"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PrintDocument, type PrintLineItem } from "@/components/quotations/print-document";

interface QuotationDetail {
  quote_number: string;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
  contacts: { name: string | null; phone: string; email: string | null } | null;
}

export default function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { account } = useAuth();
  const supabase = createClient();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [items, setItems] = useState<PrintLineItem[]>([]);

  useEffect(() => {
    if (!account) return;
    (async () => {
      const [{ data: q }, { data: lineItems }] = await Promise.all([
        supabase.from("quotations").select("*, contacts(name, phone, email)").eq("id", id).single(),
        supabase.from("quotation_items").select("*").eq("quotation_id", id).order("position"),
      ]);
      setQuotation(q as unknown as QuotationDetail);
      setItems((lineItems ?? []) as PrintLineItem[]);
    })();
  }, [account, id, supabase]);

  if (!quotation) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <PrintDocument
      docType="Quotation"
      docNumber={quotation.quote_number}
      companyName={account?.name ?? "Your Company"}
      contactName={quotation.contacts?.name || quotation.contacts?.phone || "Customer"}
      contactPhone={quotation.contacts?.phone ?? ""}
      contactEmail={quotation.contacts?.email}
      status={quotation.status}
      currency={quotation.currency}
      items={items}
      subtotal={quotation.subtotal}
      discountAmount={quotation.discount_amount}
      taxAmount={quotation.tax_amount}
      total={quotation.total}
      issuedDate={quotation.created_at}
      secondaryDateLabel="Valid Until"
      secondaryDate={quotation.valid_until}
      notes={quotation.notes}
      terms={quotation.terms}
    />
  );
}
