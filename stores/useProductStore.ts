"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { Product } from "@/types/product";

interface ProductStore {
  products: Product[];
  isLoading: boolean;
  search: string;
  category: string;
  activeProductId: string | null;
  fetchProducts: (customerId?: string) => Promise<void>;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  setActiveProduct: (id: string | null) => void;
  addProduct: (product: Product, customerId?: string) => Promise<void>;
  importProducts: (products: Product[], customerId?: string) => Promise<void>;
  replaceProducts: (products: Product[]) => void;
  removeProduct: (id: string) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  upsertProduct: (product: Product) => void;
}

export const useProductStore = create<ProductStore>()(
  immer((set, get) => ({
    products: [],
    isLoading: false,
    search: "",
    category: "all",
    activeProductId: null,
    fetchProducts: async (customerId) => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const query = customerId
          ? `?customerId=${encodeURIComponent(customerId)}`
          : "";
        const response = await fetch(`/api/products${query}`);
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        const products = (await response.json()) as Product[];
        set((state) => {
          state.products = products;
          state.activeProductId = null;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },
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
    addProduct: async (product, customerId) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...product,
          customerId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add product");
      }

      const saved = (await response.json()) as Product;
      set((state) => {
        state.products.unshift(saved);
      });
    },
    importProducts: async (products, customerId) => {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, customerId }),
      });

      if (!response.ok) {
        throw new Error("Failed to import products");
      }

      await get().fetchProducts(customerId);
    },
    replaceProducts: (products) =>
      set((state) => {
        const existingById = new Map(state.products.map((product) => [product.id, product]));

        state.products = products.map((product) => ({
          ...product,
          ...(existingById.get(product.id) ?? {}),
        }));
        state.activeProductId = null;
        state.search = "";
        state.category = "all";
      }),
    removeProduct: async (id) => {
      const response = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove product");
      }

      set((state) => {
        state.products = state.products.filter((product) => product.id !== id);

        if (state.activeProductId === id) {
          state.activeProductId = null;
        }
      });
    },
    updateProduct: async (id, updates) => {
      const current = get().products.find((product) => product.id === id);
      if (!current) {
        throw new Error("Product not found");
      }

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...current,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update product");
      }

      const saved = (await response.json()) as Product;
      set((state) => {
        const idx = state.products.findIndex((product) => product.id === id);
        if (idx !== -1) {
          state.products[idx] = saved;
        }
      });
    },
    upsertProduct: (product: Product) =>
      set((state) => {
        const idx = state.products.findIndex((entry) => entry.id === product.id);
        if (idx === -1) {
          state.products.push(product);
        } else {
          state.products[idx] = {
            ...state.products[idx],
            ...product,
          };
        }
      }),
  })),
);
