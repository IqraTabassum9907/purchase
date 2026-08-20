"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { UserCog, Loader2, Search, Send, X, UserPlus, ClipboardList, History, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { cn, parseSheetDate, getErrorMessage, reportPendingCount } from "@/lib/utils";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { AttachmentCell } from "@/components/ui/attachment-cell";

interface ApproverOption {
  username: string;
  fullName: string;
}

interface DelegationEntry {
  id: string;
  username: string;
  name: string;
}

export default function DelegateApproval() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [delegationsByIndent, setDelegationsByIndent] = useState<Record<string, DelegationEntry[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [approverOptions, setApproverOptions] = useState<ApproverOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [selectedApprover, setSelectedApprover] = useState<string>("");

  // Per-row / bulk "Action" form — delegate indents via dialog.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRecords, setDialogRecords] = useState<any[]>([]);
  const [dialogApprover, setDialogApprover] = useState<string>("");
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { fetchIndentWorkflow, fetchIndentDelegations } = await import("@/lib/supabase/queries");
      const [rows, delegations] = await Promise.all([
        fetchIndentWorkflow(),
        fetchIndentDelegations(),
      ]);

      const delegationMap: Record<string, DelegationEntry[]> = {};
      delegations.forEach((d) => {
        if (!delegationMap[d.indentId]) delegationMap[d.indentId] = [];
        delegationMap[d.indentId].push({ id: d.id, username: d.approverUsername, name: d.approverName });
      });
      setDelegationsByIndent(delegationMap);

      const mapped = rows.map((r: any) => ({
        id: r.id, // raw indents.id — this is the FK indent_delegations.indent_id points at
        indentNumber: r.data.indentNumber,
        createdAt: parseSheetDate(r.data.createdAt),
        createdBy: r.data.createdBy,
        category: r.data.category,
        itemName: r.data.itemName,
        quantity: r.data.quantity,
        uom: r.data.uom,
        warehouseLocation: r.data.warehouseLocation,
        itemCode: r.data.itemCode,
        attachment: r.data.attachment || "",
      }));

      setSheetRecords(mapped);
    } catch (e) {
      console.error("Fetch error Delegate Approval:", getErrorMessage(e));
      toast.error(`Failed to load pending indents: ${getErrorMessage(e)}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Fetch approvers from master_approvers
    supabase
      .from("master_approvers")
      .select("id, name, is_active")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Error loading master_approvers:", error);
        if (!error && data) {
          setApproverOptions(
            data
              .filter((a: any) => a.is_active !== false && a.name)
              .map((a: any) => ({ username: a.name, fullName: a.name }))
          );
        }
      });

    // Fetch warehouse locations for division filter
    supabase
      .from("master_warehouses")
      .select("name")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          setWarehouseOptions(data.map((w: any) => w.name).filter(Boolean));
        }
      });
  }, []);

  const pendingList = useMemo(() => {
    return sheetRecords
      .filter((r) => divisionFilter === "all" || r.warehouseLocation === divisionFilter)
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        if (!searchLower) return true;
        return (
          r.indentNumber?.toLowerCase().includes(searchLower) ||
          r.itemName?.toLowerCase().includes(searchLower) ||
          r.createdBy?.toLowerCase().includes(searchLower)
        );
      })
      .filter((r) => (delegationsByIndent[r.id] || []).length === 0);
  }, [sheetRecords, searchTerm, divisionFilter, delegationsByIndent]);

  const historyList = useMemo(() => {
    return sheetRecords
      .filter((r) => divisionFilter === "all" || r.warehouseLocation === divisionFilter)
      .filter((r) => {
        const searchLower = searchTerm.toLowerCase();
        if (!searchLower) return true;
        return (
          r.indentNumber?.toLowerCase().includes(searchLower) ||
          r.itemName?.toLowerCase().includes(searchLower) ||
          r.createdBy?.toLowerCase().includes(searchLower)
        );
      })
      .filter((r) => (delegationsByIndent[r.id] || []).length > 0);
  }, [sheetRecords, searchTerm, divisionFilter, delegationsByIndent]);

  useEffect(() => {
    reportPendingCount("Delegate for Approval", pendingList.length);
  }, [pendingList.length]);

  const pendingPagination = usePagination(pendingList, 15);
  const historyPagination = usePagination(historyList, 15);

  const toggleRecord = (id: string) => {
    setSelectedRecords((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedRecords.length === pendingList.length) setSelectedRecords([]);
    else setSelectedRecords(pendingList.map((r) => r.id));
  };

  const handleDelegate = async () => {
    if (selectedRecords.length === 0 || !selectedApprover) return;
    setIsSubmitting(true);
    try {
      const { delegateIndents } = await import("@/lib/supabase/queries");
      const targetApprover = approverOptions.find((a) => a.username === selectedApprover);
      if (!targetApprover) return;
      const delegatedBy = localStorage.getItem("user") || "unknown";
      await delegateIndents(selectedRecords, [targetApprover], delegatedBy);
      toast.success(`Delegated ${selectedRecords.length} item(s) to ${targetApprover.fullName}.`);
      setSelectedRecords([]);
      setSelectedApprover("");
      fetchData();
    } catch (e) {
      console.error("Delegation failed:", e);
      toast.error(`Failed to delegate: ${getErrorMessage(e)}`);
    }
    setIsSubmitting(false);
  };

  const handleRemoveDelegation = async (delegationId: string) => {
    try {
      const { removeIndentDelegation } = await import("@/lib/supabase/queries");
      await removeIndentDelegation(delegationId);
      fetchData();
    } catch (e) {
      toast.error(`Failed to remove delegation: ${getErrorMessage(e)}`);
    }
  };

  const openDelegateDialog = (record: any) => {
    setDialogRecords([record]);
    const existing = delegationsByIndent[record.id] || [];
    setDialogApprover(existing[0]?.username || selectedApprover || "");
    setDialogOpen(true);
  };

  const openBulkDelegateDialog = () => {
    if (selectedRecords.length === 0) {
      toast.error("Please select at least one indent.");
      return;
    }
    const selected = sheetRecords.filter((r) => selectedRecords.includes(r.id));
    setDialogRecords(selected);
    setDialogApprover(selectedApprover || "");
    setDialogOpen(true);
  };

  const handleDialogSave = async () => {
    if (dialogRecords.length === 0 || !dialogApprover) {
      toast.error("Please select an approver.");
      return;
    }
    setIsDialogSubmitting(true);
    try {
      const { delegateIndents } = await import("@/lib/supabase/queries");
      const targetApprover = approverOptions.find((a) => a.username === dialogApprover);
      if (!targetApprover) return;
      const delegatedBy = localStorage.getItem("user") || "unknown";
      const ids = dialogRecords.map((r) => r.id);
      await delegateIndents(ids, [targetApprover], delegatedBy);

      if (ids.length === 1) {
        toast.success(`Delegated ${dialogRecords[0].indentNumber} to ${targetApprover.fullName}.`);
      } else {
        toast.success(`Successfully delegated ${ids.length} indents to ${targetApprover.fullName}.`);
      }
      setDialogOpen(false);
      setDialogRecords([]);
      setDialogApprover("");
      setSelectedRecords([]);
      fetchData();
    } catch (e) {
      console.error("Delegation failed:", e);
      toast.error(`Failed to delegate: ${getErrorMessage(e)}`);
    }
    setIsDialogSubmitting(false);
  };

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <UserCog className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Delegate for Approval</h2>
              <p className="text-slate-500 text-sm">Assign pending indents to one or more approvers before Indent Approval.</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-end gap-3 w-full md:w-auto">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent No, Item, Created By..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-white">
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as any);
          setSelectedRecords([]);
        }}
        className="w-full flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full md:max-w-md mb-4 shrink-0">
          <TabsTrigger
            value="pending"
            className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            <div className="flex flex-col items-start leading-none gap-1">
              <span className="font-bold">Pending</span>
              <span className="text-[10px] opacity-70">Not yet delegated</span>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
              {pendingList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
          >
            <History className="w-5 h-5" />
            <div className="flex flex-col items-start leading-none gap-1">
              <span className="font-bold">History</span>
              <span className="text-[10px] opacity-70">Delegated</span>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
              {historyList.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ---------- PENDING ---------- */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4 shrink-0">
            <Select value={selectedApprover} onValueChange={setSelectedApprover}>
              <SelectTrigger className="w-full sm:w-64 bg-white">
                <SelectValue placeholder="Select approver..." />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs shadow-md z-50">
                {approverOptions.length === 0 && (
                  <SelectItem value="_none" disabled>No approvers found</SelectItem>
                )}
                {approverOptions.map((a) => (
                  <SelectItem key={a.username} value={a.username}>
                    {a.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              onClick={openBulkDelegateDialog}
              disabled={selectedRecords.length === 0 || isSubmitting}
              className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Delegate Selected ({selectedRecords.length})
            </Button>
          </div>

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
                        checked={pendingList.length > 0 && selectedRecords.length === pendingList.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Action</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Indent</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Created By</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Category</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Item</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Qty</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">UOM</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Division</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Attachment</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Delegated To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-gray-500 font-medium">
                        No pending indents to delegate.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingPagination.pageData.map((record) => {
                      const isSelected = selectedRecords.includes(record.id);
                      const delegations = delegationsByIndent[record.id] || [];
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
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleRecord(record.id)} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs font-semibold"
                              onClick={() => openDelegateDialog(record)}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              Delegate
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">{record.indentNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{record.createdBy || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.category || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.itemName || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.quantity || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.uom || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.warehouseLocation || "-"}</TableCell>
                          <TableCell className="font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                            <AttachmentCell url={record.attachment} />
                          </TableCell>
                          <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                            {delegations.length === 0 ? (
                              <span className="text-slate-400">Not delegated</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {delegations.map((d) => (
                                  <Badge
                                    key={d.id}
                                    variant="secondary"
                                    className="bg-sky-100 text-sky-800 border-sky-200 flex items-center gap-1 pr-1"
                                  >
                                    {d.name}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDelegation(d.id)}
                                      className="hover:text-red-600"
                                      title="Remove"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
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

        {/* ---------- HISTORY ---------- */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
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
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Indent</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Created By</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Category</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Item</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Qty</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">UOM</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Division</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Attachment</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-slate-200 shadow-sm border-none">Delegated To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-gray-500 font-medium">
                        No indents have been delegated yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyPagination.pageData.map((record) => {
                      const delegations = delegationsByIndent[record.id] || [];
                      return (
                        <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono text-xs font-bold">{record.indentNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{record.createdBy || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.category || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.itemName || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.quantity || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.uom || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{record.warehouseLocation || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <AttachmentCell url={record.attachment} />
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-wrap gap-1">
                              {delegations.map((d) => (
                                <Badge
                                  key={d.id}
                                  variant="secondary"
                                  className="bg-emerald-100 text-emerald-800 border-emerald-200 px-2 py-0.5 font-medium"
                                >
                                  {d.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
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

      {/* ------------------- DELEGATE FORM DIALOG ------------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delegate for Approval</DialogTitle>
            <p className="text-sm text-slate-500 font-medium">
              {dialogRecords.length === 1
                ? `${dialogRecords[0].indentNumber} — ${dialogRecords[0].itemName}`
                : dialogRecords.length > 1
                ? `${dialogRecords.length} Indents Selected (${dialogRecords.map((r) => r.indentNumber).join(", ")})`
                : ""}
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">Select Approver <span className="text-red-500">*</span></Label>
            <Select value={dialogApprover} onValueChange={setDialogApprover}>
              <SelectTrigger className="w-full bg-white border-slate-200">
                <SelectValue placeholder="Choose single approver..." />
              </SelectTrigger>
              <SelectContent className="bg-white border text-xs shadow-md z-50">
                {approverOptions.map((a) => (
                  <SelectItem key={a.username} value={a.username}>
                    {a.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDialogSave}
              disabled={!dialogApprover || isDialogSubmitting}
              className="bg-blue-700 hover:bg-blue-800 text-white"
            >
              {isDialogSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Delegate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
