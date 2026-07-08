-- ====================================================================
-- STYLE SENSE - PROFILE TABLE RECONCILIATION
-- ====================================================================
-- Run this script in the Supabase SQL Editor. 
-- It adds the missing columns to your existing public.profiles table
-- and updates the trigger function to prevent signup 500 errors.
-- ====================================================================

-- 1. Add the missing columns required by the StyleSense app
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_initial TEXT NOT NULL DEFAULT '?',
  ADD COLUMN IF NOT EXISTS current_size TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_styles TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

-- 1b. Use empty defaults for new accounts (no pre-selected size/style)
ALTER TABLE public.profiles
  ALTER COLUMN current_size SET DEFAULT '',
  ALTER COLUMN preferred_styles SET DEFAULT '{}'::TEXT[];

-- 2. Backfill display_name from existing full_name if present
UPDATE public.profiles 
  SET display_name = COALESCE(full_name, display_name) 
  WHERE display_name = '';

-- 3. Re-create user_roles table if it didn't get created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Enable RLS for User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper Function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view own roles') THEN
    CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can view all roles') THEN
    CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 4. Re-create trigger function to match columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_initial, avatar_url, current_size, preferred_styles)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    UPPER(LEFT(COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ), 1)),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    '',
    '{}'::TEXT[]
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_initial = EXCLUDED.avatar_initial,
    avatar_url = EXCLUDED.avatar_url;
  
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
