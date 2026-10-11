import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type RequestLookup = {
  id: number;
  request_no: string;
  document_type: string;
  status: string;
  submitted_at: string;
  ready_at: string | null;
  completed_at: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: { referenceCode: string } }
) {
  try {
    const referenceCode = decodeURIComponent(params.referenceCode ?? "").trim();
    if (!referenceCode) {
      return NextResponse.json({ ok: false, error: "Reference code is required." }, { status: 400 });
    }

    const rows = await query<RequestLookup>(
      `SELECT
        r.id,
        r.request_no,
        r.document_type,
        r.status,
        r.submitted_at,
        r.ready_at,
        r.completed_at
      FROM document_requests r
      WHERE r.request_no = ?
      LIMIT 1`,
      [referenceCode]
    );

    const request = rows[0];
    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: request.id,
        referenceCode: request.request_no,
        documentType: request.document_type,
        status: request.status,
        submittedAt: request.submitted_at,
        readyAt: request.ready_at,
        completedAt: request.completed_at,
      },
    });
  } catch (error) {
    console.error("Failed to fetch student request:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to look up this request in the admin database." },
      { status: 500 }
    );
  }
}
