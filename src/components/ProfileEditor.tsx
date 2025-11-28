import { useState } from 'react';
import { updateProfile, updatePassword } from '../services/authService';
import { AvatarUpload } from './AvatarUpload';

interface ProfileEditorProps {
  user: any;
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
    <div className="fixed inset-0 bg-warm-brown/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-warm-gray animate-scale-in">
        <h2 className="text-3xl font-bold mb-8 text-center text-warm-brown">Edit Profile</h2>

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
            <label className="block text-sm font-semibold text-warm-brown mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-warm-gray rounded-lg focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all text-warm-brown"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-warm-brown mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-warm-gray rounded-lg focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all text-warm-brown"
              placeholder="Leave blank to keep current password"
            />
          </div>

          {newPassword && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-warm-brown mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-warm-gray rounded-lg focus:ring-2 focus:ring-warm-orange focus:border-warm-orange transition-all text-warm-brown"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 text-center">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-warm-gray/30">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-warm-brown hover:bg-warm-cream rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-white bg-warm-orange hover:bg-warm-brown rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}