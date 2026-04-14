import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context.js';

function ProtectedRoute({ children }) {
  const { isAuthorized, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-[3px] border-gray-200" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-[3px] border-t-gray-900 animate-spin" />
          </div>
          <p className="text-sm font-medium text-gray-500 animate-pulse">
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
