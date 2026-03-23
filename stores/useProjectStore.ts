"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { PalletConfig } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";
import type { BuilderProject } from "@/types/project";

interface ProjectStore {
  projects: BuilderProject[];
  activeProjectId: string | null;
  loadFromStorage: () => Promise<void>;
  saveProject: (params: {
    name?: string;
    pallet: PalletConfig;
    products: Product[];
    placements: PlacedItem[];
  }) => Promise<BuilderProject>;
  deleteProject: (id: string) => Promise<void>;
  setProjects: (projects: BuilderProject[]) => void;
  setActiveProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    projects: [],
    activeProjectId: null,
    loadFromStorage: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const projects = (await response.json()) as BuilderProject[];
      set((state) => {
        state.projects = projects;
      });
    },
    saveProject: async ({ name, pallet, products, placements }) => {
      const now = new Date().toISOString();
      const projectName = name?.trim() || `Pallet Project ${new Date().toLocaleDateString()}`;
      const existingId = get().activeProjectId;
      const existing = existingId
        ? get().projects.find((project) => project.id === existingId)
        : undefined;

      const project: BuilderProject = {
        id: existing?.id ?? nanoid(),
        name: projectName,
        description: existing?.description,
        pallet,
        products,
        placements,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        version: 1,
      };

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        throw new Error("Failed to save project");
      }

      set((state) => {
        state.projects = [project, ...state.projects.filter((item) => item.id !== project.id)];
        state.activeProjectId = project.id;
      });

      return project;
    },
    deleteProject: async (id) => {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      set((state) => {
        const nextProjects = state.projects.filter((project) => project.id !== id);
        state.projects = nextProjects;

        if (state.activeProjectId === id) {
          state.activeProjectId = null;
        }
      });
    },
    setProjects: (projects) =>
      set((state) => {
        state.projects = projects;
      }),
    setActiveProjectId: (id) =>
      set((state) => {
        state.activeProjectId = id;
      }),
  })),
);
