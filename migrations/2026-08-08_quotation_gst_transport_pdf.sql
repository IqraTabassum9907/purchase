-- Run this once in the Supabase SQL editor.
-- Adds GST%, Transport Type, Remarks, and the auto-generated quotation PDF
-- link to vendor quotation submissions (Stage 3 public form).

ALTER TABLE public.quotation_submissions
  ADD COLUMN IF NOT EXISTS gst_percent numeric,
  ADD COLUMN IF NOT EXISTS transport_type text,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS quotation_pdf_url text;

-- Also create a PUBLIC storage bucket named "quotation-documents" via the
-- Supabase dashboard (Storage → New bucket → Public), the same way
-- "po-documents" was set up for Purchase Order PDFs. The app uploads each
-- generated quotation PDF there and stores its public URL above.
