"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Search, CheckCircle2, ShieldCheck, Copy, ExternalLink, CheckCircle, RefreshCw, Pencil } from "lucide-react";
import { formatDate, getPlannedDateForRecord, formatDateTimeFull, getErrorMessage, reportPendingCount } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow, selectApprovedVendor, isMissingColumnError } from "@/lib/supabase/queries";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

const formatDateDash = (dateStr: string) => {
  if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch {
    return dateStr;
  }
};

export default function ApprovedVendor() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tatRules, setTatRules] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [approvedVendor, setApprovedVendor] = useState("vendor1");
  const [formData, setFormData] = useState({
    remarks: "",
  });

  const [approverList, setApproverList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("master_warehouses").select("name").eq("is_active", true).then(({ data }) => {
      setWarehouseOptions((data || []).map((w: any) => w.name).filter(Boolean));
    });
  }, []);

  // Manual quotation entry — fills in a vendor slot's Payment Terms /
  // Delivery / Transport / Remarks / per-item Rate & GST on behalf of a
  // vendor who didn't submit via their public link.
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualEditSlot, setManualEditSlot] = useState<number | null>(null);
  const [manualPaymentTerms, setManualPaymentTerms] = useState("30");
  const [manualDeliveryDate, setManualDeliveryDate] = useState("");
  const [manualTransportType, setManualTransportType] = useState("");
  const [manualRemarks, setManualRemarks] = useState("");
  const [manualRates, setManualRates] = useState<Record<string, string>>({});
  const [manualGst, setManualGst] = useState<Record<string, string>>({});
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const workflow = await fetchIndentWorkflow();
      const rows = workflow
        .filter((row) => row.data.indentNumber && row.data.indentNumber.trim() !== "")
        .map((row) => {
          const hasActual3 = !!row.data.actual3 && row.data.actual3.trim() !== "" && row.data.actual3.trim() !== "-";
          const hasPlan4 = !!row.data.plan4 && row.data.plan4.trim() !== "" && row.data.plan4.trim() !== "-";

          return {
            id: row.id,
            rowIndex: row.originalIndex,
            stage: 4,
            status: (hasActual3 && hasPlan4) ? "completed" : (hasActual3 && !hasPlan4 ? "pending" : "not_ready"),
            createdAt: row.data.createdAt,
            data: row.data,
            _quotationIds: row._quotationIds,
          };
        });
      setSheetRecords(rows);

      const { data: dropRows, error: dropErr } = await supabase
        .from("master_approvers")
        .select("name")
        .eq("is_active", true);

      if (dropErr) console.error("Fetch error Stage 4 (master_approvers):", getErrorMessage(dropErr));
      if (!dropErr && dropRows) {
        setApproverList(dropRows.map((r) => r.name).filter(Boolean));
      }

      const { data: tatRows, error: tatErr } = await supabase.from("master_tat_rules").select("*");
      if (tatErr) console.error("Fetch error Stage 4 (master_tat_rules):", getErrorMessage(tatErr));
      if (tatRows) setTatRules(tatRows);
    } catch (e) {
      console.error("Fetch error Stage 4:", getErrorMessage(e));
      toast.error(`Failed to load Approved Vendor data: ${getErrorMessage(e)}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pending = useMemo(() => {
    const pendingRecs = sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => divisionFilter === "all" || r.data.warehouseLocation === divisionFilter);

    // Group by actual3 timestamp
    const groupsMap: Record<string, any[]> = {};
    pendingRecs.forEach((r) => {
      const key = r.data.actual3 || "single";
      if (!groupsMap[key]) {
        groupsMap[key] = [];
      }
      groupsMap[key].push(r);
    });

    const groups = Object.entries(groupsMap).map(([key, recs]) => {
      recs.sort((a, b) => (a.data.indentNumber || "").localeCompare(b.data.indentNumber || ""));
      return {
        id: recs.map((r) => r.id).join(","),
        actual3: key,
        records: recs,
        indentNumbers: recs.map((r) => r.data.indentNumber).join(", "),
        itemNames: recs.map((r) => r.data.itemName).join(", "),
      };
    });

    const searchLower = searchTerm.toLowerCase();
    return groups.filter((g) =>
      g.indentNumbers.toLowerCase().includes(searchLower) ||
      g.itemNames.toLowerCase().includes(searchLower)
    );
  }, [sheetRecords, searchTerm, divisionFilter]);

  useEffect(() => { reportPendingCount("Approved Vendor", pending.length); }, [pending.length]);

  const completed = useMemo(() => sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => divisionFilter === "all" || r.data.warehouseLocation === divisionFilter)
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm, divisionFilter]);

  const pendingPagination = usePagination(pending, 15);
  const historyPagination = usePagination(completed, 15);

  const baseColumns = [
    { key: "createdAtCol", label: "Timestamp" },
    { key: "indentNumber", label: "Indent" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "actual3", label: "Planned Date" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start h-10 rounded-xl bg-white border-slate-200">
          {selectedColumns.length === baseColumns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length !== 1 ? "s" : ""
            } selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2 bg-white border shadow-md">
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
                    setSelectedColumns((prev) =>
                      prev.filter((c) => c !== col.key)
                    );
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

  const paymentTermsOptions = [
    { value: "Advance", label: "Advance" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" }
  ];

  const transportTypeOptions = [
    { value: "Ex-Factory", label: "Ex-Factory" },
    { value: "Ex-Factory + Transport", label: "Ex-Factory + Transport" },
    { value: "F.O.R.", label: "F.O.R. (Free on Road)" },
  ];

  const gstOptions = [
    { value: "5", label: "5%" },
    { value: "12", label: "12%" },
    { value: "18", label: "18%" },
    { value: "28", label: "28%" },
  ];

  const handleOpenForm = (group: any) => {
    setCurrentGroup(group);
    setApprovedVendor("vendor1");
    setFormData({
      remarks: "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || currentGroup.records.length === 0) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selIdx = parseInt(approvedVendor.replace("vendor", ""), 10);

      const updatePromises = currentGroup.records.map(async (record: any) => {
        const approvedName = record.data[`vendor${selIdx}Name`] || "";
        const approvedRate = parseFloat(record.data[`vendor${selIdx}Rate`]) || 0;
        const quotationId = record._quotationIds?.[approvedVendor];

        if (!quotationId) throw new Error(`No quotation found for ${approvedVendor} on indent ${record.data.indentNumber}`);

        await selectApprovedVendor(record.id, {
          selectedQuotationId: quotationId,
          vendorName: approvedName,
          vendorType: "regular",
          finalAgreedRate: approvedRate,
          approvedBy: "",
          approvalRemarks: formData.remarks,
        });
      });

      await Promise.all(updatePromises);
      toast.success("Approved Vendor set successfully!");
      await fetchData();
      resetForm();
    } catch (err: any) {
      console.error("Stage 4 Submit Error:", err);
      setSubmitError(err.message || "Failed to submit Approved Vendor");
      toast.error(err.message || "Failed submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setOpen(false);
    setCurrentGroup(null);
    setApprovedVendor("vendor1");
    setFormData({ remarks: "" });
  };

  // Shared by the modal's own comparison table (currentGroup) and each
  // Pending-tab row's "Vendor Options" preview column.
  const computeVendorOptionsForGroup = (group: any) => {
    if (!group || group.records.length === 0) return [];
    const firstRec = group.records[0];
    const list = [];
    for (const num of [1, 2, 3]) {
      const name = firstRec.data[`vendor${num}Name`];
      if (name && name !== "-") {
        const terms = firstRec.data[`vendor${num}Terms`];
        const delivery = firstRec.data[`vendor${num}Delivery`];
        const transportType = firstRec.data[`vendor${num}TransportType`];

        let totalValue = 0;
        let hasRates = false;
        group.records.forEach((rec: any) => {
          const rateStr = rec.data[`vendor${num}Rate`];
          const qty = parseFloat(rec.data.quantity) || 0;
          if (rateStr && rateStr !== "-") {
            totalValue += (parseFloat(rateStr) || 0) * qty;
            hasRates = true;
          }
        });

        list.push({
          id: `vendor${num}`,
          slotNum: num,
          name,
          terms,
          delivery,
          transportType,
          totalValue: hasRates ? totalValue : null,
        });
      }
    }
    return list;
  };

  const groupVendorOptions = useMemo(() => computeVendorOptionsForGroup(currentGroup), [currentGroup]);

  // Keep the open dialog's snapshot in sync after a manual save triggers a
  // refetch — otherwise the comparison table would keep showing stale "—"s.
  useEffect(() => {
    if (currentGroup) {
      const updated = pending.find((g) => g.id === currentGroup.id);
      if (updated) setCurrentGroup(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // The Approved Vendor dropdown only lists slots that actually submitted
  // rates — keep the current selection pointed at one of those instead of
  // an empty slot (e.g. right after opening the form, or after a manual
  // entry / refetch changes which slots are filled).
  useEffect(() => {
    if (!open) return;
    const filled = groupVendorOptions.filter((v) => v.totalValue !== null);
    if (filled.length === 0) return;
    if (!filled.some((v) => v.id === approvedVendor)) {
      setApprovedVendor(filled[0].id);
    }
  }, [groupVendorOptions, open, approvedVendor]);

  const openManualEdit = (slotNum: number) => {
    if (!currentGroup || currentGroup.records.length === 0) return;
    const firstRec = currentGroup.records[0];
    const terms = firstRec.data[`vendor${slotNum}Terms`];
    const delivery = firstRec.data[`vendor${slotNum}Delivery`];
    const transport = firstRec.data[`vendor${slotNum}TransportType`];
    const remarks = firstRec.data[`vendor${slotNum}Remarks`];

    setManualEditSlot(slotNum);
    setManualPaymentTerms(terms && terms !== "-" ? terms : "30");
    setManualDeliveryDate(delivery && delivery !== "-" ? delivery : "");
    setManualTransportType(transport && transport !== "-" ? transport : "");
    setManualRemarks(remarks && remarks !== "-" ? remarks : "");

    const rates: Record<string, string> = {};
    const gsts: Record<string, string> = {};
    currentGroup.records.forEach((rec: any) => {
      const rate = rec.data[`vendor${slotNum}Rate`];
      rates[rec.id] = rate && rate !== "-" ? String(rate) : "";
      const gst = rec.data[`vendor${slotNum}Gst`];
      gsts[rec.id] = gst && gst !== "-" ? String(gst) : "";
    });
    setManualRates(rates);
    setManualGst(gsts);
    setManualEditOpen(true);
  };

  const handleManualEditSave = async () => {
    if (!currentGroup || manualEditSlot === null) return;

    for (const rec of currentGroup.records) {
      if (!manualRates[rec.id]?.trim()) {
        toast.error(`Please fill in Rate for ${rec.data.itemName}.`);
        return;
      }
      if (!manualGst[rec.id]?.trim()) {
        toast.error(`Please select GST % for ${rec.data.itemName}.`);
        return;
      }
    }
    if (!manualDeliveryDate) {
      toast.error("Please select Expected Delivery Date.");
      return;
    }
    if (!manualTransportType) {
      toast.error("Please select Transport Type.");
      return;
    }

    setIsManualSubmitting(true);
    try {
      const slotKey = `vendor${manualEditSlot}`;
      let extendedFieldsMissing = false;

      await Promise.all(
        currentGroup.records.map(async (rec: any) => {
          const quotationId = rec._quotationIds?.[slotKey];
          if (!quotationId) {
            throw new Error(`No quotation record found for Vendor Slot ${manualEditSlot} on ${rec.data.indentNumber}.`);
          }

          const baseUpdate = {
            quoted_rate: parseFloat(manualRates[rec.id]) || 0,
            payment_terms: manualPaymentTerms,
            delivery_terms: manualDeliveryDate,
          };
          const { error } = await supabase
            .from("quotation_submissions")
            .update({
              ...baseUpdate,
              gst_percent: parseFloat(manualGst[rec.id]) || 0,
              transport_type: manualTransportType,
              remarks: manualRemarks || "",
            })
            .eq("id", quotationId);

          if (!error) return;
          if (!isMissingColumnError(error)) throw error;

          extendedFieldsMissing = true;
          const { error: fallbackError } = await supabase
            .from("quotation_submissions")
            .update(baseUpdate)
            .eq("id", quotationId);
          if (fallbackError) throw fallbackError;
        })
      );

      if (extendedFieldsMissing) {
        toast.warning("Rate/terms saved, but GST/Transport/Remarks couldn't be saved — run the pending database migration.");
      } else {
        toast.success(`Vendor Slot ${manualEditSlot} quotation saved.`);
      }
      setManualEditOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Manual quotation entry failed:", err);
      toast.error(err.message || "Failed to save manual quotation entry.");
    } finally {
      setIsManualSubmitting(false);
    }
  };

  const generatedLinks = useMemo(() => {
    if (!currentGroup || currentGroup.records.length === 0) return [];
    const idsParam = currentGroup.records.map((r: any) => r.id).join(",");
    const list = [];
    const firstRec = currentGroup.records[0];
    if (firstRec.data.vendor1Name && firstRec.data.vendor1Name !== "-") {
      list.push({
        name: firstRec.data.vendor1Name,
        link: `${window.location.origin}/quotation-form?ids=${idsParam}&v=1`,
      });
    }
    if (firstRec.data.vendor2Name && firstRec.data.vendor2Name !== "-") {
      list.push({
        name: firstRec.data.vendor2Name,
        link: `${window.location.origin}/quotation-form?ids=${idsParam}&v=2`,
      });
    }
    if (firstRec.data.vendor3Name && firstRec.data.vendor3Name !== "-") {
      list.push({
        name: firstRec.data.vendor3Name,
        link: `${window.location.origin}/quotation-form?ids=${idsParam}&v=3`,
      });
    }
    return list;
  }, [currentGroup]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard!");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 p-6 space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Approved Vendor</h2>
              <p className="text-slate-500 text-sm">Select the approved vendor from the submitted enquiries.</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4 w-full md:w-auto">

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent or Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger className="w-44 bg-white shrink-0">
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-slate-600 hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => window.location.reload()}
              className="h-10 w-10 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-slate-100/80 p-1 w-fit rounded-lg mb-4">
          <TabsTrigger value="pending" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
            Pending Approval ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
            History ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading Indents...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Actions
                    </TableHead>
                    {selectedColumns.includes("createdAtCol") && (
                      <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        Timestamp
                      </TableHead>
                    )}
                    {selectedColumns.includes("indentNumber") && (
                      <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        Indent IDs
                      </TableHead>
                    )}
                    {selectedColumns.includes("itemName") && (
                      <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        Items
                      </TableHead>
                    )}
                    {selectedColumns.includes("quantity") && (
                      <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        Qty
                      </TableHead>
                    )}
                    {selectedColumns.includes("actual3") && (
                      <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        Planned Date
                      </TableHead>
                    )}
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Vendor Options
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 2} className="h-32 text-center text-gray-500 font-medium">
                        No pending approved vendor decisions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingPagination.pageData.map((group) => {
                      const vendorOptions = computeVendorOptionsForGroup(group);
                      return (
                      <TableRow key={group.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                        <TableCell className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenForm(group)}
                            className="h-8 text-xs font-semibold px-3 border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          >
                            Approve
                          </Button>
                        </TableCell>
                        {selectedColumns.includes("createdAtCol") && (
                          <TableCell className="text-xs text-slate-700 px-4 font-mono">
                            {formatDateTimeFull(group.records[0]?.data?.actual3 || group.records[0]?.createdAt)}
                          </TableCell>
                        )}
                        {selectedColumns.includes("indentNumber") && (
                          <TableCell className="text-sm font-semibold text-slate-900 font-mono px-4">
                            {group.indentNumbers}
                          </TableCell>
                        )}
                        {selectedColumns.includes("itemName") && (
                          <TableCell className="text-sm text-slate-800 px-4 font-medium">
                            {group.itemNames}
                          </TableCell>
                        )}
                        {selectedColumns.includes("quantity") && (
                          <TableCell className="text-sm text-slate-750 px-4 font-semibold">
                            {group.records.map((r: any) => r.data.quantity).join(", ")}
                          </TableCell>
                        )}
                        {selectedColumns.includes("actual3") && (
                          <TableCell className="text-xs text-slate-700 px-4 font-mono">
                            {getPlannedDateForRecord(group.records[0]?.data, "Approved Vendor", tatRules, group.records[0]?.createdAt)}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-3">
                          {vendorOptions.length === 0 ? (
                            <span className="text-xs text-slate-400">No quotes submitted yet</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vendorOptions.map((v) => (
                                <Badge
                                  key={v.id}
                                  variant="secondary"
                                  className={`text-[10px] font-semibold ${v.totalValue !== null ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                                >
                                  {v.name}{v.totalValue !== null ? ` — ₹${v.totalValue.toLocaleString()}` : " (no rate)"}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </table>
              <PaginationBar
                page={pendingPagination.page}
                pageSize={pendingPagination.pageSize}
                totalCount={pendingPagination.totalCount}
                onPageChange={pendingPagination.setPage}
                onPageSizeChange={pendingPagination.setPageSize}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                      <TableHead key={col.key} className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Approval Date
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Approved Vendor
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Vendor Terms
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Rate Per Qty
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 4} className="h-32 text-center text-gray-500 font-medium">
                        No completed approved vendors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyPagination.pageData.map((record) => {
                    const selId = String(record.data.selectedVendor || "vendor1");
                    const idx = parseInt(selId.replace("vendor", ""), 10) || 1;

                    const vendorName = record.data[`vendor${idx}Name`] || record.data.selectedVendorName;
                    const vendorRate = record.data[`vendor${idx}Rate`];
                    const vendorTerms = record.data[`vendor${idx}Terms`];
                    const vendorDelivery = record.data[`vendor${idx}Delivery`];
                    const vendorTransportType = record.data[`vendor${idx}TransportType`];

                    return (
                      <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                        {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                          <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                            {col.key === "createdAtCol"
                              ? formatDateTimeFull(record.data.plan4 || record.createdAt)
                              : col.key === "actual3"
                              ? getPlannedDateForRecord(record.data, "Approved Vendor", tatRules, record.createdAt)
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm text-slate-700 px-4">
                          {formatDateDash(record.data.plan4)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 px-4 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-900">{vendorName || "-"}</span>
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0 px-1 font-bold">
                              {selId.toUpperCase()}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 px-4">
                          <div className="space-y-0.5">
                            <div><span className="text-slate-400">Terms:</span> {paymentTermsOptions.find((t) => t.value === vendorTerms)?.label || vendorTerms || "-"}</div>
                            <div><span className="text-slate-400">Delivery:</span> {vendorDelivery ? formatDateDash(vendorDelivery) : "-"}</div>
                            <div><span className="text-slate-400">Transport:</span> {vendorTransportType || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 px-4 font-semibold">
                          {vendorRate && vendorRate !== "-" ? `₹${vendorRate}` : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </table>
              <PaginationBar
                page={historyPagination.page}
                pageSize={historyPagination.pageSize}
                totalCount={historyPagination.totalCount}
                onPageChange={historyPagination.setPage}
                onPageSizeChange={historyPagination.setPageSize}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* APPROVED VENDOR SUBMIT MODAL */}
      <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); else setOpen(val); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0 border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-800">Approved Vendor Decision</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2 py-4 scrollbar-thin">
            {/* Group Context Information */}
            <div className="bg-slate-50 border rounded-xl p-4 text-sm space-y-2">
              <span className="font-bold text-xs text-slate-500 uppercase tracking-wider block border-b pb-2">
                Enquiry Details
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-medium text-xs">Indent IDs:</span>
                  <p className="font-bold text-slate-800 font-mono mt-0.5">{currentGroup?.indentNumbers}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium text-xs">Items:</span>
                  <p className="font-semibold text-slate-850 mt-0.5">{currentGroup?.itemNames}</p>
                </div>
              </div>
            </div>

            {/* RFQ Links Display */}
            {generatedLinks.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Details Dispatched! Quotation forms generated below:
                </div>
                <div className="space-y-2 pt-1">
                  {generatedLinks.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-white border border-emerald-100 rounded-lg text-xs">
                      <div className="font-semibold text-slate-800">
                        {item.name}:
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto font-mono text-[10px] bg-slate-50 p-1.5 rounded truncate text-slate-600">
                        <span className="truncate max-w-[200px] sm:max-w-xs">{item.link}</span>
                      </div>
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(item.link)}
                          className="h-8 text-slate-600 hover:text-slate-900 border bg-white"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy Link
                        </Button>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 px-3 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50/50 rounded-md hover:bg-blue-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor Comparison Layout */}
            <div className="space-y-3">
              <Label className="text-xs uppercase font-extrabold text-slate-500 tracking-wider block">
                Vendor Proposals Comparison
              </Label>
              <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full min-w-max text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-3 font-semibold text-slate-700 w-1/4 sticky left-0 bg-slate-100">Field / Item</th>
                      {groupVendorOptions.map((v) => (
                        <th key={v.id} className="p-3 font-semibold text-slate-700 text-center min-w-40 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <span>Vendor Slot {v.slotNum} ({v.name})</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openManualEdit(v.slotNum)}
                              className="h-6 px-2 text-[10px] font-semibold gap-1 bg-white"
                              title={v.totalValue === null ? "Not submitted — fill manually" : "Edit manually"}
                            >
                              <Pencil className="w-3 h-3" />
                              {v.totalValue === null ? "Fill Manually" : "Edit"}
                            </Button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Payment Terms Row */}
                    <tr className="border-b bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-600 sticky left-0 bg-slate-50 whitespace-nowrap">Payment Terms</td>
                      {groupVendorOptions.map((v) => (
                        <td key={v.id} className="p-3 text-slate-800 text-center">
                          {v.terms && v.terms !== "-" ? (paymentTermsOptions.find(opt => opt.value === v.terms)?.label || v.terms) : "—"}
                        </td>
                      ))}
                    </tr>

                    {/* Delivery Date Row */}
                    <tr className="border-b bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-600 sticky left-0 bg-slate-50 whitespace-nowrap">Expected Delivery</td>
                      {groupVendorOptions.map((v) => (
                        <td key={v.id} className="p-3 text-slate-800 text-center">
                          {v.delivery && v.delivery !== "-" ? formatDateDash(v.delivery) : "—"}
                        </td>
                      ))}
                    </tr>

                    {/* Rates per Item Rows */}
                    {currentGroup?.records.map((rec: any) => (
                      <tr key={rec.id} className="border-b">
                        <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                          <div className="font-mono text-[10px] text-slate-500">Indent: {rec.data.indentNumber}</div>
                          <div className="font-semibold text-slate-800">{rec.data.itemName}</div>
                          <div className="text-[10px] text-slate-500">Qty: {rec.data.quantity}</div>
                        </td>
                        {groupVendorOptions.map((v) => {
                          const rate = rec.data[`vendor${v.slotNum}Rate`];
                          return (
                            <td key={v.id} className="p-3 text-slate-900 font-semibold text-center">
                              {rate && rate !== "-" ? `₹${rate}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Total Value Row */}
                    <tr className="bg-emerald-50/30 font-bold border-t border-slate-350">
                      <td className="p-3 text-emerald-800 uppercase tracking-wider text-xs sticky left-0 bg-emerald-50 whitespace-nowrap">Total Estimate Value</td>
                      {groupVendorOptions.map((v) => (
                        <td key={v.id} className="p-3 text-emerald-900 text-center text-sm font-semibold">
                          {v.totalValue !== null ? `₹${v.totalValue.toLocaleString()}` : "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approved Vendor Select */}
            <div className="space-y-1.5 bg-green-50/50 p-4 border border-green-100 rounded-xl shadow-sm">
              <Label htmlFor="selVendor" className="text-green-800 font-bold text-xs uppercase tracking-wider block mb-1">Approved Vendor <span className="text-red-500">*</span></Label>
              <Select
                value={approvedVendor}
                onValueChange={(v) => setApprovedVendor(v)}
              >
                <SelectTrigger id="selVendor" className="bg-white border-green-250">
                  <SelectValue placeholder="Select approved vendor slot..." />
                </SelectTrigger>
                <SelectContent>
                  {groupVendorOptions.filter((v) => v.totalValue !== null).length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No vendor has submitted rates yet.</div>
                  ) : (
                    groupVendorOptions
                      .filter((v) => v.totalValue !== null)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          Vendor Slot {v.slotNum} ({v.name}) — Total: ₹{v.totalValue!.toLocaleString()}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Negotiation or general approval comments..."
                className="min-h-20"
              />
            </div>

            {submitError && (
              <p className="text-red-500 text-xs font-semibold">{submitError}</p>
            )}
          </form>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || groupVendorOptions.length === 0} className="bg-blue-700 text-white hover:bg-blue-800">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANUAL QUOTATION ENTRY — fill a vendor slot in on their behalf when
          they haven't submitted via their public link. */}
      <Dialog open={manualEditOpen} onOpenChange={setManualEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0 border-b pb-4">
            <DialogTitle className="text-lg font-bold text-slate-800">
              Manually Enter Quotation — Vendor Slot {manualEditSlot}
              {manualEditSlot && groupVendorOptions.find((v) => v.slotNum === manualEditSlot) && (
                <span className="text-slate-500 font-medium"> ({groupVendorOptions.find((v) => v.slotNum === manualEditSlot)?.name})</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 py-4 scrollbar-thin">
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Item-wise Rate & GST</Label>
              {currentGroup?.records.map((rec: any) => (
                <div key={rec.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-mono text-[10px] text-slate-500">Indent: {rec.data.indentNumber}</div>
                    <div className="font-semibold text-slate-800 text-sm">{rec.data.itemName}</div>
                    <div className="text-[10px] text-slate-500">Qty: {rec.data.quantity}</div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Rate (₹) *</Label>
                      <Input
                        type="number"
                        value={manualRates[rec.id] || ""}
                        onChange={(e) => setManualRates((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                        placeholder="Rate"
                        className="bg-white w-24 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GST (%) *</Label>
                      <Input
                        list={`manual-gst-options-${rec.id}`}
                        value={manualGst[rec.id] || ""}
                        onChange={(e) => setManualGst((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                        placeholder="e.g. 18"
                        className="bg-white w-20 h-9"
                      />
                      <datalist id={`manual-gst-options-${rec.id}`}>
                        {gstOptions.map((g) => (
                          <option key={g.value} value={g.value} label={g.label} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Terms *</Label>
                <Select value={manualPaymentTerms} onValueChange={setManualPaymentTerms}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTermsOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Delivery *</Label>
                <Input
                  type="date"
                  value={manualDeliveryDate}
                  onChange={(e) => setManualDeliveryDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transport Type *</Label>
                <Select value={manualTransportType} onValueChange={setManualTransportType}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportTypeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</Label>
              <Textarea
                value={manualRemarks}
                onChange={(e) => setManualRemarks(e.target.value)}
                placeholder="Any additional notes..."
                className="min-h-16 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setManualEditOpen(false)} disabled={isManualSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleManualEditSave} disabled={isManualSubmitting} className="bg-blue-700 text-white hover:bg-blue-800">
              {isManualSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
