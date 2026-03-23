import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { customerProducts, products } from "@/db/schema";
import { ApiError, handleApiError, jsonOk, toNullableNumber } from "@/lib/api-utils";
import { dbProductToProduct } from "@/lib/mappers";
import { requireCustomerAccess } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireCustomerAccess(request, id);

    const rows = await db
      .select({
        product: products,
        customerUnitCost: customerProducts.unitCost,
        customerUnitPrice: customerProducts.unitPrice,
      })
      .from(customerProducts)
      .innerJoin(products, eq(customerProducts.productId, products.id))
      .where(eq(customerProducts.customerId, id));

    return jsonOk(
      rows.map(({ product, customerUnitCost, customerUnitPrice }) =>
        dbProductToProduct(product, {
          unitCost: customerUnitCost,
          unitPrice: customerUnitPrice,
        }),
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireCustomerAccess(request, id);

    const { productIds, unitCost, unitPrice } = (await request.json()) as {
      productIds?: string[];
      unitCost?: number | null;
      unitPrice?: number | null;
    };

    if (!Array.isArray(productIds)) {
      throw new ApiError("Invalid payload", 400);
    }

    if (productIds.length > 0) {
      await db
        .insert(customerProducts)
        .values(
          productIds.map((productId) => ({
            customerId: id,
            productId,
            unitCost: toNullableNumber(unitCost) != null ? Math.round(Number(unitCost) * 100) : null,
            unitPrice: toNullableNumber(unitPrice) != null ? Math.round(Number(unitPrice) * 100) : null,
          })),
        )
        .onConflictDoUpdate({
          target: [customerProducts.customerId, customerProducts.productId],
          set: {
            unitCost: toNullableNumber(unitCost) != null ? Math.round(Number(unitCost) * 100) : null,
            unitPrice: toNullableNumber(unitPrice) != null ? Math.round(Number(unitPrice) * 100) : null,
          },
        });
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireCustomerAccess(request, id);

    const productId = new URL(request.url).searchParams.get("productId");

    if (!productId) {
      throw new ApiError("Missing productId", 400);
    }

    await db
      .delete(customerProducts)
      .where(
        and(
          eq(customerProducts.customerId, id),
          eq(customerProducts.productId, productId),
        ),
      );

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
