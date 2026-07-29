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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Search, Link as LinkIcon, Mail, CheckCircle, ExternalLink, Copy, MessagesSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { fetchIndentWorkflow, submitQuotation } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";

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

const paymentTermsOptions = [
  { value: "Advance", label: "Advance" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" }
];

export default function Quotation() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentRecords, setCurrentRecords] = useState<any[]>([]);
  const currentRecord = currentRecords[0] || null;
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Email flow details
  const [selectedVendorCount, setSelectedVendorCount] = useState("1");
  const [vendorsInput, setVendorsInput] = useState<Array<{ name: string; email: string }>>([
    { name: "", email: "" }
  ]);
  const [emailSent, setEmailSent] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<Array<{ name: string; link: string }>>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const vendorOptions = [
    "INFOSYS TECH",
    "KOTAK MAHINDRA",
    "Vendor A",
    "Vendor B",
    "Vendor C",
    "Vendor IT",
    "Express Logistics",
    "DHL Express"
  ];

  const VENDOR_EMAILS: Record<string, string> = {
    "INFOSYS TECH": "infosys@company.com",
    "KOTAK MAHINDRA": "kotak@company.com",
    "Vendor A": "vendorA@company.com",
    "Vendor B": "vendorB@company.com",
    "Vendor C": "vendorC@company.com",
    "Vendor IT": "vendorit@company.com",
    "Express Logistics": "express@logistics.com",
    "DHL Express": "dhl@express.com"
  };

  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Commercial Details, Billing and Destination Address details
  const [gstin, setGstin] = useState("27ABCDE1234A1Z5");
  const [pan, setPan] = useState("ABCDE1234A");

  const [billingCompany, setBillingCompany] = useState("M/S Botivate Pvt. Ltd.");
  const [billingAddress, setBillingAddress] = useState("401-402, Gateway Park, HQ, Mumbai");
  const [isEditingBilling, setIsEditingBilling] = useState(false);

  const [destCompany, setDestCompany] = useState("M/S Botivate Pvt. Ltd.");
  const [destAddress, setDestAddress] = useState("Division 1, Mumbai");
  const [isEditingDest, setIsEditingDest] = useState(false);

  // Description / Letter Note
  const [descriptionNote, setDescriptionNote] = useState("");

  // Item selections in Approved Indent Items table
  const [itemSelected, setItemSelected] = useState(true);

  // Terms and Conditions list
  const [terms, setTerms] = useState<string[]>([
    "Payment within 30 days of Invoice date.",
    "Delivery within 2 weeks of purchase order."
  ]);
  const [newTerm, setNewTerm] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const workflowData = await fetchIndentWorkflow();
      const rows = workflowData.map((row) => {
        const hasApprovedQty = parseFloat((row.data as any).totalApprovedQty || row.data.approvedQty || "0") > 0;
        const isApproved = hasApprovedQty || (!!row.data.actual1 && row.data.actual1.trim() !== "" && row.data.actual1.trim() !== "-");
        const hasActual3 = !!row.data.actual3 && row.data.actual3.trim() !== "";
        const isRegularVendor = (row.data.vendorType || "").toLowerCase().includes("regular");
        const hasPlan4 = !!row.data.plan4 && row.data.plan4.trim() !== "";
        const hasSelectedVendor = !!row.data.selectedVendorName && row.data.selectedVendorName.trim() !== "";

        let status: string;
        if (!isApproved || isRegularVendor) {
          status = "not_ready";
        } else if (hasActual3 || hasPlan4 || hasSelectedVendor) {
          status = "completed";
        } else {
          status = "pending";
        }

        return {
          id: row.id,
          status,
          data: {
            indentNumber: row.data.indentNumber,
            createdBy: row.data.createdBy,
            category: row.data.category,
            itemName: row.data.itemName,
            quantity: row.data.approvedQty || row.data.quantity,
            planned3: row.data.plan3,
            actual3: row.data.actual3,
            selectedVendor: row.data.selectedVendor,
            selectedVendorName: row.data.selectedVendorName,
            uom: row.data.uom || "PCS",
            vendor1Name: row.data.vendor1Name,
            vendor1Rate: row.data.vendor1Rate,
            vendor1Terms: row.data.vendor1Terms,
            vendor1DeliveryDate: row.data.vendor1Delivery,
            vendor1Remarks: row.data.vendor1Remarks,
            vendor2Name: row.data.vendor2Name,
            vendor2Rate: row.data.vendor2Rate,
            vendor2Terms: row.data.vendor2Terms,
            vendor2DeliveryDate: row.data.vendor2Delivery,
            vendor2Remarks: row.data.vendor2Remarks,
            vendor3Name: row.data.vendor3Name,
            vendor3Rate: row.data.vendor3Rate,
            vendor3Terms: row.data.vendor3Terms,
            vendor3DeliveryDate: row.data.vendor3Delivery,
            vendor3Remarks: row.data.vendor3Remarks,
          },
          _quotationIds: row._quotationIds,
        };
      });
      setSheetRecords(rows);
    } catch (e) {
      console.error("Fetch error Stage 3:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll for changes in real time when the quotation dialog is open
  useEffect(() => {
    if (!open || currentRecords.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const workflowData = await fetchIndentWorkflow();

        const updatedRecords = currentRecords.map((curRec) => {
          const freshRow = workflowData.find((r) => r.id === curRec.id);
          if (freshRow) {
            return {
              ...curRec,
              data: {
                ...curRec.data,
                vendor1Rate: freshRow.data.vendor1Rate,
                vendor2Rate: freshRow.data.vendor2Rate,
                vendor3Rate: freshRow.data.vendor3Rate,
                vendor1Terms: freshRow.data.vendor1Terms,
                vendor2Terms: freshRow.data.vendor2Terms,
                vendor3Terms: freshRow.data.vendor3Terms,
                vendor1DeliveryDate: freshRow.data.vendor1Delivery,
                vendor2DeliveryDate: freshRow.data.vendor2Delivery,
                vendor3DeliveryDate: freshRow.data.vendor3Delivery,
              }
            };
          }
          return curRec;
        });

        const oldQuotesStr = currentRecords.map(r => [r.data.vendor1Rate, r.data.vendor2Rate, r.data.vendor3Rate].join(",")).join("|");
        const newQuotesStr = updatedRecords.map(r => [r.data.vendor1Rate, r.data.vendor2Rate, r.data.vendor3Rate].join(",")).join("|");

        if (oldQuotesStr !== newQuotesStr) {
          setCurrentRecords(updatedRecords);
          setSheetRecords((prev) =>
            prev.map((rec) => {
              const matched = updatedRecords.find((u) => u.id === rec.id);
              return matched || rec;
            })
          );
        }
      } catch (err) {
        console.error("Polling error in quotation stage:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [open, currentRecords]);

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

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
    { key: "indentNumber", label: "Indent" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "planned3", label: "Planned" },
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

  const handleOpenForm = (recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setCurrentRecords([record]);
    setSelectedRecordIds([record.id]);

    // Reconstruct input values if emails were already sent previously
    const tempInputs: any[] = [];
    const tempSelectedVendors: string[] = [];
    if (record.data.vendor1Name && record.data.vendor1Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor1Name] || `${record.data.vendor1Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor1Name, email });
      tempSelectedVendors.push(record.data.vendor1Name);
    }
    if (record.data.vendor2Name && record.data.vendor2Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor2Name] || `${record.data.vendor2Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor2Name, email });
      tempSelectedVendors.push(record.data.vendor2Name);
    }
    if (record.data.vendor3Name && record.data.vendor3Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor3Name] || `${record.data.vendor3Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor3Name, email });
      tempSelectedVendors.push(record.data.vendor3Name);
    }

    if (tempInputs.length === 0) {
      tempInputs.push({ name: "", email: "" });
    }

    setVendorsInput(tempInputs);
    setSelectedVendors(tempSelectedVendors);
    setSelectedVendorCount(tempInputs.length.toString());

    // Check if links need to be pre-generated (meaning email was already sent in this session or before)
    if (record.data.vendor1Name && record.data.vendor1Name !== "-") {
      setEmailSent(true);
      const links = tempInputs.map((v, i) => ({
        name: v.name,
        link: `${window.location.origin}/quotation-form?ids=${record.id}&v=${i + 1}`,
      }));
      setGeneratedLinks(links);
    } else {
      setEmailSent(false);
      setGeneratedLinks([]);
    }

    setItemSelected(true);
    setDescriptionNote(record.data.remarks || "");

    setOpen(true);
  };

  const handleOpenBulkForm = () => {
    const records = sheetRecords.filter((r) => selectedRecordIds.includes(r.id));
    if (records.length === 0) return;

    setCurrentRecords(records);

    // Reconstruct input values based on first record to pre-fill
    const record = records[0];
    const tempInputs: any[] = [];
    const tempSelectedVendors: string[] = [];
    if (record.data.vendor1Name && record.data.vendor1Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor1Name] || `${record.data.vendor1Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor1Name, email });
      tempSelectedVendors.push(record.data.vendor1Name);
    }
    if (record.data.vendor2Name && record.data.vendor2Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor2Name] || `${record.data.vendor2Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor2Name, email });
      tempSelectedVendors.push(record.data.vendor2Name);
    }
    if (record.data.vendor3Name && record.data.vendor3Name !== "-") {
      const email = VENDOR_EMAILS[record.data.vendor3Name] || `${record.data.vendor3Name.toLowerCase().replace(/\s+/g, "")}@example.com`;
      tempInputs.push({ name: record.data.vendor3Name, email });
      tempSelectedVendors.push(record.data.vendor3Name);
    }

    if (tempInputs.length === 0) {
      tempInputs.push({ name: "", email: "" });
    }

    setVendorsInput(tempInputs);
    setSelectedVendors(tempSelectedVendors);
    setSelectedVendorCount(tempInputs.length.toString());

    // Check if links need to be pre-generated (meaning email was already sent in this session or before)
    if (record.data.vendor1Name && record.data.vendor1Name !== "-") {
      setEmailSent(true);
      const idsParam = records.map(r => r.id).join(",");
      const links = tempInputs.map((v, i) => ({
        name: v.name,
        link: `${window.location.origin}/quotation-form?ids=${idsParam}&v=${i + 1}`,
      }));
      setGeneratedLinks(links);
    } else {
      setEmailSent(false);
      setGeneratedLinks([]);
    }

    setItemSelected(true);
    setDescriptionNote(record.data.remarks || "");

    setOpen(true);
  };

  const handleVendorCountChange = (val: string) => {
    setSelectedVendorCount(val);
    const count = parseInt(val, 10);
    const updated = [...vendorsInput];

    if (count > updated.length) {
      while (updated.length < count) {
        updated.push({ name: "", email: "" });
      }
    } else if (count < updated.length) {
      updated.splice(count);
    }

    setVendorsInput(updated);
  };

  const handleVendorFieldChange = (index: number, field: string, val: string) => {
    const updated = [...vendorsInput];
    updated[index] = { ...updated[index], [field]: val };

    // Auto fill email if dropdown vendor name selected
    if (field === "name" && !updated[index].email) {
      updated[index].email = `${val.toLowerCase().replace(/\s+/g, "")}@example.com`;
    }

    setVendorsInput(updated);
  };

  // Simulates sending product details via email and generates public links
  const handleSendEmails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentRecords.length === 0) return;

    if (selectedVendors.length === 0) {
      toast.error("Please select at least one supplier from the Master list.");
      return;
    }

    const mappedInputs = selectedVendors.map((name) => ({
      name,
      email: VENDOR_EMAILS[name] || `${name.toLowerCase().replace(/\s+/g, "")}@example.com`
    }));

    setIsSubmitting(true);
    try {
      const createPromises = currentRecords.flatMap((record) =>
        mappedInputs.map((vendor) =>
          submitQuotation(record.id, {
            vendorName: vendor.name,
            quotedRate: 0,
            paymentTerms: "-",
            deliveryTerms: "-",
          })
        )
      );

      await Promise.all(createPromises);
      toast.success("Enquiry generated and sent! Selected indents moved to Approved Vendor stage.");
      await fetchData();

      const idsParam = currentRecords.map(r => r.id).join(",");
      const links = mappedInputs.map((v, i) => ({
        name: v.name,
        link: `${window.location.origin}/quotation-form?ids=${idsParam}&v=${i + 1}`,
      }));
      setGeneratedLinks(links);
      setEmailSent(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to send details to vendors.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completes the Quotation stage and routes to Approved Vendor Stage
  const handleProceedToApproval = async () => {
    if (currentRecords.length === 0) return;

    for (const record of currentRecords) {
      const hasQuote1 = record.data.vendor1Rate && record.data.vendor1Rate !== "-";
      const hasQuote2 = record.data.vendor2Rate && record.data.vendor2Rate !== "-";
      const hasQuote3 = record.data.vendor3Rate && record.data.vendor3Rate !== "-";

      if (!hasQuote1 && !hasQuote2 && !hasQuote3) {
        toast.error(`Cannot proceed: At least one vendor must submit a quotation for Indent ${record.data.indentNumber} first.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await fetchData();
      toast.success("Quotation stage completed! Selected indents moved to Approved Vendor stage.");
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to proceed to Approval stage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard!");
  };

  const handleToggleRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecordIds(pending.map((r) => r.id));
    } else {
      setSelectedRecordIds([]);
    }
  };

  const resetForm = () => {
    setOpen(false);
    setCurrentRecords([]);
    setSelectedRecordIds([]);
    setSelectedVendorCount("1");
    setVendorsInput([{ name: "", email: "" }]);
    setSelectedVendors([]);
    setGstin("27ABCDE1234A1Z5");
    setPan("ABCDE1234A");
    setBillingCompany("M/S Botivate");
    setBillingAddress("Gateway Park, HQ, Mumbai");
    setIsEditingBilling(false);
    setDestCompany("M/S Botivate");
    setDestAddress("Warehouse 1, Mumbai");
    setIsEditingDest(false);
    setDescriptionNote("");
    setItemSelected(true);
    setTerms([
      "Payment within 30 days of Invoice date.",
      "Delivery within 2 weeks of purchase order."
    ]);
    setNewTerm("");
    setEmailSent(false);
    setGeneratedLinks([]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 p-6 space-y-6">
      {/* Header Card */}
      <div className="p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <MessagesSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Quotation</h2>
              <p className="text-slate-500 text-sm">Send product details to vendors and capture commercial quotations.</p>
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
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-slate-100/80 p-1 w-fit rounded-lg">
            <TabsTrigger value="pending" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
              Pending Quotations ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
              History ({completed.length})
            </TabsTrigger>
          </TabsList>

          {selectedRecordIds.length > 0 && (
            <Button
              onClick={handleOpenBulkForm}
              className="bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 rounded-xl shadow-md font-semibold text-sm transition-all"
            >
              Process Quotation ({selectedRecordIds.length})
            </Button>
          )}
        </div>

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
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider w-[50px]">
                      <Checkbox
                        checked={selectedRecordIds.length === pending.length && pending.length > 0}
                        onCheckedChange={handleToggleAll}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Actions
                    </TableHead>
                    {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                      <TableHead key={col.key} className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 3} className="h-32 text-center text-gray-500 font-medium">
                        No pending quotations found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map((record) => {
                      const statusText = record.data.vendor1Name
                        ? "Awaiting responses..."
                        : "Awaiting sending details...";

                      return (
                        <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                          <TableCell className="px-4 py-3 w-[50px]">
                            <Checkbox
                              checked={selectedRecordIds.includes(record.id)}
                              onCheckedChange={() => handleToggleRecord(record.id)}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenForm(record.id)}
                              className="h-8 text-xs font-semibold px-3 border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              Quotation
                            </Button>
                          </TableCell>
                          {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                            <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                              {col.key === "planned3"
                                ? formatDateDash(record.data[col.key])
                                : String(record.data[col.key] ?? "-")}
                            </TableCell>
                          ))}
                          <TableCell className="px-4 text-xs font-medium text-slate-500">
                            {statusText}
                          </TableCell>
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
                      Sent Date
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Approved Vendor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedColumns.length + 2} className="h-32 text-center text-gray-500 font-medium">
                        No completed quotations found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    completed.map((record) => {
                    const approvedName = record.data.selectedVendorName || "Decision pending";

                    return (
                      <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                        {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                          <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                            {col.key === "planned3"
                              ? formatDateDash(record.data[col.key])
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm text-slate-700 px-4">
                          {formatDateDash(record.data.actual3)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 px-4 font-semibold">
                          {approvedName}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
        </TabsContent>
      </Tabs>

      {/* DETAILED FORM MODAL */}
      <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); else setOpen(val); }}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle className="text-xl font-bold text-slate-800">Quotation Dispatch & Response Tracking</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2 py-4 scrollbar-thin">
            {!emailSent ? (
              <div className="space-y-6">
                {/* BOTIVATE SERVICES header card */}
                <div className="flex items-center justify-center gap-8 bg-slate-50 px-6 py-6 border rounded-xl shadow-sm">
                  <img src="null" alt="Logo" className="h-10 w-10 object-contain" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Botivate</h2>
                    <p className="text-sm text-slate-600">Gateway Park, Mumbai, Maharashtra</p>
                    <p className="text-sm text-slate-600">Phone No: +9820012345</p>
                  </div>
                </div>

                {/* Divider Header */}
                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <span className="relative px-4 bg-white text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Generate New Material RFQ / Enquiry
                  </span>
                </div>

                {/* Suppliers Multi-Select Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Suppliers (Select Multiple from Master Vendor List) <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(val) => {
                      if (selectedVendors.includes(val)) return;
                      if (selectedVendors.length >= 3) {
                        toast.warning("You can select a maximum of 3 suppliers.");
                        return;
                      }
                      setSelectedVendors([...selectedVendors, val]);
                    }}
                  >
                    <SelectTrigger className="w-full h-11 border-slate-200 bg-white">
                      <SelectValue placeholder="-- Choose Supplier from Master list --" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorOptions.map((opt) => (
                        <SelectItem key={opt} value={opt} disabled={selectedVendors.includes(opt)}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Selected Vendors Pills */}
                  {selectedVendors.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedVendors.map((vendor) => (
                        <Badge
                          key={vendor}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-3 py-1 text-xs rounded-full flex items-center gap-1.5 font-semibold transition-colors"
                        >
                          {vendor}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVendors(selectedVendors.filter((v) => v !== vendor));
                            }}
                            className="cursor-pointer text-slate-400 hover:text-slate-600 font-bold"
                          >
                            ×
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3-Column details layout: Commercial Details, Billing Address, Destination Address */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Our Commercial Details */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Our Commercial Details
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">GSTIN REGISTRATION</span>
                        <p className="font-semibold text-slate-800">{gstin}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">PAN CARD NO</span>
                        <p className="font-semibold text-slate-800">{pan}</p>
                      </div>
                    </div>
                  </div>

                  {/* Billing Address Card */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Billing Address
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditingBilling(!isEditingBilling)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {isEditingBilling ? (
                          <span className="text-xs text-slate-900 font-semibold font-semibold">Done</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isEditingBilling ? (
                      <div className="space-y-2">
                        <Input
                          size={24}
                          value={billingCompany}
                          onChange={(e) => setBillingCompany(e.target.value)}
                          className="h-8 text-xs border-slate-200"
                          placeholder="Company name"
                        />
                        <Textarea
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          className="text-xs min-h-[50px] border-slate-200"
                          placeholder="Billing Address details"
                        />
                      </div>
                    ) : (
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-800">{billingCompany}</p>
                        <p className="text-slate-600 font-medium leading-relaxed">{billingAddress}</p>
                      </div>
                    )}
                  </div>

                  {/* Destination Address Card */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Destination Address
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsEditingDest(!isEditingDest)}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {isEditingDest ? (
                          <span className="text-xs text-slate-900 font-semibold font-semibold">Done</span>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isEditingDest ? (
                      <div className="space-y-2">
                        <Input
                          size={24}
                          value={destCompany || ""}
                          onChange={(e) => setDestCompany(e.target.value)}
                          className="h-8 text-xs border-slate-200"
                          placeholder="Company name"
                        />
                        <Textarea
                          value={destAddress || ""}
                          onChange={(e) => setDestAddress(e.target.value)}
                          className="text-xs min-h-[50px] border-slate-200"
                          placeholder="Destination Address details"
                        />
                      </div>
                    ) : (
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-800">{destCompany}</p>
                        <p className="text-slate-600 font-medium leading-relaxed">{destAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description / Letter Note */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Description / Letter Note
                  </Label>
                  <Textarea
                    placeholder="Enter enquiry specific message details..."
                    value={descriptionNote || ""}
                    onChange={(e) => setDescriptionNote(e.target.value)}
                    className="min-h-[80px] border-slate-200 text-sm focus-visible:ring-slate-500"
                  />
                </div>

                {/* Approved Indent Items Table */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Approved Indent Items (Ready for Enquiry Request)
                  </Label>
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                    <Table className="w-full text-xs">
                      <TableHeader className="bg-slate-50">
                        <TableRow className="hover:bg-slate-50 border-b border-slate-100">
                          <TableHead className="w-12 text-center p-3">
                            <Checkbox
                              checked={itemSelected}
                              onCheckedChange={(checked) => setItemSelected(!!checked)}
                            />
                          </TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3">SR.</TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3">INDENT NO</TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3">FIRM NAME</TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3">PRODUCT NAME</TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3 text-right">QTY</TableHead>
                          <TableHead className="font-semibold text-slate-500 p-3">UNIT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentRecords.map((record, index) => (
                          <TableRow key={record.id} className="hover:bg-white border-0 border-b last:border-0">
                            <TableCell className="text-center p-3">
                              <Checkbox
                                checked={itemSelected}
                                onCheckedChange={(checked) => setItemSelected(!!checked)}
                              />
                            </TableCell>
                            <TableCell className="p-3 text-slate-700">{index + 1}</TableCell>
                            <TableCell className="p-3 font-semibold text-slate-900 font-mono">
                              {record?.data?.indentNumber || "—"}
                            </TableCell>
                            <TableCell className="p-3 text-slate-700">Botivate</TableCell>
                            <TableCell className="p-3 text-slate-800 font-medium">
                              {record?.data?.itemName || "—"}
                            </TableCell>
                            <TableCell className="p-3 text-right font-bold text-slate-900">
                              {record?.data?.quantity || "—"}
                            </TableCell>
                            <TableCell className="p-3 text-slate-600">
                              {record?.data?.uom || "PCS"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Terms & Conditions
                    </Label>
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        placeholder="Add custom term..."
                        className="h-8 text-xs border-slate-200 w-64"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newTerm.trim()) {
                              setTerms([...terms, `${terms.length + 1}. ${newTerm.trim()}`]);
                              setNewTerm("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (newTerm.trim()) {
                            setTerms([...terms, `${terms.length + 1}. ${newTerm.trim()}`]);
                            setNewTerm("");
                          }
                        }}
                        className="h-8 bg-slate-900 text-white hover:bg-slate-800"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 space-y-2">
                    {terms.map((term, index) => (
                      <div key={index} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg text-xs">
                        <span className="text-slate-700 font-medium">{term}</span>
                        <button
                          type="button"
                          onClick={() => setTerms(terms.filter((_, idx) => idx !== index))}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Bar Controls */}
                <div className="flex items-center justify-between border-t pt-5 mt-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {itemSelected ? currentRecords.length : 0} Items Selected for RFQ
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      className="border-slate-200 font-semibold px-5 text-slate-600 hover:bg-slate-50"
                    >
                      Reset Form
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmitting || selectedVendors.length === 0 || !itemSelected}
                      onClick={() => handleSendEmails()}
                      className="bg-slate-900 text-white hover:bg-slate-800 font-semibold px-6 shadow-sm shadow-slate-100"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Save and Send Enquiry"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Links and Live Quotations Tracking
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
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
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(item.link)}
                            className="h-8 text-slate-600 hover:text-slate-900 border"
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

                {/* Live Comparison Tracker */}
                <div className="space-y-4">
                  <Label className="text-xs uppercase font-extrabold text-slate-500 tracking-wider">Live Quotations Comparison</Label>
                  {currentRecords.map((record) => (
                    <div key={record.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                      <div className="font-bold text-xs text-slate-750 bg-slate-100 p-2 rounded flex justify-between items-center">
                        <span>Indent: {record.data.indentNumber} - {record.data.itemName} (Qty: {record.data.quantity})</span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-3 font-semibold text-slate-700">Vendor</th>
                              <th className="p-3 font-semibold text-slate-700">Rate Per Qty</th>
                              <th className="p-3 font-semibold text-slate-700">Payment Terms</th>
                              <th className="p-3 font-semibold text-slate-700">Expected Delivery</th>
                              <th className="p-3 font-semibold text-slate-700">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[1, 2, 3].map((num) => {
                              const name = record.data[`vendor${num}Name`];
                              const rate = record.data[`vendor${num}Rate`];
                              const terms = record.data[`vendor${num}Terms`];
                              const delivery = record.data[`vendor${num}DeliveryDate`];

                              if (!name || name === "-") return null;

                              const hasSubmitted = rate && rate !== "-";

                              return (
                                <tr key={num} className="border-b last:border-0 hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-800">{name}</td>
                                  <td className="p-3 font-bold text-slate-900">
                                    {hasSubmitted ? `₹${rate}` : "—"}
                                  </td>
                                  <td className="p-3 text-slate-600">
                                    {hasSubmitted ? (paymentTermsOptions.find(o => o.value === terms)?.label || terms) : "—"}
                                  </td>
                                  <td className="p-3 text-slate-600">
                                    {hasSubmitted ? formatDateDash(delivery) : "—"}
                                  </td>
                                  <td className="p-3">
                                    {hasSubmitted ? (
                                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" variant="outline">
                                        Submitted
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50" variant="outline">
                                        Awaiting Response
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEmailSent(false)}
                    className="w-full bg-white border-slate-200"
                  >
                    Resend / Change Vendors
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleProceedToApproval()}
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Proceed to Approved Vendor"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
