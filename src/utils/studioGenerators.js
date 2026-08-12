import { VOICE_PRESETS } from '../constants/models';
import { createId } from './id';

const DEFAULT_SCRIPT = `第1集 清雨夜
场景：老街巷口
林溪：今晚必须找到失踪的线索。
陆沉：我会掩护你，先别冲动。

第2集 旧档案室
场景：废弃档案室
林溪：这些档案里一定有当年的真相。
陆沉：门外有脚步声，准备撤离。`;

const DEFAULT_DELIVERY_TYPE = '剧情演绎';
const DEFAULT_CREATION_MODE = '单图模式';
const DEFAULT_ASPECT_RATIO = '16:9';
const DEFAULT_VISUAL_STYLE_ID = '';

// 标准化脚本行：去空格、去空行。
function cleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// 按名称去重，避免角色/场景重复写入。
function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.name)) {
      return false;
    }
    seen.add(item.name);
    return true;
  });
}

// 优先按“第X集”切分；无法识别时退化为均分两段。
function parseEpisodeBlocks(scriptText) {
  const blocks = scriptText.split(/(?=第\s*\d+\s*集)/g).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 0) {
    return blocks;
  }

  const lines = cleanLines(scriptText);
  if (lines.length === 0) {
    return [DEFAULT_SCRIPT.split(/\n\n/)[0], DEFAULT_SCRIPT.split(/\n\n/)[1]];
  }

  const midpoint = Math.max(1, Math.floor(lines.length / 2));
  return [lines.slice(0, midpoint).join('\n'), lines.slice(midpoint).join('\n')];
}

// 从“角色名：台词”模式中提取角色列表。
function extractCharacters(scriptText) {
  const regex = /([\u4e00-\u9fa5A-Za-z0-9]{1,8})[：:]/g;
  const matches = Array.from(scriptText.matchAll(regex)).map((entry) => entry[1]);
  const defaults = ['林溪', '陆沉'];
  const names = matches.length > 0 ? matches : defaults;

  return uniqueByName(
    names.map((name, index) => ({
      id: createId('char'),
      name,
      bio: index === 0 ? '主角，推动剧情主线。' : '核心配角，负责冲突与反转。',
      defaultVoice: VOICE_PRESETS[index % VOICE_PRESETS.length],
    })),
  );
}

// 从“场景：XXX”模式中提取场景列表。
function extractScenes(scriptText) {
  const sceneRegex = /(场景[：:]?\s*[\u4e00-\u9fa5A-Za-z0-9-]{2,20})/g;
  const matches = Array.from(scriptText.matchAll(sceneRegex)).map((entry) =>
    entry[0].replace(/场景[：:]?\s*/, ''),
  );
  const fallback = ['夜雨巷口', '旧档案室', '天台追逐'];

  return uniqueByName(
    (matches.length > 0 ? matches : fallback).map((name, index) => ({
      id: createId('scene'),
      name,
      description: index % 2 === 0 ? '环境氛围偏紧张，适合冲突镜头。' : '室内空间，适合对白推进。',
    })),
  );
}

// 将原始剧本文本解析成页面使用的分集/角色/场景结构。
export function parseScriptToProjectData(scriptText) {
  const safeScript = scriptText.trim() ? scriptText : DEFAULT_SCRIPT;
  const blocks = parseEpisodeBlocks(safeScript);
  const episodes = blocks.map((block, index) => {
    const lines = cleanLines(block);
    const firstLine = lines[0] || `第${index + 1}集`;
    const title = firstLine.startsWith('第') ? firstLine : `第${index + 1}集 ${firstLine}`;
    const summarySource = lines.slice(1).join(' ');

    return {
      id: createId('ep'),
      title,
      summary: summarySource.slice(0, 120) || '待补充分集概要。',
      storyboards: [],
    };
  });

  const characters = extractCharacters(safeScript);
  const scenes = extractScenes(safeScript);

  return { episodes, characters, scenes };
}

// 创建前端项目草稿数据结构。
export function createEmptyProject(seed = {}) {
  return {
    id: createId('project'),
    backendProjectId: '',
    name: seed.name ?? '',
    seriesName: seed.seriesName || '第一季',
    genre: seed.genre || '悬疑',
    targetPlatform: seed.targetPlatform || '抖音',
    episodeCount: seed.episodeCount || 12,
    dueDate: seed.dueDate || '',
    template: seed.template || '空白模板',
    coverUrl: seed.coverUrl || '',
    deliveryType: seed.deliveryType || DEFAULT_DELIVERY_TYPE,
    creationMode: seed.creationMode || DEFAULT_CREATION_MODE,
    aspectRatio: seed.aspectRatio || DEFAULT_ASPECT_RATIO,
    visualStyleId: seed.visualStyleId || DEFAULT_VISUAL_STYLE_ID,
    scriptText: seed.scriptText || '',
    scriptFileName: seed.scriptFileName || '',
    parsePrompt: '',
    storyboardPrompt: '',
    parseStatus: 'idle',
    analysisTaskId: '',
    analysisErrorMessage: '',
    storyboardStatus: 'idle',
    storyboardTaskId: '',
    storyboardErrorMessage: '',
    storyboardCoverBatchStatus: 'idle',
    storyboardCoverBatchTaskId: '',
    storyboardCoverBatchErrorMessage: '',
    scriptOverview: '',
    scriptUploadFile: seed.scriptUploadFile || null,
    modelConfig: {
      scriptModel: 'script-general',
      storyboardModel: 'storyboard-comic',
      imageModel: 'image-comic',
      characterModel: 'image-comic',
      sceneModel: 'image-comic',
      videoModel: 'video-hd',
    },
    episodes: [],
    characters: [],
    scenes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// 生成默认演示项目，便于首次进入页面时有可用数据。
export function seedProject() {
  const project = createEmptyProject({
    name: '星港迷案',
    seriesName: '第一季',
    genre: '悬疑',
    targetPlatform: 'B站',
    episodeCount: 10,
  });

  const parsed = parseScriptToProjectData(DEFAULT_SCRIPT);

  return {
    ...project,
    scriptText: DEFAULT_SCRIPT,
    parseStatus: 'done',
    parsePrompt: '强调悬疑氛围和转场节奏',
    ...parsed,
  };
}

// 为分镜创建一条默认人物台词槽位。
export function createDefaultCast(characters = []) {
  const fallbackVoice = VOICE_PRESETS[0];
  const firstCharacter = characters[0];

  return [
    {
      id: createId('cast'),
      characterId: firstCharacter?.id || '',
      line: '',
      voice: firstCharacter?.defaultVoice || fallbackVoice,
      voicePrompt: '',
      audio: null,
      isLocalOnly: true,
    },
  ];
}

// 根据分集摘要粗略生成分镜草稿（本地兜底逻辑）。
export function buildStoryboards(project, generationPrompt = '') {
  const characterPool = project.characters.length > 0 ? project.characters : [];
  const scenePool = project.scenes.length > 0 ? project.scenes : [];

  return project.episodes.map((episode, epIndex) => {
    const count = Math.max(2, Math.min(6, Math.ceil((episode.summary.length || 40) / 22)));
    const storyboards = Array.from({ length: count }).map((_, sbIndex) => {
      const scene = scenePool[(epIndex + sbIndex) % Math.max(scenePool.length, 1)];
      const cast = createDefaultCast(characterPool);

      return {
        id: createId('sb'),
        title: `分镜 ${sbIndex + 1}`,
        description: `镜头聚焦${episode.title}关键冲突，建议时长 2-4 秒。`,
        sceneId: scene?.id || '',
        presentCharacterIds: cast.map((item) => item.characterId).filter(Boolean),
        cast,
        shotPrompt: generationPrompt,
        imagePrompt: '',
        firstImage: null,
        videoPrompt: '',
        video: null,
      };
    });

    return {
      ...episode,
      storyboards,
    };
  });
}
