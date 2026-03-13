"use client";

import { create } from "zustand";
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
}

export const useProductStore = create<ProductStore>()(
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
        const existingSkus = new Set(state.products.map((product) => product.sku));
        const nextProducts = products.filter((product) => !existingSkus.has(product.sku));
        state.products.unshift(...nextProducts);
      }),
    replaceProducts: (products) =>
      set((state) => {
        state.products = products;
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
  })),
);
