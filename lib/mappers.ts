import type { Product, HolidayType, PackagingShape } from "@/types/product";

type DbProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  holiday: string;
  width: number;
  height: number;
  depth: number;
  color: string;
  imageUrl: string | null;
  unitCost: number | null;
  unitPrice: number | null;
  unitsPerCase: number | null;
  packaging: string | null;
  artworkUrl: string | null;
  modelUrl: string | null;
};

export function dbProductToProduct(
  row: DbProduct,
  customerPricing?: { unitCost: number | null; unitPrice: number | null },
): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    holiday: row.holiday as HolidayType,
    dimensions: {
      width: row.width,
      height: row.height,
      depth: row.depth,
    },
    color: row.color,
    imageUrl: row.imageUrl ?? undefined,
    unitCost: row.unitCost != null ? row.unitCost / 100 : undefined,
    unitPrice: row.unitPrice != null ? row.unitPrice / 100 : undefined,
    customerUnitCost:
      customerPricing?.unitCost != null ? customerPricing.unitCost / 100 : undefined,
    customerUnitPrice:
      customerPricing?.unitPrice != null ? customerPricing.unitPrice / 100 : undefined,
    unitsPerCase: row.unitsPerCase ?? undefined,
    packaging: (row.packaging as PackagingShape) ?? undefined,
    artworkUrl: row.artworkUrl ?? undefined,
    modelUrl: row.modelUrl ?? undefined,
  };
}

export function productToDbValues(product: Product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description ?? null,
    category: product.category,
    holiday: product.holiday,
    width: product.dimensions.width,
    height: product.dimensions.height,
    depth: product.dimensions.depth,
    color: product.color,
    imageUrl: product.imageUrl ?? null,
    unitCost: product.unitCost != null ? Math.round(product.unitCost * 100) : null,
    unitPrice: product.unitPrice != null ? Math.round(product.unitPrice * 100) : null,
    unitsPerCase: product.unitsPerCase ?? null,
    packaging: product.packaging ?? "box",
    artworkUrl: product.artworkUrl ?? null,
    modelUrl: product.modelUrl ?? null,
  };
}
