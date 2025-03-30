import React, { useEffect, useRef } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'


function CapturePage() {

  const videoRef = useRef(null)
  const [capturedImages, setCapturedImages] = useState([])
  const navigate = useNavigate()


  const captureImages = async () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  
    const images = []
  
    for (let i = 0; i < 30; i++) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL('image/jpeg')
      images.push(imageData)
  
      await new Promise((resolve) => setTimeout(resolve, 150)) // wait between frames
    }
  
    setCapturedImages(images)
    localStorage.setItem('capturedPhotos', JSON.stringify(images)) // send to RegisterPage
    alert("✅ 30 photos captured successfully!")
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
  }, [])

  return (
    <div>
      <h1>Capture Student Face</h1>
      <video ref={videoRef} width="640" height="480" autoPlay />
      <div>
      <button type="button" onClick={captureImages}>Capture</button>
      </div>
    </div>
  )
}

export default CapturePage
