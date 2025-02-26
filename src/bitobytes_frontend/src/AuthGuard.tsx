import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './context/AuthContext';
import dynamic from 'next/dynamic';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component to protect routes that require authentication
 * Redirects to signin page if user is not authenticated
 */
const AuthGuardComponent: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If authentication is still loading, do nothing
    if (isLoading) return;

    // If not authenticated and not already on the signin page, redirect to signin
    if (!isAuthenticated && router.pathname !== '/signin') {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render children
  return <>{children}</>;
};

// Export a dynamic version that only runs on the client
const AuthGuard = dynamic<AuthGuardProps>(
  () => Promise.resolve(AuthGuardComponent),
  { ssr: false }
);

export default AuthGuard;
