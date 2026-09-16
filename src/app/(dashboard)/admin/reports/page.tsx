"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@/components/tremor/bar-chart";
import { usePlatformOwnerGuard } from "@/hooks/use-platform-owner-guard";

interface AnalyticsResponse {
  revenueByMonth: { month: string; revenue: number }[];
  newCustomersByMonth: { month: string; customers: number }[];
  churnByMonth: { month: string; churned: number }[];
  planDistribution: { plan: string; count: number }[];
  mrr: number;
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminReportsPage() {
  usePlatformOwnerGuard();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports/analytics")
      .then((res) => res.json())
      .then((result) => setData(result))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, growth and churn trends for your customer base.
        </p>
      </div>

      {loading || !data ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading analytics...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Monthly Recurring Revenue
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                ₹{data.mrr.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                New Customers (6mo)
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data.newCustomersByMonth.reduce((sum, m) => sum + m.customers, 0)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Churned (6mo)
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data.churnByMonth.reduce((sum, m) => sum + m.churned, 0)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportCard title="Revenue (last 6 months)">
              <BarChart
                data={data.revenueByMonth}
                index="month"
                categories={["revenue"]}
                colors={["blue"]}
                valueFormatter={(v) => `₹${v.toLocaleString()}`}
              />
            </ReportCard>

            <ReportCard title="Customer growth (last 6 months)">
              <BarChart
                data={data.newCustomersByMonth}
                index="month"
                categories={["customers"]}
                colors={["emerald"]}
              />
            </ReportCard>

            <ReportCard title="Churn (last 6 months)">
              <BarChart
                data={data.churnByMonth}
                index="month"
                categories={["churned"]}
                colors={["amber"]}
              />
            </ReportCard>

            <ReportCard title="Active subscriptions by plan">
              {data.planDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active subscriptions yet.</p>
              ) : (
                <BarChart
                  data={data.planDistribution}
                  index="plan"
                  categories={["count"]}
                  colors={["violet"]}
                />
              )}
            </ReportCard>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Export raw data</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="text-primary hover:underline" href="/api/admin/reports?type=customers">
                Customers CSV
              </a>
              <a className="text-primary hover:underline" href="/api/admin/reports?type=payments">
                Payments CSV
              </a>
              <a className="text-primary hover:underline" href="/api/admin/reports?type=subscriptions">
                Subscriptions CSV
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
