"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { SAMPLE_PRODUCTS } from "@/lib/constants";
import type { HolidayType, Product } from "@/types/product";

interface ProductDraft {
  sku: string;
  name: string;
  category: string;
  holiday: HolidayType;
  width: number;
  height: number;
  depth: number;
  color: string;
}

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
}

export const defaultProductDraft: ProductDraft = {
  sku: "",
  name: "",
  category: "Imported",
  holiday: "everyday",
  width: 8,
  height: 9,
  depth: 4,
  color: "#6f8ca8",
};

export const useProductStore = create<ProductStore>()(
  persist(
    immer((set) => ({
      products: SAMPLE_PRODUCTS,
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
          const existingSkus = new Set(state.products.map((product) => product.sku));
          const nextProducts = products.filter((product) => !existingSkus.has(product.sku));
          state.products.unshift(...nextProducts);
        }),
      replaceProducts: (products) =>
        set((state) => {
          state.products = products;
        }),
      removeProduct: (id) =>
        set((state) => {
          state.products = state.products.filter((product) => product.id !== id);

          if (state.activeProductId === id) {
            state.activeProductId = null;
          }
        }),
    })),
    {
      name: "kayco-product-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        products: state.products,
      }),
    },
  ),
);
