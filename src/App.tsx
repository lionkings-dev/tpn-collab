import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EditorPage from './pages/EditorPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomId" element={<EditorPage />} />
    </Routes>
  );
}

export default App;
