import { NextResponse } from "next/server";

import { getAdminApiSession } from "@/lib/auth/admin-api";
import { getRevenueDashboard } from "@/lib/revenue";

export async function GET(request: Request) {
  const session = await getAdminApiSession("revenue");

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const data = await getRevenueDashboard({ from, to, recentLimit: 5000 });
  const filename = `kaitou-revenue-${data.range.from}-to-${data.range.to}.csv`;
  const csv = toCsv([
    ["Kaitou Game Store Revenue Export"],
    ["From", data.range.from],
    ["To", data.range.to],
    ["Revenue MYR", data.summary.revenueMyr],
    ["Allocated Cost MYR", data.summary.allocatedCostMyr],
    ["Payment Fees MYR", data.summary.paymentFeesMyr],
    ["Gross Profit MYR", data.summary.grossProfitMyr],
    ["Net Profit MYR", data.summary.netProfitMyr],
    ["Paid Orders", data.summary.paidOrders],
    ["Allocated Orders", data.summary.allocatedOrders],
    ["Unallocated Orders", data.summary.unallocatedOrders],
    [],
    [
      "Order",
      "Paid At",
      "Status",
      "Product",
      "Variation",
      "Revenue MYR",
      "Cost USDT",
      "Cost MYR",
      "Payment Fee MYR",
      "Gross Profit MYR",
      "Net Profit MYR",
      "Profit Status",
    ],
    ...data.recentOrders.map((order) => [
      order.orderNumber,
      order.paidAt,
      order.status,
      order.productTitle ?? "",
      order.variationTitle ?? "",
      order.amountMyr,
      order.costUsd,
      order.costMyr,
      order.paymentFeeMyr,
      order.grossProfitMyr ?? "",
      order.netProfitMyr ?? "",
      order.profitAllocatedAt ? "Allocated" : "Pending",
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string | number) {
  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
