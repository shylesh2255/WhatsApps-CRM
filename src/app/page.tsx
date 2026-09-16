import Link from 'next/link';

export const metadata = {
  title: 'WACRM Service Center Management',
  description: 'Manage service tasks, branches, customer updates, payments, and WhatsApp notifications in one workspace.',
  robots: { index: true, follow: true },
};

export default function RootPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">WACRM Service Center</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Run every service request from one clear workspace.</h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg">Manage customers, branches, task progress, payments, WhatsApp updates, and feedback without losing the thread.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="bg-primary text-primary-foreground rounded-md px-5 py-3 text-sm font-semibold">Sign in</Link><Link href="/login" className="border-border text-foreground rounded-md border px-5 py-3 text-sm font-semibold">Customer portal</Link></div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{['Branches', 'Customers', 'Tasks', 'WhatsApp updates'].map((item) => <div key={item} className="border-border bg-card rounded-xl border p-5"><h2 className="font-semibold">{item}</h2><p className="text-muted-foreground mt-2 text-sm">Connected to your company workspace.</p></div>)}</div>
      </div>
    </main>
  );
}
