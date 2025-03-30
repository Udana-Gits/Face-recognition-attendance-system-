from flask import Flask, request, jsonify
import os
import pandas as pd
from datetime import date
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow frontend to access backend

@app.route('/register', methods=['POST'])
def register():
    # Get data from React
    data = request.get_json()
    name = data['name']
    studentid = data['studentid']
    intake = data['intake']
    course = data['course']
    today = date.today().strftime('%Y-%m-%d')

    # Prepare file path
    folder_path = f"../Students/{intake}/{course}"
    os.makedirs(folder_path, exist_ok=True)

    file_name = f"{intake} {course}.xlsx"
    file_path = os.path.join(folder_path, file_name)

    # Create a new DataFrame row
    new_row = pd.DataFrame([{
        "Name": name,
        "StudentID": studentid,
        "Intake": intake,
        "Course": course,
        "Date": today
    }])

    if os.path.exists(file_path):
        # Load existing file and append new row
        df = pd.read_excel(file_path)
        df = pd.concat([df, new_row], ignore_index=True)
    else:
        # File doesn’t exist, create new DataFrame
        df = new_row

    # Save updated DataFrame to Excel
    df.to_excel(file_path, index=False)

    return jsonify({"message": "Student registered successfully!"})

if __name__ == '__main__':
    app.run(port=5000)
