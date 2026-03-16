export type HolidayType =
  | "christmas"
  | "hanukkah"
  | "passover"
  | "rosh-hashanah"
  | "everyday";

export type PackagingShape = "box" | "bottle" | "jar" | "bag" | "tin" | "pouch";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  holiday: HolidayType;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  color: string;
  imageUrl?: string;
  unitCost?: number;
  unitPrice?: number;
  unitsPerCase?: number;
  packaging?: PackagingShape;
  artworkUrl?: string;
}
