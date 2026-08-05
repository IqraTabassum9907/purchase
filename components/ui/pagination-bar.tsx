"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface PaginationBarProps {
  /** 1-indexed current page */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Shared table-footer pagination control: page-size selector, "start-end of total"
 * count, and a "Pg n/m" indicator with prev/next buttons. Pair with usePagination().
 */
export function PaginationBar({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
  className,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-white shrink-0 flex-wrap ${className || ""}`}
    >
      <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
        <SelectTrigger className="h-8 w-[68px] text-xs rounded-lg bg-slate-50 border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white border text-xs rounded-xl shadow-md min-w-[68px]">
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
        {start}-{end} of {totalCount}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
          Pg {page}/{totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
