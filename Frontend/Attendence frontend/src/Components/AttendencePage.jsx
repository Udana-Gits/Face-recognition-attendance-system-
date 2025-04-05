import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import React, { useEffect, useRef } from 'react'
import '../CSS/AttendencePage.css'

function AttendencePage(){

    const [selectedOptionsIntake, setSelectedOptionsIntake] = useState([])
    const [selectedOptionsCourse, setSelectedOptionsCourse] = useState([])

    const navigate = useNavigate()

    const handleCheckboxChangeIntake = (e) => {
        const value = e.target.value
        if (selectedOptionsIntake.includes(value)) {
          setSelectedOptionsIntake(selectedOptionsIntake.filter(item => item !== value))
        } else {
          setSelectedOptionsIntake([...selectedOptionsIntake, value])
        }
    }

    const handleCheckboxChangeCourse = (e) => {
        const value = e.target.value
        if (selectedOptionsCourse.includes(value)) {
          setSelectedOptionsCourse(selectedOptionsCourse.filter(item => item !== value))
        } else {
          setSelectedOptionsCourse([...selectedOptionsCourse, value])
        }
    }

    const handleReset = () => {
        setSelectedOptionsIntake([])
        setSelectedOptionsCourse([])
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
      
        if (selectedOptionsIntake.length === 0 || selectedOptionsCourse.length === 0) {
          alert("Please select at least one intake and one course.")
          return
        }
      
        try {
          const response = await fetch('http://localhost:5000/load-embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intakes: selectedOptionsIntake,
              courses: selectedOptionsCourse
            })
          })
      
          const result = await response.json()
      
          if (response.ok) {
            alert(result.message)
            navigate('/takeattendencecamera', {
              state: {
                selectedOptionsIntake,
                selectedOptionsCourse
              }
            });
          } else {
            alert("Failed to load embeddings.")
          }
        } catch (error) {
          console.error("Error sending selections:", error)
          alert("Server error.")
        }
    }
    
    function goback(){
        navigate('/mainpage')
    }
      
    return(
        <div className="attendance-container">
            <h1 className="attendance-title">Whose attendance would you like to record?</h1>
            <form onSubmit={handleSubmit}>
                <div className="attendance-selection-grid">
                    <div className="attendance-intake-panel">
                        <h4 className="attendance-section-header">Select Intake</h4>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Intake 39" 
                                onChange={handleCheckboxChangeIntake} 
                                checked={selectedOptionsIntake.includes("Intake 39")} 
                            />
                            <span className="attendance-checkbox-label">Intake 39</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Intake 40" 
                                onChange={handleCheckboxChangeIntake} 
                                checked={selectedOptionsIntake.includes("Intake 40")} 
                            />
                            <span className="attendance-checkbox-label">Intake 40</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Intake 41" 
                                onChange={handleCheckboxChangeIntake} 
                                checked={selectedOptionsIntake.includes("Intake 41")} 
                            />
                            <span className="attendance-checkbox-label">Intake 41</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Intake 42" 
                                onChange={handleCheckboxChangeIntake} 
                                checked={selectedOptionsIntake.includes("Intake 42")} 
                            />
                            <span className="attendance-checkbox-label">Intake 42</span>
                        </label>
                    </div>
                    
                    <div className="attendance-course-panel">
                        <h4 className="attendance-section-header">Select Course</h4>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Computer Science" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Computer Science")} 
                            />
                            <span className="attendance-checkbox-label">Computer Science</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Software Engineering" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Software Engineering")} 
                            />
                            <span className="attendance-checkbox-label">Software Engineering</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Computer Engineering" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Computer Engineering")} 
                            />
                            <span className="attendance-checkbox-label">Computer Engineering</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Data Science and Business Analytics" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Data Science and Business Analytics")} 
                            />
                            <span className="attendance-checkbox-label">Data Science and Business Analytics</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Information Technology" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Information Technology")} 
                            />
                            <span className="attendance-checkbox-label">Information Technology</span>
                        </label>
                        
                        <label className="attendance-checkbox-item">
                            <input 
                                type="checkbox" 
                                className="attendance-checkbox"
                                value="Information Systems" 
                                onChange={handleCheckboxChangeCourse} 
                                checked={selectedOptionsCourse.includes("Information Systems")} 
                            />
                            <span className="attendance-checkbox-label">Information Systems</span>
                        </label>
                    </div>
                </div>
                
                <div className="attendance-buttons-container">
                    <button type="submit" className="attendance-submit-button">Take Attendance</button>
                    <button type="reset" onClick={handleReset} className="attendance-reset-button">Clear</button>
                    <button type="reset" onClick={goback} className="attendance-submit-button">Back</button>
                </div>
            </form>
        </div>
    )
}

export default AttendencePage;