import { useLayoutEffect, useEffect, useState } from "react";

const CACHE_KEY = "site_logo_url";

// Reads the last-known logo from localStorage in a layout effect (runs
// before paint) so returning visitors never see the fallback mark flash in —
// only a first-ever visit (empty cache) waits on the network fetch below.
export function useSiteLogoUrl(): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useLayoutEffect(() => {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) setLogoUrl(cached);
  }, []);

  useEffect(() => {
    fetch("/api/public/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.logoUrl) {
          setLogoUrl(d.logoUrl);
          window.localStorage.setItem(CACHE_KEY, d.logoUrl);
        }
      });
  }, []);

  return logoUrl;
}
