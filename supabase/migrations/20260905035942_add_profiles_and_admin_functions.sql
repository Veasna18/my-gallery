/*
# Add profiles table, admin role system, and admin RPC functions

1. New Tables
- `profiles` — id, email, role, created_at
2. Trigger: auto-create profile on signup
3. Security: RLS on profiles, role column revoked from authenticated UPDATE
4. Admin RPC functions: is_admin, get_all_users, get_all_media, set_user_role,
   admin_delete_media, get_media_stats — all SECURITY DEFINER, admin-checked
5. First admin must be set manually via SQL
*/

-- ── Create profiles table ──
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (email) ON profiles TO authenticated;

-- ── Trigger: auto-create profile on signup ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Admin check function ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── Get all users (admin only) ──
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT p.id, p.email, p.role, p.created_at FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;

-- ── Get all media with uploader email (admin only) ──
CREATE OR REPLACE FUNCTION public.get_all_media()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  file_name text,
  storage_path text,
  public_url text,
  file_size bigint,
  mime_type text,
  media_type text,
  is_favorite boolean,
  created_at timestamptz,
  uploader_email text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      i.id, i.user_id, i.file_name, i.storage_path, i.public_url,
      i.file_size, i.mime_type, i.media_type, i.is_favorite, i.created_at,
      p.email AS uploader_email
    FROM public.images i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    ORDER BY i.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_media() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_all_media() TO authenticated;

-- ── Set user role (admin only) ──
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- ── Admin delete media (admin only) ──
CREATE OR REPLACE FUNCTION public.admin_delete_media(p_media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.images WHERE id = p_media_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_media(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_media(uuid) TO authenticated;

-- ── Get media stats (admin only) ──
CREATE OR REPLACE FUNCTION public.get_media_stats()
RETURNS TABLE (
  total_media bigint,
  total_users bigint,
  total_images bigint,
  total_videos bigint,
  total_storage_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      COUNT(*)::bigint AS total_media,
      (SELECT COUNT(*) FROM public.profiles)::bigint AS total_users,
      COUNT(*) FILTER (WHERE media_type = 'image')::bigint AS total_images,
      COUNT(*) FILTER (WHERE media_type = 'video')::bigint AS total_videos,
      COALESCE(SUM(file_size), 0)::bigint AS total_storage_bytes
    FROM public.images;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_media_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_media_stats() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);
