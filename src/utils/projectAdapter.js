import { VOICE_PRESETS } from '../constants/models';
import { normalizePossiblyMojibakeText } from './textEncoding';

// Convert server datetime into localized text for UI display.
function toLocalTime(value) {
  if (!value) {
    return new Date().toLocaleString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

// Extract a file-like name from URL/path.
function assetNameFromPath(path, fallbackName) {
  if (!path) {
    return fallbackName;
  }

  const segments = String(path).split('/');
  return segments[segments.length - 1] || fallbackName;
}

// Normalize backend media path into browser-usable URL.
function normalizeAssetUrl(path) {
  if (!path) {
    return '';
  }

  const raw = String(path).trim();
  if (!raw) {
    return '';
  }

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  const normalized = raw.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function resolveStoryboardSortOrder(value, fallbackValue = null) {
  const normalizedValue = Number(value);
  if (Number.isFinite(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedFallbackValue = Number(fallbackValue);
  if (Number.isFinite(normalizedFallbackValue)) {
    return normalizedFallbackValue;
  }

  return null;
}

function resolveStoryboardVideoDuration(value) {
  const normalizedValue = Number.parseInt(value, 10);
  return Number.isInteger(normalizedValue) ? normalizedValue : undefined;
}

function resolveLineAudioPayload(line) {
  if (!line || typeof line !== 'object') {
    return null;
  }

  const audioCandidate =
    (line.line_audio && typeof line.line_audio === 'object' ? line.line_audio : null) ||
    (line.audio && typeof line.audio === 'object' ? line.audio : null) ||
    null;
  const audioUrl = normalizeAssetUrl(
    audioCandidate?.url ||
    audioCandidate?.audio_url ||
    audioCandidate?.local_path ||
    audioCandidate?.audio_local_path ||
    line.audio_url ||
    line.audio_local_path ||
    line.line_audio_url ||
    line.preview_audio_url ||
    '',
  );

  if (!audioUrl) {
    return null;
  }

  return {
    name:
      audioCandidate?.name ||
      audioCandidate?.file_name ||
      line.audio_name ||
      assetNameFromPath(audioUrl, 'cast-audio.wav'),
    at: toLocalTime(audioCandidate?.updated_at || line.updated_at),
    url: audioUrl,
  };
}

// Map backend analysis status to local parse status.
function parseStatusFromAnalysisStatus(status) {
  if (status === 'success') {
    return 'done';
  }
  if (status === 'queued' || status === 'running') {
    return 'parsing';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'idle';
}

// Keep generic task status values aligned with backend enums.
function safeTaskStatus(status, fallback = 'idle') {
  if (!status) {
    return fallback;
  }
  return String(status);
}

function deliveryTypeFromFilmType(filmType, fallback) {
  const narrationLabel = '\u65c1\u767d\u89e3\u8bf4';
  const storyLabel = '\u5267\u60c5\u6f14\u7ece';

  if (filmType === 'narration') {
    return narrationLabel;
  }
  if (filmType === 'story') {
    return storyLabel;
  }
  return fallback || storyLabel;
}

function creationModeFromApi(creationMode, fallback) {
  const gridLabel = '\u5bab\u683c\u6a21\u5f0f';
  const singleLabel = '\u5355\u56fe\u6a21\u5f0f';

  if (creationMode === 'grid') {
    return gridLabel;
  }
  if (creationMode === 'single') {
    return singleLabel;
  }
  return fallback || singleLabel;
}

function createEpisodeLocalId(projectId, episodeNo) {
  return `${projectId}-ep-${episodeNo}`;
}

function createCharacterLocalId(projectId, index) {
  return `${projectId}-char-${index + 1}`;
}

function createSceneLocalId(projectId, index) {
  return `${projectId}-scene-${index + 1}`;
}

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizePresentCharacterItem(item, fallbackCharacterId = '') {
  if (!item || typeof item !== 'object') {
    const normalizedFallbackCharacterId = String(fallbackCharacterId ?? '').trim();
    if (!normalizedFallbackCharacterId) {
      return null;
    }

    return {
      id: normalizedFallbackCharacterId,
      presentId: '',
      characterId: normalizedFallbackCharacterId,
      characterAction: '',
      characterPosition: '',
    };
  }

  const characterId = String(
    item.character_id ??
    item.characterId ??
    item.character?.id ??
    fallbackCharacterId ??
    '',
  ).trim();
  if (!characterId) {
    return null;
  }

  const presentId = String(
    item.present_id ??
    item.presentId ??
    item.id ??
    '',
  ).trim();

  return {
    id: presentId || characterId,
    presentId,
    characterId,
    characterAction: String(item.character_action ?? item.characterAction ?? '').trim(),
    characterPosition: String(item.character_position ?? item.characterPosition ?? '').trim(),
  };
}

function normalizePresentCharacterList(items = [], fallbackCharacterIds = []) {
  const hasExplicitItems = Array.isArray(items);
  const normalizedItems = hasExplicitItems
    ? items
      .map((item) => normalizePresentCharacterItem(item))
      .filter(Boolean)
    : [];

  if (hasExplicitItems) {
    const seenKeys = new Set();
    return normalizedItems.filter((item) => {
      const dedupeKey = item.presentId || item.characterId;
      if (!dedupeKey || seenKeys.has(dedupeKey)) {
        return false;
      }
      seenKeys.add(dedupeKey);
      return true;
    });
  }

  return normalizeIdList(fallbackCharacterIds).map((characterId) => ({
    id: characterId,
    presentId: '',
    characterId,
    characterAction: '',
    characterPosition: '',
  }));
}

function resolveStoryboardPresentCharacters(storyboard) {
  if (!storyboard || typeof storyboard !== 'object') {
    return [];
  }

  const explicitCandidateArrays = [
    storyboard.present_characters,
    storyboard.presentCharacters,
    storyboard.character_presences,
    storyboard.characterPresences,
  ];
  const explicitCharacters = explicitCandidateArrays.find((items) => Array.isArray(items));
  if (explicitCharacters) {
    return normalizePresentCharacterList(explicitCharacters, []);
  }

  const inferredCandidateArrays = [
    storyboard.characters,
  ];
  const inferredCharacters = inferredCandidateArrays.find(
    (items) =>
      Array.isArray(items) &&
      items.some(
        (item) =>
          item &&
          typeof item === 'object' &&
          (
            item.character_id != null ||
            item.characterId != null ||
            item.character?.id != null ||
            item.present_id != null ||
            item.presentId != null
          ),
      ),
  );
  if (inferredCharacters) {
    return normalizePresentCharacterList(inferredCharacters, []);
  }

  return normalizePresentCharacterList(
    undefined,
    Array.isArray(storyboard.present_character_ids)
      ? storyboard.present_character_ids
      : Array.isArray(storyboard.presentCharacterIds)
        ? storyboard.presentCharacterIds
        : [],
  );
}

function buildEntityLookup(entities = []) {
  const byId = new Map();
  entities.forEach((entity) => {
    if (entity?.id && !byId.has(entity.id)) {
      byId.set(entity.id, entity);
    }
  });

  return { byId };
}

function dedupeByIdPreferMedia(entities = [], mediaField) {
  const byIdIndex = new Map();
  const deduped = [];

  entities.forEach((entity) => {
    const idKey = String(entity?.id || '').trim();
    if (!idKey) {
      deduped.push(entity);
      return;
    }

    const existingIndex = byIdIndex.get(idKey);
    if (existingIndex == null) {
      byIdIndex.set(idKey, deduped.length);
      deduped.push(entity);
      return;
    }

    const existing = deduped[existingIndex];
    const existingHasMedia = Boolean(existing?.[mediaField]);
    const nextHasMedia = Boolean(entity?.[mediaField]);

    if (!existingHasMedia && nextHasMedia) {
      deduped[existingIndex] = entity;
    }
  });

  return deduped;
}

function resolveFallbackEntityById(lookup, id) {
  if (id && lookup.byId.has(id)) {
    return lookup.byId.get(id);
  }
  return null;
}

function mergeMediaStatus(nextStatus, fallbackStatus, hasNextMedia, hasFallbackMedia) {
  const next = safeTaskStatus(nextStatus, fallbackStatus || 'idle');

  // If we already have a usable media asset, avoid regressing visual state back to queued/running
  // when another pipeline returns partial analysis data.
  if (!hasNextMedia && hasFallbackMedia && (next === 'idle' || next === 'queued' || next === 'running')) {
    return fallbackStatus || 'success';
  }

  return next;
}

// Group flat storyboard list by episode number.
function groupStoryboardsByEpisode(storyboards) {
  return storyboards.reduce((acc, storyboard) => {
    const episodeNo = storyboard.episode_no || 1;
    const storyboardsOfEpisode = acc.get(episodeNo) || [];
    const previewUrl = normalizeAssetUrl(storyboard.cover_image_url || storyboard.cover_image_local_path);
    const videoUrl = normalizeAssetUrl(storyboard.video_url || storyboard.video_local_path || '');
    const explicitPresentCharacters = resolveStoryboardPresentCharacters(storyboard);
    const explicitPresentCharacterIds = explicitPresentCharacters.map((item) => item.characterId);

    storyboardsOfEpisode.push({
      id: storyboard.id || `${episodeNo}-${storyboard.shot_no}`,
      episodeNo,
      shotNo: storyboard.shot_no || storyboardsOfEpisode.length + 1,
      title: `\u5206\u955c ${storyboard.shot_no || storyboardsOfEpisode.length + 1}`,
      sortOrder: resolveStoryboardSortOrder(
        storyboard.sort_order ?? storyboard.sortOrder,
        storyboard.shot_no ?? storyboardsOfEpisode.length + 1,
      ),
      description: storyboard.shot_description || '',
      sceneId: storyboard.scene_id || '',
      sceneName: storyboard.scene_name || '',
      shotPrompt: '',
      imagePrompt: storyboard.cover_prompt || '',
      firstImage: previewUrl
        ? {
            name: assetNameFromPath(previewUrl, 'cover.png'),
            at: toLocalTime(storyboard.updated_at),
            prompt: storyboard.cover_prompt || '',
            preview: previewUrl,
            url: previewUrl,
          }
        : null,
      videoPrompt: storyboard.video_prompt || '',
      videoDuration: resolveStoryboardVideoDuration(
        storyboard.video_duration ?? storyboard.videoDuration,
      ),
      video: videoUrl
        ? {
            name: assetNameFromPath(videoUrl, 'video.mp4'),
            mode: '\u751f\u6210',
            at: toLocalTime(storyboard.updated_at),
            prompt: storyboard.video_prompt || '',
            url: videoUrl,
          }
        : null,
      cast: (storyboard.character_lines || []).map((line, index) => ({
        id: line.id || `${storyboard.id || episodeNo}-${index + 1}`,
        characterId: line.character_id || '',
        line: line.dialogue || '',
        voice: line.voice_name || line.voice || '',
        voicePrompt: line.voice_prompt || line.voicePrompt || '',
        audio: resolveLineAudioPayload(line),
        characterName: line.character_name || '',
        isLocalOnly: false,
      })),
      presentCharacters: explicitPresentCharacters,
      presentCharacterIds: normalizeIdList(explicitPresentCharacterIds),
      coverStatus: storyboard.cover_status || 'idle',
      coverTaskId: storyboard.cover_task_id || '',
      coverErrorMessage: storyboard.cover_error_message || '',
      videoStatus: storyboard.video_status || 'idle',
      videoTaskId: storyboard.video_task_id || '',
      videoErrorMessage: storyboard.video_error_message || '',
      videoProviderJobId: storyboard.video_provider_job_id || '',
    });

    acc.set(episodeNo, storyboardsOfEpisode);
    return acc;
  }, new Map());
}

function mergeStoryboardWithFallback(storyboard, fallbackStoryboard = null) {
  const nextCast = Array.isArray(storyboard?.cast) ? storyboard.cast : [];
  const fallbackPresentCharacters = normalizePresentCharacterList(
    fallbackStoryboard?.presentCharacters,
    fallbackStoryboard?.presentCharacterIds,
  );
  const hasNextPresentCharacters = Array.isArray(storyboard?.presentCharacters);
  const nextPresentCharacters = hasNextPresentCharacters
    ? normalizePresentCharacterList(storyboard.presentCharacters, storyboard?.presentCharacterIds)
    : fallbackPresentCharacters;
  const fallbackPresentCharacterIds = normalizeIdList(fallbackStoryboard?.presentCharacterIds);
  const hasNextPresentCharacterIds = hasNextPresentCharacters || Array.isArray(storyboard?.presentCharacterIds);
  const nextPresentCharacterIds = hasNextPresentCharacterIds
    ? normalizeIdList(
      hasNextPresentCharacters
        ? nextPresentCharacters.map((item) => item.characterId)
        : storyboard.presentCharacterIds,
    )
    : fallbackPresentCharacterIds;

  return {
    ...(fallbackStoryboard || {}),
    ...storyboard,
    cast: nextCast,
    presentCharacters: nextPresentCharacters,
    presentCharacterIds: nextPresentCharacterIds,
  };
}

function mapAnalysisCharacters(projectId, analysisCharacters, fallbackCharacters = []) {
  if (!Array.isArray(analysisCharacters)) {
    return fallbackCharacters;
  }

  if (analysisCharacters.length === 0) {
    return [];
  }

  const lookup = buildEntityLookup(fallbackCharacters);

  const mappedCharacters = analysisCharacters.map((character, index) => {
    const fallback = resolveFallbackEntityById(lookup, character.id);
    const nextAvatarUrl = normalizeAssetUrl(
      character.avatar_image_url || character.avatar_local_path || '',
    );
    const mergedAvatarUrl = nextAvatarUrl || fallback?.avatarUrl || '';

    return {
      id: character.id || createCharacterLocalId(projectId, index),
      name: character.name || fallback?.name || `\u89d2\u8272${index + 1}`,
      bio: character.description || fallback?.bio || '',
      defaultVoice:
        character.voice_name || fallback?.defaultVoice || VOICE_PRESETS[index % VOICE_PRESETS.length],
      voiceId: character.voice_id || fallback?.voiceId || '',
      // Keep previous avatar if analysis payload doesn't carry the generated url/path.
      avatarUrl: mergedAvatarUrl,
      avatarPrompt:
        character.image_prompt ||
        character.imagePrompt ||
        fallback?.avatarPrompt ||
        '',
      avatarStatus: mergeMediaStatus(
        character.avatar_status,
        fallback?.avatarStatus || 'idle',
        Boolean(nextAvatarUrl),
        Boolean(fallback?.avatarUrl),
      ),
      avatarTaskId: character.avatar_task_id || fallback?.avatarTaskId || '',
      avatarErrorMessage: character.avatar_error_message || fallback?.avatarErrorMessage || '',
    };
  });

  return dedupeByIdPreferMedia(mappedCharacters, 'avatarUrl');
}

function mapAnalysisScenes(projectId, analysisScenes, fallbackScenes = []) {
  if (!Array.isArray(analysisScenes)) {
    return fallbackScenes;
  }

  if (analysisScenes.length === 0) {
    return [];
  }

  const lookup = buildEntityLookup(fallbackScenes);

  const mappedScenes = analysisScenes.map((scene, index) => {
    const fallback = resolveFallbackEntityById(lookup, scene.id);
    const nextImageUrl = normalizeAssetUrl(scene.image_url || scene.image_local_path || '');
    const mergedImageUrl = nextImageUrl || fallback?.imageUrl || '';

    return {
      id: scene.id || createSceneLocalId(projectId, index),
      name: scene.name || fallback?.name || `\u573a\u666f${index + 1}`,
      description: scene.description || fallback?.description || '',
      prompt: scene.prompt || fallback?.prompt || '',
      relatedCharacters: scene.related_characters || fallback?.relatedCharacters || [],
      // Keep previous scene image if current analysis response omits the url/path.
      imageUrl: mergedImageUrl,
      imageStatus: mergeMediaStatus(
        scene.image_status,
        fallback?.imageStatus || 'idle',
        Boolean(nextImageUrl),
        Boolean(fallback?.imageUrl),
      ),
      imageTaskId: scene.image_task_id || fallback?.imageTaskId || '',
      imageErrorMessage: scene.image_error_message || fallback?.imageErrorMessage || '',
    };
  });

  return dedupeByIdPreferMedia(mappedScenes, 'imageUrl');
}

function mapEpisodes(projectId, analysisEpisodes, groupedStoryboards, fallbackEpisodes = []) {
  const hasAnalysisEpisodes = Array.isArray(analysisEpisodes) && analysisEpisodes.length > 0;
  const fallbackEpisodesByEpisodeNo = new Map(
    (fallbackEpisodes || [])
      .filter((episode) => Number.isInteger(episode?.episodeNo))
      .map((episode) => [episode.episodeNo, episode]),
  );
  const sourceEpisodes = hasAnalysisEpisodes
    ? analysisEpisodes
    : Array.from(groupedStoryboards.keys())
        .sort((a, b) => a - b)
        .map((episodeNo) => ({
          episode_no: episodeNo,
          title: `\u7b2c${episodeNo}\u96c6`,
          summary: '',
          script_content: '',
        }));

  if (sourceEpisodes.length === 0) {
    return fallbackEpisodes;
  }

  return sourceEpisodes
    .map((episode, index) => {
      const episodeNo = episode.episode_no || index + 1;
      const localId = createEpisodeLocalId(projectId, episodeNo);
      const nextStoryboards = (groupedStoryboards.get(episodeNo) || []).sort((a, b) => {
        const leftOrder = resolveStoryboardSortOrder(a?.sortOrder, a?.shotNo);
        const rightOrder = resolveStoryboardSortOrder(b?.sortOrder, b?.shotNo);
        if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return (a?.shotNo || 0) - (b?.shotNo || 0);
      });
      const fallbackStoryboards = fallbackEpisodesByEpisodeNo.get(episodeNo)?.storyboards || [];
      const fallbackStoryboardsById = new Map(
        fallbackStoryboards
          .filter((item) => item?.id)
          .map((item) => [String(item.id), item]),
      );
      const mergedStoryboards =
        nextStoryboards.length > 0
          ? nextStoryboards.map((storyboard) =>
            mergeStoryboardWithFallback(
              storyboard,
              fallbackStoryboardsById.get(String(storyboard?.id || '')) || null,
            ),
          )
          : fallbackStoryboards;
      const storyboards = mergedStoryboards.map((storyboard, storyboardIndex) => ({
        ...storyboard,
        shotNo: storyboardIndex + 1,
        title: `\u5206\u955c ${storyboardIndex + 1}`,
      }));

      return {
        id: localId,
        episodeNo,
        title: episode.title || `\u7b2c${episodeNo}\u96c6`,
        summary: episode.summary || '',
        scriptContent: episode.script_content || '',
        keyScenes: episode.key_scenes || [],
        storyboards,
      };
    })
    .sort((a, b) => a.episodeNo - b.episodeNo);
}

function sortStoryboardsForEpisode(storyboards = []) {
  return [...storyboards]
    .sort((a, b) => {
      const leftOrder = resolveStoryboardSortOrder(a?.sortOrder, a?.shotNo);
      const rightOrder = resolveStoryboardSortOrder(b?.sortOrder, b?.shotNo);
      if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return (a?.shotNo || 0) - (b?.shotNo || 0);
    })
    .map((storyboard, storyboardIndex) => ({
      ...storyboard,
      shotNo: storyboardIndex + 1,
      title: `\u5206\u955c ${storyboardIndex + 1}`,
    }));
}

function createFallbackEpisode(projectId, episodeNo, fallbackEpisode = null) {
  if (fallbackEpisode) {
    return fallbackEpisode;
  }

  return {
    id: createEpisodeLocalId(projectId, episodeNo),
    episodeNo,
    title: `\u7b2c${episodeNo}\u96c6`,
    summary: '',
    scriptContent: '',
    keyScenes: [],
    storyboards: [],
  };
}

function mergeEpisodeStoryboards(projectId, episodeNo, nextStoryboards = [], fallbackEpisode = null) {
  const baseEpisode = createFallbackEpisode(projectId, episodeNo, fallbackEpisode);
  const fallbackStoryboards = Array.isArray(baseEpisode.storyboards) ? baseEpisode.storyboards : [];
  const fallbackStoryboardsById = new Map(
    fallbackStoryboards
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item]),
  );
  const mergedStoryboards =
    nextStoryboards.length > 0
      ? nextStoryboards.map((storyboard) =>
          mergeStoryboardWithFallback(
            storyboard,
            fallbackStoryboardsById.get(String(storyboard?.id || '')) || null,
          ),
        )
      : fallbackStoryboards;

  return {
    ...baseEpisode,
    storyboards: sortStoryboardsForEpisode(mergedStoryboards),
  };
}

export function mergeApiStoryboardsIntoStudioProject(currentProject = {}, apiStoryboards = []) {
  if (!currentProject || !Array.isArray(apiStoryboards)) {
    return currentProject;
  }

  const projectId = String(currentProject.backendProjectId || currentProject.id || '').trim();
  const groupedStoryboards = groupStoryboardsByEpisode(apiStoryboards);
  if (groupedStoryboards.size === 0) {
    return currentProject;
  }

  const fallbackEpisodes = Array.isArray(currentProject.episodes) ? currentProject.episodes : [];
  const fallbackEpisodesByEpisodeNo = new Map(
    fallbackEpisodes
      .filter((episode) => Number.isInteger(episode?.episodeNo))
      .map((episode) => [episode.episodeNo, episode]),
  );
  const mergedEpisodesByEpisodeNo = new Map(
    fallbackEpisodes.map((episode) => [episode.episodeNo, episode]),
  );

  Array.from(groupedStoryboards.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([episodeNo, nextStoryboards]) => {
      mergedEpisodesByEpisodeNo.set(
        episodeNo,
        mergeEpisodeStoryboards(
          projectId,
          episodeNo,
          nextStoryboards,
          fallbackEpisodesByEpisodeNo.get(episodeNo) || null,
        ),
      );
    });

  return {
    ...currentProject,
    episodes: Array.from(mergedEpisodesByEpisodeNo.values()).sort((a, b) => a.episodeNo - b.episodeNo),
  };
}

export function mergeApiStoryboardIntoStudioProject(currentProject = {}, apiStoryboard = null) {
  if (!currentProject || !apiStoryboard || typeof apiStoryboard !== 'object') {
    return currentProject;
  }

  const projectId = String(currentProject.backendProjectId || currentProject.id || '').trim();
  const groupedStoryboards = groupStoryboardsByEpisode([apiStoryboard]);
  const firstEntry = Array.from(groupedStoryboards.entries())[0] || null;
  if (!firstEntry) {
    return currentProject;
  }

  const [episodeNo, nextStoryboards] = firstEntry;
  const nextStoryboard = nextStoryboards[0] || null;
  if (!nextStoryboard) {
    return currentProject;
  }

  const fallbackEpisodes = Array.isArray(currentProject.episodes) ? currentProject.episodes : [];
  const fallbackEpisodesByEpisodeNo = new Map(
    fallbackEpisodes
      .filter((episode) => Number.isInteger(episode?.episodeNo))
      .map((episode) => [episode.episodeNo, episode]),
  );
  const fallbackEpisode = fallbackEpisodesByEpisodeNo.get(episodeNo) || null;
  const fallbackStoryboards = Array.isArray(fallbackEpisode?.storyboards) ? fallbackEpisode.storyboards : [];
  const nextStoryboardId = String(nextStoryboard.id || '').trim();
  let didReplace = false;

  const mergedStoryboards = fallbackStoryboards.map((storyboard) => {
    const currentStoryboardId = String(storyboard?.id || '').trim();
    if (nextStoryboardId && currentStoryboardId === nextStoryboardId) {
      didReplace = true;
      return mergeStoryboardWithFallback(nextStoryboard, storyboard);
    }
    return storyboard;
  });

  if (!didReplace) {
    mergedStoryboards.push(mergeStoryboardWithFallback(nextStoryboard, null));
  }

  const mergedEpisodesByEpisodeNo = new Map(
    fallbackEpisodes.map((episode) => [episode.episodeNo, episode]),
  );
  mergedEpisodesByEpisodeNo.set(
    episodeNo,
    mergeEpisodeStoryboards(projectId, episodeNo, mergedStoryboards, fallbackEpisode),
  );

  return {
    ...currentProject,
    episodes: Array.from(mergedEpisodesByEpisodeNo.values()).sort((a, b) => a.episodeNo - b.episodeNo),
  };
}

// Convert backend project payload into current page's local project schema.
export function mapApiProjectToStudioProject(apiProject, currentProject = {}) {
  if (!apiProject) {
    return currentProject;
  }

  const normalizedBackendProjectId = String(
    apiProject.id || currentProject.backendProjectId || '',
  ).trim();
  const analysis = apiProject.analysis || null;
  const storyboards = Array.isArray(apiProject.storyboards) ? apiProject.storyboards : [];
  const characters = mapAnalysisCharacters(
    apiProject.id,
    analysis?.characters,
    currentProject.characters || [],
  );
  const groupedStoryboards = groupStoryboardsByEpisode(storyboards);
  const episodes = mapEpisodes(
    apiProject.id,
    analysis?.episodes,
    groupedStoryboards,
    currentProject.episodes || [],
  );
  const scenes = mapAnalysisScenes(
    apiProject.id,
    analysis?.scene_settings,
    currentProject.scenes || [],
  );

  return {
    ...currentProject,
    backendProjectId: normalizedBackendProjectId,
    name: apiProject.project_name || currentProject.name || '\u672a\u547d\u540d\u6f2b\u5267\u9879\u76ee',
    deliveryType: deliveryTypeFromFilmType(apiProject.film_type, currentProject.deliveryType),
    creationMode: creationModeFromApi(apiProject.creation_mode, currentProject.creationMode),
    aspectRatio: apiProject.aspect_ratio || currentProject.aspectRatio || '16:9',
    visualStyleId: apiProject.visual_style || currentProject.visualStyleId || '',
    scriptFileName: apiProject.script_filename || currentProject.scriptFileName || '',
    scriptText: apiProject.script_text ?? currentProject.scriptText ?? '',
    parseStatus: parseStatusFromAnalysisStatus(apiProject.analysis_status),
    analysisTaskId: apiProject.analysis_task_id || '',
    analysisErrorMessage: apiProject.analysis_error_message || '',
    storyboardStatus: safeTaskStatus(apiProject.storyboard_status, 'idle'),
    storyboardTaskId: apiProject.storyboard_task_id || '',
    storyboardErrorMessage: apiProject.storyboard_error_message || '',
    storyboardCoverBatchStatus: safeTaskStatus(apiProject.storyboard_cover_batch_status, 'idle'),
    storyboardCoverBatchTaskId: apiProject.storyboard_cover_batch_task_id || '',
    storyboardCoverBatchErrorMessage: apiProject.storyboard_cover_batch_error_message || '',
    episodeComposeStatus: safeTaskStatus(apiProject.episode_compose_status, 'idle'),
    episodeComposeTaskId: apiProject.episode_compose_task_id || '',
    episodeComposeErrorMessage: apiProject.episode_compose_error_message || '',
    scriptOverview: analysis?.script_overview || '',
    episodes,
    characters,
    scenes,
    createdAt: apiProject.created_at || currentProject.createdAt || new Date().toISOString(),
    updatedAt: apiProject.updated_at || currentProject.updatedAt || new Date().toISOString(),
    scriptUploadFile: null,
  };
}

// Map local labels to backend enum values.
export function toApiFilmType(deliveryType) {
  return deliveryType === '\u65c1\u767d\u89e3\u8bf4' ? 'narration' : 'story';
}

// Map local labels to backend enum values.
export function toApiCreationMode(creationMode) {
  return creationMode === '\u5bab\u683c\u6a21\u5f0f' ? 'grid' : 'single';
}

// Normalize axios/native error into user-readable message.
export function parseApiErrorMessage(error, fallback = '\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5') {
  const normalizedFallback = normalizePossiblyMojibakeText(fallback);

  function resolveMessage(payload) {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const nestedData = payload.data && typeof payload.data === 'object' ? payload.data : null;

    return normalizePossiblyMojibakeText(
      payload?.detail?.[0]?.msg ||
        nestedData?.detail?.[0]?.msg ||
        payload?.error_message ||
        nestedData?.error_message ||
        payload?.message ||
        nestedData?.message ||
        '',
    );
  }

  if (!error) {
    return normalizedFallback;
  }

  if (error instanceof Error && error.message) {
    return normalizePossiblyMojibakeText(error.message);
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      return resolveMessage(parsed) || normalizedFallback;
    } catch {
      return normalizePossiblyMojibakeText(error);
    }
  }

  if (typeof error === 'object') {
    return resolveMessage(error) || normalizedFallback;
  }

  return normalizedFallback;
}

