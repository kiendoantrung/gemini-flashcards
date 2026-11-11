import { supabase } from '../lib/supabase';

export async function loginWithEmail(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: {
      captchaToken
    }
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user };
}

export const signup = async (email: string, password: string, name: string, captchaToken?: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        captchaToken
      }
    });

    if (error) throw error;
    return { data };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Authentication failed. Please try again.');
  }
};

/**
 * Re-sends the signup confirmation email. Calling signUp() again for this
 * (as the form used to) re-submitted the password and could fail or create
 * confusing state for an already-registered address.
 */
export async function resendSignupEmail(email: string, captchaToken?: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { captchaToken },
  });
  if (error) throw error;
}

/**
 * Checks the current password before allowing a change, so an unattended
 * signed-in browser is not enough to take over the account. Signing in again
 * with the same credentials just refreshes the session.
 *
 * For a server-enforced check, also enable "Secure password change" in the
 * Supabase Auth settings.
 */
export async function verifyCurrentPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error('Current password is incorrect');
  }
}

export async function logout() {
  await supabase.auth.signOut();
}

export function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function updateProfile(updates: { name?: string; avatar_url?: string | null }) {
  const { data: { user }, error } = await supabase.auth.updateUser({
    data: updates
  });

  if (error) throw error;
  if (!user) throw new Error('User not found after profile update');

  // Keep profile table in sync with auth metadata
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        ...updates
      },
      {
        onConflict: 'id'
      }
    );

  if (profileError) throw profileError;

  return { user };
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) throw error;
  return { data };
} 
