import type { PalletConfig } from "@/types/pallet";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

export interface BuilderProject {
  id: string;
  name: string;
  description?: string;
  pallet: PalletConfig;
  products: Product[];
  placements: PlacedItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
}
