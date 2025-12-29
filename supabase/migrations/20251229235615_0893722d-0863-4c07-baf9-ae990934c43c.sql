-- Drop the old insert policy that requires auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert invite_links" ON public.invite_links;

-- Create new insert policy that allows inserts (admin access controlled in app)
CREATE POLICY "Allow insert invite_links"
ON public.invite_links
FOR INSERT
WITH CHECK (true);