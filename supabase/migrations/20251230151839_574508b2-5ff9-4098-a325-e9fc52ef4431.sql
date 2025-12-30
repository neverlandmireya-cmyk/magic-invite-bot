-- Drop the existing constraint and add new one with 'closed_by_telegram' status
ALTER TABLE public.invite_links DROP CONSTRAINT IF EXISTS invite_links_status_check;

ALTER TABLE public.invite_links ADD CONSTRAINT invite_links_status_check 
CHECK (status IN ('active', 'used', 'expired', 'revoked', 'banned', 'closed_by_telegram'));