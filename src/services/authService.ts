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

export async function loginWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'email profile'
      }
    });

    if (error) throw error;
    return { url: data.url };
  } catch (error) {
    console.error('Google login error:', error);
    return { error: error instanceof Error ? error.message : 'Login failed' };
  }
}

export const signup = async (email: string, password: string, name: string, captchaToken?: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: undefined, // Remove email redirect
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

export const verifyOtp = async (email: string, token: string) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error) throw error;
    return { data };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Verification failed. Please try again.');
  }
};

export async function logout() {
  await supabase.auth.signOut();
}

export function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function updateProfile(updates: { name?: string; avatar_url?: string }) {
  const { data: { user }, error } = await supabase.auth.updateUser({
    data: updates
  });

  if (error) throw error;

  // Also update the users table
  const { error: profileError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user?.id);

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
