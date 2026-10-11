import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

type RequestPayload = {
  student_name: string;
  student_number: string;
  email: string;
  document_type: string;
  purpose: string;
  notes?: string;
};

function sanitizeText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text.length <= maxLength ? text : null;
}

function makeRequestNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = randomBytes(6).toString("hex").toUpperCase();
  return `REQ-${stamp}-${random}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestPayload;
    const student_name = sanitizeText(body.student_name, 120);
    const student_number = sanitizeText(body.student_number, 40);
    const email = sanitizeText(body.email, 120)?.toLowerCase() ?? null;
    const documentTypeCode = sanitizeText(body.document_type, 10)?.toUpperCase() ?? null;
    const purpose = sanitizeText(body.purpose, 255);
    const notes = sanitizeText(body.notes ?? "", 2000);

    if (!student_name || !student_number || !email || !documentTypeCode || !purpose) {
      return NextResponse.json(
        { ok: false, error: "Required fields are missing or exceed their allowed length." },
        { status: 400 }
      );
    }

    const document = siteConfig.documentTypes.find((item) => item.code === documentTypeCode);
    if (!document) {
      return NextResponse.json({ ok: false, error: "Choose a valid document type." }, { status: 400 });
    }

    const students = await query<{ id: number; full_name: string; email: string }>(
      "SELECT id, full_name, email FROM students WHERE student_no = ? LIMIT 1",
      [student_number]
    );

    let studentId = students[0]?.id;
    if (students[0]) {
      if (
        students[0].full_name.trim().toLowerCase() !== student_name.toLowerCase() ||
        students[0].email.trim().toLowerCase() !== email
      ) {
        return NextResponse.json(
          { ok: false, error: "The student details do not match the record for that student number." },
          { status: 400 }
        );
      }
    } else {
      const insertedStudents = await query<{ insertId: number }>(
        "INSERT INTO students (student_no, full_name, email) VALUES (?, ?, ?)",
        [student_number, student_name, email]
      );
      studentId = insertedStudents[0]?.insertId;
    }

    if (!studentId) {
      throw new Error("Student record was not created or resolved.");
    }

    const requestNo = makeRequestNumber();

    await query(
      `INSERT INTO document_requests (request_no, student_id, document_type, purpose, notes, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, 'new', NOW())`,
      [requestNo, studentId, document.name, purpose, notes || null]
    );

    return NextResponse.json({
      ok: true,
      message: "Request submitted successfully.",
      requestNo,
      status: "new",
    });
  } catch (error) {
    console.error("Failed to submit student request:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "The request service is not connected to the admin database yet. Please verify the DB credentials and schema.",
      },
      { status: 500 }
    );
  }
}
