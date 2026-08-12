import { configureStore } from '@reduxjs/toolkit';
import studioReducer, { createInitialStudioState } from './studioSlice';
import { createEmptyProject } from '../utils/studioGenerators';

const STUDIO_STATE_STORAGE_KEY = 'ai-animedrama:studio-state:v1';
const STUDIO_PROJECT_ID_INDEX_STORAGE_KEY = 'ai-animedrama:project-id-index:v1';
const DEFAULT_ROLE_OPTIONS = new Set([
  '创建者/管理员',
  '编剧',
  '分镜师',
  '剪辑师',
  '审核员',
  '访客',
  '自定义角色',
]);
const LEGACY_ACCOUNT_PROFILE_MAP = {
  'admin@studio.ai': { name: '陈主管', role: '创建者/管理员' },
  'writer@studio.ai': { name: '林编剧', role: '编剧' },
  'board@studio.ai': { name: '夏分镜', role: '分镜师' },
  'editor@studio.ai': { name: '顾剪辑', role: '剪辑师' },
};

function looksLikeMojibakeText(value) {
  const text = String(value || '');
  return /[\u95C4\u93CB\u6FB6\u6924\u9352\u7F02\u752F\u935B\u7D2A\u58C0\u6748]/.test(text);
}

function hasRequiredStudioShape(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.projects) &&
    typeof value.activeProjectId === 'string' &&
    Array.isArray(value.users)
  );
}

function normalizeBackendProjectId(value) {
  return String(value ?? '').trim();
}

function shouldDropTransientScriptUpload(project) {
  return Boolean(project?.scriptUploadFile) && !normalizeBackendProjectId(project?.backendProjectId);
}

function normalizeProjectsForPersistence(projects = []) {
  return projects.map((project) => {
    const shouldClearUploadDraft = shouldDropTransientScriptUpload(project);

    return {
      ...project,
      backendProjectId: normalizeBackendProjectId(project?.backendProjectId),
      scriptFileName: shouldClearUploadDraft ? '' : project?.scriptFileName || '',
      scriptText: shouldClearUploadDraft ? '' : project?.scriptText || '',
      // File is non-serializable and should not survive reloads.
      scriptUploadFile: null,
    };
  });
}

function normalizeUsersForPersistence(users = []) {
  return users.map((user) => {
    const safeUser = { ...(user || {}) };
    const account = String(safeUser.account || '').trim();
    const legacyProfile = LEGACY_ACCOUNT_PROFILE_MAP[account];
    if (!legacyProfile) {
      return safeUser;
    }

    const shouldRepairName = !safeUser.name || looksLikeMojibakeText(safeUser.name);
    const shouldRepairRole =
      !safeUser.role ||
      looksLikeMojibakeText(safeUser.role) ||
      !DEFAULT_ROLE_OPTIONS.has(String(safeUser.role));

    if (!shouldRepairName && !shouldRepairRole) {
      return safeUser;
    }

    return {
      ...safeUser,
      name: shouldRepairName ? legacyProfile.name : safeUser.name,
      role: shouldRepairRole ? legacyProfile.role : safeUser.role,
    };
  });
}

function buildBackendProjectIdIndex(projects = []) {
  return projects.reduce((accumulator, project) => {
    const backendProjectId = normalizeBackendProjectId(project?.backendProjectId);
    if (project?.id && backendProjectId) {
      accumulator[project.id] = backendProjectId;
    }
    return accumulator;
  }, {});
}

function loadBackendProjectIdIndexFromStorage() {
  try {
    const rawValue = localStorage.getItem(STUDIO_PROJECT_ID_INDEX_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce((accumulator, [projectId, backendProjectId]) => {
      if (typeof projectId !== 'string') {
        return accumulator;
      }

      const normalizedBackendProjectId = normalizeBackendProjectId(backendProjectId);
      if (!projectId || !normalizedBackendProjectId) {
        return accumulator;
      }

      accumulator[projectId] = normalizedBackendProjectId;
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function saveBackendProjectIdIndexToStorage(projects = []) {
  try {
    const backendProjectIdIndex = buildBackendProjectIdIndex(projects);
    localStorage.setItem(STUDIO_PROJECT_ID_INDEX_STORAGE_KEY, JSON.stringify(backendProjectIdIndex));
  } catch {
    // Ignore storage write failures (quota/private mode).
  }
}

function createStateFromBackendProjectIdIndex() {
  const backendProjectIdIndex = loadBackendProjectIdIndexFromStorage();
  const entries = Object.entries(backendProjectIdIndex);
  if (entries.length === 0) {
    return null;
  }

  const baseState = createInitialStudioState();
  const projects = entries.map(([localProjectId, backendProjectId], index) => ({
    ...createEmptyProject({
      name: `项目 ${index + 1}`,
    }),
    id: localProjectId,
    backendProjectId,
    scriptUploadFile: null,
  }));

  return {
    ...baseState,
    projects,
    activeProjectId: projects[0]?.id || '',
  };
}

function loadStudioStateFromStorage() {
  try {
    const rawValue = localStorage.getItem(STUDIO_STATE_STORAGE_KEY);
    if (!rawValue) {
      return createStateFromBackendProjectIdIndex();
    }

    const parsed = JSON.parse(rawValue);
    if (!hasRequiredStudioShape(parsed)) {
      return createStateFromBackendProjectIdIndex();
    }

    const backendProjectIdIndex = loadBackendProjectIdIndexFromStorage();
    const normalizedProjects = normalizeProjectsForPersistence(parsed.projects).map((project) => ({
      ...project,
      backendProjectId: normalizeBackendProjectId(
        project.backendProjectId || backendProjectIdIndex[project.id] || '',
      ),
    }));
    const normalizedUsers = normalizeUsersForPersistence(parsed.users);
    const normalizedActiveProjectId = normalizedProjects.some(
      (project) => project.id === parsed.activeProjectId,
    )
      ? parsed.activeProjectId
      : normalizedProjects[0].id || '';

    return {
      ...parsed,
      projects: normalizedProjects,
      users: normalizedUsers,
      activeProjectId: normalizedActiveProjectId,
    };
  } catch {
    return createStateFromBackendProjectIdIndex();
  }
}

function saveStudioStateToStorage(studioState) {
  try {
    const persistableState = {
      ...studioState,
      projects: normalizeProjectsForPersistence(studioState.projects || []),
      users: normalizeUsersForPersistence(studioState.users || []),
    };
    localStorage.setItem(STUDIO_STATE_STORAGE_KEY, JSON.stringify(persistableState));
    saveBackendProjectIdIndexToStorage(studioState.projects || []);
  } catch {
    // Ignore storage write failures (quota/private mode).
  }
}

const persistedStudioState = loadStudioStateFromStorage();

export const store = configureStore({
  reducer: {
    studio: studioReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  preloadedState: {
    studio: persistedStudioState || createInitialStudioState(),
  },
});

store.subscribe(() => {
  saveStudioStateToStorage(store.getState().studio);
});
