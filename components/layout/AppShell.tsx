"use client";

import { useEffect, useState } from "react";
import { Download, Save } from "lucide-react";
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
  const pallet = usePalletStore((state) => state.pallet);
  const products = useProductStore((state) => state.products);
  const replaceProducts = useProductStore((state) => state.replaceProducts);

  const placements = usePlacementStore((state) => state.placements);
  const placeProduct = usePlacementStore((state) => state.placeProduct);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const selectedPlacementId = usePlacementStore((state) => state.selectedPlacementId);
  const removeSelected = usePlacementStore((state) => state.removeSelected);
  const removePlacement = usePlacementStore((state) => state.removePlacement);
  const undo = usePlacementStore((state) => state.undo);
  const redo = usePlacementStore((state) => state.redo);
  const clearPlacements = usePlacementStore((state) => state.clear);

  const selectedCustomerId = useUIStore((state) => state.selectedCustomerId);
  const setSelectedCustomerId = useUIStore((state) => state.setSelectedCustomerId);
  const selectedWall = useUIStore((state) => state.selectedWall);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);
  const draggingProductId = useUIStore((state) => state.draggingProductId);

  const saveProject = useProjectStore((state) => state.saveProject);

  const [projectName, setProjectName] = useState("Holiday Program Layout");
  const [statusMessage, setStatusMessage] = useState("Select a customer to get started.");

  // Load products when customer changes
  useEffect(() => {
    const customer = getCustomerById(selectedCustomerId);
    if (customer) {
      replaceProducts(customer.products);
      setStatusMessage(`Loaded ${customer.products.length} products for ${customer.name}.`);
    }
  }, [selectedCustomerId, replaceProducts]);

  function snapshotProject(nameOverride?: string) {
    return saveProject({
      name: nameOverride ?? projectName,
      pallet,
      products,
      placements,
    });
  }

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    clearPlacements();
    selectPlacement(null);
  }

  useKeyboardShortcuts({
    onDelete: () => {
      removeSelected();
      setStatusMessage("Removed selected placement.");
    },
    onRotate: () => {},
    onUndo: () => {
      undo();
      setStatusMessage("Undid last change.");
    },
    onRedo: () => {
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
        <header className="panel-surface flex flex-wrap items-center justify-between gap-4 rounded-[28px] px-6 py-4">
          <div>
            <p className="eyebrow text-[10px] text-[var(--primary)]">Kayco</p>
            <h1 className="display-font text-xl font-semibold tracking-tight md:text-2xl">
              Holiday Pallet Layout
            </h1>
            <p
              aria-live="polite"
              className="mt-1 text-sm text-[var(--muted)]"
              role="status"
            >
              {statusMessage}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              aria-label="Project name"
              className="w-48 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              onChange={(e) => setProjectName(e.target.value)}
              value={projectName}
            />

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
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--line)] bg-white/75 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white"
                onClick={async () => {
                  setStatusMessage("Generating PDF...");
                  const project = snapshotProject();
                  await exportProjectPdf(project, `${project.name}.pdf`);
                  setStatusMessage("Exported planogram PDF.");
                }}
                type="button"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
            </Tip>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="mx-auto grid w-full max-w-[1680px] flex-1 gap-4 xl:grid-cols-[320px_1fr]">
          {/* Left sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Customer selector */}
            <div className="panel-surface rounded-[24px] p-4">
              <p className="eyebrow mb-3 text-[10px] text-[var(--muted)]">Customer</p>
              <div className="flex gap-2">
                {CUSTOMERS.map((customer) => (
                  <button
                    key={customer.id}
                    aria-pressed={selectedCustomerId === customer.id}
                    className={cn(
                      "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      selectedCustomerId === customer.id
                        ? "bg-[var(--primary)] text-white shadow-md shadow-sky-900/15"
                        : "bg-white/70 text-[var(--foreground)] hover:bg-white",
                    )}
                    onClick={() => handleCustomerChange(customer.id)}
                    type="button"
                  >
                    {customer.name}
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
            {/* Wall tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3">
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
                      "flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-[var(--primary)] text-white shadow-md shadow-sky-900/15"
                        : "bg-white/60 text-[var(--foreground)] hover:bg-white",
                    )}
                    onClick={() => setSelectedWall(face)}
                    type="button"
                  >
                    {WALL_LABELS[face]}
                    {wallConfig.wallType === "shelves" && placementCount > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-[var(--primary)]/10 text-[var(--primary)]",
                        )}
                      >
                        {placementCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Shelf grid */}
            <div className="flex flex-1 flex-col p-5">
              <ShelfGrid
                draggingProductId={draggingProductId}
                onDeletePlacement={(id) => {
                  removePlacement(id);
                  selectPlacement(null);
                  setStatusMessage("Removed placement.");
                }}
                onPlace={({ wall, shelfRow, gridCol, product }) => {
                  placeProduct({ pallet, product, wall, shelfRow, gridCol });
                  setStatusMessage(`Placed ${product.name} on ${WALL_LABELS[wall]} wall.`);
                }}
                onSelectPlacement={selectPlacement}
                pallet={pallet}
                placements={placements}
                products={products}
                selectedPlacementId={selectedPlacementId}
                wall={selectedWall}
              />
            </div>
          </section>
        </div>
      </main>
    </Tooltip.Provider>
  );
}
