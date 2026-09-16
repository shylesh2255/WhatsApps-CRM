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
import { Printer, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  total: number;
  amount_paid: number;
  due_date: string | null;
  created_at: string;
  contacts: { name: string | null; phone: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "border-border bg-muted text-foreground",
  sent: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  partially_paid: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  overdue: "border-red-500/40 bg-red-500/10 text-red-400",
  cancelled: "border-border bg-muted text-muted-foreground",
};

function displayStatus(invoice: Invoice): string {
  if (
    invoice.status !== "paid" &&
    invoice.status !== "cancelled" &&
    invoice.due_date &&
    new Date(invoice.due_date) < new Date()
  ) {
    return "overdue";
  }
  return invoice.status;
}

export function InvoicesList() {
  const { account } = useAuth();
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!account) return;
    const { data, error } = await supabase
      .from("crm_invoices")
      .select("*, contacts(name, phone)")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });
    if (!error && data) setInvoices(data as unknown as Invoice[]);
    setLoading(false);
  }, [account, supabase]);

  useEffect(() => {
    queueMicrotask(() => void fetchInvoices());
  }, [fetchInvoices]);

  async function markSent(id: string) {
    await supabase.from("crm_invoices").update({ status: "sent" }).eq("id", id);
    fetchInvoices();
  }

  if (loading) {
    return <div className="text-center py-8">Loading invoices...</div>;
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Receipt className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 border rounded-lg mt-4">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No invoices yet. Create one or convert an accepted quotation.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const status = displayStatus(inv);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.contacts?.name || inv.contacts?.phone || "-"}</TableCell>
                    <TableCell>
                      {inv.currency} {inv.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {inv.currency} {inv.amount_paid.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${STATUS_STYLE[status] ?? ""}`}>
                        {status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                      {inv.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => markSent(inv.id)}>
                          Mark Sent
                        </Button>
                      )}
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setPayingInvoice(inv)}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Record Payment
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1.5" nativeButton={false} render={<Link href={`/invoices/${inv.id}/print`} target="_blank" />}>
                        <Printer className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <InvoiceForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchInvoices} />
      <RecordPaymentDialog
        invoice={payingInvoice}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
        onRecorded={fetchInvoices}
      />
    </>
  );
}
