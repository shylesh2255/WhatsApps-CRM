"use client";

import { useAuth } from "@/hooks/use-auth";
import { LeadsList } from "@/components/leads/leads-list";

export default function LeadsPage() {
  const { account } = useAuth();

  if (!account) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-2">
          Track and qualify leads before converting them into contacts and deals
        </p>
      </div>

      <LeadsList />
    </div>
  );
}
