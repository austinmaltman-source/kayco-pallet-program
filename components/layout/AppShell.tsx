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
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Plus,
  Redo2,
  Save,
  Settings,
  Undo2,
  Users,
  X,
  Sparkles,
} from "lucide-react";
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

/* ─── Sidebar nav item ─── */
function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  badge?: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-[var(--primary)] text-white shadow-sm shadow-blue-600/20"
          : disabled
            ? "text-[var(--muted-foreground)] cursor-default opacity-60"
            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] cursor-pointer",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active
            ? "text-white"
            : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {badge != null && badge > 0 && (
            <span
              className={cn(
                "badge text-[10px]",
                active ? "bg-white/20 text-white" : "badge-muted",
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tip label={label} side="right">
        {content}
      </Tip>
    );
  }

  return content;
}

/* ─── Export dropdown with keyboard support ─── */
function ExportDropdown({
  onExportJson,
  onExportPdf,
}: {
  onExportJson: () => void;
  onExportPdf: () => void;
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

/* ─── Product drawer ─── */
function ProductDrawer({
  open,
  onClose,
  productCount,
}: {
  open: boolean;
  onClose: () => void;
  productCount: number;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim */}
      <div
        className={cn(
          "absolute inset-0 z-30 bg-black/20 transition-opacity duration-200",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Product catalog"
        aria-modal={open}
        className={cn(
          "absolute left-0 top-0 bottom-0 z-40 flex w-[320px] flex-col bg-[var(--surface-0)] shadow-xl border-r border-[var(--line)] transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
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
            aria-label="Close product drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <ProductCatalog />
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main App Shell
   ═══════════════════════════════════════════════════════════ */
export function AppShell() {
  const fallbackCustomer =
    getCustomerById("kroger") ?? CUSTOMERS[0] ?? null;
  const pallet = usePalletStore((state) => state.pallet);
  const products = useProductStore((state) => state.products);
  const activeProductId = useProductStore((state) => state.activeProductId);
  const setActiveProduct = useProductStore((state) => state.setActiveProduct);
  const replaceProducts = useProductStore((state) => state.replaceProducts);

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
  const replacePlacements = usePlacementStore(
    (state) => state.replacePlacements,
  );

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
  const activeCustomer =
    getCustomerById(selectedCustomerId) ?? fallbackCustomer;

  const activeProduct = activeProductId
    ? products.find((product) => product.id === activeProductId) ?? null
    : null;

  const [projectName, setProjectName] = useState("Holiday Program Layout");
  const status = useStatusMessage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<"editor" | "dashboard">(
    "editor",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  }, [
    fallbackCustomer,
    replaceProducts,
    selectedCustomerId,
    setSelectedCustomerId,
  ]);

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
    if (!customer || customerId === selectedCustomerId) return;
    setSelectedCustomerId(customerId);
    replacePlacements([]);
    status.clear();
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
    onSave: () => {
      const project = snapshotProject();
      status.show(`Saved "${project.name}".`);
    },
  });

  const totalPlacements = placements.length;
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
        {/* Product drawer (slides from left inside the editor area) */}
        <ProductDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          productCount={products.length}
        />

        {/* Editor toolbar */}
        <div className="relative z-20 flex min-w-0 items-center justify-between border-b border-[var(--line)] bg-[var(--surface-0)] px-5 py-2">
          <div className="flex items-center gap-2">
            {/* Product drawer toggle */}
            <Tip label="Products panel">
              <button
                type="button"
                aria-label="Toggle product drawer"
                aria-expanded={drawerOpen}
                className={cn(
                  "btn btn-icon btn-sm",
                  drawerOpen ? "btn-primary" : "btn-ghost",
                )}
                onClick={() => setDrawerOpen(!drawerOpen)}
              >
                <PanelRight className="h-4 w-4" />
              </button>
            </Tip>

            <div className="mx-1.5 h-5 w-px bg-[var(--line)]" />

            {viewMode === "2d" ? (
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
        <div className="min-w-0 flex-1 overflow-auto bg-[var(--surface-1)] p-4">
          {viewMode === "2d" ? (
            <div className="h-full rounded-xl border border-[var(--line)] bg-[var(--surface-0)] p-5 shadow-sm">
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
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  </span>
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
                    const project = snapshotProject();
                    status.show(`Saved "${project.name}".`);
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
      <div className="flex h-screen overflow-hidden bg-[var(--surface-1)]">
        {/* ─── Sidebar ─── */}
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface-0)] transition-[width] duration-200 ease-out",
            sidebarCollapsed ? "w-[68px]" : "w-[260px]",
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              "flex h-[60px] shrink-0 items-center border-b border-[var(--line)]",
              sidebarCollapsed ? "justify-center px-2" : "gap-3 px-5",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] shadow-sm shadow-blue-600/20">
              <Layers className="h-[18px] w-[18px] text-white" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-[15px] font-extrabold text-[var(--foreground)] tracking-tight leading-none">
                  Kayco
                </h1>
                <p className="text-[11px] font-medium text-[var(--muted-foreground)] mt-0.5">
                  Pallet Builder
                </p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav
            aria-label="Main navigation"
            className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar"
          >
            <div className="space-y-1">
              <NavItem
                icon={LayoutDashboard}
                label="Dashboard"
                collapsed={sidebarCollapsed}
                active={activeView === "dashboard"}
                onClick={() => setActiveView("dashboard")}
              />
              <NavItem
                icon={Grid3X3}
                label="Layout Editor"
                collapsed={sidebarCollapsed}
                active={activeView === "editor"}
                badge={totalPlacements}
                onClick={() => setActiveView("editor")}
              />
              <NavItem
                icon={Package}
                label="Products"
                collapsed={sidebarCollapsed}
                badge={products.length}
                onClick={() => {
                  setActiveView("editor");
                  setDrawerOpen(true);
                }}
              />
              <NavItem
                icon={Users}
                label="Customers"
                collapsed={sidebarCollapsed}
                badge={CUSTOMERS.length}
                disabled
              />
            </div>

            {/* Customer selector in sidebar */}
            {!sidebarCollapsed && (
              <div className="mt-8">
                <p className="eyebrow mb-2.5 px-3">Customer</p>
                <div className="space-y-0.5">
                  {CUSTOMERS.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      aria-pressed={selectedCustomerId === customer.id}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer",
                        selectedCustomerId === customer.id
                          ? "bg-[var(--primary-soft)] text-[var(--primary)] font-semibold"
                          : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
                      )}
                      onClick={() => handleCustomerChange(customer.id)}
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0 transition-colors",
                          selectedCustomerId === customer.id
                            ? "bg-[var(--primary)]"
                            : "bg-[var(--surface-3)]",
                        )}
                      />
                      <span className="flex-1 text-left">{customer.name}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                        {customer.products.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Sidebar footer */}
          <div className="shrink-0 border-t border-[var(--line)] p-3 space-y-0.5">
            <NavItem
              icon={Settings}
              label="Settings"
              collapsed={sidebarCollapsed}
              disabled
            />
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] cursor-pointer"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                  <span className="flex-1 text-left text-xs">Collapse</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ─── Main area ─── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-0)] px-6">
            <div className="flex items-center gap-4 min-w-0">
              <input
                aria-label="Project name"
                className="w-60 bg-transparent text-[15px] font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] border-b border-transparent hover:border-[var(--line-strong)] focus:border-[var(--primary)] transition-colors py-1"
                onChange={(e) => setProjectName(e.target.value)}
                value={projectName}
              />

              {activeCustomer && (
                <span className="badge badge-primary shrink-0">
                  {activeCustomer.name}
                </span>
              )}

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
              {/* Status message with auto-clear */}
              {status.message && (
                <div
                  className={cn(
                    "mr-2 flex items-center gap-2 text-[13px] text-[var(--muted)]",
                    status.exiting ? "toast-exit" : "toast-enter",
                  )}
                  role="status"
                  aria-live="polite"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  </span>
                  <span className="max-w-52 truncate font-medium">
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

              {/* Save */}
              <Tip label="Save project (Ctrl+S)">
                <button
                  type="button"
                  aria-label="Save project"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const project = snapshotProject();
                    status.show(`Saved "${project.name}".`);
                  }}
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </Tip>

              {/* Export dropdown */}
              <ExportDropdown
                onExportJson={() => {
                  const project = snapshotProject();
                  exportProjectJson(project, `${project.name}.pallet.json`);
                  status.show("Exported JSON.");
                }}
                onExportPdf={async () => {
                  status.show("Generating PDF...");
                  const project = snapshotProject();
                  await exportProjectPdf(project, `${project.name}.pdf`);
                  status.show("Exported planogram PDF.");
                }}
              />
            </div>
          </header>

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
      </div>
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
  activeCustomer: ReturnType<typeof getCustomerById>;
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
