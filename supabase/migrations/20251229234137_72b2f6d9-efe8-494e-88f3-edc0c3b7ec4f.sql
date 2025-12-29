-- Drop the restrictive policy
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;

-- Create a policy that allows anyone to read the admin_code setting (needed for login)
CREATE POLICY "Anyone can read admin_code for login"
ON public.settings
FOR SELECT
USING (key = 'admin_code');

-- Create a policy that allows authenticated users to read other settings
CREATE POLICY "Authenticated users can read all settings"
ON public.settings
FOR SELECT
USING (auth.uid() IS NOT NULL);