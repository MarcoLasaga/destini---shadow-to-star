-- Dataset review workflow for the CNN training corpus.
-- User uploads remain in the wardrobe; only approved rows are training candidates.

ALTER TABLE public.wardrobe_items
  ADD COLUMN IF NOT EXISTS dataset_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS dataset_split TEXT,
  ADD COLUMN IF NOT EXISTS dataset_reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dataset_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dataset_review_note TEXT;

ALTER TABLE public.wardrobe_items
  DROP CONSTRAINT IF EXISTS wardrobe_items_dataset_status_check;
ALTER TABLE public.wardrobe_items
  ADD CONSTRAINT wardrobe_items_dataset_status_check
  CHECK (dataset_status IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE public.wardrobe_items
  DROP CONSTRAINT IF EXISTS wardrobe_items_dataset_split_check;
ALTER TABLE public.wardrobe_items
  ADD CONSTRAINT wardrobe_items_dataset_split_check
  CHECK (dataset_split IS NULL OR dataset_split IN ('TRAIN', 'VALIDATION', 'TEST'));

CREATE INDEX IF NOT EXISTS wardrobe_items_dataset_review_idx
  ON public.wardrobe_items(dataset_status, category);

-- Admin API requests use the caller JWT, so RLS must permit admins to review rows.
DROP POLICY IF EXISTS "Admins can review dataset rows" ON public.wardrobe_items;
CREATE POLICY "Admins can review dataset rows" ON public.wardrobe_items
  FOR UPDATE TO authenticated
  USING (public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (public.has_role((select auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can view dataset rows" ON public.wardrobe_items;
CREATE POLICY "Admins can view dataset rows" ON public.wardrobe_items
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR public.has_role((select auth.uid()), 'admin')
  );
