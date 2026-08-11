-- Run this once in the Supabase SQL editor.
-- Adds the Delivery Location field for Stage 1 (Create Indent).

ALTER TABLE public.indents
  ADD COLUMN IF NOT EXISTS delivery_location text;
