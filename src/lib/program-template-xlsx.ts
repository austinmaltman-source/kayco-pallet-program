import ExcelJS from 'exceljs'
import type { DisplayProject, Product, Retailer, Season } from '../types'

interface BuildArgs {
  retailer: Retailer
  seasonLabel: string
  seasonRecord: Season | null
  halfPallet: DisplayProject | null
  fullPallet: DisplayProject | null
  products: Product[]
  pickedProductIds: string[]
}

const COLORS = {
  greenHeader: 'FF92D050',
  grayHeader: 'FFD9D9D9',
  pinkBody: 'FFF2CEEF',
  border: 'FF000000',
} as const

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as const, color: { argb: COLORS.border } }
  return { top: side, left: side, right: side, bottom: side }
}

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

export async function buildProgramTemplateWorkbook({
  retailer,
  seasonLabel,
  seasonRecord,
  halfPallet,
  fullPallet,
  products,
  pickedProductIds,
}: BuildArgs): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kayco Pallet Programs'
  wb.created = new Date()
  const ws = wb.addWorksheet(seasonLabel.slice(0, 31))

  const hasHalf = !!halfPallet
  const hasFull = !!fullPallet
  const halfQty = halfPallet?.quantity ?? 0
  const fullQty = fullPallet?.quantity ?? 0
  const dueDate = seasonRecord?.holidayDate
    ? new Date(seasonRecord.holidayDate)
    : null

  // Column layout: A Kayco | B Description | C UPC | D Pack | E spacer
  //                F Half  | G Full         | H Total Cases
  let nextCol = 5 // 0-indexed: F=5
  const halfCol = hasHalf ? nextCol++ + 1 : null // 1-indexed column number
  const fullCol = hasFull ? nextCol++ + 1 : null
  const totalCasesCol = nextCol + 1

  ws.columns = [
    { width: 12 }, // A Kayco
    { width: 52 }, // B Description
    { width: 14 }, // C UPC
    { width: 8 }, // D Pack
    { width: 3 }, // E spacer
    { width: hasHalf ? 18 : 3 }, // F
    { width: hasFull ? 18 : 3 }, // G
    { width: 16 }, // H Total Cases
    { width: 4 }, // I gap before tips block
    { width: 46 }, // J Tips block
  ]

  // Metadata block: tight layout A=Total Pallets, B=Half qty, C=Full qty, D=Due
  // Row 1 holds the labels above each value.
  const row1 = ws.getRow(1)
  if (hasHalf) row1.getCell(2).value = 'Half'
  if (hasFull) row1.getCell(3).value = 'Full'
  row1.getCell(4).value = 'Due'
  for (const col of [2, 3, 4]) {
    const c = row1.getCell(col)
    if (c.value !== null && c.value !== undefined && c.value !== '') {
      c.font = { bold: true }
      c.border = thinBorder()
      c.alignment = { horizontal: 'center' }
    }
  }

  const row2 = ws.getRow(2)
  row2.getCell(1).value = 'Total Pallets'
  row2.getCell(1).font = { bold: true }
  if (hasHalf) {
    row2.getCell(2).value = halfQty
    row2.getCell(2).border = thinBorder()
    row2.getCell(2).alignment = { horizontal: 'center' }
  }
  if (hasFull) {
    row2.getCell(3).value = fullQty
    row2.getCell(3).border = thinBorder()
    row2.getCell(3).alignment = { horizontal: 'center' }
  }
  if (dueDate) {
    const dueCell = row2.getCell(4)
    dueCell.value = dueDate
    dueCell.numFmt = 'm/d/yy'
    dueCell.border = thinBorder()
    dueCell.alignment = { horizontal: 'center' }
  }

  // ─── Tips block off to the right (column J, rows 1-7) ───
  // Sticky-note style help so the user knows how to fill in / add rows.
  const TIPS_COL = 10 // J
  const tips: { row: number; text: string; header?: boolean }[] = [
    { row: 1, text: 'HOW TO USE THIS TEMPLATE', header: true },
    { row: 2, text: '• Fill in cases in the green columns' },
    { row: 3, text: '• Add items: right-click a row → Insert' },
    { row: 4, text: '• Save & re-upload to Kayco Pallet Programs when done' },
  ]
  for (const tip of tips) {
    const cell = ws.getRow(tip.row).getCell(TIPS_COL)
    cell.value = tip.text
    cell.alignment = { vertical: 'middle', wrapText: false }
    cell.fill = fill('FFFFF9C4') // soft yellow sticky-note
    cell.border = thinBorder()
    if (tip.header) {
      cell.font = { bold: true, size: 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    } else {
      cell.font = { size: 10, color: { argb: 'FF555555' } }
    }
  }

  // Row 3 left blank.

  // ─── Row 4: column headers ───
  const headerRowNumber = 4
  const headerRow = ws.getRow(headerRowNumber)
  const placeHeader = (
    colNumber: number,
    label: string,
    bg: string,
  ) => {
    const cell = headerRow.getCell(colNumber)
    cell.value = label
    cell.fill = fill(bg)
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder()
  }
  placeHeader(1, 'Kayco Item#', COLORS.grayHeader)
  placeHeader(2, 'Description', COLORS.grayHeader)
  placeHeader(3, 'UPC', COLORS.grayHeader)
  placeHeader(4, 'Pack', COLORS.grayHeader)
  if (halfCol) placeHeader(halfCol, 'Half Pallet Cases', COLORS.greenHeader)
  if (fullCol) placeHeader(fullCol, 'Full Pallet Cases', COLORS.greenHeader)
  placeHeader(totalCasesCol, 'Total Cases', COLORS.greenHeader)
  headerRow.height = 24

  // Sort picked products before writing.
  const productMap = new Map(products.map((p) => [p.id, p]))
  const ordered = pickedProductIds
    .map((id) => productMap.get(id))
    .filter((p): p is Product => Boolean(p))
    .sort((a, b) => {
      const aBrand = a.brandCode || a.brand || ''
      const bBrand = b.brandCode || b.brand || ''
      return aBrand.localeCompare(bBrand) || a.name.localeCompare(b.name)
    })

  // Total Cases formula refs pallet qtys at B2 (half) and C2 (full).
  const totalCasesFormula = (excelRow: number) => {
    const parts: string[] = []
    if (halfCol) parts.push(`${columnLetter(halfCol)}${excelRow}*$B$2`)
    if (fullCol) parts.push(`${columnLetter(fullCol)}${excelRow}*$C$2`)
    return parts.join('+')
  }

  // ─── Data rows ───
  const dataStart = headerRowNumber + 1 // Row 5
  let currentRow = dataStart

  const writeDataRow = (
    excelRow: number,
    {
      kayco,
      description,
      upc,
      pack,
      half,
      full,
    }: {
      kayco: string | number
      description: string
      upc: string
      pack: number | ''
      half: number | ''
      full: number | ''
    },
  ) => {
    const row = ws.getRow(excelRow)
    row.getCell(1).value = kayco
    row.getCell(2).value = description
    row.getCell(3).value = upc
    row.getCell(4).value = pack === '' ? null : pack
    if (halfCol) row.getCell(halfCol).value = half === '' ? null : half
    if (fullCol) row.getCell(fullCol).value = full === '' ? null : full
    const tcFormula = totalCasesFormula(excelRow)
    if (tcFormula)
      row.getCell(totalCasesCol).value = { formula: tcFormula, result: undefined }
    // Borders and number formats
    for (const col of [1, 2, 3, 4, halfCol, fullCol, totalCasesCol]) {
      if (!col) continue
      const cell = row.getCell(col)
      cell.border = thinBorder()
      if (col === 4 || col === halfCol || col === fullCol || col === totalCasesCol) {
        cell.alignment = { horizontal: 'right' }
        cell.numFmt = '#,##0.##'
      }
    }
    // Pink fill on Total Cases column body
    row.getCell(totalCasesCol).fill = fill(COLORS.pinkBody)
  }

  // Example row at the top
  writeDataRow(currentRow, {
    kayco: '',
    description: '(EXAMPLE: replace or delete this row)',
    upc: '',
    pack: 12,
    half: hasHalf ? 1 : '',
    full: hasFull ? 1 : '',
  })
  // Italicize and gray the example row to make its placeholder nature obvious
  const exampleRow = ws.getRow(currentRow)
  for (let c = 1; c <= totalCasesCol; c++) {
    const cell = exampleRow.getCell(c)
    if (c !== totalCasesCol) {
      cell.font = { italic: true, color: { argb: 'FF888888' } }
    } else {
      cell.font = { italic: true }
    }
  }
  currentRow++

  for (const product of ordered) {
    writeDataRow(currentRow, {
      kayco: product.kaycoItemNumber || '',
      description: product.name,
      upc: product.upc || '',
      pack: product.unitsPerCase ?? '',
      half: '',
      full: '',
    })
    currentRow++
  }

  // ─── Totals row ───
  // Leave a buffer of empty rows between data and totals so the user can
  // right-click → Insert row and Excel's SUM range auto-extends to include
  // the new row (Excel only expands when insertion is strictly inside the
  // range, so totals must sit a few rows below the last data row).
  const INSERT_BUFFER_ROWS = 5
  const lastDataRow = currentRow - 1
  if (lastDataRow >= dataStart) {
    const totalsRowNumber = lastDataRow + INSERT_BUFFER_ROWS + 1
    const sumLastRow = totalsRowNumber - 1

    // Style the buffer rows so they look like ready-to-fill placeholders:
    // thin borders on every column and pink fill on the Total Cases column.
    for (let r = lastDataRow + 1; r <= sumLastRow; r++) {
      const bufferRow = ws.getRow(r)
      for (const col of [1, 2, 3, 4, halfCol, fullCol, totalCasesCol]) {
        if (!col) continue
        const cell = bufferRow.getCell(col)
        cell.border = thinBorder()
        if (col === 4 || col === halfCol || col === fullCol || col === totalCasesCol) {
          cell.alignment = { horizontal: 'right' }
          cell.numFmt = '#,##0.##'
        }
      }
      bufferRow.getCell(totalCasesCol).fill = fill(COLORS.pinkBody)
    }

    const totalsRow = ws.getRow(totalsRowNumber)
    // Merge A:D for a clean "Totals" label band that aligns with the data
    // section above it.
    ws.mergeCells(totalsRowNumber, 1, totalsRowNumber, 4)
    const labelCell = totalsRow.getCell(1)
    labelCell.value = 'Totals'
    labelCell.font = { bold: true }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    labelCell.border = thinBorder()

    const sumOf = (col: number) =>
      `SUM(${columnLetter(col)}${dataStart}:${columnLetter(col)}${sumLastRow})`
    if (halfCol)
      totalsRow.getCell(halfCol).value = { formula: sumOf(halfCol), result: undefined }
    if (fullCol)
      totalsRow.getCell(fullCol).value = { formula: sumOf(fullCol), result: undefined }
    totalsRow.getCell(totalCasesCol).value = { formula: sumOf(totalCasesCol), result: undefined }
    // Borders + bold + number format on every numeric column.
    for (const col of [halfCol, fullCol, totalCasesCol]) {
      if (!col) continue
      const cell = totalsRow.getCell(col)
      cell.font = { bold: true }
      cell.border = thinBorder()
      cell.numFmt = '#,##0.##'
      cell.alignment = { horizontal: 'right' }
    }
    totalsRow.getCell(totalCasesCol).fill = fill(COLORS.pinkBody)
  }

  // Auto filter on header row
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: totalCasesCol },
  }

  // Freeze panes below header
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNumber }]

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadXlsx(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function columnLetter(col: number): string {
  let n = col
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
