export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, sessions, userCustomers, users } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  jsonOk,
  toStringOrNull,
} from "@/lib/api-utils";
import { sendApprovalConfirmation } from "@/lib/email";
import { requireRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/use-role";

type UserStatus = "active" | "pending" | "rejected";
type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseRole(value: unknown): UserRole {
  const parsed = toStringOrNull(value)?.toLowerCase();
  if (parsed === "admin" || parsed === "editor" || parsed === "viewer") {
    return parsed;
  }
  throw new ApiError('role must be one of: "admin", "editor", or "viewer"');
}

function parseStatus(value: unknown): UserStatus {
  const parsed = toStringOrNull(value)?.toLowerCase();
  if (parsed === "active" || parsed === "pending" || parsed === "rejected") {
    return parsed;
  }
  throw new ApiError('status must be one of: "active", "pending", or "rejected"');
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const body = await request.json();

    const [existing] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      throw new ApiError("User not found", 404);
    }

    if (existing.email === "austinm.altman@gmail.com") {
      throw new ApiError("Cannot modify the owner account", 403);
    }

    const updates: Partial<typeof users.$inferInsert> = {};

    if (body.role !== undefined) updates.role = parseRole(body.role);
    if (body.status !== undefined) updates.status = parseStatus(body.status);
    if (body.role === undefined && body.status === undefined && body.customerIds === undefined) {
      throw new ApiError("At least one field is required: role, status, customerIds");
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(users).set(updates).where(eq(users.id, id));
    }

    if (body.customerIds !== undefined) {
      if (!Array.isArray(body.customerIds)) {
        throw new ApiError("customerIds must be an array", 400);
      }

      await db.delete(userCustomers).where(eq(userCustomers.userId, id));

      if (body.customerIds.length > 0) {
        await db
          .insert(userCustomers)
          .values(
            body.customerIds.map((customerId: string) => ({
              userId: id,
              customerId,
            })),
          )
          .onConflictDoNothing();
      }
    }

    const [updated] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const assignments = await db
      .select({ customerId: userCustomers.customerId })
      .from(userCustomers)
      .where(eq(userCustomers.userId, id));

    let notified = false;
    if (existing.status === "pending" && updated?.status === "active") {
      try {
        await sendApprovalConfirmation({
          name: updated.name || updated.email,
          email: updated.email,
        });
        notified = true;
      } catch (error) {
        console.error("Failed to send approval confirmation email", error);
      }
    }

    return jsonOk({
      data: updated
        ? {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            customerIds: assignments.map((assignment) => assignment.customerId),
          }
        : null,
      notified,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireRole(request, ["admin"]);
    const { id } = await context.params;

    const [target] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      throw new ApiError("User not found", 404);
    }

    if (target.email === "austinm.altman@gmail.com") {
      throw new ApiError("Cannot delete the owner account", 403);
    }

    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(accounts).where(eq(accounts.userId, id));
    await db.delete(userCustomers).where(eq(userCustomers.userId, id));
    await db.delete(users).where(eq(users.id, id));

    return jsonOk({ data: target });
  } catch (error) {
    return handleApiError(error);
  }
}
