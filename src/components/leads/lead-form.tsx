"use client";

import { useState, useEffect } from "react";
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
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clampNonNegative, isValidEmail, isValidPhone } from "@/lib/validation/format";

export interface Lead {
  id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  source: string;
  industry: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  expected_value: number | null;
  notes: string | null;
  next_follow_up: string | null;
  contact_id: string | null;
  deal_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export const LEAD_SOURCES = [
  "website",
  "referral",
  "whatsapp",
  "email",
  "phone",
  "advertisement",
  "social_media",
  "manual",
  "api",
] as const;

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSaved: () => void;
}

export function LeadForm({ open, onOpenChange, lead, onSaved }: LeadFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [source, setSource] = useState<string>("manual");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<string>("new");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [notes, setNotes] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (lead) {
      setFirstName(lead.first_name);
      setLastName(lead.last_name ?? "");
      setCompanyName(lead.company_name ?? "");
      setEmail(lead.email ?? "");
      setPhone(lead.phone ?? "");
      setAlternatePhone(lead.alternate_phone ?? "");
      setSource(lead.source);
      setIndustry(lead.industry ?? "");
      setStatus(lead.status);
      setPriority(lead.priority);
      setAssignedTo(lead.assigned_to ?? "");
      setExpectedValue(lead.expected_value != null ? String(lead.expected_value) : "");
      setNextFollowUp(lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : "");
      setNotes(lead.notes ?? "");
    } else {
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setAlternatePhone("");
      setSource("manual");
      setIndustry("");
      setStatus("new");
      setPriority("medium");
      setAssignedTo("");
      setExpectedValue("");
      setNextFollowUp("");
      setNotes("");
    }
  }, [open, lead]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (!cancelled) setProfiles((data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  async function handleSave() {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (alternatePhone.trim() && !isValidPhone(alternatePhone)) {
      toast.error("Enter a valid alternate phone number");
      return;
    }
    if (!accountId) {
      toast.error("No account linked");
      return;
    }

    setSaving(true);

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      company_name: companyName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      alternate_phone: alternatePhone.trim() || null,
      source,
      industry: industry.trim() || null,
      status,
      priority,
      assigned_to: assignedTo || null,
      expected_value: expectedValue ? clampNonNegative(parseFloat(expectedValue)) : null,
      next_follow_up: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
      notes: notes.trim() || null,
    };

    if (lead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
      if (error) {
        toast.error("Failed to save lead");
        setSaving(false);
        return;
      }
      toast.success("Lead updated");
    } else {
      const { error } = await supabase.from("leads").insert({ ...payload, account_id: accountId });
      if (error) {
        toast.error("Failed to create lead");
        setSaving(false);
        return;
      }
      toast.success("Lead created");
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete lead");
      return;
    }
    toast.success("Lead deleted");
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-lg w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/50 p-4">
            <SheetTitle className="text-popover-foreground">
              {lead ? "Edit Lead" : "New Lead"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">First Name *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Company</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Acme Corp"
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Alternate Phone</Label>
                <Input
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Industry</Label>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Source</Label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Priority</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Expected Value</Label>
                <Input
                  type="number"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                  placeholder="0"
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Next Follow-up</Label>
                <Input
                  type="date"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Assigned To</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px] border-border bg-muted text-foreground"
              />
            </div>

            {lead?.contact_id && (
              <p className="text-xs text-muted-foreground">
                This lead has already been converted to a contact.
              </p>
            )}
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
                disabled={saving || !firstName.trim()}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : lead ? "Save Changes" : "Create Lead"}
              </Button>
            </div>

            {lead &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">Delete this lead?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Lead
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
