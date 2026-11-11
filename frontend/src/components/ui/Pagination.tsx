'use client';

import React, { useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Accessible label for the <nav> landmark. */
  ariaLabel?: string;
  /** Translated label for the "first page" button. */
  firstPageLabel?: string;
  /** Translated label for the "previous page" button. */
  previousPageLabel?: string;
  /** Translated label for the "next page" button. */
  nextPageLabel?: string;
  /** Translated label for the "last page" button. */
  lastPageLabel?: string;
  /** Additional class names for the root element. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build the visible page-number sequence
// ─────────────────────────────────────────────────────────────────────────────

type PageToken = number | '…';

/**
 * Returns an ordered list of page tokens to render.
 *
 * Rules:
 * - Always show page 1 and the last page.
 * - Show currentPage ± 2 neighbours.
 * - Insert `'…'` for gaps larger than one page.
 *
 * Example for 10 pages, current = 5: [1, '…', 3, 4, 5, 6, 7, '…', 10]
 */
export function buildPageRange(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const WINDOW = 2; // pages shown on each side of currentPage
  const start = Math.max(2, currentPage - WINDOW);
  const end = Math.min(totalPages - 1, currentPage + WINDOW);

  const tokens: PageToken[] = [1];

  if (start > 2) tokens.push('…');

  for (let p = start; p <= end; p++) tokens.push(p);

  if (end < totalPages - 1) tokens.push('…');

  tokens.push(totalPages);

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface NavButtonProps {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}

function NavButton({ onClick, disabled, ariaLabel, children }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl',
        'border border-slate-200 bg-white text-[#0B1220]',
        'transition-colors duration-150 motion-reduce:transition-none',
        'hover:border-slate-300 hover:bg-[#F5F6F8]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220] focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-35',
        'active:scale-[0.96] motion-reduce:active:scale-100'
      )}
    >
      {children}
    </button>
  );
}

interface PageButtonProps {
  page: number;
  isActive: boolean;
  onClick: () => void;
  pageLabel: string;
}

function PageButton({ page, isActive, onClick, pageLabel }: PageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={pageLabel}
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-1',
        'text-sm font-semibold',
        'transition-colors duration-150 motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1220] focus-visible:ring-offset-1',
        'active:scale-[0.96] motion-reduce:active:scale-100',
        isActive
          ? 'bg-[#E63946] text-white shadow-[0_4px_12px_-4px_rgba(230,57,70,0.6)]'
          : 'border border-slate-200 bg-white text-[#0B1220] hover:border-slate-300 hover:bg-[#F5F6F8]'
      )}
    >
      {page}
    </button>
  );
}

function Ellipsis() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 items-center justify-center select-none text-sm font-semibold text-slate-400"
    >
      …
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Premium pagination component for KlickDrive.
 *
 * - Highlights the active page with the brand red (#E63946).
 * - Shows First / Previous / page-numbers / Next / Last controls.
 * - Uses `'…'` for large page ranges.
 * - Fully accessible: `role="navigation"`, `aria-label`, `aria-current="page"`.
 * - RTL-aware: chevrons rotate 180° under the `rtl:` modifier.
 * - Reduced-motion safe: `motion-reduce:transition-none`.
 * - Renders nothing when `totalPages <= 1`.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = 'Pagination',
  firstPageLabel = 'First page',
  previousPageLabel = 'Previous page',
  nextPageLabel = 'Next page',
  lastPageLabel = 'Last page',
  className,
}: PaginationProps) {
  const tokens = buildPageRange(currentPage, totalPages);
  const goTo = useCallback((page: number) => onPageChange(page), [onPageChange]);

  if (totalPages <= 1) return null;

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className={cn('flex items-center justify-center gap-1.5', className)}
    >
      {/* First page */}
      <NavButton onClick={() => goTo(1)} disabled={currentPage === 1} ariaLabel={firstPageLabel}>
        <ChevronsLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </NavButton>

      {/* Previous page */}
      <NavButton
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        ariaLabel={previousPageLabel}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </NavButton>

      {/* Page number tokens */}
      <div className="flex items-center gap-1" role="list" aria-label="Pages">
        {tokens.map((token, index) =>
          token === '…' ? (
            <Ellipsis key={`ellipsis-${index}`} />
          ) : (
            <div key={token} role="listitem">
              <PageButton
                page={token}
                isActive={token === currentPage}
                onClick={() => goTo(token)}
                pageLabel={`Page ${token}`}
              />
            </div>
          )
        )}
      </div>

      {/* Next page */}
      <NavButton
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        ariaLabel={nextPageLabel}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </NavButton>

      {/* Last page */}
      <NavButton
        onClick={() => goTo(totalPages)}
        disabled={currentPage === totalPages}
        ariaLabel={lastPageLabel}
      >
        <ChevronsRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </NavButton>
    </nav>
  );
}
