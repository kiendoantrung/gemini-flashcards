import { useMemo } from 'react';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const initials = name.charAt(0).toUpperCase();

  // Neo-Brutalism color palette
  const colors = ['#BBE6F0', '#22C55E', '#FF9F9F', '#FCD34D', '#A5D6E8'];

  const backgroundColor = useMemo(() => {
    // Generate consistent color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [name]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-24 h-24 text-3xl',
    '2xl': 'w-32 h-32 text-4xl'
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-dark`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-dark font-bold border-2 border-dark`}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
}