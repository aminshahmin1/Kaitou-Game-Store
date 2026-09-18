import { BarChart3, CircleDollarSign, Layers3 } from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Revenue | Kaitou Admin",
};

const revenueSections = [
  {
    title: "Funding ledger",
    copy: "Record each FazerCards balance top-up with MYR spent, USDT/USD credited, fees, and effective rate.",
    icon: Layers3,
  },
  {
    title: "FIFO order costing",
    copy: "Completed orders will consume the oldest available funding batch first and snapshot the real MYR cost.",
    icon: CircleDollarSign,
  },
  {
    title: "Profit reports",
    copy: "View daily, weekly, monthly, and custom range revenue, cost, fees, gross profit, and net profit.",
    icon: BarChart3,
  },
];

export default async function DashboardRevenuePage() {
  return (
    <AdminDashboardShell title="Revenue" eyebrow="Profit center">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-3xl font-bold">Revenue workspace</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          This section will contain the semi-automatic FIFO model: you enter top-ups manually,
          and the system calculates order cost and profit automatically after fulfillment.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {revenueSections.map((section) => (
          <div key={section.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <section.icon className="mb-5 h-6 w-6 text-sky-600" />
            <h3 className="font-display text-2xl font-bold">{section.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{section.copy}</p>
          </div>
        ))}
      </section>
    </AdminDashboardShell>
  );
}
