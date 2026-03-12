import { PROJECT_STORAGE_KEY } from "@/lib/constants";
import type { BuilderProject } from "@/types/project";

export interface StorageAdapter {
  listProjects(): Promise<BuilderProject[]>;
  saveProject(project: BuilderProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

// --- localStorage adapter (default, works offline) ---

const localStorageAdapter: StorageAdapter = {
  async listProjects() {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as BuilderProject[]) : [];
    } catch {
      return [];
    }
  },

  async saveProject(project) {
    if (typeof window === "undefined") return;
    const existing = await this.listProjects();
    const filtered = existing.filter((p) => p.id !== project.id);
    const updated = [project, ...filtered];
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(updated));
  },

  async deleteProject(id) {
    if (typeof window === "undefined") return;
    const existing = await this.listProjects();
    const updated = existing.filter((p) => p.id !== id);
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(updated));
  },
};

// --- API adapter (uses Next.js API routes + Neon Postgres) ---

const apiStorageAdapter: StorageAdapter = {
  async listProjects() {
    const response = await fetch("/api/projects");
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  },

  async saveProject(project) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error("Failed to save project");
  },

  async deleteProject(id) {
    const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete project");
  },
};

// --- Adapter selector ---
// Set window.__KAYCO_USE_API_STORAGE__ = true to use API adapter.
// By default, uses localStorage for offline/demo use.

declare global {
  interface Window {
    __KAYCO_USE_API_STORAGE__?: boolean;
  }
}

function getAdapter(): StorageAdapter {
  if (typeof window !== "undefined" && window.__KAYCO_USE_API_STORAGE__) {
    return apiStorageAdapter;
  }
  return localStorageAdapter;
}

export const storageService = {
  listProjects() {
    return getAdapter().listProjects();
  },
  saveProject(project: BuilderProject) {
    return getAdapter().saveProject(project);
  },
  deleteProject(id: string) {
    return getAdapter().deleteProject(id);
  },

  // Legacy compat — the project store uses this
  saveProjects(projects: BuilderProject[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  },
};
