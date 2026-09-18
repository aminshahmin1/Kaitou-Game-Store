import "server-only";

import { hashPassword, verifyPasswordHash } from "./auth/password";
import {
  dashboardPermissions,
  sanitizePermissions,
  type DashboardPermission,
  type StaffRolePreset,
} from "./auth/permissions";
import { createSupabaseAdminClient } from "./supabase/admin";

type StaffAccountRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: StaffRolePreset;
  password_hash?: string;
  permissions: string[] | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAccount = {
  id: string;
  email: string;
  displayName: string | null;
  role: StaffRolePreset;
  permissions: DashboardPermission[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffAccountInput = {
  email: string;
  displayName?: string;
  password?: string;
  role: StaffRolePreset;
  permissions: DashboardPermission[];
  active?: boolean;
};

export async function getStaffAccounts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id, email, display_name, role, permissions, active, last_login_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as StaffAccountRow[] | null ?? []).map(mapStaffAccount);
}

export async function createStaffAccount(input: StaffAccountInput) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const email = normalizeEmail(input.email);
  const permissions = sanitizePermissions(input.permissions);
  const role = normalizeRole(input.role);

  validateEmail(email);
  validatePassword(input.password);
  validatePermissions(permissions);

  const { data, error } = await supabase
    .from("staff_accounts")
    .insert({
      email,
      display_name: input.displayName?.trim() || null,
      role,
      password_hash: hashPassword(input.password ?? ""),
      permissions,
      active: input.active ?? true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A staff account already exists for this email.");
    }

    throw new Error(error.message);
  }

  return data.id as string;
}

export async function updateStaffAccount(staffId: string, input: Partial<StaffAccountInput>) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const update: Record<string, string | boolean | string[] | null> = {};

  if (typeof input.email === "string") {
    const email = normalizeEmail(input.email);
    validateEmail(email);
    update.email = email;
  }

  if ("displayName" in input) {
    update.display_name = input.displayName?.trim() || null;
  }

  if (input.role) {
    update.role = normalizeRole(input.role);
  }

  if (input.permissions) {
    const permissions = sanitizePermissions(input.permissions);
    validatePermissions(permissions);
    update.permissions = permissions;
  }

  if (typeof input.active === "boolean") {
    update.active = input.active;
  }

  if (input.password) {
    validatePassword(input.password);
    update.password_hash = hashPassword(input.password);
  }

  if (Object.keys(update).length === 0) {
    throw new Error("No staff fields to update.");
  }

  const { error } = await supabase.from("staff_accounts").update(update).eq("id", staffId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("A staff account already exists for this email.");
    }

    throw new Error(error.message);
  }
}

export async function authenticateStaffAccount(emailInput: string, password: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const email = normalizeEmail(emailInput);

  if (!email || !password) {
    return null;
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id, email, display_name, role, password_hash, permissions, active, last_login_at, created_at, updated_at")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const staff = data as StaffAccountRow;

  if (!staff.password_hash || !verifyPasswordHash(password, staff.password_hash)) {
    return null;
  }

  await supabase
    .from("staff_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", staff.id);

  return mapStaffAccount(staff);
}

export async function getActiveStaffSession(staffId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id, email, display_name, role, permissions, active, last_login_at, created_at, updated_at")
    .eq("id", staffId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapStaffAccount(data as StaffAccountRow);
}

function mapStaffAccount(row: StaffAccountRow): StaffAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    permissions: sanitizePermissions(row.permissions),
    active: row.active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRole(role: StaffRolePreset) {
  return role === "support" || role === "operations" || role === "finance" || role === "custom"
    ? role
    : "custom";
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new Error("Enter a valid staff email.");
  }
}

function validatePassword(password?: string) {
  if (!password || password.length < 8 || password.length > 120) {
    throw new Error("Staff password must be between 8 and 120 characters.");
  }
}

function validatePermissions(permissions: DashboardPermission[]) {
  if (permissions.length === 0 || permissions.some((permission) => !dashboardPermissions.includes(permission))) {
    throw new Error("Choose at least one valid dashboard permission.");
  }
}
