'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function BillingPanel() {
  const t = useTranslations('Settings.billing');

  return (
    <section className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage subscription, payment status, and billing history here.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('planName')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              View your subscription, payment instructions, and payment history.
            </p>
          </div>
          <CreditCard className="size-5 text-primary" />
        </div>
        <Button nativeButton={false} className="mt-5" render={<Link href="/billing" />}>View billing details</Button>
      </div>
    </section>
  );
}