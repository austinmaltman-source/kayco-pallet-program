import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { customerProducts, customers, palletHistory } from "@/db/schema";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-utils";
import { getAccessibleCustomerIds, requireRole } from "@/lib/rbac";
import type { CustomerSummary } from "@/types/customer";

export async function GET(request: Request) {
  try {
    const accessibleCustomerIds = await getAccessibleCustomerIds(request);

    const rows =
      accessibleCustomerIds === null
        ? await db.select().from(customers).orderBy(asc(customers.name))
        : accessibleCustomerIds.length === 0
          ? []
          : await db
              .select()
              .from(customers)
              .where(inArray(customers.id, accessibleCustomerIds))
              .orderBy(asc(customers.name));

    const [buildCounts, latestHistory] = await Promise.all([
      db
        .select({
          customerId: palletHistory.customerId,
          builds: sql<number>`count(*)::int`,
        })
        .from(palletHistory)
        .groupBy(palletHistory.customerId),
      db
        .select()
        .from(palletHistory)
        .orderBy(desc(palletHistory.date)),
    ]);

    const buildMap = new Map(buildCounts.map((row) => [row.customerId, row.builds]));
    const latestByCustomer = new Map<string, (typeof latestHistory)[number]>();

    for (const entry of latestHistory) {
      if (!latestByCustomer.has(entry.customerId)) {
        latestByCustomer.set(entry.customerId, entry);
      }
    }

    const result: CustomerSummary[] = rows.map((customer) => {
      const latest = latestByCustomer.get(customer.id);

      return {
        id: customer.id,
        name: customer.name,
        contact: customer.contact ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        address: customer.address ?? "",
        status: customer.status as CustomerSummary["status"],
        builds: buildMap.get(customer.id) ?? 0,
        history: latest?.name ?? null,
        historyNote: latest ? latest.status.replace("-", " ") : null,
      };
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "editor"]);

    const body = (await request.json()) as CustomerSummary;

    await db
      .insert(customers)
      .values({
        id: body.id,
        name: body.name,
        contact: body.contact,
        email: body.email,
        phone: body.phone,
        address: body.address,
        status: body.status,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: body.name,
          contact: body.contact,
          email: body.email,
          phone: body.phone,
          address: body.address,
          status: body.status,
          updatedAt: new Date(),
        },
      });

    return jsonOk({ ok: true, id: body.id });
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

    await db.delete(customerProducts).where(eq(customerProducts.customerId, id));
    await db.delete(customers).where(eq(customers.id, id));

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
