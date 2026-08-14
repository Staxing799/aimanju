import { useEffect, useRef, useState } from 'react';
import { freeCanvasApi } from '../../api';
import { parseApiErrorMessage } from '../../utils/projectAdapter';
import styles from './FreeCanvasHistoryPanel.module.less';

const HISTORY_PAGE_SIZE = 30;

const MEDIA_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

const MEDIA_LABELS = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

const COVER_URL_KEYS = [
  'thumbnail_url',
  'thumbnailUrl',
  'thumbnail',
  'preview_image_url',
  'previewImageUrl',
  'poster_url',
  'posterUrl',
  'poster',
  'cover_url',
  'coverUrl',
  'cover',
  'image_url',
  'imageUrl',
];

const MEDIA_URL_KEYS = [
  'url',
  'file_url',
  'fileUrl',
  'media_url',
  'mediaUrl',
  'output_url',
  'outputUrl',
  'asset_url',
  'assetUrl',
  'oss_url',
  'ossUrl',
  'video_url',
  'videoUrl',
];

function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function firstText(...values) {
  for (const value of values) {
    if (value == null || typeof value === 'object') {
      continue;
    }
    const text = String(value ?? '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function parseStructuredValue(value) {
  if (value && typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) {
    return value;
  }
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function isMediaUrl(value) {
  const text = firstText(value);
  return Boolean(
    text &&
      (/^(https?:|data:|blob:|\/)/i.test(text) ||
        /\.(?:avif|gif|jpe?g|png|webp|mp4|m4v|mov|webm)(?:[?#].*)?$/i.test(text)),
  );
}

function findNestedMediaUrl(value, preferredKeys, depth = 0, visited = new Set()) {
  if (depth > 5 || value == null) {
    return '';
  }

  const parsed = parseStructuredValue(value);
  if (typeof parsed === 'string') {
    return isMediaUrl(parsed) ? parsed.trim() : '';
  }
  if (!parsed || typeof parsed !== 'object' || visited.has(parsed)) {
    return '';
  }
  visited.add(parsed);

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const url = findNestedMediaUrl(item, preferredKeys, depth + 1, visited);
      if (url) {
        return url;
      }
    }
    return '';
  }

  for (const key of preferredKeys) {
    if (!(key in parsed)) {
      continue;
    }
    const url = findNestedMediaUrl(parsed[key], preferredKeys, depth + 1, visited);
    if (url) {
      return url;
    }
  }

  for (const nestedValue of Object.values(parsed)) {
    if (!nestedValue || typeof parseStructuredValue(nestedValue) !== 'object') {
      continue;
    }
    const url = findNestedMediaUrl(nestedValue, preferredKeys, depth + 1, visited);
    if (url) {
      return url;
    }
  }
  return '';
}

function resolveModelName(item) {
  const directName = firstText(
    item.model_display_name,
    item.modelDisplayName,
    item.model_name,
    item.modelName,
  );
  if (directName) {
    return directName;
  }

  const model = parseObject(item.model ?? item.model_info ?? item.modelInfo);
  return firstText(
    model.display_name,
    model.displayName,
    model.model_name,
    model.modelName,
    model.label,
    model.name,
  );
}

function normalizeMediaType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['text', 'script', 'character', 'storyboard'].includes(normalized)) {
    return 'text';
  }
  if (['image', 'upload_image', 'img'].includes(normalized)) {
    return 'image';
  }
  if (['video', 'upload_video'].includes(normalized)) {
    return 'video';
  }
  if (['audio', 'voice'].includes(normalized)) {
    return 'audio';
  }
  return 'text';
}

function findHistoryArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of ['items', 'histories', 'history', 'records', 'rows', 'results', 'list']) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  for (const key of ['data', 'result', 'payload']) {
    const nested = payload[key];
    if (nested && typeof nested === 'object') {
      const items = findHistoryArray(nested);
      if (items.length > 0) {
        return items;
      }
    }
  }
  return [];
}

function findPagingContainer(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const nested = [payload.data, payload.result, payload.payload]
    .find((value) => value && typeof value === 'object' && !Array.isArray(value));
  return nested || payload;
}

function resolvePreview(item, mediaType) {
  const directPreviewUrl = firstText(item.preview_url, item.previewUrl);
  if (isMediaUrl(directPreviewUrl)) {
    return {
      url: directPreviewUrl,
      kind: mediaType === 'video' ? 'video' : 'image',
    };
  }

  const directCoverUrl = firstText(
    item.thumbnail_url,
    item.thumbnailUrl,
    item.cover_url,
    item.coverUrl,
    item.image_url,
    item.imageUrl,
  );
  if (isMediaUrl(directCoverUrl)) {
    return { url: directCoverUrl, kind: 'image' };
  }

  const outputSources = [
    item.output,
    item.output_json,
    item.outputJson,
    item.output_summary,
    item.outputSummary,
    item.outputs,
    item.result,
    item.result_json,
    item.resultJson,
    item.asset,
    item.output_asset,
    item.outputAsset,
    item.output_assets,
    item.outputAssets,
    item.assets,
  ];
  for (const source of outputSources) {
    const coverUrl = findNestedMediaUrl(source, COVER_URL_KEYS);
    if (coverUrl) {
      return { url: coverUrl, kind: 'image' };
    }
  }

  const directMediaUrl = firstText(
    item.output_url,
    item.outputUrl,
    item.media_url,
    item.mediaUrl,
    item.video_url,
    item.videoUrl,
    item.image_url,
    item.imageUrl,
    item.url,
  );
  const mediaUrl = isMediaUrl(directMediaUrl)
    ? directMediaUrl
    : outputSources
        .map((source) => findNestedMediaUrl(source, MEDIA_URL_KEYS))
        .find(Boolean) || '';
  return {
    url: mediaUrl,
    kind: mediaType === 'video' && mediaUrl ? 'video' : 'image',
  };
}

function normalizeHistoryItem(rawItem) {
  const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
  const id = firstText(
    item.history_id,
    item.historyId,
    item.node_run_id,
    item.nodeRunId,
    item.run_id,
    item.runId,
    item.id,
  );
  const mediaType = normalizeMediaType(
    item.media_type ?? item.mediaType ?? item.component_type ?? item.componentType ?? item.node_type,
  );
  const prompt = firstText(
    item.prompt_excerpt,
    item.promptExcerpt,
    item.prompt,
    item.input_text,
    item.inputText,
  );
  const title = firstText(
    item.node_title,
    item.nodeTitle,
    item.title,
    item.name,
    prompt,
    item.model_display_name,
    item.modelDisplayName,
    id ? `记录 ${id.slice(0, 8)}` : '',
  );
  const preview = resolvePreview(item, mediaType);

  return {
    id,
    title: title || '未命名生成记录',
    mediaType,
    mediaLabel: MEDIA_LABELS[mediaType] || '文本',
    modelName: resolveModelName(item),
    createdAt: firstText(
      item.created_at,
      item.createdAt,
      item.completed_at,
      item.completedAt,
      item.generated_at,
      item.generatedAt,
    ),
    previewUrl: preview.url,
    previewKind: preview.kind,
  };
}

function normalizeHistoryPage(payload) {
  const paging = findPagingContainer(payload);
  const items = findHistoryArray(payload)
    .map(normalizeHistoryItem)
    .filter((item) => item.id);
  const nextCursor = firstText(
    paging.next_cursor,
    paging.nextCursor,
    payload?.next_cursor,
    payload?.nextCursor,
  );
  const explicitHasMore =
    paging.has_more ?? paging.hasMore ?? payload?.has_more ?? payload?.hasMore;

  return {
    items,
    nextCursor,
    hasMore: typeof explicitHasMore === 'boolean' ? explicitHasMore : Boolean(nextCursor),
  };
}

function formatHistoryTime(value) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function HistoryThumbnail({ item, disabled, onPreview }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const canPreview = Boolean(item.previewUrl) && !mediaFailed;

  return (
    <button
      className={`${styles.thumbnail} ${styles[`thumbnail_${item.mediaType}`] || ''}`}
      type="button"
      aria-label={item.previewKind === 'video' ? `放大观看视频：${item.title}` : `放大查看图片：${item.title}`}
      title={canPreview ? (item.previewKind === 'video' ? '放大观看视频' : '放大查看图片') : undefined}
      onClick={() => onPreview(item)}
      disabled={disabled || !canPreview}
    >
      <span className={styles.thumbnailFallback} aria-hidden />
      {item.previewUrl && !mediaFailed && item.previewKind === 'video' ? (
        <video
          src={item.previewUrl}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedMetadata={(event) => {
            if (event.currentTarget.duration > 0) {
              event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration);
            }
          }}
          onError={() => setMediaFailed(true)}
        />
      ) : item.previewUrl && !mediaFailed ? (
        <img
          src={item.previewUrl}
          alt=""
          loading="lazy"
          onError={() => setMediaFailed(true)}
        />
      ) : null}
      <small>{item.mediaLabel}</small>
    </button>
  );
}

export default function FreeCanvasHistoryPanel({
  open,
  projectId,
  restoringHistoryId,
  restoreError,
  onClose,
  onPreview,
  onRestore,
}) {
  const [mediaFilter, setMediaFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const requestSerialRef = useRef(0);

  async function loadHistory({ append = false, cursor = '' } = {}) {
    if (!projectId) {
      setItems([]);
      setNextCursor('');
      setHasMore(false);
      setErrorMessage('画布项目未就绪');
      return;
    }

    const requestSerial = requestSerialRef.current + 1;
    requestSerialRef.current = requestSerial;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]);
    }
    setErrorMessage('');

    try {
      const result = await freeCanvasApi.listHistory(projectId, {
        cursor: cursor || undefined,
        page_size: HISTORY_PAGE_SIZE,
        media_type: mediaFilter === 'all' ? undefined : mediaFilter,
      });
      if (requestSerialRef.current !== requestSerial) {
        return;
      }
      const page = normalizeHistoryPage(result);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      if (requestSerialRef.current !== requestSerial) {
        return;
      }
      setErrorMessage(parseApiErrorMessage(error, '历史记录加载失败，请稍后重试'));
    } finally {
      if (requestSerialRef.current === requestSerial) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    if (!open) {
      requestSerialRef.current += 1;
      return undefined;
    }
    loadHistory();
    return () => {
      requestSerialRef.current += 1;
    };
    // The request is intentionally restarted only when the visible query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFilter, open, projectId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !restoringHistoryId) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, restoringHistoryId]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className={styles.panel}
      data-canvas-ignore="true"
      role="dialog"
      aria-label="生成历史记录"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CANVAS HISTORY</span>
          <h2>历史记录</h2>
        </div>
        <button
          className={styles.closeButton}
          type="button"
          aria-label="关闭历史记录"
          onClick={onClose}
          disabled={Boolean(restoringHistoryId)}
        >
          <span aria-hidden />
        </button>
      </header>

      <div className={styles.filters} role="tablist" aria-label="历史类型筛选">
        {MEDIA_FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={mediaFilter === filter.value ? styles.filterActive : ''}
            type="button"
            role="tab"
            aria-selected={mediaFilter === filter.value}
            onClick={() => setMediaFilter(filter.value)}
            disabled={Boolean(restoringHistoryId)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {restoreError ? (
        <div className={styles.restoreError} role="alert">
          {restoreError}
        </div>
      ) : null}

      <div className={styles.body} aria-live="polite" aria-busy={loading || loadingMore}>
        {loading ? (
          <div className={styles.state}>
            <span className={styles.spinner} aria-hidden />
            <strong>正在加载历史记录</strong>
            <small>请稍候…</small>
          </div>
        ) : errorMessage ? (
          <div className={styles.state}>
            <span className={styles.errorIcon} aria-hidden>!</span>
            <strong>加载失败</strong>
            <small>{errorMessage}</small>
            <button type="button" onClick={() => loadHistory()}>重新加载</button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            <span className={styles.emptyIcon} aria-hidden />
            <strong>暂无历史记录</strong>
            <small>{mediaFilter === 'all' ? '完成一次生成后，记录会出现在这里' : `暂无${MEDIA_LABELS[mediaFilter]}生成记录`}</small>
          </div>
        ) : (
          <div className={styles.list}>
            {items.map((item) => {
              const isRestoring = restoringHistoryId === item.id;
              return (
                <div
                  key={item.id}
                  className={`${styles.item} ${isRestoring ? styles.itemRestoring : ''}`}
                >
                  <HistoryThumbnail
                    key={`${item.previewKind}:${item.previewUrl || item.mediaType}`}
                    item={item}
                    disabled={Boolean(restoringHistoryId)}
                    onPreview={onPreview}
                  />
                  <button
                    className={styles.restoreButton}
                    type="button"
                    aria-label={`恢复历史记录：${item.title}`}
                    onClick={() => onRestore(item)}
                    disabled={Boolean(restoringHistoryId)}
                  >
                    <span className={styles.itemContent}>
                      <strong title={item.title}>{item.title}</strong>
                      <span className={styles.itemMeta}>
                        {item.modelName ? <small title={item.modelName}>{item.modelName}</small> : null}
                        {formatHistoryTime(item.createdAt) ? <time dateTime={item.createdAt}>{formatHistoryTime(item.createdAt)}</time> : null}
                      </span>
                    </span>
                    <span className={styles.itemAction} aria-hidden>
                      {isRestoring ? <span className={styles.spinner} /> : <span className={styles.restoreArrow}>↗</span>}
                    </span>
                  </button>
                </div>
              );
            })}

            {hasMore ? (
              <button
                className={styles.loadMoreButton}
                type="button"
                onClick={() => loadHistory({ append: true, cursor: nextCursor })}
                disabled={loadingMore || Boolean(restoringHistoryId)}
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </button>
            ) : (
              <span className={styles.listEnd}>已显示全部记录</span>
            )}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerClock} aria-hidden />
        <span>点击记录即可在当前画布恢复完整生成链路</span>
      </footer>
    </aside>
  );
}
