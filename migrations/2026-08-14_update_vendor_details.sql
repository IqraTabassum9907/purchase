-- Seed/update master_vendors with complete prefill details for Make PO stage
UPDATE public.master_vendors SET 
  billing_address = COALESCE(NULLIF(billing_address, '-'), address),
  gstin = COALESCE(NULLIF(gstin, '-'), '27AAACV1234A1Z1'),
  pan_number = COALESCE(NULLIF(pan_number, '-'), 'AAACV1234A')
WHERE billing_address IS NULL OR billing_address = '-' OR gstin IS NULL OR gstin = '-';
