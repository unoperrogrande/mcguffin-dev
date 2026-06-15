import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import BankerPOC from './pages/BankerPOC'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/BankerPOC" element={<BankerPOC />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App