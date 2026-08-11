-- Run this once in the Supabase SQL editor.
-- Adds an explicit business decision to each Advance Payment record: whether
-- more advance will be needed again later, or not. This — not just whether
-- the amount is fully paid — is what gates whether the PO moves on to the
-- Follow UP / Lifting stage:
--   * "need_again"       -> proceeds to Follow UP / Lifting now (more advance
--                            will still be collected later, tracked separately)
--   * "not_needed_again" -> stays in Payment > Advance Pending, does not
--                            appear in Follow UP / Lifting yet

ALTER TABLE public.vendor_payments
  ADD COLUMN IF NOT EXISTS advance_status text;
