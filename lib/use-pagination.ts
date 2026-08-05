"use client";

import { useEffect, useMemo, useState } from "react";

export interface UsePaginationResult<T> {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalCount: number;
  totalPages: number;
  /** The slice of `data` for the current page — render this instead of the full array. */
  pageData: T[];
}

/**
 * Client-side pagination over an already-filtered array. Pass the same filtered
 * array (e.g. the memoized `pending`/`history` list) and render `pageData` in the
 * table body instead of the full array; render <PaginationBar> with the rest.
 *
 * Automatically clamps back to the last valid page if the underlying array
 * shrinks below the current page (e.g. after a search or a record completing).
 */
export function usePagination<T>(data: T[], initialPageSize = 15): UsePaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalCount = data.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return { page, setPage, pageSize, setPageSize, totalCount, totalPages, pageData };
}
