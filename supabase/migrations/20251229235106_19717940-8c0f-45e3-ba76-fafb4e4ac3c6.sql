-- Create admin_codes table for managing multiple admin users
CREATE TABLE public.admin_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.admin_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read admin codes (needed for login verification)
CREATE POLICY "Anyone can read admin_codes for login"
ON public.admin_codes
FOR SELECT
USING (true);

-- Allow authenticated admins to manage admin codes (will be controlled in app)
CREATE POLICY "Allow insert admin_codes"
ON public.admin_codes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update admin_codes"
ON public.admin_codes
FOR UPDATE
USING (true);

CREATE POLICY "Allow delete admin_codes"
ON public.admin_codes
FOR DELETE
USING (true);

-- Migrate existing admin code from settings to new table
INSERT INTO public.admin_codes (code, name)
SELECT value, 'Main Admin'
FROM public.settings
WHERE key = 'admin_code'
ON CONFLICT (code) DO NOTHING;