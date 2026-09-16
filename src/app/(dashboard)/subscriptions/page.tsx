'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

function getCurrentTime() {
  return Date.now();
}

type Subscription = {
  id: string;
  plan_name: string;
  start_date: string;
  expiry_date: string;
  amount: number;
  currency?: string;
  duration_days?: number;
  payment_status: string;
  status: string;
  chat_limit?: number | null;
  auto_renew?: boolean;
  profiles?: { full_name?: string; email?: string };
  latest_payment?: {
    id: string;
    status: string;
    payment_method?: string | null;
    payment_id?: string | null;
  } | null;
  usage?: { period_start: string; period_end: string | null; whatsapp_messages_count: number } | null;
};
export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [message, setMessage] = useState('');
  async function load() {
    const response = await fetch('/api/admin/subscriptions');
    const result = await response.json();
    if (response.ok) setSubscriptions(result.subscriptions ?? []);
    else setMessage(result.error ?? 'Unable to load subscriptions');
  }
  useEffect(() => {
    // The fetch updates local state when the external request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  async function recordPayment(subscription: Subscription) {
    const method = window.prompt('Payment method', 'Cash');
    if (!method) return;
    const reference =
      window.prompt('Cash receipt or transaction reference (optional)', '') ??
      '';
    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.id,
        amount: subscription.amount,
        paymentMethod: method,
        reference,
      }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? 'Unable to record payment');
    else {
      setMessage('Payment recorded as pending verification.');
      void load();
    }
  }
  async function reviewPayment(
    subscription: Subscription,
    action: 'approve' | 'reject'
  ) {
    const paymentId = subscription.latest_payment?.id;
    if (!paymentId) return;
    const rejectionReason =
      action === 'reject'
        ? (window.prompt('Reason for rejection', '') ?? '')
        : undefined;
    if (action === 'reject' && !rejectionReason.trim()) return;
    const response = await fetch('/api/admin/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, action, rejectionReason }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? `Unable to ${action} payment`);
    else {
      setMessage(
        action === 'approve'
          ? 'Payment approved and subscription extended.'
          : 'Payment rejected.'
      );
      void load();
    }
  }
  async function manageSubscription(subscription: Subscription, action: 'extend' | 'cancel' | 'reset_usage') {
    const response = await fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: subscription.id, action }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? `Unable to ${action} subscription`);
    else { setMessage(`Subscription ${action.replace('_', ' ')} complete.`); void load(); }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Customer plans, periods, renewal settings, and payment state.
        </p>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-border bg-muted/40 text-muted-foreground border-b">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Email</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Start date</th>
              <th className="p-3">Due date</th>
              <th className="p-3">Days left</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Subscription</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Usage</th>
              <th className="p-3">Billing cycle</th>
              <th className="p-3">Auto-renew</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => {
              const daysLeft = Math.ceil(
                (new Date(subscription.expiry_date).getTime() - getCurrentTime()) /
                  86400000
              );
              const pendingPayment =
                subscription.latest_payment?.status === 'pending';
              return (
                <tr
                  key={subscription.id}
                  className="border-border border-b last:border-0"
                >
                  <td className="text-foreground p-3">
                    {subscription.profiles?.full_name || 'Unnamed customer'}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.profiles?.email || '-'}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.plan_name}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {new Date(subscription.start_date).toLocaleDateString()}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {new Date(subscription.expiry_date).toLocaleDateString()}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {daysLeft >= 0 ? daysLeft : `${Math.abs(daysLeft)} overdue`}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.currency === 'INR'
                      ? '₹'
                      : (subscription.currency ?? '')}
                    {subscription.amount}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.status}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.payment_status}
                    {pendingPayment ? ' · verification pending' : ''}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.usage
                      ? subscription.chat_limit == null
                        ? 'Unlimited chats'
                        : `${subscription.usage.whatsapp_messages_count} / ${subscription.chat_limit}`
                      : subscription.chat_limit == null ? 'Unlimited chats' : '0 / ' + subscription.chat_limit}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.usage
                      ? `${subscription.usage.period_start} to ${subscription.usage.period_end ?? 'No expiry'}`
                      : '-'}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {subscription.auto_renew ? 'Yes' : 'No'}
                  </td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <Button variant="outline" size="sm" onClick={() => void manageSubscription(subscription, 'extend')}>Extend</Button>
                    <Button variant="outline" size="sm" onClick={() => void manageSubscription(subscription, 'reset_usage')}>Reset usage</Button>
                    {subscription.status !== 'cancelled' && <Button variant="outline" size="sm" onClick={() => void manageSubscription(subscription, 'cancel')}>Cancel</Button>}
                    {pendingPayment ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void reviewPayment(subscription, 'approve')
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void reviewPayment(subscription, 'reject')
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      subscription.payment_status !== 'paid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void recordPayment(subscription)}
                        >
                          Record cash payment
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
