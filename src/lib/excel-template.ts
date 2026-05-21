import ExcelJS from 'exceljs'
import type { Orientation3D, Product } from '../types'
import { withProductPlanningDefaults } from './product-variants'

const ORIENTATIONS: Orientation3D[] = ['upright', 'on-side', 'on-end', 'inverted']

export const PRODUCT_TEMPLATE_HEADERS = [
  'ID',
  'Name',
  'Kayco Item',
  'UPC',
  'Brand',
  'Category',
  'Case Width',
  'Case Depth',
  'Case Height',
  'Case Weight',
  'Units Per Case',
  'Allowed Orientations',
  'Stackable',
  'Fragile',
  'Crushable',
  'Max Stack Load Lb',
  'Nesting Percent',
  'Shelf Ready Tray',
  'Hero Image URL',
] as const

type ProductTemplateHeader = (typeof PRODUCT_TEMPLATE_HEADERS)[number]
type ProductTemplateRow = Record<ProductTemplateHeader, string | number | boolean>

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('formula' in value) return ''
  }
  return String(value)
}

function cellNumber(value: ExcelJS.CellValue): number | undefined {
  if (typeof value === 'number') return value
  const parsed = Number(cellText(value))
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(value: ExcelJS.CellValue): boolean | undefined {
  if (typeof value === 'boolean') return value
  const text = cellText(value).trim().toLowerCase()
  if (['true', 'yes', 'y', '1'].includes(text)) return true
  if (['false', 'no', 'n', '0'].includes(text)) return false
  return undefined
}

function parseOrientations(value: ExcelJS.CellValue): Orientation3D[] | undefined {
  const orientations = cellText(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is Orientation3D =>
      ORIENTATIONS.includes(entry as Orientation3D),
    )

  return orientations.length > 0 ? Array.from(new Set(orientations)) : undefined
}

export function productToPlanningTemplateRow(product: Product): ProductTemplateRow {
  const normalized = withProductPlanningDefaults(product)

  return {
    ID: normalized.id,
    Name: normalized.name,
    'Kayco Item': normalized.kaycoItemNumber ?? '',
    UPC: normalized.upc ?? '',
    Brand: normalized.brand,
    Category: normalized.category,
    'Case Width': normalized.caseWidth ?? normalized.width,
    'Case Depth': normalized.caseDepth ?? normalized.depth,
    'Case Height': normalized.caseHeight ?? normalized.height,
    'Case Weight': normalized.caseWeight ?? normalized.weight,
    'Units Per Case': normalized.unitsPerCase ?? '',
    'Allowed Orientations': (normalized.allowedOrientations ?? ['upright']).join(', '),
    Stackable: normalized.stackable ?? true,
    Fragile: normalized.fragile ?? false,
    Crushable: normalized.crushable ?? false,
    'Max Stack Load Lb': normalized.maxStackLoadLb ?? normalized.weight * 10,
    'Nesting Percent': normalized.nestingPercent ?? 0,
    'Shelf Ready Tray': normalized.shelfReadyTray ?? false,
    'Hero Image URL': normalized.heroImageUrl ?? '',
  }
}

export function productFromPlanningTemplateRow(
  row: ExcelJS.Row,
  existingProduct?: Product,
): Product | null {
  const byHeader = new Map<ProductTemplateHeader, ExcelJS.CellValue>()
  PRODUCT_TEMPLATE_HEADERS.forEach((header, index) => {
    byHeader.set(header, row.getCell(index + 1).value)
  })

  const id = cellText(byHeader.get('ID') ?? null).trim()
  const name = cellText(byHeader.get('Name') ?? null).trim()
  if (!id || !name) return null

  const caseWidth = cellNumber(byHeader.get('Case Width') ?? null)
  const caseDepth = cellNumber(byHeader.get('Case Depth') ?? null)
  const caseHeight = cellNumber(byHeader.get('Case Height') ?? null)
  const caseWeight = cellNumber(byHeader.get('Case Weight') ?? null)

  const base: Product = existingProduct
    ? { ...existingProduct, id, name }
    : {
        id,
        name,
        sku: id,
        brand: 'other',
        brandColor: '#777777',
        category: 'Uncategorized',
        width: caseWidth ?? 1,
        depth: caseDepth ?? 1,
        height: caseHeight ?? 1,
        weight: caseWeight ?? 1,
        holidayTags: [],
      }

  return withProductPlanningDefaults({
    ...base,
    kaycoItemNumber: cellText(byHeader.get('Kayco Item') ?? null).trim() || base.kaycoItemNumber,
    upc: cellText(byHeader.get('UPC') ?? null).trim() || base.upc,
    category: cellText(byHeader.get('Category') ?? null).trim() || base.category,
    caseWidth: caseWidth ?? base.caseWidth,
    caseDepth: caseDepth ?? base.caseDepth,
    caseHeight: caseHeight ?? base.caseHeight,
    caseWeight: caseWeight ?? base.caseWeight,
    width: caseWidth ?? base.width,
    depth: caseDepth ?? base.depth,
    height: caseHeight ?? base.height,
    weight: caseWeight ?? base.weight,
    unitsPerCase: cellNumber(byHeader.get('Units Per Case') ?? null) ?? base.unitsPerCase,
    allowedOrientations:
      parseOrientations(byHeader.get('Allowed Orientations') ?? null) ??
      base.allowedOrientations,
    stackable: parseBoolean(byHeader.get('Stackable') ?? null) ?? base.stackable,
    fragile: parseBoolean(byHeader.get('Fragile') ?? null) ?? base.fragile,
    crushable: parseBoolean(byHeader.get('Crushable') ?? null) ?? base.crushable,
    maxStackLoadLb:
      cellNumber(byHeader.get('Max Stack Load Lb') ?? null) ?? base.maxStackLoadLb,
    nestingPercent:
      cellNumber(byHeader.get('Nesting Percent') ?? null) ?? base.nestingPercent,
    shelfReadyTray:
      parseBoolean(byHeader.get('Shelf Ready Tray') ?? null) ?? base.shelfReadyTray,
    heroImageUrl:
      cellText(byHeader.get('Hero Image URL') ?? null).trim() || base.heroImageUrl,
  })
}

export async function buildProductPlanningWorkbookBuffer(
  products: Product[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PalletForge'
  wb.created = new Date()

  const ws = wb.addWorksheet('Product Planning')
  ws.addRow([...PRODUCT_TEMPLATE_HEADERS])
  for (const product of products) {
    const row = productToPlanningTemplateRow(product)
    ws.addRow(PRODUCT_TEMPLATE_HEADERS.map((header) => row[header]))
  }

  ws.columns = PRODUCT_TEMPLATE_HEADERS.map((header) => ({
    header,
    width: Math.max(14, header.length + 2),
  }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const allowedOrientationsColumn =
    PRODUCT_TEMPLATE_HEADERS.indexOf('Allowed Orientations') + 1
  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
    ws.getRow(rowNumber).getCell(allowedOrientationsColumn).note =
      'Comma-separated values: upright, on-side, on-end, inverted'
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

export async function parseProductPlanningWorkbook(
  buffer: ArrayBuffer,
  existingProducts: Product[] = [],
): Promise<Product[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const existingById = new Map(existingProducts.map((product) => [product.id, product]))
  const parsed: Product[] = []

  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
    const row = ws.getRow(rowNumber)
    const id = cellText(row.getCell(1).value).trim()
    const product = productFromPlanningTemplateRow(row, existingById.get(id))
    if (product) parsed.push(product)
  }

  return parsed
}
