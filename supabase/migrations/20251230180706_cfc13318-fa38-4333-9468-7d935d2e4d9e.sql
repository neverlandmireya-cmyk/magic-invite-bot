-- EMERGENCY DATABASE LOCKDOWN
-- Drop ALL permissive RLS policies that allow public access

-- Drop settings policies
DROP POLICY IF EXISTS "Allow all insert on settings" ON public.settings;
DROP POLICY IF EXISTS "Allow all update on settings" ON public.settings;
DROP POLICY IF EXISTS "Allow reading settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can read admin_code for login" ON public.settings;

-- Drop admin_codes policies
DROP POLICY IF EXISTS "Allow delete admin_codes" ON public.admin_codes;
DROP POLICY IF EXISTS "Allow insert admin_codes" ON public.admin_codes;
DROP POLICY IF EXISTS "Allow update admin_codes" ON public.admin_codes;
DROP POLICY IF EXISTS "Anyone can read admin_codes for login" ON public.admin_codes;

-- Drop invite_links policies
DROP POLICY IF EXISTS "Allow all delete on invite_links" ON public.invite_links;
DROP POLICY IF EXISTS "Allow all insert on invite_links" ON public.invite_links;
DROP POLICY IF EXISTS "Allow all select on invite_links" ON public.invite_links;
DROP POLICY IF EXISTS "Allow all update on invite_links" ON public.invite_links;

-- Drop tickets policies
DROP POLICY IF EXISTS "Allow all delete on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all insert on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all select on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all update on tickets" ON public.tickets;

-- Drop ticket_replies policies
DROP POLICY IF EXISTS "Allow all delete on ticket_replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Allow all insert on ticket_replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Allow all select on ticket_replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Allow all update on ticket_replies" ON public.ticket_replies;

-- Drop activity_logs policies
DROP POLICY IF EXISTS "Allow all insert on activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow all select on activity_logs" ON public.activity_logs;

-- Drop revenue policies
DROP POLICY IF EXISTS "Allow all delete on revenue" ON public.revenue;
DROP POLICY IF EXISTS "Allow all insert on revenue" ON public.revenue;
DROP POLICY IF EXISTS "Allow all select on revenue" ON public.revenue;

-- Force RLS on all tables with no public access
ALTER TABLE public.settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revenue FORCE ROW LEVEL SECURITY;