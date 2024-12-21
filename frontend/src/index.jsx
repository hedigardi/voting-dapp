import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App';

/**
 * The main entry point of the React application.
 * It renders the root `App` component into the DOM.
 */

// Select the root DOM element where the React application will be mounted
const rootElement = document.getElementById('root');

// Create a React root using the new `ReactDOM.createRoot` method
const root = ReactDOM.createRoot(rootElement);

// Render the App component wrapped in `React.StrictMode` for highlighting potential problems
root.render(
  <React.StrictMode>
    <App /> {/* The main application component */}
  </React.StrictMode>
);