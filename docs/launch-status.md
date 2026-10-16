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
