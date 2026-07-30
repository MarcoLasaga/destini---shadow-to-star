-- ====================================================================
-- STYLE SENSE - STORAGE BUCKET & RLS POLICIES
-- ====================================================================
-- Run this script in the Supabase SQL Editor.
-- It ensures the wardrobe-images bucket exists and configures the 
-- correct read/write security policies.
-- ====================================================================

-- 1. Create the wardrobe-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wardrobe-images',
  'wardrobe-images',
  true,
  5242880, -- 5MB
  '{image/jpeg,image/png,image/gif,image/webp}'
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880;

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their wardrobe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their wardrobe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their wardrobe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their wardrobe images" ON storage.objects;

-- 3. Create the public read access policy
-- The app stores public URLs in wardrobe_items, so this bucket intentionally has
-- public read access. Writes remain strictly limited to the owner folder below.
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'wardrobe-images');

-- 4. Create the authenticated upload policy
CREATE POLICY "Users can upload their wardrobe images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 5. Create the authenticated update policy
CREATE POLICY "Users can update their wardrobe images" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  ) WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 6. Create the authenticated delete policy
CREATE POLICY "Users can delete their wardrobe images" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
