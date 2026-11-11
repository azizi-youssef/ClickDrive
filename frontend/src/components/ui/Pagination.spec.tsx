// @vitest-environment jsdom
import '@/tests/setup/dom';
import { render, screen, fireEvent } from '@/tests/setup/render';
import { describe, it, expect, vi } from 'vitest';
import { Pagination, buildPageRange } from './Pagination';

// ─────────────────────────────────────────────────────────────────────────────
// buildPageRange unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPageRange', () => {
  it('returns [] when totalPages = 0', () => {
    expect(buildPageRange(1, 0)).toEqual([]);
  });

  it('returns [1] when totalPages = 1', () => {
    expect(buildPageRange(1, 1)).toEqual([1]);
  });

  it('returns no ellipsis when totalPages is small', () => {
    // With 5 pages no gaps should appear
    const result = buildPageRange(3, 5);
    expect(result).not.toContain('…');
    expect(result).toContain(1);
    expect(result).toContain(5);
  });

  it('inserts ellipsis before the last page when current page is near the start', () => {
    const result = buildPageRange(1, 10);
    // Should look like: [1, 2, 3, '…', 10]
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(10);
    expect(result).toContain('…');
    // Should NOT show pages 8, 9 when current=1
    expect(result).not.toContain(8);
    expect(result).not.toContain(9);
  });

  it('inserts ellipsis after page 1 when current page is near the end', () => {
    const result = buildPageRange(10, 10);
    // Should look like: [1, '…', 8, 9, 10]
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(10);
    expect(result).toContain('…');
    expect(result).not.toContain(2);
    expect(result).not.toContain(3);
  });

  it('inserts two ellipses when current page is in the middle of a large range', () => {
    const result = buildPageRange(5, 10);
    // Should look like: [1, '…', 3, 4, 5, 6, 7, '…', 10]
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(10);
    const ellipses = result.filter((t) => t === '…');
    expect(ellipses.length).toBe(2);
    expect(result).toContain(3);
    expect(result).toContain(5);
    expect(result).toContain(7);
  });

  it('always includes the first and last page number', () => {
    for (const cp of [1, 3, 7, 10]) {
      const result = buildPageRange(cp, 10);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(10);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination component tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Pagination component', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders navigation when totalPages > 1', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('marks the active page with aria-current="page"', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);
    const activePage = screen.getByRole('button', { name: 'Page 3' });
    expect(activePage).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT set aria-current on non-active pages', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);
    const page1 = screen.getByRole('button', { name: 'Page 1' });
    expect(page1).not.toHaveAttribute('aria-current');
  });

  it('calls onPageChange with the correct page number when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange(currentPage + 1) when Next is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={onPageChange}
        nextPageLabel="Next page"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange(currentPage - 1) when Previous is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={onPageChange}
        previousPageLabel="Previous page"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Previous and First buttons on the first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={vi.fn()}
        firstPageLabel="First page"
        previousPageLabel="Previous page"
      />
    );
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('disables Next and Last buttons on the last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={vi.fn()}
        nextPageLabel="Next page"
        lastPageLabel="Last page"
      />
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();
  });

  it('calls onPageChange(1) when First button is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={5}
        totalPages={10}
        onPageChange={onPageChange}
        firstPageLabel="First page"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'First page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange(totalPages) when Last button is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={onPageChange}
        lastPageLabel="Last page"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Last page' }));
    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('renders with custom ariaLabel on the nav element', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        ariaLabel="Naviguer dans les pages"
      />
    );
    expect(screen.getByRole('navigation', { name: 'Naviguer dans les pages' })).toBeInTheDocument();
  });

  it('shows ellipsis for large page counts', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={10} onPageChange={vi.fn()} />
    );
    const ellipsisSpans = Array.from(container.querySelectorAll('span[aria-hidden="true"]')).filter(
      (el) => el.textContent === '…'
    );
    expect(ellipsisSpans.length).toBeGreaterThanOrEqual(1);
  });

  it('applies custom className to the nav element', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        className="mt-10"
      />
    );
    expect(screen.getByRole('navigation')).toHaveClass('mt-10');
  });
});
