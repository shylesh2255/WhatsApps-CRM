'use client';

import { useEffect, useState } from 'react';

type SupportRequest = { id: string; subject: string; message: string; status: 'open' | 'in_progress' | 'resolved'; created_at: string; customer?: { full_name: string | null; email: string | null; phone: string | null; business_name: string | null } | null };

export default function AdminSupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/support', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setRequests(result.requests ?? []);
    else setError(result.error ?? 'Unable to load support requests');
  }
  useEffect(() => {
    // The fetch updates local state when the external request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function updateStatus(id: string, status: SupportRequest['status']) {
    const response = await fetch('/api/admin/support', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? 'Unable to update support request');
    else setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request));
  }

  return <div className="space-y-6"><div><h1 className="text-foreground text-2xl font-bold">Support</h1><p className="text-muted-foreground mt-1 text-sm">Review and respond to client payment and account requests.</p></div>{error && <p className="text-sm text-red-500">{error}</p>}<div className="space-y-3">{requests.map((request) => <article key={request.id} className="border-border bg-card rounded-xl border p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-primary text-xs font-semibold">{request.subject}</p><h2 className="text-foreground mt-1 font-semibold">{request.customer?.full_name || request.customer?.email || 'Unknown client'}</h2><p className="text-muted-foreground text-xs">{request.customer?.business_name || 'No company name'} · {request.customer?.phone || 'No phone'} · {new Date(request.created_at).toLocaleString()}</p></div><select className="border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm" value={request.status} onChange={(event) => void updateStatus(request.id, event.target.value as SupportRequest['status'])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><p className="text-foreground mt-4 whitespace-pre-wrap text-sm">{request.message}</p></article>)}{!requests.length && <div className="border-border bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">No support requests yet.</div>}</div></div>;
}