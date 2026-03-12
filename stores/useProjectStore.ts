"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { storageService } from "@/services/storageService";
import type { PalletConfig } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";
import type { BuilderProject } from "@/types/project";

interface ProjectStore {
  projects: BuilderProject[];
  activeProjectId: string | null;
  loadFromStorage: () => void;
  saveProject: (params: {
    name?: string;
    pallet: PalletConfig;
    products: Product[];
    placements: PlacedItem[];
  }) => BuilderProject;
  deleteProject: (id: string) => void;
  setProjects: (projects: BuilderProject[]) => void;
  setActiveProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    projects: [],
    activeProjectId: null,
    loadFromStorage: () => {
      storageService.listProjects().then((projects) => {
        set((state) => {
          state.projects = projects;
        });
      });
    },
    saveProject: ({ name, pallet, products, placements }) => {
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

      set((state) => {
        const nextProjects = [project, ...state.projects.filter((item) => item.id !== project.id)];
        state.projects = nextProjects;
        state.activeProjectId = project.id;
        storageService.saveProjects(nextProjects);
      });

      return project;
    },
    deleteProject: (id) =>
      set((state) => {
        const nextProjects = state.projects.filter((project) => project.id !== id);
        state.projects = nextProjects;

        if (state.activeProjectId === id) {
          state.activeProjectId = null;
        }

        storageService.saveProjects(nextProjects);
      }),
    setProjects: (projects) =>
      set((state) => {
        state.projects = projects;
        storageService.saveProjects(projects);
      }),
    setActiveProjectId: (id) =>
      set((state) => {
        state.activeProjectId = id;
      }),
  })),
);
