import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import AdminPanel from "./pages/AdminPanel";
import VotingPage from "./pages/VotingPage";
import ResultsPage from "./pages/ResultsPage";
import PublicSessionPage from "./pages/PublicSessionPage";

const PUBLIC_VIEW_LOCK_KEY = "publicViewSessionId";

const GuardedRoutes = () => {
  const location = useLocation();
  const [lockedSessionId, setLockedSessionId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.sessionStorage.getItem(PUBLIC_VIEW_LOCK_KEY) || "";
  });

  useEffect(() => {
    const match = location.pathname.match(/^\/s\/(\d+)$/);
    if (!match) {
      return;
    }

    const sessionId = match[1];
    if (sessionId !== lockedSessionId) {
      setLockedSessionId(sessionId);
      window.sessionStorage.setItem(PUBLIC_VIEW_LOCK_KEY, sessionId);
    }
  }, [location.pathname, lockedSessionId]);

  if (lockedSessionId && location.pathname !== `/s/${lockedSessionId}`) {
    return <Navigate to={`/s/${lockedSessionId}`} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<VotingPage />} />
      <Route path="/s/:sessionId" element={<PublicSessionPage />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  );
};

const App = () => (
  <Router>
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <GuardedRoutes />
      </main>
    </div>
  </Router>
);

export default App;
