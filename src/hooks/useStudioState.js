import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  addUser as addUserAction,
  createProject as createProjectAction,
  removeProject as removeProjectAction,
  removeUser as removeUserAction,
  resetStudioState as resetStudioStateAction,
  selectActiveProject,
  selectActiveProjectId,
  selectProjects,
  selectUsers,
  setActiveProject,
  setProjectById as setProjectByIdAction,
  switchProject as switchProjectAction,
  upsertProject as upsertProjectAction,
  updateUserRole as updateUserRoleAction,
} from '../store/studioSlice';
import { fetchLatestProjectSnapshot } from '../utils/projectRemoteSync';

// 工作台全局状态仓库：项目与成员数据统一走 Redux。
function isCanvasProject(project) {
  const typeText = String(
    project?.projectType ??
      project?.project_type ??
      project?.projectGenre ??
      project?.project_genre ??
      project?.genre ??
      project?.type ??
      '',
  ).toLowerCase();

  return typeText.includes('canvas') || typeText.includes('free-canvas');
}

export function useStudioState() {
  const dispatch = useDispatch();
  const location = useLocation();
  const projects = useSelector(selectProjects);
  const activeProject = useSelector(selectActiveProject);
  const activeProjectId = useSelector(selectActiveProjectId);
  const users = useSelector(selectUsers);
  const activeLocalProjectId = activeProject?.id || '';
  const activeBackendProjectId = activeProject?.backendProjectId || '';
  const activeProjectRef = useRef(activeProject);

  useEffect(() => {
    activeProjectRef.current = activeProject;
  }, [activeProject]);

  // 刷新后若已有后端项目ID，优先按ID回源拉最新项目快照。
  useEffect(() => {
    if (!activeLocalProjectId || !activeBackendProjectId) {
      return;
    }

    const pathname = location.pathname || '';
    if (
      pathname.startsWith('/workflow') ||
      pathname.startsWith('/assets') ||
      pathname.startsWith('/users') ||
      pathname.startsWith('/projects') ||
      pathname.startsWith('/canvas-projects')
    ) {
      return;
    }

    if (isCanvasProject(activeProjectRef.current)) {
      return;
    }

    if (!localStorage.getItem('token')) {
      return;
    }

    let disposed = false;

    (async () => {
      try {
        const latestProject = await fetchLatestProjectSnapshot(
          activeBackendProjectId,
          activeProjectRef.current || {
            id: activeLocalProjectId,
            backendProjectId: activeBackendProjectId,
          },
        );

        if (disposed || !latestProject) {
          return;
        }

        dispatch(
          setProjectByIdAction({
            projectId: activeLocalProjectId,
            project: latestProject,
          }),
        );
      } catch {
        // Keep persisted local snapshot when server refresh fails.
      }
    })();

    return () => {
      disposed = true;
    };
  }, [activeBackendProjectId, activeLocalProjectId, dispatch, location.pathname]);

  function createProject(form) {
    dispatch(createProjectAction(form));
  }

  function clearStudioState() {
    dispatch(resetStudioStateAction());
  }

  function switchProject(projectId) {
    dispatch(switchProjectAction(projectId));
  }

  // 保持原有函数式更新 API，内部转换为 Redux action。
  function updateActiveProject(updater) {
    if (!activeProject) {
      return;
    }

    const nextProject = typeof updater === 'function' ? updater(activeProject) : updater;

    if (!nextProject || typeof nextProject !== 'object') {
      return;
    }

    dispatch(setActiveProject(nextProject));
  }

  function removeProject(projectId) {
    dispatch(removeProjectAction(projectId));
  }

  function updateProjectById(projectId, updater) {
    if (!projectId) {
      return;
    }

    const targetProject = projects.find((project) => project.id === projectId);
    if (!targetProject) {
      return;
    }

    const nextProject = typeof updater === 'function' ? updater(targetProject) : updater;
    if (!nextProject || typeof nextProject !== 'object') {
      return;
    }

    dispatch(
      setProjectByIdAction({
        projectId,
        project: nextProject,
      }),
    );
  }

  function upsertProject(project, options = {}) {
    dispatch(
      upsertProjectAction({
        project,
        setActive: options.setActive !== false,
      }),
    );
  }

  function addUser(newUser) {
    dispatch(addUserAction(newUser));
  }

  function updateUserRole(userId, role) {
    dispatch(updateUserRoleAction({ userId, role }));
  }

  function removeUser(userId) {
    dispatch(removeUserAction(userId));
  }

  return {
    projects,
    activeProject,
    activeProjectId,
    users,
    clearStudioState,
    createProject,
    switchProject,
    updateActiveProject,
    updateProjectById,
    upsertProject,
    removeProject,
    addUser,
    updateUserRole,
    removeUser,
  };
}
