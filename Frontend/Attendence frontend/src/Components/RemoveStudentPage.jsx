
function RemoveStudentPage(){

    return(
        <div >
            <h1>Remove Student</h1>
                <form>
                    <label>Student Name:</label>
                    <input type="text" name="username" required/>
                    <br />
                    <label>Student ID:</label>
                    <input type="text" name="studentid" required/>
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
                    <button type="submit">Remove</button>
                    <button type="reset">Clear</button>
                </form>
        </div>
    )

}

export default RemoveStudentPage;