-- ====================================================================
-- STYLE SENSE - ASSIGN ADMIN ROLE (CLEANUP VERSION)
-- ====================================================================
-- Run this script in the Supabase SQL Editor to make a user an admin.
-- Replace 'admin@stylesense.com' with the email of the admin user.
-- ====================================================================

-- 1. Insert the 'admin' role if it does not exist already
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'admin@stylesense.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Delete any redundant 'user' role for anyone who already has the 'admin' role.
-- This keeps the roles clean and prevents constraint violations.
DELETE FROM public.user_roles
WHERE role = 'user'::public.app_role
  AND user_id IN (
    SELECT user_id 
    FROM public.user_roles 
    WHERE role = 'admin'::public.app_role
  );
