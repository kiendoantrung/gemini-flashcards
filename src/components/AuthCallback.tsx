import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/** Give up waiting for a session after this long instead of spinning forever. */
const CALLBACK_TIMEOUT_MS = 15_000;

/**
 * Reads an OAuth / email-link error from either the hash (implicit flow) or
 * the query string (PKCE flow, and the provider's own error redirect).
 */
function readCallbackError(): string | null {
  const hash = new URLSearchParams(window.location.hash.substring(1));
  const query = new URLSearchParams(window.location.search);
  const description =
    hash.get('error_description') ?? query.get('error_description') ?? hash.get('error') ?? query.get('error');
  return description ? description.replace(/\+/g, ' ') : null;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(() => readCallbackError());

  useEffect(() => {
    if (error) return;

    let isCancelled = false;

    // supabase-js consumes the URL on startup (detectSessionInUrl): the
    // `#access_token=` of the implicit flow and the `?code=` of PKCE alike.
    // getSession() resolves once that has finished.
    const timeout = setTimeout(() => {
      if (!isCancelled) setError('Sign-in is taking too long. Please try again.');
    }, CALLBACK_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data: { session }, error: sessionError }) => {
        if (isCancelled) return;
        if (sessionError) throw sessionError;
        if (session) {
          navigate('/', { replace: true });
        } else {
          setError('This sign-in link is invalid or has expired. Please sign in again.');
        }
      })
      .catch((callbackError: unknown) => {
        console.error('Auth callback error:', callbackError);
        if (!isCancelled) setError('Sign-in failed. Please try again.');
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [error, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div role="alert" className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Sign-in was not completed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="btn-duo-green duo-label px-6 py-3 text-sm"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we complete the authentication process.</p>
      </div>
    </div>
  );
}
