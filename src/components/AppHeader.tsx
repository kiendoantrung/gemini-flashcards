import { useEffect, useRef, useState } from 'react';
import { UserCircle, LogOut, ChevronDown } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Avatar } from './Avatar';

interface AppHeaderProps {
  user: User | null;
  onOpenProfile: () => void;
  onLogout: () => void | Promise<void>;
}

function getIdentityAvatarUrl(user: User | null): string | null {
  if (!user?.identities?.length) return null;

  for (const identity of user.identities) {
    if (!identity?.identity_data || typeof identity.identity_data !== 'object') continue;
    const identityData = identity.identity_data as Record<string, unknown>;
    const avatarUrl = identityData.avatar_url;
    if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
      return avatarUrl;
    }
  }

  return null;
}

export function AppHeader({ user, onOpenProfile, onLogout }: AppHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const metadata =
    user?.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const displayName =
    (typeof metadata?.name === 'string' && metadata.name) ||
    (typeof metadata?.full_name === 'string' && metadata.full_name) ||
    user?.email ||
    'User';
  const avatarUrl =
    (typeof metadata?.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata?.picture === 'string' && metadata.picture) ||
    getIdentityAvatarUrl(user);

  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleLogoutClick = () => {
    void onLogout();
    setShowDropdown(false);
  };

  return (
    <header className="bg-white border-b-2 border-duo-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt="Gemini Flashcards Icon"
              className="w-10 h-10 rounded-duo-md object-contain"
            />
            <h1 className="text-xl font-heading font-black text-duo-charcoal tracking-tight">
              Gemini Flashcards
            </h1>
          </div>

          <div ref={dropdownRef} className="flex items-center gap-4 relative">
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-duo-border bg-white shadow-duo-white hover:border-duo-green hover:shadow-duo-hover active:translate-y-[2px] transition-all"
            >
              <Avatar
                name={displayName}
                imageUrl={avatarUrl}
                size="sm"
              />
              <span className="hidden md:inline text-duo-charcoal font-bold text-sm">
                {displayName}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-duo-pencil transition-transform duration-200 ${
                  showDropdown ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border-2 border-duo-border shadow-duo-modal transform opacity-100 scale-100 transition-all duration-200 ease-out origin-top-right overflow-hidden z-50">
                <div className="py-2" role="menu">
                  <button
                    onClick={() => {
                      onOpenProfile();
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-duo-charcoal hover:bg-duo-green-subtle/50 transition-colors duration-150 font-bold"
                    role="menuitem"
                  >
                    <UserCircle className="w-4 h-4 text-duo-green" />
                    <span>Edit Profile</span>
                  </button>
                  <div className="h-px bg-duo-border mx-3 my-1"></div>
                  <button
                    onClick={handleLogoutClick}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-duo-red hover:bg-duo-red-subtle/50 transition-colors duration-150 font-bold"
                    role="menuitem"
                  >
                    <LogOut className="w-4 h-4 text-duo-red" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
