-- Allow the admin panel backend (service role only) to read total DB size in bytes.
CREATE OR REPLACE FUNCTION public.admin_database_size_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT pg_database_size(current_database());
$$;

REVOKE ALL ON FUNCTION public.admin_database_size_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_database_size_bytes() TO service_role;
