"use client";

import { useAuth } from "@/hooks/use-auth";
import { QuotationsList } from "@/components/quotations/quotations-list";

export default function QuotationsPage() {
  const { account } = useAuth();

  if (!account) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
        <p className="text-muted-foreground mt-2">
          Send quotes to contacts and convert accepted ones into invoices
        </p>
      </div>

      <QuotationsList />
    </div>
  );
}
