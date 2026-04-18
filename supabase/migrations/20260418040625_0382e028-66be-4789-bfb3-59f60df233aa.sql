ALTER TABLE public.invite_links
ADD COLUMN IF NOT EXISTS status_flag text NOT NULL DEFAULT 'clean'
CHECK (status_flag IN ('clean', 'pending', 'fugitive'));

CREATE INDEX IF NOT EXISTS idx_invite_links_status_flag ON public.invite_links(status_flag);
CREATE INDEX IF NOT EXISTS idx_invite_links_client_id ON public.invite_links(client_id);