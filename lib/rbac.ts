import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userCustomers } from "@/db/schema";
import { ApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/use-role";

type RequestLike = Request & { headers: Headers };

export type UserContext = {
  userId: string;
  role: UserRole;
  /** null means "all customers" (admin). Otherwise an explicit list. */
  customerIds: string[] | null;
};

function normalizeRole(raw: unknown): UserRole {
  if (typeof raw !== "string") return "viewer";
  const lower = raw.toLowerCase();
  if (lower === "admin" || lower === "editor" || lower === "viewer") {
    return lower;
  }
  return "viewer";
}

function normalizeStatus(raw: unknown): string {
  if (typeof raw !== "string") return "pending";
  const lower = raw.toLowerCase();
  if (lower === "active" || lower === "pending" || lower === "rejected") {
    return lower;
  }
  return "pending";
}

/**
 * Extracts authenticated user context from the request.
 * Throws 401 if not authenticated, 403 if account is not active.
 */
export async function getUserContext(
  request: RequestLike,
): Promise<UserContext> {
  let session;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch {
    throw new ApiError("Authentication required", 401);
  }

  if (!session?.user) {
    throw new ApiError("Authentication required", 401);
  }

  const user = session.user as Record<string, unknown>;
  const status = normalizeStatus(user.status);
  if (status !== "active") {
    throw new ApiError("Account pending approval", 403);
  }

  const role = normalizeRole(user.role);
  const userId = user.id as string;

  // Admins can access all customers
  if (role === "admin") {
    return { userId, role, customerIds: null };
  }

  // Non-admins: look up assigned customers
  const assignments = await db
    .select({ customerId: userCustomers.customerId })
    .from(userCustomers)
    .where(eq(userCustomers.userId, userId));

  return {
    userId,
    role,
    customerIds: assignments.map((a) => a.customerId),
  };
}

/**
 * Returns the list of customer IDs the user can access.
 * null means "all" (admin).
 */
export async function getAccessibleCustomerIds(
  request: RequestLike,
): Promise<string[] | null> {
  const ctx = await getUserContext(request);
  return ctx.customerIds;
}

/**
 * Throws 403 if the user doesn't have access to the given customer.
 */
export async function requireCustomerAccess(
  request: RequestLike,
  customerId: string,
): Promise<UserContext> {
  const ctx = await getUserContext(request);
  if (ctx.customerIds !== null && !ctx.customerIds.includes(customerId)) {
    throw new ApiError("Access denied to this customer", 403);
  }
  return ctx;
}

/**
 * Throws 403 if the user's role is not in the allowed list.
 */
export async function requireRole(
  request: RequestLike,
  allowedRoles: UserRole[] = ["admin", "editor"],
): Promise<UserContext> {
  const ctx = await getUserContext(request);
  if (!allowedRoles.includes(ctx.role)) {
    throw new ApiError("Insufficient permissions", 403);
  }
  return ctx;
}
