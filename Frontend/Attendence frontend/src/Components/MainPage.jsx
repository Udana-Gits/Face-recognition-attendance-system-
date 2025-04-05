import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../CSS/mainPage.css'
import leftbackground from '../Images/t2.png'
import RegisterPage from './RegisterPage'

function MainPage() {
  const navigate = useNavigate()

  function regsiterPage(){
    navigate('/registerpage')
  }
  function attendencepage(){
    navigate('/attendencepage')
  }
  function removestudentpage(){
    navigate('/removestudentpage')
  }

  return (
    <>
      <div className="ams-split-container">
        <div className="ams-left-pane">
          <img src={leftbackground} alt="Attendance System Background" />
        </div>
        <div className="ams-right-pane">
          <div className="ams-button-container">
            <button className="ams-action-button" onClick={attendencepage}>Take Attendance</button>
            <button className="ams-action-button" onClick={regsiterPage}>Register Students</button>
            <button className="ams-action-button" onClick={removestudentpage}>Remove Students</button>
            <button className="ams-action-button" onClick={attendencepage}>Manage Attendance</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default MainPage