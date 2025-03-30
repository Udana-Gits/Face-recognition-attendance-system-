from flask import Flask, request, jsonify
import os
import pandas as pd
import base64
import numpy as np
import cv2
from datetime import date
from flask_cors import CORS
from deepface import DeepFace
from mtcnn import MTCNN

detector = MTCNN()

app = Flask(__name__)
CORS(app)  # Allow frontend to access backend

@app.route('/register', methods=['POST'])
def register():

    createStudentEmbeddings()

    data = request.get_json()
    name = data['name']
    studentid = data['studentid']
    intake = data['intake']
    course = data['course']
    today = date.today().strftime('%Y-%m-%d')

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

    return jsonify({"message": "Student removed successfully!"})


def createStudentEmbeddings():
    data = request.get_json()
    name = data['name']
    studentid = str(data['studentid'])
    intake = data['intake']
    course = data['course']
    images = data['images']  # 30 base64 images

    # Folder path
    folder_path = os.path.join("Students", intake, course)
    os.makedirs(folder_path, exist_ok=True)

    embeddings = []

    for i, img_base64 in enumerate(images):
        img_data = base64.b64decode(img_base64.split(',')[1])
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Detect face
        results = detector.detect_faces(img)
        if not results:
            continue

        x, y, w, h = results[0]['box']
        x, y = max(0, x), max(0, y)
        cropped = img[y:y+h, x:x+w]

        if cropped.size == 0:
            continue

        # Resize and grayscale
        cropped = cv2.resize(cropped, (112, 112))
        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        gray = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)  # ArcFace expects 3 channels

        try:
            emb = DeepFace.represent(gray, model_name='ArcFace', enforce_detection=False)[0]['embedding']
            embeddings.append(emb)
        except Exception as e:
            print("Embedding error:", e)

    # Save mean embedding
    if embeddings:
        mean_embedding = np.mean(embeddings, axis=0)
        filename = f"{name}_{studentid}.npy"
        np.save(os.path.join(folder_path, filename), mean_embedding)
        return { "message": "✅ Embedding created successfully!" }

    return { "message": "❌ No valid faces found in the images." }


if __name__ == '__main__':
    app.run(port=5000)
