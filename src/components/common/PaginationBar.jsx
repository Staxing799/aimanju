import { useEffect, useMemo, useState } from 'react';
import AppSelect from './AppSelect';
import styles from './PaginationBar.module.less';

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push('ellipsis-left');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push('ellipsis-right');
  }

  items.push(totalPages);
  return items;
}

function PaginationBar({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  summaryText,
  pageSizeAriaLabel = '每页条数',
}) {
  const [gotoPageInput, setGotoPageInput] = useState(String(currentPage));
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const displaySummary = summaryText ?? `共 ${totalItems} 条`;

  useEffect(() => {
    setGotoPageInput(String(currentPage));
  }, [currentPage]);

  function jumpToPage(rawValue) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setGotoPageInput(String(currentPage));
      return;
    }

    const nextPage = Math.min(totalPages, Math.max(1, Math.floor(parsed)));
    onPageChange(nextPage);
  }

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationSummary}>{displaySummary}</div>
      <label className={styles.pageSizeWrap}>
        <AppSelect
          className={styles.pageSizeSelect}
          fullWidth={false}
          value={pageSize}
          onChange={(value) => onPageSizeChange(Number(value) || pageSize)}
          ariaLabel={pageSizeAriaLabel}
          disabled={disabled}
          options={pageSizeOptions.map((size) => ({
            value: size,
            label: `${size} 条/页`,
          }))}
        />
      </label>
      <button
        type="button"
        className={styles.pageArrow}
        onClick={() => canGoPrev && onPageChange(currentPage - 1)}
        disabled={disabled || !canGoPrev}
        aria-label="上一页"
      >
        ‹
      </button>
      <div className={styles.pageNumbers}>
        {pageItems.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`${styles.pageNumber} ${item === currentPage ? styles.pageNumberActive : ''}`}
              onClick={() => onPageChange(item)}
              disabled={disabled}
            >
              {item}
            </button>
          ) : (
            <span key={item} className={styles.pageEllipsis}>
              ...
            </span>
          ),
        )}
      </div>
      <button
        type="button"
        className={styles.pageArrow}
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        disabled={disabled || !canGoNext}
        aria-label="下一页"
      >
        ›
      </button>
      <label className={styles.gotoWrap}>
        <span>前往</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={gotoPageInput}
          onChange={(event) => setGotoPageInput(event.target.value)}
          onBlur={() => jumpToPage(gotoPageInput)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              jumpToPage(gotoPageInput);
            }
          }}
          disabled={disabled}
        />
        <span>页</span>
      </label>
    </div>
  );
}

export default PaginationBar;
