export interface LineItemInput {
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
}

export function lineTotal(item: LineItemInput): number {
  const gross = item.quantity * item.unit_price;
  const afterDiscount = gross * (1 - item.discount_percent / 100);
  const withTax = afterDiscount * (1 + item.tax_percent / 100);
  return Math.round(withTax * 100) / 100;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export function computeTotals(items: LineItemInput[]): Totals {
  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  for (const item of items) {
    const gross = item.quantity * item.unit_price;
    const discount = gross * (item.discount_percent / 100);
    const afterDiscount = gross - discount;
    const tax = afterDiscount * (item.tax_percent / 100);
    subtotal += gross;
    discountAmount += discount;
    taxAmount += tax;
  }

  const total = subtotal - discountAmount + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function nextDocumentNumber(prefix: string, existingCount: number): string {
  return `${prefix}-${String(existingCount + 1).padStart(4, "0")}`;
}
