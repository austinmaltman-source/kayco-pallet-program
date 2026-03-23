export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { handleApiError, jsonOk } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return jsonOk({ status: null });
    }

    const [found] = await db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    if (found?.status === "pending") {
      return jsonOk({ status: "pending" });
    }

    return jsonOk({ status: null });
  } catch (error) {
    return handleApiError(error);
  }
}
