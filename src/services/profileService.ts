import { supabase } from '../lib/supabase';

interface ProfileUpdate {
  name?: string;
  avatar_url?: string | null;
  email?: string;
  // Add any other profile fields you need
}

export async function getProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

export async function updateProfile(userId: string, updates: ProfileUpdate) {
  try {
    // First, check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // If profile doesn't exist, create it
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          },
        ]);

      if (insertError) throw insertError;
    } else {
      // If profile exists, update it
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    }

    // If email is being updated, update auth email
    if (updates.email) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: updates.email,
      });

      if (emailError) throw emailError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
} 