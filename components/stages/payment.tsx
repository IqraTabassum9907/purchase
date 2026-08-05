"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Loader2,
  Search,
  CreditCard,
  CheckCircle,
  FileText,
  RefreshCw,
  Upload,
  CalendarIcon,
  Truck,
  Banknote,
  Trash2,
} from "lucide-react";
import { formatDate, getPlannedDateForRecord, formatDateTimeFull } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

// Column definitions for Vendor Invoices
const VENDOR_PENDING_COLUMNS = [
  { key: "invoiceNo", label: "Invoice No." },
  { key: "totalPaid", label: "Paid" },
  { key: "pendingAmount", label: "Pending" },
  { key: "plan1", label: "Planned" },
  { key: "invoiceDate", label: "Inv. Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "vendor", label: "Vendor" },
  { key: "poNumber", label: "PO Number" },
  { key: "invoiceCopy", label: "Invoice Copy" },
  { key: "totalRcvd", label: "Total Rcvd." },
  { key: "qty", label: "Rec. Qty" },
  { key: "receivedItems", label: "Rec. Items" },
] as const;
const ALL_VENDOR_PENDING_KEYS = VENDOR_PENDING_COLUMNS.map(c => c.key);

const VENDOR_HISTORY_COLUMNS = [
  { key: "date", label: "Payment Date" },
  { key: "invoiceNo", label: "Invoice" },
  { key: "vendor", label: "Vendor" },
  { key: "planned", label: "Planned" },
  { key: "actual", label: "Actual" },
  { key: "amountPaid", label: "Amount Paid" },
  { key: "mode", label: "Payment Mode" },
  { key: "status", label: "Status" },
  { key: "proof", label: "Proof" },
] as const;

// Column definitions for Freight Payments
const FREIGHT_COLUMNS = [
  { key: "lrNo", label: "LR No." },
  { key: "biltyImage", label: "Bilty" },
  { key: "freightAmount", label: "Freight Amt" },
  { key: "transporter", label: "Transporter" },
  { key: "vehicleNo", label: "Vehicle No." },
  { key: "contact", label: "Contact" },
  { key: "totalPaid", label: "Paid" },
  { key: "pendingAmount", label: "Pending" },
  { key: "plan1", label: "Planned" },
  { key: "actual1", label: "Actual" },
] as const;
const ALL_FREIGHT_COLUMN_KEYS = FREIGHT_COLUMNS.map(c => c.key);

const FREIGHT_HISTORY_COLUMNS = [
  { key: "date", label: "Payment Date" },
  { key: "lrNo", label: "LR No." },
  { key: "transporter", label: "Transporter" },
  { key: "planned", label: "Planned" },
  { key: "actual", label: "Actual" },
  { key: "amountPaid", label: "Amount Paid" },
  { key: "mode", label: "Mode" },
  { key: "status", label: "Status" },
  { key: "proof", label: "Proof" },
] as const;

// Helper functions
const toDate = (val: any): string => formatDate(val);

const parseNum = (val: any): number =>
  parseFloat(String(val || 0).replace(/,/g, "")) || 0;

const formatAmount = (val: any): string => {
  const num = parseNum(val);
  return `₹ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const parseDateString = (dateStr: any): Date | null => {
  if (!dateStr || dateStr === "-" || dateStr === "—") return null;
  if (dateStr instanceof Date) return dateStr;
  const str = String(dateStr).trim();

  // Check for DD-Mon-YYYY format
  const parts = str.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monStr = parts[1].toLowerCase();
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monStr.substring(0, 3)];
    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
};

const isDueDateOverdueOrToday = (dueDateStr: any): boolean => {
  const dueDate = parseDateString(dueDateStr);
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() <= today.getTime();
};

const defaultBulkForm = () => ({
  paymentMode: "",
  paymentDate: new Date() as Date | undefined,
  proof: null as File | null,
});

const defaultFreightForm = () => ({
  amount: "",
  paymentDetails: "",
  paymentDate: new Date(),
  paymentStatus: "pending",
  totalPaid: "",
  pendingAmount: "",
  paymentProof: null as File | null,
});

const defaultTerms = [
  "Payment within 30 days of Invoice date.",
  "Subject to receipt of all relevant document copies.",
];

export default function UnifiedPaymentHub() {
  const params = useParams();
  const slug = params?.slug as string;

  // Active sub-workflow state
  const [workflow, setWorkflow] = useState<"advance" | "vendor" | "freight">("advance");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [tatRules, setTatRules] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Workflow 1: Advance Payments state ---
  const [advRecords, setAdvRecords] = useState<any[]>([]);
  const [advOpen, setAdvOpen] = useState(false);
  const [currentAdvRecord, setCurrentAdvRecord] = useState<any>(null);
  const [advForm, setAdvForm] = useState({
    paymentRef: "",
    paymentDate: new Date().toISOString().split("T")[0],
  });

  // --- Workflow 2: Vendor Payments state ---
  const [vendorRecords, setVendorRecords] = useState<any[]>([]);
  const [vendorHistory, setVendorHistory] = useState<any[]>([]);
  const [vendorSelectedColumns, setVendorSelectedColumns] = useState<string[]>(ALL_VENDOR_PENDING_KEYS);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<"vendor" | "invoices">("vendor");
  const [selectedBulkVendor, setSelectedBulkVendor] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [bulkInvoices, setBulkInvoices] = useState<Record<string, { selected: boolean; payAmount: string; originalPending: number }>>({});
  const [bulkFormData, setBulkFormData] = useState(defaultBulkForm);
  const [terms, setTerms] = useState<string[]>(defaultTerms);

  // --- Workflow 3: Freight Payments state ---
  const [freightRecords, setFreightRecords] = useState<any[]>([]);
  const [freightHistory, setFreightHistory] = useState<any[]>([]);
  const [freightSelectedColumns, setFreightSelectedColumns] = useState<string[]>(ALL_FREIGHT_COLUMN_KEYS);
  const [freightOpen, setFreightOpen] = useState(false);
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [freightForm, setFreightForm] = useState(defaultFreightForm);
  const [freightCalcData, setFreightCalcData] = useState({ freightAmount: 0, advanceAmount: 0 });

  // Sync sub-workflow with route slug
  useEffect(() => {
    if (slug === "vendor-payment") {
      setWorkflow("vendor");
      setActiveTab("pending");
    } else if (slug === "freight-payments") {
      setWorkflow("freight");
      setActiveTab("pending");
    } else if (slug === "payment") {
      setWorkflow("advance");
      setActiveTab("pending");
    }
  }, [slug]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        indentRows,
        { data: poData },
        { data: billingData },
        { data: tfData },
        { data: receiptData },
        { data: paymentData },
        { data: liftingData },
        { data: tatData },
      ] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("purchase_orders").select("*"),
        supabase.from("tally_billing").select("*"),
        supabase.from("transporter_followups").select("*"),
        supabase.from("material_receipts").select("*"),
        supabase.from("vendor_payments").select("*"),
        supabase.from("vendor_liftings").select("*"),
        supabase.from("master_tat_rules").select("*"),
      ]);
      if (tatData) setTatRules(tatData);

      const poById = new Map<string, any>();
      (poData || []).forEach((po: any) => poById.set(po.id, po));

      const poByIndent = new Map<string, any>();
      (poData || []).forEach((po: any) => {
        if (po.indent_id && !poByIndent.has(po.indent_id)) {
          poByIndent.set(po.indent_id, po);
        }
      });

      const liftingByPo = new Map<string, any>();
      (liftingData || []).forEach((l: any) => {
        if (l.po_id && !liftingByPo.has(l.po_id)) {
          liftingByPo.set(l.po_id, l);
        }
      });

      const paymentsByPo = new Map<string, any[]>();
      (paymentData || []).forEach((p: any) => {
        if (p.po_id) {
          const list = paymentsByPo.get(p.po_id) || [];
          list.push(p);
          paymentsByPo.set(p.po_id, list);
        }
      });

      const receiptsByPo = new Map<string, any[]>();
      (receiptData || []).forEach((r: any) => {
        if (r.po_id) {
          const list = receiptsByPo.get(r.po_id) || [];
          list.push(r);
          receiptsByPo.set(r.po_id, list);
        }
      });

      const advRows = indentRows
        .filter((row: any) => poByIndent.has(row.id))
        .map((row: any) => {
          const po = poByIndent.get(row.id);
          const payments = (paymentsByPo.get(po.id) || []).filter((p: any) => p.payment_type === "Advance");
          const advPay = payments[0];

          const selectedVendor = row.data.selectedVendor;
          let terms = "";
          if (selectedVendor === "vendor1") terms = row.data.vendor1Terms;
          else if (selectedVendor === "vendor2") terms = row.data.vendor2Terms;
          else if (selectedVendor === "vendor3") terms = row.data.vendor3Terms;

          const poPayType = po?.payment_type?.toLowerCase() || "";
          const isNoAdvance = poPayType.includes("no advance");
          const isAdvance = !isNoAdvance && (poPayType.includes("advance") || terms?.toLowerCase().includes("advance") || terms?.toLowerCase().includes("pi"));
          const hasPlanPayment = isAdvance || !!advPay;
          const hasActualPayment = !!advPay && advPay.status === "Paid";

          let status = "not_ready";
          if (hasPlanPayment) {
            status = hasActualPayment ? "completed" : "pending";
          }

          let advanceAmount = parseFloat(po?.advance_amount || po?.advance_amt || advPay?.amount || "0") || 0;
          if (!advanceAmount && po?.payment_type) {
            const match = String(po.payment_type).match(/₹?\s*([\d,]+(?:\.\d+)?)/);
            if (match && match[1]) {
              advanceAmount = parseFloat(match[1].replace(/,/g, "")) || 0;
            }
          }

          return {
            id: row.id,
            rowIndex: row.originalIndex,
            poId: po.id,
            status,
            createdAt: row.data.createdAt,
            data: {
              timestamp: row.data.createdAt,
              indentNumber: row.data.indentNumber,
              itemName: row.data.itemName,
              quantity: row.data.quantity,
              selectedVendorName: po.vendor_name || row.data.selectedVendorName || row.data.finalVendorName || row.data.vendor1Name || "Regular Vendor",
              poNumber: po.po_number || "-",
              totalValue: po.total_amount || "-",
              advanceAmount: advanceAmount,
              paymentTerms: terms || po.payment_type || "Advance",
              plannedPayment: advPay?.payment_date || null,
              actualPayment: advPay?.status === "Paid" ? advPay.payment_date : null,
              paymentMode: advPay?.payment_mode || "-",
              transactionRef: advPay?.reference_number || "-",
              paymentProof: advPay?.proof_url || null,
            }
          };
        });

      setAdvRecords(advRows);

      const indentMapById = new Map<string, any>(indentRows.map((r: any) => [r.id, r]));

      const vendorRows = (billingData || [])
        .map((bill: any) => {
          const po = bill.po_id ? poById.get(bill.po_id) : null;
          const allPayments = bill.po_id ? (paymentsByPo.get(bill.po_id) || []) : [];
          const advPayments = allPayments.filter((p: any) =>
            p.payment_type === "Advance" || String(p.payment_type || "").toLowerCase().includes("advance")
          );

          let advancePaid = advPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
          if (advancePaid === 0) {
            advancePaid = parseFloat(po?.advance_amount || po?.advance_amt || "0") || 0;
          }
          if (advancePaid === 0 && po?.payment_type) {
            const match = String(po.payment_type).match(/₹?\s*([\d,]+(?:\.\d+)?)/);
            if (match && match[1]) {
              advancePaid = parseFloat(match[1].replace(/,/g, "")) || 0;
            }
          }
          if (advancePaid === 0 && po?.indent_id) {
            const indent = indentMapById.get(po.indent_id);
            const indAdv = parseFloat(indent?.data?.advanceAmount || "0") || 0;
            if (indAdv > 0) advancePaid = indAdv;
          }

          const vpPayments = allPayments.filter((p: any) => {
            const isPaid = p.status === "Paid" || !!p.transaction_utr || !!p.payment_mode || (parseFloat(p.amount) > 0);
            const isFreight = p.payment_type === "Freight Payment" || p.paid_by === "Freight";
            const isAdv = p.payment_type === "Advance" || String(p.payment_type || "").toLowerCase().includes("advance");
            return isPaid && !isFreight && !isAdv;
          });
          const receipts = bill.po_id ? (receiptsByPo.get(bill.po_id) || []) : [];

          const invNo = bill.vendor_invoice_number || "";
          const totalVal = (bill.invoice_amount && bill.invoice_amount > 0) ? bill.invoice_amount : (po?.total_amount || 0);
          const totalPaid = vpPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
          const currentPending = Math.max(0, totalVal - advancePaid - totalPaid);
          const totalRcvd = receipts.reduce((sum: number, r: any) => sum + (r.received_quantity || 0), 0);
          const receivedItems = receipts.map((r: any) => r.grn_number).filter(Boolean).join(", ");
          const isVerified = bill.verification_status === "Verified" || !!bill.accountant_name;
          const plan1 = vpPayments.length > 0 ? vpPayments[0].created_at : bill.created_at || null;
          const actual1 = currentPending <= 1 && vpPayments.length > 0 ? vpPayments[vpPayments.length - 1].payment_date : null;
          const status = isVerified
            ? (currentPending > 0.01 ? "pending" : "history")
            : "not_ready";

          const indent = po?.indent_id ? indentMapById.get(po.indent_id) : null;
          const selVendor = indent?.data?.selectedVendor;
          let indentVendor = indent?.data?.selectedVendorName || indent?.data?.finalVendorName || "";
          if (!indentVendor && selVendor) {
            if (selVendor === "vendor1") indentVendor = indent?.data?.vendor1Name;
            else if (selVendor === "vendor2") indentVendor = indent?.data?.vendor2Name;
            else if (selVendor === "vendor3") indentVendor = indent?.data?.vendor3Name;
          }
          const vendorName = po?.vendor_name || bill?.vendor_name || indentVendor || "-";

          return {
            id: `${invNo}_${bill.id}`,
            rowIndex: bill.id,
            poId: bill.po_id,
            status,
            createdAt: indent?.data?.createdAt || null,
            data: {
              id: invNo,
              invoiceNo: invNo,
              invoiceCopy: bill.tally_bill_copy_url || "",
              invoiceDate: toDate(bill.invoice_date),
              dueDate: po?.delivery_date || "-",
              vendor: vendorName,
              poNumber: po?.po_number || "",
              totalRcvd,
              poCopy: po?.po_copy_url || "",
              qty: receipts.map((r: any) => r.received_quantity).join(", "),
              receivedItems,
              totalVal,
              advanceAmount: advancePaid,
              plan1: toDate(plan1),
              actual1: toDate(actual1),
              totalPaid,
              pendingAmount: currentPending,
              paymentStatus: currentPending <= 1 ? "paid" : (totalPaid > 0 ? "partial" : "pending"),
            }
          };
        });
      const pendingAdv = advRows.filter((r: any) => r.status === "pending");
      const pendingVen = vendorRows.filter((r: any) => r.status === "pending");
      setVendorRecords(pendingVen);

      if (pendingAdv.length === 0 && pendingVen.length > 0) {
        setWorkflow("vendor");
      }

      const allPayments = paymentData || [];
      const vHist = allPayments
        .filter((p: any) => 
          p.payment_type === "Vendor Payment" && 
          (!!p.transaction_utr || !!p.payment_mode || (p.status === "Paid" && !p.paid_by))
        )
        .map((p: any) => {
          const po = p.po_id ? poById.get(p.po_id) : null;
          const indent = po?.indent_id ? indentMapById.get(po.indent_id) : null;
          const payments = p.po_id ? (paymentsByPo.get(p.po_id) || []).filter((pp: any) => pp.payment_type === "Vendor Payment") : [];
          const plan1 = payments.length > 0 ? payments[0].created_at : null;
          const actual1 = payments.length > 0 ? payments[payments.length - 1].payment_date : null;

          return {
            id: `VHIST_${p.id}`,
            invoiceNo: po?.po_number || "",
            vendor: po?.vendor_name || indent?.data?.selectedVendorName || indent?.data?.vendor1Name || "-",
            amountPaid: p.amount,
            status: p.status,
            date: toDate(p.payment_date),
            planned: toDate(plan1),
            actual: toDate(actual1),
            mode: p.payment_mode,
            proof: p.proof_url,
            createdAt: indent?.data?.createdAt || null,
          };
        });

      const fHist = allPayments
        .filter((p: any) => p.payment_type === "Freight Payment")
        .map((p: any) => {
          const tf = tfData?.find((t: any) => t.po_id === p.po_id);
          const po = p.po_id ? poById.get(p.po_id) : null;
          const indent = po?.indent_id ? indentMapById.get(po.indent_id) : null;
          const payments = p.po_id ? (paymentsByPo.get(p.po_id) || []).filter((pp: any) => pp.payment_type === "Freight Payment") : [];
          const plan1 = payments.length > 0 ? payments[0].created_at : null;
          const actual1 = payments.length > 0 ? payments[payments.length - 1].payment_date : null;

          return {
            id: `FHIST_${p.id}`,
            lrNo: tf?.bilty_number || "",
            transporter: tf?.transporter_name || "",
            amountPaid: p.amount,
            status: p.status,
            date: toDate(p.payment_date),
            planned: toDate(plan1),
            actual: toDate(actual1),
            mode: p.payment_mode,
            proof: p.proof_url,
            createdAt: indent?.data?.createdAt || null,
          };
        });

      setVendorHistory(vHist.reverse());
      setFreightHistory(fHist.reverse());

      // transporter_followups gets a NEW row inserted on every status change
      // (In Transit -> Received etc.) rather than an update, so a PO can have
      // several rows here. Collapse to the most recently updated one per PO,
      // otherwise every status change would show up as a duplicate freight entry.
      const latestTfByPo = new Map<string, any>();
      (tfData || []).forEach((tf: any) => {
        if (!tf.po_id) return;
        const existing = latestTfByPo.get(tf.po_id);
        if (!existing || new Date(tf.updated_at || 0).getTime() > new Date(existing.updated_at || 0).getTime()) {
          latestTfByPo.set(tf.po_id, tf);
        }
      });

      const freightRows: any[] = Array.from(latestTfByPo.values())
        .map((tf: any) => {
          const po = tf.po_id ? poById.get(tf.po_id) : null;
          const indent = po?.indent_id ? indentMapById.get(po.indent_id) : null;
          const lifting = tf.po_id ? liftingByPo.get(tf.po_id) : null;
          const payments = tf.po_id ? (paymentsByPo.get(tf.po_id) || []).filter((p: any) => p.payment_type === "Freight Payment") : [];
          const receipts = tf.po_id ? (receiptsByPo.get(tf.po_id) || []) : [];
          const receipt = receipts.length > 0 ? receipts[0] : null;

          let freightAmt = parseFloat(tf.freight_amount || tf.freight_amt || tf.transporting_amount || lifting?.freight_amount || "0") || 0;
          if (!freightAmt && (tf.transport_rate || tf.transporting_rate || lifting?.transport_rate)) {
            const rate = parseFloat(tf.transport_rate || tf.transporting_rate || lifting?.transport_rate || "0") || 0;
            const rcvdQty = receipt ? (parseFloat(receipt.received_quantity) || 0) : (po ? parseFloat(po.quantity) || 0 : 0);
            freightAmt = rate * rcvdQty;
          }

          const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          const currentPending = freightAmt - totalPaid;
          const advancePayments = payments.filter((p: any) => p.paid_by === "Advance");
          const advanceAmount = advancePayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

          const isMaterialApproved = receipts.length > 0 || tf.status === "Received" || tf.status === "Approved" || tf.status === "Completed";
          const isEligibleFreight = freightAmt > 0 || isMaterialApproved || !!tf.transporter_name || !!tf.bilty_number;
          const isPendingPayment = isMaterialApproved && (totalPaid <= 0 || currentPending > 0.01);

          return {
            id: `${tf.bilty_number || ""}_${tf.id}`,
            rowIndex: tf.id,
            poId: tf.po_id,
            status: (isEligibleFreight || isMaterialApproved) && isPendingPayment ? "pending" : "not_ready",
            data: {
              lrNo: tf.bilty_number || "",
              biltyImage: tf.bilty_copy_url || "",
              freightAmount: freightAmt,
              transporter: tf.transporter_name || "",
              vehicleNo: tf.vehicle_number || lifting?.vehicle_number || "",
              contact: tf.driver_contact || lifting?.driver_contact || "",
              advanceAmount,
              paymentDate: formatDate(tf.dispatch_date),
              plan1: formatDate(tf.dispatch_date),
              actual1: formatDate(tf.expected_arrival_date),
              totalPaid,
              pendingAmount: currentPending,
              invoiceNo: po?.po_number || "",
              invoiceCopy: po?.po_copy_url || "",
              freightVal: freightAmt,
              advanceVal: advanceAmount,
              createdAt: indent?.data?.createdAt || null,
            }
          };
        });

      const processedPoIds = new Set((tfData || []).map((tf: any) => tf.po_id));
      (receiptData || []).forEach((rcpt: any) => {
        if (rcpt.po_id && !processedPoIds.has(rcpt.po_id)) {
          processedPoIds.add(rcpt.po_id);
          const po = poById.get(rcpt.po_id);
          const lifting = liftingByPo.get(rcpt.po_id);
          const tf = (tfData || []).find((t: any) => t.po_id === rcpt.po_id);
          const payments = (paymentsByPo.get(rcpt.po_id) || []).filter((p: any) => p.payment_type === "Freight Payment");
          const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          
          let freightAmt = parseFloat(rcpt.extra_freight || tf?.freight_amount || lifting?.freight_amount || po?.freight_amount || "0") || 0;
          if (!freightAmt && (tf?.transport_rate || lifting?.transport_rate)) {
            const rate = parseFloat(tf?.transport_rate || lifting?.transport_rate || "0") || 0;
            const rcvdQty = parseFloat(rcpt.received_quantity) || (po ? parseFloat(po.quantity) || 0 : 0);
            freightAmt = rate * rcvdQty;
          }

          const currentPending = freightAmt - totalPaid;
          const advancePayments = payments.filter((p: any) => p.paid_by === "Advance");
          const advanceAmount = advancePayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

          freightRows.push({
            id: `RCPT_${rcpt.grn_number || rcpt.id}`,
            rowIndex: rcpt.id,
            poId: rcpt.po_id,
            status: totalPaid <= 0 || currentPending > 0.01 ? "pending" : "completed",
            data: {
              lrNo: rcpt.grn_number || "",
              biltyImage: rcpt.bilty_invoice_image_url || "",
              freightAmount: freightAmt,
              transporter: tf?.transporter_name || po?.vendor_name || "-",
              vehicleNo: tf?.vehicle_number || lifting?.vehicle_number || "-",
              contact: tf?.driver_contact || lifting?.driver_contact || "-",
              advanceAmount,
              paymentDate: formatDate(rcpt.received_date),
              plan1: formatDate(rcpt.received_date),
              actual1: formatDate(rcpt.received_date),
              totalPaid,
              pendingAmount: currentPending,
              invoiceNo: po?.po_number || "",
              invoiceCopy: po?.po_copy_url || "",
              freightVal: freightAmt,
              advanceVal: advanceAmount,
            }
          });
        }
      });

      const pendingFreightList = freightRows.filter((r: any) => r.status === "pending" && (r.data.totalPaid <= 0 || r.data.pendingAmount > 0.01));
      const uniqueFreightMap = new Map<string, any>();
      pendingFreightList.forEach((r: any) => {
        const key = `${r.poId || ""}_${r.data.lrNo || r.id}`;
        if (!uniqueFreightMap.has(key)) {
          uniqueFreightMap.set(key, r);
        }
      });
      setFreightRecords(Array.from(uniqueFreightMap.values()));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load payment data");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived search term lower casing
  const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  // --- Filtering PO Advance rows ---
  const filteredAdvPending = useMemo(() => {
    return advRecords.filter((r: any) => r.status === "pending" && (
      r.data.indentNumber?.toLowerCase().includes(searchLower) ||
      r.data.itemName?.toLowerCase().includes(searchLower) ||
      r.data.selectedVendorName?.toLowerCase().includes(searchLower)
    ));
  }, [advRecords, searchLower]);

  const filteredAdvHistory = useMemo(() => {
    return advRecords.filter((r: any) => r.status === "completed" && (
      r.data.indentNumber?.toLowerCase().includes(searchLower) ||
      r.data.itemName?.toLowerCase().includes(searchLower) ||
      r.data.selectedVendorName?.toLowerCase().includes(searchLower)
    ));
  }, [advRecords, searchLower]);

  // --- Filtering Vendor Invoice rows ---
  const filteredVendorPending = useMemo(() => {
    let result = vendorRecords.filter((r: any) => (
      r.data.invoiceNo?.toLowerCase().includes(searchLower) ||
      r.data.vendor?.toLowerCase().includes(searchLower) ||
      r.data.receivedItems?.toLowerCase().includes(searchLower) ||
      r.data.poNumber?.toLowerCase().includes(searchLower) ||
      r.data.dueDate?.toLowerCase().includes(searchLower)
    ));
    if (showOverdueOnly) {
      result = result.filter((r: any) => isDueDateOverdueOrToday(r.data.dueDate));
    }
    return result;
  }, [vendorRecords, searchLower, showOverdueOnly]);

  const filteredVendorHistory = useMemo(() => {
    return vendorHistory.filter((r: any) => (
      r.invoiceNo?.toLowerCase().includes(searchLower) ||
      r.vendor?.toLowerCase().includes(searchLower)
    ));
  }, [vendorHistory, searchLower]);

  // --- Filtering Freight rows ---
  const filteredFreightPending = useMemo(() => {
    return freightRecords.filter((r: any) => (
      String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
      String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
      String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
      String(r.data.contact || "").toLowerCase().includes(searchLower)
    ));
  }, [freightRecords, searchLower]);

  const filteredFreightHistory = useMemo(() => {
    return freightHistory.filter((r: any) => (
      String(r.lrNo || "").toLowerCase().includes(searchLower) ||
      String(r.transporter || "").toLowerCase().includes(searchLower)
    ));
  }, [freightHistory, searchLower]);

  // --- Client-side pagination per table ---
  const advPendingPagination = usePagination(filteredAdvPending, 15);
  const advHistoryPagination = usePagination(filteredAdvHistory, 15);
  const vendorPendingPagination = usePagination(filteredVendorPending, 15);
  const vendorHistoryPagination = usePagination(filteredVendorHistory, 15);
  const freightPendingPagination = usePagination(filteredFreightPending, 15);
  const freightHistoryPagination = usePagination(filteredFreightHistory, 15);

  // --- Sub-workflow Actions & Forms Submission ---

  // 1. Submit PO Advance
  const handleOpenAdvForm = (record: any) => {
    setCurrentAdvRecord(record);
    setAdvForm({
      paymentRef: "",
      paymentDate: new Date().toISOString().split("T")[0],
    });
    setAdvOpen(true);
  };

  const handleAdvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdvRecord || !advForm.paymentRef) {
      toast.error("Please enter the Payment Reference Number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const advAmt = parseFloat(String(currentAdvRecord.data.advanceAmount || currentAdvRecord.data.totalValue || "0").replace(/[^0-9.]/g, "")) || 0;
      const { error } = await supabase.from("vendor_payments").insert({
        po_id: currentAdvRecord.poId,
        payment_type: "Advance",
        amount: advAmt,
        payment_date: advForm.paymentDate || new Date().toISOString().split("T")[0],
        transaction_utr: advForm.paymentRef,
        status: "Paid",
      });

      if (error) throw error;
      toast.success("Advance Payment recorded and transitioned successfully!");
      setAdvOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Bulk Vendor Payments
  const vendorsList = useMemo(() => {
    const list = new Set<string>();
    vendorRecords.forEach((r: any) => { if (r.data.vendor) list.add(r.data.vendor); });
    return Array.from(list);
  }, [vendorRecords]);

  const filteredVendorsList = useMemo(() => {
    const term = vendorSearch.toLowerCase();
    return vendorsList.filter((v: any) => v.toLowerCase().includes(term));
  }, [vendorsList, vendorSearch]);

  const handleBulkOpen = () => {
    setSelectedBulkVendor("");
    setVendorSearch("");
    setBulkInvoices({});
    setBulkFormData(defaultBulkForm());
    setTerms(defaultTerms);
    setBulkStep("vendor");
    setBulkOpen(true);
  };

  const handleSelectVendor = (vendorName: string) => {
    setSelectedBulkVendor(vendorName);
    const matched = vendorRecords.filter((r: any) => r.data.vendor === vendorName);
    const invoiceStates: Record<string, { selected: boolean; payAmount: string; originalPending: number }> = {};
    matched.forEach((r: any) => {
      invoiceStates[r.id] = {
        selected: false,
        payAmount: (r.data.pendingAmount || 0).toString(),
        originalPending: r.data.pendingAmount || 0,
      };
    });
    setBulkInvoices(invoiceStates);
    setBulkStep("invoices");
  };

  const bulkTotalToPay = useMemo(() => {
    return Object.entries(bulkInvoices)
      .filter(([_, info]) => info.selected)
      .reduce((sum, [_, info]) => sum + (parseFloat(info.payAmount) || 0), 0);
  }, [bulkInvoices]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedIds = Object.entries(bulkInvoices)
      .filter(([_, info]) => info.selected)
      .map(([id]) => id);

    if (selectedIds.length === 0) {
      toast.error("Please select at least one invoice.");
      return;
    }
    if (!bulkFormData.paymentMode) {
      toast.error("Please select payment mode.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Vendor payments...");
    try {
      const dateStr = bulkFormData.paymentDate ? format(bulkFormData.paymentDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

      let proofUrl = "";
      if (bulkFormData.proof) {
        const ext = bulkFormData.proof.name.split('.').pop() || 'bin';
        const path = `bulk-pay_${selectedBulkVendor}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, bulkFormData.proof);
        if (!upErr) {
          const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
          proofUrl = data?.publicUrl || "";
        } else {
          console.warn("Payment proof storage upload error (bucket missing):", upErr.message);
          proofUrl = typeof window !== "undefined" ? URL.createObjectURL(bulkFormData.proof) : "";
        }
      }

      for (const id of selectedIds) {
        const rec = vendorRecords.find(r => r.id === id);
        if (!rec) continue;
        const payInfo = bulkInvoices[id];
        const payAmount = parseFloat(payInfo.payAmount) || 0;
        const pending = rec.data.pendingAmount || 0;

        if (payAmount > pending + 0.01) {
          toast.error(`Payment amount (₹${payAmount}) for Invoice ${rec.data.invoiceNo} cannot exceed remaining pending amount (₹${pending.toFixed(2)}).`, { id: toastId });
          setIsSubmitting(false);
          return;
        }
      }

      let successCount = 0;
      for (const id of selectedIds) {
        const rec = vendorRecords.find(r => r.id === id);
        if (!rec) continue;
        const payInfo = bulkInvoices[id];
        const payAmount = parseFloat(payInfo.payAmount) || 0;
        if (payAmount <= 0) continue;

        const paymentStatus = (rec.data.totalVal - (rec.data.totalPaid + payAmount)) <= 1 ? "Paid" : "Partial";

        const { error } = await supabase.from("vendor_payments").insert({
          po_id: rec.poId,
          payment_type: "Vendor Payment",
          amount: payAmount,
          payment_mode: bulkFormData.paymentMode,
          payment_date: dateStr,
          proof_url: proofUrl,
          status: paymentStatus,
        });

        if (!error) successCount++;
      }

      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} invoice payment(s)!`, { id: toastId });
        setBulkOpen(false);
        setBulkInvoices({});
        setBulkStep("vendor");
        await fetchData();
      } else {
        toast.error("No invoice payments were processed.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process bulk payment", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Freight Payments
  const handleOpenFreightForm = (recordId: string) => {
    const rec = freightRecords.find(r => r.id === recordId);
    if (!rec) return;

    const freight = rec.data.freightVal;
    const advance = rec.data.advanceVal;
    const pendingAmt = rec.data.pendingAmount > 0 ? rec.data.pendingAmount : (freight - advance);

    setSelectedFreightId(recordId);
    setFreightForm({
      amount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
      paymentDetails: "",
      paymentDate: new Date(),
      paymentStatus: pendingAmt <= 1 ? "paid" : "pending",
      totalPaid: rec.data.totalPaid.toString(),
      pendingAmount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
      paymentProof: null,
    });
    setFreightCalcData({ freightAmount: freight, advanceAmount: advance });
    setFreightOpen(true);
  };

  const handleFreightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFreightId) return;

    const rec = freightRecords.find(r => r.id === selectedFreightId);
    if (!rec) return;

    const payAmount = parseNum(freightForm.amount);
    const currentPending = rec.data.pendingAmount || 0;

    if (payAmount > currentPending + 0.01) {
      toast.error(`Freight payment amount (₹${payAmount}) cannot exceed remaining pending balance (₹${currentPending.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Freight Payment...");

    try {
      const dateStr = format(freightForm.paymentDate, "yyyy-MM-dd");

      let proofUrl = "";
      if (freightForm.paymentProof) {
        const ext = freightForm.paymentProof.name.split('.').pop() || 'bin';
        const path = `frt_${rec.data.lrNo}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, freightForm.paymentProof);
        if (!upErr) {
          const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
          proofUrl = data?.publicUrl || "";
        } else {
          console.warn("Freight proof storage upload error (bucket missing):", upErr.message);
          proofUrl = typeof window !== "undefined" ? URL.createObjectURL(freightForm.paymentProof) : "";
        }
      }

      const payAmount = parseNum(freightForm.amount);
      const newTotalPaid = (rec.data.totalPaid || 0) + payAmount;
      const newPending = rec.data.freightVal - newTotalPaid;
      const paymentStatus = newPending <= 1 ? "Paid" : "Partial";

      const { error } = await supabase.from("vendor_payments").insert({
        po_id: rec.poId,
        payment_type: "Freight Payment",
        amount: payAmount,
        payment_mode: freightForm.paymentDetails || "",
        payment_date: dateStr,
        proof_url: proofUrl,
        status: paymentStatus,
      });

      if (error) throw error;
      toast.success("Freight Payment Recorded!", { id: toastId });
      setFreightOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Freight payment failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Visibility toggle helpers
  const handleVendorColumnToggle = (key: string, checked: boolean) => {
    setVendorSelectedColumns(prev => checked ? [...prev, key] : prev.filter(k => k !== key));
  };

  const handleFreightColumnToggle = (key: string, checked: boolean) => {
    setFreightSelectedColumns(prev => checked ? [...prev, key] : prev.filter(k => k !== key));
  };

  // safeValue renderer for files/URLs
  const renderSafeValue = (val: any) => {
    if (!val || val === "-" || val === "") return "-";
    if (typeof val === "string" && (val.startsWith("http") || val.includes("drive.google"))) {
      let displayUrl = val;
      if (displayUrl.includes("drive.google.com/uc")) {
        const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
        }
      }
      return (
        <a href={displayUrl} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:underline flex items-center gap-1 font-semibold">
          <FileText className="w-3.5 h-3.5" /> View
        </a>
      );
    }
    return String(val);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 p-6 space-y-6">
      {/* Upper Header Card */}
      <div className="p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Hub</h2>
              <p className="text-slate-500 text-sm">Process, record, and track all stages of purchase and freight payments.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {workflow === "vendor" && (
              <Button
                onClick={handleBulkOpen}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md flex items-center gap-2 h-10 px-5 rounded-xl"
              >
                <Banknote className="w-4 h-4" /> Process Payment
              </Button>
            )}

            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-slate-200 focus-visible:ring-slate-400"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={isLoading}
              className="h-10 w-10 bg-white hover:bg-slate-50 border-slate-200 shrink-0 rounded-xl"
            >
              <RefreshCw className={cn("w-4 h-4 text-slate-600", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Switcher and View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Unified switcher tabs */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100/80 p-1 w-fit rounded-lg">
            <Button
              variant={workflow === "advance" ? "secondary" : "ghost"}
              onClick={() => { setWorkflow("advance"); setActiveTab("pending"); }}
              className={cn("px-4 py-2 text-xs font-semibold rounded-md h-8 shadow-none flex items-center gap-2", workflow === "advance" && "bg-white text-slate-900 hover:bg-white")}
            >
              <span>Advance Payment</span>
              {filteredAdvPending.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white font-bold rounded-full">
                  {filteredAdvPending.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={workflow === "vendor" ? "secondary" : "ghost"}
              onClick={() => { setWorkflow("vendor"); setActiveTab("pending"); }}
              className={cn("px-4 py-2 text-xs font-semibold rounded-md h-8 shadow-none flex items-center gap-2", workflow === "vendor" && "bg-white text-slate-900 hover:bg-white")}
            >
              <span>Vendor payment</span>
              {filteredVendorPending.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white font-bold rounded-full">
                  {filteredVendorPending.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={workflow === "freight" ? "secondary" : "ghost"}
              onClick={() => { setWorkflow("freight"); setActiveTab("pending"); }}
              className={cn("px-4 py-2 text-xs font-semibold rounded-md h-8 shadow-none flex items-center gap-2", workflow === "freight" && "bg-white text-slate-900 hover:bg-white")}
            >
              <span>Freight Payments</span>
              {filteredFreightPending.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white font-bold rounded-full">
                  {filteredFreightPending.length}
                </Badge>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-lg h-9 inline-flex items-center gap-1">
              <button
                onClick={() => setActiveTab("pending")}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                  activeTab === "pending" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Pending (
                {workflow === "advance" && filteredAdvPending.length}
                {workflow === "vendor" && filteredVendorPending.length}
                {workflow === "freight" && filteredFreightPending.length}
                )
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                  activeTab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                History (
                {workflow === "advance" && filteredAdvHistory.length}
                {workflow === "vendor" && filteredVendorHistory.length}
                {workflow === "freight" && filteredFreightHistory.length}
                )
              </button>
            </div>

            {/* Overdue switch for vendor payments */}
            {workflow === "vendor" && activeTab === "pending" && (
              <Button
                variant={showOverdueOnly ? "destructive" : "outline"}
                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className="h-9 px-3 rounded-lg text-xs font-bold"
              >
                Overdue Only
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Workflow Area */}
        <div className="flex-1 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-slate-800 mb-4" />
              <p className="font-semibold text-slate-700 text-sm">Syncing spreadsheet records...</p>
            </div>
          )}

          {/* Workflow 1: Advance Payments Pending Table */}
          {workflow === "advance" && activeTab === "pending" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Action</TableHead>
                    <TableHead className="font-bold p-3">Timestamp</TableHead>
                    <TableHead className="font-bold p-3">Indent</TableHead>
                    <TableHead className="font-bold p-3">Item Details</TableHead>
                    <TableHead className="font-bold p-3">Supplier</TableHead>
                    <TableHead className="font-bold p-3">PO Number</TableHead>
                    <TableHead className="font-bold p-3 text-right">PO Value</TableHead>
                    <TableHead className="font-bold p-3 text-right">Advance Amt</TableHead>
                    <TableHead className="font-bold p-3">Payment Terms</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdvPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-slate-400 font-medium">
                        No pending advance payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    advPendingPagination.pageData.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAdvForm(r)}
                            className="h-7 text-xs font-semibold px-2.5 hover:bg-slate-100 hover:text-black"
                          >
                            Pay
                          </Button>
                        </TableCell>
                        <TableCell className="p-3 text-slate-500 font-mono text-xs">{formatDateTimeFull(r.createdAt)}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-700">IND-{r.data.indentNumber}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-900">{r.data.itemName} (Qty: {r.data.quantity})</TableCell>
                        <TableCell className="p-3 text-slate-600">{r.data.selectedVendorName}</TableCell>
                        <TableCell className="p-3 font-mono text-xs">{r.data.poNumber}</TableCell>
                        <TableCell className="p-3 text-right font-semibold text-slate-800">{formatAmount(r.data.totalValue)}</TableCell>
                        <TableCell className="p-3 text-right font-bold text-emerald-700">{formatAmount(r.data.advanceAmount)}</TableCell>
                        <TableCell className="p-3 text-slate-500">{r.data.paymentTerms}</TableCell>
                        <TableCell className="p-3 text-slate-600 font-mono text-xs">
                          {getPlannedDateForRecord(r.data, "Payment", tatRules, r.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationBar
                page={advPendingPagination.page}
                pageSize={advPendingPagination.pageSize}
                totalCount={advPendingPagination.totalCount}
                onPageChange={advPendingPagination.setPage}
                onPageSizeChange={advPendingPagination.setPageSize}
              />
            </div>
          )}

          {/* Workflow 1: Advance Payments History Table */}
          {workflow === "advance" && activeTab === "history" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Indent</TableHead>
                    <TableHead className="font-bold p-3">Item Details</TableHead>
                    <TableHead className="font-bold p-3">Vendor</TableHead>
                    <TableHead className="font-bold p-3">PO Number</TableHead>
                    <TableHead className="font-bold p-3 text-right">PO Value</TableHead>
                    <TableHead className="font-bold p-3 text-right">Advance Amt</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                    <TableHead className="font-bold p-3">Actual Payment Date</TableHead>
                    <TableHead className="font-bold p-3">Payment Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdvHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-400 font-medium">
                        No advance payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    advHistoryPagination.pageData.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-3 font-semibold text-slate-700">IND-{r.data.indentNumber}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-900">{r.data.itemName} (Qty: {r.data.quantity})</TableCell>
                        <TableCell className="p-3 text-slate-600">{r.data.selectedVendorName}</TableCell>
                        <TableCell className="p-3 font-mono text-xs">{r.data.poNumber}</TableCell>
                        <TableCell className="p-3 text-right font-semibold text-slate-800">{formatAmount(r.data.totalValue)}</TableCell>
                        <TableCell className="p-3 text-right font-bold text-emerald-700">{formatAmount(r.data.advanceAmount)}</TableCell>
                        <TableCell className="p-3 text-slate-500 font-mono text-xs">
                          {getPlannedDateForRecord(r.data, "Payment", tatRules, r.createdAt)}
                        </TableCell>
                        <TableCell className="p-3 text-slate-600 font-medium">{formatDate(r.data.actualPayment)}</TableCell>
                        <TableCell className="p-3 font-mono text-xs text-slate-700">{r.data.paymentRef}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationBar
                page={advHistoryPagination.page}
                pageSize={advHistoryPagination.pageSize}
                totalCount={advHistoryPagination.totalCount}
                onPageChange={advHistoryPagination.setPage}
                onPageSizeChange={advHistoryPagination.setPageSize}
              />
            </div>
          )}

          {/* Workflow 2: Vendor Payments Table */}
          {workflow === "vendor" && activeTab === "pending" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs min-w-[1400px]">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Timestamp</TableHead>
                    <TableHead className="font-bold p-3">Invoice No</TableHead>
                    <TableHead className="font-bold p-3">Supplier</TableHead>
                    <TableHead className="font-bold p-3 text-right">Total Bill Value</TableHead>
                    <TableHead className="font-bold p-3 text-right text-indigo-700">Advance Paid</TableHead>
                    <TableHead className="font-bold p-3 text-right">Pending Amount</TableHead>
                    <TableHead className="font-bold p-3">Due Date</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                    <TableHead className="font-bold p-3">PO Number</TableHead>
                    <TableHead className="font-bold p-3">Invoice Copy</TableHead>
                    <TableHead className="font-bold p-3 text-right">Rec. Qty</TableHead>
                    <TableHead className="font-bold p-3">Rec. Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendorPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-32 text-center text-slate-400 font-medium">
                        No pending vendor invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorPendingPagination.pageData.map((r) => {
                      const overdue = isDueDateOverdueOrToday(r.data.dueDate);
                      return (
                        <TableRow key={r.id} className={cn("hover:bg-slate-50/50", overdue && "bg-red-50/30 hover:bg-red-50/50")}>
                          <TableCell className="p-3 text-slate-500 font-mono text-xs">{formatDateTimeFull(r.createdAt)}</TableCell>
                          <TableCell className="p-3 font-semibold text-slate-800">{r.data.invoiceNo}</TableCell>
                          <TableCell className="p-3 font-semibold text-slate-900">{r.data.vendor}</TableCell>
                          <TableCell className="p-3 text-right font-semibold text-slate-800">{formatAmount(r.data.totalVal)}</TableCell>
                          <TableCell className="p-3 text-right text-indigo-600 font-bold">{formatAmount(r.data.advanceAmount)}</TableCell>
                          <TableCell className="p-3 text-right font-bold text-red-600">{formatAmount(r.data.pendingAmount)}</TableCell>
                          <TableCell className="p-3 font-semibold">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", overdue ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600")}>
                              {r.data.dueDate}
                            </span>
                          </TableCell>
                          <TableCell className="p-3 text-slate-500 font-mono text-xs">
                            {getPlannedDateForRecord(r.data, "Payment", tatRules, r.createdAt)}
                          </TableCell>
                          <TableCell className="p-3 font-mono text-xs">{r.data.poNumber}</TableCell>
                          <TableCell className="p-3">{renderSafeValue(r.data.invoiceCopy)}</TableCell>
                          <TableCell className="p-3 text-right font-medium">{r.data.totalRcvd}</TableCell>
                          <TableCell className="p-3 text-slate-500 max-w-[200px] truncate">{r.data.receivedItems}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <PaginationBar
                page={vendorPendingPagination.page}
                pageSize={vendorPendingPagination.pageSize}
                totalCount={vendorPendingPagination.totalCount}
                onPageChange={vendorPendingPagination.setPage}
                onPageSizeChange={vendorPendingPagination.setPageSize}
              />
            </div>
          )}

          {/* Workflow 2: Vendor Payments History Table */}
          {workflow === "vendor" && activeTab === "history" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Payment Date</TableHead>
                    <TableHead className="font-bold p-3">Invoice No</TableHead>
                    <TableHead className="font-bold p-3">Vendor</TableHead>
                    <TableHead className="font-bold p-3 text-right">Amount Paid</TableHead>
                    <TableHead className="font-bold p-3">Payment Mode</TableHead>
                    <TableHead className="font-bold p-3">Status</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                    <TableHead className="font-bold p-3">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendorHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-400 font-medium">
                        No vendor payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendorHistoryPagination.pageData.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-3 font-medium text-slate-700">{r.date}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-800">{r.invoiceNo}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-900">{r.vendor}</TableCell>
                        <TableCell className="p-3 text-right font-bold text-slate-800">{formatAmount(r.amountPaid)}</TableCell>
                        <TableCell className="p-3 text-slate-600">{r.mode}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3 font-mono text-xs">{getPlannedDateForRecord(r, "Payment", tatRules, r.createdAt)}</TableCell>
                        <TableCell className="p-3">{renderSafeValue(r.proof)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationBar
                page={vendorHistoryPagination.page}
                pageSize={vendorHistoryPagination.pageSize}
                totalCount={vendorHistoryPagination.totalCount}
                onPageChange={vendorHistoryPagination.setPage}
                onPageSizeChange={vendorHistoryPagination.setPageSize}
              />
            </div>
          )}

          {/* Workflow 3: Freight Payments Table */}
          {workflow === "freight" && activeTab === "pending" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full caption-bottom text-xs min-w-[1250px]">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Action</TableHead>
                    <TableHead className="font-bold p-3">Timestamp</TableHead>
                    <TableHead className="font-bold p-3">LR No.</TableHead>
                    <TableHead className="font-bold p-3">Transporter</TableHead>
                    <TableHead className="font-bold p-3 text-right">Freight Amt</TableHead>
                    <TableHead className="font-bold p-3 text-right">Pending Amount</TableHead>
                    <TableHead className="font-bold p-3">Vehicle No.</TableHead>
                    <TableHead className="font-bold p-3">Contact</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                    <TableHead className="font-bold p-3">Bilty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFreightPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-slate-400 font-medium">
                        No pending freight payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    freightPendingPagination.pageData.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenFreightForm(r.id)}
                            className="h-7 text-xs font-semibold px-2.5 hover:bg-slate-100 hover:text-black"
                          >
                            Pay
                          </Button>
                        </TableCell>
                        <TableCell className="p-3 text-slate-500 font-mono text-xs">{formatDateTimeFull(r.data.createdAt)}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-800">{r.data.lrNo}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-900">{r.data.transporter}</TableCell>
                        <TableCell className="p-3 text-right font-semibold text-slate-800">{formatAmount(r.data.freightAmount)}</TableCell>
                        <TableCell className="p-3 text-right font-bold text-red-600">{formatAmount(r.data.pendingAmount)}</TableCell>
                        <TableCell className="p-3 font-mono text-xs">{r.data.vehicleNo}</TableCell>
                        <TableCell className="p-3 text-slate-600">{r.data.contact}</TableCell>
                        <TableCell className="p-3 text-slate-500 font-mono text-xs">{getPlannedDateForRecord(r.data, "Payment", tatRules, r.data.createdAt)}</TableCell>
                        <TableCell className="p-3">{renderSafeValue(r.data.biltyImage)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
              <PaginationBar
                page={freightPendingPagination.page}
                pageSize={freightPendingPagination.pageSize}
                totalCount={freightPendingPagination.totalCount}
                onPageChange={freightPendingPagination.setPage}
                onPageSizeChange={freightPendingPagination.setPageSize}
              />
            </div>
          )}

          {/* Workflow 3: Freight Payments History Table */}
          {workflow === "freight" && activeTab === "history" && (
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full caption-bottom text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-bold p-3">Payment Date</TableHead>
                    <TableHead className="font-bold p-3">LR No.</TableHead>
                    <TableHead className="font-bold p-3">Transporter</TableHead>
                    <TableHead className="font-bold p-3 text-right">Amount Paid</TableHead>
                    <TableHead className="font-bold p-3">Payment Mode</TableHead>
                    <TableHead className="font-bold p-3">Status</TableHead>
                    <TableHead className="font-bold p-3">Planned Date</TableHead>
                    <TableHead className="font-bold p-3">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFreightHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-400 font-medium">
                        No freight payment history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    freightHistoryPagination.pageData.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-3 font-medium text-slate-700">{r.date}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-800">{r.lrNo}</TableCell>
                        <TableCell className="p-3 font-semibold text-slate-900">{r.transporter}</TableCell>
                        <TableCell className="p-3 text-right font-bold text-slate-800">{formatAmount(r.amountPaid)}</TableCell>
                        <TableCell className="p-3 text-slate-600">{r.mode}</TableCell>
                        <TableCell className="p-3">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3 font-mono text-xs">{getPlannedDateForRecord(r, "Payment", tatRules, r.createdAt)}</TableCell>
                        <TableCell className="p-3">{renderSafeValue(r.proof)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
              <PaginationBar
                page={freightHistoryPagination.page}
                pageSize={freightHistoryPagination.pageSize}
                totalCount={freightHistoryPagination.totalCount}
                onPageChange={freightHistoryPagination.setPage}
                onPageSizeChange={freightHistoryPagination.setPageSize}
              />
            </div>
          )}
        </div>
      </div>

      {/* --- Workflow 1 Dialog: Record PO Advance Payment --- */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent className="max-w-md bg-white border shadow-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-950">Record Advance Payment</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Confirm payment of advance value for Indent IND-{currentAdvRecord?.data?.indentNumber}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdvSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Payment Reference Number / Transaction ID</Label>
              <Input
                value={advForm.paymentRef}
                onChange={(e) => setAdvForm({ ...advForm, paymentRef: e.target.value })}
                placeholder="e.g. TXN-1002345"
                required
                className="border-slate-200 focus-visible:ring-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Payment Date</Label>
              <Input
                type="date"
                value={advForm.paymentDate}
                onChange={(e) => setAdvForm({ ...advForm, paymentDate: e.target.value })}
                required
                className="border-slate-200 focus-visible:ring-slate-400"
              />
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setAdvOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-700 text-white hover:bg-blue-800 font-semibold px-6 shadow-sm">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- Workflow 2 Dialog: Bulk Vendor Invoices Payment --- */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl bg-white border shadow-lg rounded-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-bold text-slate-950">Bulk Vendor Payment</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Select a vendor and invoices to process payments in batch.
            </DialogDescription>
          </DialogHeader>

          {bulkStep === "vendor" ? (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4 pt-2">
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search vendor name..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="pl-9 bg-white border-slate-200"
                />
              </div>
              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50 p-2 space-y-1">
                {filteredVendorsList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">No vendors found with pending invoices.</div>
                ) : (
                  filteredVendorsList.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleSelectVendor(v)}
                      className="w-full text-left px-4 py-3 bg-white hover:bg-slate-100/80 border rounded-lg shadow-sm text-sm font-semibold text-slate-900 transition-colors"
                    >
                      {v}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-hidden flex flex-col space-y-4 pt-2">
              <div className="font-bold text-sm text-slate-800">
                Vendor: <span className="text-emerald-700 font-extrabold">{selectedBulkVendor}</span>
              </div>
              <div className="flex-1 overflow-y-auto border rounded-xl overflow-hidden shadow-sm">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="w-12 text-center p-3">Select</TableHead>
                      <TableHead className="p-3">Invoice No</TableHead>
                      <TableHead className="p-3">PO Number</TableHead>
                      <TableHead className="p-3 text-right">Pending Amount</TableHead>
                      <TableHead className="p-3 text-right">Paying Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorRecords
                      .filter(r => r.data.vendor === selectedBulkVendor)
                      .map((r) => {
                        const info = bulkInvoices[r.id] || { selected: false, payAmount: "0" };
                        return (
                          <TableRow key={r.id} className="hover:bg-slate-50/30">
                            <TableCell className="text-center p-3">
                              <Checkbox
                                checked={info.selected}
                                onCheckedChange={(chk) => {
                                  setBulkInvoices(prev => ({
                                    ...prev,
                                    [r.id]: { ...prev[r.id], selected: !!chk },
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell className="p-3 font-semibold text-slate-700">{r.data.invoiceNo}</TableCell>
                            <TableCell className="p-3 font-mono text-xs">{r.data.poNumber}</TableCell>
                            <TableCell className="p-3 text-right font-bold text-slate-800">{formatAmount(r.data.pendingAmount)}</TableCell>
                            <TableCell className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                value={info.payAmount}
                                disabled={!info.selected}
                                onChange={(e) => {
                                  setBulkInvoices(prev => ({
                                    ...prev,
                                    [r.id]: { ...prev[r.id], payAmount: e.target.value },
                                  }));
                                }}
                                className="h-8 text-xs max-w-[120px] ml-auto border-slate-200 text-right font-bold"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Terms and payments info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 shrink-0">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Payment Mode</Label>
                    <Select
                      value={bulkFormData.paymentMode}
                      onValueChange={(val: string) => setBulkFormData(prev => ({ ...prev, paymentMode: val }))}
                    >
                      <SelectTrigger className="border-slate-200"><SelectValue placeholder="Select mode" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RTGS">RTGS / Bank Transfer</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="DD">Demand Draft</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Payment Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start h-10 text-left border-slate-200">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bulkFormData.paymentDate ? format(bulkFormData.paymentDate, "PPP") : <span>Pick date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border">
                        <Calendar
                          mode="single"
                          selected={bulkFormData.paymentDate}
                          onSelect={(d) => setBulkFormData(prev => ({ ...prev, paymentDate: d }))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Upload Receipt / Proof</Label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setBulkFormData(prev => ({ ...prev, proof: file }));
                      }}
                      className="hidden"
                      id="bulk-payment-proof-file"
                    />
                    <label htmlFor="bulk-payment-proof-file" className="flex h-10 items-center justify-center border border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors">
                      <Upload className="mr-2 h-4 w-4 text-slate-500" />
                      {bulkFormData.proof ? bulkFormData.proof.name : "Choose receipt copy..."}
                    </label>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center h-10 border border-slate-150">
                    <span className="text-xs font-bold text-slate-500">TOTAL TO PAY:</span>
                    <span className="text-sm font-extrabold text-slate-900">{formatAmount(bulkTotalToPay)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t shrink-0">
                <Button type="button" variant="outline" onClick={() => setBulkStep("vendor")} disabled={isSubmitting}>
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting || bulkTotalToPay <= 0 || !bulkFormData.paymentMode} className="bg-blue-700 text-white hover:bg-blue-800 font-semibold px-6 shadow-sm">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Submit Payment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Workflow 3 Dialog: Record Freight Payment --- */}
      <Dialog open={freightOpen} onOpenChange={setFreightOpen}>
        <DialogContent className="max-w-2xl bg-white border shadow-lg rounded-2xl flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-950">Transporter Freight Payment</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Confirm payment for Freight LR No. <span className="font-bold text-slate-800">{freightRecords.find(r => r.id === selectedFreightId)?.data.lrNo}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFreightSubmit} className="space-y-4 pt-2">
            {/* Calculation info box */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 border rounded-xl text-center text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Freight Amount</span>
                <span className="font-bold text-slate-800">{formatAmount(freightCalcData.freightAmount)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Advance Paid</span>
                <span className="font-bold text-emerald-600">{formatAmount(freightCalcData.advanceAmount)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Calculated Due</span>
                <span className="font-bold text-red-600">{formatAmount(freightCalcData.freightAmount - freightCalcData.advanceAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Amount Paying</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={freightForm.amount}
                  onChange={(e) => setFreightForm({ ...freightForm, amount: e.target.value })}
                  placeholder="0.00"
                  required
                  className="border-slate-200 focus-visible:ring-slate-400 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Payment Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-10 text-left border-slate-200">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {freightForm.paymentDate ? format(freightForm.paymentDate, "PPP") : <span>Pick date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border">
                    <Calendar
                      mode="single"
                      selected={freightForm.paymentDate}
                      onSelect={(d) => d && setFreightForm({ ...freightForm, paymentDate: d })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Payment Reference / Details</Label>
              <Input
                value={freightForm.paymentDetails}
                onChange={(e) => setFreightForm({ ...freightForm, paymentDetails: e.target.value })}
                placeholder="RTGS / Cheque Reference Details"
                className="border-slate-200 focus-visible:ring-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Upload Bilty / Receipt Copy</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFreightForm(prev => ({ ...prev, paymentProof: file }));
                }}
                className="hidden"
                id="freight-payment-proof-file"
              />
              <label htmlFor="freight-payment-proof-file" className="flex h-10 items-center justify-center border border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors">
                <Upload className="mr-2 h-4 w-4 text-slate-500" />
                {freightForm.paymentProof ? freightForm.paymentProof.name : "Choose receipt copy..."}
              </label>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setFreightOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-700 text-white hover:bg-blue-800 font-semibold px-6 shadow-sm">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Submit Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
