export interface DisplayBranding {
  lipText?: string;        // e.g., "ALL YOUR HOLIDAY NEEDS"
  lipTextColor?: string;   // default "#FFFFFF"
  headerText?: string;     // e.g., "Rosh Hashanah"
  headerTextColor?: string; // default "#FFFFFF"  
  headerBackgroundColor?: string; // default uses cardboard color
}

export interface AssortmentEntry {
  productId: string
  cases: number
}

export interface ProductDimensions {
  width: number
  height: number
  depth: number
  source: 'manual' | 'calculated'
}

export type WallFace = TrayFace

export interface WallConfig {
  type: 'shelves' | 'branded-panel'
  gridColumns: number
}

export interface PalletConfig {
  base: {
    width: number
    depth: number
    height: number
  }
  maxWeight?: number
}

export type Orientation3D = 'upright' | 'on-side' | 'on-end' | 'inverted'

export interface OrientationRule {
  orientation: Orientation3D
  rotationDeg: 0 | 90 | 180 | 270
}

export interface StackRule {
  stackable: boolean
  fragile: boolean
  crushable: boolean
  maxStackLoadLb?: number
  nestingPercent?: number
}

export type RetailerPreset = 'costco' | 'sams' | 'walmart' | 'bjs'

export interface PalletSpec {
  id: 'gma-48x40' | 'half-48x20' | 'quarter-24x20' | 'custom'
  label: string
  widthIn: number
  depthIn: number
  baseHeightIn: number
  maxLoadLb: number
  maxHeightIn: number
  noOverhang: boolean
  underhangMaxIn: number
  primaryFaceIn: 40 | 48
  retailerPreset?: RetailerPreset
}

export type PalletWarning =
  | { kind: 'overweight'; tier?: number; lb: number; maxLb: number }
  | { kind: 'overhang'; placementId: string; overhangIn: number }
  | { kind: 'overheight'; usedIn: number; maxIn: number }
  | { kind: 'crush'; placementId: string; loadAboveLb: number; maxLoadLb: number }
  | { kind: 'unsupported'; placementId: string; supportPct: number }
  | { kind: 'fragile-under-heavy'; placementId: string }
  | { kind: 'orientation-disallowed'; placementId: string; orientation: Orientation3D }

export interface PalletKPIs {
  cubeUtilizationPct: number
  weightUtilizationPct: number
  footprintUtilizationPct: number
  totalCases: number
  totalUnits: number
  totalWeightLb: number
  heightUsedIn: number
  warnings: PalletWarning[]
}

export interface PlacementSuggestion {
  type:
    | 'alternative-position'
    | 'alternative-tier'
    | 'alternative-wall'
    | 'rotate'
    | 'reduce-quantity'
  message: string
  wall?: WallFace
  tier?: number
  gridCol?: number
  displayMode?: 'face-out' | 'spine-out'
  maxQuantity?: number
  priority: number
}

export interface FullValidationResult {
  valid: boolean
  errors: Array<{ rule: string; reason: string }>
  warnings: Array<{ rule: string; reason: string }>
  suggestions: PlacementSuggestion[]
}

export interface GhostProduct {
  slotId: string;          // "tierId-slotIndex"
  width: number;           // product case width in inches
  height: number;          // product case height
  depth: number;           // product case depth
  color: string;           // brand color hex
  label?: string;          // product name to show on the box
  isValid: boolean;        // green if valid, red if invalid
  worldPosition?: [number, number, number]
  rotation?: [number, number, number]
  errorReason?: string
  suggestions?: PlacementSuggestion[]
  suggestionMarkers?: Array<{
    position: [number, number, number]
    message: string
  }>
}

export interface DraggedCaseProduct {
  productId: string
  placementId?: string
  source?: 'tray' | 'scene'
  startClient?: { x: number; y: number }
  startPosition?: { x: number; y: number; z: number }
  width: number
  height: number
  depth: number
  color: string
  label: string
}

export type PackagingType = 'box' | 'bottle' | 'jar' | 'bag' | 'tin' | 'pouch'

export interface CaseConfig {
  unitProductId: string
  layout: {
    cols: number
    rows: number
    layers: number
  }
  caseStyle: 'open-top' | 'closed' | 'tray'
  innerPadding: number
  dividers: boolean
  dimensionOverride?: Partial<ProductDimensions>
}

export interface PlacedProduct {
  id: string;              // unique placement ID
  sourceProductId?: string; // original catalog product ID
  slotId: string;          // "tierId-slotIndex"
  width: number;           // case dimensions
  height: number;
  depth: number;
  color: string;           // brand color
  label: string;           // product name
  sku: string;             // SKU code
  category?: string;
  imageUrl?: string;       // product image URL (Tier 1)
  modelUrl?: string;       // .glb model URL (Tier 3)
  packaging?: PackagingType; // packaging type for scaling strategy
  caseConfig?: CaseConfig;
  orientation?: number;    // index into ORIENTATION_PRESETS (0-5)
  position?: { x: number; y: number; z: number }
  rotationDeg?: 0 | 90 | 180 | 270
  orientation3D?: Orientation3D
  caseStackHeight?: number
  wall?: WallFace
  tier?: number
  gridCol?: number
  colSpan?: number
  quantity?: number
  displayMode?: 'face-out' | 'spine-out'
  renderStyle?: 'single' | 'facing-row' | 'deep-stock' | 'stepped-stack' | 'case'
  facings?: number
  rows?: number
  layers?: number
  merchGap?: number
}

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';
export type DisplayEnvironment = 'retail' | 'studio' | 'clean'

export interface PalletDisplayProps {
  // Configuration
  tierCount?: number; // 2-6, default 4
  palletType?: PalletType; // 'full' | 'half', default 'full'
  palletDimensions?: { width: number; depth: number; height: number }; // default 48×40×6
  maxDisplayHeight?: number; // inches, default 60

  // Branding
  lipColor?: string; // hex, default "#3B7DD8"
  branding?: DisplayBranding;

  // Products
  placedProducts?: PlacedProduct[];
  ghostProduct?: GhostProduct | null;
  draggedCaseProduct?: DraggedCaseProduct | null;
  selectedProductId?: string | null;

  // Interaction callbacks
  onSlotClick?: (tierId: number, slotIndex: number, position: [number, number, number]) => void;
  onSlotHover?: (tierId: number, slotIndex: number, position: [number, number, number]) => void;
  onSlotHoverEnd?: () => void;
  onProductClick?: (productId: string) => void;
  onRotateProduct?: (productId: string) => void;
  onDeleteProduct?: (productId: string) => void;
  onProductDragStart?: (
    productId: string,
    pointer: { clientX: number; clientY: number },
  ) => void;
  onFreeformDrop?: (position: { x: number; y: number; z: number }) => void;
  onFreeformDragCancel?: () => void;
  settleFreeformDrop?: (
    position: { x: number; y: number; z: number },
  ) => { x: number; y: number; z: number };
  validateFreeformDrop?: (
    position: { x: number; y: number; z: number },
  ) => FullValidationResult | undefined;
  hiddenProductId?: string | null;

  // Camera
  autoRotate?: boolean; // default false
  initialCameraPosition?: [number, number, number];
  cameraPreset?: CameraPreset;
  onCameraPresetChange?: (preset: CameraPreset) => void;

  // Display
  showSlotGrid?: boolean; // default true
  showHeader?: boolean; // default true
  environment?: DisplayEnvironment; // default 'retail'
}

export interface TierConfig {
  id: number;
  width: number;
  depth: number;
  height: number;
  shelfDepth: number;
  trayHeight: number;
  yOffset: number;
  slotGridSize: number;
}

export type Brand =
  | 'tuscanini'
  | 'kedem'
  | 'gefen'
  | 'liebers'
  | 'haddar'
  | 'osem'
  | 'other'

export type Holiday = 'rosh-hashanah' | 'pesach' | 'sukkos' | 'none'

export type PalletType = 'full' | 'half'

export type UnitSystem = 'imperial' | 'metric'

export type ViewMode = '2d' | '3d'

export type TrayFace = 'front' | 'back' | 'left' | 'right'

export interface Product {
  id: string
  name: string
  sku: string
  upc?: string
  kaycoItemNumber?: string
  buyer?: string
  caseCost?: number
  brand: Brand
  brandCode?: string
  brandColor: string
  category: string
  width: number
  height: number
  depth: number
  weight: number
  unitsPerCase?: number
  imageUrl?: string
  modelUrl?: string
  packaging?: PackagingType
  variantType?: 'single' | 'case'
  parentProductId?: string
  autoGeneratedCase?: boolean
  caseConfig?: CaseConfig
  holidayTags: Holiday[]
  allowedOrientations?: Orientation3D[]
  stackable?: boolean
  fragile?: boolean
  crushable?: boolean
  maxStackLoadLb?: number
  nestingPercent?: number
  caseWidth?: number
  caseDepth?: number
  caseHeight?: number
  caseWeight?: number
  shelfReadyTray?: boolean
  heroImageUrl?: string
}

export type RetailerStatus = 'active' | 'pending' | 'inactive'

export type RetailerTier = 'enterprise' | 'premium' | 'standard'

export interface RetailerContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
  isPrimary: boolean
}

export interface AuthorizedItem {
  productId: string
  productName: string
  sku: string
  brand: Brand
  status: 'authorized' | 'pending' | 'discontinued'
  authorizedDate: string
  lastOrderDate?: string
  avgMonthlyUnits?: number
  marginPercent?: number
  casePrice?: number
}

export interface ComplianceRecord {
  id: string
  requirement: string
  status: 'compliant' | 'action-required' | 'pending-review'
  lastAuditDate: string
  nextAuditDate: string
  notes?: string
}

export interface RetailerPerformance {
  totalRevenueMTD: number
  totalRevenueYTD: number
  avgOrderValue: number
  fillRate: number
  onTimeDelivery: number
  returnRate: number
  displayComplianceScore: number
}

export interface DisplayHistoryEntry {
  id: string
  projectName: string
  holiday: Holiday
  createdAt: string
  status: 'active' | 'completed' | 'draft'
  tierCount: number
  productCount: number
}

export interface Retailer {
  id: string
  name: string
  logo?: string
  status: RetailerStatus
  tier: RetailerTier
  defaultTierCount: number
  maxDisplayHeight: number
  palletDimensions: { width: number; depth: number; height: number }
  notes?: string
  // Extended fields
  storeCount: number
  regions: string[]
  headquartersCity: string
  headquartersState: string
  accountManager: string
  contractStart: string
  contractEnd: string
  website: string
  contacts: RetailerContact[]
  authorizedItems: AuthorizedItem[]
  compliance: ComplianceRecord[]
  performance: RetailerPerformance
  displayHistory: DisplayHistoryEntry[]
  tags: string[]
  // Kayco Sales Intelligence accounts linked to this retailer (a retailer can
  // map to several ship-to accounts, e.g. Costco's regional DCs). Drives the
  // customer-scoped sales shown in the program item picker.
  kaycoAccounts?: { id: string; name: string }[]
  // Case-insensitive account-NAME prefixes that auto-include every matching
  // ship-to account ("COSTCO" catches all 13 Costco DCs plus future ones).
  // Explicit kaycoAccounts links are for accounts whose names don't match,
  // e.g. a distributor DC that services this retailer.
  kaycoAccountPatterns?: string[]
}

export interface PalletWizardConfig {
  palletType: PalletType
  season: Holiday
  retailerId: string
  seasonId?: string | null
}

export type BuildLocation = 'hook' | 'goshen' | 'third-party'

export type Role = 'salesman' | 'buyer' | 'builder' | 'manager'

export interface Salesperson {
  id: string
  name: string
  retailerIds: string[]
  createdAt: number
}

export type PalletStatus = 'draft' | 'ready' | 'in_build' | 'built'

export interface BuildLogEntry {
  date: string  // YYYY-MM-DD
  built: number
  note?: string
}

export interface PalletComment {
  id: string
  authorRole: Role
  authorName?: string
  text: string
  createdAt: number
}

export type InventoryLocation = 'hook' | 'goshen'

export interface InventorySnapshot {
  location: InventoryLocation
  uploadedAt: number
  // map keyed by Kayco item number (preferred) or productId fallback
  lines: { kaycoItemNumber: string; cases: number }[]
}

export interface DisplayProject {
  id: string
  name: string
  retailerId: string
  holiday: Holiday
  season: Holiday
  seasonId: string | null
  buildLocation: BuildLocation | null
  laborCost: number | null
  corrugateCost: number | null
  status: PalletStatus
  buildLog?: BuildLogEntry[]
  comments?: PalletComment[]
  tierCount: number
  palletType: PalletType
  palletSpec?: PalletSpec
  lipColor: string
  branding: DisplayBranding
  placements: PlacedProduct[]
  assortment: AssortmentEntry[]
  packingRules?: import('../lib/rules/types').Rule[]
  // Items the salesman has picked for this pallet. Persists across sessions
  // even when cases = 0. Undefined on legacy projects — fall back to deriving
  // selection from `assortment` entries.
  selectedProductIds?: string[]
  shipByDate?: number
  // Number of identical pallets the salesman is requesting (default 1).
  // Cases on each assortment entry are per-pallet; multiply by quantity for
  // total cases the retailer is buying / the warehouse needs to build.
  quantity?: number
  createdAt: number
  updatedAt: number
}

export interface Season {
  id: string
  name: string
  archived: boolean
  createdAt: number
  holidayDate?: number
}

export interface SlotGridItem {
  slotId: string
  tierId: number
  slotIndex: number
  face: TrayFace
  row: number
  col: number
  position: [number, number, number]
  width: number
  depth: number
}
