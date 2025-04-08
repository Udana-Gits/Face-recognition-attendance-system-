import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import '../CSS/AttendanceConfirm.css';

function SubmitAttendance() {
    const location = useLocation();
    const { attendanceList, selectedOptionsIntake, selectedOptionsCourse } = location.state || {};
    
    const [subject, setSubject] = useState('');
    const [attendedBy, setAttendedBy] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!subject) {
            alert("Please select a subject.");
            return;
        }

        setIsSubmitting(true);

        try {
            await axios.post('http://localhost:5000/save_attendance', {
                attendanceList,
                intake: selectedOptionsIntake[0],
                course: selectedOptionsCourse[0],
                subject,
                attendedBy
            });

            alert('Attendance saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save attendance');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="attendance-confirm-container">
            <h2 className="attendance-confirm-title">Submit Attendance</h2>
            
            <div className="attendance-confirm-form">
                <div className="attendance-confirm-field">
                    <label className="attendance-confirm-label">Attendance Taker's Name:</label>
                    <input 
                        type="text" 
                        value={attendedBy}
                        onChange={(e) => setAttendedBy(e.target.value)}
                        placeholder="Enter your name"
                        className="attendance-confirm-input"
                    />
                </div>

                <div className="attendance-confirm-field">
                    <label className="attendance-confirm-label">Select Subject:</label>
                    <select 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)} 
                        className="attendance-confirm-select"
                    >
                        <option value="">-- Select Subject --</option>
                        <option value="Computer_Network">Computer Network</option>
                        <option value="Operating_Systems">Operating Systems</option>
                        <option value="Database_Systems">Database Systems</option>
                        {/* Add more subjects as needed */}
                    </select>
                </div>

                <div className="attendance-confirm-summary">
                    {selectedOptionsIntake && selectedOptionsIntake.length > 0 && (
                        <p className="attendance-confirm-detail">
                            <strong>Intake:</strong> {selectedOptionsIntake[0]}
                        </p>
                    )}
                    {selectedOptionsCourse && selectedOptionsCourse.length > 0 && (
                        <p className="attendance-confirm-detail">
                            <strong>Course:</strong> {selectedOptionsCourse[0]}
                        </p>
                    )}
                    {attendanceList && (
                        <p className="attendance-confirm-detail">
                            <strong>Total Students:</strong> {attendanceList.length}
                        </p>
                    )}
                </div>
                <div className="attendance-confirm-buttons">
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="attendance-confirm-submit-button"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Attendance'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SubmitAttendance;