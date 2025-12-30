-- Drop existing policies
DROP POLICY IF EXISTS "Allow insert invite_links" ON public.invite_links;
DROP POLICY IF EXISTS "Users can read their own invite link" ON public.invite_links;
DROP POLICY IF EXISTS "Authenticated users can update invite_links" ON public.invite_links;

-- Create permissive policies for all operations
CREATE POLICY "Allow all select on invite_links"
ON public.invite_links
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow all insert on invite_links"
ON public.invite_links
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow all update on invite_links"
ON public.invite_links
FOR UPDATE
TO public
USING (true);

CREATE POLICY "Allow all delete on invite_links"
ON public.invite_links
FOR DELETE
TO public
USING (true);