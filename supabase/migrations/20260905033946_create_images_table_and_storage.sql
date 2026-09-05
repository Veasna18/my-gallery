/*
# Create images table and storage bucket for personal image gallery

1. New Tables
- `images`
  - `id` (uuid, primary key)
  - `file_name` (text, original uploaded file name)
  - `storage_path` (text, path used in the Supabase Storage bucket)
  - `public_url` (text, public URL to access the image)
  - `file_size` (bigint, size in bytes)
  - `mime_type` (text, e.g. image/png)
  - `is_favorite` (boolean, default false, marks favorite images)
  - `created_at` (timestamptz, upload timestamp)

2. Storage
- Create a public storage bucket named `gallery` if it does not exist.
- The bucket is public so uploaded images can be displayed via their public URL.

3. Security
- Enable RLS on `images`.
- This is a single-tenant personal gallery (no sign-in screen), so all CRUD
  is allowed for both `anon` and `authenticated` roles.
- Storage policies allow public read and allow anon/authenticated upload + delete.

4. Notes
1. The app uses the anon key, so policies must include the `anon` role.
2. `is_favorite` is toggled from the UI via an UPDATE.
3. Deleting an image removes both the database row and the storage object.
*/

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  file_size bigint DEFAULT 0,
  mime_type text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_images" ON images;
CREATE POLICY "anon_select_images" ON images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_images" ON images;
CREATE POLICY "anon_insert_images" ON images FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_images" ON images;
CREATE POLICY "anon_update_images" ON images FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_images" ON images;
CREATE POLICY "anon_delete_images" ON images FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_gallery_objects" ON storage.objects;
CREATE POLICY "anon_read_gallery_objects" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_insert_gallery_objects" ON storage.objects;
CREATE POLICY "anon_insert_gallery_objects" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_delete_gallery_objects" ON storage.objects;
CREATE POLICY "anon_delete_gallery_objects" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'gallery');

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images (created_at DESC);
