-- Drop existing restrictive INSERT and UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.settings;

-- Create permissive policies that allow all operations (matching other tables in this project)
CREATE POLICY "Allow all insert on settings" 
ON public.settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all update on settings" 
ON public.settings 
FOR UPDATE 
USING (true);