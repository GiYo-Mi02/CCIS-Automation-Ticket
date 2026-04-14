import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { AnalyticsProvider } from './contexts/AnalyticsContext.jsx';
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase.js';

function SupabaseConfigErrorScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white shadow-xl p-8">
        <h1 className="text-xl font-bold text-red-700">Missing Frontend Environment Variables</h1>
        <p className="mt-3 text-sm text-gray-700">{supabaseConfigError}</p>
        <div className="mt-5 rounded-lg bg-gray-900 text-gray-100 p-4 text-sm font-mono overflow-x-auto">
          <p>VITE_SUPABASE_URL=https://your-project-ref.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=your_anon_key</p>
          <p>VITE_API_BASE_URL=https://your-api-domain</p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <AnalyticsProvider>
            <App />
          </AnalyticsProvider>
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SupabaseConfigErrorScreen />
    )}
  </React.StrictMode>
);
