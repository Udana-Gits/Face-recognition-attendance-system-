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
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import date
from deepface import DeepFace
from mtcnn import MTCNN
from PIL import Image
from numpy.linalg import norm
from datetime import datetime

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
            intake = intake_item[0] if isinstance(intake_item, list) else intake_item
            course = course_item[0] if isinstance(course_item, list) else course_item

            path = os.path.join(base_path, intake, course)
            if os.path.exists(path):
                for file in os.listdir(path):
                    if file.endswith('.npy'):
                        name = file.replace('.npy', '')
                        try:
                            embedding = np.load(os.path.join(path, file))
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


# In the process_frame function in app.py
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
            print("❌ Image is empty or invalid")
            socketio.emit('frame_processed')
            return

        # Fast face detection with minimal parameters
        try:
            results = detector.detect_faces(img)
            print(f"👁️ Detected {len(results)} faces in frame")
        except Exception as e:
            print(f"❌ Face detection error: {e}")
            socketio.emit('frame_processed')
            return

        if not results:
            print("⚠️ No faces detected in this frame")
            socketio.emit('frame_processed')
            return

        # Process faces at various distances
        faces_processed = False

        # Sort faces by size (area), largest first
        sorted_faces = sorted(results, key=lambda x: x['box'][2] * x['box'][3], reverse=True)

        # Emit all detected faces for debugging
        for i, face in enumerate(sorted_faces):
            socketio.emit('face_detected', {
                'index': i,
                'box': face['box'],
                'confidence': float(face['confidence'])
            })

        # Process up to 3 largest faces for efficiency
        for i, face in enumerate(sorted_faces[:3]):
            x, y, w, h = face["box"]
            confidence = face["confidence"]
            print(f"🔍 Processing face #{i + 1}: Size {w}x{h}, Confidence: {confidence:.2f}")

            # Skip extremely small faces (probably too far)
            if w < 15 or h < 15:
                print(f"⏭️ Skipping face #{i + 1}: Too small ({w}x{h})")
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
                    print(f"⏭️ Skipping face #{i + 1}: Cropped size too small")
                    continue

                # Pre-resize the image to exactly what ArcFace needs to avoid extra processing
                resized_face = cv2.resize(face_img, (112, 112))

                # Get embedding with optimized settings
                try:
                    embedding_result = DeepFace.represent(
                        resized_face,
                        model_name='ArcFace',
                        enforce_detection=False,
                        detector_backend='skip'  # Skip detection since we already did it
                    )
                    print(f"✅ Successfully generated embedding for face #{i + 1}")
                except Exception as e:
                    print(f"❌ Failed to generate embedding for face #{i + 1}: {e}")
                    # Still emit this face for visualization
                    socketio.emit('unrecognized_face', {
                        'box': [x, y, w, h],
                        'error': str(e)
                    })
                    continue

                if not embedding_result:
                    print(f"⚠️ Empty embedding result for face #{i + 1}")
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

                    print(f"🔍 Face #{i + 1} - Best match: {best_match}, Similarity: {best_similarity:.4f}")

                    # Adjust threshold based on face size
                    # Smaller faces (further away) may need a lower threshold
                    threshold = 0.75
                    if w < 30:  # Far faces
                        threshold = 0.72


                    if best_similarity <= threshold:
                        print(
                            f"⚠️ Face #{i + 1} - Best match below threshold: {best_match} ({best_similarity:.4f} < {threshold})")
                        socketio.emit('below_threshold_match', {
                            'name': best_match,
                            'similarity': float(best_similarity),
                            'threshold': threshold,
                            'box': [x, y, w, h]
                        })
                        continue

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
                        print(f"✅ Recognition: {best_match} ({best_similarity:.2f}) - "
                              f"Processing: {(time.time() - start_time) * 1000:.0f}ms, "
                              f"Latency: {(time.time() - (client_timestamp / 1000)) * 1000:.0f}ms")
                else:
                    print("⚠️ No embeddings loaded - cannot recognize faces")
                    socketio.emit('unrecognized_face', {
                        'box': [x, y, w, h],
                        'error': 'No embeddings loaded'
                    })

            except Exception as e:
                print(f"❌ Recognition error for face #{i + 1}: {e}")
                socketio.emit('unrecognized_face', {
                    'box': [x, y, w, h],
                    'error': str(e)
                })
                continue

        if not faces_processed:
            print("ℹ️ No faces successfully processed to recognition stage")

    except Exception as e:
        print(f"❌ Frame processing error: {e}")

    # Always emit frame_processed to unblock client
    socketio.emit('frame_processed')


@socketio.on('stop_recognition')
def stop_recognition():
    # Clear recognition cache when stopping
    global recent_recognitions
    recent_recognitions = {}
    return {'status': 'success', 'message': 'Recognition stopped'}



@app.route('/save_attendance', methods=['POST'])
def save_attendance():
    data = request.get_json()
    intake = data['intake']
    course = data['course']
    subject = data['subject']
    attendance_list = data['attendanceList']
    today = date.today().strftime('%d-%m-%Y')

    folder_path = f"../Students/{intake}/{course}/attendence"
    os.makedirs(folder_path, exist_ok=True)

    file_name = f"{intake} {course} {subject} attendence.xlsx"
    file_path = os.path.join(folder_path, file_name)

    # Convert list of students into a dict keyed by ID for easier update
    present_ids = {student['id']: student['name'] for student in attendance_list}

    if os.path.exists(file_path):
        df = pd.read_excel(file_path)
    else:
        df = pd.DataFrame(columns=["StudentID", "Name"])

    # Ensure 'StudentID' is string
    df['StudentID'] = df['StudentID'].astype(str)

    # Mark attendance
    for index, row in df.iterrows():
        student_id = str(row['StudentID'])
        df.at[index, today] = '✅' if student_id in present_ids else '❌'

    # Add new students if not already in the sheet
    for student_id, name in present_ids.items():
        if not (df['StudentID'] == student_id).any():
            new_row = {
                "StudentID": student_id,
                "Name": name,
                today: '✅'
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    df.to_excel(file_path, index=False)
    return jsonify({"message": "Attendance saved successfully!"})


# Add this route to your Flask backend (app.js)

@app.route('/api/attendance/student/<student_id>', methods=['GET'])
def get_student_attendance(student_id):
    intake = request.args.get('intake')
    course = request.args.get('course')

    if not intake or not course:
        return jsonify({"error": "Both intake and course are required"}), 400

    folder_path = f"../Students/{intake}/{course}/attendence"

    # Check if folder exists
    if not os.path.exists(folder_path):
        return jsonify({"error": f"No data found for {intake} {course}"}), 404

    # Get all attendance Excel files for this intake and course
    attendance_files = [f for f in os.listdir(folder_path) if f.endswith('.xlsx') and 'attendence' in f]

    if not attendance_files:
        return jsonify({"error": "No attendance records found"}), 404

    student_name = ""
    subjects_data = []

    # Process each attendance file (representing a subject)
    for file_name in attendance_files:
        file_path = os.path.join(folder_path, file_name)

        # Extract subject name from file name
        # Format: "intake course subject attendence.xlsx"
        parts = file_name.split(" ")
        if len(parts) < 3:
            continue  # Skip if filename format doesn't match expected pattern

        # Extract subject name (all parts except intake, course, and "attendence.xlsx")
        subject_name = " ".join(parts[2:-1])  # Skip intake, course, and "attendence.xlsx"

        try:
            df = pd.read_excel(file_path)

            # Ensure 'StudentID' is string
            df['StudentID'] = df['StudentID'].astype(str)

            # Find the student in the Excel file
            student_row = df[df['StudentID'] == student_id]

            if student_row.empty:
                # Student not found in this subject
                subjects_data.append({
                    "name": subject_name,
                    "percentage": 0
                })
                continue

            # Get student name if not already set
            if not student_name and 'Name' in student_row.columns:
                student_name = student_row['Name'].iloc[0]

            # Calculate attendance percentage
            date_columns = [col for col in df.columns if col not in ['StudentID', 'Name']]

            if not date_columns:
                subjects_data.append({
                    "name": subject_name,
                    "percentage": 0
                })
                continue

            present_count = 0
            for date_col in date_columns:
                if student_row[date_col].iloc[0] == '✅':
                    present_count += 1

            attendance_percentage = (present_count / len(date_columns)) * 100

            subjects_data.append({
                "name": subject_name,
                "percentage": attendance_percentage
            })

        except Exception as e:
            print(f"Error processing {file_name}: {str(e)}")
            # Continue with other files even if one fails

    return jsonify({
        "name": student_name,
        "subjects": subjects_data
    })


@app.route('/api/intakes', methods=['GET'])
def get_intakes():
    # Return the list of intakes based on folder structure
    try:
        base_dir = "../Students"
        intakes = [folder for folder in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, folder))]
        return jsonify(intakes)
    except Exception as e:
        print(f"Error getting intakes: {str(e)}")
        return jsonify([])


@app.route('/api/courses', methods=['GET'])
def get_courses():
    intake = request.args.get('intake')
    if not intake:
        return jsonify({"error": "Intake parameter is required"}), 400

    try:
        base_dir = f"../Students/{intake}"
        if not os.path.exists(base_dir):
            return jsonify([])

        courses = [folder for folder in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, folder))]
        return jsonify(courses)
    except Exception as e:
        print(f"Error getting courses: {str(e)}")
        return jsonify([])


@app.route('/api/attendance/intake/<intake>/course/<course>', methods=['GET'])
def get_intake_attendance(intake, course):
    folder_path = f"../Students/{intake}/{course}/attendence"

    # Check if folder exists
    if not os.path.exists(folder_path):
        return jsonify({"error": f"No data found for {intake} {course}"}), 404

    # Get all attendance Excel files for this intake and course
    attendance_files = [f for f in os.listdir(folder_path) if f.endswith('.xlsx') and 'attendence' in f]

    if not attendance_files:
        return jsonify({"error": "No attendance records found"}), 404

    # Dictionary to store student attendance data by subject
    students_data = {}

    # Dictionary to store daily attendance counts for graph
    graph_data = {}

    # Process each attendance file (representing a subject)
    for file_name in attendance_files:
        file_path = os.path.join(folder_path, file_name)

        # Extract subject name from file name
        parts = file_name.split(" ")
        if len(parts) < 3:
            continue

        subject_name = " ".join(parts[2:-1])

        try:
            df = pd.read_excel(file_path)

            # Ensure 'StudentID' is string
            df['StudentID'] = df['StudentID'].astype(str)

            # Get date columns (all columns except 'StudentID' and 'Name')
            date_columns = [col for col in df.columns if col not in ['StudentID', 'Name']]

            # Process each student's attendance for this subject
            for _, row in df.iterrows():
                student_id = row['StudentID']
                student_name = row['Name'] if 'Name' in row else "Unknown"

                # Initialize student record if not exists
                if student_id not in students_data:
                    students_data[student_id] = {
                        "id": student_id,
                        "name": student_name,
                        "subjects": {}
                    }

                # Calculate attendance percentage for this subject
                present_count = 0
                for date_col in date_columns:
                    if row[date_col] == '✅':
                        present_count += 1

                        # Update graph data for this date and subject
                        if date_col not in graph_data:
                            graph_data[date_col] = {}

                        if subject_name not in graph_data[date_col]:
                            graph_data[date_col][subject_name] = 0

                        graph_data[date_col][subject_name] += 1

                attendance_percentage = (present_count / len(date_columns)) * 100 if date_columns else 0
                students_data[student_id]["subjects"][subject_name] = attendance_percentage

        except Exception as e:
            print(f"Error processing {file_name}: {str(e)}")

    # Format graph data for charting
    formatted_graph_data = []
    for date, subjects in graph_data.items():
        date_entry = {"date": date}
        date_entry.update(subjects)
        formatted_graph_data.append(date_entry)

    # Sort graph data by date
    formatted_graph_data.sort(key=lambda x: x["date"])

    return jsonify({
        "studentsData": list(students_data.values()),
        "graphData": formatted_graph_data
    })






if __name__ == '__main__':
    # For development with socketio
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

    # Comment out the regular Flask run
    # app.run(port=5000, threaded=True)