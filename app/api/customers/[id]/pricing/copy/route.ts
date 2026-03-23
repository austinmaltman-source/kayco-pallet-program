import { eq } from "drizzle-orm";

import { db } from "@/db";
import { customerProducts } from "@/db/schema";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-utils";
import { requireRole, requireCustomerAccess } from "@/lib/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const ctx = await requireRole(request, ["admin", "editor"]);
    const { id } = await context.params;
    const { sourceCustomerId } = (await request.json()) as {
      sourceCustomerId?: string;
    };

    if (!sourceCustomerId) {
      throw new ApiError("sourceCustomerId is required", 400);
    }

    await requireCustomerAccess(request, id);
    if (ctx.customerIds !== null && !ctx.customerIds.includes(sourceCustomerId)) {
      throw new ApiError("Access denied to source customer", 403);
    }

    const sourceRows = await db
      .select()
      .from(customerProducts)
      .where(eq(customerProducts.customerId, sourceCustomerId));

    for (const row of sourceRows) {
      await db
        .insert(customerProducts)
        .values({
          customerId: id,
          productId: row.productId,
          unitCost: row.unitCost,
          unitPrice: row.unitPrice,
        })
        .onConflictDoUpdate({
          target: [customerProducts.customerId, customerProducts.productId],
          set: {
            unitCost: row.unitCost,
            unitPrice: row.unitPrice,
          },
        });
    }

    return jsonOk({ ok: true, copied: sourceRows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
