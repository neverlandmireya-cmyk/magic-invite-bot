-- Create revenue table to track earnings from generated links
CREATE TABLE public.revenue (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    link_id uuid REFERENCES public.invite_links(id) ON DELETE SET NULL,
    access_code text NOT NULL,
    amount decimal(10,2) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by text NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Allow all select on revenue" 
ON public.revenue 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all insert on revenue" 
ON public.revenue 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all delete on revenue" 
ON public.revenue 
FOR DELETE 
USING (true);