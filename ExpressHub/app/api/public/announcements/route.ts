import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

type PublishedAnnouncementRow = {
  id: number;
  title: string;
  body: string;
  category: string;
  office: string;
  published_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export async function GET() {
  try {
    const rows = await query<PublishedAnnouncementRow>(
      `SELECT
        a.id,
        a.title,
        a.body,
        a.category,
        a.created_at AS published_at,
        'Office of the Registrar' AS office
      FROM announcements a
      WHERE a.is_published = TRUE
      ORDER BY a.created_at DESC
      LIMIT 12`
    );

    const announcements = rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      office: row.office,
      date: formatDate(row.published_at),
    }));

    return NextResponse.json({ announcements });
  } catch (error) {
    console.warn("Using fallback announcements because the admin DB is not reachable:", error);

    return NextResponse.json({
      announcements: siteConfig.announcements.map((item, index) => ({
        id: index + 1,
        ...item,
      })),
    });
  }
}
