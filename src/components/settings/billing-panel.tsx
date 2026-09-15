'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface Subscription {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function BillingPanel() {
  const t = useTranslations('Settings.billing');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/billing/status')
      .then((response) => response.json())
      .then((data) => {
        if (active) setSubscription(data.subscription ?? null);
      })
      .catch(() => {
        if (active) toast.error(t('loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const startCheckout = async () => {
    setStartingCheckout(true);
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t('checkoutFailed'));
      if (data.url) window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('checkoutFailed'));
      setStartingCheckout(false);
    }
  };

  const active = subscription?.status === 'active' || subscription?.status === 'trialing';
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString()
    : null;

  return (
    <section className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('planName')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? t('loading') : active ? t('active') : t('notActive')}
            </p>
          </div>
          <CreditCard className="size-5 text-primary" />
        </div>

        {active ? (
          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 text-foreground">
              <Check className="size-4 text-primary" />
              {t('subscriptionActive')}
            </p>
            {renewalDate && <p>{t('renewsOn', { date: renewalDate })}</p>}
            {subscription?.cancel_at_period_end && <p>{t('cancelsAtPeriodEnd')}</p>}
          </div>
        ) : (
          <Button className="mt-5" onClick={startCheckout} disabled={startingCheckout}>
            {startingCheckout && <Loader2 className="size-4 animate-spin" />}
            {t('subscribe')}
          </Button>
        )}
      </div>
    </section>
  );
}