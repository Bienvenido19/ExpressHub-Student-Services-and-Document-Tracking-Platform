import { NextResponse } from "next/server";
import { ping } from "@/lib/db";

export async function GET() {
  try {
    const result = await ping();

    return NextResponse.json({
      ok: true,
      message: "Database connection successful",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 }
    );
  }
}
