-- Make receipts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow all uploads to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete receipts" ON storage.objects;