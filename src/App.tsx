import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Camera } from 'lucide-react';
import Header from '@/components/Header';
import UploadZone from '@/components/UploadZone';
import GalleryGrid from '@/components/GalleryGrid';
import AuthModal from '@/components/AuthModal';
import AdminDashboard from '@/components/AdminDashboard';
import AdminLoginModal from '@/components/AdminLoginModal';
import { isAdminAuthenticated, logoutAdmin } from '@/lib/auth';
import { supabase, type MediaRecord } from '@/lib/supabase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(() => isAdminAuthenticated());

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // ── Auth: restore session + listen for changes ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (!session) {
        setAuthModalOpen(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (!session) {
          setMedia([]);
          setIsAdmin(false);
          setShowAdminDashboard(false);
          setAuthModalOpen(true);
        } else {
          setAuthModalOpen(false);
        }
      })();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ── Check admin status when user changes ──
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!error && data === true) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
  }, [user]);

  // ── Fetch media for the logged-in user ──
  const fetchMedia = useCallback(async () => {
    if (!user) {
      setMedia([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load media:', error.message);
    } else {
      setMedia((data as MediaRecord[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchMedia();
  }, [user, fetchMedia]);

  // ── Handlers ──
  const handleUploadComplete = useCallback((item: MediaRecord) => {
    setMedia((prev) => [item, ...prev]);
  }, []);

  const handleToggleFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      setMedia((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_favorite: isFavorite } : m))
      );

      const { error } = await supabase
        .from('images')
        .update({ is_favorite: isFavorite })
        .eq('id', id);

      if (error) {
        setMedia((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_favorite: !isFavorite } : m))
        );
        console.error('Failed to update favorite:', error.message);
      }
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleAdminLogout = useCallback(() => {
    logoutAdmin();
    setAdminAuthenticated(false);
  }, []);

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const favoriteCount = media.filter((m) => m.is_favorite).length;
  const displayedMedia = showFavoritesOnly
    ? media.filter((m) => m.is_favorite)
    : media;

  // ── Loading screen while auth restores ──
  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not signed in ──
  if (!user) {
    if (adminAuthenticated) {
      return (
        <div className="min-h-screen bg-gray-50">
          <AdminDashboard onBackToGallery={handleAdminLogout} />
        </div>
      );
    }

    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 shadow-lg mx-auto mb-5">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Gallery</h1>
            <p className="text-gray-500 mb-6">
              Sign in to upload and manage your personal image and video collection.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => openAuthModal('login')}
                className="px-6 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-6 py-2.5 rounded-lg bg-white text-slate-700 text-sm font-semibold ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                Create Account
              </button>
            </div>
            <button
              onClick={() => setAdminLoginOpen(true)}
              className="mt-5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              Admin Login
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authMode}
          onAdminLogin={() => setAdminAuthenticated(true)}
        />
        <AdminLoginModal
          isOpen={adminLoginOpen}
          onClose={() => setAdminLoginOpen(false)}
          onLogin={() => {
            setAdminLoginOpen(false);
            setAdminAuthenticated(true);
          }}
        />
      </>
    );
  }

  // ── Signed in: main app ──
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly((v) => !v)}
        totalMedia={media.length}
        favoriteCount={favoriteCount}
        user={user}
        isAdmin={isAdmin}
        showAdminDashboard={showAdminDashboard}
        onToggleAdminDashboard={() => setShowAdminDashboard((v) => !v)}
        onLogout={handleLogout}
      />

      {showAdminDashboard && isAdmin ? (
        <AdminDashboard onBackToGallery={() => setShowAdminDashboard(false)} />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <section className="mb-8">
            <UploadZone onUploadComplete={handleUploadComplete} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {showFavoritesOnly ? 'Favorite Media' : 'All Media'}
              </h2>
              <span className="text-sm text-gray-500 tabular-nums">
                {displayedMedia.length}{' '}
                {displayedMedia.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin" />
              </div>
            ) : (
              <GalleryGrid
                media={displayedMedia}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            )}
          </section>
        </main>
      )}

      <footer className="border-t border-gray-200/60 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-400">
          My Gallery — powered by Supabase
        </div>
      </footer>
    </div>
  );
}
