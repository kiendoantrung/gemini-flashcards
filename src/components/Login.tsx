import React, { useState, useRef, useCallback } from 'react';
import { loginWithEmail } from '../services/authService';
import { supabase } from '../lib/supabase';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { loginFormSchema, validateField, emailSchema, loginPasswordSchema } from '../utils/validation';

interface LoginProps {
  onLogin: () => void;
  onError: (error: Error | string) => void;
  onToggleForm: () => void;
}

export function Login({ onLogin, onError, onToggleForm }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaReady, setIsCaptchaReady] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Validate individual field on blur
  const handleBlur = useCallback((field: 'email' | 'password') => {
    const value = field === 'email' ? email : password;
    const schema = field === 'email' ? emailSchema : loginPasswordSchema;
    const result = validateField(schema, value);
    setFieldErrors(prev => ({ ...prev, [field]: result.error }));
  }, [email, password]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entire form
    const validationResult = loginFormSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      setError('Please fix the errors above');
      return;
    }

    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    const response = await loginWithEmail(email, password, captchaToken);
    if (response.error) {
      setError(response.error);
      onError(response.error);
      // Reset captcha on error
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setIsCaptchaReady(false);
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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-md w-full p-8 md:p-10 space-y-7">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/icon.png"
            alt="Gemini Flashcards"
            className="w-16 h-16 rounded-2xl object-contain"
          />
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-heading font-black text-duo-charcoal mb-1 tracking-tight">Welcome back</h2>
          <p className="text-duo-pencil text-sm font-semibold">Sign in to continue learning</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold ${
                fieldErrors.email ? 'border-duo-red' : 'border-duo-border'
              }`}
              placeholder="Enter your email"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1.5 text-xs text-duo-red font-bold">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold ${
                fieldErrors.password ? 'border-duo-red' : 'border-duo-border'
              }`}
              placeholder="Enter your password"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1.5 text-xs text-duo-red font-bold">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="text-duo-red text-xs bg-duo-red-subtle/80 p-3.5 rounded-2xl border-2 border-duo-red font-bold">{error}</div>
          )}

          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={(token) => {
                setCaptchaToken(token);
                setIsCaptchaReady(true);
              }}
              onError={() => {
                setCaptchaToken(null);
                setIsCaptchaReady(false);
                setError('CAPTCHA verification failed. Please try again.');
              }}
              onExpire={() => {
                setCaptchaToken(null);
                setIsCaptchaReady(false);
              }}
              options={{
                theme: 'light',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !isCaptchaReady}
            className="btn-duo-green duo-label w-full py-4 text-sm tracking-wider shadow-duo-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-duo-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-duo-pencil font-bold uppercase tracking-wider">Or continue with</span>
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={handleGoogleLogin}
              className="btn-duo-white duo-label w-full py-3.5 text-xs tracking-wider flex items-center justify-center gap-2.5 text-duo-charcoal"
            >
              <img src="/icons8-google-480.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-duo-pencil font-medium">
          Don't have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-duo-blue hover:text-duo-blue-dark font-extrabold transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}