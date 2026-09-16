'use client';

import { useEffect, useState } from 'react';
import { usePlatformOwnerGuard } from '@/hooks/use-platform-owner-guard';

type Agent = { id: string; full_name: string | null; email: string | null };

type SupportRequest = {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  sla_due_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  customer?: { full_name: string | null; email: string | null; phone: string | null; business_name: string | null } | null;
  assignee?: { full_name: string | null; email: string | null } | null;
};

type Comment = { id: string; author_user_id: string; message: string; created_at: string };

const STATUS_LABEL: Record<SupportRequest['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_customer: 'Waiting for customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_STYLE: Record<SupportRequest['priority'], string> = {
  low: 'border-border bg-muted text-muted-foreground',
  medium: 'border-primary/40 bg-primary/10 text-primary',
  high: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  urgent: 'border-red-500/40 bg-red-500/10 text-red-500',
};

function isOverdue(request: SupportRequest) {
  return (
    request.sla_due_at &&
    request.status !== 'resolved' &&
    request.status !== 'closed' &&
    new Date(request.sla_due_at) < new Date()
  );
}

export default function AdminSupportPage() {
  usePlatformOwnerGuard();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reply, setReply] = useState('');

  async function load() {
    const response = await fetch('/api/admin/support', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) {
      setRequests(result.requests ?? []);
      setAgents(result.agents ?? []);
    } else setError(result.error ?? 'Unable to load support requests');
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function patch(id: string, updates: Record<string, unknown>) {
    const response = await fetch('/api/admin/support', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'Unable to update support request'); return; }
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, ...result.request } : request)));
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const response = await fetch(`/api/admin/support/${id}/comments`, { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setComments(result.comments ?? []);
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return;
    const response = await fetch(`/api/admin/support/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply.trim() }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'Unable to send reply'); return; }
    setComments((current) => [...current, result.comment]);
    setReply('');
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, status: 'waiting_customer' } : request)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Support</h1>
        <p className="text-muted-foreground mt-1 text-sm">Review and respond to client payment and account requests.</p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className={`border-border bg-card rounded-xl border p-5 ${isOverdue(request) ? 'border-red-500/50' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-primary text-xs font-semibold">{request.subject}</p>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_STYLE[request.priority]}`}>{request.priority}</span>
                  {request.category && <span className="text-[10px] text-muted-foreground">· {request.category}</span>}
                  {isOverdue(request) && <span className="text-[10px] font-semibold text-red-500">SLA overdue</span>}
                </div>
                <h2 className="text-foreground mt-1 font-semibold">{request.customer?.full_name || request.customer?.email || 'Unknown client'}</h2>
                <p className="text-muted-foreground text-xs">
                  {request.customer?.business_name || 'No company name'} · {request.customer?.phone || 'No phone'} · {new Date(request.created_at).toLocaleString()}
                  {request.sla_due_at && !isOverdue(request) && request.status !== 'resolved' && request.status !== 'closed' && (
                    <> · SLA due {new Date(request.sla_due_at).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm" value={request.priority} onChange={(event) => void patch(request.id, { priority: event.target.value })}>
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm" value={request.assigned_to ?? ''} onChange={(event) => void patch(request.id, { assignedTo: event.target.value || null })}>
                  <option value="">Unassigned</option>
                  {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.full_name || agent.email}</option>)}
                </select>
                <select className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm" value={request.status} onChange={(event) => void patch(request.id, { status: event.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-foreground mt-4 whitespace-pre-wrap text-sm">{request.message}</p>
            <button type="button" onClick={() => void toggleExpand(request.id)} className="mt-3 text-xs text-primary hover:underline">
              {expandedId === request.id ? 'Hide conversation' : 'View conversation & reply'}
            </button>
            {expandedId === request.id && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {comments.length === 0 && <p className="text-xs text-muted-foreground">No replies yet.</p>}
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                    <p className="whitespace-pre-wrap">{comment.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Reply to this customer..." className="border-input bg-background text-foreground flex-1 rounded-md border px-3 py-2 text-sm" />
                  <button type="button" onClick={() => void sendReply(request.id)} className="self-end rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Send</button>
                </div>
              </div>
            )}
          </article>
        ))}
        {!requests.length && <div className="border-border bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">No support requests yet.</div>}
      </div>
    </div>
  );
}
