"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  ChevronDown,
  Download,
  FileJson,
  FileText,
  Grid3X3,
  Layers,
  Maximize2,
  Minimize2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Save,
  Undo2,
  X,
  Sparkles,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProductCatalog } from "@/components/catalog/ProductCatalog";
import { ShelfGrid } from "@/components/editor/ShelfGrid";
import { DndProvider, parseCellId } from "@/components/editor/DndProvider";
import { WALL_FACES, WALL_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { exportProjectJson, exportProjectPdf } from "@/services/exportService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePalletStore } from "@/stores/usePalletStore";
import { usePlacementStore } from "@/stores/usePlacementStore";
import { useProductStore } from "@/stores/useProductStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useUIStore } from "@/stores/useUIStore";
import type { Customer } from "@/types/customer";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

const Scene3DView = dynamic(
  () =>
    import("@/components/scene/SceneRoot").then((m) => ({
      default: m.SceneRoot,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-xl bg-[var(--surface-2)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--surface-3)] border-t-[var(--primary)]" />
          <p className="text-sm font-medium text-[var(--muted)]">
            Loading 3D scene...
          </p>
        </div>
      </div>
    ),
  },
);

/* ─── Status toast auto-clear hook ─── */
function useStatusMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setExiting(false);
    setMessage(msg);
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setMessage(null);
        setExiting(false);
      }, 200);
    }, 4000);
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(null);
    setExiting(false);
  }, []);

  return { message, exiting, show, clear };
}

/* ─── Tooltip helper ─── */
function Tip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip.Root delayDuration={400}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-50 rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          sideOffset={6}
          side={side}
        >
          {label}
          <Tooltip.Arrow className="fill-[var(--foreground)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ─── Export dropdown with keyboard support ─── */
function ExportDropdown({
  onExportJson,
  onExportPdf,
}: {
  onExportJson: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLButtonElement>(
        '[role="menuitem"]',
      );
      firstItem?.focus();
    }
  }, [open]);

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    if (!items?.length) return;

    const current = Array.from(items).indexOf(
      document.activeElement as HTMLButtonElement,
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--muted)] transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Export options"
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[var(--line)] bg-[var(--surface-0)] p-1.5 shadow-xl"
            onKeyDown={handleMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={0}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] cursor-pointer outline-none"
              onClick={() => {
                onExportJson();
                setOpen(false);
              }}
            >
              <FileJson className="h-4 w-4 text-[var(--muted)]" />
              <div>
                <p className="text-left">Export as JSON</p>
                <p className="text-[11px] text-[var(--muted)] font-normal">
                  Machine-readable format
                </p>
              </div>
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] cursor-pointer outline-none"
              onClick={() => {
                onExportPdf();
                setOpen(false);
              }}
            >
              <FileText className="h-4 w-4 text-[var(--muted)]" />
              <div>
                <p className="text-left">Export as PDF</p>
                <p className="text-[11px] text-[var(--muted)] font-normal">
                  Planogram with BOM
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Product panel ─── */
function ProductPanel({
  onClose,
  productCount,
}: {
  onClose: () => void;
  productCount: number;
}) {
  return (
    <aside
      aria-label="Product catalog"
      className="flex min-h-[320px] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-0)] shadow-sm lg:min-h-0 lg:w-[380px] lg:min-w-[380px] xl:w-[440px] xl:min-w-[440px]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
        <div className="flex items-center gap-2.5">
          <Package className="h-4 w-4 text-[var(--muted)]" />
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            Products
          </h2>
          <span className="badge badge-muted text-[10px]">
            {productCount}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={onClose}
          aria-label="Hide products panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <ProductCatalog />
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main App Shell
   ═══════════════════════════════════════════════════════════ */
export function AppShell() {
  const pallet = usePalletStore((state) => state.pallet);
  const setPalletType = usePalletStore((state) => state.setType);
  const products = useProductStore((state) => state.products);
  const activeProductId = useProductStore((state) => state.activeProductId);
  const setActiveProduct = useProductStore((state) => state.setActiveProduct);
  const fetchProducts = useProductStore((state) => state.fetchProducts);

  const placements = usePlacementStore((state) => state.placements);
  const placeProduct = usePlacementStore((state) => state.placeProduct);
  const pastLength = usePlacementStore((state) => state.past.length);
  const futureLength = usePlacementStore((state) => state.future.length);
  const selectPlacement = usePlacementStore((state) => state.selectPlacement);
  const selectedPlacementId = usePlacementStore(
    (state) => state.selectedPlacementId,
  );
  const removeSelected = usePlacementStore((state) => state.removeSelected);
  const removePlacement = usePlacementStore((state) => state.removePlacement);
  const undo = usePlacementStore((state) => state.undo);
  const redo = usePlacementStore((state) => state.redo);
  const selectedCustomerId = useUIStore((state) => state.selectedCustomerId);
  const setSelectedCustomerId = useUIStore(
    (state) => state.setSelectedCustomerId,
  );
  const selectedWall = useUIStore((state) => state.selectedWall);
  const setSelectedWall = useUIStore((state) => state.setSelectedWall);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const draggingProductId = useUIStore((state) => state.draggingProductId);

  const saveProject = useProjectStore((state) => state.saveProject);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const activeCustomer =
    customersList.find((customer) => customer.id === selectedCustomerId) ??
    customersList[0] ??
    null;

  const activeProduct = activeProductId
    ? products.find((product) => product.id === activeProductId) ?? null
    : null;

  const [projectName, setProjectName] = useState("Holiday Program Layout");
  const status = useStatusMessage();
  const [activeView, setActiveView] = useState<"editor" | "dashboard">(
    "editor",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error("Failed to load customers");
      }

      const customers = (await response.json()) as Customer[];
      if (!cancelled) {
        setCustomersList(customers);
      }
    }

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Escape exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFullscreen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  useEffect(() => {
    if (customersList.length === 0) {
      return;
    }

    const customer =
      customersList.find((entry) => entry.id === selectedCustomerId) ??
      customersList[0] ??
      null;

    if (!customer) {
      return;
    }

    if (customer.id !== selectedCustomerId) {
      setSelectedCustomerId(customer.id);
      return;
    }

    void fetchProducts(customer.id);
  }, [
    customersList,
    fetchProducts,
    selectedCustomerId,
    setSelectedCustomerId,
  ]);

  async function snapshotProject(nameOverride?: string) {
    return saveProject({
      name: nameOverride ?? projectName,
      pallet,
      products,
      placements,
    });
  }

  useKeyboardShortcuts({
    onDelete: () => {
      if (!selectedPlacementId) {
        status.show("Select a placement to remove.");
        return;
      }
      removeSelected();
      status.show("Removed selected placement.");
    },
    onRotate: () => {},
    onUndo: () => {
      if (pastLength === 0) {
        status.show("Nothing to undo.");
        return;
      }
      undo();
      status.show("Undid last change.");
    },
    onRedo: () => {
      if (futureLength === 0) {
        status.show("Nothing to redo.");
        return;
      }
      redo();
      status.show("Redid last change.");
    },
    onSave: async () => {
      const project = await snapshotProject();
      status.show(`Saved "${project.name}".`);
    },
  });

  /* ─── dnd-kit drop handler ─── */
  const handleDndDrop = useCallback(
    (productId: string, droppableId: string) => {
      const cell = parseCellId(droppableId);
      if (!cell) return;
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const result = placeProduct({
        pallet,
        product,
        wall: cell.wall as import("@/types/pallet").WallFace,
        shelfRow: cell.row,
        gridCol: cell.col,
      });

      if (!result.ok) {
        status.show(result.reason ?? "Unable to place product there.");
        return;
      }

      status.show(
        `Placed ${product.name} on ${WALL_LABELS[cell.wall as keyof typeof WALL_LABELS]} wall.`,
      );
    },
    [pallet, placeProduct, products, status],
  );

  const wallPlacementCounts = WALL_FACES.reduce(
    (acc, face) => {
      acc[face] = placements.filter((p) => p.wall === face).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  /* ─── Editor view (shared between normal and fullscreen) ─── */
  function renderEditor() {
    return (
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Editor toolbar */}
        <div className="relative z-20 flex min-w-0 items-center justify-between border-b border-[var(--line)] bg-[var(--surface-0)] px-5 py-2">
          <div className="flex items-center gap-2">
            <Tip label={drawerOpen ? "Hide products panel" : "Show products panel"}>
              <button
                type="button"
                aria-label={drawerOpen ? "Hide products panel" : "Show products panel"}
                aria-pressed={drawerOpen}
                className={cn(
                  "btn btn-icon btn-sm",
                  drawerOpen ? "btn-primary" : "btn-ghost",
                )}
                onClick={() => setDrawerOpen(!drawerOpen)}
              >
                {drawerOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </button>
            </Tip>

            <div className="mx-1.5 h-5 w-px bg-[var(--line)]" />

            {viewMode === "2d" ? (
              pallet.type === "full" ? (
                <div
                  className="flex items-center rounded-lg bg-[var(--surface-2)] p-0.5"
                  role="tablist"
                  aria-label="Wall selector"
                >
                  {WALL_FACES.map((face) => {
                    const wallConfig = pallet.display.walls[face];
                    const isActive = selectedWall === face;
                    const count = wallPlacementCounts[face] ?? 0;

                    return (
                      <button
                        key={face}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                          isActive
                            ? "bg-[var(--surface-0)] text-[var(--foreground)] shadow-sm"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]",
                        )}
                        onClick={() => setSelectedWall(face)}
                      >
                        {WALL_LABELS[face]}
                        {wallConfig.wallType === "shelves" &&
                          count > 0 && (
                            <span
                              className={cn(
                                "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                                isActive
                                  ? "bg-[var(--primary)] text-white"
                                  : "bg-[var(--surface-3)] text-[var(--muted)]",
                              )}
                            >
                              {count}
                            </span>
                          )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  Front Face
                </p>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-[13px] font-semibold text-[var(--foreground)]">
                  3D Preview
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeProduct && viewMode === "2d" && (
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--primary)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] pulse-dot" />
                Click grid to place {activeProduct.sku}
              </div>
            )}

            {/* View mode toggle */}
            <div
              className="flex items-center rounded-lg border border-[var(--line)] p-0.5"
              role="tablist"
              aria-label="View mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "2d"}
                aria-label="2D Grid view"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                  viewMode === "2d"
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
                onClick={() => setViewMode("2d")}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                2D
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "3d"}
                aria-label="3D Preview"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                  viewMode === "3d"
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
                onClick={() => setViewMode("3d")}
              >
                <Box className="h-3.5 w-3.5" />
                3D
              </button>
            </div>

            <div className="mx-0.5 h-5 w-px bg-[var(--line)]" />

            {/* Fullscreen toggle */}
            <Tip label={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}>
              <button
                type="button"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </Tip>
          </div>
        </div>

        {/* Canvas area */}
        <DndProvider products={products} onDrop={handleDndDrop}>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--surface-1)] p-4">
            <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 lg:flex-row">
              {drawerOpen && (
                <ProductPanel
                  onClose={() => setDrawerOpen(false)}
                  productCount={products.length}
                />
              )}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {viewMode === "2d" ? (
                  <div className="h-full min-h-[400px] min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface-0)] p-5 shadow-sm">
                    <ShelfGrid
                      activeProduct={activeProduct}
                      draggingProductId={draggingProductId}
                      onDeletePlacement={(id) => {
                        removePlacement(id);
                        selectPlacement(null);
                        status.show("Removed placement.");
                      }}
                      onPlace={({ wall, shelfRow, gridCol, product }) => {
                        const result = placeProduct({
                          pallet,
                          product,
                          wall,
                          shelfRow,
                          gridCol,
                        });

                        if (!result.ok) {
                          status.show(
                            result.reason ?? "Unable to place product there.",
                          );
                          return;
                        }

                        status.show(
                          `Placed ${product.name} on ${WALL_LABELS[wall]} wall.`,
                        );
                      }}
                      onSelectPlacement={selectPlacement}
                      pallet={pallet}
                      placements={placements}
                      products={products}
                      selectedPlacementId={selectedPlacementId}
                      wall={selectedWall}
                    />
                  </div>
                ) : (
                  <div className="h-full min-h-[400px] min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-0)] shadow-sm">
                    <Scene3DView />
                  </div>
                )}
              </div>
            </div>
          </div>
        </DndProvider>

      </div>
    );
  }

  /* ─── Fullscreen mode ─── */
  if (isFullscreen && activeView === "editor") {
    return (
      <Tooltip.Provider>
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-1)]">
          {/* Minimal top bar in fullscreen */}
          <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--surface-0)] px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--primary)]">
                <Layers className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-[13px] font-semibold text-[var(--foreground)]">
                {projectName}
              </span>
              {activeCustomer && (
                <span className="badge badge-primary text-[10px]">
                  {activeCustomer.name}
                </span>
              )}
              {activeProduct && (
                <div className="flex items-center gap-1.5">
                  <span className="badge badge-success text-[10px]">
                    Placing: {activeProduct.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setActiveProduct(null)}
                    aria-label="Clear product selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Status */}
              {status.message && (
                <div
                  className={cn(
                    "mr-2 flex items-center gap-2 text-[12px] text-[var(--muted)]",
                    status.exiting ? "toast-exit" : "toast-enter",
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  <span className="max-w-40 truncate font-medium">
                    {status.message}
                  </span>
                </div>
              )}

              {/* Undo/Redo */}
              <div className="flex items-center rounded-lg border border-[var(--line)] p-0.5">
                <Tip label="Undo (Ctrl+Z)">
                  <button
                    type="button"
                    aria-label="Undo"
                    disabled={pastLength === 0}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => {
                      undo();
                      status.show("Undid last change.");
                    }}
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </Tip>
                <Tip label="Redo (Ctrl+Y)">
                  <button
                    type="button"
                    aria-label="Redo"
                    disabled={futureLength === 0}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => {
                      redo();
                      status.show("Redid last change.");
                    }}
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </Tip>
              </div>

              <Tip label="Save (Ctrl+S)">
                <button
                  type="button"
                  aria-label="Save project"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    void (async () => {
                      const project = await snapshotProject();
                      status.show(`Saved "${project.name}".`);
                    })();
                  }}
                >
                  <Save className="h-4 w-4" />
                </button>
              </Tip>

              <Tip label="Exit fullscreen (Esc)">
                <button
                  type="button"
                  aria-label="Exit fullscreen"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </Tip>
            </div>
          </div>

          {renderEditor()}
        </div>
      </Tooltip.Provider>
    );
  }

  return (
    <Tooltip.Provider>
      <DashboardLayout searchPlaceholder="Search products, placements...">
        {/* ─── Main area ─── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Editor toolbar */}
          <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-0)] px-4 rounded-b-none">
            <div className="flex items-center gap-3 min-w-0">
              <input
                aria-label="Project name"
                className="w-52 bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] border-b border-transparent hover:border-[var(--line-strong)] focus:border-[var(--primary)] transition-colors py-1"
                onChange={(e) => setProjectName(e.target.value)}
                value={projectName}
              />

              {activeCustomer && (
                <span className="badge badge-primary shrink-0">
                  {activeCustomer.name}
                </span>
              )}

              {/* Half / Full pallet toggle */}
              <div
                className="flex items-center rounded-lg border border-[var(--line)] p-0.5 shrink-0"
                role="tablist"
                aria-label="Pallet type"
              >
                {(["half", "full"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={pallet.type === type}
                    className={cn(
                      "rounded-md px-3 py-1 text-[13px] font-semibold transition-all duration-150 cursor-pointer capitalize",
                      pallet.type === type
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                    onClick={() => {
                      setPalletType(type);
                      if (type === "half") setSelectedWall("front");
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {activeProduct && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge badge-success">
                    Placing: {activeProduct.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setActiveProduct(null)}
                    aria-label="Clear product selection"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status message */}
              {status.message && (
                <div
                  className={cn(
                    "mr-2 flex items-center gap-2 text-[12px] text-[var(--muted)]",
                    status.exiting ? "toast-exit" : "toast-enter",
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  <span className="max-w-40 truncate font-medium">
                    {status.message}
                  </span>
                </div>
              )}

              {/* Undo/Redo */}
              <div className="flex items-center border border-[var(--line)] p-0.5 rounded-lg">
                <Tip label="Undo (Ctrl+Z)">
                  <button
                    type="button"
                    aria-label="Undo"
                    disabled={pastLength === 0}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => {
                      undo();
                      status.show("Undid last change.");
                    }}
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </Tip>
                <Tip label="Redo (Ctrl+Y)">
                  <button
                    type="button"
                    aria-label="Redo"
                    disabled={futureLength === 0}
                    className="btn btn-ghost btn-icon btn-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => {
                      redo();
                      status.show("Redid last change.");
                    }}
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </Tip>
              </div>

              {/* Save */}
              <Tip label="Save project (Ctrl+S)">
                <button
                  type="button"
                  aria-label="Save project"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    void (async () => {
                      const project = await snapshotProject();
                      status.show(`Saved "${project.name}".`);
                    })();
                  }}
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </Tip>

              {/* Export dropdown */}
              <ExportDropdown
                onExportJson={async () => {
                  const project = await snapshotProject();
                  exportProjectJson(project, `${project.name}.pallet.json`);
                  status.show("Exported JSON.");
                }}
                onExportPdf={async () => {
                  status.show("Generating PDF...");
                  const project = await snapshotProject();
                  await exportProjectPdf(project, `${project.name}.pdf`);
                  status.show("Exported planogram PDF.");
                }}
              />
            </div>
          </div>

          {/* ─── Content area ─── */}
          {activeView === "dashboard" ? (
            <DashboardView
              placements={placements}
              products={products}
              activeCustomer={activeCustomer}
              pallet={pallet}
              onOpenEditor={() => setActiveView("editor")}
            />
          ) : (
            renderEditor()
          )}
        </div>
      </DashboardLayout>
    </Tooltip.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════
   Dashboard View
   ═══════════════════════════════════════════════════════════ */
function DashboardView({
  placements,
  products,
  activeCustomer,
  pallet,
  onOpenEditor,
}: {
  placements: PlacedItem[];
  products: Product[];
  activeCustomer: Customer | null;
  pallet: ReturnType<typeof usePalletStore.getState>["pallet"];
  onOpenEditor: () => void;
}) {
  const uniqueProducts = new Set(placements.map((p) => p.productId)).size;
  const totalUnits = placements.reduce((sum, p) => sum + p.quantity, 0);
  const wallsUsed = new Set(placements.map((p) => p.wall)).size;

  const stats = [
    {
      label: "Total Placements",
      value: placements.length,
      icon: Grid3X3,
      color: "var(--primary)",
      bg: "var(--primary-soft)",
    },
    {
      label: "Unique Products",
      value: uniqueProducts,
      icon: Package,
      color: "var(--success-fg)",
      bg: "var(--success-soft)",
    },
    {
      label: "Total Units",
      value: totalUnits,
      icon: Layers,
      color: "var(--warning-fg)",
      bg: "var(--warning-soft)",
    },
    {
      label: "Walls Used",
      value: `${wallsUsed}/4`,
      icon: Box,
      color: "var(--purple)",
      bg: "var(--purple-soft)",
    },
  ];

  const isEmpty = placements.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-1)] p-8 custom-scrollbar">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
            Dashboard
          </h2>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Overview of your current pallet layout
            {activeCustomer ? ` for ${activeCustomer.name}` : ""}.
          </p>
        </div>

        {/* Stats grid — responsive */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="card-elevated flex items-center gap-4 p-5"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon
                  className="h-5 w-5"
                  style={{ color: stat.color }}
                />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[var(--foreground)] leading-none tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1 text-[12px] font-medium text-[var(--muted)]">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {isEmpty ? (
          <div className="card-elevated flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-soft)] mb-5">
              <Sparkles className="h-7 w-7 text-[var(--primary)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              No placements yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
              Open the editor to start building your pallet display. Select products from the catalog and place them on the shelf grid.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-6"
              onClick={onOpenEditor}
            >
              <Grid3X3 className="h-4 w-4" />
              Start Building
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pallet configuration */}
            <div className="card-elevated lg:col-span-2 p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-5">
                Pallet Configuration
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Type",
                    value: `${pallet.type.charAt(0).toUpperCase() + pallet.type.slice(1)} Pallet`,
                  },
                  {
                    label: "Base Size",
                    value: `${pallet.base.width}" x ${pallet.base.depth}"`,
                  },
                  {
                    label: "Shelf Rows",
                    value: `${pallet.display.shelfRows} rows`,
                  },
                  {
                    label: "Row Height",
                    value: `${pallet.display.rowHeight}"`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-[var(--surface-1)] border border-[var(--line)] p-4"
                  >
                    <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="card-elevated p-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-5">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={onOpenEditor}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Open Editor
                </button>
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                >
                  <Plus className="h-4 w-4" />
                  New Layout
                </button>
              </div>

              <div className="mt-6">
                <p className="eyebrow mb-3">Top Products</p>
                <div className="space-y-1.5">
                  {products.slice(0, 4).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-[var(--surface-1)]"
                    >
                      <div
                        className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: product.color }}
                      >
                        <Package className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[var(--foreground)]">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {product.sku}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
