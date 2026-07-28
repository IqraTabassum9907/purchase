"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, X, Shield, ShieldCheck, Loader2, ClipboardList, History, Search, Plus, Trash2, Eye, Save, Edit2, FileEdit, Mail, Send, Check, CheckCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const formatGSTDisplay = (gst: any) => {
  if (!gst || gst === "-" || gst === "") return "-";
  const s = String(gst);
  if (s.includes("%")) return s;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    return `${Math.round(n * 100)}%`;
  }
  return s;
};

const formatInputDate = (date: any) => {
  const parsed = parseSheetDate(date);
  if (!parsed || isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
};

const normalizePaymentTerms = (term?: string): string => {
  if (!term) return "advance";
  const lower = String(term).toLowerCase().trim();
  if (lower.includes("advance")) return "advance";
  if (lower.includes("pi") || lower.includes("proforma")) return "PI";
  if (lower.includes("15")) return "15";
  if (lower.includes("30")) return "30";
  if (lower.includes("60")) return "60";
  if (lower.includes("90")) return "90";
  return "advance";
};

const extractAdvanceAmount = (term?: string): string => {
  if (!term) return "";
  const match = String(term).match(/₹?\s*(\d+(\.\d+)?)/);
  return match ? match[1] : "";
};

const VENDOR_EMAILS: Record<string, string> = {
  "INFOSYS TECH": "procurement@infosys.com",
  "KOTAK MAHINDRA": "corporate@kotak.com",
  "Vendor A": "sales@vendorA.com",
  "Vendor B": "orders@vendorB.com",
  "Vendor C": "contact@vendorC.com",
  "Vendor IT": "support@vendorit.com",
  "Express Logistics": "dispatch@expresslogistics.com",
  "DHL Express": "billing@dhl.com"
};

const VENDOR_ADDRESSES: Record<string, string> = {
  "INFOSYS TECH": "Electronics City, Hosur Road, Bangalore",
  "KOTAK MAHINDRA": "Kotak Infiniti, Goregaon East, Mumbai",
  "Vendor A": "A-Block, Industrial Area, Sector 62, Noida",
  "Vendor B": "B-Wing, Commercial Plaza, Andheri East, Mumbai",
  "Vendor C": "C-Square Building, Salt Lake, Kolkata",
  "Vendor IT": "IT Park, Phase 1, Hinjewadi, Pune",
  "Express Logistics": "Logistics Hub, NH-8, Gurugram",
  "DHL Express": "Express Tower, Nariman Point, Mumbai"
};

export default function Stage5() {
  const [open, setOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [bulkFormData, setBulkFormData] = useState<Record<string, any>>({});
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // States for PO Preview and Email Simulator
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailSimOpen, setEmailSimOpen] = useState(false);
  const [emailSimSteps, setEmailSimSteps] = useState<string[]>([]);
  const [emailSimActiveIndex, setEmailSimActiveIndex] = useState(0);

  // Auto-advance simulated email delivery steps
  React.useEffect(() => {
    if (!emailSimOpen) return;
    const interval = setInterval(() => {
      setEmailSimActiveIndex((prev) => {
        if (prev >= emailSimSteps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [emailSimOpen, emailSimSteps]);

  // Shared fields for bulk PO
  const [poMode, setPoMode] = useState<"create" | "revise">("create");
  const [commonPONumber, setCommonPONumber] = useState("");
  const [commonPOCopy, setCommonPOCopy] = useState<File | string | null>(null);

  // Shared Packaging/Forwarding fields
  const [commonPkgAmount, setCommonPkgAmount] = useState("");
  const [commonPkgGST, setCommonPkgGST] = useState("");

  // Derived: total packaging (base + gst)
  const getPkgTotals = (pkgAmount: string, pkgGST: string, count: number) => {
    const base = parseFloat(pkgAmount) || 0;
    let gstRate = 0;
    if (pkgGST === "5%") gstRate = 0.05;
    if (pkgGST === "12%") gstRate = 0.12;
    if (pkgGST === "18%") gstRate = 0.18;
    if (pkgGST === "28%") gstRate = 0.28;
    const totalPkg = base + base * gstRate;
    const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
    const perItemPkgBase = count > 0 ? base / count : 0;
    return { totalPkg, perItemPkgTotal, perItemPkgBase };
  };


  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const workflow = await fetchIndentWorkflow();

      const { data: poData } = await supabase
        .from("purchase_orders")
        .select("*");

      const posByIndentId = new Map<string, any[]>();
      if (poData) {
        poData.forEach((po: any) => {
          if (po.indent_id) {
            const list = posByIndentId.get(po.indent_id) || [];
            list.push(po);
            posByIndentId.set(po.indent_id, list);
          }
        });
      }

      const rows = workflow
        .filter((row) => row.data.indentNumber && row.data.indentNumber.trim() !== "")
        .map((row) => {
          const indentPos = posByIndentId.get(row.id) || [];
          const latestPo = indentPos.length > 0 ? indentPos[indentPos.length - 1] : null;
          const hasPo = indentPos.length > 0;
          const isRegularVendor = row.data.vendorType?.toLowerCase() === "regular";
          const hasPlan4 = !!row.data.plan4 && row.data.plan4.trim() !== "" && row.data.plan4.trim() !== "-";
          const isApprovedStage2 = parseFloat(String((row.data as any).totalApprovedQty || row.data.approvedQty || "0")) > 0 || (!!row.data.actual1 && row.data.actual1.trim() !== "" && row.data.actual1.trim() !== "-");

          let status = "not_ready";
          if (hasPo) {
            status = "completed";
          } else if (hasPlan4 || (isRegularVendor && isApprovedStage2)) {
            status = "pending";
          }

          const displayQty = row.data.approvedQty || row.data.quantity;

          return {
            id: row.id,
            rowIndex: row.originalIndex,
            stage: 4,
            status: status,
            createdAt: row.data.createdAt,
            history: hasPo ? [{ stage: 4, date: latestPo?.created_at || row.data.plan4 || row.data.createdAt, data: {} }] : [],
            data: {
              timestamp: row.data.createdAt,
              indentNumber: row.data.indentNumber,
              itemName: row.data.itemName,
              quantity: displayQty,
              planned1: row.data.plan1 || "",
              actual1: row.data.actual1 || "",
              approvedBy: row.data.finalApprovedBy,
              itemCode: row.data.itemCode,

              vendor1Name: row.data.vendor1Name,
              vendor1Rate: row.data.vendor1Rate,
              vendor1Terms: row.data.vendor1Terms,
              vendor1DeliveryDate: row.data.vendor1Delivery,
              vendor1WarrantyType: "",
              vendor1WarrantyFrom: "",
              vendor1WarrantyTo: "",
              vendor1Attachment: "",

              vendor2Name: row.data.vendor2Name,
              vendor2Rate: row.data.vendor2Rate,
              vendor2Terms: row.data.vendor2Terms,
              vendor2DeliveryDate: row.data.vendor2Delivery,
              vendor2WarrantyType: "",
              vendor2WarrantyFrom: "",
              vendor2WarrantyTo: "",
              vendor2Attachment: "",

              vendor3Name: row.data.vendor3Name,
              vendor3Rate: row.data.vendor3Rate,
              vendor3Terms: row.data.vendor3Terms,
              vendor3DeliveryDate: row.data.vendor3Delivery,
              vendor3WarrantyType: "",
              vendor3WarrantyFrom: "",
              vendor3WarrantyTo: "",
              vendor3Attachment: "",

              planned3: row.data.plan3,
              actual3: row.data.actual3,
              delay3: "",
              selectedVendor: row.data.selectedVendor,
              finalApprovedBy: row.data.finalApprovedBy,
              negotiationRemarks: row.data.negotiationRemarks,

              planned4: row.data.plan4,
              actual4: latestPo ? (latestPo.created_at || "") : "",
              delay4: "",
              poNumber: latestPo?.po_number || "",
              basicValue: latestPo ? String(latestPo.unit_rate || "") : "",
              totalWithTax: latestPo ? String(latestPo.total_amount || "") : "",
              hsn: "",
              poCopy: latestPo?.po_copy_url || "",
              gst: latestPo?.payment_type || "",
              pkgAmount: "",
              pkgGst: "",
            }
          };
        });
      setSheetRecords(rows);
    } catch (e) {
      console.error("Fetch error Stage 5:", e);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      const selectedId = String(r.data.selectedVendor || "1");
      const idx = parseInt(selectedId.toLowerCase().replace("vendor", "").trim(), 10) || 1;
      const vName = r.data[`vendor${idx}Name`] || "";

      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        vName.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const completed = useMemo(() => sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      const selectedId = String(r.data.selectedVendor || "1");
      const idx = parseInt(selectedId.toLowerCase().replace("vendor", "").trim(), 10) || 1;
      const vName = r.data[`vendor${idx}Name`] || "";

      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        vName.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const poTotalMap = useMemo(() => {
    const totals = new Map<string, number>();
    completed.forEach(record => {
      const po = record.data.poNumber;
      if (po && po !== "-") {
        const amount = parseFloat(String(record.data.totalWithTax || "0").replace(/[^0-9.]/g, "")) || 0;
        totals.set(po, (totals.get(po) || 0) + amount);
      }
    });
    return totals;
  }, [completed]);

  const baseColumns = [
    { key: "indentNumber", label: "Indent-No", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
    { key: "planned4", label: "Planned", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const paymentTermsList = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "advance", label: "Advance" },
    { value: "PI", label: "PI (Proforma Invoice)" },
  ];

  const defaultTerms = [
    "Payment within 30 days of invoice date.",
    "Delivery within 2 weeks of purchase order.",
    "Goods once sold will not be taken back.",
    "All disputes subject to Mumbai jurisdiction.",
  ];

  const defaultSuppliers = [
    "INFOSYS TECH",
    "KOTAK MAHINDRA",
    "Vendor A",
    "Vendor B",
    "Vendor C",
    "Vendor IT",
    "Express Logistics",
    "DHL Express"
  ];

  const defaultPOForm = {
    firmName: "Botivate",
    supplierName: "",
    poDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    paymentTerms: "advance",
    advancePayment: "yes",
    advanceAmount: "",
    supplierEmail: "",
    supplierAddress: "",
    gstin: "",
    quotationNumber: "",
    quotationDate: "",
    enquiryNumber: "",
    enquiryDate: "",
    remarks: "",
    companyGstin: "27ABCDE1234A1Z5",
    companyPan: "ABCDE1234A",
    billingName: "M/S Botivate Pvt. Ltd.",
    billingAddress: "401-402, Gateway Park, HQ, Mumbai",
    destinationName: "M/S Botivate Pvt. Ltd.",
    destinationAddress: "Division 1, Mumbai",
  };

  const [poForm, setPoForm] = useState(defaultPOForm);
  const [terms, setTerms] = useState(defaultTerms);

  const selectedPORecords = useMemo(() => {
    return selectedRecordIds
      .map((id) => sheetRecords.find((r) => r.id === id))
      .filter(Boolean);
  }, [selectedRecordIds, sheetRecords]);

  const completedPONumbers = useMemo(() => {
    const set = new Set<string>();
    completed.forEach((r) => {
      if (r.data.poNumber && r.data.poNumber !== "-") {
        set.add(r.data.poNumber);
      }
    });
    return Array.from(set).sort();
  }, [completed]);

  const handleRevisePONumberChange = (poNum: string) => {
    setCommonPONumber(poNum);
    if (!poNum.trim()) return;

    const matching = completed.filter((r) => r.data.poNumber === poNum);
    if (matching.length === 0) return;

    const matchedIds = matching.map((r) => r.id);
    setSelectedRecordIds(matchedIds);

    const firstRec = matching[0];
    const v = getVendorData(firstRec);

    setPoForm({
      firmName: "Botivate",
      supplierName: v.name !== "-" ? v.name : "",
      supplierEmail: v.name ? (VENDOR_EMAILS[v.name] || "") : "",
      supplierAddress: v.name ? (VENDOR_ADDRESSES[v.name] || "") : "",
      poDate: formatInputDate(firstRec.data.actual4),
      deliveryDate: v.delivery ? formatInputDate(v.delivery) : "",
      paymentTerms: normalizePaymentTerms(v.terms),
      advancePayment: "yes",
      advanceAmount: extractAdvanceAmount(v.terms),
      gstin: "",
      quotationNumber: "",
      quotationDate: new Date().toISOString().split("T")[0],
      enquiryNumber: "",
      enquiryDate: "",
      remarks: "",
      companyGstin: "27ABCDE1234A1Z5",
      companyPan: "ABCDE1234A",
      billingName: "M/S Botivate Pvt. Ltd.",
      billingAddress: "401-402, Gateway Park, HQ, Mumbai",
      destinationName: "M/S Botivate Pvt. Ltd.",
      destinationAddress: "Division 1, Mumbai",
    });

    const matchedFormData: Record<string, any> = {};
    matching.forEach((r) => {
      matchedFormData[r.id] = {
        basicValue: r.data.basicValue || "0",
        totalWithTax: r.data.totalWithTax || "0",
        hsn: r.data.hsn || "",
        gst: r.data.gst || "",
      };
    });
    setBulkFormData(matchedFormData);

    const individualPkg = parseFloat(firstRec.data.pkgAmount) || 0;
    const totalPkgAmount = (individualPkg * matching.length).toFixed(2);
    setCommonPkgAmount(individualPkg > 0 ? totalPkgAmount : "");
    setCommonPkgGST(firstRec.data.pkgGst || "");

    setCommonPOCopy(firstRec.data.poCopy || null);
  };

  const gstRateFor = (gst: string) => {
    if (gst === "5%") return 0.05;
    if (gst === "12%") return 0.12;
    if (gst === "18%") return 0.18;
    if (gst === "28%") return 0.28;
    return 0;
  };

  const poSummary = useMemo(() => {
    const subtotal = selectedRecordIds.reduce((sum, recordId) => {
      const data = bulkFormData[recordId] || {};
      return sum + (parseFloat(data.basicValue) || 0);
    }, 0);

    const itemGst = selectedRecordIds.reduce((sum, recordId) => {
      const data = bulkFormData[recordId] || {};
      const basic = parseFloat(data.basicValue) || 0;
      return sum + basic * gstRateFor(data.gst || "");
    }, 0);

    const packaging = getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg;
    return {
      subtotal,
      gst: itemGst + Math.max(0, packaging - (parseFloat(commonPkgAmount) || 0)),
      grandTotal: subtotal + itemGst + packaging,
    };
  }, [bulkFormData, commonPkgAmount, commonPkgGST, selectedRecordIds]);

  const resetPOForm = () => {
    setPoForm(defaultPOForm);
    setTerms(defaultTerms);
    setCommonPONumber("");
    setCommonPOCopy(null);
    setCommonPkgAmount("");
    setCommonPkgGST("");
    const resetData: Record<string, any> = {};
    selectedRecordIds.forEach((id) => {
      const record = sheetRecords.find((r) => r.id === id);
      const vendorData = record ? getVendorData(record) : { rate: 0 };
      const rate = vendorData.rate || "";
      const rateNum = parseFloat(rate) || 0;
      const quantity = parseFloat(record?.data?.quantity) || 0;
      const basicValue = (rateNum * quantity).toFixed(2);
      resetData[id] = {
        rate,
        basicValue,
        totalWithTax: basicValue,
        hsn: "",
        gst: "",
      };
    });
    setBulkFormData(resetData);
  };

  const handleOpenBulkForm = () => {
    if (selectedRecordIds.length === 0) return;

    const initialData: Record<string, any> = {};
    selectedRecordIds.forEach((id) => {
      const record = sheetRecords.find((r) => r.id === id);
      const vendorData = record ? getVendorData(record) : { rate: 0, terms: "" };
      const rate = vendorData.rate || "";
      const rateNum = parseFloat(rate) || 0;
      const quantity = parseFloat(record?.data?.quantity) || 0;
      const basicValue = (rateNum * quantity).toFixed(2);

      initialData[id] = {
        rate: rate,
        basicValue: basicValue,
        totalWithTax: basicValue, // Initially same until tax selected
        hsn: "",        // HSN code
        gst: "",        // GST% dropdown
        paymentTerms: vendorData.terms || "advance", // Advance / Credit payment terms
      };
    });
    // Find highest PO number in sheetRecords
    let maxPoNum = 1000; // default start
    sheetRecords.forEach((r) => {
      const poVal = r.data.poNumber;
      if (poVal && String(poVal).startsWith("PO-")) {
        const numPart = parseInt(String(poVal).replace("PO-", ""), 10);
        if (!isNaN(numPart) && numPart > maxPoNum) {
          maxPoNum = numPart;
        }
      }
    });
    const nextPoNumber = `PO-${maxPoNum + 1}`;

    setBulkFormData(initialData);
    setPoMode("create");
    setCommonPONumber(nextPoNumber);
    setCommonPOCopy(null);
    setCommonPkgAmount("");
    setCommonPkgGST("");
    setTerms(defaultTerms);
    const firstRecord = sheetRecords.find((r) => r.id === selectedRecordIds[0]);
    const firstVendor = firstRecord ? getVendorData(firstRecord) : null;
    setPoForm({
      ...defaultPOForm,
      supplierName: firstVendor?.name && firstVendor.name !== "-" ? firstVendor.name : "",
      supplierEmail: firstVendor?.name ? (VENDOR_EMAILS[firstVendor.name] || "") : "",
      supplierAddress: firstVendor?.name ? (VENDOR_ADDRESSES[firstVendor.name] || "") : "",
      deliveryDate: firstVendor?.delivery ? formatInputDate(firstVendor.delivery) : "",
      paymentTerms: normalizePaymentTerms(firstVendor?.terms),
      advanceAmount: extractAdvanceAmount(firstVendor?.terms),
      quotationDate: new Date().toISOString().split("T")[0],
      enquiryDate: new Date().toISOString().split("T")[0],
    });
    setOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecordIds.length === 0) return;

    if (!commonPONumber.trim()) {
      toast.error("Please enter the PO Number.");
      return;
    }

    let allValid = true;
    selectedRecordIds.forEach((id) => {
      const data = bulkFormData[id];
      if (!data || !data.basicValue || !data.totalWithTax || !data.hsn || !data.gst) {
        allValid = false;
      }
    });

    if (!allValid) {
      toast.error("Please fill all required fields for selected records.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const recordsToProcess = selectedRecordIds.map((id) => {
      const record = sheetRecords.find((r) => r.id === id);
      const data = bulkFormData[id];
      return { record, data };
    }).filter((item) => item.record);

    const processPromise = (async () => {
      try {
        let successCount = 0;
        let finalFileUrl = "";

        if (typeof commonPOCopy === "string") {
          finalFileUrl = commonPOCopy;
        } else if (commonPOCopy instanceof File) {
          try {
            const fileName = `po-copies/${Date.now()}_${commonPOCopy.name}`;
            const { error: uploadError } = await supabase.storage
              .from("po-copies")
              .upload(fileName, commonPOCopy);

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from("po-copies")
                .getPublicUrl(fileName);
              finalFileUrl = urlData.publicUrl;
            } else {
              console.warn("PO Copy upload error (bucket missing):", uploadError.message);
              finalFileUrl = typeof window !== "undefined" ? URL.createObjectURL(commonPOCopy) : "";
            }
          } catch (uploadErr) {
            console.error("PO Copy upload failed:", uploadErr);
            finalFileUrl = typeof window !== "undefined" ? URL.createObjectURL(commonPOCopy) : "";
          }
        }

        for (const { record, data } of recordsToProcess) {
          if (!record) continue;

          const poQty = parseFloat(record.data.quantity || "0") || 0;
          const maxApprovedQty = parseFloat(record.data.approvedQty || record.data.totalApprovedQty || "0") || poQty;

          if (poQty > maxApprovedQty && maxApprovedQty > 0) {
            toast.error(`PO Quantity (${poQty}) cannot exceed approved quantity (${maxApprovedQty}) for ${record.data.indentNumber}!`, {
              style: { background: "red", color: "white", border: "none" }
            });
            setIsSubmitting(false);
            return;
          }

          await new Promise((r) => setTimeout(r, 300));

          try {
            const { perItemPkgTotal } = getPkgTotals(
              commonPkgAmount,
              commonPkgGST,
              recordsToProcess.length
            );

            const basicVal = parseFloat(data.basicValue) || 0;
            const existingTax = parseFloat(data.totalWithTax) - basicVal;
            const finalTotalWithTax = (basicVal + existingTax + perItemPkgTotal).toFixed(2);

            const vendorData = getVendorData(record);

            const isAdv = (poForm.advancePayment || "yes") === "yes";
            const pTerm = poForm.paymentTerms || vendorData.terms || "advance";
            const advAmtStr = isAdv && poForm.advanceAmount ? ` (₹${poForm.advanceAmount})` : "";
            const finalPaymentType = isAdv ? `Advance Payment${advAmtStr}` : `No Advance - ${pTerm}`;

            const poPayload = {
              po_number: commonPONumber,
              indent_id: record.id,
              vendor_name: vendorData.name !== "-" ? vendorData.name : "",
              po_date: poForm.poDate || new Date().toISOString().split("T")[0],
              item_code: record.data.itemCode || "",
              item_name: record.data.itemName || "",
              quantity: parseFloat(record.data.quantity) || 0,
              unit_rate: basicVal,
              total_amount: parseFloat(finalTotalWithTax),
              payment_type: finalPaymentType,
              advance_amount: isAdv && poForm.advanceAmount ? parseFloat(poForm.advanceAmount) || 0 : 0,
              delivery_date: poForm.deliveryDate || null,
              delivery_address: poForm.supplierAddress || "",
              po_copy_url: finalFileUrl || record.data.poCopy || "",
              created_by: "System",
              status: "PO Issued",
            };

            if (poMode === "revise") {
              let { error } = await supabase
                .from("purchase_orders")
                .update(poPayload)
                .eq("indent_id", record.id)
                .eq("po_number", commonPONumber);

              if (error && (error.message.includes("advance_amount") || error.code === "PGRST204" || error.message.includes("column"))) {
                const fallbackPayload = { ...poPayload };
                delete (fallbackPayload as any).advance_amount;
                const retryRes = await supabase
                  .from("purchase_orders")
                  .update(fallbackPayload)
                  .eq("indent_id", record.id)
                  .eq("po_number", commonPONumber);
                error = retryRes.error;
              }
              if (error) throw error;
            } else {
              let { error } = await supabase
                .from("purchase_orders")
                .insert(poPayload);

              if (error && (error.message.includes("advance_amount") || error.code === "PGRST204" || error.message.includes("column"))) {
                const fallbackPayload = { ...poPayload };
                delete (fallbackPayload as any).advance_amount;
                const retryRes = await supabase
                  .from("purchase_orders")
                  .insert(fallbackPayload);
                error = retryRes.error;
              }
              if (error) throw error;
            }

            successCount++;
          } catch (err: any) {
            console.error(`Error processing record ${record.id}:`, err);
            throw new Error(`Record ${record.id}: ${err.message}`);
          }
        }

        await fetchData();
        setEmailSimActiveIndex(0);
        setEmailSimSteps([
          "Generating PDF Purchase Order Document...",
          "Connecting to SMTP server at mail.Botivateempire.com...",
          "Attaching Purchase Order and commercial annexures...",
          `Sending email to supplier: ${poForm.supplierEmail || "vendor@example.com"}...`,
          "Purchase Order successfully dispatched via Email!"
        ]);
        setEmailSimOpen(true);
        return { successCount, total: recordsToProcess.length };
      } finally {
        setIsSubmitting(false);
      }
    })();

    toast.promise(processPromise, {
      loading: `Processing ${recordsToProcess.length} POs...`,
      success: (data: any) => `Successfully processed ${data?.successCount || 0} of ${data?.total || 0} POs.`,
      error: (err) => `Error during bulk processing: ${err.message}`,
    });
  };

  const handleCloseEmailSim = () => {
    setEmailSimOpen(false);
    setOpen(false);
    setSelectedRecordIds([]);
    setBulkFormData({});
    resetPOForm();
  };

  const handleCommonFileChange = (file: File | null) => {
    setCommonPOCopy(file);
  };

  const handleCommonFileRemove = () => {
    setCommonPOCopy(null);
  };

  const getVendorData = (record: any) => {
    const selectedId = String(record.data.selectedVendor || "vendor1");
    const idx = parseInt(selectedId.replace("vendor", ""), 10) || 1;
    return {
      name: record.data[`vendor${idx}Name`] || "-",
      rate: record.data[`vendor${idx}Rate`],
      terms: record.data[`vendor${idx}Terms`],
      delivery: record.data[`vendor${idx}DeliveryDate`],
      warrantyType: record.data[`vendor${idx}WarrantyType`],
      attachment: record.data[`vendor${idx}Attachment`],
      approvedBy: record.data.approvedBy || "Auto-Approved",
    };
  };

  const selectedVendorName = useMemo(() => {
    if (selectedRecordIds.length === 0) return null;
    const firstSelected = sheetRecords.find((r) => r.id === selectedRecordIds[0]);
    return firstSelected ? getVendorData(firstSelected).name : null;
  }, [selectedRecordIds, sheetRecords]);

  const toggleSelectAll = () => {
    if (selectedVendorName) {
      setSelectedRecordIds([]);
    } else {
      if (pending.length === 0) return;
      const firstVendor = getVendorData(pending[0]).name;
      const sameVendorIds = pending
        .filter((r) => getVendorData(r).name === firstVendor)
        .map((r) => r.id);
      setSelectedRecordIds(sameVendorIds);
      toast.success(`Selected all pending items for supplier "${firstVendor}".`);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRecordIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      const recordToSelect = sheetRecords.find((r) => r.id === id);
      if (!recordToSelect) return prev;
      const vendorName = getVendorData(recordToSelect).name;
      if (prev.length > 0) {
        const firstSelected = sheetRecords.find((r) => r.id === prev[0]);
        if (firstSelected) {
          const firstVendor = getVendorData(firstSelected).name;
          if (vendorName !== firstVendor) {
            toast.warning(`You can only select indents from the same supplier ("${firstVendor}") to create a PO.`);
            return prev;
          }
        }
      }
      return [...prev, id];
    });
  };

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start">
          {selectedColumns.length === baseColumns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === baseColumns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(baseColumns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>
          {baseColumns.map((col) => (
            <div key={col.key} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.key]);
                  } else {
                    setSelectedColumns((prev) => prev.filter((c) => c !== col.key));
                  }
                }}
              />
              <Label className="text-sm">{col.label}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <FileEdit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Make PO</h2>
              </div>
              {submitError && (
                <p className="text-red-600 text-sm mt-2 font-medium bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {submitError}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent, Item, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 mb-6 flex items-center justify-between">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-[400px]">
            <TabsTrigger
              value="pending"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">Pending</span>
                <span className="text-[10px] opacity-70">Awaiting processing</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
            >
              <History className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70">Completed</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {completed.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {selectedRecordIds.length > 0 && activeTab === "pending" && (
            <Button
              onClick={handleOpenBulkForm}
              className="animate-in fade-in zoom-in duration-200 shadow-md shadow-slate-200 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 h-auto text-sm font-bold rounded-lg"
            >
              Create PO ({selectedRecordIds.length})
            </Button>
          )}
        </div>

        {/* PENDING */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No pending PO entries</p>
              <p className="text-sm mt-1">All purchase orders are created!</p>
            </div>
          ) : (
            <>

              <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
                <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                  <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                    <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                      <TableHead className="w-12 sticky top-0 z-20 bg-slate-200 border-none pl-4 py-3 ">
                        <div className="flex items-center justify-start h-full">
                          <Checkbox
                            checked={selectedRecordIds.length > 0 && pending.filter((r) => getVendorData(r).name === selectedVendorName).length === selectedRecordIds.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </div>
                      </TableHead>
                      {baseColumns
                        .filter((c) => selectedColumns.includes(c.key))
                        .map((col) => (
                          <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">{col.label}</TableHead>
                        ))}
                      <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Vendor</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Rate</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Payment Terms</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Exp. Delivery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record) => {
                      const v = getVendorData(record);
                      const isSelected = selectedRecordIds.includes(record.id);
                      const isRowDisabled = selectedVendorName !== null && v.name !== selectedVendorName;
                      return (
                        <TableRow
                          key={record.id}
                          className={isSelected ? "bg-blue-50" : isRowDisabled ? "opacity-40 transition-opacity" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(record.id)}
                              disabled={isRowDisabled}
                            />
                          </TableCell>
                          {baseColumns
                            .filter((c) => selectedColumns.includes(c.key))
                            .map((col) => (
                              <TableCell key={col.key} className="px-4 whitespace-nowrap">
                                {col.key === "planned4"
                                  ? formatDateDash(record.data[col.key])
                                  : (record.data[col.key] || "-")}
                              </TableCell>
                            ))}
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                          </TableCell>
                          <TableCell>
                            {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed orders</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed POs</p>
            </div>
          ) : (
            <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
              <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Item Details</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Planned</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Actual</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">Vendor Info</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Terms & Delivery</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase">PO Details (Incl. HSN)</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Financials (Incl. GST%)</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Total Amount</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-[13px] font-bold text-slate-700 uppercase whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record) => {
                    const v = getVendorData(record);
                    return (
                      <TableRow key={record.id} className="bg-green-50/50 hover:bg-green-100/50">
                        <TableCell className="max-w-[200px] px-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-blue-900">{record.data.indentNumber || "-"}</div>
                            <div className="text-sm font-medium truncate" title={record.data.itemName}>{record.data.itemName}</div>
                            <div className="text-xs text-gray-500">Qty: {record.data.quantity}</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 text-slate-700 whitespace-nowrap">
                          {formatDateDash(record.data.planned4)}
                        </TableCell>
                        <TableCell className="px-4 text-slate-700 whitespace-nowrap">
                          {formatDateDash(record.data.actual4)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">{v.name}</div>
                            <div className="text-xs text-gray-500">Rate: ₹{v.rate || "-"}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Terms:</span>
                              <span>{paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Delivery:</span>
                              <span className={!v.delivery ? "text-gray-400" : ""}>
                                {v.delivery ? formatDate(parseSheetDate(v.delivery)) : "-"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="bg-white/50">
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-bold text-green-700">{record.data.poNumber || "-"}</div>
                            <div className="text-[11px] text-gray-500">HSN: {record.data.hsn || "-"}</div>
                            {record.data.poCopy && (
                              <a
                                href={typeof record.data.poCopy === 'string' ? record.data.poCopy : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-green-600 hover:underline text-[11px]"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View PO Copy</span>
                              </a>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="bg-white/50">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-xs text-gray-500">Basic:</span>
                              <span className="font-medium">₹{record.data.basicValue || "-"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1">
                              <span className="text-xs text-gray-500 font-semibold text-green-700">GST: {formatGSTDisplay(record.data.gst)}</span>
                              <span className="font-bold text-green-800">Total: ₹{record.data.totalWithTax || "-"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="bg-white/50 border-l">
                          <div className="font-bold text-green-800 text-sm">
                            ₹{poTotalMap.get(record.data.poNumber)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="bg-white/50 border-l">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPoMode("revise");
                              setOpen(true);
                              handleRevisePONumberChange(record.data.poNumber);
                            }}
                            className="h-8 text-xs font-semibold px-2 bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-750 transition-colors"
                          >
                            <FileEdit className="w-3.5 h-3.5 mr-1" />
                            Revise
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* BULK PO MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl max-h-[94vh] flex flex-col gap-0 p-0 overflow-hidden bg-slate-50">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 border-b bg-white text-sm font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setPoMode("create");
                resetPOForm();
              }}
              className={`h-11 transition-colors ${poMode === "create" ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-50"}`}
            >
              Create New PO
            </button>
            <button
              type="button"
              onClick={() => {
                setPoMode("revise");
                resetPOForm();
              }}
              className={`h-11 transition-colors ${poMode === "revise" ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-slate-50"}`}
            >
              Revise Existing PO
            </button>
          </div>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-5 p-6">
              <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-center gap-8 bg-slate-50 px-6 py-6">
                  <img src="null" alt="Logo" className="h-10 w-10 object-contain" />
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Botivate</h2>
                    <p className="text-sm text-slate-600">Gateway Park, Mumbai, Maharashtra</p>
                    <p className="text-sm text-slate-600">Phone No: +9820012345</p>
                  </div>
                </div>
                <div className="border-t bg-white py-4 text-center text-lg font-bold tracking-[0.2em] text-slate-800">
                  PURCHASE ORDER
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="border-b bg-slate-50 px-4 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ClipboardList className="h-4 w-4 text-indigo-600" />
                    Order Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Firm Name</Label>
                    <Select value={poForm.firmName} onValueChange={(value) => setPoForm((prev) => ({ ...prev, firmName: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Botivate">Botivate</SelectItem>
                        <SelectItem value="Botivate Services">Botivate Services</SelectItem>
                        <SelectItem value="Botivate Retail">Botivate Retail</SelectItem>
                        <SelectItem value="Botivate Logistics">Botivate Logistics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Supplier Name</Label>
                    <Select
                      value={poForm.supplierName || undefined}
                      onValueChange={(value) => setPoForm((prev) => ({
                        ...prev,
                        supplierName: value,
                        supplierEmail: VENDOR_EMAILS[value] || `${value.toLowerCase().replace(/\s+/g, "")}@example.com`,
                        supplierAddress: VENDOR_ADDRESSES[value] || `${value} Business Park, Mumbai`
                      }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set([
                          ...selectedPORecords.map((record: any) => getVendorData(record).name).filter(Boolean),
                          ...defaultSuppliers
                        ])).map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {poMode === "revise" && (
                    <div className="space-y-1.5 col-span-2 bg-indigo-50/50 p-3 border border-indigo-100 rounded-xl">
                      <Label className="text-xs font-bold uppercase tracking-wide text-indigo-700">Select Existing PO Number</Label>
                      <Select value={commonPONumber} onValueChange={handleRevisePONumberChange}>
                        <SelectTrigger className="bg-white border-indigo-200 h-9"><SelectValue placeholder="Choose PO from history..." /></SelectTrigger>
                        <SelectContent>
                          {completedPONumbers.map((poNum) => (
                            <SelectItem key={poNum} value={poNum}>{poNum}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className={poMode === "revise" ? "space-y-1.5" : "space-y-1.5 col-span-2"}>
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PO Number</Label>
                    <Input
                      value={commonPONumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCommonPONumber(val);
                        if (completedPONumbers.includes(val)) {
                          handleRevisePONumberChange(val);
                        }
                      }}
                      placeholder="Botivate/Store/26-27/21"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PO Date</Label>
                    <Input type="date" value={poForm.poDate} onChange={(e) => setPoForm((prev) => ({ ...prev, poDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Delivery Date</Label>
                    <Input type="date" value={poForm.deliveryDate || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Supplier Email</Label>
                    <Input type="email" value={poForm.supplierEmail || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, supplierEmail: e.target.value }))} placeholder="Email for notification" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Supplier Address</Label>
                    <Input value={poForm.supplierAddress || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, supplierAddress: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">GSTIN</Label>
                    <Input value={poForm.gstin || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, gstin: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quotation Number</Label>
                    <Input value={poForm.quotationNumber || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, quotationNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quotation Date</Label>
                    <Input type="date" value={poForm.quotationDate || ""} onChange={(e) => setPoForm((prev) => ({ ...prev, quotationDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 font-extrabold">Advance Payment *</Label>
                    <Select
                      value={poForm.advancePayment || "yes"}
                      onValueChange={(val) => setPoForm((prev) => ({
                        ...prev,
                        advancePayment: val,
                        advanceAmount: val === "no" ? "" : prev.advanceAmount
                      }))}
                    >
                      <SelectTrigger className="bg-white border-slate-300 font-semibold text-xs h-10">
                        <SelectValue placeholder="Select Yes / No" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border text-xs shadow-md z-50">
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(poForm.advancePayment || "yes") === "yes" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 font-extrabold">Advance Amount (₹) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 5000"
                        value={poForm.advanceAmount || ""}
                        onChange={(e) => setPoForm((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                        className="bg-white border-slate-300 font-semibold text-xs h-10"
                      />
                    </div>
                  )}
                  {/* Enquiry fields removed */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Description / Remarks</Label>
                    <textarea
                      value={poForm.remarks}
                      onChange={(e) => setPoForm((prev) => ({ ...prev, remarks: e.target.value }))}
                      className="min-h-14 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* PO Copy Upload */}
                  <div className="space-y-1.5 md:col-span-2 bg-slate-50 p-4 border rounded-lg">
                    <Label className="text-xs font-bold uppercase tracking-wide text-slate-700 block mb-1">PO Copy (PDF/Image)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => handleCommonFileChange(e.target.files?.[0] || null)}
                        className="bg-white max-w-sm h-9"
                      />
                      {commonPOCopy && (
                        <div className="flex items-center gap-2 text-xs bg-white border px-3 py-1.5 rounded shadow-sm">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          {commonPOCopy instanceof File ? (
                            <span className="font-semibold text-slate-800">{commonPOCopy.name}</span>
                          ) : (
                            <a href={commonPOCopy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                              <span>View Existing PO Copy</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-750 hover:bg-slate-50" onClick={handleCommonFileRemove}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>


                </div>
              </section>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="border-b bg-slate-50 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Commercial Details</div>
                  <div className="space-y-3 p-4 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-xs font-semibold text-slate-500">GSTIN</span><span>{poForm.companyGstin}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-xs font-semibold text-slate-500">PAN</span><span>{poForm.companyPan}</span></div>
                  </div>
                </section>
                <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="border-b bg-slate-50 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Billing Address</div>
                  <div className="p-4 text-sm">
                    <p className="font-bold text-slate-900">{poForm.billingName}</p>
                    <p className="mt-1 text-slate-600">{poForm.billingAddress}</p>
                  </div>
                </section>
                <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Destination</span>
                    <Edit2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="p-4 text-sm">
                    <p className="font-bold text-slate-900">{poForm.destinationName}</p>
                    <p className="mt-1 text-slate-600">{poForm.destinationAddress}</p>
                  </div>
                </section>
              </div>

              <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-semibold text-slate-900">Items & Quantities</h3>
                  <Badge variant="secondary" className="text-indigo-700">{selectedRecordIds.length} Items Selected</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">S/N</th>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-left">Payment</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-left">HSN</th>
                        <th className="px-4 py-3 text-left">GST%</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPORecords.map((record: any, index) => {
                        const v = getVendorData(record);
                        const data = bulkFormData[record.id] || {};
                        const baseTotal = parseFloat(data.totalWithTax) || 0;
                        const pkgShare = getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal;
                        return (
                          <tr key={record.id} className="border-t">
                            <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{record.data.itemName}</div>
                              <div className="text-xs text-slate-500">{record.data.indentNumber}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-indigo-900">
                               {paymentTermsList.find((t) => t.value === poForm.paymentTerms)?.label || poForm.paymentTerms || v.terms || "-"}
                             </td>
                            <td className="px-4 py-3 text-right">{record.data.quantity || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs font-semibold text-slate-500">₹</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={data.rate !== undefined ? data.rate : (v.rate || "")}
                                  onChange={(e) => {
                                    const newRate = e.target.value;
                                    const rateNum = parseFloat(newRate) || 0;
                                    const qtyNum = parseFloat(record.data.quantity || "0") || 0;
                                    const newBasic = (rateNum * qtyNum).toFixed(2);
                                    const gstVal = data.gst || "";
                                    const newTotal = (parseFloat(newBasic) + parseFloat(newBasic) * gstRateFor(gstVal)).toFixed(2);
                                    setBulkFormData((prev) => ({
                                      ...prev,
                                      [record.id]: {
                                        ...prev[record.id],
                                        rate: newRate,
                                        basicValue: newBasic,
                                        totalWithTax: newTotal,
                                      },
                                    }));
                                  }}
                                  placeholder="0.00"
                                  className="h-8 w-28 text-right font-semibold bg-white border-slate-300"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                value={data.hsn || ""}
                                onChange={(e) => setBulkFormData((prev) => ({ ...prev, [record.id]: { ...prev[record.id], hsn: e.target.value } }))}
                                placeholder="HSN"
                                className="h-8 min-w-24"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={data.gst || ""}
                                onValueChange={(val) => {
                                  const basic = parseFloat(data.basicValue) || 0;
                                  const total = (basic + basic * gstRateFor(val)).toFixed(2);
                                  setBulkFormData((prev) => ({
                                    ...prev,
                                    [record.id]: { ...prev[record.id], gst: val, totalWithTax: total },
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 min-w-24"><SelectValue placeholder="GST" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5%">5%</SelectItem>
                                  <SelectItem value="12%">12%</SelectItem>
                                  <SelectItem value="18%">18%</SelectItem>
                                  <SelectItem value="28%">28%</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">Rs. {(baseTotal + pkgShare).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid justify-end gap-3 border-t p-4 text-sm">
                  <div className="flex min-w-72 justify-between gap-10"><span>Subtotal</span><span>Rs. {poSummary.subtotal.toFixed(2)}</span></div>
                  <div className="flex min-w-72 justify-between gap-10"><span>GST</span><span>Rs. {poSummary.gst.toFixed(2)}</span></div>
                  <div className="flex min-w-72 justify-between gap-10 pt-2 text-base font-bold"><span>GRAND TOTAL</span><span className="text-indigo-700">Rs. {poSummary.grandTotal.toFixed(2)}</span></div>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-semibold text-slate-900">Terms & Conditions</h3>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-indigo-700" onClick={() => setTerms((prev) => [...prev, ""])}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Term
                  </Button>
                </div>
                <div className="divide-y">
                  {terms.map((term, index) => (
                    <div key={index} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-3 px-4 py-3 text-sm">
                      <span className="text-right text-slate-500">{index + 1}.</span>
                      <Input
                        value={term}
                        onChange={(e) => setTerms((prev) => prev.map((item, i) => i === index ? e.target.value : item))}
                        className="border-0 shadow-none focus-visible:ring-0"
                      />
                      <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setTerms((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Packaging and optional attachment sections removed */}
            </div>
          </form>

          <DialogFooter className="grid grid-cols-3 gap-1 border-t bg-white p-4">
            <Button type="button" variant="secondary" onClick={resetPOForm} disabled={isSubmitting}>
              Reset
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)} disabled={selectedRecordIds.length === 0}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={
                isSubmitting ||
                selectedRecordIds.length === 0 ||
                !commonPONumber.trim() ||
                !selectedRecordIds.every((id) => {
                  const d = bulkFormData[id];
                  return d?.basicValue && d?.totalWithTax && d?.hsn && d?.gst;
                })
              }
              className="bg-indigo-500 text-white hover:bg-indigo-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {poMode === "revise" ? "Updating PO..." : "Sending PO..."}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {poMode === "revise" ? "Update PO" : "Send PO"}
                </>
              )}
            </Button>
          </DialogFooter>

          <div className="hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Bulk PO Creation ({selectedRecordIds.length} items)</DialogTitle>
              <p className="text-sm text-gray-600">Fill PO details for all selected items</p>
              {selectedRecordIds.length > 1 && (
                <div className="mt-3 flex items-center gap-2 max-w-xs">
                  <Label htmlFor="grand-total-display" className="text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                    Grand Total (w/ Tax):
                  </Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">₹</span>
                    <Input
                      id="grand-total-display"
                      type="text"
                      readOnly
                      value={(selectedRecordIds.reduce((sum, recordId) => {
                        const data = bulkFormData[recordId] || {};
                        return sum + (parseFloat(data.totalWithTax) || 0);
                      }, 0) + getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                      className="pl-7 bg-slate-100 cursor-not-allowed font-bold text-green-700 h-9"
                    />
                  </div>
                </div>
              )}
            </DialogHeader>

            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* SHARED PO NUMBER - AT TOP */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="space-y-2">
                  <Label htmlFor="common-poNumber" className="text-base font-semibold">
                    PO Number <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items)</span>
                  </Label>
                  <Input
                    id="common-poNumber"
                    value={commonPONumber}
                    onChange={(e) => setCommonPONumber(e.target.value)}
                    required
                    placeholder="PO-2025-001"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* SHARED PACKAGING/FORWARDING SECTION */}
              <div className="border rounded-lg p-4 bg-amber-50">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Packaging / Forwarding
                    <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items, divided equally)</span>
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="common-pkgAmount">Amount</Label>
                      <Input
                        id="common-pkgAmount"
                        type="number"
                        step="0.01"
                        value={commonPkgAmount}
                        onChange={(e) => setCommonPkgAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="common-pkgGST">GST on Packaging</Label>
                      <Select value={commonPkgGST} onValueChange={setCommonPkgGST}>
                        <SelectTrigger id="common-pkgGST" className="bg-white">
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0%">0%</SelectItem>
                          <SelectItem value="5%">5%</SelectItem>
                          <SelectItem value="12%">12%</SelectItem>
                          <SelectItem value="18%">18%</SelectItem>
                          <SelectItem value="28%">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Total Packaging / Forwarding</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).totalPkg.toFixed(2)}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* PER-ITEM SECTIONS */}
              {selectedRecordIds.map((recordId) => {
                const record = sheetRecords.find((r) => r.id === recordId);
                if (!record) return null;
                const v = getVendorData(record);
                const data = bulkFormData[recordId] || {};

                return (
                  <div key={recordId} className="border rounded-lg p-4 bg-gray-50">
                    <div className="mb-4 pb-3 border-b">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div><strong>Indent-No:</strong> {record.data.indentNumber}</div>
                        <div><strong>Item:</strong> {record.data.itemName}</div>
                        <div><strong>Qty:</strong> {record.data.quantity}</div>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Vendor: <span className="font-medium">{v.name}</span> | Rate: ₹{v.rate}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${recordId}-basicValue`}>
                          Basic Value <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`${recordId}-basicValue`}
                          type="number"
                          step="0.01"
                          value={data.basicValue || ""}
                          readOnly
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${recordId}-gst`}>
                          GST <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={data.gst || ""}
                          onValueChange={(val) => {
                            const basic = parseFloat(data.basicValue) || 0;
                            let taxRate = 0;
                            if (val === "5%") taxRate = 0.05;
                            if (val === "12%") taxRate = 0.12;
                            if (val === "18%") taxRate = 0.18;
                            if (val === "28%") taxRate = 0.28;

                            const total = (basic + (basic * taxRate)).toFixed(2);

                            setBulkFormData((prev) => ({
                              ...prev,
                              [recordId]: {
                                ...prev[recordId],
                                gst: val,
                                totalWithTax: total
                              },
                            }))
                          }}
                        >
                          <SelectTrigger id={`${recordId}-gst`}>
                            <SelectValue placeholder="Select GST" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5%">5%</SelectItem>
                            <SelectItem value="12%">12%</SelectItem>
                            <SelectItem value="18%">18%</SelectItem>
                            <SelectItem value="28%">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Pkg/Fwd Share</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal.toFixed(2)}
                          readOnly
                          className="bg-gray-100 cursor-not-allowed text-amber-700"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${recordId}-totalWithTax`}>
                          Total With Tax <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`${recordId}-totalWithTax`}
                          type="number"
                          step="0.01"
                          value={(
                            (parseFloat(data.totalWithTax) || 0) +
                            getPkgTotals(commonPkgAmount, commonPkgGST, selectedRecordIds.length).perItemPkgTotal
                          ).toFixed(2)}
                          readOnly
                          className="bg-gray-100 cursor-not-allowed font-semibold"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${recordId}-hsn`}>
                          HSN <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id={`${recordId}-hsn`}
                          value={data.hsn || ""}
                          onChange={(e) =>
                            setBulkFormData((prev) => ({
                              ...prev,
                              [recordId]: { ...prev[recordId], hsn: e.target.value },
                            }))
                          }
                          required
                          placeholder="HSN Code"
                        />
                      </div>


                    </div>
                  </div>
                );
              })}

              {/* SHARED PO COPY - AT BOTTOM */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-slate-900">
                    PO Copy <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-slate-500 ml-2">(applies to all items)</span>
                  </Label>
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleCommonFileChange(e.target.files?.[0] || null)}
                      className="hidden"
                      id="common-file"
                    />
                    <label
                      htmlFor="common-file"
                      className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 bg-white rounded-lg cursor-pointer hover:border-gray-400 text-sm"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload PO copy
                    </label>
                    {commonPOCopy && (
                      <div className="mt-2 p-2 bg-white border rounded flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          {commonPOCopy instanceof File ? (
                            <>
                              <span className="font-medium text-slate-800">{commonPOCopy.name}</span>
                              <span className="text-xs text-gray-500">
                                ({(commonPOCopy.size / 1024).toFixed(1)} KB)
                              </span>
                            </>
                          ) : (
                            <a
                              href={commonPOCopy}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span>Existing PO Copy Link</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCommonFileRemove}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkSubmit}
                disabled={
                  isSubmitting ||
                  selectedRecordIds.length === 0 ||
                  !commonPONumber.trim() ||
                  !commonPOCopy ||
                  !selectedRecordIds.every((id) => {
                    const d = bulkFormData[id];
                    return d?.basicValue && d?.totalWithTax && d?.hsn && d?.gst;
                  })
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating POs...
                  </>
                ) : (
                  `Create ${selectedRecordIds.length} PO${selectedRecordIds.length > 1 ? "s" : ""}`
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      {/* PO DRAFT PREVIEW MODAL */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-none">
          <DialogHeader className="p-4 bg-slate-800 text-white flex-shrink-0 flex flex-row items-center justify-between border-b border-slate-700">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              <span>Purchase Order Document Preview</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50 flex justify-center scrollbar-thin">
            {/* A4 Paper mockup layout */}
            <div className="w-full max-w-3xl bg-white border border-slate-200 shadow-xl rounded-md p-8 md:p-12 text-slate-800 font-sans space-y-8 min-h-[1000px] flex flex-col justify-between">
              <div>
                {/* Header Section */}
                <div className="flex items-start justify-between border-b pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-950 rounded flex items-center justify-center text-white font-extrabold text-xl shadow">
                      DE
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 leading-tight">Botivate</h2>
                      <p className="text-xs text-slate-500">Gateway Park, Mumbai, Maharashtra</p>
                      <p className="text-xs text-slate-500">GSTIN: {poForm.companyGstin || "-"}</p>
                      <p className="text-xs text-slate-500">Email: accounts@Botivateempire.com</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-black text-indigo-600 tracking-wide">PURCHASE ORDER</h1>
                    <p className="text-xs text-slate-500 mt-1">Ref: {commonPONumber || "DRAFT"}</p>
                    <p className="text-xs text-slate-500">Date: {formatDateDash(poForm.poDate)}</p>
                  </div>
                </div>

                {/* Info Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  {/* Vendor Details */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier Info</h3>
                    <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1">
                      <p className="font-bold text-slate-900">{poForm.supplierName || "—"}</p>
                      <p className="text-slate-600 leading-relaxed">{poForm.supplierAddress || "—"}</p>
                      <p className="text-slate-600"><span className="font-semibold text-slate-500">GSTIN:</span> {poForm.gstin || "—"}</p>
                      <p className="text-slate-600"><span className="font-semibold text-slate-500">Email:</span> {poForm.supplierEmail || "—"}</p>
                    </div>
                  </div>

                  {/* Delivery & Reference details */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery & Order References</h3>
                    <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-slate-500">Delivery Date:</span><span className="font-semibold text-slate-800">{formatDateDash(poForm.deliveryDate)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Quotation No:</span><span className="font-semibold text-slate-800">{poForm.quotationNumber || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Quotation Date:</span><span className="font-semibold text-slate-800">{formatDateDash(poForm.quotationDate)}</span></div>
                      <div className="flex justify-between border-t pt-1 mt-1"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* Billing Details */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Billing Address</h3>
                    <div className="bg-slate-50 border rounded-lg p-3 text-xs leading-relaxed">
                      <p className="font-bold text-slate-900">{poForm.billingName}</p>
                      <p className="text-slate-600">{poForm.billingAddress}</p>
                    </div>
                  </div>

                  {/* Shipping Details */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Destination / Ship-To Address</h3>
                    <div className="bg-slate-50 border rounded-lg p-3 text-xs leading-relaxed">
                      <p className="font-bold text-slate-900">{poForm.destinationName}</p>
                      <p className="text-slate-600">{poForm.destinationAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Items details table */}
                <div className="pt-6">
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b text-left">
                          <th className="p-3 text-center w-10">S/N</th>
                          <th className="p-3">Item Description</th>
                          <th className="p-3">HSN</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-center">GST</th>
                          <th className="p-3 text-right">Total Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPORecords.map((record: any, index) => {
                          const v = getVendorData(record);
                          const data = bulkFormData[record.id] || {};
                          const total = parseFloat(data.totalWithTax) || 0;
                          return (
                            <tr key={record.id} className="border-b last:border-0 hover:bg-slate-50/30">
                              <td className="p-3 text-center text-slate-500">{index + 1}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{record.data.itemName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">Indent: {record.data.indentNumber}</div>
                              </td>
                              <td className="p-3 font-mono">{data.hsn || "—"}</td>
                              <td className="p-3 text-center font-semibold text-slate-700">{record.data.quantity || "—"}</td>
                              <td className="p-3 text-right font-medium">₹{parseFloat(v.rate || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-center text-slate-600 font-semibold">{data.gst || "0%"}</td>
                              <td className="p-3 text-right font-bold text-slate-900">₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary block */}
                <div className="flex justify-end pt-6">
                  <div className="w-72 bg-slate-50 border rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-medium">₹{poSummary.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>GST amount:</span>
                      <span className="font-medium">₹{poSummary.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {commonPkgAmount && (
                      <div className="flex justify-between text-slate-600">
                        <span>Pkg & Fwd ({commonPkgGST || "0%"}):</span>
                        <span className="font-medium">₹{parseFloat(commonPkgAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1.5 text-sm font-bold text-indigo-700">
                      <span>GRAND TOTAL:</span>
                      <span>₹{poSummary.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions block */}
                <div className="pt-6 space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terms & Conditions</h4>
                  <ol className="list-decimal pl-4 text-[10px] text-slate-500 space-y-1 leading-relaxed">
                    {terms.filter(t => t.trim() !== "").map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Signatures block */}
              <div className="border-t pt-8 flex items-center justify-between text-[11px] text-slate-500">
                <div>
                  <p>Prepared By: Procurement Department</p>
                  <p className="font-mono text-[9px] mt-0.5">FMS System Draft Generation</p>
                </div>
                <div className="text-right">
                  <div className="h-10 w-32 border-b border-dashed border-slate-300 ml-auto mb-1"></div>
                  <p className="font-bold text-slate-700">For Botivate</p>
                  <p className="text-[9px]">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-800 flex-shrink-0 border-t border-slate-700">
            <Button type="button" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMAIL SIMULATION MODAL */}
      <Dialog open={emailSimOpen} onOpenChange={setEmailSimOpen}>
        <DialogContent className="max-w-md p-6 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl flex flex-col items-center text-center">
          <DialogHeader className="sr-only">
            <DialogTitle>PO Email Dispatch Simulator</DialogTitle>
          </DialogHeader>
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
            {emailSimActiveIndex === emailSimSteps.length - 1 ? (
              <CheckCircle className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : (
              <Mail className="w-8 h-8 text-indigo-400 animate-pulse" />
            )}
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white mb-2">PO Email Dispatch Simulator</h2>
          <p className="text-xs text-slate-400 max-w-xs mb-6">
            Dispatching Purchase Order Ref: <span className="text-indigo-400 font-bold font-mono">{commonPONumber}</span> to <span className="text-indigo-400 font-bold">{poForm.supplierName}</span> via SMTP relay.
          </p>

          <div className="w-full space-y-3.5 mb-6 text-left max-w-sm">
            {emailSimSteps.map((step, idx) => {
              const isCompleted = idx < emailSimActiveIndex;
              const isActive = idx === emailSimActiveIndex;
              return (
                <div key={idx} className="flex items-center gap-3 text-xs transition-opacity duration-300">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-[9px] font-mono">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <span className={`font-medium ${isCompleted ? "text-emerald-400" : isActive ? "text-white font-bold" : "text-slate-500"}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Simple progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-6 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((emailSimActiveIndex + 1) / emailSimSteps.length) * 100}%` }}
            ></div>
          </div>

          <Button
            type="button"
            onClick={handleCloseEmailSim}
            disabled={emailSimActiveIndex < emailSimSteps.length - 1}
            className={`w-full font-bold h-10 ${emailSimActiveIndex === emailSimSteps.length - 1 ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}
          >
            {emailSimActiveIndex === emailSimSteps.length - 1 ? "Done / Complete" : "Sending PO..."}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
