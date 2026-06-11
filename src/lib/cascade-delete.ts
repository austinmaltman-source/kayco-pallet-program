import type { DisplayProject, Retailer } from '../types'
import { useCatalogStore } from '../stores/catalog-store'
import { useDisplayStore } from '../stores/display-store'
import { useRetailerStore } from '../stores/retailer-store'
import { useSalespersonStore } from '../stores/salesperson-store'

export function pruneOrphanedAuthorizedItems(
  retailers: Retailer[],
  validProductIds: Set<string>,
): { next: Retailer[]; dropped: number } {
  let dropped = 0
  const next = retailers.map((retailer) => {
    const filtered = retailer.authorizedItems.filter((item) => {
      const ok = validProductIds.has(item.productId)
      if (!ok) dropped += 1
      return ok
    })
    if (filtered.length === retailer.authorizedItems.length) return retailer
    return { ...retailer, authorizedItems: filtered }
  })
  return { next, dropped }
}

export function pruneOrphanedAssortmentAndPlacements(
  projects: DisplayProject[],
  validProductIds: Set<string>,
): { next: DisplayProject[]; assortmentDropped: number; placementsDropped: number } {
  let assortmentDropped = 0
  let placementsDropped = 0

  const next = projects.map((project) => {
    const nextAssortment = project.assortment.filter((entry) => {
      const ok = validProductIds.has(entry.productId)
      if (!ok) assortmentDropped += 1
      return ok
    })
    const nextPlacements = project.placements.filter((placement) => {
      if (!placement.sourceProductId) return true
      const ok = validProductIds.has(placement.sourceProductId)
      if (!ok) placementsDropped += 1
      return ok
    })

    if (
      nextAssortment.length === project.assortment.length &&
      nextPlacements.length === project.placements.length
    ) {
      return project
    }

    return {
      ...project,
      assortment: nextAssortment,
      placements: nextPlacements,
      updatedAt: Date.now(),
    }
  })

  return { next, assortmentDropped, placementsDropped }
}

// setProjects resets the active project to the first in the list; restore the
// one the user was on if it survived the prune.
function applyProjects(next: DisplayProject[], previousCurrentId: string | undefined) {
  const displayState = useDisplayStore.getState()
  displayState.setProjects(next)
  if (!previousCurrentId) return
  const survivor = next.find((project) => project.id === previousCurrentId)
  if (survivor) useDisplayStore.getState().setCurrentProject(survivor)
}

export function countProductReferences(productId: string) {
  const projects = useDisplayStore.getState().projects
  const retailers = useRetailerStore.getState().retailers

  let assortmentEntries = 0
  let placements = 0
  const palletIds = new Set<string>()
  for (const project of projects) {
    for (const entry of project.assortment) {
      if (entry.productId !== productId) continue
      assortmentEntries += 1
      palletIds.add(project.id)
    }
    for (const placement of project.placements) {
      if (placement.sourceProductId !== productId) continue
      placements += 1
      palletIds.add(project.id)
    }
  }
  const authorizations = retailers.filter((retailer) =>
    retailer.authorizedItems.some((item) => item.productId === productId),
  ).length

  return { assortmentEntries, placements, pallets: palletIds.size, authorizations }
}

export function describeProductReferences(productId: string) {
  const refs = countProductReferences(productId)
  const parts: string[] = []
  if (refs.pallets > 0) {
    parts.push(
      `${refs.assortmentEntries + refs.placements} reference${
        refs.assortmentEntries + refs.placements === 1 ? '' : 's'
      } across ${refs.pallets} pallet${refs.pallets === 1 ? '' : 's'}`,
    )
  }
  if (refs.authorizations > 0) {
    parts.push(
      `${refs.authorizations} retailer authorization${refs.authorizations === 1 ? '' : 's'}`,
    )
  }
  if (parts.length === 0) {
    return 'This product will be removed from the master catalog.'
  }
  return `This also removes ${parts.join(' and ')}. This cannot be undone.`
}

// Removing a product synchronously prunes every reference so pallets and
// retailer authorizations never point at a missing catalog entry.
export function cascadeDeleteProduct(productId: string) {
  const catalog = useCatalogStore.getState()
  const validIds = new Set(catalog.products.map((product) => product.id))
  validIds.delete(productId)

  const retailerState = useRetailerStore.getState()
  const { next: cleanedRetailers, dropped } = pruneOrphanedAuthorizedItems(
    retailerState.retailers,
    validIds,
  )
  if (dropped > 0) retailerState.setRetailers(cleanedRetailers)

  const displayState = useDisplayStore.getState()
  const { next, assortmentDropped, placementsDropped } =
    pruneOrphanedAssortmentAndPlacements(displayState.projects, validIds)
  if (assortmentDropped > 0 || placementsDropped > 0) {
    applyProjects(next, displayState.currentProject?.id)
  }

  catalog.deleteProduct(productId)
}

export function countRetailerPallets(retailerId: string) {
  return useDisplayStore
    .getState()
    .projects.filter((project) => project.retailerId === retailerId).length
}

// Deleting a retailer takes its pallets with it and unassigns it from
// salespeople so nothing keeps pointing at a missing program.
export function cascadeDeleteRetailer(retailerId: string) {
  const displayState = useDisplayStore.getState()
  const remaining = displayState.projects.filter(
    (project) => project.retailerId !== retailerId,
  )
  if (remaining.length !== displayState.projects.length) {
    applyProjects(remaining, displayState.currentProject?.id)
  }

  const salespersonState = useSalespersonStore.getState()
  for (const salesperson of salespersonState.salespeople) {
    if (!salesperson.retailerIds.includes(retailerId)) continue
    salespersonState.setRetailers(
      salesperson.id,
      salesperson.retailerIds.filter((id) => id !== retailerId),
    )
  }

  useRetailerStore.getState().deleteRetailer(retailerId)
}
