import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { AnalyticsProvider } from './contexts/AnalyticsContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AnalyticsProvider>
          <App />
        </AnalyticsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
