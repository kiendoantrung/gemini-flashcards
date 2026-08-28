import { useMemo } from 'react';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const AVATAR_COLORS = ['#d7ffb8', '#ddf4ff', '#ffeb99', '#bae6fd', '#fed7aa'];

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const initials = name.charAt(0).toUpperCase();

  const backgroundColor = useMemo(() => {
    // Generate consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }, [name]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-24 h-24 text-3xl',
    '2xl': 'w-32 h-32 text-4xl'
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-duo-border shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-duo-charcoal font-black border-2 border-duo-border shadow-sm`}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
}
