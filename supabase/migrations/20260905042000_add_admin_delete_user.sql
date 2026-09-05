/* Allow admins to remove a user and their owned media. */

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own admin account';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;