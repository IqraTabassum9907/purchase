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
import { Loader2, Search, CheckCircle2, ShieldCheck, Copy, ExternalLink, CheckCircle, RefreshCw } from "lucide-react";
import { formatDate, getPlannedDateForRecord, formatDateTimeFull } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow, selectApprovedVendor } from "@/lib/supabase/queries";

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

      if (!dropErr && dropRows) {
        setApproverList(dropRows.map((r) => r.name).filter(Boolean));
      }

      const { data: tatRows } = await supabase.from("master_tat_rules").select("*");
      if (tatRows) setTatRules(tatRows);
    } catch (e) {
      console.error("Fetch error Stage 4:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pending = useMemo(() => {
    const pendingRecs = sheetRecords.filter((r) => r.status === "pending");

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
  }, [sheetRecords, searchTerm]);

  const completed = useMemo(() => sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

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

  const groupVendorOptions = useMemo(() => {
    if (!currentGroup || currentGroup.records.length === 0) return [];
    const firstRec = currentGroup.records[0];
    const list = [];
    for (const num of [1, 2, 3]) {
      const name = firstRec.data[`vendor${num}Name`];
      if (name && name !== "-") {
        const terms = firstRec.data[`vendor${num}Terms`];
        const delivery = firstRec.data[`vendor${num}Delivery`];

        let totalValue = 0;
        let hasRates = false;
        currentGroup.records.forEach((rec: any) => {
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
          totalValue: hasRates ? totalValue : null,
        });
      }
    }
    return list;
  }, [currentGroup]);

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 1} className="h-32 text-center text-gray-500 font-medium">
                        No pending approved vendor decisions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map((group) => (
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
                            {formatDateTimeFull(group.records[0]?.createdAt)}
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
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
                      Rate Per Qty
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 3} className="h-32 text-center text-gray-500 font-medium">
                        No completed approved vendors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    completed.map((record) => {
                    const selId = String(record.data.selectedVendor || "vendor1");
                    const idx = parseInt(selId.replace("vendor", ""), 10) || 1;

                    const vendorName = record.data[`vendor${idx}Name`] || record.data.selectedVendorName;
                    const vendorRate = record.data[`vendor${idx}Rate`];

                    return (
                      <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                        {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                          <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                            {col.key === "createdAtCol"
                              ? formatDateTimeFull(record.createdAt)
                              : col.key === "actual3"
                              ? getPlannedDateForRecord(record.data, "Approved Vendor", tatRules, record.createdAt)
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm text-slate-700 px-4">
                          {formatDateDash(record.data.planned4)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 px-4 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-900">{vendorName || "-"}</span>
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0 px-1 font-bold">
                              {selId.toUpperCase()}
                            </Badge>
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
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-3 font-semibold text-slate-700 w-1/4">Field / Item</th>
                      {groupVendorOptions.map((v) => (
                        <th key={v.id} className="p-3 font-semibold text-slate-700 text-center">
                          Vendor Slot {v.slotNum} ({v.name})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Payment Terms Row */}
                    <tr className="border-b bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-600">Payment Terms</td>
                      {groupVendorOptions.map((v) => (
                        <td key={v.id} className="p-3 text-slate-800 text-center">
                          {v.terms && v.terms !== "-" ? (paymentTermsOptions.find(opt => opt.value === v.terms)?.label || v.terms) : "—"}
                        </td>
                      ))}
                    </tr>

                    {/* Delivery Date Row */}
                    <tr className="border-b bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-600">Expected Delivery</td>
                      {groupVendorOptions.map((v) => (
                        <td key={v.id} className="p-3 text-slate-800 text-center">
                          {v.delivery && v.delivery !== "-" ? formatDateDash(v.delivery) : "—"}
                        </td>
                      ))}
                    </tr>

                    {/* Rates per Item Rows */}
                    {currentGroup?.records.map((rec: any) => (
                      <tr key={rec.id} className="border-b">
                        <td className="p-3 font-medium text-slate-700">
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
                      <td className="p-3 text-emerald-800 uppercase tracking-wider text-xs">Total Estimate Value</td>
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
                  {groupVendorOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      Vendor Slot {v.slotNum} ({v.name}) {v.totalValue !== null ? `— Total: ₹${v.totalValue.toLocaleString()}` : ""}
                    </SelectItem>
                  ))}
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
    </div>
  );
}
