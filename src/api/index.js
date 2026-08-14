import request from '@/utils/request';

const API_PREFIX = '/api';

// File upload endpoints require multipart/form-data.
const formdataConfig = { type: 'formdata' };

// Project core endpoints.
export const projectApi = {
  getProjects: (page = 1, pageSize = 20, params = {}) =>
    request.get(`${API_PREFIX}/projects`, {
      params: {
        page,
        page_size: pageSize,
        ...params,
      },
    }),
  uploadScript: (formData) =>
    request.post(`${API_PREFIX}/scripts/upload`, formData, formdataConfig),
  getProject: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}`),
  deleteProject: (projectId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}`),
  getProjectAnalysis: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/analysis`),
  getProjectPipelineStatus: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/pipeline-status`),
    listProjectTasks: (projectId, limit = 100) =>
    request.get(`${API_PREFIX}/projects/${projectId}/tasks`, { params: { limit } }),
  analyzeProject: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/analyze`, data),
  updateProjectScript: (projectId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/script`, data),
  getProjectEpisodes: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/episodes`),
  updateEpisodeScript: (projectId, episodeNo, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/episodes/${episodeNo}`, data),
  composeProjectEpisodes: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/episodes/compose`, data),
  getProjectEpisodeComposeStatus: (projectId, taskId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/episodes/compose/${taskId}/status`),
};

export const freeCanvasApi = {
  listModels: (params = {}) =>
    request.get(`${API_PREFIX}/free-canvas/models`, { params }),
  createProject: (data) =>
    request.post(`${API_PREFIX}/free-canvas/projects`, data),
  deleteProject: (projectId) =>
    request.delete(`${API_PREFIX}/free-canvas/projects/${projectId}`),
  getGraph: (projectId) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/graph`),
  patchGraph: (projectId, data) =>
    request.patch(`${API_PREFIX}/free-canvas/projects/${projectId}/graph`, data),
  listHistory: (projectId, params = {}) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/history`, { params }),
  getHistoryDetail: (projectId, historyId) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/history/${historyId}`),
  restoreHistory: (projectId, historyId, data) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/history/${historyId}/restore`, data),
  listOperations: (projectId, params = {}) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/operations`, { params }),
  generateNode: (projectId, nodeId, data) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/nodes/${nodeId}/generate`, data),
  runGroup: (projectId, groupId, data) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/groups/${groupId}/runs`, data),
  runWorkflow: (projectId, data) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/workflow-runs`, data),
  syncWorkflowRun: (projectId, workflowRunId) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/workflow-runs/${workflowRunId}/sync`),
  getLatestWorkflowRun: (projectId) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/workflow-runs/latest`),
  syncNodeRun: (projectId, nodeRunId) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/node-runs/${nodeRunId}/sync`),
  uploadNodeAsset: (projectId, nodeId, formData) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/nodes/${nodeId}/assets/upload`, formData, formdataConfig),
  listSeedanceVirtualCharacters: (projectId) =>
    request.get(`${API_PREFIX}/free-canvas/projects/${projectId}/seedance/virtual-characters`),
  uploadSeedanceVirtualCharacterAsset: (projectId, formData) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/seedance/virtual-character-assets`, formData, formdataConfig),
  refreshSeedanceVirtualCharacterAsset: (projectId, virtualAssetId) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/seedance/virtual-character-assets/${virtualAssetId}/refresh`),
  deleteSeedanceVirtualCharacterAsset: (projectId, virtualAssetId) =>
    request.delete(`${API_PREFIX}/free-canvas/projects/${projectId}/seedance/virtual-character-assets/${virtualAssetId}`),
  createSeedanceVirtualCharacterAsset: (projectId, virtualCharacterId, data) =>
    request.post(`${API_PREFIX}/free-canvas/projects/${projectId}/seedance/virtual-characters/${virtualCharacterId}/assets`, data),
};

// Generic task endpoint.
export const taskApi = {
  getTask: (taskId) =>
    request.get(`${API_PREFIX}/tasks/${taskId}`),
};

// Character endpoints.
export const characterApi = {
  getProjectCharacters: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/characters`),
  createProjectCharacter: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/characters`, data),
  updateProjectCharacter: (projectId, characterId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/characters/${characterId}`, data),
  deleteProjectCharacter: (projectId, characterId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}/characters/${characterId}`),
  uploadProjectCharacterAvatar: (projectId, characterId, formData) =>
    request.post(
      `${API_PREFIX}/projects/${projectId}/characters/${characterId}/avatar/upload`,
      formData,
      formdataConfig,
    ),
    generateProjectCharacterAvatar: (projectId, characterId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/characters/${characterId}/avatar/generate`, data),
  generateProjectCharactersAvatarBatch: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/characters/avatar/generate-batch`, data),
};

// Scene endpoints.
export const sceneApi = {
  getProjectScenes: (projectId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/scenes`),
  createProjectScene: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/scenes`, data),
  updateProjectScene: (projectId, sceneId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/scenes/${sceneId}`, data),
  deleteProjectScene: (projectId, sceneId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}/scenes/${sceneId}`),
  uploadProjectSceneImage: (projectId, sceneId, formData) =>
    request.post(
      `${API_PREFIX}/projects/${projectId}/scenes/${sceneId}/image/upload`,
      formData,
      formdataConfig,
    ),
    generateProjectSceneImage: (projectId, sceneId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/scenes/${sceneId}/image/generate`, data),
  generateProjectSceneImageBatch: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/scenes/image/generate-batch`, data),
};

// Storyboard endpoints.
export const storyboardApi = {
  generateProjectStoryboards: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/generate`, data),
  generateProjectStoryboardCoverBatch: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/cover/generate-batch`, data),
      generateProjectStoryboardVideoBatch: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/video/generate-batch`, data),
  getProjectStoryboards: (projectId, episodeNo) =>
    request.get(`${API_PREFIX}/projects/${projectId}/storyboards`, {
      params: episodeNo == null ? {} : { episode_no: episodeNo },
    }),
  createProjectStoryboard: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards`, data),
  getProjectStoryboard: (projectId, shotId) =>
    request.get(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}`),
  updateProjectStoryboard: (projectId, shotId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}`, data),
  removeProjectStoryboard: (projectId, shotId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}`),
  reorderProjectStoryboards: (projectId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/reorder`, data),
  addProjectStoryboardPresentCharacter: (projectId, shotId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/characters`, data),
  removeProjectStoryboardPresentCharacter: (projectId, shotId, presentId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/characters/${presentId}`),
  addProjectStoryboardLine: (projectId, shotId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/lines`, data),
  updateProjectStoryboardLine: (projectId, shotId, lineId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/lines/${lineId}`, data),
  generateProjectStoryboardLineAudio: (projectId, shotId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/lines/audio/generate`, data),
  removeProjectStoryboardLine: (projectId, shotId, lineId) =>
    request.delete(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/lines/${lineId}`),
  uploadProjectStoryboardCover: (projectId, shotId, formData) =>
    request.post(
      `${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/cover/upload`,
      formData,
      formdataConfig,
    ),
  generateProjectStoryboardCover: (projectId, shotId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/cover/generate`, data),
  updateProjectStoryboardVideoDuration: (projectId, shotId, data) =>
    request.put(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/video/duration`, data),
  generateProjectStoryboardVideo: (projectId, shotId, data) =>
    request.post(`${API_PREFIX}/projects/${projectId}/storyboards/${shotId}/video/generate`, data),
};

// User/auth endpoints.
export const userApi = {
  login: (data) =>
    request.post(`${API_PREFIX}/users/auth/login`, data, {
      doNotRedirect: true,
      skipAuth: true,
    }),
  refresh: (data) =>
    request.post(`${API_PREFIX}/users/auth/refresh`, data, {
      doNotRedirect: true,
      skipAuth: true,
    }),
  logout: () => request.post(`${API_PREFIX}/users/auth/logout`),
  me: () => request.get(`${API_PREFIX}/users/me`),
  myTeams: () => request.get(`${API_PREFIX}/users/me/teams`),
  getTeamMembers: (teamId, page = 1, pageSize = 20) =>
    request.get(`${API_PREFIX}/users/teams/${teamId}/members`, {
      params: {
        page,
        page_size: pageSize,
      },
    }),
  updateTeamMemberPointsQuota: (teamId, subUserId, pointsQuota) =>
    request.put(`${API_PREFIX}/users/teams/${teamId}/members/${subUserId}/points-quota`, {
      points_quota: pointsQuota,
    }),
  inviteTeamMember: (teamId, data) =>
    request.post(`${API_PREFIX}/users/teams/${teamId}/invite`, data),
  selectTeam: (teamId, accessToken = '') =>
    request.post(
      `${API_PREFIX}/users/me/team/select`,
      { team_id: teamId },
      accessToken
        ? {
            skipAuth: true,
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : {},
    ),
};

export const pointsApi = {
  getWallet: () => request.get(`${API_PREFIX}/points/wallet`),
  getRecords: (params = {}) => request.get(`${API_PREFIX}/points/records`, { params }),
  quote: (data, config = {}) => request.post(`${API_PREFIX}/points/quote`, data, config),
};

// Asset endpoints.
export const assetApi = {
  getTeamAssets: ({
    page = 1,
    pageSize = 20,
    assetType,
    sourceType,
  } = {}) =>
    request.get(`${API_PREFIX}/assets`, {
      params: {
        page,
        page_size: pageSize,
        asset_type: assetType,
        source_type: sourceType,
      },
    }),
};


export const managedProjectApi = {
  getFeatureModels: () =>
    request.get(`${API_PREFIX}/managed-projects/feature-models`),
  getStyles: () =>
    request.get(`${API_PREFIX}/managed-projects/styles`),
};

export const ttsApi = {
  getVoices: () =>
    request.get(`${API_PREFIX}/tts/voices`),
};

// Health endpoint.
export const healthApi = {
  healthz: () => request.get('/healthz'),
};
