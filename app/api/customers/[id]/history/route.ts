import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { palletHistory } from "@/db/schema";
import { handleApiError, jsonOk } from "@/lib/api-utils";
import { requireCustomerAccess } from "@/lib/rbac";
import type { PalletHistory } from "@/types/customer";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await requireCustomerAccess(request, id);

    const rows = await db
      .select()
      .from(palletHistory)
      .where(eq(palletHistory.customerId, id))
      .orderBy(desc(palletHistory.date));

    const result: PalletHistory[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      date: row.date.toISOString(),
      skuCount: row.skuCount,
      status: row.status as PalletHistory["status"],
    }));

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
