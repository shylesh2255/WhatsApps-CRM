'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
};

const emptyForm = { name: '', code: '', address: '', phone: '', email: '' };

export default function BranchesPage() {
  const { accountRole } = useAuth();
  const canManageBranches = accountRole === 'owner' || accountRole === 'admin';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/branches');
    const result = await response.json();
    if (response.ok) setBranches(result.branches ?? []);
    else setError(result.error ?? 'Unable to load branches');
  }

  useEffect(() => {
    // The fetch updates local state when the external request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function createBranch(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/admin/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? 'Unable to create branch');
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    setMessage('Branch created successfully.');
    void load();
  }

  async function toggleBranch(branch: Branch) {
    setError('');
    const response = await fetch('/api/admin/branches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: branch.id, active: !branch.active }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? 'Unable to update branch');
    else void load();
  }

  async function saveBranch(event: React.FormEvent) {
    event.preventDefault();
    if (!editingBranchId) return;
    const response = await fetch('/api/admin/branches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingBranchId, ...editForm }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? 'Unable to edit branch');
    else {
      setEditingBranchId(null);
      setMessage('Branch updated successfully.');
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Branches</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage company locations, branch codes, and operational access.
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((current) => !current)}>
          {showForm ? 'Close form' : 'Add branch'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {showForm && (
        <form onSubmit={createBranch} className="border-border bg-card grid gap-3 rounded-xl border p-5 md:grid-cols-2">
          <Input required placeholder="Branch name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input required placeholder="Branch code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <Input placeholder="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Input type="tel" inputMode="numeric" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Input type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Button type="submit">Create branch</Button>
        </form>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((branch) => (
          <article key={branch.id} className="border-border bg-card rounded-xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-foreground font-semibold">{branch.name}</h2>
                <p className="text-muted-foreground mt-1 text-xs tracking-widest uppercase">{branch.code}</p>
              </div>
              <span className={branch.active ? 'text-emerald-600 text-xs font-medium' : 'text-muted-foreground text-xs font-medium'}>
                {branch.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <dl className="text-muted-foreground mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt>Address</dt><dd className="text-foreground text-right">{branch.address ?? '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt>Phone</dt><dd className="text-foreground text-right">{branch.phone ?? '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt>Created</dt><dd className="text-foreground text-right">{new Date(branch.created_at).toLocaleDateString()}</dd></div>
            </dl>
            {canManageBranches && <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => void toggleBranch(branch)}>
              {branch.active ? 'Deactivate branch' : 'Activate branch'}
            </Button>}
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => { setEditingBranchId(branch.id); setEditForm({ name: branch.name, code: branch.code, address: branch.address ?? '', phone: branch.phone ?? '', email: branch.email ?? '' }); }}>
              Edit branch details
            </Button>
            {editingBranchId === branch.id && <form onSubmit={saveBranch} className="mt-4 space-y-2 border-t border-border pt-4"><Input required placeholder="Branch name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /><Input required placeholder="Branch code" value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: event.target.value })} /><Input placeholder="Address" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} /><Input type="tel" inputMode="numeric" placeholder="Phone" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /><Input type="email" placeholder="Email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /><div className="flex gap-2"><Button type="submit" size="sm">Save changes</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditingBranchId(null)}>Cancel</Button></div></form>}
          </article>
        ))}
      </div>
      {!branches.length && <div className="border-border bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">No branches yet. Create the company&apos;s first branch to begin.</div>}
    </div>
  );
}