import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { ChatLayout } from './pages/ChatLayout';
function App() {
    return (<BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />}/>
        <Route path="/chat" element={<ChatLayout />}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>);
}
export default App;
