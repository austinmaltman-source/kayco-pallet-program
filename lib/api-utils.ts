import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function withNoStoreHeaders(init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return {
    ...init,
    headers,
  };
}

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, withNoStoreHeaders(init));
}

export function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function toNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function toStringOrNull(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function requireString(value: unknown, fieldName: string) {
  const parsed = toStringOrNull(value);
  if (!parsed) {
    throw new ApiError(`${fieldName} is required`, 400);
  }
  return parsed;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      withNoStoreHeaders({ status: error.status }),
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    { error: "Internal server error" },
    withNoStoreHeaders({ status: 500 }),
  );
}
