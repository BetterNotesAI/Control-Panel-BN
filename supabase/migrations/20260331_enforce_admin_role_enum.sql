-- Enforce admin-only access role and store it as an enum for Supabase dropdown editing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'admin_role_enum'
  ) THEN
    CREATE TYPE public.admin_role_enum AS ENUM ('user', 'admin');
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role text NOT NULL DEFAULT 'user';

-- Drop legacy CHECK constraints on admin_role (old text + superadmin setup).
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.profiles'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%admin_role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$$;

-- Normalize existing values so only admin/user remain.
UPDATE public.profiles
SET admin_role = 'admin'
WHERE lower(coalesce(admin_role::text, '')) IN ('admin', 'superadmin');

UPDATE public.profiles
SET admin_role = 'user'
WHERE lower(coalesce(admin_role::text, '')) NOT IN ('admin', 'superadmin');

-- Convert text column to enum only when needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'admin_role'
      AND NOT (udt_schema = 'public' AND udt_name = 'admin_role_enum')
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN admin_role DROP DEFAULT;

    ALTER TABLE public.profiles
      ALTER COLUMN admin_role TYPE public.admin_role_enum
      USING admin_role::public.admin_role_enum;
  END IF;
END
$$;

ALTER TABLE public.profiles
  ALTER COLUMN admin_role SET DEFAULT 'user'::public.admin_role_enum,
  ALTER COLUMN admin_role SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_admin_role
  ON public.profiles(admin_role);
