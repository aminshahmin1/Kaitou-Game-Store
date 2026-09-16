import Link from "next/link";

export default async function PaymentUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  return (
    <main className="trust-surface grid min-h-screen place-items-center px-5">
      <section className="max-w-lg rounded-lg border border-sky-100 bg-white p-6 text-center shadow-xl shadow-sky-950/10">
        <p className="text-sm font-bold uppercase text-sky-600">Payment setup required</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">
          Online payment is not active yet
        </h1>
        <p className="mt-4 text-slate-600">
          Order {orderId ?? "KGS"} was not charged. Please contact Kaitou support or try again later.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-slate-950 px-5 py-3 font-bold text-white"
        >
          Back to store
        </Link>
      </section>
    </main>
  );
}
