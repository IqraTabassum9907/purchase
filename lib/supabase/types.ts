export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: string;
  page_access: string[] | null;
  created_at: string;
}

export interface MasterDropdown {
  id: string;
  category_type: string;
  item_value: string;
  additional_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Indent {
  id: string;
  indent_number: string;
  created_by: string;
  warehouse_location: string | null;
  category: string | null;
  item_code: string | null;
  item_name: string;
  quantity: number;
  uom: string | null;
  required_date: string | null;
  urgency: string;
  specifications: string | null;
  attachment_url: string | null;
  status: string;
  created_at: string;
}

export interface IndentApproval {
  id: string;
  indent_id: string;
  approver_username: string;
  approval_status: string;
  rejection_reason: string | null;
  remarks: string | null;
  approved_at: string;
}

export interface QuotationSubmission {
  id: string;
  indent_id: string;
  vendor_name: string;
  vendor_code: string | null;
  quoted_rate: number;
  total_quoted_amount: number | null;
  tax_percent: number;
  delivery_terms: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  quotation_file_url: string | null;
  is_selected: boolean;
  submitted_by: string | null;
  created_at: string;
}

export interface ApprovedVendor {
  id: string;
  indent_id: string;
  selected_quotation_id: string | null;
  vendor_name: string;
  vendor_type: string;
  final_agreed_rate: number;
  approval_remarks: string | null;
  approved_by: string | null;
  approved_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  indent_id: string | null;
  vendor_name: string;
  po_date: string;
  item_code: string | null;
  item_name: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  payment_type: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  po_copy_url: string | null;
  created_by: string | null;
  status: string;
  created_at: string;
}

export interface VendorPayment {
  id: string;
  po_id: string | null;
  payment_type: string;
  amount: number;
  payment_mode: string | null;
  transaction_utr: string | null;
  payment_date: string;
  proof_url: string | null;
  paid_by: string | null;
  status: string;
  created_at: string;
}

export interface VendorLifting {
  id: string;
  po_id: string | null;
  contact_person: string | null;
  followup_date: string | null;
  expected_lifting_date: string | null;
  actual_lifting_date: string | null;
  vehicle_number: string | null;
  driver_contact: string | null;
  lifting_status: string;
  remarks: string | null;
  updated_at: string;
}

export interface TransporterFollowup {
  id: string;
  po_id: string | null;
  transporter_name: string;
  bilty_number: string | null;
  vehicle_number: string | null;
  dispatch_date: string | null;
  expected_arrival_date: string | null;
  current_location: string | null;
  bilty_copy_url: string | null;
  status: string;
  updated_at: string;
}

export interface MaterialReceipt {
  id: string;
  grn_number: string;
  po_id: string | null;
  received_date: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  received_item_image_url: string | null;
  bilty_invoice_image_url: string | null;
  received_by: string | null;
  status: string;
  created_at: string;
}

export interface QcInspection {
  id: string;
  material_receipt_id: string | null;
  qc_engineer: string;
  inspection_date: string;
  passed_quantity: number;
  failed_quantity: number;
  rejection_reason: string | null;
  checklist_status: any;
  damage_image_url: string | null;
  overall_status: string;
  created_at: string;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  po_id: string | null;
  material_receipt_id: string | null;
  vendor_name: string;
  return_date: string;
  returned_quantity: number;
  return_reason: string;
  return_item_image_url: string | null;
  credit_note_number: string | null;
  credit_note_date: string | null;
  credit_note_image_url: string | null;
  status: string;
  created_at: string;
}

export interface TallyBilling {
  id: string;
  po_id: string | null;
  vendor_invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  tally_voucher_number: string | null;
  tally_entry_date: string | null;
  accountant_name: string | null;
  tally_bill_copy_url: string | null;
  verification_status: string;
  created_at: string;
}

export interface OrderCancellation {
  id: string;
  indent_id: string | null;
  po_id: string | null;
  cancellation_date: string;
  cancelled_by: string;
  cancellation_reason: string;
  financial_impact: number;
  status: string;
}

export interface Database {
  public: {
    Tables: {
      users_master: { Row: User; Insert: Omit<User, "id" | "created_at">; Update: Partial<Omit<User, "id" | "created_at">> };
      indents: { Row: Indent; Insert: Omit<Indent, "id" | "created_at">; Update: Partial<Omit<Indent, "id" | "created_at">> };
      indent_approvals: { Row: IndentApproval; Insert: Omit<IndentApproval, "id" | "approved_at">; Update: Partial<Omit<IndentApproval, "id" | "approved_at">> };
      quotation_submissions: { Row: QuotationSubmission; Insert: Omit<QuotationSubmission, "id" | "created_at">; Update: Partial<Omit<QuotationSubmission, "id" | "created_at">> };
      approved_vendors: { Row: ApprovedVendor; Insert: Omit<ApprovedVendor, "id" | "approved_at">; Update: Partial<Omit<ApprovedVendor, "id" | "approved_at">> };
      purchase_orders: { Row: PurchaseOrder; Insert: Omit<PurchaseOrder, "id" | "created_at">; Update: Partial<Omit<PurchaseOrder, "id" | "created_at">> };
      vendor_payments: { Row: VendorPayment; Insert: Omit<VendorPayment, "id" | "created_at">; Update: Partial<Omit<VendorPayment, "id" | "created_at">> };
      vendor_liftings: { Row: VendorLifting; Insert: Omit<VendorLifting, "id" | "updated_at">; Update: Partial<Omit<VendorLifting, "id" | "updated_at">> };
      transporter_followups: { Row: TransporterFollowup; Insert: Omit<TransporterFollowup, "id" | "updated_at">; Update: Partial<Omit<TransporterFollowup, "id" | "updated_at">> };
      material_receipts: { Row: MaterialReceipt; Insert: Omit<MaterialReceipt, "id" | "created_at">; Update: Partial<Omit<MaterialReceipt, "id" | "created_at">> };
      qc_inspections: { Row: QcInspection; Insert: Omit<QcInspection, "id" | "created_at">; Update: Partial<Omit<QcInspection, "id" | "created_at">> };
      purchase_returns: { Row: PurchaseReturn; Insert: Omit<PurchaseReturn, "id" | "created_at">; Update: Partial<Omit<PurchaseReturn, "id" | "created_at">> };
      tally_billing: { Row: TallyBilling; Insert: Omit<TallyBilling, "id" | "created_at">; Update: Partial<Omit<TallyBilling, "id" | "created_at">> };
      order_cancellations: { Row: OrderCancellation; Insert: Omit<OrderCancellation, "id">; Update: Partial<Omit<OrderCancellation, "id">> };
    };
  };
}
