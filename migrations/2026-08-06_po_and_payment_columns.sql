-- Run this once in the Supabase SQL editor.
-- Adds the columns needed for: GST%/HSN persistence + prefill on PO Revise,
-- the auto-generated "Make Copy" PDF link, and Remarks on Advance Payments.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS gst_percent character varying,
  ADD COLUMN IF NOT EXISTS hsn character varying,
  ADD COLUMN IF NOT EXISTS po_pdf_url text;

ALTER TABLE public.vendor_payments
  ADD COLUMN IF NOT EXISTS remarks text;
