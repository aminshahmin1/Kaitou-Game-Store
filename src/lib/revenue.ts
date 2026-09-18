import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";
import { malaysiaDate, revenueQuickRange } from "./revenue-dates";

const paidOrderStatuses = ["processing", "completed", "review"] as const;

type MoneyValue = string | number | null | undefined;

type FundingBatchRow = {
  id: string;
  topup_date: string;
  provider: string;
  currency: string;
  myr_spent: MoneyValue;
  usd_credited: MoneyValue;
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
  status: "processing" | "completed" | "review";
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

type AllocationOrderRow = {
  id: string;
  order_number: string;
  status: "processing" | "completed" | "review";
  amount_myr: MoneyValue;
  cost_usd: MoneyValue;
  cost_myr: MoneyValue;
  payment_fee_myr: MoneyValue;
  profit_allocated_at: string | null;
  order_funding_allocations?: Array<{ id: string }>;
};

export type FundingBatch = {
  id: string;
  topupDate: string;
  provider: string;
  currency: string;
  myrSpent: number;
  usdCredited: number;
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
  status: "processing" | "completed" | "review";
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
          "id, topup_date, provider, currency, myr_spent, usd_credited, fees_myr, effective_rate, reference, notes, created_at, order_funding_allocations(amount_usd, cost_myr)",
        )
        .order("topup_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(
          "id, order_number, status, amount_myr, cost_usd, cost_myr, payment_fee_myr, gross_profit_myr, net_profit_myr, profit_allocated_at, paid_at, created_at, products(title), product_variations(title)",
        )
        .in("status", paidOrderStatuses)
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

export async function allocatePaidOrdersFunding(options: { orderId?: string } = {}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: fundingRows, error: fundingError } = await supabase
    .from("funding_batches")
    .select(
      "id, topup_date, provider, currency, myr_spent, usd_credited, fees_myr, effective_rate, reference, notes, created_at, order_funding_allocations(amount_usd, cost_myr)",
    )
    .order("topup_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (fundingError) {
    throw new Error(fundingError.message);
  }

  const batches = (fundingRows as FundingBatchRow[] | null ?? []).map(mapFundingBatch);
  let orderQuery = supabase
    .from("orders")
    .select(
      "id, order_number, status, amount_myr, cost_usd, cost_myr, payment_fee_myr, profit_allocated_at, order_funding_allocations(id)",
    )
    .in("status", paidOrderStatuses)
    .is("profit_allocated_at", null)
    .order("created_at", { ascending: true });

  if (options.orderId) {
    orderQuery = orderQuery.eq("id", options.orderId);
  }

  const { data: orderRows, error: orderError } = await orderQuery;

  if (orderError) {
    throw new Error(orderError.message);
  }

  const result: AllocationResult = {
    allocatedOrders: 0,
    skippedOrders: [],
  };

  for (const order of (orderRows as AllocationOrderRow[] | null ?? [])) {
    if ((order.order_funding_allocations ?? []).length > 0) {
      result.skippedOrders.push({
        orderNumber: order.order_number,
        reason: "Order already has funding allocations.",
      });
      continue;
    }

    const costUsd = round4(toNumber(order.cost_usd));
    const currentCostMyr = round2(toNumber(order.cost_myr));
    const amountMyr = round2(toNumber(order.amount_myr));
    const paymentFeeMyr = round2(toNumber(order.payment_fee_myr ?? 1));

    if (costUsd <= 0) {
      await snapshotOrderProfit(order.id, amountMyr, currentCostMyr, paymentFeeMyr);
      result.allocatedOrders += 1;
      continue;
    }

    const availableUsd = round4(batches.reduce((sum, batch) => sum + batch.remainingUsd, 0));

    if (availableUsd + 0.0001 < costUsd) {
      result.skippedOrders.push({
        orderNumber: order.order_number,
        reason: `Not enough funding balance. Need ${costUsd.toFixed(4)} USDT; available ${availableUsd.toFixed(4)} USDT.`,
      });
      continue;
    }

    let remainingUsd = costUsd;
    const allocations: Array<{
      order_id: string;
      funding_batch_id: string;
      amount_usd: number;
      effective_rate: number;
      cost_myr: number;
    }> = [];

    for (const batch of batches) {
      if (remainingUsd <= 0.0001) {
        break;
      }

      if (batch.remainingUsd <= 0) {
        continue;
      }

      const amountUsd = round4(Math.min(batch.remainingUsd, remainingUsd));
      const costMyr = round2(amountUsd * batch.effectiveRate);

      if (amountUsd <= 0) {
        continue;
      }

      allocations.push({
        order_id: order.id,
        funding_batch_id: batch.id,
        amount_usd: amountUsd,
        effective_rate: batch.effectiveRate,
        cost_myr: costMyr,
      });

      batch.remainingUsd = round4(batch.remainingUsd - amountUsd);
      batch.allocatedUsd = round4(batch.allocatedUsd + amountUsd);
      batch.allocatedMyr = round2(batch.allocatedMyr + costMyr);
      remainingUsd = round4(remainingUsd - amountUsd);
    }

    const allocatedCostMyr = round2(allocations.reduce((sum, allocation) => sum + allocation.cost_myr, 0));

    const { error: allocationError } = await supabase.from("order_funding_allocations").insert(allocations);

    if (allocationError) {
      throw new Error(allocationError.message);
    }

    await snapshotOrderProfit(order.id, amountMyr, allocatedCostMyr, paymentFeeMyr);
    result.allocatedOrders += 1;
  }

  return result;
}

export async function allocateFundingForOrder(orderId: string) {
  return allocatePaidOrdersFunding({ orderId });
}

async function snapshotOrderProfit(
  orderId: string,
  amountMyr: number,
  costMyr: number,
  paymentFeeMyr: number,
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const grossProfitMyr = round2(amountMyr - costMyr);
  const netProfitMyr = round2(grossProfitMyr - paymentFeeMyr);
  const { error } = await supabase
    .from("orders")
    .update({
      cost_myr: costMyr,
      gross_profit_myr: grossProfitMyr,
      net_profit_myr: netProfitMyr,
      profit_allocated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message);
  }
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
    feesMyr: round2(toNumber(row.fees_myr)),
    effectiveRate: round6(toNumber(row.effective_rate)),
    allocatedUsd,
    allocatedMyr,
    remainingUsd: round4(Math.max(0, usdCredited - allocatedUsd)),
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
    amountMyr: round2(toNumber(row.amount_myr)),
    costUsd: round4(toNumber(row.cost_usd)),
    costMyr: round2(toNumber(row.cost_myr)),
    paymentFeeMyr: round2(toNumber(row.payment_fee_myr ?? 1)),
    grossProfitMyr:
      row.gross_profit_myr === null || row.gross_profit_myr === undefined
        ? null
        : round2(toNumber(row.gross_profit_myr)),
    netProfitMyr:
      row.net_profit_myr === null || row.net_profit_myr === undefined
        ? null
        : round2(toNumber(row.net_profit_myr)),
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
