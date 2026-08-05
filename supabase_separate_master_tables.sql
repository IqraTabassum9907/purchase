-- =====================================================================
-- SUPABASE MIGRATION: SEPARATE DEDICATED TABLES FOR ALL MASTER DROPDOWNS
-- Run this script in the Supabase SQL Editor.
-- =====================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop old master_dropdowns table completely
DROP TABLE IF EXISTS public.master_dropdowns CASCADE;

-- 1. Master Created By Table
CREATE TABLE IF NOT EXISTS public.master_created_by (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Master Warehouses Table
CREATE TABLE IF NOT EXISTS public.master_warehouses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 3. Master Approvers Table
CREATE TABLE IF NOT EXISTS public.master_approvers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 4. Master QC Engineers Table
CREATE TABLE IF NOT EXISTS public.master_qc_engineers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 5. Master Accountants Table
CREATE TABLE IF NOT EXISTS public.master_accountants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 6. Master UOMs Table
CREATE TABLE IF NOT EXISTS public.master_uoms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 6b. Master Categories Table (backs the Category combobox on the Product Catalog form)
CREATE TABLE IF NOT EXISTS public.master_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 7. Master Checklists Table
CREATE TABLE IF NOT EXISTS public.master_checklists (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 8. Master Reject Reasons Table
CREATE TABLE IF NOT EXISTS public.master_reject_reasons (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 9. Master Cancel Stages Table
CREATE TABLE IF NOT EXISTS public.master_cancel_stages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 10. Master TAT Systems Table
CREATE TABLE IF NOT EXISTS public.master_tat_systems (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 11. Master TAT Units Table
CREATE TABLE IF NOT EXISTS public.master_tat_units (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 12. Master Transporters Table
CREATE TABLE IF NOT EXISTS public.master_transporters (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    transporter_name text NOT NULL UNIQUE,
    contact_person text DEFAULT '-',
    phone text DEFAULT '-',
    vehicle_type text DEFAULT 'truck',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 13. Master Vendors Table
CREATE TABLE IF NOT EXISTS public.master_vendors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_name text NOT NULL UNIQUE,
    contact_person text DEFAULT '-',
    phone text DEFAULT '-',
    email text DEFAULT '-',
    address text DEFAULT '-',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 14. Master Items Catalog Table
CREATE TABLE IF NOT EXISTS public.master_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code text NOT NULL UNIQUE,
    category text DEFAULT 'General',
    item_name text NOT NULL,
    uom text DEFAULT 'Nos',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 15. Master TAT Rules Table
CREATE TABLE IF NOT EXISTS public.master_tat_rules (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_name text NOT NULL DEFAULT 'Purchase FMS',
    section_name text NOT NULL,
    time_unit text NOT NULL DEFAULT 'day',
    completion_time numeric NOT NULL DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- =====================================================================
-- INITIAL SEED DATA
-- =====================================================================

INSERT INTO public.master_created_by (name) VALUES
    ('Amit Sahu'), ('Admin'), ('Purchase Team')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_warehouses (name) VALUES
    ('Divison A'), ('Division B'), ('Depot Main')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_approvers (name) VALUES
    ('Approver User'), ('Fin Director'), ('QA Manager')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_qc_engineers (name) VALUES
    ('QC Eng 1'), ('QC Eng 2')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_accountants (name) VALUES
    ('Acc 1'), ('Acc 2')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_uoms (name) VALUES
    ('Nos'), ('Sets'), ('Kgs'), ('Bags'), ('Mtrs')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_categories (name) VALUES
    ('Raw Material'), ('Hardware'), ('Electronics'), ('Office Supplies'), ('General')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_checklists (name) VALUES
    ('Check Packaging'), ('Check Quality Standards'), ('Quantity Audit')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_reject_reasons (name) VALUES
    ('Damaged Material'), ('Specification Mismatch'), ('Short Supply')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_cancel_stages (name) VALUES
    ('Create Indent'), ('Indent Approval'), ('Quotation'), ('Approved Vendor'), ('Make PO'), ('Payment'), ('Follow UP / Lifting'), ('Transporter Follow-Up'), ('Material Received'), ('Billing'), ('Purchase Return'), ('Order Cancel')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_tat_systems (name) VALUES
    ('Purchase FMS'), ('IMS'), ('FMS'), ('FMS Portal')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_tat_units (name) VALUES
    ('minute'), ('hour'), ('day')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.master_transporters (transporter_name, contact_person, phone, vehicle_type) VALUES
    ('Fast Logistics', 'Jane Smith', '9876543210', 'truck'),
    ('Swift Movers', 'John Doe', '9876501234', 'van')
ON CONFLICT (transporter_name) DO NOTHING;

INSERT INTO public.master_vendors (vendor_name, contact_person, phone, email, address) VALUES
    ('Vendor Alpha Corp', 'Alice Manager', '9123456789', 'alpha@vendor.com', '123 Industrial Area'),
    ('Beta Supplies Ltd', 'Bob Director', '9876543210', 'beta@vendor.com', '456 Commercial Hub')
ON CONFLICT (vendor_name) DO NOTHING;

INSERT INTO public.master_items (item_code, category, item_name, uom) VALUES
    ('ITEM-101', 'Raw Material', 'Steel Plates 10mm', 'Kgs'),
    ('ITEM-102', 'Hardware', 'Industrial Bolts M12', 'Nos')
ON CONFLICT (item_code) DO NOTHING;
