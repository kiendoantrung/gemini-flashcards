import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { uploadAvatar, deleteAvatar } from '../services/storageService';

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

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;
    
    setIsUploading(true);
    setError(null);

    try {
      await deleteAvatar(userId, currentAvatarUrl);
      onAvatarChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar name={name} imageUrl={currentAvatarUrl} size="lg" />
        <label
          htmlFor="avatar-upload"
          className="absolute bottom-0 right-0 p-1 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50"
        >
          <Upload className="w-4 h-4 text-gray-600" />
          <input
            id="avatar-upload"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
        {currentAvatarUrl && (
          <button
            onClick={handleDelete}
            disabled={isUploading}
            className="absolute top-0 right-0 p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
      {isUploading && (
        <div className="text-sm text-gray-600">Uploading...</div>
      )}
      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
    </div>
  );
} 