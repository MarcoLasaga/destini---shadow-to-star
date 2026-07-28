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

-- 3. Create the public read access policy
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'wardrobe-images');

-- 4. Create the authenticated upload policy
CREATE POLICY "Authenticated Upload Access" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'wardrobe-images' 
    AND auth.role() = 'authenticated'
  );

-- 5. Create the authenticated update policy
CREATE POLICY "Authenticated Update Access" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'wardrobe-images'
    AND auth.role() = 'authenticated'
  ) WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND auth.role() = 'authenticated'
  );

-- 6. Create the authenticated delete policy
CREATE POLICY "Authenticated Delete Access" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'wardrobe-images'
    AND auth.role() = 'authenticated'
  );
