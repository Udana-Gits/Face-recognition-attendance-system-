import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import '../CSS/TakeAttendenceCamera.css';

function TakeAttendenceCamera() {
    const [socket, setSocket] = useState(null);
    const [running, setRunning] = useState(false);
    const [attendanceList, setAttendanceList] = useState([]);
    // Modified to track attendance by intake/course instead of debug info
    const [attendanceSummary, setAttendanceSummary] = useState({
        // Example format: { "intake 40 computer science": 4, "intake 39 software engineering": 3 }
    });
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const videoStreamRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const frameCountRef = useRef(0);
    const navigate = useNavigate();
    const location = useLocation();
    const runningRef = useRef(false);
    const trackedFacesRef = useRef({});
    const unrecognizedFacesRef = useRef({});
    const belowThresholdFacesRef = useRef({});
    const pendingFramesRef = useRef(0); // Track pending frame requests
    const maxPendingFrames = 2; // Don't send more frames if we have this many pending

    const { selectedOptionsIntake, selectedOptionsCourse } = location.state || {};

    useEffect(() => {
        // Create socket with lower latency settings
        const newSocket = io('http://localhost:5000', {
            transports: ['websocket'], // Force WebSocket transport
            forceNew: true,
            reconnectionDelay: 500,
            timeout: 5000
        });
        
        setSocket(newSocket);
    
        newSocket.on('connect', () => console.log('Connected to server'));
        
        // Handle server responses
        newSocket.on('recognition_event', (data) => {
            // Decrement pending frames counter when we get a response
            pendingFramesRef.current = Math.max(0, pendingFramesRef.current - 1);
            
            if (data.type === 'recognition' && runningRef.current) {
                const { name, similarity, box } = data;
                const [studentName, studentId] = name.split('_');
                const currentTime = new Date().toLocaleTimeString();
    
                setAttendanceList(prevList => {
                    if (!prevList.some(s => s.id === studentId)) {
                        // Extract intake and course from student data
                        // This assumes the studentId contains or can map to intake/course info
                        // You may need to adjust this based on your actual data structure
                        const studentIntakeCourse = extractIntakeCourse(name, studentId);
                        
                        // Update the attendance summary
                        updateAttendanceSummary(studentIntakeCourse);
                        
                        return [...prevList, { id: studentId, name: studentName, time: currentTime }];
                    }
                    return prevList;
                });
    
                // Update tracking with the latest face position
                updateTrackedFace(studentId, box, studentName, 'recognized', similarity);
            }
        });

        // New event handler for detected faces
        newSocket.on('face_detected', (data) => {
            console.log(`Face detected: ${JSON.stringify(data)}`);
        });

        // New event handler for unrecognized faces
        newSocket.on('unrecognized_face', (data) => {
            console.log(`Unrecognized face: ${JSON.stringify(data)}`);
            const { box, error } = data;
            const faceId = `unrecognized_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            updateTrackedFace(faceId, box, "Unknown", 'unrecognized');
        });

        // New event handler for below-threshold matches
        newSocket.on('below_threshold_match', (data) => {
            console.log(`Below threshold match: ${JSON.stringify(data)}`);
            const { name, similarity, box, threshold } = data;
            const [studentName, studentId] = name.split('_');
            
            updateTrackedFace(
                `threshold_${studentId || Date.now()}`, 
                box, 
                `${studentName || 'Unknown'}`, 
                'belowThreshold',
                similarity
            );
        });

        // Handle frame_processed event to track pending frames
        newSocket.on('frame_processed', () => {
            pendingFramesRef.current = Math.max(0, pendingFramesRef.current - 1);
        });
    
        return () => {
            newSocket.disconnect();
            if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
            if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Helper function to extract intake and course from student data
    // This is a placeholder - you'll need to adapt this based on your data structure
    const extractIntakeCourse = (name, studentId) => {
        // For demonstration, we're using sample data
        // In a real app, you would determine this from the student records
        
        // This is just example logic - replace with actual logic
        const firstDigit = studentId.toString().charAt(0);
        if (parseInt(firstDigit) % 2 === 0) {
            return "intake 40 computer science";
        } else {
            return "intake 39 software engineering";
        }
    };

    // Update attendance summary count when a new student is recognized
    const updateAttendanceSummary = (intakeCourse) => {
        setAttendanceSummary(prev => {
            const newSummary = {...prev};
            if (newSummary[intakeCourse]) {
                newSummary[intakeCourse] += 1;
            } else {
                newSummary[intakeCourse] = 1;
            }
            return newSummary;
        });
    };

    // Update tracked face data
    // In TakeAttendenceCamera.jsx - modify the updateTrackedFace function

// First, add this helper function above updateTrackedFace
const isSameFace = (box1, box2) => {
    // Calculate centers of both boxes
    const center1 = {
        x: box1[0] + box1[2]/2,
        y: box1[1] + box1[3]/2
    };
    const center2 = {
        x: box2[0] + box2[2]/2,
        y: box2[1] + box2[3]/2
    };
    
    // Calculate distance between centers
    const distance = Math.sqrt(
        Math.pow(center1.x - center2.x, 2) + 
        Math.pow(center1.y - center2.y, 2)
    );
    
    // If centers are close enough, consider it the same face
    // Adjust threshold based on your needs
    return distance < 30; 
};

// Then modify updateTrackedFace function
    const updateTrackedFace = (id, box, name, status = 'recognized', similarity = 0) => {
        const now = Date.now();
        
        if (status === 'recognized') {
            trackedFacesRef.current[id] = {
                box,
                name,
                lastSeen: now,
                similarity
            };
        } else if (status === 'unrecognized') {
            // Check if this unrecognized face is close to any existing unrecognized face
            let existingFaceId = null;
            
            Object.entries(unrecognizedFacesRef.current).forEach(([existingId, existingFace]) => {
                if (isSameFace(existingFace.box, box)) {
                    existingFaceId = existingId;
                }
            });
            
            if (existingFaceId) {
                // Update existing face position
                unrecognizedFacesRef.current[existingFaceId] = {
                    box,
                    name,
                    lastSeen: now
                };
            } else {
                // This is a new unrecognized face
                unrecognizedFacesRef.current[id] = {
                    box,
                    name,
                    lastSeen: now
                };
            }
        } else if (status === 'belowThreshold') {
            // Similar approach for below threshold matches
            let existingFaceId = null;
            
            Object.entries(belowThresholdFacesRef.current).forEach(([existingId, existingFace]) => {
                if (isSameFace(existingFace.box, box)) {
                    existingFaceId = existingId;
                }
            });
            
            if (existingFaceId) {
                // Update existing face
                belowThresholdFacesRef.current[existingFaceId] = {
                    box,
                    name,
                    lastSeen: now,
                    similarity
                };
            } else {
                belowThresholdFacesRef.current[id] = {
                    box,
                    name,
                    lastSeen: now,
                    similarity
                };
            }
        }
        
        // Immediately update the canvas
        updateCanvas();
    };
    
    // Render all currently tracked faces on canvas
    const updateCanvas = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (!canvas || !video || !runningRef.current) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Get the actual video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Calculate display dimensions with proper aspect ratio
        let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
        
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        if (videoAspect > canvasAspect) {
            // Video is wider than canvas
            displayWidth = canvasWidth;
            displayHeight = canvasWidth / videoAspect;
            offsetY = (canvasHeight - displayHeight) / 2;
        } else {
            // Video is taller than canvas
            displayHeight = canvasHeight;
            displayWidth = canvasHeight * videoAspect;
            offsetX = (canvasWidth - displayWidth) / 2;
        }
        
        // Scale factors between original video dimensions and displayed size
        const scaleFactorX = displayWidth / videoWidth;
        const scaleFactorY = displayHeight / videoHeight;
        
        // Backend processing width (where face detection happens)
        const processingWidth = 160;
        // Scale between processing image and original video
        const processingScale = processingWidth / videoWidth;
        
        // Filter out old faces (older than 2 seconds)
        const now = Date.now();
        
        // Process recognized faces (green boxes)
        const activeFaces = Object.entries(trackedFacesRef.current).filter(
            ([id, face]) => (now - face.lastSeen) < 2000
        );
        
        // Process unrecognized faces (red boxes)
        const activeUnrecognizedFaces = Object.entries(unrecognizedFacesRef.current).filter(
            ([id, face]) => (now - face.lastSeen) < 2000
        );
        
        // Process below threshold faces (yellow boxes)
        const activeBelowThresholdFaces = Object.entries(belowThresholdFacesRef.current).filter(
            ([id, face]) => (now - face.lastSeen) < 2000
        );
        
        // Helper function to draw a face box with proper scaling
        const drawFaceBox = (face, color) => {
            const [x, y, w, h] = face.box;
            
            // First convert from processing coordinates to original video coordinates
            const originalX = x / processingScale;
            const originalY = y / processingScale;
            const originalWidth = w / processingScale;
            const originalHeight = h / processingScale;
            
            // Then convert to canvas display coordinates
            const boxX = (originalX * scaleFactorX) + offsetX;
            const boxY = (originalY * scaleFactorY) + offsetY;
            const boxWidth = originalWidth * scaleFactorX;
            const boxHeight = originalHeight * scaleFactorY;
            
            // Draw face box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // Draw name label
            ctx.font = 'bold 16px Arial';
            const nameText = face.name;
            const textWidth = ctx.measureText(nameText).width;
            const labelY = Math.max(25, boxY); // Ensure label doesn't go off-screen
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(boxX, labelY - 25, textWidth + 20, 25);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(nameText, boxX + 10, labelY - 7);
            
            // Add similarity if available (but only above the box, not inside)
            if (face.similarity) {
                const similarityText = `${(face.similarity * 100).toFixed(1)}%`;
                ctx.font = 'bold 14px Arial';
                const simWidth = ctx.measureText(similarityText).width;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(boxX + textWidth + 20, labelY - 25, simWidth + 10, 25);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(similarityText, boxX + textWidth + 25, labelY - 7);
            }
        };
        
        // Draw recognized faces (green)
        activeFaces.forEach(([id, face]) => {
            drawFaceBox(face, '#00FF00'); // Green for recognized
        });
        
        // Draw unrecognized faces (red)
        activeUnrecognizedFaces.forEach(([id, face]) => {
            drawFaceBox(face, '#FF0000'); // Red for unrecognized
        });
        
        // Draw below threshold faces (yellow)
        activeBelowThresholdFaces.forEach(([id, face]) => {
            drawFaceBox(face, '#FFCC00'); // Yellow for below threshold
        });
        
        // Remove old faces from tracking
        Object.keys(trackedFacesRef.current).forEach(id => {
            if ((now - trackedFacesRef.current[id].lastSeen) >= 2000) {
                delete trackedFacesRef.current[id];
            }
        });
        
        Object.keys(unrecognizedFacesRef.current).forEach(id => {
            if ((now - unrecognizedFacesRef.current[id].lastSeen) >= 2000) {
                delete unrecognizedFacesRef.current[id];
            }
        });
        
        Object.keys(belowThresholdFacesRef.current).forEach(id => {
            if ((now - belowThresholdFacesRef.current[id].lastSeen) >= 2000) {
                delete belowThresholdFacesRef.current[id];
            }
        });
    };
    
    const startDetection = async () => {
        if (!selectedOptionsIntake || !selectedOptionsCourse) return;
    
        try {
            // Request camera with specific constraints for better performance
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, // Lower resolution for better performance
                    height: { ideal: 480 },
                    frameRate: { min: 15, ideal: 30 },
                    facingMode: "user"
                } 
            });
            videoStreamRef.current = stream;
            videoRef.current.srcObject = stream;
            
            videoRef.current.onloadedmetadata = async () => {
                await videoRef.current.play();
                
                // Set canvas size
                const canvas = canvasRef.current;
                canvas.width = videoRef.current.clientWidth;
                canvas.height = videoRef.current.clientHeight;
                
                // Reset attendance summary
                setAttendanceSummary({});
                
                // Initialize with sample data for demonstration
                // Replace this with actual data loading in your production code
                setAttendanceSummary({
                    "intake 40 computer science": 0,
                    "intake 39 software engineering": 0
                });
                
                // Inform server to prepare recognition resources
                socket.emit('start_recognition', { 
                    intake: selectedOptionsIntake, 
                    course: selectedOptionsCourse 
                }, (res) => {
                    if (res.status === 'success') {
                        setRunning(true);
                        runningRef.current = true;
                        pendingFramesRef.current = 0;
                        
                        // Use 50ms interval (~20fps) for smoother tracking
                        captureIntervalRef.current = setInterval(() => {
                            if (runningRef.current) {
                                // Only send new frames if we don't have too many pending
                                if (pendingFramesRef.current < maxPendingFrames) {
                                    captureAndSendFrame();
                                }
                            }
                        }, 50);
                    }
                });
            };
        } catch (err) {
            console.error("Error starting camera:", err);
            alert("Could not access camera. Please check permissions.");
        }
    };

    const captureAndSendFrame = () => {
        if (!runningRef.current || !socket) return;
        
        frameCountRef.current++;
        
        // Skip frames to reduce load if needed (process every other frame)
        if (frameCountRef.current % 2 !== 0) {
            updateCanvas(); // Still update canvas for smooth display
            return;
        }
        
        const canvas = document.createElement('canvas');
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!video || video.readyState !== 4) return;
        
        // Use smallest possible size for faster processing
        canvas.width = 160; // Even smaller than 240 for fast transfer
        canvas.height = Math.round(video.videoHeight * (160 / video.videoWidth));
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Use JPEG with lower quality for faster transfer
        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        
        // Increment pending frames counter
        pendingFramesRef.current++;
        
        // Send to server
        socket.emit('process_frame', { 
            image: imageData,
            timestamp: Date.now() // Add timestamp for tracking latency
        });
        
        // Always update the canvas for smooth experience
        updateCanvas();
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        trackedFacesRef.current = {};
        unrecognizedFacesRef.current = {};
        belowThresholdFacesRef.current = {};
    };

    const stopDetection = () => {
        setRunning(false);
        runningRef.current = false;
        clearCanvas();
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        if (socket) socket.emit('stop_recognition');
        if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
    };

    const goBack = () => {
        stopDetection();
        navigate('/attendencepage');
    };

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (videoRef.current && canvasRef.current) {
                canvasRef.current.width = videoRef.current.clientWidth;
                canvasRef.current.height = videoRef.current.clientHeight;
                updateCanvas();
            }
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="split-container">
            <div className="left-pane">
                <div className="camera_canvas">
                    <video 
                        ref={videoRef} 
                        width="600" 
                        height="480" 
                        autoPlay 
                        muted 
                        playsInline 
                    />
                    <canvas 
                        ref={canvasRef} 
                        width="600" 
                        height="480" 
                    />
                </div>
                <div className="control-buttons">
                    <button onClick={startDetection} disabled={running}>Start Recognition</button>
                    <button onClick={stopDetection} disabled={!running}>Stop Recognition</button>
                    <button onClick={goBack}>Back</button>
                </div>
                <div className="attendance-summary" style={{marginTop: '10px', backgroundColor: '#f5f5f5',color:'#2F4B4E', padding: '10px', borderRadius: '5px'}}>
                    <h3>Today's Attendance by Intake/Course</h3>
                    {Object.entries(attendanceSummary).length > 0 ? (
                        <table className="summary-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                            <thead>
                                <tr>
                                    <th style={{textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd'}}>Intake & Course</th>
                                    <th style={{textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd'}}>Students Present</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(attendanceSummary).map(([intakeCourse, count], index) => (
                                    <tr key={index}>
                                        <td style={{padding: '8px', borderBottom: '1px solid #ddd'}}>{intakeCourse}</td>
                                        <td style={{textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd'}}>{count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p>No attendance data available yet</p>
                    )}
                    
                </div>
            </div>
            <div className="right-pane">
                <h2>Attendance List</h2>
                
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
                            attendanceList.map((s) => (
                                <tr key={s.id}>
                                    <td>{s.id}</td>
                                    <td>{s.name}</td>
                                    <td>{s.time}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" style={{textAlign: 'center'}}>No students detected yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <p>Total Students: {attendanceList.length}</p>
            </div>
        </div>
    );
}

export default TakeAttendenceCamera;