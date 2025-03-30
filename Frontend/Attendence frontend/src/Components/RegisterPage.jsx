import { useState } from 'react'
import '../CSS/RegisterPage.css'
import { useNavigate } from 'react-router-dom'



function RegisterPage(){

    const Navigate = useNavigate()

    const [formData, setFormData] = useState({
        name: '',
        studentid: '',
        intake: '',
        course: ''
      })

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }  

    const handleSubmit = async (e) => {
      e.preventDefault()

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
        alert(result.message)
      } catch (error) {
        console.error('Error:', error)
        alert('Something went wrong!')
      }
    }

    

      const handleReset = () => {
        setFormData({
          name: '',
          studentid: '',
          intake: '',
          course: ''
        })
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