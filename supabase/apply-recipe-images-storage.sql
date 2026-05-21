-- Run in Supabase SQL Editor if recipe image uploads fail (bucket / policies missing).
-- Idempotent: safe to run more than once only if policies do not already exist.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- If policies already exist, drop them first or skip the CREATE POLICY block below.

CREATE POLICY "public read recipe images"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

CREATE POLICY "public insert recipe images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "public update recipe images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recipe-images')
WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "public delete recipe images"
ON storage.objects FOR DELETE
USING (bucket_id = 'recipe-images');
