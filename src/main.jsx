import React from 'react';
import ReactDOM from 'react-dom/client';
import FPSGame from './FPSGame'; // Import your main game component
import './index.css';

// 1. Find the root DOM element where the app will be rendered
const rootElement = document.getElementById('root');

// 2. Render the FPSGame component into that root element
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <FPSGame />
  </React.StrictMode>,
);

