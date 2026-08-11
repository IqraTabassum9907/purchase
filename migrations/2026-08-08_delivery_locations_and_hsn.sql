-- Run this once in the Supabase SQL editor.
-- Delivery Location is its own concept (where an indent's items should be
-- delivered) separate from Billing/Destination Address (our company's legal
-- addresses used on Quotations/POs) — gets its own master list. HSN codes
-- also get their own master list instead of being typed freehand per PO line.

CREATE TABLE IF NOT EXISTS public.master_delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS master_delivery_locations_name_key ON public.master_delivery_locations (name);

INSERT INTO public.master_delivery_locations (name, is_active) VALUES
  ('Raipur Warehouse', true),
  ('Bhilai Factory Gate', true),
  ('Durg Site Office', true),
  ('Naya Raipur HQ', true)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.master_hsn_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS master_hsn_codes_name_key ON public.master_hsn_codes (name);

INSERT INTO public.master_hsn_codes (name, is_active) VALUES
  ('7308', true),
  ('7326', true),
  ('8481', true),
  ('3926', true)
ON CONFLICT (name) DO NOTHING;

-- Optional: persist the chosen Delivery Location on the PO itself. The app
-- degrades gracefully (drops this field and retries) if this column isn't
-- present yet, so running this is recommended but not immediately required.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_location text;
