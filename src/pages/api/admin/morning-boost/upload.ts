import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import formidable from "formidable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/upload";

export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const form = formidable({ maxFileSize: MAX_SIZE, keepExtensions: true });

  let files: formidable.Files;
  try {
    [, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: "Upload failed — file may exceed the 5 MB limit." });
  }

  const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!uploaded) {
    return res.status(400).json({ error: "No file received." });
  }

  if (!ALLOWED_TYPES.includes(uploaded.mimetype ?? "")) {
    return res.status(400).json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed." });
  }

  const buffer = await fs.promises.readFile(uploaded.filepath);
  const url = await uploadToR2(
    buffer,
    uploaded.originalFilename ?? "image",
    uploaded.mimetype ?? "image/jpeg",
    "morning-boost"
  );

  return res.status(200).json({ url });
}
