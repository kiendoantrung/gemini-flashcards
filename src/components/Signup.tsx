import React, { useState, useRef, useCallback } from 'react';
import { signup } from '../services/authService';
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
          <h2 className="text-3xl font-heading font-black text-duo-charcoal mb-1 tracking-tight">Create Account</h2>
          <p className="text-duo-pencil text-sm font-semibold">Start your learning journey today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur('name')}
              className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold ${
                fieldErrors.name ? 'border-duo-red' : 'border-duo-border'
              }`}
              placeholder="Enter your name"
              required
            />
            {fieldErrors.name && (
              <p className="mt-1.5 text-xs text-duo-red font-bold">{fieldErrors.name}</p>
            )}
          </div>

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
              placeholder="Create a password (min 8 chars, mixed)"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1.5 text-xs text-duo-red font-bold">{fieldErrors.password}</p>
            )}
          </div>

          {error && (
            <div className="text-duo-red text-xs bg-duo-red-subtle/80 p-3.5 rounded-2xl border-2 border-duo-red font-bold">
              {error}
              {isLinkExpired && countdown === 0 && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="ml-2 text-duo-blue hover:underline font-black"
                >
                  Resend link
                </button>
              )}
              {countdown !== null && countdown > 0 && (
                <div className="mt-2 text-duo-pencil font-medium">
                  Please wait {countdown} seconds before requesting a new link.
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="text-duo-green-dark text-xs bg-duo-green-subtle/80 p-3.5 rounded-2xl border-2 border-duo-green font-bold">
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
            className="btn-duo-green duo-label w-full py-4 text-sm tracking-wider shadow-duo-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-duo-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-duo-pencil font-bold uppercase tracking-wider">Already registered?</span>
          </div>
        </div>

        <p className="text-center text-sm text-duo-pencil font-medium">
          Have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-duo-blue hover:text-duo-blue-dark font-extrabold transition-colors"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}
