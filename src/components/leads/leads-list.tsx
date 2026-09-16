"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightCircle, Download, Plus, Trash2, Upload, Users2 } from "lucide-react";
import { toast } from "sonner";
import { LeadForm, LEAD_STATUSES, type Lead } from "@/components/leads/lead-form";
import { LeadImportModal } from "@/components/leads/lead-import-modal";
import { leadsToCsv } from "@/lib/leads/parse-lead-csv";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  new: "border-border bg-muted text-foreground",
  contacted: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  qualified: "border-violet-500/40 bg-violet-500/10 text-violet-400",
  proposal: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  negotiation: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  won: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  lost: "border-red-500/40 bg-red-500/10 text-red-400",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-primary/40 bg-primary/10 text-primary",
  high: "border-red-500/40 bg-red-500/10 text-red-400",
};

export function LeadsList() {
  const { account, accountId } = useAuth();
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!account) return;
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from("leads").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (!leadsRes.error && leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (!profilesRes.error && profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  }, [account, supabase]);

  useEffect(() => {
    queueMicrotask(() => void fetchLeads());
  }, [fetchLeads]);

  const profileName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = profiles.find((p) => p.id === id);
    return p?.full_name || p?.email || "Unassigned";
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const haystack = `${lead.first_name} ${lead.last_name ?? ""} ${lead.company_name ?? ""} ${lead.email ?? ""} ${lead.phone ?? ""}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [leads, search, statusFilter]);

  async function handleConvert(lead: Lead) {
    if (lead.contact_id) {
      toast.error("Lead has already been converted");
      return;
    }
    if (!lead.phone) {
      toast.error("Add a phone number before converting this lead to a contact");
      return;
    }
    if (!accountId) return;

    setConverting(lead.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not signed in");

      const fullName = `${lead.first_name} ${lead.last_name ?? ""}`.trim();

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          account_id: accountId,
          user_id: userId,
          phone: lead.phone,
          name: fullName,
          email: lead.email,
          company: lead.company_name,
        })
        .select("id")
        .single();
      if (contactError) throw contactError;

      let dealId: string | null = null;
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (pipeline) {
        const { data: stage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", pipeline.id)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (stage) {
          const { data: deal } = await supabase
            .from("deals")
            .insert({
              account_id: accountId,
              user_id: userId,
              pipeline_id: pipeline.id,
              stage_id: stage.id,
              contact_id: contact.id,
              title: fullName || "New deal",
              value: lead.expected_value ?? 0,
              status: "open",
            })
            .select("id")
            .single();
          dealId = deal?.id ?? null;
        }
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          contact_id: contact.id,
          deal_id: dealId,
          converted_at: new Date().toISOString(),
          status: lead.status === "new" || lead.status === "contacted" ? "qualified" : lead.status,
        })
        .eq("id", lead.id);
      if (updateError) throw updateError;

      toast.success(dealId ? "Lead converted to contact + deal" : "Lead converted to contact");
      fetchLeads();
    } catch (error) {
      console.error("Error converting lead:", error);
      toast.error("Failed to convert lead");
    } finally {
      setConverting(null);
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filteredLeads.map((l) => l.id)) : new Set());
  }

  function handleExport() {
    const rows = filteredLeads.filter((l) => selectedIds.size === 0 || selectedIds.has(l.id));
    if (rows.length === 0) {
      toast.error("No leads to export");
      return;
    }
    const csv = leadsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} lead${selectedIds.size === 1 ? "" : "s"}?`)) return;
    setBulkWorking(true);
    const { error } = await supabase.from("leads").delete().in("id", Array.from(selectedIds));
    setBulkWorking(false);
    if (error) {
      toast.error("Failed to delete leads");
      return;
    }
    toast.success(`Deleted ${selectedIds.size} lead${selectedIds.size === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    fetchLeads();
  }

  async function handleBulkStatus(status: string) {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    const { error } = await supabase.from("leads").update({ status }).in("id", Array.from(selectedIds));
    setBulkWorking(false);
    if (error) {
      toast.error("Failed to update leads");
      return;
    }
    toast.success(`Updated ${selectedIds.size} lead${selectedIds.size === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    fetchLeads();
  }

  async function handleBulkAssign(userId: string) {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    const { error } = await supabase.from("leads").update({ assigned_to: userId || null }).in("id", Array.from(selectedIds));
    setBulkWorking(false);
    if (error) {
      toast.error("Failed to assign leads");
      return;
    }
    toast.success(`Assigned ${selectedIds.size} lead${selectedIds.size === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    fetchLeads();
  }

  if (loading) {
    return <div className="text-center py-8">Loading leads...</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search leads by name, company, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingLead(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        {LEAD_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <select
            disabled={bulkWorking}
            defaultValue=""
            onChange={(e) => e.target.value && handleBulkStatus(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="" disabled>Set status...</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            disabled={bulkWorking}
            defaultValue=""
            onChange={(e) => handleBulkAssign(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="" disabled>Assign to...</option>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="gap-1.5 text-red-400 hover:text-red-300" disabled={bulkWorking} onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {filteredLeads.length === 0 ? (
        <div className="text-center py-12 border rounded-lg mt-4">
          <Users2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            {leads.length === 0 ? "No leads yet. Add one to get started!" : "No leads match your filters."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                    onCheckedChange={(checked: boolean) => toggleSelectAll(checked)}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={(checked: boolean) => toggleSelect(lead.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </TableCell>
                  <TableCell>{lead.company_name || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div className="text-muted-foreground">{lead.phone}</div>}
                      {!lead.email && !lead.phone && "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${STATUS_STYLE[lead.status] ?? ""}`}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize ${PRIORITY_STYLE[lead.priority] ?? ""}`}>
                      {lead.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profileName(lead.assigned_to)}
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {!lead.contact_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={converting === lead.id}
                        onClick={() => handleConvert(lead)}
                        title="Convert to contact + deal"
                      >
                        <ArrowRightCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingLead(lead);
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LeadForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingLead(null);
        }}
        lead={editingLead}
        onSaved={fetchLeads}
      />

      <LeadImportModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchLeads} />
    </>
  );
}
