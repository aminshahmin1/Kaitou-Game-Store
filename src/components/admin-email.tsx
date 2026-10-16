"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function AdminEmail() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function testEmail() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/email", { method: "POST" });
      const body = await response.json();
      setMessage(response.ok ? body.message : body.error ?? "Email could not be sent.");
    } catch {
      setMessage("Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="border-b border-slate-200 py-6">
    <h2 className="text-xl font-bold">Email</h2>
    <button type="button" disabled={busy} onClick={testEmail} className="mt-3 inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
      <Mail size={16} aria-hidden="true" />{busy ? "Sending..." : "Send test email"}
    </button>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
