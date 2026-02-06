import React, { useState, useRef, useCallback } from 'react';
import { loginWithEmail } from '../services/authService';
import { supabase } from '../lib/supabase';
import { GraduationCap } from 'lucide-react';
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
              onBlur={() => handleBlur('email')}
              className={`w-full px-4 py-3 bg-neo-cream border-2 rounded-neo-md focus:ring-2 focus:ring-neo-green focus:border-neo-green transition-all text-neo-charcoal font-medium ${fieldErrors.email ? 'border-red-300' : 'border-neo-border'}`}
              placeholder="Enter your email"
              required
            />
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600 font-medium">{fieldErrors.email}</p>
            )}
          </div>


          <div>
            <label className="block text-sm font-bold text-neo-charcoal mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              className={`w-full px-4 py-3 bg-neo-cream border-2 rounded-neo-md focus:ring-2 focus:ring-neo-green focus:border-neo-green transition-all text-neo-charcoal font-medium ${fieldErrors.password ? 'border-red-300' : 'border-neo-border'}`}
              placeholder="Enter your password"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-neo-pink/20 p-4 rounded-neo-md border-2 border-red-300 font-medium">{error}</div>
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