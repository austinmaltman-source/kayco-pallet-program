import { nanoid } from "nanoid";

import type { WallFace } from "@/types/pallet";
import type { Product } from "@/types/product";

export const WALL_FACES: WallFace[] = ["front", "right", "back", "left"];

export const WALL_LABELS: Record<WallFace, string> = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left",
};

export const PALLET_COPY = {
  headline: "Holiday pallet layout",
  subtitle:
    "Prototype the physical footprint, switch between full and half programs, and frame each selling face before catalog and placement work lands.",
  strapline: "All your holiday needs",
};

export const PROJECT_STORAGE_KEY = "kayco-builder-projects";

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: nanoid(),
    sku: "KAY-CHR-001",
    name: "Chocolate Coins",
    description: "Foil-wrapped holiday chocolate coins in a merchandisable countertop box.",
    category: "Candy",
    holiday: "christmas",
    dimensions: { width: 8, height: 10, depth: 6 },
    color: "#c59c45",
    unitPrice: 7.99,
    unitsPerCase: 12,
  },
  {
    id: nanoid(),
    sku: "KAY-CHR-014",
    name: "Marshmallow Twists",
    description: "Bright peg-bag marshmallows sized for top shelf color blocking.",
    category: "Snacks",
    holiday: "christmas",
    dimensions: { width: 6, height: 9, depth: 4 },
    color: "#cf5d55",
    unitPrice: 5.49,
    unitsPerCase: 18,
  },
  {
    id: nanoid(),
    sku: "KAY-HAN-022",
    name: "Mini Menorah Kit",
    description: "Compact boxed menorah set with candles and holiday insert.",
    category: "Traditions",
    holiday: "hanukkah",
    dimensions: { width: 9, height: 8, depth: 3 },
    color: "#2f5f96",
    unitPrice: 11.99,
    unitsPerCase: 8,
  },
  {
    id: nanoid(),
    sku: "KAY-PAS-031",
    name: "Matzo Variety Pack",
    description: "Shelf-ready family variety pack with reinforced sidewalls.",
    category: "Pantry",
    holiday: "passover",
    dimensions: { width: 10, height: 12, depth: 5 },
    color: "#7a9f6d",
    unitPrice: 8.99,
    unitsPerCase: 10,
  },
  {
    id: nanoid(),
    sku: "KAY-EVE-008",
    name: "Fruit Slice Gummies",
    description: "Colorful everyday gummy pack suitable for impulse-facing rows.",
    category: "Candy",
    holiday: "everyday",
    dimensions: { width: 7, height: 9, depth: 4 },
    color: "#d9733f",
    unitPrice: 4.99,
    unitsPerCase: 20,
  },
  {
    id: nanoid(),
    sku: "KAY-ROS-017",
    name: "Honey Sampler",
    description: "Giftable honey set designed for premium placement near eye line.",
    category: "Gifts",
    holiday: "rosh-hashanah",
    dimensions: { width: 8, height: 7, depth: 5 },
    color: "#b7832d",
    unitPrice: 14.99,
    unitsPerCase: 6,
  },
];
