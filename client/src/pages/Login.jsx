import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context.js';
import { useState } from 'react';

function LoginPage() {
  const { signInWithGoogle, isAuthorized, isLoading, authError, clearError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  // If already authorized, redirect to dashboard
  if (isAuthorized && !isLoading) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    clearError();
    await signInWithGoogle();
    // OAuth will redirect — signingIn stays true until redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-50">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-100/60 to-indigo-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-slate-200/60 to-gray-100/40 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 mb-5 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              CCIS Admin Console
            </h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Sign in with your authorized UMak Google account to access the control center.
            </p>
          </div>

          {/* Error Alert */}
          {authError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 animate-in">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Access Denied</p>
                <p className="text-xs text-red-600 mt-0.5">{authError}</p>
              </div>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            id="google-sign-in-btn"
            onClick={handleGoogleLogin}
            disabled={signingIn || isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {signingIn ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                Redirecting to Google…
              </>
            ) : (
              <>
                {/* Google "G" logo */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">RESTRICTED ACCESS</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Info Section */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-gray-700">
                  Only authorized <span className="font-semibold">@umak.edu.ph</span> emails can access this system.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Contact your administrator if you need access.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          CCIS Automation Ticket System &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

export default LoginPage;
