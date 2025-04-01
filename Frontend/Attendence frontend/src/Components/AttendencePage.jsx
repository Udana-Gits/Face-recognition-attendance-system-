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
          // ✅ Remove if already selected
          setSelectedOptionsIntake(selectedOptionsIntake.filter(item => item !== value))
        } else {
          // ✅ Add new selection
          setSelectedOptionsIntake([...selectedOptionsIntake, value])
        }
      }

      const handleCheckboxChangeCourse = (e) => {
        const value = e.target.value
        if (selectedOptionsCourse.includes(value)) {
          // ✅ Remove if already selected
          setSelectedOptionsCourse(selectedOptionsCourse.filter(item => item !== value))
        } else {
          // ✅ Add new selection
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
            navigate('/takeattendencecamera')
          } else {
            alert("Failed to load embeddings.")
          }
        } catch (error) {
          console.error("Error sending selections:", error)
          alert("Server error.")
        }
      }
      
      

    return(
        <div className="attendence-page">
            <h1>AttendencePage</h1>
            <form onSubmit={handleSubmit}>
            <div className="split-container_attendencepage">
                <div className="left-pane">
                    <h4>Select Intake</h4>
                    <br />
                    <label>
                        <input type="checkbox" value="Intake 39" onChange={handleCheckboxChangeIntake} checked={selectedOptionsIntake.includes("Intake 39")} />Intake 39
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Intake 40" onChange={handleCheckboxChangeIntake} checked={selectedOptionsIntake.includes("Intake 40")} />Intake 40
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Intake 41" onChange={handleCheckboxChangeIntake} checked={selectedOptionsIntake.includes("Intake 41")} />Intake 41
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Intake 42" onChange={handleCheckboxChangeIntake} checked={selectedOptionsIntake.includes("Intake 42")} />Intake 42    
                    </label>
                    <br /> 
                </div>
                <div className="right-pane">
                    <h4>Select Course</h4>
                    <br />
                    <label>
                        <input type="checkbox" value="Computer Science" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Computer Science")} />Computer Science
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Software Engineering" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Software Engineering")} />Software Engineering
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Computer Engineering" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Computer Engineering")} />Computer Engineering
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Data Science and Business Analytics" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Data Science and Business Analytics")} />Data Science and Business Analytics
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Information Technology" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Information Technology")} />Information Technology
                    </label>
                    <br />
                    <label>
                        <input type="checkbox" value="Information Systems" onChange={handleCheckboxChangeCourse} checked={selectedOptionsCourse.includes("Information Systems")} />Information Systems
                    </label>
                    <br />          
                </div>
            </div>
            <button type="submit" >Take Attendence</button>
            <button type="reset" onClick={handleReset} >Clear</button>
        </form>
    </div>
    )

}

export default AttendencePage;