"use client";

import { useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";

export function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Invalid admin email or password.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form action={onSubmit} className="grid gap-4 rounded-lg border border-sky-100 bg-white p-6 shadow-xl shadow-sky-950/10">
      <div>
        <p className="text-sm font-bold uppercase text-sky-600">Admin access</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">Kaitou Dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in to manage orders, products, support reviews, and integration settings.
        </p>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Admin email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-sky-100 px-3 py-3 outline-none ring-sky-300 focus:ring-4"
        />
      </label>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        Enter dashboard
      </button>
    </form>
  );
}
