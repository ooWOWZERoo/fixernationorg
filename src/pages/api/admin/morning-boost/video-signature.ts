import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cloudinary } from "@/lib/upload";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const FOLDER = "morning-boost-video";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: FOLDER },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return res.status(200).json({
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: FOLDER,
  });
}
