import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { projects } from "@/db/schema";
import type { BuilderProject } from "@/types/project";

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));

  const result: BuilderProject[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    pallet: row.pallet as BuilderProject["pallet"],
    products: row.products as BuilderProject["products"],
    placements: row.placements as BuilderProject["placements"],
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as BuilderProject;

  await db
    .insert(projects)
    .values({
      id: body.id,
      name: body.name,
      description: body.description,
      pallet: body.pallet,
      products: body.products,
      placements: body.placements,
      version: body.version,
      createdAt: new Date(body.createdAt),
      updatedAt: new Date(body.updatedAt),
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        name: body.name,
        description: body.description,
        pallet: body.pallet,
        products: body.products,
        placements: body.placements,
        version: body.version,
        updatedAt: new Date(body.updatedAt),
      },
    });

  return NextResponse.json({ ok: true, id: body.id });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
