"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Truck, Download } from "lucide-react";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getFmsTimestamp, formatDateTimeFull, calculatePlannedDate, getPlannedDateForRecord, reportPendingCount } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

const formatDateDash = (date: any) => {
    if (!date || date === "-" || date === "—") return "-";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${dd}-${mm}-${yyyy}`;
    } catch (e) {
        return typeof date === 'string' ? date : "-";
    }
};

export default function TransporterFollowUp() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [open, setOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        status: "",
        remarks: "",
        expectedDate: "",
        expectedDelivery: "",
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    // Selection State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // Bulk State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

    // -----------------------------------------------------------------
    // FETCH DATA
    // -----------------------------------------------------------------
    const [tatRules, setTatRules] = useState<any[]>([]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [indentRows, poResult, liftingResult, transporterResult, tatResult] = await Promise.all([
                fetchIndentWorkflow(),
                supabase.from("purchase_orders").select("*").order("created_at", { ascending: true }),
                supabase.from("vendor_liftings").select("*"),
                supabase.from("transporter_followups").select("*"),
                supabase.from("master_tat_rules").select("*"),
            ]);

            if (tatResult.data) setTatRules(tatResult.data);

            const poData = poResult.data || [];
            const liftingData = liftingResult.data || [];
            const transporterData = transporterResult.data || [];

            const posByIndent = new Map<string, any[]>();
            poData.forEach((po: any) => {
                if (po.indent_id) {
                    const list = posByIndent.get(po.indent_id) || [];
                    list.push(po);
                    posByIndent.set(po.indent_id, list);
                }
            });

            const liftingsByPo = new Map<string, any[]>();
            liftingData.forEach((lift: any) => {
                if (lift.po_id) {
                    const list = liftingsByPo.get(lift.po_id) || [];
                    list.push(lift);
                    liftingsByPo.set(lift.po_id, list);
                }
            });

            const transportersByPo = new Map<string, any[]>();
            const transportersByLifting = new Map<string, any[]>();
            transporterData.forEach((tf: any) => {
                if (tf.po_id) {
                    const list = transportersByPo.get(tf.po_id) || [];
                    list.push(tf);
                    transportersByPo.set(tf.po_id, list);
                }
                if (tf.lifting_id) {
                    const list = transportersByLifting.get(tf.lifting_id) || [];
                    list.push(tf);
                    transportersByLifting.set(tf.lifting_id, list);
                }
            });

            const pickLatestTransporter = (candidates: any[]) =>
                candidates.length > 0
                    ? [...candidates].sort((a: any, b: any) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0]
                    : null;

            const rows: any[] = [];

            for (const indentRow of indentRows) {
                const indentPOs = posByIndent.get(indentRow.id) || [];
                for (const po of indentPOs) {
                    const poLiftings = liftingsByPo.get(po.id) || [];
                    const poTransporters = transportersByPo.get(po.id) || [];

                const latestTransporter = poTransporters.length > 0
                    ? [...poTransporters].sort((a: any, b: any) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime())[0]
                    : null;

                const totalIntransit = poTransporters.filter((t: any) => t.status === "Intransit").length;

                const actualDispatchedLiftings = poLiftings.filter((l: any) =>
                    !!l.actual_lifting_date && String(l.actual_lifting_date).trim() !== "" && String(l.actual_lifting_date).trim() !== "-"
                );

                if (actualDispatchedLiftings.length === 0) {
                    // Follow Up / Lifting hasn't logged anything for this PO yet
                    // (no vendor_liftings row and no transporter_followups row) —
                    // don't surface it here until Follow Up actually processes it.
                    if (poLiftings.length === 0 && poTransporters.length === 0) {
                        continue;
                    }

                    const isDeliveredOrReceived = (latestTransporter && ["received", "delivered", "completed", "complete"].includes(String(latestTransporter.status || "").toLowerCase()));
                    const status = isDeliveredOrReceived ? "history" : "pending";

                    rows.push({
                        id: `${indentRow.data.indentNumber}_${po.po_number}`,
                        _poId: po.id,
                        _liftingId: null,
                        createdAt: indentRow.data.createdAt,
                        status,
                        data: {
                            indentNumber: indentRow.data.indentNumber,
                            liftNo: po.po_number,
                            vendorName: po.vendor_name || indentRow.data.selectedVendorName || indentRow.data.vendor1Name || "-",
                            poNumber: po.po_number,
                            invoiceNumber: "",
                            itemName: indentRow.data.itemName,
                            liftingQty: String(po.quantity || indentRow.data.quantity || ""),
                            transporterName: latestTransporter?.transporter_name || "",
                            vehicleNo: latestTransporter?.vehicle_number || "",
                            contactNo: "",
                            freightAmt: "",
                            plannedDate: po.delivery_date || "",
                            actualDate: latestTransporter?.status === "Received" ? latestTransporter.dispatch_date || "" : "",
                            expectedDate: latestTransporter?.expected_arrival_date || "",
                            remarks: "",
                            totalFollowUps: totalIntransit,
                            lrNo: latestTransporter?.bilty_number || "",
                            lrCopy: latestTransporter?.bilty_copy_url || "",
                        }
                    });
                } else {
                    // Legacy transporter_followups rows predate the lifting_id column and only
                    // carry po_id — keep them as a shared fallback for POs whose dispatches
                    // haven't been touched since the migration.
                    const legacyPoTransporters = poTransporters.filter((t: any) => !t.lifting_id);

                    for (const lifting of actualDispatchedLiftings) {
                        const liftTrackingNo = String(lifting.id).substring(0, 8);
                        const liftingTransporters = transportersByLifting.get(lifting.id) || [];
                        const latestLiftingTransporter = pickLatestTransporter(
                            liftingTransporters.length > 0 ? liftingTransporters : legacyPoTransporters
                        );
                        const liftingIntransitCount = liftingTransporters.filter((t: any) => t.status === "Intransit").length;

                        // NOTE: vendor_liftings.lifting_status "Complete" only means the material
                        // was lifted/dispatched from the vendor — it has nothing to do with the
                        // transporter having delivered it. Delivery state comes only from this
                        // dispatch's own transporter_followups.status (Intransit/Received).
                        const isDeliveredOrReceived = !!latestLiftingTransporter &&
                            ["received", "delivered", "completed", "complete"].includes(String(latestLiftingTransporter.status || "").toLowerCase());

                        const status = isDeliveredOrReceived ? "history" : "pending";

                        rows.push({
                            id: `${indentRow.data.indentNumber}_${liftTrackingNo}`,
                            _poId: po.id,
                            _liftingId: lifting.id,
                            createdAt: indentRow.data.createdAt,
                            status,
                            data: {
                                indentNumber: indentRow.data.indentNumber,
                                liftNo: liftTrackingNo,
                                vendorName: po.vendor_name || indentRow.data.selectedVendorName || indentRow.data.vendor1Name || "-",
                                poNumber: po.po_number,
                                invoiceNumber: "",
                                itemName: indentRow.data.itemName,
                                liftingQty: String(lifting.quantity || po.quantity || indentRow.data.quantity || ""),
                                transporterName: latestLiftingTransporter?.transporter_name || lifting.contact_person || "",
                                vehicleNo: lifting.vehicle_number || latestLiftingTransporter?.vehicle_number || "",
                                contactNo: lifting.driver_contact || "",
                                freightAmt: "",
                                plannedDate: lifting.expected_lifting_date || po.delivery_date || "",
                                actualDate: lifting.actual_lifting_date || "",
                                expectedDate: lifting.followup_date || "",
                                remarks: lifting.remarks || "",
                                totalFollowUps: liftingIntransitCount,
                                lrNo: latestLiftingTransporter?.bilty_number || "",
                                lrCopy: latestLiftingTransporter?.bilty_copy_url || "",
                            }
                        });
                    }
                }
            }
        }

            setRecords(rows);
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // -----------------------------------------------------------------
    // COLUMNS & SORTING
    // -----------------------------------------------------------------
    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const sortedPending = React.useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        const pendingItems = records
            .filter(r => r.status === "pending")
            .filter((r) => {
                return (
                    r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                    r.data.itemName?.toLowerCase().includes(searchLower) ||
                    r.data.vendorName?.toLowerCase().includes(searchLower) ||
                    r.data.transporterName?.toLowerCase().includes(searchLower) ||
                    String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                    String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
                );
            });

        if (!sortConfig) return pendingItems;

        return [...pendingItems].sort((a, b) => {
            const aValue = a.data[sortConfig.key] || "";
            const bValue = b.data[sortConfig.key] || "";

            // Date sorting for Expected Date
            if (sortConfig.key === "expectedDate") {
                const dateA = new Date(aValue).getTime() || 0;
                const dateB = new Date(bValue).getTime() || 0;
                if (dateA < dateB) return sortConfig.direction === "asc" ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            }

            // General string/number sorting
            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [records, sortConfig, searchTerm]);

    const completed = React.useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        return records.filter(r => {
            if (r.status !== "history") return false;
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                r.data.transporterName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        });
    }, [records, searchTerm]);
    const pending = sortedPending; // Use sorted list for display

    React.useEffect(() => { reportPendingCount("Transporter Follow-Up", pending.length); }, [pending.length]);

    const pendingPagination = usePagination(pending, 15);
    const historyPagination = usePagination(completed, 15);

    const pendingColumns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "itemName", label: "Item Name" },
        { key: "plannedDate", label: "Expected Date" },
        { key: "totalFollowUps", label: "Total Follow-Ups" },
        { key: "expectedDate", label: "Last Follow-Up Date" },
        { key: "remarks", label: "Remarks" },
        { key: "liftNo", label: "Unit Tracking No." },
        { key: "vendorName", label: "Supplier" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Dispatch Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
    ];

    const historyColumns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "itemName", label: "Item Name" },
        { key: "plannedDate", label: "Expected Date" },
        { key: "actualDate", label: "Actual" },
        { key: "totalFollowUps", label: "Total Follow-Ups" },
        { key: "expectedDate", label: "Last Follow-Up Date" },
        { key: "remarks", label: "Remarks" },
        { key: "liftNo", label: "Unit Tracking No." },
        { key: "vendorName", label: "Supplier" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Dispatch Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
    ];

    // -----------------------------------------------------------------
    // MODAL
    // -----------------------------------------------------------------
    const handleOpenForm = (record: any) => {
        setSelectedRecord(record);
        setFormData({
            status: "",
            remarks: "",
            expectedDate: "",
            expectedDelivery: "",
        });
        setIsBulkMode(false);
        setBulkError(null);
        setOpen(true);
    };

    const validateBulkSelection = () => {
        if (selectedRows.size <= 1) return true;
        const selectedItems = records.filter(r => selectedRows.has(r.id));
        if (selectedItems.length === 0) return false;

        const first = selectedItems[0];
        const vendor = first.data.vendorName;
        const po = first.data.poNumber;

        for (let i = 1; i < selectedItems.length; i++) {
            if (selectedItems[i].data.vendorName !== vendor || selectedItems[i].data.poNumber !== po) {
                return false;
            }
        }
        return true;
    };

    const handleBulkOpen = () => {
        if (selectedRows.size === 0) return;

        const isValid = validateBulkSelection();
        if (!isValid) {
            toast.error("Vendor and PO No. didn't match");
            setBulkError("Vendor and PO Number mismatch. Cannot submit.");
        } else {
            setBulkError(null);
        }

        // Use the first selected record to populate common fields (or just for context)
        const firstId = Array.from(selectedRows)[0];
        const rec = records.find(r => r.id === firstId);
        if (rec) {
            setSelectedRecord(rec);
            setFormData({
                status: "",
                remarks: "",
                expectedDate: "",
                expectedDelivery: "",
            });
            setIsBulkMode(true);
            setOpen(true);
        }
    };

    // -----------------------------------------------------------------
    // SUBMIT
    // -----------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord && !isBulkMode) return;
        if (isBulkMode && bulkError) {
            toast.error(bulkError);
            return;
        }

        if (!formData.status) {
            toast.error("Status is required");
            return;
        }

        if (formData.status === "Intransit") {
            if (!formData.expectedDate) {
                toast.error("Next Follow-Up is required when status is Intransit");
                return;
            }
            if (!formData.expectedDelivery) {
                toast.error("Expected Delivery is required when status is Intransit");
                return;
            }
        }

        setIsSubmitting(true);
        const toastId = toast.loading(isBulkMode ? "Recording Bulk Follow-Up..." : "Recording Follow-Up...");

        try {
            const recordsToProcess = isBulkMode
                ? records.filter(r => selectedRows.has(r.id))
                : [selectedRecord];

            const timestamp = getFmsTimestamp();

            for (const record of recordsToProcess) {
                const { error: insertError } = await supabase.from("transporter_followups").insert({
                    po_id: record._poId,
                    lifting_id: record._liftingId || null,
                    transporter_name: record.data.transporterName || "",
                    vehicle_number: record.data.vehicleNo || "",
                    bilty_number: record.data.lrNo || null,
                    freight_amount: record.data.freightAmt || record.data.freightAmount ? parseFloat(record.data.freightAmt || record.data.freightAmount) : null,
                    status: formData.status,
                    expected_arrival_date: formData.expectedDelivery || null,
                    dispatch_date: formData.status === "Received" ? timestamp : null,
                });

                if (insertError) throw insertError;

                if (record._liftingId) {
                    const updateData: any = {
                        followup_date: formData.expectedDate || timestamp,
                        expected_lifting_date: formData.expectedDelivery || null,
                        remarks: formData.remarks || "",
                    };

                    if (formData.status === "Received") {
                        updateData.actual_lifting_date = timestamp;
                        updateData.lifting_status = "Complete";
                    }

                    if (formData.status === "Intransit") {
                        updateData.lifting_status = "Intransit";
                    }

                    const { error: updateError } = await supabase.from("vendor_liftings").update(updateData).eq("id", record._liftingId);
                    if (updateError) throw updateError;
                }
            }

            toast.success("Follow-Up Recorded!", { id: toastId });
            setOpen(false);
            if (isBulkMode) {
                setSelectedRows(new Set());
                setIsBulkMode(false);
            }
            fetchData();

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // -----------------------------------------------------------------
    // SELECTION
    // -----------------------------------------------------------------
    const toggleRow = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAll = () => {
        const currentList = activeTab === "pending" ? pending : completed;
        if (selectedRows.size === currentList.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(currentList.map(r => r.id)));
        }
    };

    const safeValue = (val: any) => {
        if (!val || val === "-" || val === "") return "-";
        return String(val);
    };

    const handleExportPendingCSV = () => {
        setIsExporting(true);

        // Simulate export delay so that the spinner is visible to the user
        setTimeout(() => {
            try {
                const headers = pendingColumns.map((c) => c.label);

                const rowData = pending.map((record) => {
                    return pendingColumns.map((col) => {
                        const val = record.data[col.key];
                        if (col.key === "plannedDate" || col.key === "expectedDate") {
                            return formatDateDash(val);
                        }
                        return val === undefined || val === null || String(val).trim() === "" ? "-" : String(val);
                    });
                });

                const escapeCSV = (val: string) => {
                    const clean = val === undefined || val === null ? "" : String(val);
                    if (clean.includes(",") || clean.includes('"') || clean.includes("\n") || clean.includes("\r")) {
                        return `"${clean.replace(/"/g, '""')}"`;
                    }
                    return clean;
                };

                const csvContent = [
                    headers.map(escapeCSV).join(","),
                    ...rowData.map((row) => row.map(escapeCSV).join(","))
                ].join("\r\n");

                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `Pending_Transporter_FollowUp_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("CSV file exported successfully!");
            } catch (error) {
                console.error("Export CSV error:", error);
                toast.error("Failed to export CSV file");
            } finally {
                setIsExporting(false);
            }
        }, 1000); // 1 second delay to showcase spinner
    };

    return (
        <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Transporter Follow-Up</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search by Indent, Item, Vendor, Transporter, LR No..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white"
                            />
                        </div>

                        <div className="h-8 w-px bg-slate-200 hidden md:block" />

                        <div className="flex gap-4 items-center">
                            {/* Bulk Button */}
                            {activeTab === "pending" && selectedRows.size > 1 && (
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handleBulkOpen}
                                >
                                    Bulk Follow-Up ({selectedRows.size})
                                </Button>
                            )}

                            {/* Sorting Dropdown - Only for Pending Tab */}
                            {activeTab === "pending" && (
                                <Select
                                    value={sortConfig?.key || ""}
                                    onValueChange={(value) => handleSort(value)}
                                >
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Sort by..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="indentNumber">Indent No</SelectItem>
                                        <SelectItem value="expectedDate">Last Follow-Up Date</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}

                            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading transport records...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 mb-4 gap-3">
                        <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full sm:w-auto">
                            <TabsTrigger
                                value="pending"
                                className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                            >
                                Pending ({pending.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="py-2.5 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm"
                            >
                                History ({completed.length})
                            </TabsTrigger>
                        </TabsList>

                        {activeTab === "pending" && (
                            <Button
                                onClick={handleExportPendingCSV}
                                disabled={isExporting}
                                size="sm"
                                className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2 ml-auto sm:ml-0"
                            >
                                {isExporting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Export CSV
                            </Button>
                        )}
                    </div>

                    <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
                        <div className="border rounded-lg flex-1 overflow-auto shadow-sm relative h-full">
                            <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                    <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                                        <TableHead className="w-[50px] sticky top-0 left-0 z-40 bg-slate-200 border-none pl-4 py-3">
                                            <Checkbox
                                                checked={selectedRows.size === pending.length && pending.length > 0}
                                                onCheckedChange={toggleAll}
                                            />
                                        </TableHead>
                                        <TableHead className="w-[120px] sticky top-0 left-[50px] z-40 bg-slate-200 border-none px-4 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center font-bold text-slate-700 uppercase">Actions</TableHead>
                                        {pendingColumns.map(c => (
                                            <TableHead key={c.key} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-center font-bold text-slate-700 uppercase whitespace-nowrap">{c.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pending.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={pendingColumns.length + 2} className="h-32 text-center text-gray-500 font-medium">
                                                No pending transporter follow-ups found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pendingPagination.pageData.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell className="sticky left-0 z-10 bg-white border-b border-r px-4 py-2">
                                                    <Checkbox
                                                        checked={selectedRows.has(rec.id)}
                                                        onCheckedChange={() => toggleRow(rec.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="sticky left-[50px] z-10 bg-white border-b border-r px-4 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center">
                                                    <Button size="sm" onClick={() => handleOpenForm(rec)} className="bg-blue-600 hover:bg-blue-700">
                                                        Follow-Up
                                                    </Button>
                                                </TableCell>
                                                {pendingColumns.map((c) => {
                                                    const val = rec.data[c.key];

                                                    if (c.key === "vendorName") {
                                                        return (
                                                            <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700 font-semibold">
                                                                {safeValue(val)}
                                                            </TableCell>
                                                        );
                                                    }

                                                    if (c.key === "createdAtCol") {
                                                        return (
                                                            <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700 font-mono text-xs">
                                                                {formatDateTimeFull(rec.createdAt)}
                                                            </TableCell>
                                                        );
                                                    }

                                                    if (c.key === "plannedDate") {
                                                        return (
                                                            <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700 font-mono text-xs">
                                                                {getPlannedDateForRecord(rec.data, "Transporter Follow-Up", tatRules, rec.createdAt)}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Default Logic
                                                    return <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700">{safeValue(val)}</TableCell>;
                                                })}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
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

                    <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
                        <div className="border rounded-lg overflow-auto shadow-sm flex-1 relative h-full">
                            <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                    <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                                        {historyColumns.map(c => (
                                            <TableHead key={c.key} className="sticky top-0 z-20 bg-slate-200 border-none px-4 py-3 text-center font-bold text-slate-700 uppercase whitespace-nowrap">{c.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completed.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={historyColumns.length} className="h-32 text-center text-gray-500 font-medium">
                                                No follow-up history found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        historyPagination.pageData.map(rec => (
                                        <TableRow key={rec.id}>
                                            {historyColumns.map((c) => {
                                                const val = rec.data[c.key];

                                                if (c.key === "plannedDate") {
                                                    return <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700 font-mono text-xs">{getPlannedDateForRecord(rec.data, "Transporter Follow-Up", tatRules, rec.createdAt)}</TableCell>;
                                                }

                                                // Actual & Expected Date Logic
                                                if (c.key === "actualDate" || c.key === "expectedDate") {
                                                    return <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700">{formatDateDash(val)}</TableCell>;
                                                }

                                                // Default Logic
                                                return <TableCell key={c.key} className="text-center border-b px-4 py-2 text-slate-700">{safeValue(val)}</TableCell>;
                                            })}
                                        </TableRow>
                                    )))}
                                </TableBody>
                            </table>
                        </div>
                        <PaginationBar
                            page={historyPagination.page}
                            pageSize={historyPagination.pageSize}
                            totalCount={historyPagination.totalCount}
                            onPageChange={historyPagination.setPage}
                            onPageSizeChange={historyPagination.setPageSize}
                        />
                    </TabsContent>
                </Tabs>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isBulkMode ? `Bulk Follow-Up (${selectedRows.size} items)` : "Transport Follow-Up"}</DialogTitle>
                    </DialogHeader>

                    {bulkError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
                            {bulkError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">

                        {isBulkMode ? (
                            <div className="space-y-4">
                                {/* Selected Items List */}
                                <div className="border rounded-md overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium flex justify-between">
                                        <span>Selected Items ({selectedRows.size})</span>
                                        <span className="text-gray-500 font-normal">
                                            Vendor: {selectedRecord?.data.vendorName} | PO: {selectedRecord?.data.poNumber}
                                        </span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2 bg-slate-50">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="pb-1 font-medium">Indent No</th>
                                                    <th className="pb-1 font-medium">Unit Tracking No.</th>
                                                    <th className="pb-1 font-medium">Transporter</th>
                                                    <th className="pb-1 font-medium">Vehicle</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records
                                                    .filter(r => selectedRows.has(r.id))
                                                    .map(r => (
                                                        <tr key={r.id} className="border-b last:border-0 border-gray-100">
                                                            <td className="py-1">{r.data.indentNumber}</td>
                                                            <td className="py-1">{r.data.liftNo}</td>
                                                            <td className="py-1 truncate max-w-[100px]" title={r.data.transporterName}>{r.data.transporterName}</td>
                                                            <td className="py-1">{r.data.vehicleNo}</td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Single Item View - Read Only Fields */
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Transporter Name</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium truncate">
                                            {selectedRecord?.data.transporterName || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Vehicle Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.vehicleNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Contact Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.contactNo || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Unit Tracking No.</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.liftNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs text-gray-500">Indent Number</Label>
                                    <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                        {selectedRecord?.data.indentNumber || "-"}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Editable Fields - Compact Layout */}
                        <div className="p-4 bg-white border rounded-md shadow-sm space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Update Status</h3>
                            <div className={`grid gap-3 ${formData.status === "Intransit" ? "grid-cols-3" : "grid-cols-2"}`}>
                                <div>
                                    <Label className="text-xs mb-1 block">Status <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Intransit">Intransit</SelectItem>
                                            <SelectItem value="Received">Received</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Expected Date - Only show when Status is Intransit */}
                                {formData.status === "Intransit" && (
                                    <>
                                        <div>
                                            <Label className="text-xs mb-1 block">Next Follow-Up <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.expectedDate}
                                                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                                                required
                                                className="h-9"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs mb-1 block">Expected Delivery <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.expectedDelivery}
                                                onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
                                                required
                                                className="h-9"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs mb-1 block">Remarks</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="Enter any remarks..."
                                    rows={2}
                                    className="resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !!bulkError} className="bg-blue-600 hover:bg-blue-700">
                                {isSubmitting ? "Submitting..." : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
