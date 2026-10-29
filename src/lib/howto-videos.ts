// Registry of how-to videos, keyed by feature. A feature with no entry shows
// nothing, so a page can reference its video before the video exists.
// Videos are produced by scripts/howto/ and copied into public/howto/ (or
// hosted on Cloudinary); captions (.vtt) stay in public/howto/ so they load
// same-origin.
export interface HowToVideo {
  title: string;
  /** Delivery URL for the compressed .mp4 (site-hosted /howto/... or Cloudinary) */
  src: string;
  /** Still image shown before play (Cloudinary so_0 frame or a static image) */
  poster?: string;
  /** Same-origin WebVTT captions, e.g. /howto/blog-editor.vtt */
  captions?: string;
}

export const HOWTO_VIDEOS: Record<string, HowToVideo> = {
  "blog-editor": {
    title: "Writing a blog post",
    src: "/howto/blog-editor.mp4",
    poster: "/howto/blog-editor-poster.jpg",
    captions: "/howto/blog-editor.vtt",
  },
};
