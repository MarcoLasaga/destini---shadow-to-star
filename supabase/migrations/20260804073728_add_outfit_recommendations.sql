CREATE TABLE IF NOT EXISTS public.outfit_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion TEXT,
  item_ids UUID[] NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  is_worn BOOLEAN NOT NULL DEFAULT FALSE,
  feedback_rating SMALLINT CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_note TEXT CHECK (char_length(feedback_note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outfit_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their outfit recommendations" ON public.outfit_recommendations;
DROP POLICY IF EXISTS "Users can insert their outfit recommendations" ON public.outfit_recommendations;
DROP POLICY IF EXISTS "Users can update their outfit recommendations" ON public.outfit_recommendations;
DROP POLICY IF EXISTS "Users can delete their outfit recommendations" ON public.outfit_recommendations;

CREATE POLICY "Users can view their outfit recommendations" ON public.outfit_recommendations
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their outfit recommendations" ON public.outfit_recommendations
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their outfit recommendations" ON public.outfit_recommendations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their outfit recommendations" ON public.outfit_recommendations
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS outfit_recommendations_user_created_idx
  ON public.outfit_recommendations (user_id, created_at DESC);
