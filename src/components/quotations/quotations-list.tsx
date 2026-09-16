"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Printer, Receipt } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { nextDocumentNumber } from "@/lib/quotations/calc";

interface Quotation {
  id: string;
  quote_number: string;
  contact_id: string;
  status: string;
  currency: string;
  total: number;
  valid_until: string | null;
  created_at: string;
  contacts: { name: string | null; phone: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "border-border bg-muted text-foreground",
  sent: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  viewed: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  rejected: "border-red-500/40 bg-red-500/10 text-red-400",
  expired: "border-border bg-muted text-muted-foreground",
};

const STATUS_FLOW: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["viewed", "accepted", "rejected"],
  viewed: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  expired: [],
};

export function QuotationsList() {
  const { account, accountId, profile } = useAuth();
  const supabase = createClient();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    if (!account) return;
    const { data, error } = await supabase
      .from("quotations")
      .select("*, contacts(name, phone)")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });
    if (!error && data) setQuotations(data as unknown as Quotation[]);
    setLoading(false);
  }, [account, supabase]);

  useEffect(() => {
    queueMicrotask(() => void fetchQuotations());
  }, [fetchQuotations]);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
    setUpdating(null);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    fetchQuotations();
  }

  async function convertToInvoice(quotation: Quotation) {
    if (!accountId || !profile) return;
    setConverting(quotation.id);
    try {
      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotation.id);
      if (itemsError) throw itemsError;

      const { count } = await supabase
        .from("crm_invoices")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);
      const invoiceNumber = nextDocumentNumber("INV", count ?? 0);

      const { data: quoteFull } = await supabase
        .from("quotations")
        .select("subtotal, discount_amount, tax_amount, total, currency")
        .eq("id", quotation.id)
        .single();

      const { data: invoice, error: invoiceError } = await supabase
        .from("crm_invoices")
        .insert({
          account_id: accountId,
          invoice_number: invoiceNumber,
          contact_id: quotation.contact_id,
          quotation_id: quotation.id,
          status: "draft",
          currency: quoteFull?.currency ?? quotation.currency,
          subtotal: quoteFull?.subtotal ?? 0,
          discount_amount: quoteFull?.discount_amount ?? 0,
          tax_amount: quoteFull?.tax_amount ?? 0,
          total: quoteFull?.total ?? quotation.total,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (invoiceError) throw invoiceError;

      if (items && items.length > 0) {
        const { error: lineError } = await supabase.from("crm_invoice_items").insert(
          items.map((item) => ({
            invoice_id: invoice.id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            position: item.position,
          }))
        );
        if (lineError) throw lineError;
      }

      toast.success(`Invoice ${invoiceNumber} created from this quotation`);
      fetchQuotations();
    } catch (error) {
      console.error("Error converting quotation:", error);
      toast.error("Failed to convert to invoice");
    } finally {
      setConverting(null);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading quotations...</div>;
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <FileText className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-12 border rounded-lg mt-4">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No quotations yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.quote_number}</TableCell>
                  <TableCell>{q.contacts?.name || q.contacts?.phone || "-"}</TableCell>
                  <TableCell>
                    {q.currency} {q.total.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${STATUS_STYLE[q.status] ?? ""}`}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                    {STATUS_FLOW[q.status]?.map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="outline"
                        disabled={updating === q.id}
                        onClick={() => updateStatus(q.id, next)}
                        className="capitalize"
                      >
                        Mark {next}
                      </Button>
                    ))}
                    {q.status === "accepted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={converting === q.id}
                        onClick={() => convertToInvoice(q)}
                        className="gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        To Invoice
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5" nativeButton={false} render={<Link href={`/quotations/${q.id}/print`} target="_blank" />}>
                      <Printer className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <QuotationForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchQuotations} />
    </>
  );
}
