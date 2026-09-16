export default function SubscriptionExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Subscription access is restricted</h1>
        <p className="mt-3 text-muted-foreground">Your subscription has expired, your payment is pending, or your account has been suspended. Contact your administrator to restore access.</p>
      </section>
    </main>
  );
}