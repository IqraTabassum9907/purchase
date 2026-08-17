-- Migration: Add Performance Indexes for Supabase tables
-- Run this script in your Supabase SQL Editor to speed up database queries

CREATE INDEX IF NOT EXISTS idx_indent_approvals_indent_id ON indent_approvals(indent_id);
CREATE INDEX IF NOT EXISTS idx_quotation_submissions_indent_id ON quotation_submissions(indent_id);
CREATE INDEX IF NOT EXISTS idx_approved_vendors_indent_id ON approved_vendors(indent_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_indent_id ON purchase_orders(indent_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_transporter_followups_po_id ON transporter_followups(po_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_po_id ON vendor_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_po_id ON material_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_tally_billing_po_id ON tally_billing(po_id);
CREATE INDEX IF NOT EXISTS idx_vendor_liftings_po_id ON vendor_liftings(po_id);
