"use client";

import React, { useState, useEffect } from "react";
// import { useWorkflow } from "@/lib/workflow-context";
import { StageTable } from "./stage-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  UserCheck,
  Upload,
  X,
  Loader2,
  Send,
  ClipboardList,
  History,
  Search,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatDate, parseSheetDate, getFmsTimestamp, formatDateTimeFull, calculatePlannedDate, getPlannedDateForRecord } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useMemo } from "react";

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

export default function Stage2() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    status: "",
    approvedQty: "",
    vendorType: "",
    remarks: "",
    attachment: null as File | null,
  });

  // State for per-line overrides in the bulk modal
  const [lineItemsData, setLineItemsData] = useState<Record<string, { approvedQty: string; status: string; vendorType: string }>>({});

  // Initialize lineItemsData when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const initial: Record<string, { approvedQty: string; status: string; vendorType: string }> = {};
      selectedRecords.forEach(id => {
        const item = sheetRecords.find(r => r.id === id);
        initial[id] = {
          approvedQty: item?.data.quantity || "",
          status: "approved",
          vendorType: "regular"
        };
      });
      setLineItemsData(initial);
    }
  }, [isModalOpen]);

  // const approvers = ["John Doe", "Jane Smith", "Bob Johnson"]; // Replaced by dynamic fetch


  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [tatRules, setTatRules] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { fetchIndentWorkflow } = await import("@/lib/supabase/queries");
      const { supabase } = await import("@/lib/supabase/client");
      const [rows, tatRes] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("master_tat_rules").select("*")
      ]);

      if (tatRes.data) setTatRules(tatRes.data);

      const stage2Rows = rows
        .map((r: any) => {
          const pendingQty = parseFloat(r.data.pendingApprovalQty || "0");
          const isRejected = (r.data.status || "").toLowerCase() === "rejected";
          let status = "pending";
          if (pendingQty <= 0 || isRejected) {
            status = "completed";
          }

          const indentQtyNum = parseFloat(String(r.data.indentQty || r.data.quantity || "0").replace(/,/g, "")) || 0;
          const approvedQtyNum = parseFloat(String(r.data.totalApprovedQty || r.data.approvedQty || "0").replace(/,/g, "")) || 0;
          const computedRejected = approvedQtyNum > 0 ? Math.max(0, indentQtyNum - approvedQtyNum) : (r.data.status?.toLowerCase() === "rejected" ? indentQtyNum : 0);

          return {
            id: r.data.indentNumber || r.id,
            rowIndex: r.originalIndex,
            stage: 2,
            status,
            createdAt: parseSheetDate(r.data.createdAt),
            history: [],
            data: {
              indentNumber: r.data.indentNumber,
              timestamp: r.data.createdAt,
              createdBy: r.data.createdBy,
              category: r.data.category,
              itemName: r.data.itemName,
              quantity: r.data.quantity,
              indentQty: String(indentQtyNum),
              totalApprovedQty: String(approvedQtyNum),
              rejectedQty: String(computedRejected),
              warehouseLocation: r.data.warehouseLocation,
              itemCode: r.data.itemCode,
              leadTime: r.data.leadTime,
              plannedDate: r.data.plan1,
              actualDate: r.data.actual1,
              delay: r.data.delay,
              status: r.data.status,
              approvedQty: r.data.approvedQty,
              vendorType: r.data.vendorType,
              remarks: r.data.remarks,
            },
          };
        })
        .filter((r: any) => r.status !== "not_ready");

      setSheetRecords(stage2Rows);
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.quantity?.toString().toLowerCase().includes(searchLower) ||
        r.data.vendorType?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const history = useMemo(() => sheetRecords
    .filter((r) => parseFloat(r.data.totalApprovedQty || r.data.approvedQty || "0") > 0 || r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.quantity?.toString().toLowerCase().includes(searchLower) ||
        r.data.vendorType?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const columns = [
    { key: "createdAtCol", label: "Timestamp" },
    { key: "indentNumber", label: "Indent" },
    { key: "createdBy", label: "Created By" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "indentQty", label: "Indent Qty" },
    { key: "totalApprovedQty", label: "Total Approved" },
    { key: "rejectedQty", label: "Rejected Qty" },
    { key: "warehouseLocation", label: "Warehouse" },
    { key: "itemCode", label: "Item Code" },
    { key: "leadTime", label: "Expected Requirement Date" },
    { key: "plannedDate", label: "Planned Date" },
    { key: "actualDate", label: "Actual" },
    { key: "delay", label: "Delay" },
    { key: "status", label: "Status" },
    { key: "remarks", label: "Remarks" },
  ] as const;

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map((c) => c.key)
  );

  const toggleRecord = (id: string) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedRecords.length === pending.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(pending.map((r) => r.id));
    }
  };

  const submitToSheet = async (recordsToSubmit: any[], approvalData: any) => {
    try {
      const { approveIndent, fetchIndentWorkflow } = await import("@/lib/supabase/queries");

      for (const record of recordsToSubmit) {
        const itemData = (approvalData as any).lineData?.[record.id];
        const finalQty = parseFloat(itemData?.approvedQty || approvalData.approvedQty || record.data.pendingApprovalQty || record.data.quantity) || 0;
        const pendingQty = parseFloat(record.data.pendingApprovalQty || record.data.quantity || "0") || 0;

        if (finalQty > pendingQty) {
          alert(`Approved quantity (${finalQty}) for Indent ${record.data.indentNumber} cannot exceed remaining pending quantity (${pendingQty}).`);
          return;
        }
      }

      let successCount = 0;

      for (const record of recordsToSubmit) {
        const itemData = (approvalData as any).lineData?.[record.id];
        const finalStatus = itemData?.status || approvalData.status || "approved";
        const finalQty = itemData?.approvedQty || approvalData.approvedQty || record.data.pendingApprovalQty || record.data.quantity;
        const finalVendorType = itemData?.vendorType || approvalData.vendorType || "regular";

        const allRows = await fetchIndentWorkflow();
        const matchingRow = allRows.find((r: any) => r.data.indentNumber === record.data.indentNumber);

        if (matchingRow) {
          await approveIndent(matchingRow.id, {
            approverUsername: localStorage.getItem("user") || "unknown",
            approvalStatus: finalStatus,
            approvedQty: parseInt(finalQty) || 0,
            vendorType: finalVendorType,
            remarks: approvalData.remarks || "",
          });
          successCount++;
        }
      }

      if (successCount > 0) {
        fetchData();
      }
    } catch (e) {
      console.error("Error submitting Stage 2 data:", e);
      alert("Submission failed. Check console.");
    }
  };

  const updateLineItem = (id: string, field: string, value: string) => {
    setLineItemsData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleBulkApprove = async () => {
    const recordsToProcess = selectedRecords
      .map((id) => sheetRecords.find((r) => r.id === id))
      .filter((r) => r !== undefined);

    if (recordsToProcess.length === 0) return;

    setIsSubmitting(true);
    await submitToSheet(recordsToProcess, { ...approvalForm, lineData: lineItemsData });
    setIsSubmitting(false);

    setSelectedRecords([]);
    setApprovalForm({
      status: "",
      approvedQty: "",
      vendorType: "",
      remarks: "",
      attachment: null,
    });
    setIsModalOpen(false);
    setLineItemsData({});
  };

  const selectedItems = pending.filter((r) =>
    selectedRecords.includes(r.id)
  );

  const isFormValid = true; // No required fields in global footer now

  /* --------------------------------------------------------------------- */
  /* -------------------------- Column Selector -------------------------- */
  /* --------------------------------------------------------------------- */
  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start">
          {selectedColumns.length === columns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length !== 1 ? "s" : ""
            } selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === columns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(columns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>

          {columns.map((col) => (
            <div
              key={col.key}
              className="flex items-center space-x-2 py-1"
            >
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

  /* --------------------------------------------------------------------- */
  /* ------------------------------ Render ------------------------------- */
  /* --------------------------------------------------------------------- */
  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Indent Approval</h2>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent No, Item Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-slate-600 hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 shrink-0">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full md:max-w-md">
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
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {selectedRecords.length > 0 && activeTab === "pending" && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-3 px-6 h-[60px] rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span className="text-base font-semibold">Submit Approval ({selectedRecords.length})</span>
            </Button>
          )}
        </div>

        {/* ---------- PENDING ---------- */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
              <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm">
                  <TableRow className="bg-slate-200 hover:bg-slate-200">
                    <TableHead className="w-12 sticky top-0 z-20 bg-slate-200 shadow-sm border-none">
                      <Checkbox
                        checked={
                          pending.length > 0 &&
                          selectedRecords.length === pending.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    {columns
                      .filter((c) => selectedColumns.includes(c.key) &&
                        !["actualDate", "delay", "status", "remarks", "approvedQty"].includes(c.key))
                      .map((col) => (
                        <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">
                          <div className="flex items-center gap-2">
                            {col.label}
                          </div>
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 1} className="h-32 text-center text-gray-500 font-medium">
                        No pending indents found for approval.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map((record) => {
                      const isSelected = selectedRecords.includes(record.id);
                      return (
                        <TableRow
                          key={record.id}
                          className={cn(
                            "cursor-pointer transition-colors duration-150",
                            isSelected ? "bg-slate-50" : "hover:bg-slate-50/50"
                          )}
                          onClick={() => toggleRecord(record.id)}
                        >
                          <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRecord(record.id)}
                            />
                          </TableCell>
                          {columns
                            .filter((c) => selectedColumns.includes(c.key) &&
                              !["actualDate", "delay", "status", "remarks", "approvedQty"].includes(c.key))
                            .map((col) => (
                              <TableCell key={String(col.key)} className="font-mono text-xs">
                                {(col.key as string) === "createdAtCol"
                                   ? formatDateTimeFull(record.createdAt)
                                   : (col.key as string) === "plannedDate"
                                   ? getPlannedDateForRecord(record.data, "Indent Approval", tatRules, record.createdAt)
                                   : (col.key as string) === "indentDate"
                                   ? formatDateDash((record.data as any)[col.key])
                                   : (col.key as string) === "leadTime"
                                   ? `${(record.data as any)[col.key] || 0} days`
                                   : (record.data as any)[col.key] || "-"}
                              </TableCell>
                            ))}
                        </TableRow>
                      );
                    })
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
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative h-full">
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="bg-slate-200 sticky top-0 z-30 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    <TableHead className="w-12 text-center text-sm font-bold text-slate-400 sticky top-0 z-20 bg-slate-200 border-none">#</TableHead>
                    {columns
                      .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
                      .map((col) => (
                        <TableHead key={col.key} className="sticky top-0 z-20 bg-slate-200 border-none">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {col.label}
                          </div>
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 1} className="h-32 text-center text-gray-500 font-medium">
                        No completed approval records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((record, index) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-center font-medium text-slate-500 text-sm">
                          {index + 1}
                        </TableCell>
                        {columns
                          .filter((c) => selectedColumns.includes(c.key) && c.key !== "delay")
                          .map((col) => (
                            <TableCell key={col.key} className="text-sm text-slate-700">
                              {(col.key as string) === "createdAtCol"
                                ? formatDateTimeFull(record.data.actualDate || record.createdAt)
                                : (col.key as string) === "plannedDate"
                                ? getPlannedDateForRecord(record.data, "Indent Approval", tatRules, record.createdAt)
                                : col.key === "leadTime"
                                ? `${record.data[col.key] || 0} days`
                                : col.key === "actualDate"
                                  ? formatDateDash(record.data[col.key])
                                  : record.data[col.key] || "-"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------- APPROVAL MODAL ------------------- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] w-full p-0 overflow-hidden border-none shadow-2xl border-2 border-green-500">
          <div className="bg-blue-700 px-6 py-4 flex items-center justify-between ">
            <div className="flex items-center gap-3 ">
              <div className="p-2 bg-white/10 rounded-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold leading-none">
                  Bulk Approval
                </DialogTitle>
                <p className="text-slate-400 text-xs mt-1">
                  Processing {selectedRecords.length} selected indent{selectedRecords.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 px-3 py-1">
              Final Review
            </Badge>
          </div>

          <div className="p-6 space-y-8 bg-slate-50/30">
            {/* Selected items summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Active Items</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {selectedItems.length} records to update
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5">
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Indent ID</TableHead>
                        <TableHead className="min-w-40 h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Item Description</TableHead>
                        <TableHead className="w-20 h-10 px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Indent Qty</TableHead>
                        <TableHead className="w-20 h-10 px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Prev. Approved</TableHead>
                        <TableHead className="w-[100px] h-10 px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Approve Qty</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Vendor Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="transition-all border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/80 hover:bg-slate-100/30"
                        >
                          <TableCell className="py-3 px-4 font-mono text-xs font-bold text-slate-900">{item.data.indentNumber}</TableCell>
                          <TableCell className="py-3 px-4 text-slate-600 text-xs font-medium">{item.data.itemName}</TableCell>
                          <TableCell className="py-3 px-3 text-center text-xs font-bold text-slate-800">{item.data.indentQty || item.data.quantity}</TableCell>
                          <TableCell className="py-3 px-3 text-center text-xs font-bold text-emerald-700">{item.data.totalApprovedQty || "0"}</TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center text-xs font-extrabold border-slate-300 focus:ring-slate-900"
                                value={lineItemsData[item.id]?.approvedQty || ""}
                                onChange={(e) => setLineItemsData(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], approvedQty: e.target.value }
                                }))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "approved")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                  lineItemsData[item.id]?.status === "approved"
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLineItem(item.id, "status", "rejected")}
                                className={cn(
                                  "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                  lineItemsData[item.id]?.status === "rejected"
                                    ? "bg-white text-rose-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Reject
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <Select
                              value={lineItemsData[item.id]?.vendorType || ""}
                              onValueChange={(v) => setLineItemsData(prev => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], vendorType: v }
                              }))}
                            >
                              <SelectTrigger className="h-8 w-28 text-[10px] font-bold border-slate-200 shadow-sm capitalize bg-white text-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular" className="text-[10px] font-bold">Regular Vendor</SelectItem>
                                <SelectItem value="new vendor" className="text-[10px] font-bold">New Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBulkApprove();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Final Remarks {approvalForm.status === "rejected" && <span className="text-rose-500">*</span>}
                    </Label>
                    <Textarea
                      placeholder="Enter detailed approval/rejection notes..."
                      className="bg-white border-slate-200 shadow-sm resize-none min-h-[90px] focus:ring-slate-900"
                      value={approvalForm.remarks}
                      onChange={(e) => setApprovalForm((p) => ({ ...p, remarks: e.target.value }))}
                      required={approvalForm.status === "rejected"}
                    />
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-6 h-11 font-bold text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100 hover:bg-white transition-all rounded-lg"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedRecords([]);
                  }}
                >
                  Discard Changes
                </Button>

                <Button
                  type="submit"
                  className={`px-10 h-11 rounded-lg font-bold shadow-xl transition-all active:scale-[0.98] ${approvalForm.status === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200/50"
                    : "bg-blue-700 hover:bg-blue-800 shadow-slate-200/50"
                    }`}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Request...
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {approvalForm.status === "rejected" ? <XCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span>{approvalForm.status === "rejected" ? "Reject Selection" : "Complete Approval"}</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}