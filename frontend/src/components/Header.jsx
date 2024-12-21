import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation between routes
import 'bootstrap/dist/css/bootstrap.min.css'; // Import Bootstrap for styling

/**
 * Header component for the Voting DApp
 * Provides a navigation bar for navigating between different pages of the application
 */
const Header = () => {
  return (
    // Navbar container using Bootstrap classes for styling
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        {/* Logo or brand link that redirects to the home page */}
        <Link className="navbar-brand" to="/">
          Voting DApp
        </Link>

        {/* Toggler button for collapsing the navbar on smaller screens */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navbar links, collapsed on smaller screens */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {/* Link to the Home page */}
            <li className="nav-item">
              <Link className="nav-link" to="/">
                Voting
              </Link>
            </li>

            {/* Link to the Results page */}
            <li className="nav-item">
              <Link className="nav-link" to="/results">
                Results
              </Link>
            </li>

            {/* Link to the Admin Panel page */}
            <li className="nav-item">
              <Link className="nav-link" to="/admin">
                Admin Panel
              </Link>
            </li>            
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header;