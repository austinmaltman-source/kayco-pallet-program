"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { Product } from "@/types/product";

interface ProductStore {
  products: Product[];
  search: string;
  category: string;
  activeProductId: string | null;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  setActiveProduct: (id: string | null) => void;
  addProduct: (product: Product) => void;
  importProducts: (products: Product[]) => void;
  replaceProducts: (products: Product[]) => void;
  removeProduct: (id: string) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  upsertProduct: (product: Product) => void;
}

export const useProductStore = create<ProductStore>()(
  persist(
    immer((set) => ({
      products: [],
      search: "",
      category: "all",
      activeProductId: null,
      setSearch: (value) =>
        set((state) => {
          state.search = value;
        }),
      setCategory: (value) =>
        set((state) => {
          state.category = value;
        }),
      setActiveProduct: (id) =>
        set((state) => {
          state.activeProductId = id;
        }),
      addProduct: (product) =>
        set((state) => {
          state.products.unshift(product);
        }),
      importProducts: (products) =>
        set((state) => {
          const existingSkus = new Set(
            state.products.map((product) => product.sku),
          );
          const nextProducts = products.filter(
            (product) => !existingSkus.has(product.sku),
          );
          state.products.unshift(...nextProducts);
        }),
      replaceProducts: (products) =>
        set((state) => {
          const existingById = new Map(
            state.products.map((product) => [product.id, product]),
          );

          state.products = products.map((product) => ({
            ...product,
            ...(existingById.get(product.id) ?? {}),
          }));
          state.activeProductId = null;
          state.search = "";
          state.category = "all";
        }),
      removeProduct: (id) =>
        set((state) => {
          state.products = state.products.filter((product) => product.id !== id);

          if (state.activeProductId === id) {
            state.activeProductId = null;
          }
        }),
      updateProduct: (id, updates) =>
        set((state) => {
          const idx = state.products.findIndex((p) => p.id === id);
          if (idx !== -1) {
            Object.assign(state.products[idx], updates);
          }
        }),
      upsertProduct: (product: Product) =>
        set((state) => {
          const idx = state.products.findIndex((p) => p.id === product.id);
          if (idx === -1) {
            state.products.push(product);
          } else {
            Object.assign(state.products[idx], product);
          }
        }),
    })),
    {
      name: "kayco-product-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
