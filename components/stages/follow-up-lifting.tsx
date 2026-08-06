"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  X,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  Truck,
  ClipboardList,
  History,
  Search,
  Download,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, parseSheetDate, formatDate, formatDateTimeFull, calculatePlannedDate, getPlannedDateForRecord, reportPendingCount } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

interface LiftingEntry {
  liftNumber: string;
  liftingQty: string;
  transporterName: string;
  vehicleNumber: string;
  contactNumber: string;
  billNo?: string;
  billDate?: string;
  areaLifting?: string;
  transportRateType?: string;
  freightAmount: string;
  advanceAmount: string;
  paymentDate: string;
  paymentStatus?: string;
  expectedDeliveryDate?: string;
  hasBilty?: string;
  biltyNumber?: string;
  biltyCopy: File | null;
  dispatchDate: string;
}

interface RecordLifting {
  recordId: string;
  status: string;
  followUpDate?: string;
  followUpStatus?: string;
  remarks?: string;
  quantity?: number | string;
  liftingData: LiftingEntry;
  indentNumber: string;
}

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const TransporterCombobox = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-10 justify-between bg-white border-green-200 shadow-sm"
        >
          {value ? value : "Select transporter..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search transporter..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground pb-2">No transporter found.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                  }}
                >
                  Create "{query}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const defaultLiftingData = (existLift: any = {}, recordQty: string = "0"): LiftingEntry => ({
  liftNumber: existLift.liftNumber || "",
  liftingQty: existLift.liftingQty || recordQty,
  transporterName: existLift.transporterName || "",
  vehicleNumber: existLift.vehicleNumber || "",
  contactNumber: existLift.contactNumber || "",
  billNo: existLift.billNo || "",
  billDate: existLift.billDate || "",
  areaLifting: existLift.areaLifting || "",
  transportRateType: existLift.transportRateType || "",
  freightAmount: existLift.freightAmount || "",
  advanceAmount: existLift.advanceAmount || "",
  paymentDate: existLift.paymentDate || "",
  paymentStatus: existLift.paymentStatus || "",
  expectedDeliveryDate: existLift.expectedDeliveryDate || "",
  hasBilty: existLift.hasBilty || "No",
  biltyNumber: existLift.biltyNumber || existLift.lrNumber || "",
  biltyCopy: existLift.biltyCopy || null,
  dispatchDate: existLift.dispatchDate || new Date().toISOString().split("T")[0],
});

export default function FollowUpLifting() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkFormData, setBulkFormData] = useState<RecordLifting[]>([]);
  const [liftCounter, setLiftCounter] = useState(1);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [receivingAccountsData, setReceivingAccountsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Unified form mode state
  const [isUnifiedMode, setIsUnifiedMode] = useState(false);
  const [commonVendorPO, setCommonVendorPO] = useState<{ vendor: string; poNumber: string } | null>(null);
  const [vendorPOMismatchError, setVendorPOMismatchError] = useState<string | null>(null);
  const [unifiedFormData, setUnifiedFormData] = useState<{
    status: string;
    followUpDate: string;
    followUpStatus?: string;
    remarks: string;
    liftingData: LiftingEntry;
  } | null>(null);
  const [unifiedLiftingQtys, setUnifiedLiftingQtys] = useState<Record<string, string>>({});
  const [processMode, setProcessMode] = useState<"follow-up" | "lift-material">("follow-up");
  const [commonBillCopy, setCommonBillCopy] = useState<File | string | null>(null);

  const handleCommonBillFileChange = (file: File | null) => {
    setCommonBillCopy(file);
  };
  const handleCommonBillFileRemove = () => {
    setCommonBillCopy(null);
  };

  const handleRemoveIndentFromLift = (recordId: string) => {
    const updatedIds = selectedRecordIds.filter(id => id !== recordId);
    if (updatedIds.length === 0) {
      resetBulk();
      return;
    }
    setSelectedRecordIds(updatedIds);
    setBulkFormData(prev => prev.filter(item => item.recordId !== recordId));
    setUnifiedLiftingQtys(prev => {
      const copy = { ...prev };
      delete copy[recordId];
      return copy;
    });
  };

  const baseColumns = [
    { key: "createdAtCol", label: "Timestamp", icon: null },
    { key: "indentNumber", label: "Indent No.", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "supplierName", label: "Supplier", icon: null },
    { key: "quantity", label: "Qty", icon: null },
    { key: "plannedDate", label: "Planned Date", icon: null },
    { key: "lastFollowUpDate", label: "Last Follow Up Date", icon: null },
    { key: "totalLifted", label: "Total Dispatch Qty", icon: null },
    { key: "cancelledQty", label: "Cancel Qty", icon: null },
    { key: "pendingLifted", label: "Pending Dispatch Qty", icon: null },
    { key: "estimatedDate", label: "Next Follow Up Date", icon: null },
    { key: "remarksFollowUp", label: "Last Follow Up Remark", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const [transporterList, setTransporterList] = useState<string[]>([]);
  const [areaList, setAreaList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tatRules, setTatRules] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [workflow, poResult, liftingResult, transResult, whResult, tatResult, cancelResult] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("purchase_orders").select("*"),
        supabase.from("vendor_liftings").select("*"),
        supabase.from("master_transporters").select("transporter_name").eq("is_active", true),
        supabase.from("master_warehouses").select("name").eq("is_active", true),
        supabase.from("master_tat_rules").select("*"),
        supabase.from("order_cancellations").select("po_id, financial_impact"),
      ]);

      if (tatResult.data) setTatRules(tatResult.data);

      const poData = poResult.data || [];
      const liftingData = liftingResult.data || [];

      // financial_impact on order_cancellations actually stores the
      // cancelled quantity (see order-cancel.tsx) — sum it per PO so pending
      // lifting can account for quantity that's been cancelled, not just
      // quantity still awaiting dispatch.
      const cancelQtyByPoId = new Map<string, number>();
      (cancelResult.data || []).forEach((c: any) => {
        if (!c.po_id) return;
        cancelQtyByPoId.set(c.po_id, (cancelQtyByPoId.get(c.po_id) || 0) + (parseFloat(c.financial_impact) || 0));
      });

      if (transResult.data) {
        setTransporterList(transResult.data.map((r: any) => r.transporter_name).filter(Boolean));
      }
      if (whResult.data) {
        setAreaList(whResult.data.map((r: any) => r.name).filter(Boolean));
      }

      // Group all POs by indent_id (one indent can have multiple POs)
      const posByIndentId = new Map<string, any[]>();
      poData.forEach((po) => {
        if (po.indent_id) {
          const list = posByIndentId.get(po.indent_id) || [];
          list.push(po);
          posByIndentId.set(po.indent_id, list);
        }
      });

      const liftingsByPoId = new Map<string, any[]>();
      liftingData.forEach((lift) => {
        if (lift.po_id) {
          const list = liftingsByPoId.get(lift.po_id) || [];
          list.push(lift);
          liftingsByPoId.set(lift.po_id, list);
        }
      });

      const historyRows = liftingData.map((lift, i) => {
        const po = poData.find((p) => p.id === lift.po_id);
        const indent = workflow.find((w) => w.id === po?.indent_id);
        return {
          id: lift.id,
          createdAt: indent?.data.createdAt || "",
          indentNumber: indent?.data.indentNumber || "",
          liftNo: `LIFT-${String(i + 1).padStart(3, "0")}`,
          vendorName: po?.vendor_name || "",
          poNumber: po?.po_number || "",
          nextFollowUpDate: lift.followup_date || "",
          remarks: lift.remarks || "",
          itemName: indent?.data.itemName || "",
          liftingQty: "",
          transporterName: "",
          vehicleNo: lift.vehicle_number || "",
          contactNo: lift.driver_contact || "",
          lrNo: "",
          dispatchDate: lift.actual_lifting_date || "",
          freightAmount: "",
          advanceAmount: "",
          paymentDate: "",
          paymentStatus: "",
          biltyCopy: "",
        };
      });
      setReceivingAccountsData(historyRows);

      // Create ONE ROW per PO (not per indent)
      // This ensures all POs for same indent are separately visible and processable
      const rows: any[] = [];
      workflow
        .filter((row) => row.data.indentNumber && row.data.indentNumber.trim() !== "")
        .forEach((row) => {
          const posForThisIndent = posByIndentId.get(row.id) || [];

          if (posForThisIndent.length === 0) {
            // No PO yet — show one "not_ready" row
            rows.push({
              id: row.id,
              rowIndex: row.originalIndex,
              stage: 5,
              status: "not_ready",
              createdAt: row.data.createdAt,
              history: [],
              data: {
                indentNumber: row.data.indentNumber,
                itemName: row.data.itemName,
                supplierName: row.data.selectedVendorName || row.data.vendor1Name || "-",
                vendorType: row.data.vendorType || "",
                quantity: row.data.quantity,
                selectedVendor: row.data.selectedVendor,
                vendor1Name: row.data.vendor1Name,
                vendor1PoNumber: "",
                vendor2Name: row.data.vendor2Name,
                vendor2PoNumber: "",
                vendor3Name: row.data.vendor3Name,
                vendor3PoNumber: "",
                finalVendorName: row.data.selectedVendorName,
                estimatedDate: "",
                remarksFollowUp: "",
                lastFollowUpDate: "",
                totalLifted: "0",
                cancelledQty: "0",
                pendingLifted: String(row.data.quantity || 0),
                liftingData: { liftingQty: String(row.data.quantity || 0) },
              },
              basicValue: 0,
              _poId: null,
            });
            return;
          }

          // One row per PO
          posForThisIndent.forEach((po) => {
            const poLiftings = liftingsByPoId.get(po.id) || [];
            const totalQty = parseFloat(String(po.quantity || row.data.quantity || "0").replace(/,/g, "")) || 0;
            const totalLiftedSoFar = poLiftings.reduce((sum: number, l: any) => sum + (parseFloat(String(l.lifting_qty || "0").replace(/,/g, "")) || 0), 0);
            const cancelledQty = cancelQtyByPoId.get(po.id) || 0;
            const pendingLiftQty = Math.max(0, totalQty - (totalLiftedSoFar + cancelledQty));

            let status = "pending";
            if ((totalLiftedSoFar + cancelledQty) >= totalQty && totalQty > 0) {
              status = "completed";
            }

            const latestLifting = poLiftings.length > 0 ? poLiftings[poLiftings.length - 1] : null;

            rows.push({
              id: `${row.id}__${po.id}`,   // unique id per PO row
              rowIndex: row.originalIndex,
              stage: 5,
              status,
              createdAt: row.data.createdAt,
              history: status === "completed"
                ? [{ stage: 5, date: latestLifting?.actual_lifting_date || row.data.createdAt, data: {} }]
                : [],
              data: {
                indentNumber: row.data.indentNumber,
                itemName: po.item_name || row.data.itemName,
                supplierName: po.vendor_name || row.data.selectedVendorName || row.data.vendor1Name || "-",
                vendorType: row.data.vendorType || "",
                quantity: String(po.quantity || row.data.quantity),
                selectedVendor: row.data.selectedVendor,
                vendor1Name: row.data.vendor1Name,
                vendor1PoNumber: po.po_number,
                vendor2Name: row.data.vendor2Name,
                vendor2PoNumber: po.po_number,
                vendor3Name: row.data.vendor3Name,
                vendor3PoNumber: po.po_number,
                finalVendorName: po.vendor_name || row.data.selectedVendorName,
                estimatedDate: latestLifting?.expected_lifting_date || "",
                remarksFollowUp: latestLifting?.remarks || "",
                lastFollowUpDate: latestLifting?.followup_date || "",
                totalLifted: String(totalLiftedSoFar),
                cancelledQty: String(cancelledQty),
                pendingLifted: String(pendingLiftQty),
                poNumber: po.po_number,
                liftingData: latestLifting && latestLifting.lifting_status === "Complete"
                  ? {
                      liftNumber: latestLifting.id?.slice(0, 8) || "",
                      liftingQty: String(pendingLiftQty),
                      transporterName: "",
                      vehicleNumber: latestLifting.vehicle_number || "",
                      contactNumber: latestLifting.driver_contact || "",
                      dispatchDate: latestLifting.actual_lifting_date || "",
                    }
                  : {
                      liftingQty: String(pendingLiftQty),
                    },
              },
              basicValue: po.total_amount || 0,
              _poId: po.id,
              _indentId: row.id,
            });
          });
        });

      setSheetRecords(rows);

    } catch (error) {
      console.error("Fetch error:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getVendorData = (record: any) => {
    if (!record) return { name: "-", poNumber: "-" };
    const sel = String(record.data?.selectedVendor || "").trim();
    const po = record.data?.vendor1PoNumber || record.data?.vendor2PoNumber || record.data?.vendor3PoNumber || record.data?.poNumber || "-";

    let name = String(
      record.data?.supplierName ||
      record.data?.vendorName ||
      ""
    ).trim();

    if (!name || name === "-" || name.toLowerCase() === "regular vendor") {
      const candidates = [
        record.data?.finalVendorName,
        record.data?.selectedVendorName,
        record.data?.vendor1Name,
        record.data?.vendor2Name,
        record.data?.vendor3Name,
        record.vendorName
      ].filter((n) => n && String(n).trim() !== "" && String(n).trim() !== "-" && String(n).toLowerCase() !== "regular vendor");

      if (candidates.length > 0) {
        name = String(candidates[0]);
      }
    }

    if (!name || name === "-") {
      name = record.data?.supplierName || record.data?.vendorName || record.data?.selectedVendorName || "Regular Vendor";
    }

    return { name: name || "-", poNumber: po };
  };

  // Any other PENDING row sharing the same PO Number as `recordId` (a PO can
  // span multiple indents when entered together in PO Entry), so the user
  // never has to hunt down and manually tick every row for that PO.
  const getSamePORecordIds = (recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return [recordId];
    const poNum = String(getVendorData(record).poNumber || "").trim();
    if (!poNum || poNum === "-") return [recordId];

    return sheetRecords
      .filter((r) => r.status === "pending" && String(getVendorData(r).poNumber || "").trim() === poNum)
      .map((r) => r.id);
  };

  const checkVendorPOMatch = (ids: string[]) => {
    if (ids.length <= 1) return { isMatched: true, vendor: "", poNumber: "" };
    let vendor = "";
    let poNumber = "";

    for (let i = 0; i < ids.length; i++) {
      const record = sheetRecords.find((r) => r.id === ids[i]);
      if (!record) continue;
      const vInfo = getVendorData(record);
      if (i === 0) {
        vendor = String(vInfo.name).trim();
        poNumber = String(vInfo.poNumber).trim();
      } else {
        if (String(vInfo.name).trim() !== vendor || String(vInfo.poNumber).trim() !== poNumber) {
          return { isMatched: false, vendor: "", poNumber: "" };
        }
      }
    }
    return { isMatched: true, vendor, poNumber };
  };

  // Shared entry point for both single-row "Process" clicks and the
  // "Process Selected" bulk button — always operates on the full PO group.
  const beginProcessing = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedRecordIds(ids);
    setProcessMode("follow-up");
    setVendorPOMismatchError(null);
    setIsUnifiedMode(ids.length > 1);

    if (ids.length > 1) {
      const vInfo = getVendorData(sheetRecords.find((r) => r.id === ids[0]));
      setCommonVendorPO({ vendor: vInfo.name, poNumber: vInfo.poNumber });
    } else {
      setCommonVendorPO(null);
    }

    setUnifiedFormData({
      status: "follow-up",
      followUpDate: "",
      followUpStatus: "Intransit",
      remarks: "",
      liftingData: defaultLiftingData(),
    });

    const initialData = ids.map((id) => {
      const record = sheetRecords.find((r) => r.id === id)!;
      const existLift = record.data.liftingData || {};

      return {
        recordId: id,
        status: "follow-up",
        followUpDate: "",
        followUpStatus: "Intransit",
        remarks: "",
        liftingData: defaultLiftingData(existLift, String(record.data.quantity || 0)),
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      };
    });
    setBulkFormData(initialData);
    setOpen(true);
  };

  const handleProcessDirect = (recordId: string) => {
    beginProcessing(getSamePORecordIds(recordId));
  };

  const handleBulkProcessDirect = () => {
    if (selectedRecordIds.length === 0) return;
    // Expand the manual selection to include any same-PO rows not yet ticked.
    const expanded = new Set<string>();
    selectedRecordIds.forEach((id) => getSamePORecordIds(id).forEach((gid) => expanded.add(gid)));
    beginProcessing(Array.from(expanded));
  };

  const toggleDialogMode = (newMode: "follow-up" | "lift-material") => {
    if (newMode === processMode) return;
    setProcessMode(newMode);

    if (newMode === "follow-up") {
      setVendorPOMismatchError(null);
      setUnifiedFormData(prev => ({
        status: "follow-up",
        followUpDate: prev?.followUpDate || bulkFormData[0]?.followUpDate || "",
        followUpStatus: prev?.followUpStatus || bulkFormData[0]?.followUpStatus || "Intransit",
        remarks: prev?.remarks || bulkFormData[0]?.remarks || "",
        liftingData: defaultLiftingData(),
      }));
      setBulkFormData(prev => prev.map(item => ({
        ...item,
        status: "follow-up",
        followUpStatus: item.followUpStatus || "Intransit",
      })));
    } else {
      if (selectedRecordIds.length > 1) {
        const matchResult = checkVendorPOMatch(selectedRecordIds);
        if (!matchResult.isMatched) {
          setIsUnifiedMode(false);
          setVendorPOMismatchError("Vendor Name or PO number not matched for the selected items.");
          setCommonVendorPO(null);
          setUnifiedFormData(null);
          setBulkFormData([]);
          return;
        }
        setIsUnifiedMode(true);
        setCommonVendorPO({ vendor: matchResult.vendor, poNumber: matchResult.poNumber });
      } else {
        const record = sheetRecords.find(r => r.id === selectedRecordIds[0]);
        const vInfo = getVendorData(record);
        setIsUnifiedMode(true);
        setCommonVendorPO({ vendor: vInfo.name, poNumber: vInfo.poNumber });
      }

      setVendorPOMismatchError(null);
      setUnifiedFormData({
        status: "lift-material",
        followUpDate: "",
        remarks: "",
        liftingData: defaultLiftingData(),
      });

      const qtys: Record<string, string> = {};
      selectedRecordIds.forEach(id => {
        const record = sheetRecords.find(r => r.id === id);
        if (record) {
          const totalQty = parseFloat(String(record.data.quantity || 0).replace(/,/g, "")) || 0;
          const totalLiftedQty = parseFloat(String(record.data.totalLifted || 0).replace(/,/g, "")) || 0;
          const pendingQty = Math.max(0, totalQty - totalLiftedQty);
          qtys[id] = String(pendingQty);
        } else {
          qtys[id] = "0";
        }
      });
      setUnifiedLiftingQtys(qtys);

      setBulkFormData(prev => prev.map(item => {
        const record = sheetRecords.find(r => r.id === item.recordId)!;
        const existLift = record?.data?.liftingData || {};
        const totalQty = parseFloat(String(record?.data?.quantity || 0).replace(/,/g, "")) || 0;
        const totalLiftedQty = parseFloat(String(record?.data?.totalLifted || 0).replace(/,/g, "")) || 0;
        const pendingQty = Math.max(0, totalQty - totalLiftedQty);
        return {
          ...item,
          status: "lift-material",
          liftingData: {
            ...defaultLiftingData(existLift, String(pendingQty)),
            liftingQty: String(pendingQty)
          },
        };
      }));
    }
  };

  const handleUnifiedQtyChange = (id: string, value: string) => {
    setUnifiedLiftingQtys(prev => ({ ...prev, [id]: value }));
  };

  const updateLiftingEntry = (
    recordIndex: number,
    field: keyof LiftingEntry | 'paymentStatus',
    value: any
  ) => {
    setBulkFormData((prev) => {
      const updated = [...prev];
      updated[recordIndex].liftingData = {
        ...updated[recordIndex].liftingData,
        [field]: value,
      };
      return updated;
    });
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      const { data: existingLiftings } = await supabase
        .from("vendor_liftings")
        .select("id, po_id");

      const tempCountMap = new Map<string, number>();
      const getUniqueLiftNumber = (indentNo: string) => {
        const cleanIndent = String(indentNo).trim();
        const count = existingLiftings?.filter((l) => {
          const po = sheetRecords.find((r) => r._poId === l.po_id);
          return po && String(po.data.indentNumber).trim() === cleanIndent;
        }).length || 0;
        const batchCount = tempCountMap.get(cleanIndent) || 0;
        const totalCount = count + batchCount;
        tempCountMap.set(cleanIndent, batchCount + 1);
        return `LIFT-${totalCount + 1}`;
      };

      for (let i = 0; i < bulkFormData.length; i++) {
        let record = bulkFormData[i];

        if (isUnifiedMode && unifiedFormData) {
          record = {
            ...record,
            status: unifiedFormData.status,
            followUpDate: unifiedFormData.followUpDate,
            // followUpStatus is intentionally NOT overwritten from the shared
            // unifiedFormData here — each item keeps its own individually
            // chosen status (see the per-item Status control below), so
            // marking one item "Received" in a multi-item follow-up no
            // longer drags every other selected item along with it.
            remarks: unifiedFormData.remarks,
            liftingData: {
              ...record.liftingData,
              ...unifiedFormData.liftingData,
              liftingQty: unifiedLiftingQtys[record.recordId] || "",
              liftNumber: record.liftingData.liftNumber || "",
              biltyCopy: unifiedFormData.liftingData.biltyCopy,
            },
          };
        }

        const sheetRecord = sheetRecords.find((r) => r.id === record.recordId)!;
        const lift = record.liftingData;

        const enteredQty = parseFloat(String(lift.liftingQty || "0").replace(/,/g, "")) || 0;
        const allowedQty = parseFloat(String(sheetRecord.data.quantity || "0").replace(/,/g, "")) || 0;

        if (record.status === "lift-material" && enteredQty > allowedQty && allowedQty > 0) {
          toast.error(`Lifting quantity (${enteredQty}) cannot be greater than approved quantity (${allowedQty}) for Indent ${sheetRecord.data.indentNumber}!`, {
            style: { background: "red", color: "white", border: "none" }
          });
          setIsSubmitting(false);
          return;
        }

        const uniqueLiftNo = getUniqueLiftNumber(sheetRecord.data.indentNumber);
        lift.liftNumber = uniqueLiftNo;

        const toYMD = (dateStr: string) => {
          if (!dateStr) return "";
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return "";
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        const followUpDateFormatted = toYMD(record.followUpDate || "");
        const expectedDeliveryDateFormatted = toYMD(lift.expectedDeliveryDate || "");

        // In Follow-Up mode, "Received" behaves like completing the lift
        // (same as switching to Material Lifting mode) — "Intransit" keeps
        // it pending, matching Transporter Follow-Up's own status meaning.
        const isFollowUpMode = record.status === "follow-up";
        const followUpReceived = isFollowUpMode && record.followUpStatus === "Received";

        // defaultLiftingData() prefills liftingQty with the record's full
        // pending quantity for BOTH modes, even though the Follow-Up form
        // has no quantity field of its own — so blindly saving lift.liftingQty
        // here recorded the *entire* quantity as "lifted" on every Follow-Up
        // submission (Intransit included), which is what silently completed
        // the PO and knocked it out of Pending regardless of the status picked.
        // Only "Received" should count as anything actually lifted; a plain
        // Intransit follow-up hasn't lifted anything yet.
        const followUpLiftQty = followUpReceived
          ? (parseFloat(String(sheetRecord.data.quantity || "0").replace(/,/g, "")) || null)
          : null;

        const liftingRecord: any = {
          po_id: sheetRecord._poId || null,
          contact_person: lift.contactNumber || "",
          followup_date: followUpDateFormatted || null,
          expected_lifting_date: expectedDeliveryDateFormatted || null,
          vehicle_number: lift.vehicleNumber || "",
          driver_contact: lift.contactNumber || "",
          lifting_status: (record.status === "lift-material" || followUpReceived) ? "Complete" : "Pending",
          lifting_qty: isFollowUpMode
            ? followUpLiftQty
            : (parseFloat(lift.liftingQty || unifiedLiftingQtys[record.recordId] || "0") || null),
          freight_amount: parseFloat(lift.freightAmount) || null,
          transport_rate: lift.transportRateType || null,
          remarks: record.remarks || "",
        };

        if (record.status === "lift-material" || followUpReceived) {
          liftingRecord.actual_lifting_date = toYMD(new Date().toISOString()) || null;
        }

        const { data: insertedLifting, error: insertError } = await supabase
          .from("vendor_liftings")
          .insert(liftingRecord)
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to insert lifting record:", insertError);
          toast.error("Failed to save lifting record");
        }

        if (isFollowUpMode) {
          // Log the vendor follow-up outcome (Intransit / Received) so
          // downstream stages (Transporter Follow-Up, Payment) recognize the
          // same status transition they already understand from that stage.
          await supabase.from("transporter_followups").insert({
            po_id: sheetRecord._poId,
            lifting_id: insertedLifting?.id || null,
            status: record.followUpStatus || "Intransit",
            dispatch_date: toYMD(new Date().toISOString()),
          });
        } else if (sheetRecord._poId && (lift.transporterName || lift.vehicleNumber || lift.freightAmount || lift.biltyNumber)) {
          await supabase.from("transporter_followups").insert({
            po_id: sheetRecord._poId,
            lifting_id: insertedLifting?.id || null,
            transporter_name: lift.transporterName || "",
            vehicle_number: lift.vehicleNumber || "",
            bilty_number: lift.biltyNumber || null,
            freight_amount: parseFloat(lift.freightAmount) || null,
            status: "Intransit",
            dispatch_date: toYMD(new Date().toISOString()),
          });
        }
      }

      toast.success("Processed successfully!");
      setOpen(false);
      resetBulk();
      await fetchData();
    } catch (error: any) {
      console.error("Bulk submit error:", error);
      toast.error(error.message || "Failed to submit updates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBulk = () => {
    setOpen(false);
    setSelectedRecordIds([]);
    setBulkFormData([]);
    setIsUnifiedMode(false);
    setCommonVendorPO(null);
    setVendorPOMismatchError(null);
    setUnifiedFormData(null);
    setUnifiedLiftingQtys({});
    setCommonBillCopy(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedRecordIds((prev) => {
      const groupIds = getSamePORecordIds(id);
      if (prev.includes(id)) {
        const groupSet = new Set(groupIds);
        return prev.filter((x) => !groupSet.has(x));
      }
      return Array.from(new Set([...prev, ...groupIds]));
    });
  };

  const selectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  const isBulkValid = (() => {
    if (vendorPOMismatchError) return false;

    if (processMode === "follow-up") {
      const followUpDate = (isUnifiedMode ? unifiedFormData?.followUpDate : null) || bulkFormData[0]?.followUpDate;
      const hasValidDate = !!(followUpDate && String(followUpDate).trim() !== "");
      if (isUnifiedMode && bulkFormData.length > 1) {
        // Every item needs its own status now — not one shared value.
        return hasValidDate && bulkFormData.every((item) => !!item.followUpStatus);
      }
      const followUpStatus = (isUnifiedMode ? unifiedFormData?.followUpStatus : null) || bulkFormData[0]?.followUpStatus;
      return hasValidDate && !!followUpStatus;
    }

    if (isUnifiedMode && unifiedFormData) {
      if (!unifiedFormData.status) return false;
      if (unifiedFormData.status === "lift-material") {
        const e = unifiedFormData.liftingData;
        const allQtysValid = selectedRecordIds.length > 0 && selectedRecordIds.every(id => {
          const val = parseFloat(unifiedLiftingQtys[id] || "0") || 0;
          return val > 0;
        });

        return !!(
          (e.transporterName || e.vehicleNumber) &&
          allQtysValid
        );
      }
      return false;
    }

    return bulkFormData.length > 0 &&
      bulkFormData.every((item) => {
        if (!item.status) return false;
        if (item.status === "lift-material") {
          const e = item.liftingData;
          const qty = parseFloat(e.liftingQty || "0") || 0;
          return !!(
            (e.transporterName || e.vehicleNumber) &&
            qty > 0
          );
        }
        return false;
      });
  })();

  const handleExportPendingCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const headers = [
          ...baseColumns.filter((c) => selectedColumns.includes(c.key)).map((c) => c.label),
          "Vendor",
          "PO Number",
          "Basic Value"
        ];

        const rowData = pending.map((record) => {
          const v = getVendorData(record);
          const baseData = baseColumns
            .filter((c) => selectedColumns.includes(c.key))
            .map((col) => {
              const val = record.data[col.key];
              if (col.key === "lastFollowUpDate" || col.key === "estimatedDate") {
                return formatDateDash(val);
              }
              return val || "-";
            });

          return [
            ...baseData,
            v.name || "-",
            v.poNumber || "-",
            record.basicValue || "-"
          ];
        });

        const csvContent =
          "data:text/csv;charset=utf-8," +
          [headers.join(","), ...rowData.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Follow_UP_Lifting_Pending_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Export CSV error:", error);
        toast.error("Failed to export CSV file");
      } finally {
        setIsExporting(false);
      }
    }, 1000);
  };

  const pending = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const v = getVendorData(r);
        return (
          r.data.indentNumber?.toLowerCase().includes(term) ||
          r.data.itemName?.toLowerCase().includes(term) ||
          r.data.quantity?.toString().includes(term) ||
          r.data.lastFollowUpDate?.toLowerCase().includes(term) ||
          v.name?.toLowerCase().includes(term) ||
          v.poNumber?.toLowerCase().includes(term)
        );
      });
  }, [sheetRecords, searchTerm]);

  useEffect(() => { reportPendingCount("Follow UP / Lifting", pending.length); }, [pending.length]);

  const history = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return receivingAccountsData.filter((r) => {
      return (
        r.indentNumber?.toLowerCase().includes(term) ||
        r.liftNo?.toLowerCase().includes(term) ||
        r.vendorName?.toLowerCase().includes(term) ||
        r.poNumber?.toLowerCase().includes(term) ||
        r.itemName?.toLowerCase().includes(term) ||
        r.vehicleNo?.toLowerCase().includes(term)
      );
    });
  }, [receivingAccountsData, searchTerm]);

  const pendingPagination = usePagination(pending, 15);
  const historyPagination = usePagination(history, 15);

  const handleColumnToggle = useCallback((key: string, checked: boolean) => {
    setSelectedColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  }, []);

  const renderItemDetailsCard = () => {
    if (isUnifiedMode) {
      return (
        <div className="bg-linear-to-r from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-5 mb-6 shadow-sm shrink-0">
          {processMode === "follow-up" && (
            <>
              <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2">
                <span className="p-1.5 bg-blue-700 text-white rounded text-[10px] font-bold">Selected Items</span>
                <span>Batch Details ({bulkFormData.length} Indents)</span>
              </h4>
              {bulkFormData.length > 1 ? (
                // Each item gets its own Status — marking one "Received"
                // must not drag the rest of the batch along with it.
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold">Indent</th>
                        <th className="text-left px-3 py-2 font-bold">Item</th>
                        <th className="text-right px-3 py-2 font-bold">Qty</th>
                        <th className="text-left px-3 py-2 font-bold w-40">Status *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkFormData.map((item) => {
                        const record = sheetRecords.find((r) => r.id === item.recordId);
                        return (
                          <tr key={item.recordId} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono font-semibold text-slate-800">{record?.data.indentNumber}</td>
                            <td className="px-3 py-2 text-slate-700">{record?.data.itemName}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{record?.data.quantity}</td>
                            <td className="px-3 py-2">
                              <Select
                                value={item.followUpStatus || "Intransit"}
                                onValueChange={(val) => {
                                  setBulkFormData((prev) =>
                                    prev.map((b) => b.recordId === item.recordId ? { ...b, followUpStatus: val, status: "follow-up" } : b)
                                  );
                                }}
                              >
                                <SelectTrigger className="bg-white border-slate-200 h-8 text-xs">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border">
                                  <SelectItem value="Intransit">Intransit</SelectItem>
                                  <SelectItem value="Received">Received</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {bulkFormData.map((item) => {
                    const record = sheetRecords.find((r) => r.id === item.recordId);
                    return (
                      <Badge key={item.recordId} variant="secondary" className="bg-white border-slate-200 px-3 py-1 font-semibold text-slate-700 text-xs">
                        {record?.data.indentNumber} - {record?.data.itemName} (Qty: {record?.data.quantity})
                      </Badge>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4 text-xs", processMode === "follow-up" && "pt-3 border-t border-slate-200/60")}>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor</span>
              <span className="font-semibold text-slate-800">
                {commonVendorPO?.vendor || getVendorData(sheetRecords.find(r => r.id === bulkFormData[0]?.recordId)).name}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">PO Number</span>
              <span className="font-semibold text-slate-800 font-mono">
                {commonVendorPO?.poNumber || getVendorData(sheetRecords.find(r => r.id === bulkFormData[0]?.recordId)).poNumber}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (bulkFormData.length === 1) {
      const record = sheetRecords.find((r) => r.id === bulkFormData[0].recordId);
      const v = getVendorData(record);
      return (
        <div className="bg-linear-to-r from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-5 mb-6 shadow-sm shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Indent Number</span>
            <span className="font-bold text-slate-900 text-sm">{record?.data.indentNumber}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Item Details</span>
            <span className="font-semibold text-slate-800 text-sm">{record?.data.itemName} (Qty: {record?.data.quantity})</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor Name</span>
            <span className="font-semibold text-slate-800 text-sm">{v.name}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">PO Number</span>
            <span className="font-semibold text-slate-800 font-mono text-sm">{v.poNumber}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Follow UP & Lifting</h2>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-white border-slate-200">
                    Columns <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 bg-white border p-2" align="end">
                  <div className="space-y-1.5">
                    {baseColumns.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={(checked) => handleColumnToggle(col.key, !!checked)}
                        />
                        <Label htmlFor={`col-${col.key}`} className="text-xs cursor-pointer select-none font-medium text-slate-700">
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
          <TabsList className="bg-slate-100/80 p-1 rounded-lg">
            <TabsTrigger value="pending" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Pending</span>
              <Badge variant="secondary" className="bg-blue-700 text-white px-2">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            {selectedRecordIds.length > 0 && activeTab === "pending" && (
              <Button
                disabled={selectedRecordIds.length === 0}
                size="sm"
                onClick={handleBulkProcessDirect}
                className="bg-blue-700 hover:bg-blue-800 text-white"
              >
                Process Selected ({selectedRecordIds.length})
              </Button>
            )}

            {activeTab === "pending" && (
              <Button
                onClick={handleExportPendingCSV}
                disabled={isExporting}
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Export CSV</span>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="pending" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-slate-950 mb-3" />
              <p className="font-semibold text-slate-700 text-sm">Syncing spreadsheet records...</p>
            </div>
          )}

          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={selectedRecordIds.length === pending.length && pending.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead className="text-center w-24">Actions</TableHead>
                    {baseColumns
                      .filter((c) => selectedColumns.includes(c.key))
                      .map((c) => (
                        <TableHead key={c.key} className={cn((c.key === "totalLifted" || c.key === "cancelledQty" || c.key === "pendingLifted") && "text-center")}>
                          {c.label}
                        </TableHead>
                      ))}
                    <TableHead>PO Number</TableHead>
                    <TableHead className="text-right">Basic Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 4} className="h-32 text-center text-slate-400 font-medium">
                        No pending follow-up indents found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingPagination.pageData.map((record) => {
                      const v = getVendorData(record);
                      return (
                        <TableRow key={record.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedRecordIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleProcessDirect(record.id)}
                            >
                              Process
                            </Button>
                          </TableCell>
                          {baseColumns
                            .filter((c) => selectedColumns.includes(c.key))
                            .map((col) => (
                              <TableCell key={col.key} className={cn((col.key === "totalLifted" || col.key === "cancelledQty" || col.key === "pendingLifted") && "text-center")}>
                                {col.key === "supplierName" ? (
                                  <span className="font-semibold text-slate-800">{record.data.supplierName || v.name}</span>
                                ) : col.key === "createdAtCol" ? (
                                  <span className="font-mono text-xs text-slate-700">{formatDateTimeFull(record.createdAt)}</span>
                                ) : col.key === "plannedDate" ? (
                                  <span className="font-mono text-xs text-slate-700">
                                    {getPlannedDateForRecord(record.data, "Follow UP / Lifting", tatRules, record.createdAt)}
                                  </span>
                                ) : col.key === "lastFollowUpDate" || col.key === "estimatedDate"
                                  ? formatDateDash(record.data[col.key])
                                  : record.data[col.key] || "-"}
                              </TableCell>
                            ))}
                          <TableCell className="font-mono text-slate-600">{record.data.poNumber || record.data.vendor1PoNumber || "-"}</TableCell>
                          <TableCell className="text-right font-medium text-slate-800">
                            {record.basicValue ? `₹ ${parseFloat(String(record.basicValue).replace(/,/g, '')).toLocaleString()}` : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={pendingPagination.page}
              pageSize={pendingPagination.pageSize}
              totalCount={pendingPagination.totalCount}
              onPageChange={pendingPagination.setPage}
              onPageSizeChange={pendingPagination.setPageSize}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead>Lift Number</TableHead>
                    <TableHead>Indent No</TableHead>
                    <TableHead>Item Details</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead className="text-center">Lifting Qty</TableHead>
                    <TableHead>Planned Date</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Vehicle No</TableHead>
                    <TableHead>LR / Bilty</TableHead>
                    <TableHead>Dispatch Date</TableHead>
                    <TableHead className="text-right">Freight Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-32 text-center text-slate-400 font-medium">
                        No material lifting history logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyPagination.pageData.map((h) => (
                      <TableRow key={h.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800">{h.liftNo}</TableCell>
                        <TableCell className="font-mono">{h.indentNumber}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{h.itemName}</TableCell>
                        <TableCell>{h.vendorName}</TableCell>
                        <TableCell className="font-mono">{h.poNumber}</TableCell>
                        <TableCell className="text-center font-semibold">{h.liftingQty}</TableCell>
                        <TableCell className="font-mono">{getPlannedDateForRecord(h, "Follow UP / Lifting", tatRules, h.createdAt)}</TableCell>
                        <TableCell>{h.transporterName}</TableCell>
                        <TableCell className="font-mono uppercase">{h.vehicleNo}</TableCell>
                        <TableCell>
                          {h.lrNo ? (
                            <span className="flex items-center gap-1">
                              {h.lrNo}
                              {h.biltyCopy && h.biltyCopy.startsWith("http") && (
                                <a href={h.biltyCopy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                  <FileText className="w-3.5 h-3.5 ml-1" />
                                </a>
                              )}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{formatDateDash(h.dispatchDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {h.freightAmount ? `₹ ${parseFloat(String(h.freightAmount).replace(/,/g, '')).toLocaleString()}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={historyPagination.page}
              pageSize={historyPagination.pageSize}
              totalCount={historyPagination.totalCount}
              onPageChange={historyPagination.setPage}
              onPageSizeChange={historyPagination.setPageSize}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* PROCESS MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 bg-white border rounded-2xl shadow-xl overflow-hidden">
          <DialogHeader className="shrink-0 border-b p-6 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  {processMode === "follow-up" ? "Follow-Up Details" : "Material Lifting & Dispatch"}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {vendorPOMismatchError
                    ? "Cannot proceed with submission."
                    : isUnifiedMode
                      ? `Updating ${bulkFormData.length} indents with common details.`
                      : "Update multiple indents at once."}
                </p>
              </div>
            </div>

            {/* Mode Switch Header inside Modal */}
            {!vendorPOMismatchError && (
              <div className="flex bg-slate-200/60 p-1 rounded-lg w-fit mx-auto mt-4 shrink-0 border border-slate-300/30">
                <button
                  type="button"
                  onClick={() => toggleDialogMode("follow-up")}
                  className={cn(
                    "px-6 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                    processMode === "follow-up"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Follow-UP
                </button>
                <button
                  type="button"
                  onClick={() => toggleDialogMode("lift-material")}
                  className={cn(
                    "px-6 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                    processMode === "lift-material"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Material Lifting
                </button>
              </div>
            )}
          </DialogHeader>

          {/* Modal Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Mismatch Error Message */}
            {vendorPOMismatchError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                  <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-red-700 mb-2">Cannot Proceed</h4>
                  <p className="text-red-600 text-sm">{vendorPOMismatchError}</p>
                  <p className="text-xs text-gray-500 mt-4">
                    Please select items with the same Vendor and PO Number to use bulk material lifting.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Same Indent Information Card at the top of BOTH forms */}
                {renderItemDetailsCard()}

                {processMode === "follow-up" ? (
                  /* Follow-Up Form */
                  <form onSubmit={handleBulkSubmit} className="space-y-6">
                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-4">
                      <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Follow-Up Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* When multiple items are selected, Status is set per-item in the
                            table above instead of one shared field for the whole batch. */}
                        {!(isUnifiedMode && bulkFormData.length > 1) && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">
                              Status *
                            </Label>
                            <Select
                              value={
                                (isUnifiedMode ? unifiedFormData?.followUpStatus : null) ||
                                bulkFormData[0]?.followUpStatus ||
                                "Intransit"
                              }
                              onValueChange={(val) => {
                                setUnifiedFormData((prev) => ({
                                  status: "follow-up",
                                  followUpDate: prev?.followUpDate || bulkFormData[0]?.followUpDate || "",
                                  followUpStatus: val,
                                  remarks: prev?.remarks || bulkFormData[0]?.remarks || "",
                                  liftingData: prev?.liftingData || defaultLiftingData(),
                                }));
                                setBulkFormData((prev) =>
                                  prev.map((item) => ({ ...item, followUpStatus: val, status: "follow-up" }))
                                );
                              }}
                            >
                              <SelectTrigger className="bg-white border-slate-200 h-10 shadow-sm">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border">
                                <SelectItem value="Intransit">Intransit</SelectItem>
                                <SelectItem value="Received">Received</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className={cn("space-y-2", isUnifiedMode && bulkFormData.length > 1 && "md:col-span-2")}>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">
                            Estimated Requirement Date *
                          </Label>
                          <Input
                            type="date"
                            required
                            value={
                              (isUnifiedMode ? unifiedFormData?.followUpDate : null) ||
                              bulkFormData[0]?.followUpDate ||
                              ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setUnifiedFormData((prev) => ({
                                status: "follow-up",
                                followUpDate: val,
                                followUpStatus: prev?.followUpStatus || bulkFormData[0]?.followUpStatus || "Intransit",
                                remarks: prev?.remarks || bulkFormData[0]?.remarks || "",
                                liftingData: prev?.liftingData || defaultLiftingData(),
                              }));
                              setBulkFormData((prev) =>
                                prev.map((item) => ({ ...item, followUpDate: val, status: "follow-up" }))
                              );
                            }}
                            className="bg-white border-slate-200 h-10 shadow-sm"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">
                            Remarks
                          </Label>
                          <Input
                            placeholder="Enter remarks..."
                            value={
                              (isUnifiedMode ? unifiedFormData?.remarks : null) ||
                              bulkFormData[0]?.remarks ||
                              ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setUnifiedFormData((prev) => ({
                                status: "follow-up",
                                followUpDate: prev?.followUpDate || bulkFormData[0]?.followUpDate || "",
                                followUpStatus: prev?.followUpStatus || bulkFormData[0]?.followUpStatus || "Intransit",
                                remarks: val,
                                liftingData: prev?.liftingData || defaultLiftingData(),
                              }));
                              setBulkFormData((prev) =>
                                prev.map((item) => ({ ...item, remarks: val, status: "follow-up" }))
                              );
                            }}
                            className="bg-white border-slate-200 h-10 shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="pt-6 border-t mt-6 bg-white gap-2">
                      <Button type="button" variant="outline" onClick={resetBulk} disabled={isSubmitting} className="h-10 px-5 rounded-lg border-slate-200">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !isBulkValid} className="h-10 bg-blue-700 text-white hover:bg-blue-800 font-semibold px-6 shadow-sm rounded-lg">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Follow-Up"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : unifiedFormData ? (
                  /* Unified Material Lifting Form */
                  <form onSubmit={handleBulkSubmit} className="space-y-6">
                    {/* Products To Lift Table */}
                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-xs text-green-800 uppercase tracking-wider">Products To Lift</h4>
                        <span className="text-xs text-slate-500">
                          Edit quantities per product. Removed products will not be included in this lift.
                        </span>
                      </div>

                      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                        <Table className="text-xs">
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="font-bold text-slate-700">INDENT NO.</TableHead>
                              <TableHead className="font-bold text-slate-700">INDENT NAME</TableHead>
                              <TableHead className="text-center font-bold text-slate-700">TOTAL QTY</TableHead>
                              <TableHead className="text-center font-bold text-slate-700">LIFTED QTY</TableHead>
                              <TableHead className="text-center font-bold text-slate-700">PENDING QTY</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 w-32">LIFT QTY</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 w-20">REMOVE</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkFormData.map((item) => {
                              const record = sheetRecords.find((r) => r.id === item.recordId);
                              if (!record) return null;

                              const totalQty = parseFloat(String(record.data.quantity || 0).replace(/,/g, "")) || 0;
                              const totalLiftedQty = parseFloat(String(record.data.totalLifted || 0).replace(/,/g, "")) || 0;
                              const pendingQty = Math.max(0, totalQty - totalLiftedQty);
                              const liftQtyVal = unifiedLiftingQtys[item.recordId] || "";

                              return (
                                <TableRow key={item.recordId} className="hover:bg-slate-50/50">
                                  <TableCell className="font-mono font-semibold text-slate-800">{record.data.indentNumber}</TableCell>
                                  <TableCell className="font-medium text-slate-700">{record.data.itemName}</TableCell>
                                  <TableCell className="text-center font-semibold text-slate-800">{totalQty}</TableCell>
                                  <TableCell className="text-center text-slate-500">{totalLiftedQty}</TableCell>
                                  <TableCell className="text-center font-semibold text-amber-600">{pendingQty}</TableCell>
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      step="any"
                                      min="0"
                                      max={pendingQty}
                                      value={liftQtyVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const numVal = parseFloat(val) || 0;
                                        let finalVal = val;
                                        if (val !== "") {
                                          if (numVal > pendingQty) {
                                            finalVal = pendingQty.toString();
                                          } else if (numVal < 0) {
                                            finalVal = "0";
                                          }
                                        }

                                        // Update bulkFormData
                                        setBulkFormData((prev) => {
                                          return prev.map((bf) => {
                                            if (bf.recordId === item.recordId) {
                                              return {
                                                ...bf,
                                                liftingData: {
                                                  ...bf.liftingData,
                                                  liftingQty: finalVal,
                                                },
                                              };
                                            }
                                            return bf;
                                          });
                                        });

                                        // Update unifiedLiftingQtys
                                        setUnifiedLiftingQtys((prev) => ({
                                          ...prev,
                                          [item.recordId]: finalVal,
                                        }));
                                      }}
                                      className="w-24 mx-auto bg-white border-slate-200 h-8 text-center text-xs"
                                      required
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveIndentFromLift(item.recordId)}
                                      className="h-7 w-7 text-red-500 hover:text-red-750 hover:bg-red-50"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-6">
                      <h4 className="font-semibold text-xs text-green-800 uppercase tracking-wider">Lifting Dispatch details</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Transporter *</Label>
                          <TransporterCombobox
                            value={unifiedFormData.liftingData.transporterName}
                            onChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, transporterName: val }
                              } : null)
                            }
                            options={transporterList}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Vehicle No *</Label>
                          <Input
                            className="bg-white border-green-200 uppercase h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.vehicleNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, vehicleNumber: e.target.value.toUpperCase() }
                              } : null)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Contact No</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.contactNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, contactNumber: e.target.value }
                              } : null)
                            }
                            placeholder="Driver contact info"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">AREA LIFTING</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.areaLifting || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, areaLifting: e.target.value }
                              } : null)
                            }
                            placeholder="Enter lifting area"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL NO.</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.billNo || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, billNo: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL DATE</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.billDate || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, billDate: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">EXPECTED DELIVERY DATE</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.expectedDeliveryDate || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, expectedDeliveryDate: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">TOTAL TRANSPORTING AMOUNT</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.freightAmount}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, freightAmount: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY *</Label>
                          <Select
                            value={unifiedFormData.liftingData.hasBilty || "No"}
                            onValueChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, hasBilty: val }
                              } : null)
                            }
                          >
                            <SelectTrigger className="bg-white border-green-200 h-10 shadow-sm w-full">
                              <SelectValue placeholder="Bilty Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border">
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {unifiedFormData.liftingData.hasBilty === "Yes" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY NUMBER *</Label>
                            <Input
                              className="bg-white border-green-200 h-10 shadow-sm w-full"
                              value={unifiedFormData.liftingData.biltyNumber || ""}
                              onChange={(e) =>
                                setUnifiedFormData((prev) => prev ? {
                                  ...prev,
                                  liftingData: { ...prev.liftingData, biltyNumber: e.target.value }
                                } : null)
                              }
                              required
                            />
                          </div>
                        )}

                        {unifiedFormData.liftingData.hasBilty === "Yes" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY IMAGE *</Label>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) =>
                                setUnifiedFormData((prev) => prev ? {
                                  ...prev,
                                  liftingData: { ...prev.liftingData, biltyCopy: e.target.files?.[0] || null }
                                } : null)
                              }
                              className="hidden"
                              id="unified-file"
                            />
                            <label
                              htmlFor="unified-file"
                              className="flex h-10 items-center justify-between w-full border border-green-200 rounded-lg cursor-pointer bg-white px-3 hover:bg-slate-50 transition-colors shadow-sm text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-255"
                            >
                              <span className="truncate">
                                {unifiedFormData.liftingData.biltyCopy
                                  ? (unifiedFormData.liftingData.biltyCopy instanceof File ? unifiedFormData.liftingData.biltyCopy.name : "View Bilty Image")
                                  : "Choose Bilty Image..."}
                              </span>
                              <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                            </label>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL IMAGE</Label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleCommonBillFileChange(e.target.files?.[0] || null)}
                            className="hidden"
                            id="unified-bill-file"
                          />
                          <label
                            htmlFor="unified-bill-file"
                            className="flex h-10 items-center justify-between w-full border border-green-200 rounded-lg cursor-pointer bg-white px-3 hover:bg-slate-50 transition-colors shadow-sm text-xs font-medium text-slate-700"
                          >
                            <span className="truncate">
                              {commonBillCopy
                                ? (commonBillCopy instanceof File ? commonBillCopy.name : "View Uploaded Bill")
                                : "Choose Bill Image..."}
                            </span>
                            <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <Label className="text-xs font-semibold text-slate-650">Remarks (Optional)</Label>
                        <Textarea
                          className="bg-white border-slate-200 mt-1 shadow-sm"
                          placeholder="General remarks..."
                          value={unifiedFormData.remarks}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              remarks: e.target.value
                            } : null)
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter className="pt-6 border-t mt-6 bg-white gap-2">
                      <Button type="button" variant="outline" onClick={resetBulk} disabled={isSubmitting} className="h-10 px-5 rounded-lg border-slate-200">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !isBulkValid} className="h-10 bg-blue-700 text-white hover:bg-blue-800 font-semibold px-6 shadow-sm rounded-lg">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Dispatch Material"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
