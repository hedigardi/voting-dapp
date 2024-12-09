import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import AdminPanel from './pages/AdminPanel';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';

const App = () => {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<VotingPage sessionId={1} />} />
        
        <Route path="/voting/:sessionId" element={<VotingPage />} />
        
        <Route path="/admin" element={<AdminPanel />} />
        
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
  );
};

export default App;