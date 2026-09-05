import { Camera, Heart, Image as ImageIcon, LogOut, Film, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  totalMedia: number;
  favoriteCount: number;
  user: User | null;
  isAdmin: boolean;
  showAdminDashboard: boolean;
  onToggleAdminDashboard: () => void;
  onLogout: () => void;
}

export default function Header({
  showFavoritesOnly,
  onToggleFavorites,
  totalMedia,
  favoriteCount,
  user,
  isAdmin,
  showAdminDashboard,
  onToggleAdminDashboard,
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 shadow-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">
                My Gallery
              </h1>
              <p className="text-xs text-gray-500 -mt-0.5">Personal Media Collection</p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            {!showAdminDashboard && (
              <>
                <button
                  onClick={onToggleFavorites}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    showFavoritesOnly
                      ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                  <span className="hidden sm:inline">Favorites</span>
                  <span className="text-xs tabular-nums bg-white/70 px-1.5 py-0.5 rounded-full ring-1 ring-gray-200">
                    {favoriteCount}
                  </span>
                </button>

                <div className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
                  <ImageIcon className="w-4 h-4" />
                  <Film className="w-4 h-4" />
                  <span className="tabular-nums">{totalMedia}</span>
                </div>
              </>
            )}

            {isAdmin && (
              <button
                onClick={onToggleAdminDashboard}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  showAdminDashboard
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {showAdminDashboard ? 'Back to Gallery' : 'Admin'}
                </span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-700 max-w-[140px] truncate">
                    {user.email}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {isAdmin ? 'Admin' : 'Signed in'}
                  </span>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-sm font-semibold">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
