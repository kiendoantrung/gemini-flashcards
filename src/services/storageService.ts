import { supabase } from '../lib/supabase';

const AVATAR_BUCKET = 'avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB, mirrored by the bucket's file_size_limit

/**
 * Raster formats only. SVG is excluded on purpose: the bucket is public and
 * an SVG opened directly from its URL can run script. The bucket's
 * allowed_mime_types enforces the same list server-side.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const AVATAR_ACCEPT = Object.keys(EXTENSION_BY_MIME).join(',');

export interface UploadedAvatar {
  publicUrl: string;
  /** Object path inside the bucket, `<userId>/<uuid>.<ext>`. */
  path: string;
}

/**
 * Uploads an avatar into the caller's own folder and returns its URL.
 *
 * This does NOT touch the profile: the URL is only saved when the user
 * presses Save, so cancelling the editor leaves the old avatar in place.
 * Each upload gets a fresh name, which also busts browser and CDN caches.
 */
export async function uploadAvatar(userId: string, file: File): Promise<UploadedAvatar> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 2MB');
  }

  // The extension comes from the verified MIME type, never from the file name.
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new Error('Please choose a PNG, JPEG or WebP image');
  }

  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return { publicUrl, path };
}

/**
 * The object path of an avatar URL from this bucket, or null for anything
 * else (e.g. a Google profile picture).
 */
export function avatarPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * Whether `path` belongs to `userId`: the current `<userId>/...` layout, or
 * the legacy `<userId>-<timestamp>.<ext>` files at the bucket root.
 */
function isOwnAvatarPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) || (!path.includes('/') && path.startsWith(`${userId}-`));
}

/**
 * Best-effort removal of avatar files the user no longer uses. Storage
 * clutter is not worth failing a profile save over, so errors are logged.
 */
export async function removeAvatarFiles(userId: string, paths: Array<string | null>): Promise<void> {
  const owned = [...new Set(paths)].filter(
    (path): path is string => !!path && isOwnAvatarPath(userId, path),
  );
  if (owned.length === 0) return;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(owned);
  if (error) {
    console.warn('Could not remove old avatar files:', error);
  }
}
