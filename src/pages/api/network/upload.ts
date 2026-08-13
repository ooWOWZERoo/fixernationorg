import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { upload } from "@/lib/upload";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Sign in to upload files." });

  const multerSingle = upload.single("file");

  await new Promise<void>((resolve, reject) => {
    multerSingle(req as any, res as any, (err) => {
      if (err) reject(err);
      else resolve();
    });
  }).catch((err) => {
    res.status(400).json({ error: err.message ?? "Upload failed." });
  });

  if (res.writableEnded) return;

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "No file received." });

  const url = `/uploads/social/${file.filename}`;
  return res.status(200).json({ url, name: file.originalname, type: "image" });
}
