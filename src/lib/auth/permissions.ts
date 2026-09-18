export const dashboardPermissions = [
  "products",
  "review",
  "revenue",
  "staff",
  "integrations",
  "settings",
] as const;

export type DashboardPermission = (typeof dashboardPermissions)[number];

export type StaffRolePreset = "support" | "operations" | "finance" | "custom";

export const permissionDetails: Array<{
  id: DashboardPermission;
  label: string;
  description: string;
}> = [
  {
    id: "products",
    label: "Products",
    description: "Create, edit, import, publish, hide, and delete listings.",
  },
  {
    id: "review",
    label: "Failed review",
    description: "Review failed orders, update support notes, and move support statuses.",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "View profit reports, add funding batches, allocate costs, and export CSV.",
  },
  {
    id: "staff",
    label: "Staff",
    description: "Create staff logins, change passwords, and manage permissions.",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "View provider setup areas for payments, fulfillment, WhatsApp, and email.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "View store controls and future store configuration.",
  },
];

export const rolePresets: Array<{
  id: StaffRolePreset;
  label: string;
  description: string;
  permissions: DashboardPermission[];
}> = [
  {
    id: "support",
    label: "Support",
    description: "For support staff handling failed orders and customer follow-up.",
    permissions: ["review"],
  },
  {
    id: "operations",
    label: "Operations",
    description: "For staff managing listings plus support issues.",
    permissions: ["products", "review"],
  },
  {
    id: "finance",
    label: "Finance",
    description: "For trusted staff reviewing funding, revenue, and profit exports.",
    permissions: ["revenue"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start with no preset and tick permissions manually.",
    permissions: [],
  },
];

const permissionSet = new Set<string>(dashboardPermissions);

export function sanitizePermissions(input: unknown): DashboardPermission[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<DashboardPermission>();

  for (const value of input) {
    if (typeof value === "string" && permissionSet.has(value)) {
      unique.add(value as DashboardPermission);
    }
  }

  return dashboardPermissions.filter((permission) => unique.has(permission));
}

export function hasDashboardPermission(
  session: { role: string; permissions?: DashboardPermission[] },
  permission?: DashboardPermission,
) {
  if (!permission) {
    return true;
  }

  if (session.role === "owner") {
    return true;
  }

  return Boolean(session.permissions?.includes(permission));
}
