import { useState, useRef } from "react";

const MAX_SIZE_WARNING = 500 * 1024 * 1024; // 500 MB — fail fast rather than a long doomed upload

interface VideoFieldProps {
  value: string;
  onChange: (url: string) => void;
}

export function VideoField({ value, onChange }: VideoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_WARNING) {
      setUploadError("That file is over 500 MB — trim it down or compress it before uploading.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      const sigRes = await fetch("/api/admin/morning-boost/video-signature", { method: "POST" });
      if (!sigRes.ok) throw new Error("Could not get upload authorization.");
      const { timestamp, signature, apiKey, cloudName, folder } = await sigRes.json();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", apiKey);
      fd.append("timestamp", timestamp);
      fd.append("signature", signature);
      fd.append("folder", folder);

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } else {
            reject(new Error("Video upload failed."));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during video upload."));
        xhr.send(fd);
      });

      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        Video <span className="font-normal text-slate-400">(optional)</span>
      </label>

      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? `Uploading… ${progress}%` : "Choose file"}
        </button>
        <span className="text-xs text-slate-400">MP4, WebM, or MOV · keep it under ~200 MB for reasonable load times</span>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste a video URL…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      />

      {value && (
        <div className="mt-2 flex items-start gap-3">
          <video src={value} className="h-20 w-32 rounded-lg border border-slate-200 object-cover" muted />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
