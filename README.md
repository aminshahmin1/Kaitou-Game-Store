# Kaitou Game Store

Standalone store for Kaitou.shop, built for Vercel, GitHub, Supabase, ToyyibPay Standard, and FazerCards fulfillment.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and fill credentials as they become available.

## Admin Dashboard

The public website does not link to the admin dashboard.

Admin access is at:

```text
/dashboard
```

Set these environment variables locally and in Vercel:

```text
ADMIN_EMAIL=
ADMIN_PASSWORD_PBKDF2=
ADMIN_SESSION_SECRET=
```

Generate the password hash without committing the plaintext password:

```bash
npm run hash:admin-password
```

Paste the generated value into `ADMIN_PASSWORD_PBKDF2`. Use a long random value for `ADMIN_SESSION_SECRET`.

## Current Scope

- Public gaming storefront with Kaitou's current brand direction.
- Clean fintech-style checkout surface.
- Manual catalog data model with product-specific required fields.
- ToyyibPay bill creation from server-side checkout.
- FazerCards, WhatsApp, and email integrations kept server-side.
- Admin dashboard for failed review, products, roles, reports, and integrations.
- Supabase schema draft in `supabase/schema.sql`.

## Production Credentials Needed

- Supabase URL, publishable key, and service role key.
- ToyyibPay secret key and category code.
- ToyyibPay return URL: `https://kaitou.shop/order-status`.
- ToyyibPay callback URL: `https://kaitou.shop/api/webhooks/toyyibpay`.
- FazerCards API key.
- WhatsApp Business API provider credentials.
- Email provider and admin order email.
- Admin email, admin password hash, and admin session secret.

Do not commit real secrets. Store production values in Vercel environment variables.

## FazerCards Product Mapping

Each Kaitou product variation has an optional `fazercardsSku` field. This is the value the fulfillment adapter will use later to place the matching FazerCards order.

The dashboard includes a protected `Sync MLBB MY draft` action. It imports `Mobile Legends (Malaysia)` from FazerCards `/topups/offers` as a hidden draft, stores the provider category and offer IDs, and estimates cost in MYR from USD using:

```text
FAZERCARDS_USD_TO_MYR_RATE=4.8
```

Review and set final MYR sale prices before publishing synced products.

Safe ways to get the mapping:

1. Open the FazerCards API docs at `https://api.fzr.cards/public/docs#/`.
2. Use the catalog/listing endpoints for the product family, such as platform top-ups or Steam gifts.
3. Find the exact item and region, for example `Mobile Legends (Malaysia)`.
4. Copy the provider product/card/service identifier into the variation's `fazercardsSku`.
5. Keep your FazerCards API key only in `.env.local` and Vercel environment variables.

Do not create public products with missing or unverified FazerCards SKU values if you want automatic fulfillment. You can still create hidden/internal drafts first by marking them inactive later when edit controls are added.

## Deploy

Checkout is disabled by default. Keep `CHECKOUT_ENABLED=false` until payment callback verification, idempotent FazerCards fulfillment, and order tracking are implemented and tested. The current fulfillment adapter is a placeholder; deploying the storefront does not make it ready to accept payments.

Push the repository to GitHub and import it into Vercel. Add environment variables in Vercel Project Settings before enabling real payment or fulfillment.

Required production environment variables are listed in `.env.example`. Do not upload `.env.local`; Vercel does not read it automatically.

After Vercel is linked, add `kaitou.shop` in Vercel project domains and point the domain DNS to Vercel.
