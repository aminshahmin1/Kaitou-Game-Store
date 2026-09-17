"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, RefreshCw } from "lucide-react";

import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import type { Product } from "@/lib/types";

const requiredFieldsTemplate = JSON.stringify(
  [
    { key: "user_id", label: "User ID", placeholder: "Example: 123456789", type: "number" },
    { key: "zone_id", label: "Zone ID", placeholder: "Example: 1234", type: "number" },
  ],
  null,
  2,
);

const variationsTemplate = JSON.stringify(
  [
    {
      title: "Weekly Diamond Pass",
      sku: "mobile-legends-weekly-diamond-pass-my",
      fazercardsSku: "",
      priceMyr: 10.9,
      costMyr: 0,
      active: true,
      available: true,
    },
  ],
  null,
  2,
);

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch("/api/admin/products");
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Products could not be loaded.");
  }
  return body.products ?? [];
}

export function AdminProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requiredFields, setRequiredFields] = useState(requiredFieldsTemplate);
  const [variations, setVariations] = useState(variationsTemplate);

  const totalVariations = useMemo(
    () => products.reduce((sum, product) => sum + product.variations.length, 0),
    [products],
  );

  async function loadProducts() {
    try {
      setProducts(await fetchProducts());
    } catch {
      setMessage("Products could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchProducts()
      .then((loadedProducts) => {
        if (!cancelled) setProducts(loadedProducts);
      })
      .catch(() => {
        if (!cancelled) setMessage("Products could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(formData: FormData) {
    setIsSaving(true);
    setMessage(null);

    let parsedRequiredFields: unknown;
    let parsedVariations: unknown;

    try {
      parsedRequiredFields = JSON.parse(requiredFields);
      parsedVariations = JSON.parse(variations);
    } catch {
      setIsSaving(false);
      setMessage("Required fields and variations must be valid JSON.");
      return;
    }

    const payload = {
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      type: String(formData.get("type") ?? ""),
      category: String(formData.get("category") ?? ""),
      game: String(formData.get("game") ?? ""),
      description: String(formData.get("description") ?? ""),
      imageTone: String(formData.get("imageTone") ?? ""),
      region: String(formData.get("region") ?? ""),
      deliveryType: String(formData.get("deliveryType") ?? ""),
      requiredFields: parsedRequiredFields,
      variations: parsedVariations,
      active: true,
      available: true,
    };

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setMessage(body.error ?? "Product could not be created.");
      return;
    }

    setMessage("Product created.");
    await loadProducts();
  }

  async function syncMobileLegends() {
    setIsSyncing(true);
    setMessage(null);

    const response = await fetch("/api/admin/fazercards/sync-mobile-legends", {
      method: "POST",
    });
    const body = await response.json();
    setIsSyncing(false);

    if (!response.ok) {
      setMessage(body.error ?? "FazerCards catalog could not be synced.");
      return;
    }

    setMessage(
      `Imported ${body.productTitle} as a hidden draft with ${body.variationCount} provider variations. Review MYR pricing before publishing.`,
    );
    await loadProducts();
  }

  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold">Product listings</h2>
          <p className="text-sm text-slate-500">
            Create products manually or import provider drafts. Keep synced drafts hidden until prices and availability are reviewed.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void syncMobileLegends()}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync MLBB MY draft
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void loadProducts();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Products</p>
          <strong className="mt-1 block text-2xl">{products.length}</strong>
        </div>
        <div className="rounded-md bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Variations</p>
          <strong className="mt-1 block text-2xl">{totalVariations}</strong>
        </div>
        <div className="rounded-md bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Lowest price</p>
          <strong className="mt-1 block text-2xl">
            {products.length > 0
              ? formatMyr(Math.min(...products.map((product) => getProductStartingPrice(product))))
              : formatMyr(0)}
          </strong>
        </div>
      </div>

      <form action={onSubmit} className="grid gap-4 border-t border-slate-100 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="title" label="Product title" placeholder="Mobile Legends (Malaysia)" />
          <Field name="slug" label="Slug" placeholder="mobile-legends-malaysia" />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Type
            <select name="type" className="rounded-md border border-slate-200 px-3 py-3">
              <option value="topup">Game top-up</option>
              <option value="steam_gift_game">Steam gift game</option>
            </select>
          </label>
          <Field name="category" label="Category" placeholder="Game Top-Ups" defaultValue="Game Top-Ups" />
          <Field name="game" label="Game" placeholder="Mobile Legends" />
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Region
            <select name="region" className="rounded-md border border-slate-200 px-3 py-3">
              <option value="MY">MY</option>
              <option value="SEA">SEA</option>
              <option value="Global">Global</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Delivery type
            <select name="deliveryType" className="rounded-md border border-slate-200 px-3 py-3">
              <option value="Direct top-up">Direct top-up</option>
              <option value="Steam gift">Steam gift</option>
            </select>
          </label>
          <Field
            name="imageTone"
            label="Card color"
            defaultValue="from-sky-500 via-blue-700 to-slate-950"
            placeholder="from-sky-500 via-blue-700 to-slate-950"
          />
        </div>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Description
          <textarea name="description" className="min-h-20 rounded-md border border-slate-200 px-3 py-3" />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Required customer fields JSON
            <textarea
              value={requiredFields}
              onChange={(event) => setRequiredFields(event.target.value)}
              className="min-h-56 rounded-md border border-slate-200 px-3 py-3 font-mono text-xs"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Variations JSON
            <textarea
              value={variations}
              onChange={(event) => setVariations(event.target.value)}
              className="min-h-56 rounded-md border border-slate-200 px-3 py-3 font-mono text-xs"
            />
          </label>
        </div>

        {message ? (
          <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Create product
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Variations</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  Loading products...
                </td>
              </tr>
            ) : products.length > 0 ? (
              products.map((product) => (
                <tr key={product.id} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-bold">{product.title}</td>
                  <td className="px-4 py-4">{product.type}</td>
                  <td className="px-4 py-4">{product.variations.length}</td>
                  <td className="px-4 py-4">{formatMyr(getProductStartingPrice(product))}</td>
                  <td className="px-4 py-4">{product.active && product.available ? "Active" : "Hidden"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  No products created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        required
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-200 px-3 py-3"
      />
    </label>
  );
}
