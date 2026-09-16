"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyForm } from "@/components/companies/company-form";

interface Company {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  contact_count: number;
}

export function CompaniesList() {
  const { account } = useAuth();
  const supabase = createClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchCompanies = useCallback(async () => {
    if (!account) return;

    const { data, error } = await supabase
      .from("companies")
      .select("*, contacts(count)")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCompanies(
        data.map((c) => ({
          ...c,
          contact_count: c.contacts?.[0]?.count ?? 0,
        })) as Company[]
      );
    }
    setLoading(false);
  }, [account, supabase]);

  useEffect(() => {
    const fetchInitialCompanies = () => {
      void fetchCompanies();
    };

    queueMicrotask(fetchInitialCompanies);
  }, [fetchCompanies]);

  const handleDelete = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company? Linked contacts will be unlinked, not deleted.")) return;

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (!error) {
      setCompanies(companies.filter((c) => c.id !== companyId));
    }
  };

  const handleEditSuccess = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    fetchCompanies();
  };

  if (loading) {
    return <div className="text-center py-8">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No companies yet. Add one to get started!</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    {company.name}
                  </div>
                </TableCell>
                <TableCell>{company.industry || "-"}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {company.email && <div>{company.email}</div>}
                    {company.phone && (
                      <div className="text-muted-foreground">{company.phone}</div>
                    )}
                    {!company.email && !company.phone && "-"}
                  </div>
                </TableCell>
                <TableCell>{company.contact_count}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCompany(company);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(company.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
          </DialogHeader>
          {editingCompany && (
            <CompanyForm
              accountId={account!.id}
              company={editingCompany}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
