import React, { useState, useRef, useCallback } from 'react';
import { signup } from '../services/authService';
import { GraduationCap } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { signupFormSchema, validateField, emailSchema, passwordSchema, nameSchema } from '../utils/validation';

interface SignupProps {
  onSignup: () => void;
  onError: (error: Error | string) => void;
  onToggleForm: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onSignup, onError, onToggleForm }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaReady, setIsCaptchaReady] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Validate individual field on blur
  const handleBlur = useCallback((field: 'name' | 'email' | 'password') => {
    const value = field === 'name' ? name : field === 'email' ? email : password;
    const schema = field === 'name' ? nameSchema : field === 'email' ? emailSchema : passwordSchema;
    const result = validateField(schema, value);
    setFieldErrors(prev => ({ ...prev, [field]: result.error }));
  }, [name, email, password]);

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
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const resetCaptcha = useCallback(() => {
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    setIsCaptchaReady(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate entire form
    const validationResult = signupFormSchema.safeParse({ name, email, password });
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      setFieldErrors({
        name: errors.name?.[0],
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
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const { data } = await signup(email, password, name, captchaToken);
      if (!data.user) {
        const errorMessage = 'Signup failed. Please try again.';
        setError(errorMessage);
        onError(errorMessage);
        resetCaptcha();
      } else if (data.session) {
        onSignup();
      } else {
        setSuccessMessage('Account created. Please check your email to verify your account before signing in.');
        setIsLinkExpired(false);
        setCountdown(null);
        resetCaptcha();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(errorMessage);
      onError(errorMessage);
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLinkExpired(false);
    setCountdown(54);

    try {
      const { data } = await signup(email, password, name, captchaToken);
      if (!data.user) {
        const errorMessage = 'Signup failed. Please try again.';
        setError(errorMessage);
        onError(errorMessage);
        resetCaptcha();
      } else if (data.session) {
        onSignup();
      } else {
        setSuccessMessage('Verification email sent. Please check your inbox.');
        resetCaptcha();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(errorMessage);
      onError(errorMessage);
      resetCaptcha();
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
          <h2 className="text-3xl font-heading font-extrabold text-neo-charcoal mb-2">Create Account</h2>
          <p className="text-neo-gray">Start your learning journey today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-neo-charcoal mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur('name')}
              className={`w-full px-4 py-3 bg-neo-cream border-2 rounded-neo-md focus:ring-2 focus:ring-neo-green focus:border-neo-green transition-all text-neo-charcoal font-medium ${fieldErrors.name ? 'border-red-300' : 'border-neo-border'}`}
              placeholder="Enter your name"
              required
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-600 font-medium">{fieldErrors.name}</p>
            )}
          </div>

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
              placeholder="Create a password (min 8 chars, uppercase, lowercase, number)"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-neo-pink/20 p-4 rounded-neo-md border-2 border-red-300 font-medium">
              {error}
              {isLinkExpired && countdown === 0 && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="ml-2 text-neo-green hover:text-neo-charcoal font-bold"
                >
                  Resend verification email
                </button>
              )}
              {countdown !== null && countdown > 0 && (
                <div className="mt-2 text-neo-gray">
                  Please wait {countdown} seconds before requesting a new link.
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="text-emerald-700 text-sm bg-emerald-50 p-4 rounded-neo-md border-2 border-emerald-300 font-medium">
              {successMessage}
            </div>
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
            disabled={isLoading || !isCaptchaReady || (countdown !== null && countdown > 0)}
            className="w-full bg-neo-green text-white py-3.5 rounded-full font-bold border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-neo-border/30" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-neo-gray font-medium">Already registered?</span>
          </div>
        </div>

        <p className="text-center text-sm text-neo-gray">
          Have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-neo-green hover:text-neo-charcoal font-bold transition-colors"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
