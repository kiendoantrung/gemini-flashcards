import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { updateProfile, updatePassword } from '../services/authService';
import { AvatarUpload } from './AvatarUpload';

interface ProfileEditorProps {
  user: User | null;
  onUpdate: () => void;
  onClose: () => void;
}

export function ProfileEditor({ user, onUpdate, onClose }: ProfileEditorProps) {
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Update profile if name or avatar changed
      if (name !== user?.user_metadata?.name || avatarUrl !== user?.user_metadata?.avatar_url) {
        await updateProfile({
          name,
          avatar_url: avatarUrl
        });
      }

      // Update password if provided
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await updatePassword(newPassword);
      }

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neo-cream rounded-2xl max-w-md w-full p-8 border-2 border-dark neo-shadow animate-scale-in">
        <h2 className="text-3xl font-heading font-bold mb-8 text-center text-dark">Edit Profile</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center mb-8">
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={avatarUrl}
              name={name || user?.email}
              onAvatarChange={setAvatarUrl}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all text-dark bg-white neo-shadow"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all text-dark bg-white neo-shadow"
              placeholder="Leave blank to keep current password"
            />
          </div>

          {newPassword && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-dark mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-dark rounded-xl focus:ring-2 focus:ring-primary-green focus:border-primary-green transition-all text-dark bg-white neo-shadow"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {error && (
            <div className="text-dark text-sm bg-accent-pink/30 p-3 rounded-xl border-2 border-dark text-center neo-shadow">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-dark/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-neo-charcoal bg-neo-pink border-2 border-neo-border rounded-full font-semibold hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all shadow-neo"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-white bg-neo-green border-2 border-neo-border rounded-full font-semibold hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all shadow-neo disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
