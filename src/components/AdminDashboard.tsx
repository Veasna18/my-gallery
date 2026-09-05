import { useCallback, useEffect, useState } from 'react';
import {
  Users, Image as ImageIcon, Film, HardDrive, Trash2, Loader2,
  Shield, ShieldCheck, ArrowLeft, Heart,
} from 'lucide-react';
import { supabase, STORAGE_BUCKET, type UserProfile, type AdminMediaRecord, type MediaStats, type UserRole } from '@/lib/supabase';

interface AdminDashboardProps {
  onBackToGallery: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminDashboard({ onBackToGallery }: AdminDashboardProps) {
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [media, setMedia] = useState<AdminMediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'media'>('overview');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, usersRes, mediaRes] = await Promise.all([
      supabase.rpc('get_media_stats'),
      supabase.rpc('get_all_users'),
      supabase.rpc('get_all_media'),
    ]);

    if (statsRes.data) setStats(statsRes.data as unknown as MediaStats);
    if (usersRes.data) setUsers(usersRes.data as unknown as UserProfile[]);
    if (mediaRes.data) setMedia(mediaRes.data as unknown as AdminMediaRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleToggleRole = async (userId: string, currentRole: UserRole) => {
    const newRole: UserRole = currentRole === 'admin' ? 'user' : 'admin';
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: newRole,
      });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      alert(message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteMedia = async (item: AdminMediaRecord) => {
    setDeletingMediaId(item.id);
    try {
      // Delete storage object first
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([item.storage_path]);
      if (storageError) console.error('Storage delete error:', storageError.message);

      // Delete database row via admin function
      const { error: dbError } = await supabase.rpc('admin_delete_media', {
        p_media_id: item.id,
      });
      if (dbError) throw dbError;

      setMedia((prev) => prev.filter((m) => m.id !== item.id));
      // Refresh stats
      const { data: newStats } = await supabase.rpc('get_media_stats');
      if (newStats) setStats(newStats as unknown as MediaStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete media';
      alert(message);
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Remove ${user.email} and all of their media?`)) return;

    setDeletingUserId(user.id);
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: user.id });
      if (error) throw error;
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setMedia((prev) => prev.filter((item) => item.user_id !== user.id));
      const { data: newStats } = await supabase.rpc('get_media_stats');
      if (newStats) setStats(newStats as unknown as MediaStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove user';
      alert(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Media',
      value: stats?.total_media ?? 0,
      icon: ImageIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Users',
      value: stats?.total_users ?? 0,
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Images',
      value: stats?.total_images ?? 0,
      icon: ImageIcon,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Videos',
      value: stats?.total_videos ?? 0,
      icon: Film,
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: 'Storage Used',
      value: formatSize(stats?.total_storage_bytes ?? 0),
      icon: HardDrive,
      color: 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-xs text-gray-500">Manage users and media across the platform</p>
          </div>
        </div>
        <button
          onClick={onBackToGallery}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Gallery</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        {(['overview', 'users', 'media'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'users' ? 'Users' : 'All Media'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl p-5 shadow-sm ring-1 ring-gray-200/60"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.color} mb-3`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Recent users preview */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Recent Users</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {users.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold">
                      {u.email[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{u.email}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                    {u.role}
                  </span>
                </div>
              ))}
              {users.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No users yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              All Users ({users.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Joined</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold">
                          {u.email[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700 truncate max-w-[200px]">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                        }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleToggleRole(u.id, u.role)}
                        disabled={updatingUserId === u.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${u.role === 'admin'
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                      >
                        {updatingUserId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : u.role === 'admin' ? (
                          <Shield className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        {u.role === 'admin' ? 'Make user' : 'Make admin'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={deletingUserId === u.id}
                        className="ml-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingUserId === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">
                      No users registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media Tab */}
      {activeTab === 'media' && (
        <div>
          {media.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">No media uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200/60 transition-all duration-300 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden">
                    {item.media_type === 'video' ? (
                      <video
                        src={item.public_url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                      />
                    ) : (
                      <img
                        src={item.public_url}
                        alt={item.file_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
                      {item.media_type === 'video' ? (
                        <><Film className="w-2.5 h-2.5" />Video</>
                      ) : (
                        <><ImageIcon className="w-2.5 h-2.5" />Image</>
                      )}
                    </span>
                  </div>

                  {/* Favorite badge */}
                  {item.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-medium backdrop-blur-sm">
                        <Heart className="w-2.5 h-2.5 fill-white" />
                      </span>
                    </div>
                  )}

                  {/* Info + delete */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p className="text-white text-xs font-medium truncate mb-0.5">
                      {item.file_name}
                    </p>
                    <p className="text-white/60 text-[10px] truncate mb-1">
                      by {item.uploader_email || 'Unknown'}
                    </p>
                    <p className="text-white/70 text-[10px]">
                      {formatDate(item.created_at)} · {formatSize(item.file_size)}
                    </p>
                    <button
                      onClick={() => handleDeleteMedia(item)}
                      disabled={deletingMediaId === item.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/90 text-red-600 text-xs font-medium hover:bg-white transition-colors disabled:opacity-50 mt-2"
                    >
                      {deletingMediaId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
