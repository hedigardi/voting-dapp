import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import AdminPanel from "./pages/AdminPanel";
import VotingPage from "./pages/VotingPage";
import ResultsPage from "./pages/ResultsPage";

const App = () => (
  <Router>
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<VotingPage />} />
          <Route path="/voting/:sessionId" element={<VotingPage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  </Router>
);

export default App;
