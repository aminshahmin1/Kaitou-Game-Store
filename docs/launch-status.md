# Kaitou launch verification

## Verified 2026-10-16 (Malaysia)

- Gmail SMTP test accepted and recipient confirmed receipt.
- One authorized supplier-only Mobile Legends test, order ord-2109041.
- 13 + 1 diamonds, USD 0.2317 supplier debit, approved RM2 maximum.
- Supplier reported completed; customer confirmed receipt. Do not repeat this purchase.
- This was NOT a storefront payment-to-delivery test and is not store revenue.
- SMTP, availability, supplier response parsing, payment callbacks, staff, and revenue regression tests pass.
- Next.js patched to 16.3.8. Production dependency audit reports no vulnerabilities.
- Development-tool advisories remain in the ESLint/fast-glob/braces chain; do not downgrade Next tooling with audit --force.

## Implemented in this batch

- Payment callback race fix: supplier success/error results only update an order that is still processing with no supplier reference. Concurrent admin completion/refund and newly saved provider references are preserved; skipped writes do not allocate funding. Regression tests simulate an admin refund during success and an admin completion during supplier failure. No live payment or supplier purchase.

- Global button press feedback uses a short scale/brightness transition, preserves disabled states and removes movement for reduced-motion users.
- Interrupted fulfillment recovery handles one stale paid processing order with no supplier reference per worker run, using the original saved mapping/customer fields and original idempotency key. Timestamp claims prevent overlapping workers and preserve newer admin changes; invalid mappings/unknown outcomes go to review. Supplier success with a failed DB save remains eligible for a later idempotent replay. Confirmed-cost conflicts preserve recorded profit. Isolated tests cover these paths and worker authentication. A separate fulfillment cron keeps supplier recovery/polling independent from balance pricing/email work. No paid test performed.
- Deployment verified: button press and reduced-motion CSS present in production; authenticated fulfillment worker returned HTTP 200 with zero orders processed. Supabase job kaitou-fulfillment-recovery runs every five minutes, offset one minute from the balance monitor. Unauthenticated worker requests return 401; public checkout still returns 503. Real paid full-flow test and stock reservations remain pending.

- Dashboard balance refresh: Overview and Revenue use a shared live panel with Sync balance, initial refresh, 60-second visible-tab polling and focus/visibility refresh. Requests do not overlap and rapid repeats are throttled; hidden tabs stop polling. Provider failures preserve and explicitly label the last successful reading. Authenticated no-store endpoint does not mutate funding or selling prices. Endpoint and simulated client lifecycle tests pass.

- Admin variation ordering: pointer drag handles, accessible move buttons and low-to-high price sorting. Existing sort_order positions are persisted by Save changes and now loaded by both admin and product-detail queries. Live Mobile Legends drag, move, sort, save and reopen verified; stored prices and disabled options preserved. Customer product pages now show a read-only package list when checkout is disabled; live page verified ascending prices and correct out-of-stock labels, without enabling payment. Automated query/persistence tests pass. Browser viewport override did not take effect; narrow-mobile verification remains pending.

- Funding allocation now uses the server-only allocate_order_funding transaction, serialized across orders with an advisory lock and row locks. Confirmed debit/payment required; duplicate and insufficient allocations rejected without partial writes. SQL rollback tests verify two-batch FIFO, exact remaining balance, correct net profit, repeat calls, unpaid/unconfirmed exclusions and no leftover data. anon/authenticated execute denied; service_role allowed. Refund accounting and multi-connection concurrency stress verification remain pending. This accounting lock does NOT replace checkout stock reservations.

- Review edits now require verified payment for status transitions, delivery notes for manual completion, and a customer refund reference for refunded status. Refunded orders cannot be reopened or have refund evidence cleared. Missing orders and concurrent callback/poller/operator edits produce an error rather than silent success. Isolated tests pass; these guards do not execute refunds. Granular financial permissions and durable audit trail remain outstanding.

- 2026-10-17 follow-up: Supplier polls preserve confirmed cost snapshots and route changed totals to review without rewriting allocated profit. Revenue reports and funding allocation exclude unpaid orders, including unpaid review rows. Added isolated regression cases for first cost confirmation, changed/same confirmed totals, and unpaid report/CSV exclusion. No paid test or selling-price change.

- Checkout snapshots original supplier product type/category/SKU; payment fulfillment no longer reads mutable catalogue mapping. Missing legacy snapshots go to review with no supplier request. Isolated callback tests cover changed listings and absent snapshots. Order cost allocation now waits for a valid supplier-returned USD total rather than allocating a quote before purchase. Added fulfillment_snapshot and supplier_cost_confirmed_at columns. Concurrent accounting allocation and recovery remain outstanding.

- Product workspace redesigned into My products, Add from FazerCards and a separate editor view. Imports open the imported listing for pricing. Technical mappings and customer fields are collapsed; MYR cost and selling price remain prominent. New draft saves stay hidden; publish respects disabled packages. Save/search/import/visibility/delete network errors preserve recovery paths. Existing package removal now disables it instead of silently dropping it from the editor while retaining it in storage.

- 2026-10-17: Supplier polling rotates failed lookups to avoid starving later orders, preserves concurrent admin changes using timestamp/status/reference guards, and counts only actual updates. Regression tests use isolated adapters; no supplier purchase. The unimplemented supplier webhook now returns 503 instead of falsely acknowledging events. Configure no webhook until HMAC payload/signature details are verified; authenticated order polling remains the current status path. Missing-reference recovery is still outstanding.

- Checkout validates only the configured customer fields, rejects unexpected fields and invalid select choices, bounds lengths, and preserves numeric IDs as strings. Isolated HTTP-handler tests confirm rejection happens before storage or payment creation. Tested without live purchases.

- Server-only TLS SMTP sender and owner-only email test endpoint.
- Live USD provider balance separate from the manual funding ledger.
- Fresh supplier pricing checks and per-variation affordability on storefront requests.
- Missing prices, removed SKUs, provider failures, and prices under the RM1 FPX minimum cannot be purchased.
- Selling prices and manual publication choices are preserved.
- Scheduled worker endpoint uses a secret, not a public trigger.
- Low-balance alert lease and 24-hour reminder cooldown in a private RLS table.
- Pending supplier order status polling; supplier refunds require customer review, not automatic customer-refunded status.
- Actual nested supplier order response parsed; no fabricated successful provider reference.
- Public order lookup no longer exposes supplier failure details; network errors recover.

## Must finish before enabling checkout

- Owner approved a separate RM1 FPX surcharge on 2026-10-16. New checkout totals and provider bills use product price + RM1; gateway charge-to-customer remains blank to prevent a second fee. New orders snapshot product_amount_myr and payment_surcharge_myr; older orders unchanged. Verify live callback against the total including fee in the next newly authorized full-flow test.

- Opening cost confirmed: USD14 credited for approximately RM57.93 including network fee (RM4.137857/USD). Stored separately in integration_settings as fazercards-opening-cost, NOT a new funding deposit. Prior supplier usage still needs reconciliation before creating an opening ledger balance. Product estimates use this basis only until funding batches exist; the next remaining batch rate is an indicative quote, not a multi-batch profit allocation.
- Hourly chat continuation created as finish-kaitou-launch. It cannot bypass account usage limits.

- Atomic supplier-credit reservations across simultaneous checkouts, with verified payment expiry and late-payment handling.
- Durable payment-to-fulfillment job recovery after crashes/timeouts, with the same idempotency key.
- Record actual supplier cost snapshots and allocate funding after confirmed supplier debit; fix concurrent funding allocation/refunds.
- Full operational order list, guarded manual completion/refund actions, permission separation and audit trail.
- Authenticated supplier webhook or fully tested polling fallback, including missing references and unknown outcomes.
- Buyer receipts/order notifications and integration readiness UI (WhatsApp adapter is still a placeholder).
- Storefront search, mobile navigation, light/dark theme and bilingual support.
- Re-import now preserves existing selling prices/publication and only refreshes supplier costs; new variations have zero selling price and need manual pricing. Verify live import UI with an unpublished test item before launch.
- Full live payment-to-supplier-to-customer test, distinct from the supplier-only test above.
- Rotate credentials shared in chat before launch.

Public CHECKOUT_ENABLED must stay false until the launch-critical payment and stock safeguards are verified.
