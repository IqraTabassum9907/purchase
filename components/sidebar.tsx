"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogOut, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAGES } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";
import { fetchIndentWorkflow } from "@/lib/supabase/queries";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { pageAccess, fullName, role, logout } = useAuth();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const isPageAllowed = useCallback((pageName: string) => {
    if (!pageAccess || pageAccess.length === 0) return true;
    if (pageName === "Order Cancel" || pageName === "Master") return true;
    return pageAccess.includes(pageName);
  }, [pageAccess]);

  const filteredStages = useMemo(() => STAGES.filter(stage => isPageAllowed(stage.name)), [isPageAllowed]);
  const showDashboard = isPageAllowed("Dashboard");

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const fetchCounts = useCallback(async () => {
    try {
      const activeStageNames = filteredStages.map(s => s.name);
      const newCounts: Record<string, number> = {};

      const needsIndentData = activeStageNames.some(name =>
        ["Indent Approval", "Quotation", "Approved Vendor", "Make PO"].includes(name)
      );
      const needsPayment = activeStageNames.includes("Payment");
      const needsFollowUp = activeStageNames.includes("Follow UP / Lifting");
      const needsReceivingData = activeStageNames.some(name =>
        ["Transporter Follow-Up", "Material Received", "Billing", "Payment"].includes(name)
      );
      const needsPurchaseReturn = activeStageNames.includes("Purchase Return");

      const queries: PromiseLike<{ k: string; d: any; e: any }>[] = [];

      if (needsIndentData) {
        queries.push(fetchIndentWorkflow().then(d => ({ k: "indents", d, e: null })));
      }
      if (needsPayment || needsReceivingData) {
        queries.push(supabase.from("purchase_orders").select("id, payment_type").then(r => ({ k: "pos", d: r.data, e: r.error })));
      }
      if (needsPayment) {
        queries.push(supabase.from("vendor_payments").select("po_id, payment_type, status, transaction_utr, payment_mode, paid_by").then(r => ({ k: "vp", d: r.data, e: r.error })));
      }
      if (needsFollowUp) {
        queries.push(supabase.from("vendor_liftings").select("po_id, lifting_status, actual_lifting_date").then(r => ({ k: "vl", d: r.data, e: r.error })));
      }
      if (needsReceivingData) {
        queries.push(supabase.from("transporter_followups").select("po_id, status, freight_amount, bilty_number, transporter_name, vehicle_number").then(r => ({ k: "tf", d: r.data, e: r.error })));
        queries.push(supabase.from("material_receipts").select("po_id").then(r => ({ k: "mr", d: r.data, e: r.error })));
        queries.push(supabase.from("tally_billing").select("po_id, verification_status, accountant_name").then(r => ({ k: "tb", d: r.data, e: r.error })));
      }
      if (needsPurchaseReturn) {
        queries.push(supabase.from("material_receipts").select("id, rejected_quantity").then(r => ({ k: "mr_pr", d: r.data, e: r.error })));
        queries.push(supabase.from("purchase_returns").select("material_receipt_id").then(r => ({ k: "pr", d: r.data, e: r.error })));
      }

      const results = await Promise.all(queries);
      const g: Record<string, any> = {};
      results.forEach(r => { g[r.k] = r.e ? null : r.d; });

      if (g.indents) {
        const rows = g.indents;
        newCounts["Indent Approval"] = rows.filter((r: any) => !r.data.actual1).length;
        newCounts["Quotation"] = rows.filter((r: any) =>
          r.data.actual1 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.actual3 &&
          !r.data.plan4 &&
          !r.data.selectedVendor
        ).length;
        newCounts["Approved Vendor"] = rows.filter((r: any) =>
          r.data.actual3 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.plan4 &&
          !r.data.selectedVendor
        ).length;
        newCounts["Make PO"] = rows.filter((r: any) =>
          ((r.data.vendorType?.toLowerCase() === "regular" && r.data.actual1) || r.data.plan4 || r.data.selectedVendor) &&
          !r.data.poNumber
        ).length;
      }

      if (g.pos && g.vl) {
        const actualLiftedPoIds = new Set(
          (g.vl || [])
            .filter((v: any) => !!v.actual_lifting_date && String(v.actual_lifting_date).trim() !== "" && String(v.actual_lifting_date).trim() !== "-")
            .map((v: any) => v.po_id)
            .filter(Boolean)
        );
        newCounts["Follow UP / Lifting"] = g.pos.filter((p: any) => !actualLiftedPoIds.has(p.id)).length;
      }

      if (g.pos && g.vl && g.tf) {
        const liftedPoIds = new Set(
          (g.vl || [])
            .filter((v: any) => !!v.actual_lifting_date && String(v.actual_lifting_date).trim() !== "" && String(v.actual_lifting_date).trim() !== "-")
            .map((v: any) => v.po_id)
            .filter(Boolean)
        );
        const receivedTfPoIds = new Set((g.tf || []).filter((t: any) => t.status === "Received").map((t: any) => t.po_id).filter(Boolean));
        newCounts["Transporter Follow-Up"] = g.pos.filter((p: any) => liftedPoIds.has(p.id) && !receivedTfPoIds.has(p.id)).length;
      }

      if (g.tf && g.mr) {
        const mrPoIds = new Set((g.mr || []).map((m: any) => m.po_id).filter(Boolean));
        const approvedTf = (g.tf || []).filter((t: any) =>
          t.status === "Received" || t.status === "Completed" || t.status === "Approved" || t.status === "Delivered" || t.status === "Complete"
        );
        newCounts["Material Received"] = approvedTf.filter((t: any) => !mrPoIds.has(t.po_id)).length;
      }

      if (g.mr && g.tb) {
        const verifiedTbPoIds = new Set(
          (g.tb || [])
            .filter((b: any) => b.verification_status === "Verified" || (b.accountant_name && b.accountant_name !== "-"))
            .map((b: any) => b.po_id)
            .filter(Boolean)
        );
        newCounts["Billing"] = (g.mr || []).filter((m: any) => !verifiedTbPoIds.has(m.po_id)).length;
      }

      if (g.mr_pr && g.pr) {
        const returnedReceiptIds = new Set((g.pr || []).map((p: any) => p.material_receipt_id).filter(Boolean));
        newCounts["Purchase Return"] = (g.mr_pr || []).filter(
          (m: any) => (m.rejected_quantity || 0) > 0 && !returnedReceiptIds.has(m.id)
        ).length;
      }

      if (g.pos && g.vp && g.tb) {
        // 1. Pending Advance Payments
        const advPos = (g.pos || []).filter((p: any) => p.payment_type?.toLowerCase().includes("advance"));
        const paidAdvPoIds = new Set(
          (g.vp || [])
            .filter((v: any) => v.payment_type === "Advance" && (v.status === "Paid" || v.status === "completed"))
            .map((v: any) => v.po_id)
            .filter(Boolean)
        );
        const pendingAdvCount = advPos.filter((p: any) => !paidAdvPoIds.has(p.id)).length;

        // 2. Pending Verified Vendor Bills
        const paidVendorPoIds = new Set(
          (g.vp || [])
            .filter((v: any) => 
              v.payment_type === "Vendor Payment" && 
              (!!v.transaction_utr || !!v.payment_mode || (v.status === "Paid" && !v.paid_by))
            )
            .map((v: any) => v.po_id)
            .filter(Boolean)
        );
        const verifiedBills = (g.tb || []).filter(
          (b: any) => b.verification_status === "Verified" || (b.accountant_name && b.accountant_name !== "-")
        );
        const pendingVendorBillCount = verifiedBills.filter((b: any) => !paidVendorPoIds.has(b.po_id)).length;

        // 3. Pending Freight Payments
        const paidFreightPoIds = new Set(
          (g.vp || [])
            .filter((v: any) => (v.payment_type === "Freight Payment" || v.paid_by === "Freight") && (v.status === "Paid" || v.status === "completed" || !!v.transaction_utr))
            .map((v: any) => v.po_id)
            .filter(Boolean)
        );
        const pendingFreightPoIds = new Set(
          (g.tf || [])
            .filter((t: any) => t.po_id && !paidFreightPoIds.has(t.po_id))
            .map((t: any) => t.po_id)
            .filter(Boolean)
        );
        const pendingFreightCount = pendingFreightPoIds.size;

        newCounts["Payment"] = pendingAdvCount + pendingVendorBillCount + pendingFreightCount;
      }

      setCounts(newCounts);
    } catch (e) {
      console.error("Failed to fetch sidebar counts:", e);
    }
  }, [filteredStages]);

  useEffect(() => {
    fetchCounts();
  }, [pathname, fetchCounts]);

  useEffect(() => {
    const handleUpdate = () => fetchCounts();
    window.addEventListener("stageUpdated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    const interval = setInterval(() => {
      fetchCounts();
    }, 3000);

    return () => {
      window.removeEventListener("stageUpdated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
      clearInterval(interval);
    };
  }, [fetchCounts]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Purchase Logo" className="h-10 w-auto max-w-[150px] object-contain" />
          <h1 className="text-sm font-semibold text-sidebar-foreground">
            Purchase
          </h1>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sidebar-foreground focus:outline-none"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={`fixed lg:static top-0 left-0 h-full lg:h-auto w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out z-40 
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="p-4 overflow-y-auto h-full scrollbar-hide">
          <div className="hidden lg:flex items-center gap-3 mb-6 px-1">
            <img src="/logo.png" alt="Purchase Logo" className="h-12 w-auto max-w-[180px] object-contain" />
            <h1 className="text-base font-semibold text-sidebar-foreground">
              Purchase
            </h1>
          </div>

          {showDashboard && (
            <Button
              variant={pathname === "/" ? "default" : "ghost"}
              className="w-full justify-start mb-4"
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/">
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
            </Button>
          )}

          <div className="space-y-1">
            {filteredStages.map((stage) => {
              const stagePath = `/stages/${stage.slug}`;
              const Icon = stage.icon;
              const count = stage.name === "Create Indent" ? 0 : (counts[stage.name] || 0);
              return (
                <Button
                  key={stage.num}
                  variant={isActive(stagePath) ? "default" : "ghost"}
                  className="w-full justify-start text-sm transition-colors duration-200"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={stagePath} className="flex items-center w-full">
                    <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="truncate flex-grow text-left">{stage.name}</span>
                    {count > 0 && (
                      <span className={`ml-auto text-[10px] rounded-full px-2 py-0.5 font-bold leading-none min-w-[20px] text-center flex-shrink-0 transition-all ${
                        isActive(stagePath)
                          ? "bg-white text-slate-900 shadow-sm"
                          : "bg-blue-500 text-white shadow-sm"
                      }`}>
                        {count}
                      </span>
                    )}
                  </Link>
                </Button>
              );
            })}
          </div>

          <div className="mt-auto pt-6 border-t border-sidebar-border">
            <div className="px-3 py-2 mb-3">
              <p className="text-sm text-sidebar-foreground/80">
                Logged in as:
              </p>
              <p className="font-medium truncate" title={fullName || "User"}>{fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-sm border-sidebar-border hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
