import { useEffect, useMemo, useRef, useState } from 'react';
import defaultProjectCover from '../assets/default-project-cover.svg';
import AppSelect from '../components/common/AppSelect';
import PaginationBar from '../components/common/PaginationBar';
import { normalizePossiblyMojibakeText } from '../utils/textEncoding';
import styles from './ProjectManagementPage.module.less';

const PROJECTS_PER_PAGE = 8;
const PAGE_SIZE_OPTIONS = [8, 16, 24, 40];

function resolveProjectStatus(parseStatus) {
  if (parseStatus === 'done' || parseStatus === 'success') {
    return '已完成';
  }
  if (parseStatus === 'failed') {
    return '解析失败';
  }
  if (parseStatus === 'parsing' || parseStatus === 'queued' || parseStatus === 'running') {
    return '进行中';
  }
  return '待开始';
}

function resolveProjectStatusTone(parseStatus) {
  const status = resolveProjectStatus(parseStatus);
  if (status === '已完成') {
    return 'done';
  }
  if (status === '解析失败') {
    return 'failed';
  }
  if (status === '进行中') {
    return 'running';
  }
  return 'idle';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('封面读取失败'));
    reader.readAsDataURL(file);
  });
}

function sanitizeDisplayText(value, fallback = '') {
  const rawText = String(value || '').trim();
  if (!rawText) {
    return fallback;
  }

  const normalized = normalizePossiblyMojibakeText(rawText).replace(/\uFFFD+/g, '');
  return normalized.trim() || fallback;
}

function toProjectType(genre) {
  const text = String(genre || '').toLowerCase();
  if (text.includes('live') || text.includes('真人')) {
    return 'live_action';
  }
  return 'comic';
}

function toTimeNumber(value) {
  const next = new Date(value || '').getTime();
  return Number.isFinite(next) ? next : 0;
}

function toDateText(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString();
}

// 项目管理页：素材库式布局，支持筛选、排序、空态与项目卡片展示。
function ProjectManagementPage({
  projects,
  total,
  currentPage,
  pageSize,
  activeProjectId,
  activeBackendProjectId,
  onEnterCreation,
  onRequestCreateProject,
  onUpdateProject,
  onRemoveProject,
  onPageChange,
  onPageSizeChange,
  onNotify,
  loading,
  errorMessage,
  onRetryLoad,
}) {
  const coverUploadInputRef = useRef(null);
  const [pendingCoverProjectId, setPendingCoverProjectId] = useState('');
  const [uploadingCoverProjectId, setUploadingCoverProjectId] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  function triggerCoverUpload(projectId) {
    if (!projectId) {
      return;
    }

    setPendingCoverProjectId(projectId);
    if (coverUploadInputRef.current) {
      coverUploadInputRef.current.value = '';
      coverUploadInputRef.current.click();
    }
  }

  async function handleCoverUpload(event) {
    const file = event.target.files?.[0];
    const projectId = pendingCoverProjectId;
    if (!file || !projectId || typeof onUpdateProject !== 'function') {
      return;
    }

    try {
      setUploadingCoverProjectId(projectId);
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        return;
      }

      onUpdateProject(projectId, {
        coverUrl: dataUrl,
      });
    } catch {
      if (typeof onNotify === 'function') {
        onNotify('封面上传失败，请重试', 'error');
      }
    } finally {
      setUploadingCoverProjectId('');
      setPendingCoverProjectId('');
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  function handleEnterCreation(project) {
    if (typeof onEnterCreation !== 'function') {
      return;
    }

    const localProjectId = String(project?.id || '').trim();
    const backendProjectId = String(project?.backendProjectId || '').trim();
    const targetProjectId = backendProjectId || localProjectId;
    if (!targetProjectId) {
      return;
    }

    onEnterCreation(targetProjectId);
  }

  function handleCreateProject() {
    if (typeof onRequestCreateProject === 'function') {
      onRequestCreateProject();
    }
  }

  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const hasError = Boolean(String(errorMessage || '').trim());
  const hasActiveFilters =
    Boolean(searchKeyword.trim()) ||
    sortOrder !== 'desc' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all';
  const remoteTotal =
    Number.isFinite(Number(total)) && Number(total) >= 0 ? Number(total) : safeProjects.length;

  const visibleProjects = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return safeProjects
      .filter((project) => {
        const displayName = sanitizeDisplayText(project.name, '').toLowerCase();
        const displayGenre = sanitizeDisplayText(project.genre, '').toLowerCase();
        const displayPlatform = sanitizeDisplayText(project.targetPlatform, '').toLowerCase();
        const statusTone = resolveProjectStatusTone(project.parseStatus);

        const matchesType = typeFilter === 'all' || toProjectType(project.genre) === typeFilter;
        const matchesStatus = statusFilter === 'all' || statusTone === statusFilter;
        const matchesKeyword =
          !keyword ||
          displayName.includes(keyword) ||
          displayGenre.includes(keyword) ||
          displayPlatform.includes(keyword);

        return matchesType && matchesStatus && matchesKeyword;
      })
      .sort((a, b) => {
        const left = toTimeNumber(a.updatedAt || a.createdAt);
        const right = toTimeNumber(b.updatedAt || b.createdAt);
        return sortOrder === 'asc' ? left - right : right - left;
      });
  }, [safeProjects, searchKeyword, sortOrder, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(remoteTotal / pageSize));
  const pagedProjects = visibleProjects;
  useEffect(() => {
    if (currentPage > totalPages && typeof onPageChange === 'function') {
      onPageChange(totalPages);
    }
  }, [currentPage, onPageChange, totalPages]);

  const showEmptyResult = !loading && !hasError && visibleProjects.length === 0;
  const emptyTitle = safeProjects.length > 0 ? '没有匹配的项目' : '暂无项目';
  const emptyDesc =
    safeProjects.length > 0
      ? '试试调整搜索词、排序方式或项目类型筛选。'
      : '当前团队还没有项目，请从短剧创建入口点击生成设定后自动创建。';

  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (searchKeyword.trim()) {
      tags.push(`关键词：${searchKeyword.trim()}`);
    }
    if (typeFilter !== 'all') {
      tags.push(`类型：${typeFilter === 'comic' ? '短剧项目' : '真人项目'}`);
    }
    if (statusFilter !== 'all') {
      const statusLabel =
        statusFilter === 'running' ? '进行中' : statusFilter === 'done' ? '已完成' : statusFilter === 'failed' ? '解析失败' : '待开始';
      tags.push(`状态：${statusLabel}`);
    }
    if (sortOrder !== 'desc') {
      tags.push('排序：时间正序');
    }
    return tags;
  }, [searchKeyword, typeFilter, statusFilter, sortOrder]);

  function handleResetFilters() {
    setSearchKeyword('');
    setSortOrder('desc');
    setTypeFilter('all');
    setStatusFilter('all');
    if (typeof onPageChange === 'function') {
      onPageChange(1);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <h3>项目管理</h3>
            <p>集中查看项目状态、筛选目标项目并快速进入创作流程。</p>
          </div>
        </div>

        <div className={styles.libraryBoard}>
          <div className={styles.libraryTopBar}>
            <div className={styles.titleGroup}>
              <h4 className={styles.sectionTag}>全部项目</h4>
              <span className={styles.sectionMeta}>
                当前页显示 {visibleProjects.length} / {safeProjects.length} 项，共 {remoteTotal} 项
              </span>
            </div>
            <div className={styles.tools}>
              <label className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden>
                  ⌕
                </span>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  aria-label="搜索项目"
                  placeholder="搜索项目名称 / 关键词"
                />
              </label>
              <AppSelect
                className={styles.toolsSelect}
                fullWidth={false}
                ariaLabel="排序方式"
                value={sortOrder}
                onChange={setSortOrder}
                options={[
                  { value: 'desc', label: '时间倒序' },
                  { value: 'asc', label: '时间正序' },
                ]}
              />
              <AppSelect
                className={styles.toolsSelect}
                fullWidth={false}
                ariaLabel="项目类型"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'comic', label: '短剧项目' },
                  { value: 'live_action', label: '真人项目' },
                ]}
              />
              <AppSelect
                className={styles.toolsSelect}
                fullWidth={false}
                ariaLabel="项目状态"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'running', label: '进行中' },
                  { value: 'done', label: '已完成' },
                  { value: 'failed', label: '解析失败' },
                  { value: 'idle', label: '待开始' },
                ]}
              />
              <button
                type="button"
                className={styles.toolsButton}
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
              >
                重置筛选
              </button>
            </div>
          </div>
          {activeFilterTags.length > 0 && (
            <div className={styles.filterChips} aria-label="当前筛选条件">
              {activeFilterTags.map((tag) => (
                <span key={tag} className={styles.filterChip}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className={styles.listArea}>
            {loading ? (
              <div className={styles.statePanel}>
                <div className={styles.loadingSpinner} aria-hidden />
                <h5 className={styles.stateTitle}>项目加载中</h5>
                <p className={styles.stateDesc}>正在同步团队项目，请稍候。</p>
              </div>
            ) : hasError ? (
              <div className={styles.statePanel}>
                <div className={styles.stateIcon} aria-hidden>
                  !
                </div>
                <h5 className={styles.stateTitle}>项目列表加载失败</h5>
                <p className={styles.stateDesc}>{errorMessage}</p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => (typeof onRetryLoad === 'function' ? onRetryLoad() : null)}
                >
                  重新加载
                </button>
              </div>
            ) : showEmptyResult ? (
              <div className={styles.statePanel}>
                <div className={styles.stateIcon} aria-hidden>
                  {safeProjects.length > 0 ? '0' : '[]'}
                </div>
                <h5 className={styles.stateTitle}>{emptyTitle}</h5>
                <p className={styles.stateDesc}>{emptyDesc}</p>
              </div>
            ) : (
              <>
                <div className={styles.cardListScroller}>
                  <div className={styles.cardGrid}>
                    <button type="button" className={styles.newProjectCard} onClick={handleCreateProject}>
                      <span className={styles.newProjectIcon} aria-hidden>
                        +
                      </span>
                      <strong>创建新项目</strong>
                      <small>从剧本设定开始，自动生成项目结构</small>
                    </button>
                    {pagedProjects.map((project) => {
                      const isActiveProject =
                        activeProjectId === project.id ||
                        (activeBackendProjectId && activeBackendProjectId === project.backendProjectId);
                      const isUploadingCover = uploadingCoverProjectId === project.id;
                      const displayName = sanitizeDisplayText(project.name, '未命名项目');
                      const displayGenre = sanitizeDisplayText(project.genre, '未设置');
                      const canUploadCover = false;
                      const canRemoveProject = typeof onRemoveProject === 'function';

                      return (
                        <article key={project.id} className={styles.projectCard}>
                          <div className={styles.coverWrap}>
                            <img
                              className={styles.coverImage}
                              src={project.coverUrl || defaultProjectCover}
                              alt={`${displayName || '项目'}封面`}
                            />
                            {canUploadCover && (
                              <button
                                type="button"
                                className={styles.coverAction}
                                onClick={() => triggerCoverUpload(project.id)}
                                disabled={isUploadingCover}
                              >
                                {isUploadingCover ? '上传中...' : '替换封面'}
                              </button>
                            )}
                          </div>

                          <div className={styles.cardBody}>
                            <div className={styles.cardTitleRow}>
                              <h4 className={styles.cardTitle}>{displayName}</h4>
                              {isActiveProject && <span className={styles.currentBadge}>当前项目</span>}
                            </div>

                            <div className={styles.metaLine}>
                              <span className={styles.metaLabel}>题材/平台</span>
                              <span className={styles.metaValue}>
                                {displayGenre}
                              </span>
                            </div>
                            <div className={styles.metaLine}>
                              <span className={styles.metaLabel}>创建时间</span>
                              <span className={styles.metaValue}>{toDateText(project.createdAt)}</span>
                            </div>
                          </div>

                          <div className={styles.actions}>
                            <button type="button" onClick={() => handleEnterCreation(project)}>
                              {isActiveProject ? '进入创作' : '切换并创作'}
                            </button>
                            {canRemoveProject && (
                              <button type="button" onClick={() => onRemoveProject(project)}>
                                删除
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <PaginationBar
                  totalItems={remoteTotal}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={(page) => (typeof onPageChange === 'function' ? onPageChange(page) : null)}
                  onPageSizeChange={(nextPageSize) =>
                    typeof onPageSizeChange === 'function'
                      ? onPageSizeChange(nextPageSize || PROJECTS_PER_PAGE)
                      : null
                  }
                  pageSizeAriaLabel="\u6bcf\u9875\u6761\u6570"
                  summaryText={`\u5171${remoteTotal}\u6761`}
                />
              </>
            )}
          </div>
        </div>

        <input
          ref={coverUploadInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleCoverUpload}
        />
      </section>
    </div>
  );
}

export default ProjectManagementPage;
