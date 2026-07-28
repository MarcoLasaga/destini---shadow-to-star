-- ====================================================================
-- STYLE SENSE - WARDROBE ITEMS COLUMN RECONCILIATION
-- ====================================================================
-- Run this script in the Supabase SQL Editor if the public.wardrobe_items
-- table already exists and is missing columns like laundry_status.
-- ====================================================================

-- 1. Ensure columns exist on the table
ALTER TABLE public.wardrobe_items 
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS clothing_name TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS material TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS occasion TEXT,
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS estimated_price NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN,
  ADD COLUMN IF NOT EXISTS laundry_status TEXT,
  ADD COLUMN IF NOT EXISTS wear_count INTEGER,
  ADD COLUMN IF NOT EXISTS wash_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_worn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_washed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seasons TEXT[],
  ADD COLUMN IF NOT EXISTS occasions TEXT[];

-- 2. Set default values and constraints
ALTER TABLE public.wardrobe_items 
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN clothing_name SET NOT NULL,
  ALTER COLUMN is_favorite SET DEFAULT FALSE,
  ALTER COLUMN is_favorite SET NOT NULL,
  ALTER COLUMN laundry_status SET DEFAULT 'CLEAN',
  ALTER COLUMN laundry_status SET NOT NULL,
  ALTER COLUMN wear_count SET DEFAULT 0,
  ALTER COLUMN wear_count SET NOT NULL,
  ALTER COLUMN wash_count SET DEFAULT 0,
  ALTER COLUMN wash_count SET NOT NULL,
  ALTER COLUMN seasons SET DEFAULT '{}'::TEXT[],
  ALTER COLUMN seasons SET NOT NULL,
  ALTER COLUMN occasions SET DEFAULT '{}'::TEXT[],
  ALTER COLUMN occasions SET NOT NULL;

-- 3. Re-enable RLS
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

-- 4. Re-create policies for safety
DROP POLICY IF EXISTS "Users can insert their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can view their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can update their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can delete their own wardrobe items" ON public.wardrobe_items;

CREATE POLICY "Users can insert their own wardrobe items" ON public.wardrobe_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own wardrobe items" ON public.wardrobe_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wardrobe items" ON public.wardrobe_items
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wardrobe items" ON public.wardrobe_items
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Re-create indexes
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_idx ON public.wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_category_idx ON public.wardrobe_items(user_id, category);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_is_favorite_idx ON public.wardrobe_items(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_laundry_status_idx ON public.wardrobe_items(user_id, laundry_status);
