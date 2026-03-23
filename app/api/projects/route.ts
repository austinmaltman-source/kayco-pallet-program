import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { products, projectProducts, projects } from "@/db/schema";
import { ApiError, handleApiError, jsonOk } from "@/lib/api-utils";
import { dbProductToProduct } from "@/lib/mappers";
import { getUserContext } from "@/lib/rbac";
import type { BuilderProject } from "@/types/project";

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext(request);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.userId))
      .orderBy(desc(projects.updatedAt));

    const projectIds = rows.map((row) => row.id);
    const linkedProducts =
      projectIds.length > 0
        ? await db
            .select({
              projectId: projectProducts.projectId,
              product: products,
            })
            .from(projectProducts)
            .innerJoin(products, eq(projectProducts.productId, products.id))
            .where(inArray(projectProducts.projectId, projectIds))
        : [];

    const productsByProject = new Map<string, BuilderProject["products"]>();
    for (const entry of linkedProducts) {
      const list = productsByProject.get(entry.projectId) ?? [];
      list.push(dbProductToProduct(entry.product));
      productsByProject.set(entry.projectId, list);
    }

    const result: BuilderProject[] = rows.map((row) => {
      const createdAt =
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString();
      const updatedAt =
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : new Date(row.updatedAt).toISOString();

      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        pallet: row.pallet as BuilderProject["pallet"],
        products: productsByProject.get(row.id) ?? [],
        placements: row.placements as BuilderProject["placements"],
        version: row.version,
        createdAt,
        updatedAt,
      };
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext(request);

    const body = (await request.json()) as BuilderProject;

    await db
      .insert(projects)
      .values({
        id: body.id,
        userId: ctx.userId,
        name: body.name,
        description: body.description,
        pallet: body.pallet,
        placements: body.placements,
        version: body.version,
        createdAt: new Date(body.createdAt),
        updatedAt: new Date(body.updatedAt),
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          userId: ctx.userId,
          name: body.name,
          description: body.description,
          pallet: body.pallet,
          placements: body.placements,
          version: body.version,
          updatedAt: new Date(body.updatedAt),
        },
      });

    await db.delete(projectProducts).where(eq(projectProducts.projectId, body.id));

    if (body.products.length > 0) {
      await db
        .insert(projectProducts)
        .values(
          body.products.map((product) => ({
            projectId: body.id,
            productId: product.id,
          })),
        )
        .onConflictDoNothing();
    }

    return jsonOk({ ok: true, id: body.id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getUserContext(request);

    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      throw new ApiError("Missing id", 400);
    }

    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, ctx.userId)));

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
