-- Drop the authenticated-only policy since we don't use Supabase auth anymore
DROP POLICY IF EXISTS "Authenticated users can read all settings" ON public.settings;

-- Allow reading all settings (admin code user will manage access in the app)
CREATE POLICY "Allow reading settings"
ON public.settings
FOR SELECT
USING (true);