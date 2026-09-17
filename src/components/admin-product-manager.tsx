"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { formatMyr, getProductStartingPrice } from "@/lib/catalog";
import type { Product, ProductVariation, RequiredField } from "@/lib/types";

type CatalogKind = "topup" | "gift_card" | "steam_gift";

type FieldDraft = RequiredField & { localId: string };

type VariationDraft = {
  localId: string;
  id?: string;
  title: string;
  sku: string;
  fazercardsSku: string;
  priceMyr: string;
  costMyr: string;
  active: boolean;
  available: boolean;
};

type FazerCardsCatalogItem = {
  id: string;
  name: string;
  kind: CatalogKind;
  note: string | null;
  imageUrl: string | null;
};

const defaultFields: FieldDraft[] = [
  {
    localId: crypto.randomUUID(),
    key: "user_id",
    label: "User ID",
    placeholder: "Example: 123456789",
    type: "number",
  },
  {
    localId: crypto.randomUUID(),
    key: "zone_id",
    label: "Zone ID",
    placeholder: "Example: 1234",
    type: "number",
  },
];

const defaultVariations: VariationDraft[] = [
  {
    localId: crypto.randomUUID(),
    title: "Weekly Diamond Pass",
    sku: "mobile-legends-weekly-diamond-pass-my",
    fazercardsSku: "",
    priceMyr: "10.90",
    costMyr: "0.00",
    active: true,
    available: true,
  },
];

async function fetchProducts(): Promise<Product[]> {
  const response = await fetch("/api/admin/products");
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Products could not be loaded.");
  }
  return body.products ?? [];
}

function fieldDraft(field?: Partial<RequiredField>): FieldDraft {
  return {
    localId: crypto.randomUUID(),
    key: field?.key ?? "",
    label: field?.label ?? "",
    placeholder: field?.placeholder ?? "",
    help: field?.help ?? "",
    type: field?.type ?? "text",
    options: field?.options ?? [],
  };
}

function variationDraft(variation?: Partial<ProductVariation>): VariationDraft {
  return {
    localId: crypto.randomUUID(),
    id: variation?.id,
    title: variation?.title ?? "",
    sku: variation?.sku ?? "",
    fazercardsSku: variation?.fazercardsSku ?? "",
    priceMyr: variation?.priceMyr != null ? String(variation.priceMyr) : "0.00",
    costMyr: variation?.costMyr != null ? String(variation.costMyr) : "0.00",
    active: variation?.active ?? true,
    available: variation?.available ?? true,
  };
}

function cloneDefaultVariation(variation: VariationDraft): VariationDraft {
  return {
    ...variation,
    localId: crypto.randomUUID(),
  };
}

export function AdminProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [importingCatalogId, setImportingCatalogId] = useState<string | null>(null);
  const [mutatingProductId, setMutatingProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requiredFields, setRequiredFields] = useState<FieldDraft[]>(defaultFields);
  const [variations, setVariations] = useState<VariationDraft[]>(defaultVariations);
  const [productSearch, setProductSearch] = useState("");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("topup");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogItems, setCatalogItems] = useState<FazerCardsCatalogItem[]>([]);

  const totalVariations = useMemo(
    () => products.reduce((sum, product) => sum + product.variations.length, 0),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) =>
      `${product.title} ${product.game} ${product.slug} ${product.fazercardsProductId ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [productSearch, products]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(formData: FormData) {
    setIsSaving(true);
    setMessage(null);

    const payload = {
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      type: String(formData.get("type") ?? ""),
      category: String(formData.get("category") ?? ""),
      game: String(formData.get("game") ?? ""),
      description: String(formData.get("description") ?? ""),
      imageTone: String(formData.get("imageTone") ?? ""),
      fazercardsProductId: String(formData.get("fazercardsProductId") ?? ""),
      region: String(formData.get("region") ?? ""),
      deliveryType: String(formData.get("deliveryType") ?? ""),
      requiredFields: requiredFields
        .filter((field) => field.key.trim() && field.label.trim())
        .map((field) => {
          const cleanField = {
            key: field.key,
            label: field.label,
            placeholder: field.placeholder,
            type: field.type,
            help: field.help?.trim() || undefined,
            options: field.type === "select" ? field.options?.filter(Boolean) : undefined,
          };
          return cleanField;
        }),
      variations: variations
        .filter((variation) => variation.title.trim() && variation.sku.trim())
        .map((variation) => ({
          id: variation.id,
          title: variation.title,
          sku: variation.sku,
          fazercardsSku: variation.fazercardsSku,
          priceMyr: Number(variation.priceMyr),
          costMyr: Number(variation.costMyr),
          active: variation.active,
          available: variation.available,
        })),
      active: formData.get("active") === "on",
      available: formData.get("available") === "on",
    };

    const response = await fetch(
      editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products",
      {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setMessage(body.error ?? (editingProduct ? "Product could not be updated." : "Product could not be created."));
      return;
    }

    setMessage(editingProduct ? "Listing updated. If it is public with available variations, it will appear on the storefront." : "Product created.");
    setEditingProduct(null);
    setRequiredFields(defaultFields.map((field) => fieldDraft(field)));
    setVariations(defaultVariations.map(cloneDefaultVariation));
    await loadProducts();
  }

  function startEditing(product: Product) {
    setEditingProduct(product);
    setMessage("Editing listing. A product appears publicly only when the product and at least one priced variation are active and available.");
    setRequiredFields(product.requiredFields.length ? product.requiredFields.map(fieldDraft) : []);
    setVariations(product.variations.length ? product.variations.map(variationDraft) : [variationDraft()]);
    document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditing() {
    setEditingProduct(null);
    setMessage(null);
    setRequiredFields(defaultFields.map((field) => fieldDraft(field)));
    setVariations(defaultVariations.map(cloneDefaultVariation));
  }

  async function updateProductStatus(product: Product, next: { active?: boolean; available?: boolean }) {
    setMutatingProductId(product.id);
    setMessage(null);

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const body = await response.json().catch(() => ({}));
    setMutatingProductId(null);

    if (!response.ok) {
      setMessage(body.error ?? "Product status could not be updated.");
      return;
    }

    setMessage(next.active === false || next.available === false ? "Product hidden." : "Product published.");
    await loadProducts();
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.title}? This removes its variations too.`)) {
      return;
    }

    setMutatingProductId(product.id);
    setMessage(null);

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => ({}));
    setMutatingProductId(null);

    if (!response.ok) {
      setMessage(body.error ?? "Product could not be deleted.");
      return;
    }

    setMessage("Product deleted.");
    await loadProducts();
  }

  async function searchCatalog() {
    setIsSearchingCatalog(true);
    setMessage(null);
    const params = new URLSearchParams({ kind: catalogKind, q: catalogSearch });
    const response = await fetch(`/api/admin/fazercards/catalog?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    setIsSearchingCatalog(false);

    if (!response.ok) {
      setMessage(body.error ?? "FazerCards catalog could not be searched.");
      return;
    }

    setCatalogItems(body.items ?? []);
  }

  async function importCatalogItem(item: FazerCardsCatalogItem) {
    setImportingCatalogId(item.id);
    setMessage(null);

    const response = await fetch("/api/admin/fazercards/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: item.kind, categoryId: item.id, displayName: item.name }),
    });
    const body = await response.json().catch(() => ({}));
    setImportingCatalogId(null);

    if (!response.ok) {
      setMessage(body.error ?? "FazerCards item could not be imported.");
      return;
    }

    setMessage(`Imported ${body.productTitle} as a hidden draft with ${body.variationCount} variations. Edit sale prices and availability before publishing.`);
    await loadProducts();
  }

  function updateField(localId: string, patch: Partial<FieldDraft>) {
    setRequiredFields((current) =>
      current.map((field) => (field.localId === localId ? { ...field, ...patch } : field)),
    );
  }

  function updateVariation(localId: string, patch: Partial<VariationDraft>) {
    setVariations((current) =>
      current.map((variation) => (variation.localId === localId ? { ...variation, ...patch } : variation)),
    );
  }

  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold">Product listings</h2>
          <p className="text-sm text-slate-500">
            Import provider items as hidden drafts, set MYR prices, then publish only the products you want to sell.
          </p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Products" value={products.length.toString()} />
        <Stat label="Variations" value={totalVariations.toString()} />
        <Stat
          label="Lowest price"
          value={products.length > 0 ? formatMyr(Math.min(...products.map((product) => getProductStartingPrice(product)))) : formatMyr(0)}
        />
      </div>

      <div className="grid gap-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-950">Import from FazerCards</h3>
            <p className="text-sm text-slate-600">
              Search provider products, import them as hidden drafts, then edit your sale prices before publishing.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <select
              value={catalogKind}
              onChange={(event) => setCatalogKind(event.target.value as CatalogKind)}
              className="rounded-md border border-sky-200 bg-white px-3 py-3 text-sm font-semibold"
            >
              <option value="topup">Top-ups</option>
              <option value="steam_gift">Steam gifts</option>
              <option value="gift_card">Gift cards</option>
            </select>
            <input
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchCatalog();
              }}
              placeholder="Search Mobile Legends, Valorant, Steam..."
              className="rounded-md border border-sky-200 bg-white px-3 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => void searchCatalog()}
              disabled={isSearchingCatalog}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {isSearchingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
        </div>
        {catalogItems.length > 0 ? (
          <div className="grid max-h-96 gap-2 overflow-y-auto">
            {catalogItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex flex-col justify-between gap-3 rounded-md border border-sky-100 bg-white p-3 md:flex-row md:items-center">
                <div>
                  <p className="font-bold text-slate-950">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.kind.replace("_", " ")} / {item.id}</p>
                  {item.note ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.note}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void importCatalogItem(item)}
                  disabled={importingCatalogId === item.id}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {importingCatalogId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Import draft
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <form id="product-editor" key={editingProduct?.id ?? "new"} action={onSubmit} className="grid gap-4 border-t border-slate-100 pt-5">
        <div className="flex flex-col justify-between gap-3 rounded-md bg-slate-50 p-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {editingProduct ? "Editing listing" : "New manual listing"}
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Public visibility requires product active, product available, and at least one active available variation with a positive sale price.
            </p>
          </div>
          {editingProduct ? (
            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            >
              <X className="h-4 w-4" />
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field name="title" label="Product title" placeholder="Mobile Legends (Malaysia)" defaultValue={editingProduct?.title} />
          <Field name="slug" label="Slug" placeholder="mobile-legends-malaysia" defaultValue={editingProduct?.slug} />
          <SelectField name="type" label="Type" defaultValue={editingProduct?.type ?? "topup"} options={[["topup", "Game top-up"], ["steam_gift_game", "Steam gift game"]]} />
          <Field name="category" label="Category" placeholder="Game Top-Ups" defaultValue={editingProduct?.category ?? "Game Top-Ups"} />
          <Field name="game" label="Game" placeholder="Mobile Legends" defaultValue={editingProduct?.game} />
          <SelectField name="region" label="Region" defaultValue={editingProduct?.region ?? "MY"} options={[["MY", "MY"], ["SEA", "SEA"], ["Global", "Global"]]} />
          <SelectField name="deliveryType" label="Delivery type" defaultValue={editingProduct?.deliveryType ?? "Direct top-up"} options={[["Direct top-up", "Direct top-up"], ["Steam gift", "Steam gift"]]} />
          <Field
            name="imageTone"
            label="Card color"
            defaultValue={editingProduct?.imageTone ?? "from-sky-500 via-blue-700 to-slate-950"}
            placeholder="from-sky-500 via-blue-700 to-slate-950"
          />
          <Field
            name="fazercardsProductId"
            label="FazerCards product/category ID"
            defaultValue={editingProduct?.fazercardsProductId ?? ""}
            placeholder="mobile_legends_malaysia"
            required={false}
          />
        </div>

        <div className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-700 md:grid-cols-2">
          <label className="flex items-center gap-3">
            <input name="active" type="checkbox" defaultChecked={editingProduct?.active ?? true} className="h-4 w-4" />
            Show on public website
          </label>
          <label className="flex items-center gap-3">
            <input name="available" type="checkbox" defaultChecked={editingProduct?.available ?? true} className="h-4 w-4" />
            Available for checkout
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Description
          <textarea name="description" defaultValue={editingProduct?.description ?? ""} className="min-h-20 rounded-md border border-slate-200 px-3 py-3" />
        </label>

        <EditorPanel
          title="Required customer fields"
          actionLabel="Add field"
          onAdd={() => setRequiredFields((current) => [...current, fieldDraft()])}
        >
          {requiredFields.length > 0 ? (
            requiredFields.map((field) => (
              <div key={field.localId} className="grid gap-3 rounded-md border border-slate-200 p-3 lg:grid-cols-[1fr_1fr_1fr_140px_auto]">
                <SmallInput label="Key" value={field.key} onChange={(value) => updateField(field.localId, { key: value })} placeholder="user_id" />
                <SmallInput label="Label" value={field.label} onChange={(value) => updateField(field.localId, { label: value })} placeholder="User ID" />
                <SmallInput label="Placeholder" value={field.placeholder} onChange={(value) => updateField(field.localId, { placeholder: value })} placeholder="Example: 123456789" />
                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  Type
                  <select
                    value={field.type ?? "text"}
                    onChange={(event) => updateField(field.localId, { type: event.target.value as RequiredField["type"] })}
                    className="rounded-md border border-slate-200 px-2 py-2 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setRequiredFields((current) => current.filter((item) => item.localId !== field.localId))}
                  className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-2 text-red-700"
                  aria-label="Remove customer field"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No customer fields. This is usually fine for gift code products, but direct top-ups normally need at least a user ID.
            </p>
          )}
        </EditorPanel>

        <EditorPanel
          title="Variations and prices"
          actionLabel="Add variation"
          onAdd={() => setVariations((current) => [...current, variationDraft()])}
        >
          <div className="grid gap-3">
            {variations.map((variation) => (
              <div key={variation.localId} className="grid gap-3 rounded-md border border-slate-200 p-3 xl:grid-cols-[1.3fr_1fr_1fr_110px_110px_110px_auto]">
                <SmallInput label="Variation" value={variation.title} onChange={(value) => updateVariation(variation.localId, { title: value })} placeholder="Weekly Diamond Pass" />
                <SmallInput label="Store SKU" value={variation.sku} onChange={(value) => updateVariation(variation.localId, { sku: value })} placeholder="mlbb-weekly-pass" />
                <SmallInput label="Provider SKU" value={variation.fazercardsSku} onChange={(value) => updateVariation(variation.localId, { fazercardsSku: value })} placeholder="category:offer" />
                <SmallInput label="Cost MYR" type="number" value={variation.costMyr} onChange={(value) => updateVariation(variation.localId, { costMyr: value })} placeholder="8.00" />
                <SmallInput label="Sale MYR" type="number" value={variation.priceMyr} onChange={(value) => updateVariation(variation.localId, { priceMyr: value })} placeholder="9.90" />
                <div className="grid gap-2 text-xs font-bold text-slate-600">
                  Status
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={variation.active} onChange={(event) => updateVariation(variation.localId, { active: event.target.checked })} />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={variation.available} onChange={(event) => updateVariation(variation.localId, { available: event.target.checked })} />
                    Available
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setVariations((current) => current.filter((item) => item.localId !== variation.localId))}
                  className="inline-flex items-center justify-center rounded-md border border-red-200 px-2 py-2 text-red-700"
                  aria-label="Remove variation"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </EditorPanel>

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
          {editingProduct ? "Save listing changes" : "Create product"}
        </button>
      </form>

      <div className="grid gap-3">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h3 className="font-display text-2xl font-bold">Listings</h3>
          <label className="relative block md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search your listings"
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Variations</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Public readiness</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Loading products...
                  </td>
                </tr>
              ) : visibleProducts.length > 0 ? (
                visibleProducts.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-bold">{product.title}</p>
                      <p className="text-xs text-slate-500">{product.slug}</p>
                    </td>
                    <td className="px-4 py-4">{product.type}</td>
                    <td className="px-4 py-4">{product.variations.length}</td>
                    <td className="px-4 py-4">{product.variations.length ? formatMyr(getProductStartingPrice(product)) : "No public options"}</td>
                    <td className="px-4 py-4">
                      <Readiness product={product} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(product)}
                          className="inline-flex items-center gap-1 rounded-md border border-sky-200 px-2 py-1 font-bold text-sky-700"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>
                        {product.active && product.available ? (
                          <button
                            type="button"
                            disabled={mutatingProductId === product.id}
                            onClick={() => void updateProductStatus(product, { active: false, available: false })}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-bold text-slate-700 disabled:opacity-60"
                          >
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={mutatingProductId === product.id}
                            onClick={() => void updateProductStatus(product, { active: true, available: true })}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-bold text-white disabled:opacity-60"
                          >
                            <Eye className="h-4 w-4" />
                            Publish
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={mutatingProductId === product.id}
                          onClick={() => void deleteProduct(product)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 font-bold text-red-700 disabled:opacity-60"
                        >
                          {mutatingProductId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <strong className="mt-1 block text-2xl">{value}</strong>
    </div>
  );
}

function EditorPanel({
  title,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function Readiness({ product }: { product: Product }) {
  const publicVariationCount = product.variations.filter(
    (variation) => variation.active && variation.available && variation.priceMyr > 0,
  ).length;

  if (product.active && product.available && publicVariationCount > 0) {
    return <span className="rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Visible</span>;
  }

  const reason = !product.active
    ? "Hidden product"
    : !product.available
      ? "Unavailable product"
      : "No available priced variation";

  return <span className="rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-700">{reason}</span>;
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required = true,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-200 px-3 py-3"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select name={name} defaultValue={defaultValue} className="rounded-md border border-slate-200 px-3 py-3">
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-slate-200 px-2 py-2 text-sm font-medium text-slate-900"
      />
    </label>
  );
}
