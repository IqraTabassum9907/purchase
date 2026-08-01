-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users_master (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  full_name character varying NOT NULL,
  role character varying DEFAULT 'User'::character varying,
  page_access ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_master_pkey PRIMARY KEY (id)
);

-- 15 Separate Dedicated Master Tables
CREATE TABLE public.master_created_by ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_warehouses ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_approvers ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_qc_engineers ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_accountants ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_uoms ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_checklists ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_reject_reasons ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name text NOT NULL UNIQUE, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_transporters ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), transporter_name text NOT NULL UNIQUE, contact_person text, phone text, vehicle_type text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_vendors ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), vendor_name text NOT NULL UNIQUE, contact_person text, phone text, email text, address text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_items ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), item_code text NOT NULL UNIQUE, category text, item_name text NOT NULL, uom text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );
CREATE TABLE public.master_tat_rules ( id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), system_name text NOT NULL, section_name text NOT NULL, time_unit text NOT NULL, completion_time numeric NOT NULL, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() );

CREATE TABLE public.indents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  indent_number character varying NOT NULL UNIQUE,
  created_by character varying NOT NULL,
  warehouse_location character varying,
  category character varying,
  item_code character varying,
  item_name character varying NOT NULL,
  quantity numeric NOT NULL,
  uom character varying,
  required_date date,
  urgency character varying DEFAULT 'Medium'::character varying,
  specifications text,
  attachment_url text,
  status character varying DEFAULT 'Pending Approval'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT indents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.indent_approvals (
    id uuid NOT NULL DEFAULT uuid_generate_v4 (),
    indent_id uuid,
    approver_username character varying NOT NULL,
    approval_status character varying NOT NULL,
    approved_qty numeric DEFAULT 0,
    vendor_type text,
    rejection_reason text,
    remarks text,
    approved_at timestamp
    with
        time zone DEFAULT now(),
        CONSTRAINT indent_approvals_pkey PRIMARY KEY (id),
        CONSTRAINT indent_approvals_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents (id)
);

CREATE TABLE public.quotation_submissions (
    id uuid NOT NULL DEFAULT uuid_generate_v4 (),
    indent_id uuid,
    vendor_name character varying NOT NULL,
    vendor_code character varying,
    quoted_rate numeric NOT NULL,
    total_quoted_amount numeric,
    tax_percent numeric DEFAULT 0,
    delivery_terms character varying,
    payment_terms character varying,
    lead_time_days integer,
    quotation_file_url text,
    is_selected boolean DEFAULT false,
    submitted_by character varying,
    created_at timestamp
    with
        time zone DEFAULT now(),
        CONSTRAINT quotation_submissions_pkey PRIMARY KEY (id),
        CONSTRAINT quotation_submissions_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents (id)
);

CREATE TABLE public.approved_vendors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  indent_id uuid,
  selected_quotation_id uuid,
  vendor_name character varying NOT NULL,
  vendor_type character varying DEFAULT 'regular'::character varying,
  final_agreed_rate numeric NOT NULL,
  approval_remarks text,
  approved_by character varying,
  approved_at timestamp with time zone DEFAULT now(),
  CONSTRAINT approved_vendors_pkey PRIMARY KEY (id),
  CONSTRAINT approved_vendors_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id),
  CONSTRAINT approved_vendors_selected_quotation_id_fkey FOREIGN KEY (selected_quotation_id) REFERENCES public.quotation_submissions(id)
);

CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_number character varying NOT NULL,
  indent_id uuid,
  vendor_name character varying NOT NULL,
  po_date date NOT NULL,
  item_code character varying,
  item_name character varying,
  quantity numeric NOT NULL,
  unit_rate numeric NOT NULL,
  total_amount numeric NOT NULL,
  payment_type character varying,
  advance_amount numeric DEFAULT 0,
  delivery_date date,
  delivery_address text,
  po_copy_url text,
  created_by character varying,
  status character varying DEFAULT 'PO Issued'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_po_indent_unique UNIQUE (po_number, indent_id),
  CONSTRAINT purchase_orders_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id)
);

CREATE TABLE public.vendor_payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_id uuid,
  payment_type character varying NOT NULL,
  amount numeric NOT NULL,
  payment_mode character varying,
  transaction_utr character varying,
  payment_date date NOT NULL,
  proof_url text,
  paid_by character varying,
  status character varying DEFAULT 'Paid'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendor_payments_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_payments_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);

CREATE TABLE public.vendor_liftings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_id uuid,
  contact_person character varying,
  followup_date date,
  expected_lifting_date date,
  actual_lifting_date date,
  vehicle_number character varying,
  driver_contact character varying,
  lifting_status character varying DEFAULT 'Pending'::character varying,
  lifting_qty numeric DEFAULT 0,
  freight_amount numeric DEFAULT 0,
  transport_rate text,
  remarks text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendor_liftings_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_liftings_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);

CREATE TABLE public.transporter_followups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_id uuid,
  lifting_id uuid,
  transporter_name character varying NOT NULL,
  bilty_number character varying,
  vehicle_number character varying,
  dispatch_date date,
  expected_arrival_date date,
  current_location character varying,
  bilty_copy_url text,
  freight_amount numeric DEFAULT 0,
  transport_rate text,
  status character varying DEFAULT 'In Transit'::character varying,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transporter_followups_pkey PRIMARY KEY (id),
  CONSTRAINT transporter_followups_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id),
  CONSTRAINT transporter_followups_lifting_id_fkey FOREIGN KEY (lifting_id) REFERENCES public.vendor_liftings(id)
);

CREATE TABLE public.material_receipts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  grn_number character varying NOT NULL UNIQUE,
  po_id uuid,
  received_date date NOT NULL,
  received_quantity numeric NOT NULL,
  accepted_quantity numeric DEFAULT 0,
  rejected_quantity numeric DEFAULT 0,
  extra_freight numeric DEFAULT 0,
  received_item_image_url text,
  bilty_invoice_image_url text,
  received_by character varying,
  status character varying DEFAULT 'QC Pending'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT material_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT material_receipts_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);

CREATE TABLE public.qc_inspections (
    id uuid NOT NULL DEFAULT uuid_generate_v4 (),
    material_receipt_id uuid,
    qc_engineer character varying NOT NULL,
    inspection_date date NOT NULL,
    passed_quantity numeric NOT NULL,
    failed_quantity numeric DEFAULT 0,
    rejection_reason text,
    checklist_status jsonb,
    damage_image_url text,
    overall_status character varying NOT NULL,
    created_at timestamp
    with
        time zone DEFAULT now(),
        CONSTRAINT qc_inspections_pkey PRIMARY KEY (id),
        CONSTRAINT qc_inspections_material_receipt_id_fkey FOREIGN KEY (material_receipt_id) REFERENCES public.material_receipts (id)
);

CREATE TABLE public.purchase_returns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  return_number character varying NOT NULL UNIQUE,
  po_id uuid,
  material_receipt_id uuid,
  vendor_name character varying NOT NULL,
  return_date date NOT NULL,
  returned_quantity numeric NOT NULL,
  return_reason text NOT NULL,
  return_item_image_url text,
  credit_note_number character varying,
  credit_note_date date,
  credit_note_image_url text,
  status character varying DEFAULT 'Initiated'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_returns_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_returns_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_returns_material_receipt_id_fkey FOREIGN KEY (material_receipt_id) REFERENCES public.material_receipts(id)
);

CREATE TABLE public.tally_billing (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_id uuid,
  vendor_invoice_number character varying NOT NULL,
  invoice_date date NOT NULL,
  invoice_amount numeric NOT NULL,
  tally_voucher_number character varying,
  tally_entry_date date,
  accountant_name character varying,
  tally_bill_copy_url text,
  verification_status character varying DEFAULT 'Verified'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tally_billing_pkey PRIMARY KEY (id),
  CONSTRAINT tally_billing_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);

CREATE TABLE public.order_cancellations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  indent_id uuid,
  po_id uuid,
  cancellation_date timestamp with time zone DEFAULT now(),
  cancelled_by character varying NOT NULL,
  cancellation_reason text NOT NULL,
  financial_impact numeric DEFAULT 0,
  status character varying DEFAULT 'Cancelled'::character varying,
  CONSTRAINT order_cancellations_pkey PRIMARY KEY (id),
  CONSTRAINT order_cancellations_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.indents(id),
  CONSTRAINT order_cancellations_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);