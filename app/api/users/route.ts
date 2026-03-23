export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { customers, userCustomers, users } from "@/db/schema";
import { handleApiError, jsonOk } from "@/lib/api-utils";
import { requireRole } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);

    const [userRows, assignments] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      db
        .select({
          userId: userCustomers.userId,
          customerId: customers.id,
          customerName: customers.name,
        })
        .from(userCustomers)
        .innerJoin(customers, eq(userCustomers.customerId, customers.id)),
    ]);

    const assignmentsByUser = new Map<
      string,
      Array<{ id: string; name: string }>
    >();

    for (const assignment of assignments) {
      const list = assignmentsByUser.get(assignment.userId) ?? [];
      list.push({
        id: assignment.customerId,
        name: assignment.customerName,
      });
      assignmentsByUser.set(assignment.userId, list);
    }

    return jsonOk({
      data: userRows.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        customers: assignmentsByUser.get(user.id) ?? [],
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
