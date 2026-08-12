import { useEffect, useMemo, useRef, useState } from 'react';
import { assetApi } from '../api';
import AppSelect from '../components/common/AppSelect';
import PaginationBar from '../components/common/PaginationBar';
import { parseApiErrorMessage } from '../utils/projectAdapter';
import styles from './AssetLibraryPage.module.less';

const NOTICE_HIDE_DURATION_MS = 2400;
const ASSETS_PER_PAGE = 8;
const PAGE_SIZE_OPTIONS = [8, 16, 24, 40];

function toDateKey(value, fallbackValue) {
  const fallbackDate = fallbackValue ? new Date(fallbackValue) : new Date();
  const date = value ? new Date(value) : fallbackDate;
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const matched = String(value || '').match(/(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (matched) {
    const [, year, month, day] = matched;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const safeDate = Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimestamp(value, fallbackValue) {
  const date = value ? new Date(value) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return date.getTime();
  }

  const fallbackDate = fallbackValue ? new Date(fallbackValue) : new Date();
  return Number.isNaN(fallbackDate.getTime()) ? Date.now() : fallbackDate.getTime();
}

function toTimeText(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
}

function detectPermissionIssue(message) {
  const text = String(message || '').toLowerCase();
  return /(401|403|unauthorized|forbidden|权限|未授权|无权|拒绝)/i.test(text);
}

function readAssetName(path, fallbackName) {
  const raw = String(path || '').trim();
  if (!raw) {
    return fallbackName;
  }

  const normalized = raw.replace(/\\/g, '/');
  const withoutQuery = normalized.split('?')[0];
  const segments = withoutQuery.split('/');
  return segments[segments.length - 1] || fallbackName;
}

function normalizeAssetKind(assetType, mimeType) {
  const safeAssetType = String(assetType || '').toLowerCase();
  const safeMimeType = String(mimeType || '').toLowerCase();

  if (safeAssetType === 'audio' || safeMimeType.startsWith('audio/')) {
    return 'audio';
  }

  if (safeAssetType === 'video' || safeMimeType.startsWith('video/')) {
    return 'video';
  }

  return 'image';
}

function getAssetTypeLabel(kind) {
  if (kind === 'audio') {
    return '音频';
  }
  if (kind === 'video') {
    return '视频';
  }
  return '图片';
}

function getDefaultAssetExtension(kind) {
  if (kind === 'audio') {
    return 'mp3';
  }
  if (kind === 'video') {
    return 'mp4';
  }
  return 'png';
}

function getSourceMeta(sourceType) {
  const safeSourceType = String(sourceType || '').toLowerCase();

  if (safeSourceType === 'character') {
    return { source: '角色素材', subTitle: '角色资产' };
  }
  if (safeSourceType === 'scene') {
    return { source: '场景素材', subTitle: '场景资产' };
  }
  if (safeSourceType === 'storyboard') {
    return { source: '分镜素材', subTitle: '分镜资产' };
  }

  return {
    source: safeSourceType ? `${safeSourceType} 素材` : '团队素材',
    subTitle: '通用资产',
  };
}

function buildProjectEntityLookup(project) {
  const characterById = new Map();
  const sceneById = new Map();
  const storyboardById = new Map();

  (project?.characters || []).forEach((character, index) => {
    const id = String(character?.id || '').trim();
    if (id) {
      characterById.set(id, character?.name || `角色${index + 1}`);
    }
  });

  (project?.scenes || []).forEach((scene, index) => {
    const id = String(scene?.id || '').trim();
    if (id) {
      sceneById.set(id, scene?.name || `场景${index + 1}`);
    }
  });

  (project?.episodes || []).forEach((episode, episodeIndex) => {
    (episode?.storyboards || []).forEach((storyboard, storyboardIndex) => {
      const id = String(storyboard?.id || '').trim();
      if (id) {
        const episodeTitle = episode?.title || `第${episodeIndex + 1}集`;
        const storyboardTitle = storyboard?.title || `分镜${storyboardIndex + 1}`;
        storyboardById.set(id, `${episodeTitle} · ${storyboardTitle}`);
      }
    });
  });

  return { characterById, sceneById, storyboardById };
}

function resolveAssetTitle(assetItem, projectLookup, fallbackIndex) {
  const sourceType = String(assetItem?.source_type || '').toLowerCase();
  const sourceId = String(assetItem?.source_id || '').trim();

  if (sourceType === 'character' && sourceId && projectLookup.characterById.has(sourceId)) {
    return projectLookup.characterById.get(sourceId);
  }
  if (sourceType === 'scene' && sourceId && projectLookup.sceneById.has(sourceId)) {
    return projectLookup.sceneById.get(sourceId);
  }
  if (sourceType === 'storyboard' && sourceId && projectLookup.storyboardById.has(sourceId)) {
    return projectLookup.storyboardById.get(sourceId);
  }

  return sourceId || `素材 ${fallbackIndex + 1}`;
}

function normalizeAssetPageResponse(response) {
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

function buildRemoteAssetCollection(assetItems, project) {
  if (!Array.isArray(assetItems) || assetItems.length === 0) {
    return [];
  }

  const projectLookup = buildProjectEntityLookup(project);

  return assetItems.reduce((assets, assetItem, index) => {
    const previewUrl = String(assetItem?.url || '').trim();
    if (!previewUrl) {
      return assets;
    }

    const kind = normalizeAssetKind(assetItem?.asset_type, assetItem?.mime_type);
    const sourceMeta = getSourceMeta(assetItem?.source_type);
    const createdAt = assetItem?.updated_at || assetItem?.created_at || new Date().toISOString();
    const title = resolveAssetTitle(assetItem, projectLookup, index);
    const defaultExtension = getDefaultAssetExtension(kind);

    assets.push({
      id: String(assetItem?.asset_id || `asset-${index + 1}`),
      kind,
      typeLabel: getAssetTypeLabel(kind),
      dateKey: toDateKey(createdAt, createdAt),
      timestamp: toTimestamp(createdAt, createdAt),
      createdAt,
      previewUrl,
      fileName:
        readAssetName(assetItem?.object_key || assetItem?.url, `${title}.${defaultExtension}`),
      title,
      subTitle: sourceMeta.subTitle,
      prompt: assetItem?.prompt_text || '',
      source: sourceMeta.source,
      status: 'success',
      failedText: '',
    });

    return assets;
  }, []);
}

function groupAssetsByDate(assets, sortOrder = 'desc') {
  const grouped = new Map();
  assets.forEach((asset) => {
    if (!grouped.has(asset.dateKey)) {
      grouped.set(asset.dateKey, []);
    }
    grouped.get(asset.dateKey).push(asset);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => (sortOrder === 'asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
    .map(([dateKey, items]) => ({
      dateKey,
      items:
        sortOrder === 'asc'
          ? [...items].sort((a, b) => a.timestamp - b.timestamp)
          : [...items].sort((a, b) => b.timestamp - a.timestamp),
    }));
}

function AssetLibraryPageContent({ project }) {
  const [remoteAssetItems, setRemoteAssetItems] = useState([]);
  const [remoteAssetTotal, setRemoteAssetTotal] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ASSETS_PER_PAGE);

  const [previewAssetId, setPreviewAssetId] = useState('');

  const [actionNotice, setActionNotice] = useState('');
  const noticeTimerRef = useRef(0);
  const hasToken = Boolean(localStorage.getItem('token'));

  useEffect(
    () => () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );

  function showActionNotice(message) {
    if (!message) {
      return;
    }

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    setActionNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setActionNotice('');
      noticeTimerRef.current = 0;
    }, NOTICE_HIDE_DURATION_MS);
  }

  useEffect(() => {
    if (!hasToken) {
      return undefined;
    }

    let disposed = false;

    (async () => {
      setIsSyncing(true);
      setSyncMessage('');
      setIsPermissionDenied(false);

      const [assetResult] = await Promise.allSettled([
        assetApi.getTeamAssets({
          page: currentPage,
          pageSize,
        }),
      ]);

      if (disposed) {
        return;
      }

      if (assetResult.status === 'fulfilled') {
        const normalized = normalizeAssetPageResponse(assetResult.value);
        setRemoteAssetItems(normalized.items);
        setRemoteAssetTotal(normalized.total);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      if (assetResult.status === 'rejected') {
        const message = parseApiErrorMessage(
          assetResult.reason,
          '素材列表加载失败，请稍后重试。',
        );
        setRemoteAssetItems([]);
        setRemoteAssetTotal(0);
        setSyncMessage(message);
        setIsPermissionDenied(detectPermissionIssue(message));
      }

      setIsSyncing(false);
    })();

    return () => {
      disposed = true;
    };
  }, [currentPage, hasToken, pageSize, project, project?.id, syncNonce]);

  const effectiveRemoteAssetTotal = hasToken ? remoteAssetTotal : 0;
  const effectiveIsSyncing = hasToken ? isSyncing : false;
  const effectiveSyncMessage = hasToken ? syncMessage : '';
  const effectiveIsPermissionDenied = hasToken ? isPermissionDenied : false;
  const effectiveLastSyncedAt = hasToken ? lastSyncedAt : '';

  const remoteAssets = useMemo(
    () => buildRemoteAssetCollection(hasToken ? remoteAssetItems : [], project),
    [hasToken, remoteAssetItems, project],
  );
  const allAssets = useMemo(() => remoteAssets, [remoteAssets]);

  const filteredAssets = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return allAssets.filter((asset) => {
      if (assetTypeFilter === 'image' && asset.kind !== 'image') {
        return false;
      }
      if (assetTypeFilter === 'audio' && asset.kind !== 'audio') {
        return false;
      }
      if (assetTypeFilter === 'video' && asset.kind !== 'video') {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const text = `${asset.title} ${asset.subTitle} ${asset.prompt} ${asset.source}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [allAssets, assetTypeFilter, searchKeyword]);

  const orderedAssets = useMemo(() => {
    const list = [...filteredAssets];
    list.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.timestamp - b.timestamp;
      }
      return b.timestamp - a.timestamp;
    });
    return list;
  }, [filteredAssets, sortOrder]);

  const totalItems =
    Number.isFinite(Number(effectiveRemoteAssetTotal)) && Number(effectiveRemoteAssetTotal) >= 0
      ? Number(effectiveRemoteAssetTotal)
      : allAssets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedAssets = orderedAssets;

  const groupedAssets = useMemo(
    () => groupAssetsByDate(pagedAssets, sortOrder),
    [pagedAssets, sortOrder],
  );

  const hasAssets = allAssets.length > 0;
  const hasVisibleAssets = orderedAssets.length > 0;
  const isFilterResultEmpty = hasAssets && !hasVisibleAssets;
  const hasActiveFilter =
    Boolean(searchKeyword.trim()) ||
    assetTypeFilter !== 'all' ||
    sortOrder !== 'desc';

  const previewIndex = useMemo(
    () => orderedAssets.findIndex((asset) => asset.id === previewAssetId),
    [orderedAssets, previewAssetId],
  );
  const currentPreviewAsset = previewIndex >= 0 ? orderedAssets[previewIndex] : null;


  function openPreview(assetId) {
    setPreviewAssetId(assetId);
  }

  function closePreview() {
    setPreviewAssetId('');
  }

  function movePreview(step) {
    if (!orderedAssets.length || previewIndex < 0) {
      return;
    }

    const nextIndex = previewIndex + step;
    if (nextIndex < 0 || nextIndex >= orderedAssets.length) {
      return;
    }

    setPreviewAssetId(orderedAssets[nextIndex].id);
  }

  function handleDownloadAsset(asset, event) {
    if (event) {
      event.stopPropagation();
    }

    if (!asset?.previewUrl) {
      showActionNotice('当前素材没有可下载文件。');
      return;
    }

    const link = document.createElement('a');
    link.href = asset.previewUrl;
    link.download = asset.fileName || `${asset.title}.${getDefaultAssetExtension(asset.kind)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleGenerateSimilar(asset) {
    if (!asset?.prompt) {
      showActionNotice('当前素材没有可复用的提示词。');
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(asset.prompt)
        .then(() => {
          showActionNotice('提示词已复制，可前往短剧创建页生成同款。');
        })
        .catch(() => {
          showActionNotice('复制失败，请手动复制提示词后在创作页使用。');
        });
      return;
    }

    showActionNotice('请手动复制提示词后在创作页生成同款素材。');
  }

  function handleResetFilters() {
    setSearchKeyword('');
    setAssetTypeFilter('all');
    setSortOrder('desc');
  }

  function handleRefreshAssets() {
    if (!hasToken || effectiveIsSyncing) {
      return;
    }

    setSyncNonce((current) => current + 1);
  }


  useEffect(() => {
    if (!currentPreviewAsset) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        setPreviewAssetId('');
        return;
      }
      if (event.key === 'ArrowLeft') {
        if (previewIndex > 0) {
          setPreviewAssetId(orderedAssets[previewIndex - 1].id);
        }
        return;
      }
      if (event.key === 'ArrowRight') {
        if (previewIndex >= 0 && previewIndex < orderedAssets.length - 1) {
          setPreviewAssetId(orderedAssets[previewIndex + 1].id);
        }
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [currentPreviewAsset, previewIndex, orderedAssets]);

  return (
    <div className={styles.page}>
      <section className={styles.surface} aria-labelledby="asset-library-heading">
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h3 id="asset-library-heading">素材库</h3>
            <p>按时间聚合项目素材，支持筛选、预览、下载与复用提示词。</p>
          </div>
          <div className={styles.headerAction}>
            <div className={styles.syncInfo}>
              <span>
                {effectiveIsSyncing
                  ? '同步中...'
                  : effectiveLastSyncedAt
                    ? `上次同步 ${effectiveLastSyncedAt}`
                    : '等待同步'}
              </span>
            </div>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleRefreshAssets}
              disabled={!hasToken || effectiveIsSyncing}
            >
              {effectiveIsSyncing ? '同步中...' : '刷新素材'}
            </button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="搜索素材标题 / 提示词 / 来源"
              aria-label="搜索素材"
            />
          </label>

          <AppSelect
            className={styles.toolbarSelect}
            fullWidth={false}
            ariaLabel="素材类型"
            value={assetTypeFilter}
            onChange={setAssetTypeFilter}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'image', label: '仅图片' },
              { value: 'audio', label: '仅音频' },
              { value: 'video', label: '仅视频' },
            ]}
          />

          <AppSelect
            className={styles.toolbarSelect}
            fullWidth={false}
            ariaLabel="时间排序"
            value={sortOrder}
            onChange={setSortOrder}
            options={[
              { value: 'desc', label: '时间倒序' },
              { value: 'asc', label: '时间正序' },
            ]}
          />

          <button
            type="button"
            className={styles.secondaryAction}
            onClick={handleResetFilters}
            disabled={!hasActiveFilter}
          >
            重置筛选
          </button>
        </div>

        {effectiveSyncMessage && (
          <div className={`${styles.syncMessage} ${effectiveIsPermissionDenied ? styles.syncError : ''}`}>
            {effectiveSyncMessage}
          </div>
        )}

        {actionNotice && (
          <p className={styles.notice} role="status" aria-live="polite">
            {actionNotice}
          </p>
        )}

        <div className={styles.listArea}>
          {effectiveIsSyncing && !hasAssets ? (
            <div className={styles.statePanel}>
              <div className={styles.spinner} aria-hidden />
              <h4>素材列表加载中</h4>
              <p>正在同步项目素材，请稍候。</p>
            </div>
          ) : effectiveIsPermissionDenied && !hasAssets ? (
            <div className={styles.statePanel}>
              <div className={styles.stateIcon} aria-hidden>
                !
              </div>
              <h4>暂无权限访问素材</h4>
              <p>请确认当前账号具备项目访问权限，或重新登录后重试同步。</p>
              <button type="button" className={styles.secondaryAction} onClick={handleRefreshAssets}>
                重新同步
              </button>
            </div>
          ) : !hasVisibleAssets ? (
            <div className={styles.statePanel}>
              <div className={styles.stateIcon} aria-hidden>
                {isFilterResultEmpty ? '0' : '[]'}
              </div>
              <h4>{isFilterResultEmpty ? '没有匹配素材' : '暂无素材'}</h4>
              <p>
                {isFilterResultEmpty
                  ? '请调整关键词或筛选条件。'
                  : '当前团队还没有可展示的图片、音频或视频素材，生成后会自动出现在这里。'}
              </p>
              {isFilterResultEmpty && (
                <button type="button" className={styles.secondaryAction} onClick={handleResetFilters}>
                  清空筛选
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.assetListScroller}>
                <div className={styles.groupList}>
                  {groupedAssets.map((group) => (
                    <section key={group.dateKey} className={styles.dateSection}>
                      <header className={styles.dateHeader}>
                        <h4 className={styles.dateTitle}>{group.dateKey}</h4>
                        <span className={styles.dateMeta}>本页 {group.items.length} 项</span>
                      </header>
                      <div className={styles.assetGrid}>
                        {group.items.map((asset) => (
                          <article
                            key={asset.id}
                            className={`${styles.assetCard} ${asset.status === 'failed' ? styles.assetFailed : ''}`}
                          >
                            <div className={styles.assetMedia}>
                              {asset.status === 'failed' ? (
                                <div className={styles.failedPanel}>
                                  <span className={styles.failedMark}>×</span>
                                  <span>{asset.failedText}</span>
                                </div>
                              ) : asset.kind === 'audio' ? (
                                <div className={styles.assetAudioPanel}>
                                  <div className={styles.assetAudioBadge}>音频</div>
                                  <p className={styles.assetAudioHint}>使用播放器预览当前音频素材</p>
                                  <audio
                                    className={styles.assetAudio}
                                    src={asset.previewUrl}
                                    controls
                                    preload="metadata"
                                  />
                                </div>
                              ) : asset.kind === 'video' ? (
                                <video className={styles.assetVideo} src={asset.previewUrl} preload="metadata" muted />
                              ) : (
                                <img className={styles.assetImage} src={asset.previewUrl} alt={asset.title} />
                              )}

                              <span className={styles.typeTag}>{asset.typeLabel}</span>
                              {asset.status === 'failed' && <span className={styles.failedTag}>失败</span>}
                            </div>

                            <div className={styles.assetInfo}>
                              <h5 title={asset.title}>{asset.title}</h5>
                              <p>{asset.subTitle}</p>
                              <small>
                                {asset.source} · {asset.dateKey}
                              </small>
                            </div>

                            <div className={styles.assetActions}>
                              <button type="button" onClick={() => openPreview(asset.id)}>
                                预览
                              </button>
                              <button
                                type="button"
                                onClick={(event) => handleDownloadAsset(asset, event)}
                                disabled={!asset.previewUrl}
                              >
                                下载
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
              <PaginationBar
                totalItems={totalItems}
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setCurrentPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize || ASSETS_PER_PAGE);
                  setCurrentPage(1);
                }}
                pageSizeAriaLabel="\u6bcf\u9875\u7d20\u6750\u6570\u91cf"
                summaryText={`\u5171 ${totalItems} \u6761`}
              />
            </>
          )}
        </div>
      </section>

      {currentPreviewAsset && (
        <div
          className={styles.previewMask}
          role="dialog"
          aria-modal="true"
          aria-label="素材预览"
          onClick={closePreview}
        >
          <div className={styles.previewDialog} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.previewClose} onClick={closePreview} aria-label="关闭预览">
              ×
            </button>

            <div className={styles.previewBody}>
              <section className={styles.previewMediaPane}>
                <button
                  type="button"
                  className={styles.previewNav}
                  disabled={previewIndex <= 0}
                  onClick={() => movePreview(-1)}
                >
                  ‹
                </button>
                <div className={styles.previewMediaFrame}>
                  {currentPreviewAsset.status === 'failed' ? (
                    <div className={styles.previewFailed}>
                      <span className={styles.failedMark}>×</span>
                      <p>{currentPreviewAsset.failedText}</p>
                    </div>
                  ) : currentPreviewAsset.kind === 'audio' ? (
                    <div className={styles.previewAudioWrap}>
                      <div className={styles.previewAudioIcon}>AUDIO</div>
                      <audio
                        className={styles.previewAudio}
                        src={currentPreviewAsset.previewUrl}
                        controls
                        preload="metadata"
                      />
                    </div>
                  ) : currentPreviewAsset.kind === 'video' ? (
                    <video
                      className={styles.previewVideo}
                      src={currentPreviewAsset.previewUrl}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      className={styles.previewImage}
                      src={currentPreviewAsset.previewUrl}
                      alt={currentPreviewAsset.title}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className={styles.previewNav}
                  disabled={previewIndex >= orderedAssets.length - 1}
                  onClick={() => movePreview(1)}
                >
                  ›
                </button>
              </section>

              <aside className={styles.previewInfoPane}>
                <header className={styles.previewHeader}>
                  <h4>{currentPreviewAsset.title}</h4>
                  <p>{currentPreviewAsset.subTitle}</p>
                  <small>
                    来源：{currentPreviewAsset.source} · 时间：{toTimeText(currentPreviewAsset.createdAt)}
                  </small>
                  <small>
                    当前预览：第 {previewIndex + 1} / {orderedAssets.length} 项
                  </small>
                </header>

                <section className={styles.previewMetaSection}>
                  <h5>生成提示词</h5>
                  <p>{currentPreviewAsset.prompt || '暂无提示词'}</p>
                </section>

                <div className={styles.previewFooter}>
                  <button type="button" onClick={() => handleGenerateSimilar(currentPreviewAsset)}>
                    复制提示词
                  </button>
                  <button type="button" onClick={(event) => handleDownloadAsset(currentPreviewAsset, event)}>
                    下载素材
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetLibraryPage({ project }) {
  const projectKey = `${project?.id || ''}:${project?.backendProjectId || ''}`;
  return <AssetLibraryPageContent key={projectKey} project={project} />;
}

export default AssetLibraryPage;
