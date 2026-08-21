"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Plus,
  Trash2,
  Loader2,
  Users,
  MapPin,
  ShieldCheck,
  Truck,
  FileText,
  Boxes,
  HelpCircle,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Wrench,
  CheckSquare,
  XCircle,
  Clock,
  Edit3,
  Check,
  Layers,
  Building2,
  Navigation,
  Hash,
  Percent,
  CreditCard,
} from "lucide-react";
import { STAGES } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";
import { isMissingColumnError } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import { usePagination } from "@/lib/use-pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";

interface ItemOption {
  itemCode: string;
  category: string;
  itemName: string;
  uom: string;
}

interface TransporterInfo {
  transporterName: string;
  contactPerson: string;
  phone: string;
  vehicleType: string;
}

interface VendorInfo {
  vendorName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  billingAddress: string;
  gstin: string;
  panNumber: string;
}

interface AddressInfo {
  name: string;
  address: string;
}

/**
 * Searchable + creatable dropdown: click to see all options, type to filter,
 * and if nothing matches, "Add '<value>'" persists it to the master table and
 * selects it. Defined at module scope (not inside MasterPage) so its identity
 * stays stable across re-renders — otherwise React would remount it on every
 * keystroke of the parent and the field would drop focus after each character.
 */
function Combobox({
  options,
  value,
  onSelect,
  onCreate,
  placeholder,
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  onCreate: (value: string) => Promise<boolean>;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [creating, setCreating] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keep the input text in sync when the committed value changes externally
  // (e.g. the parent resets the form after a successful submit).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value); // discard any unconfirmed typing
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? options.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const hasExactMatch = options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase());
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;

  const selectOption = (option: string) => {
    onSelect(option);
    setQuery(option);
    setOpen(false);
  };

  const createAndSelect = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    const ok = await onCreate(trimmedQuery);
    setCreating(false);
    if (ok) {
      onSelect(trimmedQuery);
      setQuery(trimmedQuery);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (hasExactMatch) {
            const match = options.find((o) => o.toLowerCase() === trimmedQuery.toLowerCase())!;
            selectOption(match);
          } else if (canCreate) {
            createAndSelect();
          }
        }}
        placeholder={placeholder}
        className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-xs text-slate-400">No options found</div>
          )}
          {filtered.map((option) => (
            <div
              key={option}
              className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 flex items-center gap-2 text-slate-700"
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option);
              }}
            >
              <Check className={cn("h-3.5 w-3.5 shrink-0", value === option ? "opacity-100 text-blue-600" : "opacity-0")} />
              <span className="truncate">{option}</span>
            </div>
          ))}
          {canCreate && (
            <div
              className={cn(
                "px-3 py-2 text-xs flex items-center gap-2 font-medium border-t border-slate-100",
                creating ? "text-slate-400 cursor-wait" : "text-blue-600 cursor-pointer hover:bg-blue-50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                createAndSelect();
              }}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{creating ? "Adding..." : `Add "${trimmedQuery}"`}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MasterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("createdBy");

  // TAT Manager state variables
  interface TatRule {
    systemName: string;
    sectionName: string;
    timeUnit: string;
    completionTime: number;
  }
  const [currentView, setCurrentView] = useState<"config" | "tat">("config");
  const [tatRules, setTatRules] = useState<TatRule[]>([]);
  const [tatForm, setTatForm] = useState<TatRule>({
    systemName: "Purchase FMS",
    sectionName: "Create Indent",
    timeUnit: "day",
    completionTime: 1
  });
  const [editingTatIndex, setEditingTatIndex] = useState<number | null>(null);

  // Managed Dropdown Lists
  const [createdBy, setCreatedBy] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState<string[]>([]);
  const [approver, setApprover] = useState<string[]>([]);
  const [transporter, setTransporter] = useState<TransporterInfo[]>([]);
  const [newTransporter, setNewTransporter] = useState<TransporterInfo>({ transporterName: "", contactPerson: "", phone: "", vehicleType: "" });
  const [transporterSearch, setTransporterSearch] = useState<string>("");
  const [accountant, setAccountant] = useState<string[]>([]);
  const [uom, setUom] = useState<string[]>([]);
  const [qcEngineer, setQcEngineer] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState<string[]>([]);
  const [cancelStages, setCancelStages] = useState<string[]>([]);
  const [tatSystems, setTatSystems] = useState<string[]>([]);
  const [tatUnits, setTatUnits] = useState<string[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<string[]>([]);
  const [hsnCodes, setHsnCodes] = useState<string[]>([]);
  const [transportTypes, setTransportTypes] = useState<string[]>([]);
  const [gstRates, setGstRates] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([]);
  
  // Complex items catalog
  const [items, setItems] = useState<ItemOption[]>([]);
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [newVendor, setNewVendor] = useState<VendorInfo>({ vendorName: "", contactPerson: "", phone: "", email: "", address: "", billingAddress: "", gstin: "", panNumber: "" });
  const [vendorSearch, setVendorSearch] = useState<string>("");

  // Our company's own addresses (billing / destination), used as a shared
  // dropdown source in the Quotation RFQ form and the Create PO form.
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [newAddress, setNewAddress] = useState<AddressInfo>({ name: "", address: "" });
  const [addressSearch, setAddressSearch] = useState<string>("");

  // Categories are now their own dedicated master list (Category Master), same as UOMs
  const [categoryList, setCategoryList] = useState<string[]>([]);

  // Form Inputs
  const [newSimpleVal, setNewSimpleVal] = useState<string>("");
  const [newItem, setNewItem] = useState<ItemOption>({ itemCode: "", category: "", itemName: "", uom: "" });
  const [itemSearch, setItemSearch] = useState<string>("");

  // Options shown in the Category combobox: the Category Master list, plus any category
  // already used on an existing item (in case it predates the master table / migration).
  const categoryOptions = useMemo(
    () => Array.from(new Set([...categoryList, ...items.map((i) => i.category)])).filter(Boolean),
    [categoryList, items]
  );

  const fetchDropdowns = async () => {
    setIsLoading(true);
    try {
      const [
        cbRes, whRes, apRes, qcRes, acRes, uomRes, catRes, chRes, rjRes,
        csRes, tsRes, tuRes, transRes, venRes, itemRes, addrRes, dlRes, hsnRes, ttRes, gstRes, ptRes
      ] = await Promise.all([
        supabase.from("master_created_by").select("name").eq("is_active", true),
        supabase.from("master_warehouses").select("name").eq("is_active", true),
        supabase.from("master_approvers").select("name").eq("is_active", true),
        supabase.from("master_qc_engineers").select("name").eq("is_active", true),
        supabase.from("master_accountants").select("name").eq("is_active", true),
        supabase.from("master_uoms").select("name").eq("is_active", true),
        supabase.from("master_categories").select("name").eq("is_active", true),
        supabase.from("master_checklists").select("name").eq("is_active", true),
        supabase.from("master_reject_reasons").select("name").eq("is_active", true),
        supabase.from("master_cancel_stages").select("name").eq("is_active", true),
        supabase.from("master_tat_systems").select("name").eq("is_active", true),
        supabase.from("master_tat_units").select("name").eq("is_active", true),
        supabase.from("master_transporters").select("*").eq("is_active", true),
        supabase.from("master_vendors").select("*").eq("is_active", true),
        supabase.from("master_items").select("*").eq("is_active", true),
        supabase.from("master_addresses").select("*").eq("is_active", true),
        supabase.from("master_delivery_locations").select("name").eq("is_active", true),
        supabase.from("master_hsn_codes").select("name").eq("is_active", true),
        supabase.from("master_transport_types").select("name").eq("is_active", true),
        supabase.from("master_gst_rates").select("name").eq("is_active", true),
        supabase.from("master_payment_terms").select("name").eq("is_active", true),
      ]);

      const mapNames = (res: any, defaults: string[]) => {
        if (res.error) return defaults;
        if (res.data !== null && res.data !== undefined) {
          return (res.data || []).map((r: any) => r.name).filter(Boolean);
        }
        return defaults;
      };

      let cbList = mapNames(cbRes, ["Amit Sahu", "Admin", "Purchase Team"]);
      let whList = mapNames(whRes, ["Divison A", "Division B", "Depot Main"]);
      let apList = mapNames(apRes, ["Approver User", "Fin Director", "QA Manager"]);
      let qcList = mapNames(qcRes, ["QC Eng 1", "QC Eng 2"]);
      let acList = mapNames(acRes, ["Acc 1", "Acc 2"]);
      let uomList = mapNames(uomRes, ["Nos", "Sets", "Kgs", "Bags", "Mtrs"]);
      let catList = mapNames(catRes, ["Raw Material", "Hardware", "Electronics", "Office Supplies", "General"]);
      let chList = mapNames(chRes, ["Check Packaging", "Check Quality Standards", "Quantity Audit"]);
      let rjList = mapNames(rjRes, ["Damaged Material", "Specification Mismatch", "Short Supply"]);
      let csList = mapNames(csRes, ["Create Indent", "Indent Approval", "Quotation", "Approved Vendor", "Make PO", "Payment", "Follow UP / Lifting", "Transporter Follow-Up", "Material Received", "Billing", "Order Cancel"]);
      let tsList = mapNames(tsRes, ["Purchase FMS", "IMS", "FMS", "FMS Portal"]);
      let tuList = mapNames(tuRes, ["minute", "hour", "day"]);
      let dlList = mapNames(dlRes, ["Raipur Warehouse", "Bhilai Factory Gate", "Durg Site Office", "Naya Raipur HQ"]);
      let hsnList = mapNames(hsnRes, ["7308", "7326", "8481", "3926"]);
      let ttList = mapNames(ttRes, ["Ex-Factory Only", "Ex-Factory in Transport Office", "F.O.R. (Free on Road)"]);
      let gstList = mapNames(gstRes, ["0%", "5%", "12%", "18%", "28%"]);
      let ptList = mapNames(ptRes, ["Advance", "15 days", "30 days", "60 days", "90 days"]);

      setCreatedBy(cbList);
      setWarehouse(whList);
      setApprover(apList);
      setQcEngineer(qcList);
      setAccountant(acList);
      setUom(uomList);
      setCategoryList(catList);
      setChecklist(chList);
      setRejectReason(rjList);
      setCancelStages(csList);
      setTatSystems(tsList);
      setDeliveryLocations(dlList);
      setHsnCodes(hsnList);
      setTransportTypes(ttList);
      setGstRates(gstList);
      setPaymentTerms(ptList);
      setTatUnits(tuList);

      const parsedTransporters: TransporterInfo[] = (transRes.data && transRes.data.length > 0)
        ? transRes.data.map((t: any) => ({
            transporterName: t.transporter_name,
            contactPerson: t.contact_person || "-",
            phone: t.phone || "-",
            vehicleType: t.vehicle_type || "truck",
          }))
        : [
            { transporterName: "Fast Logistics", contactPerson: "Jane Smith", phone: "9876543210", vehicleType: "truck" },
            { transporterName: "Swift Movers", contactPerson: "John Doe", phone: "9876501234", vehicleType: "van" }
          ];
      setTransporter(parsedTransporters);

      const parsedVendors: VendorInfo[] = (venRes.data && venRes.data.length > 0)
        ? venRes.data.map((v: any) => ({
            vendorName: v.vendor_name,
            contactPerson: v.contact_person || "-",
            phone: v.phone || "-",
            email: v.email || "-",
            address: v.address || "-",
            billingAddress: v.billing_address || "-",
            gstin: v.gstin || "-",
            panNumber: v.pan_number || "-",
          }))
        : [
            { vendorName: "INFOSYS TECH", contactPerson: "Nandan Nilekani", phone: "9876543210", email: "infosys@company.com", address: "Electronic City, Bangalore", billingAddress: "-", gstin: "-", panNumber: "-" },
            { vendorName: "KOTAK MAHINDRA", contactPerson: "Uday Kotak", phone: "9876501234", email: "kotak@company.com", address: "Bandra Kurla Complex, Mumbai", billingAddress: "-", gstin: "-", panNumber: "-" },
          ];
      setVendors(parsedVendors);

      const parsedAddresses: AddressInfo[] = (addrRes.data && addrRes.data.length > 0)
        ? addrRes.data.map((a: any) => ({
            name: a.name,
            address: a.address || "-",
          }))
        : [
            { name: "M/S Nutech Pvt. Ltd.", address: "Swarnabhoomi, C-131, R-5, Vidhan Sabha Road, Naya Raipur, Chattisgarh, India, Raipur, Chattisgarh 493111, IN" },
          ];
      setAddresses(parsedAddresses);

      const parsedItems: ItemOption[] = (itemRes.data && itemRes.data.length > 0)
        ? itemRes.data.map((i: any) => ({
            itemCode: i.item_code,
            category: i.category || "General",
            itemName: i.item_name,
            uom: i.uom || "Nos",
          }))
        : [
            { itemCode: "IT-LAP-101", category: "IT Supplies", itemName: "Dell Latitude Laptop", uom: "pcs" },
            { itemCode: "OFF-CHR-002", category: "Office Furniture", itemName: "Ergonomic Chair", uom: "pcs" }
          ];
      setItems(parsedItems);

    } catch (e) {
      console.error(e);
      toast.error("Network error fetching options.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTatRules = async () => {
    try {
      const { data: rows, error } = await supabase
        .from("master_tat_rules")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      if (rows) {
        const rules: TatRule[] = rows.map((r: any) => ({
          systemName: r.system_name,
          sectionName: r.section_name,
          timeUnit: r.time_unit,
          completionTime: Number(r.completion_time) || 1,
        }));
        setTatRules(rules);
      }
    } catch (e) {
      console.error("Error fetching TAT rules:", e);
    }
  };

  const saveTatRules = async (rulesToSave: TatRule[]) => {
    setIsSubmitting(true);
    try {
      await supabase.from("master_tat_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      if (rulesToSave.length > 0) {
        const rowsToInsert = rulesToSave.map(rule => ({
          system_name: rule.systemName,
          section_name: rule.sectionName,
          time_unit: rule.timeUnit,
          completion_time: rule.completionTime,
          is_active: true,
        }));
        await supabase.from("master_tat_rules").insert(rowsToInsert);
      }

      toast.success("TAT rules saved successfully!");
    } catch (e) {
      console.error("Error saving TAT rules:", e);
      toast.error("Error saving TAT rules");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTatRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tatForm.systemName || !tatForm.sectionName || !tatForm.timeUnit || tatForm.completionTime <= 0) {
      toast.error("Please fill out all fields correctly!");
      return;
    }

    if (editingTatIndex !== null) {
      const updated = [...tatRules];
      updated[editingTatIndex] = tatForm;
      setTatRules(updated);
      saveTatRules(updated);
      setEditingTatIndex(null);
    } else {
      if (tatRules.some(r => r.systemName === tatForm.systemName && r.sectionName === tatForm.sectionName)) {
        toast.warning("A TAT rule for this system and page already exists!");
        return;
      }
      const updated = [...tatRules, tatForm];
      setTatRules(updated);
      saveTatRules(updated);
    }

    setTatForm({
      systemName: "Purchase FMS",
      sectionName: "Create Indent",
      timeUnit: "day",
      completionTime: 1
    });
  };

  const handleDeleteTatRule = (idx: number) => {
    const updated = tatRules.filter((_, i) => i !== idx);
    setTatRules(updated);
    saveTatRules(updated);
    if (editingTatIndex === idx) {
      setEditingTatIndex(null);
      setTatForm({
        systemName: "Purchase FMS",
        sectionName: "Create Indent",
        timeUnit: "day",
        completionTime: 1
      });
    }
  };

  const handleStartEditTatRule = (idx: number) => {
    setEditingTatIndex(idx);
    setTatForm(tatRules[idx]);
  };

  useEffect(() => {
    fetchDropdowns();
    fetchTatRules();
  }, []);

  // Save the current states back to Supabase separate master tables
  const handleSave = async (
    updatedCreatedBy = createdBy,
    updatedWarehouse = warehouse,
    updatedApprover = approver,
    updatedTransporter = transporter,
    updatedQcEngineer = qcEngineer,
    updatedAccountant = accountant,
    updatedUom = uom,
    updatedChecklist = checklist,
    updatedRejectReason = rejectReason,
    updatedCancelStages = cancelStages,
    updatedItems = items,
    updatedTatSystems = tatSystems,
    updatedTatUnits = tatUnits,
    updatedVendors = vendors
  ) => {
    setIsSubmitting(true);

    try {
      if (updatedCreatedBy.length > 0) {
        await supabase.from("master_created_by").upsert(updatedCreatedBy.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedWarehouse.length > 0) {
        await supabase.from("master_warehouses").upsert(updatedWarehouse.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedApprover.length > 0) {
        await supabase.from("master_approvers").upsert(updatedApprover.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedQcEngineer.length > 0) {
        await supabase.from("master_qc_engineers").upsert(updatedQcEngineer.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedAccountant.length > 0) {
        await supabase.from("master_accountants").upsert(updatedAccountant.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedUom.length > 0) {
        await supabase.from("master_uoms").upsert(updatedUom.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedChecklist.length > 0) {
        await supabase.from("master_checklists").upsert(updatedChecklist.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedRejectReason.length > 0) {
        await supabase.from("master_reject_reasons").upsert(updatedRejectReason.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedCancelStages.length > 0) {
        await supabase.from("master_cancel_stages").upsert(updatedCancelStages.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedTatSystems.length > 0) {
        await supabase.from("master_tat_systems").upsert(updatedTatSystems.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedTatUnits.length > 0) {
        await supabase.from("master_tat_units").upsert(updatedTatUnits.map(name => ({ name })), { onConflict: "name" });
      }
      if (updatedTransporter.length > 0) {
        await supabase.from("master_transporters").upsert(
          updatedTransporter.map(t => ({
            transporter_name: t.transporterName,
            contact_person: t.contactPerson || "-",
            phone: t.phone || "-",
            vehicle_type: t.vehicleType || "truck",
          })),
          { onConflict: "transporter_name" }
        );
      }
      if (updatedVendors.length > 0) {
        await supabase.from("master_vendors").upsert(
          updatedVendors.map(v => ({
            vendor_name: v.vendorName,
            contact_person: v.contactPerson || "-",
            phone: v.phone || "-",
            email: v.email || "-",
            address: v.address || "-",
            billing_address: v.billingAddress || "-",
            gstin: v.gstin || "-",
            pan_number: v.panNumber || "-",
          })),
          { onConflict: "vendor_name" }
        );
      }
      if (updatedItems.length > 0) {
        await supabase.from("master_items").upsert(
          updatedItems.map(i => ({
            item_code: i.itemCode,
            category: i.category,
            item_name: i.itemName,
            uom: i.uom,
          })),
          { onConflict: "item_code" }
        );
      }
      toast.success("Options synchronized successfully across master tables!");
    } catch (e) {
      console.error(e);
      toast.error("Error saving options to database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table map for simple string dropdowns
  const simpleTableMap: Record<string, string> = {
    createdBy: "master_created_by",
    warehouse: "master_warehouses",
    approver: "master_approvers",
    qcEngineer: "master_qc_engineers",
    accountant: "master_accountants",
    uom: "master_uoms",
    category: "master_categories",
    checklist: "master_checklists",
    rejectReason: "master_reject_reasons",
    cancelStage: "master_cancel_stages",
    tatSystem: "master_tat_systems",
    tatUnit: "master_tat_units",
    deliveryLocation: "master_delivery_locations",
    hsnCode: "master_hsn_codes",
    transportType: "master_transport_types",
    gstRate: "master_gst_rates",
    paymentTerms: "master_payment_terms",
  };

  // Add simple value
  const handleAddSimple = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSimpleVal.trim();
    if (!val) return;

    const tableName = simpleTableMap[activeTab];
    if (tableName) {
      const { error } = await supabase.from(tableName).upsert({ name: val, is_active: true }, { onConflict: "name" });
      if (error) {
        console.warn(`Note when adding '${val}' to ${tableName}:`, error);
      }
    }

    switch (activeTab) {
      case "createdBy": setCreatedBy(prev => Array.from(new Set([...prev, val]))); break;
      case "warehouse": setWarehouse(prev => Array.from(new Set([...prev, val]))); break;
      case "approver": setApprover(prev => Array.from(new Set([...prev, val]))); break;
      case "qcEngineer": setQcEngineer(prev => Array.from(new Set([...prev, val]))); break;
      case "accountant": setAccountant(prev => Array.from(new Set([...prev, val]))); break;
      case "uom": setUom(prev => Array.from(new Set([...prev, val]))); break;
      case "category": setCategoryList(prev => Array.from(new Set([...prev, val]))); break;
      case "checklist": setChecklist(prev => Array.from(new Set([...prev, val]))); break;
      case "rejectReason": setRejectReason(prev => Array.from(new Set([...prev, val]))); break;
      case "cancelStage": setCancelStages(prev => Array.from(new Set([...prev, val]))); break;
      case "tatSystem": setTatSystems(prev => Array.from(new Set([...prev, val]))); break;
      case "tatUnit": setTatUnits(prev => Array.from(new Set([...prev, val]))); break;
      case "deliveryLocation": setDeliveryLocations(prev => Array.from(new Set([...prev, val]))); break;
      case "hsnCode": setHsnCodes(prev => Array.from(new Set([...prev, val]))); break;
      case "transportType": setTransportTypes(prev => Array.from(new Set([...prev, val]))); break;
      case "gstRate": setGstRates(prev => Array.from(new Set([...prev, val]))); break;
      case "paymentTerms": setPaymentTerms(prev => Array.from(new Set([...prev, val]))); break;
    }

    toast.success(`Added '${val}' successfully!`);
    setNewSimpleVal("");
  };

  // Remove simple value
  const handleRemoveSimple = async (valToRemove: string) => {
    const tableName = simpleTableMap[activeTab];
    if (tableName) {
      const { error } = await supabase.from(tableName).delete().eq("name", valToRemove);
      if (error) {
        console.warn(`Note when removing '${valToRemove}' from ${tableName}:`, error);
      }
    }

    switch (activeTab) {
      case "createdBy": setCreatedBy(prev => prev.filter(item => item !== valToRemove)); break;
      case "warehouse": setWarehouse(prev => prev.filter(item => item !== valToRemove)); break;
      case "approver": setApprover(prev => prev.filter(item => item !== valToRemove)); break;
      case "qcEngineer": setQcEngineer(prev => prev.filter(item => item !== valToRemove)); break;
      case "accountant": setAccountant(prev => prev.filter(item => item !== valToRemove)); break;
      case "uom": setUom(prev => prev.filter(item => item !== valToRemove)); break;
      case "category": setCategoryList(prev => prev.filter(item => item !== valToRemove)); break;
      case "checklist": setChecklist(prev => prev.filter(item => item !== valToRemove)); break;
      case "rejectReason": setRejectReason(prev => prev.filter(item => item !== valToRemove)); break;
      case "cancelStage": setCancelStages(prev => prev.filter(item => item !== valToRemove)); break;
      case "tatSystem": setTatSystems(prev => prev.filter(item => item !== valToRemove)); break;
      case "tatUnit": setTatUnits(prev => prev.filter(item => item !== valToRemove)); break;
      case "deliveryLocation": setDeliveryLocations(prev => prev.filter(item => item !== valToRemove)); break;
      case "hsnCode": setHsnCodes(prev => prev.filter(item => item !== valToRemove)); break;
      case "transportType": setTransportTypes(prev => prev.filter(item => item !== valToRemove)); break;
      case "gstRate": setGstRates(prev => prev.filter(item => item !== valToRemove)); break;
      case "paymentTerms": setPaymentTerms(prev => prev.filter(item => item !== valToRemove)); break;
    }

    toast.success(`Removed '${valToRemove}' successfully!`);
  };

  // Create-on-the-fly handlers for the Category / UOM comboboxes on the item form.
  // Both persist to their own master table and are case-insensitive-duplicate-safe;
  // if the value already exists (any case), nothing is inserted — it's just selected.
  const createCategoryOption = async (raw: string): Promise<boolean> => {
    const val = raw.trim();
    if (!val) return false;
    if (categoryOptions.some((c) => c.toLowerCase() === val.toLowerCase())) return true;

    const { error } = await supabase
      .from("master_categories")
      .upsert({ name: val, is_active: true }, { onConflict: "name" });
    if (error) {
      toast.error("Failed to add category");
      return false;
    }
    setCategoryList((prev) => Array.from(new Set([...prev, val])));
    toast.success(`Category '${val}' added`);
    return true;
  };

  const createUomOption = async (raw: string): Promise<boolean> => {
    const val = raw.trim();
    if (!val) return false;
    if (uom.some((u) => u.toLowerCase() === val.toLowerCase())) return true;

    const { error } = await supabase
      .from("master_uoms")
      .upsert({ name: val, is_active: true }, { onConflict: "name" });
    if (error) {
      toast.error("Failed to add UOM");
      return false;
    }
    setUom((prev) => Array.from(new Set([...prev, val])));
    toast.success(`UOM '${val}' added`);
    return true;
  };

  // Add Item to Catalog
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newItem.itemCode.trim();
    const cat = newItem.category.trim();
    const name = newItem.itemName.trim();
    const unit = newItem.uom.trim();

    if (!code || !cat || !name || !unit) {
      toast.error("Please fill out all fields!");
      return;
    }

    const { error } = await supabase.from("master_items").upsert({
      item_code: code,
      category: cat,
      item_name: name,
      uom: unit,
      is_active: true,
    }, { onConflict: "item_code" });

    if (error) {
      toast.error("Error saving item to database.");
      return;
    }

    setItems(prev => [...prev.filter(i => i.itemCode !== code), { itemCode: code, category: cat, itemName: name, uom: unit }]);
    setNewItem({ itemCode: "", category: "", itemName: "", uom: "" });
    toast.success("Item added successfully!");
  };

  // Remove Item from Catalog
  const handleRemoveItem = async (codeToRemove: string) => {
    const { error } = await supabase.from("master_items").delete().eq("item_code", codeToRemove);
    if (error) {
      toast.error("Error deleting item from catalog.");
      return;
    }
    setItems(prev => prev.filter(item => item.itemCode !== codeToRemove));
    toast.success("Item removed successfully!");
  };

  // Search filtered catalog items
  const filteredCatalog = useMemo(() => {
    return items.filter(item => {
      const search = itemSearch.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(search) ||
        item.itemCode.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        (item.uom && item.uom.toLowerCase().includes(search))
      );
    });
  }, [items, itemSearch]);

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newVendor.vendorName.trim();
    const contact = newVendor.contactPerson.trim();
    const ph = newVendor.phone.trim();
    const mail = newVendor.email.trim();
    const addr = newVendor.address.trim();
    const billingAddr = newVendor.billingAddress.trim();
    const gstinVal = newVendor.gstin.trim();
    const panVal = newVendor.panNumber.trim();

    if (!name || !contact || !ph || !addr) {
      toast.error("Please fill out all required fields!");
      return;
    }

    let payload: Record<string, any> = {
      vendor_name: name,
      contact_person: contact,
      phone: ph,
      email: mail,
      address: addr,
      billing_address: billingAddr,
      gstin: gstinVal,
      pan_number: panVal,
      is_active: true,
    };
    let extendedFieldsMissing = false;

    let { error } = await supabase.from("master_vendors").upsert(payload, { onConflict: "vendor_name" });
    // billing_address / gstin / pan_number may not exist yet on deployments
    // that haven't run the migration — drop them and retry rather than
    // failing to save the vendor at all.
    while (error && isMissingColumnError(error)) {
      const missingCol = error.message?.match(/column\s+"?([a-zA-Z_]+)"?/i)?.[1];
      if (!missingCol || !(missingCol in payload)) break;
      extendedFieldsMissing = true;
      const { [missingCol]: _drop, ...rest } = payload;
      payload = rest;
      ({ error } = await supabase.from("master_vendors").upsert(payload, { onConflict: "vendor_name" }));
    }

    if (error) {
      toast.error("Error saving vendor.");
      return;
    }

    setVendors(prev => [
      ...prev.filter(v => v.vendorName !== name),
      { vendorName: name, contactPerson: contact, phone: ph, email: mail, address: addr, billingAddress: billingAddr || "-", gstin: gstinVal || "-", panNumber: panVal || "-" },
    ]);
    setNewVendor({ vendorName: "", contactPerson: "", phone: "", email: "", address: "", billingAddress: "", gstin: "", panNumber: "" });
    if (extendedFieldsMissing) {
      toast.warning("Vendor saved, but Billing Address/GSTIN/PAN couldn't be saved — run the pending database migration.");
    } else {
      toast.success("Vendor added successfully!");
    }
  };

  const handleRemoveVendor = async (nameToRemove: string) => {
    const { error } = await supabase.from("master_vendors").delete().eq("vendor_name", nameToRemove);
    if (error) {
      toast.error("Error deleting vendor.");
      return;
    }
    setVendors(prev => prev.filter(v => v.vendorName !== nameToRemove));
    toast.success("Vendor removed successfully!");
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const search = vendorSearch.toLowerCase();
      return (
        v.vendorName.toLowerCase().includes(search) ||
        v.contactPerson.toLowerCase().includes(search) ||
        v.phone.includes(search) ||
        v.email.toLowerCase().includes(search) ||
        v.address.toLowerCase().includes(search)
      );
    });
  }, [vendors, vendorSearch]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAddress.name.trim();
    const addr = newAddress.address.trim();

    if (!name || !addr) {
      toast.error("Please fill out all required fields!");
      return;
    }

    const { error } = await supabase.from("master_addresses").upsert({
      name,
      address: addr,
      is_active: true,
    }, { onConflict: "name" });

    if (error) {
      toast.error("Error saving address.");
      return;
    }

    setAddresses(prev => [...prev.filter(a => a.name !== name), { name, address: addr }]);
    setNewAddress({ name: "", address: "" });
    toast.success("Address added successfully!");
  };

  const handleRemoveAddress = async (nameToRemove: string) => {
    const { error } = await supabase.from("master_addresses").delete().eq("name", nameToRemove);
    if (error) {
      toast.error("Error deleting address.");
      return;
    }
    setAddresses(prev => prev.filter(a => a.name !== nameToRemove));
    toast.success("Address removed successfully!");
  };

  const filteredAddresses = useMemo(() => {
    return addresses.filter(a => {
      const search = addressSearch.toLowerCase();
      return (
        a.name.toLowerCase().includes(search) ||
        a.address.toLowerCase().includes(search)
      );
    });
  }, [addresses, addressSearch]);

  const handleAddTransporter = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTransporter.transporterName.trim();
    const contact = newTransporter.contactPerson.trim();
    const ph = newTransporter.phone.trim();
    const vType = newTransporter.vehicleType.trim();

    if (!name || !contact || !ph || !vType) {
      toast.error("Please fill out all fields!");
      return;
    }

    const { error } = await supabase.from("master_transporters").upsert({
      transporter_name: name,
      contact_person: contact,
      phone: ph,
      vehicle_type: vType,
      is_active: true,
    }, { onConflict: "transporter_name" });

    if (error) {
      toast.error("Error saving transporter.");
      return;
    }

    setTransporter(prev => [...prev.filter(t => t.transporterName !== name), { transporterName: name, contactPerson: contact, phone: ph, vehicleType: vType }]);
    setNewTransporter({ transporterName: "", contactPerson: "", phone: "", vehicleType: "" });
    toast.success("Transporter added successfully!");
  };

  const handleRemoveTransporter = async (nameToRemove: string) => {
    const { error } = await supabase.from("master_transporters").delete().eq("transporter_name", nameToRemove);
    if (error) {
      toast.error("Error deleting transporter.");
      return;
    }
    setTransporter(prev => prev.filter(t => t.transporterName !== nameToRemove));
    toast.success("Transporter removed successfully!");
  };

  const filteredTransporters = useMemo(() => {
    return transporter.filter(t => {
      const search = transporterSearch.toLowerCase();
      return (
        t.transporterName.toLowerCase().includes(search) ||
        t.contactPerson.toLowerCase().includes(search) ||
        t.phone.includes(search) ||
        t.vehicleType.toLowerCase().includes(search)
      );
    });
  }, [transporter, transporterSearch]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const tabsConfig = [
    { id: "createdBy", label: "Created By", icon: Users, desc: "System operators and indent authors." },
    { id: "warehouse", label: "Division / Area", icon: MapPin, desc: "Warehouse depots and lifting destination zones." },
    { id: "items", label: "Product Catalog", icon: Boxes, desc: "Registered inventory items, categories, and item codes." },
    { id: "vendor", label: "Vendors", icon: Users, desc: "Approved material suppliers and service vendors." },
    { id: "address", label: "Addresses", icon: Building2, desc: "Our company's billing & destination addresses used in Quotation RFQ and Create PO." },
    { id: "approver", label: "Approvers", icon: ShieldCheck, desc: "Authorized personnel who approve indents and vendors." },
    { id: "transporter", label: "Transporters", icon: Truck, desc: "Lifting logistics and transporting suppliers." },
    { id: "qcEngineer", label: "QC Engineers", icon: Wrench, desc: "Engineers inspecting items on arrival." },
    { id: "accountant", label: "Accountants", icon: FileText, desc: "Financial accountants posting to Tally." },
    { id: "uom", label: "UOMs", icon: Settings, desc: "Units of Measure (e.g. Nos, Sets, Kgs, Bags)." },
    { id: "category", label: "Categories", icon: Layers, desc: "Item categories used in the Product Catalog." },
    { id: "checklist", label: "QC Checklists", icon: CheckSquare, desc: "Quality inspection standard checklist options." },
    { id: "rejectReason", label: "Reject Reasons", icon: AlertCircle, desc: "Reasons cited for material returns." },
    { id: "cancelStage", label: "Cancel Stages", icon: XCircle, desc: "Stage options for Order Cancellation." },
    { id: "tatSystem", label: "TAT Systems", icon: Settings, desc: "System names for Turn Around Time rules." },
    { id: "tatUnit", label: "TAT Time Units", icon: Clock, desc: "Time duration units for Turn Around Time limits." },
    { id: "deliveryLocation", label: "Delivery Locations", icon: Navigation, desc: "Where an indent's items should be delivered — used in Create Indent and Create PO." },
    { id: "hsnCode", label: "HSN Codes", icon: Hash, desc: "HSN codes used per line item when creating a Purchase Order." },
    { id: "transportType", label: "Transport Types", icon: Truck, desc: "Transport and logistics terms available in Quotations, Approved Vendor, and Purchase Orders." },
    { id: "gstRate", label: "GST Rates", icon: Percent, desc: "GST percentage options available across Quotations, Vendor Approvals, and Purchase Orders." },
    { id: "paymentTerms", label: "Payment Terms", icon: CreditCard, desc: "Commercial payment terms available across Quotations, Vendor Approvals, and Purchase Orders." },
  ];

  const activeTabConfig = tabsConfig.find(t => t.id === activeTab);

  // Whichever simple string list is active in the "Simple Values Management" panel
  // (Created By, Warehouse, Approver, ... Category, TAT Units, etc.)
  const currentSimpleList = useMemo(() => {
    switch (activeTab) {
      case "createdBy": return createdBy;
      case "warehouse": return warehouse;
      case "approver": return approver;
      case "qcEngineer": return qcEngineer;
      case "accountant": return accountant;
      case "uom": return uom;
      case "category": return categoryList;
      case "checklist": return checklist;
      case "rejectReason": return rejectReason;
      case "cancelStage": return cancelStages;
      case "tatSystem": return tatSystems;
      case "tatUnit": return tatUnits;
      case "deliveryLocation": return deliveryLocations;
      case "hsnCode": return hsnCodes;
      case "transportType": return transportTypes;
      case "gstRate": return gstRates;
      case "paymentTerms": return paymentTerms;
      default: return [];
    }
  }, [activeTab, createdBy, warehouse, approver, qcEngineer, accountant, uom, categoryList, checklist, rejectReason, cancelStages, tatSystems, tatUnits, deliveryLocations, hsnCodes, transportTypes, gstRates, paymentTerms]);

  // Preserve each TAT rule's true index (in the full `tatRules` array) through pagination,
  // since handleStartEditTatRule/handleDeleteTatRule operate on that original index.
  const tatRulesIndexed = useMemo(() => tatRules.map((rule, idx) => ({ rule, idx })), [tatRules]);

  const tatRulesPagination = usePagination(tatRulesIndexed, 15);
  const transportersPagination = usePagination(filteredTransporters, 15);
  const catalogPagination = usePagination(filteredCatalog, 15);
  const vendorsPagination = usePagination(filteredVendors, 15);
  const addressesPagination = usePagination(filteredAddresses, 15);
  const simpleListPagination = usePagination(currentSimpleList, 15);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white p-6 shadow-md shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">System Master Settings</h1>
            <p className="text-xs text-slate-400 mt-1">Configure and manage dropdown select values used across the workflow stages.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitting && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold bg-indigo-950/45 px-3 py-1.5 rounded-full border border-indigo-500/35">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving options...
            </div>
          )}
          <Button
            onClick={fetchDropdowns}
            variant="outline"
            className="h-9 px-4 rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-xs"
            disabled={isLoading || isSubmitting}
          >
            {isLoading ? "Fetching..." : "Sync Sheet"}
          </Button>
        </div>
      </div>

      {/* View Switcher Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex gap-2 shrink-0">
        <Button
          onClick={() => setCurrentView("config")}
          variant={currentView === "config" ? "default" : "outline"}
          className={`h-9 px-5 rounded-xl text-xs font-semibold ${
            currentView === "config" ? "bg-blue-700 text-white" : ""
          }`}
        >
          Configurations
        </Button>
        <Button
          onClick={() => setCurrentView("tat")}
          variant={currentView === "tat" ? "default" : "outline"}
          className={`h-9 px-5 rounded-xl text-xs font-semibold ${
            currentView === "tat" ? "bg-blue-700 text-white" : ""
          }`}
        >
          TAT Manager
        </Button>
      </div>

      {/* Main settings body */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === "tat" ? (
          /* TAT MANAGER VIEW */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Add TAT Rule Form */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="flex items-center gap-2 border-b pb-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {editingTatIndex !== null ? "Edit TAT Rule" : "Add TAT Rule"}
                </h4>
              </div>
              <form onSubmit={handleAddTatRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* System Name */}
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs text-slate-655 font-semibold">System Name *</Label>
                  <Select
                    value={tatForm.systemName}
                    onValueChange={(val) => setTatForm(prev => ({ ...prev, systemName: val }))}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select System" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border text-xs rounded-xl shadow-md">
                      {tatSystems.length === 0 ? (
                        <div className="p-2 text-center text-slate-400">No systems configured</div>
                      ) : (
                        tatSystems.map(sys => (
                          <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Page / Section */}
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs text-slate-655 font-semibold">Page / Section *</Label>
                  <Select
                    value={tatForm.sectionName}
                    onValueChange={(val) => setTatForm(prev => ({ ...prev, sectionName: val }))}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border text-xs rounded-xl shadow-md max-h-56 overflow-y-auto">
                      {STAGES.filter(s => s.name !== "Master").map(s => (
                        <SelectItem key={s.slug} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Unit */}
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs text-slate-655 font-semibold">Time Unit *</Label>
                  <Select
                    value={tatForm.timeUnit}
                    onValueChange={(val) => setTatForm(prev => ({ ...prev, timeUnit: val }))}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select Time Unit" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border text-xs rounded-xl shadow-md">
                      {tatUnits.length === 0 ? (
                        <div className="p-2 text-center text-slate-400">No units configured</div>
                      ) : (
                        tatUnits.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Completion Time */}
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs text-slate-655 font-semibold">Completion Time *</Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={tatForm.completionTime || ""}
                    onChange={(e) => setTatForm(prev => ({ ...prev, completionTime: parseInt(e.target.value) || 0 }))}
                    placeholder="Enter value..."
                    className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Submit Actions */}
                <div className="col-span-2 flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md"
                  >
                    {editingTatIndex !== null ? "Update Rule" : "Add Rule"}
                  </Button>
                  {editingTatIndex !== null && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingTatIndex(null);
                        setTatForm({
                          systemName: "Purchase FMS",
                          sectionName: "Create Indent",
                          timeUnit: "day",
                          completionTime: 1
                        });
                      }}
                      className="h-10 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Rules Listing Table Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden max-w-4xl mx-auto flex flex-col">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Configured TAT Rules ({tatRules.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-slate-650">System Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-650">Page / Section</TableHead>
                      <TableHead className="text-xs font-bold text-slate-650">Time Unit</TableHead>
                      <TableHead className="text-xs font-bold text-slate-650 text-center">Completion Time</TableHead>
                      <TableHead className="text-xs font-bold text-slate-650 text-right w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tatRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-400 py-12 text-xs">
                          No TAT rules configured yet. Add rules using the form above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tatRulesPagination.pageData.map(({ rule, idx }) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="text-xs font-semibold text-slate-800">{rule.systemName}</TableCell>
                          <TableCell className="text-xs text-slate-650">{rule.sectionName}</TableCell>
                          <TableCell className="text-xs text-slate-650 font-semibold uppercase">{rule.timeUnit}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-800 text-center">{rule.completionTime}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditTatRule(idx)}
                                className="w-8 h-8 hover:text-indigo-650 rounded-lg text-slate-450"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteTatRule(idx)}
                                className="w-8 h-8 hover:text-red-650 rounded-lg text-slate-450 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <PaginationBar
                  page={tatRulesPagination.page}
                  pageSize={tatRulesPagination.pageSize}
                  totalCount={tatRulesPagination.totalCount}
                  onPageChange={tatRulesPagination.setPage}
                  onPageSizeChange={tatRulesPagination.setPageSize}
                />
              </div>
            </div>
          </div>
        ) : (
          /* CONFIGURATIONS VIEW WITH HORIZONTAL SELECTOR */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Horizontal config tabs selector */}
            <div onWheel={handleWheel} className="bg-white border-b border-slate-200 px-6 py-3 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
              {tabsConfig.map(t => {
                const TabIcon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTab(t.id);
                      setNewSimpleVal("");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-blue-700 text-white shadow-sm"
                        : "bg-slate-50 text-slate-655 hover:bg-slate-100 border border-slate-250/20"
                    }`}
                  >
                    <TabIcon className="w-4 h-4 shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Options List Manager content */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                  <p className="text-sm font-semibold">Loading options database...</p>
                </div>
              ) : (
                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Category Info header */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      {activeTabConfig && <activeTabConfig.icon className="w-5 h-5 text-indigo-600" />}
                      <span>Manage {activeTabConfig?.label}</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">{activeTabConfig?.desc}</p>
                  </div>

                  {activeTab === "transporter" ? (
                    /* TRANSPORTER MANAGEMENT */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                      {/* Left panel: Transporter Form */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Transporter</h4>
                        </div>
                        <form onSubmit={handleAddTransporter} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Transporter Name *</Label>
                            <Input
                              placeholder="e.g. Fast Logistics"
                              value={newTransporter.transporterName}
                              onChange={(e) => setNewTransporter({ ...newTransporter, transporterName: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Contact Person *</Label>
                            <Input
                              placeholder="e.g. Jane Smith"
                              value={newTransporter.contactPerson}
                              onChange={(e) => setNewTransporter({ ...newTransporter, contactPerson: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Phone *</Label>
                            <Input
                              placeholder="e.g. 9876543210"
                              value={newTransporter.phone}
                              onChange={(e) => setNewTransporter({ ...newTransporter, phone: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Vehicle Type *</Label>
                            <Select
                              value={newTransporter.vehicleType}
                              onValueChange={(val) => setNewTransporter({ ...newTransporter, vehicleType: val })}
                            >
                              <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Select Vehicle Type" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border text-xs rounded-xl shadow-md">
                                <SelectItem value="truck">Truck</SelectItem>
                                <SelectItem value="van">Van</SelectItem>
                                <SelectItem value="trailer">Trailer</SelectItem>
                                <SelectItem value="container">Container</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Save Transporter
                          </Button>
                        </form>
                      </div>

                      {/* Right panel: Transporters Table list */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-auto min-h-[400px]">
                        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Transporters ({transporter.length})</h4>
                          <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input
                              placeholder="Search transporters..."
                              value={transporterSearch}
                              onChange={(e) => setTransporterSearch(e.target.value)}
                              className="pl-9 h-9 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow>
                                <TableHead className="text-xs font-bold text-slate-660">Name</TableHead>
                                <TableHead className="text-xs font-bold text-slate-660">Contact Person</TableHead>
                                <TableHead className="text-xs font-bold text-slate-660">Phone</TableHead>
                                <TableHead className="text-xs font-bold text-slate-660">Vehicle Type</TableHead>
                                <TableHead className="w-20 text-xs font-bold text-slate-660 text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredTransporters.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-slate-400 py-12 text-xs">
                                    No transporters found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                transportersPagination.pageData.map((t, idx) => (
                                  <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="text-xs text-slate-800 font-bold">{t.transporterName}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-semibold">{t.contactPerson}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-mono">{t.phone}</TableCell>
                                    <TableCell className="text-xs text-slate-700 capitalize font-medium">{t.vehicleType}</TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        onClick={() => handleRemoveTransporter(t.transporterName)}
                                        variant="ghost"
                                        size="icon"
                                        disabled={isSubmitting}
                                        className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationBar
                          page={transportersPagination.page}
                          pageSize={transportersPagination.pageSize}
                          totalCount={transportersPagination.totalCount}
                          onPageChange={transportersPagination.setPage}
                          onPageSizeChange={transportersPagination.setPageSize}
                        />
                      </div>
                    </div>
                  ) : activeTab === "items" ? (
                    /* PRODUCT CATALOG MANAGEMENT */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                      {/* Left panel: Catalog Addition Form */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Catalog Item</h4>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600">Item Code</Label>
                            <Input
                              placeholder="e.g. IT-LAP-101"
                              value={newItem.itemCode}
                              onChange={(e) => setNewItem({ ...newItem, itemCode: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600">Category *</Label>
                            <Combobox
                              options={categoryOptions}
                              value={newItem.category}
                              onSelect={(val) => setNewItem({ ...newItem, category: val })}
                              onCreate={createCategoryOption}
                              placeholder="Search or type a category..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600">Item Name *</Label>
                            <Input
                              placeholder="e.g. Laptop, Screwdriver"
                              value={newItem.itemName}
                              onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">UOM *</Label>
                            <Combobox
                              options={uom}
                              value={newItem.uom}
                              onSelect={(val) => setNewItem({ ...newItem, uom: val })}
                              onCreate={createUomOption}
                              placeholder="Search or type a UOM..."
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Add to Catalog
                          </Button>
                        </form>
                      </div>

                      {/* Right panel: Catalog Table list */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-auto min-h-[400px]">
                        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Catalog Items ({items.length})</h4>
                          <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input
                              placeholder="Search items..."
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                              className="pl-9 h-9 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow>
                                <TableHead className="w-[100px] text-xs font-bold text-slate-600">Code</TableHead>
                                <TableHead className="w-[120px] text-xs font-bold text-slate-600">Category</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Item Name</TableHead>
                                <TableHead className="w-20 text-xs font-bold text-slate-600">UOM</TableHead>
                                <TableHead className="w-20 text-xs font-bold text-slate-600 text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCatalog.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-slate-400 py-12 text-xs">
                                    No items found in catalog.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                catalogPagination.pageData.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono text-xs text-slate-700">{item.itemCode || "-"}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-semibold">{item.category}</TableCell>
                                    <TableCell className="text-xs text-slate-800 font-bold">{item.itemName}</TableCell>
                                    <TableCell className="text-xs text-slate-700 font-medium capitalize">{item.uom || "-"}</TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.itemCode || item.itemName)}
                                        disabled={isSubmitting}
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:text-red-600 rounded-lg hover:bg-red-50 text-slate-400 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationBar
                          page={catalogPagination.page}
                          pageSize={catalogPagination.pageSize}
                          totalCount={catalogPagination.totalCount}
                          onPageChange={catalogPagination.setPage}
                          onPageSizeChange={catalogPagination.setPageSize}
                        />
                      </div>
                    </div>
                  ) : activeTab === "vendor" ? (
                    /* VENDOR MANAGEMENT */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                      {/* Left panel: Vendor Form */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Vendor</h4>
                        </div>
                        <form onSubmit={handleAddVendor} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Vendor Name *</Label>
                            <Input
                              placeholder="e.g. ABC Suppliers"
                              value={newVendor.vendorName}
                              onChange={(e) => setNewVendor({ ...newVendor, vendorName: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Contact Person *</Label>
                            <Input
                              placeholder="e.g. John Doe"
                              value={newVendor.contactPerson}
                              onChange={(e) => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Phone *</Label>
                            <Input
                              placeholder="e.g. 9876543210"
                              value={newVendor.phone}
                              onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Email</Label>
                            <Input
                              placeholder="e.g. vendor@example.com"
                              type="email"
                              value={newVendor.email}
                              onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Address *</Label>
                            <textarea
                              placeholder="Enter complete address"
                              value={newVendor.address}
                              onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border text-xs rounded-xl bg-slate-50 border-slate-200 resize-none outline-none focus:border-indigo-500 transition-colors"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Billing Address</Label>
                            <textarea
                              placeholder="Enter billing address (if different)"
                              value={newVendor.billingAddress}
                              onChange={(e) => setNewVendor({ ...newVendor, billingAddress: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border text-xs rounded-xl bg-slate-50 border-slate-200 resize-none outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">GSTIN</Label>
                            <Input
                              placeholder="e.g. 27ABCDE1234A1Z5"
                              value={newVendor.gstin}
                              onChange={(e) => setNewVendor({ ...newVendor, gstin: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">PAN Number</Label>
                            <Input
                              placeholder="e.g. ABCDE1234A"
                              value={newVendor.panNumber}
                              onChange={(e) => setNewVendor({ ...newVendor, panNumber: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Save Vendor
                          </Button>
                        </form>
                      </div>

                      {/* Right panel: Vendors Table list */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-auto min-h-[400px]">
                        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Vendors ({vendors.length})</h4>
                          <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input
                              placeholder="Search vendors..."
                              value={vendorSearch}
                              onChange={(e) => setVendorSearch(e.target.value)}
                              className="pl-9 h-9 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow>
                                <TableHead className="text-xs font-bold text-slate-600">Name</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Contact Person</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Phone</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Email</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Address</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Billing Address</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">GSTIN</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">PAN</TableHead>
                                <TableHead className="w-20 text-xs font-bold text-slate-600 text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredVendors.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center text-slate-400 py-12 text-xs">
                                    No vendors found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                vendorsPagination.pageData.map((v, idx) => (
                                  <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="text-xs text-slate-800 font-bold">{v.vendorName}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-semibold">{v.contactPerson}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-mono">{v.phone}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-semibold">{v.email || "-"}</TableCell>
                                    <TableCell className="text-xs text-slate-700 font-medium truncate max-w-[150px]">{v.address}</TableCell>
                                    <TableCell className="text-xs text-slate-700 font-medium truncate max-w-[150px]">{v.billingAddress}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-mono">{v.gstin}</TableCell>
                                    <TableCell className="text-xs text-slate-600 font-mono">{v.panNumber}</TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        onClick={() => handleRemoveVendor(v.vendorName)}
                                        variant="ghost"
                                        size="icon"
                                        disabled={isSubmitting}
                                        className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationBar
                          page={vendorsPagination.page}
                          pageSize={vendorsPagination.pageSize}
                          totalCount={vendorsPagination.totalCount}
                          onPageChange={vendorsPagination.setPage}
                          onPageSizeChange={vendorsPagination.setPageSize}
                        />
                      </div>
                    </div>
                  ) : activeTab === "address" ? (
                    /* ADDRESS MANAGEMENT */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                      {/* Left panel: Address Form */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Address</h4>
                        </div>
                        <form onSubmit={handleAddAddress} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Company / Location Name *</Label>
                            <Input
                              placeholder="e.g. M/S Nutech Pvt. Ltd. (Warehouse)"
                              value={newAddress.name}
                              onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                              className="h-10 text-xs rounded-xl"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Address *</Label>
                            <textarea
                              placeholder="Enter complete address"
                              value={newAddress.address}
                              onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 border text-xs rounded-xl bg-slate-50 border-slate-200 resize-none outline-none focus:border-indigo-500 transition-colors"
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Save Address
                          </Button>
                        </form>
                      </div>

                      {/* Right panel: Addresses Table list */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-auto min-h-[400px]">
                        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Addresses ({addresses.length})</h4>
                          <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                            <Input
                              placeholder="Search addresses..."
                              value={addressSearch}
                              onChange={(e) => setAddressSearch(e.target.value)}
                              className="pl-9 h-9 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow>
                                <TableHead className="text-xs font-bold text-slate-600">Name</TableHead>
                                <TableHead className="text-xs font-bold text-slate-600">Address</TableHead>
                                <TableHead className="w-20 text-xs font-bold text-slate-600 text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAddresses.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center text-slate-400 py-12 text-xs">
                                    No addresses found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                addressesPagination.pageData.map((a, idx) => (
                                  <TableRow key={idx} className="hover:bg-slate-50/50">
                                    <TableCell className="text-xs text-slate-800 font-bold">{a.name}</TableCell>
                                    <TableCell className="text-xs text-slate-700 font-medium truncate max-w-[300px]">{a.address}</TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        onClick={() => handleRemoveAddress(a.name)}
                                        variant="ghost"
                                        size="icon"
                                        disabled={isSubmitting}
                                        className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <PaginationBar
                          page={addressesPagination.page}
                          pageSize={addressesPagination.pageSize}
                          totalCount={addressesPagination.totalCount}
                          onPageChange={addressesPagination.setPage}
                          onPageSizeChange={addressesPagination.setPageSize}
                        />
                      </div>
                    </div>
                  ) : (
                    /* SIMPLE VALUES MANAGEMENT (Created By, Warehouse, Approver, etc.) */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                      {/* Option Add panel */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Option Value</h4>
                        </div>
                        <form onSubmit={handleAddSimple} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600 font-semibold">Value Name</Label>
                            <Input
                              placeholder={`Enter new ${activeTabConfig?.label.toLowerCase() || "option"}...`}
                              value={newSimpleVal}
                              onChange={(e) => setNewSimpleVal(e.target.value)}
                              className="h-10"
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-10 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Add Value
                          </Button>
                        </form>
                      </div>

                      {/* Option List Display panel */}
                      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-auto min-h-[400px]">
                        <div className="p-4 border-b bg-slate-50">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Current Values ({
                              activeTab === "createdBy" ? createdBy.length :
                              activeTab === "warehouse" ? warehouse.length :
                              activeTab === "approver" ? approver.length :
                              activeTab === "qcEngineer" ? qcEngineer.length :
                              activeTab === "accountant" ? accountant.length :
                              activeTab === "uom" ? uom.length :
                              activeTab === "category" ? categoryList.length :
                              activeTab === "checklist" ? checklist.length :
                              activeTab === "rejectReason" ? rejectReason.length :
                              activeTab === "cancelStage" ? cancelStages.length :
                              activeTab === "tatSystem" ? tatSystems.length :
                              activeTab === "tatUnit" ? tatUnits.length :
                              activeTab === "deliveryLocation" ? deliveryLocations.length :
                              activeTab === "hsnCode" ? hsnCodes.length : 0
                            })
                          </h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {currentSimpleList.length === 0 ? (
                              <div className="col-span-2 text-center text-slate-400 py-12 text-xs">
                                No values entered yet. Add options using the form on the left.
                              </div>
                            ) : (
                              simpleListPagination.pageData.map((val, idx) => (
                                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200/70 rounded-xl shadow-sm hover:border-slate-350 transition-colors">
                                  <span className="text-xs font-semibold text-slate-700 truncate mr-2" title={val}>{val}</span>
                                  <Button
                                    type="button"
                                    onClick={() => handleRemoveSimple(val)}
                                    disabled={isSubmitting}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 hover:text-red-600 hover:bg-red-50 text-slate-400 rounded-lg transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <PaginationBar
                          page={simpleListPagination.page}
                          pageSize={simpleListPagination.pageSize}
                          totalCount={simpleListPagination.totalCount}
                          onPageChange={simpleListPagination.setPage}
                          onPageSizeChange={simpleListPagination.setPageSize}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
