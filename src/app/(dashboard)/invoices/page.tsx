"use client";

import { useAuth } from "@/hooks/use-auth";
import { InvoicesList } from "@/components/invoices/invoices-list";

export default function InvoicesPage() {
  const { account } = useAuth();

  if (!account) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground mt-2">
          Bill your contacts and track payments (separate from your own wacrm subscription billing)
        </p>
      </div>

      <InvoicesList />
    </div>
  );
}
