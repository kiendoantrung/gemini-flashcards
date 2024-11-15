import { supabase } from '../lib/supabase';

export async function loginWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
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
        // Thêm các scope để lấy thông tin profile từ Google
        scopes: 'email profile'
      }
    });

    if (error) throw error;

    // Sau khi đăng nhập OAuth thành công, kiểm tra và tạo user profile
    const user = await getCurrentUser();
    if (user.data.user) {
      // Kiểm tra xem user đã có trong bảng users chưa
      const { data: existingUser } = await supabase
        .from('users')
        .select()
        .eq('id', user.data.user.id)
        .single();

      if (!existingUser) {
        // Nếu chưa có, tạo mới user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: user.data.user.id,
              email: user.data.user.email,
              name: user.data.user.user_metadata.full_name || user.data.user.email,
              avatar_url: user.data.user.user_metadata.avatar_url
            }
          ]);

        if (profileError) throw profileError;
      }
    }

    return { url: data.url };
  } catch (error) {
    console.error('Google login error:', error);
    return { user: null, error: error instanceof Error ? error.message : 'Login failed' };
  }
}

export const signup = async (email: string, password: string, name: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: undefined // Remove email redirect
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
  try {
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
  } catch (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) throw error;
    return { data };
  } catch (error) {
    throw error;
  }
} 