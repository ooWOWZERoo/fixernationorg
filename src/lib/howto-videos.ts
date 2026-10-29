// Registry of how-to videos, keyed by feature. A feature with no entry shows
// nothing, so a page can reference its video before the video exists.
// Videos are produced by scripts/howto/ and hosted on Cloudinary; captions
// (.vtt) live in public/howto/ so they load same-origin.
export interface HowToVideo {
  title: string;
  /** Cloudinary delivery URL for the compressed .mp4 */
  src: string;
  /** Still image shown before play (Cloudinary so_0 frame or a static image) */
  poster?: string;
  /** Same-origin WebVTT captions, e.g. /howto/blog-editor.vtt */
  captions?: string;
}

export const HOWTO_VIDEOS: Record<string, HowToVideo> = {
  // "blog-editor": { title: "Writing a blog post", src: "...", poster: "...", captions: "/howto/blog-editor.vtt" },
};
