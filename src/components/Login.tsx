import React, { useState } from 'react';
import { loginWithEmail} from '../services/authService';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: () => void;
  onError: (error: any) => void;
  onToggleForm: () => void;
}

export function Login({ onLogin, onError, onToggleForm }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const response = await loginWithEmail(email, password);
    if (response.error) {
      setError(response.error);
      onError(response.error);
    } else {
      onLogin();
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setError(error.message);
      onError(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Welcome back</h2>
        </div>
        
        <form onSubmit={handleEmailLogin} className="space-y-6">
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
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium transition-colors duration-200"
          >
            {isLoading ? 'Loading...' : 'Sign in'}
          </button>
        </form>

        <div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center gap-3 hover:bg-gray-50 font-medium transition-colors duration-200"
            >
              <img src="/icons8-google-480.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
} 