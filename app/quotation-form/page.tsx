"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchIndentWorkflow, submitQuotation, updateQuotationPdfUrl, isMissingColumnError } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";

const paymentTermsOptions = [
  { value: "Advance", label: "Advance" },
  { value: "30 days", label: "30 days" },
  { value: "60 days", label: "60 days" },
  { value: "90 days", label: "90 days" },
  { value: "Custom", label: "Custom / Type Manually..." },
];

const transportTypeOptions = [
  { value: "Ex-Factory", label: "Ex-Factory" },
  { value: "Ex-Factory + Transport", label: "Ex-Factory + Transport" },
  { value: "F.O.R.", label: "F.O.R. (Free on Road)" },
];

const gstOptions = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const NUTECH_ADDRESS = "Swarnabhoomi, C-131, R-5, Vidhan Sabha Road, Naya Raipur, Chattisgarh, India, Raipur, Chattisgarh 493111, IN";

export default function PublicQuotationForm() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id"); // e.g. "IND-001_8"
  const idsParam = searchParams.get("ids"); // e.g. "IND-001_8,IND-002_9"
  const vParam = searchParams.get("v");   // e.g. "1", "2", "3"

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [indentItems, setIndentItems] = useState<Array<{
    id: string;
    indentNumber: string;
    itemName: string;
    quantity: string;
    category: string;
    vendorName: string;
    _quotationIds?: Record<string, string>;
  }>>([]);

  const [formRates, setFormRates] = useState<string[]>([]);
  const [formGst, setFormGst] = useState<string[]>([]);
  const [commonTerms, setCommonTerms] = useState("30 days");
  const [customTerms, setCustomTerms] = useState("");
  const [commonDeliveryDate, setCommonDeliveryDate] = useState("");
  const [commonTransportType, setCommonTransportType] = useState("");
  const [commonRemarks, setCommonRemarks] = useState("");

  const vendorSlot = parseInt(vParam || "1", 10);

  // Per-item total = rate * qty, plus that item's own GST% — shown right next
  // to its Rate field instead of one combined summary.
  const itemTotals = useMemo(
    () =>
      indentItems.map((item, index) => {
        const rate = parseFloat(formRates[index]) || 0;
        const qty = parseFloat(item.quantity) || 0;
        const gstValStr = formGst[index] !== undefined && formGst[index] !== "" ? formGst[index] : "18";
        const gstPct = parseFloat(gstValStr) || 0;
        const base = rate * qty;
        const gstAmt = base * (gstPct / 100);
        return { base, gstAmt, total: base + gstAmt, gstValStr };
      }),
    [indentItems, formRates, formGst]
  );

  const subtotal = useMemo(() => itemTotals.reduce((sum, t) => sum + t.base, 0), [itemTotals]);
  const gstAmount = useMemo(() => itemTotals.reduce((sum, t) => sum + t.gstAmt, 0), [itemTotals]);
  const grandTotal = subtotal + gstAmount;

  useEffect(() => {
    const rawIds = idsParam ? idsParam.split(",") : (idParam ? [idParam] : []);
    if (rawIds.length === 0) {
      setErrorMsg("Missing indent ID or vendor parameter in link.");
      setIsLoading(false);
      return;
    }

    const fetchIndent = async () => {
      try {
        const workflowData = await fetchIndentWorkflow();
        const fetchedItems = [];
        for (const rawId of rawIds) {
          const row = workflowData.find((r) => r.id === rawId);
          if (row) {
            const vendorNameKey = `vendor${vendorSlot}Name` as const;
            fetchedItems.push({
              id: rawId,
              indentNumber: row.data.indentNumber,
              itemName: row.data.itemName,
              quantity: row.data.quantity,
              category: row.data.category,
              vendorName: (row.data as any)[vendorNameKey] || `Vendor #${vendorSlot}`,
              _quotationIds: row._quotationIds,
            });
          }
        }

        if (fetchedItems.length > 0) {
          setIndentItems(fetchedItems);
          setFormRates(fetchedItems.map(() => ""));
          setFormGst(fetchedItems.map(() => "18"));
        } else {
          setErrorMsg("Indent details not found.");
        }
      } catch (err: any) {
        console.error("Fetch error on public quotation form:", err);
        setErrorMsg("Network error trying to load indent details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchIndent();
  }, [idParam, idsParam, vendorSlot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (let i = 0; i < indentItems.length; i++) {
      if (!formRates[i]?.trim()) {
        toast.error(`Please fill in Rate Per Qty for ${indentItems[i].itemName}.`);
        return;
      }
      const itemGst = String(formGst[i] || "18").trim();
      if (!itemGst) {
        toast.error(`Please fill in GST % for ${indentItems[i].itemName}.`);
        return;
      }
    }
    const finalTerms = commonTerms === "Custom" ? customTerms.trim() : commonTerms;
    if (!finalTerms) {
      toast.error("Please specify or select Payment Terms.");
      return;
    }
    if (!commonDeliveryDate) {
      toast.error("Please select Expected Delivery Date.");
      return;
    }
    if (!commonTransportType) {
      toast.error("Please select Transport Type.");
      return;
    }

    if (indentItems.length === 0) return;

    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        indentItems.map(async (item, index): Promise<{ id: string; extendedFieldsSaved: boolean }> => {
          const gstPercentNum = parseFloat(formGst[index] || "18") || 0;
          const existingId = item._quotationIds?.[`vendor${vendorSlot}`];
          if (existingId) {
            const baseUpdate = {
              quoted_rate: parseFloat(formRates[index]),
              payment_terms: finalTerms,
              delivery_terms: commonDeliveryDate,
            };
            const { error } = await supabase
              .from("quotation_submissions")
              .update({
                ...baseUpdate,
                gst_percent: gstPercentNum,
                transport_type: commonTransportType,
                remarks: commonRemarks || "",
              })
              .eq("id", existingId);
            if (!error) return { id: existingId, extendedFieldsSaved: true };
            if (!isMissingColumnError(error)) throw error;

            // Migration not run yet — fall back so the core update still saves.
            const { error: fallbackError } = await supabase
              .from("quotation_submissions")
              .update(baseUpdate)
              .eq("id", existingId);
            if (fallbackError) throw fallbackError;
            return { id: existingId, extendedFieldsSaved: false };
          }
          return submitQuotation(item.id, {
            vendorName: item.vendorName,
            quotedRate: parseFloat(formRates[index]),
            paymentTerms: finalTerms,
            deliveryTerms: commonDeliveryDate,
            gstPercent: gstPercentNum,
            transportType: commonTransportType,
            remarks: commonRemarks || "",
          });
        })
      );

      const quotationIds = results.map((r) => r.id);
      const extendedFieldsMissing = results.some((r) => !r.extendedFieldsSaved);

      setSubmitted(true);
      if (extendedFieldsMissing) {
        toast.warning(
          "Quotation saved, but GST / Transport Type / Remarks couldn't be saved — ask the admin to run the pending database migration."
        );
      } else {
        toast.success("All quotations submitted successfully!");
      }

      // Auto-generate a PDF copy of this quotation and attach it to the
      // submitted rows. Non-blocking: the quotation itself is already saved
      // above even if the PDF step fails (e.g. the storage bucket or the
      // new columns haven't been set up yet).
      try {
        const { pdf } = await import("@react-pdf/renderer");
        const { QuotationPdfDocument } = await import("@/components/stages/quotation-pdf");

        const pdfItems = indentItems.map((item, index) => {
          const rate = parseFloat(formRates[index]) || 0;
          return {
            srNo: index + 1,
            itemName: item.itemName,
            indentNumber: item.indentNumber,
            quantity: item.quantity,
            rate: rate.toFixed(2),
            gstPercent: formGst[index] || "0",
            amount: itemTotals[index].total.toFixed(2),
          };
        });

        const blob = await pdf(
          <QuotationPdfDocument
            logoUrl={`${window.location.origin}/nutech-logo.png`}
            companyAddress={NUTECH_ADDRESS}
            vendorName={indentItems[0]?.vendorName || ""}
            submissionDate={new Date().toLocaleDateString("en-GB")}
            paymentTerms={finalTerms}
            deliveryDate={commonDeliveryDate}
            transportType={transportTypeOptions.find((o) => o.value === commonTransportType)?.label || commonTransportType}
            remarks={commonRemarks}
            items={pdfItems}
            subtotal={subtotal.toFixed(2)}
            gstAmount={gstAmount.toFixed(2)}
            grandTotal={grandTotal.toFixed(2)}
          />
        ).toBlob();

        const safeVendor = (indentItems[0]?.vendorName || "vendor").replace(/[^a-zA-Z0-9-_]/g, "_");
        const pdfPath = `quotation-pdfs/${safeVendor}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("quotation-documents")
          .upload(pdfPath, blob, { contentType: "application/pdf" });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("quotation-documents").getPublicUrl(pdfPath);
          const pdfUrl = urlData?.publicUrl || "";
          if (pdfUrl) {
            await updateQuotationPdfUrl(quotationIds, pdfUrl);
          }
        } else {
          console.warn("Quotation PDF upload failed:", uploadError.message);
        }
      } catch (pdfErr) {
        console.error("Failed to auto-generate quotation PDF (non-blocking):", pdfErr);
      }
    } catch (err: any) {
      console.error("Quotation submit error:", err);
      toast.error(err.message || "Failed to submit quotation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
          <p className="text-slate-600 text-sm font-medium">Loading proposal parameters...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200 bg-white">
          <CardHeader className="flex flex-col items-center gap-2">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <CardTitle className="text-red-800 text-lg">Error loading form</CardTitle>
            <CardDescription className="text-center">{errorMsg}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full border-green-150 bg-white shadow-xl rounded-2xl">
          <CardHeader className="flex flex-col items-center gap-3 pt-8">
            <div className="w-16 h-16 bg-emerald-100 flex items-center justify-center rounded-full text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-slate-900 text-xl font-bold tracking-tight">Quotation Received!</CardTitle>
            <CardDescription className="text-center text-slate-500 px-4">
              Thank you for submitting your quotation. The purchasing department has been notified.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8 px-8 space-y-4">
            <div className="font-semibold text-sm text-slate-700">Submitted Items Summary (Vendor: {indentItems[0]?.vendorName}):</div>
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3">Indent</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">GST %</th>
                    <th className="p-3 text-right text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {indentItems.map((item, index) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-100/30">
                      <td className="p-3 font-mono font-semibold">{item.indentNumber}</td>
                      <td className="p-3">{item.itemName}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">₹{formRates[index]}</td>
                      <td className="p-3 text-right">{itemTotals[index]?.gstValStr || formGst[index] || "18"}%</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{itemTotals[index]?.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-b">
                    <td className="p-3 font-semibold text-slate-600" colSpan={6}>Sub Total</td>
                    <td className="p-3 text-right font-semibold text-slate-800">₹{subtotal.toFixed(2)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-semibold text-slate-600" colSpan={6}>GST Amount</td>
                    <td className="p-3 text-right font-semibold text-slate-800">₹{gstAmount.toFixed(2)}</td>
                  </tr>
                  <tr className="bg-slate-100/70">
                    <td className="p-3 font-bold text-slate-800" colSpan={6}>Grand Total</td>
                    <td className="p-3 text-right font-bold text-slate-900">₹{grandTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 text-xs text-slate-600 space-y-2 mt-4 shadow-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Payment Terms:</span>
                <span className="font-semibold text-slate-800">{paymentTermsOptions.find(o => o.value === commonTerms)?.label || commonTerms}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Expected Delivery Date:</span>
                <span className="font-semibold text-slate-800">{commonDeliveryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Transport Type:</span>
                <span className="font-semibold text-slate-800">{transportTypeOptions.find(o => o.value === commonTransportType)?.label || commonTransportType}</span>
              </div>
              {commonRemarks && (
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500 shrink-0">Remarks:</span>
                  <span className="font-semibold text-slate-800 text-right">{commonRemarks}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <Card className="max-w-3xl w-full bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 md:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <img src="/nutech-logo.png" alt="Nutech Logo" className="h-10 w-auto max-w-[140px] object-contain rounded shrink-0" />
            <div className="min-w-0 max-w-md">
              <h2 className="text-lg font-bold leading-tight">Nutech</h2>
              <p className="text-slate-300 text-xs leading-snug line-clamp-2 wrap-break-word" title={NUTECH_ADDRESS}>{NUTECH_ADDRESS}</p>
            </div>
          </div>
          <CardTitle className="text-xl md:text-2xl font-bold tracking-tight">Vendor Quotation Submission</CardTitle>
          <CardDescription className="text-slate-300 text-sm">
            Please submit your commercial proposal details for the indent lift request below.
          </CardDescription>
        </div>

        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Indent Context Header */}
          <div className="border border-slate-100 bg-slate-50/70 rounded-xl p-4 text-sm flex justify-between items-center shadow-sm">
            <span className="text-slate-500 font-medium">Requesting Vendor:</span>
            <span className="font-bold text-slate-800">{indentItems[0]?.vendorName}</span>
          </div>

          {/* Quotation Inputs Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-xs uppercase font-extrabold text-slate-500 tracking-wider block">
                Item-wise Rates (Enter rate, GST % and see the total per item)
              </Label>
              {indentItems.map((item, index) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-slate-500 text-xs font-semibold">Indent: {item.indentNumber}</span>
                    <h4 className="font-bold text-slate-800 text-sm mt-0.5">{item.itemName}</h4>
                    <span className="text-xs text-slate-500">Category: {item.category}</span>
                  </div>

                  <div className="flex items-end gap-3 shrink-0 flex-wrap">
                    <Badge className="bg-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 mb-1.5">
                      Qty: {item.quantity}
                    </Badge>

                    <div className="space-y-1">
                      <Label htmlFor={`rate-${index}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Rate Per Qty (₹) *</Label>
                      <Input
                        id={`rate-${index}`}
                        type="number"
                        value={formRates[index] || ""}
                        onChange={(e) => {
                          const updated = [...formRates];
                          updated[index] = e.target.value;
                          setFormRates(updated);
                        }}
                        placeholder="Rate in INR"
                        required
                        className="bg-white w-28 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`gst-${index}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GST (%) *</Label>
                      <Select
                        value={formGst[index] || "18"}
                        onValueChange={(val) => {
                          const updated = [...formGst];
                          updated[index] = val;
                          setFormGst(updated);
                        }}
                      >
                        <SelectTrigger id={`gst-${index}`} className="bg-white w-28 h-9 text-xs">
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                        <SelectContent>
                          {gstOptions.map((g) => (
                            <SelectItem key={g.value} value={g.value} className="text-xs">
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total (₹)</Label>
                      <div className="h-9 w-28 flex items-center justify-end px-3 rounded-md border border-slate-200 bg-slate-100 text-sm font-bold text-slate-800">
                        {itemTotals[index]?.total.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {indentItems.length > 1 && (
                <div className="flex justify-end pr-1">
                  <div className="text-sm text-slate-700 space-y-1 text-right">
                    <div>Sub Total: <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span></div>
                    <div>GST Amount: <span className="font-semibold text-slate-900">₹{gstAmount.toFixed(2)}</span></div>
                    <div className="font-bold">Grand Total: <span className="text-slate-900">₹{grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Common Commercial Terms Section */}
            <div className="border border-slate-250 rounded-xl p-4 bg-white space-y-4 shadow-sm">
              <Label className="text-xs uppercase font-extrabold text-slate-800 tracking-wider block border-b pb-2">
                Common Commercial Details (Applies to all items)
              </Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Common Payment Terms */}
                <div className="space-y-1.5">
                  <Label htmlFor="commonTerms" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Terms <span className="text-red-500">*</span></Label>
                  <Select
                    value={commonTerms}
                    onValueChange={(v) => {
                      setCommonTerms(v);
                      if (v !== "Custom") setCustomTerms("");
                    }}
                  >
                    <SelectTrigger id="commonTerms" className="bg-white">
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {commonTerms === "Custom" && (
                    <Input
                      type="text"
                      placeholder="Type custom payment terms (e.g. 50% Advance & 50% on Delivery)"
                      value={customTerms}
                      onChange={(e) => setCustomTerms(e.target.value)}
                      required
                      className="bg-white text-xs h-9 mt-2 border-slate-300 focus:border-slate-500"
                    />
                  )}
                </div>

                {/* Common Expected Delivery Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="commonDeliveryDate" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Delivery Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="commonDeliveryDate"
                    type="date"
                    value={commonDeliveryDate}
                    onChange={(e) => setCommonDeliveryDate(e.target.value)}
                    required
                  />
                </div>

                {/* Transport Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="commonTransportType" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transport Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={commonTransportType}
                    onValueChange={(v) => setCommonTransportType(v)}
                  >
                    <SelectTrigger id="commonTransportType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {transportTypeOptions.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="commonRemarks" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</Label>
                <Textarea
                  id="commonRemarks"
                  value={commonRemarks}
                  onChange={(e) => setCommonRemarks(e.target.value)}
                  placeholder="Any additional notes for this quotation..."
                  className="bg-white resize-none min-h-[70px]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11 text-sm font-semibold tracking-wide rounded-lg transition-colors mt-6 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting quotations...
                </>
              ) : (
                "Submit Quotations"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
