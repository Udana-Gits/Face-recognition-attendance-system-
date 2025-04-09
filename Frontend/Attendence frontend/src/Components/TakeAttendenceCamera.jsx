import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import '../CSS/TakeAttendenceCamera.css';

function TakeAttendenceCamera() {
    const [socket, setSocket] = useState(null);
    const [running, setRunning] = useState(false);
    const [attendanceList, setAttendanceList] = useState([]);
    // Modified to track attendance by user-selected intake/course combinations
    const [attendanceSummary, setAttendanceSummary] = useState({});
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

    // Get selected intakes and courses from location state
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
                console.log(`Recognition event: ${name}, similarity: ${similarity}`);
                
                // Only process if similarity is at least 75%
                if (similarity >= 0.75) {
                    // Parse the name to extract student information
                    // Expected format: "{name}_{studentId}"
                    const nameParts = name.split('_');
                    const studentId = nameParts.pop(); // Extract the last part as ID
                    const studentName = nameParts.join('_'); // Rejoin the rest as name
                    const currentTime = new Date().toLocaleTimeString();
                    
                    // The file path should indicate which intake/course this student belongs to
                    // Extract this information from the backend response or infer it
                    // Let's assume the server returns this info or we can infer it from context
                    const studentIntakeCourse = extractIntakeCourseFromPath(data.path || '');
                    const formattedIntakeCourse = formatIntakeCourse(studentIntakeCourse);
                    console.log(`Student ${studentName} (${studentId}) belongs to ${studentIntakeCourse}`);
                    
                    // Check if this student belongs to a selected intake/course
                    if (isSelectedIntakeCourse(studentIntakeCourse)) {
                        console.log(`Adding student ${studentName} (${studentId}) to attendance list`);
                        
                        // Update the attendance list - CHANGED: add new students to the end of the list
                        setAttendanceList(prevList => {
                            if (!prevList.some(s => s.id === studentId)) {
                                updateAttendanceSummary(studentIntakeCourse);
                                
                                
                                const newStudentEntry = { 
                                    id: studentId, 
                                    name: studentName, 
                                    time: currentTime, 
                                    intakeCourse: studentIntakeCourse,
                                    formattedIntakeCourse: formattedIntakeCourse 
                                };
                                
                                return [...prevList, newStudentEntry]; 
                            }
                            return prevList;
                        });
                    } else {
                        console.log(`Student ${studentName} does not match selected intake/course criteria`);
                    }
                    
                    // Always update tracking with the latest face position
                    updateTrackedFace(studentId, box, studentName, 'recognized', similarity);
                } else {
                    // Handle as below threshold match if below 75%
                    console.log(`Similarity ${similarity} below threshold, treating as below threshold match`);
                    const nameParts = name.split('_');
                    const studentId = nameParts.pop(); // Extract the last part as ID
                    const studentName = nameParts.join('_'); // Rejoin the rest as name
                    updateTrackedFace(
                        `threshold_${studentId || Date.now()}`, 
                        box, 
                        `${studentName || 'Unknown'}`, 
                        'belowThreshold',
                        similarity
                    );
                }
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
            const nameParts = name.split('_');
            const studentId = nameParts.pop(); // Extract the last part as ID
            const studentName = nameParts.join('_'); // Rejoin the rest as name
            
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

    // NEW: Format intake and course to shorter format (40-CS)
    const formatIntakeCourse = (intakeCourse) => {
        // Format should handle cases like "intake 40 software engineering" -> "40-SE"
        const parts = intakeCourse.split(' ');
        let intakeNumber = '';
        let courseShort = '';
        
        // Extract intake number
        for (let i = 0; i < parts.length; i++) {
            // Look for numeric part which would be the intake number
            if (/^\d+$/.test(parts[i])) {
                intakeNumber = parts[i];
                break;
            }
        }
        
        // If we didn't find a numeric part, use first part
        if (!intakeNumber && parts.length > 0) {
            intakeNumber = parts[0];
        }
        
        // Extract course and create abbreviation
        const courseWords = parts.filter(p => !(/^\d+$/.test(p)) && p.toLowerCase() !== 'intake');
        if (courseWords.length > 0) {
            // Create acronym from first letter of each word
            courseShort = courseWords.map(word => word[0].toUpperCase()).join('');
        } else {
            courseShort = "N/A";
        }
        
        return `${intakeNumber}-${courseShort}`;
    };

    // Updated: Extract intake and course from path (expected format: "Students/{intake}/{course}/{name}_{id}.npy")
    const extractIntakeCourseFromPath = (path) => {
        // If we don't have path information, use other methods to determine intake/course
        if (!path) {
            // This is a fallback method if the path isn't available
            // Try to check if the student belongs to the selected intakes/courses
            // We'll just return a default value that matches one of the selected options
            if (selectedOptionsIntake && selectedOptionsIntake.length > 0 &&
                selectedOptionsCourse && selectedOptionsCourse.length > 0) {
                return `${selectedOptionsIntake[0]} ${selectedOptionsCourse[0]}`;
            }
            return "Unknown intake Unknown course";
        }
        
        // Split the path to extract intake and course
        const parts = path.split('/');
        if (parts.length >= 3) {
            // Format should be like "Students/intake 40/software engineering/name_id.npy"
            const intake = parts[parts.length - 3];
            const course = parts[parts.length - 2];
            return `${intake} ${course}`;
        }
        
        return "Unknown intake Unknown course";
    };

    // Updated: Check if student belongs to one of the selected intake/course combinations
    const isSelectedIntakeCourse = (studentIntakeCourse) => {
        console.log("Checking if student belongs to selected intake/course:", studentIntakeCourse);
        console.log("Selected intakes:", selectedOptionsIntake);
        console.log("Selected courses:", selectedOptionsCourse);
        
        if (!selectedOptionsIntake || !selectedOptionsCourse || 
            selectedOptionsIntake.length === 0 || selectedOptionsCourse.length === 0) {
            console.log("No selected options, rejecting student");
            return false;
        }
        
        // Split the intake and course
        const parts = studentIntakeCourse.split(' ');
        if (parts.length < 2) {
            console.log("Invalid intake/course format, rejecting student");
            return false;
        }
        
        // Extract intake and course parts
        // We need to handle various possible formats from the path extraction
        let intake = "", course = "";
        
        // First word is the intake category (e.g., "intake")
        // Second word is the intake number (e.g., "40")
        // Rest is the course name (e.g., "software engineering")
        if (parts[0].toLowerCase() === "intake") {
            intake = `${parts[0]} ${parts[1]}`;
            course = parts.slice(2).join(' ');
        } else {
            // If format is different, try to match the first part as intake and rest as course
            intake = parts[0];
            course = parts.slice(1).join(' ');
        }
        
        console.log(`Parsed: intake="${intake}", course="${course}"`);
        
        // Check if both the intake and course were selected by the user
        const intakeSelected = selectedOptionsIntake.some(
            selectedIntake => selectedIntake.toLowerCase() === intake.toLowerCase()
        );
        
        const courseSelected = selectedOptionsCourse.some(
            selectedCourse => selectedCourse.toLowerCase() === course.toLowerCase()
        );
        
        console.log(`Intake selected: ${intakeSelected}, Course selected: ${courseSelected}`);
        
        return intakeSelected && courseSelected;
    };

    // Update attendance summary count when a new student is recognized
    // Improved updateAttendanceSummary function
    const updateAttendanceSummary = (intakeCourse) => {
        console.log(`Updating attendance summary for ${intakeCourse}`);
        
        // Get the current attendance count for this intake/course
        const currentCount = attendanceList.filter(
            student => student.intakeCourse === intakeCourse
        ).length;
        
        // Now we're setting the exact count based on the attendance list
        // This ensures the summary always matches the actual list
        setAttendanceSummary(prev => {
            const newSummary = {...prev};
            newSummary[intakeCourse] = currentCount + 1; // +1 because the new student isn't in the list yet
            console.log(`Set count for ${intakeCourse} to ${newSummary[intakeCourse]}`);
            return newSummary;
        });
    };

    // Helper function to check if two face boxes represent the same face
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
        return distance < 30; 
    };

    // Update tracked face data
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
        if (!selectedOptionsIntake || !selectedOptionsCourse || selectedOptionsIntake.length === 0 || selectedOptionsCourse.length === 0) {
            alert("Please select intake and course options first");
            return;
        }
    
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
                
                // Reset attendance list and summary
                setAttendanceList([]);
                
                // Initialize the attendance summary with selected intake/course combinations
                const initialSummary = {};
                
                // Create a key for each combination of intake and course the user selected
                selectedOptionsIntake.forEach(intake => {
                    selectedOptionsCourse.forEach(course => {
                        initialSummary[`${intake} ${course}`] = 0;
                    });
                });
                
                setAttendanceSummary(initialSummary);
                
                // Inform server to prepare recognition resources
                socket.emit('start_recognition', { 
                    intake: selectedOptionsIntake, 
                    course: selectedOptionsCourse 
                }, (res) => {
                    if (res && res.status === 'success') {
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
                    } else {
                        console.error("Failed to start recognition:", res);
                        alert("Failed to start recognition. Check console for details.");
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
        
        // Send to server with selected intake/course information
        socket.emit('process_frame', { 
            image: imageData,
            timestamp: Date.now(), // Add timestamp for tracking latency
            selectedIntakes: selectedOptionsIntake,
            selectedCourses: selectedOptionsCourse
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

    const navigateConfirmAttendance = () => {
        stopDetection();
        navigate('/attendanceconfirm', {
            state: {
                attendanceList,
                selectedOptionsIntake,
                selectedOptionsCourse
            }
        });
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

    // Format intake and course for display in summary
    const formatSummaryKey = (intakeCourse) => {
        return formatIntakeCourse(intakeCourse);
    };

    return (
        <div className="split-container-attendencecamera">
            <div className="left-pane-attendencecamera">
                <div className="camera_canvas-attendencecamera">
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
                <div className="control-buttons-attendencecamera">
                    <button onClick={startDetection} disabled={running}>Start Recognition</button>
                    <button onClick={stopDetection} disabled={!running}>Stop Recognition</button>
                    <button onClick={goBack}>Back</button>
                </div>
                <div className="attendance-summary-attendencecamera" style={{marginTop: '10px', backgroundColor: '#f5f5f5',color:'#2F4B4E', padding: '10px', borderRadius: '5px'}}>
                    <h3>Today's Attendance by Selected Intake/Course</h3>
                    {Object.entries(attendanceSummary).length > 0 ? (
                        <table className="summary-table-attendencecamera" style={{width: '100%', borderCollapse: 'collapse'}}>
                            <thead>
                                <tr>
                                    <th style={{textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd'}}>Intake & Course</th>
                                    <th style={{textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd'}}>Students Present</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(attendanceSummary).map(([intakeCourse, count], index) => (
                                    <tr key={index}>
                                        <td style={{textAlign: 'left', apadding: '8px', borderBottom: '1px solid #ddd'}}>{intakeCourse}</td>
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
            <div className="right-pane-attendencecamera">
                <h2>Attendance List</h2>
                <div className="attendance-table-wrapper-attendencecamera">
                <table className="attendence_table-attendencecamera" style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            <th>Student ID</th>
                            <th>Name</th>
                            <th>Time</th>
                            <th>Intake & Course</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendanceList.length > 0 ? (
                            attendanceList.map((s) => (
                                <tr key={s.id}>
                                    <td>{s.id}</td>
                                    <td>{s.name}</td>
                                    <td>{s.time}</td>
                                    <td>{s.formattedIntakeCourse || formatIntakeCourse(s.intakeCourse)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" style={{textAlign: 'center'}}>No students detected yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
                <p style={{textAlign: 'left'}}>Total Students: {attendanceList.length}</p>
                <div className="control-buttons-attendencecamera">
                    <button onClick={navigateConfirmAttendance}>Submit Attendance</button>
                </div>
            </div>
        </div>
    );
}

export default TakeAttendenceCamera;