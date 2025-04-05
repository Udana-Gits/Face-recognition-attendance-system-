import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../CSS/RemoveStudentPage.css';

function RemoveStudentPage(){

    const [formData, setFormData] = useState({
        name: '',
        studentid: '',
        intake: '',
        course: ''
    })

    const navigate = useNavigate()


    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    } 

    const handleSubmit = async (e) => {
        e.preventDefault()
        console.log("Sending data:", formData)
      
        try {
            const response = await fetch('http://localhost:5000/remove-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
      
            const result = await response.json()
          
            if (response.ok) {
                alert(result.message) // Success message
            } else {
                alert(result.message) // Error from Flask
            }
      
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
    function goback(){
        navigate('/mainpage')
    }

    return(
        <div className="remove-student-container">
            <h1 className="remove-student-title">Remove Student</h1>
            <form onSubmit={handleSubmit}>
                <div className="remove-student-grid">
                    <div className="remove-student-left-panel">
                        <h3 className="remove-student-section-header">Student Information</h3>
                        <label>Student Name:</label>
                        <input 
                            type="text" 
                            name="name" 
                            value={formData.name} 
                            onChange={handleChange} 
                            required
                        />
                        
                        <label>Student ID:</label>
                        <input 
                            type="text" 
                            name="studentid" 
                            value={formData.studentid} 
                            onChange={handleChange} 
                            required
                        />
                    </div>
                    
                    <div className="remove-student-right-panel">
                        <h3 className="remove-student-section-header">Program Details</h3>
                        <label>Intake:</label>
                        <select 
                            name="intake" 
                            value={formData.intake} 
                            onChange={handleChange} 
                            required
                        >
                            <option value="">-- Select Intake --</option>
                            <option value="Intake 39">Intake 39</option>
                            <option value="Intake 40">Intake 40</option>
                            <option value="Intake 41">Intake 41</option>
                            <option value="Intake 42">Intake 42</option>
                        </select>
                        
                        <label>Course:</label>
                        <select 
                            name="course" 
                            value={formData.course} 
                            onChange={handleChange} 
                            required
                        >
                            <option value="">-- Select Course --</option>
                            <option value="Computer Science">Computer Science</option>
                            <option value="Software Engineering">Software Engineering</option>
                            <option value="Computer Engineering">Computer Engineering</option>
                            <option value="Data Science and Business Analytics">Data Science and Business Analytics</option>
                            <option value="Information Technology">Information Technology</option>
                            <option value="Information Systems">Information Systems</option>
                        </select>
                    </div>
                </div>
                
                <div className="remove-student-buttons-container">
                    <button 
                        type="submit" 
                        className="remove-student-submit-button"
                    >
                        Remove
                    </button>
                    <button 
                        type="reset" 
                        className="remove-student-reset-button" 
                        onClick={handleReset}
                    >
                        Clear
                    </button>
                    <button 
                        type="button" 
                        className="remove-student-submit-button"
                        onClick={goback}
                    >
                        Back
                    </button>
                </div>
            </form>
        </div>
    )
}

export default RemoveStudentPage;