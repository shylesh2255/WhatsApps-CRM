"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  created_at: string;
  updated_at: string;
};

type Comment = { id: string; author_user_id: string; message: string; created_at: string };

const STATUS_LABEL: Record<Ticket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Waiting on your reply",
  resolved: "Resolved",
  closed: "Closed",
};

export function MySupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState("");

  async function load() {
    const response = await fetch("/api/customer/support", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setTickets(result.requests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const response = await fetch(`/api/customer/support/${id}/comments`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setComments(result.comments ?? []);
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return;
    const response = await fetch(`/api/customer/support/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply.trim() }),
    });
    const result = await response.json();
    if (response.ok) {
      setComments((current) => [...current, result.comment]);
      setReply("");
      void load();
    }
  }

  if (loading) return null;
  if (tickets.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Your support tickets</h3>
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[ticket.status]} · {new Date(ticket.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleExpand(ticket.id)}
              className="text-xs text-primary hover:underline shrink-0"
            >
              {expandedId === ticket.id ? "Hide" : "View"}
            </button>
          </div>
          {expandedId === ticket.id && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.message}</p>
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md bg-muted/40 p-2 text-sm">
                  <p className="whitespace-pre-wrap">{comment.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {ticket.status !== "resolved" && ticket.status !== "closed" && (
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="Add a reply..."
                    className="border-input bg-background text-foreground flex-1 rounded-md border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply(ticket.id)}
                    className="self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
