import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportDocument } from "@/components/report-pdf";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = createServerClient();

        const [indentRes, poRes, liftingRes, transportRes, receiptRes, masterRes] = await Promise.all([
            supabase.from("indents").select("*").order("created_at", { ascending: true }),
            supabase.from("purchase_orders").select("id, indent_id, po_number, vendor_name, item_name, quantity, status"),
            supabase.from("vendor_liftings").select("*"),
            supabase.from("transporter_followups").select("*"),
            supabase.from("material_receipts").select("po_id"),
            supabase.from("master_items").select("*"),
        ]);

        if (indentRes.error) throw indentRes.error;
        if (poRes.error) throw poRes.error;
        if (liftingRes.error) throw liftingRes.error;
        if (transportRes.error) throw transportRes.error;
        if (receiptRes.error) throw receiptRes.error;
        if (masterRes.error) throw masterRes.error;

        const indents = indentRes.data || [];
        const purchaseOrders = poRes.data || [];
        const liftings = liftingRes.data || [];
        const transports = transportRes.data || [];
        const receipts = receiptRes.data || [];
        const masterData = masterRes.data || [];

        const indentIds = indents.map((i) => i.id);

        const [approvalRes, quotationRes, avRes] = await Promise.all([
            indentIds.length > 0
                ? supabase.from("indent_approvals").select("*").in("indent_id", indentIds)
                : Promise.resolve({ data: [] as any[], error: null }),
            indentIds.length > 0
                ? supabase.from("quotation_submissions").select("*").in("indent_id", indentIds)
                : Promise.resolve({ data: [] as any[], error: null }),
            indentIds.length > 0
                ? supabase.from("approved_vendors").select("*").in("indent_id", indentIds)
                : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        if (approvalRes.error) throw approvalRes.error;
        if (quotationRes.error) throw quotationRes.error;
        if (avRes.error) throw avRes.error;

        const approvals = approvalRes.data || [];
        const quotations = quotationRes.data || [];
        const approvedVendors = avRes.data || [];

        const approvalMap = new Map<string, any>();
        approvals.forEach((a) => {
            const existing = approvalMap.get(a.indent_id);
            if (!existing || new Date(a.approved_at) > new Date(existing.approved_at)) {
                approvalMap.set(a.indent_id, a);
            }
        });

        const avMap = new Map<string, any>();
        approvedVendors.forEach((av) => {
            const existing = avMap.get(av.indent_id);
            if (!existing || new Date(av.approved_at) > new Date(existing.approved_at)) {
                avMap.set(av.indent_id, av);
            }
        });

        const poByIndent = new Map<string, any>();
        purchaseOrders.forEach((po) => {
            if (po.indent_id && !poByIndent.has(po.indent_id)) {
                poByIndent.set(po.indent_id, po);
            }
        });

        const liftingByPo = new Map<string, any>();
        liftings.forEach((l) => {
            if (l.po_id && !liftingByPo.has(l.po_id)) {
                liftingByPo.set(l.po_id, l);
            }
        });

        const transportByPo = new Map<string, any>();
        transports.forEach((t) => {
            if (t.po_id && !transportByPo.has(t.po_id)) {
                transportByPo.set(t.po_id, t);
            }
        });

        const receiptsByPo = new Map<string, any>();
        receipts.forEach((r) => {
            if (r.po_id && !receiptsByPo.has(r.po_id)) {
                receiptsByPo.set(r.po_id, r);
            }
        });

        const respMap: Record<string, string> = {};
        masterData.forEach((item: any) => {
            if (item.category_type && item.item_value) {
                respMap[String(item.category_type).trim()] = String(item.item_value).trim();
            }
        });

        const transportMap = new Map<string, string>();
        transports.forEach((t: any) => {
            const liftNo = t.po_id;
            const exDate = t.expected_date || t.dispatch_date || "";
            if (liftNo) transportMap.set(String(liftNo).trim(), String(exDate));
        });

        const allowedStages = ["Indent Approval", "Make PO", "Follow UP / Lifting", "Transporter Follow-Up"];
        const totalCounts: Record<string, number> = {};
        const overdueCounts: Record<string, number> = {};
        allowedStages.forEach(name => {
            totalCounts[name] = 0;
            overdueCounts[name] = 0;
        });

        const detailed: any[] = [];
        const followUpVendorPOs = new Set<string>();

        for (const indent of indents) {
            const approval = approvalMap.get(indent.id);
            const av = avMap.get(indent.id);
            const po = poByIndent.get(indent.id);
            const lifting = liftingByPo.get(po?.id);

            if (!approval) {
                totalCounts["Indent Approval"]++;
                overdueCounts["Indent Approval"]++;
                detailed.push({
                    indent: indent.indent_number || "-",
                    party: indent.created_by || "-",
                    item: indent.item_name || "-",
                    qty: indent.quantity || "-",
                    stage: "Indent Approval",
                    delay: "0",
                    poNumber: "-",
                });
            }

            if (approval && approval.approval_status === "approved" && !po) {
                totalCounts["Make PO"]++;
                overdueCounts["Make PO"]++;
                detailed.push({
                    indent: indent.indent_number || "-",
                    party: av?.vendor_name || indent.category || "-",
                    item: indent.item_name || "-",
                    qty: indent.quantity || "-",
                    stage: "Make PO",
                    delay: "0",
                    poNumber: "-",
                });
            }

            if (po && !lifting) {
                totalCounts["Follow UP / Lifting"]++;
                overdueCounts["Follow UP / Lifting"]++;
                const poNumKey = String(po.po_number || "").toUpperCase().replace(/\s+/g, '');
                if (poNumKey && poNumKey !== "-" && !followUpVendorPOs.has(poNumKey)) {
                    followUpVendorPOs.add(poNumKey);
                    detailed.push({
                        indent: indent.indent_number || "-",
                        party: po.vendor_name || av?.vendor_name || "-",
                        item: po.item_name || indent.item_name || "-",
                        qty: po.quantity || indent.quantity || "-",
                        stage: "Follow UP / Lifting",
                        delay: "0",
                        poNumber: po.po_number || "-",
                        plannedDate: lifting?.planned_date || "-",
                    });
                }
            }
        }

        for (const lifting of liftings) {
            const po = purchaseOrders.find((p) => p.id === lifting.po_id);
            if (!po) continue;

            const transport = transportByPo.get(po.id);
            if (!transport) {
                totalCounts["Transporter Follow-Up"]++;
                overdueCounts["Transporter Follow-Up"]++;
                const liftNo = String(lifting.id || "").trim();
                const expectedFromTransport = transportMap.get(liftNo);
                const plannedDate = lifting.planned_date || expectedFromTransport || "-";

                detailed.push({
                    indent: po.indent_id || "-",
                    party: po.vendor_name || "-",
                    item: po.item_name || "-",
                    qty: po.quantity || "-",
                    stage: "Transporter Follow-Up",
                    delay: "0",
                    expectedDate: plannedDate,
                    transporterName: "-",
                    poNumber: po.po_number || "-",
                });
            }
        }

        const summaryData = allowedStages
            .filter(name => overdueCounts[name] > 0)
            .map(name => ({
                stage: name,
                pending: overdueCounts[name],
                responsible: respMap[name] || "-",
                uniquePoCount: name === "Follow UP / Lifting" ? followUpVendorPOs.size : undefined
            }));

        detailed.sort((a, b) => {
            const indexA = allowedStages.indexOf(a.stage);
            const indexB = allowedStages.indexOf(b.stage);
            return indexA - indexB;
        });

        const doc = React.createElement(ReportDocument, { summaryData, detailedData: detailed }) as any;
        const buffer = await renderToBuffer(doc);
        const base64Pdf = buffer.toString('base64');
        const filename = `Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        return NextResponse.json({
            success: true,
            message: "Purchase Report generated successfully via Supabase",
            filename,
            summary: summaryData,
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
