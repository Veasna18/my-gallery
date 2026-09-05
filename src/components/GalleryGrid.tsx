import { useState } from 'react';
import { Heart, Download, Trash2, Loader2, X, Film, Image as ImageIcon, Play } from 'lucide-react';
import { supabase, STORAGE_BUCKET, type MediaRecord } from '@/lib/supabase';

interface GalleryGridProps {
  media: MediaRecord[];
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
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
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GalleryGrid({
  media,
  onToggleFavorite,
  onDelete,
}: GalleryGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<MediaRecord | null>(null);

  const handleDelete = async (item: MediaRecord) => {
    setDeletingId(item.id);
    try {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([item.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;

      onDelete(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (item: MediaRecord) => {
    try {
      const response = await fetch(item.public_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.public_url, '_blank');
    }
  };

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm">No media here yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200/60 transition-all duration-300 hover:shadow-lg hover:ring-gray-300"
          >
            <div className="aspect-square overflow-hidden">
              {item.media_type === 'video' ? (
                <div
                  className="relative w-full h-full cursor-pointer"
                  onClick={() => setLightboxItem(item)}
                >
                  <video
                    src={item.public_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-slate-700 fill-slate-700 ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={item.public_url}
                  alt={item.file_name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                  onClick={() => setLightboxItem(item)}
                />
              )}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="absolute top-2.5 left-2.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
                {item.media_type === 'video' ? (
                  <>
                    <Film className="w-2.5 h-2.5" />
                    Video
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-2.5 h-2.5" />
                    Image
                  </>
                )}
              </span>
            </div>

            <button
              onClick={() => onToggleFavorite(item.id, !item.is_favorite)}
              className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                item.is_favorite
                  ? 'bg-white/90 text-rose-500 opacity-100'
                  : 'bg-white/70 text-gray-600 opacity-0 group-hover:opacity-100 hover:text-rose-500'
              }`}
              aria-label="Toggle favorite"
            >
              <Heart
                className={`w-4 h-4 ${item.is_favorite ? 'fill-rose-500' : ''}`}
              />
            </button>

            <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-xs font-medium truncate mb-0.5">
                {item.file_name}
              </p>
              <p className="text-white/70 text-[10px]">
                {formatDate(item.created_at)} · {formatSize(item.file_size)}
              </p>

              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => handleDownload(item)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/90 text-gray-700 text-xs font-medium hover:bg-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/90 text-red-600 text-xs font-medium hover:bg-white transition-colors disabled:opacity-50"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>

            {item.is_favorite && (
              <div className="absolute top-10 left-2.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-medium backdrop-blur-sm">
                  <Heart className="w-2.5 h-2.5 fill-white" />
                  Fav
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setLightboxItem(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
          {lightboxItem.media_type === 'video' ? (
            <video
              src={lightboxItem.public_url}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxItem.public_url}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
