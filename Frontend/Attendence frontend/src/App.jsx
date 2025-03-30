import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import MainPage from './Components/MainPage'
import RegisterPage from './Components/RegisterPage'
import AttendencePage from './Components/AttendencePage'
import RemoveStudentPage from './Components/RemoveStudentPage'
import CapturePage from './Components/CapturePage'
import TakeAttendenceCamera from './Components/TakeAttendenceCamera'


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainPage />} />
        <Route path='/registerpage' element={<RegisterPage />} />
        <Route path='/attendencepage' element={<AttendencePage />} />
        <Route path='/removestudentpage' element={<RemoveStudentPage />} />
        <Route path='/capturepage' element={<CapturePage />} />
        <Route path='/takeattendencecamera' element={<TakeAttendenceCamera />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
