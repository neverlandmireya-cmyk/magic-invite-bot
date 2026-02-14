-- =====================================================
-- COMPLETE DATABASE SCHEMA MIGRATION
-- Project: Magic Invite Bot
-- Generated: 2026-02-14
-- =====================================================

-- ============ TABLES ============

-- 1. settings
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 2. admin_codes
CREATE TABLE public.admin_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.admin_codes ENABLE ROW LEVEL SECURITY;

-- 3. resellers
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL,
  group_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

-- 4. invite_links
CREATE TABLE public.invite_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_link TEXT NOT NULL,
  group_id TEXT NOT NULL,
  group_name TEXT,
  access_code TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  client_email TEXT,
  client_id TEXT,
  receipt_url TEXT,
  note TEXT,
  reseller_code TEXT
);
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- 5. revenue
CREATE TABLE public.revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID,
  amount NUMERIC NOT NULL,
  access_code TEXT NOT NULL,
  created_by TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;

-- 6. tickets
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_code TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  reseller_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 7. ticket_replies
CREATE TABLE public.ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id),
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- 8. activity_logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  performed_by TEXT NOT NULL,
  details JSONB,
  reseller_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.user_owns_link(link_access_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_links 
    WHERE access_code = link_access_code
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ STORAGE ============

-- Create private receipts bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- ============ DATA EXPORT ============

-- admin_codes
INSERT INTO public.admin_codes (id, name, code, is_active, created_at, last_used_at) VALUES
  ('fcadc447-0bd6-47d0-ae5a-40002b34a938', 'Jhoson', 'ZG325F548K', true, '2025-12-29 23:53:57.459089+00', '2025-12-31 12:10:58.037+00'),
  ('080795a2-0009-4634-8f28-8fc557c954b9', 'Main Admin', 'XK9M7PQWT4NE2VBC', true, '2025-12-29 23:51:05.49722+00', '2026-02-14 17:24:03.821+00');

-- resellers
INSERT INTO public.resellers (id, name, code, credits, group_id, group_name, is_active, created_at, last_used_at) VALUES
  ('32ab0d42-b155-4232-b7de-60d2317b771c', 'Atocmi', 'RSDYGDR9', 9, '-1003463417127', 'UflashBrasilTV - Premium™ (Official)', true, '2025-12-30 20:22:11.240002+00', '2025-12-31 12:29:45.927+00'),
  ('a14c122a-b15a-4d39-bb76-7bf8ebb82481', 'DA', 'QGPMSDHDB5KB', 1, '-1003463417127', 'UflashBrasilTV - Premium™ (Official)', true, '2025-12-30 20:36:29.538786+00', '2025-12-31 14:57:02.85+00'),
  ('0eb86d64-15f9-4c44-b070-8820c67dc58c', 'Tom', 'NNLK446VWBQD', 2, '-1002637672497', 'counterking', true, '2025-12-31 15:09:32.56112+00', NULL);

-- settings
INSERT INTO public.settings (id, key, value, created_at, updated_at) VALUES
  ('47318a2b-a1b2-49df-a96c-907bcfdfcccf', 'admin_code', 'ADMIN2024', '2025-12-29 23:38:32.129433+00', '2025-12-29 23:38:32.129433+00'),
  ('1b2f98d7-e47c-4e67-91bd-5f02d066aedf', 'bot_token', '8586280308:AAE2HfpzlT-q47OsDBgqwITqXhBTKYI0euM', '2025-12-29 23:13:26.682498+00', '2025-12-30 14:27:03.693803+00'),
  ('ff73a441-c991-4bc9-8a2f-fcedf4d6dfbc', 'command_bot_token', '8420072785:AAGShgPVzNIkEX4fNSGphDRyOqfDGvE50dQ', '2026-01-29 22:17:00.10029+00', '2026-01-29 22:17:00.10029+00'),
  ('0009b883-971d-41e5-92d4-a051d1129af7', 'group_ids', '[{"id":"-1002697153976","name":"dagotica"},{"id":"-1002637672497","name":"counterking"},{"id":"-1002968746728","name":"Encoxada.tv"},{"id":"-1003086476789","name":"Flashes"},{"id":"-1003463417127","name":"UflashBrasilTV - Premium™ (Official)"}]', '2025-12-29 23:13:26.682498+00', '2026-02-01 23:54:45.672841+00'),
  ('db080bd0-4d52-42a3-bdf4-e68929574d8c', 'notification_group_id', '-1003571888497', '2025-12-31 12:32:00.296188+00', '2026-02-01 23:54:45.918868+00'),
  ('640dea5c-045c-4e91-bf55-0a04e923756a', 'telegram_admin_ids', '599959994, 5854898118, 5786587921', '2026-01-29 21:37:04.666129+00', '2026-02-01 23:54:46.064871+00');

-- tickets
INSERT INTO public.tickets (id, access_code, subject, message, status, priority, reseller_code, created_at, updated_at) VALUES
  ('0984d33b-b711-4692-8db0-8237be72b530', 'RYAPQD7Q', 'i CAN''T', 'I CAN ACCESS TO  THIS', 'open', 'normal', NULL, '2025-12-30 00:18:46.939145+00', '2025-12-30 00:33:15.572873+00'),
  ('b923847e-0cfa-4aaa-acc8-e80df53a6abf', 'ETGRW87P', 'Account Deletion Request', 'Hello, my Telegram account was deleted and I need assistance to regain access to the group. My access code is: ETGRW87P. Please help me resolve this issue.', 'open', 'high', NULL, '2025-12-30 05:04:04.765428+00', '2025-12-30 05:04:04.765428+00'),
  ('1da8ff2d-a62d-43ec-9bb3-427d3f926824', 'Z7UK683M', 'doen''t', 'doen''t working', 'closed', 'normal', NULL, '2025-12-30 15:36:16.699488+00', '2025-12-30 15:37:46.969465+00'),
  ('161162a3-939b-425a-b6f7-76ce846342cb', 'QGPMSDHDB5KB', 'Test', 'Testing this!', 'closed', 'normal', 'QGPMSDHDB5KB', '2025-12-30 21:27:08.188391+00', '2025-12-31 03:49:59.767305+00'),
  ('35455c10-a311-4e79-8cd4-96a9ac039232', 'RSDYGDR9', 'Testings', 'As proof is this', 'open', 'normal', 'RSDYGDR9', '2025-12-31 12:29:06.641161+00', '2025-12-31 12:29:06.641161+00'),
  ('7f3fff1b-c47c-48ed-b1b2-2cdf72b76a24', 'RSDYGDR9', 'aDF', 'SSSSSSSSFFFFFFFFFFF', 'open', 'normal', 'RSDYGDR9', '2025-12-31 12:29:59.074015+00', '2025-12-31 12:29:59.074015+00'),
  ('a472dc93-f6a3-4371-a9e9-31aa84e6c984', 'RSDYGDR9', 'dsff', 'uuuuuuuuufhytdjfesdrwa', 'open', 'normal', 'RSDYGDR9', '2025-12-31 12:32:22.341108+00', '2025-12-31 12:32:22.341108+00'),
  ('e9705c19-1691-412e-a267-45d62206d9f1', 'RSDYGDR9', 'rfsggg', 'tgedredredredredredredredredredr', 'open', 'normal', 'RSDYGDR9', '2025-12-31 12:35:26.724643+00', '2025-12-31 12:35:26.724643+00'),
  ('3c833ed7-dccc-4438-be2c-858f5fc11287', 'ZNCUKYTV', 'dddddddddddfg', 'ffffffffffffffffffffs', 'open', 'normal', 'QGPMSDHDB5KB', '2025-12-31 12:47:16.603474+00', '2025-12-31 12:47:16.603474+00'),
  ('d4b75b80-f15d-4fc0-8dc4-c838b2a03f93', 'QGPMSDHDB5KB', 'STGTG', 'SHYTRGFDFDFDFDFDFDFDFDFDFDFDFDF', 'open', 'normal', 'QGPMSDHDB5KB', '2025-12-31 14:57:14.068521+00', '2025-12-31 14:57:30.981458+00'),
  ('d9891646-a4fb-4bed-9410-3ec32e879010', 'QGPMSDHDB5KB', 'SSSSSSSH', 'FFFFFFFFRD', 'open', 'normal', 'QGPMSDHDB5KB', '2025-12-31 15:00:42.528134+00', '2025-12-31 15:00:42.528134+00'),
  ('cd62ffff-cafd-485e-8337-b13f0f21d2a0', 'QGPMSDHDB5KB', 'rrrrrrrrr', 'waqqqqqqqqqfygh', 'open', 'normal', 'QGPMSDHDB5KB', '2025-12-31 15:04:17.589725+00', '2025-12-31 15:04:17.589725+00'),
  ('7d1ca626-b92a-4365-980d-4b3e2949557f', '5PC9PF7B', 'yol', 'trfgdssfrdddd', 'closed', 'normal', NULL, '2025-12-31 12:36:43.617615+00', '2026-01-02 23:57:12.820362+00');

-- ticket_replies
INSERT INTO public.ticket_replies (id, ticket_id, message, is_admin, created_at) VALUES
  ('bf51ab22-9ebb-404f-ab93-7030f722079e', '0984d33b-b711-4692-8db0-8237be72b530', 'YO', false, '2025-12-30 00:18:53.961391+00'),
  ('cd2d78be-ec2d-4683-9920-d8b07a6c4cb1', '0984d33b-b711-4692-8db0-8237be72b530', 'What''s the problem?', true, '2025-12-30 00:19:20.489489+00'),
  ('cd8ee41e-9ee2-438c-a55d-0421a64a303b', '0984d33b-b711-4692-8db0-8237be72b530', 'Nothung !', false, '2025-12-30 00:33:15.326706+00'),
  ('9ef435d0-dad8-4552-b6dc-9f042e9ead41', '1da8ff2d-a62d-43ec-9bb3-427d3f926824', 'We have just generated a new link, please avoid leaving the group.', true, '2025-12-30 15:37:33.580145+00'),
  ('f79360a6-d2ce-4d5f-93c6-cce7eff9f00b', 'd4b75b80-f15d-4fc0-8dc4-c838b2a03f93', 'SSS', true, '2025-12-31 14:57:30.850822+00');

-- NOTE: invite_links, revenue, and activity_logs data is too large to include inline.
-- The data has been exported to separate files below.

-- =====================================================
-- END OF SCHEMA + CORE DATA
-- =====================================================
