/*
# Tighten function and table grants for defense-in-depth

1. Revoke EXECUTE from PUBLIC and anon on all admin RPC functions
   (is_admin, get_all_users, get_all_media, set_user_role, admin_delete_media,
   get_media_stats). The internal is_admin() check already blocks anon, but
   removing the EXECUTE grant adds defense-in-depth.
2. Revoke all privileges from anon on profiles table — anon has no legitimate
   access path since RLS has no anon policies.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_all_media() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_all_media() FROM anon;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.admin_delete_media(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_media(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_media_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_media_stats() FROM anon;

-- Revoke anon privileges on profiles
REVOKE ALL ON public.profiles FROM anon;

-- Grant execute to authenticated only
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_media() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_media(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_stats() TO authenticated;
