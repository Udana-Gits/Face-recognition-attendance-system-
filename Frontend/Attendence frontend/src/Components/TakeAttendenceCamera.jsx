import { BrowserRouter, Routes, Route } from 'react-router-dom'
import React, { useEffect, useRef } from 'react'
import { useState } from 'react'


import '../CSS/TakeAttendenceCamera.css'



function TakeAttendenceCamera() {

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const [running, setRunning] = useState(false)
    let intervalId = useRef(null)


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

    const startDetection = () => {
        setRunning(true)
      
        intervalId.current = setInterval(async () => {
          if (!videoRef.current) return
      
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          const video = videoRef.current
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
      
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = canvas.toDataURL('image/jpeg')
      
          try {
            const response = await fetch('http://localhost:5000/recognize-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: imageData })
            })
      
            const result = await response.json()
      
            const canvasElement = canvasRef.current
            const ctx = canvasElement.getContext('2d')
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)
      
            if (response.ok) {
              const { name, box } = result
              const [x, y, w, h] = box
      
              ctx.strokeStyle = 'green'
              ctx.lineWidth = 2
              ctx.strokeRect(x, y, w, h)
              ctx.font = '16px Arial'
              ctx.fillStyle = 'green'
              ctx.fillText(name, x, y - 10)
            }
          } catch (error) {
            console.error("Recognition error:", error)
          }
        }, 1500)
      }
      

      const stopDetection = () => {
        setRunning(false)
        clearInterval(intervalId.current)
        const ctx = canvasRef.current.getContext('2d')
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      
      

  return (
    <div className="split-container">
            <div className="left-pane">
            <div className="camera_canvas">
                <video ref={videoRef} width="600" height="480" autoPlay style={{ position: 'absolute' }} />
                <canvas ref={canvasRef} width="600" height="480" style={{ position: 'absolute' }} />
            </div>
                <div>
                    <button type="button" onClick={startDetection} disabled={running} >Take Attendence</button>
                    <button type="button" onClick={stopDetection} >Stop</button>
                </div>
            </div>
            <div className="right-pane">
                <table className="attendence_table">
                    <thead>
                        <tr>
                            <th>Index No</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                </table>  
            </div>
          </div>
  )
}

export default TakeAttendenceCamera
