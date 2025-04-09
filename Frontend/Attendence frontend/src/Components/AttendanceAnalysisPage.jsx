import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../CSS/AttendanceAnalysisPage.css';

const AttendanceAnalysisPage = () => {
  // State for form inputs
  const [studentId, setStudentId] = useState('');
  const [selectedIntake, setSelectedIntake] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [studentIntake, setStudentIntake] = useState(''); // New state for student search
  const [studentCourse, setStudentCourse] = useState(''); // New state for student search
  
  // State for data
  const [intakes, setIntakes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [studentCourses, setStudentCourses] = useState([]); // Courses for student search
  const [studentAttendanceData, setStudentAttendanceData] = useState(null);
  const [intakeAttendanceData, setIntakeAttendanceData] = useState(null);
  const [attendanceGraphData, setAttendanceGraphData] = useState([]);
  
  // State for loading and errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State to track which search was performed last
  const [lastSearchType, setLastSearchType] = useState(null);

  // Fetch intakes on component mount
  useEffect(() => {
    fetchIntakes();
  }, []);

  // Fetch courses when intake changes for course analysis
  useEffect(() => {
    if (selectedIntake) {
      fetchCourses(selectedIntake, setCourses);
    } else {
      setCourses([]);
    }
  }, [selectedIntake]);

  // Fetch courses when student intake changes
  useEffect(() => {
    if (studentIntake) {
      fetchCourses(studentIntake, setStudentCourses);
    } else {
      setStudentCourses([]);
    }
  }, [studentIntake]);

  const fetchIntakes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from API first
      try {
        console.log("Fetching intakes from API...");
        const response = await axios.get('/api/intakes');
        console.log("Intakes API response:", response.data);
        if (response.data && Array.isArray(response.data)) {
          setIntakes(response.data);
          return;
        }
      } catch (apiError) {
        console.warn('API call for intakes failed, using mock data:', apiError);
      }
      
      // Mock data for intakes as fallback
      console.log("Using mock intake data");
      const intakeData = ['Intake 39', 'Intake 40', 'Intake 41', 'Intake 42'];
      setIntakes(intakeData);
    } catch (error) {
      console.error('Error fetching intakes:', error);
      setError('Failed to load intakes. Please try again later.');
      setIntakes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async (intake, setStateFunction) => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from API first
      try {
        console.log(`Fetching courses for intake ${intake}...`);
        const response = await axios.get(`/api/courses?intake=${intake}`);
        console.log("Courses API response:", response.data);
        if (response.data && Array.isArray(response.data)) {
          setStateFunction(response.data);
          return;
        }
      } catch (apiError) {
        console.warn('API call for courses failed, using mock data:', apiError);
      }
      
      // Mock data for courses as fallback
      console.log("Using mock course data");
      const courseData = [
        'Computer Science', 
        'Software Engineering', 
        'Computer Engineering', 
        'Data Science and Business Analytics', 
        'Information Systems', 
        'Information Technology'
      ];
      setStateFunction(courseData);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Failed to load courses. Please try again later.');
      setStateFunction([]);
    } finally {
      setLoading(false);
    }
  };

  const searchStudentAttendance = async () => {
    if (!studentId || !studentIntake || !studentCourse) {
      alert('Please enter Student ID and select both Intake and Course');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let attendanceData;
      
      try {
        console.log(`Fetching attendance for student ${studentId}...`);
        const response = await axios.get(`/api/attendance/student/${studentId}`, {
          params: {
            intake: studentIntake,
            course: studentCourse
          }
        });
        console.log("Student attendance API response:", response.data);
        attendanceData = response.data;
      } catch (apiError) {
        console.warn('API call for student attendance failed, using mock data:', apiError);
        // Mock student attendance data as fallback
        console.log("Generating mock student attendance data");
        attendanceData = {
          name: "Test Student",
          subjects: [
            { name: "Mathematics", percentage: 85.5 },
            { name: "Computer Programming", percentage: 92.3 },
            { name: "Database Systems", percentage: 78.9 }
          ]
        };
      }
      
      console.log("Final student attendance data:", attendanceData);
      setStudentAttendanceData(attendanceData);
      setIntakeAttendanceData(null);
      setAttendanceGraphData([]);
      setLastSearchType('student');
    } catch (error) {
      console.error('Error processing student attendance data:', error);
      setError('Error processing attendance data. Please try again.');
      setStudentAttendanceData(null);
    } finally {
      setLoading(false);
    }
  };

  const searchIntakeAttendance = async () => {
    if (!selectedIntake || !selectedCourse) {
      alert('Please select both Intake and Course');
      return;
    }

    setLoading(true);
    setError(null);
    setIntakeAttendanceData(null);
    setAttendanceGraphData([]);
    
    try {
      let responseData;
      
      try {
        // Make API call
        console.log(`Fetching attendance for intake ${selectedIntake} and course ${selectedCourse}...`);
        const response = await axios.get(`/api/attendance/intake/${selectedIntake}/course/${selectedCourse}`);
        console.log("Intake attendance API response:", response.data);
        responseData = response.data;
      } catch (apiError) {
        console.warn('API call for intake attendance failed, using mock data:', apiError);
        // Generate mock data
        console.log("Generating mock intake attendance data");
        responseData = generateMockIntakeData();
      }
      
      // Process the response data
      if (responseData) {
        // Check and extract studentsData
        const studentsData = responseData.studentsData || [];
        console.log("Processed students data:", studentsData);
        
        // Check and extract graphData
        const graphData = responseData.graphData || [];
        console.log("Processed graph data:", graphData);
        
        setIntakeAttendanceData(studentsData);
        setAttendanceGraphData(graphData);
        setStudentAttendanceData(null);
        setLastSearchType('intake');
      } else {
        throw new Error('No data received from API');
      }
    } catch (error) {
      console.error('Error processing intake attendance:', error);
      setError('Error processing attendance data. Please try again.');
      setIntakeAttendanceData(null);
      setAttendanceGraphData([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate mock data for development/testing
  const generateMockIntakeData = () => {
    // Generate sample student data
    const subjects = ['Mathematics', 'Computer Programming', 'Database Systems', 'Web Development'];
    const students = [];
    
    // Generate at least 5 students to ensure we have data
    for (let i = 1; i <= 5; i++) {
      const studentSubjects = {};
      subjects.forEach(subject => {
        studentSubjects[subject] = Math.floor(Math.random() * 30) + 70; // 70-100%
      });
      
      students.push({
        id: `S100${i}`,
        name: `Student ${i}`,
        subjects: studentSubjects
      });
    }
    
    // Generate sample graph data
    const dates = ['2023-04-01', '2023-04-02', '2023-04-03', '2023-04-04', '2023-04-05'];
    const graphData = dates.map(date => {
      const entry = { date };
      subjects.forEach(subject => {
        entry[subject] = Math.floor(Math.random() * 5) + 1; // 1-5 students present
      });
      return entry;
    });
    
    // Log the generated mock data
    console.log("Generated mock students:", students);
    console.log("Generated mock graph data:", graphData);
    
    return {
      studentsData: students,
      graphData: graphData
    };
  };

  // Helper function to abbreviate subject names
  const abbreviateSubject = (subject) => {
    if (!subject) return '';
    
    const words = subject.split(' ');
    if (words.length === 1) {
      return subject.substring(0, 3).toUpperCase();
    } else {
      return words.map(word => word[0].toUpperCase()).join('');
    }
  };

  // Render function for student attendance table
  const renderStudentAttendanceTable = () => {
    if (!studentAttendanceData) return null;
    if (!studentAttendanceData.subjects || !Array.isArray(studentAttendanceData.subjects) || studentAttendanceData.subjects.length === 0) {
      return <p className="no-data-message">No attendance data found for this student.</p>;
    }

    return (
      <div className="attendance-table-container">
        <h3>Attendance Report for Student ID: {studentId}</h3>
        <h4>Name: {studentAttendanceData.name || 'Unknown'}</h4>
        <h4>Intake: {studentIntake} | Course: {studentCourse}</h4>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Attendance Percentage</th>
            </tr>
          </thead>
          <tbody>
            {studentAttendanceData.subjects.map((subject, index) => (
              <tr key={index}>
                <td>{subject.name} ({abbreviateSubject(subject.name)})</td>
                <td>{(subject.percentage || 0).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render function for intake attendance table
  const renderIntakeAttendanceTable = () => {
    if (!intakeAttendanceData || !Array.isArray(intakeAttendanceData) || intakeAttendanceData.length === 0) {
      return <p className="no-data-message">No attendance data found for this intake and course.</p>;
    }

    // Safely extract subject names
    const firstStudent = intakeAttendanceData[0] || {};
    const subjects = firstStudent.subjects ? Object.keys(firstStudent.subjects) : [];
    
    if (subjects.length === 0) {
      return <p className="no-data-message">No subject data found for this course.</p>;
    }

    return (
      <div className="attendance-table-container">
        <h3>Attendance Report for {selectedIntake} - {selectedCourse}</h3>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Name</th>
              {subjects.map(subject => (
                <th key={subject}>{abbreviateSubject(subject)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {intakeAttendanceData.map((student, index) => (
              <tr key={index}>
                <td>{student.id}</td>
                <td>{student.name}</td>
                {subjects.map(subject => (
                  <td key={subject}>
                    {student.subjects && student.subjects[subject] !== undefined 
                      ? student.subjects[subject].toFixed(2) + '%' 
                      : 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render function for attendance graphs - FIXED VERSION
  const renderAttendanceGraphs = () => {
    // Enhanced logging for debugging
    console.log("Attendance Graph Data:", attendanceGraphData);
    
    // Check if data exists and has proper structure
    if (!attendanceGraphData || !Array.isArray(attendanceGraphData) || attendanceGraphData.length === 0) {
      console.log("No graph data available");
      return null;
    }

    // Get all subject keys except 'date'
    const firstDay = attendanceGraphData[0] || {};
    console.log("First day data:", firstDay);
    
    const subjects = Object.keys(firstDay).filter(key => key !== 'date');
    console.log("Subject keys for graph:", subjects);
    
    if (subjects.length === 0) {
      console.log("No subjects found in graph data");
      return null;
    }

    // Generate colors for bars
    const getBarColor = (index) => {
      const colors = [
        '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', 
        '#00C49F', '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57'
      ];
      return colors[index % colors.length];
    };

    return (
      <div className="attendance-graphs-container">
        <h3>Daily Attendance Graph for {selectedIntake} - {selectedCourse}</h3>
        <div className="graph-wrapper">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={attendanceGraphData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                angle={-45} 
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Number of Students', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                allowDecimals={false}
              />
              <Tooltip />
              <Legend wrapperStyle={{ bottom: 0 }} />
              {subjects.map((subject, index) => (
                <Bar 
                  key={subject} 
                  dataKey={subject} 
                  name={abbreviateSubject(subject)} 
                  fill={getBarColor(index)} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="attendance-analysis-page">
      <h2>Attendance Analysis</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="search-container">
        {/* Individual student search section */}
        <div className="student-search-section">
          <h3>Individual Student Attendance</h3>
          <div className="search-box">
            <input
              type="text"
              placeholder="Enter Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
            <select
              value={studentIntake}
              onChange={(e) => setStudentIntake(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Intake</option>
              {Array.isArray(intakes) && intakes.map((intake, index) => (
                <option key={index} value={intake}>{intake}</option>
              ))}
            </select>
            
            <select
              value={studentCourse}
              onChange={(e) => setStudentCourse(e.target.value)}
              disabled={!studentIntake || loading}
            >
              <option value="">Select Course</option>
              {Array.isArray(studentCourses) && studentCourses.map((course, index) => (
                <option key={index} value={course}>{course}</option>
              ))}
            </select>
            <button 
              onClick={searchStudentAttendance}
              disabled={loading}
            >
              {loading && lastSearchType === 'student' ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Intake course search section */}
        <div className="intake-search-section">
          <h3>Course Attendance Analysis</h3>
          <div className="search-box">
            <select
              value={selectedIntake}
              onChange={(e) => setSelectedIntake(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Intake</option>
              {Array.isArray(intakes) && intakes.map((intake, index) => (
                <option key={index} value={intake}>{intake}</option>
              ))}
            </select>
            
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={!selectedIntake || loading}
            >
              <option value="">Select Course</option>
              {Array.isArray(courses) && courses.map((course, index) => (
                <option key={index} value={course}>{course}</option>
              ))}
            </select>
            
            <button 
              onClick={searchIntakeAttendance}
              disabled={loading}
            >
              {loading && lastSearchType === 'intake' ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Results display area */}
      <div className="results-container">
        {loading && <div className="loading">Loading data...</div>}
        
        {!loading && lastSearchType === 'student' && (
          <div className="result-section">
            {renderStudentAttendanceTable() || (
              <p className="no-data-message">No attendance data found for this student.</p>
            )}
          </div>
        )}
        
        {!loading && lastSearchType === 'intake' && (
          <div className="result-section">
            {(intakeAttendanceData && intakeAttendanceData.length > 0) ? (
              <>
                {renderIntakeAttendanceTable()}
                {renderAttendanceGraphs()}
              </>
            ) : (
              <p className="no-data-message">No attendance data found for this intake and course.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceAnalysisPage;