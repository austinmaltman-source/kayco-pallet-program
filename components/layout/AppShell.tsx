"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Download, Grid3X3, Save } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

import { ProductCatalog } from "@/components/catalog/ProductCatalog";
import { ShelfGrid } from "@/components/editor/ShelfGrid";
import { CUSTOMERS, getCustomerById } from "@/lib/customers";
import { WALL_FACES, WALL_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { exportProjectJson, exportProjectPdf } from "@/services/exportService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useUIStore } from "@/stores/useUIStore";

const Scene3DView = dynamic(
  () => import("@/components/scene/SceneRoot").then((m) => ({ default: m.SceneRoot })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8e2d6] to-[#d8d0c0]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--muted)]/20 border-t-[var(--muted)]" />
          <p className="text-xs font-medium text-[var(--muted)]">Loading 3D...</p>
        </div>
      </div>
    ),
  },
);

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs text-white shadow-lg"
          sideOffset={6}
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--foreground)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function AppShell() {
  const fallbackCustomer = getCustomerById("kroger") ?? CUSTOMERS[0] ?? null;
  const pallet = usePalletStore((state) => state.pallet);
  const products = useProductStore((state) => state.products);
  const replaceProducts = useProductStore((state) => state.replaceProducts);

  const placements = usePlacementStore((state) => state.placements);
  const placeProduct = usePlacementStore((state) => state.placeProduct);
  const pastLength = usePlacementStore((state) => state.past.length);
  const futureLength = usePlacementStore((state) => state.future.length);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const selectedPlacementId = usePlacementStore((state) => state.selectedPlacementId);
  const removeSelected = usePlacementStore((state) => state.removeSelected);
  const removePlacement = usePlacementStore((state) => state.removePlacement);
  const undo = usePlacementStore((state) => state.undo);
  const redo = usePlacementStore((state) => state.redo);
  const replacePlacements = usePlacementStore((state) => state.replacePlacements);

  const selectedCustomerId = useUIStore((state) => state.selectedCustomerId);
  const setSelectedCustomerId = useUIStore((state) => state.setSelectedCustomerId);
  const selectedWall = useUIStore((state) => state.selectedWall);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const draggingProductId = useUIStore((state) => state.draggingProductId);

  const saveProject = useProjectStore((state) => state.saveProject);
  const activeCustomer = getCustomerById(selectedCustomerId) ?? fallbackCustomer;
  const defaultStatusMessage = activeCustomer
    ? `Loaded ${activeCustomer.products.length} products for ${activeCustomer.name}.`
    : "Select a customer to get started.";

  const [projectName, setProjectName] = useState("Holiday Program Layout");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load products when customer changes
  useEffect(() => {
    const customer = getCustomerById(selectedCustomerId);

    if (!customer) {
      if (fallbackCustomer && selectedCustomerId !== fallbackCustomer.id) {
        setSelectedCustomerId(fallbackCustomer.id);
        return;
      }

      replaceProducts([]);
      return;
    }

    replaceProducts(customer.products);
  }, [fallbackCustomer, replaceProducts, selectedCustomerId, setSelectedCustomerId]);

  function snapshotProject(nameOverride?: string) {
    return saveProject({
      name: nameOverride ?? projectName,
      pallet,
      products,
      placements,
    });
  }

  function handleCustomerChange(customerId: string) {
    const customer = getCustomerById(customerId);

    if (!customer || customerId === selectedCustomerId) {
      return;
    }

    setSelectedCustomerId(customerId);
    replacePlacements([]);
    setStatusMessage(null);
  }

  useKeyboardShortcuts({
    onDelete: () => {
      if (!selectedPlacementId) {
        setStatusMessage("Select a placement to remove.");
        return;
      }

      removeSelected();
      setStatusMessage("Removed selected placement.");
    },
    onRotate: () => {},
    onUndo: () => {
      if (pastLength === 0) {
        setStatusMessage("Nothing to undo.");
        return;
      }

      undo();
      setStatusMessage("Undid last change.");
    },
    onRedo: () => {
      if (futureLength === 0) {
        setStatusMessage("Nothing to redo.");
        return;
      }

      redo();
      setStatusMessage("Redid last change.");
    },
    onSave: () => {
      const project = snapshotProject();
      setStatusMessage(`Saved ${project.name}.`);
    },
  });

  return (
    <Tooltip.Provider>
      <main className="flex min-h-screen flex-col gap-4 px-4 py-4 text-[var(--foreground)] md:px-6 lg:px-8">
        {/* Header */}
        <header className="panel-surface flex flex-wrap items-center justify-between gap-4 rounded-[28px] px-6 py-4 shadow-xl shadow-cyan-900/5 border border-cyan-100/20">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a3c7] to-[#008eb0] shadow-lg shadow-cyan-900/20">
              <Box className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="eyebrow text-[10px] text-[var(--primary)] font-bold tracking-widest">Kayco</p>
              <h1 className="display-font text-2xl font-bold tracking-tight text-slate-800">
                Holiday Pallet Layout
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/60 p-1.5 shadow-sm border border-slate-200">
              <input
                aria-label="Project name"
                className="w-48 bg-transparent px-3 py-1.5 text-sm font-medium outline-none transition-colors placeholder:text-slate-400 focus:text-slate-900"
                onChange={(e) => setProjectName(e.target.value)}
                value={projectName}
              />
            </div>

            <Tip label="Save project (Cmd+S)">
              <button
                aria-label="Save project"
                className="flex min-h-[40px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]"
                onClick={() => {
                  const project = snapshotProject();
                  setStatusMessage(`Saved ${project.name}.`);
                }}
                type="button"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </Tip>

            <Tip label="Export as JSON">
              <button
                aria-label="Export JSON"
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--line)] bg-white/75 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white"
                onClick={() => {
                  const project = snapshotProject();
                  exportProjectJson(project, `${project.name}.pallet.json`);
                  setStatusMessage("Exported JSON.");
                }}
                type="button"
              >
                <Download className="h-4 w-4" />
                JSON
              </button>
            </Tip>

            <Tip label="Export planogram PDF">
              <button
                aria-label="Export PDF"
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--line)] bg-white/75 px-3 py-2 text-sm font-semibold transition-all hover:bg-white hover:shadow-md hover:-translate-y-0.5"
                onClick={async () => {
                  setStatusMessage("Generating PDF...");
                  const project = snapshotProject();
                  await exportProjectPdf(project, `${project.name}.pdf`);
                  setStatusMessage("Exported planogram PDF.");
                }}
                type="button"
              >
                <Download className="h-4 w-4 text-[var(--primary)]" />
                PDF
              </button>
            </Tip>
          </div>
        </header>
        
        <div className="flex justify-between px-2">
          <p
            aria-live="polite"
            className="text-sm font-medium text-[var(--muted)] flex items-center gap-2"
            role="status"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)]"></span>
            </span>
            {statusMessage ?? defaultStatusMessage}
          </p>
        </div>

        {/* Two-column layout */}
        <div className="mx-auto grid w-full max-w-[1680px] flex-1 gap-4 xl:grid-cols-[320px_1fr]">
          {/* Left sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Customer selector */}
            <div className="panel-surface rounded-[24px] p-4 shadow-lg shadow-cyan-900/5">
              <p className="eyebrow mb-4 text-[10px] text-[var(--muted)]">Retail Customer</p>
              <div className="flex flex-col gap-2">
                {CUSTOMERS.map((customer) => (
                  <button
                    key={customer.id}
                    aria-pressed={selectedCustomerId === customer.id}
                    className={cn(
                      "group relative flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300",
                      selectedCustomerId === customer.id
                        ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)] text-white shadow-md shadow-cyan-900/20 translate-x-1"
                        : "bg-white/50 text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200",
                    )}
                    onClick={() => handleCustomerChange(customer.id)}
                    type="button"
                  >
                    <span>{customer.name}</span>
                    {selectedCustomerId === customer.id && (
                      <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Product catalog */}
            <div className="panel-surface flex-1 overflow-y-auto rounded-[24px] p-4">
              <p className="eyebrow mb-3 text-[10px] text-[var(--muted)]">
                Products ({products.length})
              </p>
              <ProductCatalog />
            </div>
          </aside>

          {/* Main editor */}
          <section className="panel-surface flex flex-col overflow-hidden rounded-[28px]">
            {/* Wall tabs + view mode toggle */}
            <div className="flex items-center gap-3 border-b border-[var(--line)] bg-white/40 px-6 py-4">
              {viewMode === "2d" && (
                <div className="flex rounded-xl bg-slate-100/80 p-1 shadow-inner ring-1 ring-inset ring-slate-200/50">
                  {WALL_FACES.map((face) => {
                    const wallConfig = pallet.display.walls[face];
                    const isActive = selectedWall === face;
                    const placementCount = placements.filter(
                      (p) => p.wall === face,
                    ).length;

                    return (
                      <button
                        key={face}
                        aria-pressed={isActive}
                        className={cn(
                          "relative flex min-h-[36px] items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-300",
                          isActive
                            ? "bg-white text-[var(--primary)] shadow-sm ring-1 ring-slate-200/50"
                            : "text-slate-500 hover:text-slate-700 hover:bg-white/50",
                        )}
                        onClick={() => setSelectedWall(face)}
                        type="button"
                      >
                        {WALL_LABELS[face]}
                        {wallConfig.wallType === "shelves" && placementCount > 0 && (
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                              isActive
                                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                : "bg-slate-200 text-slate-500",
                            )}
                          >
                            {placementCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {viewMode === "3d" && (
                <p className="text-sm font-medium text-[var(--muted)]">
                  3D Preview
                </p>
              )}

              <div className="ml-auto flex gap-0.5 rounded-xl border border-[var(--line)] bg-white/60 p-0.5">
                <button
                  aria-label="2D Grid view"
                  aria-pressed={viewMode === "2d"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    viewMode === "2d"
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--foreground)] hover:bg-white",
                  )}
                  onClick={() => setViewMode("2d")}
                  type="button"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  2D
                </button>
                <button
                  aria-label="3D Preview"
                  aria-pressed={viewMode === "3d"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    viewMode === "3d"
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--foreground)] hover:bg-white",
                  )}
                  onClick={() => setViewMode("3d")}
                  type="button"
                >
                  <Box className="h-3.5 w-3.5" />
                  3D
                </button>
              </div>
            </div>

            {/* Editor content: 2D grid or 3D scene */}
            <div className="flex flex-1 flex-col p-5">
              {viewMode === "2d" ? (
                <ShelfGrid
                  draggingProductId={draggingProductId}
                  onDeletePlacement={(id) => {
                    removePlacement(id);
                    selectPlacement(null);
                    setStatusMessage("Removed placement.");
                  }}
                  onPlace={({ wall, shelfRow, gridCol, product }) => {
                    const result = placeProduct({ pallet, product, wall, shelfRow, gridCol });

                    if (!result.ok) {
                      setStatusMessage(result.reason ?? "Unable to place product there.");
                      return;
                    }

                    setStatusMessage(`Placed ${product.name} on ${WALL_LABELS[wall]} wall.`);
                  }}
                  onSelectPlacement={selectPlacement}
                  pallet={pallet}
                  placements={placements}
                  products={products}
                  selectedPlacementId={selectedPlacementId}
                  wall={selectedWall}
                />
              ) : (
                <div className="h-[calc(100vh-220px)] min-h-[320px] max-h-[600px]">
                  <Scene3DView />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </Tooltip.Provider>
  );
}
