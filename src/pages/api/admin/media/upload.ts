import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import formidable from "formidable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToCloudinary } from "@/lib/upload";

export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const form = formidable({ maxFileSize: MAX_SIZE, keepExtensions: true });
  let files: formidable.Files;
  let fields: formidable.Fields;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: "Upload failed — file may exceed the 10 MB limit." });
  }

  const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!uploaded) return res.status(400).json({ error: "No file received." });

  const mimeType = uploaded.mimetype ?? "";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed." });
  }

  const buffer = await fs.promises.readFile(uploaded.filepath);
  const result = await uploadToCloudinary(buffer, "campaign-assets");

  const altVal = Array.isArray(fields.alt) ? fields.alt[0] : fields.alt;
  const tagsVal = Array.isArray(fields.tags) ? fields.tags[0] : fields.tags;

  const baseName = uploaded.originalFilename ?? "image";
  const name = baseName.replace(/\.[^.]+$/, "");

  const asset = await db.mediaAsset.create({
    data: {
      name,
      url: result.url,
      publicId: result.publicId,
      mimeType,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      alt: altVal ?? null,
      tags: tagsVal ?? null,
      createdBy: session.user.id,
    },
  });

  return res.status(201).json(asset);
}
