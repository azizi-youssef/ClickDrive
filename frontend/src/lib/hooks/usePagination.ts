'use client';

import { useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export interface UsePaginationOptions {
  /** Number of items per page. */
  pageSize: number;
  /** Total number of items in the filtered list. */
  totalItems: number;
  /** URL search-param name for the page number (default: 'page'). */
  paramName?: string;
}

export interface UsePaginationResult {
  /** 1-based current page, clamped to [1, totalPages]. */
  currentPage: number;
  /** Total number of pages (at least 1). */
  totalPages: number;
  /** 0-based start index for Array.slice(). */
  startIndex: number;
  /** 0-based exclusive end index for Array.slice(). */
  endIndex: number;
  /** Navigate to the given 1-based page number. */
  setPage: (page: number) => void;
  /** Reset to page 1 (call this when filters change). */
  resetPage: () => void;
}

/**
 * Client-side pagination hook that syncs the current page with a URL search
 * parameter so the page survives a browser refresh and can be bookmarked.
 *
 * Usage:
 * ```tsx
 * const { currentPage, totalPages, startIndex, endIndex, setPage, resetPage } =
 *   usePagination({ pageSize: 12, totalItems: filteredVehicles.length });
 * const pageItems = filteredVehicles.slice(startIndex, endIndex);
 * ```
 */
export function usePagination({
  pageSize,
  totalItems,
  paramName = 'page',
}: UsePaginationOptions): UsePaginationResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const rawPage = parseInt(searchParams.get(paramName) ?? '1', 10);
  const currentPage = Number.isFinite(rawPage)
    ? Math.min(Math.max(1, rawPage), totalPages)
    : 1;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  /** Build a new URL preserving all existing params but overriding `paramName`. */
  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 1) {
        params.delete(paramName);
      } else {
        params.set(paramName, String(page));
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [searchParams, pathname, paramName]
  );

  const setPage = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(1, page), totalPages);
      router.push(buildUrl(clamped), { scroll: false });
    },
    [router, buildUrl, totalPages]
  );

  const resetPage = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [router, searchParams, pathname, paramName]);

  return useMemo(
    () => ({ currentPage, totalPages, startIndex, endIndex, setPage, resetPage }),
    [currentPage, totalPages, startIndex, endIndex, setPage, resetPage]
  );
}

