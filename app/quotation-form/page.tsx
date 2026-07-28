"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchIndentWorkflow, submitQuotation } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";

const paymentTermsOptions = [
  { value: "Advance", label: "Advance" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" }
];

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
  const [commonTerms, setCommonTerms] = useState("30");
  const [commonDeliveryDate, setCommonDeliveryDate] = useState("");

  const vendorSlot = parseInt(vParam || "1", 10);

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
    }
    if (!commonDeliveryDate) {
      toast.error("Please select Expected Delivery Date.");
      return;
    }

    if (indentItems.length === 0) return;

    setIsSubmitting(true);
    try {
      const updatePromises = indentItems.map(async (item, index) => {
        const quotationId = item._quotationIds?.[`vendor${vendorSlot}`];
        if (quotationId) {
          const { error } = await supabase
            .from("quotation_submissions")
            .update({
              quoted_rate: parseFloat(formRates[index]),
              payment_terms: commonTerms,
              delivery_terms: commonDeliveryDate,
            })
            .eq("id", quotationId);
          if (error) throw error;
        } else {
          await submitQuotation(item.id, {
            vendorName: item.vendorName,
            quotedRate: parseFloat(formRates[index]),
            paymentTerms: commonTerms,
            deliveryTerms: commonDeliveryDate,
          });
        }
      });

      await Promise.all(updatePromises);
      setSubmitted(true);
      toast.success("All quotations submitted successfully!");
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
                    <th className="p-3 text-right text-slate-900">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {indentItems.map((item, index) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-slate-100/30">
                      <td className="p-3 font-mono font-semibold">{item.indentNumber}</td>
                      <td className="p-3">{item.itemName}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{formRates[index]}</td>
                    </tr>
                  ))}
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <Card className="max-w-3xl w-full bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 md:p-8 space-y-2">
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
                Item-wise Rates (Enter rate per unit for each item)
              </Label>
              {indentItems.map((item, index) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-slate-500 text-xs font-semibold">Indent: {item.indentNumber}</span>
                    <h4 className="font-bold text-slate-800 text-sm mt-0.5">{item.itemName}</h4>
                    <span className="text-xs text-slate-500">Category: {item.category}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge className="bg-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
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
                        className="bg-white w-36 h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
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
                    onValueChange={(v) => setCommonTerms(v)}
                  >
                    <SelectTrigger id="commonTerms">
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
