"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCw, Search, Plus, Loader2, AlertCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { fetchIndentWorkflow } from "@/lib/supabase/queries"
import { getPlannedDateForRecord, formatDateTimeFull } from "@/lib/utils"
import { usePagination } from "@/lib/use-pagination"
import { PaginationBar } from "@/components/ui/pagination-bar"

export default function OrderCancelPage() {
  // Cancellation is only ever done off the Follow UP / Lifting pending set
  // (search only looks there), so the stage is fixed rather than a pickable
  // dropdown — no other stage can produce a cancellable record here.
  const FIXED_CANCEL_STAGE = "Follow UP / Lifting"
  const [orderNumber, setOrderNumber] = useState("")
  const [cancelStage, setCancelStage] = useState(FIXED_CANCEL_STAGE)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelQuantities, setCancelQuantities] = useState<Record<string, string>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([])
  const [tatRules, setTatRules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Search is by Indent Number only, and only against indents that are
  // currently Pending in the Follow UP / Lifting stage — this is the same
  // "still has quantity left to lift" set that page itself shows, so an
  // order can only be cancelled while it's genuinely still pending there.
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedSearchRowIds, setSelectedSearchRowIds] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")

  // Helper function to parse Google Sheets date format and display as YYYY-MM-DD HH:MM:SS
  const parseGoogleSheetsDate = (dateString: any) => {
    if (!dateString) return "—"

    let d: Date
    if (dateString instanceof Date) {
      d = dateString
    } else if (typeof dateString === "string") {
      if (dateString.startsWith("Date(")) {
        try {
          const parts = dateString.slice(5, -1).split(",")
          if (parts.length < 3) return dateString
          const year = Number(parts[0])
          const month = Number(parts[1]) // zero based
          const day = Number(parts[2])
          const hour = parts.length > 3 ? Number(parts[3]) : 0
          const minute = parts.length > 4 ? Number(parts[4]) : 0
          const second = parts.length > 5 ? Number(parts[5]) : 0
          d = new Date(year, month, day, hour, minute, second)
        } catch {
          return dateString
        }
      } else {
        const parsed = new Date(dateString)
        if (!isNaN(parsed.getTime())) {
          d = parsed
        } else {
          return dateString
        }
      }
    } else {
      return String(dateString)
    }

    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const fetchCancelledOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      const [
        { data: cancelData, error: cancelErr },
        { data: poData },
        { data: receiptData },
        indentRows,
        tatRes,
      ] = await Promise.all([
        supabase.from("order_cancellations").select("*").order("cancellation_date", { ascending: false }),
        supabase.from("purchase_orders").select("*"),
        supabase.from("material_receipts").select("*"),
        fetchIndentWorkflow(),
        supabase.from("master_tat_rules").select("*"),
      ])

      if (tatRes.data) setTatRules(tatRes.data)

      if (cancelErr) throw cancelErr

      const poById = new Map<string, any>();
      (poData || []).forEach((po: any) => poById.set(po.id, po));

      const indentById = new Map<string, any>();
      indentRows.forEach((row: any) => indentById.set(row.id, row));

      const receiptMap = new Map<string, { totalLiftedQty: number; totalReceivedQty: number }>();
      (receiptData || []).forEach((r: any) => {
        const po = r.po_id ? poById.get(r.po_id) : null;
        const indentId = po?.indent_id;
        if (indentId) {
          const existing = receiptMap.get(indentId) || { totalLiftedQty: 0, totalReceivedQty: 0 };
          receiptMap.set(indentId, {
            totalLiftedQty: existing.totalLiftedQty + (r.accepted_quantity || 0),
            totalReceivedQty: existing.totalReceivedQty + (r.received_quantity || 0),
          });
        }
      });

      const orders: any[] = [];

      (cancelData || []).forEach((cancel: any, index: number) => {
        const indent = cancel.indent_id ? indentById.get(cancel.indent_id) : null;
        const po = cancel.po_id ? poById.get(cancel.po_id) : null;
        const recData = cancel.indent_id ? receiptMap.get(cancel.indent_id) : null;

        const poQty = po?.quantity || 0;
        const cancelQty = cancel.financial_impact || 0;
        const totalLiftedQty = recData?.totalLiftedQty || 0;
        const receivedQty = recData?.totalReceivedQty || 0;
        const pendingQty = poQty - cancelQty - receivedQty;
        // unit_rate on purchase_orders stores the line's basic value (rate x qty),
        // not a true per-unit rate — divide back out by qty to get the actual rate.
        const rate = poQty > 0 ? (parseFloat(po?.unit_rate) || 0) / poQty : 0;
        const amount = cancelQty * rate;

        orders.push({
          id: cancel.id,
          rowIndex: index + 2,
          timestamp: cancel.cancellation_date || "",
          createdAt: indent?.data?.createdAt || "",
          indentNo: indent?.data?.indentNumber || "",
          poNumber: po?.po_number || "",
          supplierName: po?.vendor_name || indent?.data?.selectedVendorName || indent?.data?.finalVendorName || indent?.data?.vendor1Name || "-",
          itemName: indent?.data?.itemName || "",
          cancelStage: cancel.cancelled_by || "",
          cancelReason: cancel.cancellation_reason || "",
          qty: cancelQty,
          poQty,
          totalLiftedQty,
          receivedQty,
          pendingQty,
          rate,
          amount,
        });
      });

      setCancelledOrders(orders);
    } catch (err: any) {
      console.error("Error fetching cancelled orders data:", err)
      setError(err.message)
      setCancelledOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCancelledOrders()
  }, [])

  // Filter orders based on search term
  const filteredCancelledOrders = useMemo(() => {
    if (!searchTerm) return cancelledOrders

    return cancelledOrders.filter((order) => {
      return (
        (order.indentNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.poNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.itemName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelStage || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelReason || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.qty || "").toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [cancelledOrders, searchTerm])

  const cancelledOrdersPagination = usePagination(filteredCancelledOrders, 15)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please select or enter a search query")
      return
    }

    setSearchLoading(true)
    setSearchResults([])
    setSelectedSearchRowIds([])

    try {
      const [indentRows, { data: poData }, { data: liftingData }, { data: cancelData }] = await Promise.all([
        fetchIndentWorkflow(),
        supabase.from("purchase_orders").select("*"),
        supabase.from("vendor_liftings").select("po_id, lifting_qty"),
        supabase.from("order_cancellations").select("po_id, financial_impact"),
      ])

      // Same "still pending" set Follow UP / Lifting itself shows: one row
      // per PO, pending while (lifted + already cancelled) hasn't used up
      // the full PO quantity yet.
      const posByIndentId = new Map<string, any[]>();
      (poData || []).forEach((po: any) => {
        if (po.indent_id) {
          const list = posByIndentId.get(po.indent_id) || [];
          list.push(po);
          posByIndentId.set(po.indent_id, list);
        }
      });

      const liftedByPoId = new Map<string, number>();
      (liftingData || []).forEach((l: any) => {
        if (!l.po_id) return;
        liftedByPoId.set(l.po_id, (liftedByPoId.get(l.po_id) || 0) + (parseFloat(l.lifting_qty) || 0));
      });

      // financial_impact on order_cancellations stores the cancelled
      // quantity (see submitCancellation below), not a monetary amount.
      const cancelledByPoId = new Map<string, number>();
      (cancelData || []).forEach((c: any) => {
        if (!c.po_id) return;
        cancelledByPoId.set(c.po_id, (cancelledByPoId.get(c.po_id) || 0) + (parseFloat(c.financial_impact) || 0));
      });

      const query = searchQuery.toLowerCase().trim()
      const results: any[] = []

      indentRows.forEach((row: any) => {
        const indentNumber = row.data.indentNumber;
        if (!indentNumber || !indentNumber.toLowerCase().includes(query)) return;

        const posForIndent = posByIndentId.get(row.id) || [];
        posForIndent.forEach((po: any) => {
          const poQty = parseFloat(po.quantity) || 0;
          const liftedQty = liftedByPoId.get(po.id) || 0;
          const cancelledQty = cancelledByPoId.get(po.id) || 0;
          const remainingQty = Math.max(0, poQty - (liftedQty + cancelledQty));

          // Only still-pending-in-Follow-Up POs can be cancelled here.
          if (remainingQty <= 0) return;

          // unit_rate on purchase_orders stores the line's basic value
          // (rate x qty), not a true per-unit rate — divide back out by
          // qty to get the actual per-unit rate for display.
          const rate = poQty > 0 ? (parseFloat(po.unit_rate) || 0) / poQty : 0;

          results.push({
            id: row.id,
            poId: po.id,
            indentNumber,
            poNumber: po.po_number || "—",
            itemName: po.item_name || row.data.itemName,
            poQty,
            liftedQty,
            cancelledQty,
            remainingQty,
            rate,
          });
        });
      });

      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No matching pending Follow-Up records found")
      }
    } catch (err: any) {
      console.error("Error during search:", err)
      toast.error(`Search error: ${err.message}`)
    } finally {
      setSearchLoading(false)
    }
  }

  const submitCancellation = async () => {
    if (selectedSearchRowIds.length === 0) {
      toast.error("Please select at least one record to cancel")
      return
    }
    if (!cancelStage || !cancelReason) {
      toast.error("Please fill all required fields")
      return
    }

    const selectedRows = searchResults.filter(row => selectedSearchRowIds.includes(row.id))

    for (const row of selectedRows) {
      const q = cancelQuantities[row.id] ?? row.remainingQty
      const cancelNum = Number(q)
      if (isNaN(cancelNum) || cancelNum <= 0) {
        toast.error(`Please enter a valid cancellation quantity for Indent: ${row.indentNumber}`)
        return
      }
      if (cancelNum > row.remainingQty) {
        toast.error(`Cancel quantity (${cancelNum}) cannot exceed remaining quantity (${row.remainingQty}) for Indent: ${row.indentNumber}`)
        return
      }
    }

    setSubmitting(true)

    try {
      const insertRows = selectedRows.map((row) => {
        const rowQty = cancelQuantities[row.id] ?? row.remainingQty

        return {
          indent_id: row.id,
          po_id: row.poId || null,
          cancelled_by: cancelStage,
          cancellation_reason: cancelReason,
          financial_impact: Number(rowQty),
          status: "Cancelled",
        }
      })

      const { error } = await supabase.from("order_cancellations").insert(insertRows)
      if (error) throw error

      setSearchQuery("")
      setSearchResults([])
      setSelectedSearchRowIds([])
      setCancelStage(FIXED_CANCEL_STAGE)
      setCancelReason("")
      setCancelQuantities({})
      setIsDialogOpen(false)

      await fetchCancelledOrders()

      toast.success(`Successfully cancelled ${selectedRows.length} record(s)`)
    } catch (err: any) {
      console.error("Error submitting cancellation:", err)
      toast.error(`Error cancelling order: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewCancellation = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedSearchRowIds([])
    setCancelStage(FIXED_CANCEL_STAGE)
    setCancelReason("")
    setCancelQuantities({})
    setIsDialogOpen(true)
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchCancelledOrders()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }



  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive">Error Loading Data</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-700 rounded-lg text-white shadow-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Order Cancel</h2>
            <p className="text-[13px] text-muted-foreground mt-0">Manage and track cancelled orders</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search cancelled orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 shadow-sm focus:ring-red-500 focus:border-red-500 rounded-lg h-10"
            />
          </div>
          <Button variant="outline" onClick={handleRefresh} size="icon" className="bg-white shadow-sm hover:bg-slate-50 border-slate-200 h-10 w-10 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNewCancellation} className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg h-10 px-4 shadow-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Cancel Order
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white overflow-hidden ring-1 ring-slate-200 rounded-xl">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
          <div className="flex flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                Cancellation Logs
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
              {filteredCancelledOrders.length} RECORDS FOUND
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto relative custom-scrollbar">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Timestamp</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancelled At</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Planned Date</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Indent-No.</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">PO Number</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Supplier</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Item-Name</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Stage</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Reason</TableHead>
                  <TableHead className="w-20 text-center font-bold text-slate-700 uppercase text-[10px]">PO Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Total Lifted Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Received Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Canceled Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Pending Qty</TableHead>
                  <TableHead className="w-[100px] text-right font-bold text-slate-700 uppercase text-[10px]">Rate</TableHead>
                  <TableHead className="w-[120px] text-right font-bold text-slate-700 uppercase text-[10px]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                        <span className="text-slate-500 font-medium">Loading cancelled orders...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCancelledOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="h-32 text-center text-slate-400 font-medium">
                      No cancelled orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  cancelledOrdersPagination.pageData.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                      <TableCell className="text-[11px] text-slate-500 font-mono py-4">
                        {formatDateTimeFull(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 font-mono py-4">
                        {parseGoogleSheetsDate(order.timestamp)}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-600 font-mono py-4">
                        {getPlannedDateForRecord(order, "Order Cancel", tatRules, order.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 py-4">
                        {order.indentNo}
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-slate-600 py-4">
                        {order.poNumber}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800 text-[12px] py-4">
                        {order.supplierName}
                      </TableCell>
                      <TableCell className="text-slate-700 py-4 max-w-[200px] truncate" title={order.itemName}>
                        {order.itemName}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200">{order.cancelStage}</Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant={
                            order.cancelReason === "Customer Request"
                              ? "default"
                              : order.cancelReason === "Quality Issues"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {order.cancelReason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.poQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.totalLiftedQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.receivedQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.qty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.pendingQty}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 py-4">
                        ₹{Number(order.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 py-4">
                        ₹{Number(order.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {!loading && filteredCancelledOrders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={15}
                      className="text-center text-muted-foreground h-32"
                    >
                      {searchTerm
                        ? "No orders match your search criteria"
                        : "No cancelled orders found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={cancelledOrdersPagination.page}
            pageSize={cancelledOrdersPagination.pageSize}
            totalCount={cancelledOrdersPagination.totalCount}
            onPageChange={cancelledOrdersPagination.setPage}
            onPageSizeChange={cancelledOrdersPagination.setPageSize}
          />
        </CardContent>
      </Card>

      {/* Cancel Order Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
            {/* Search Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="md:col-span-10 space-y-1.5">
                <Label>Search by Indent Number *</Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter Indent Number (e.g. IN-...)"
                  className="bg-white border-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium flex items-center justify-center gap-2 h-10"
                >
                  {searchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {/* Results Table Section */}
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                <span className="text-sm text-slate-500 font-medium">Searching FMS Sheet...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Search Results ({searchResults.length} found)
                  </h4>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {selectedSearchRowIds.length} Selected
                  </Badge>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-12 text-center">
                          <Checkbox
                            checked={
                              searchResults.length > 0 &&
                              selectedSearchRowIds.length === searchResults.length
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSearchRowIds(searchResults.map(r => r.id))
                              } else {
                                setSelectedSearchRowIds([])
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">Indent No.</TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">PO Number</TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">Item Name</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">PO Qty</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">Lifted Qty</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">Cancelled Qty</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">Remaining Qty</TableHead>
                        <TableHead className="w-[120px] text-center text-xs uppercase font-semibold text-slate-600">Qty to Cancel</TableHead>
                        <TableHead className="text-right text-xs uppercase font-semibold text-slate-600">Rate</TableHead>
                        <TableHead className="text-right text-xs uppercase font-semibold text-slate-600">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((row) => {
                        const qtyToCancel = Number(cancelQuantities[row.id] ?? row.remainingQty) || 0;
                        const amount = qtyToCancel * (row.rate || 0);
                        return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            "hover:bg-slate-50/50 transition-colors border-b border-slate-100",
                            selectedSearchRowIds.includes(row.id) && "bg-red-50/20"
                          )}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedSearchRowIds.includes(row.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSearchRowIds(prev => [...prev, row.id])
                                } else {
                                  setSelectedSearchRowIds(prev => prev.filter(id => id !== row.id))
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs text-slate-900">{row.indentNumber}</TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-500">{row.poNumber}</TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-[150px] truncate" title={row.itemName}>
                            {row.itemName}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-700">{row.poQty}</TableCell>
                          <TableCell className="text-center text-xs text-slate-700">{row.liftedQty}</TableCell>
                          <TableCell className="text-center text-xs text-slate-700">{row.cancelledQty}</TableCell>
                          <TableCell className="text-center text-xs text-slate-700 font-semibold">{row.remainingQty}</TableCell>
                          <TableCell className="text-center py-1">
                            <Input
                              type="number"
                              min="1"
                              max={isNaN(Number(row.remainingQty)) ? undefined : Number(row.remainingQty)}
                              value={cancelQuantities[row.id] ?? row.remainingQty}
                              onChange={(e) => {
                                const val = e.target.value
                                setCancelQuantities(prev => ({
                                  ...prev,
                                  [row.id]: val
                                }))
                              }}
                              className={cn(
                                "w-20 text-center h-8 bg-white border-slate-200 focus-visible:ring-red-500 mx-auto",
                                Number(cancelQuantities[row.id] ?? row.remainingQty) > row.remainingQty && "border-destructive text-destructive focus-visible:ring-destructive focus:border-destructive"
                              )}
                              placeholder="Qty"
                              disabled={!selectedSearchRowIds.includes(row.id)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-700">
                            ₹{Number(row.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-slate-800">
                            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : searchQuery.trim() && !searchLoading ? (
              <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-lg">
                No search results yet. Click Search to retrieve matching rows.
              </div>
            ) : null}

            {/* Cancellation Details Form (Visible only when rows are selected) */}
            {selectedSearchRowIds.length > 0 && (
              <div className="border border-red-100 bg-red-50/10 p-5 rounded-lg space-y-4 animate-in slide-in-from-top-4 duration-300">
                <h4 className="text-sm font-semibold text-red-900 border-b pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full" />
                  Cancellation Details for {selectedSearchRowIds.length} Selected Item(s)
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cancelReason">Order Cancel Reason *</Label>
                    <Input
                      id="cancelReason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Enter cancel reason description"
                      className="bg-white border-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t pt-4 flex justify-end gap-2 bg-white">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCancellation}
              disabled={
                selectedSearchRowIds.length === 0 ||
                !cancelStage ||
                !cancelReason ||
                submitting ||
                selectedSearchRowIds.some(id => {
                  const q = cancelQuantities[id] ?? searchResults.find(r => r.id === id)?.remainingQty
                  const numQ = Number(q)
                  const remaining = searchResults.find(r => r.id === id)?.remainingQty || 0
                  return !q || isNaN(numQ) || numQ <= 0 || numQ > remaining
                })
              }
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                `Cancel ${selectedSearchRowIds.length} Order(s)`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `}</style>
    </div>
  )
}