# Customer support and automation release

## Production

- Application commits: e6819e7 and 247db6d.
- Deployment: dpl_85ysVeSMN4HfjvgCAPBfcrdXW8hR, Ready at https://kaitou.shop.
- Original first-customer status was already Completed. Orders is paid history; only problematic orders require manual support. Added visible-tab/focus refresh every 15 seconds, preserving unsaved support drafts. Revenue refreshes every 30 seconds.
- Confirmed manual-rate profit no longer depends on deposit-ledger credit. Supplier debit uses the original checkout rate. Historical recorded profit and manual selling prices remain unchanged. First genuine sale now records RM18.91 supplier cost and RM2 net, after the RM1 payment fee, from RM21.91 collected.
- Fulfillment recovery/polling and bounded profit reconciliation run every minute. All six jobs active; recent HTTP responses checked were 200. Authenticated revenue-worker invocation returned 200 with no eligible orders outstanding.
- Smaller 112px artwork avoids stretching low-resolution supplier images. No claim that the supplier provided higher-resolution assets.
- Medal positions 1-3, configured empty game boards, session-dismissable ranking promotion and email Get help links on non-completed order results are live. Account grouping uses game/region/player/server identity, not server alone. Repeat currency purchases aggregate; passes/packs, tests and refunds remain excluded.
- Personal phone removed from public examples and the old cover bitmap removed from this deployment. Examples use 0123456789. Support email remains public by owner request. This does not remove older Git/deployment/CDN/social-media copies outside the current site.
- Light-theme outer text, dark-banner inheritance and checkout badge/payment-button contrast fixed.

## Verification

- Full isolated regression suite, new bounded revenue-worker and order polling/draft-preservation tests, lint, local build and both Vercel builds passed.
- Remote rollback SQL verified frozen-rate recognition without inventing deposits, duplicate/unpaid guards, refund losses and repeat-account ranking totals. No fixture data persisted.
- Local browser run passed 32 route/width/theme cases plus promotion, empty boards, support status rules, media removal and cron authentication. An initial networkidle timeout was a harness issue: page content readiness is now used. The live harness explicitly waits for each requested theme to hydrate rather than relying on accumulated init-script ordering.
- Final production browser verification results are in ignored artifacts/support-release/report.json. Checks include public routes at 390px/1440px in both themes, no page overflow or uncaught exceptions, artwork intrinsic dimensions, checkout text colours, dark hero text, five support-result states using intercepted local fixtures, unauthenticated private APIs, removed bitmap 404 and the real first-place ranking. No payment creation is involved.
- Normal existing owner-session accessibility data confirmed the revenue totals; the refreshed admin screenshot could not be reliably verified because desktop capture showed the foreground Codex window instead of the selected Chrome window. Stopped desktop interaction; no synthetic session or authentication bypass used. Do not claim a fresh admin visual pass.
- No new paid test, bill, supplier purchase, customer refund, staff account, funding deposit or selling-price change.

## Boundaries

- Automatic updates depend on supplier/payment availability and are eventual, not instant webhook guarantees. Missing/conflicting supplier costs remain visible for reconciliation; no profit is invented.
- Refund reporting retains consumed supplier costs and the gateway fee until confirmed recoveries are separately accounted for; marking a customer refund does not imply a supplier refund or transfer money.
- Prior audit R1-R4 addressed. Other findings in docs/audit-2026-10-19.md remain, including pending-checkout editable fields, operator audit trail and policy content. This release is not a penetration-test certificate or a claim of no remaining defects.
- Chatbot and automatic Steam catalogue are discussion-only and were not implemented. English/email launch scope remains unchanged.
