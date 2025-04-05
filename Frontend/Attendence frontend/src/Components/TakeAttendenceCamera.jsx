import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import '../CSS/TakeAttendenceCamera.css';

function TakeAttendenceCamera() {
    const [socket, setSocket] = useState(null);
    const [running, setRunning] = useState(false);
    const [attendanceList, setAttendanceList] = useState([]);
    const [videoFrame, setVideoFrame] = useState(null);
    const videoRef = useRef(null);
    const videoStreamRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedOptionsIntake, selectedOptionsCourse } = location.state || {};
    
    // Connect to Socket.IO when component mounts
    // In TakeAttendenceCamera.jsx
    useEffect(() => {
        // Create the socket connection
        try {
            const newSocket = io('http://localhost:5000');
            console.log('Socket connection initialized');
            
            newSocket.on('connect', () => {
                console.log('Connected to server');
                setSocket(newSocket); // Only set the socket after successful connection
            });
            
            newSocket.on('error', (error) => {
                console.error('Socket connection error:', error);
            });
            
            newSocket.on('video_frame', (data) => {
                // Update video frame with processed image from server
                if (data && data.frame) {
                    console.log('Received processed frame from server');
                    setVideoFrame(`data:image/jpeg;base64,${data.frame}`);
                }
            });
            
            newSocket.on('recognition_event', (data) => {
                if (data.type === 'recognition') {
                    const recognizedName = data.name;
                    console.log(`Recognized: ${recognizedName} (similarity: ${data.similarity})`);
                    
                    // Add to attendance list if not already present
                    const currentTime = new Date().toLocaleTimeString();
                    const [studentName, studentId] = recognizedName.split('_');
                    
                    setAttendanceList(prevList => {
                        // Check if student is already in the list
                        if (!prevList.some(student => student.id === studentId)) {
                            console.log(`Adding student to attendance: ${studentName} (${studentId})`);
                            return [...prevList, {
                                id: studentId,
                                name: studentName,
                                time: currentTime
                            }];
                        }
                        return prevList;
                    });
                }
            });
            
            return () => {
                // Clean up on component unmount
                if (captureIntervalRef.current) {
                    clearInterval(captureIntervalRef.current);
                }
                
                if (videoStreamRef.current) {
                    const tracks = videoStreamRef.current.getTracks();
                    tracks.forEach(track => track.stop());
                }
                
                newSocket.disconnect();
            };
        } catch (err) {
            console.error('Failed to initialize socket:', err);
        }
    }, []);
    
    // Start the camera and begin sending frames to server
    // In the startDetection function
    const startDetection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoStreamRef.current = stream;
            
            // Initialize local video preview
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                console.log('Video stream started');
            }
            
            // Check if socket exists before using it
            if (socket) {
                console.log('Sending start_recognition to server');
                socket.emit('start_recognition', {
                    intake: selectedOptionsIntake,
                    course: selectedOptionsCourse
                }, (response) => {
                    console.log('Received start_recognition response:', response);
                    if (response && response.status === 'success') {
                        setRunning(true);
                        console.log('Recognition started successfully, setting running=true');
                        
                        // Start sending frames to server
                        captureIntervalRef.current = setInterval(() => {
                            captureAndSendFrame();
                        }, 500); // Send frame every 500ms
                    } else {
                        alert('Failed to start recognition: ' + (response ? response.message : 'Unknown error'));
                    }
                });
            } else {
                alert('Socket connection not established. Please refresh the page.');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Cannot access camera. Please check permissions.');
        }
    };
    
    // Capture frame from video and send to server
    // Capture frame from video and send to server
    const captureAndSendFrame = () => {
        if (!running || !socket) {
            console.log('Not capturing frame: running=', running, 'socket=', !!socket);
            return;
        }
        
        const video = videoRef.current;
        if (!video || !video.videoWidth) {
            console.error('Video element not initialized properly');
            return;
        }
        
        console.log('Capturing and sending frame');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 and send to server
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        if (socket) {
            socket.emit('process_frame', { image: imageData });
        }
    };
    
    // Stop detection
    const stopDetection = () => {
        if (!running) return;
        
        setRunning(false);
        
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        
        if (socket) {
            socket.emit('stop_recognition', (response) => {
                console.log('Recognition stopped:', response);
            });
        }
        
        if (videoStreamRef.current) {
            const tracks = videoStreamRef.current.getTracks();
            tracks.forEach(track => track.stop());
            videoStreamRef.current = null;
        }
        
        // Clear the video frame
        setVideoFrame(null);
    };
    
    const goBack = () => {
        // Make sure to stop everything before navigating away
        stopDetection();
        navigate('/attendencepage');
    };

    return (
        <div className="split-container">
            <div className="left-pane">
                <div className="camera_canvas">
                    {running && videoFrame ? (
                        // Display processed frames from server with bounding boxes
                        <img 
                            src={videoFrame} 
                            alt="Processed video feed"
                            width="600" 
                            height="480" 
                            style={{ border: '2px solid #333' }} 
                        />
                    ) : (
                        // Local video preview (before processing)
                        <video 
                            ref={videoRef} 
                            width="600" 
                            height="480" 
                            autoPlay 
                            style={{ border: '2px solid #333' }} 
                        />
                    )}
                </div>
                <div className="control-buttons">
                    <button type="button" onClick={startDetection} disabled={running}>
                        Start Recognition
                    </button>
                    <button type="button" onClick={stopDetection} disabled={!running}>
                        Stop Recognition
                    </button>
                    <button type="button" onClick={goBack}>
                        Back
                    </button>
                </div>
            </div>
            <div className="right-pane">
                <h2>Attendance List</h2>
                <p>Total Students: {attendanceList.length}</p>
                <table className="attendence_table">
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendanceList.length > 0 ? (
                            attendanceList.map((student) => (
                                <tr key={student.id}>
                                    <td>{student.id}</td>
                                    <td>{student.name}</td>
                                    <td>{student.time}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center' }}>No students detected yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>  
            </div>
        </div>
    );
}

export default TakeAttendenceCamera;