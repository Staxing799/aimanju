import { characterApi, projectApi, sceneApi, storyboardApi } from '../api';
import { mapApiProjectToStudioProject } from './projectAdapter';

// Pull latest project state from backend and normalize it to local schema.
export async function fetchLatestProjectSnapshot(projectId, fallbackProject = null, options = {}) {
  if (!projectId) {
    return fallbackProject;
  }

  const { includeAnalysis = true } = options;
  const safeFallbackProject = fallbackProject || {};
  const projectData = await projectApi.getProject(projectId);
  let mergedProject = projectData;

  if (includeAnalysis) {
    let analysisPayload = projectData.analysis || null;
    let analysisStatus = projectData.analysis_status || '';
    let analysisTaskId = projectData.analysis_task_id || '';
    let analysisErrorMessage = projectData.analysis_error_message || '';

    try {
      const analysisResponse = await projectApi.getProjectAnalysis(projectId);
      analysisPayload = analysisResponse.analysis || analysisPayload;
      analysisStatus = analysisResponse.status || analysisStatus;
      analysisTaskId = analysisResponse.task_id || analysisTaskId;
      analysisErrorMessage = analysisResponse.error_message || analysisErrorMessage;
    } catch {
      // Ignore analysis fetch errors and keep base project payload.
    }

    const [charactersResult, scenesResult, storyboardsResult] = await Promise.allSettled([
      characterApi.getProjectCharacters(projectId),
      sceneApi.getProjectScenes(projectId),
      storyboardApi.getProjectStoryboards(projectId),
    ]);

    const fallbackCharacters = Array.isArray(safeFallbackProject.characters)
      ? safeFallbackProject.characters
      : [];
    const fallbackScenes = Array.isArray(safeFallbackProject.scenes)
      ? safeFallbackProject.scenes
      : [];
    const fallbackStoryboards = Array.isArray(projectData.storyboards) ? projectData.storyboards : [];

    const characters =
      charactersResult.status === 'fulfilled' && Array.isArray(charactersResult.value)
        ? charactersResult.value
        : fallbackCharacters.length > 0
          ? fallbackCharacters
          : analysisPayload?.characters;
    const scenes =
      scenesResult.status === 'fulfilled' && Array.isArray(scenesResult.value)
        ? scenesResult.value
        : fallbackScenes.length > 0
          ? fallbackScenes
          : analysisPayload?.scene_settings;
    const storyboards =
      storyboardsResult.status === 'fulfilled' && Array.isArray(storyboardsResult.value)
        ? storyboardsResult.value
        : fallbackStoryboards;

    mergedProject = {
      ...projectData,
      storyboards,
      analysis_status: analysisStatus,
      analysis_task_id: analysisTaskId,
      analysis_error_message: analysisErrorMessage,
      analysis:
        analysisPayload || characters || scenes
          ? {
              ...(analysisPayload || {}),
              ...(Array.isArray(characters) ? { characters } : {}),
              ...(Array.isArray(scenes) ? { scene_settings: scenes } : {}),
            }
          : null,
    };
  }

  return mapApiProjectToStudioProject(mergedProject, safeFallbackProject);
}
