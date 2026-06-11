import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { DisplayProject, InventoryLocation, InventorySnapshot, Product, Retailer, Salesperson, Season } from './types'
import { RoleAppLayout } from './components/layout/role-app-layout'
import { LegacyFlatRedirect } from './components/layout/legacy-flat-redirect'
import { RoleLauncher } from './pages/role-launcher'
import { ManagerSalesmanView } from './pages/manager-views/salesman-view'
import { ManagerBuilderView } from './pages/manager-views/builder-view'
import { ManagerBuyerView } from './pages/manager-views/buyer-view'
import { EditorPage } from './pages/editor-page'
import { CatalogPage } from './pages/catalog-page'
import { ProductDetailPage } from './pages/product-detail-page'
import { RetailersPage } from './pages/retailers-page'
import { RetailerDetailPage } from './pages/retailer-detail-page'
import { PalletDetailPage } from './pages/pallet-detail-page'
import { ProgramRollupPage } from './pages/program-rollup-page'
import { SeasonsPage } from './pages/seasons-page'
import { BuildQueuePage } from './pages/build-queue-page'
import { HomePage } from './pages/home-page'
import { DemandPage } from './pages/demand-page'
import { AssignmentsPage } from './pages/assignments-page'
import { TransfersPage } from './pages/transfers-page'
import { ScenePage } from './pages/scene-page'
import { PalletsPage } from './pages/pallets-page'
import { useDisplayStore } from './stores/display-store'
import { useCatalogStore } from './stores/catalog-store'
import { useRetailerStore } from './stores/retailer-store'
import { useSeasonStore } from './stores/season-store'
import { useSalespersonStore } from './stores/salesperson-store'
import { useInventoryStore } from './stores/inventory-store'
import { useAppSettingsStore } from './stores/app-settings-store'
import { mockRetailers, mockSalespeople } from './lib/mock-data'
import { loadInventoryInfo } from './lib/inventory-info-loader'
import { mergeInventoryInfoIntoProducts } from './lib/inventory-info-import'
import { migrateProjectPlacements } from './lib/placementMigration'
import {
  pruneOrphanedAssortmentAndPlacements,
  pruneOrphanedAuthorizedItems,
} from './lib/cascade-delete'

const PROJECT_STORAGE_KEY = 'palletforge-project'
const PALLETS_STORAGE_KEY = 'palletforge-pallets'
const ACTIVE_PALLET_STORAGE_KEY = 'palletforge-active-pallet-id'
const CATALOG_STORAGE_KEY = 'palletforge-products'
const RETAILER_STORAGE_KEY = 'palletforge-retailers'
const SEASONS_STORAGE_KEY = 'palletforge-seasons'
const SALESPEOPLE_STORAGE_KEY = 'palletforge-salespeople'
const INVENTORY_STORAGE_KEY = 'palletforge-inventory'
const MIGRATION_KEY = 'palletforge-migration-version'
// Bump when a destructive migration needs to re-run for every user.
const CURRENT_MIGRATION_VERSION = '2026-05-11-orphan-cleanup-v2'

function loadPersistedState<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function mergeCatalogProducts(
  persistedProducts: Product[] | null,
  fallbackProducts: Product[]
) {
  if (!persistedProducts) return fallbackProducts

  const fallbackMap = new Map(
    fallbackProducts.map((product) => [product.id, product])
  )

  const merged = persistedProducts.map((product) => {
    const fallbackProduct = fallbackMap.get(product.id)
    if (!fallbackProduct) return product

    return {
      ...fallbackProduct,
      ...product,
    }
  })

  const persistedIds = new Set(persistedProducts.map((product) => product.id))

  fallbackProducts.forEach((product) => {
    if (!persistedIds.has(product.id)) {
      merged.push(product)
    }
  })

  return merged
}

function mergeRetailers(
  persistedRetailers: Retailer[] | null,
  fallbackRetailers: Retailer[]
) {
  if (!persistedRetailers) return fallbackRetailers

  const fallbackMap = new Map(
    fallbackRetailers.map((retailer) => [retailer.id, retailer])
  )

  const mergedRetailers = persistedRetailers.map((retailer) => {
    const status = retailer.status === 'pending' ? 'active' : retailer.status
    const fallbackRetailer = fallbackMap.get(retailer.id)
    if (!fallbackRetailer) return { ...retailer, status }

    const authorizedItems = [...retailer.authorizedItems]
    const authorizedIds = new Set(
      retailer.authorizedItems.map((item) => item.productId)
    )

    fallbackRetailer.authorizedItems.forEach((item) => {
      if (!authorizedIds.has(item.productId)) {
        authorizedItems.push(item)
      }
    })

    return {
      ...retailer,
      status,
      authorizedItems,
    }
  })

  const persistedIds = new Set(persistedRetailers.map((retailer) => retailer.id))
  fallbackRetailers.forEach((retailer) => {
    if (!persistedIds.has(retailer.id)) {
      mergedRetailers.push({
        ...retailer,
        status: retailer.status === 'pending' ? 'active' : retailer.status,
      })
    }
  })

  return mergedRetailers
}

export default function App() {
  useEffect(() => {
    const catalogProducts = mergeCatalogProducts(
      loadPersistedState(CATALOG_STORAGE_KEY),
      []
    )
    const retailers = mergeRetailers(
      loadPersistedState(RETAILER_STORAGE_KEY),
      mockRetailers
    )

    useCatalogStore
      .getState()
      .setProducts(catalogProducts)

    loadInventoryInfo().then((inventoryInfo) => {
      if (inventoryInfo.length === 0) return
      const catalogState = useCatalogStore.getState()
      const result = mergeInventoryInfoIntoProducts(
        catalogState.products,
        inventoryInfo,
      )
      if (result.products.length > 0) {
        catalogState.setProducts(result.products)
      }

      // One-time orphan cleanup: drop assortment entries + placements that
      // reference productIds no longer in the catalog (e.g. legacy mock
      // prod-N entries from before we removed the seed). Gated by a
      // version key so each user pays the cost exactly once.
      const ranVersion = localStorage.getItem(MIGRATION_KEY)
      if (ranVersion !== CURRENT_MIGRATION_VERSION) {
        const validIds = new Set(
          useCatalogStore.getState().products.map((product) => product.id),
        )

        const retailerState = useRetailerStore.getState()
        const { next: cleanedRetailers, dropped: authDropped } =
          pruneOrphanedAuthorizedItems(retailerState.retailers, validIds)
        if (authDropped > 0) {
          retailerState.setRetailers(cleanedRetailers)
        }

        const displayState = useDisplayStore.getState()
        const { next, assortmentDropped, placementsDropped } =
          pruneOrphanedAssortmentAndPlacements(displayState.projects, validIds)
        if (assortmentDropped > 0 || placementsDropped > 0) {
          displayState.setProjects(next)
          const currentId = displayState.currentProject?.id
          if (currentId) {
            const updated = next.find((p) => p.id === currentId)
            if (updated) displayState.setCurrentProject(updated)
          }
        }

        if (authDropped > 0 || assortmentDropped > 0 || placementsDropped > 0) {
          console.info(
            `[migration] orphan cleanup pruned ${authDropped} authorized items, ${assortmentDropped} assortment entries, and ${placementsDropped} placements`,
          )
        }
        try {
          localStorage.setItem(MIGRATION_KEY, CURRENT_MIGRATION_VERSION)
        } catch {
          // best effort
        }
      }
    })

    useRetailerStore
      .getState()
      .setRetailers(retailers)

    const persistedSeasons = loadPersistedState<Season[]>(SEASONS_STORAGE_KEY) ?? []
    useSeasonStore.getState().setSeasons(
      persistedSeasons.map((season) => ({
        ...season,
        archived: season.archived ?? false,
      })),
    )

    // Fall back to the demo team (same pattern as retailers) so the salesman
    // workspace is usable in a fresh browser instead of dead-ending on
    // "no salespeople yet".
    const persistedSalespeople =
      loadPersistedState<Salesperson[]>(SALESPEOPLE_STORAGE_KEY) ?? mockSalespeople
    useSalespersonStore.getState().setSalespeople(persistedSalespeople)

    const persistedInventory = loadPersistedState<
      Record<InventoryLocation, InventorySnapshot | null>
    >(INVENTORY_STORAGE_KEY) ?? { hook: null, goshen: null }
    useInventoryStore.getState().hydrate(persistedInventory)

    const persistedProjects = loadPersistedState<DisplayProject[]>(PALLETS_STORAGE_KEY)
    const legacyProject = loadPersistedState<DisplayProject>(PROJECT_STORAGE_KEY)
    const MOCK_PALLET_IDS = new Set(['proj-1', 'proj-2', 'proj-3'])
    const rawProjects = persistedProjects ?? (legacyProject ? [legacyProject] : [])
    const getRetailerForProject = (retailerId: string) =>
      useRetailerStore.getState().getRetailer(retailerId)
    const projects = rawProjects
      .filter((project) => !MOCK_PALLET_IDS.has(project.id))
      .map((project) => ({
        ...project,
        assortment: project.assortment ?? [],
        seasonId: project.seasonId ?? null,
        buildLocation: project.buildLocation ?? null,
        laborCost:
          project.laborCost ?? (project.palletType === 'half' ? 50 : 75),
        status: project.status ?? 'draft',
      }))
      // Physics sandbox migration: give every slot-based placement a world
      // transform so it can spawn as a rigid body where it always rendered.
      .map((project) =>
        migrateProjectPlacements(project, getRetailerForProject(project.retailerId)),
      )
    const activePalletId = localStorage.getItem(ACTIVE_PALLET_STORAGE_KEY)
    const activeProject =
      projects.find((project) => project.id === activePalletId) ??
      (legacyProject ? projects.find((project) => project.id === legacyProject.id) : undefined) ??
      projects[0]

    useDisplayStore.getState().setProjects(projects)
    if (activeProject) {
      useDisplayStore.getState().setCurrentProject(activeProject)
    }

    const unsubscribeCatalog = useCatalogStore.subscribe((state) => {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state.products))
    })

    const unsubscribeRetailers = useRetailerStore.subscribe((state) => {
      localStorage.setItem(RETAILER_STORAGE_KEY, JSON.stringify(state.retailers))
    })

    const unsubscribeSeasons = useSeasonStore.subscribe((state) => {
      localStorage.setItem(SEASONS_STORAGE_KEY, JSON.stringify(state.seasons))
    })

    const unsubscribeSalespeople = useSalespersonStore.subscribe((state) => {
      localStorage.setItem(SALESPEOPLE_STORAGE_KEY, JSON.stringify(state.salespeople))
    })

    const unsubscribeInventory = useInventoryStore.subscribe((state) => {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(state.snapshots))
    })

    return () => {
      unsubscribeCatalog()
      unsubscribeRetailers()
      unsubscribeSeasons()
      unsubscribeSalespeople()
      unsubscribeInventory()
    }
  }, [])

  useEffect(() => {
    const unsubscribeProject = useDisplayStore.subscribe((state) => {
      if (!useAppSettingsStore.getState().settings.autoSaveProject) return

      localStorage.setItem(PALLETS_STORAGE_KEY, JSON.stringify(state.projects))
      if (state.currentProject) {
        localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(state.currentProject))
        localStorage.setItem(ACTIVE_PALLET_STORAGE_KEY, state.currentProject.id)
        return
      }

      localStorage.removeItem(PROJECT_STORAGE_KEY)
      localStorage.removeItem(ACTIVE_PALLET_STORAGE_KEY)
    })

    return () => unsubscribeProject()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleLauncher />} />

        <Route path="/:role" element={<RoleAppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="catalog/:id" element={<ProductDetailPage />} />
          <Route path="retailers" element={<RetailersPage />} />
          <Route path="retailers/:id" element={<RetailerDetailPage />} />
          <Route
            path="retailers/:retailerId/pallets/:palletId"
            element={<PalletDetailPage />}
          />
          <Route
            path="retailers/:retailerId/pallets/:palletId/editor"
            element={<EditorPage />}
          />
          <Route
            path="retailers/:retailerId/program/:season"
            element={<ProgramRollupPage />}
          />
          <Route path="seasons" element={<SeasonsPage />} />
          <Route path="builders" element={<BuildQueuePage />} />
          <Route path="demand" element={<DemandPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="scene" element={<ScenePage />} />
          <Route path="pallets" element={<PalletsPage />} />
          <Route path="views/salesman" element={<ManagerSalesmanView />} />
          <Route path="views/builder" element={<ManagerBuilderView />} />
          <Route path="views/buyer" element={<ManagerBuyerView />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>

        {/* Legacy flat URLs bounce to the current role's prefix. */}
        <Route path="/catalog/*" element={<LegacyFlatRedirect />} />
        <Route path="/retailers/*" element={<LegacyFlatRedirect />} />
        <Route path="/seasons" element={<LegacyFlatRedirect />} />
        <Route path="/builders" element={<LegacyFlatRedirect />} />
        <Route path="/demand" element={<LegacyFlatRedirect />} />
        <Route path="/assignments" element={<LegacyFlatRedirect />} />
        <Route path="/transfers" element={<LegacyFlatRedirect />} />
        <Route path="/scene" element={<LegacyFlatRedirect />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
