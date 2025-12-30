-- Add optional client information columns to invite_links
ALTER TABLE public.invite_links 
ADD COLUMN client_email TEXT,
ADD COLUMN client_id TEXT;