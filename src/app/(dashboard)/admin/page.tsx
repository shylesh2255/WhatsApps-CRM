"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlatformOwnerGuard } from '@/hooks/use-platform-owner-guard';

export default function AdminPage() {
  usePlatformOwnerGuard();
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [companyName, setCompanyName] = useState('');
  const [companyMessage, setCompanyMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/overview').then((response) => response.json()).then((result) => setMetrics(result.metrics ?? {}));
    fetch('/api/account').then((response) => response.json()).then((result) => setCompanyName(result.account?.name ?? ''));
  }, []);
  async function saveCompanyName(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: companyName }) });
    const result = await response.json();
    setCompanyMessage(response.ok ? 'Company name updated.' : result.error ?? 'Unable to update company name.');
  }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Admin dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Manage customers, subscriptions, and payments.</p></div>
      <form onSubmit={saveCompanyName} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
        <div className="min-w-64 flex-1"><label className="text-foreground mb-2 block text-sm font-medium">Company name</label><Input required maxLength={80} value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Enter your company name" /></div>
        <Button type="submit">Save company name</Button>
        {companyMessage && <p className="w-full text-sm text-muted-foreground">{companyMessage}</p>}
      </form>
      <div className="grid gap-4 md:grid-cols-4">
        <AdminLink href="/customers" title="Customers" description="Create accounts, reset passwords, and control access." />
        <AdminLink href="/admin/users" title="Users" description="Review user details without exposing passwords." />
        <AdminLink href="/subscriptions" title="Subscriptions" description="Assign plans, set periods, and track expiry." />
        <AdminLink href="/admin/reports" title="Reports" description="Revenue, growth, and churn trends." />
        <AdminLink href="/admin/ads" title="Ad Banners" description="Sponsor banners shown to viewer-role users." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {['totalCustomers', 'paidCustomers', 'paymentVerificationPending', 'overduePayments', 'paymentsDueToday', 'paymentsDueWithin3Days', 'paymentsDueWithin7Days', 'earlyPayments', 'rejectedPayments', 'totalAmountReceived', 'totalAmountPending', 'totalOverdueAmount'].map((key) => <div key={key} className="rounded-xl border border-border bg-card p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</div><div className="mt-2 text-2xl font-semibold text-foreground">{metrics[key] ?? 0}</div></div>)}
      </div>
      <div className="flex gap-3"><Link className="text-sm text-primary hover:underline" href="/admin/activity">Activity logs</Link><Link className="text-sm text-primary hover:underline" href="/admin/payment-settings">Payment settings</Link></div>
    </div>
  );
}

function AdminLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"><h2 className="font-semibold text-foreground">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></Link>;
}