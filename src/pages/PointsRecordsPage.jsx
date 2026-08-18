import { useEffect, useMemo, useState } from 'react';
import { pointsApi } from '../api';
import AppSelect from '../components/common/AppSelect';
import PaginationBar from '../components/common/PaginationBar';
import { parseApiErrorMessage } from '../utils/projectAdapter';
import styles from './PointsRecordsPage.module.less';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

const CHANGE_TYPE_META = {
  consume: { label: '消费', tone: 'consume' },
  refund: { label: '退款', tone: 'refund' },
  recharge: { label: '充值', tone: 'recharge' },
  adjust: { label: '调整', tone: 'adjust' },
};

const CHANGE_TYPE_OPTIONS = [
  { value: 'all', label: '全部流水' },
  { value: 'consume', label: '消费' },
  { value: 'refund', label: '退款' },
  { value: 'recharge', label: '充值' },
  { value: 'adjust', label: '调整' },
];

function readRecordValue(record, camelKey, snakeKey) {
  return record?.[camelKey] ?? record?.[snakeKey];
}

function normalizeRecordPage(response) {
  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
    };
  }

  const items = Array.isArray(response?.items) ? response.items : [];
  const parsedTotal = Number(response?.total);
  return {
    items,
    total: Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : items.length,
  };
}

function formatPoints(value, fallback = '--') {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(parsed);
}

function formatPointsDelta(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '--';
  }

  const formatted = formatPoints(parsed, '--');
  return parsed > 0 ? `+${formatted}` : formatted;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function PointsRecordsPage({
  teamId,
  isMainAccount = false,
  availablePoints = null,
  walletLoading = false,
  refreshVersion = 0,
  onRefreshWallet,
  onNotify,
}) {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [changeType, setChangeType] = useState('consume');
  const [featureCodeDraft, setFeatureCodeDraft] = useState('');
  const [featureCode, setFeatureCode] = useState('');
  const [userIdDraft, setUserIdDraft] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (isMainAccount) {
      return;
    }

    setUserIdDraft('');
    setUserId(null);
    setPage(1);
  }, [isMainAccount]);

  useEffect(() => {
    let ignored = false;

    async function loadRecords() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await pointsApi.getRecords({
          page,
          pageSize,
          userId: isMainAccount ? userId ?? undefined : undefined,
          changeType: changeType === 'all' ? undefined : changeType,
          featureCode: featureCode || undefined,
        });

        if (ignored) {
          return;
        }

        const normalized = normalizeRecordPage(response);
        setRecords(normalized.items);
        setTotal(normalized.total);
      } catch (error) {
        if (ignored) {
          return;
        }

        setRecords([]);
        setTotal(0);
        setErrorMessage(parseApiErrorMessage(error, '积分流水加载失败，请稍后重试'));
      } finally {
        if (!ignored) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      ignored = true;
    };
  }, [changeType, featureCode, isMainAccount, page, pageSize, refreshNonce, refreshVersion, teamId, userId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentTypeLabel =
    changeType === 'all' ? '全部流水' : CHANGE_TYPE_META[changeType]?.label || '全部流水';
  const hasExtraFilters = Boolean(
    changeType !== 'consume' || featureCode || (isMainAccount && userId != null),
  );
  const accountScopeText = isMainAccount
    ? userId == null
      ? '团队全部账号'
      : `子账号 ${userId}`
    : '当前登录账号';
  const activeFilterText = useMemo(() => {
    const filters = [currentTypeLabel];
    if (featureCode) {
      filters.push(`功能 ${featureCode}`);
    }
    if (isMainAccount && userId != null) {
      filters.push(`账号 ${userId}`);
    }
    return filters.join(' · ');
  }, [currentTypeLabel, featureCode, isMainAccount, userId]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function applyFilters(event) {
    event.preventDefault();

    const nextFeatureCode = featureCodeDraft.trim();
    const rawUserId = userIdDraft.trim();
    let nextUserId = null;

    if (isMainAccount && rawUserId) {
      const parsedUserId = Number(rawUserId);
      if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
        if (typeof onNotify === 'function') {
          onNotify('请输入有效的子账号 ID', 'warning');
        }
        return;
      }
      nextUserId = parsedUserId;
    }

    setFeatureCode(nextFeatureCode);
    setUserId(nextUserId);
    setPage(1);
  }

  function resetFilters() {
    setChangeType('consume');
    setFeatureCodeDraft('');
    setFeatureCode('');
    setUserIdDraft('');
    setUserId(null);
    setPage(1);
  }

  function refreshData() {
    if (typeof onRefreshWallet === 'function') {
      onRefreshWallet();
      return;
    }

    setRefreshNonce((current) => current + 1);
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>POINTS LEDGER</span>
            <h3>积分流水</h3>
            <p>查询当前团队的消费、退款、充值与调整记录。</p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={refreshData}
            disabled={loading || walletLoading}
          >
            <span className={loading || walletLoading ? styles.refreshIconSpinning : styles.refreshIcon} aria-hidden>
              ↻
            </span>
            {loading || walletLoading ? '刷新中...' : '刷新余额与流水'}
          </button>
        </div>

        <div className={styles.summaryGrid}>
          <article className={`${styles.metricCard} ${styles.balanceCard}`}>
            <span className={styles.metricLabel}>当前可用积分</span>
            <strong className={styles.metricValue}>
              {walletLoading ? '加载中...' : formatPoints(availablePoints)}
            </strong>
            <small>余额随当前 access token 所属团队更新</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>匹配流水</span>
            <strong className={styles.metricValue}>{loading ? '--' : formatPoints(total, '0')}</strong>
            <small>服务端分页统计结果</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>流水类型</span>
            <strong className={styles.metricTextValue}>{currentTypeLabel}</strong>
            <small>默认仅查看积分消费</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>账号范围</span>
            <strong className={styles.metricTextValue}>{accountScopeText}</strong>
            <small>{isMainAccount ? '主账号可筛选子账号' : '子账号仅能查看自己的流水'}</small>
          </article>
        </div>

        <form className={styles.filters} onSubmit={applyFilters}>
          <label className={styles.filterField}>
            <span>流水类型</span>
            <AppSelect
              ariaLabel="流水类型"
              value={changeType}
              onChange={(value) => {
                setChangeType(value);
                setPage(1);
              }}
              options={CHANGE_TYPE_OPTIONS}
            />
          </label>
          <label className={`${styles.filterField} ${styles.featureField}`}>
            <span>功能编码</span>
            <input
              type="text"
              value={featureCodeDraft}
              onChange={(event) => setFeatureCodeDraft(event.target.value)}
              placeholder="精确筛选 featureCode"
              autoComplete="off"
            />
          </label>
          {isMainAccount && (
            <label className={styles.filterField}>
              <span>子账号 ID</span>
              <input
                type="number"
                min="1"
                step="1"
                value={userIdDraft}
                onChange={(event) => setUserIdDraft(event.target.value)}
                placeholder="全部账号"
              />
            </label>
          )}
          <div className={styles.filterActions}>
            <button type="submit" className={styles.primaryButton} disabled={loading}>
              查询
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={resetFilters}
              disabled={loading || !hasExtraFilters}
            >
              重置
            </button>
          </div>
        </form>

        <div className={styles.listHeader}>
          <div>
            <strong>流水明细</strong>
            <span>{activeFilterText}</span>
          </div>
          <p aria-live="polite">
            {loading ? '正在同步积分流水...' : `当前页显示 ${records.length} 条记录`}
          </p>
        </div>

        <div className={styles.recordsArea}>
          {loading ? (
            <div className={styles.stateCard}>
              <span className={styles.loadingSpinner} aria-hidden />
              <h4>积分流水加载中</h4>
              <p>正在读取当前团队的积分记录，请稍候。</p>
            </div>
          ) : errorMessage ? (
            <div className={`${styles.stateCard} ${styles.errorState}`}>
              <span className={styles.stateIcon} aria-hidden>!</span>
              <h4>积分流水加载失败</h4>
              <p>{errorMessage}</p>
              <button type="button" className={styles.primaryButton} onClick={refreshData}>
                重新加载
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className={styles.stateCard}>
              <span className={styles.stateIcon} aria-hidden>0</span>
              <h4>暂无匹配流水</h4>
              <p>当前筛选条件下没有积分记录，可以调整类型、账号或功能编码后重试。</p>
            </div>
          ) : (
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">时间</th>
                    <th scope="col">类型</th>
                    <th scope="col">消费项目</th>
                    <th scope="col">消费账号</th>
                    <th scope="col" className={styles.numberColumn}>积分变化</th>
                    <th scope="col" className={styles.numberColumn}>剩余积分</th>
                    <th scope="col">任务编号</th>
                    <th scope="col">流水号</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const recordNo = String(readRecordValue(record, 'recordNo', 'record_no') || '-');
                    const relatedRecordNo = String(
                      readRecordValue(record, 'relatedRecordNo', 'related_record_no') || '',
                    );
                    const recordChangeType = String(
                      readRecordValue(record, 'changeType', 'change_type') || '',
                    );
                    const changeMeta = CHANGE_TYPE_META[recordChangeType] || {
                      label: recordChangeType || '未知',
                      tone: 'unknown',
                    };
                    const featureName = String(
                      readRecordValue(record, 'featureName', 'feature_name') || '未命名功能',
                    );
                    const featureCodeValue = String(
                      readRecordValue(record, 'featureCode', 'feature_code') || '',
                    );
                    const pointsDelta = Number(
                      readRecordValue(record, 'pointsDelta', 'points_delta'),
                    );
                    const createdAt = readRecordValue(record, 'createdAt', 'created_at');

                    return (
                      <tr key={recordNo}>
                        <td className={styles.timeCell} title={String(createdAt || '')}>
                          {formatDateTime(createdAt)}
                        </td>
                        <td>
                          <span className={`${styles.typeBadge} ${styles[changeMeta.tone] || ''}`}>
                            {changeMeta.label}
                          </span>
                        </td>
                        <td>
                          <span className={styles.stackCell}>
                            <strong>{featureName}</strong>
                            <small>{featureCodeValue || '-'}</small>
                          </span>
                        </td>
                        <td className={styles.monoCell}>
                          {String(readRecordValue(record, 'userId', 'user_id') ?? '-')}
                        </td>
                        <td
                          className={`${styles.numberColumn} ${
                            Number.isFinite(pointsDelta) && pointsDelta > 0
                              ? styles.positivePoints
                              : styles.negativePoints
                          }`}
                        >
                          {formatPointsDelta(pointsDelta)}
                        </td>
                        <td className={`${styles.numberColumn} ${styles.balancePoints}`}>
                          {formatPoints(readRecordValue(record, 'balanceAfter', 'balance_after'))}
                        </td>
                        <td className={styles.monoCell} title={String(readRecordValue(record, 'taskId', 'task_id') || '')}>
                          {String(readRecordValue(record, 'taskId', 'task_id') || '-')}
                        </td>
                        <td>
                          <span className={`${styles.stackCell} ${styles.recordCell}`}>
                            <strong title={recordNo}>{recordNo}</strong>
                            {relatedRecordNo && (
                              <small title={relatedRecordNo}>关联 {relatedRecordNo}</small>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !errorMessage && (
          <PaginationBar
            totalItems={total}
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize || DEFAULT_PAGE_SIZE);
              setPage(1);
            }}
            disabled={loading}
            pageSizeAriaLabel="积分流水每页条数"
            summaryText={`共 ${total} 条流水`}
          />
        )}
      </section>
    </div>
  );
}

export default PointsRecordsPage;
