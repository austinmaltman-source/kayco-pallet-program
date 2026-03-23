import { put, del } from "@vercel/blob";

import { ApiError, handleApiError, jsonOk } from "@/lib/api-utils";
import { getUserContext } from "@/lib/rbac";

export async function POST(request: Request) {
  try {
    await getUserContext(request);

    const form = await request.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      throw new ApiError("No file provided", 400);
    }

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
      throw new ApiError(`File type ${ext} not supported`, 400);
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new ApiError("File too large (max 50MB)", 400);
    }

    const blob = await put(`products/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return jsonOk({ url: blob.url });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await getUserContext(request);

    const { url } = await request.json();

    if (!url) {
      throw new ApiError("No URL provided", 400);
    }

    await del(url);
    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
