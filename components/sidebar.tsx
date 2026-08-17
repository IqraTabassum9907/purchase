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
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { pageAccess, fullName, role, logout } = useAuth();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Live counts reported directly by whichever stage page is currently
  // mounted (see reportPendingCount in lib/utils) — these take precedence
  // over our own separately-derived `counts` approximation below, since
  // they're the exact number the page itself shows in its Pending tab.
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const isPageAllowed = useCallback((pageName: string) => {
    // Settings manages logins/passwords — restricted to Admins regardless of
    // the page_access bypass rules below, and never auto-granted just
    // because a user has no explicit page_access list configured.
    if (pageName === "Settings") return role === "Admin";
    if (!pageAccess || pageAccess.length === 0) return true;
    if (pageName === "Order Cancel" || pageName === "Master") return true;
    return pageAccess.includes(pageName);
  }, [pageAccess, role]);

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
        ["Delegate for Approval", "Indent Approval", "Quotation", "Approved Vendor", "Make PO"].includes(name)
      );
      const needsPayment = activeStageNames.includes("Payment");
      const needsFollowUp = activeStageNames.includes("Follow UP / Lifting");
      const needsReceivingData = activeStageNames.some(name =>
        ["Transporter Follow-Up", "Material Received", "Billing", "Payment"].includes(name)
      );
      const queries: Promise<{ k: string; d: any; e: any }>[] = [];

      const safeQuery = async (queryPromise: PromiseLike<any>, key: string) => {
        try {
          const res = await queryPromise;
          return { k: key, d: res?.data ?? res, e: res?.error ?? null };
        } catch (err) {
          return { k: key, d: null, e: err };
        }
      };

      if (needsIndentData) {
        queries.push(safeQuery(fetchIndentWorkflow(), "indents"));
        queries.push(safeQuery(supabase.from("indent_delegations").select("indent_id"), "delegations"));
      }
      if (needsPayment || needsReceivingData || needsFollowUp) {
        queries.push(safeQuery(supabase.from("purchase_orders").select("id, indent_id, payment_type"), "pos"));
      }
      if (needsPayment || needsFollowUp) {
        queries.push(safeQuery(
          supabase.from("vendor_payments")
            .select("po_id, payment_type, status, transaction_utr, payment_mode, paid_by, advance_status, created_at")
            .order("created_at", { ascending: true }),
          "vp"
        ));
      }
      if (needsFollowUp) {
        queries.push(safeQuery(supabase.from("vendor_liftings").select("po_id, lifting_status, actual_lifting_date"), "vl"));
      }
      if (needsReceivingData) {
        queries.push(safeQuery(supabase.from("transporter_followups").select("po_id, status, freight_amount, bilty_number, transporter_name, vehicle_number"), "tf"));
        queries.push(safeQuery(supabase.from("material_receipts").select("po_id"), "mr"));
        queries.push(safeQuery(supabase.from("tally_billing").select("po_id, verification_status, accountant_name"), "tb"));
      }
      const results = await Promise.all(queries);
      const g: Record<string, any> = {};
      results.forEach(r => { g[r.k] = r.e ? null : r.d; });

      if (g.indents) {
        const rows = g.indents;
        const delegatedIds = new Set((g.delegations || []).map((d: any) => d.indent_id));
        // Delegate for Approval's own Pending tab = not yet delegated to anyone.
        newCounts["Delegate for Approval"] = rows.filter((r: any) => !r.data.actual1 && !delegatedIds.has(r.id)).length;
        // Only counts as awaiting Indent Approval once it's been delegated —
        // matches the Pending-tab filter on that page.
        newCounts["Indent Approval"] = rows.filter((r: any) => !r.data.actual1 && delegatedIds.has(r.id)).length;
        newCounts["Quotation"] = rows.filter((r: any) =>
          r.data.actual1 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.actual3 &&
          !r.data.plan4 &&
          !r.data.selectedVendor
        ).length;
        // Approved Vendor's own Pending tab groups rows that share the same
        // actual3 (quotation-approval) timestamp into a single row — count
        // distinct actual3 values here too, not raw indent rows, or the
        // badge over-counts vs. what the page actually shows.
        const approvedVendorPendingRows = rows.filter((r: any) =>
          r.data.actual3 &&
          r.data.vendorType?.toLowerCase() !== "regular" &&
          !r.data.plan4 &&
          !r.data.selectedVendor
        );
        newCounts["Approved Vendor"] = new Set(approvedVendorPendingRows.map((r: any) => r.data.actual3)).size;
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
        // Latest Advance-payment decision per PO — mirrors follow-up-lifting.tsx:
        // a PO whose payment plan needs an advance stays parked in Payment's
        // own Pending tab (not counted here) until "Need Advance Payment
        // Again" is explicitly recorded.
        const advancePaymentsByPoId = new Map<string, boolean>();
        (g.vp || []).forEach((p: any) => {
          if (!p.po_id || p.payment_type !== "Advance") return;
          advancePaymentsByPoId.set(p.po_id, true);
        });
        newCounts["Follow UP / Lifting"] = g.pos.filter((p: any) => {
          if (actualLiftedPoIds.has(p.id)) return false;
          const requiresAdvanceDecision = !String(p.payment_type || "").toLowerCase().includes("no advance");
          if (requiresAdvanceDecision && !advancePaymentsByPoId.has(p.id)) return false;
          return true;
        }).length;
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

      if (g.pos && g.vp && g.tb) {
        // A revision never edits its old PO row — it inserts a new one
        // against the same indent_id. Payment's own Advance tab already
        // collapses these to one row per indent (first PO found per
        // indent_id); count it the same way here, or every revised PO gets
        // counted twice (once as its now-superseded original, once as the
        // revision) and inflates this badge past what that tab shows.
        const advPosByIndentId = new Map<string, any>();
        (g.pos || []).forEach((p: any) => {
          if (p.indent_id && !advPosByIndentId.has(p.indent_id)) advPosByIndentId.set(p.indent_id, p);
        });
        // 1. Pending Advance Payments
        // payment_type reads like "Advance Payment (...)" or "No Advance -
        // ...", and "No Advance" itself contains the substring "advance" —
        // matching on that substring alone wrongly counted every No-Advance
        // PO as needing one too, inflating this badge well past what the
        // page's own Advance Payment > Pending tab actually shows.
        const advPos = Array.from(advPosByIndentId.values()).filter((p: any) => !String(p.payment_type || "").toLowerCase().includes("no advance"));
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
    } catch (e: any) {
      console.warn("Sidebar count update skipped:", e?.message || e);
    }
  }, [filteredStages]);

  useEffect(() => {
    fetchCounts();
  }, [pathname, fetchCounts]);

  useEffect(() => {
    const handleUpdate = () => fetchCounts();
    window.addEventListener("stageUpdated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      window.removeEventListener("stageUpdated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [fetchCounts]);

  // A stage page currently on screen reports its own live Pending-tab count
  // (see reportPendingCount in lib/utils) — trust that over our own
  // separately-derived approximation for that stage so the badge always
  // matches what the page itself shows in its Pending tab.
  useEffect(() => {
    const handlePendingCount = (e: Event) => {
      const { stageName, count } = (e as CustomEvent).detail || {};
      if (!stageName) return;
      setLiveCounts(prev => ({ ...prev, [stageName]: count }));
    };
    window.addEventListener("pendingCountUpdate", handlePendingCount);
    return () => window.removeEventListener("pendingCountUpdate", handlePendingCount);
  }, []);

  // A live count is only trustworthy while its page is actually mounted —
  // drop it on navigation so the fallback approximation takes back over
  // until the newly-opened page reports its own fresh live count.
  useEffect(() => {
    setLiveCounts({});
  }, [pathname]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="NuTech Logo" className="h-10 w-auto max-w-[170px] object-contain" />
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-700 focus:outline-none"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out z-40 
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Fixed Top Logo Header */}
        <div className="hidden lg:flex items-center justify-center py-2.5 px-2 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-10 shadow-2xs overflow-hidden">
          <img src="/logo.png" alt="NuTech Logo" className="h-15 w-auto max-w-[230px] scale-200 object-contain" />
        </div>

        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">

          {showDashboard && (
            <Button
              variant={pathname === "/" ? "default" : "ghost"}
              className={cn(
                "w-full justify-start mb-4 text-sm font-medium transition-all duration-200",
                pathname === "/"
                  ? "bg-linear-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20 hover:from-sky-700 hover:to-blue-700"
                  : "text-slate-700 hover:bg-sky-50 hover:text-sky-700"
              )}
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/">
                <LayoutDashboard className={cn("w-5 h-5 mr-3", pathname === "/" ? "text-white" : "text-sky-600")} />
                Dashboard
              </Link>
            </Button>
          )}

          <div className="space-y-1">
            {filteredStages.map((stage) => {
              const stagePath = `/stages/${stage.slug}`;
              const Icon = stage.icon;
              const count = stage.name === "Create Indent" ? 0 : (liveCounts[stage.name] ?? counts[stage.name] ?? 0);
              const active = isActive(stagePath);
              return (
                <Button
                  key={stage.num}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-linear-to-r from-sky-600 to-blue-600 text-white font-semibold shadow-md shadow-sky-600/20 hover:from-sky-700 hover:to-blue-700"
                      : "text-slate-700 hover:bg-sky-50 hover:text-sky-700"
                  )}
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={stagePath} className="flex items-center w-full">
                    <Icon className={cn("w-5 h-5 mr-3 shrink-0 transition-colors", active ? "text-white" : "text-sky-600")} />
                    <span className="truncate grow text-left">{stage.name}</span>
                    {count > 0 && (
                      <span className={`ml-auto text-[10px] rounded-full px-2 py-0.5 font-bold leading-none min-w-5 text-center shrink-0 transition-all ${active
                        ? "bg-white text-sky-700 shadow-2xs font-extrabold"
                        : "bg-sky-100 text-sky-800"
                        }`}>
                        {count}
                      </span>
                    )}
                  </Link>
                </Button>
              );
            })}
          </div>

          <div className="mt-auto pt-6 pb-6 border-t border-sidebar-border">
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
