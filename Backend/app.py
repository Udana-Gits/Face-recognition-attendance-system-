import eventlet

eventlet.monkey_patch()

import os
import pandas as pd
import base64
import numpy as np
import cv2
import io
import time
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import date
from deepface import DeepFace
from mtcnn import MTCNN
from PIL import Image
from numpy.linalg import norm

detector = MTCNN()

loaded_embeddings = {}
processing_lock = threading.Lock()

app = Flask(__name__)
CORS(app)  # Allow frontend to access backend
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', ping_timeout=10, ping_interval=5)

recent_recognitions = {}


# Add WebSocket functionality
@socketio.on('connect')
def handle_connect():
    print('Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data['name']
    studentid = data['studentid']
    intake = data['intake']
    course = data['course']
    today = date.today().strftime('%Y-%m-%d')

    # First create student embeddings
    embedding_result = create_student_embeddings(data)
    if "error" in embedding_result:
        return jsonify({"message": embedding_result["error"]}), 400

    folder_path = f"../Students/{intake}/{course}"
    os.makedirs(folder_path, exist_ok=True)

    file_name = f"{intake} {course}.xlsx"
    file_path = os.path.join(folder_path, file_name)

    new_row = pd.DataFrame([{
        "Name": name,
        "StudentID": studentid,
        "Intake": intake,
        "Course": course,
        "Date": today
    }])

    if os.path.exists(file_path):
        df = pd.read_excel(file_path)

        # 🔒 Convert all StudentID values to string and strip spaces
        df['StudentID'] = df['StudentID'].astype(str).str.strip()
        cleaned_studentid = str(studentid).strip()

        # ✅ Now check for duplicates
        if cleaned_studentid in df['StudentID'].values:
            print(f"Duplicate found for ID: {cleaned_studentid}")
            return jsonify({"message": "Student ID already registered!"}), 400

        df = pd.concat([df, new_row], ignore_index=True)

    else:
        df = new_row

    df.to_excel(file_path, index=False)
    print(f"Registered: {studentid} - {name}")
    return jsonify({"message": "Student registered successfully!"})


@app.route('/remove-student', methods=['POST'])
def remove_student():
    data = request.get_json()
    name = data['name'].strip().lower()
    studentid = str(data['studentid']).strip()
    intake = data['intake']
    course = data['course']

    file_path = os.path.join(f"../Students/{intake}/{course}", f"{intake} {course}.xlsx")

    if not os.path.exists(file_path):
        return jsonify({"message": "File not found for given intake and course."}), 404

    df = pd.read_excel(file_path)

    # Normalize for case-insensitive comparison
    df['StudentID'] = df['StudentID'].astype(str).str.strip()
    df['Name'] = df['Name'].astype(str).str.strip().str.lower()

    # Check if row exists
    match = (df['StudentID'] == studentid) & (df['Name'] == name)

    if match.sum() == 0:
        return jsonify({"message": "No matching student found."}), 404

    # Remove matching rows
    df = df[~match]

    # Save the updated file
    df.to_excel(file_path, index=False)

    # Also remove the embedding file if it exists
    embedding_path = os.path.join(f"Students/{intake}/{course}", f"{name}_{studentid}.npy")
    if os.path.exists(embedding_path):
        os.remove(embedding_path)
        print(f"Removed embedding file: {embedding_path}")

    return jsonify({"message": "Student removed successfully!"})


# New endpoint to handle load-embeddings request
@app.route('/load-embeddings', methods=['POST'])
def load_embeddings():
    data = request.get_json()
    intakes = data.get('intakes', [])
    courses = data.get('courses', [])

    if not intakes or not courses:
        return jsonify({"message": "Missing intake or course information"}), 400

    try:
        count = load_embeddings_for_courses(intakes, courses)
        return jsonify({
            "message": f"Successfully loaded {count} embeddings",
            "count": count
        })
    except Exception as e:
        print(f"Error loading embeddings: {e}")
        return jsonify({"message": f"Error loading embeddings: {str(e)}"}), 500


def create_student_embeddings(data):
    name = data['name']
    studentid = str(data['studentid'])
    intake = data['intake']
    course = data['course']
    images = data['images']  # 30 base64 images

    # Folder path
    folder_path = os.path.join("Students", intake, course)
    os.makedirs(folder_path, exist_ok=True)

    embeddings = []
    valid_images = 0

    for i, img_base64 in enumerate(images):
        try:
            # Skip the data URL prefix if present
            if ',' in img_base64:
                img_data = base64.b64decode(img_base64.split(',')[1])
            else:
                img_data = base64.b64decode(img_base64)

            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None or img.size == 0:
                print(f"Image {i} is invalid")
                continue

            # Detect face
            results = detector.detect_faces(img)
            if not results:
                print(f"No face detected in image {i}")
                continue

            x, y, w, h = results[0]['box']
            x, y = max(0, x), max(0, y)
            cropped = img[y:y + h, x:x + w]

            if cropped.size == 0:
                print(f"Cropped face in image {i} is empty")
                continue

            # Resize and preprocess
            cropped = cv2.resize(cropped, (112, 112))

            # Get embedding
            try:
                emb = DeepFace.represent(cropped, model_name='ArcFace', enforce_detection=False)[0]['embedding']
                embeddings.append(emb)
                valid_images += 1
                print(f"Processed image {i} successfully")
            except Exception as e:
                print(f"Embedding error for image {i}: {e}")

        except Exception as e:
            print(f"Error processing image {i}: {e}")

    # Save mean embedding
    if embeddings:
        mean_embedding = np.mean(embeddings, axis=0)
        filename = f"{name}_{studentid}.npy"
        np.save(os.path.join(folder_path, filename), mean_embedding)
        print(f"Created embedding from {valid_images} valid images")
        return {"success": f"Embedding created from {valid_images} images"}
    else:
        print("No valid faces found in the images")
        return {"error": "No valid faces found in the images"}


def load_embeddings_for_courses(intakes, courses):
    """Load embeddings for specific intakes and courses"""
    global loaded_embeddings

    base_path = 'Students'
    loaded_embeddings.clear()
    count = 0

    # Make sure we're working with lists
    if not isinstance(intakes, list):
        intakes = [intakes]
    if not isinstance(courses, list):
        courses = [courses]

    for intake_item in intakes:
        for course_item in courses:
            # Extract the string from each item if it's a list
            intake = intake_item[0] if isinstance(intake_item, list) else intake_item
            course = course_item[0] if isinstance(course_item, list) else course_item

            path = os.path.join(base_path, intake, course)
            if os.path.exists(path):
                for file in os.listdir(path):
                    if file.endswith('.npy'):
                        name = file.replace('.npy', '')
                        try:
                            embedding = np.load(os.path.join(path, file))
                            # Normalize embedding for faster comparison later
                            embedding = embedding / np.linalg.norm(embedding)
                            loaded_embeddings[name] = embedding
                            count += 1
                        except Exception as e:
                            print(f"Error loading embedding {file}: {e}")

    print(f"Loaded {count} embeddings")
    return count


def cosine_similarity(a, b):
    return np.dot(a, b) / (norm(a) * norm(b))


@app.route('/recognize-face', methods=['POST'])
def recognize_face():
    global loaded_embeddings
    start = time.time()

    # Check if embeddings are loaded
    if not loaded_embeddings:
        return jsonify({"message": "No embeddings loaded. Please load embeddings first."}), 400

    data = request.get_json()

    try:
        # Process the incoming image
        img_data = data['image'].split(',')[1]
        img_bytes = base64.b64decode(img_data)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        img_np = np.array(img)

        # Detect faces in the image
        faces = detector.detect_faces(img_np)
        if not faces:
            print("⚠️ No face detected")
            return jsonify({"message": "No face detected"}), 400

        # Process the detected face
        face = faces[0]
        x, y, w, h = face["box"]
        print(f"🔍 Face detected at: {x},{y},{w},{h}")

        # Crop and preprocess the face
        cropped_face = img_np[y:y + h, x:x + w]
        cropped_face = cv2.resize(cropped_face, (112, 112))

        # Generate embedding for the detected face
        try:
            new_embedding = DeepFace.represent(cropped_face, model_name='ArcFace', enforce_detection=False)[0][
                'embedding']
        except Exception as e:
            print(f"❌ Embedding error: {e}")
            return jsonify({"message": "Failed to generate face embedding"}), 400

        # Find the best match
        best_match = None
        best_similarity = 0

        for name, saved_emb in loaded_embeddings.items():
            similarity = cosine_similarity(new_embedding, saved_emb)
            print(f"Similarity with {name}: {similarity:.4f}")

            if similarity > best_similarity:
                best_similarity = similarity
                best_match = name

        # Check if the best match exceeds the threshold
        if best_similarity > 0.75:
            print(f"✅ Recognized {best_match} (similarity: {best_similarity:.4f})")
            elapsed = time.time() - start
            print(f"🕒 Processing time: {elapsed:.2f}s")
            return jsonify({"name": best_match, "box": [x, y, w, h], "similarity": float(best_similarity)})
        else:
            print(f"❌ Best match {best_match} with similarity {best_similarity:.4f} below threshold")
            return jsonify({"message": "Person not recognized", "best_match": best_match,
                            "similarity": float(best_similarity)}), 404

    except Exception as e:
        print(f"Error in face recognition: {e}")
        return jsonify({"message": f"Error processing image: {str(e)}"}), 500


@socketio.on('start_recognition')
def start_recognition(data, callback=None):
    global recent_recognitions

    # Clear the recognition cache when starting
    recent_recognitions = {}

    # Get intake and course as strings
    intake = data.get('intake')
    course = data.get('course')

    # Print the received data for debugging
    print(f"Received data: intake={intake}, course={course}")

    # If they're lists, take the first item
    if isinstance(intake, list):
        intake = intake[0]
    if isinstance(course, list):
        course = course[0]

    # Now they should be strings
    print(f"Using intake={intake}, course={course}")

    # Load embeddings for faster matching - pass strings
    load_embeddings_for_courses(intake, course)

    print(f"Recognition started with {len(loaded_embeddings)} loaded embeddings")

    if callback:
        callback({'status': 'success', 'message': 'Recognition started'})

    return {'status': 'success', 'message': 'Recognition started'}


@socketio.on('process_frame')
def process_frame(data):
    # Track processing time
    start_time = time.time()
    client_timestamp = data.get('timestamp', 0)

    try:
        # Extract image data
        img_data = data['image'].split(',')[1]
        img_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            socketio.emit('frame_processed')
            return

        # Fast face detection with minimal parameters
        try:
            results = detector.detect_faces(img)
        except Exception as e:
            print(f"Face detection error: {e}")
            socketio.emit('frame_processed')
            return

        if not results:
            socketio.emit('frame_processed')
            return

        # Process faces at various distances
        faces_processed = False

        # Sort faces by size (area), largest first
        sorted_faces = sorted(results, key=lambda x: x['box'][2] * x['box'][3], reverse=True)

        # Process up to 3 largest faces for efficiency
        for face in sorted_faces[:3]:
            x, y, w, h = face["box"]

            # Skip extremely small faces (probably too far)
            if w < 15 or h < 15:
                continue

            # Adjust padding based on face size
            padding_factor = 0.05  # Default padding
            if w > 100:  # Close face
                padding_factor = 0.02  # Less padding needed for large faces
            elif w < 30:  # Far face
                padding_factor = 0.1  # More padding for small faces

            padding_x = int(w * padding_factor)
            padding_y = int(h * padding_factor)

            try:
                # Ensure coordinates are within bounds
                x_start = max(0, x - padding_x)
                y_start = max(0, y - padding_y)
                x_end = min(img.shape[1], x + w + padding_x)
                y_end = min(img.shape[0], y + h + padding_y)

                face_img = img[y_start:y_end, x_start:x_end]

                # Skip tiny crops that might cause errors
                if face_img.shape[0] < 10 or face_img.shape[1] < 10:
                    continue

                # Pre-resize the image to exactly what ArcFace needs to avoid extra processing
                resized_face = cv2.resize(face_img, (112, 112))

                # Get embedding with optimized settings
                embedding_result = DeepFace.represent(
                    resized_face,
                    model_name='ArcFace',
                    enforce_detection=False,
                    detector_backend='skip'  # Skip detection since we already did it
                )

                if not embedding_result:
                    continue

                emb = embedding_result[0]['embedding']

                # Find best match using vectorized operations for speed
                if loaded_embeddings:
                    # Get all embeddings as a matrix for fast comparison
                    names = list(loaded_embeddings.keys())
                    embeddings_matrix = np.array([loaded_embeddings[name] for name in names])

                    # Compute similarities in one go
                    emb_normalized = emb / np.linalg.norm(emb)
                    similarities = np.dot(embeddings_matrix, emb_normalized)

                    # Find best match
                    best_idx = np.argmax(similarities)
                    best_similarity = similarities[best_idx]
                    best_match = names[best_idx]

                    # Adjust threshold based on face size
                    # Smaller faces (further away) may need a lower threshold
                    threshold = 0.75
                    if w < 30:  # Far faces
                        threshold = 0.72  # Slightly more forgiving for distant faces

                    # Set a stricter threshold for more accurate recognition
                    if best_similarity > threshold:
                        # Check if we just recognized this person to avoid duplicates
                        current_time = time.time()
                        if best_match in recent_recognitions:
                            # Only re-emit if it's been at least 1 second
                            if current_time - recent_recognitions[best_match] < 1.0:
                                continue

                        # Update recognition time
                        recent_recognitions[best_match] = current_time
                        faces_processed = True

                        # Emit recognition event
                        socketio.emit('recognition_event', {
                            'type': 'recognition',
                            'name': best_match,
                            'similarity': float(best_similarity),
                            'box': [x, y, w, h],
                            'processing_time': time.time() - start_time,
                            'latency': time.time() - (client_timestamp / 1000)
                        })

                        # Log performance metrics
                        print(f"Recognition: {best_match} ({best_similarity:.2f}) - "
                              f"Processing: {(time.time() - start_time) * 1000:.0f}ms, "
                              f"Latency: {(time.time() - (client_timestamp / 1000)) * 1000:.0f}ms")

            except Exception as e:
                print(f"Recognition error for face: {e}")
                continue

        if not faces_processed:
            print("No faces successfully processed")

    except Exception as e:
        print(f"Frame processing error: {e}")

    # Always emit frame_processed to unblock client
    socketio.emit('frame_processed')


@socketio.on('stop_recognition')
def stop_recognition():
    # Clear recognition cache when stopping
    global recent_recognitions
    recent_recognitions = {}
    return {'status': 'success', 'message': 'Recognition stopped'}


if __name__ == '__main__':
    # For development with socketio
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

    # Comment out the regular Flask run
    # app.run(port=5000, threaded=True)