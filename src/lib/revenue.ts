import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import { malaysiaDate, revenueQuickRange } from "./revenue-dates";

const paidOrderStatuses = ["processing", "completed", "review", "failed", "refunded"] as const;

type MoneyValue = string | number | null | undefined;

type FundingBatchRow = {
  id: string;
  topup_date: string;
  provider: string;
  currency: string;
  myr_spent: MoneyValue;
  usd_credited: MoneyValue;
  opening_used_usd: MoneyValue;
  fees_myr: MoneyValue;
  effective_rate: MoneyValue;
  reference: string | null;
  notes: string | null;
  created_at: string;
  order_funding_allocations?: Array<{
    amount_usd: MoneyValue;
    cost_myr: MoneyValue;
  }>;
};

type RevenueOrderRow = {
  id: string;
  order_number: string;
  status: typeof paidOrderStatuses[number];
  amount_myr: MoneyValue;
  cost_usd: MoneyValue;
  cost_myr: MoneyValue;
  payment_fee_myr: MoneyValue;
  gross_profit_myr: MoneyValue;
  net_profit_myr: MoneyValue;
  profit_allocated_at: string | null;
  paid_at: string | null;
  created_at: string;
  products: unknown;
  product_variations: unknown;
};


export type FundingBatch = {
  id: string;
  topupDate: string;
  provider: string;
  currency: string;
  myrSpent: number;
  usdCredited: number;
  openingUsedUsd: number;
  feesMyr: number;
  effectiveRate: number;
  allocatedUsd: number;
  allocatedMyr: number;
  remainingUsd: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

export type RevenueOrder = {
  id: string;
  orderNumber: string;
  status: typeof paidOrderStatuses[number];
  productTitle: string | null;
  variationTitle: string | null;
  amountMyr: number;
  costUsd: number;
  costMyr: number;
  paymentFeeMyr: number;
  grossProfitMyr: number | null;
  netProfitMyr: number | null;
  profitAllocatedAt: string | null;
  paidAt: string;
};

export type RevenueDashboardData = {
  range: {
    from: string;
    to: string;
  };
  summary: {
    revenueMyr: number;
    allocatedCostMyr: number;
    paymentFeesMyr: number;
    grossProfitMyr: number;
    netProfitMyr: number;
    paidOrders: number;
    allocatedOrders: number;
    unallocatedOrders: number;
    unallocatedRevenueMyr: number;
    pendingCostUsd: number;
    totalFundingMyr: number;
    totalFundingUsd: number;
    allocatedFundingUsd: number;
    availableFundingUsd: number;
    blendedFundingRate: number;
    lowFundingThresholdUsd: number;
    isLowFundingBalance: boolean;
  };
  fundingBatches: FundingBatch[];
  recentOrders: RevenueOrder[];
};

export type FundingBatchInput = {
  topupDate?: string;
  myrSpent: number;
  usdCredited: number;
  feesMyr?: number;
  reference?: string;
  notes?: string;
};

export type AllocationResult = {
  allocatedOrders: number;
  skippedOrders: Array<{
    orderNumber: string;
    reason: string;
  }>;
};

export async function getRevenueDashboard(input: { from?: string; to?: string; recentLimit?: number } = {}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const range = normalizeRange(input);

  const [{ data: fundingRows, error: fundingError }, { data: orderRows, error: orderError }] =
    await Promise.all([
      supabase
        .from("funding_batches")
        .select(
          "id, topup_date, provider, currency, myr_spent, usd_credited, opening_used_usd, fees_myr, effective_rate, reference, notes, created_at, order_funding_allocations(amount_usd, cost_myr)",
        )
        .order("topup_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(
          "id, order_number, status, amount_myr, cost_usd, cost_myr, payment_fee_myr, gross_profit_myr, net_profit_myr, profit_allocated_at, paid_at, created_at, products(title), product_variations(title)",
        )
        .in("status", paidOrderStatuses)
        .eq("is_test_order", false)
        .not("paid_at", "is", null)
        .order("created_at", { ascending: false }),
    ]);

  if (fundingError) {
    throw new Error(fundingError.message);
  }

  if (orderError) {
    throw new Error(orderError.message);
  }

  const fundingBatches = (fundingRows as FundingBatchRow[] | null ?? []).map(mapFundingBatch);
  const orders = (orderRows as RevenueOrderRow[] | null ?? []).map(mapRevenueOrder);
  const rangedOrders = orders.filter((order) => isWithinDateRange(order.paidAt, range.from, range.to));
  const allocatedOrders = rangedOrders.filter((order) => order.profitAllocatedAt);
  const unallocatedOrders = rangedOrders.filter((order) => !order.profitAllocatedAt);
  const totalFundingUsd = fundingBatches.reduce((sum, batch) => sum + batch.usdCredited, 0);
  const totalFundingMyr = fundingBatches.reduce((sum, batch) => sum + batch.myrSpent + batch.feesMyr, 0);
  const allocatedFundingUsd = fundingBatches.reduce((sum, batch) => sum + batch.allocatedUsd, 0);
  const availableFundingUsd = fundingBatches.reduce((sum, batch) => sum + batch.remainingUsd, 0);
  const pendingCostUsd = round4(unallocatedOrders.reduce((sum, order) => sum + order.costUsd, 0));
  const lowFundingThresholdUsd = getLowFundingThresholdUsd();

  return {
    range,
    summary: {
      revenueMyr: round2(rangedOrders.reduce((sum, order) => sum + order.amountMyr, 0)),
      allocatedCostMyr: round2(allocatedOrders.reduce((sum, order) => sum + order.costMyr, 0)),
      paymentFeesMyr: round2(allocatedOrders.reduce((sum, order) => sum + order.paymentFeeMyr, 0)),
      grossProfitMyr: round2(
        allocatedOrders.reduce((sum, order) => sum + (order.grossProfitMyr ?? 0), 0),
      ),
      netProfitMyr: round2(
        allocatedOrders.reduce((sum, order) => sum + (order.netProfitMyr ?? 0), 0),
      ),
      paidOrders: rangedOrders.length,
      allocatedOrders: allocatedOrders.length,
      unallocatedOrders: unallocatedOrders.length,
      unallocatedRevenueMyr: round2(unallocatedOrders.reduce((sum, order) => sum + order.amountMyr, 0)),
      pendingCostUsd,
      totalFundingMyr: round2(totalFundingMyr),
      totalFundingUsd: round4(totalFundingUsd),
      allocatedFundingUsd: round4(allocatedFundingUsd),
      availableFundingUsd: round4(availableFundingUsd),
      blendedFundingRate: totalFundingUsd > 0 ? round6(totalFundingMyr / totalFundingUsd) : 0,
      lowFundingThresholdUsd,
      isLowFundingBalance:
        availableFundingUsd <= lowFundingThresholdUsd ||
        (pendingCostUsd > 0 && availableFundingUsd + 0.0001 < pendingCostUsd),
    },
    fundingBatches,
    recentOrders: rangedOrders.slice(0, input.recentLimit ?? 80),
  } satisfies RevenueDashboardData;
}

export async function createFundingBatch(input: FundingBatchInput) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const myrSpent = round2(input.myrSpent);
  const usdCredited = round4(input.usdCredited);
  const feesMyr = round2(input.feesMyr ?? 0);

  if (myrSpent < 0 || usdCredited <= 0 || feesMyr < 0) {
    throw new Error("Funding batch amounts are invalid.");
  }

  const { data, error } = await supabase
    .from("funding_batches")
    .insert({
      topup_date: input.topupDate || malaysiaDate(),
      provider: "fazercards",
      currency: "USDT",
      myr_spent: myrSpent,
      usd_credited: usdCredited,
      fees_myr: feesMyr,
      effective_rate: round6((myrSpent + feesMyr) / usdCredited),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function allocatePaidOrdersFunding(options: { orderId?: string; limit?: number; manualOnly?: boolean } = {}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  let query = supabase.from("orders").select("id,order_number")
    .in("status", paidOrderStatuses).not("paid_at", "is", null)
    .not("supplier_cost_confirmed_at", "is", null).is("profit_allocated_at", null)
    .order("paid_at", { ascending: true }).order("id", { ascending: true });
  if (options.orderId) query = query.eq("id", options.orderId);
  if (options.manualOnly) query = query.filter("cost_exchange_rate", "not.is", null);
  if (options.limit) query = query.limit(options.limit);
  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);
  const result: AllocationResult = { allocatedOrders: 0, skippedOrders: [] };
  for (const order of orders ?? []) {
    const { data, error: allocationError } = await supabase.rpc("allocate_order_funding", { p_order_id: order.id });
    if (allocationError) throw new Error("Funding allocation failed. No partial allocation was saved for this order.");
    if (data?.allocated === true) result.allocatedOrders++;
    else result.skippedOrders.push({ orderNumber: order.order_number, reason: data?.reason ?? "Order was not eligible for allocation." });
  }
  return result;
}

export async function allocateFundingForOrder(orderId: string) {
  return allocatePaidOrdersFunding({ orderId });
}

function normalizeRange(input: { from?: string; to?: string }) {
  const defaults = revenueQuickRange("month");
  const from = isDateInput(input.from) ? input.from : defaults.from;
  const to = isDateInput(input.to) ? input.to : defaults.to;

  return from <= to ? { from, to } : { from: to, to: from };
}

function isWithinDateRange(value: string, from: string, to: string) {
  const timestamp = new Date(value).getTime();
  const fromTimestamp = new Date(`${from}T00:00:00.000+08:00`).getTime();
  const toTimestamp = new Date(`${to}T23:59:59.999+08:00`).getTime();

  return timestamp >= fromTimestamp && timestamp <= toTimestamp;
}

function isDateInput(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function mapFundingBatch(row: FundingBatchRow): FundingBatch {
  const usdCredited = round4(toNumber(row.usd_credited));
  const allocatedUsd = round4(
    (row.order_funding_allocations ?? []).reduce(
      (sum, allocation) => sum + toNumber(allocation.amount_usd),
      0,
    ),
  );
  const allocatedMyr = round2(
    (row.order_funding_allocations ?? []).reduce(
      (sum, allocation) => sum + toNumber(allocation.cost_myr),
      0,
    ),
  );

  return {
    id: row.id,
    topupDate: row.topup_date,
    provider: row.provider,
    currency: row.currency,
    myrSpent: round2(toNumber(row.myr_spent)),
    usdCredited,
    openingUsedUsd: round4(toNumber(row.opening_used_usd)),
    feesMyr: round2(toNumber(row.fees_myr)),
    effectiveRate: round6(toNumber(row.effective_rate)),
    allocatedUsd,
    allocatedMyr,
    remainingUsd: round4(Math.max(0, usdCredited - allocatedUsd - toNumber(row.opening_used_usd))),
    reference: row.reference,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapRevenueOrder(row: RevenueOrderRow): RevenueOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    productTitle: getRelationTitle(row.products),
    variationTitle: getRelationTitle(row.product_variations),
    amountMyr: row.status === "refunded" ? 0 : round2(toNumber(row.amount_myr)),
    costUsd: round4(toNumber(row.cost_usd)),
    costMyr: round2(toNumber(row.cost_myr)),
    paymentFeeMyr: round2(toNumber(row.payment_fee_myr ?? 1)),
    grossProfitMyr:
      row.gross_profit_myr === null || row.gross_profit_myr === undefined
        ? null
        : row.status === "refunded" ? -round2(toNumber(row.cost_myr)) : round2(toNumber(row.gross_profit_myr)),
    netProfitMyr:
      row.net_profit_myr === null || row.net_profit_myr === undefined
        ? null
        : row.status === "refunded" ? -round2(toNumber(row.cost_myr) + toNumber(row.payment_fee_myr ?? 1)) : round2(toNumber(row.net_profit_myr)),
    profitAllocatedAt: row.profit_allocated_at,
    paidAt: row.paid_at ?? row.created_at,
  };
}

function getRelationTitle(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0]?.title === "string" ? value[0].title : null;
  }

  return value && typeof value === "object" && "title" in value && typeof value.title === "string"
    ? value.title
    : null;
}

function toNumber(value: MoneyValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getLowFundingThresholdUsd() {
  const value = Number(process.env.LOW_FUNDING_THRESHOLD_USD ?? "20");
  return Number.isFinite(value) && value >= 0 ? round4(value) : 20;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function round6(value: number) {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}
