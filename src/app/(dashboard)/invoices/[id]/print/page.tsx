"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PrintDocument, type PrintLineItem } from "@/components/quotations/print-document";

interface InvoiceDetail {
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  contacts: { name: string | null; phone: string; email: string | null } | null;
}

export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account } = useAuth();
  const supabase = createClient();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [items, setItems] = useState<PrintLineItem[]>([]);

  useEffect(() => {
    if (!account) return;
    (async () => {
      const [{ data: inv }, { data: lineItems }] = await Promise.all([
        supabase.from("crm_invoices").select("*, contacts(name, phone, email)").eq("id", id).single(),
        supabase.from("crm_invoice_items").select("*").eq("invoice_id", id).order("position"),
      ]);
      setInvoice(inv as unknown as InvoiceDetail);
      setItems((lineItems ?? []) as PrintLineItem[]);
    })();
  }, [account, id, supabase]);

  if (!invoice) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <PrintDocument
      docType="Invoice"
      docNumber={invoice.invoice_number}
      companyName={account?.name ?? "Your Company"}
      contactName={invoice.contacts?.name || invoice.contacts?.phone || "Customer"}
      contactPhone={invoice.contacts?.phone ?? ""}
      contactEmail={invoice.contacts?.email}
      status={invoice.status}
      currency={invoice.currency}
      items={items}
      subtotal={invoice.subtotal}
      discountAmount={invoice.discount_amount}
      taxAmount={invoice.tax_amount}
      total={invoice.total}
      amountPaid={invoice.amount_paid}
      issuedDate={invoice.created_at}
      secondaryDateLabel="Due Date"
      secondaryDate={invoice.due_date}
      notes={invoice.notes}
    />
  );
}
