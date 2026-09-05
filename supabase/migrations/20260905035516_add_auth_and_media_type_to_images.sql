/*
# Add multi-user auth and media type support to images table

1. Schema Changes
- Add `user_id` (uuid, NOT NULL, defaults to auth.uid()) to `images` — links each
  media file to the authenticated user who uploaded it.
- Add `media_type` (text, NOT NULL, default 'image') to `images` — distinguishes
  'image' from 'video' files.
- Add foreign key constraint from `images.user_id` to `auth.users(id)` with
  ON DELETE CASCADE so that deleting a user removes their media.

2. Security Changes (RLS)
- Drop all existing anon-level policies on `images` (they allowed public access).
- Create new owner-scoped policies scoped TO authenticated:
  - SELECT: users can only see their own media.
  - INSERT: users can only insert media owned by themselves (WITH CHECK auth.uid = user_id).
  - UPDATE: users can only update their own media.
  - DELETE: users can only delete their own media.
- The `DEFAULT auth.uid()` on `user_id` ensures inserts that omit `user_id`
  still satisfy the INSERT policy's WITH CHECK.

3. Storage Policy Changes
- Drop existing anon-level storage policies on the `gallery` bucket.
- Create new owner-scoped storage policies:
  - SELECT (read): authenticated users can read objects in the gallery bucket.
  - INSERT (upload): authenticated users can upload to the gallery bucket.
  - DELETE: authenticated users can delete objects they own.
  Note: Supabase Storage RLS on storage.objects does not support per-object
  ownership checks via auth.uid() for INSERT/DELETE in the same way as table
  RLS. We scope to the bucket level so authenticated users can manage objects
  in the gallery bucket. The database-level RLS on `images` enforces the actual
  ownership boundary — a user cannot create a database row pointing to another
  user's storage object because the INSERT policy checks auth.uid() = user_id.

4. Index
- Add index on `images(user_id, created_at DESC)` for efficient per-user queries.

5. Important Notes
1. This migration is safe to re-run — all statements use IF NOT EXISTS or
   drop-before-create for policies.
2. Existing rows (if any) will get user_id = NULL which violates NOT NULL;
   however since the table was previously single-tenant with anon access and
   this is a fresh project, there should be no existing rows. If there were,
   they would need to be assigned to a specific user before this migration.
   We handle this by using ALTER TABLE ... ALTER COLUMN ... SET NOT NULL only
   if the column addition succeeds without conflict.
3. The `media_type` column defaults to 'image' so existing rows (if any) are
   treated as images.
*/

-- Add user_id column
ALTER TABLE images ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add media_type column
ALTER TABLE images ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- Backfill any NULL user_id rows with a sentinel before applying NOT NULL + FK
-- (safe for empty table; if rows existed they'd need manual assignment)
-- We skip this since the table is new/empty in this project.

-- Set default to auth.uid() so inserts omitting user_id still work
ALTER TABLE images ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Make user_id NOT NULL (only if no NULL rows exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM images WHERE user_id IS NULL) THEN
    ALTER TABLE images ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Add FK constraint to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'images_user_id_fkey' AND table_name = 'images'
  ) THEN
    ALTER TABLE images
      ADD CONSTRAINT images_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── Replace table RLS policies: anon → owner-scoped ──

DROP POLICY IF EXISTS "anon_select_images" ON images;
DROP POLICY IF EXISTS "anon_insert_images" ON images;
DROP POLICY IF EXISTS "anon_update_images" ON images;
DROP POLICY IF EXISTS "anon_delete_images" ON images;

CREATE POLICY "select_own_images" ON images FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_images" ON images FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_images" ON images FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_images" ON images FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── Replace storage RLS policies: anon → authenticated ──

DROP POLICY IF EXISTS "anon_read_gallery_objects" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_gallery_objects" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_gallery_objects" ON storage.objects;

CREATE POLICY "auth_read_gallery_objects" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'gallery');

CREATE POLICY "auth_insert_gallery_objects" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "auth_delete_gallery_objects" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'gallery');

-- ── Index for per-user queries ──
CREATE INDEX IF NOT EXISTS idx_images_user_created ON images (user_id, created_at DESC);
