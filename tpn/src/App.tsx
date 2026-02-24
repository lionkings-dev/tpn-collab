import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EditorPage from './pages/EditorPage';
import MyRoomsPage from './pages/MyRoomsPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomId" element={<EditorPage />} />
      <Route path="/rooms" element={<MyRoomsPage />} />
    </Routes>
  );
}

export default App;
