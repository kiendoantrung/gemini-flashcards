import React, { useState } from 'react';
import { signup } from '../services/authService';

interface SignupProps {
  onSignup: () => void;
  onError: (error: any) => void;
  onToggleForm: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onSignup, onError, onToggleForm }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLinkExpired, setIsLinkExpired] = useState(false);

  React.useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorCode = hashParams.get('error_code');
    const errorDesc = hashParams.get('error_description');
    
    if (errorCode === '403' && errorDesc?.includes('Email link is invalid or has expired')) {
      setIsLinkExpired(true);
      setError('Your verification link has expired. Please request a new one.');
      setCountdown(54);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  React.useEffect(() => {
    if (countdown === null || countdown === 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => prev !== null ? prev - 1 : null);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await signup(email, password, name);
      if (!data.user || !data.session) {
        const errorMessage = 'Signup failed. Please try again.';
        setError(errorMessage);
        onError(errorMessage);
      } else {
        onSignup();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setIsLinkExpired(false);
    setCountdown(54);

    try {
      const { data } = await signup(email, password, name);
      if (!data.user || !data.session) {
        const errorMessage = 'Signup failed. Please try again.';
        setError(errorMessage);
        onError(errorMessage);
      } else {
        onSignup();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(errorMessage);
      onError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Create Account</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
              {isLinkExpired && countdown === 0 && (
                <button 
                  onClick={handleResendVerification}
                  className="ml-2 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Resend verification email
                </button>
              )}
              {countdown !== null && countdown > 0 && (
                <div className="mt-2 text-gray-600">
                  Please wait {countdown} seconds before requesting a new link.
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (countdown !== null && countdown > 0)}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Sign Up'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">Already registered?</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600">
          Have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-indigo-600 hover:text-indigo-500 font-medium transition-colors duration-200"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
} 