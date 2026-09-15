'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

 type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  business_name: string | null;
  company_name: string | null;
  customer_code: string | null;
  account_role: string;
  account_status: string;
  must_change_password: boolean;
  created_at: string | null;
  last_login_at: string | null;
  provider: string | null;
};

function statusStyles(status: string) {
  switch (status) {
    case 'suspended':
      return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200';
    case 'inactive':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200';
    case 'active':
    default:
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  const filteredUsers = users.filter((user) => {
    if (statusFilter === 'all') return true;
    return user.account_status === statusFilter;
  });

  async function loadUsers() {
    const response = await fetch('/api/admin/users');
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? 'Unable to load users');
      return;
    }
    setUsers(result.users ?? []);
    setError(null);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function toggleStatus(user: AdminUser) {
    const nextStatus = user.account_status === 'active' ? 'suspended' : 'active';
    setBusy(user.id);
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, action: 'setStatus', accountStatus: nextStatus }),
    });
    const result = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(result.error ?? 'Unable to update user status');
      return;
    }

    setError(null);
    await loadUsers();
  }

  async function resetPassword(userId: string) {
    setBusy(userId);
    setTemporaryPassword(null);
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'resetPassword' }),
    });
    const result = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(result.error ?? 'Unable to reset password');
      return;
    }

    setTemporaryPassword(result.temporaryPassword ?? null);
    setError(null);
    await loadUsers();
  }

  async function deleteUser(user: AdminUser) {
    const confirmed = window.confirm(`Delete ${user.full_name ?? user.email ?? 'this user'} permanently? Type DELETE in the next step is required.`);
    if (!confirmed) return;

    const confirmText = window.prompt('To confirm, type DELETE:');
    if (confirmText !== 'DELETE') {
      setError('Deletion was cancelled because the confirmation text did not match.');
      return;
    }

    setBusy(user.id);
    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, confirmText: 'DELETE' }),
    });
    const result = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(result.error ?? 'Unable to delete user');
      return;
    }

    setError(null);
    await loadUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">A safe list of account members and their profile metadata. Passwords are never displayed in plain text.</p>
      </div>

      {error && <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {temporaryPassword && (
        <div className="rounded border border-amber-500/60 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          Temporary password for the selected user: <strong className="break-all">{temporaryPassword}</strong>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="text-sm font-medium text-foreground">Filter</span>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'inactive', 'suspended'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={['rounded-md border px-3 py-1.5 text-sm capitalize transition-colors', statusFilter === option ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-muted'].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Customer code</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{statusFilter === 'all' ? 'No users were found for this account.' : `No ${statusFilter} users were found.`}</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className={['border-t border-border align-top transition-colors', user.account_status === 'suspended' ? 'bg-red-500/5' : user.account_status === 'inactive' ? 'bg-amber-500/5' : ''].join(' ')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{user.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{user.phone ?? 'No phone'}</div>
                  </td>
                  <td className="px-4 py-3 break-all">{user.email ?? '—'}</td>
                  <td className="px-4 py-3">{user.business_name ?? user.company_name ?? '—'}</td>
                  <td className="px-4 py-3">{user.customer_code ?? '—'}</td>
                  <td className="px-4 py-3 uppercase tracking-wide text-xs">{user.account_role}</td>
                  <td className="px-4 py-3">
                    <span className={['inline-flex rounded-full border px-2 py-1 text-xs font-medium capitalize', statusStyles(user.account_status)].join(' ')}>
                      {user.account_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{user.created_at ? new Date(user.created_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{user.provider ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={busy === user.id} onClick={() => void toggleStatus(user)}>
                        {busy === user.id ? 'Updating...' : user.account_status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy === user.id} onClick={() => void resetPassword(user.id)}>
                        {busy === user.id ? 'Resetting...' : 'Reset password'}
                      </Button>
                      <Button variant="destructive" size="sm" disabled={busy === user.id} onClick={() => void deleteUser(user)}>
                        {busy === user.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
