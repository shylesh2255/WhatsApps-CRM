"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { lineTotal } from "@/lib/quotations/calc";
import { clampNonNegative, clampPercent } from "@/lib/validation/format";

export interface EditableLineItem {
  key: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface LineItemsEditorProps {
  items: EditableLineItem[];
  onChange: (items: EditableLineItem[]) => void;
  products: Product[];
  currency: string;
}

export function LineItemsEditor({ items, onChange, products, currency }: LineItemsEditorProps) {
  const updateItem = (key: string, patch: Partial<EditableLineItem>) => {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        key: crypto.randomUUID(),
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: 0,
      },
    ]);
  };

  const removeItem = (key: string) => {
    onChange(items.filter((item) => item.key !== key));
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={item.product_id ?? ""}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  updateItem(item.key, {
                    product_id: e.target.value || null,
                    description: product ? product.name : item.description,
                    unit_price: product ? product.price : item.unit_price,
                  });
                }}
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Custom item</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeItem(item.key)}
                disabled={items.length === 1}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <Input
              value={item.description}
              onChange={(e) => updateItem(item.key, { description: e.target.value })}
              placeholder="Description"
              className="border-border bg-background text-foreground"
            />

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Qty</label>
                <Input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: clampNonNegative(parseFloat(e.target.value) || 0) })}
                  className="border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Price ({currency})</label>
                <Input
                  type="number"
                  min={0}
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.key, { unit_price: clampNonNegative(parseFloat(e.target.value) || 0) })}
                  className="border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Discount %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.discount_percent}
                  onChange={(e) => updateItem(item.key, { discount_percent: clampPercent(parseFloat(e.target.value) || 0) })}
                  className="border-border bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Tax %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.tax_percent}
                  onChange={(e) => updateItem(item.key, { tax_percent: clampPercent(parseFloat(e.target.value) || 0) })}
                  className="border-border bg-background text-foreground"
                />
              </div>
            </div>

            <p className="text-right text-xs text-muted-foreground">
              Line total: {currency} {lineTotal(item).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add Item
      </Button>
    </div>
  );
}
