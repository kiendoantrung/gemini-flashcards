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
          className="absolute -bottom-1 -right-1 p-2 bg-duo-blue text-white rounded-full cursor-pointer hover:bg-duo-blue-dark transition-all border-2 border-duo-blue-dark shadow-duo-blue group-hover:scale-110 duration-200 z-10"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <input
            id="avatar-upload"
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
      {isUploading && (
        <div className="text-xs text-duo-pencil animate-pulse font-bold">Uploading...</div>
      )}
      {error && (
        <div className="text-xs text-duo-red bg-duo-red-subtle px-3.5 py-1 rounded-full border-2 border-duo-red font-bold">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}