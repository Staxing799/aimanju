import { createSlice } from '@reduxjs/toolkit';
import { createEmptyProject } from '../utils/studioGenerators';

const INITIAL_USERS = [
  { id: 'u-admin', name: '陈主管', account: 'admin@studio.ai', role: '创建者/管理员' },
  { id: 'u-writer', name: '林编剧', account: 'writer@studio.ai', role: '编剧' },
  { id: 'u-board', name: '夏分镜', account: 'board@studio.ai', role: '分镜师' },
  { id: 'u-editor', name: '顾剪辑', account: 'editor@studio.ai', role: '剪辑师' },
];

function normalizeBackendProjectId(value) {
  return String(value ?? '').trim();
}

export function createInitialStudioState() {
  return {
    projects: [],
    activeProjectId: '',
    users: INITIAL_USERS,
  };
}

const studioSlice = createSlice({
  name: 'studio',
  initialState: createInitialStudioState(),
  reducers: {
    resetStudioState() {
      return createInitialStudioState();
    },
    createProject(state, action) {
      const nextProject = createEmptyProject(action.payload || {});
      state.projects.push(nextProject);
      state.activeProjectId = nextProject.id;
    },
    switchProject(state, action) {
      const nextProjectId = action.payload || '';
      if (state.projects.some((project) => project.id === nextProjectId)) {
        state.activeProjectId = nextProjectId;
      }
    },
    setActiveProject(state, action) {
      const activeIndex = state.projects.findIndex((project) => project.id === state.activeProjectId);
      if (activeIndex < 0) {
        return;
      }

      const currentProject = state.projects[activeIndex];
      const nextProject = action.payload || {};

      state.projects[activeIndex] = {
        ...currentProject,
        ...nextProject,
        id: currentProject.id,
        backendProjectId: normalizeBackendProjectId(
          nextProject.backendProjectId || currentProject.backendProjectId || '',
        ),
        updatedAt: new Date().toISOString(),
      };
    },
    setProjectById(state, action) {
      const { projectId, project } = action.payload || {};
      if (!projectId || !project) {
        return;
      }

      const projectIndex = state.projects.findIndex((item) => item.id === projectId);
      if (projectIndex < 0) {
        return;
      }

      const currentProject = state.projects[projectIndex];
      state.projects[projectIndex] = {
        ...currentProject,
        ...project,
        id: currentProject.id,
        backendProjectId: normalizeBackendProjectId(
          project.backendProjectId || currentProject.backendProjectId || '',
        ),
        updatedAt: new Date().toISOString(),
      };
    },
    upsertProject(state, action) {
      const { project, setActive = true } = action.payload || {};
      if (!project || typeof project !== 'object') {
        return;
      }

      const fallbackProject = createEmptyProject({
        name: project.name || '未命名短剧项目',
      });
      const normalizedProject = {
        ...fallbackProject,
        ...project,
        id: project.id || fallbackProject.id,
        backendProjectId: normalizeBackendProjectId(
          project.backendProjectId || fallbackProject.backendProjectId || '',
        ),
        updatedAt: new Date().toISOString(),
      };

      const indexByLocalId = state.projects.findIndex((item) => item.id === normalizedProject.id);
      const indexByBackendId = normalizedProject.backendProjectId
        ? state.projects.findIndex((item) => item.backendProjectId === normalizedProject.backendProjectId)
        : -1;
      const targetIndex = indexByLocalId >= 0 ? indexByLocalId : indexByBackendId;

      if (targetIndex >= 0) {
        const currentProject = state.projects[targetIndex];
        state.projects[targetIndex] = {
          ...currentProject,
          ...normalizedProject,
          id: currentProject.id || normalizedProject.id,
          backendProjectId: normalizeBackendProjectId(
            normalizedProject.backendProjectId || currentProject.backendProjectId || '',
          ),
          updatedAt: new Date().toISOString(),
        };
      } else {
        state.projects.push(normalizedProject);
      }

      if (setActive) {
        const activeTarget =
          state.projects.find((item) => item.backendProjectId === normalizedProject.backendProjectId) ||
          state.projects.find((item) => item.id === normalizedProject.id);
        if (activeTarget?.id) {
          state.activeProjectId = activeTarget.id;
        }
      }
    },
    removeProject(state, action) {
      const projectId = action.payload;
      state.projects = state.projects.filter((project) => project.id !== projectId);

      if (!state.projects.some((project) => project.id === state.activeProjectId)) {
        state.activeProjectId = state.projects[0]?.id || '';
      }
    },
    addUser(state, action) {
      state.users.push(action.payload);
    },
    updateUserRole(state, action) {
      const { userId, role } = action.payload;
      state.users = state.users.map((user) => (user.id === userId ? { ...user, role } : user));
    },
    removeUser(state, action) {
      const userId = action.payload;
      state.users = state.users.filter((user) => user.id !== userId);
    },
  },
});

export const {
  resetStudioState,
  createProject,
  switchProject,
  setActiveProject,
  setProjectById,
  upsertProject,
  removeProject,
  addUser,
  updateUserRole,
  removeUser,
} = studioSlice.actions;

export const selectProjects = (state) => state.studio.projects;
export const selectActiveProjectId = (state) => state.studio.activeProjectId;
export const selectUsers = (state) => state.studio.users;
export const selectActiveProject = (state) => {
  const projects = selectProjects(state);
  const activeProjectId = selectActiveProjectId(state);
  return projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
};

export default studioSlice.reducer;
