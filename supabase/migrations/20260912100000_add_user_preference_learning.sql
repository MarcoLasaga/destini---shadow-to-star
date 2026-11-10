-- Per-user, explainable recommendation feedback.
CREATE TABLE IF NOT EXISTS public.preference_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  style_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  color_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  occasion_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  disliked_items UUID[] NOT NULL DEFAULT '{}',
  feedback_count INTEGER NOT NULL DEFAULT 0 CHECK (feedback_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.preference_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES public.outfit_recommendations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('LIKE', 'DISLIKE', 'SKIP', 'RATING', 'SAVE', 'UNSAVE', 'WORN')),
  rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  occasion TEXT,
  item_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.preference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their preference profile" ON public.preference_profiles;
CREATE POLICY "Users manage their preference profile" ON public.preference_profiles
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage their preference events" ON public.preference_events;
CREATE POLICY "Users manage their preference events" ON public.preference_events
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS preference_events_user_created_idx
  ON public.preference_events(user_id, created_at DESC);
