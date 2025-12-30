-- Create resellers table
CREATE TABLE public.resellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  group_id text NOT NULL,
  group_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

-- Add reseller_code column to invite_links to track who created the link
ALTER TABLE public.invite_links ADD COLUMN reseller_code text;

-- Add reseller_code column to tickets for reseller-specific tickets
ALTER TABLE public.tickets ADD COLUMN reseller_code text;

-- Add reseller_code column to activity_logs to track reseller actions
ALTER TABLE public.activity_logs ADD COLUMN reseller_code text;

-- Create index for better query performance
CREATE INDEX idx_invite_links_reseller_code ON public.invite_links(reseller_code);
CREATE INDEX idx_tickets_reseller_code ON public.tickets(reseller_code);
CREATE INDEX idx_activity_logs_reseller_code ON public.activity_logs(reseller_code);