import React, { useState } from 'react';
import { loginWithEmail } from '../services/authService';
import { supabase } from '../lib/supabase';
import { GraduationCap } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-neo-cream p-4">
      <div className="max-w-md w-full bg-white rounded-neo-xl border-2 border-neo-border shadow-neo-lg p-8 space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-neo-green rounded-neo-lg border-2 border-neo-border shadow-neo flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-heading font-extrabold text-neo-charcoal mb-2">Welcome back</h2>
          <p className="text-neo-gray">Sign in to continue learning</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-neo-charcoal mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-neo-cream border-2 border-neo-border rounded-neo-md focus:ring-2 focus:ring-neo-green focus:border-neo-green transition-all text-neo-charcoal font-medium"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-neo-charcoal mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-neo-cream border-2 border-neo-border rounded-neo-md focus:ring-2 focus:ring-neo-green focus:border-neo-green transition-all text-neo-charcoal font-medium"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-neo-pink/20 p-4 rounded-neo-md border-2 border-red-300 font-medium">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-neo-green text-white py-3.5 rounded-full font-bold border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-neo-border/30" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-neo-gray font-medium">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-neo-border rounded-full px-4 py-3.5 flex items-center justify-center gap-3 shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all font-bold text-neo-charcoal"
            >
              <img src="/icons8-google-480.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-neo-gray">
          Don't have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-neo-green hover:text-neo-charcoal font-bold transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}