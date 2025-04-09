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
  function attendanceanalysispage(){
    navigate('/attendanceanalysispage')
  }

  return (
    <>
      <div class="background-img-mainpage">
        <div className="ams-split-container-mainpage">
          <div className="ams-left-pane-mainpage">
            <img src={leftbackground} alt="Attendance System Background" />
          </div>
          <div className="ams-right-pane-mainpage">
            <div className="ams-button-container-mainpage">
              <button className="ams-action-button-mainpage" onClick={attendencepage}>Take Attendance</button>
              <button className="ams-action-button-mainpage" onClick={regsiterPage}>Register Students</button>
              <button className="ams-action-button-mainpage" onClick={removestudentpage}>Remove Students</button>
              <button className="ams-action-button-mainpage" onClick={attendanceanalysispage}>Analyze Attendance</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default MainPage