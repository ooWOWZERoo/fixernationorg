import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import formidable from "formidable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToR2 } from "@/lib/upload";

export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden — SUPER_ADMIN only" });
  }

  const form = formidable({ maxFileSize: MAX_SIZE, keepExtensions: true });

  let files: formidable.Files;
  try {
    [, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: "Upload failed — file may exceed the 2 MB limit." });
  }

  const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!uploaded) {
    return res.status(400).json({ error: "No file received." });
  }

  if (!ALLOWED_TYPES.includes(uploaded.mimetype ?? "")) {
    return res.status(400).json({ error: "Only JPEG, PNG, WebP, and SVG images are allowed." });
  }

  const buffer = await fs.promises.readFile(uploaded.filepath);
  const url = await uploadToR2(
    buffer,
    uploaded.originalFilename ?? "logo",
    uploaded.mimetype ?? "image/png",
    "branding"
  );

  await db.setting.upsert({
    where: { key: "site_logo_url" },
    create: { key: "site_logo_url", value: url },
    update: { value: url },
  });

  return res.status(200).json({ url });
}
