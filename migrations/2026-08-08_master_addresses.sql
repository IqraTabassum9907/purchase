-- Run this once in the Supabase SQL editor.
-- Adds a master list of "our company" addresses (HQ, warehouses, plants,
-- etc.) so Billing Address / Destination Address in the Quotation RFQ form
-- and the Create PO form can be picked from a dropdown instead of typed
-- freehand each time.

CREATE TABLE IF NOT EXISTS public.master_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS master_addresses_name_key ON public.master_addresses (name);

-- Seed with the existing default (name kept exactly as the app's hardcoded
-- fallback so it matches on first load) plus a few dummy locations so the
-- dropdown has real options to test with — edit/replace from Master → Addresses.
INSERT INTO public.master_addresses (name, address, is_active) VALUES
  ('M/S Nutech Pvt. Ltd.', 'Swarnabhoomi, C-131, R-5, Vidhan Sabha Road, Naya Raipur, Chattisgarh, India, Raipur, Chattisgarh 493111, IN', true),
  ('M/S Nutech Pvt. Ltd. (Warehouse - Raipur)', 'Plot No. 45, Industrial Area, Urla, Raipur, Chattisgarh 493221, IN', true),
  ('M/S Nutech Pvt. Ltd. (Factory - Bhilai)', 'Sector 5, Industrial Estate, Bhilai, Chattisgarh 490026, IN', true),
  ('M/S Nutech Pvt. Ltd. (Branch Office - Raipur)', 'Shop No. 12, VIP Road, Raipur, Chattisgarh 492001, IN', true)
ON CONFLICT (name) DO NOTHING;
