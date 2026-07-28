-- ====================================================================
-- STYLE SENSE - WARDROBE ITEMS TABLE
-- ====================================================================
-- Run this script in the Supabase SQL Editor.
-- It creates the public.wardrobe_items table and configures Row Level Security.
-- ====================================================================

-- UNCOMMENT THE FOLLOWING LINE IF YOU WANT A CLEAN SLATE (WARNING: deletes all data):
-- DROP TABLE IF EXISTS public.wardrobe_items CASCADE;

CREATE TABLE IF NOT EXISTS public.wardrobe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    clothing_name TEXT NOT NULL,
    color TEXT,
    material TEXT,
    brand TEXT,
    style TEXT,
    occasion TEXT,
    season TEXT,
    size TEXT,
    estimated_price NUMERIC,
    notes TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    laundry_status TEXT NOT NULL DEFAULT 'CLEAN',
    wear_count INTEGER NOT NULL DEFAULT 0,
    wash_count INTEGER NOT NULL DEFAULT 0,
    last_worn_at TIMESTAMPTZ,
    last_washed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Mobile compatibility fields
    seasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    occasions TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can view their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can update their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can delete their own wardrobe items" ON public.wardrobe_items;

-- Create policies for RLS
CREATE POLICY "Users can insert their own wardrobe items" ON public.wardrobe_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own wardrobe items" ON public.wardrobe_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wardrobe items" ON public.wardrobe_items
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wardrobe items" ON public.wardrobe_items
    FOR DELETE USING (auth.uid() = user_id);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_idx ON public.wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_category_idx ON public.wardrobe_items(user_id, category);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_is_favorite_idx ON public.wardrobe_items(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS wardrobe_items_user_id_laundry_status_idx ON public.wardrobe_items(user_id, laundry_status);
