import { useCallback, useRef, useState } from 'react';
import { UploadCloud, Loader2, X, Film, Image as ImageIcon } from 'lucide-react';
import { supabase, STORAGE_BUCKET, type MediaRecord, type MediaType } from '@/lib/supabase';

interface UploadZoneProps {
  onUploadComplete: (media: MediaRecord) => void;
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const mediaType = getMediaType(file);
      if (!mediaType) {
        setError(`${file.name} is not a supported image or video file.`);
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name} (${file.type}) is not a supported file type.`);
        return;
      }

      setUploading(true);
      setError(null);
      setProgress(`Uploading ${file.name}...`);

      try {
        const ext = file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);

        const { data, error: dbError } = await supabase
          .from('images')
          .insert({
            file_name: file.name,
            storage_path: filePath,
            public_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            media_type: mediaType,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        onUploadComplete(data as MediaRecord);
        setProgress(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setProgress(null);
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach(uploadFile);
    },
    [uploadFile]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
          isDragging
            ? 'border-slate-400 bg-slate-50 scale-[1.01]'
            : 'border-gray-300 hover:border-slate-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-slate-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">{progress}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors mb-4">
                <UploadCloud className="w-7 h-7 text-slate-500" />
              </div>
              <p className="text-base font-semibold text-gray-800">
                Drag &amp; drop images or videos here
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or <span className="text-slate-600 font-medium underline underline-offset-2">browse files</span> from your device
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  PNG, JPG, GIF, WEBP
                </span>
                <span className="flex items-center gap-1">
                  <Film className="w-3.5 h-3.5" />
                  MP4, WebM
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
