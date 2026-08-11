-- Run this once in the Supabase SQL editor.
-- Adds Transport Type to Purchase Orders, prefilled in the Create PO form
-- from whatever the vendor selected on their quotation.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transport_type text;
