"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Upload, X, Loader2, Search, Eye, Package, CheckCircle2, AlertCircle, Info, ClipboardList } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { parseSheetDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";

const formatDateDash = (date: any) => {
    if (!date || date === "-" || date === "—") return "-";
    const d = date instanceof Date ? date : parseSheetDate(date);
    if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

// ─── Module-level helpers (stable references, no re-creation on render) ────
const GST_RATES: Record<string, number> = {
    "5%": 0.05,
    "12%": 0.12,
    "18%": 0.18,
    "28%": 0.28,
};

const uploadToStorage = async (file: File): Promise<string> => {
    try {
        const path = `material-images/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
            .from("material-images")
            .upload(path, file);
        if (error) {
            console.warn("Storage upload error (bucket missing or permission issue):", error.message);
            return typeof window !== "undefined" ? URL.createObjectURL(file) : "";
        }
        const { data } = supabase.storage.from("material-images").getPublicUrl(path);
        return data.publicUrl;
    } catch (err) {
        console.warn("Upload exception:", err);
        return typeof window !== "undefined" ? URL.createObjectURL(file) : "";
    }
};

const generateGRN = async (): Promise<string> => {
    const { data } = await supabase
        .from("material_receipts")
        .select("grn_number")
        .order("grn_number", { ascending: false })
        .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
        const match = data[0].grn_number?.match(/GRN-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `GRN-${String(nextNum).padStart(3, "0")}`;
};

/* --------------------------------------------------------------- */
/*  COLUMNS FOR PENDING TAB (Same as Follow-Up Vendor History)     */
/* --------------------------------------------------------------- */
const PENDING_COLUMNS = [
    { key: "indentNumber", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "poQty", label: "PO Qty" },
    { key: "liftingQty", label: "Dispatch Qty" },
    { key: "totalReceivedSoFar", label: "Rec. So Far" },
    { key: "remainingPOBalance", label: "Pending Bal." },
    { key: "planned6", label: "Planned" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "transporterName", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No" },
    { key: "contactNo", label: "Contact No" },
    { key: "dispatchDate", label: "Dispatch Date" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "biltyCopy", label: "Bilty Copy" },
    { key: "poCopy", label: "PO Copy" },
] as const;

// ─── COLUMNS FOR HISTORY TAB (SHOW ALL) ─────────────────────────────────────
const HISTORY_COLUMNS = [
    ...PENDING_COLUMNS.slice(0, 6),
    { key: "actual6", label: "Actual" },
    ...PENDING_COLUMNS.slice(6),
    { key: "invoiceType", label: "Invoice Type" },
    { key: "receiptLiftNumber", label: "Receipt Unit Tracking No." },
    { key: "receivedQty", label: "Received Qty" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "extraFreight", label: "Extra Freight" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "damagedQty", label: "Damaged Qty" },
    { key: "damageReason", label: "Damage Reason" },
    { key: "damageImage", label: "Damage Image" },
] as const;

export default function Stage7() {

    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [selectedPendingColumns, setSelectedPendingColumns] = useState<
        string[]
    >(PENDING_COLUMNS.map((c) => c.key));
    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<
        string[]
    >(HISTORY_COLUMNS.map((c) => c.key));

    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");

    // Bulk State
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkItems, setBulkItems] = useState<{
        recordId: string;
        indentNumber: string;
        liftNumber: string;
        itemName: string;
        receivedQty: string;
        receivedItemImage: File | null;
        damageReceived: string;
        damagedQty: string;
        damageReason: string;
        damageImage: File | null;
        index: number;
    }[]>([]);
    const [commonData, setCommonData] = useState({
        remarks: "",
    });

    // Stable helper: Packaging/Forwarding totals
    const getPkgTotals = useCallback((
        pkgAmount: string, pkgGST: string, count: number
    ) => {
        const base = parseFloat(pkgAmount) || 0;
        const gstRate = GST_RATES[pkgGST] ?? 0;
        const totalPkg = base + base * gstRate;
        const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
        const perItemPkgBase = count > 0 ? base / count : 0;
        return { totalPkg, perItemPkgTotal, perItemPkgBase };
    }, []);


    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const indentRows = await fetchIndentWorkflow();

            const { data: poRows } = await supabase
                .from("purchase_orders")
                .select("*")
                .order("created_at", { ascending: true });

            const posByIndent = new Map<string, any[]>();
            (poRows || []).forEach((po: any) => {
                if (po.indent_id) {
                    const list = posByIndent.get(po.indent_id) || [];
                    list.push(po);
                    posByIndent.set(po.indent_id, list);
                }
            });

            const poIds = (poRows || []).map((p: any) => p.id).filter(Boolean);

            const [liftingRes, transporterRes, receiptRes, paymentRes] = await Promise.all([
                poIds.length > 0
                    ? supabase.from("vendor_liftings").select("*").in("po_id", poIds)
                    : Promise.resolve({ data: [] as any[] }),
                poIds.length > 0
                    ? supabase.from("transporter_followups").select("*").in("po_id", poIds)
                    : Promise.resolve({ data: [] as any[] }),
                poIds.length > 0
                    ? supabase.from("material_receipts").select("*").in("po_id", poIds)
                    : Promise.resolve({ data: [] as any[] }),
                poIds.length > 0
                    ? supabase.from("vendor_payments").select("*").in("po_id", poIds)
                    : Promise.resolve({ data: [] as any[] }),
            ]);

            const liftings = liftingRes.data || [];
            const transporters = transporterRes.data || [];
            const receipts = receiptRes.data || [];
            const payments = paymentRes.data || [];

            const liftingByPo = new Map<string, any[]>();
            liftings.forEach((l: any) => {
                const list = liftingByPo.get(l.po_id) || [];
                list.push(l);
                liftingByPo.set(l.po_id, list);
            });

            const transporterByPo = new Map<string, any>();
            transporters.forEach((t: any) => {
                if (!transporterByPo.has(t.po_id)) transporterByPo.set(t.po_id, t);
            });

            const receiptsByPo = new Map<string, any[]>();
            receipts.forEach((r: any) => {
                const list = receiptsByPo.get(r.po_id) || [];
                list.push(r);
                receiptsByPo.set(r.po_id, list);
            });

            const paymentsByPo = new Map<string, any[]>();
            payments.forEach((p: any) => {
                const list = paymentsByPo.get(p.po_id) || [];
                list.push(p);
                paymentsByPo.set(p.po_id, list);
            });

            const rows: any[] = [];

            for (const indentRow of indentRows) {
                const indentPOs = posByIndent.get(indentRow.id) || [];
                for (const po of indentPOs) {

                const poLiftings = liftingByPo.get(po.id) || [];
                const poReceipts = receiptsByPo.get(po.id) || [];
                const transporter = transporterByPo.get(po.id);
                const poPayments = paymentsByPo.get(po.id) || [];
                const freightPayment = poPayments.find((p: any) => p.payment_type === "freight");
                const advancePayment = poPayments.find((p: any) => p.payment_type === "advance");

                const totalPOQty = parseFloat(String(po.quantity || indentRow.data.quantity || "0").replace(/,/g, "")) || 0;
                const totalReceivedSoFar = poReceipts.reduce((sum, r) => sum + (parseFloat(String(r.received_quantity || "0").replace(/,/g, "")) || 0), 0);
                const remainingPOBalance = Math.max(0, totalPOQty - totalReceivedSoFar);

                if (poLiftings.length === 0) {
                    const compositeId = `${indentRow.data.indentNumber}_${po.po_number}`;
                    const receipt = poReceipts.find(r => parseFloat(String(r.received_quantity || "0")) > 0);
                    const status = receipt ? "completed" : (transporter ? "pending" : "not_ready");

                    rows.push({
                        id: compositeId,
                        rowIndex: rows.length,
                        stage: 7,
                        status,
                        data: {
                            indentNumber: indentRow.data.indentNumber,
                            liftNo: po.po_number,
                            warehouse: indentRow.data.warehouseLocation,
                            vendorName: po.vendor_name,
                            itemName: indentRow.data.itemName,
                            poNumber: po.po_number,
                            poQty: String(totalPOQty),
                            totalReceivedSoFar: String(totalReceivedSoFar),
                            remainingPOBalance: String(remainingPOBalance),
                            nextFollowUpDate: "",
                            remarks: "",
                            liftingQty: String(totalPOQty),
                            transporterName: transporter?.transporter_name || "",
                            vehicleNo: transporter?.vehicle_number || "",
                            contactNo: "",
                            lrNo: transporter?.bilty_number || "",
                            dispatchDate: transporter?.dispatch_date || "",
                            freightAmount: freightPayment ? String(freightPayment.amount || "") : "",
                            advanceAmount: advancePayment ? String(advancePayment.amount || "") : "",
                            paymentDate: poPayments[0]?.payment_date || "",
                            paymentStatus: poPayments[0]?.status || "",
                            biltyCopy: transporter?.bilty_copy_url || "",
                            poCopy: po.po_copy_url || "",
                            planned6: "",
                            actual6: receipt ? String(receipt.received_date || "") : "",
                            invoiceType: "",
                            receivedQty: receipt ? String(receipt.received_quantity || "") : "",
                            invoiceDate: "",
                            invoiceNumber: "",
                            extraFreight: "",
                            receivedItemImage: receipt?.received_item_image_url || "",
                            billAttachment: "",
                            damagedQty: receipt ? String(receipt.rejected_quantity || "") : "",
                            damageReason: "",
                            damageImage: "",
                            productClaim: "",
                            receiptLiftNumber: "",
                            _poId: po.id,
                        }
                    });
                } else {
                    for (const lifting of poLiftings) {
                        const liftTrackingNo = String(lifting.id).substring(0, 8);
                        const compositeId = `${indentRow.data.indentNumber}_${liftTrackingNo}`;
                        const liftQty = parseFloat(String(lifting.quantity || lifting.lifting_qty || "0").replace(/,/g, "")) || 0;
                        const receipt = poReceipts.find(r => 
                            String(r.grn_number || "").includes(liftTrackingNo) || 
                            (liftQty > 0 && Math.abs((parseFloat(String(r.received_quantity || "0").replace(/,/g, "")) || 0) - liftQty) < 0.01)
                        ) || null;

                        let status = "not_ready";
                        const isLiftingDone = !!(lifting.actual_lifting_date && String(lifting.actual_lifting_date).trim() !== "" && String(lifting.actual_lifting_date).trim() !== "-");
                        const isTransporterDone = !!transporter || (lifting.lifting_status && ["complete", "completed", "received", "approved", "intransit"].includes(String(lifting.lifting_status).toLowerCase()));

                        if (receipt) {
                            status = "completed";
                        } else if (isTransporterDone || isLiftingDone) {
                            status = "pending";
                        }

                        rows.push({
                            id: compositeId,
                            rowIndex: rows.length,
                            stage: 7,
                            status,
                            data: {
                                indentNumber: indentRow.data.indentNumber,
                                liftNo: liftTrackingNo,
                                warehouse: indentRow.data.warehouseLocation,
                                vendorName: po.vendor_name,
                                itemName: indentRow.data.itemName,
                                poNumber: po.po_number,
                                poQty: String(totalPOQty),
                                totalReceivedSoFar: String(totalReceivedSoFar),
                                remainingPOBalance: String(remainingPOBalance),
                                nextFollowUpDate: lifting.followup_date || "",
                                remarks: lifting.remarks || "",
                                liftingQty: String(lifting.lifting_qty || totalPOQty),
                                transporterName: transporter?.transporter_name || "",
                                vehicleNo: lifting.vehicle_number || transporter?.vehicle_number || "",
                                contactNo: lifting.driver_contact || "",
                                lrNo: transporter?.bilty_number || "",
                                dispatchDate: transporter?.dispatch_date || "",
                                freightAmount: freightPayment ? String(freightPayment.amount || "") : "",
                                advanceAmount: advancePayment ? String(advancePayment.amount || "") : "",
                                paymentDate: poPayments[0]?.payment_date || "",
                                paymentStatus: poPayments[0]?.status || "",
                                biltyCopy: transporter?.bilty_copy_url || "",
                                poCopy: po.po_copy_url || "",
                                planned6: lifting.expected_lifting_date || "",
                                actual6: receipt ? String(receipt.received_date || "") : "",
                                invoiceType: "",
                                receivedQty: receipt ? String(receipt.received_quantity || "") : "",
                                invoiceDate: "",
                                invoiceNumber: "",
                                extraFreight: "",
                                receivedItemImage: receipt?.received_item_image_url || "",
                                billAttachment: "",
                                damagedQty: receipt ? String(receipt.rejected_quantity || "") : "",
                                damageReason: "",
                                damageImage: "",
                                productClaim: "",
                                receiptLiftNumber: liftTrackingNo,
                                _poId: po.id,
                            }
                        });
                    }
                }
            }
        }

            setSheetRecords(rows);
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const fetchDropdown = async () => {
            try {
                const { data: rows, error } = await supabase
                    .from("master_items")
                    .select("item_code, item_name")
                    .eq("is_active", true);

                if (error) throw error;
                if (rows) {
                    const mapping: Record<string, string> = {};
                    rows.forEach((r: any) => {
                        if (r.item_name && r.item_code) mapping[r.item_name] = r.item_code;
                    });
                    setItemCodeMap(mapping);
                }
            } catch (e) {
                console.error("Error fetching dropdowns:", e);
            }
        };
        fetchDropdown();
    }, []);


    useEffect(() => { fetchData(); }, [fetchData]);

    const [form, setForm] = useState({
        itemName: "",
        liftNumber: "",
        receivedQty: "",
        receivedItemImage: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        extraFreight: "",
        qcRequirement: "no",
        warrantyClaim: "",
        productClaim: "",
        duration: "",
        warrantyExpiry: "",
        productExpiry: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
        damageReceived: "no",
        damagedQty: "",
        damageReason: "",
        damageImage: null as File | null,
    });

    // Build a fast lookup map for records
    const recordMap = useMemo(
        () => new Map(sheetRecords.map((r) => [r.id, r])),
        [sheetRecords]
    );

    // Check Vendor/PO Match
    const checkVendorPOMatch = useCallback((ids: string[]) => {
        if (ids.length === 0) return { match: false, vendor: "", po: "" };
        const first = recordMap.get(ids[0]);
        if (!first) return { match: false, vendor: "", po: "" };
        const v = first.data.vendorName;
        const p = first.data.poNumber;
        for (let i = 1; i < ids.length; i++) {
            const rec = recordMap.get(ids[i]);
            if (!rec || rec.data.vendorName !== v || rec.data.poNumber !== p)
                return { match: false, vendor: "", po: "" };
        }
        return { match: true, vendor: v, po: p };
    }, [recordMap]);

    const handleBulkOpen = useCallback(() => {
        if (selectedRecordIds.length === 0) return;
        const { match } = checkVendorPOMatch(selectedRecordIds);
        if (selectedRecordIds.length > 1 && !match) {
            toast.error("All selected items must have the same Vendor and PO Number.", {
                style: { background: "red", color: "white", border: "none" }
            });
            return;
        }
        setIsBulkMode(true);
        setCommonData({
            remarks: "",
        });
        const items = selectedRecordIds.map(id => {
            const rec = recordMap.get(id);
            return {
                recordId: id,
                indentNumber: rec?.data?.indentNumber || "",
                liftNumber: rec?.data?.liftNo || "",
                itemName: rec?.data?.itemName || "",
                receivedQty: "",
                receivedItemImage: null,
                damageReceived: "no",
                damagedQty: "",
                damageReason: "",
                damageImage: null,
                index: rec?.rowIndex || 0
            };
        });
        setBulkItems(items);
        setOpen(true);
    }, [selectedRecordIds, checkVendorPOMatch, recordMap]);

    const handleBulkSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await Promise.all(bulkItems.map(async (item) => {
                const rec = recordMap.get(item.recordId);
                if (!rec) return;

                const itemImgUrl = item.receivedItemImage
                    ? await uploadToStorage(item.receivedItemImage)
                    : "";

                let damageImageUrl = "";
                if (item.damageImage) {
                    damageImageUrl = await uploadToStorage(item.damageImage);
                }

                const baseGrn = await generateGRN();
                const liftNo = item.liftNumber || rec.data.liftNo || "";
                const grnNumber = liftNo ? `${baseGrn}_${liftNo}` : baseGrn;
                const receivedQty = parseFloat(item.receivedQty) || 0;
                const damagedQty = parseFloat(item.damagedQty) || 0;
                const isDamaged = item.damageReceived === "yes";
                const availableQty = parseFloat(String(rec.data.liftingQty || rec.data.poQty || rec.data.quantity || "0").replace(/,/g, "")) || 0;

                if (receivedQty > availableQty && availableQty > 0) {
                    toast.error(`Cannot submit quantity (${receivedQty}) greater than Dispatch Quantity (${availableQty})!`, {
                        style: { background: "red", color: "white", border: "none" }
                    });
                    setIsSubmitting(false);
                    return;
                }

                if (damagedQty > receivedQty) {
                    toast.error(`Damaged quantity (${damagedQty}) cannot exceed received quantity (${receivedQty})!`, {
                        style: { background: "red", color: "white", border: "none" }
                    });
                    setIsSubmitting(false);
                    return;
                }

                const { error: insertError } = await supabase.from("material_receipts").insert({
                    grn_number: grnNumber,
                    po_id: rec.data._poId || null,
                    received_date: new Date().toISOString().split("T")[0],
                    received_quantity: receivedQty,
                    accepted_quantity: isDamaged ? Math.max(0, receivedQty - damagedQty) : receivedQty,
                    rejected_quantity: isDamaged ? damagedQty : 0,
                    received_item_image_url: itemImgUrl || null,
                    bilty_invoice_image_url: null,
                    received_by: null,
                    status: isDamaged && damagedQty > 0 ? "QC Failed" : "QC Passed",
                });

                if (insertError) throw insertError;

                if (isDamaged && damagedQty > 0) {
                    const { data: receiptData } = await supabase
                        .from("material_receipts")
                        .select("id")
                        .eq("grn_number", grnNumber)
                        .single();

                    if (receiptData) {
                        await supabase.from("qc_inspections").insert({
                            material_receipt_id: receiptData.id,
                            qc_engineer: "System",
                            inspection_date: new Date().toISOString().split("T")[0],
                            passed_quantity: Math.max(0, receivedQty - damagedQty),
                            failed_quantity: damagedQty,
                            rejection_reason: item.damageReason || "Damaged on receipt",
                            checklist_status: {},
                            damage_image_url: damageImageUrl || null,
                            overall_status: "Failed",
                        });
                    }
                }
            }));

            toast.success("Bulk Receipt recorded successfully!");
            setOpen(false);
            setSelectedRecordIds([]);
            setIsBulkMode(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error submitting bulk form");
        } finally {
            setIsSubmitting(false);
        }
    }, [commonData, bulkItems, fetchData, recordMap]);



    /* --------------------------------------------------------------- */
    /*  Open Modal                                                     */
    /* --------------------------------------------------------------- */
    const openModal = useCallback((recordId: string) => {
        const rec = recordMap.get(recordId);
        if (!rec) {
            toast.error("Record not found locally. Please refresh.");
            return;
        }
        setSelectedRecordIds([]);
        setIsBulkMode(false);
        setSelectedRecordId(recordId);
        setForm({
            itemName: rec.data.itemName || "",
            liftNumber: rec.data.liftNo || "",
            receivedQty: rec.data.liftingQty || "",
            receivedItemImage: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            extraFreight: "",
            qcRequirement: "no",
            warrantyClaim: "",
            productClaim: "",
            duration: "",
            warrantyExpiry: "",
            productExpiry: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
            damageReceived: "no",
            damagedQty: "",
            damageReason: "",
            damageImage: null,
        });
        setOpen(true);
    }, [recordMap]);

    /* --------------------------------------------------------------- */
    /*  Submit                                                         */
    /* --------------------------------------------------------------- */
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId) return;
        const rec = recordMap.get(selectedRecordId);
        if (!rec) return;
        setIsSubmitting(true);
        try {
            const imageUrl = form.receivedItemImage instanceof File
                ? await uploadToStorage(form.receivedItemImage)
                : (typeof form.receivedItemImage === "string" ? form.receivedItemImage : "");

            let damageImageUrl = "";
            if (form.damageImage) {
                damageImageUrl = await uploadToStorage(form.damageImage);
            }

            const baseGrn = await generateGRN();
            const liftNo = rec.data.liftNo || "";
            const grnNumber = liftNo ? `${baseGrn}_${liftNo}` : baseGrn;
            const receivedQty = parseFloat(form.receivedQty) || 0;
            const damagedQty = parseFloat(form.damagedQty) || 0;
            const isDamaged = form.damageReceived === "yes";
            const availableQty = parseFloat(String(rec.data.liftingQty || rec.data.poQty || rec.data.quantity || "0").replace(/,/g, "")) || 0;

            if (receivedQty > availableQty && availableQty > 0) {
                toast.error(`Cannot submit quantity (${receivedQty}) greater than Dispatch Quantity (${availableQty})!`, {
                    style: { background: "red", color: "white", border: "none" }
                });
                setIsSubmitting(false);
                return;
            }

            if (damagedQty > receivedQty) {
                toast.error(`Damaged quantity (${damagedQty}) cannot exceed received quantity (${receivedQty})!`, {
                    style: { background: "red", color: "white", border: "none" }
                });
                setIsSubmitting(false);
                return;
            }

            const { error: insertError } = await supabase.from("material_receipts").insert({
                grn_number: grnNumber,
                po_id: rec.data._poId || null,
                received_date: new Date().toISOString().split("T")[0],
                received_quantity: receivedQty,
                accepted_quantity: isDamaged ? Math.max(0, receivedQty - damagedQty) : receivedQty,
                rejected_quantity: isDamaged ? damagedQty : 0,
                extra_freight: parseFloat(form.extraFreight || "0") || 0,
                received_item_image_url: imageUrl || null,
                bilty_invoice_image_url: null,
                received_by: null,
                status: isDamaged && damagedQty > 0 ? "QC Failed" : "QC Passed",
            });

            if (insertError) throw insertError;

            if (isDamaged && damagedQty > 0) {
                const { data: receiptData } = await supabase
                    .from("material_receipts")
                    .select("id")
                    .eq("grn_number", grnNumber)
                    .single();

                if (receiptData) {
                    await supabase.from("qc_inspections").insert({
                        material_receipt_id: receiptData.id,
                        qc_engineer: "System",
                        inspection_date: new Date().toISOString().split("T")[0],
                        passed_quantity: Math.max(0, receivedQty - damagedQty),
                        failed_quantity: damagedQty,
                        rejection_reason: form.damageReason || "Damaged on receipt",
                        checklist_status: {},
                        damage_image_url: damageImageUrl || null,
                        overall_status: "Failed",
                    });
                }
            }

            toast.success("Receipt recorded successfully!");
            setOpen(false);
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error("Error submitting form");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecordId, recordMap, form, fetchData]);

    const removeFile = useCallback((key: "receivedItemImage") => {
        setForm((f) => ({ ...f, [key]: null }));
    }, []);

    const formValid = useMemo(() =>
        !!form.receivedQty,
        [form.receivedQty]);

    // Memoized filtered lists – only recompute when records or search change
    const pending = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "pending") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);

    const completed = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "completed") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);

    const activeRec = selectedRecordId ? recordMap.get(selectedRecordId) : null;
    const singleLiftingQtyVal = parseFloat(String(activeRec?.data?.liftingQty || 0)) || 0;
    const singleReceivedQtyVal = parseFloat(String(form.receivedQty || 0)) || 0;
    const singleDifferentQtyVal = singleLiftingQtyVal - singleReceivedQtyVal;

    return (
        <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                {/* Sticky Header and Tabs Container */}
                <div className="md:sticky md:top-0 z-50 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    {/* ==================== HEADER ==================== */}
                    <div className="p-4 md:p-6 bg-white border rounded-lg shadow-sm mb-4 md:mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-900 rounded-lg text-white shadow-xl">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage : Material Received</h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Bulk Button */}
                                {activeTab === "pending" && selectedRecordIds.length > 1 && (
                                    <Button
                                        onClick={handleBulkOpen}
                                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                    >
                                        Bulk Record ({selectedRecordIds.length})
                                    </Button>
                                )}

                                <Label className="text-sm font-medium text-slate-600 hidden md:inline-block">Show Columns:</Label>
                                <Select value="" onValueChange={() => { }}>
                                    <SelectTrigger className="w-40 bg-white border-slate-200">
                                        <SelectValue
                                            placeholder={
                                                activeTab === "pending"
                                                    ? `${selectedPendingColumns.length} selected`
                                                    : `${selectedHistoryColumns.length} selected`
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="w-40 bg-white">
                                        <div className="p-2">
                                            <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                                <Checkbox
                                                    checked={
                                                        activeTab === "pending"
                                                            ? selectedPendingColumns.length ===
                                                            PENDING_COLUMNS.length
                                                            : selectedHistoryColumns.length ===
                                                            HISTORY_COLUMNS.length
                                                    }
                                                    onCheckedChange={(c) => {
                                                        if (activeTab === "pending") {
                                                            setSelectedPendingColumns(
                                                                c ? PENDING_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        } else {
                                                            setSelectedHistoryColumns(
                                                                c ? HISTORY_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        }
                                                    }}
                                                />
                                                <Label className="text-sm font-medium">All Columns</Label>
                                            </div>
                                            {(activeTab === "pending"
                                                ? PENDING_COLUMNS
                                                : HISTORY_COLUMNS
                                            ).map((col) => (
                                                <div
                                                    key={col.key}
                                                    className="flex items-center space-x-2 py-1"
                                                >
                                                    <Checkbox
                                                        checked={
                                                            activeTab === "pending"
                                                                ? selectedPendingColumns.includes(col.key)
                                                                : selectedHistoryColumns.includes(col.key)
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            } else {
                                                                setSelectedHistoryColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <Label className="text-sm">{col.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Search Filter */}
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            {/* Warehouse Filter */}
                            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-slate-200">
                                    <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="All">All Warehouses</SelectItem>
                                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                                    <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                            </Select>
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

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
                        <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        {/* ---------- PENDING ---------- */}
                        <TabsContent value="pending" className="mt-0 outline-none">
                            <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                <Table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                    <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                        <TableRow className="hover:bg-transparent border-none">
                                            {activeTab === "pending" && (
                                                <TableHead className="sticky left-0 z-40 bg-slate-200 w-[50px] border-b text-center">
                                                    <Checkbox
                                                        checked={
                                                            pending.length > 0 &&
                                                            selectedRecordIds.length === pending.length
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedRecordIds(pending.map((r) => r.id));
                                                            } else {
                                                                setSelectedRecordIds([]);
                                                            }
                                                        }}
                                                    />
                                                </TableHead>
                                            )}
                                            <TableHead className="sticky left-[50px] z-40 bg-slate-200 w-[150px] border-b text-center whitespace-nowrap px-4">Actions</TableHead>
                                            {PENDING_COLUMNS.filter((c) =>
                                                selectedPendingColumns.includes(c.key)
                                            ).map((c) => (
                                                <TableHead key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={selectedPendingColumns.length + 2} className="h-32 text-center text-gray-500 font-medium">
                                                    No pending receipts found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pending.map((rec) => (
                                                <TableRow key={rec.id} className="bg-white hover:bg-gray-50 transition-colors group">
                                                    {activeTab === "pending" && (
                                                        <TableCell className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center">
                                                            <Checkbox
                                                                checked={selectedRecordIds.includes(rec.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedRecordIds((prev) =>
                                                                        checked
                                                                            ? [...prev, rec.id]
                                                                            : prev.filter((id) => id !== rec.id)
                                                                    );
                                                                }}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="sticky left-[50px] z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openModal(rec.id)}
                                                            className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                        >
                                                            Record Receipt
                                                        </Button>
                                                    </TableCell>

                                                    {PENDING_COLUMNS.filter((c) =>
                                                        selectedPendingColumns.includes(c.key)
                                                    ).map((col) => {
                                                        const val = rec.data[col.key];

                                                        if (col.key === "biltyCopy") {
                                                            const biltyRaw = rec.data.biltyCopy;
                                                            let biltyUrl = biltyRaw;
                                                            if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                                const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                    {biltyUrl ? (
                                                                        <a
                                                                            href={biltyUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center justify-center gap-1 text-xs text-green-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View Bilty</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (col.key === "poCopy") {
                                                            const poRaw = rec.data.poCopy;
                                                            let poUrl = poRaw;
                                                            if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                                const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                    {poUrl ? (
                                                                        <a
                                                                            href={poUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View PO</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (col.key === "nextFollowUpDate" || col.key === "dispatchDate" || col.key === "paymentDate" || col.key === "planned6") {
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? formatDateDash(val) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (col.key === "freightAmount" || col.key === "advanceAmount") {
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? `₹${val}` : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        return (
                                                            <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                {val || "-"}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* ---------- HISTORY ---------- */}
                        <TabsContent value="history" className="mt-6">
                            <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                <Table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                    <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                        <TableRow className="hover:bg-transparent border-none">
                                            {HISTORY_COLUMNS.filter((c) =>
                                                selectedHistoryColumns.includes(c.key)
                                            ).map((c) => (
                                                <TableHead key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                    {c.label}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completed.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={selectedHistoryColumns.length} className="h-32 text-center text-gray-500 font-medium">
                                                    No completed receipts found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            completed.map((record) => {
                                                const historyData = record.data;

                                                return (
                                                    <TableRow key={record.id} className="bg-green-50 hover:bg-green-100 transition-colors">
                                                        {HISTORY_COLUMNS.filter((c) =>
                                                            selectedHistoryColumns.includes(c.key)
                                                        ).map((col) => {
                                                            const val = (historyData[col.key] !== undefined && historyData[col.key] !== "")
                                                                ? historyData[col.key]
                                                                : record.data[col.key];

                                                            // Handle date fields (dispatchDate, paymentDate, etc.)
                                                            if (
                                                                col.key === "dispatchDate" ||
                                                                col.key === "paymentDate" ||
                                                                col.key === "nextFollowUpDate" ||
                                                                col.key === "invoiceDate" ||
                                                                col.key === "actual6" ||
                                                                col.key === "planned6"
                                                            ) {
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                        {formatDateDash(val)}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle file fields
                                                            if (col.key === "biltyCopy") {
                                                                const biltyRaw = historyData.biltyCopy;
                                                                let biltyUrl = biltyRaw;
                                                                if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                                    const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {biltyUrl ? (
                                                                            <a
                                                                                href={biltyUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-green-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span>View Bilty</span>
                                                                            </a>
                                                                        ) : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle PO Copy as a link
                                                            if (col.key === "poCopy") {
                                                                const poRaw = historyData.poCopy;
                                                                let poUrl = poRaw;
                                                                if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                                    const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {poUrl ? (
                                                                            <a
                                                                                href={poUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span>View PO</span>
                                                                            </a>
                                                                        ) : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            if (
                                                                col.key === "receivedItemImage" ||
                                                                col.key === "billAttachment" ||
                                                                col.key === "damageImage"
                                                            ) {
                                                                const file = historyData[col.key];
                                                                let fileUrl = typeof file === "string" ? file : undefined;
                                                                if (fileUrl && fileUrl.includes("drive.google.com/uc")) {
                                                                    const m = fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) fileUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {fileUrl ? (
                                                                            <a
                                                                                href={fileUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span className="truncate max-w-20">
                                                                                    View {col.label}
                                                                                </span>
                                                                            </a>
                                                                        ) : (
                                                                            "-"
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle currency columns
                                                            if (
                                                                col.key === "freightAmount" ||
                                                                col.key === "advanceAmount" ||
                                                                col.key === "extraFreight"
                                                            ) {
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                        {val ? `₹${val}` : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Default: show from historyData
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? String(val) : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </>
                )}
            </Tabs>

            {/* ==================== MODAL ==================== */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="flex-shrink-0 bg-slate-900 text-white p-5 flex flex-row items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Package className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-lg font-bold text-white leading-none">
                                {isBulkMode
                                    ? "Bulk Material Receipt"
                                    : "Record Material Receipt"}
                            </DialogTitle>
                            <p className="text-xs text-slate-300 mt-1.5">
                                {isBulkMode
                                    ? "Reconcile quantities and verify received items in bulk."
                                    : "Reconcile quantity, record image, and report damage if any."}
                            </p>
                        </div>
                    </DialogHeader>

                    {isBulkMode ? (
                        /* BULK FORM */
                        <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 p-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 border-b pb-2">
                                    <ClipboardList className="w-5 h-5 text-slate-800" />
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Items List ({bulkItems.length})</h3>
                                </div>
                                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="w-[180px] text-xs font-bold text-slate-600">Item Details</TableHead>
                                                <TableHead className="w-[100px] text-xs font-bold text-slate-600 text-center">Lifting Qty</TableHead>
                                                <TableHead className="w-[120px] text-xs font-bold text-slate-600 text-center">Received Qty <span className="text-red-500">*</span></TableHead>
                                                <TableHead className="w-[100px] text-xs font-bold text-slate-600 text-center">Different Qty</TableHead>
                                                <TableHead className="w-[130px] text-xs font-bold text-slate-600 text-center">Item Image</TableHead>
                                                <TableHead className="w-[110px] text-xs font-bold text-slate-600 text-center">Damage Received</TableHead>
                                                {bulkItems.some(i => i.damageReceived === "yes") && (
                                                    <>
                                                        <TableHead className="w-[90px] text-xs font-bold text-red-700 text-center">Damaged Qty</TableHead>
                                                        <TableHead className="w-[130px] text-xs font-bold text-red-700 text-center">Reason</TableHead>
                                                        <TableHead className="w-[130px] text-xs font-bold text-red-700 text-center">Damage Image</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bulkItems.map((item, idx) => {
                                                const rec = recordMap.get(item.recordId);
                                                const liftingQtyVal = parseFloat(String(rec?.data?.liftingQty || 0)) || 0;
                                                const receivedQtyVal = parseFloat(String(item.receivedQty || 0)) || 0;
                                                const differentQtyVal = liftingQtyVal - receivedQtyVal;

                                                return (
                                                    <TableRow key={item.recordId} className="hover:bg-slate-50/50 transition-colors">
                                                        <TableCell className="text-xs">
                                                            <div className="font-bold text-slate-800">Ind: {item.indentNumber}</div>
                                                            <div className="text-slate-500 font-medium">Lift: {item.liftNumber}</div>
                                                            <div className="text-slate-400 truncate max-w-[150px] font-medium" title={item.itemName}>{item.itemName}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={rec?.data?.liftingQty || "0"}
                                                                readOnly
                                                                className="bg-slate-50 border-slate-100 h-8 text-xs font-semibold text-slate-600 rounded-md text-center"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                value={item.receivedQty}
                                                                onChange={(e) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx].receivedQty = e.target.value;
                                                                    setBulkItems(newItems);
                                                                }}
                                                                className="h-8 text-xs font-semibold border-slate-200 focus:border-blue-500 rounded-md text-center bg-white"
                                                                required
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={differentQtyVal.toFixed(2)}
                                                                readOnly
                                                                className={`h-8 text-xs font-bold rounded-md text-center border transition-colors ${differentQtyVal === 0
                                                                        ? "bg-emerald-50/50 text-emerald-700 border-emerald-100"
                                                                        : differentQtyVal > 0
                                                                            ? "bg-amber-50/50 text-amber-700 border-amber-100"
                                                                            : "bg-rose-50/50 text-rose-700 border-rose-100"
                                                                    }`}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <input
                                                                    id={`bulkItemImage-${idx}`}
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => {
                                                                        const newItems = [...bulkItems];
                                                                        newItems[idx].receivedItemImage = e.target.files?.[0] || null;
                                                                        setBulkItems(newItems);
                                                                    }}
                                                                    className="hidden"
                                                                />
                                                                {!item.receivedItemImage ? (
                                                                    <label
                                                                        htmlFor={`bulkItemImage-${idx}`}
                                                                        className="flex items-center justify-center h-8 border border-dashed border-slate-200 rounded-md cursor-pointer hover:border-slate-350 hover:bg-slate-50 transition-colors px-2 text-slate-500 bg-white"
                                                                    >
                                                                        <Upload className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                                                        <span className="text-[10px] font-semibold">Upload</span>
                                                                    </label>
                                                                ) : (
                                                                    <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded-md">
                                                                        <span className="text-[9px] font-medium text-slate-600 truncate max-w-[60px]">{item.receivedItemImage.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newItems = [...bulkItems];
                                                                                newItems[idx].receivedItemImage = null;
                                                                                setBulkItems(newItems);
                                                                            }}
                                                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={item.damageReceived}
                                                                onValueChange={(v) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx].damageReceived = v;
                                                                    if (v === "no") {
                                                                        newItems[idx].damagedQty = "";
                                                                        newItems[idx].damageReason = "";
                                                                        newItems[idx].damageImage = null;
                                                                    }
                                                                    setBulkItems(newItems);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs rounded-md bg-white border-slate-200 shadow-sm"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="yes" className="text-red-650 font-semibold">Yes</SelectItem>
                                                                    <SelectItem value="no">No</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        {bulkItems.some(i => i.damageReceived === "yes") && (
                                                            <>
                                                                <TableCell>
                                                                    {item.damageReceived === "yes" ? (
                                                                        <Input
                                                                            type="number"
                                                                            value={item.damagedQty}
                                                                            onChange={(e) => {
                                                                                const newItems = [...bulkItems];
                                                                                newItems[idx].damagedQty = e.target.value;
                                                                                setBulkItems(newItems);
                                                                            }}
                                                                            className="h-8 text-xs font-semibold border-red-200 focus:border-red-500 rounded-md text-center text-red-900 bg-red-50/10"
                                                                            placeholder="Qty"
                                                                            required
                                                                        />
                                                                    ) : (
                                                                        <div className="text-center text-slate-300">—</div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.damageReceived === "yes" ? (
                                                                        <Input
                                                                            value={item.damageReason}
                                                                            onChange={(e) => {
                                                                                const newItems = [...bulkItems];
                                                                                newItems[idx].damageReason = e.target.value;
                                                                                setBulkItems(newItems);
                                                                            }}
                                                                            className="h-8 text-xs border-red-200 focus:border-red-500 rounded-md text-red-900 bg-red-50/10"
                                                                            placeholder="Reason"
                                                                            required
                                                                        />
                                                                    ) : (
                                                                        <div className="text-center text-slate-300">—</div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.damageReceived === "yes" ? (
                                                                        <div className="space-y-1">
                                                                            <input
                                                                                id={`bulkDamageImage-${idx}`}
                                                                                type="file"
                                                                                accept="image/*"
                                                                                onChange={(e) => {
                                                                                    const newItems = [...bulkItems];
                                                                                    newItems[idx].damageImage = e.target.files?.[0] || null;
                                                                                    setBulkItems(newItems);
                                                                                }}
                                                                                className="hidden"
                                                                            />
                                                                            {!item.damageImage ? (
                                                                                <label
                                                                                    htmlFor={`bulkDamageImage-${idx}`}
                                                                                    className="flex items-center justify-center h-8 border border-dashed border-red-200 rounded-md cursor-pointer hover:border-red-350 hover:bg-red-50/30 transition-colors px-2 text-red-700 bg-white"
                                                                                >
                                                                                    <Upload className="w-3.5 h-3.5 mr-1 text-red-500" />
                                                                                    <span className="text-[10px] font-semibold">Upload</span>
                                                                                </label>
                                                                            ) : (
                                                                                <div className="flex items-center justify-between gap-1.5 p-1 bg-red-50/50 border border-red-100 rounded-md">
                                                                                    <span className="text-[9px] font-medium text-red-800 truncate max-w-[60px]">{item.damageImage.name}</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const newItems = [...bulkItems];
                                                                                            newItems[idx].damageImage = null;
                                                                                            setBulkItems(newItems);
                                                                                        }}
                                                                                        className="text-red-500 hover:bg-red-100 p-0.5 rounded transition-colors"
                                                                                    >
                                                                                        <X className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center text-slate-300">—</div>
                                                                    )}
                                                                </TableCell>
                                                            </>
                                                        )}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 p-5 bg-slate-50 border border-slate-200/60 rounded-xl shadow-sm">
                                <Label className="text-xs text-slate-650 font-bold uppercase tracking-wider">Internal Remarks</Label>
                                <textarea
                                    value={commonData.remarks}
                                    onChange={(e) => setCommonData({ ...commonData, remarks: e.target.value })}
                                    className="w-full min-h-24 px-3 py-2 border border-slate-250 rounded-xl focus:border-blue-500 focus:ring-blue-500 resize-none text-sm placeholder:text-slate-400 bg-white shadow-sm"
                                    placeholder="Add any internal remarks or special instructions common to this bulk receipt..."
                                    rows={3}
                                />
                            </div>
                        </form>
                    ) : (
                        /* SINGLE FORM (Existing) */
                        <form
                            onSubmit={handleSubmit}
                            className="flex-1 overflow-y-auto space-y-6 p-6 pb-8"
                        >
                            {/* Card 1: Item Information */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 shadow-sm flex items-start gap-3 border-l-4 border-l-blue-600">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <ClipboardList className="w-5 h-5" />
                                </div>
                                <div className="flex-1 grid grid-cols-4 gap-4">
                                    <div className="col-span-2 space-y-1">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Item Name</span>
                                        <p className="text-sm font-semibold text-slate-800 truncate" title={form.itemName}>
                                            {form.itemName || "—"}
                                        </p>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit Tracking No.</span>
                                        <p className="text-sm font-mono font-medium text-slate-700 bg-white border border-slate-100 rounded px-2 py-0.5 w-fit">
                                            {form.liftNumber || "—"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Quantity Reconciliation */}
                            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider">Quantity Reconciliation</h4>
                                    </div>
                                    <div className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                        PO Balance After Receipt: <span className="font-bold text-slate-800">{Math.max(0, (parseFloat(activeRec?.data?.remainingPOBalance || "0") - (parseFloat(form.receivedQty || "0") || 0))).toFixed(0)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                        <Label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PO Total Ordered</Label>
                                        <p className="text-sm font-extrabold text-slate-800">{activeRec?.data?.poQty || activeRec?.data?.liftingQty || "0"}</p>
                                    </div>
                                    <div className="space-y-1 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
                                        <Label className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Dispatch (This Batch)</Label>
                                        <p className="text-sm font-extrabold text-blue-900">{activeRec?.data?.liftingQty || "0"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-700 font-bold flex items-center gap-1 uppercase tracking-wider">
                                            Received Qty <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            value={form.receivedQty}
                                            onChange={(e) =>
                                                setForm({ ...form, receivedQty: e.target.value })
                                            }
                                            required
                                            placeholder="0"
                                            className="border-slate-300 focus:border-blue-500 focus:ring-blue-500 font-bold text-slate-900 h-9 shadow-sm rounded-lg text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                                        <Label className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Batch Difference</Label>
                                        <p className={`text-sm font-extrabold ${singleDifferentQtyVal === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                            {singleDifferentQtyVal.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Damage Assessment */}
                            <div className={`border rounded-xl p-5 shadow-sm transition-all duration-300 space-y-4 ${form.damageReceived === "yes"
                                    ? "bg-red-55/10 border-red-200"
                                    : "bg-white border-slate-200/80"
                                }`}>
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className={`w-4 h-4 ${form.damageReceived === "yes" ? "text-red-650" : "text-slate-500"}`} />
                                        <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider">Damage Assessment</h4>
                                    </div>
                                    <div className="w-[140px]">
                                        <Select
                                            value={form.damageReceived}
                                            onValueChange={(v) => {
                                                const newForm = { ...form, damageReceived: v };
                                                if (v === "no") {
                                                    newForm.damagedQty = "";
                                                    newForm.damageReason = "";
                                                    newForm.damageImage = null;
                                                }
                                                setForm(newForm);
                                            }}
                                        >
                                            <SelectTrigger className="w-full h-9 bg-white border-slate-200 shadow-sm text-xs rounded-lg">
                                                <SelectValue placeholder="Damage?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="yes" className="text-red-600 font-medium">Yes, Damaged</SelectItem>
                                                <SelectItem value="no">No Damage</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {form.damageReceived === "yes" && (
                                    <div className="grid grid-cols-3 gap-4 pt-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-red-900 font-semibold">Damaged Qty <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="number"
                                                value={form.damagedQty}
                                                onChange={(e) => setForm({ ...form, damagedQty: e.target.value })}
                                                placeholder="0"
                                                className="bg-white border-red-200 focus:border-red-500 focus:ring-red-500 h-10 shadow-sm text-red-900 font-semibold rounded-lg"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-red-900 font-semibold">Reason <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={form.damageReason}
                                                onChange={(e) => setForm({ ...form, damageReason: e.target.value })}
                                                placeholder="Describe damage..."
                                                className="bg-white border-red-200 focus:border-red-500 focus:ring-red-500 h-10 shadow-sm text-red-900 text-sm rounded-lg"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-red-900 font-semibold font-medium">Damage Image</Label>
                                            <input
                                                id="damageImage"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setForm({ ...form, damageImage: e.target.files?.[0] || null })}
                                                className="hidden"
                                            />
                                            <label
                                                htmlFor="damageImage"
                                                className="flex items-center justify-center w-full h-10 border border-dashed border-red-300 rounded-lg cursor-pointer bg-white hover:bg-red-50/50 text-red-700 transition-colors shadow-sm"
                                            >
                                                <Upload className="w-4 h-4 mr-2 text-red-500" />
                                                <span className="text-xs font-semibold">Upload Image</span>
                                            </label>
                                            {form.damageImage && (
                                                <div className="mt-1.5 flex items-center justify-between text-[11px] text-red-800 bg-white/95 px-2 py-1 rounded border border-red-100 shadow-sm">
                                                    <span className="truncate max-w-[120px] font-medium">{form.damageImage.name}</span>
                                                    <button type="button" onClick={() => setForm({ ...form, damageImage: null })} className="hover:bg-red-100 p-0.5 rounded text-red-600 transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Card 4: Documentation & Remarks */}
                            <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label className="text-xs text-slate-600 font-semibold">Received Item Image</Label>
                                    <input
                                        id="receivedItemImage"
                                        type="file"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                receivedItemImage: e.target.files?.[0] ?? null,
                                            })
                                        }
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="receivedItemImage"
                                        className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl cursor-pointer transition-all h-[96px] text-center"
                                    >
                                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                                        <span className="text-[11px] text-slate-600 font-bold">Drop item image here or click</span>
                                        <span className="text-[9px] text-slate-400">JPG, PNG (max. 5MB)</span>
                                    </label>
                                    {form.receivedItemImage && (
                                        <div className="mt-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between shadow-sm">
                                            <div className="flex items-center min-w-0 mr-2">
                                                <FileText className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                                                <span className="text-xs text-slate-700 font-medium truncate">
                                                    {form.receivedItemImage.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile("receivedItemImage")}
                                                className="text-slate-400 hover:text-red-650 hover:bg-red-50 p-1 rounded-md transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 col-span-1">
                                    <Label className="text-xs text-slate-600 font-semibold">Remarks</Label>
                                    <textarea
                                        value={form.remarks}
                                        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                        className="w-full h-[96px] px-3 py-2 text-sm border border-slate-250 rounded-xl focus:border-blue-500 focus:ring-blue-500 resize-none placeholder:text-slate-400 shadow-sm"
                                        placeholder="Add any internal receiving notes or comments..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </form>
                    )}

                    <DialogFooter className="flex-shrink-0 border-t p-4 bg-slate-50 flex sm:justify-end items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                            className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700 transition-all font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={isBulkMode ? handleBulkSubmit : handleSubmit}
                            disabled={
                                isSubmitting ||
                                (isBulkMode
                                    ? !bulkItems.every((item) => item.receivedQty)
                                    : !formValid)
                            }
                            className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all font-semibold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Record Receipt"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}                                                                                   