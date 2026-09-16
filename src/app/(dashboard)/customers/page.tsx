'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

function getTemporaryPasswordExpiry() {
  return Date.now() + 10 * 60 * 1000;
}

type Customer = {
  user_id: string;
  customer_code: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  company_name: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  account_status: string;
  account_role: string;
  must_change_password: boolean;
};
const methods = [
  'UPI',
  'Bank Transfer',
  'Cash',
  'Credit Card',
  'Debit Card',
  'Razorpay',
  'Stripe',
  'Other',
];
const plans = [
  { name: 'Free', label: 'Unlimited chats - ₹0' },
  { name: 'Basic', label: '1,000 chats - ₹150/month' },
  { name: 'Professional', label: '5,000 chats - ₹350/month' },
  { name: 'Unlimited', label: 'Unlimited chats - ₹500/month' },
];

export default function CustomersPage() {
  const { isOwner } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'viewer',
    phone: '',
    businessName: '',
    businessType: '',
    gstNumber: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    defaultPassword: '',
    planName: '',
    amount: '',
    paymentMethod: '',
    paymentDetails: '',
    receivedAmount: '',
    receivedDate: '',
    autoRenew: false,
  });
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, { password: string; expiresAt: number }>>({});
  const [now, setNow] = useState(() => Date.now());
  const set = (key: string, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function load() {
    const response = await fetch('/api/admin/customers');
    const result = await response.json();
    if (response.ok) {
      setCustomers(result.customers ?? []);
      for (const customer of result.customers ?? []) if (!customer.must_change_password) localStorage.removeItem(`wacrm-temporary-password:${customer.user_id}`);
    }
    else setError(result.error ?? 'Unable to load customers');
  }
  useEffect(() => {
    // The fetch updates local state when the external request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    const saved: Record<string, { password: string; expiresAt: number }> = {};
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('wacrm-temporary-password:')) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null') as { password?: string; expiresAt?: number } | null;
        const userId = key.replace('wacrm-temporary-password:', '');
        if (value?.password && value.expiresAt && value.expiresAt > Date.now()) saved[userId] = { password: value.password, expiresAt: value.expiresAt };
        else localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
    // Restore persisted temporary passwords before starting the expiry timer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemporaryPasswords(saved);
    const timer = window.setInterval(() => {
      setTemporaryPasswords((current) => {
        const next = { ...current };
        for (const [userId, value] of Object.entries(next)) if (value.expiresAt <= Date.now()) { delete next[userId]; localStorage.removeItem(`wacrm-temporary-password:${userId}`); }
        return next;
      });
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setTemporaryPassword(null);
    const response = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        temporaryPassword: form.defaultPassword || undefined,
        amount: form.amount ? Number(form.amount) : 0,
        paymentDetails: form.paymentDetails
          ? { value: form.paymentDetails }
          : {},
        receivedAmount: form.receivedAmount ? Number(form.receivedAmount) : 0,
        receivedDate: form.receivedDate || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? 'Unable to create customer');
      return;
    }
    setTemporaryPassword(result.temporaryPassword);
    if (typeof result.temporaryPassword === 'string' && typeof result.customer?.id === 'string') {
      const expiresAt = Date.now() + 10 * 60 * 1000;
      localStorage.setItem(`wacrm-temporary-password:${result.customer.id}`, JSON.stringify({ password: result.temporaryPassword, expiresAt }));
      setTemporaryPasswords((current) => ({ ...current, [result.customer.id]: { password: result.temporaryPassword, expiresAt } }));
    }
    setForm({
      fullName: '',
      email: '',
      role: 'viewer',
      phone: '',
      businessName: '',
      businessType: '',
      gstNumber: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      defaultPassword: '',
      planName: '',
      amount: '',
      paymentMethod: '',
      paymentDetails: '',
      receivedAmount: '',
      receivedDate: '',
      autoRenew: false,
    });
    setShowCreateForm(false);
    void load();
  }
  async function action(userId: string, method: string, body: object) {
    setError(null);
    setMessage(null);
    const response = await fetch(
      body && 'customer_code' in body
        ? `/api/admin/customers/${userId}`
        : '/api/admin/customers',
      {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...body }),
      },
    );
      const responseText = await response.text();
      let result: { error?: string; temporaryPassword?: string } = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = { error: responseText || `Request failed with status ${response.status}` };
      }
    if (!response.ok) setError(result.error ?? 'Action failed');
    else {
      if (typeof result.temporaryPassword === 'string') {
        if (!(body && 'action' in body && body.action === 'resetPassword')) setTemporaryPassword(result.temporaryPassword);
        const expiresAt = getTemporaryPasswordExpiry();
        localStorage.setItem(`wacrm-temporary-password:${userId}`, JSON.stringify({ password: result.temporaryPassword, expiresAt }));
        setTemporaryPasswords((current) => ({ ...current, [userId]: { password: result.temporaryPassword!, expiresAt } }));
      }
      setMessage(
        body && 'action' in body && body.action === 'resetPassword'
          ? 'Password reset successfully. Share the temporary password with the customer.'
          : method === 'DELETE'
            ? 'Customer deleted successfully.'
            : 'Customer status updated successfully.'
      );
      void load();
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create customers, collect payment, and manage account access.
        </p>
      </div>
      {isOwner && <Button type="button" onClick={() => setShowCreateForm((open) => !open)}>
        {showCreateForm ? 'Close form' : 'Create customer'}
      </Button>}
      {isOwner && showCreateForm && <form
        onSubmit={createCustomer}
        className="border-border bg-card grid gap-3 rounded-xl border p-5 md:grid-cols-2"
      >
        <Input
          required
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => set('fullName', e.target.value)}
        />
        <Input
          required
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <select
          required
          value={form.role}
          onChange={(e) => set('role', e.target.value)}
          className="border-border bg-background text-foreground h-10 rounded-md border px-3 text-sm"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="viewer">User</option>
        </select>
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <Input
          placeholder="Company name"
          value={form.businessName}
          onChange={(e) => set('businessName', e.target.value)}
        />
        <Input
          placeholder="Business type"
          value={form.businessType}
          onChange={(e) => set('businessType', e.target.value)}
        />
        <Input
          placeholder="GST number"
          value={form.gstNumber}
          onChange={(e) => set('gstNumber', e.target.value)}
        />
        <Input
          placeholder="Address"
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
        />
        <Input
          placeholder="City"
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
        />
        <Input
          placeholder="State"
          value={form.state}
          onChange={(e) => set('state', e.target.value)}
        />
        <Input
          type="text"
          inputMode="numeric"
          placeholder="Postal code"
          value={form.postalCode}
          onChange={(e) => set('postalCode', e.target.value)}
        />
        <select
          value={form.country}
          onChange={(e) => set('country', e.target.value)}
          className="border-border bg-background text-foreground h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Select country</option>
          <option>India</option><option>United States</option><option>United Kingdom</option><option>Australia</option><option>Canada</option><option>Singapore</option><option>United Arab Emirates</option>
        </select>
        <Input
          type="password"
          minLength={8}
          placeholder="Default password"
          value={form.defaultPassword}
          onChange={(e) => set('defaultPassword', e.target.value)}
        />
        <select
          required
          value={form.planName}
          onChange={(e) => {
            const plan = plans.find((item) => item.name === e.target.value);
            set('planName', e.target.value);
            set(
              'amount',
              plan?.name === 'Free'
                ? '0'
                : plan?.name === 'Basic'
                  ? '150'
                  : plan?.name === 'Professional'
                    ? '350'
                    : '500'
            );
          }}
          className="border-border bg-background text-foreground h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Select plan</option>
          {plans.map((plan) => (
            <option key={plan.name} value={plan.name}>
              {plan.name} - {plan.label}
            </option>
          ))}
        </select>
        <Input readOnly placeholder="Plan price (INR)" value={form.amount} />
        <select
          value={form.paymentMethod}
          onChange={(e) => set('paymentMethod', e.target.value)}
          className="border-border bg-background text-foreground h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Payment method</option>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        {form.paymentMethod && (
          <Input
            placeholder={
              form.paymentMethod === 'UPI'
                ? 'UPI ID'
                : form.paymentMethod === 'Credit Card' ||
                    form.paymentMethod === 'Debit Card'
                  ? 'Card brand and last 4 digits only'
                  : form.paymentMethod === 'Bank Transfer'
                    ? 'UTR / transfer reference'
                    : 'Payment details'
            }
            value={form.paymentDetails}
            onChange={(e) => set('paymentDetails', e.target.value)}
          />
        )}
        {form.planName && (
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount received now"
            value={form.receivedAmount}
            onChange={(e) => set('receivedAmount', e.target.value)}
          />
        )}
        {form.receivedAmount && (
          <Input
            type="date"
            value={form.receivedDate}
            onChange={(e) => set('receivedDate', e.target.value)}
          />
        )}
        {form.planName && (
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoRenew}
              onChange={(e) => set('autoRenew', e.target.checked)}
            />{' '}
            Auto-renew
          </label>
        )}
        <Button type="submit">Create customer</Button>
      </form>}
      {temporaryPassword && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Temporary password (showing once):{' '}
          <strong>{temporaryPassword}</strong>
        </p>
      )}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-border bg-muted/40 text-muted-foreground border-b">
            <tr>
              <th className="p-3">Customer ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Company name</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Address</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.user_id}
                className="border-border border-b last:border-0"
              >
                <td className="p-3">
                  <span className="text-foreground font-medium">{customer.customer_code ?? 'Generating...'}</span>
                </td>
                <td className="p-3">
                  <div className="text-foreground font-medium">
                    {customer.full_name || 'Unnamed customer'}
                  </div>
                  <div className="text-muted-foreground">{customer.email}</div>
                </td>
                <td className="text-muted-foreground p-3">
                  {customer.company_name || customer.business_name || '-'}
                  <div className="text-xs">
                    GST: {customer.gst_number || '-'}
                  </div>
                </td>
                <td className="text-muted-foreground p-3">
                  {customer.phone || '-'}
                </td>
                <td className="text-muted-foreground p-3">
                  {[
                    customer.address,
                    customer.city,
                    customer.state,
                    customer.postal_code,
                    customer.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
                <td className="text-muted-foreground p-3">
                  {customer.account_status}
                  {customer.must_change_password
                    ? ' · password change required'
                    : ''}
                </td>
                <td className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/customers/${customer.user_id}`} />}
                    nativeButton={false}
                  >
                    Billing details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/customers/${customer.user_id}`} />}
                    nativeButton={false}
                  >
                    Edit customer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void action(customer.user_id, 'PATCH', {
                        accountStatus:
                          customer.account_status === 'active'
                            ? 'suspended'
                            : 'active',
                      })
                    }
                  >
                    {customer.account_status === 'active'
                      ? 'Suspend'
                      : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void action(customer.user_id, 'PATCH', {
                        action: 'resetPassword',
                      })
                    }
                  >
                    Reset password
                  </Button>
                  {temporaryPasswords[customer.user_id] && (
                    <div className="mt-2 max-w-xs rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                      <div>Temporary password:</div>
                      <strong className="break-all text-sm text-black">{temporaryPasswords[customer.user_id].password}</strong>
                      <div className="mt-1 text-black">Expires in {Math.max(0, Math.ceil((temporaryPasswords[customer.user_id].expiresAt - now) / 1000))} seconds</div>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm('Delete this customer permanently?'))
                        void action(customer.user_id, 'DELETE', {});
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
