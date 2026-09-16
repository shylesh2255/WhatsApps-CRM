"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CURRENCIES } from "@/lib/currency";
import { computeTotals, nextDocumentNumber } from "@/lib/quotations/calc";
import { LineItemsEditor, type EditableLineItem } from "@/components/quotations/line-items-editor";

interface Contact {
  id: string;
  name: string | null;
  phone: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface QuotationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function emptyItem(): EditableLineItem {
  return {
    key: crypto.randomUUID(),
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: 0,
  };
}

export function QuotationForm({ open, onOpenChange, onSaved }: QuotationFormProps) {
  const supabase = createClient();
  const { accountId, profile, defaultCurrency } = useAuth();

  const [contactId, setContactId] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<EditableLineItem[]>([emptyItem()]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContactId("");
    setCurrency(defaultCurrency);
    setValidUntil("");
    setNotes("");
    setTerms("");
    setItems([emptyItem()]);
  }, [open, defaultCurrency]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("id, name, phone").order("name"),
        supabase.from("products").select("id, name, price").order("name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProducts((p.data ?? []) as Product[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  const totals = computeTotals(items);

  async function handleSave() {
    if (!contactId) {
      toast.error("Select a contact");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error("Every line item needs a description");
      return;
    }
    if (!accountId || !profile) return;

    setSaving(true);
    try {
      const { count } = await supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const quoteNumber = nextDocumentNumber("QT", count ?? 0);

      const { data: quotation, error: quoteError } = await supabase
        .from("quotations")
        .insert({
          account_id: accountId,
          quote_number: quoteNumber,
          contact_id: contactId,
          status: "draft",
          currency,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          tax_amount: totals.taxAmount,
          total: totals.total,
          valid_until: validUntil || null,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (quoteError) throw quoteError;

      const { error: itemsError } = await supabase.from("quotation_items").insert(
        items.map((item, index) => ({
          quotation_id: quotation.id,
          product_id: item.product_id,
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          line_total: computeTotals([item]).total,
          position: index,
        }))
      );
      if (itemsError) throw itemsError;

      toast.success(`Quotation ${quoteNumber} created`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Error creating quotation:", error);
      toast.error("Failed to create quotation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-xl w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/50 p-4">
            <SheetTitle className="text-popover-foreground">New Quotation</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Contact *</Label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Select contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Valid Until</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Line Items</Label>
              <LineItemsEditor items={items} onChange={setItems} products={products} currency={currency} />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{currency} {totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>- {currency} {totals.discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>+ {currency} {totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                <span>Total</span>
                <span>{currency} {totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border-border bg-muted text-foreground"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Terms & Conditions</Label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="border-border bg-muted text-foreground"
                rows={2}
              />
            </div>
          </div>

          <div className="border-t border-border/50 bg-popover/80 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !contactId}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Create Quotation"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
