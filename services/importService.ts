import Papa from "papaparse";
import * as XLSX from "xlsx";
import { nanoid } from "nanoid";

import type { HolidayType, Product } from "@/types/product";

type RawRow = Record<string, string | number | undefined>;

function findValue(row: RawRow, keys: string[]) {
  const entries = Object.entries(row);

  for (const key of keys) {
    const match = entries.find(([column]) => column.trim().toLowerCase() === key);

    if (match && match[1] !== undefined) {
      return String(match[1]).trim();
    }
  }

  return "";
}

function parseHoliday(value: string): HolidayType {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "christmas" ||
    normalized === "hanukkah" ||
    normalized === "passover" ||
    normalized === "rosh-hashanah" ||
    normalized === "everyday"
  ) {
    return normalized;
  }

  return "everyday";
}

function toNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function mapRowToProduct(row: RawRow): Product | null {
  const sku = findValue(row, ["sku", "itemnumber", "item number", "item", "product sku"]);
  const name = findValue(row, ["name", "description", "product", "item name"]);

  if (!sku || !name) {
    return null;
  }

  return {
    id: nanoid(),
    sku,
    name,
    description: findValue(row, ["description", "details"]),
    category: findValue(row, ["category", "department"]) || "Imported",
    holiday: parseHoliday(findValue(row, ["holiday", "season"])),
    dimensions: {
      width: toNumber(findValue(row, ["width", "case width"]), 8),
      height: toNumber(findValue(row, ["height", "case height"]), 9),
      depth: toNumber(findValue(row, ["depth", "case depth"]), 4),
    },
    color: findValue(row, ["color", "hex"]) || "#6f8ca8",
    unitCost: toNumber(findValue(row, ["unit cost", "cost"]), 0),
    unitPrice: toNumber(findValue(row, ["unit price", "price"]), 0),
    unitsPerCase: toNumber(findValue(row, ["units per case", "case pack"]), 12),
  };
}

export async function importProductsFromFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: RawRow[] = [];

  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
  } else {
    const text = await file.text();
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rows = parsed.data;
  }

  const products = rows.map(mapRowToProduct).filter((value): value is Product => value !== null);

  return {
    products,
    imported: products.length,
    rejected: rows.length - products.length,
  };
}
