"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export interface PrintLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
}

interface PrintDocumentProps {
  docType: "Quotation" | "Invoice";
  docNumber: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  status: string;
  currency: string;
  items: PrintLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  issuedDate: string;
  secondaryDateLabel?: string;
  secondaryDate?: string | null;
  notes?: string | null;
  terms?: string | null;
}

export function PrintDocument({
  docType,
  docNumber,
  companyName,
  contactName,
  contactPhone,
  contactEmail,
  status,
  currency,
  items,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  amountPaid,
  issuedDate,
  secondaryDateLabel,
  secondaryDate,
  notes,
  terms,
}: PrintDocumentProps) {
  return (
    <div className="mx-auto max-w-3xl bg-background p-6 print:p-0 print:max-w-none">
      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="rounded-xl border border-border p-8 print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{companyName}</h1>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold uppercase tracking-wide text-foreground">{docType}</p>
            <p className="text-sm text-muted-foreground">#{docNumber}</p>
            <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{status}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
            <p className="mt-1 font-medium text-foreground">{contactName}</p>
            <p className="text-sm text-muted-foreground">{contactPhone}</p>
            {contactEmail && <p className="text-sm text-muted-foreground">{contactEmail}</p>}
          </div>
          <div className="text-right text-sm">
            <p><span className="text-muted-foreground">Date: </span>{new Date(issuedDate).toLocaleDateString()}</p>
            {secondaryDate && (
              <p><span className="text-muted-foreground">{secondaryDateLabel}: </span>{new Date(secondaryDate).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Discount</th>
              <th className="py-2 text-right">Tax</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-2 text-foreground">{item.description}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{currency} {item.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right">{item.discount_percent}%</td>
                <td className="py-2 text-right">{item.tax_percent}%</td>
                <td className="py-2 text-right font-medium text-foreground">{currency} {item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {currency} {discountAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+ {currency} {taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><span>Total</span><span>{currency} {total.toFixed(2)}</span></div>
            {amountPaid !== undefined && (
              <>
                <div className="flex justify-between text-emerald-500"><span>Paid</span><span>{currency} {amountPaid.toFixed(2)}</span></div>
                <div className="flex justify-between font-medium"><span>Balance Due</span><span>{currency} {(total - amountPaid).toFixed(2)}</span></div>
              </>
            )}
          </div>
        </div>

        {(notes || terms) && (
          <div className="mt-8 space-y-3 border-t border-border pt-4 text-sm">
            {notes && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{notes}</p>
              </div>
            )}
            {terms && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Terms & Conditions</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
