"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Grid3X3, Layers3, Undo2, Redo2 } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

import { ProductCatalog } from "@/components/catalog/ProductCatalog";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { ProjectToolbar } from "@/components/toolbar/ProjectToolbar";

const SceneRoot = dynamic(() => import("@/components/scene/SceneRoot").then((m) => m.SceneRoot), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
      Loading 3D scene...
    </div>
  ),
});
import { exportProjectJson, exportProjectPdf, exportViewportImage, importProjectJson } from "@/services/exportService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { PALLET_COPY, WALL_FACES, WALL_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useUIStore } from "@/stores/useUIStore";
import type { BuilderProject } from "@/types/project";

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs text-white shadow-lg animate-in fade-in-0 zoom-in-95"
          sideOffset={6}
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--foreground)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ControlPill({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label?: string;
  onClick: () => void;
}) {
  const button = (
    <button
      aria-pressed={active}
      className={cn(
        "min-h-[44px] rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-lg shadow-sky-900/15"
          : "border-[var(--line)] bg-white/70 text-[var(--foreground)] hover:border-[var(--line-strong)] hover:bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );

  if (label) {
    return <Tip label={label}>{button}</Tip>;
  }

  return button;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel-surface rounded-3xl p-4">
      <p className="eyebrow text-[11px] text-[var(--muted)]">{label}</p>
      <p className="mt-3 display-font text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function AppShell() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pallet = usePalletStore((state) => state.pallet);
  const reset = usePalletStore((state) => state.reset);
  const replacePallet = usePalletStore((state) => state.replacePallet);
  const setType = usePalletStore((state) => state.setType);
  const setBasePreset = usePalletStore((state) => state.setBasePreset);
  const updateBaseDimension = usePalletStore((state) => state.updateBaseDimension);
  const setGridColumns = usePalletStore((state) => state.setGridColumns);
  const toggleHeader = usePalletStore((state) => state.toggleHeader);

  const products = useProductStore((state) => state.products);
  const activeProductId = useProductStore((state) => state.activeProductId);
  const replaceProducts = useProductStore((state) => state.replaceProducts);
  const setActiveProduct = useProductStore((state) => state.setActiveProduct);

  const placements = usePlacementStore((state) => state.placements);
  const replacePlacements = usePlacementStore((state) => state.replacePlacements);
  const removeSelected = usePlacementStore((state) => state.removeSelected);
  const rotateSelected = usePlacementStore((state) => state.rotateSelected);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const undo = usePlacementStore((state) => state.undo);
  const redo = usePlacementStore((state) => state.redo);
  const clearPlacements = usePlacementStore((state) => state.clear);

  const activeView = useUIStore((state) => state.activeView);
  const selectedWall = useUIStore((state) => state.selectedWall);
  const showGrid = useUIStore((state) => state.showGrid);
  const draggingProductId = useUIStore((state) => state.draggingProductId);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);
  const toggleGrid = useUIStore((state) => state.toggleGrid);
  const setDraggingProductId = useUIStore((state) => state.setDraggingProductId);
  const setDropPreview = useUIStore((state) => state.setDropPreview);
  const requestCaptures = useUIStore((state) => state.requestCaptures);

  const projects = useProjectStore((state) => state.projects);
  const loadFromStorage = useProjectStore((state) => state.loadFromStorage);
  const saveProject = useProjectStore((state) => state.saveProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const setProjects = useProjectStore((state) => state.setProjects);
  const setActiveProjectId = useProjectStore((state) => state.setActiveProjectId);

  const [projectName, setProjectName] = useState("Holiday Program Layout");
  const [statusMessage, setStatusMessage] = useState("Ready for product import and placement.");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const selectedWallConfig = pallet.display.walls[selectedWall];
  const selectedProduct = products.find((product) => product.id === activeProductId) ?? null;
  const shelfPlacementCount = useMemo(
    () =>
      placements.filter((placement) => pallet.display.walls[placement.wall].wallType === "shelves").length,
    [pallet.display.walls, placements],
  );

  function snapshotProject(nameOverride?: string) {
    return saveProject({
      name: nameOverride ?? projectName,
      pallet,
      products,
      placements,
    });
  }

  function handleTypeChange(type: "full" | "half") {
    setType(type);

    if (type === "half") {
      replacePlacements(placements.filter((placement) => placement.wall === "front"));
      setSelectedWall("front");
      setStatusMessage("Switched to half pallet mode and kept front-wall placements.");
      return;
    }

    setStatusMessage("Switched to full pallet mode.");
  }

  function loadProject(project: BuilderProject) {
    replacePallet(project.pallet);
    replaceProducts(project.products);
    replacePlacements(project.placements);
    setActiveProjectId(project.id);
    setActiveView("isometric");
    setSelectedWall("front");
    setActiveProduct(null);
    selectPlacement(null);
    setDraggingProductId(null);
    setDropPreview(null);
    setProjectName(project.name);
    setStatusMessage(`Loaded ${project.name}.`);
  }

  useKeyboardShortcuts({
    onDelete: () => {
      removeSelected();
      setStatusMessage("Removed selected placement.");
    },
    onRotate: () => {
      rotateSelected(products, pallet);
      setStatusMessage("Rotated selected placement.");
    },
    onUndo: () => {
      undo();
      setStatusMessage("Undid last placement change.");
    },
    onRedo: () => {
      redo();
      setStatusMessage("Redid last placement change.");
    },
    onSave: () => {
      const project = snapshotProject();
      setStatusMessage(`Saved ${project.name}.`);
    },
  });

  return (
    <Tooltip.Provider>
    <main className="min-h-screen px-4 py-4 text-[var(--foreground)] md:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] flex-col gap-4">
        <header className="panel-surface rounded-[32px] px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow text-xs text-[var(--primary)]">Kayco design lab</p>
              <h1 className="display-font mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                {PALLET_COPY.headline}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-pretty text-[var(--muted)] md:text-base">
                {PALLET_COPY.subtitle}
              </p>
              <p aria-live="polite" className="mt-3 text-sm text-[var(--primary)]" role="status">{statusMessage}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 p-1">
                <ControlPill active={pallet.type === "full"} onClick={() => handleTypeChange("full")}>
                  Full pallet
                </ControlPill>
                <ControlPill active={pallet.type === "half"} onClick={() => handleTypeChange("half")}>
                  Half pallet
                </ControlPill>
              </div>

              <ControlPill active={showGrid} label="Toggle placement grid overlay" onClick={toggleGrid}>
                {showGrid ? "Grid on" : "Grid off"}
              </ControlPill>

              <ControlPill
                label="Remove all product placements"
                onClick={() => {
                  clearPlacements();
                  setStatusMessage("Cleared all placements.");
                }}
              >
                Clear placements
              </ControlPill>

              <ControlPill
                label="Reset pallet to default settings"
                onClick={() => {
                  reset();
                  replacePlacements([]);
                  setStatusMessage("Reset pallet configuration.");
                }}
              >
                Reset scene
              </ControlPill>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_1fr] xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <aside className="flex flex-col gap-4">
            <StatCard
              label="Program mode"
              value={pallet.type === "full" ? "4 selling faces" : "Endcap half pallet"}
              hint={
                pallet.type === "full"
                  ? "All four walls are configured as product-facing shelf systems."
                  : "Front face stays shoppable while the side walls switch to branded graphic panels."
              }
            />
            <StatCard
              label="Footprint"
              value={`${pallet.base.width}" x ${pallet.base.depth}"`}
              hint={`Pallet base height is ${pallet.base.height}" with four shelf rows above the deck.`}
            />
            <ProductCatalog onStatus={setStatusMessage} />
          </aside>

          <section className="panel-surface flex min-h-[780px] flex-col overflow-hidden rounded-[36px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="eyebrow text-[11px] text-[var(--muted)]">Viewport</p>
                <h2 className="display-font mt-1 text-xl font-semibold">3D pallet scene</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ControlPill active={activeView === "isometric"} onClick={() => setActiveView("isometric")}>
                  Isometric
                </ControlPill>
                {WALL_FACES.map((face) => (
                  <ControlPill
                    key={face}
                    active={activeView === face}
                    onClick={() => setActiveView(face)}
                  >
                    {WALL_LABELS[face]}
                  </ControlPill>
                ))}

                <div className="ml-2 flex items-center gap-1 border-l border-[var(--line)] pl-3">
                  <Tip label="Undo (Cmd+Z)">
                    <button
                      aria-label="Undo"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-white hover:text-[var(--foreground)]"
                      onClick={() => {
                        undo();
                        setStatusMessage("Undid last placement change.");
                      }}
                      type="button"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </Tip>
                  <Tip label="Redo (Cmd+Shift+Z)">
                    <button
                      aria-label="Redo"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-white hover:text-[var(--foreground)]"
                      onClick={() => {
                        redo();
                        setStatusMessage("Redid last placement change.");
                      }}
                      type="button"
                    >
                      <Redo2 className="h-4 w-4" />
                    </button>
                  </Tip>
                </div>
              </div>
            </div>

            <div className="scene-frame relative flex-1" ref={viewportRef}>
              <SceneRoot />
              <div className="pointer-events-none absolute inset-x-5 top-5 flex items-start justify-between gap-4">
                <div className="rounded-2xl border border-white/55 bg-white/60 px-4 py-3 shadow-lg backdrop-blur">
                  <p className="eyebrow text-[10px] text-[var(--muted)]">Selected wall</p>
                  <p className="mt-1 display-font text-lg font-semibold">{WALL_LABELS[selectedWall]}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {selectedWallConfig.wallType === "shelves"
                      ? `${selectedWallConfig.gridColumns} placement columns`
                      : selectedWallConfig.wallType}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/55 bg-white/60 px-4 py-3 text-right shadow-lg backdrop-blur">
                  <p className="eyebrow text-[10px] text-[var(--muted)]">Placement state</p>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                    {draggingProductId ? "Dragging product" : "Scene ready"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {selectedProduct
                      ? `Active product: ${selectedProduct.name}`
                      : "Select or drag a product from the catalog"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <ProjectToolbar
              onDeleteProject={(id) => {
                deleteProject(id);
                setStatusMessage("Deleted saved project.");
              }}
              onExportImage={async () => {
                if (!viewportRef.current) {
                  return;
                }

                await exportViewportImage(viewportRef.current, `${projectName || "pallet-view"}.png`);
                setStatusMessage("Exported viewport image.");
              }}
              onExportJson={() => {
                const project = snapshotProject();
                exportProjectJson(project, `${project.name}.pallet.json`);
                setStatusMessage("Exported JSON project file.");
              }}
              onExportPdf={async () => {
                setStatusMessage("Capturing wall views for PDF...");
                const captures = await requestCaptures();
                const project = snapshotProject();
                await exportProjectPdf(project, captures, `${project.name}.pdf`);
                setStatusMessage("Exported multi-page planogram PDF.");
              }}
              onImportProject={async (file) => {
                const project = await importProjectJson(file);
                const nextProjects = [project, ...projects.filter((entry) => entry.id !== project.id)];
                setProjects(nextProjects);
                loadProject(project);
              }}
              onLoadProject={loadProject}
              onProjectNameChange={setProjectName}
              onSave={() => {
                const project = snapshotProject();
                setStatusMessage(`Saved ${project.name}.`);
              }}
              projectName={projectName}
              projects={projects}
            />

            <section className="panel-surface rounded-[32px] p-5">
              <div className="flex items-center gap-3">
                <Box className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="display-font text-lg font-semibold">Pallet settings</h2>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--muted)]">Preset</span>
                  <select
                    className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition-colors focus:border-[var(--primary)]"
                    onChange={(event) => setBasePreset(event.target.value as typeof pallet.base.preset)}
                    value={pallet.base.preset}
                  >
                    <option value="48x40">48 x 40</option>
                    <option value="48x48">48 x 48</option>
                    <option value="42x42">42 x 42</option>
                    <option value="48x42">48 x 42</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {(["width", "depth", "height"] as const).map((dimension) => (
                    <label className="block" key={dimension}>
                      <span className="mb-2 block text-sm font-medium capitalize text-[var(--muted)]">
                        {dimension}
                      </span>
                      <input
                        className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 outline-none transition-colors focus:border-[var(--primary)]"
                        min={dimension === "height" ? 4 : 30}
                        onChange={(event) => updateBaseDimension(dimension, Number(event.target.value))}
                        type="number"
                        value={pallet.base[dimension]}
                      />
                    </label>
                  ))}
                </div>

                <label className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/65 px-4 py-3">
                  <span>
                    <span className="block font-medium">Header topper</span>
                    <span className="text-sm text-[var(--muted)]">
                      Keep the branded cap visible above the display tower.
                    </span>
                  </span>
                  <button
                    aria-label={`Header topper: ${pallet.display.header.enabled ? "enabled" : "disabled"}`}
                    aria-pressed={pallet.display.header.enabled}
                    className={cn(
                      "min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      pallet.display.header.enabled
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[rgba(24,33,43,0.08)] text-[var(--foreground)]",
                    )}
                    onClick={toggleHeader}
                    type="button"
                  >
                    {pallet.display.header.enabled ? "Enabled" : "Disabled"}
                  </button>
                </label>
              </div>
            </section>

            <section className="panel-surface rounded-[32px] p-5">
              <div className="flex items-center gap-3">
                <Layers3 className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="display-font text-lg font-semibold">Wall program</h2>
              </div>

              <div className="mt-5 grid gap-3">
                {WALL_FACES.map((face) => {
                  const wall = pallet.display.walls[face];

                  return (
                    <button
                      key={face}
                      className={cn(
                        "min-h-[44px] rounded-2xl border px-4 py-3 text-left transition-colors",
                        selectedWall === face
                          ? "border-[var(--primary)] bg-[rgba(20,78,131,0.08)]"
                          : "border-[var(--line)] bg-white/55 hover:border-[var(--line-strong)] hover:bg-white/75",
                      )}
                      onClick={() => setSelectedWall(face)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{WALL_LABELS[face]}</span>
                        <span className="rounded-full border border-[var(--line)] px-2 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          {wall.wallType}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {wall.wallType === "shelves"
                          ? `${wall.gridColumns} columns with branded dividers`
                          : wall.wallType === "branded-panel"
                            ? "Graphic support wall for half pallet mode"
                            : "Open rear face for against-wall placement"}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedWallConfig.wallType === "shelves" ? (
                <label className="mt-5 block rounded-2xl border border-[var(--line)] bg-white/65 px-4 py-4">
                  <span className="mb-2 block text-sm font-medium text-[var(--muted)]">Grid columns</span>
                  <input
                    className="w-full accent-[var(--primary)]"
                    max={8}
                    min={2}
                    onChange={(event) => setGridColumns(selectedWall, Number(event.target.value))}
                    type="range"
                    value={selectedWallConfig.gridColumns}
                  />
                  <div className="mt-2 flex items-center justify-between text-sm text-[var(--muted)]">
                    <span>2</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {selectedWallConfig.gridColumns} columns
                    </span>
                    <span>8</span>
                  </div>
                </label>
              ) : null}
            </section>

            <section className="panel-surface rounded-[32px] p-5">
              <div className="flex items-center gap-3">
                <Grid3X3 className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="display-font text-lg font-semibold">Builder summary</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                <p>
                  Saved projects:{" "}
                  <span className="font-semibold text-[var(--foreground)]">{projects.length}</span>
                </p>
                <p>
                  Active placements:{" "}
                  <span className="font-semibold text-[var(--foreground)]">{placements.length}</span>
                </p>
                <p>
                  Shelf placements:{" "}
                  <span className="font-semibold text-[var(--foreground)]">{shelfPlacementCount}</span>
                </p>
              </div>
            </section>

            <PropertiesPanel
              onDeleteSelected={() => {
                removeSelected();
                setStatusMessage("Removed selected placement.");
              }}
              onRotateSelected={() => {
                rotateSelected(products, pallet);
                setStatusMessage("Rotated selected placement.");
              }}
              pallet={pallet}
              products={products}
            />
          </aside>
        </div>

        <footer className="panel-surface flex flex-col gap-3 rounded-[28px] px-5 py-4 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>
            Active view: <span className="font-semibold text-[var(--foreground)]">{activeView}</span>
          </p>
          <p>
            Shelf rows:{" "}
            <span className="font-semibold text-[var(--foreground)]">{pallet.display.shelfRows}</span>{" "}
            with {pallet.display.rowHeight}&quot; row height and {pallet.display.stripHeight}&quot; branded strips
          </p>
          <p>
            Active product:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {selectedProduct?.name ?? "None"}
            </span>
          </p>
        </footer>
      </div>
    </main>
    </Tooltip.Provider>
  );
}
