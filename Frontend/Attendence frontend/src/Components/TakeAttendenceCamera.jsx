import { BrowserRouter, Routes, Route } from 'react-router-dom'
import React, { useEffect, useRef } from 'react'

import '../CSS/TakeAttendenceCamera.css'



function TakeAttendenceCamera() {

    const videoRef = useRef(null)

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
    <div className="split-container">
            <div className="left-pane">
                <video ref={videoRef} width="600" height="480" autoPlay />
                <div>
                    <button type="button" >Take Attendence</button>
                    <button type="button" >Stop</button>
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
