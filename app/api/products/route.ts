import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/db";
import { customerProducts, products } from "@/db/schema";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-utils";
import { dbProductToProduct, productToDbValues } from "@/lib/mappers";
import { getAccessibleCustomerIds, requireCustomerAccess, requireRole } from "@/lib/rbac";
import type { Product } from "@/types/product";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");

    if (customerId) {
      await requireCustomerAccess(request, customerId);

      const rows = await db
        .select({
          product: products,
          customerUnitCost: customerProducts.unitCost,
          customerUnitPrice: customerProducts.unitPrice,
        })
        .from(customerProducts)
        .innerJoin(products, eq(customerProducts.productId, products.id))
        .where(eq(customerProducts.customerId, customerId))
        .orderBy(desc(products.updatedAt));

      return jsonOk(
        rows.map(({ product, customerUnitCost, customerUnitPrice }) =>
          dbProductToProduct(product, {
            unitCost: customerUnitCost,
            unitPrice: customerUnitPrice,
          }),
        ),
      );
    }

    const accessibleCustomerIds = await getAccessibleCustomerIds(request);
    if (accessibleCustomerIds === null) {
      const rows = await db.select().from(products).orderBy(desc(products.updatedAt));
      return jsonOk(rows.map((row) => dbProductToProduct(row)));
    }

    if (accessibleCustomerIds.length === 0) {
      return jsonOk([]);
    }

    const rows = await db
      .select({
        product: products,
      })
      .from(customerProducts)
      .innerJoin(products, eq(customerProducts.productId, products.id))
      .where(inArray(customerProducts.customerId, accessibleCustomerIds))
      .orderBy(desc(products.updatedAt));

    const seen = new Set<string>();
    const result: Product[] = [];
    for (const { product } of rows) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      result.push(dbProductToProduct(product));
    }

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "editor"]);

    const body = (await request.json()) as Product & { customerId?: string };
    const product = {
      ...body,
      id: body.id || nanoid(),
    };

    if (body.customerId) {
      await requireCustomerAccess(request, body.customerId);
    }

    await db
      .insert(products)
      .values(productToDbValues(product))
      .onConflictDoUpdate({
        target: products.id,
        set: {
          ...productToDbValues(product),
          updatedAt: new Date(),
        },
      });

    if (body.customerId) {
      await db
        .insert(customerProducts)
        .values({
          customerId: body.customerId,
          productId: product.id,
        })
        .onConflictDoNothing();
    }

    return jsonOk(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, ["admin"]);

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      throw new ApiError("Missing id", 400);
    }

    await db.delete(customerProducts).where(eq(customerProducts.productId, id));
    await db.delete(products).where(eq(products.id, id));

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
