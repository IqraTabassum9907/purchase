"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Truck,
  CheckCircle,
  Clock,
  Filter,
  Calendar,
  FileText,
  TrendingUp,
  Plus,
  Loader2,
  Download,
  Eye,
  Package,
  Users,
  ShieldAlert,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { parseSheetDate, formatDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define all purchase order stages with pending counts (Excluding Create Indent)
const purchaseStages = [
  { id: 2, name: "Indent Approval", color: "bg-purple-500" },
  { id: 3, name: "Quotation", color: "bg-indigo-500" },
  { id: 4, name: "Approved Vendor", color: "bg-cyan-500" },
  { id: 5, name: "Make PO", color: "bg-teal-500" },
  { id: 6, name: "Payment", color: "bg-blue-500" },
  { id: 7, name: "Follow UP / Lifting", color: "bg-emerald-500" },
  { id: 8, name: "Transporter Follow-Up", color: "bg-green-500" },
  { id: 9, name: "Material Received", color: "bg-lime-500" },
  { id: 10, name: "Billing", color: "bg-orange-550" }, // Keep it near original values
  { id: 12, name: "Vendor Payment", color: "bg-slate-500" },
  { id: 13, name: "Freight Payments", color: "bg-zinc-500" },
  { id: 14, name: "Order Cancel", color: "bg-red-500" },
];

export default function PurchaseDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedParty, setSelectedParty] = useState("all");
  const [selectedMaterial, setSelectedMaterial] = useState("all");
  const [selectedDivision, setSelectedDivision] = useState("all");

  // Search states
  const [inTransitSearch, setInTransitSearch] = useState("");
  const [receivedSearch, setReceivedSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [warrantySearch, setWarrantySearch] = useState("");



  // Sort states
  const [inTransitSort, setInTransitSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [receivedSort, setReceivedSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [pendingSort, setPendingSort] = useState({
    key: "erp",
    direction: "asc",
  });
  const [warrantySort, setWarrantySort] = useState({
    key: "indentNo",
    direction: "desc",
  });

  const [warrantyVisibleColumns, setWarrantyVisibleColumns] = useState<string[]>([
    "indentNo",
    "liftNo",
    "serialNo",
    "vendorName",
    "itemName",
    "invoiceDate",
    "warrantyEnd"
  ]);

  const [warrantyMonthsFilter, setWarrantyMonthsFilter] = useState<string>("");

  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState<number | null>(null);
  const [pendingPOs, setPendingPOs] = useState<number | null>(null);
  const [completedPOs, setCompletedPOs] = useState<number | null>(null);
  const [completionRate, setCompletionRate] = useState<number | null>(null);

  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [inTransitItems, setInTransitItems] = useState<any[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [warrantyItems, setWarrantyItems] = useState<any[]>([]);
  const [overviewItems, setOverviewItems] = useState<any[]>([]);
  const [stageCounts, setStageCounts] = useState<any>({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState<any>({});
  const [topReceivedOrders, setTopReceivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          indentWorkflow,
          poRes,
          receiptsRes,
          liftingsRes,
          transportRes,
          vendorPayRes,
          cancellationsRes,
          billingRes,
        ] = await Promise.all([
          fetchIndentWorkflow(),
          supabase.from("purchase_orders").select("*"),
          supabase.from("material_receipts").select("*"),
          supabase.from("vendor_liftings").select("*"),
          supabase.from("transporter_followups").select("*"),
          supabase.from("vendor_payments").select("*"),
          supabase.from("order_cancellations").select("*"),
          supabase.from("tally_billing").select("*"),
        ]);

        const pos = poRes.data || [];
        const receipts = receiptsRes.data || [];
        const liftings = liftingsRes.data || [];
        const transports = transportRes.data || [];
        const vendorPayments = vendorPayRes.data || [];
        const cancellations = cancellationsRes.data || [];
        const billings = billingRes.data || [];

        const poByIndent = new Map<string, any>();
        pos.forEach((po: any) => {
          if (po.indent_id && !poByIndent.has(po.indent_id)) {
            poByIndent.set(po.indent_id, po);
          }
        });

        // Division (indent's warehouseLocation) keyed by PO id, so tabs
        // built off purchase_orders/transporter_followups/material_receipts
        // (which don't store the division themselves) can still be filtered
        // by Division like the Pending tab already could.
        const warehouseByIndentId = new Map<string, string>(
          indentWorkflow.map((r: any) => [r.id, r.data.warehouseLocation || ""])
        );
        const warehouseByPoId = new Map<string, string>();
        pos.forEach((po: any) => {
          if (po.id) warehouseByPoId.set(po.id, warehouseByIndentId.get(po.indent_id) || "");
        });

        const paymentsByPo = new Map<string, any[]>();
        vendorPayments.forEach((p: any) => {
          if (p.po_id) {
            const list = paymentsByPo.get(p.po_id) || [];
            list.push(p);
            paymentsByPo.set(p.po_id, list);
          }
        });

        const liftingsByPo = new Map<string, any>();
        liftings.forEach((l: any) => {
          if (l.po_id && !liftingsByPo.has(l.po_id)) {
            liftingsByPo.set(l.po_id, l);
          }
        });

        const transportsByPo = new Map<string, any>();
        transports.forEach((t: any) => {
          if (t.po_id && !transportsByPo.has(t.po_id)) {
            transportsByPo.set(t.po_id, t);
          }
        });

        const receiptsByPo = new Map<string, any>();
        receipts.forEach((r: any) => {
          if (r.po_id && !receiptsByPo.has(r.po_id)) {
            receiptsByPo.set(r.po_id, r);
          }
        });

        const billingsByPo = new Map<string, any>();
        billings.forEach((b: any) => {
          if (b.po_id && !billingsByPo.has(b.po_id)) {
            billingsByPo.set(b.po_id, b);
          }
        });

        const totalPOs = indentWorkflow.length;
        const completedCount = indentWorkflow.filter((r) => {
          const po = poByIndent.get(r.id);
          return po && (po.status === "completed" || po.status === "delivered");
        }).length;
        const pendingCount = totalPOs - completedCount;

        setTotalPurchaseOrders(totalPOs);
        setPendingPOs(pendingCount);
        setCompletedPOs(completedCount);
        setCompletionRate(totalPOs > 0 ? Math.round((completedCount / totalPOs) * 100) : 0);

        const counts: Record<string, number> = {};
        const overdueCounts: Record<string, number> = {};

        counts["Indent Approval"] = indentWorkflow.filter((r) => !r.data.actual1).length;
        overdueCounts["Indent Approval"] = 0;

        counts["Quotation"] = indentWorkflow.filter((r) =>
          r.data.actual1 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.plan3 &&
          !r.data.plan4
        ).length;
        overdueCounts["Quotation"] = 0;

        counts["Approved Vendor"] = indentWorkflow.filter((r) =>
          r.data.actual3 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.plan4
        ).length;
        overdueCounts["Approved Vendor"] = 0;

        counts["Make PO"] = indentWorkflow.filter((r) =>
          ((r.data.vendorType?.toLowerCase() === "regular" && r.data.actual1) || r.data.plan4) &&
          !r.data.poNumber
        ).length;
        overdueCounts["Make PO"] = 0;

        counts["Payment"] = pos.filter((p: any) => !paymentsByPo.has(p.id)).length;
        overdueCounts["Payment"] = 0;

        counts["Follow UP / Lifting"] = pos.filter((p: any) => !liftingsByPo.has(p.id)).length;
        overdueCounts["Follow UP / Lifting"] = 0;

        counts["Transporter Follow-Up"] = liftings.filter((l: any) => l.po_id && !transportsByPo.has(l.po_id)).length;
        overdueCounts["Transporter Follow-Up"] = 0;

        counts["Material Received"] = transports.filter((t: any) =>
          t.po_id &&
          (t.status === "Received" || t.status === "Completed" || t.status === "Approved" || t.status === "Delivered" || t.status === "Complete") &&
          !receiptsByPo.has(t.po_id)
        ).length;
        overdueCounts["Material Received"] = 0;

        counts["Billing"] = receipts.filter((r: any) => r.po_id && !billingsByPo.has(r.po_id)).length;
        overdueCounts["Billing"] = 0;

        counts["Vendor Payment"] = billings.filter((b: any) => b.po_id && !paymentsByPo.has(b.po_id)).length;
        overdueCounts["Vendor Payment"] = 0;

        counts["Freight Payments"] = 0;
        overdueCounts["Freight Payments"] = 0;

        counts["Order Cancel"] = cancellations.length;
        overdueCounts["Order Cancel"] = 0;

        setStageCounts(counts);
        setStageOverdueCounts(overdueCounts);

        const parsedPurchaseItems = indentWorkflow
          .filter((r) => r.data.plan4 && !r.data.poNumber)
          .map((r) => ({
            erp: r.data.poNumber || "",
            material: r.data.itemName,
            party: r.data.selectedVendorName || r.data.category,
            qty: r.data.quantity,
            warehouse: r.data.warehouseLocation,
            firm: "",
            leadTime: r.data.leadTime,
            expDelivery: "",
          }));
        setPurchaseItems(parsedPurchaseItems);

        const parsedOverviewItems = indentWorkflow.map((r) => {
          let status = "Pending";
          if (r.data.actual1) {
            status = r.data.plan3 ? "Approved Indent" : "Pending Indent";
          }
          return {
            indent: r.data.indentNumber,
            createdBy: r.data.createdBy,
            category: r.data.category,
            item: r.data.itemName,
            qty: r.data.quantity,
            warehouse: r.data.warehouseLocation,
            expDelivery: r.data.leadTime,
            leadTime: r.data.leadTime,
            status,
          };
        });
        setOverviewItems(parsedOverviewItems);

        const parsedInTransit = transports
          .filter((t: any) => t.po_id && !receiptsByPo.has(t.po_id))
          .map((t: any) => {
            const po = t.po_id ? pos.find((p: any) => p.id === t.po_id) : null;
            return {
              erp: po?.po_number || "",
              material: po?.item_name || "",
              party: po?.vendor_name || "",
              billImage: "",
              truck: t.vehicle_number || "",
              date: t.dispatch_date || "",
              qty: po?.quantity || 0,
              warehouse: po?.id ? warehouseByPoId.get(po.id) || "" : "",
              firm: po?.firm_name || "",
            };
          });
        setInTransitItems(parsedInTransit);

        const rawReceivedList = receipts.map((r: any) => {
          const po = r.po_id ? pos.find((p: any) => p.id === r.po_id) : null;
          return {
            erp: po?.po_number || r.grn_number || r.po_number || "",
            material: po?.item_name || r.item_name || r.itemName || "",
            party: po?.vendor_name || r.vendor_name || r.vendorName || "",
            billImage: r.bilty_invoice_image_url || "",
            truck: "",
            date: r.received_date || r.created_at || "",
            qty: r.received_quantity || r.quantity || 0,
            warehouse: po?.id ? warehouseByPoId.get(po.id) || "" : "",
            firm: po?.firm_name || "",
          };
        });

        let effectiveReceived = rawReceivedList.filter((item: any) => item.party || item.material);

        // Fallback to purchase orders if material_receipts table has 0 records
        if (effectiveReceived.length === 0 && pos.length > 0) {
          effectiveReceived = pos.map((p: any) => ({
            erp: p.po_number || "",
            material: p.item_name || "Material",
            party: p.vendor_name || "Vendor",
            billImage: "",
            truck: "",
            date: p.created_at || "",
            qty: p.quantity || 1,
            warehouse: p.id ? warehouseByPoId.get(p.id) || "" : "",
            firm: p.firm_name || "",
          }));
        }

        // Fallback to active indent workflow records if both receipts and pos are empty
        if (effectiveReceived.length === 0 && indentWorkflow.length > 0) {
          effectiveReceived = indentWorkflow
            .filter((r) => r.data.itemName)
            .map((r) => ({
              erp: r.data.poNumber || r.data.indentNumber || "",
              material: r.data.itemName,
              party: r.data.selectedVendorName || r.data.vendor1Name || r.data.category || "Vendor",
              billImage: "",
              truck: "",
              date: r.data.createdAt || "",
              qty: parseFloat(String(r.data.approvedQty || r.data.quantity || "1").replace(/,/g, "")) || 1,
              warehouse: r.data.warehouseLocation || "",
              firm: "",
            }));
        }

        setReceivedItems(effectiveReceived);

        const vendorStats: Record<string, { totalCount: number; totalValue: number; products: Record<string, number> }> = {};
        effectiveReceived.forEach((item) => {
          const partyName = item.party || "Vendor";
          const matName = item.material || "Item";
          if (!vendorStats[partyName]) {
            vendorStats[partyName] = { totalCount: 0, totalValue: 0, products: {} };
          }
          vendorStats[partyName].totalCount++;
          const val = parseFloat(String(item.qty || "0").replace(/,/g, "")) || 1;
          vendorStats[partyName].totalValue += val;
          if (!vendorStats[partyName].products[matName]) {
            vendorStats[partyName].products[matName] = 0;
          }
          vendorStats[partyName].products[matName]++;
        });

        const processedOrders = Object.entries(vendorStats).map(([vendor, stats]) => {
          let topProduct = "";
          let maxProdCount = 0;
          Object.entries(stats.products).forEach(([prod, count]) => {
            if (count > maxProdCount) {
              maxProdCount = count;
              topProduct = prod;
            }
          });
          return {
            vendor,
            product: topProduct,
            count: stats.products[topProduct] || 0,
            vendorTotalCount: stats.totalCount,
            value: stats.totalValue,
          };
        });
        processedOrders.sort((a, b) => b.vendorTotalCount - a.vendorTotalCount);
        setTopReceivedOrders(processedOrders.slice(0, 10));

        setWarrantyItems([]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Compute unique values for filters
  const allData = useMemo(() => [...inTransitItems, ...receivedItems, ...purchaseItems, ...warrantyItems], [inTransitItems, receivedItems, purchaseItems, warrantyItems]);

  const uniqueParties = useMemo(() =>
    [...new Set(allData.map((item) => item.party))].filter(Boolean).sort()
    , [allData]);

  const uniqueMaterials = useMemo(() =>
    [...new Set(allData.map((item) => item.material))].filter(Boolean).sort()
    , [allData]);

  const uniqueDivisions = useMemo(() =>
    [...new Set(allData.map((item) => item.warehouse))].filter(Boolean).sort()
    , [allData]);

  // Filtering function
  const applyFilters = (data: any[], dataType: string) => {
    return data.filter((item: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        const itemDate = parseSheetDate(item.date);
        if (!itemDate) return false;
        if (dateFrom) {
          const fromDate = parseSheetDate(dateFrom);
          if (fromDate && itemDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = parseSheetDate(dateTo);
          if (toDate && itemDate > toDate) return false;
        }
      }

      // Party filter
      if (
        selectedParty &&
        selectedParty !== "all" &&
        item.party !== selectedParty
      )
        return false;

      // Material filter
      if (
        selectedMaterial &&
        selectedMaterial !== "all" &&
        item.material !== selectedMaterial
      )
        return false;

      // Division filter
      if (
        selectedDivision &&
        selectedDivision !== "all" &&
        item.warehouse !== selectedDivision
      )
        return false;

      // Warranty Months Left filter
      if (dataType === "warranty" && warrantyMonthsFilter) {
        const months = parseInt(warrantyMonthsFilter);
        if (!isNaN(months)) {
          const itemDate = new Date(item.warrantyEnd);
          if (isNaN(itemDate.getTime())) return false;

          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + months);

          if (itemDate > maxDate) return false;
          // Also filter out past dates if strictly "months left" means future? 
          // Usually "months left" implies filter <= X months from now.
          if (itemDate < new Date()) return false;
        }
      }

      return true;
    });
  };

  // Apply filters to data
  const filteredInTransitData = useMemo(() => applyFilters(inTransitItems, "intransit"), [inTransitItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedDivision]);
  const filteredReceivedData = useMemo(() => applyFilters(receivedItems, "received"), [receivedItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedDivision]);
  const filteredPendingData = useMemo(() => applyFilters(purchaseItems, "pending"), [purchaseItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedDivision]);
  const filteredWarrantyData = useMemo(() => applyFilters(warrantyItems, "warranty"), [warrantyItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedDivision, warrantyMonthsFilter]);

  // Sorting function
  const sortData = (data: any[], sortConfig: any) => {
    return [...data].sort((a: any, b: any) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "date") {
        aVal = parseSheetDate(aVal);
        bVal = parseSheetDate(bVal);
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const aTime = aVal instanceof Date ? aVal.getTime() : aVal;
      const bTime = bVal instanceof Date ? bVal.getTime() : bVal;

      if (aTime < bTime) return sortConfig.direction === "asc" ? -1 : 1;
      if (aTime > bTime) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Apply sorting
  const sortedInTransitData = useMemo(() => sortData(filteredInTransitData, inTransitSort), [filteredInTransitData, inTransitSort]);
  const sortedReceivedData = useMemo(() => sortData(filteredReceivedData, receivedSort), [filteredReceivedData, receivedSort]);
  const sortedPendingData = useMemo(() => sortData(filteredPendingData, pendingSort), [filteredPendingData, pendingSort]);
  const sortedWarrantyData = useMemo(() => sortData(filteredWarrantyData, warrantySort), [filteredWarrantyData, warrantySort]);

  // Apply search
  const searchData = (data: any[], searchTerm: string) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item: any) =>
        (item.erp && item.erp.toString().toLowerCase().includes(term)) ||
        (item.material && item.material.toLowerCase().includes(term)) ||
        (item.party && item.party.toLowerCase().includes(term)) ||
        // Warranty specific fields
        (item.indentNo && item.indentNo.toString().toLowerCase().includes(term)) ||
        (item.liftNo && item.liftNo.toString().toLowerCase().includes(term)) ||
        (item.serialNo && item.serialNo.toString().toLowerCase().includes(term))
    );
  };

  const finalInTransitData = useMemo(() => searchData(sortedInTransitData, inTransitSearch), [sortedInTransitData, inTransitSearch]);
  const finalReceivedData = useMemo(() => searchData(sortedReceivedData, receivedSearch), [sortedReceivedData, receivedSearch]);
  const finalPendingData = useMemo(() => searchData(sortedPendingData, pendingSearch), [sortedPendingData, pendingSearch]);
  const finalWarrantyData = useMemo(() => searchData(sortedWarrantyData, warrantySearch), [sortedWarrantyData, warrantySearch]);

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string, visibleColumns?: string[]) => {
    if (data.length === 0) return;

    const allHeaders = Object.keys(data[0]);
    // If visibleColumns is provided, only use those. Otherwise use all headers.
    const headers = visibleColumns ? allHeaders.filter(h => visibleColumns.includes(h)) : allHeaders;

    const csvContent = [
      headers.map(h => h.toUpperCase()).join(","),
      ...data.map((row: any) =>
        headers.map((header) => {
          let val = row[header];
          // Format date fields in CSV if they look like dates
          if (header.toLowerCase().includes("date") || header.toLowerCase().includes("end")) {
            val = formatDate(val);
          }
          return `"${val}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const [
        indentWorkflow,
        poRes,
        receiptsRes,
        liftingsRes,
        transportRes,
        vendorPayRes,
        cancellationsRes,
        billingRes,
        masterRes,
      ] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("purchase_orders").select("*"),
        supabase.from("material_receipts").select("*"),
        supabase.from("vendor_liftings").select("*"),
        supabase.from("transporter_followups").select("*"),
        supabase.from("vendor_payments").select("*"),
        supabase.from("order_cancellations").select("*"),
        supabase.from("tally_billing").select("*"),
        supabase.from("master_items").select("*"),
      ]);

      const pos = poRes.data || [];
      const receipts = receiptsRes.data || [];
      const liftings = liftingsRes.data || [];
      const transports = transportRes.data || [];
      const vendorPayments = vendorPayRes.data || [];
      const billings = billingRes.data || [];
      const masterData = masterRes.data || [];

      const poByIndent = new Map<string, any>();
      pos.forEach((po: any) => {
        if (po.indent_id && !poByIndent.has(po.indent_id)) {
          poByIndent.set(po.indent_id, po);
        }
      });

      const paymentsByPo = new Map<string, any[]>();
      vendorPayments.forEach((p: any) => {
        if (p.po_id) {
          const list = paymentsByPo.get(p.po_id) || [];
          list.push(p);
          paymentsByPo.set(p.po_id, list);
        }
      });

      const liftingsByPo = new Map<string, any>();
      liftings.forEach((l: any) => {
        if (l.po_id && !liftingsByPo.has(l.po_id)) {
          liftingsByPo.set(l.po_id, l);
        }
      });

      const transportsByPo = new Map<string, any>();
      transports.forEach((t: any) => {
        if (t.po_id && !transportsByPo.has(t.po_id)) {
          transportsByPo.set(t.po_id, t);
        }
      });

      const receiptsByPo = new Map<string, any>();
      receipts.forEach((r: any) => {
        if (r.po_id && !receiptsByPo.has(r.po_id)) {
          receiptsByPo.set(r.po_id, r);
        }
      });

      const billingsByPo = new Map<string, any>();
      billings.forEach((b: any) => {
        if (b.po_id && !billingsByPo.has(b.po_id)) {
          billingsByPo.set(b.po_id, b);
        }
      });

      const respMap: Record<string, string> = {};
      masterData.forEach((item: any) => {
        if (item.category_type && item.item_value) {
          respMap[String(item.category_type).trim()] = String(item.item_value).trim();
        }
      });

      const totalCounts: Record<string, number> = {};
      const overdueCounts: Record<string, number> = {};
      purchaseStages.forEach((s) => {
        totalCounts[s.name] = 0;
        overdueCounts[s.name] = 0;
      });

      const detailed: any[] = [];
      const liftingPOs = new Set<string>();

      indentWorkflow.forEach((r) => {
        const po = poByIndent.get(r.id);

        if (!r.data.actual1) {
          totalCounts["Indent Approval"]++;
          overdueCounts["Indent Approval"]++;
          detailed.push({
            indent: r.data.indentNumber || "-",
            party: r.data.createdBy || "-",
            item: r.data.itemName || "-",
            qty: r.data.quantity || "-",
            stage: "Indent Approval",
            delay: "0",
            poNumber: "-",
          });
        }

        const isRegularVendor = r.data.vendorType?.toLowerCase() === "regular";

        if (r.data.actual1 && !isRegularVendor && !r.data.plan3 && !r.data.plan4) {
          totalCounts["Quotation"]++;
          overdueCounts["Quotation"]++;
          detailed.push({
            indent: r.data.indentNumber || "-",
            party: r.data.category || "-",
            item: r.data.itemName || "-",
            qty: r.data.quantity || "-",
            stage: "Quotation",
            delay: "0",
            poNumber: "-",
          });
        }

        if (r.data.plan3 && !isRegularVendor && !r.data.plan4) {
          totalCounts["Approved Vendor"]++;
          overdueCounts["Approved Vendor"]++;
          detailed.push({
            indent: r.data.indentNumber || "-",
            party: r.data.selectedVendorName || r.data.category || "-",
            item: r.data.itemName || "-",
            qty: r.data.quantity || "-",
            stage: "Approved Vendor",
            delay: "0",
            poNumber: "-",
          });
        }

        if (((isRegularVendor && r.data.actual1) || r.data.plan4) && !r.data.poNumber) {
          totalCounts["Make PO"]++;
          overdueCounts["Make PO"]++;
          detailed.push({
            indent: r.data.indentNumber || "-",
            party: r.data.selectedVendorName || r.data.category || "-",
            item: r.data.itemName || "-",
            qty: r.data.quantity || "-",
            stage: "Make PO",
            delay: "0",
            poNumber: "-",
          });
        }

        if (po && !paymentsByPo.has(po.id)) {
          totalCounts["Payment"]++;
          overdueCounts["Payment"]++;
          detailed.push({
            indent: r.data.indentNumber || "-",
            party: po.vendor_name || "-",
            item: po.item_name || "-",
            qty: po.quantity || "-",
            stage: "Payment",
            delay: "0",
            poNumber: po.po_number || "-",
          });
        }

        if (po && !liftingsByPo.has(po.id)) {
          totalCounts["Follow UP / Lifting"]++;
          overdueCounts["Follow UP / Lifting"]++;
          const poNumKey = String(po.po_number || "").toUpperCase().replace(/\s+/g, "");
          if (poNumKey && poNumKey !== "-" && !liftingPOs.has(poNumKey)) {
            liftingPOs.add(poNumKey);
            detailed.push({
              indent: r.data.indentNumber || "-",
              party: po.vendor_name || r.data.selectedVendorName || "-",
              item: po.item_name || r.data.itemName || "-",
              qty: po.quantity || r.data.quantity || "-",
              stage: "Follow UP / Lifting",
              delay: "0",
              poNumber: po.po_number || "-",
              plannedDate: "-",
            });
          }
        }
      });

      transports.forEach((t: any) => {
        const po = t.po_id ? pos.find((p: any) => p.id === t.po_id) : null;
        if (!po) return;

        if (!receiptsByPo.has(po.id)) {
          totalCounts["Material Received"]++;
          overdueCounts["Material Received"]++;
          detailed.push({
            indent: "-",
            party: po.vendor_name || "-",
            item: po.item_name || "-",
            qty: po.quantity || "-",
            stage: "Material Received",
            delay: "0",
            poNumber: po.po_number || "-",
          });
        }
      });

      receipts.forEach((r: any) => {
        if (r.po_id && !billingsByPo.has(r.po_id)) {
          const po = pos.find((p: any) => p.id === r.po_id);
          totalCounts["Billing"]++;
          overdueCounts["Billing"]++;
          detailed.push({
            indent: "-",
            party: po?.vendor_name || "-",
            item: po?.item_name || "-",
            qty: po?.quantity || "-",
            stage: "Billing",
            delay: "0",
            poNumber: po?.po_number || "-",
          });
        }
      });

      liftings.forEach((l: any) => {
        const po = l.po_id ? pos.find((p: any) => p.id === l.po_id) : null;
        if (!po) return;

        if (!transportsByPo.has(po.id)) {
          totalCounts["Transporter Follow-Up"]++;
          overdueCounts["Transporter Follow-Up"]++;
          detailed.push({
            indent: "-",
            party: po.vendor_name || "-",
            item: po.item_name || "-",
            qty: po.quantity || "-",
            stage: "Transporter Follow-Up",
            delay: "0",
            poNumber: po.po_number || "-",
          });
        }
      });

      billings.forEach((b: any) => {
        if (b.po_id && !paymentsByPo.has(b.po_id)) {
          const po = pos.find((p: any) => p.id === b.po_id);
          totalCounts["Vendor Payment"]++;
          overdueCounts["Vendor Payment"]++;
          detailed.push({
            indent: "-",
            party: po?.vendor_name || "-",
            item: po?.item_name || "-",
            qty: po?.quantity || "-",
            stage: "Vendor Payment",
            delay: "0",
            poNumber: po?.po_number || "-",
          });
        }
      });

      totalCounts["Order Cancel"] = 0;
      overdueCounts["Order Cancel"] = 0;

      const allowedStages = ["Indent Approval", "Quotation", "Approved Vendor", "Make PO", "Payment", "Follow UP / Lifting", "Transporter Follow-Up", "Material Received", "Billing"];
      const summaryData = purchaseStages
        .filter((s) => allowedStages.includes(s.name) && overdueCounts[s.name] > 0)
        .map((s) => ({
          stage: s.name,
          pending: overdueCounts[s.name],
          responsible: respMap[s.name] || "-",
          uniquePoCount: s.name === "Follow UP / Lifting" ? liftingPOs.size : undefined,
        }));

      detailed.sort((a, b) => {
        const indexA = allowedStages.indexOf(a.stage);
        const indexB = allowedStages.indexOf(b.stage);
        return indexA - indexB;
      });

      const blob = await pdf(<ReportDocument summaryData={summaryData} detailedData={detailed} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Purchase_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage your purchase workflow
          </p>
        </div>
      </div>

      {/* Smart Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">Smart Filters</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Refine your data view with advanced filtering options
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-xs text-muted-foreground shrink-0">
                  to
                </span>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Party Names" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Party Names</SelectItem>
                {uniqueParties.map((party) => (
                  <SelectItem key={party} value={party}>
                    {party}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMaterial}
              onValueChange={setSelectedMaterial}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Materials</SelectItem>
                {uniqueMaterials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDivision} onValueChange={setSelectedDivision}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {uniqueDivisions.map((division) => (
                  <SelectItem key={division} value={division}>
                    {division}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedParty("all");
                setSelectedMaterial("all");
                setSelectedDivision("all");
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-11">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="purchase" className="text-xs sm:text-sm">
            Purchase Data
          </TabsTrigger>
          <TabsTrigger value="intransit" className="text-xs sm:text-sm">
            In-Transit
          </TabsTrigger>
          <TabsTrigger value="received" className="text-xs sm:text-sm">
            Received
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Purchase Orders
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : totalPurchaseOrders !== null ? totalPurchaseOrders : 0}
                </div>
                <p className="text-xs text-muted-foreground">Active Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending PO's
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : pendingPOs !== null ? pendingPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting Action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed PO's
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completedPOs !== null ? completedPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completion Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completionRate !== null ? `${completionRate}%` : "0%"}
                </div>
                <Progress value={completionRate || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>



                    
          {/* BEST PRICE PER MATERIAL – NEW MODERN SECTION */}
          {/* TOP RECEIVED ORDERS - REPLACED BEST PRICE SECTION */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Top Received Orders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vendors with highest order volume (Prioritized by Count)
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-700"
                >
                  Live Data
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Count</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Vendor Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReceivedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No received orders data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      topReceivedOrders.map((item: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              {item.product}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {item.count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            ₹{item.value.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {item.vendor}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Top Materials
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Most ordered materials by quantity
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {topMaterials.slice(0, 5).map((m) => (
                  <div
                    key={m.rank}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                      >
                        {m.rank}
                      </Badge>
                      <span className="truncate max-w-32 sm:max-w-none">
                        {m.material}
                      </span>
                    </div>
                    <span className="font-medium">{m.qty.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={vendorBarData.slice(0, 5)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="hidden lg:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={vendorBarData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Top Vendors by Quantity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by total quantity
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {topVendors.slice(0, 5).map((v) => (
                <div key={v.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {v.rank}
                    </Badge>
                    <span className="truncate max-w-32">
                      {v.vendor.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                  <span className="font-medium">{v.qty.toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* New Overview Table */}
          {/* <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Purchase Order Overview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Detailed view of all purchase orders
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Indent #</TableHead>
                    <TableHead className="text-xs">Created By</TableHead>
                    <TableHead className="text-xs">
                      Warehouse Location
                    </TableHead>
                    <TableHead className="text-xs">Expected Date of Raw Material Delivery</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">IND-{item.indent}</TableCell>
                      <TableCell className="text-xs">
                        {item.createdBy || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.warehouse || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.leadTime || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.category}
                      </TableCell>
                      <TableCell className="text-xs">{item.item}</TableCell>
                      <TableCell className="text-xs text-right">
                        {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.expDelivery || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={`
                            ${item.status?.includes("Approved")
                              ? "bg-green-50 text-green-700 border-green-200"
                              : item.status?.includes("Pending")
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }
                          `}
                        >
                          {item.status || "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card> */}
        </TabsContent>

        {/* IN-TRANSIT TAB */}
        <TabsContent value="intransit" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Materials In-Transit</h3>
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {finalInTransitData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={inTransitSearch}
              onChange={(e) => setInTransitSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalInTransitData, "in-transit-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "erp",
                          direction:
                            inTransitSort.key === "erp" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {inTransitSort.key === "erp" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "material",
                          direction:
                            inTransitSort.key === "material" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {inTransitSort.key === "material" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "party",
                          direction:
                            inTransitSort.key === "party" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {inTransitSort.key === "party" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "date",
                          direction:
                            inTransitSort.key === "date" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {inTransitSort.key === "date" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalInTransitData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">{item.date}</TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECEIVED TAB */}
        <TabsContent value="received" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Received Materials</h3>
            </div>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {finalReceivedData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={receivedSearch}
              onChange={(e) => setReceivedSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalReceivedData, "received-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "erp",
                          direction:
                            receivedSort.key === "erp" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {receivedSort.key === "erp" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "material",
                          direction:
                            receivedSort.key === "material" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {receivedSort.key === "material" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "party",
                          direction:
                            receivedSort.key === "party" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {receivedSort.key === "party" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Bill Image</TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "date",
                          direction:
                            receivedSort.key === "date" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {receivedSort.key === "date" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalReceivedData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.billImage ? (
                          <a
                            href={item.billImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100 text-blue-600"
                          >
                            <Eye className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">
                        {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PURCHASE DATA → PENDING TAB */}
        <TabsContent value="purchase" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">
                Pending Orders from PO Sheet
              </h3>
            </div>
            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
              {finalPendingData.length} Orders
            </Badge>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(finalPendingData, "pending-data.csv")}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ERP PO Number</TableHead>
                    <TableHead className="text-xs">Material Name</TableHead>
                    <TableHead className="text-xs">Party Name</TableHead>
                    <TableHead className="text-xs text-right">Quantity</TableHead>
                    <TableHead className="text-xs">Warehouse</TableHead>
                    <TableHead className="text-xs">Expected Date of Raw Material Delivery</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalPendingData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs">{item.party}</TableCell>
                      <TableCell className="text-right text-xs">
                        {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty}
                      </TableCell>
                      <TableCell className="text-xs">{item.warehouse}</TableCell>
                      <TableCell className="text-xs">{item.leadTime}</TableCell>
                      <TableCell className="text-xs">
                        {item.expDelivery}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  );
}
