"use client";

import { useState } from "react";
import { nanoid } from "nanoid";

import type { HolidayType, Product } from "@/types/product";

const DEFAULT_DRAFT = {
  sku: "",
  name: "",
  category: "Imported",
  holiday: "everyday" as HolidayType,
  width: 8,
  height: 9,
  depth: 4,
  color: "#6f8ca8",
};

export function ProductForm({
  onCreate,
}: {
  onCreate: (product: Product) => void;
}) {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] p-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!draft.sku.trim() || !draft.name.trim()) {
          return;
        }

        onCreate({
          id: nanoid(),
          sku: draft.sku.trim(),
          name: draft.name.trim(),
          description: "",
          category: draft.category.trim() || "Imported",
          holiday: draft.holiday,
          dimensions: {
            width: draft.width,
            height: draft.height,
            depth: draft.depth,
          },
          color: draft.color,
          unitsPerCase: 12,
        });

        setDraft(DEFAULT_DRAFT);
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            SKU
          </span>
          <input
            className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 outline-none transition-colors focus:border-[var(--primary)]"
            onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))}
            value={draft.sku}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Category
          </span>
          <input
            className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 outline-none transition-colors focus:border-[var(--primary)]"
            onChange={(event) =>
              setDraft((current) => ({ ...current, category: event.target.value }))
            }
            value={draft.category}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          Product name
        </span>
        <input
          className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 outline-none transition-colors focus:border-[var(--primary)]"
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          value={draft.name}
        />
      </label>

      <div className="grid grid-cols-4 gap-3">
        {(["width", "height", "depth"] as const).map((key) => (
          <label className="block" key={key}>
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              {key}
            </span>
            <input
              className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 outline-none transition-colors focus:border-[var(--primary)]"
              min={1}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [key]: Number(event.target.value),
                }))
              }
              type="number"
              value={draft[key]}
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            Holiday
          </span>
          <select
            className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 outline-none transition-colors focus:border-[var(--primary)]"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                holiday: event.target.value as Product["holiday"],
              }))
            }
            value={draft.holiday}
          >
            <option value="everyday">Everyday</option>
            <option value="christmas">Christmas</option>
            <option value="hanukkah">Hanukkah</option>
            <option value="passover">Passover</option>
            <option value="rosh-hashanah">Rosh Hashanah</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>Color</span>
          <input
            className="h-10 w-14 rounded-lg border border-[var(--line-strong)] bg-transparent"
            onChange={(event) =>
              setDraft((current) => ({ ...current, color: event.target.value }))
            }
            type="color"
            value={draft.color}
          />
        </label>

        <button
          className="min-h-[44px] rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
          type="submit"
        >
          Add product
        </button>
      </div>
    </form>
  );
}
