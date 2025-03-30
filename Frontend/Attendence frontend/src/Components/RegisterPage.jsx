import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import React, { useEffect, useRef } from 'react'

import '../CSS/RegisterPage.css'




function RegisterPage(){

    const Navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        studentid: '',
        intake: '',
        course: ''
      })

      useEffect(() => {
        const savedForm = JSON.parse(localStorage.getItem('studentFormData'))
        if (savedForm) {
          setFormData(savedForm)
        }
      }, [])

      const handleChange = (e) => {
        const updatedForm = { ...formData, [e.target.name]: e.target.value }
        setFormData(updatedForm)
        localStorage.setItem('studentFormData', JSON.stringify(updatedForm))
      }
        

    


    const handleSubmit = async (e) => {
      e.preventDefault()
    
      const capturedPhotos = JSON.parse(localStorage.getItem('capturedPhotos') || '[]')
    
      // 🚫 Block registration if photos are missing or not exactly 30
      if (capturedPhotos.length !== 30) {
        alert("⚠️ Please capture 30 photos before registering.")
        return
      }
    
      const payload = {
        ...formData,
        images: capturedPhotos
      }
    
      try {
        const response = await fetch('http://localhost:5000/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
    
        const result = await response.json()
    
        if (response.ok) {
          // ✅ Clear photos and reload the form
          localStorage.removeItem('studentFormData')      // 🧼 clear saved form
          localStorage.removeItem('capturedPhotos')       // 🧼 clear captured photos
          alert(result.message)
          window.location.reload()
        } else {
          alert(result.message)
        }
    
      } catch (error) {
        console.error('Error:', error)
        alert('Something went wrong during registration!')
      }
    }
    

    

    const handleReset = () => {
      setFormData({
        name: '',
        studentid: '',
        intake: '',
        course: ''
      })
      localStorage.removeItem('studentFormData')      // 🧼 clear saved form
      localStorage.removeItem('capturedPhotos')       // 🧼 clear captured photos
    }
    
    

      function handleCapture(){
        Navigate('/capturepage')
      }
    
    

    return(
        <div >
            <h1>Register Student</h1>
                <form onSubmit={handleSubmit}>
                    <label>Student Name:</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required/>
                    <br />
                    <label>Student ID:</label>
                    <input type="text" name="studentid" value={formData.studentid} onChange={handleChange} required/>
                    <br />
                    <label>Intake:</label>
                    <select name="intake" value={formData.intake} onChange={handleChange} required >
                        <option value="">-- Select Intake --</option>
                        <option value="Intake 39">Intake 39</option>
                        <option value="Intake 40">Intake 40</option>
                        <option value="Intake 41">Intake 41</option>
                        <option value="Intake 42">Intake 42</option>
                    </select>
                    <br />
                    <label>Course:</label>
                    <select name="course" value={formData.course} onChange={handleChange} required>
                      <option value="">-- Select Course --</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Software Engineering">Software Engineering</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Data Science and Business Analytics">Data Science and Business Analytics</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Information Systems">Information Systems</option>
                    </select>
                    <br />
                    <button type="button" onClick={handleCapture}>Capture</button>
                    <br /><br />
                    <button type="submit">Register</button> 
                    <button type="reset" onClick={handleReset}>Clear</button>
                </form>
                
        </div>
    )

}

export default RegisterPage;