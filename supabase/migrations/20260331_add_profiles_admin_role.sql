-- Add admin role support for BetterNotes internal admin panel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role text NOT NULL DEFAULT 'user'
  CHECK (admin_role IN ('user', 'admin', 'superadmin'));

CREATE INDEX IF NOT EXISTS idx_profiles_admin_role
  ON public.profiles(admin_role);

-- Example: grant superadmin access to a specific account
-- UPDATE public.profiles
-- SET admin_role = 'superadmin'
-- WHERE email = 'massomarti@gmail.com';
