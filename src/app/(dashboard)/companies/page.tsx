"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CompaniesList } from "@/components/companies/companies-list";
import { CompanyForm } from "@/components/companies/company-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CompaniesPage() {
  const { account } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddCompany = () => {
    setRefreshKey((k) => k + 1);
    setIsOpen(false);
  };

  if (!account) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-2">
            Manage the organizations your contacts belong to
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      <CompaniesList key={refreshKey} />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <CompanyForm accountId={account.id} onSuccess={handleAddCompany} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
