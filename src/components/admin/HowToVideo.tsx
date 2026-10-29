import { HOWTO_VIDEOS } from "@/lib/howto-videos";

// Collapsed "Watch how this works" panel. The video is not fetched until the
// admin presses play (preload="none"), which keeps page load and Cloudinary
// bandwidth low. Renders nothing when no video is registered for the feature.
export function HowToVideo({ feature }: { feature: string }) {
  const video = HOWTO_VIDEOS[feature];
  if (!video) return null;

  return (
    <details className="group mb-6 rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-navy">
        <span aria-hidden="true">▶</span>
        Watch how this works
        <span className="font-normal text-slate-400">({video.title})</span>
      </summary>
      <div className="border-t border-slate-100 p-4">
        <video
          controls
          preload="none"
          poster={video.poster}
          className="w-full rounded-lg bg-black"
        >
          <source src={video.src} type="video/mp4" />
          {video.captions && (
            <track kind="captions" src={video.captions} srcLang="en" label="English" default />
          )}
          Your browser can't play this video.
        </video>
      </div>
    </details>
  );
}
