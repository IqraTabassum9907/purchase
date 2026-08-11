"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw, Calendar, MessageSquare, User, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { cn, parseSheetDate, getFmsTimestamp, getPlannedDateForRecord, formatDateTimeFull, getErrorMessage, reportPendingCount } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";


export default function Stage9() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [accountantList, setAccountantList] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [tatRules, setTatRules] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    doneBy: "",
    submissionDate: new Date().toISOString().split("T")[0],
    remarks: "",
    checkedStatus: "",
  });

  // Open Modal with Bulk Validation
  const handleOpenModal = () => {
    if (selectedRows.size === 0) return;
    setBulkError(null);


    const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

    if (selectedRecords.length === 0) return;

    // Validate Invoice Numbers
    const firstInvoice = selectedRecords[0].data.invoiceNumber;
    const isConsistent = selectedRecords.every(r => r.data.invoiceNumber === firstInvoice);

    if (!isConsistent) {
      setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
    }

    // Prefill from the first record
    const rec = selectedRecords[0];
    const doneByExists = !!rec.data.doneBy && rec.data.doneBy !== "-";

    let status = "";
    if (rec.data.checkedStatus && rec.data.checkedStatus !== "-") {
      status = rec.data.checkedStatus;
    } else if (doneByExists) {
      status = "No";
    }

    setFormData({
      doneBy: doneByExists ? rec.data.doneBy : "",
      submissionDate: new Date().toISOString().split("T")[0],
      remarks: (rec.data.remarks && rec.data.remarks !== "-") ? rec.data.remarks : "",
      checkedStatus: status,
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (selectedRows.size === 0 || !formData.doneBy || !formData.checkedStatus) return;
    if (bulkError) return;

    setIsSubmitting(true);
    try {
      const timestamp = getFmsTimestamp();
      const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

      for (const rec of selectedRecords) {
        // Use the exact PO row this record was built from — a PO number can
        // be shared across several items/indents (one purchase_orders row
        // per item), so looking it up again by po_number alone would grab
        // an arbitrary sibling row and silently attach billing to the wrong
        // item, which is why some items never made it through to Payment.
        const poId = rec.data.poId;

        // Find or create tally_billing record
        if (!poId) {
          console.warn(`Skipping billing for ${rec.data.indentNumber}: no matching PO id found.`);
          continue;
        }

        const { data: existingBilling, error: lookupErr } = await supabase
          .from("tally_billing")
          .select("id")
          .eq("po_id", poId)
          .limit(1);

        if (lookupErr) throw new Error(`Lookup failed for ${rec.data.indentNumber}: ${getErrorMessage(lookupErr)}`);

        if (existingBilling && existingBilling.length > 0) {
          const { error: updateErr } = await supabase
            .from("tally_billing")
            .update({
              accountant_name: formData.doneBy,
              verification_status: formData.checkedStatus === "Yes" ? "Verified" : "Pending",
              vendor_invoice_number: rec.data.invoiceNumber || "",
              invoice_amount: parseFloat(rec.data.totalWithTax) || parseFloat(rec.data.basicValue) || 0,
            })
            .eq("id", existingBilling[0].id);
          if (updateErr) throw new Error(`Update failed for ${rec.data.indentNumber}: ${getErrorMessage(updateErr)}`);
        } else {
          // tally_billing.invoice_date is NOT NULL — rec.data.invoiceDate
          // falls back to the literal string "-" (or is empty) when the
          // receipt has no received_date, and either one fails the insert
          // silently (this used to go unchecked). Fall back to today so the
          // row always gets created; the date can be corrected later.
          const rawInvoiceDate = rec.data.invoiceDate;
          const validInvoiceDate = rawInvoiceDate && rawInvoiceDate !== "-"
            ? rawInvoiceDate
            : new Date().toISOString().split("T")[0];

          const { error: insertErr } = await supabase.from("tally_billing").insert({
            po_id: poId,
            vendor_invoice_number: rec.data.invoiceNumber || "",
            invoice_date: validInvoiceDate,
            invoice_amount: parseFloat(rec.data.totalWithTax) || 0,
            accountant_name: formData.doneBy,
            verification_status: formData.checkedStatus === "Yes" ? "Verified" : "Pending",
          });
          if (insertErr) throw new Error(`Insert failed for ${rec.data.indentNumber}: ${getErrorMessage(insertErr)}`);
        }
      }

      toast.success(formData.checkedStatus === "Yes" ? "Billing Completed (Bulk)!" : "Billing Saved (Bulk Pending)");
      setIsModalOpen(false);
      setSelectedRows(new Set());
      window.dispatchEvent(new Event("stageUpdated"));
      fetchData();

    } catch (e) {
      console.error("Billing submission failed:", getErrorMessage(e));
      toast.error(getErrorMessage(e) || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { fetchIndentWorkflow } = await import("@/lib/supabase/queries");
      const [indentRows, poRows, receiptRows, billingRows] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("purchase_orders").select("*"),
        supabase.from("material_receipts").select("*"),
        supabase.from("tally_billing").select("*"),
      ]);

      const pos = poRows.data || [];
      const receipts = receiptRows.data || [];
      const billings = billingRows.data || [];

      // Build PO map by indent_id
      const poMap = new Map<string, any[]>();
      pos.forEach((po) => {
        const list = poMap.get(po.indent_id) || [];
        list.push(po);
        poMap.set(po.indent_id, list);
      });

      // Build receipt map by po_id
      const receiptMap = new Map<string, any[]>();
      receipts.forEach((r) => {
        const list = receiptMap.get(r.po_id) || [];
        list.push(r);
        receiptMap.set(r.po_id, list);
      });

      // Build billing map by po_id
      const billingMap = new Map<string, any>();
      billings.forEach((b) => {
        if (!billingMap.has(b.po_id)) billingMap.set(b.po_id, b);
      });

      const rows: any[] = [];

      indentRows.forEach((indentRow) => {
        const indentPos = poMap.get(indentRow.id) || [];
        if (indentPos.length === 0) return;

        indentPos.forEach((po) => {
          const poReceipts = receiptMap.get(po.id) || [];
          const billing = billingMap.get(po.id);

          if (poReceipts.length === 0) return;

          poReceipts.forEach((receipt) => {
            const isChecked = billing?.verification_status === "Verified";
            const hasDoneBy = billing?.accountant_name && billing.accountant_name !== "-";
            const status = isChecked ? "completed" : "pending";

            rows.push({
              id: `${indentRow.data.indentNumber}-${receipt.id}`,
              rowIndex: rows.length + 7,
              stage: 8,
              status,
              createdAt: indentRow.data.createdAt,
              data: {
                indentNumber: indentRow.data.indentNumber || "",
                liftNumber: receipt.grn_number || "",
                vendorName: po.vendor_name || indentRow.data.selectedVendorName || indentRow.data.vendor1Name || "-",
                poNumber: po.po_number || "-",
                poId: po.id,
                nextFollowUpDate: "",
                remarksStage6: "",
                itemName: po.item_name || indentRow.data.itemName || "-",
                quantity: String(po.quantity || ""),
                indentQty: indentRow.data.quantity || "",
                transporterName: "",
                vehicleNo: "",
                contactNo: "",
                lrNo: "",
                dispatchDate: "",
                freightAmount: "",
                advanceAmount: "",
                paymentDate: "",
                paymentStatus: "",
                biltyCopy: "",
                invoiceType: "-",
                invoiceDate: billing?.invoice_date || receipt.received_date || "-",
                invoiceNumber: billing?.vendor_invoice_number || ("INV-" + (indentRow.data.indentNumber || "1004")),
                receivedQty: String(receipt.accepted_quantity !== undefined && receipt.accepted_quantity !== null ? receipt.accepted_quantity : receipt.received_quantity || ""),
                receivedItemImage: receipt.received_item_image_url || "",
                srnNumber: receipt.grn_number || ("SRN-" + receipt.id?.slice(0, 4)),
                qcRequirement: "-",
                billAttachment: billing?.tally_bill_copy_url || "",
                paymentAmountHydra: "",
                paymentAmountLabour: "",
                paymentAmountHamali: "",
                remarks7: "",
                plan8: "",
                actual8: billing ? billing.tally_entry_date : "",
                doneBy: billing?.accountant_name || "",
                doneDate: billing?.tally_entry_date || "",
                remarks: "",
                checkedStatus: isChecked ? "Yes" : (hasDoneBy ? "No" : ""),
                checkedByAcc: billing?.accountant_name || "",
                createdBy: indentRow.data.createdBy || "-",
                category: indentRow.data.category || "-",
                warehouse: indentRow.data.warehouseLocation || "-",
                basicValue: String(po.total_amount || "-"),
                totalWithTax: String(po.total_amount || "-"),
                poCopy: po.po_copy_url || "",
                deliveryDate: "-",
                vendorNameFallback: po.vendor_name || "-",
                rate: String(po.unit_rate || "-"),
                terms: po.payment_type || "-",
              }
            });
          });
        });
      });

      setSheetRecords(rows);

      const { data: dropRows } = await supabase
        .from("master_accountants")
        .select("name")
        .eq("is_active", true);

      const { data: tatData } = await supabase.from("master_tat_rules").select("*");
      if (tatData) setTatRules(tatData);

      if (dropRows) {
        setAccountantList(dropRows.map((r) => r.name).filter(Boolean));
      }

    } catch (e) {
      console.error("Fetch error Billing:", getErrorMessage(e));
      toast.error(`Failed to load Billing data: ${getErrorMessage(e)}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter records
  const pending = useMemo(() => sheetRecords
    .filter((r: any) => r.status === "pending")
    .filter((r) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm, warehouseFilter]);

  useEffect(() => { reportPendingCount("Billing", pending.length); }, [pending.length]);

  const completed = useMemo(() => sheetRecords
    .filter((r: any) => r.status === "completed")
    .filter((r: any) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm, warehouseFilter]);

  const pendingPagination = usePagination(pending, 15);
  const completedPagination = usePagination(completed, 15);

  // Pending columns
  const pendingColumns = [
    { key: "createdAtCol", label: "Timestamp" },
    { key: "indentNumber", label: "Indent No." },
    { key: "createdBy", label: "Created By" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "indentQty", label: "Qty" },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Supplier" },
    { key: "poNumber", label: "PO Number" },
    { key: "basicValue", label: "Basic Value" },
    { key: "totalWithTax", label: "Total w/Tax" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receiptLiftNumber", label: "Unit Tracking No." },
    { key: "receivedQty", label: "Rec. Qty" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "srnNumber", label: "SRN No." },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "plan8", label: "Planned" },
  ];

  // History columns
  const historyColumns = [
    ...pendingColumns,
    { key: "actual8", label: "Actual" },
    { key: "doneBy", label: "Billing Done By" },
    { key: "doneDate", label: "Billing Date" },
    { key: "tallyStatus", label: "Billing Status" },
    { key: "remarks", label: "Billing Remarks" },
    { key: "checkedStatus", label: "Checked" },
    { key: "checkedByAcc", label: "Checked By" },
  ];

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    pendingColumns.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    historyColumns.map((c) => c.key)
  );

  // Toggle row
  const toggleRow = (id: string) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedRows.size === pending.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pending.map((r: any) => r.id)));
    }
  };

  // Get vendor data helper
  const getVendorData = (record: any) => {
    const data = record?.data;
    if (!data) return { name: "-", rate: "-", terms: "-" };
    // Only use fallback if needed, but primary vendorName is now direct from Row 3
    return {
      name: data.vendorName || data.vendorNameFallback || "-",
      rate: data.rate || "-",
      terms: data.terms || "-",
    };
  };

  const formatDateDash = (dateStr: any) => {
    if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
    const d = parseSheetDate(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}-${month}-${year}`;
  };

  // Safe value getter with lifting data support
  const safeValue = (record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const vendor = getVendorData(record);

      // Handle file attachments with clickable links
      const fileFields = ["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto", "biltyCopy"];
      if (fileFields.includes(key)) {
        let url = data[key];
        if (key === "biltyCopy") url = data.liftingData?.[0]?.biltyCopy;

        if (!url || String(url).trim() === "" || url === "-") return "-";

        let displayUrl = String(url);
        if (displayUrl.includes("drive.google.com/uc")) {
          const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
          }
        }

        return (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      // Handle vendor data fields
      if (key === "vendorName") return vendor.name;
      if (key === "ratePerQty") return vendor.rate ? `₹${vendor.rate}` : "-";
      if (key === "paymentTerms") return vendor.terms;

      // Handle lifting data
      if (key === "receiptLiftNumber") return data.liftNumber || "-";

      // Handle payment amounts
      if (key === "paymentAmountHydra" || key === "paymentAmountLabour" || key === "paymentAmountHamali") {
        return data[key] ? `₹${data[key]}` : "-";
      }

      // Handle QC Status for display
      if (key === "qcStatus") {
        const val = data[key];
        if (!val || val === "-") return "-";
        // Capitalize first letter
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
      }

      // Timestamp and Planned Date are derived from the indent's own timestamp, not stored fields
      if (key === "createdAtCol") {
        return formatDateTimeFull(record.createdAt);
      }

      if (key === "plan8") {
        return getPlannedDateForRecord(data, "Billing", tatRules, record.createdAt);
      }

      const val = data[key];
      if (val === undefined || val === null || String(val).trim() === "") return "-";

      const lowKey = key.toLowerCase();
      if ((lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual"))) {
        return formatDateDash(val);
      }

      return String(val);
    } catch (err) {
      return "-";
    }
  };



  return (
    <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
      {/* Modal Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="p-0 overflow-hidden border-0 rounded-3xl shadow-2xl bg-white" style={{ maxWidth: "360px", width: "90%" }}>
          {/* Header Banner */}
          <div className="bg-linear-to-r from-indigo-950 via-slate-900 to-slate-950 text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <FileText className="w-5.5 h-5.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-wide text-white">
                  Billing
                </DialogTitle>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update billing information for {selectedRows.size} Selected item(s)
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 flex flex-col items-center">
            {bulkError && (
              <div className="bg-rose-50 text-rose-700 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 border border-rose-100 shadow-sm w-[280px]">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            <div className="space-y-4 w-[280px]">
              {/* Done By */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-650" />
                  Accountant (Done By) *
                </Label>
                <Select
                  value={formData.doneBy}
                  onValueChange={(v) => setFormData({ ...formData, doneBy: v })}
                >
                  <SelectTrigger className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs focus:ring-2 focus:ring-indigo-500">
                    <SelectValue placeholder="Select Accountant" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border rounded-xl shadow-lg text-xs">
                    {accountantList.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-650" />
                  Billing Entry Date
                </Label>
                <Input
                  type="date"
                  value={formData.submissionDate}
                  onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-650" />
                  Remarks
                </Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter billing remarks..."
                  className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Checked Status Button Toggles */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-650" />
                  Checked by Accountant? *
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checkedStatus: "Yes" })}
                    className={cn(
                      "h-10 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-1.5",
                      formData.checkedStatus === "Yes"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10"
                        : "bg-slate-50/50 border-slate-200 text-slate-650 hover:bg-slate-50"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Yes, Verified
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checkedStatus: "No" })}
                    className={cn(
                      "h-10 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-1.5",
                      formData.checkedStatus === "No"
                        ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/10"
                        : "bg-slate-50/50 border-slate-200 text-slate-655 hover:bg-slate-50"
                    )}
                  >
                    <AlertCircle className="w-4 h-4" />
                    No, Pending
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.doneBy ||
                !formData.checkedStatus ||
                isSubmitting ||
                !!bulkError
              }
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-semibold shadow-md transition-all duration-200",
                formData.checkedStatus === "Yes"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                  : "bg-blue-700 hover:bg-blue-800 text-white shadow-slate-950/10"
              )}
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Complete Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        {/* Sticky Header and Tabs Container */}
        <div className="md:sticky md:top-0 z-50 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
          {/* Header Card */}
          <div className="mb-4 md:mb-6 p-4 md:p-6 bg-white border rounded-lg shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-700 rounded-lg text-white shadow-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Stage : Billing
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                {/* Column Selection */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-600">
                    Columns:
                  </Label>
                  <Select value="" onValueChange={() => { }}>
                    <SelectTrigger className="w-40 bg-white border-slate-200 h-9 text-slate-900">
                      <SelectValue
                        placeholder={
                          activeTab === "pending"
                            ? `${selectedPendingColumns.length} selected`
                            : `${selectedHistoryColumns.length} selected`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="w-56 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                          <Checkbox
                            id="select-all-columns"
                            checked={
                              activeTab === "pending"
                                ? selectedPendingColumns.length ===
                                pendingColumns.length
                                : selectedHistoryColumns.length ===
                                historyColumns.length
                            }
                            onCheckedChange={(checked) => {
                              if (activeTab === "pending") {
                                setSelectedPendingColumns(
                                  checked ? pendingColumns.map((c) => c.key) : []
                                );
                              } else {
                                setSelectedHistoryColumns(
                                  checked ? historyColumns.map((c) => c.key) : []
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor="select-all-columns"
                            className="text-sm font-semibold text-slate-900 cursor-pointer"
                          >
                            Select All
                          </Label>
                        </div>
                        {(activeTab === "pending"
                          ? pendingColumns
                          : historyColumns
                        ).map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded transition-colors"
                          >
                            <Checkbox
                              id={`col-${col.key}`}
                              checked={
                                activeTab === "pending"
                                  ? selectedPendingColumns.includes(col.key)
                                  : selectedHistoryColumns.includes(col.key)
                              }
                              onCheckedChange={(checked) => {
                                if (activeTab === "pending") {
                                  setSelectedPendingColumns(
                                    checked
                                      ? [...selectedPendingColumns, col.key]
                                      : selectedPendingColumns.filter(
                                        (c) => c !== col.key
                                      )
                                  );
                                } else {
                                  setSelectedHistoryColumns(
                                    checked
                                      ? [...selectedHistoryColumns, col.key]
                                      : selectedHistoryColumns.filter(
                                        (c) => c !== col.key
                                      )
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`col-${col.key}`}
                              className="text-sm cursor-pointer flex-1 text-slate-700"
                            >
                              {col.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Warehouse Filter */}
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="w-40 bg-white border-slate-200 h-9 text-slate-900">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="All">All Warehouses</SelectItem>
                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-9 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="h-9 w-9 border-slate-200"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                  )}
                </Button>

                {/* Bulk Action */}
                {selectedRows.size >= 1 && activeTab === "pending" && (
                  <Button
                    onClick={handleOpenModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 shadow-sm whitespace-nowrap"
                  >
                    Billing ({selectedRows.size})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100/50 p-1 rounded-lg">
            <TabsTrigger
              value="pending"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
            >
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
            >
              History ({completed.length})
            </TabsTrigger>
          </TabsList>
        </div>


        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-0 outline-none">
          <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
            <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
              <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                <tr className="hover:bg-transparent border-none">
                  <th className="sticky left-0 z-40 bg-slate-200 w-12 border-b text-center px-4 py-3">
                    <Checkbox
                      checked={
                        selectedRows.size === pending.length &&
                        pending.length > 0
                      }
                      onCheckedChange={toggleAll}
                      className="translate-y-0.5"
                    />
                  </th>
                  {pendingColumns
                    .filter((c) => selectedPendingColumns.includes(c.key))
                    .map((col) => (
                      <th
                        key={col.key}
                        className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={pendingColumns.filter((c) => selectedPendingColumns.includes(c.key)).length + 1}
                      className="h-48 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <span className="text-slate-500 font-medium">Loading records...</span>
                      </div>
                    </td>
                  </tr>
                ) : pending.length === 0 ? (
                  <tr>
                    <td
                      colSpan={pendingColumns.filter((c) => selectedPendingColumns.includes(c.key)).length + 1}
                      className="h-32 text-center text-slate-400 font-medium"
                    >
                      No pending billing entries found.
                    </td>
                  </tr>
                ) : (
                  pendingPagination.pageData.map((record: any) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                        <Checkbox
                          checked={selectedRows.has(record.id)}
                          onCheckedChange={() => toggleRow(record.id)}
                          className="translate-y-0.5"
                        />
                      </td>
                      {pendingColumns
                        .filter((c) => selectedPendingColumns.includes(c.key))
                        .map((col) => {
                          if (col.key === "plan8") {
                            return (
                              <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700 font-mono text-xs">
                                {getPlannedDateForRecord(record.data, "Billing", tatRules, record.createdAt)}
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                              {record.data[col.key] || "-"}
                            </td>
                          );
                        })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={pendingPagination.page}
            pageSize={pendingPagination.pageSize}
            totalCount={pendingPagination.totalCount}
            onPageChange={pendingPagination.setPage}
            onPageSizeChange={pendingPagination.setPageSize}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
            <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
              <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                <tr className="hover:bg-transparent border-none">
                  {historyColumns
                    .filter((c) => selectedHistoryColumns.includes(c.key))
                    .map((col) => (
                      <th
                        key={col.key}
                        className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={historyColumns.filter((c) => selectedHistoryColumns.includes(c.key)).length}
                      className="h-48 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <span className="text-slate-500 font-medium">Loading history...</span>
                      </div>
                    </td>
                  </tr>
                ) : completed.length === 0 ? (
                  <tr>
                    <td
                      colSpan={historyColumns.filter((c) => selectedHistoryColumns.includes(c.key)).length}
                      className="h-32 text-center text-slate-400 font-medium"
                    >
                      No billing history found.
                    </td>
                  </tr>
                ) : (
                  completedPagination.pageData.map((record: any) => (
                    <tr
                      key={record.id}
                      className="hover:bg-indigo-50/50 transition-colors"
                    >
                      {historyColumns
                        .filter((c) => selectedHistoryColumns.includes(c.key))
                        .map((col) => (
                          <td
                            key={col.key}
                            className="border-b px-4 py-2 text-center text-slate-700"
                          >
                            {safeValue(record, col.key)}
                          </td>
                        ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={completedPagination.page}
            pageSize={completedPagination.pageSize}
            totalCount={completedPagination.totalCount}
            onPageChange={completedPagination.setPage}
            onPageSizeChange={completedPagination.setPageSize}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}