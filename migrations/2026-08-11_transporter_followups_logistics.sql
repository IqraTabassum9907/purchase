-- Run this once in the Supabase SQL editor.
-- Backs the new "Arrange Logistics" tab in Follow UP / Lifting (sits between
-- Follow-UP and Material Lifting). It only records transporter/rate details
-- for reference — it never affects the Pending/History gate, which remains
-- driven solely by actual Material Lifting.

ALTER TABLE public.transporter_followups
  ADD COLUMN IF NOT EXISTS rate_per_kg numeric,
  ADD COLUMN IF NOT EXISTS transport_type text;
