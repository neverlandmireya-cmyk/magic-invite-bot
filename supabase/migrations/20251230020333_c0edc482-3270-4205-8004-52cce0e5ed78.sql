-- Create activity_logs table for tracking admin actions
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read logs (admin will filter client-side)
CREATE POLICY "Allow all select on activity_logs"
ON public.activity_logs
FOR SELECT
USING (true);

-- Allow all insert on activity_logs
CREATE POLICY "Allow all insert on activity_logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);