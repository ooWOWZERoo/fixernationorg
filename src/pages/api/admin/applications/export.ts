import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildApplicationWhere } from "@/lib/application-filter";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cols: unknown[]): string {
  return cols.map(cell).join(",");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tab = (req.query.tab as string) ?? "ALL";
  const type = (req.query.type as string) ?? "ALL";
  const q = (req.query.q as string) ?? "";

  const where = buildApplicationWhere(tab, type, q);

  const applications = await db.userApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      providerDetail: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
          businessType: true,
          serviceCategory: true,
          serviceAreas: true,
          licenseNumber: true,
          yearsInBusiness: true,
        },
      },
      ambassadorDetail: {
        select: {
          city: true,
          state: true,
          platformsUsed: true,
        },
      },
    },
  });

  const HEADERS = [
    "ID",
    "Type",
    "Status",
    "Name",
    "Email",
    "Phone",
    "Business Name",
    "Service Category",
    "Service Areas",
    "License Number",
    "Years in Business",
    "City",
    "State",
    "Platforms Used",
    "Referral Code",
    "Campaign Source",
    "Account Created",
    "Created At",
    "Submitted At",
    "Reviewed At",
    "Reviewed By",
  ];

  const lines = [
    row(HEADERS),
    ...applications.map((a) =>
      row([
        a.id,
        a.type,
        a.status,
        a.name ?? "",
        a.email,
        a.phone ?? "",
        a.businessName ?? a.providerDetail?.businessName ?? "",
        a.providerDetail?.serviceCategory ?? "",
        (a.providerDetail?.serviceAreas ?? []).join("; "),
        a.providerDetail?.licenseNumber ?? "",
        a.providerDetail?.yearsInBusiness ?? "",
        a.ambassadorDetail?.city ?? "",
        a.ambassadorDetail?.state ?? "",
        (a.ambassadorDetail?.platformsUsed ?? []).join("; "),
        a.referralCode ?? "",
        a.campaignSource ?? "",
        a.userId ? "Yes" : "No",
        a.createdAt.toISOString(),
        a.submittedAt?.toISOString() ?? "",
        a.reviewedAt?.toISOString() ?? "",
        a.reviewedBy ?? "",
      ])
    ),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="applications.csv"');
  return res.send(lines.join("\n"));
}
