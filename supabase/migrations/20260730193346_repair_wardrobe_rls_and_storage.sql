-- Replaces the policies previously installed from the SQL Editor.
-- Safe to run on an existing project; it preserves wardrobe rows and images.

ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can view their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can update their own wardrobe items" ON public.wardrobe_items;
DROP POLICY IF EXISTS "Users can delete their own wardrobe items" ON public.wardrobe_items;

CREATE POLICY "Users can insert their own wardrobe items" ON public.wardrobe_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can view their own wardrobe items" ON public.wardrobe_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own wardrobe items" ON public.wardrobe_items
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own wardrobe items" ON public.wardrobe_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Keep public reads because wardrobe_items stores public URLs. Limit all writes
-- to a folder whose first segment is the authenticated user's UUID.
UPDATE storage.buckets
  SET public = true, file_size_limit = 5242880,
      allowed_mime_types = '{image/jpeg,image/png,image/webp}'
  WHERE id = 'wardrobe-images';

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their wardrobe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their wardrobe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their wardrobe images" ON storage.objects;

CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'wardrobe-images');
CREATE POLICY "Users can upload their wardrobe images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
CREATE POLICY "Users can update their wardrobe images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = (select auth.uid()::text))
  WITH CHECK (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Users can delete their wardrobe images" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
