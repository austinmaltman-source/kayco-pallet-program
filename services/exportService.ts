import html2canvas from "html2canvas";
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
  const summary = new Map<string, { sku: string; name: string; count: number; unitPrice?: number }>();

  for (const placement of placements) {
    const product = productMap.get(placement.productId);

    if (!product) {
      continue;
    }

    const existing = summary.get(product.id) ?? {
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

export async function exportViewportImage(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

  if (!blob) {
    return;
  }

  triggerDownload(filename, blob);
}

/**
 * Multi-page PDF planogram with per-wall views and SKU tables.
 * Page 1: Overview (isometric) + project summary
 * Pages 2-5: One page per wall face with 3D capture + placement grid
 * Last page: Bill of Materials summary
 */
export async function exportProjectPdf(
  project: BuilderProject,
  captures: Record<string, string>,
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

  if (captures.isometric) {
    const imgW = contentWidth * 0.58;
    const imgH = imgW * 0.65;
    pdf.addImage(captures.isometric, "PNG", margin, margin + 48, imgW, imgH);
  }

  // Summary sidebar
  const summaryX = margin + contentWidth * 0.62;
  let y = margin + 56;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Placement Summary", summaryX, y);
  y += 22;

  const summary = buildPlacementSummary(project.placements, project.products);
  const totalUnits = summary.reduce((sum, item) => sum + item.count, 0);
  pdf.setFontSize(9);

  // Table header
  pdf.setFont("helvetica", "bold");
  pdf.text("SKU", summaryX, y);
  pdf.text("Product", summaryX + 80, y);
  pdf.text("Qty", summaryX + 210, y);
  y += 4;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(summaryX, y, summaryX + 240, y);
  y += 12;

  pdf.setFont("helvetica", "normal");
  for (const item of summary) {
    if (y > pageHeight - 60) break;
    pdf.text(item.sku, summaryX, y);
    pdf.text(item.name.substring(0, 22), summaryX + 80, y);
    pdf.text(`x${item.count}`, summaryX + 210, y);
    y += 14;
  }

  y += 6;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(summaryX, y, summaryX + 240, y);
  y += 14;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total SKUs: ${summary.length}`, summaryX, y);
  y += 14;
  pdf.text(`Total Units: ${totalUnits}`, summaryX, y);

  // --- PAGES 2-5: Per-wall views ---
  const wallFaces: WallFace[] = ["front", "back", "left", "right"];

  for (const face of wallFaces) {
    const wallConfig = project.pallet.display.walls[face];
    if (!wallConfig.enabled || wallConfig.wallType !== "shelves") continue;

    pdf.addPage();

    // Wall header
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

    // Wall 3D capture
    const captureKey = face;
    if (captures[captureKey]) {
      const imgW = contentWidth * 0.48;
      const imgH = imgW * 0.75;
      pdf.addImage(captures[captureKey], "PNG", margin, margin + 42, imgW, imgH);
    }

    // Placement grid for this wall
    const wallPlacements = buildWallPlacements(project.placements, project.products, face);
    const gridX = margin + contentWidth * 0.52;
    let gridY = margin + 48;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Shelf Layout", gridX, gridY);
    gridY += 18;

    // Draw grid
    const gridW = contentWidth * 0.44;
    const cols = wallConfig.gridColumns;
    const rows = project.pallet.display.shelfRows;
    const cellW = gridW / cols;
    const cellH = 42;
    const gridH = rows * cellH;

    // Grid background
    pdf.setFillColor(245, 241, 232);
    pdf.rect(gridX, gridY, gridW, gridH, "F");

    // Grid lines
    pdf.setDrawColor(200, 190, 175);
    pdf.setLineWidth(0.5);
    for (let r = 0; r <= rows; r++) {
      pdf.line(gridX, gridY + r * cellH, gridX + gridW, gridY + r * cellH);
    }
    for (let c = 0; c <= cols; c++) {
      pdf.line(gridX + c * cellW, gridY, gridX + c * cellW, gridY + gridH);
    }

    // Row labels (shelf 4 at top, shelf 1 at bottom)
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    for (let r = 0; r < rows; r++) {
      const shelfNum = rows - r;
      pdf.text(`Row ${shelfNum}`, gridX - 28, gridY + r * cellH + cellH / 2 + 2);
    }
    pdf.setTextColor(0, 0, 0);

    // Place products in grid
    pdf.setFontSize(7);
    for (const placement of wallPlacements) {
      const product = placement.product!;
      const visualRow = rows - 1 - placement.shelfRow;
      const x = gridX + placement.gridCol * cellW + 2;
      const cellY = gridY + visualRow * cellH + 2;
      const w = placement.colSpan * cellW - 4;
      const h = cellH - 4;

      // Product fill
      pdf.setFillColor(
        parseInt(product.color?.slice(1, 3) ?? "cc", 16),
        parseInt(product.color?.slice(3, 5) ?? "cc", 16),
        parseInt(product.color?.slice(5, 7) ?? "cc", 16),
      );
      pdf.roundedRect(x, cellY, w, h, 2, 2, "F");

      // Product label
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      const label = product.sku.length > 12 ? product.sku.substring(0, 12) : product.sku;
      pdf.text(label, x + 3, cellY + 11);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      const name = product.name.length > 16 ? product.name.substring(0, 16) + "…" : product.name;
      pdf.text(name, x + 3, cellY + 20);
      pdf.text(`x${placement.quantity}`, x + 3, cellY + 28);
      pdf.setTextColor(0, 0, 0);
    }

    // Placement table below grid
    let tableY = gridY + gridH + 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Wall Placement Details", gridX, tableY);
    tableY += 16;

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("SKU", gridX, tableY);
    pdf.text("Product", gridX + 70, tableY);
    pdf.text("Row", gridX + 170, tableY);
    pdf.text("Col", gridX + 195, tableY);
    pdf.text("Span", gridX + 220, tableY);
    pdf.text("Qty", gridX + 248, tableY);
    tableY += 4;
    pdf.setDrawColor(180, 180, 180);
    pdf.line(gridX, tableY, gridX + gridW, tableY);
    tableY += 10;

    pdf.setFont("helvetica", "normal");
    for (const placement of wallPlacements) {
      if (tableY > pageHeight - 40) break;
      const product = placement.product!;
      pdf.text(product.sku, gridX, tableY);
      pdf.text(product.name.substring(0, 18), gridX + 70, tableY);
      pdf.text(`${placement.shelfRow + 1}`, gridX + 170, tableY);
      pdf.text(`${placement.gridCol + 1}`, gridX + 195, tableY);
      pdf.text(`${placement.colSpan}`, gridX + 220, tableY);
      pdf.text(`${placement.quantity}`, gridX + 248, tableY);
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

  let bomY = margin + 52;

  // BOM table header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("SKU", margin, bomY);
  pdf.text("Product Name", margin + 90, bomY);
  pdf.text("Category", margin + 260, bomY);
  pdf.text("Dimensions", margin + 340, bomY);
  pdf.text("Units", margin + 420, bomY);
  pdf.text("Price", margin + 460, bomY);
  pdf.text("Total", margin + 510, bomY);
  bomY += 4;
  pdf.setDrawColor(80, 80, 80);
  pdf.setLineWidth(1);
  pdf.line(margin, bomY, margin + contentWidth, bomY);
  pdf.setLineWidth(0.5);
  bomY += 14;

  const productMap = new Map(project.products.map((p) => [p.id, p]));
  let grandTotal = 0;

  pdf.setFont("helvetica", "normal");
  for (const item of summary) {
    if (bomY > pageHeight - 50) {
      pdf.addPage();
      bomY = margin + 20;
    }
    const product = [...productMap.values()].find((p) => p.sku === item.sku);
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
    pdf.text(item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : "—", margin + 460, bomY);
    pdf.text(lineTotal > 0 ? `$${lineTotal.toFixed(2)}` : "—", margin + 510, bomY);
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
