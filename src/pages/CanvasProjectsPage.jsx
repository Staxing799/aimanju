import { useEffect, useMemo, useRef, useState } from 'react';
import { freeCanvasApi, projectApi } from '../api';
import PaginationBar from '../components/common/PaginationBar';
import {
  createFreeCanvasUntitledName,
  loadFreeCanvasRenameMap,
  normalizeFreeCanvasProjectName,
  saveFreeCanvasRenameMap,
} from '../utils/freeCanvasProjectNames';
import { parseApiErrorMessage } from '../utils/projectAdapter';
import styles from './CanvasProjectsPage.module.less';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 100];
const DEFAULT_PAGE_SIZE = 20;
const CANVAS_PROJECT_GENRE = 'canvas';

function normalizeProjectId(value) {
  return String(value ?? '').trim();
}

function isCanvasProject(item) {
  const typeText = String(
    item?.project_genre ??
      item?.project_type ??
      item?.genre ??
      item?.type ??
      item?.entry_type ??
      '',
  ).toLowerCase();
  return typeText.includes('canvas') || typeText.includes('free-canvas');
}

function toDateText(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function normalizeProjectItem(item, index, renameMap) {
  const id = normalizeProjectId(item?.id ?? item?.project_id ?? item?.projectId);
  const createdAt = item?.created_at || item?.createdAt || '';
  const fallbackName =
    normalizeFreeCanvasProjectName(item?.project_name ?? item?.name) ||
    createFreeCanvasUntitledName(createdAt);

  return {
    id: id || `canvas-${index + 1}`,
    backendProjectId: id,
    name: renameMap[id] || fallbackName,
    createdAt,
    updatedAt: item?.updated_at || item?.updatedAt || item?.created_at || '',
    coverUrl: String(item?.cover_url || item?.cover || '').trim(),
    raw: item,
  };
}

function normalizeProjectPageResponse(response) {
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

function CanvasProjectsPage({
  onBack,
  onOpenProject,
  onProjectCreated,
  onNotify,
}) {
  const menuRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [openMenuProjectId, setOpenMenuProjectId] = useState('');
  const [renameMap, setRenameMap] = useState(() => loadFreeCanvasRenameMap());
  const [renameDialog, setRenameDialog] = useState({
    open: false,
    project: null,
    value: '',
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    project: null,
  });
  const [busyProjectId, setBusyProjectId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function loadProjects() {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await projectApi.getProjects(page, pageSize, {
        project_genre: CANVAS_PROJECT_GENRE,
      });
      const projectPage = normalizeProjectPageResponse(response);
      const items = projectPage.items
        .filter(isCanvasProject)
        .map((item, index) => normalizeProjectItem(item, index, renameMap))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      setProjects(items);
      setTotalItems(projectPage.total);
    } catch (error) {
      setProjects([]);
      setTotalItems(0);
      setErrorMessage(parseApiErrorMessage(error, '画布项目加载失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // Request params are intentionally tied to the pagination controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    function handleDocumentPointerDown(event) {
      if (!menuRef.current || menuRef.current.contains(event.target)) {
        return;
      }
      setOpenMenuProjectId('');
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleProjects = useMemo(() => projects, [projects]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  function notify(text, type = 'info') {
    if (typeof onNotify === 'function') {
      onNotify(text, type);
    }
  }

  async function createProject() {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const createdAt = new Date().toISOString();
      const projectName = createFreeCanvasUntitledName(createdAt);
      const created = await freeCanvasApi.createProject({
        project_name: projectName,
        description: '',
      });
      const projectId = normalizeProjectId(created?.project_id ?? created?.projectId ?? created?.canvas_id);
      const project = {
        id: projectId,
        backendProjectId: projectId,
        name: projectName,
        projectType: 'canvas',
        createdAt,
      };
      if (typeof onProjectCreated === 'function') {
        onProjectCreated(project);
      }
      if (typeof onOpenProject === 'function') {
        onOpenProject(project);
      }
    } catch (error) {
      notify(parseApiErrorMessage(error, '创建画布项目失败'), 'error');
    } finally {
      setIsCreating(false);
    }
  }

  function openRenameDialog(project) {
    setOpenMenuProjectId('');
    setRenameDialog({
      open: true,
      project,
      value: project?.name || '',
    });
  }

  function closeRenameDialog() {
    setRenameDialog({
      open: false,
      project: null,
      value: '',
    });
  }

  function confirmRename() {
    const projectId = normalizeProjectId(renameDialog.project?.backendProjectId || renameDialog.project?.id);
    const nextName = renameDialog.value.trim();
    if (!projectId || !nextName) {
      return;
    }

    const nextRenameMap = {
      ...renameMap,
      [projectId]: nextName,
    };
    saveFreeCanvasRenameMap(nextRenameMap);
    setRenameMap(nextRenameMap);
    setProjects((current) =>
      current.map((project) => (project.backendProjectId === projectId ? { ...project, name: nextName } : project)),
    );
    closeRenameDialog();
    notify('项目已重命名', 'success');
  }

  function openDeleteDialog(project) {
    setOpenMenuProjectId('');
    setDeleteDialog({
      open: true,
      project,
    });
  }

  function closeDeleteDialog() {
    if (busyProjectId) {
      return;
    }

    setDeleteDialog({
      open: false,
      project: null,
    });
  }

  async function confirmDelete() {
    const project = deleteDialog.project;
    const projectId = normalizeProjectId(project?.backendProjectId || project?.id);
    if (!projectId || busyProjectId) {
      return;
    }

    setBusyProjectId(projectId);
    try {
      await freeCanvasApi.deleteProject(projectId);
      setProjects((current) => current.filter((item) => item.backendProjectId !== projectId && item.id !== projectId));
      const nextTotalItems = Math.max(0, totalItems - 1);
      setTotalItems(nextTotalItems);
      const nextRenameMap = { ...renameMap };
      delete nextRenameMap[projectId];
      saveFreeCanvasRenameMap(nextRenameMap);
      setRenameMap(nextRenameMap);
      setDeleteDialog({
        open: false,
        project: null,
      });
      notify('项目已删除', 'success');
      const nextTotalPages = Math.max(1, Math.ceil(nextTotalItems / pageSize));
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
      } else {
        loadProjects();
      }
    } catch (error) {
      notify(parseApiErrorMessage(error, '删除画布项目失败'), 'error');
    } finally {
      setBusyProjectId('');
    }
  }

  function handleOpenProject(project) {
    if (typeof onOpenProject === 'function') {
      onOpenProject({
        ...project,
        id: project.id,
        backendProjectId: project.backendProjectId,
        projectType: 'canvas',
      });
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          <span className={styles.backIcon} aria-hidden />
          <span className={styles.backText}>返回</span>
        </button>
        <span className={styles.divider} aria-hidden />
        <h1>全部项目</h1>
      </header>

      <section className={styles.projectGrid} aria-label="自由画布项目列表">
        <button
          className={`${styles.card} ${styles.createCard}`}
          type="button"
          onClick={createProject}
          disabled={isCreating}
        >
          <span className={styles.createPlus} aria-hidden>
            +
          </span>
          <strong>{isCreating ? '创建中...' : '开始创作'}</strong>
          <small>创建新的视频项目</small>
        </button>

        {errorMessage ? (
          <div className={styles.statePanel}>
            <span>{errorMessage}</span>
            <button type="button" onClick={loadProjects}>重新加载</button>
          </div>
        ) : (
          visibleProjects.map((project) => {
            const isBusy = busyProjectId === project.backendProjectId;
            return (
              <article key={project.id} className={styles.projectCard}>
                <button
                  className={styles.projectPreview}
                  type="button"
                  onClick={() => handleOpenProject(project)}
                  aria-label={`进入项目 ${project.name}`}
                  disabled={isBusy}
                >
                  {project.coverUrl ? (
                    <img src={project.coverUrl} alt="" />
                  ) : (
                    <span className={styles.placeholderIcon} aria-hidden />
                  )}
                </button>

                <div className={styles.projectInfo}>
                  <div className={styles.projectTitleRow}>
                    <div className={styles.projectTitle} title={project.name || '未命名'}>
                      {project.name || '未命名'}
                    </div>
                    <div className={styles.cardMenuWrap} ref={openMenuProjectId === project.id ? menuRef : null}>
                      <button
                        className={styles.menuButton}
                        type="button"
                        aria-label={`${project.name || '项目'} 更多操作`}
                        aria-expanded={openMenuProjectId === project.id}
                        onClick={() => setOpenMenuProjectId((current) => (current === project.id ? '' : project.id))}
                        disabled={isBusy}
                      />
                      {openMenuProjectId === project.id && (
                        <div className={styles.actionMenu} role="menu">
                          <button type="button" role="menuitem" onClick={() => openRenameDialog(project)}>
                            重命名
                          </button>
                          <button type="button" role="menuitem" onClick={() => openDeleteDialog(project)}>
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <span>{toDateText(project.createdAt || project.updatedAt)}</span>
                </div>
              </article>
            );
          })
        )}
      </section>

      {totalItems > 0 && (
        <div className={styles.paginationDock}>
          <PaginationBar
            totalItems={totalItems}
            currentPage={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize || DEFAULT_PAGE_SIZE);
              setPage(1);
            }}
            disabled={loading}
            pageSizeAriaLabel="每页项目数量"
            summaryText={`共${totalItems}个项目`}
          />
        </div>
      )}

      {loading && (
        <div className={styles.loadingOverlay} role="status" aria-live="polite" aria-label="项目加载中">
          <div className={styles.loadingCard}>
            <span className={styles.loadingSpinner} aria-hidden />
            <strong>项目加载中...</strong>
          </div>
        </div>
      )}

      {renameDialog.open && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={closeRenameDialog}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="重命名项目" onMouseDown={(event) => event.stopPropagation()}>
            <h2>重命名项目</h2>
            <input
              value={renameDialog.value}
              onChange={(event) => setRenameDialog((current) => ({ ...current, value: event.target.value }))}
              autoFocus
              maxLength={128}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  confirmRename();
                }
              }}
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={closeRenameDialog}>取消</button>
              <button type="button" onClick={confirmRename} disabled={!renameDialog.value.trim()}>确定</button>
            </div>
          </section>
        </div>
      )}

      {deleteDialog.open && (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={closeDeleteDialog}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="删除项目" onMouseDown={(event) => event.stopPropagation()}>
            <h2>删除项目</h2>
            <p>确定删除“{deleteDialog.project?.name || '未命名'}”吗？删除后不可恢复。</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={closeDeleteDialog} disabled={Boolean(busyProjectId)}>取消</button>
              <button type="button" onClick={confirmDelete} disabled={Boolean(busyProjectId)}>
                {busyProjectId ? '删除中...' : '删除'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default CanvasProjectsPage;
