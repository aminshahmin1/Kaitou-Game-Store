"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, UserPlus } from "lucide-react";

import {
  permissionDetails,
  rolePresets,
  type DashboardPermission,
  type StaffRolePreset,
} from "@/lib/auth/permissions";
import type { StaffAccount } from "@/lib/staff";

type StaffDraft = {
  email: string;
  displayName: string;
  password: string;
  role: StaffRolePreset;
  permissions: DashboardPermission[];
  active: boolean;
};

const defaultDraft: StaffDraft = {
  email: "",
  displayName: "",
  password: "",
  role: "support",
  permissions: ["review"],
  active: true,
};

export function AdminStaffManager({ initialStaff }: { initialStaff: StaffAccount[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [newStaff, setNewStaff] = useState<StaffDraft>(defaultDraft);
  const [drafts, setDrafts] = useState<Record<string, StaffDraft>>(() => createDrafts(initialStaff));
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeCount = useMemo(() => staff.filter((account) => account.active).length, [staff]);

  async function loadStaff() {
    setIsLoading(true);
    setMessage(null);

    const { response, body } = await staffRequest("/api/admin/staff");
    setIsLoading(false);

    if (!response?.ok) {
      setMessage(body.error ?? "Staff accounts could not be loaded.");
      return false;
    }

    const loadedStaff = body.staff ?? [];
    setStaff(loadedStaff);
    setDrafts(createDrafts(loadedStaff));
    return true;
  }

  async function createStaff() {
    setIsCreating(true);
    setMessage(null);

    const { response, body } = await staffRequest("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStaff),
    });
    setIsCreating(false);

    if (!response?.ok) {
      setMessage(body.error ?? "Staff account could not be created.");
      return;
    }

    setNewStaff(defaultDraft);
    if (await loadStaff()) {
      setMessage("Staff account created. They can sign in at /dashboard with the credentials you set.");
    } else {
      setMessage("Staff account created, but the list could not be refreshed. Refresh to see the account.");
    }
  }

  async function saveStaff(account: StaffAccount) {
    const draft = drafts[account.id];

    if (!draft) {
      return;
    }

    setSavingId(account.id);
    setMessage(null);

    const { response, body } = await staffRequest(`/api/admin/staff/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSavingId(null);

    if (!response?.ok) {
      setMessage(body.error ?? "Staff account could not be updated.");
      return;
    }

    updateDraft(account.id, { password: "" });
    if (await loadStaff()) {
      setMessage(`${draft.email} updated.`);
    } else {
      setMessage("Staff account updated, but the list could not be refreshed. Refresh to see the changes.");
    }
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Staff accounts" value={staff.length.toString()} />
        <Stat label="Active staff" value={activeCount.toString()} />
        <Stat label="Permission groups" value={permissionDetails.length.toString()} />
      </section>

      {message ? (
        <div role="status" className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="font-display text-3xl font-bold">Create staff login</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Set the staff email, password, and the dashboard sections they are allowed to access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStaff()}
            disabled={isLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3">
            <Field label="Staff email" value={newStaff.email} onChange={(email) => setNewStaff((current) => ({ ...current, email }))} type="email" />
            <Field label="Display name" value={newStaff.displayName} onChange={(displayName) => setNewStaff((current) => ({ ...current, displayName }))} required={false} />
            <Field label="Password" value={newStaff.password} onChange={(password) => setNewStaff((current) => ({ ...current, password }))} type="password" />
            <RoleSelect value={newStaff.role} onChange={(role) => setNewStaff(applyRolePreset(newStaff, role))} />
          </div>
          <PermissionChecklist
            permissions={newStaff.permissions}
            onChange={(permissions) => setNewStaff((current) => ({ ...current, permissions, role: "custom" }))}
          />
        </div>

        <button
          type="button"
          onClick={() => void createStaff()}
          disabled={isCreating}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create staff account
        </button>
      </section>

      <section className="grid gap-4">
        {staff.length > 0 ? (
          staff.map((account) => {
            const draft = drafts[account.id] ?? draftFromAccount(account);

            return (
              <article key={account.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-slate-500">{account.active ? "Active" : "Disabled"}</p>
                    <h2 className="break-words font-display text-3xl font-bold">{account.email}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Last login: {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveStaff(account)}
                    disabled={savingId === account.id}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {savingId === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save account
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-3">
                    <Field label="Staff email" value={draft.email} onChange={(email) => updateDraft(account.id, { email })} type="email" />
                    <Field label="Display name" value={draft.displayName} onChange={(displayName) => updateDraft(account.id, { displayName })} required={false} />
                    <Field label="New password" value={draft.password} onChange={(password) => updateDraft(account.id, { password })} type="password" required={false} placeholder="Leave blank to keep current password" />
                    <RoleSelect value={draft.role} onChange={(role) => updateDraft(account.id, applyRolePreset(draft, role))} />
                    <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(event) => updateDraft(account.id, { active: event.target.checked })}
                        className="h-4 w-4"
                      />
                      Account active
                    </label>
                  </div>
                  <PermissionChecklist
                    permissions={draft.permissions}
                    onChange={(permissions) => updateDraft(account.id, { permissions, role: "custom" })}
                  />
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
            No staff accounts yet.
          </div>
        )}
      </section>
    </>
  );

  function updateDraft(accountId: string, patch: Partial<StaffDraft>) {
    setDrafts((current) => ({
      ...current,
      [accountId]: {
        ...current[accountId],
        ...patch,
      },
    }));
  }
}

async function staffRequest(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    const body = await response.json();
    return { response, body };
  } catch {
    return {
      response: null,
      body: { error: "Could not confirm the request. Check your connection and refresh the staff list before trying again." },
    };
  }
}

function PermissionChecklist({
  permissions,
  onChange,
}: {
  permissions: DashboardPermission[];
  onChange: (permissions: DashboardPermission[]) => void;
}) {
  function toggle(permission: DashboardPermission, checked: boolean) {
    const next = checked
      ? [...permissions, permission]
      : permissions.filter((current) => current !== permission);

    onChange(permissionDetails.map((item) => item.id).filter((item) => next.includes(item)));
  }

  return (
    <div className="grid gap-2 rounded-md bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-700">Dashboard permissions</p>
      {permissionDetails.map((permission) => (
        <label key={permission.id} className="flex gap-3 rounded-md bg-white p-3 text-sm">
          <input
            type="checkbox"
            checked={permissions.includes(permission.id)}
            onChange={(event) => toggle(permission.id, event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block font-bold text-slate-900">{permission.label}</span>
            <span className="mt-1 block leading-5 text-slate-500">{permission.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: StaffRolePreset;
  onChange: (role: StaffRolePreset) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      Role preset
      <select value={value} onChange={(event) => onChange(event.target.value as StaffRolePreset)} className="rounded-md border border-slate-200 px-3 py-3">
        {rolePresets.map((role) => (
          <option key={role.id} value={role.id}>
            {role.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-200 px-3 py-3"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl">{value}</strong>
    </div>
  );
}

function createDrafts(staff: StaffAccount[]) {
  return Object.fromEntries(staff.map((account) => [account.id, draftFromAccount(account)]));
}

function draftFromAccount(account: StaffAccount): StaffDraft {
  return {
    email: account.email,
    displayName: account.displayName ?? "",
    password: "",
    role: account.role,
    permissions: account.permissions,
    active: account.active,
  };
}

function applyRolePreset(draft: StaffDraft, role: StaffRolePreset): StaffDraft {
  const preset = rolePresets.find((item) => item.id === role);

  return {
    ...draft,
    role,
    permissions: preset?.permissions ?? draft.permissions,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}
