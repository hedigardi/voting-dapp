import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import AdminPanel from './pages/AdminPanel';
import VotingPage from './pages/VotingPage';
import ResultsPage from './pages/ResultsPage';

/**
 * The App component serves as the entry point for the React application.
 * It configures the main application routes and includes the Header component.
 */
const App = () => {
  return (
    <Router>
      {/* Header component is displayed across all pages */}
      <Header />
      {/* Defines the application's route structure */}
      <Routes>
        {/* Default route to the VotingPage component */}
        <Route path="/" element={<VotingPage sessionId={1} />} />
        
        {/* Dynamic route for a specific voting session by session ID */}
        <Route path="/voting/:sessionId" element={<VotingPage />} />
        
        {/* Route to the AdminPanel component for managing voting sessions */}
        <Route path="/admin" element={<AdminPanel />} />
        
        {/* Route to the ResultsPage component to view voting results */}
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
  );
};

export default App;