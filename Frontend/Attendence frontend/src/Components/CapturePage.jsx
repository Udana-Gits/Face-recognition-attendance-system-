import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../CSS/CapturePage.css'

function CapturePage() {
  const videoRef = useRef(null)
  const [capturedImages, setCapturedImages] = useState([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureProgress, setCaptureProgress] = useState(0)
  const navigate = useNavigate()

  const captureImages = async () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  
    const images = []
    setIsCapturing(true)
    setCaptureProgress(0)
  
    for (let i = 0; i < 30; i++) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL('image/jpeg')
      images.push(imageData)
      
      setCaptureProgress(Math.round(((i + 1) / 30) * 100))
      await new Promise((resolve) => setTimeout(resolve, 150)) // wait between frames
    }
  
    setCapturedImages(images)
    localStorage.setItem('capturedPhotos', JSON.stringify(images)) // send to RegisterPage
    setIsCapturing(false)
    alert("✅ 30 photos captured successfully!")
    navigate('/registerpage') 
  }
  
  const handleBackToRegister = () => {
    navigate('/registerpage')
  }

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      })
      .catch((err) => {
        console.error("Error accessing webcam: ", err)
      })
      
    return () => {
      // Clean up video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="capture-page-container">
      <h1 className="capture-page-title">Capture Student Face</h1>
      
      <div className="capture-page-video-container">
        <video 
          ref={videoRef} 
          className="capture-page-video" 
          autoPlay 
          playsInline 
          muted
        />
        
        {isCapturing && (
          <div className="capture-page-progress-container">
            <div className="capture-page-progress-text">
              Capturing: {captureProgress}%
            </div>
            <div className="capture-page-progress-bar">
              <div 
                className="capture-page-progress-fill" 
                style={{width: `${captureProgress}%`}}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="capture-page-buttons-container">
        <button 
          type="button" 
          className="capture-page-capture-button"
          onClick={captureImages}
          disabled={isCapturing}
        >
          {isCapturing ? 'Capturing...' : 'Capture Photos'}
        </button>
        
        <button 
          type="button" 
          className="capture-page-back-button"
          onClick={handleBackToRegister}
          disabled={isCapturing}
        >
          Back to Register
        </button>
      </div>
    </div>
  )
}

export default CapturePage