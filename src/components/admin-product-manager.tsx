"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowDownWideNarrow,
  GripVertical,
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
import type { FundingCostBasis } from "@/lib/funding-cost";
import { estimateCostMyr } from "@/lib/cost-conversion";
import { moveVariation } from "@/lib/variation-order";
import { isRepeatableCurrency, isRankingCurrency } from "@/lib/custom-packages";

type CatalogKind = "all" | "topup" | "gift_card" | "steam_gift";

type FieldDraft = RequiredField & { localId: string };

type VariationDraft = {
  currencyUnits: string;
  supplierQuantity: number;
  repeatable: boolean;
  basePackageTitle: string | null;
  localId: string;
  id?: string;
  title: string;
  sku: string;
  fazercardsSku: string;
  costUsd: string;
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
    supplierQuantity: 1, repeatable: false, basePackageTitle: null, currencyUnits: "0",
    localId: crypto.randomUUID(),
    title: "Weekly Diamond Pass",
    sku: "mobile-legends-weekly-diamond-pass-my",
    fazercardsSku: "",
    costUsd: "0.00",
    priceMyr: "10.90",
    costMyr: "0.00",
    active: true,
    available: true,
  },
];

async function fetchProducts(): Promise<{ products: Product[]; fundingCostBasis: FundingCostBasis | null }> {
  const response = await fetch("/api/admin/products");
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Products could not be loaded.");
  }
  return { products: body.products ?? [], fundingCostBasis: body.fundingCostBasis ?? null };
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
    currencyUnits: String(variation?.currencyUnits ?? 0),
    supplierQuantity: variation?.supplierQuantity ?? 1,
    repeatable: variation?.repeatable ?? false,
    basePackageTitle: variation?.basePackageTitle ?? null,
    localId: crypto.randomUUID(),
    id: variation?.id,
    title: variation?.title ?? "",
    sku: variation?.sku ?? "",
    fazercardsSku: variation?.fazercardsSku ?? "",
    costUsd: variation?.costUsd != null ? String(variation.costUsd) : "0.00",
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
  const [view, setView] = useState<"list" | "catalog" | "editor">("list");
  const [products, setProducts] = useState<Product[]>([]);
  const [fundingCostBasis, setFundingCostBasis] = useState<FundingCostBasis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [importingCatalogId, setImportingCatalogId] = useState<string | null>(null);
  const [mutatingProductId, setMutatingProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requiredFields, setRequiredFields] = useState<FieldDraft[]>(defaultFields);
  const [variations, setVariations] = useState<VariationDraft[]>(defaultVariations);
  const [draggedVariation, setDraggedVariation] = useState<string | null>(null);
  const [customBaseId, setCustomBaseId] = useState("");
  const [customQuantity, setCustomQuantity] = useState(2);
  const [customPrice, setCustomPrice] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogItems, setCatalogItems] = useState<FazerCardsCatalogItem[]>([]);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);

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
      const loaded = await fetchProducts();
      setProducts(loaded.products);
      setFundingCostBasis(loaded.fundingCostBasis);
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
        if (!cancelled) {
          setProducts(loadedProducts.products);
          setFundingCostBasis(loadedProducts.fundingCostBasis);
        }
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
    try {

    const action = String(formData.get("action") ?? "save");
    const shouldPublish = action === "publish";
    if (shouldPublish && !variations.some((variation) => variation.active && variation.available && Number(variation.priceMyr) > 0)) {
      setMessage("Choose at least one package to sell and enter its price.");
      return;
    }

    const payload = {
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      type: String(formData.get("type") ?? ""),
      category: String(formData.get("category") ?? ""),
      game: String(formData.get("game") ?? ""),
      leaderboardUnit: String(formData.get("leaderboardUnit") ?? ""),
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
        .map((variation) => {
          const priceMyr = Number(variation.priceMyr);

          return {
            id: variation.id,
            currencyUnits: Number(variation.currencyUnits),
            supplierQuantity: variation.supplierQuantity,
            repeatable: variation.repeatable,
            basePackageTitle: variation.basePackageTitle,
            title: variation.title,
            sku: variation.sku,
            fazercardsSku: variation.fazercardsSku,
            costUsd: Number(variation.costUsd),
            priceMyr,
            costMyr: Number(variation.costMyr),
            active: variation.active,
            available: variation.available && priceMyr > 0,
          };
        }),
      active: shouldPublish || Boolean(editingProduct && formData.get("active") === "on"),
      available: shouldPublish || Boolean(editingProduct && formData.get("available") === "on"),
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
    setView("list");
    setRequiredFields(defaultFields.map((field) => fieldDraft(field)));
    setVariations(defaultVariations.map(cloneDefaultVariation));
    await loadProducts();
    } catch {
      setMessage("Could not save. Your edits are still here. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(product: Product) {
    setCustomBaseId(""); setCustomQuantity(2); setCustomPrice("");
    setView("editor");
    setEditingProduct(product);
    setMessage(null);
    setRequiredFields(product.requiredFields.length ? product.requiredFields.map(fieldDraft) : []);
    setVariations(product.variations.length ? product.variations.map(variationDraft) : [variationDraft()]);
    document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditing() {
    if (view === "editor" && !window.confirm("Leave this editor? Unsaved changes will be discarded.")) return;
    setView("list");
    setEditingProduct(null);
    setMessage(null);
    setRequiredFields(defaultFields.map((field) => fieldDraft(field)));
    setVariations(defaultVariations.map(cloneDefaultVariation));
  }

  async function updateProductStatus(product: Product, next: { active?: boolean; available?: boolean }) {
    setMutatingProductId(product.id);
    setMessage(null);
    try {

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
    } catch {
      setMessage("Could not update visibility. Please refresh and try again.");
    } finally {
      setMutatingProductId(null);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.title}? This removes its variations too.`)) {
      return;
    }

    setMutatingProductId(product.id);
    setMessage(null);
    try {

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
    } catch {
      setMessage("Deletion could not be confirmed. Refresh before retrying.");
    } finally {
      setMutatingProductId(null);
    }
  }

  async function searchCatalog() {
    if (isSearchingCatalog) return;
    setIsSearchingCatalog(true);
    setMessage(null);
    setCatalogWarnings([]);
    try {
    const params = new URLSearchParams({ kind: catalogKind, q: catalogSearch });
    const response = await fetch(`/api/admin/fazercards/catalog?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    setIsSearchingCatalog(false);

    if (!response.ok) {
      setMessage(body.error ?? "FazerCards catalog could not be searched.");
      return;
    }

    setCatalogItems(body.items ?? []);
    setCatalogWarnings(body.warnings ?? []);
    if (!(body.items ?? []).length) setMessage("No matching products. Try a different game name.");
    } catch {
      setMessage("Search could not connect. Please try again.");
    } finally {
      setIsSearchingCatalog(false);
    }
  }

  async function importCatalogItem(item: FazerCardsCatalogItem) {
    setImportingCatalogId(item.id);
    setMessage(null);
    try {

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

    const loaded = await fetchProducts();
    setProducts(loaded.products);
    setFundingCostBasis(loaded.fundingCostBasis);
    const imported = loaded.products.find((product) => product.id === body.productId);
    if (imported) startEditing(imported);
    else { setView("list"); setMessage("Product imported. Open it to set your prices."); }
    } catch {
      setMessage("Import could not be confirmed. Refresh your products before retrying.");
    } finally {
      setImportingCatalogId(null);
    }
  }

  function updateField(localId: string, patch: Partial<FieldDraft>) {
    setRequiredFields((current) =>
      current.map((field) => (field.localId === localId ? { ...field, ...patch } : field)),
    );
  }

  function updateVariation(localId: string, patch: Partial<VariationDraft>) {
    setVariations((current) => {
      const next = current.map((variation) => variation.localId === localId ? { ...variation, ...patch } : variation);
      return next.map((variation) => {
        if (variation.supplierQuantity === 1) return variation;
        const base = next.find((item) => item.supplierQuantity === 1 && item.fazercardsSku === variation.fazercardsSku);
        return base ? { ...variation, basePackageTitle: base.title,
          costUsd: String(Math.round(Number(base.costUsd) * variation.supplierQuantity * 10000) / 10000),
          costMyr: String(Math.round(Number(base.costMyr) * variation.supplierQuantity * 100) / 100),
          currencyUnits: String(Number(base.currencyUnits) * variation.supplierQuantity) } : variation;
      });
    });
  }

  const customSources = variations.filter((v) => v.supplierQuantity === 1 && v.repeatable
    && v.fazercardsSku && isRepeatableCurrency(v.title));
  const customBase = customSources.find((v) => v.localId === customBaseId);
  function addCustomPackage() {
    if (!customBase || !Number.isInteger(customQuantity) || customQuantity < 2 || customQuantity > 5
      || !Number.isFinite(Number(customPrice)) || Number(customPrice) <= 0) {
      setMessage("Select a repeatable currency package, quantity 2 to 5, and a positive selling price.");
      return;
    }
    setVariations((current) => [...current, variationDraft({
      title: `${customQuantity} x ${customBase.title}`, sku: `custom-${crypto.randomUUID()}`,
      fazercardsSku: customBase.fazercardsSku, supplierQuantity: customQuantity,
      repeatable: true, basePackageTitle: customBase.title,
      currencyUnits: Number(customBase.currencyUnits) * customQuantity,
      costUsd: Math.round(Number(customBase.costUsd) * customQuantity * 10000) / 10000,
      costMyr: Math.round(Number(customBase.costMyr) * customQuantity * 100) / 100,
      priceMyr: Number(customPrice), active: true, available: true,
    })]);
    setMessage("Custom package added. Save changes to publish it with this listing.");
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold">{view === "editor" ? editingProduct?.title ?? "New product" : view === "catalog" ? "Add from FazerCards" : "My products"}</h2>
          {fundingCostBasis && <p className="mt-2 text-sm text-slate-600">USD 1 = RM {fundingCostBasis.rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</p>}
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

      {view !== "editor" && <nav className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3" aria-label="Product workspace">
        <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`px-3 py-2 text-sm font-semibold ${view === "list" ? "border-b-2 border-sky-600 text-sky-700" : "text-slate-600"}`}>My products ({products.length})</button>
        <button type="button" onClick={() => setView("catalog")} aria-pressed={view === "catalog"} className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${view === "catalog" ? "border-b-2 border-sky-600 text-sky-700" : "text-slate-600"}`}><Plus className="h-4 w-4" />Add from FazerCards</button>
        <button type="button" onClick={() => { cancelEditing(); setView("editor"); }} className="ml-auto text-sm font-semibold text-slate-600">Create manually</button>
      </nav>}
      {message && <p role="status" className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{message}</p>}

      {view === "catalog" && <div className="grid min-w-0 gap-4 py-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h3 className="font-display text-2xl font-bold text-slate-950">Import from FazerCards</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <select
              value={catalogKind}
              onChange={(event) => setCatalogKind(event.target.value as CatalogKind)}
              className="rounded-md border border-sky-200 bg-white px-3 py-3 text-sm font-semibold"
            >
              <option value="all">All libraries</option>
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
              placeholder="Search Forza Horizon, Mobile Legends, Valorant..."
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
        {catalogWarnings.length > 0 ? (
          <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-800">
            {catalogWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {catalogItems.length > 0 ? (
          <div className="grid max-h-96 gap-2 overflow-y-auto">
            {catalogItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex flex-col justify-between gap-3 rounded-md border border-sky-100 bg-white p-3 md:flex-row md:items-center">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-950">{item.name}</p>
                  <p className="break-all text-xs font-semibold text-slate-500">{item.kind.replace("_", " ")} / {item.id}</p>
                  {item.note ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.note}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void importCatalogItem(item)}
                  disabled={importingCatalogId !== null}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {importingCatalogId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Add & set prices
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>}

      {view === "editor" && <form id="product-editor" key={editingProduct?.id ?? "new"} action={onSubmit} className="grid min-w-0 gap-5">
        <div className="flex flex-col justify-between gap-3 rounded-md bg-slate-50 p-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">
              {editingProduct ? "Editing listing" : "New manual listing"}
            </p>
          </div>
          {(
            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            >
              <X className="h-4 w-4" />
              Back to products
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field name="title" label="Product title" placeholder="Mobile Legends (Malaysia)" defaultValue={editingProduct?.title} />
          <SelectField name="region" label="Region" defaultValue={editingProduct?.region ?? "MY"} options={[["MY", "Malaysia"], ["SEA", "Southeast Asia"], ["Global", "Global"]]} />
          <Field name="leaderboardUnit" label="Leaderboard unit" placeholder="Diamonds or UC" defaultValue={editingProduct?.leaderboardUnit ?? ""} required={false} />
        </div>
        <details open={!editingProduct} className="border-y border-slate-200 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">Advanced product settings</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field name="slug" label="Slug" placeholder="mobile-legends-malaysia" defaultValue={editingProduct?.slug} />
          <SelectField name="type" label="Type" defaultValue={editingProduct?.type ?? "topup"} options={[["topup", "Game top-up"], ["steam_gift_game", "Steam gift game"]]} />
          <Field name="category" label="Category" placeholder="Game Top-Ups" defaultValue={editingProduct?.category ?? "Game Top-Ups"} />
          <Field name="game" label="Game" placeholder="Mobile Legends" defaultValue={editingProduct?.game} />
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
        </details>

        <div className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-700 md:grid-cols-2">
          <label className="flex items-center gap-3">
            <input name="active" type="checkbox" defaultChecked={editingProduct?.active ?? false} className="h-4 w-4" />
            Show on public website
          </label>
          <label className="flex items-center gap-3">
            <input name="available" type="checkbox" defaultChecked={editingProduct?.available ?? false} className="h-4 w-4" />
            Available for checkout
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Description
          <textarea name="description" defaultValue={editingProduct?.description ?? ""} className="min-h-20 rounded-md border border-slate-200 px-3 py-3" />
        </label>

        <details className="border-b border-slate-200 pb-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Customer details ({requiredFields.length} fields)</summary>
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
        </details>

        <EditorPanel
          title="Packages & prices"
          actionLabel="Add package"
          onAdd={() => setVariations((current) => [...current, variationDraft()])}
        >
          {editingProduct?.type === "topup" && <fieldset className="grid min-w-0 gap-3 border-b border-slate-200 pb-5 sm:grid-cols-2 xl:grid-cols-4">
            <legend className="mb-3 text-base font-bold">Custom package</legend>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Existing package
              <select value={customBaseId} onChange={(event) => {
                setCustomBaseId(event.target.value);
                const source = customSources.find((v) => v.localId === event.target.value);
                setCustomPrice(source ? (Number(source.priceMyr) * customQuantity).toFixed(2) : "");
              }} className="min-w-0 rounded-md border border-slate-300 px-3 py-3">
                <option value="">{customSources.length ? "Select package" : "No repeatable currency packages"}</option>
                {customSources.map((v) => <option key={v.localId} value={v.localId}>{v.title}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">Quantity
              <select value={customQuantity} onChange={(event) => {
                const quantity = Number(event.target.value); setCustomQuantity(quantity);
                if (customBase) setCustomPrice((Number(customBase.priceMyr) * quantity).toFixed(2));
              }} className="min-w-0 rounded-md border border-slate-300 px-3 py-3">
                {[2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
              </select>
            </label>
            <SmallInput label="Your package price (RM)" type="number" value={customPrice} onChange={setCustomPrice} placeholder="0.00" />
            <button type="button" disabled={isSaving || !customBase} onClick={addCustomPackage}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Plus className="h-4 w-4" />Add custom package</button>
          </fieldset>}
          <div className="flex justify-end">
            <button type="button" disabled={isSaving || variations.length < 2}
              onClick={() => setVariations((current) => [...current].sort((a, b) => Number(a.priceMyr) - Number(b.priceMyr)))}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">
              <ArrowDownWideNarrow className="h-4 w-4" />Price: low to high
            </button>
          </div>
          <div className="grid gap-3">
            {variations.map((variation, index) => (
              <div key={variation.localId}
                data-variation-id={variation.localId}
                className={`grid min-w-0 gap-3 border-b border-slate-200 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] ${draggedVariation === variation.localId ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-4">
                  <button type="button" disabled={isSaving}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggedVariation(variation.localId);
                    }}
                    onPointerUp={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-variation-id]")?.dataset.variationId;
                      if (target && !isSaving) setVariations((current) => moveVariation(current, variation.localId, target));
                      event.currentTarget.releasePointerCapture(event.pointerId);
                      setDraggedVariation(null);
                    }}
                    onPointerCancel={() => setDraggedVariation(null)}
                    onLostPointerCapture={() => setDraggedVariation(null)}
                    title={`Drag ${variation.title || "package"} to reorder`} aria-label={`Drag ${variation.title || "package"} to reorder`}
                    className="inline-flex h-10 w-10 touch-none cursor-grab items-center justify-center rounded-md border border-slate-200 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-sm tabular-nums text-slate-500">{index + 1}</span>
                  <button type="button" disabled={isSaving || index === 0}
                    onClick={() => setVariations((current) => moveVariation(current, variation.localId, current[index - 1].localId))}
                    title="Move package up" aria-label={`Move ${variation.title || "package"} up`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={isSaving || index === variations.length - 1}
                    onClick={() => setVariations((current) => moveVariation(current, variation.localId, current[index + 1].localId))}
                    title="Move package down" aria-label={`Move ${variation.title || "package"} down`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <SmallInput label="Package" value={variation.title} onChange={(value) => updateVariation(variation.localId, { title: value })} placeholder="Weekly Diamond Pass" />
                {variation.supplierQuantity > 1 && <p className="text-sm text-slate-600 sm:col-span-2 xl:col-span-4">{variation.supplierQuantity} x {variation.basePackageTitle}</p>}
                <details className="order-last min-w-0 sm:col-span-2 xl:col-span-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500">Supplier mapping</summary>
                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">
                <SmallInput label="Store SKU" value={variation.sku} onChange={(value) => updateVariation(variation.localId, { sku: value })} placeholder="mlbb-weekly-pass" />
                <SmallInput label="Provider SKU" value={variation.fazercardsSku} onChange={(value) => updateVariation(variation.localId, { fazercardsSku: value })} placeholder="category:offer" />
                <SmallInput label="Cost USD" type="number" value={variation.costUsd} onChange={(value) => updateVariation(variation.localId, { costUsd: value })} placeholder="2.00" />
                </div>
                </details>
                {Number(variation.costUsd) > 0 ? <div className="min-w-0 text-xs text-slate-600">
                  <span className="font-semibold">Estimated cost MYR</span>
                  <p className="mt-2 text-base font-semibold text-slate-900">{fundingCostBasis && Number.isFinite(Number(variation.costUsd))
                    ? formatMyr(estimateCostMyr(Number(variation.costUsd), fundingCostBasis.rate))
                    : "Funding cost unavailable"}</p>
                </div> : <SmallInput label="Manual cost MYR" type="number" value={variation.costMyr} onChange={(value) => updateVariation(variation.localId, { costMyr: value })} placeholder="8.00" />}
                <SmallInput label="Your price (RM)" type="number" value={variation.priceMyr} onChange={(value) => updateVariation(variation.localId, { priceMyr: value })} placeholder="0.00" />
                <div className="grid gap-2 text-xs font-bold text-slate-600">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={variation.active && variation.available} onChange={(event) => updateVariation(variation.localId, { active: event.target.checked, available: event.target.checked })} />
                    Sell this package
                  </label>
                  {editingProduct?.type === "topup" && variation.supplierQuantity === 1 && isRepeatableCurrency(variation.title) && <label className="flex items-center gap-2 text-sm font-normal" title="Enable only for currency top-ups that can be purchased repeatedly. Passes and subscriptions are excluded.">
                    <input type="checkbox" checked={variation.repeatable} onChange={(event) => updateVariation(variation.localId, { repeatable: event.target.checked })} />Repeatable currency top-up
                  </label>}
                  {editingProduct?.type === "topup" && variation.supplierQuantity === 1 && isRankingCurrency(variation.title) && <SmallInput
                    label="Leaderboard currency units (0 = excluded)" type="number" value={variation.currencyUnits}
                    onChange={(value) => updateVariation(variation.localId, { currencyUnits: value })} placeholder="0" />}
                  {variation.supplierQuantity > 1 && <p className="font-normal">Ranking units: {Number(variation.currencyUnits) || 0}</p>}
                </div>
                {!variation.id && <button
                  type="button"
                  onClick={() => setVariations((current) => current.filter((item) => item.localId !== variation.localId))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700"
                  aria-label="Remove package"
                  title="Remove package"
                >
                  <Trash2 className="h-4 w-4" />
                </button>}
              </div>
            ))}
          </div>
        </EditorPanel>

        <div className="sticky bottom-0 z-10 grid gap-2 border-t border-slate-200 bg-white p-3 sm:grid-cols-2">
          <button
            type="submit"
            name="action"
            value="save"
            disabled={isSaving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-200 px-5 py-3 font-bold text-slate-800 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {editingProduct ? "Save changes" : "Save draft"}
          </button>
          <button
            type="submit"
            name="action"
            value="publish"
            disabled={isSaving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Save & publish
          </button>
        </div>
      </form>}

      {view === "list" && <div className="grid min-w-0 gap-3">
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
                      <p className="max-w-80 break-words font-bold">{product.title}</p>
                      <p className="max-w-80 break-all text-xs text-slate-500">{product.slug}</p>
                    </td>
                    <td className="px-4 py-4">{product.type === "topup" ? "Top-up" : "Steam gift"}</td>
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
      </div>}
    </section>
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
    <div className="grid min-w-0 gap-3 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
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
    <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 w-full rounded-md border border-slate-200 px-2 py-2 text-sm font-medium text-slate-900"
      />
    </label>
  );
}
