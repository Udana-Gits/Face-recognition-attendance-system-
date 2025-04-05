import eventlet
eventlet.monkey_patch()

import os
import pandas as pd
import base64
import numpy as np
import cv2
import io
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import date
from deepface import DeepFace
from mtcnn import MTCNN
from PIL import Image
from numpy.linalg import norm

detector = MTCNN()

app = Flask(__name__)
CORS(app)  # Allow frontend to access backend
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

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


loaded_embeddings = {}


@app.route('/load-embeddings', methods=['POST'])
def load_student_embeddings():
    global loaded_embeddings
    data = request.get_json()
    intakes = data['intakes']
    courses = data['courses']

    base_path = 'Students'
    loaded_embeddings.clear()
    count = 0

    for intake in intakes:
        for course in courses:
            path = os.path.join(base_path, intake, course)
            if os.path.exists(path):
                for file in os.listdir(path):
                    if file.endswith('.npy'):
                        name = file.replace('.npy', '')
                        try:
                            embedding = np.load(os.path.join(path, file))
                            loaded_embeddings[name] = embedding
                            count += 1
                        except Exception as e:
                            print(f"Error loading embedding {file}: {e}")

    print(f"Loaded {count} embeddings")
    return jsonify({
        "message": f"Loaded {count} student embeddings successfully.",
        "count": count
    })


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
def start_recognition(data, callback=None):  # Make sure to accept the callback parameter
    global loaded_embeddings
    print(f"Starting recognition with {len(loaded_embeddings)} loaded embeddings")
    # Store session data like selected intakes and courses
    intake = data['intake']
    course = data['course']

    # Call the callback to acknowledge receipt and send back status
    if callback:
        callback({'status': 'success', 'message': 'Recognition started'})

    return {'status': 'success', 'message': 'Recognition started'}


@socketio.on('process_frame')
def process_frame(data):
    print("Received frame for processing")
    try:
        # Decode the image
        img_data = data['image'].split(',')[1]
        img_bytes = base64.b64decode(img_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Run face detection
        results = detector.detect_faces(img)
        print(f"Face detection results: {len(results)} faces found")

        # Process each detected face
        for face in results:
            x, y, w, h = face["box"]

            # Draw bounding box
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 3)

            # Crop face for recognition
            cropped = img[y:y + h, x:x + w]
            try:
                # Get embedding and find match
                emb = DeepFace.represent(cropped, model_name='ArcFace', enforce_detection=False)[0]['embedding']

                # Find best match
                best_match = None
                best_similarity = 0

                for name, saved_emb in loaded_embeddings.items():
                    similarity = cosine_similarity(emb, saved_emb)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_match = name

                # If match found with good confidence
                if best_similarity > 0.75:
                    # Draw name above face
                    cv2.rectangle(img, (x, y - 30), (x + 200, y), (0, 0, 0), -1)
                    cv2.putText(img, best_match, (x + 5, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

                    # Emit recognition event
                    socketio.emit('recognition_event', {
                        'type': 'recognition',
                        'name': best_match,
                        'similarity': float(best_similarity)
                    })
            except Exception as e:
                print(f"Error recognizing face: {e}")

        # Convert processed image back to base64
        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')

        print(f"Sending processed frame with {len(results)} bounding boxes")

        # Send processed frame back to client
        socketio.emit('video_frame', {'frame': processed_image})

    except Exception as e:
        print(f"Error in process_frame: {e}")
        socketio.emit('error', {'message': str(e)})


@socketio.on('stop_recognition')
def stop_recognition():
    # Any cleanup needed when stopping
    return {'status': 'success', 'message': 'Recognition stopped'}


if __name__ == '__main__':
    # For development with socketio
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

    # Comment out the regular Flask run
    # app.run(port=5000, threaded=True)