-- Drop the existing check constraint and add one that includes 'banned'
ALTER TABLE public.invite_links DROP CONSTRAINT IF EXISTS invite_links_status_check;

-- Add new check constraint with 'banned' status
ALTER TABLE public.invite_links ADD CONSTRAINT invite_links_status_check 
  CHECK (status IN ('active', 'used', 'expired', 'revoked', 'banned'));