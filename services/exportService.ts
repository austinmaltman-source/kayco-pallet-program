import { jsPDF } from "jspdf";

import { WALL_LABELS } from "@/lib/constants";
import type { WallFace } from "@/types/pallet";
import type { BuilderProject } from "@/types/project";
import type { PlacedItem } from "@/types/placement";
import type { Product } from "@/types/product";

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildPlacementSummary(placements: PlacedItem[], products: Product[]) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const summary = new Map<
    string,
    { productId: string; sku: string; name: string; count: number; unitPrice?: number }
  >();

  for (const placement of placements) {
    const product = productMap.get(placement.productId);

    if (!product) {
      continue;
    }

    const existing = summary.get(product.id) ?? {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      count: 0,
      unitPrice: product.unitPrice,
    };

    existing.count += placement.quantity;
    summary.set(product.id, existing);
  }

  return Array.from(summary.values());
}

function buildWallPlacements(placements: PlacedItem[], products: Product[], wall: WallFace) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return placements
    .filter((p) => p.wall === wall)
    .map((p) => ({
      ...p,
      product: productMap.get(p.productId),
    }))
    .filter((p) => p.product)
    .sort((a, b) => b.shelfRow - a.shelfRow || a.gridCol - b.gridCol);
}

function drawBomTableHeader(pdf: jsPDF, margin: number, contentWidth: number, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("SKU", margin, y);
  pdf.text("Product Name", margin + 90, y);
  pdf.text("Category", margin + 260, y);
  pdf.text("Dimensions", margin + 340, y);
  pdf.text("Units", margin + 420, y);
  pdf.text("Price", margin + 460, y);
  pdf.text("Total", margin + 510, y);
  y += 4;
  pdf.setDrawColor(80, 80, 80);
  pdf.setLineWidth(1);
  pdf.line(margin, y, margin + contentWidth, y);
  pdf.setLineWidth(0.5);

  return y + 14;
}

/**
 * Multi-page PDF planogram with per-wall grids and SKU tables.
 * Page 1: Overview + placement summary
 * Pages 2+: Per-wall grid + placement details
 * Last page: Bill of Materials
 */
export async function exportProjectPdf(
  project: BuilderProject,
  filename: string,
) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // --- PAGE 1: Overview ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text(project.name, margin, margin + 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `${project.pallet.type.toUpperCase()} PALLET  |  ${project.pallet.base.width}" x ${project.pallet.base.depth}"  |  Updated ${new Date(project.updatedAt).toLocaleString()}`,
    margin,
    margin + 32,
  );
  pdf.setTextColor(0, 0, 0);

  // Summary
  let y = margin + 56;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Placement Summary", margin, y);
  y += 22;

  const summary = buildPlacementSummary(project.placements, project.products);
  const totalUnits = summary.reduce((sum, item) => sum + item.count, 0);
  pdf.setFontSize(9);

  pdf.setFont("helvetica", "bold");
  pdf.text("SKU", margin, y);
  pdf.text("Product", margin + 80, y);
  pdf.text("Qty", margin + 280, y);
  y += 4;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(margin, y, margin + 310, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  for (const item of summary) {
    if (y > pageHeight - 60) break;
    pdf.text(item.sku, margin, y);
    pdf.text(item.name.substring(0, 32), margin + 80, y);
    pdf.text(`x${item.count}`, margin + 280, y);
    y += 14;
  }

  y += 6;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(margin, y, margin + 310, y);
  y += 14;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total SKUs: ${summary.length}`, margin, y);
  y += 14;
  pdf.text(`Total Units: ${totalUnits}`, margin, y);

  // --- PAGES 2+: Per-wall views ---
  const wallFaces: WallFace[] = ["front", "back", "left", "right"];

  for (const face of wallFaces) {
    const wallConfig = project.pallet.display.walls[face];
    if (!wallConfig.enabled || wallConfig.wallType !== "shelves") continue;

    const wallPlacements = buildWallPlacements(project.placements, project.products, face);
    if (wallPlacements.length === 0) continue;

    pdf.addPage();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(`${WALL_LABELS[face]} Wall`, margin, margin + 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `${wallConfig.gridColumns} columns  |  ${project.pallet.display.shelfRows} shelf rows  |  ${project.pallet.display.rowHeight}" row height`,
      margin,
      margin + 30,
    );
    pdf.setTextColor(0, 0, 0);

    // Draw grid
    let gridY = margin + 48;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Shelf Layout", margin, gridY);
    gridY += 18;

    const gridW = contentWidth * 0.55;
    const cols = wallConfig.gridColumns;
    const rows = project.pallet.display.shelfRows;
    const cellW = gridW / cols;
    const cellH = 48;
    const gridH = rows * cellH;

    pdf.setFillColor(245, 241, 232);
    pdf.rect(margin, gridY, gridW, gridH, "F");

    pdf.setDrawColor(200, 190, 175);
    pdf.setLineWidth(0.5);
    for (let r = 0; r <= rows; r++) {
      pdf.line(margin, gridY + r * cellH, margin + gridW, gridY + r * cellH);
    }
    for (let c = 0; c <= cols; c++) {
      pdf.line(margin + c * cellW, gridY, margin + c * cellW, gridY + gridH);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    for (let r = 0; r < rows; r++) {
      const shelfNum = rows - r;
      pdf.text(`Row ${shelfNum}`, margin - 28, gridY + r * cellH + cellH / 2 + 2);
    }
    pdf.setTextColor(0, 0, 0);

    pdf.setFontSize(7);
    for (const placement of wallPlacements) {
      const product = placement.product!;
      const visualRow = rows - 1 - placement.shelfRow;
      const x = margin + placement.gridCol * cellW + 2;
      const cellY = gridY + visualRow * cellH + 2;
      const w = placement.colSpan * cellW - 4;
      const h = cellH - 4;

      pdf.setFillColor(
        parseInt(product.color?.slice(1, 3) ?? "cc", 16),
        parseInt(product.color?.slice(3, 5) ?? "cc", 16),
        parseInt(product.color?.slice(5, 7) ?? "cc", 16),
      );
      pdf.roundedRect(x, cellY, w, h, 2, 2, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      const label = product.sku.length > 14 ? product.sku.substring(0, 14) : product.sku;
      pdf.text(label, x + 3, cellY + 12);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      const name = product.name.length > 18 ? product.name.substring(0, 18) + "..." : product.name;
      pdf.text(name, x + 3, cellY + 22);
      pdf.text(`x${placement.quantity}`, x + 3, cellY + 32);
      pdf.setTextColor(0, 0, 0);
    }

    // Placement table
    const tableX = margin + contentWidth * 0.6;
    let tableY = margin + 48;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Placement Details", tableX, tableY);
    tableY += 16;

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("SKU", tableX, tableY);
    pdf.text("Product", tableX + 70, tableY);
    pdf.text("Row", tableX + 170, tableY);
    pdf.text("Col", tableX + 195, tableY);
    pdf.text("Qty", tableX + 220, tableY);
    tableY += 4;
    pdf.setDrawColor(180, 180, 180);
    pdf.line(tableX, tableY, tableX + 240, tableY);
    tableY += 10;

    pdf.setFont("helvetica", "normal");
    for (const placement of wallPlacements) {
      if (tableY > pageHeight - 40) break;
      const product = placement.product!;
      pdf.text(product.sku, tableX, tableY);
      pdf.text(product.name.substring(0, 18), tableX + 70, tableY);
      pdf.text(`${placement.shelfRow + 1}`, tableX + 170, tableY);
      pdf.text(`${placement.gridCol + 1}`, tableX + 195, tableY);
      pdf.text(`${placement.quantity}`, tableX + 220, tableY);
      tableY += 12;
    }
  }

  // --- LAST PAGE: Bill of Materials ---
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Bill of Materials", margin, margin + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`${project.name}  |  Generated ${new Date().toLocaleString()}`, margin, margin + 30);
  pdf.setTextColor(0, 0, 0);

  let bomY = drawBomTableHeader(pdf, margin, contentWidth, margin + 52);

  const productMap = new Map(project.products.map((p) => [p.id, p]));
  let grandTotal = 0;

  pdf.setFont("helvetica", "normal");
  for (const item of summary) {
    if (bomY > pageHeight - 50) {
      pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Bill of Materials", margin, margin + 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${project.name}  |  Continued`, margin, margin + 30);
      pdf.setTextColor(0, 0, 0);
      bomY = drawBomTableHeader(pdf, margin, contentWidth, margin + 52);
    }
    const product = productMap.get(item.productId);
    const dims = product
      ? `${product.dimensions.width}" x ${product.dimensions.height}" x ${product.dimensions.depth}"`
      : "";
    const lineTotal = item.unitPrice ? item.count * item.unitPrice : 0;
    grandTotal += lineTotal;

    pdf.text(item.sku, margin, bomY);
    pdf.text(item.name.substring(0, 28), margin + 90, bomY);
    pdf.text(product?.category ?? "", margin + 260, bomY);
    pdf.text(dims, margin + 340, bomY);
    pdf.text(`${item.count}`, margin + 420, bomY);
    pdf.text(item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : "-", margin + 460, bomY);
    pdf.text(lineTotal > 0 ? `$${lineTotal.toFixed(2)}` : "-", margin + 510, bomY);
    bomY += 14;
  }

  bomY += 4;
  pdf.setDrawColor(80, 80, 80);
  pdf.setLineWidth(1);
  pdf.line(margin, bomY, margin + contentWidth, bomY);
  bomY += 16;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(`Total SKUs: ${summary.length}`, margin, bomY);
  pdf.text(`Total Units: ${totalUnits}`, margin + 160, bomY);
  if (grandTotal > 0) {
    pdf.text(`Estimated Value: $${grandTotal.toFixed(2)}`, margin + 320, bomY);
  }

  pdf.save(filename);
}

export function exportProjectJson(project: BuilderProject, filename: string) {
  triggerDownload(
    filename,
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
  );
}

export async function importProjectJson(file: File) {
  const text = await file.text();
  return JSON.parse(text) as BuilderProject;
}
