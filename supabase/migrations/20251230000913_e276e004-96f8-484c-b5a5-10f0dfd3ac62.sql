-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_code TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket replies table
CREATE TABLE public.ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "Allow all select on tickets"
ON public.tickets FOR SELECT TO public USING (true);

CREATE POLICY "Allow all insert on tickets"
ON public.tickets FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow all update on tickets"
ON public.tickets FOR UPDATE TO public USING (true);

CREATE POLICY "Allow all delete on tickets"
ON public.tickets FOR DELETE TO public USING (true);

-- Ticket replies policies
CREATE POLICY "Allow all select on ticket_replies"
ON public.ticket_replies FOR SELECT TO public USING (true);

CREATE POLICY "Allow all insert on ticket_replies"
ON public.ticket_replies FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow all update on ticket_replies"
ON public.ticket_replies FOR UPDATE TO public USING (true);

CREATE POLICY "Allow all delete on ticket_replies"
ON public.ticket_replies FOR DELETE TO public USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();