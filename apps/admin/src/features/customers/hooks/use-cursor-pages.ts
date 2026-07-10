"use client";

import { useState } from "react";

export interface CursorPages<T> {
  items: T[];
  /** 1-indexed, for display. */
  pageNumber: number;
  hasPrev: boolean;
  hasNext: boolean;
  isLoadingNext: boolean;
  prev: () => void;
  next: () => void;
}

interface InfiniteLike<T> {
  data?: { pages: { items: T[] }[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * Page through a cursor-paginated `useInfiniteQuery` with Prev/Next instead of
 * infinite scroll. React Query already keeps every fetched page, so going back
 * is free; going forward past the last fetched page pulls the next cursor.
 */
export function useCursorPages<T>(query: InfiniteLike<T>): CursorPages<T> {
  const [page, setPage] = useState(0);
  const pages = query.data?.pages ?? [];
  const lastIndex = Math.max(0, pages.length - 1);
  // An invalidation can shrink the page list under us (fewer rows → fewer
  // pages), so never index past the end.
  const current = Math.min(page, lastIndex);

  return {
    items: pages[current]?.items ?? [],
    pageNumber: current + 1,
    hasPrev: current > 0,
    hasNext: current < lastIndex || query.hasNextPage,
    isLoadingNext: query.isFetchingNextPage,
    prev: () => setPage(current - 1),
    next: () => {
      if (current < lastIndex) {
        setPage(current + 1);
        return;
      }
      if (!query.hasNextPage || query.isFetchingNextPage) return;
      void query.fetchNextPage().then(() => setPage(current + 1));
    },
  };
}
