import React, { useState, useRef, useId } from 'react';
import type { User } from '@supabase/supabase-js';
import { updateProfile, updatePassword, verifyCurrentPassword } from '../services/authService';
import { avatarPathFromUrl, removeAvatarFiles, type UploadedAvatar } from '../services/storageService';
import { nameSchema, passwordSchema, validateField } from '../utils/validation';
import { useModalA11y } from '../hooks/useModalA11y';
import { AvatarUpload } from './AvatarUpload';
import { X, Mail } from 'lucide-react';

interface ProfileEditorProps {
  user: User | null;
  onUpdate: () => void;
  onClose: () => void;
}

/** Accounts created with Google have no password to confirm. */
function hasPasswordLogin(user: User): boolean {
  return (user.identities ?? []).some((identity) => identity.provider === 'email');
}

export function ProfileEditor({ user, onUpdate, onClose }: ProfileEditorProps) {
  const savedName: string = user?.user_metadata?.name || '';
  const savedAvatarUrl: string | null = user?.user_metadata?.avatar_url || null;

  const [name, setName] = useState(savedName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(savedAvatarUrl);
  const titleId = useId();
  const nameId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  /** Files uploaded in this editor session; deleted again unless saved. */
  const uploadedPaths = useRef<string[]>([]);

  const discardAndClose = () => {
    if (isLoading) return;
    if (user && uploadedPaths.current.length > 0) {
      void removeAvatarFiles(user.id, uploadedPaths.current);
      uploadedPaths.current = [];
    }
    onClose();
  };

  const dialogRef = useModalA11y<HTMLDivElement>(!!user, discardAndClose, !isLoading);

  if (!user) return null;

  const requiresCurrentPassword = hasPasswordLogin(user);

  const handleAvatarUploaded = (avatar: UploadedAvatar) => {
    uploadedPaths.current.push(avatar.path);
    setAvatarUrl(avatar.publicUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameResult = nameSchema.safeParse(name);
    if (!nameResult.success) {
      setError(nameResult.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    const trimmedName = nameResult.data;

    if (newPassword) {
      const passwordCheck = validateField(passwordSchema, newPassword);
      if (!passwordCheck.valid) {
        setError(passwordCheck.error);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (requiresCurrentPassword && !currentPassword) {
        setError('Enter your current password to set a new one');
        return;
      }
    }

    setIsLoading(true);
    try {
      // Verify before changing anything, so a wrong password leaves the
      // profile untouched as well.
      if (newPassword && requiresCurrentPassword && user.email) {
        await verifyCurrentPassword(user.email, currentPassword);
      }

      if (trimmedName !== savedName || avatarUrl !== savedAvatarUrl) {
        await updateProfile({ name: trimmedName, avatar_url: avatarUrl });

        // The new avatar is saved; everything else uploaded in this session,
        // plus the avatar it replaced, is now unreferenced.
        const keep = avatarPathFromUrl(avatarUrl);
        void removeAvatarFiles(
          user.id,
          [...uploadedPaths.current, avatarPathFromUrl(savedAvatarUrl)].filter((path) => path !== keep),
        );
        uploadedPaths.current = [];
      }

      if (newPassword) {
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
        if (e.target === e.currentTarget) discardAndClose();
      }}
      className="fixed inset-0 bg-duo-charcoal/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-7 md:p-8 border-2 border-duo-border shadow-duo-modal animate-scale-in relative"
      >
        {/* Close X Button */}
        <button
          type="button"
          onClick={discardAndClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full border-2 border-duo-border text-duo-pencil hover:text-duo-charcoal hover:border-duo-charcoal flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        <h2 id={titleId} className="text-2xl sm:text-3xl font-heading font-black mb-6 text-center text-duo-charcoal tracking-tight">
          Edit Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-2 mb-4">
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={avatarUrl}
              name={name || user?.email || 'User'}
              onAvatarUploaded={handleAvatarUploaded}
            />
            {user.email && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-duo-blue-subtle/50 text-duo-pencil rounded-full border border-duo-border text-xs font-semibold">
                <Mail className="w-3.5 h-3.5 text-duo-blue" />
                <span>{user.email}</span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor={nameId} className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="name"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor={newPasswordId} className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              id={newPasswordId}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
              placeholder="Leave blank to keep current password"
            />
          </div>

          {newPassword && requiresCurrentPassword && (
            <div className="animate-fade-in">
              <label htmlFor={currentPasswordId} className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
                Current Password
              </label>
              <input
                id={currentPasswordId}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
                placeholder="Required to change your password"
              />
            </div>
          )}

          {newPassword && (
            <div className="animate-fade-in">
              <label htmlFor={confirmPasswordId} className="block text-xs font-bold text-duo-pencil uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <input
                id={confirmPasswordId}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 border-2 border-duo-border rounded-2xl focus:ring-2 focus:ring-duo-green/20 focus:border-duo-green transition-all text-duo-charcoal font-bold bg-white"
                placeholder="Confirm new password"
              />
            </div>
          )}

          {error && (
            <div role="alert" className="text-duo-red text-xs bg-duo-red-subtle/80 p-3.5 rounded-2xl border-2 border-duo-red font-bold text-center">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-duo-border">
            <button
              type="button"
              onClick={discardAndClose}
              disabled={isLoading}
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
