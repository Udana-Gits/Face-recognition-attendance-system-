import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../CSS/mainPage.css'
import leftbackground from '../Images/t1.png'
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
      <div className="split-container">
        <div className="left-pane">
          <img src={leftbackground} alt="" height='100%' width='100%' />
        </div>
        <div className="right-pane">
          <h1>Attendance Management System</h1>
          <br />
          <button onClick={attendencepage}>Take Attendence</button>
          <br />
          <button onClick={regsiterPage}>Regsiter Students</button>
          <br />
          <button onClick={removestudentpage}>Remove Students</button>
          <br />
          <button onClick={attendencepage}>Manage Attendence</button>            
        </div>
      </div>
    </>
  )
}

export default MainPage


