import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import fs from "fs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/upload";

export const config = { api: { bodyParser: false } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to upload files." });

  const form = new IncomingForm({ maxFileSize: MAX_BYTES });

  const [, files] = await form.parse(req).catch((err: Error) => {
    throw err;
  });

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "No file received." });

  if (!ALLOWED_TYPES.includes(file.mimetype ?? "")) {
    return res.status(400).json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed." });
  }

  const buffer = fs.readFileSync(file.filepath);
  fs.unlinkSync(file.filepath);

  try {
    const url = await uploadToR2(buffer, file.originalFilename ?? "upload.jpg", file.mimetype ?? "image/jpeg");
    return res.status(200).json({ url, name: file.originalFilename, type: "image" });
  } catch (err) {
    console.error("[upload] R2 error:", err);
    return res.status(500).json({ error: "Upload failed. Please try again." });
  }
}
