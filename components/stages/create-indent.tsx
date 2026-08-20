"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { useAuth } from "@/lib/auth-context";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Loader2, PlusCircle, History as HistoryIcon, LayoutGrid, ClipboardList, FileText, Upload, Search, Check, ChevronsUpDown, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, parseSheetDate, getFmsTimestamp, getErrorMessage } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase/client";
import { AttachmentCell } from "@/components/ui/attachment-cell";

export default function Stage1() {
  const {
    // records,
    // addRecord,
    // moveToNextStage,
    indentCounter,
    setIndentCounter,
  } = useWorkflow();
  const { fullName, user } = useAuth();
  const loggedInName = fullName || user || "";

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");


  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { fetchIndentWorkflow } = await import("@/lib/supabase/queries");
      const rows = await fetchIndentWorkflow();

      // Calculate max ID from loaded rows to sync counter
      let maxId = 0;
      rows.forEach((r: any) => {
        if (r.data?.indentNumber) {
          const match = r.data.indentNumber.match(/IN-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxId) maxId = num;
          }
        }
      });
      setIndentCounter(maxId > 0 ? maxId + 1 : 1);

      // Map to Stage 1 format (only show pending indents)
      const stage1Rows = rows.map((r: any) => ({
        id: r.data.indentNumber || r.id,
        rowIndex: r.originalIndex,
        stage: 1,
        status: r.status,
        createdAt: parseSheetDate(r.data.createdAt),
        history: [{ stage: 1, date: parseSheetDate(r.data.createdAt), data: {} }],
        data: {
          indentNumber: r.data.indentNumber,
          createdBy: r.data.createdBy,
          category: r.data.category,
          warehouseLocation: r.data.warehouseLocation,
          leadTime: r.data.leadTime,
          deliveryLocation: r.data.deliveryLocation,
          itemName: r.data.itemName,
          quantity: r.data.quantity,
          itemCode: r.data.itemCode,
          uom: r.data.uom || "",
          status: r.data.status || "pending",
          remarks: r.data.remarks,
          attachment: r.data.attachment || "",
          itemPriority: r.data.priority || ""
        }
      }));

      setSheetRecords(stage1Rows);
    } catch (e) {
      console.error("Fetch error Stage 1:", getErrorMessage(e));
      toast.error(`Failed to load Create Indent data: ${getErrorMessage(e)}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  // Helper for search filtering
  const matchesSearch = (r: any) => {
    const searchLower = searchTerm.toLowerCase();
    const indNum = r.data.indentNumber || "";
    const iName = r.data.itemName || "";
    const qty = r.data.quantity ? r.data.quantity.toString() : "";
    const vType = r.data.vendorType || ""; // vendorType might be undefined

    return (
      indNum.toLowerCase().includes(searchLower) ||
      iName.toLowerCase().includes(searchLower) ||
      qty.toLowerCase().includes(searchLower) ||
      // r.data.poNumber?.toLowerCase().includes(searchLower) || // Not available in Stage 1
      // r.data.invoiceNumber?.toLowerCase().includes(searchLower) || // Not available in Stage 1
      vType.toLowerCase().includes(searchLower)
    );
  };

  const pending = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "pending")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  const history = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "completed")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  const Combobox = ({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    disabled,
    stockMap,
  }: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
    stockMap?: Record<string, number>;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            <span className="truncate">
              {value
                ? options.find((option) => option === value) || value
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div
                  className="py-2 px-4 text-sm text-blue-600 cursor-pointer hover:bg-slate-100 flex items-center gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(searchValue); // Set custom value
                    setOpen(false);
                  }}
                >
                  <PlusCircle className="w-3 h-3" />
                  Create "{searchValue}"
                </div>
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const hasStockData = stockMap && option in stockMap;
                  const stockQty = stockMap ? (stockMap[option] || 0) : null;
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center truncate mr-2">
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === option ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{option}</span>
                      </div>
                      {stockMap && (
                        <span
                          className={cn(
                            "ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                            stockQty && stockQty > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          )}
                        >
                          Stock: {stockQty || 0}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // === Existing Indent Creation Modal ===
  const [open, setOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === Edit Modal State ===
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    deliveryLocation: "",
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    itemPriority: "",
    attachment: null as File | null,
    existingAttachmentUrl: "",
  });

  const [formData, setFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    deliveryLocation: "",
    attachment: null as File | null,
    items: [] as Array<{
      category: string;
      itemName: string;
      quantity: string;
      uom: string;
      itemCode: string;
      itemPriority: string;
      attachment?: File | null;
    }>,
  });

  const [itemInput, setItemInput] = useState({
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    itemPriority: "",
    attachment: null as File | null,
  });

  // Prefill "Created By" with the logged-in user's name (once auth resolves)
  useEffect(() => {
    if (loggedInName) {
      setFormData((prev) => (prev.createdBy ? prev : { ...prev, createdBy: loggedInName }));
    }
  }, [loggedInName]);





  // Stock and UOM maps
  const [itemStockMap, setItemStockMap] = useState<Record<string, number>>({});
  const [itemUomMap, setItemUomMap] = useState<Record<string, string>>({});

  // Fetch "Created By" options from Dropdown sheet column A
  const [createdByOptions, setCreatedByOptions] = useState<string[]>([]);
  // Master Category options state
  const [masterCategoryList, setMasterCategoryList] = useState<string[]>([]);

  // Fetch "Warehouse Location" options from Dropdown sheet column B
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  // Fetch "UOM" options from Dropdown sheet column N (Index 13)
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  // Fetch "Delivery Location" options from Master → Delivery Locations
  const [deliveryLocationOptions, setDeliveryLocationOptions] = useState<string[]>([]);
  // Fetch dropdown data for Category (D), Item Name (E), Item Code (C)
  const [dropdownData, setDropdownData] = useState<Array<{ itemCode: string; category: string; itemName: string; uom?: string }>>([]);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const [cbRes, whRes, uomRes, itemRes, addrRes, mrRes, poRes, catRes] = await Promise.all([
          supabase.from("master_created_by").select("name").eq("is_active", true),
          supabase.from("master_warehouses").select("name").eq("is_active", true),
          supabase.from("master_uoms").select("name").eq("is_active", true),
          supabase.from("master_items").select("item_code, category, item_name, uom").eq("is_active", true),
          supabase.from("master_delivery_locations").select("name").eq("is_active", true),
          supabase.from("material_receipts").select("po_id, accepted_quantity, received_quantity"),
          supabase.from("purchase_orders").select("id, item_code, item_name"),
          supabase.from("master_categories").select("name").eq("is_active", true),
        ]);

        const cbOpts = (cbRes.data || []).map((r: any) => r.name).filter((v: any) => v && String(v).trim() !== "");
        setCreatedByOptions(cbOpts);

        const whOpts = (whRes.data || []).map((r: any) => r.name).filter((v: any) => v && String(v).trim() !== "");
        setWarehouseOptions(whOpts);

        const uomOpts = (uomRes.data || []).map((r: any) => r.name).filter((v: any) => v && String(v).trim() !== "");
        setUomOptions(uomOpts);

        const addrOpts = (addrRes.data || []).map((r: any) => r.name).filter((v: any) => v && String(v).trim() !== "");
        setDeliveryLocationOptions(addrOpts);

        const catOpts = (catRes.data || []).map((r: any) => r.name).filter((v: any) => v && String(v).trim() !== "");
        setMasterCategoryList(catOpts);

        const uomMap: Record<string, string> = {};
        const itemData = (itemRes.data || []).map((r: any) => {
          if (r.item_name && r.uom) uomMap[r.item_name] = r.uom;
          if (r.item_code && r.uom) uomMap[r.item_code] = r.uom;
          return {
            category: r.category || "",
            itemName: r.item_name || "",
            itemCode: r.item_code || "",
            uom: r.uom || "",
          };
        }).filter((item: any) => item.category && item.itemName);
        setDropdownData(itemData);
        setItemUomMap(uomMap);

        // Compute stock from material_receipts joined with purchase_orders
        const poMap: Record<string, { item_code?: string; item_name?: string }> = {};
        (poRes.data || []).forEach((po: any) => {
          poMap[po.id] = { item_code: po.item_code, item_name: po.item_name };
        });

        const stockMap: Record<string, number> = {};
        (mrRes.data || []).forEach((mr: any) => {
          const qty = Number(mr.accepted_quantity !== undefined && mr.accepted_quantity !== null ? mr.accepted_quantity : mr.received_quantity || 0) || 0;
          const poInfo = poMap[mr.po_id];
          if (poInfo) {
            if (poInfo.item_name) {
              stockMap[poInfo.item_name] = (stockMap[poInfo.item_name] || 0) + qty;
            }
            if (poInfo.item_code) {
              stockMap[poInfo.item_code] = (stockMap[poInfo.item_code] || 0) + qty;
            }
          }
        });
        setItemStockMap(stockMap);
      } catch (e) {
        console.error("Error fetching dropdown options:", e);
      }
    };
    fetchDropdownOptions();
  }, []);

  // Combine categories from master_categories table and existing catalog items
  const categoryOptions = useMemo(() => {
    const fromItems = dropdownData.map(item => item.category);
    const combined = [...masterCategoryList, ...fromItems].map(c => String(c).trim()).filter(Boolean);
    return Array.from(new Set(combined));
  }, [masterCategoryList, dropdownData]);

  // Get items filtered by selected category (case-insensitive)
  const getItemsByCategory = (category: string) => {
    const targetCat = category.trim().toLowerCase();
    const items = dropdownData.filter(item => (item.category || "").trim().toLowerCase() === targetCat);
    // Deduplicate by itemName to prevent duplicate key errors in the dropdown
    return Array.from(new Map(items.map(item => [item.itemName, item])).values());
  };


  // Check and save new options to master_items table
  const checkAndSaveNewOptions = async (items: any[]) => {
    const newOptions: any[] = [];

    items.forEach(item => {
      const exists = dropdownData.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );
      const alreadyQueued = newOptions.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );

      if (!exists && !alreadyQueued) {
        newOptions.push({
          category: item.category,
          itemName: item.itemName,
          itemCode: item.itemCode
        });
      }
    });

    if (newOptions.length > 0) {
      setDropdownData(prev => [...prev, ...newOptions]);

      try {
        const rowsToInsert = newOptions.map(opt => ({
          item_code: opt.itemCode || `ITEM-${Date.now()}`,
          category: opt.category,
          item_name: opt.itemName,
          is_active: true,
        }));

        await supabase.from("master_items").upsert(rowsToInsert, { onConflict: "item_code" });

        // Save unique category names to master_categories table
        const uniqueCats = Array.from(new Set(newOptions.map(opt => opt.category).filter(Boolean)));
        for (const cat of uniqueCats) {
          await supabase.from("master_categories").upsert({ name: cat, is_active: true }, { onConflict: "name" });
        }
      } catch (e) {
        console.error("Failed to save new options:", e);
      }
    }
  };


  const uploadOrConvertFile = async (file: File): Promise<string> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `indent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('indent-attachments').upload(path, file);
      if (!upErr) {
        const { data: publicUrlData } = supabase.storage.from('indent-attachments').getPublicUrl(path);
        if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
      }
    } catch (err) {
      console.warn("Storage upload failed, falling back to data URL:", err);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(`pending-upload:${file.name}`);
        }
      };
      reader.onerror = () => {
        resolve(`pending-upload:${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  // submitToSheet: Creates indent rows in Supabase
  const submitToSheet = async (data: any, globalAttachmentUrl: string): Promise<string[]> => {
    const { createIndentRow } = await import("@/lib/supabase/queries");

    const generatedIds: string[] = [];
    for (const item of data.items) {
      let itemAttachmentUrl = "";
      if (item.attachment) {
        itemAttachmentUrl = await uploadOrConvertFile(item.attachment);
      } else if (globalAttachmentUrl) {
        itemAttachmentUrl = globalAttachmentUrl;
      }

      const indentNumber = await createIndentRow({
        createdBy: data.createdBy,
        category: item.category,
        itemName: item.itemName,
        quantity: parseInt(item.quantity) || 0,
        warehouseLocation: data.warehouseLocation,
        itemCode: item.itemCode || "",
        leadTime: data.leadTime,
        deliveryLocation: data.deliveryLocation || "",
        priority: item.itemPriority || "",
        attachmentUrl: itemAttachmentUrl || "",
        uom: item.uom || "",
      });
      generatedIds.push(indentNumber);
    }

    return generatedIds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.createdBy &&
      formData.warehouseLocation &&
      formData.leadTime &&
      formData.items.length > 0
    ) {
      setIsSubmitting(true);

      const submitPromise = (async () => {
        // 1. Handle global file upload if needed
        let attachmentUrl = "";
        if (formData.attachment) {
          attachmentUrl = await uploadOrConvertFile(formData.attachment);
        }

        // 2. Submit to Supabase
        const generatedIds = await submitToSheet({ ...formData }, attachmentUrl);

        // 3. Save new dropdown options in background (using generated IDs for reference)
        const createdRecords = formData.items.map((item, i) => ({
          indentNumber: generatedIds[i] || "",
          ...item,
        }));
        checkAndSaveNewOptions(createdRecords);

        // 4. Sync counter from returned IDs
        const maxFromGenerated = generatedIds.reduce((max, id) => {
          const m = id.match(/IN-(\d+)/);
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        if (maxFromGenerated > 0) setIndentCounter(maxFromGenerated + 1);

        fetchData();
        setFormData({ createdBy: loggedInName, warehouseLocation: "", leadTime: "", deliveryLocation: "", attachment: null, items: [] });
        setOpen(false);
        return true;
      })();

      toast.promise(submitPromise, {
        loading: "Creating indent and uploading attachment...",
        success: "Indent created successfully!",
        error: (err) => `Failed to create indent: ${err.message}`,
      });

      try {
        await submitPromise;
      } catch (err) {
        console.error("Submission failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleItemFieldChange = (field: string, value: string) => {
    setItemInput((prev) => {
      if (field === "category") {
        return { ...prev, category: value, itemName: "", itemCode: "" };
      }
      if (field === "itemName") {
        const selectedItem = dropdownData.find(
          (d) => d.category === prev.category && d.itemName === value
        );
        const autoUom = selectedItem?.uom || itemUomMap[value] || prev.uom;
        return {
          ...prev,
          itemName: value,
          itemCode: selectedItem?.itemCode || prev.itemCode || "",
          uom: autoUom || prev.uom,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleAddItemToList = (e: React.MouseEvent) => {
    e.preventDefault();
    if (
      !itemInput.category ||
      !itemInput.itemName ||
      !itemInput.quantity ||
      !itemInput.uom ||
      !itemInput.itemCode ||
      !itemInput.itemPriority
    ) {
      toast.error("Please fill in all item fields before adding.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...itemInput }],
    }));

    // Clear inputs but preserve category to make sequential adding faster
    setItemInput({
      category: itemInput.category,
      itemName: "",
      quantity: "",
      uom: "",
      itemCode: "",
      itemPriority: "",
      attachment: null,
    });

    toast.success("Item added to the indent list!");
  };

  // === Edit Record Handler ===
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({
      createdBy: record.data.createdBy || "",
      warehouseLocation: record.data.warehouseLocation || "",
      leadTime: record.data.leadTime || "",
      deliveryLocation: record.data.deliveryLocation || "",
      category: record.data.category || "",
      itemName: record.data.itemName || "",
      quantity: record.data.quantity || "",
      uom: record.data.uom || "",
      itemCode: record.data.itemCode || "",
      itemPriority: record.data.itemPriority || "",
      attachment: null,
      existingAttachmentUrl: record.data.attachment || "",
    });
    setEditOpen(true);
  };

  // === Update Record in Supabase ===
  const updateRecordInSheet = async () => {
    if (!editingRecord) return;

    setIsEditSubmitting(true);

    try {
      const { updateIndentRow } = await import("@/lib/supabase/queries");

      let finalAttachmentUrl = editFormData.existingAttachmentUrl;
      if (editFormData.attachment) {
        finalAttachmentUrl = `pending-upload:${editFormData.attachment.name}`;
      }

      await updateIndentRow(editingRecord.id, {
        createdBy: editFormData.createdBy,
        category: editFormData.category,
        itemName: editFormData.itemName,
        quantity: parseInt(editFormData.quantity) || 0,
        warehouseLocation: editFormData.warehouseLocation,
        itemCode: editFormData.itemCode,
        leadTime: editFormData.leadTime,
        deliveryLocation: editFormData.deliveryLocation,
        priority: editFormData.itemPriority,
        attachmentUrl: finalAttachmentUrl,
        uom: editFormData.uom,
      });

      setEditOpen(false);
      setEditingRecord(null);
      fetchData();
    } catch (error: any) {
      console.error("Error updating record:", error);
      alert("Error updating record: " + (error?.message || "Please check console."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-4xl mx-auto">
        <div className="p-3 bg-blue-700 rounded-lg text-white shadow-xl">
          <PlusCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Create Indent</h2>
          <p className="text-slate-500 text-sm">Initiate a new purchase indent by filling in the details below.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* Step 1: General Specifications */}
          {/* Step 1: General Specifications & Item Input */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-700">1</span>
              General Specifications & Item Details
            </h3>

            {/* General Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="createdBy">Created By <span className="text-red-500">*</span></Label>
                <Input
                  id="createdBy"
                  type="text"
                  value={formData.createdBy}
                  readOnly
                  disabled
                  className="bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="warehouseLocation">Division <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.warehouseLocation}
                  onValueChange={(val) =>
                    setFormData({ ...formData, warehouseLocation: val })
                  }
                >
                  <SelectTrigger id="warehouseLocation" className="w-full">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="deliveryLocation">Delivery Location</Label>
                <Select
                  value={formData.deliveryLocation}
                  onValueChange={(val) =>
                    setFormData({ ...formData, deliveryLocation: val })
                  }
                >
                  <SelectTrigger id="deliveryLocation" className="w-full">
                    <SelectValue placeholder="Select delivery location" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryLocationOptions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">No locations configured (Master → Delivery Locations)</div>
                    ) : (
                      deliveryLocationOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Attachment (Optional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="indent-attachment"
                    className="flex-1 flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs transition-colors"
                  >
                    <span className="text-slate-500 truncate max-w-[200px]">
                      {formData.attachment ? formData.attachment.name : "Choose file..."}
                    </span>
                    <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                  </label>
                  {formData.attachment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => setFormData({ ...formData, attachment: null })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Divider for Item Input */}
            <div className="border-t border-slate-100 pt-4 mt-6">
              <h4 className="text-sm font-bold text-slate-700 mb-3">Item Details</h4>
            </div>

            {/* Item Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Combobox
                  options={categoryOptions}
                  value={itemInput.category}
                  onChange={(val) => handleItemFieldChange("category", val)}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Item Name <span className="text-red-500">*</span></Label>
                <Combobox
                  options={itemInput.category ? getItemsByCategory(itemInput.category).map(i => i.itemName) : []}
                  value={itemInput.itemName}
                  onChange={(val) => handleItemFieldChange("itemName", val)}
                  placeholder={itemInput.category ? "Select or type item..." : "Select category first"}
                  searchPlaceholder="Search or create item..."
                  disabled={!itemInput.category}
                  stockMap={itemStockMap}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Item Code <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="e.g. IC-001"
                  value={itemInput.itemCode}
                  onChange={(e) => handleItemFieldChange("itemCode", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Quantity <span className="text-red-500">*</span></Label>
                  {itemInput.itemName && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                        (itemStockMap[itemInput.itemName] || itemStockMap[itemInput.itemCode] || 0) > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-amber-50 text-amber-700 border-amber-300"
                      )}
                    >
                      <Package className="w-3 h-3" />
                      Avail: {itemStockMap[itemInput.itemName] || itemStockMap[itemInput.itemCode] || 0} {itemInput.uom || itemUomMap[itemInput.itemName] || "Nos"}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={itemInput.quantity}
                  onChange={(e) => handleItemFieldChange("quantity", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>UOM <span className="text-red-500">*</span></Label>
                <Select
                  value={itemInput.uom}
                  onValueChange={(val) => handleItemFieldChange("uom", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {uomOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Item Priority <span className="text-red-500">*</span></Label>
                <Select
                  value={itemInput.itemPriority}
                  onValueChange={(val) => handleItemFieldChange("itemPriority", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leadTime">Expected Date of Raw Material Delivery <span className="text-red-500">*</span></Label>
                <Input
                  id="leadTime"
                  type="date"
                  value={formData.leadTime}
                  onChange={(e) =>
                    setFormData({ ...formData, leadTime: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Item Attachment (Optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="item-detail-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setItemInput((prev) => ({ ...prev, attachment: file }));
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="item-detail-attachment"
                    className="flex-1 flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs transition-colors"
                  >
                    <span className="text-slate-500 truncate max-w-[160px]">
                      {itemInput.attachment ? itemInput.attachment.name : "Choose file..."}
                    </span>
                    <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                  </label>
                  {itemInput.attachment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => setItemInput((prev) => ({ ...prev, attachment: null }))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={handleAddItemToList}
                variant="outline"
                className="w-full sm:w-auto px-6 border-slate-200 text-slate-800 hover:bg-slate-100 hover:text-black font-semibold h-10 transition-colors"
              >
                + Add Item to List
              </Button>
            </div>
          </div>

          {/* Step 2: Item List (Bottom) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-700">2</span>
              Added Items List ({formData.items.length})
            </h3>

            {formData.items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                <p className="text-sm text-slate-400">
                  No items added to the list yet. Fill in the section above and click "+ Add Item to List".
                </p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150">
                      <th className="p-3 font-semibold text-slate-700">Category</th>
                      <th className="p-3 font-semibold text-slate-700">Item Name</th>
                      <th className="p-3 font-semibold text-slate-700">Priority</th>
                      <th className="p-3 font-semibold text-slate-700">Quantity</th>
                      <th className="p-3 font-semibold text-slate-700">UOM</th>
                      <th className="p-3 font-semibold text-slate-700">Item Code</th>
                      <th className="p-3 font-semibold text-slate-700">Attachment</th>
                      <th className="p-3 font-semibold text-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="p-3"><Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">{item.category}</Badge></td>
                        <td className="p-3 font-semibold text-slate-800">{item.itemName}</td>
                        <td className="p-3">
                          <Badge className={cn(
                            item.itemPriority === "high" && "bg-red-100 text-red-800 hover:bg-red-150 border-red-200",
                            item.itemPriority === "medium" && "bg-amber-100 text-amber-800 hover:bg-amber-150 border-amber-200",
                            item.itemPriority === "low" && "bg-green-100 text-green-800 hover:bg-green-150 border-green-200"
                          )} variant="outline">
                            {item.itemPriority ? item.itemPriority.toUpperCase() : "-"}
                          </Badge>
                        </td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">{item.uom}</td>
                        <td className="p-3 font-mono text-xs">{item.itemCode}</td>
                        <td className="p-3 font-mono text-xs">
                          <AttachmentCell url={item.attachment} />
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                items: formData.items.filter((_, i) => i !== index),
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step 4: Create Indent Submit Action */}
          <div className="pt-6 border-t flex justify-end">
            <Button
              type="button"
              disabled={
                !formData.createdBy ||
                !formData.warehouseLocation ||
                !formData.leadTime ||
                formData.items.length === 0 ||
                isSubmitting
              }
              onClick={handleSubmit}
              className="w-full sm:w-80 bg-blue-700 text-white hover:bg-blue-800 h-11 text-sm font-semibold tracking-wide shadow-lg shadow-slate-150 transition-all rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Indent...
                </>
              ) : (
                <>
                  Create Indent ({formData.items.length} item
                  {formData.items.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* === EDIT RECORD MODAL === */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Indent Record</DialogTitle>
            <p className="text-sm text-gray-600">
              {editingRecord ? `Editing: ${editingRecord.data.indentNumber}` : ""}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRecordInSheet();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <Select
                    value={editFormData.createdBy}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, createdBy: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select creator" />
                    </SelectTrigger>
                    <SelectContent>
                      {createdByOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={editFormData.warehouseLocation}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, warehouseLocation: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Combobox
                    options={categoryOptions}
                    value={editFormData.category}
                    onChange={(val) =>
                      setEditFormData({
                        ...editFormData,
                        category: val,
                        itemName: "",
                        itemCode: ""
                      })
                    }
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Combobox
                    options={editFormData.category ? getItemsByCategory(editFormData.category).map(i => i.itemName) : []}
                    value={editFormData.itemName}
                    onChange={(val) => {
                      const selectedItem = dropdownData.find(
                        d => d.category === editFormData.category && d.itemName === val
                      );
                      setEditFormData({
                        ...editFormData,
                        itemName: val,
                        itemCode: selectedItem?.itemCode || "",
                        uom: selectedItem?.uom || itemUomMap[val] || editFormData.uom,
                      });
                    }}
                    placeholder={editFormData.category ? "Select item" : "Select category first"}
                    searchPlaceholder="Search item..."
                    disabled={!editFormData.category}
                    stockMap={itemStockMap}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Quantity</Label>
                    {editFormData.itemName && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Avail: {itemStockMap[editFormData.itemName] || itemStockMap[editFormData.itemCode] || 0} {editFormData.uom || itemUomMap[editFormData.itemName] || "Nos"}
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={editFormData.quantity}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, quantity: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>UOM</Label>
                  <Select
                    value={editFormData.uom}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, uom: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {uomOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expected Date of Raw Material Delivery</Label>
                  <Input
                    type="date"
                    value={editFormData.leadTime}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, leadTime: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delivery Location</Label>
                  <Select
                    value={editFormData.deliveryLocation}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, deliveryLocation: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select delivery location" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryLocationOptions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">No locations configured</div>
                      ) : (
                        deliveryLocationOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Priority</Label>
                  <Select
                    value={editFormData.itemPriority}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, itemPriority: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Item Code</Label>
                  <Input
                    type="text"
                    placeholder="Auto-filled"
                    value={editFormData.itemCode}
                    readOnly
                    className="bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Attachment</Label>
                <div className="flex flex-col gap-3">
                  {editFormData.existingAttachmentUrl && !editFormData.attachment && (() => {
                    const isImage = editFormData.existingAttachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)|(drive\.google\.com.*(id=|\/d\/))/i);
                    let previewUrl = editFormData.existingAttachmentUrl;

                    // Convert Google Drive link to direct image link for preview if possible
                    if (previewUrl.includes('drive.google.com')) {
                      const fileId = previewUrl.match(/\/d\/(.+?)\//)?.[1] || previewUrl.match(/id=(.+?)(&|$)/)?.[1];
                      if (fileId) {
                        previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                      }
                    }

                    return (
                      <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-100/50 aspect-video flex flex-col items-center justify-center transition-all hover:bg-slate-100">
                        {isImage ? (
                          <img
                            src={previewUrl}
                            alt="Previous attachment"
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <a
                            href={editFormData.existingAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-lg shadow-sm font-semibold text-slate-900 hover:bg-white hover:scale-105 transition-all text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            Open Previous Attachment
                          </a>
                          {!isImage && (
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-200/50 px-2 py-1 rounded">No image preview available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    id="edit-indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditFormData({ ...editFormData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="edit-indent-attachment"
                    className="flex items-center justify-center w-full py-4 px-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Upload className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="text-left leading-tight">
                        <p className="text-sm font-semibold text-slate-700">
                          {editFormData.attachment ? "Change Document" : "Update Document"}
                        </p>
                        <p className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {editFormData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-blue-100 rounded-md">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                            {editFormData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">New document selected</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => setEditFormData({ ...editFormData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingRecord(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
