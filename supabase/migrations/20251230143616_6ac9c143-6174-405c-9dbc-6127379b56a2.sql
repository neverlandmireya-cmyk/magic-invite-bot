-- Add receipt and note columns to invite_links
ALTER TABLE public.invite_links 
ADD COLUMN receipt_url TEXT,
ADD COLUMN note TEXT;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true);

-- Allow authenticated and anon users to upload receipts (since we use code-based auth)
CREATE POLICY "Allow all uploads to receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

-- Allow public read access to receipts
CREATE POLICY "Allow public read of receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Allow deletion of receipts
CREATE POLICY "Allow delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts');