-- Goal 9.4: harden the existing Community schema.
-- This is a reconciliation migration: the Community tables and aggregate
-- triggers already exist in the target project. It must not recreate them.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.shared_outfits') IS NULL
     OR to_regclass('public.outfit_likes') IS NULL
     OR to_regclass('public.outfit_saves') IS NULL
     OR to_regclass('public.outfit_ratings') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Goal 9.4 requires the existing Community and profiles tables';
  END IF;
  IF to_regprocedure('public.recalc_outfit_aggregates()') IS NULL THEN
    RAISE EXCEPTION 'Goal 9.4 requires the existing aggregate trigger function';
  END IF;
END $$;

ALTER TABLE public.shared_outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Store only sanitized creator attribution with each published outfit. The
-- Community feed no longer needs to read other users' full profiles.
ALTER TABLE public.shared_outfits
  ADD COLUMN IF NOT EXISTS creator_name TEXT NOT NULL DEFAULT 'StyleSense member',
  ADD COLUMN IF NOT EXISTS creator_avatar_url TEXT;

-- Preserve existing rows if the migration is applied after Community data is
-- created. Only the owner's sanitized attribution is copied.
UPDATE public.shared_outfits AS so
SET creator_name = COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), 'StyleSense member'),
    creator_avatar_url = p.avatar_url
FROM public.profiles AS p
WHERE p.id = so.user_id
  AND so.creator_name = 'StyleSense member';

-- Populate attribution from the owner's profile without exposing profile rows
-- to the feed or allowing a client to impersonate another display name.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.populate_shared_outfit_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), 'StyleSense member'), avatar_url
    INTO NEW.creator_name, NEW.creator_avatar_url
  FROM public.profiles
  WHERE id = NEW.user_id;

  NEW.creator_name := COALESCE(NEW.creator_name, 'StyleSense member');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.populate_shared_outfit_creator() FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'populate_shared_outfit_creator'
      AND tgrelid = 'public.shared_outfits'::regclass
  ) THEN
    CREATE TRIGGER populate_shared_outfit_creator
      BEFORE INSERT ON public.shared_outfits
      FOR EACH ROW EXECUTE FUNCTION private.populate_shared_outfit_creator();
  END IF;
END $$;

-- Feed and current-user interaction lookups used by the mobile client.
CREATE INDEX IF NOT EXISTS shared_outfits_user_id_idx
  ON public.shared_outfits (user_id);
CREATE INDEX IF NOT EXISTS shared_outfits_created_at_idx
  ON public.shared_outfits (created_at DESC);
CREATE INDEX IF NOT EXISTS shared_outfits_like_count_idx
  ON public.shared_outfits (like_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_outfits_occasion_created_idx
  ON public.shared_outfits (occasion, created_at DESC);
CREATE INDEX IF NOT EXISTS outfit_likes_user_id_idx
  ON public.outfit_likes (user_id);
CREATE INDEX IF NOT EXISTS outfit_saves_user_id_idx
  ON public.outfit_saves (user_id);
CREATE INDEX IF NOT EXISTS outfit_ratings_user_id_idx
  ON public.outfit_ratings (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_outfits_like_count_check'
      AND conrelid = 'public.shared_outfits'::regclass
  ) THEN
    ALTER TABLE public.shared_outfits
      ADD CONSTRAINT shared_outfits_like_count_check CHECK (like_count >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_outfits_save_count_check'
      AND conrelid = 'public.shared_outfits'::regclass
  ) THEN
    ALTER TABLE public.shared_outfits
      ADD CONSTRAINT shared_outfits_save_count_check CHECK (save_count >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_outfits_rating_count_check'
      AND conrelid = 'public.shared_outfits'::regclass
  ) THEN
    ALTER TABLE public.shared_outfits
      ADD CONSTRAINT shared_outfits_rating_count_check CHECK (rating_count >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_outfits_rating_avg_check'
      AND conrelid = 'public.shared_outfits'::regclass
  ) THEN
    ALTER TABLE public.shared_outfits
      ADD CONSTRAINT shared_outfits_rating_avg_check CHECK (rating_avg >= 0 AND rating_avg <= 5);
  END IF;
END $$;

-- Replace only the known Community policies with explicit roles and ownership
-- checks. Shared outfits remain publicly readable; writes are authenticated.
DROP POLICY IF EXISTS "Anyone can view shared outfits" ON public.shared_outfits;
DROP POLICY IF EXISTS "Users can post their own outfits" ON public.shared_outfits;
DROP POLICY IF EXISTS "Users can delete their own outfits" ON public.shared_outfits;
DROP POLICY IF EXISTS "Admins can delete any shared outfit" ON public.shared_outfits;
DROP POLICY IF EXISTS "Users can update their own outfits" ON public.shared_outfits;

CREATE POLICY "Anyone can view shared outfits"
  ON public.shared_outfits FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Users can post their own outfits"
  ON public.shared_outfits FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own outfits"
  ON public.shared_outfits FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own outfits"
  ON public.shared_outfits FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can delete any shared outfit"
  ON public.shared_outfits FOR DELETE TO authenticated
  USING (public.has_role((select auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Likes viewable by all" ON public.outfit_likes;
DROP POLICY IF EXISTS "Users can like" ON public.outfit_likes;
DROP POLICY IF EXISTS "Users can unlike" ON public.outfit_likes;
CREATE POLICY "Users can view their own likes"
  ON public.outfit_likes FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can like their own account"
  ON public.outfit_likes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can unlike their own likes"
  ON public.outfit_likes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Saves viewable by owner" ON public.outfit_saves;
DROP POLICY IF EXISTS "Users can save" ON public.outfit_saves;
DROP POLICY IF EXISTS "Users can unsave" ON public.outfit_saves;
CREATE POLICY "Users can view their own saves"
  ON public.outfit_saves FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can save their own account"
  ON public.outfit_saves FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can unsave their own saves"
  ON public.outfit_saves FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Ratings viewable by all" ON public.outfit_ratings;
DROP POLICY IF EXISTS "Users can rate" ON public.outfit_ratings;
DROP POLICY IF EXISTS "Users delete own rating" ON public.outfit_ratings;
DROP POLICY IF EXISTS "Users update own rating" ON public.outfit_ratings;
CREATE POLICY "Users can view their own ratings"
  ON public.outfit_ratings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can rate their own account"
  ON public.outfit_ratings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND rating BETWEEN 1 AND 5);
CREATE POLICY "Users can update their own ratings"
  ON public.outfit_ratings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id AND rating BETWEEN 1 AND 5);
CREATE POLICY "Users can delete their own ratings"
  ON public.outfit_ratings FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Profiles are private except for the sanitized creator snapshot stored above.
-- Existing owner flows continue to work for the web and mobile applications.
DROP POLICY IF EXISTS "Allow public read-only access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Remove broad client privileges. Aggregate columns are intentionally omitted
-- from INSERT/UPDATE grants; the existing SECURITY DEFINER trigger remains the
-- only writer of aggregate values.
REVOKE ALL ON TABLE public.shared_outfits FROM anon, authenticated;
GRANT SELECT ON public.shared_outfits TO anon, authenticated;
GRANT INSERT (user_id, name, caption, style, occasion, items, cover_image)
  ON public.shared_outfits TO authenticated;
GRANT UPDATE (name, caption, style, occasion, items, cover_image)
  ON public.shared_outfits TO authenticated;
GRANT DELETE ON public.shared_outfits TO authenticated;

REVOKE ALL ON TABLE public.outfit_likes FROM anon, authenticated;
GRANT SELECT ON public.outfit_likes TO authenticated;
GRANT INSERT (outfit_id, user_id) ON public.outfit_likes TO authenticated;
GRANT DELETE ON public.outfit_likes TO authenticated;
REVOKE ALL ON TABLE public.outfit_saves FROM anon, authenticated;
GRANT SELECT ON public.outfit_saves TO authenticated;
GRANT INSERT (outfit_id, user_id) ON public.outfit_saves TO authenticated;
GRANT DELETE ON public.outfit_saves TO authenticated;
REVOKE ALL ON TABLE public.outfit_ratings FROM anon, authenticated;
GRANT SELECT ON public.outfit_ratings TO authenticated;
GRANT INSERT (outfit_id, user_id, rating) ON public.outfit_ratings TO authenticated;
GRANT DELETE ON public.outfit_ratings TO authenticated;
GRANT UPDATE (rating) ON public.outfit_ratings TO authenticated;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- The function is used by existing triggers, not as a client RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.recalc_outfit_aggregates() FROM PUBLIC, anon, authenticated;

COMMIT;
