import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import '../CSS/TakeAttendenceCamera.css';

function TakeAttendenceCamera() {
    const [socket, setSocket] = useState(null);
    const [running, setRunning] = useState(false);
    const [attendanceList, setAttendanceList] = useState([]);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const videoStreamRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const frameCountRef = useRef(0);
    const navigate = useNavigate();
    const location = useLocation();
    const runningRef = useRef(false);
    const trackedFacesRef = useRef({});
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
                        return [...prevList, { id: studentId, name: studentName, time: currentTime }];
                    }
                    return prevList;
                });
    
                // Update tracking with the latest face position
                updateTrackedFace(studentId, box, studentName);
            }
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

    // Update tracked face data
    const updateTrackedFace = (studentId, box, name) => {
        const now = Date.now();
        
        trackedFacesRef.current[studentId] = {
            box,
            name,
            lastSeen: now
        };
        
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
        
        // Get the actual video dimensions being displayed
        const videoElement = video;
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        
        // Calculate display dimensions with proper aspect ratio
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Calculate scaling based on how the video is actually displayed
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
        
        // The backend processes images at 160px width
        const processingWidth = 160;
        // Calculate the scale factor between processed image and displayed video
        const scaleX = displayWidth / processingWidth;
        // Calculate height scale based on aspect ratio
        const scaleY = scaleX; // Use same scale to maintain aspect ratio
        
        // Filter out old faces (older than 2 seconds)
        const now = Date.now();
        const activeFaces = Object.entries(trackedFacesRef.current).filter(
            ([id, face]) => (now - face.lastSeen) < 2000
        );
        
        // Render each active face
        activeFaces.forEach(([id, face]) => {
            const [x, y, w, h] = face.box;
            
            // Scale box to canvas
            const boxX = x * scaleX + offsetX;
            const boxY = y * scaleY + offsetY;
            const boxWidth = w * scaleX;
            const boxHeight = h * scaleY;
            
            // Draw face box
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 3;
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            
            // Draw name label
            ctx.font = 'bold 16px Arial';
            const textWidth = ctx.measureText(face.name).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(boxX, boxY - 25, textWidth + 20, 25);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(face.name, boxX + 10, boxY - 7);
        });
        
        // Remove old faces from tracking
        Object.keys(trackedFacesRef.current).forEach(id => {
            if ((now - trackedFacesRef.current[id].lastSeen) >= 2000) {
                delete trackedFacesRef.current[id];
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
                        {attendanceList.length > 0 ? attendanceList.map((s) => (
                            <tr key={s.id}>
                                <td>{s.id}</td>
                                <td>{s.name}</td>
                                <td>{s.time}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3">No students detected yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TakeAttendenceCamera;