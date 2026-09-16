"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  contact_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export const EVENT_TYPES = ["meeting", "call", "follow_up", "reminder", "other"] as const;

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  onSaved: () => void;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventForm({ open, onOpenChange, event, defaultDate, onSaved }: EventFormProps) {
  const supabase = createClient();
  const { accountId, profile } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<string>("meeting");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [contactId, setContactId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setEventType(event.event_type);
      setStartAt(toLocalInput(new Date(event.start_at)));
      setEndAt(event.end_at ? toLocalInput(new Date(event.end_at)) : "");
      setAllDay(event.all_day);
      setContactId(event.contact_id ?? "");
      setAssignedTo(event.assigned_to ?? "");
    } else {
      const base = defaultDate ?? new Date();
      const start = new Date(base);
      start.setHours(9, 0, 0, 0);
      setTitle("");
      setDescription("");
      setEventType("meeting");
      setStartAt(toLocalInput(start));
      setEndAt("");
      setAllDay(false);
      setContactId("");
      setAssignedTo("");
    }
  }, [open, event, defaultDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("id, name, phone").order("name"),
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!startAt) {
      toast.error("Start date/time is required");
      return;
    }
    if (endAt && new Date(endAt) < new Date(startAt)) {
      toast.error("End time can't be before the start time");
      return;
    }
    if (!accountId) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
      all_day: allDay,
      contact_id: contactId || null,
      assigned_to: assignedTo || null,
    };

    if (event) {
      const { error } = await supabase.from("calendar_events").update(payload).eq("id", event.id);
      if (error) {
        toast.error("Failed to save event");
        setSaving(false);
        return;
      }
      toast.success("Event updated");
    } else {
      const { error } = await supabase.from("calendar_events").insert({
        ...payload,
        account_id: accountId,
        created_by: profile?.id ?? null,
      });
      if (error) {
        toast.error("Failed to create event");
        setSaving(false);
        return;
      }
      toast.success("Event created");
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    const { error } = await supabase.from("calendar_events").delete().eq("id", event.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete event");
      return;
    }
    toast.success("Event deleted");
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
              {event ? "Edit Event" : "New Event"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Type</Label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary capitalize"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
              <Label className="text-muted-foreground">All day</Label>
              <Switch checked={allDay} onCheckedChange={(checked: boolean) => setAllDay(checked)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Start *</Label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? startAt.slice(0, 10) : startAt}
                  onChange={(e) =>
                    setStartAt(allDay ? `${e.target.value}T00:00` : e.target.value)
                  }
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">End</Label>
                <Input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? endAt.slice(0, 10) : endAt}
                  onChange={(e) =>
                    setEndAt(allDay ? `${e.target.value}T00:00` : e.target.value)
                  }
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>
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
              <Label className="text-muted-foreground">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-border bg-muted text-foreground"
                rows={3}
              />
            </div>
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
                disabled={saving || !title.trim()}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : event ? "Save Changes" : "Create Event"}
              </Button>
            </div>

            {event &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">Delete this event?</span>
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
                  Delete Event
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
