import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { pointsApi, projectApi, userApi } from './api';
import LoginPage from './components/auth/LoginPage';
import TeamSelectModal from './components/auth/TeamSelectModal';
import AppShell from './components/layout/AppShell';
import CanvasProjectsPage from './pages/CanvasProjectsPage';
import CreationPage from './pages/CreationPage';
import WorkflowPage from './pages/WorkflowPage';
import AssetLibraryPage from './pages/AssetLibraryPage';
import UserManagementPage from './pages/UserManagementPage';
import ProjectManagementPage from './pages/ProjectManagementPage';
import { MENU_ITEMS } from './constants/models';
import { useStudioState } from './hooks/useStudioState';
import { parseApiErrorMessage } from './utils/projectAdapter';
import { fetchLatestProjectSnapshot } from './utils/projectRemoteSync';
import styles from './App.module.less';

const TOKEN_STORAGE_KEY = 'token';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';
const ACCOUNT_STORAGE_KEY = 'account';
const TEAM_STORAGE_KEY = 'teamId';
const TEAM_LIST_STORAGE_KEY = 'teamList';
const STUDIO_STATE_STORAGE_KEY = 'ai-animedrama:studio-state:v1';
const STUDIO_PROJECT_ID_INDEX_STORAGE_KEY = 'ai-animedrama:project-id-index:v1';
const DEFAULT_ACCOUNT = 'demo@studio.ai';
const PROJECT_LIST_PAGE_SIZE = 8;
const PROJECT_LIST_CACHE_TTL_MS = 3000;
const PROJECT_MANAGEMENT_GENRE = 'comic';
const MESSAGE_HIDE_DURATION_MS = 3000;
const projectListCache = new Map();

const MENU_ROUTE_MAP = {
  creation: '/home',
  assets: '/assets',
  users: '/users',
  projects: '/projects',
};

function createDefaultConfirmDialogState() {
  return {
    open: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消',
    hideCancel: false,
    onConfirm: null,
  };
}

function buildProjectListCacheKey(token, teamId, page, pageSize, projectGenre) {
  return `${token || ''}:${teamId || ''}:${projectGenre || ''}:${page || 1}:${pageSize || PROJECT_LIST_PAGE_SIZE}`;
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

async function fetchProjectListWithCache(token, teamId, page, pageSize, projectGenre, force = false) {
  const cacheKey = buildProjectListCacheKey(token, teamId, page, pageSize, projectGenre);
  const now = Date.now();
  const cached = projectListCache.get(cacheKey);

  if (!force && cached?.data && now - cached.fetchedAt <= PROJECT_LIST_CACHE_TTL_MS) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const requestPromise = projectApi.getProjects(page, pageSize, {
    project_genre: projectGenre,
  })
    .then((response) => {
      const projects = normalizeProjectPageResponse(response);
      projectListCache.set(cacheKey, {
        data: projects,
        fetchedAt: Date.now(),
        promise: null,
      });
      return projects;
    })
    .catch((error) => {
      const latest = projectListCache.get(cacheKey);
      if (latest?.promise === requestPromise) {
        projectListCache.delete(cacheKey);
      }
      throw error;
    });

  projectListCache.set(cacheKey, {
    data: cached?.data || null,
    fetchedAt: cached?.fetchedAt || 0,
    promise: requestPromise,
  });

  return requestPromise;
}

function normalizeTeamId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeProjectIdentity(value) {
  const text = String(value ?? '').trim();
  return text || '';
}

function normalizePointsNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveAvailablePoints(wallet) {
  if (!wallet || typeof wallet !== 'object') {
    return null;
  }

  const balancePoints = normalizePointsNumber(wallet.balancePoints ?? wallet.balance_points);
  if (resolveIsMainAccount(wallet)) {
    return balancePoints;
  }

  const availableQuotaPoints = normalizePointsNumber(
    wallet.availableQuotaPoints ?? wallet.available_quota_points,
  );
  if (availableQuotaPoints == null) {
    return balancePoints;
  }

  if (balancePoints == null) {
    return availableQuotaPoints;
  }

  return Math.max(0, Math.min(balancePoints, availableQuotaPoints));
}

function resolveIsMainAccount(wallet) {
  const value = wallet?.isMainAccount ?? wallet?.is_main_account;
  return value === true || String(value).trim().toLowerCase() === 'true';
}

function formatPoints(value) {
  const parsed = normalizePointsNumber(value);
  if (parsed == null) {
    return '--';
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function clearLocalProjectDataFromLocalStorage() {
  try {
    const rawStudioState = localStorage.getItem(STUDIO_STATE_STORAGE_KEY);
    if (!rawStudioState) {
      return;
    }

    const parsedStudioState = JSON.parse(rawStudioState);
    if (!parsedStudioState || typeof parsedStudioState !== 'object') {
      localStorage.removeItem(STUDIO_STATE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      STUDIO_STATE_STORAGE_KEY,
      JSON.stringify({
        ...parsedStudioState,
        projects: [],
        activeProjectId: '',
      }),
    );
  } catch {
    localStorage.removeItem(STUDIO_STATE_STORAGE_KEY);
  } finally {
    try {
      localStorage.removeItem(STUDIO_PROJECT_ID_INDEX_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
}

function clearAppLocalCacheFromStorage() {
  const removableKeys = new Set([
    TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    ACCOUNT_STORAGE_KEY,
    TEAM_STORAGE_KEY,
    TEAM_LIST_STORAGE_KEY,
  ]);

  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (removableKeys.has(key) || key.startsWith('ai-animedrama:')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    removableKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore storage failures.
      }
    });

    try {
      localStorage.removeItem(STUDIO_STATE_STORAGE_KEY);
      localStorage.removeItem(STUDIO_PROJECT_ID_INDEX_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
}

function normalizeTeamList(teams) {
  if (!Array.isArray(teams)) {
    return [];
  }

  return teams.reduce((accumulator, team) => {
    const teamId = normalizeTeamId(team?.id);
    if (!teamId) {
      return accumulator;
    }

    const rawMemberCount = team?.memberCount ?? team?.member_count;
    const parsedMemberCount = Number(rawMemberCount);

    accumulator.push({
      id: teamId,
      name: String(team?.name || `团队 ${teamId}`),
      memberCount: Number.isFinite(parsedMemberCount) && parsedMemberCount > 0 ? parsedMemberCount : null,
    });

    return accumulator;
  }, []);
}

function loadTeamListFromStorage() {
  try {
    const raw = localStorage.getItem(TEAM_LIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return normalizeTeamList(JSON.parse(raw));
  } catch {
    return [];
  }
}

function resolveActiveMenu(pathname) {
  if (pathname === '/home' || pathname === '/creation' || pathname === '/workflow' || pathname === '/canvas-projects') {
    return 'creation';
  }

  if (pathname.startsWith('/assets')) {
    return 'assets';
  }

  if (pathname.startsWith('/users')) {
    return 'users';
  }

  if (pathname.startsWith('/projects')) {
    return 'projects';
  }

  return 'creation';
}

// 应用根组件：负责登录鉴权、路由守卫和一级功能页面渲染。
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const studio = useStudioState();

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(ACCOUNT_STORAGE_KEY) || DEFAULT_ACCOUNT);
  const [currentTeamId, setCurrentTeamId] = useState(() => normalizeTeamId(localStorage.getItem(TEAM_STORAGE_KEY)));
  const [teamOptions, setTeamOptions] = useState(() => loadTeamListFromStorage());

  const [pendingLogin, setPendingLogin] = useState(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(() => normalizeTeamId(localStorage.getItem(TEAM_STORAGE_KEY)));
  const [loginLoading, setLoginLoading] = useState(false);
  const [teamConfirmLoading, setTeamConfirmLoading] = useState(false);
  const [pointsWallet, setPointsWallet] = useState(null);
  const [pointsWalletLoading, setPointsWalletLoading] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState([]);
  const [projectListPage, setProjectListPage] = useState(1);
  const [projectListPageSize, setProjectListPageSize] = useState(PROJECT_LIST_PAGE_SIZE);
  const [projectListTotal, setProjectListTotal] = useState(0);
  const [projectListLoading, setProjectListLoading] = useState(false);
  const [projectListError, setProjectListError] = useState('');
  const [messageState, setMessageState] = useState({
    visible: false,
    text: '',
    type: 'info',
    sequence: 0,
  });
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialogState);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const messageTimerRef = useRef(0);
  const messageSequenceRef = useRef(0);

  const activeMenu = resolveActiveMenu(location.pathname);
  const currentTeamName = useMemo(
    () => teamOptions.find((team) => team.id === currentTeamId)?.name || teamOptions[0]?.name || '默认团队',
    [currentTeamId, teamOptions],
  );
  const activeBackendProjectId = studio.activeProject?.backendProjectId || '';
  const projectManagementProjects = useMemo(
    () =>
      (remoteProjects || []).map((projectItem, index) => ({
        id: normalizeProjectIdentity(projectItem?.id) || `project-${index + 1}`,
        backendProjectId: normalizeProjectIdentity(projectItem?.id),
        name: String(projectItem?.project_name || '').trim() || `Project ${index + 1}`,
        genre: String(projectItem?.project_type || '').trim() || '',
        targetPlatform: String(projectItem?.target_platform || '').trim() || '',
        coverUrl: String(projectItem?.cover_url || projectItem?.cover || '').trim() || '',
        parseStatus: String(projectItem?.analysis_status || projectItem?.parse_status || 'idle'),
        episodeCount: Number(projectItem?.episode_count) || 0,
        characterCount: Number(projectItem?.character_count) || 0,
        sceneCount: Number(projectItem?.scene_count) || 0,
        createdAt: projectItem?.created_at || '',
        updatedAt: projectItem?.updated_at || projectItem?.created_at || '',
      })),
    [remoteProjects],
  );

  useEffect(() => {
    if (token || pendingLogin) {
      return;
    }

    setPointsWallet(null);
    setPointsWalletLoading(false);
    setRemoteProjects([]);
    setProjectListPage(1);
    setProjectListPageSize(PROJECT_LIST_PAGE_SIZE);
    setProjectListTotal(0);
    setProjectListLoading(false);
    setProjectListError('');
  }, [token, pendingLogin]);

  function clearMessageTimer() {
    if (!messageTimerRef.current) {
      return;
    }

    window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = 0;
  }

  function showMessage(text, type = 'info') {
    if (!text) {
      return;
    }

    clearMessageTimer();
    const sequence = messageSequenceRef.current + 1;
    messageSequenceRef.current = sequence;
    setMessageState({
      visible: true,
      text,
      type,
      sequence,
    });
    messageTimerRef.current = window.setTimeout(() => {
      setMessageState((current) =>
        current.sequence === sequence
          ? {
              ...current,
              visible: false,
            }
          : current,
      );
      messageTimerRef.current = 0;
    }, MESSAGE_HIDE_DURATION_MS);
  }

  function openConfirmDialog(options) {
    setConfirmLoading(false);
    setConfirmDialog({
      open: true,
      title: options.title || '提示',
      content: options.content || '',
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      hideCancel: options.hideCancel === true,
      onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null,
    });
  }

  function showNoticeDialog(content, title = '提示') {
    if (!content) {
      return;
    }

    if (location.pathname === '/login') {
      const messageType = title.includes('失败') ? 'error' : 'warning';
      showMessage(content, messageType);
      return;
    }

    openConfirmDialog({
      title,
      content,
      confirmText: '确定',
      hideCancel: true,
    });
  }

  function persistLoginSession({
    accessToken,
    refreshToken,
    account,
    teamId,
    teams,
  }) {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
    localStorage.setItem(ACCOUNT_STORAGE_KEY, account || DEFAULT_ACCOUNT);
    localStorage.setItem(TEAM_STORAGE_KEY, String(teamId));
    localStorage.setItem(TEAM_LIST_STORAGE_KEY, JSON.stringify(teams || []));
    projectListCache.clear();

    setToken(accessToken);
    setCurrentUser(account || DEFAULT_ACCOUNT);
    setCurrentTeamId(teamId);
    setTeamOptions(teams || []);
    setSelectedTeamId(teamId);
    setPendingLogin(null);
    setTeamModalOpen(false);
    navigate('/home', { replace: true });
  }

  function closeConfirmDialog() {
    if (confirmLoading) {
      return;
    }

    setConfirmLoading(false);
    setConfirmDialog(createDefaultConfirmDialogState());
  }

  async function handleConfirmDialogConfirm() {
    if (confirmLoading) {
      return;
    }

    const action = confirmDialog.onConfirm;
    if (!action) {
      closeConfirmDialog();
      return;
    }

    setConfirmLoading(true);
    try {
      await action();
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '操作失败'), 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmDialog(createDefaultConfirmDialogState());
    }
  }

  useEffect(
    () => () => {
      clearMessageTimer();
    },
    [],
  );

  async function refreshPointsWallet() {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
      setPointsWallet(null);
      setPointsWalletLoading(false);
      return null;
    }

    setPointsWalletLoading(true);
    try {
      const wallet = await pointsApi.getWallet();
      setPointsWallet(wallet || null);
      return wallet || null;
    } catch {
      setPointsWallet(null);
      return null;
    } finally {
      setPointsWalletLoading(false);
    }
  }

  async function refreshMainAvailablePoints() {
    const wallet = await refreshPointsWallet();
    if (!resolveIsMainAccount(wallet)) {
      return null;
    }

    return resolveAvailablePoints(wallet);
  }

  useEffect(() => {
    if (!token) {
      setPointsWallet(null);
      setPointsWalletLoading(false);
      return undefined;
    }

    let ignored = false;
    setPointsWalletLoading(true);

    pointsApi.getWallet()
      .then((wallet) => {
        if (!ignored) {
          setPointsWallet(wallet || null);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPointsWallet(null);
        }
      })
      .finally(() => {
        if (!ignored) {
          setPointsWalletLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [token, currentTeamId]);

  async function refreshProjectList(options = {}) {
    if (!token) {
      setRemoteProjects([]);
      setProjectListTotal(0);
      setProjectListLoading(false);
      setProjectListError('');
      return;
    }

    const force = options.force === true;
    const page = Number(options.page) > 0 ? Number(options.page) : projectListPage;
    const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : projectListPageSize;
    const onFailMessage = options.onFailMessage || '项目列表加载失败，请稍后重试';

    setProjectListLoading(true);
    setProjectListError('');

    try {
      const latestProjects = await fetchProjectListWithCache(
        token,
        currentTeamId,
        page,
        pageSize,
        PROJECT_MANAGEMENT_GENRE,
        force,
      );
      setProjectListPage(page);
      setProjectListPageSize(pageSize);
      setRemoteProjects(Array.isArray(latestProjects?.items) ? latestProjects.items : []);
      setProjectListTotal(Number(latestProjects?.total) || 0);
    } catch (error) {
      setRemoteProjects([]);
      setProjectListTotal(0);
      setProjectListError(parseApiErrorMessage(error, onFailMessage));
    } finally {
      setProjectListLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !location.pathname.startsWith('/projects')) {
      return;
    }

    refreshProjectList({
      force: false,
      page: projectListPage,
      pageSize: projectListPageSize,
    });
    // `refreshProjectList` intentionally not in deps to keep trigger conditions explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentTeamId, location.pathname, projectListPage, projectListPageSize]);

  // 第一步：调用真实登录接口，拉取 token 与团队列表。
  async function handleLogin({ account, password }) {
    const safeAccount = account.trim();
    const safePassword = password.trim();

    if (!safeAccount && !safePassword) {
      showMessage('请输入用户名和密码', 'warning');
      return;
    }

    if (!safeAccount) {
      showMessage('请输入用户名', 'warning');
      return;
    }

    if (!safePassword) {
      showMessage('请输入密码', 'warning');
      return;
    }

    if (loginLoading) {
      return;
    }

    setLoginLoading(true);

    try {
      const loginResponse = await userApi.login({
        username: safeAccount,
        password: safePassword,
      });

      if (!loginResponse?.access_token) {
        throw new Error('登录失败：接口未返回 access_token');
      }

      const teams = normalizeTeamList(loginResponse.teams);
      const defaultTeamId = normalizeTeamId(loginResponse.current_team_id) || teams[0]?.id || null;
      const accountName = String(loginResponse?.user?.username || safeAccount);
      const accessToken = String(loginResponse.access_token || '');
      const refreshToken = String(loginResponse.refresh_token || '');

      if (!defaultTeamId) {
        throw new Error('登录失败：当前账号未加入任何团队');
      }

      // Team selection is temporarily bypassed. Main and sub accounts both
      // enter the backend-selected team immediately after authentication.
      persistLoginSession({
        account: accountName,
        accessToken,
        refreshToken,
        teamId: defaultTeamId,
        teams,
      });
    } catch (error) {
      showNoticeDialog(parseApiErrorMessage(error, '登录失败，请检查账号或密码'), '登录失败');
    } finally {
      setLoginLoading(false);
    }
  }

  // 第二步：确认团队，必要时调用 team/select 获取对应团队 access_token。
  async function confirmTeamSelection() {
    if (!pendingLogin) {
      setTeamModalOpen(false);
      return;
    }

    if (!selectedTeamId) {
      showNoticeDialog('请选择团队');
      return;
    }

    if (teamConfirmLoading) {
      return;
    }

    setTeamConfirmLoading(true);

    try {
      let finalAccessToken = pendingLogin.accessToken;
      if (selectedTeamId !== pendingLogin.currentTeamId) {
        const selected = await userApi.selectTeam(selectedTeamId, pendingLogin.accessToken);
        finalAccessToken = String(selected?.access_token || '');
      }

      if (!finalAccessToken) {
        throw new Error('进入团队失败：未获取到有效 access_token');
      }

      persistLoginSession({
        account: pendingLogin.account,
        accessToken: finalAccessToken,
        refreshToken: pendingLogin.refreshToken,
        teamId: selectedTeamId,
        teams: pendingLogin.teams,
      });
    } catch (error) {
      showNoticeDialog(parseApiErrorMessage(error, '进入团队失败，请稍后重试'), '进入团队失败');
    } finally {
      setTeamConfirmLoading(false);
    }
  }

  function closeTeamSelection() {
    setTeamModalOpen(false);
    setPendingLogin(null);
  }

  async function logout() {
    try {
      if (token) {
        await userApi.logout();
      }
    } catch {
      // Logout API failure should not block local sign-out.
    }

    studio.clearStudioState();
    clearAppLocalCacheFromStorage();
    projectListCache.clear();

    setToken('');
    setCurrentUser(DEFAULT_ACCOUNT);
    setCurrentTeamId(null);
    setTeamOptions([]);
    setSelectedTeamId(null);
    setPendingLogin(null);
    setTeamModalOpen(false);
    setRemoteProjects([]);
    setProjectListLoading(false);
    setProjectListError('');
    navigate('/login', { replace: true });
  }

  function handleMenuChange(nextMenu) {
    const targetRoute = MENU_ROUTE_MAP[nextMenu] || '/home';
    navigate(targetRoute);
  }

  async function openProjectInCreation(projectIdOrBackendId) {
    const targetId = normalizeProjectIdentity(projectIdOrBackendId);
    if (!targetId) {
      return;
    }

    const matchedLocalProject = studio.projects.find(
      (project) =>
        normalizeProjectIdentity(project?.id) === targetId ||
        normalizeProjectIdentity(project?.backendProjectId) === targetId,
    );
    if (matchedLocalProject?.id) {
      studio.switchProject(matchedLocalProject.id);
      navigate('/creation');
      return;
    }

    try {
      const latestProject = await fetchLatestProjectSnapshot(targetId, null, {
        includeAnalysis: true,
      });
      if (!latestProject) {
        throw new Error('项目加载失败：接口未返回有效数据');
      }

      studio.upsertProject(latestProject, {
        setActive: true,
      });
      navigate('/creation');
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '加载项目失败，请稍后重试'), 'error');
    }
  }

  function openCanvasProject(project) {
    const backendProjectId = normalizeProjectIdentity(project?.backendProjectId || project?.id);
    if (!backendProjectId) {
      return;
    }

    studio.upsertProject(
      {
        id: normalizeProjectIdentity(project?.id) || backendProjectId,
        backendProjectId,
        name: String(project?.name || '').trim() || '未命名',
        projectType: 'canvas',
      },
      {
        setActive: true,
      },
    );
    navigate('/workflow');
  }

  async function removeProjectFromManagement(project) {
    const targetProject =
      project && typeof project === 'object'
        ? project
        : projectManagementProjects.find(
            (item) => item.id === project || item.backendProjectId === project,
          );
    if (!targetProject) {
      return;
    }

    const targetName = String(targetProject.name || '').trim() || '未命名项目';
    const backendProjectId = normalizeProjectIdentity(targetProject.backendProjectId);
    const localProjectIds = (studio.projects || [])
      .map((item) => normalizeProjectIdentity(item?.id))
      .filter(Boolean);

    openConfirmDialog({
      title: '删除项目',
      content: `确认删除项目「${targetName}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
      cancelText: '取消',
      onConfirm: async () => {
        if (backendProjectId) {
          await projectApi.deleteProject(backendProjectId);
          projectListCache.clear();
          await refreshProjectList({
            force: true,
            page: projectListPage,
            pageSize: projectListPageSize,
            onFailMessage: '项目删除成功，但列表刷新失败，请手动重试',
          });
        }

        localProjectIds.forEach((localProjectId) => {
          studio.removeProject(localProjectId);
        });
        clearLocalProjectDataFromLocalStorage();

        showMessage('项目已删除', 'success');
      },
    });
  }

  function openCreationEntry() {
    if (!studio.activeProject) {
      studio.createProject({
        name: '',
      });
      navigate('/creation');
      return;
    }

    navigate('/home');
  }

  function renderWorkspacePage(routeType) {
    if (!token) {
      return <Navigate to="/login" replace />;
    }

    let content = null;

    if (routeType === 'assets') {
      content = <AssetLibraryPage project={studio.activeProject} />;
    } else if (routeType === 'users') {
      content = (
        <UserManagementPage
          teamId={currentTeamId}
          canInviteMembers={isMainAccount}
          canManagePointsQuota={isMainAccount}
          mainAvailablePoints={availablePointsValue}
          pointsWalletLoading={pointsWalletLoading}
          onRefreshMainAvailablePoints={refreshMainAvailablePoints}
          onNotify={showMessage}
        />
      );
    } else if (routeType === 'projects') {
      content = (
        <ProjectManagementPage
          projects={projectManagementProjects}
          total={projectListTotal}
          currentPage={projectListPage}
          pageSize={projectListPageSize}
          activeProjectId={studio.activeProjectId}
          activeBackendProjectId={activeBackendProjectId}
          onEnterCreation={openProjectInCreation}
          onRequestCreateProject={openCreationEntry}
          onUpdateProject={studio.updateProjectById}
          onRemoveProject={removeProjectFromManagement}
          onPageChange={(page) =>
            refreshProjectList({
              page,
              pageSize: projectListPageSize,
            })
          }
          onPageSizeChange={(pageSize) =>
            refreshProjectList({
              page: 1,
              pageSize,
            })
          }
          onNotify={showMessage}
          loading={projectListLoading}
          errorMessage={projectListError}
          onRetryLoad={() =>
            refreshProjectList({
              force: true,
              page: projectListPage,
              pageSize: projectListPageSize,
            })
          }
        />
      );
    } else {
      const isCreationRoute = routeType === 'creation';
      content = (
        <CreationPage
          key={isCreationRoute ? 'creation-route' : 'home-route'}
          projects={studio.projects}
          activeProject={studio.activeProject}
          activeProjectId={studio.activeProjectId}
          onSwitchProject={studio.switchProject}
          onCreateProject={studio.createProject}
          onUpdateProject={studio.updateActiveProject}
          routeMode
          initialViewMode={isCreationRoute ? 'workflow' : 'home'}
          onRequestHome={() => navigate('/home')}
          onRequestCreation={() => navigate('/creation')}
          onRequestWorkflow={() => navigate('/canvas-projects')}
          onPointsChanged={refreshPointsWallet}
          availablePoints={availablePointsText}
        />
      );
    }

    return (
      <div className={styles.workspaceView}>
        <AppShell
          menuItems={MENU_ITEMS}
          activeMenu={activeMenu}
          onMenuChange={handleMenuChange}
          currentUser={currentUser || DEFAULT_ACCOUNT}
          teamName={currentTeamName}
          availablePoints={availablePointsText}
          onLogout={logout}
          hideNavigation={routeType === 'creation'}
        >
          {content}
        </AppShell>
      </div>
    );
  }

  function renderWorkflowRoute() {
    if (!token) {
      return <Navigate to="/login" replace />;
    }

    return (
      <WorkflowPage
        activeProject={studio.activeProject}
        onBackHome={() => navigate('/canvas-projects')}
        onEnterCreation={() => navigate('/creation')}
        onCanvasProjectReady={(project) => {
          studio.upsertProject(project, {
            setActive: true,
          });
        }}
        onProjectNameChange={(name) => {
          studio.updateActiveProject((project) => ({
            ...project,
            name,
          }));
          projectListCache.clear();
        }}
        onPointsChanged={refreshPointsWallet}
        availablePoints={availablePointsText}
      />
    );
  }

  function renderCanvasProjectsRoute() {
    if (!token) {
      return <Navigate to="/login" replace />;
    }

    return (
      <CanvasProjectsPage
        onBack={() => navigate('/home')}
        onOpenProject={openCanvasProject}
        onProjectCreated={(project) => {
          studio.upsertProject(project, {
            setActive: true,
          });
          projectListCache.clear();
        }}
        onNotify={showMessage}
      />
    );
  }

  const defaultRoute = token ? '/home' : '/login';
  const messageTypeClassMap = {
    info: styles.messageInfo,
    success: styles.messageSuccess,
    warning: styles.messageWarning,
    error: styles.messageError,
  };
  const currentMessageClass = messageTypeClassMap[messageState.type] || styles.messageInfo;
  const loginMessageClass = location.pathname === '/login' ? styles.loginTopMessage : '';
  const availablePointsValue = resolveAvailablePoints(pointsWallet);
  const isMainAccount = resolveIsMainAccount(pointsWallet);
  const availablePointsText = pointsWalletLoading
    ? '加载中'
    : formatPoints(availablePointsValue);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/home" replace />
            ) : (
              <div className={styles.authView}>
                <LoginPage onLogin={handleLogin} loading={loginLoading} />
                <TeamSelectModal
                  open={teamModalOpen}
                  teams={teamOptions}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={setSelectedTeamId}
                  onConfirm={confirmTeamSelection}
                  onClose={closeTeamSelection}
                  confirmLoading={teamConfirmLoading}
                />
              </div>
            )
          }
        />
        <Route path="/home" element={renderWorkspacePage('home')} />
        <Route path="/creation" element={renderWorkspacePage('creation')} />
        <Route path="/workflow" element={renderWorkflowRoute()} />
        <Route path="/canvas-projects" element={renderCanvasProjectsRoute()} />
        <Route path="/assets" element={renderWorkspacePage('assets')} />
        <Route path="/users" element={renderWorkspacePage('users')} />
        <Route path="/projects" element={renderWorkspacePage('projects')} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>

      {messageState.visible && (
        <div
          className={`${styles.topMessage} ${currentMessageClass} ${loginMessageClass}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {messageState.text}
        </div>
      )}

      {confirmDialog.open && (
        <div className={styles.confirmMask} role="dialog" aria-modal="true" aria-label={confirmDialog.title}>
          <div className={styles.confirmDialog}>
            <h4 className={styles.confirmTitle}>{confirmDialog.title}</h4>
            <p className={styles.confirmContent}>{confirmDialog.content}</p>
            <div className={styles.confirmActions}>
              {!confirmDialog.hideCancel && (
                <button
                  className={styles.confirmCancelButton}
                  type="button"
                  onClick={closeConfirmDialog}
                  disabled={confirmLoading}
                >
                  {confirmDialog.cancelText}
                </button>
              )}
              <button
                className={styles.confirmPrimaryButton}
                type="button"
                onClick={handleConfirmDialogConfirm}
                disabled={confirmLoading}
              >
                {confirmLoading ? '处理中...' : confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
