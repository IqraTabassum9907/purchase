import { supabase } from "./client";

// Reconstructs the flat INDENT-LIFT row structure from normalized Supabase tables
// so existing stage components can migrate without rewriting their entire data model.

export interface FlatIndentRow {
  id: string;
  originalIndex: number;
  status: string;
  data: {
    createdAt: string;
    indentNumber: string;
    createdBy: string;
    category: string;
    itemName: string;
    quantity: string;
    warehouseLocation: string;
    itemCode: string;
    leadTime: string;
    deliveryLocation: string;
    // Stage 2: Approval
    plan1: string;
    actual1: string;
    delay: string;
    approvedQty: string;
    vendorType: string;
    remarks: string;
    attachment: string;
    // Stage 3: Quotation
    vendor1Name: string;
    vendor1Rate: string;
    vendor1Terms: string;
    vendor1Delivery: string;
    vendor1Approved: string;
    vendor1Remarks: string;
    vendor1Gst: string;
    vendor1TransportType: string;
    vendor1PdfUrl: string;
    vendor2Name: string;
    vendor2Rate: string;
    vendor2Terms: string;
    vendor2Delivery: string;
    vendor2Approved: string;
    vendor2Remarks: string;
    vendor2Gst: string;
    vendor2TransportType: string;
    vendor2PdfUrl: string;
    vendor3Name: string;
    vendor3Rate: string;
    vendor3Terms: string;
    vendor3Delivery: string;
    vendor3Approved: string;
    vendor3Remarks: string;
    vendor3Gst: string;
    vendor3TransportType: string;
    vendor3PdfUrl: string;
    plan3: string;
    actual3: string;
    selectedVendor: string;
    selectedVendorName: string;
    finalApprovedBy: string;
    negotiationRemarks: string;
    plan4: string;
    // Extra
    priority: string;
    uom: string;
    // Stage 5+
    poNumber: string;
    status2: string;
  };
  // Quotation IDs for updating
  _quotationIds?: Record<string, string>;
  _approvalId?: string;
  _approvedVendorId?: string;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  return String(val);
}

function empty(v: any): boolean {
  return !v || String(v).trim() === "" || String(v).trim() === "-";
}

let inFlightWorkflowPromise: Promise<FlatIndentRow[]> | null = null;
let cachedWorkflowData: { data: FlatIndentRow[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 1000;

export function invalidateIndentWorkflowCache() {
  cachedWorkflowData = null;
  inFlightWorkflowPromise = null;
}

/**
 * Fetch all indent workflow rows (Stages 1-4) by joining normalized tables.
 * Returns data in the same flat structure the Google Sheet provided.
 */
export async function fetchIndentWorkflow(forceRefresh = false): Promise<FlatIndentRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedWorkflowData && now - cachedWorkflowData.timestamp < CACHE_TTL_MS) {
    return cachedWorkflowData.data;
  }
  if (!forceRefresh && inFlightWorkflowPromise) {
    return inFlightWorkflowPromise;
  }

  inFlightWorkflowPromise = (async () => {
    try {
      // Single parallel roundtrip: Fetch all indents and related tables concurrently
      const [indentsRes, approvalRes, quotationRes, avRes, poRes] = await Promise.all([
        supabase.from("indents").select("*").order("created_at", { ascending: true }),
        supabase.from("indent_approvals").select("*"),
        supabase.from("quotation_submissions").select("*"),
        supabase.from("approved_vendors").select("*"),
        supabase.from("purchase_orders").select("indent_id, po_number, status, vendor_name"),
      ]);

      if (indentsRes.error) throw indentsRes.error;
      const indents = indentsRes.data || [];
      if (indents.length === 0) {
        cachedWorkflowData = { data: [], timestamp: Date.now() };
        return [];
      }

      const approvals = approvalRes.data || [];
      const quotations = quotationRes.data || [];
      const approvedVendors = avRes.data || [];
      const purchaseOrders = poRes.data || [];

      // Build lookup maps
      const approvalMap = new Map<string, any[]>();
      approvals.forEach((a) => {
        const list = approvalMap.get(a.indent_id) || [];
        list.push(a);
        approvalMap.set(a.indent_id, list);
      });

      // For quotations: group by indent_id, sort by created_at
      const quotationMap = new Map<string, any[]>();
      quotations.forEach((q) => {
        const list = quotationMap.get(q.indent_id) || [];
        list.push(q);
        quotationMap.set(q.indent_id, list);
      });

      // For approved vendors: take most recent per indent
      const avMap = new Map<string, any>();
      approvedVendors.forEach((av) => {
        const existing = avMap.get(av.indent_id);
        if (!existing || new Date(av.approved_at) > new Date(existing.approved_at)) {
          avMap.set(av.indent_id, av);
        }
      });

      // For POs: take first per indent
      const poMap = new Map<string, any>();
      purchaseOrders.forEach((po) => {
        if (po.indent_id && !poMap.has(po.indent_id)) {
          poMap.set(po.indent_id, po);
        }
      });

      const result = indents.map((indent, idx) => {
        const indentApprovals = approvalMap.get(indent.id) || [];
        const lastApproval = indentApprovals.length > 0 ? indentApprovals[indentApprovals.length - 1] : null;
        const vendorQuots = quotationMap.get(indent.id) || [];
        const av = avMap.get(indent.id);
        const po = poMap.get(indent.id);

        const totalIndentQty = parseFloat(String(indent.quantity || "0").replace(/,/g, "")) || 0;
        const totalApprovedQty = indentApprovals.reduce((sum, a) => sum + (parseFloat(String(a.approved_qty || "0").replace(/,/g, "")) || 0), 0);
        const hasApprovalRecord = indentApprovals.length > 0;

        // Determine status: once an approval/rejection record exists, Stage 2 is completed
        let status = "pending";
        if (hasApprovalRecord || totalApprovedQty > 0 || (indent.status && indent.status.toLowerCase() === "rejected")) {
          status = "completed";
        }

        const rejectedQty = totalApprovedQty > 0 ? Math.max(0, totalIndentQty - totalApprovedQty) : (indent.status?.toLowerCase() === "rejected" ? totalIndentQty : 0);
        const effectiveQty = totalApprovedQty > 0 ? totalApprovedQty : totalIndentQty;

        // Map quotations to vendor slots (up to 3)
        const getQuot = (slot: number) => vendorQuots[slot] || null;
        const q1 = getQuot(0);
        const q2 = getQuot(1);
        const q3 = getQuot(2);

        // Build quotation ID map for updating
        const quotationIds: Record<string, string> = {};
        if (q1) quotationIds["vendor1"] = q1.id;
        if (q2) quotationIds["vendor2"] = q2.id;
        if (q3) quotationIds["vendor3"] = q3.id;

        const submittedQuots = vendorQuots.filter((q) => q.quoted_rate !== null && q.quoted_rate !== undefined && String(q.quoted_rate).trim() !== "" && String(q.quoted_rate) !== "-" && parseFloat(String(q.quoted_rate)) > 0);

        return {
          id: indent.id,
          originalIndex: idx + 7,
          status,
          data: {
            createdAt: formatDate(indent.created_at),
            indentNumber: indent.indent_number || "",
            createdBy: indent.created_by || "",
            category: indent.category || "",
            itemName: indent.item_name || "",
            quantity: String(effectiveQty),
            indentQty: String(totalIndentQty),
            totalApprovedQty: String(totalApprovedQty),
            rejectedQty: String(rejectedQty),
            pendingApprovalQty: status === "completed" ? "0" : String(Math.max(0, totalIndentQty - totalApprovedQty)),
            indentApprovalsCount: String(indentApprovals.length),
            warehouseLocation: indent.warehouse_location || "",
            itemCode: indent.item_code || "",
            leadTime: indent.required_date || "",
            deliveryLocation: indent.delivery_location || "",
            // Stage 2
            plan1: "",
            actual1: lastApproval ? formatDate(lastApproval.approved_at) : "",
            delay: "",
            approvedQty: String(effectiveQty),
            vendorType: lastApproval?.vendor_type || "",
            remarks: lastApproval?.rejection_reason || lastApproval?.remarks || "",
            attachment: indent.attachment_url || "",
            // Stage 3
            vendor1Name: q1?.vendor_name || "",
            vendor1Rate: q1 ? String(q1.quoted_rate || "") : "",
            vendor1Terms: q1?.payment_terms || "",
            vendor1Delivery: q1?.delivery_terms || "",
            vendor1Approved: q1?.is_selected ? "Yes" : "No",
            vendor1Remarks: q1?.remarks || "",
            vendor1Gst: q1?.gst_percent != null ? String(q1.gst_percent) : "",
            vendor1TransportType: q1?.transport_type || "",
            vendor1PdfUrl: q1?.quotation_pdf_url || q1?.quotation_file_url || "",
            vendor2Name: q2?.vendor_name || "",
            vendor2Rate: q2 ? String(q2.quoted_rate || "") : "",
            vendor2Terms: q2?.payment_terms || "",
            vendor2Delivery: q2?.delivery_terms || "",
            vendor2Approved: q2?.is_selected ? "Yes" : "No",
            vendor2Remarks: q2?.remarks || "",
            vendor2Gst: q2?.gst_percent != null ? String(q2.gst_percent) : "",
            vendor2TransportType: q2?.transport_type || "",
            vendor2PdfUrl: q2?.quotation_pdf_url || q2?.quotation_file_url || "",
            vendor3Name: q3?.vendor_name || "",
            vendor3Rate: q3 ? String(q3.quoted_rate || "") : "",
            vendor3Terms: q3?.payment_terms || "",
            vendor3Delivery: q3?.delivery_terms || "",
            vendor3Approved: q3?.is_selected ? "Yes" : "No",
            vendor3Remarks: q3?.remarks || "",
            vendor3Gst: q3?.gst_percent != null ? String(q3.gst_percent) : "",
            vendor3TransportType: q3?.transport_type || "",
            vendor3PdfUrl: q3?.quotation_pdf_url || q3?.quotation_file_url || "",
            plan3: vendorQuots.length > 0 ? formatDate(vendorQuots[0].created_at) : "",
            actual3: submittedQuots.length > 0 ? formatDate(submittedQuots[submittedQuots.length - 1].created_at) : "",
            selectedVendor: av ? `vendor${vendorQuots.findIndex((q) => q.id === av.selected_quotation_id) + 1}` : "",
            selectedVendorName: po?.vendor_name || av?.vendor_name || "",
            finalApprovedBy: av?.approved_by || "",
            negotiationRemarks: av?.approval_remarks || "",
            plan4: av ? formatDate(av.approved_at) : "",
            // Extra
            priority: indent.urgency || "",
            uom: indent.uom || "",
            // Stage 5+
            poNumber: po?.po_number || "",
            status2: po?.status || "",
          },
          _quotationIds: quotationIds,
          _approvalId: lastApproval?.id,
          _approvedVendorId: av?.id,
        };
      });

      cachedWorkflowData = { data: result, timestamp: Date.now() };
      return result;
    } finally {
      inFlightWorkflowPromise = null;
    }
  })();

  return inFlightWorkflowPromise;
}

/**
 * Create a new indent row (Stage 1).
 * Returns the generated indent number.
 */
export async function createIndentRow(data: {
  createdBy: string;
  category: string;
  itemName: string;
  quantity: number;
  warehouseLocation: string;
  itemCode: string;
  leadTime: string;
  deliveryLocation?: string;
  priority: string;
  attachmentUrl: string;
  uom: string;
  specifications?: string;
}): Promise<string> {
  // Generate indent number: IN-NNN A
  const { data: existing, error: countErr } = await supabase
    .from("indents")
    .select("indent_number")
    .order("created_at", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (existing && existing.length > 0) {
    const match = existing[0].indent_number?.match(/IN-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  const indentNumber = `IN-${String(nextNum).padStart(3, "0")}A`;

  const { error } = await supabase.from("indents").insert({
    indent_number: indentNumber,
    created_by: data.createdBy,
    category: data.category,
    item_name: data.itemName,
    quantity: data.quantity,
    warehouse_location: data.warehouseLocation,
    item_code: data.itemCode,
    required_date: data.leadTime || null,
    delivery_location: data.deliveryLocation || "",
    urgency: data.priority || "Medium",
    attachment_url: data.attachmentUrl || "",
    uom: data.uom || "",
    specifications: data.specifications || "",
    status: "Pending Approval",
  });

  if (error) throw error;
  return indentNumber;
}

/**
 * Update an existing indent row (Stage 1 edit).
 */
export async function updateIndentRow(
  indentId: string,
  data: {
    createdBy?: string;
    category?: string;
    itemName?: string;
    quantity?: number;
    warehouseLocation?: string;
    itemCode?: string;
    leadTime?: string;
    deliveryLocation?: string;
    priority?: string;
    attachmentUrl?: string;
    uom?: string;
  }
): Promise<void> {
  const update: any = {};
  if (data.createdBy !== undefined) update.created_by = data.createdBy;
  if (data.category !== undefined) update.category = data.category;
  if (data.itemName !== undefined) update.item_name = data.itemName;
  if (data.quantity !== undefined) update.quantity = data.quantity;
  if (data.warehouseLocation !== undefined) update.warehouse_location = data.warehouseLocation;
  if (data.itemCode !== undefined) update.item_code = data.itemCode;
  if (data.leadTime !== undefined) update.required_date = data.leadTime || null;
  if (data.deliveryLocation !== undefined) update.delivery_location = data.deliveryLocation || "";
  if (data.priority !== undefined) update.urgency = data.priority;
  if (data.attachmentUrl !== undefined) update.attachment_url = data.attachmentUrl;
  if (data.uom !== undefined) update.uom = data.uom;

  const { error } = await supabase.from("indents").update(update).eq("id", indentId);
  if (error) throw error;
}

/**
 * A single "this indent was delegated to this approver" record
 * (Stage 1.5: Delegate for Approval). One indent can be delegated to
 * several approvers at once — each shows up in that approver's own tab
 * on the Indent Approval page.
 */
export interface IndentDelegation {
  id: string;
  indentId: string;
  approverUsername: string;
  approverName: string;
  createdAt: string;
}

/**
 * Fetch all delegation records, joined across every indent.
 */
export async function fetchIndentDelegations(): Promise<IndentDelegation[]> {
  const { data, error } = await supabase.from("indent_delegations").select("*");
  if (error) throw error;

  return (data || []).map((d: any) => ({
    id: d.id,
    indentId: d.indent_id,
    approverUsername: d.approver_username,
    approverName: d.approver_name || d.approver_username,
    createdAt: d.created_at,
  }));
}

/**
 * Delegate one or more pending indents to one or more approvers.
 * Skips any (indent, approver) pair that's already delegated.
 */
export async function delegateIndents(
  indentIds: string[],
  approvers: { username: string; fullName: string }[],
  delegatedBy: string
): Promise<void> {
  if (indentIds.length === 0 || approvers.length === 0) return;

  const { data: existing, error: fetchErr } = await supabase
    .from("indent_delegations")
    .select("indent_id, approver_username")
    .in("indent_id", indentIds);
  if (fetchErr) throw fetchErr;

  const existingPairs = new Set(
    (existing || []).map((e: any) => `${e.indent_id}::${e.approver_username}`)
  );

  const rows = indentIds.flatMap((indentId) =>
    approvers
      .filter((a) => !existingPairs.has(`${indentId}::${a.username}`))
      .map((a) => ({
        indent_id: indentId,
        approver_username: a.username,
        approver_name: a.fullName || a.username,
        delegated_by: delegatedBy,
      }))
  );

  if (rows.length === 0) return;

  const { error } = await supabase.from("indent_delegations").insert(rows);
  if (error) throw error;
}

/**
 * Undo a single delegation (e.g. removing an approver assigned by mistake).
 */
export async function removeIndentDelegation(delegationId: string): Promise<void> {
  const { error } = await supabase.from("indent_delegations").delete().eq("id", delegationId);
  if (error) throw error;
}

/**
 * Approve or reject an indent (Stage 2).
 */
export async function approveIndent(
  indentId: string,
  data: {
    approverUsername: string;
    approvalStatus: string;
    approvedQty?: number;
    vendorType?: string;
    remarks?: string;
    rejectionReason?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("indent_approvals").insert({
    indent_id: indentId,
    approver_username: data.approverUsername,
    approval_status: data.approvalStatus,
    approved_qty: data.approvedQty || 0,
    vendor_type: data.vendorType || "",
    remarks: data.remarks || "",
    rejection_reason: data.rejectionReason || "",
  });

  if (error) throw error;

  // Calculate cumulative approved quantity for this indent
  const { data: pastApprovals } = await supabase
    .from("indent_approvals")
    .select("approved_qty")
    .eq("indent_id", indentId);

  const { data: indentRecord } = await supabase
    .from("indents")
    .select("quantity")
    .eq("id", indentId)
    .single();

  const totalIndentQty = parseFloat(String(indentRecord?.quantity || "0").replace(/,/g, "")) || 0;
  const totalApprovedSoFar = (pastApprovals || []).reduce(
    (sum: number, a: any) => sum + (parseFloat(String(a.approved_qty || "0").replace(/,/g, "")) || 0),
    0
  );

  const isFullyApproved = totalApprovedSoFar >= totalIndentQty && totalIndentQty > 0;
  const newStatus = data.approvalStatus === "rejected"
    ? "Rejected"
    : (isFullyApproved ? "Approved" : "Pending Approval");

  await supabase.from("indents").update({ status: newStatus }).eq("id", indentId);

  // If approved as Regular Vendor, auto-create entry in approved_vendors to skip Quotation/Stage 4 and route directly to Make PO
  if (data.approvalStatus === "approved" && data.vendorType?.toLowerCase() === "regular") {
    await supabase.from("approved_vendors").insert({
      indent_id: indentId,
      vendor_name: "Regular Vendor",
      vendor_type: "regular",
      final_agreed_rate: 0,
      approved_by: data.approverUsername,
      approval_remarks: data.remarks || "Regular Vendor Direct Flow",
    });
  }
}

/**
 * True when a Supabase/Postgres error is "column does not exist" — the
 * signature of a migration not having been run yet. Callers use this to
 * degrade gracefully instead of failing the whole save.
 */
export function isMissingColumnError(error: any): boolean {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");
}

/**
 * Submit a vendor quotation (Stage 3 - public form).
 *
 * Resilient to the GST/transport/remarks columns not existing yet (i.e. the
 * migration hasn't been run in Supabase): retries with just the original
 * core fields so the quotation itself still saves, and reports back whether
 * the extended fields made it in so the caller can warn the user.
 */
export async function submitQuotation(
  indentId: string,
  data: {
    vendorName: string;
    vendorCode?: string;
    quotedRate: number;
    paymentTerms: string;
    deliveryTerms: string;
    submittedBy?: string;
    gstPercent?: number;
    transportType?: string;
    remarks?: string;
  }
): Promise<{ id: string; extendedFieldsSaved: boolean }> {
  const baseRow = {
    indent_id: indentId,
    vendor_name: data.vendorName,
    vendor_code: data.vendorCode || "",
    quoted_rate: data.quotedRate,
    payment_terms: data.paymentTerms,
    delivery_terms: data.deliveryTerms,
    submitted_by: data.submittedBy || "",
  };
  const extendedRow = {
    ...baseRow,
    gst_percent: data.gstPercent ?? null,
    transport_type: data.transportType || "",
    remarks: data.remarks || "",
  };

  const { data: inserted, error } = await supabase.from("quotation_submissions").insert(extendedRow).select("id").single();

  if (!error) return { id: inserted.id, extendedFieldsSaved: true };
  if (!isMissingColumnError(error)) throw error;

  // Migration not run yet — fall back to the core fields so the quotation
  // itself still gets saved.
  const { data: fallbackInserted, error: fallbackError } = await supabase
    .from("quotation_submissions")
    .insert(baseRow)
    .select("id")
    .single();
  if (fallbackError) throw fallbackError;
  return { id: fallbackInserted.id, extendedFieldsSaved: false };
}

/**
 * Attach the auto-generated quotation PDF link to one or more quotation
 * submissions (called right after a successful public-form submit).
 */
export async function updateQuotationPdfUrl(quotationIds: string[], pdfUrl: string): Promise<void> {
  if (quotationIds.length === 0) return;
  const { error } = await supabase.from("quotation_submissions").update({ quotation_pdf_url: pdfUrl }).in("id", quotationIds);
  if (error) throw error;
}

/**
 * Select an approved vendor (Stage 4).
 */
export async function selectApprovedVendor(
  indentId: string,
  data: {
    selectedQuotationId: string;
    vendorName: string;
    vendorType?: string;
    finalAgreedRate?: number;
    approvedBy?: string;
    approvalRemarks?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("approved_vendors").insert({
    indent_id: indentId,
    selected_quotation_id: data.selectedQuotationId,
    vendor_name: data.vendorName,
    vendor_type: data.vendorType || "regular",
    final_agreed_rate: data.finalAgreedRate || 0,
    approved_by: data.approvedBy || "",
    approval_remarks: data.approvalRemarks || "",
  });

  if (error) throw error;
}

/**
 * Helper to fetch master dropdowns from separate dedicated tables.
 */
export async function fetchMasterCategoriesSeparate() {
  const [
    cbRes, whRes, apRes, qcRes, acRes, uomRes, chRes, rjRes,
    transRes, venRes, itemRes, tatRes
  ] = await Promise.all([
    supabase.from("master_created_by").select("*"),
    supabase.from("master_warehouses").select("*"),
    supabase.from("master_approvers").select("*"),
    supabase.from("master_qc_engineers").select("*"),
    supabase.from("master_accountants").select("*"),
    supabase.from("master_uoms").select("*"),
    supabase.from("master_checklists").select("*"),
    supabase.from("master_reject_reasons").select("*"),
    supabase.from("master_transporters").select("*"),
    supabase.from("master_vendors").select("*"),
    supabase.from("master_items").select("*"),
    supabase.from("master_tat_rules").select("*"),
  ]);

  return {
    createdBy: cbRes.data || [],
    warehouses: whRes.data || [],
    approvers: apRes.data || [],
    qcEngineers: qcRes.data || [],
    accountants: acRes.data || [],
    uoms: uomRes.data || [],
    checklists: chRes.data || [],
    rejectReasons: rjRes.data || [],
    transporters: transRes.data || [],
    vendors: venRes.data || [],
    items: itemRes.data || [],
    tatRules: tatRes.data || [],
  };
}
