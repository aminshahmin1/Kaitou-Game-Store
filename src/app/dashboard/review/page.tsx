import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata = {
  title: "Failed Review | Kaitou Admin",
};

const failedQueue: {
  orderId: string;
  product: string;
  reason: string;
  next: string;
}[] = [];

export default async function DashboardReviewPage() {
  return (
    <AdminDashboardShell title="Failed order review" eyebrow="Support">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold">Failed order review</h2>
            <p className="text-sm text-slate-500">SOP: retry, contact customer, manual fulfill, mark refund, record refund.</p>
          </div>
          <span className="w-fit rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {failedQueue.length} needs review
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Next action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-5 py-8 text-center text-slate-500" colSpan={4}>
                  No failed orders are waiting for review.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AdminDashboardShell>
  );
}
