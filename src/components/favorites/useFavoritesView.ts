import { useCallback, useState } from "react";
import { useRouter } from "next/router";
import type { FavoritesView } from "./FavoritesToggle";

// Page-level favorites state: the starred ids (newest first) and the
// All/Favorites view, kept in sync with `?view=` via a shallow replace.
export function useFavoritesView(initialIds: string[], initialView: FavoritesView) {
  const router = useRouter();
  const [favoriteIds, setFavoriteIds] = useState(initialIds);
  const [view, setViewState] = useState<FavoritesView>(initialView);

  const setView = useCallback(
    (next: FavoritesView) => {
      setViewState(next);
      const query = { ...router.query };
      if (next === "favorites") query.view = "favorites";
      else delete query.view;
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
    },
    [router]
  );

  const onFavoriteChange = useCallback((itemId: string, favorited: boolean) => {
    setFavoriteIds((prev) => {
      const without = prev.filter((id) => id !== itemId);
      return favorited ? [itemId, ...without] : without;
    });
  }, []);

  return { favoriteIds, view, setView, onFavoriteChange };
}
