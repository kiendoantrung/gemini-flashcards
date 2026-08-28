import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { updateProfile, updatePassword } from '../services/authService';
import { AvatarUpload } from './AvatarUpload';
import { X, Mail } from 'lucide-react';

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-duo-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-7 md:p-8 border-2 border-duo-border shadow-duo-modal animate-scale-in relative">
        {/* Close X Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full border-2 border-duo-border text-duo-pencil hover:text-duo-charcoal hover:border-duo-charcoal flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        <h2 className="text-2xl sm:text-3xl font-heading font-black mb-6 text-center text-duo-charcoal tracking-tight">
          Edit Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-2 mb-4">
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={avatarUrl}
              name={name || user?.email || 'User'}
              onAvatarChange={setAvatarUrl}
            />
            {user.email && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-duo-blue-subtle/50 text-duo-pencil rounded-full border border-duo-border text-xs font-semibold">
                <Mail className="w-3.5 h-3.5 text-duo-blue" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
              placeholder="Leave blank to keep current password"
            />
          </div>

          {newPassword && (
            <div className="animate-fade-in">
              <label className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {error && (
            <div className="text-duo-red text-xs bg-duo-red-subtle/80 p-3.5 rounded-2xl border-2 border-duo-red font-bold text-center">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-duo-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-duo-white duo-label px-6 py-2.5 text-xs tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-duo-green duo-label px-6 py-2.5 text-xs tracking-wider shadow-duo-green disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
