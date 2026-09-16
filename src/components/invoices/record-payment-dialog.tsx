"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string;
  total: number;
  amount_paid: number;
  currency: string;
}

interface RecordPaymentDialogProps {
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}

export function RecordPaymentDialog({ invoice, onOpenChange, onRecorded }: RecordPaymentDialogProps) {
  const supabase = createClient();
  const { accountId, profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = invoice ? Math.max(invoice.total - invoice.amount_paid, 0) : 0;

  async function handleSubmit() {
    if (!invoice || !accountId) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (value > remaining) {
      toast.error(`Amount can't exceed the remaining balance (${invoice.currency} ${remaining.toFixed(2)})`);
      return;
    }

    setSaving(true);
    try {
      const { error: paymentError } = await supabase.from("crm_payments").insert({
        account_id: accountId,
        invoice_id: invoice.id,
        amount: value,
        method: method.trim() || null,
        transaction_id: transactionId.trim() || null,
        created_by: profile?.id ?? null,
      });
      if (paymentError) throw paymentError;

      const newPaid = invoice.amount_paid + value;
      const newStatus = newPaid >= invoice.total ? "paid" : "partially_paid";

      const { error: updateError } = await supabase
        .from("crm_invoices")
        .update({ amount_paid: newPaid, status: newStatus })
        .eq("id", invoice.id);
      if (updateError) throw updateError;

      toast.success("Payment recorded");
      setAmount("");
      setMethod("");
      setTransactionId("");
      onOpenChange(false);
      onRecorded();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Remaining balance: {invoice.currency} {remaining.toFixed(2)}
            </p>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={remaining.toString()}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Input
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="e.g., UPI, Bank Transfer, Cash"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="transaction_id">Transaction ID</Label>
              <Input
                id="transaction_id"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
