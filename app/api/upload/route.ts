import { put, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type - accept common 3D formats and images
  const allowedTypes = [
    ".glb",
    ".gltf",
    ".obj",
    ".fbx",
    ".usdz",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
  ];
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedTypes.includes(ext)) {
    return NextResponse.json(
      { error: `File type ${ext} not supported` },
      { status: 400 },
    );
  }

  // Max 50MB for 3D models
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 50MB)" },
      { status: 400 },
    );
  }

  const blob = await put(`products/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}

export async function DELETE(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  await del(url);
  return NextResponse.json({ success: true });
}
