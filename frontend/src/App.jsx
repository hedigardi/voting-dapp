import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import AdminPanel from "./pages/AdminPanel";
import VotingPage from "./pages/VotingPage";
import ResultsPage from "./pages/ResultsPage";
import PublicSessionPage from "./pages/PublicSessionPage";

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<VotingPage />} />
    <Route path="/s/:sessionId" element={<PublicSessionPage />} />
    <Route path="/admin" element={<AdminPanel />} />
    <Route path="/results" element={<ResultsPage />} />
  </Routes>
);

const App = () => (
  <Router>
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <AppRoutes />
      </main>
      <footer className="app-footer">
        <div className="container app-footer-inner">
          <p className="app-footer-copy">
            Copyright © {new Date().getFullYear()} Voting DApp. All rights
            reserved.
          </p>
          <p className="app-footer-product">
            A product from <a href="https://hedigardi.com">hedigardi.com</a>
          </p>
        </div>
      </footer>
    </div>
  </Router>
);

export default App;
