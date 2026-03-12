"use client";

import { useId } from "react";
import { Download, FolderOpen, ImageDown, Save } from "lucide-react";

import type { BuilderProject } from "@/types/project";

export function ProjectToolbar({
  projectName,
  projects,
  onProjectNameChange,
  onSave,
  onExportJson,
  onExportImage,
  onExportPdf,
  onImportProject,
  onLoadProject,
  onDeleteProject,
}: {
  projectName: string;
  projects: BuilderProject[];
  onProjectNameChange: (value: string) => void;
  onSave: () => void;
  onExportJson: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onImportProject: (file: File) => void;
  onLoadProject: (project: BuilderProject) => void;
  onDeleteProject: (id: string) => void;
}) {
  const importId = useId();

  return (
    <section className="panel-surface rounded-[32px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-[11px] text-[var(--muted)]">Projects</p>
          <h2 className="display-font mt-1 text-lg font-semibold">Save and export</h2>
        </div>
        <label
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white/75 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white"
          htmlFor={importId}
        >
          <FolderOpen className="h-4 w-4" />
          Import
        </label>
        <input
          className="hidden"
          id={importId}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onImportProject(file);
            }

            event.target.value = "";
          }}
          type="file"
        />
      </div>

      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="Project name"
          value={projectName}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
            onClick={onSave}
            type="button"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white"
            onClick={onExportJson}
            type="button"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>
          <button
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white"
            onClick={onExportImage}
            type="button"
          >
            <ImageDown className="h-4 w-4" />
            PNG
          </button>
          <button
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white"
            onClick={onExportPdf}
            type="button"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {projects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
            No saved projects yet.
          </div>
        ) : (
          projects.map((project) => (
            <div
              className="flex items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-white/70 px-4 py-3"
              key={project.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{project.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {new Date(project.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="min-h-[44px] rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold transition-colors hover:bg-white"
                  onClick={() => onLoadProject(project)}
                  type="button"
                >
                  Load
                </button>
                <button
                  className="min-h-[44px] rounded-full bg-[rgba(154,67,62,0.12)] px-3 py-2 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[rgba(154,67,62,0.18)]"
                  onClick={() => onDeleteProject(project.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
