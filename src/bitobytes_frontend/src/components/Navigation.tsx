import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  // Check if the current route matches the given path
  const isActive = (path: string) => router.pathname === path;

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold">
            BitOBytes
          </Link>
          
          <div className="ml-8 flex space-x-4">
            <Link 
              href="/" 
              className={`hover:text-blue-300 ${isActive('/') ? 'text-blue-300' : ''}`}
            >
              Home
            </Link>
            
            {isAuthenticated && (
              <Link 
                href="/profile" 
                className={`hover:text-blue-300 ${isActive('/profile') ? 'text-blue-300' : ''}`}
              >
                Profile
              </Link>
            )}
          </div>
        </div>
        
        <div>
          {isAuthenticated ? (
            <button 
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Sign Out
            </button>
          ) : (
            <Link 
              href="/signin" 
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${isActive('/signin') ? 'bg-blue-700' : ''}`}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
