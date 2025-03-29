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

  return (
    <>
      <div>
        <table>
            <tr>
                <td><img src={leftbackground} alt="" height='100%' width='100%' /></td>
                <td>
                    <h1>Attendance Management System</h1>
                    <br />
                    <button onClick={regsiterPage}>Register</button>
                    <br />
                    <button onClick={attendencepage}>Take Attendence</button>
                </td>
            </tr>
        </table>
      </div>
    </>
  )
}

export default MainPage