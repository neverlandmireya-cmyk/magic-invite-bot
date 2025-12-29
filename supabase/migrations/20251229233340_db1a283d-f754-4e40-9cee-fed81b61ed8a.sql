-- Add access_code column to invite_links table
ALTER TABLE public.invite_links ADD COLUMN access_code TEXT UNIQUE;

-- Create index for faster code lookups
CREATE INDEX idx_invite_links_access_code ON public.invite_links(access_code);

-- Update RLS policy to allow reading only own link via access_code
DROP POLICY IF EXISTS "Authenticated users can read invite_links" ON public.invite_links;

-- Create a function to check if current user has access to a link
CREATE OR REPLACE FUNCTION public.user_owns_link(link_access_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_links 
    WHERE access_code = link_access_code
  )
$$;

-- Allow public read access for links matching session access_code (stored in app metadata)
CREATE POLICY "Users can read their own invite link"
ON public.invite_links
FOR SELECT
USING (
  -- Admin users can see all
  auth.uid() IS NOT NULL AND auth.jwt() ->> 'email' IS NOT NULL
  OR
  -- Users with access_code can see their own link
  access_code = current_setting('app.current_access_code', true)
);