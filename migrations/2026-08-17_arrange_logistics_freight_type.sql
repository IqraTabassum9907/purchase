-- Run this once in the Supabase SQL editor if not already present.
-- Adds freight_type to public.transporter_followups to support 'Per kg Rate' and 'Fixed Rate' selections.

ALTER TABLE public.transporter_followups
  ADD COLUMN IF NOT EXISTS freight_type text,
  ADD COLUMN IF NOT EXISTS rate_per_kg numeric,
  ADD COLUMN IF NOT EXISTS transport_type text;
