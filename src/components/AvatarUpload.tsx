import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Avatar } from './Avatar';
import { uploadAvatar } from '../services/storageService';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  name: string;
  onAvatarChange: (url: string | null) => void;
}

export function AvatarUpload({ userId, currentAvatarUrl, name, onAvatarChange }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const url = await uploadAvatar(userId, file);
      onAvatarChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar name={name} imageUrl={currentAvatarUrl} size="xl" />
        <label
          htmlFor="avatar-upload"
          className="absolute -bottom-2 -right-2 p-2.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-warm-cream transition-all border border-warm-gray group-hover:scale-110 duration-200 z-10"
        >
          <Upload className="w-5 h-5 text-warm-brown" />
          <input
            id="avatar-upload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
      {isUploading && (
        <div className="text-sm text-warm-brown/70 animate-pulse">Uploading...</div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">{error}</div>
      )}
    </div>
  );
}