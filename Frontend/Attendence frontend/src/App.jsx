import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import MainPage from './Components/MainPage'
import RegisterPage from './Components/RegisterPage'
import AttendencePage from './Components/AttendencePage'
import RemoveStudentPage from './Components/RemoveStudentPage'


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MainPage />} />
        <Route path='/registerpage' element={<RegisterPage />} />
        <Route path='/attendencepage' element={<AttendencePage />} />
        <Route path='/removestudentpage' element={<RemoveStudentPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
