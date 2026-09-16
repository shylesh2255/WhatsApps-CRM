'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MySupportTickets } from '@/components/support/my-support-tickets';

function getCurrentTime() {
  return Date.now();
}

type Subscription = {
  plan_name: string;
  amount: number;
  currency?: string;
  start_date: string;
  expiry_date: string | null;
  payment_status: string;
  status: string;
  chat_limit?: number | null;
  autopay_enabled?: boolean;
  autopay_status?: string | null;
} | null;
type Usage = { period_start: string | null; period_end: string | null; whatsapp_messages_count: number };
type Payment = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_id: string | null;
  payment_date: string | null;
  status: string;
  rejection_reason?: string | null;
};
type Settings = {
  payment_upi_id?: string | null;
  payment_bank_name?: string | null;
  payment_account_name?: string | null;
  payment_account_number?: string | null;
  payment_ifsc?: string | null;
  payment_mobile_number?: string | null;
};
type Plan = { id: string; name: string; monthly_price: number; currency: string; chat_limit: number | null };
type RazorpayCheckout = new (options: {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  recurring?: boolean;
  handler: (response: {
    razorpay_order_id?: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    razorpay_subscription_id?: string;
  }) => void;
}) => { open: () => void };

declare global {
  interface Window { Razorpay?: RazorpayCheckout; }
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage>({ period_start: null, period_end: null, whatsapp_messages_count: 0 });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [form, setForm] = useState({
    method: 'UPI',
    transactionId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/customer/billing');
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? 'Unable to load billing');
      return;
    }
    setSubscription(result.subscription);
    setPayments(result.payments ?? []);
    setSettings(result.settings ?? {});
    setUsage(result.usage ?? { period_start: null, period_end: null, whatsapp_messages_count: 0 });
  }
  async function loadPlans() {
    const response = await fetch('/api/billing/plans');
    const result = await response.json();
    if (response.ok) {
      const clientPlans = (result.plans ?? []).filter((plan: Plan) => Number(plan.monthly_price) > 0);
      setPlans(clientPlans);
      setSelectedPlan((current) => current || clientPlans[0]?.id || '');
    }
  }
  useEffect(() => {
    // These fetches update local state when the external requests complete.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlans();
  }, []);

  async function startRazorpayPayment() {
    setError('');
    setMessage('');
    if (!selectedPlan) return setError('Select a plan first');
    if (!window.Razorpay) return setError('Payment checkout is still loading. Try again in a moment.');
    const response = await fetch('/api/customer/billing/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: selectedPlan }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? 'Unable to start payment');
    if (result.free) {
      setMessage('Free plan activated.');
      await load();
      return;
    }
    const checkout = new window.Razorpay({
      key: result.keyId,
      amount: result.order.amount,
      currency: result.order.currency,
      name: 'WACRM',
      description: `${result.plan.name} subscription`,
      order_id: result.order.id,
      handler: async (payment) => {
        const verify = await fetch('/api/customer/billing/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature }) });
        if (!verify.ok) return setError('Payment was received but could not be verified yet. Please contact support.');
        setMessage('Payment verified. Your subscription is active.');
        await load();
      },
    });
    checkout.open();
  }

  async function startAutopay() {
    setError('');
    setMessage('');
    if (!selectedPlan) return setError('Select a plan first');
    if (!window.Razorpay) return setError('Payment checkout is still loading. Try again in a moment.');
    const response = await fetch('/api/customer/billing/autopay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: selectedPlan }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? 'Unable to start autopay');
    const plan = plans.find((p) => p.id === selectedPlan);
    const checkout = new window.Razorpay({
      key: result.keyId,
      name: 'WACRM',
      description: `${result.plan.name} subscription (autopay)`,
      subscription_id: result.subscriptionId,
      recurring: true,
      handler: async (payment) => {
        const verify = await fetch('/api/customer/billing/verify-autopay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: payment.razorpay_subscription_id,
            paymentId: payment.razorpay_payment_id,
            signature: payment.razorpay_signature,
            amount: result.plan.amount,
            currency: plan?.currency ?? 'INR',
          }),
        });
        if (!verify.ok) return setError('Payment was received but could not be verified yet. Please contact support.');
        setMessage('Autopay enabled. Your subscription will renew automatically.');
        await load();
      },
    });
    checkout.open();
  }

  const amount = Number(subscription?.amount ?? 0);
  const pending = payments.some((payment) => payment.status === 'pending');
  const canSubmit =
    amount > 0 && !pending && subscription?.payment_status !== 'paid';
  const daysRemaining = subscription?.expiry_date
    ? Math.ceil(
        (new Date(subscription.expiry_date).getTime() - getCurrentTime()) /
        86400000
      )
    : null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/customer/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? 'Unable to submit payment');
      return;
    }
    setMessage('Payment Verification Pending');
    await load();
  }

  return (
    <div className="space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div>
        <h1 className="text-foreground text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          View your subscription and submit payment for admin approval.
        </p>
      </div>
      <section className="border-border bg-card rounded-xl border p-5">
        <h2 className="text-foreground font-semibold">Current usage</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p><strong>Plan:</strong> {subscription?.plan_name ?? 'Free'}</p>
          <p><strong>Chats:</strong> {subscription?.chat_limit == null ? 'Unlimited chats' : `${usage.whatsapp_messages_count} / ${subscription.chat_limit}`}</p>
          <p><strong>Remaining:</strong> {subscription?.chat_limit == null ? 'Unlimited' : Math.max(0, subscription.chat_limit - usage.whatsapp_messages_count)}</p>
          <p><strong>Cycle:</strong> {usage.period_start ?? 'No expiry'}{usage.period_end ? ` to ${usage.period_end}` : ''}</p>
          <p><strong>Status:</strong> {subscription?.status ?? 'active'}</p>
          <p>
            <strong>Autopay:</strong>{' '}
            {subscription?.autopay_enabled
              ? `On (${subscription.autopay_status ?? 'active'})`
              : 'Off — renews manually'}
          </p>
        </div>
        {subscription?.chat_limit != null && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Chat usage</span><span>{Math.min(100, Math.round((usage.whatsapp_messages_count / subscription.chat_limit) * 100))}%</span></div><div className="bg-muted h-2 overflow-hidden rounded-full"><div className="bg-primary h-full" style={{ width: `${Math.min(100, (usage.whatsapp_messages_count / subscription.chat_limit) * 100)}%` }} /></div></div>}
      </section>
      <section className="border-border bg-card rounded-xl border p-5">
        <h2 className="text-foreground font-semibold">
          Company payment details
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Pay using your preferred method, then enter the transfer ID below.
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <strong>UPI:</strong> {settings.payment_upi_id ?? 'Not configured'}
          </p>
          <p>
            <strong>Bank:</strong> {settings.payment_bank_name ?? '-'} ·{' '}
            {settings.payment_account_name ?? '-'} ·{' '}
            {settings.payment_account_number ?? '-'} ·{' '}
            {settings.payment_ifsc ?? '-'}
          </p>
          <p>
            <strong>Payment number:</strong>{' '}
            {settings.payment_mobile_number ?? 'Not configured'}
          </p>
        </div>
      </section>
      {subscription?.chat_limit != null && usage.whatsapp_messages_count >= subscription.chat_limit * 0.8 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {usage.whatsapp_messages_count >= subscription.chat_limit
            ? 'You have reached your chat limit for this billing cycle. Please upgrade your plan or wait until your next billing cycle.'
            : `You have used ${usage.whatsapp_messages_count >= subscription.chat_limit * 0.9 ? '90%' : '80%'} of your monthly chat limit.`}
          {usage.whatsapp_messages_count >= subscription.chat_limit && <Button type="button" className="ml-3" onClick={() => document.getElementById('plan-options')?.scrollIntoView({ behavior: 'smooth' })}>Upgrade Plan</Button>}
        </section>
      )}
      {plans.length > 0 && <section id="plan-options" className="border-border bg-card max-w-3xl rounded-xl border p-5">
        <h2 className="text-foreground font-semibold">Choose a subscription plan</h2>
        <p className="text-muted-foreground mt-1 text-sm">Plans are billed monthly in INR. Access changes after payment verification.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-lg border p-4 text-left ${selectedPlan === plan.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
              <span className="text-foreground block font-semibold">{plan.name}</span>
              <span className="text-muted-foreground mt-1 block text-sm">₹{Number(plan.monthly_price).toLocaleString('en-IN')} / month</span>
              <span className="text-muted-foreground mt-2 block text-xs">{plan.chat_limit ? `${plan.chat_limit.toLocaleString('en-IN')} chats` : 'Unlimited chats'}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={() => void startRazorpayPayment()}>Pay once with Razorpay</Button>
          <Button type="button" variant="outline" onClick={() => void startAutopay()}>Enable Autopay (auto-renew)</Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Autopay authorizes a recurring mandate (UPI Autopay / card) so your subscription renews automatically each month without you having to pay manually.
        </p>
      </section>
      }
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Package', subscription?.plan_name ?? 'No package'],
          ['Price', amount ? `₹${amount.toLocaleString('en-IN')}` : '₹0'],
          [
            'Status',
            pending
              ? 'Verification pending'
              : (subscription?.payment_status ?? '-'),
          ],
          [
            'Next payment',
            subscription
              ? subscription.expiry_date
                ? new Date(subscription.expiry_date).toLocaleDateString()
                : 'No expiry'
              : '-',
          ],
          [
            'Start date',
            subscription
              ? new Date(subscription.start_date).toLocaleDateString()
              : '-',
          ],
          [
            'Days remaining',
            daysRemaining === null
              ? '-'
              : daysRemaining >= 0
                ? `${daysRemaining} days`
                : `${Math.abs(daysRemaining)} overdue`,
          ],
          [
            'Usage',
            subscription?.chat_limit
              ? `${subscription.chat_limit} chats`
              : 'Included',
          ],
          [
            'Remaining usage',
            subscription?.chat_limit
              ? `${subscription.chat_limit} chats`
              : 'Unlimited',
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-border bg-card rounded-xl border p-4"
          >
            <div className="text-muted-foreground text-xs uppercase">
              {label}
            </div>
            <div className="text-foreground mt-2 font-semibold">{value}</div>
          </div>
        ))}
      </div>
      {canSubmit ? (
        <section className="border-border bg-card max-w-xl rounded-xl border p-5">
          <h2 className="text-foreground font-semibold">Submit payment</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Amount due:{' '}
            <strong className="text-foreground">
              ₹{amount.toLocaleString('en-IN')}
            </strong>
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <select
              className="border-input bg-background text-foreground h-10 w-full rounded-md border px-3 text-sm"
              value={form.method}
              onChange={(event) =>
                setForm({ ...form, method: event.target.value })
              }
            >
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Company Payment Number</option>
            </select>
            <Input
              required
              readOnly
              value={`₹${amount.toLocaleString('en-IN')}`}
            />
            <Input
              required
              placeholder="Transfer ID / UTR number"
              value={form.transactionId}
              onChange={(event) =>
                setForm({ ...form, transactionId: event.target.value })
              }
            />
            <Input
              required
              type="date"
              value={form.paymentDate}
              onChange={(event) =>
                setForm({ ...form, paymentDate: event.target.value })
              }
            />
            <Button type="submit">Submit Payment</Button>
          </form>
        </section>
      ) : (
        <section className="border-border bg-card max-w-xl rounded-xl border p-5">
          <h2 className="text-foreground font-semibold">Payment status</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {amount === 0
              ? 'This is a free plan. No payment is required.'
              : pending
                ? 'Your payment is waiting for admin approval.'
                : 'Your current subscription is paid.'}
          </p>
        </section>
      )}
      <section className="border-border overflow-x-auto rounded-xl border">
        <div className="border-border bg-card border-b p-5">
          <h2 className="text-foreground font-semibold">Payment history</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Amount</th>
              <th className="p-3">How paid</th>
              <th className="p-3">Transfer ID</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-border border-t">
                <td className="p-3">
                  {payment.payment_date
                    ? new Date(payment.payment_date).toLocaleDateString()
                    : '-'}
                </td>
                <td className="p-3">
                  ₹{payment.amount.toLocaleString('en-IN')}
                </td>
                <td className="p-3">{payment.payment_method ?? '-'}</td>
                <td className="p-3">{payment.payment_id ?? '-'}</td>
                <td className="p-3">
                  {payment.status}
                  {payment.rejection_reason
                    ? `: ${payment.rejection_reason}`
                    : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="border-border bg-card max-w-xl rounded-xl border p-5">
        <h2 className="text-foreground font-semibold">Payment support</h2>
        <p className="text-muted-foreground mt-1 text-sm">Payment issue? Send a message to the support team from this page.</p>
        <form className="mt-4 space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const response = await fetch('/api/customer/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: form.get('message') }) });
          const result = await response.json();
          if (!response.ok) return setError(result.error ?? 'Unable to contact support');
          setMessage(`Support request sent (${result.requestId})`);
          formElement.reset();
        }}>
          <textarea name="message" required rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" placeholder="Describe your payment issue" />
          <Button type="submit">Contact support</Button>
        </form>
        <MySupportTickets />
      </section>
    </div>
  );
}
