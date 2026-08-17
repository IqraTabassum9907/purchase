CREATE TABLE IF NOT EXISTS public.master_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

GRANT ALL ON TABLE public.master_categories TO anon;
GRANT ALL ON TABLE public.master_categories TO authenticated;
GRANT ALL ON TABLE public.master_categories TO service_role;
