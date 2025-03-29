import '../CSS/RegisterPage.css'


function RegisterPage(){

    return(
        <div >
            <h1>Register Student</h1>
                <form>
                    <label>Student Name:</label>
                    <input type="text" name="username" required/>
                    <br />
                    <label>Student ID:</label>
                    <input type="text" name="studentid" required/>
                    <br />
                    <label>Intake:</label>
                    <select >
                        <option value="39">Intake 39</option>
                        <option value="40">Intake 40</option>
                        <option value="41">Intake 41</option>
                        <option value="42">Intake 42</option>
                    </select>
                    <br />
                    <label>Course:</label>
                    <select >
                        <option value="course1">Computer Science</option>
                        <option value="course2">Software Engeneering</option>
                        <option value="course3">Computer Engeneering</option>
                        <option value="course2">Data Science and Business Analytics</option>
                        <option value="course3">Information Technology</option>
                        <option value="course3">Information Systems</option>
                    </select>
                    <br />
                </form>
                <button type="submit">Register</button> 
                <button type="reset">Clear</button>
        </div>
    )

}

export default RegisterPage;