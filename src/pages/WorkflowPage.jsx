import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { freeCanvasApi, pointsApi } from '../api';
import {
  createFreeCanvasUntitledName,
  normalizeFreeCanvasProjectName,
  saveFreeCanvasProjectName,
} from '../utils/freeCanvasProjectNames';
import { parseApiErrorMessage } from '../utils/projectAdapter';
import styles from './WorkflowPage.module.less';

const NODE_TYPES = [
  { type: 'script', label: '剧本', icon: '文', accent: '#5ed7ff', description: '输入长文、小说或分集脚本' },
  { type: 'character', label: '角色', icon: '角', accent: '#8df2b2', description: '沉淀角色外观、性格与配音' },
  { type: 'scene', label: '场景', icon: '景', accent: '#ffd36a', description: '统一环境、机位和美术风格' },
  { type: 'storyboard', label: '分镜', icon: '镜', accent: '#b7a0ff', description: '生成镜头描述、构图和动作' },
  { type: 'image', label: '首图', icon: '图', accent: '#ff9ab3', description: '生成视频参考图和角色入镜' },
  { type: 'video', label: '视频', icon: '影', accent: '#ffb06a', description: '把首图与提示词转成短视频' },
  { type: 'upload_image', label: '图片资源', icon: '图', accent: '#ff9ab3', description: '用户上传的图片资源' },
  { type: 'upload_video', label: '视频资源', icon: '影', accent: '#ffb06a', description: '用户上传的视频资源' },
  { type: 'audio', label: '音频', icon: '音', accent: '#89a7ff', description: '配音、音效和背景音乐' },
  { type: 'export', label: '导出', icon: '出', accent: '#76e8d1', description: '合成分集成片并下载' },
];

const QUICK_ADD_NODE_TYPES = [
  { type: 'script', label: '文本', icon: '文' },
  { type: 'image', label: '图片', icon: '图' },
  { type: 'video', label: '视频', icon: '视' },
  // { type: 'audio', label: '音频', icon: '音' },
];

const MEDIA_GENERATION_TYPE_OPTIONS = [
  { type: 'video', label: '视频生成' },
  { type: 'image', label: '图片生成' },
];

const GENERATED_MEDIA_NODE_TYPES = ['image', 'audio', 'video'];
const RESOURCE_CONTAINER_NODE_TYPES = ['upload_image', 'upload_video'];
const MEDIA_NODE_TYPES = [...GENERATED_MEDIA_NODE_TYPES, ...RESOURCE_CONTAINER_NODE_TYPES];
const CONNECTABLE_TARGET_TYPE_MAP = {
  1: 'script',
  2: 'image',
  3: 'video',
};
const DEFAULT_CONNECTABLE_TARGET_TYPES_BY_NODE_TYPE = {
  script: [1, 2, 3],
  image: [1, 2, 3],
  video: [1, 3],
  upload_image: [1, 2, 3],
  upload_video: [1, 3],
  audio: [],
};
const DEFAULT_VIDEO_MODEL = 'Seedance 2.0 VIP';
const DEFAULT_TEXT_MODEL = 'GVLM 3.1';
const TEXT_MODEL_OPTIONS = [DEFAULT_TEXT_MODEL, 'GVLM 3.1 Turbo', 'Qwen 3 Max', 'DeepSeek V3.2', 'Claude Sonnet 4.5'];
const DEFAULT_IMAGE_MODEL = 'Lib Nano Pro';
const IMAGE_MODEL_OPTIONS = [DEFAULT_IMAGE_MODEL, 'Lib Nano', 'Dreamina Image Pro', 'Seedream 4.0', 'Midjourney V7'];
const VIDEO_MODEL_OPTIONS = [
  DEFAULT_VIDEO_MODEL,
  'Seedance 2.0 Lite',
  'Kling 2.1 Pro',
  'Kling 2.1 Standard',
  'Vidu Q1',
  'Vidu Q1 Fast',
  'Runway Gen-4',
  'Runway Gen-3 Turbo',
  'Pika 2.2',
  'Pika 2.2 Turbo',
  'Hailuo 02',
  'Hailuo 02 Fast',
  'Luma Ray 2',
  'Luma Ray 2 Flash',
  'Wan 2.1 Video',
  'Wan 2.1 Turbo',
  'PixVerse V4.5',
  'PixVerse V4.5 Fast',
  'Dreamina Video Pro',
  'Dreamina Video Lite',
];
const VIDEO_ASPECT_RATIO_OPTIONS = ['自适应', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'];
const DEFAULT_AUDIO_MODEL = 'Minimax-speech-2.8-hd';
const AUDIO_MODEL_OPTIONS = [DEFAULT_AUDIO_MODEL];
const FALLBACK_MODEL_OPTIONS_BY_NODE_TYPE = {
  script: TEXT_MODEL_OPTIONS,
  image: IMAGE_MODEL_OPTIONS,
  video: VIDEO_MODEL_OPTIONS,
  audio: AUDIO_MODEL_OPTIONS,
};
const MODEL_NODE_TYPES = Object.keys(FALLBACK_MODEL_OPTIONS_BY_NODE_TYPE);
const EMPTY_MODEL_OPTIONS_BY_NODE_TYPE = MODEL_NODE_TYPES.reduce((options, nodeType) => {
  options[nodeType] = [];
  return options;
}, {});
const POINTS_QUOTE_NODE_TYPES = ['script', 'image', 'video'];
const VIDEO_INPUT_MODE_REFERENCE = 'reference';
const VIDEO_INPUT_MODE_FIRST_FRAME = 'first_frame';
const VIDEO_INPUT_MODE_FIRST_END_FRAME = 'frames2video';
const VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER = 'virtual_character';
const VIDEO_INPUT_ROLE_REFERENCE_IMAGE = 'reference_image';
const VIDEO_INPUT_ROLE_FIRST_FRAME = 'first_frame';
const VIDEO_INPUT_ROLE_END_FRAME = 'end_frame';
const SHOW_GLOBAL_WORKFLOW_RUN_ACTION = false;
const MODEL_INPUT_LIMIT_FIELDS_BY_MEDIA_TYPE = {
  text: ['max_text_inputs', 'maxTextInputs'],
  image: ['max_image_inputs', 'maxImageInputs'],
  video: ['max_video_inputs', 'maxVideoInputs'],
  audio: ['max_audio_inputs', 'maxAudioInputs'],
};
const MODEL_MEDIA_TYPE_LABELS = {
  text: '\u6587\u672c',
  image: '\u56fe\u7247',
  video: '\u89c6\u9891',
  audio: '\u97f3\u9891',
};
const MIN_VIDEO_DURATION_SECONDS = 5;
const MAX_VIDEO_DURATION_SECONDS = 15;
const SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE = 8;
const SEEDANCE_VIRTUAL_ASSET_ACTIVE_STATUS = 'active';
const SEEDANCE_VIRTUAL_ASSET_REFRESH_INTERVAL_MS = 3000;
const SEEDANCE_VIRTUAL_ASSET_REFRESH_MAX_ATTEMPTS = 20;
const IMAGE_DIMENSION_LIMIT = {
  min: 300,
  max: 6000,
};

const INITIAL_NODES = [
  {
    id: 'script-source',
    type: 'script',
    title: '文本节点1',
    subtitle: '上传或粘贴原始故事',
    x: 160,
    y: 170,
    width: 310,
    height: 190,
    status: 'ready',
    model: '文本解析',
    content: '长篇原始剧本、小说章节或分集梗概会在这里进入工作流。',
    tags: ['TXT', 'DOCX', 'PDF'],
  },
  {
    id: 'setting-extract',
    type: 'storyboard',
    title: '剧本解析',
    subtitle: '抽取分集、角色、场景',
    x: 610,
    y: 155,
    width: 340,
    height: 210,
    status: 'running',
    model: '剧本解析模型',
    content: '自动拆分剧情节奏，生成可编辑的角色卡、场景卡和分集脚本。',
    tags: ['分集', '角色', '场景'],
  },
  {
    id: 'character-bank',
    type: 'character',
    title: '角色设定',
    subtitle: '形象、提示词、配音',
    x: 1080,
    y: 80,
    width: 300,
    height: 200,
    status: 'waiting',
    model: '角色生成',
    content: '为主要角色生成统一外观，支持上传替换和再次生成。',
    tags: ['外观', '声音'],
  },
  {
    id: 'scene-bank',
    type: 'scene',
    title: '场景设定',
    subtitle: '地点、时代、美术风格',
    x: 1080,
    y: 330,
    width: 300,
    height: 200,
    status: 'waiting',
    model: '场景生成',
    content: '提炼高频场景并生成背景参考图，保证画面气质一致。',
    tags: ['背景', '光线'],
  },
  {
    id: 'shot-plan',
    type: 'storyboard',
    title: '分镜规划',
    subtitle: '镜头描述、动作、台词',
    x: 1530,
    y: 190,
    width: 350,
    height: 230,
    status: 'idle',
    model: '分镜生成',
    content: '合并角色和场景资产，为每集生成镜头级生产表。',
    tags: ['镜头', '机位', '动作'],
  },
  {
    id: 'cover-gen',
    type: 'image',
    title: '首图生成',
    subtitle: '批量参考图',
    x: 2020,
    y: 110,
    width: 592,
    height: 333,
    status: 'idle',
    model: DEFAULT_IMAGE_MODEL,
    content: '按镜头提示词生成参考图，作为视频生成的起始帧。',
    tags: ['16:9', '9:16'],
  },
  {
    id: 'video-gen',
    type: 'video',
    title: '视频生成',
    subtitle: '首图转视频',
    x: 2020,
    y: 360,
    width: 300,
    height: 200,
    status: 'idle',
    model: DEFAULT_VIDEO_MODEL,
    content: '按单镜头时长生成 5-15 秒短视频，可批量执行。',
    durationSeconds: MIN_VIDEO_DURATION_SECONDS,
    tags: ['5s', '15s'],
  },
  {
    id: 'episode-export',
    type: 'export',
    title: '剧集合成',
    subtitle: '字幕、配音、打包下载',
    x: 2480,
    y: 240,
    width: 320,
    height: 210,
    status: 'idle',
    model: '合成器',
    content: '把已完成的视频镜头按集导出，生成成片压缩包。',
    tags: ['MP4', 'ZIP'],
  },
];

const INITIAL_EDGES = [
  { id: 'edge-script-setting', from: 'script-source', fromSide: 'right', to: 'setting-extract', toSide: 'left' },
  { id: 'edge-setting-character', from: 'setting-extract', fromSide: 'right', to: 'character-bank', toSide: 'left' },
  { id: 'edge-setting-scene', from: 'setting-extract', fromSide: 'right', to: 'scene-bank', toSide: 'left' },
  { id: 'edge-character-shot', from: 'character-bank', fromSide: 'right', to: 'shot-plan', toSide: 'left' },
  { id: 'edge-scene-shot', from: 'scene-bank', fromSide: 'right', to: 'shot-plan', toSide: 'left' },
  { id: 'edge-shot-cover', from: 'shot-plan', fromSide: 'right', to: 'cover-gen', toSide: 'left' },
  { id: 'edge-cover-video', from: 'cover-gen', fromSide: 'right', to: 'video-gen', toSide: 'left' },
  { id: 'edge-video-export', from: 'video-gen', fromSide: 'right', to: 'episode-export', toSide: 'left' },
];

const STATUS_META = {
  queued: { label: '队列中', tone: 'running' },
  success: { label: '已完成', tone: 'ready' },
  failed: { label: '生成失败', tone: 'waiting' },
  ready: { label: '已就绪', tone: 'ready' },
  running: { label: '生成中', tone: 'running' },
  waiting: { label: '待素材', tone: 'waiting' },
  idle: { label: '未开始', tone: 'idle' },
  done: { label: '已完成', tone: 'ready' },
};

const ACTIVE_GENERATION_STATUSES = ['queued', 'running'];
const SUCCESS_GENERATION_STATUSES = ['success', 'succeeded', 'completed', 'complete', 'done', 'finished'];
const FAILURE_GENERATION_STATUSES = ['failed', 'fail', 'error', 'canceled', 'cancelled', 'timeout'];

const WORLD_EXTENT = 50000;
const WORLD_SIZE = WORLD_EXTENT * 2;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 138;
const MINIMAP_PADDING = 12;
const NODE_RUN_SYNC_INTERVAL_MS = 5000;
const WORKFLOW_RUN_SYNC_INTERVAL_MS = 5000;
const POINTS_QUOTE_TIMEOUT_MS = 15000;
const MAX_REQUEST_ID_LENGTH = 64;
const CANVAS_HISTORY_LIMIT = 100;
const CANVAS_HISTORY_COMMIT_DELAY_MS = 280;
const CANVAS_PASTE_OFFSET = 32;
const CANVAS_HISTORY_TRANSIENT_NODE_FIELDS = new Set([
  'canvasGroups',
  'generationRunId',
  'generationStatus',
  'isVideoPlaying',
  'status',
  'videoCurrentTime',
  'videoDuration',
  'videoProgress',
]);
const CONNECTOR_SIDES = ['left', 'right'];
const CONNECTOR_PORT_OUTSET = 10;
const TEXT_NODE_MIN_WIDTH = 280;
const TEXT_NODE_MIN_HEIGHT = 160;
const SNAP_GRID_SIZE = 15;
const ALIGN_GUIDE_THRESHOLD = 6;
const MIN_SELECTION_REGION_SIZE = 8;
const SELECTION_REGION_PADDING = 28;
const GROUP_CONTENT_PADDING = 28;
const GROUP_MIN_WIDTH = 180;
const GROUP_MIN_HEIGHT = 120;
const GROUP_RESIZE_HANDLES = [
  { corner: 'top-left', label: '调整分组左上角' },
  { corner: 'top-right', label: '调整分组右上角' },
  { corner: 'bottom-left', label: '调整分组左下角' },
  { corner: 'bottom-right', label: '调整分组右下角' },
];

const createGroupRunRequestId = () => {
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `group-run-${uniqueId}`.slice(0, MAX_REQUEST_ID_LENGTH);
};

const EMPTY_CANVAS_PRESETS = [
  {
    id: 'generate-story',
    label: '生成故事',
    description: '创建故事节点并打开生成面板',
    sourceType: 'script',
    sourceTitle: '故事生成',
    tone: 'cyan',
  },
  {
    id: 'generate-image',
    label: '生成图片',
    description: '创建图片节点并打开生成面板',
    sourceType: 'image',
    sourceTitle: '图片生成',
    iconType: 'image',
    tone: 'violet',
  },
  {
    id: 'generate-video',
    label: '生成视频',
    description: '创建图片 → 视频生成链路',
    sourceType: 'image',
    targetType: 'video',
    sourceTitle: '视频首图',
    targetTitle: '视频生成',
    targetPortKey: VIDEO_INPUT_ROLE_REFERENCE_IMAGE,
    focusNode: 'source',
    iconType: 'video',
    tone: 'amber',
  },
];

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function snapToGrid(value) {
  return Math.round(value / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
}

function isMediaNodeType(type) {
  return MEDIA_NODE_TYPES.includes(type);
}

function isGeneratedMediaNodeType(type) {
  return GENERATED_MEDIA_NODE_TYPES.includes(type);
}

function isResourceContainerNodeType(type) {
  return RESOURCE_CONTAINER_NODE_TYPES.includes(type);
}

function getResourceContainerNodeType(mediaType) {
  return mediaType === 'video' ? 'upload_video' : 'upload_image';
}

function getNodeTypeMediaType(type) {
  if (type === 'upload_image') {
    return 'image';
  }
  if (type === 'upload_video') {
    return 'video';
  }
  return GENERATED_MEDIA_NODE_TYPES.includes(type) ? type : '';
}

function getMediaNodeTitle(type) {
  if (type === 'audio') {
    return '音频节点';
  }
  if (type === 'video') {
    return '视频节点';
  }
  return '图片节点';
}

function getMediaAccept(type) {
  const mediaType = getNodeTypeMediaType(type);
  if (mediaType === 'audio') {
    return 'audio/*';
  }
  if (mediaType === 'video') {
    return 'video/*';
  }
  return 'image/*';
}

const AUDIO_WAVEFORM_BARS = [
  0.62, 0.48, 0.54, 0.78, 0.66, 0.52, 0.74, 0.88, 0.86, 0.76, 0.72, 0.84,
  0.9, 0.7, 0.8, 0.76, 0.92, 0.72, 0.64, 0.78, 0.9, 0.84, 0.68, 0.56,
  0.58, 0.64, 0.76, 0.5, 0.7, 0.92, 0.78, 0.68, 0.88, 0.96, 0.72, 0.84,
  0.66, 0.52, 0.54, 0.56, 0.62, 0.86, 0.78, 0.82, 0.88, 0.94, 0.76, 0.7,
  0.82, 0.9, 0.72, 0.68,
];

function formatMediaTime(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPreciseMediaTime(value) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const totalMilliseconds = Math.round(safeValue * 1000);
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function normalizeGenerationMeta(value) {
  const meta = parseJsonObject(value);
  const references = Array.isArray(meta.references)
    ? meta.references
        .map((reference, index) => {
          const item = reference && typeof reference === 'object' ? reference : {};
          const url = String(item.url || item.previewUrl || '').trim();
          const label = String(item.label || item.name || `参考素材 ${index + 1}`).trim();
          return {
            id: String(item.id || `${item.type || 'reference'}-${index}`).trim(),
            type: String(item.type || item.sourceKind || 'reference').trim(),
            label,
            url,
          };
        })
        .filter((reference) => reference.url || reference.label)
    : [];
  const outputs = Array.isArray(meta.outputs)
    ? meta.outputs
        .map((output, index) => {
          const item = typeof output === 'string' ? { url: output } : output || {};
          const url = String(
            item.url ||
              item.ossUrl ||
              item.oss_url ||
              item.outputUrl ||
              item.output_url ||
              item.assetUrl ||
              item.asset_url ||
              item.imageUrl ||
              item.image_url ||
              item.videoUrl ||
              item.video_url ||
              '',
          ).trim();
          if (!url) {
            return null;
          }
          return {
            id: String(item.id || `output-${index}`).trim(),
            url,
            width: Number(item.width) || 0,
            height: Number(item.height) || 0,
            duration: Number(item.duration) || 0,
            fileSize: Number(item.fileSize ?? item.file_size) || 0,
            mimeType: String(item.mimeType || item.mime_type || '').trim(),
          };
        })
        .filter(Boolean)
    : [];

  return {
    runId: String(meta.runId || meta.run_id || '').trim(),
    requestedAt: String(meta.requestedAt || meta.requested_at || '').trim(),
    generatedAt: String(
      meta.generatedAt || meta.generated_at || meta.completedAt || meta.completed_at || '',
    ).trim(),
    model: String(meta.model || '').trim(),
    prompt: String(meta.prompt || meta.content || '').trim(),
    aspectRatio: String(meta.aspectRatio || meta.aspect_ratio || '').trim(),
    resolution: String(meta.resolution || '').trim(),
    durationSeconds: Number(meta.durationSeconds ?? meta.duration_seconds) || 0,
    references,
    outputs,
  };
}

function formatGenerationDate(value) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) {
    return '暂无记录';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const videoDoubleClickFullscreenBlockUntil = new WeakMap();

function markVideoDoubleClickFullscreenBlocked(video) {
  if (video) {
    videoDoubleClickFullscreenBlockUntil.set(video, Date.now() + 700);
  }
}

function shouldBlockVideoDoubleClickFullscreen(video) {
  return Boolean(
    video &&
      (videoDoubleClickFullscreenBlockUntil.get(video) || 0) > Date.now(),
  );
}

function isVideoFullscreen(video) {
  const fullscreenElement = document.fullscreenElement;
  return Boolean(
    video &&
      (fullscreenElement === video ||
        fullscreenElement?.contains?.(video) ||
        video.contains?.(fullscreenElement) ||
        video.webkitDisplayingFullscreen),
  );
}

function exitNativeVideoFullscreen(video) {
  if (!video || !isVideoFullscreen(video)) {
    return;
  }
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch?.(() => {});
  }
  if (video.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.();
  }
}

function preventNativeVideoFullscreen(event) {
  const video = event.target?.closest?.('video');
  if (!video) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  markVideoDoubleClickFullscreenBlocked(video);
  exitNativeVideoFullscreen(video);
  return true;
}

function MediaDetailViewer({ node, references = [], onClose }) {
  const closeButtonRef = useRef(null);
  const viewerRef = useRef(null);
  const generationMeta = useMemo(
    () => normalizeGenerationMeta(node?.generationMeta),
    [node?.generationMeta],
  );
  const outputs = useMemo(() => {
    const normalizedOutputs = [...generationMeta.outputs];
    const currentUrl = String(node?.mediaPreviewUrl || '').trim();
    if (currentUrl) {
      const currentOutputIndex = normalizedOutputs.findIndex(
        (output) => output.url === currentUrl,
      );
      if (currentOutputIndex > 0) {
        normalizedOutputs.unshift(normalizedOutputs.splice(currentOutputIndex, 1)[0]);
      } else if (currentOutputIndex < 0) {
        normalizedOutputs.unshift({
          id: 'current-output',
          url: currentUrl,
          width: 0,
          height: 0,
          duration: 0,
          fileSize: 0,
          mimeType: '',
        });
      }
    }
    return normalizedOutputs;
  }, [generationMeta.outputs, node?.mediaPreviewUrl]);
  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [mediaMetadata, setMediaMetadata] = useState({
    url: '',
    width: 0,
    height: 0,
    duration: 0,
  });
  const safeSelectedOutputIndex = outputs[selectedOutputIndex] ? selectedOutputIndex : 0;
  const selectedOutput = outputs[safeSelectedOutputIndex] || outputs[0] || null;
  const mediaType = getNodeMediaType(node);
  const isVideo = mediaType === 'video';
  const isUploadedResource = isResourceContainerNodeType(node?.type);
  const detailReferences = generationMeta.references.length > 0
    ? generationMeta.references
    : references.map((reference, index) => ({
        id: String(reference.id || `reference-${index}`),
        type: String(reference.frameRole || reference.sourceKind || 'reference'),
        label: String(reference.label || `参考素材 ${index + 1}`),
        url: String(reference.previewUrl || '').trim(),
      }));
  const currentMediaMetadata = mediaMetadata.url === selectedOutput?.url
    ? mediaMetadata
    : { width: 0, height: 0, duration: 0 };
  const mediaWidth = currentMediaMetadata.width || selectedOutput?.width || 0;
  const mediaHeight = currentMediaMetadata.height || selectedOutput?.height || 0;
  const mediaDuration = currentMediaMetadata.duration || selectedOutput?.duration || 0;
  const fileSize = formatFileSize(selectedOutput?.fileSize || node?.mediaFileSize);
  const displayModel = generationMeta.model || node?.model || '';
  const displayPrompt = generationMeta.prompt || String(node?.content || '').trim();
  const displayAspectRatio = generationMeta.aspectRatio || node?.aspectRatio || '';
  const displayResolution = generationMeta.resolution || node?.resolution || '';
  const displayDuration =
    generationMeta.durationSeconds || Number(node?.durationSeconds) || mediaDuration;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function closeFromKeyboard(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusableElements = viewerRef.current?.querySelectorAll(
          'button:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements?.length) {
          return;
        }
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    window.addEventListener('keydown', closeFromKeyboard);
    return () => {
      window.removeEventListener('keydown', closeFromKeyboard);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  if (!node || !selectedOutput?.url) {
    return null;
  }

  return (
    <div
      className={styles.mediaDetailMask}
      data-canvas-ignore="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={viewerRef}
        className={styles.mediaDetailViewer}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.mediaDetailPreviewColumn}>
          <div
            className={styles.mediaDetailPreviewStage}
            onDoubleClickCapture={preventNativeVideoFullscreen}
          >
            {isVideo ? (
              <video
                key={selectedOutput.url}
                className="media-detail-main-video"
                data-disable-native-fullscreen="true"
                src={selectedOutput.url}
                controls
                controlsList="noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                autoPlay
                preload="metadata"
                playsInline
                onDoubleClick={preventNativeVideoFullscreen}
                onLoadedMetadata={(event) => {
                  const media = event.currentTarget;
                  setMediaMetadata({
                    url: selectedOutput.url,
                    width: media.videoWidth || 0,
                    height: media.videoHeight || 0,
                    duration: Number.isFinite(media.duration) ? media.duration : 0,
                  });
                }}
              />
            ) : (
              <img
                key={selectedOutput.url}
                src={selectedOutput.url}
                alt={node.mediaFileName || node.title || '图片详情'}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setMediaMetadata({
                    url: selectedOutput.url,
                    width: image.naturalWidth || 0,
                    height: image.naturalHeight || 0,
                    duration: 0,
                  });
                }}
              />
            )}
          </div>

          {outputs.length > 1 ? (
            <div className={styles.mediaDetailOutputList} aria-label="生成结果列表">
              {outputs.map((output, index) => (
                <button
                  key={`${output.id}-${output.url}`}
                  className={index === safeSelectedOutputIndex ? styles.mediaDetailOutputActive : ''}
                  type="button"
                  aria-label={`查看第 ${index + 1} 个生成结果`}
                  aria-pressed={index === safeSelectedOutputIndex}
                  onClick={() => setSelectedOutputIndex(index)}
                >
                  {isVideo ? (
                    <video src={output.url} muted preload="metadata" />
                  ) : (
                    <img src={output.url} alt="" />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <aside className={styles.mediaDetailInfoPanel}>
          <header className={styles.mediaDetailHeader}>
            <div>
              <strong id="media-detail-title">
                {isUploadedResource ? '素材信息' : '生成信息'}
              </strong>
              <span>{node.title}</span>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="关闭详情"
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className={styles.mediaDetailInfoBody}>
            {displayModel ? (
              <div className={styles.mediaDetailField}>
                <span>模型</span>
                <strong>{displayModel}</strong>
              </div>
            ) : null}
            {displayAspectRatio ? (
              <div className={styles.mediaDetailField}>
                <span>比例</span>
                <strong>{displayAspectRatio}</strong>
              </div>
            ) : null}
            {displayResolution ? (
              <div className={styles.mediaDetailField}>
                <span>分辨率</span>
                <strong>{displayResolution}</strong>
              </div>
            ) : null}
            {isVideo && displayDuration ? (
              <div className={styles.mediaDetailField}>
                <span>时长</span>
                <strong>{formatMediaTime(displayDuration)}</strong>
              </div>
            ) : null}

            {detailReferences.length > 0 ? (
              <div className={styles.mediaDetailSection}>
                <span>参考素材（{detailReferences.length}）</span>
                <div className={styles.mediaDetailReferences}>
                  {detailReferences.map((reference) => (
                    <div key={`${reference.id}-${reference.url}`} title={reference.label}>
                      {reference.url ? (
                        <img src={reference.url} alt={reference.label} />
                      ) : (
                        <span aria-hidden>图</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {displayPrompt ? (
              <div className={styles.mediaDetailSection}>
                <span>提示词</span>
                <p className={styles.mediaDetailPrompt}>{displayPrompt}</p>
              </div>
            ) : null}

            {!isUploadedResource ? (
              <div className={styles.mediaDetailField}>
                <span>生成时间</span>
                <strong>{formatGenerationDate(generationMeta.generatedAt)}</strong>
              </div>
            ) : null}

            <div className={styles.mediaDetailSection}>
              <span>{isVideo ? '视频信息' : '图片信息'}</span>
              <dl className={styles.mediaDetailMetadata}>
                {mediaWidth && mediaHeight ? (
                  <div>
                    <dt>尺寸</dt>
                    <dd>{mediaWidth} × {mediaHeight}</dd>
                  </div>
                ) : null}
                {fileSize ? (
                  <div>
                    <dt>大小</dt>
                    <dd>{fileSize}</dd>
                  </div>
                ) : null}
                {node.mediaFileName ? (
                  <div>
                    <dt>文件名</dt>
                    <dd title={node.mediaFileName}>{node.mediaFileName}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>类型</dt>
                  <dd>{node.mediaMimeType || selectedOutput?.mimeType || (isVideo ? '视频' : '图片')}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function createDefaultVideoFrameExtractorState() {
  return {
    nodeId: '',
    currentTime: 0,
    duration: 0,
    isSeeking: false,
    isExtracting: false,
    error: '',
  };
}

function VideoFrameExtractorDialog({
  node,
  state,
  videoRef,
  onClose,
  onExtract,
  onVideoStateChange,
  onVideoError,
}) {
  const canExtract =
    Boolean(node?.mediaPreviewUrl) &&
    state.duration > 0 &&
    !state.isSeeking &&
    !state.isExtracting;

  function seekToTime(event) {
    const video = videoRef.current;
    if (!video || !state.duration) {
      return;
    }
    const nextTime = Number(event.target.value);
    video.pause();
    video.currentTime = Math.min(
      state.duration,
      Math.max(0, Number.isFinite(nextTime) ? nextTime : 0),
    );
    onVideoStateChange(video, { isSeeking: true });
  }

  return (
    <div
      className={styles.frameExtractorMask}
      data-canvas-ignore="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="frame-extractor-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.frameExtractorPanel}
        data-canvas-ignore="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.frameExtractorHeader}>
          <div>
            <strong id="frame-extractor-title">提取视频画面</strong>
            <span>{node?.title || '视频节点'}</span>
          </div>
          <button
            className={styles.frameExtractorCloseButton}
            type="button"
            aria-label="关闭抽帧窗口"
            disabled={state.isExtracting}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.frameExtractorPreview}>
          <video
            ref={videoRef}
            crossOrigin="anonymous"
            src={node?.mediaPreviewUrl || ''}
            controls
            preload="auto"
            playsInline
            onLoadedMetadata={(event) =>
              onVideoStateChange(event.currentTarget)
            }
            onDurationChange={(event) =>
              onVideoStateChange(event.currentTarget)
            }
            onTimeUpdate={(event) =>
              onVideoStateChange(event.currentTarget)
            }
            onSeeking={(event) =>
              onVideoStateChange(event.currentTarget, { isSeeking: true })
            }
            onSeeked={(event) =>
              onVideoStateChange(event.currentTarget, { isSeeking: false })
            }
            onError={onVideoError}
          />
        </div>

        <div className={styles.frameExtractorTimeline}>
          <div className={styles.frameExtractorTimeRow}>
            <strong>{formatPreciseMediaTime(state.currentTime)}</strong>
            <span>{formatPreciseMediaTime(state.duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(0, state.duration)}
            step="0.001"
            value={Math.min(state.currentTime, state.duration || 0)}
            disabled={!state.duration || state.isExtracting}
            aria-label="选择要提取的视频时间点"
            onChange={seekToTime}
          />
          <p>拖动时间轴或使用视频控制条，停在需要的画面后提取。</p>
        </div>

        {state.error ? (
          <div className={styles.frameExtractorError} role="alert">
            {state.error}
          </div>
        ) : null}

        <footer className={styles.frameExtractorFooter}>
          <span aria-live="polite">
            {state.isExtracting
              ? '正在提取并保存图片资源…'
              : state.isSeeking
                ? '正在定位目标画面…'
              : `当前时间 ${formatPreciseMediaTime(state.currentTime)}`}
          </span>
          <button
            className={styles.frameExtractorPrimaryButton}
            type="button"
            disabled={!canExtract}
            onClick={onExtract}
          >
            {state.isExtracting ? '提取中…' : '提取当前帧'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AudioWaveformPlayer({ src, fileName }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function syncAudioState(audio) {
    const nextDuration = Number.isFinite(audio?.duration) ? audio.duration : 0;
    const nextCurrentTime = Number.isFinite(audio?.currentTime) ? audio.currentTime : 0;
    setDuration(nextDuration);
    setCurrentTime(nextCurrentTime);
  }

  async function togglePlayback(event) {
    event.preventDefault();
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  function seekFromPointer(event) {
    event.preventDefault();
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = progress * duration;
    syncAudioState(audio);
  }

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <div
      className={styles.audioWaveformPlayer}
      style={{ '--audio-progress': progress }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <audio
        ref={audioRef}
        className={styles.audioWaveformMedia}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => syncAudioState(event.currentTarget)}
        onTimeUpdate={(event) => syncAudioState(event.currentTarget)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={(event) => {
          setIsPlaying(false);
          syncAudioState(event.currentTarget);
        }}
      />
      <button
        className={styles.audioWaveformGraph}
        type="button"
        aria-label={fileName ? `${fileName} 音频波形，点击跳转播放进度` : '音频波形，点击跳转播放进度'}
        onPointerDown={seekFromPointer}
      >
        <span className={styles.audioWaveformProgress} aria-hidden />
        <span className={styles.audioWaveformPlayhead} aria-hidden />
        <span className={styles.audioWaveformBars} aria-hidden>
          {AUDIO_WAVEFORM_BARS.map((height, index) => (
            <span
              // The waveform is decorative and intentionally deterministic.
              key={`${index}-${height}`}
              className={styles.audioWaveformBar}
              style={{ '--bar-height': height }}
            />
          ))}
        </span>
      </button>
      <div className={styles.audioControlRow}>
        <span className={styles.audioTimeLabel}>
          {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
        </span>
        <button
          className={`${styles.audioPlayButton} ${isPlaying ? styles.audioPlayButtonActive : ''}`}
          type="button"
          aria-label={isPlaying ? '暂停音频' : '播放音频'}
          onClick={togglePlayback}
        >
          <span aria-hidden />
        </button>
      </div>
    </div>
  );
}

function getNodeAlignmentAnchors(node) {
  return {
    vertical: [
      { key: 'left', value: node.x },
      { key: 'center', value: node.x + node.width / 2 },
      { key: 'right', value: node.x + node.width },
    ],
    horizontal: [
      { key: 'top', value: node.y },
      { key: 'middle', value: node.y + node.height / 2 },
      { key: 'bottom', value: node.y + node.height },
    ],
  };
}

function buildAlignmentGuides(movingNodes, staticNodes) {
  if (!Array.isArray(movingNodes) || movingNodes.length === 0 || !Array.isArray(staticNodes) || staticNodes.length === 0) {
    return { vertical: [], horizontal: [] };
  }

  const vertical = [];
  const horizontal = [];

  movingNodes.forEach((movingNode) => {
    const movingAnchors = getNodeAlignmentAnchors(movingNode);
    staticNodes.forEach((staticNode) => {
      const staticAnchors = getNodeAlignmentAnchors(staticNode);
      movingAnchors.vertical.forEach((movingAnchor) => {
        staticAnchors.vertical.forEach((staticAnchor) => {
          if (Math.abs(movingAnchor.value - staticAnchor.value) <= ALIGN_GUIDE_THRESHOLD) {
            vertical.push(Math.round(staticAnchor.value));
          }
        });
      });
      movingAnchors.horizontal.forEach((movingAnchor) => {
        staticAnchors.horizontal.forEach((staticAnchor) => {
          if (Math.abs(movingAnchor.value - staticAnchor.value) <= ALIGN_GUIDE_THRESHOLD) {
            horizontal.push(Math.round(staticAnchor.value));
          }
        });
      });
    });
  });

  return {
    vertical: Array.from(new Set(vertical)),
    horizontal: Array.from(new Set(horizontal)),
  };
}

function normalizeSelectionBox(box) {
  if (!box) {
    return null;
  }

  return {
    left: Math.min(box.startX, box.currentX),
    top: Math.min(box.startY, box.currentY),
    width: Math.abs(box.currentX - box.startX),
    height: Math.abs(box.currentY - box.startY),
  };
}

function getSelectionWorldRect(box, viewport) {
  const normalizedBox = normalizeSelectionBox(box);
  if (!normalizedBox) {
    return null;
  }

  return {
    left: (normalizedBox.left - viewport.x) / viewport.zoom,
    top: (normalizedBox.top - viewport.y) / viewport.zoom,
    right: (normalizedBox.left + normalizedBox.width - viewport.x) / viewport.zoom,
    bottom: (normalizedBox.top + normalizedBox.height - viewport.y) / viewport.zoom,
  };
}

function doesNodeIntersectRect(node, rect) {
  if (!node || !rect) {
    return false;
  }

  return (
    node.x < rect.right &&
    node.x + node.width > rect.left &&
    node.y < rect.bottom &&
    node.y + node.height > rect.top
  );
}

function findNodeAtPoint(nodes = [], point, excludeNodeId = '') {
  if (!point) {
    return null;
  }

  return [...nodes].reverse().find(
    (node) =>
      node.id !== excludeNodeId &&
      point.x >= node.x - 20 &&
      point.x <= node.x + node.width + 20 &&
      point.y >= node.y - 20 &&
      point.y <= node.y + node.height + 20,
  ) || null;
}

function doRectsIntersect(rectA, rectB) {
  if (!rectA || !rectB) {
    return false;
  }

  return (
    rectA.left < rectB.right &&
    rectA.right > rectB.left &&
    rectA.top < rectB.bottom &&
    rectA.bottom > rectB.top
  );
}

function cubicBezierPoint(start, startControl, endControl, end, t) {
  const inverse = 1 - t;
  const inverse2 = inverse * inverse;
  const t2 = t * t;

  return {
    x:
      inverse2 * inverse * start.x +
      3 * inverse2 * t * startControl.x +
      3 * inverse * t2 * endControl.x +
      t2 * t * end.x,
    y:
      inverse2 * inverse * start.y +
      3 * inverse2 * t * startControl.y +
      3 * inverse * t2 * endControl.y +
      t2 * t * end.y,
  };
}

function doesEdgeIntersectRect(edge, rect, nodeMap) {
  if (!edge || !rect) {
    return false;
  }

  const fromNode = nodeMap[edge.from];
  const toNode = nodeMap[edge.to];
  if (!fromNode || !toNode) {
    return false;
  }

  const points = getConnectorControlPoints(
    getNodePortPosition(fromNode, 'right'),
    getNodePortPosition(toNode, 'left'),
    'right',
    'left',
  );
  const hitPadding = 5;
  const paddedRect = {
    left: rect.left - hitPadding,
    right: rect.right + hitPadding,
    top: rect.top - hitPadding,
    bottom: rect.bottom + hitPadding,
  };

  for (let step = 0; step <= 32; step += 1) {
    const point = cubicBezierPoint(
      points.start,
      points.startControl,
      points.endControl,
      points.end,
      step / 32,
    );

    if (
      point.x >= paddedRect.left &&
      point.x <= paddedRect.right &&
      point.y >= paddedRect.top &&
      point.y <= paddedRect.bottom
    ) {
      return true;
    }
  }

  return false;
}

function getNodesBounds(nodes = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function getFittedViewportForNodes(nodes = [], width = 0, height = 0) {
  const bounds = getNodesBounds(nodes);
  if (!bounds || !width || !height) {
    return { x: -35, y: 90, zoom: 0.64 };
  }

  const padding = 120;
  const availableWidth = Math.max(width - padding * 2, 240);
  const availableHeight = Math.max(height - padding * 2, 180);
  const zoom = clampZoom(
    Math.min(
      availableWidth / Math.max(bounds.width, 1),
      availableHeight / Math.max(bounds.height, 1),
      1.05,
    ),
  );
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  return {
    x: Math.round(width / 2 - centerX * zoom),
    y: Math.round(height / 2 - centerY * zoom),
    zoom,
  };
}

function getViewportWorldRect(viewport, viewportSize) {
  if (!viewportSize?.width || !viewportSize?.height) {
    return null;
  }

  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  const right = (viewportSize.width - viewport.x) / viewport.zoom;
  const bottom = (viewportSize.height - viewport.y) / viewport.zoom;

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

const PROMPT_POPOVER_LAYOUT_BY_NODE_TYPE = {
  script: { width: 640, estimatedHeight: 246 },
  image: { width: 640, estimatedHeight: 262 },
  video: { width: 660, estimatedHeight: 264 },
  audio: { width: 640, estimatedHeight: 285 },
};

function getPromptPopoverScreenStyle(node, viewport, viewportSize, hasReferences = false) {
  const viewportWidth = Math.max(0, viewportSize?.width || 0);
  const viewportHeight = Math.max(0, viewportSize?.height || 0);
  const margin = viewportWidth < 520 ? 12 : 16;
  const gap = viewportWidth < 520 ? 10 : 14;
  const layout = PROMPT_POPOVER_LAYOUT_BY_NODE_TYPE[node.type] || PROMPT_POPOVER_LAYOUT_BY_NODE_TYPE.script;
  const estimatedHeight = layout.estimatedHeight - (hasReferences ? 0 : 74);
  const availableWidth = Math.max(0, viewportWidth - margin * 2);
  const width = Math.min(layout.width, availableWidth);
  const nodeLeft = viewport.x + node.x * viewport.zoom;
  const nodeTop = viewport.y + node.y * viewport.zoom;
  const nodeRight = viewport.x + (node.x + node.width) * viewport.zoom;
  const nodeBottom = viewport.y + (node.y + node.height) * viewport.zoom;
  const desiredLeft = (nodeLeft + nodeRight - width) / 2;
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const left = Math.min(Math.max(desiredLeft, margin), maxLeft);
  const maxTop = Math.max(margin, viewportHeight - estimatedHeight - margin);
  const belowTop = nodeBottom + gap;
  const aboveTop = nodeTop - estimatedHeight - gap;
  const top = belowTop <= maxTop
    ? Math.max(margin, belowTop)
    : aboveTop >= margin
      ? aboveTop
      : Math.min(Math.max(belowTop, margin), maxTop);

  return {
    left,
    top,
    width,
    maxWidth: `calc(100% - ${margin * 2}px)`,
    maxHeight: `calc(100% - ${margin * 2}px)`,
    zIndex: 60,
    transform: 'none',
  };
}

function getExpandedPromptPopoverScreenStyle(viewportSize) {
  const viewportWidth = Math.max(0, viewportSize?.width || 0);
  const viewportHeight = Math.max(0, viewportSize?.height || 0);
  const margin = viewportWidth < 520 ? 8 : 16;
  const availableWidth = Math.max(0, viewportWidth - margin * 2);
  const availableHeight = Math.max(0, viewportHeight - margin * 2);
  const width = Math.min(800, availableWidth);
  const height = Math.min(600, availableHeight);

  return {
    left: Math.max(margin, (viewportWidth - width) / 2),
    top: Math.max(margin, (viewportHeight - height) / 2),
    width,
    height,
    maxWidth: `calc(100% - ${margin * 2}px)`,
    maxHeight: `calc(100% - ${margin * 2}px)`,
    zIndex: 72,
    transform: 'none',
  };
}

function buildMinimapLayout(nodes = [], nodeBounds, viewportWorldRect) {
  if (!nodeBounds && !viewportWorldRect) {
    return null;
  }

  const sourceRects = [nodeBounds, viewportWorldRect].filter(Boolean);
  const rawLeft = Math.min(...sourceRects.map((rect) => rect.left));
  const rawTop = Math.min(...sourceRects.map((rect) => rect.top));
  const rawRight = Math.max(...sourceRects.map((rect) => rect.right));
  const rawBottom = Math.max(...sourceRects.map((rect) => rect.bottom));
  const rawWidth = Math.max(rawRight - rawLeft, 1);
  const rawHeight = Math.max(rawBottom - rawTop, 1);
  const worldPadding = Math.max(160, Math.max(rawWidth, rawHeight) * 0.08);
  const worldBounds = {
    left: rawLeft - worldPadding,
    top: rawTop - worldPadding,
    right: rawRight + worldPadding,
    bottom: rawBottom + worldPadding,
    width: rawWidth + worldPadding * 2,
    height: rawHeight + worldPadding * 2,
  };
  const innerWidth = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
  const innerHeight = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;
  const scale = Math.min(innerWidth / worldBounds.width, innerHeight / worldBounds.height);
  const offsetX = (MINIMAP_WIDTH - worldBounds.width * scale) / 2;
  const offsetY = (MINIMAP_HEIGHT - worldBounds.height * scale) / 2;

  function toMinimapRect(rect) {
    const left = offsetX + (rect.left - worldBounds.left) * scale;
    const top = offsetY + (rect.top - worldBounds.top) * scale;
    const width = Math.max((rect.right - rect.left) * scale, 2);
    const height = Math.max((rect.bottom - rect.top) * scale, 2);

    return {
      left,
      top,
      width,
      height,
    };
  }

  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      rect: toMinimapRect({
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + node.height,
      }),
    })),
    viewportRect: viewportWorldRect ? toMinimapRect(viewportWorldRect) : null,
  };
}

function isEditableElement(target) {
  const tagName = target?.tagName?.toLowerCase?.() || '';
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(target?.isContentEditable);
}

function cloneCanvasGraphData(nodes = [], edges = [], groups = []) {
  return JSON.parse(JSON.stringify({
    nodes,
    edges,
    groups,
  }));
}

function normalizeCanvasEdgePorts(edge) {
  return edge
    ? {
        ...edge,
        fromSide: 'right',
        toSide: 'left',
      }
    : edge;
}

function getCanvasHistorySignature(graphData) {
  return JSON.stringify({
    nodes: graphData.nodes.map((node) =>
      Object.fromEntries(
        Object.entries(node).filter(
          ([field]) => !CANVAS_HISTORY_TRANSIENT_NODE_FIELDS.has(field),
        ),
      ),
    ),
    edges: graphData.edges,
    groups: graphData.groups,
  });
}

function createCanvasHistorySnapshot(nodes = [], edges = [], groups = []) {
  const normalizedEdges = edges.map(normalizeCanvasEdgePorts);
  const signature = getCanvasHistorySignature({ nodes, edges: normalizedEdges, groups });
  const graphData = cloneCanvasGraphData(nodes, normalizedEdges, groups);
  return {
    ...graphData,
    signature,
  };
}

function createEmptyCanvasHistoryState() {
  return {
    past: [],
    present: null,
    future: [],
    pending: null,
    applyingSignature: '',
  };
}

function mergeCanvasHistoryTransientNodeState(historyNodes, currentNodes) {
  const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));
  return historyNodes.map((historyNode) => {
    const currentNode = currentNodeById.get(historyNode.id);
    if (!currentNode) {
      return historyNode;
    }

    const nextNode = { ...historyNode };
    CANVAS_HISTORY_TRANSIENT_NODE_FIELDS.forEach((field) => {
      if (field === 'canvasGroups') {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(currentNode, field)) {
        nextNode[field] = currentNode[field];
      } else {
        delete nextNode[field];
      }
    });
    return nextNode;
  });
}

function shouldLetNestedScrollHandleWheel(target, viewportElement) {
  if (isEditableElement(target)) {
    return true;
  }

  let current = target;
  while (current && current !== viewportElement) {
    if (current.nodeType !== 1) {
      current = current.parentElement;
      continue;
    }

    const style = window.getComputedStyle(current);
    const canScrollY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
    const canScrollX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') && current.scrollWidth > current.clientWidth;

    if (canScrollY || canScrollX) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function blurActiveEditableElement() {
  if (isEditableElement(document.activeElement)) {
    document.activeElement.blur();
  }
}

function getNodeTypeMeta(type) {
  return NODE_TYPES.find((item) => item.type === type) || NODE_TYPES[0];
}

function normalizeNodeInputContent(type, content) {
  const normalizedContent = String(content ?? '');
  const legacyDefaultContent = `配置${getNodeTypeMeta(type).label}节点的输入、生成提示词和输出结果。`;
  return normalizedContent === legacyDefaultContent ? '' : normalizedContent;
}

function getNodePortPosition(node, side = 'right') {
  const positions = {
    left: { x: node.x - CONNECTOR_PORT_OUTSET, y: node.y + node.height / 2 },
    right: { x: node.x + node.width + CONNECTOR_PORT_OUTSET, y: node.y + node.height / 2 },
  };
  return positions[side] || positions.right;
}

function getEdgeGradientId(edgeId, edgeIndex) {
  const safeEdgeId = String(edgeId || 'edge').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `workflow-line-${edgeIndex}-${safeEdgeId}`;
}

function getPortVector(side = 'right') {
  const vectors = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  return vectors[side] || vectors.right;
}

function buildConnectorPath(start, end, startSide = 'right', endSide = 'left') {
  const points = getConnectorControlPoints(start, end, startSide, endSide);

  return [
    `M ${points.start.x} ${points.start.y}`,
    `C ${points.startControl.x} ${points.startControl.y},`,
    `${points.endControl.x} ${points.endControl.y},`,
    `${points.end.x} ${points.end.y}`,
  ].join(' ');
}

function getConnectorControlPoints(start, end, startSide = 'right', endSide = 'left') {
  const distance = Math.max(96, Math.min(320, Math.hypot(end.x - start.x, end.y - start.y) * 0.36));
  const startVector = getPortVector(startSide);
  const endVector = getPortVector(endSide);

  return {
    start,
    startControl: {
      x: start.x + startVector.x * distance,
      y: start.y + startVector.y * distance,
    },
    endControl: {
      x: end.x + endVector.x * distance,
      y: end.y + endVector.y * distance,
    },
    end,
  };
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pickArrayDeep(payload, keys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const key of keys) {
    const value = payload[key];
    if (value && typeof value === 'object') {
      const nested = pickArrayDeep(value, keys);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function pickSeedanceCharacterArray(payload) {
  return pickArrayDeep(payload, [
    'items',
    'characters',
    'virtual_characters',
    'virtualCharacters',
    'records',
    'rows',
    'results',
    'list',
    'data',
  ]);
}

function resolveSeedanceImageUrl(item) {
  const directUrl = String(
    item?.url ??
      item?.asset_url ??
      item?.assetUrl ??
      item?.image_url ??
      item?.imageUrl ??
      item?.cover_url ??
      item?.coverUrl ??
      item?.avatar_url ??
      item?.avatarUrl ??
      item?.preview_url ??
      item?.previewUrl ??
      item?.source_url ??
      item?.sourceUrl ??
      item?.team_asset_url ??
      item?.teamAssetUrl ??
      item?.download_url ??
      item?.downloadUrl ??
      item?.oss_url ??
      item?.ossUrl ??
      item?.local_path ??
      item?.localPath ??
      '',
  ).trim();

  if (directUrl) {
    return directUrl;
  }

  const nestedAssets = pickArrayDeep(item, [
    'assets',
    'asset_list',
    'assetList',
    'character_assets',
    'characterAssets',
    'virtual_character_assets',
    'virtualCharacterAssets',
    'files',
  ]);

  const firstAsset = nestedAssets.find((asset) => resolveSeedanceImageUrl(asset));
  return firstAsset ? resolveSeedanceImageUrl(firstAsset) : '';
}

function getPrimarySeedanceAsset(item) {
  const nestedAssets = pickArrayDeep(item, [
    'assets',
    'asset_list',
    'assetList',
    'character_assets',
    'characterAssets',
    'virtual_character_assets',
    'virtualCharacterAssets',
    'files',
  ]);

  return nestedAssets[0] || {};
}

function getSeedanceVirtualCharacterId(item, index = 0) {
  return String(
    item?.virtual_character_id ??
      item?.virtualCharacterId ??
      item?.character_id ??
      item?.characterId ??
      item?.asset_group_id ??
      item?.assetGroupId ??
      item?.group_id ??
      item?.groupId ??
      item?.id ??
      `seedance-character-${index + 1}`,
  );
}

function getSeedanceVirtualAssetId(item) {
  const primaryAsset = getPrimarySeedanceAsset(item);
  return String(
    item?.virtual_asset_id ??
      item?.virtualAssetId ??
      item?.asset_id ??
      item?.assetId ??
      item?.asset?.virtual_asset_id ??
      item?.asset?.virtualAssetId ??
      item?.asset?.asset_id ??
      item?.asset?.assetId ??
      primaryAsset?.virtual_asset_id ??
      primaryAsset?.virtualAssetId ??
      primaryAsset?.asset_id ??
      primaryAsset?.assetId ??
      '',
  ).trim();
}

function findSeedanceVirtualAssetIdDeep(value, visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) {
    return '';
  }
  visited.add(value);

  const directId = getSeedanceVirtualAssetId(value);
  if (directId) {
    return directId;
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      for (const child of item) {
        const childId = findSeedanceVirtualAssetIdDeep(child, visited);
        if (childId) {
          return childId;
        }
      }
    } else if (item && typeof item === 'object') {
      const childId = findSeedanceVirtualAssetIdDeep(item, visited);
      if (childId) {
        return childId;
      }
    }
  }

  return '';
}

function getSeedanceAssetStatus(item) {
  const primaryAsset = getPrimarySeedanceAsset(item);
  return String(
    item?.status ??
      item?.asset_status ??
      item?.assetStatus ??
      item?.asset?.status ??
      item?.asset?.asset_status ??
      item?.asset?.assetStatus ??
      primaryAsset?.status ??
      primaryAsset?.asset_status ??
      primaryAsset?.assetStatus ??
      '',
  ).trim();
}

function findSeedanceAssetStatusDeep(value, virtualAssetId = '', visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) {
    return '';
  }
  visited.add(value);

  const directAssetId = getSeedanceVirtualAssetId(value);
  const directStatus = getSeedanceAssetStatus(value);
  if (directStatus && (!virtualAssetId || directAssetId === virtualAssetId || !directAssetId)) {
    return directStatus;
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      for (const child of item) {
        const childStatus = findSeedanceAssetStatusDeep(child, virtualAssetId, visited);
        if (childStatus) {
          return childStatus;
        }
      }
    } else if (item && typeof item === 'object') {
      const childStatus = findSeedanceAssetStatusDeep(item, virtualAssetId, visited);
      if (childStatus) {
        return childStatus;
      }
    }
  }

  return '';
}

function isSeedanceVirtualAssetActive(status) {
  return String(status || '').trim().toLowerCase() === SEEDANCE_VIRTUAL_ASSET_ACTIVE_STATUS;
}

function getSeedanceCharacterId(item, index) {
  return `${getSeedanceVirtualCharacterId(item, index)}:${getSeedanceVirtualAssetId(item) || index}`;
}

function normalizeSeedanceCharacters(payload) {
  return pickSeedanceCharacterArray(payload).map((item, index) => {
    const primaryAsset = getPrimarySeedanceAsset(item);
    const createdAt = item?.updated_at || item?.updatedAt || item?.created_at || item?.createdAt || '';
    const imageUrl = resolveSeedanceImageUrl(item);
    const status = getSeedanceAssetStatus(item);
    return {
      id: getSeedanceCharacterId(item, index),
      virtualCharacterId: getSeedanceVirtualCharacterId(item, index),
      virtualAssetId: getSeedanceVirtualAssetId(item),
      name:
        String(
          item?.name ??
            item?.character_name ??
            item?.characterName ??
            primaryAsset?.name ??
            primaryAsset?.asset_name ??
            primaryAsset?.assetName ??
            item?.title ??
            `真人照片 ${index + 1}`,
        ).trim() || `真人照片 ${index + 1}`,
      description: String(item?.description ?? item?.desc ?? primaryAsset?.description ?? primaryAsset?.desc ?? item?.prompt ?? '').trim(),
      imageUrl,
      createdAt,
      status,
      isActive: isSeedanceVirtualAssetActive(status),
    };
  });
}

function normalizeSeedanceVirtualAssets(value) {
  const assets = Array.isArray(value) ? value : parseJsonArray(value);
  return assets
    .map((asset) => {
      const virtualAssetId = String(
        asset?.virtualAssetId ?? asset?.virtual_asset_id ?? asset?.assetId ?? asset?.asset_id ?? asset?.id ?? '',
      ).trim();
      if (!virtualAssetId) {
        return null;
      }

      return {
        virtualAssetId,
        role: String(asset?.role || 'reference_image').trim() || 'reference_image',
      };
    })
    .filter(Boolean);
}

function getSeedanceVirtualAssetIds(value) {
  return normalizeSeedanceVirtualAssets(value).map((asset) => asset.virtualAssetId);
}

function normalizeVideoFrameAsset(value, fallbackRole = '') {
  const asset = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const url = String(
    asset.url ??
      asset.assetUrl ??
      asset.asset_url ??
      asset.imageUrl ??
      asset.image_url ??
      '',
  ).trim();
  if (!url) {
    return null;
  }

  return {
    url,
    role: String(asset.role || fallbackRole).trim() || fallbackRole,
    fileName: String(asset.fileName ?? asset.file_name ?? asset.name ?? '').trim(),
    contentJson: firstObject(asset.contentJson, asset.content_json),
  };
}

function getVideoFrameAsset(node, role) {
  if (!node || node.type !== 'video') {
    return null;
  }
  return normalizeVideoFrameAsset(
    role === VIDEO_INPUT_ROLE_END_FRAME ? node.endFrameAsset : node.firstFrameAsset,
    role,
  );
}

function getVideoFrameUploadRoles(mode) {
  return mode === VIDEO_INPUT_MODE_FIRST_END_FRAME
    ? [VIDEO_INPUT_ROLE_FIRST_FRAME, VIDEO_INPUT_ROLE_END_FRAME]
    : mode === VIDEO_INPUT_MODE_FIRST_FRAME
      ? [VIDEO_INPUT_ROLE_FIRST_FRAME]
      : [];
}

function getVideoFrameRoleDisplayOrder(role, fallbackIndex = 0) {
  if (role === VIDEO_INPUT_ROLE_FIRST_FRAME) {
    return 0;
  }
  if (role === VIDEO_INPUT_ROLE_END_FRAME) {
    return 1;
  }
  return fallbackIndex + 2;
}

function isInternalVideoFrameNode(node) {
  return Boolean(
    node &&
      node.type === 'upload_image' &&
      node.videoInputTargetNodeId &&
      [VIDEO_INPUT_ROLE_FIRST_FRAME, VIDEO_INPUT_ROLE_END_FRAME].includes(
        node.videoInputRole,
      ),
  );
}

function isInternalVideoFrameEdge(edge, nodeMap = {}) {
  const sourceNode = nodeMap[edge?.from];
  const targetNode = nodeMap[edge?.to];
  return Boolean(
    isInternalVideoFrameNode(sourceNode) ||
      isInternalVideoFrameNode(targetNode),
  );
}

function getInternalVideoFrameNode(
  nodes = [],
  videoNodeId,
  role,
) {
  return nodes.find(
    (node) =>
      isInternalVideoFrameNode(node) &&
      node.videoInputTargetNodeId === videoNodeId &&
      node.videoInputRole === role,
  ) || null;
}

function clearVideoFrameAssetState(node, roles = []) {
  if (!node || node.type !== 'video' || roles.length === 0) {
    return node;
  }
  const roleSet = new Set(roles);
  const nextParamValuesJson = { ...(node.paramValuesJson || {}) };
  if (roleSet.has(VIDEO_INPUT_ROLE_FIRST_FRAME)) {
    ['firstFrameUrl', 'first_frame_url', 'firstFrameAsset', 'first_frame_asset']
      .forEach((key) => delete nextParamValuesJson[key]);
  }
  if (roleSet.has(VIDEO_INPUT_ROLE_END_FRAME)) {
    ['endFrameUrl', 'end_frame_url', 'endFrameAsset', 'end_frame_asset']
      .forEach((key) => delete nextParamValuesJson[key]);
  }
  return {
    ...node,
    paramValuesJson: nextParamValuesJson,
    ...(roleSet.has(VIDEO_INPUT_ROLE_FIRST_FRAME)
      ? { firstFrameAsset: null }
      : {}),
    ...(roleSet.has(VIDEO_INPUT_ROLE_END_FRAME)
      ? { endFrameAsset: null }
      : {}),
  };
}

function getNodeInputReferenceThumbnails(node, edges = [], nodeMap = {}, seedanceCharacters = []) {
  if (!node) {
    return [];
  }

  const connectedNodeReferences = edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => ({ edge, sourceNode: nodeMap[edge.from] }))
    .filter(({ sourceNode }) => {
      const mediaType = getNodeMediaType(sourceNode);
      if (isInternalVideoFrameNode(sourceNode)) {
        return Boolean(String(sourceNode.mediaPreviewUrl || '').trim());
      }
      return mediaType === 'text' || mediaType === 'image' || mediaType === 'video';
    })
    .map(({ edge, sourceNode }) => {
      const mediaPreviewUrl = String(sourceNode.mediaPreviewUrl || '').trim();
      const sourceMediaType = getNodeMediaType(sourceNode);
      const previewType =
        sourceMediaType === 'text'
          ? 'text'
          : sourceMediaType === 'image'
            ? mediaPreviewUrl
              ? 'image'
              : 'image-empty'
            : mediaPreviewUrl
              ? 'video'
              : 'video-empty';
      const sourceTypeLabel =
        sourceMediaType === 'text' ? '文本' : sourceMediaType === 'image' ? '图片' : '视频';
      const isInternalFrame = isInternalVideoFrameNode(sourceNode);

      return {
        id: `connected-${edge.id}`,
        sourceKind: isInternalFrame ? 'internal-frame' : 'edge',
        edgeId: edge.id,
        sourceNodeId: sourceNode.id,
        frameRole: isInternalFrame ? sourceNode.videoInputRole : '',
        virtualAssetId: String(sourceNode.seedanceVirtualAssetId || '').trim(),
        previewType,
        previewUrl: mediaPreviewUrl,
        previewText:
          sourceMediaType === 'text'
            ? String(sourceNode.content || sourceNode.textPromptContent || '').trim()
            : '',
        label: isInternalFrame
          ? sourceNode.videoInputRole === VIDEO_INPUT_ROLE_END_FRAME
            ? '已上传尾帧'
            : '已上传首帧'
          : `连线${sourceTypeLabel}：${sourceNode.title || `${sourceTypeLabel}节点`}`,
      };
    });

  const characterByAssetId = seedanceCharacters.reduce((map, character) => {
    if (character.virtualAssetId) {
      map.set(character.virtualAssetId, character);
    }
    return map;
  }, new Map());
  const connectedVirtualAssetIds = new Set(
    connectedNodeReferences
      .map((reference) => reference.virtualAssetId)
      .filter(Boolean),
  );
  const seenVirtualAssetIds = new Set();
  const virtualCharacterReferences = (node.type === 'video'
    ? normalizeSeedanceVirtualAssets(node.seedanceVirtualAssets)
    : [])
    .filter((asset) => {
      if (
        connectedVirtualAssetIds.has(asset.virtualAssetId) ||
        seenVirtualAssetIds.has(asset.virtualAssetId)
      ) {
        return false;
      }
      seenVirtualAssetIds.add(asset.virtualAssetId);
      return true;
    })
    .map((asset) => {
      const character = characterByAssetId.get(asset.virtualAssetId);
      return {
        id: `virtual-${asset.virtualAssetId}`,
        sourceKind: 'virtual-asset',
        virtualAssetId: asset.virtualAssetId,
        previewType: character?.imageUrl ? 'image' : 'image-empty',
        previewUrl: String(character?.imageUrl || '').trim(),
        label: `虚拟角色：${character?.name || asset.virtualAssetId}`,
      };
    });

  const directFrameRoles =
    node.type === 'video' ? getVideoFrameUploadRoles(node.videoInputMode) : [];
  const internalFrameRoles = new Set(
    connectedNodeReferences
      .filter((reference) => reference.sourceKind === 'internal-frame')
      .map((reference) => reference.frameRole),
  );
  const directFrameReferences = node.type === 'video'
    ? directFrameRoles
        .filter((role) => !internalFrameRoles.has(role))
        .map((role) => ({ role, asset: getVideoFrameAsset(node, role) }))
        .filter(({ asset }) => Boolean(asset))
        .map(({ role, asset }) => ({
          id: `direct-${role}`,
          sourceKind: 'direct-frame',
          frameRole: role,
          previewType: 'image',
          previewUrl: asset.url,
          label: role === VIDEO_INPUT_ROLE_END_FRAME ? '已上传尾帧' : '已上传首帧',
        }))
    : [];

  return [...connectedNodeReferences, ...directFrameReferences, ...virtualCharacterReferences];
}

function removeCanvasGraphItems(
  nodes = [],
  edges = [],
  nodeIds = [],
  edgeIds = [],
) {
  const removedNodeIds =
    nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  nodes.forEach((node) => {
    if (
      isInternalVideoFrameNode(node) &&
      removedNodeIds.has(node.videoInputTargetNodeId)
    ) {
      removedNodeIds.add(node.id);
    }
  });
  const explicitlyRemovedEdgeIds =
    edgeIds instanceof Set ? edgeIds : new Set(edgeIds);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const removedEdges = [];
  const nextEdges = edges.filter((edge) => {
    const shouldRemove =
      explicitlyRemovedEdgeIds.has(edge.id) ||
      removedNodeIds.has(edge.from) ||
      removedNodeIds.has(edge.to);
    if (shouldRemove) {
      removedEdges.push(edge);
    }
    return !shouldRemove;
  });
  const removedConnectionKeys = new Set(
    removedEdges.map((edge) => `${edge.from}\u0000${edge.to}`),
  );
  const virtualAssetIdsByTargetNodeId = new Map();

  function trackRemovedVirtualAsset(targetNodeId, virtualAssetId) {
    const normalizedTargetNodeId = String(targetNodeId || '').trim();
    const normalizedVirtualAssetId = String(virtualAssetId || '').trim();
    if (
      !normalizedTargetNodeId ||
      !normalizedVirtualAssetId ||
      removedNodeIds.has(normalizedTargetNodeId) ||
      nextEdges.some(
        (edge) =>
          edge.to === normalizedTargetNodeId &&
          nodeById.get(edge.from)?.seedanceVirtualAssetId ===
            normalizedVirtualAssetId,
      )
    ) {
      return;
    }
    const assetIds =
      virtualAssetIdsByTargetNodeId.get(normalizedTargetNodeId) || new Set();
    assetIds.add(normalizedVirtualAssetId);
    virtualAssetIdsByTargetNodeId.set(normalizedTargetNodeId, assetIds);
  }

  removedEdges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.from);
    trackRemovedVirtualAsset(
      edge.to,
      sourceNode?.seedanceVirtualAssetId,
    );
  });
  nodes.forEach((node) => {
    if (!removedNodeIds.has(node.id)) {
      return;
    }
    trackRemovedVirtualAsset(
      node.seedanceVirtualAssetTargetNodeId,
      node.seedanceVirtualAssetId,
    );
  });

  const nextNodes = nodes
    .filter((node) => !removedNodeIds.has(node.id))
    .map((node) => {
      let nextNode = node;
      const removedVideoInputBinding =
        Boolean(node.videoInputTargetNodeId) &&
        (removedNodeIds.has(node.videoInputTargetNodeId) ||
          removedConnectionKeys.has(
            `${node.id}\u0000${node.videoInputTargetNodeId}`,
          ));
      const removedVirtualAssetBinding =
        Boolean(node.seedanceVirtualAssetTargetNodeId) &&
        (removedNodeIds.has(node.seedanceVirtualAssetTargetNodeId) ||
          removedConnectionKeys.has(
            `${node.id}\u0000${node.seedanceVirtualAssetTargetNodeId}`,
          ));
      if (removedVideoInputBinding || removedVirtualAssetBinding) {
        nextNode = {
          ...nextNode,
          ...(removedVideoInputBinding
            ? {
                videoInputRole: '',
                videoInputTargetNodeId: '',
              }
            : {}),
          ...(removedVirtualAssetBinding
            ? { seedanceVirtualAssetTargetNodeId: '' }
            : {}),
        };
      }

      const removedVirtualAssetIds =
        virtualAssetIdsByTargetNodeId.get(node.id);
      if (!removedVirtualAssetIds?.size) {
        return nextNode;
      }
      const nextVirtualAssets = normalizeSeedanceVirtualAssets(
        node.seedanceVirtualAssets,
      ).filter(
        (asset) => !removedVirtualAssetIds.has(asset.virtualAssetId),
      );
      return {
        ...nextNode,
        seedanceVirtualAssets: nextVirtualAssets,
        ...(nextVirtualAssets.length === 0 &&
        node.videoModelCapabilityMode ===
          VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER
          ? {
              modeType: '',
              videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
              videoModelCapabilityMode: VIDEO_INPUT_MODE_REFERENCE,
            }
          : {}),
      };
    });

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
}

function VideoReferencePlaceholderIcon({ type }) {
  if (type === 'text') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden>
        <path d="M11 13h14M11 18h14M11 23h9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'video-empty') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden>
        <rect x="8.5" y="10.5" width="19" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m16 14 7 4-7 4z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 36 36" aria-hidden>
      <circle cx="23.5" cy="12.5" r="2.5" fill="currentColor" />
      <path d="m8 26 7-10 4.5 6 3-4 5.5 8z" fill="currentColor" />
    </svg>
  );
}

function ModelOptionThumbnail({ model, compact = false }) {
  const thumbnailUrl = String(model?.thumbnailUrl || '').trim();
  return (
    <span
      className={`${styles.modelOptionThumbnail} ${compact ? styles.modelOptionThumbnailCompact : ''}`}
      aria-hidden="true"
    >
      <span className={styles.modelOptionThumbnailFallback}>—</span>
      {thumbnailUrl ? (
        <img
          key={thumbnailUrl}
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </span>
  );
}

function getFileBaseName(fileName) {
  const normalized = String(fileName || '').trim();
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\.[^.]+$/, '');
}

function validateImageFileDimensions(file) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').toLowerCase().startsWith('image/')) {
      reject(new Error('只能上传图片文件'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const { naturalWidth, naturalHeight } = image;
      URL.revokeObjectURL(objectUrl);
      if (
        naturalWidth < IMAGE_DIMENSION_LIMIT.min ||
        naturalHeight < IMAGE_DIMENSION_LIMIT.min ||
        naturalWidth > IMAGE_DIMENSION_LIMIT.max ||
        naturalHeight > IMAGE_DIMENSION_LIMIT.max
      ) {
        reject(new Error('图片宽高需在 300px ~ 6000px 之间'));
        return;
      }
      resolve({ width: naturalWidth, height: naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片读取失败，请更换图片后重试'));
    };
    image.src = objectUrl;
  });
}

function normalizeConnectableTargetTypes(value) {
  return parseJsonArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && CONNECTABLE_TARGET_TYPE_MAP[item]);
}

function getNodeConnectableTargetTypes(...values) {
  for (const value of values) {
    const normalized = normalizeConnectableTargetTypes(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function getDefaultConnectableTargetTypes(type) {
  return [...(DEFAULT_CONNECTABLE_TARGET_TYPES_BY_NODE_TYPE[type] || [])];
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};
}

function firstJsonObject(...values) {
  return values.map((value) => parseJsonObject(value)).find((value) => Object.keys(value).length > 0) || {};
}

function normalizeGenerationStatus(...values) {
  for (const value of values) {
    const status = String(value ?? '').trim().toLowerCase();
    if (status) {
      return status;
    }
  }
  return '';
}

function isActiveGenerationStatus(status) {
  return ACTIVE_GENERATION_STATUSES.includes(String(status || '').trim().toLowerCase());
}

function isSuccessGenerationStatus(status) {
  return SUCCESS_GENERATION_STATUSES.includes(String(status || '').trim().toLowerCase());
}

function isFailureGenerationStatus(status) {
  return FAILURE_GENERATION_STATUSES.includes(String(status || '').trim().toLowerCase());
}

function getUiStatusFromGenerationStatus(status, fallback = 'idle') {
  if (isActiveGenerationStatus(status)) {
    return status;
  }
  if (isSuccessGenerationStatus(status)) {
    return 'success';
  }
  if (isFailureGenerationStatus(status)) {
    return 'failed';
  }
  return fallback || 'idle';
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getGraphVersion(graph) {
  return toFiniteNumber(
    graph?.version_no ?? graph?.versionNo ?? graph?.version ?? graph?.canvas?.version_no ?? graph?.canvas?.version,
    null,
  );
}

function pickGraphArray(graph, ...keys) {
  for (const key of keys) {
    const value = graph?.[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function pickFreeCanvasModelArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of ['models', 'items', 'list', 'records', 'rows', 'results', 'data']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = pickFreeCanvasModelArray(value);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function normalizeModelNodeType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const codeMap = {
    1: 'script',
    text: 'script',
    txt: 'script',
    2: 'image',
    img: 'image',
    image: 'image',
    3: 'video',
    vod: 'video',
    video: 'video',
    4: 'audio',
    voice: 'audio',
    audio: 'audio',
  };

  return codeMap[normalized] || '';
}

function normalizeCanvasGroup(rawGroup) {
  if (!rawGroup || typeof rawGroup !== 'object') {
    return null;
  }

  const id = String(rawGroup.id || '').trim();
  const x = toFiniteNumber(rawGroup.x, NaN);
  const y = toFiniteNumber(rawGroup.y, NaN);
  const width = toFiniteNumber(rawGroup.width, NaN);
  const height = toFiniteNumber(rawGroup.height, NaN);
  if (!id || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    id,
    title: String(rawGroup.title || '分组'),
    x,
    y,
    width,
    height,
  };
}

function getNodeSelectionRegion(nodes = [], padding = SELECTION_REGION_PADDING) {
  const bounds = getNodesBounds(nodes);
  if (!bounds) {
    return null;
  }

  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.right + padding,
    bottom: bounds.bottom + padding,
  };
}

function getSharedExistingGroupId(selectedNodes = [], groups = []) {
  if (selectedNodes.length === 0 || selectedNodes.some((node) => !node.groupId)) {
    return '';
  }

  const groupIds = new Set(selectedNodes.map((node) => node.groupId));
  if (groupIds.size !== 1) {
    return '';
  }

  const [groupId] = groupIds;
  return groups.some((group) => group.id === groupId) ? groupId : '';
}

function getEntitySequenceFloor(items = []) {
  return items.reduce((highestSequence, item) => {
    const id = String(item?.id ?? item ?? '').trim();
    const sequence = Number(id.match(/-(\d+)$/)?.[1] || 0);
    return Math.max(
      highestSequence,
      Number.isFinite(sequence) ? sequence : 0,
    );
  }, items.length);
}

function getNodeContainingGroup(groups = [], node) {
  if (!node) {
    return null;
  }

  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  return [...groups].reverse().find(
    (group) =>
      centerX >= group.x &&
      centerX <= group.x + group.width &&
      centerY >= group.y &&
      centerY <= group.y + group.height,
  ) || null;
}

function resolveNodeDropGroup(groups = [], node, originalGroupId = '') {
  if (!node) {
    return null;
  }

  const originalGroup = originalGroupId
    ? groups.find((group) => group.id === originalGroupId)
    : null;
  if (
    originalGroup &&
    doesNodeIntersectRect(node, {
      left: originalGroup.x,
      top: originalGroup.y,
      right: originalGroup.x + originalGroup.width,
      bottom: originalGroup.y + originalGroup.height,
    })
  ) {
    return originalGroup;
  }

  return getNodeContainingGroup(groups, node);
}

function expandGroupToContainNodes(group, memberNodes = [], padding = GROUP_CONTENT_PADDING) {
  const bounds = getNodesBounds(memberNodes);
  if (!group || !bounds) {
    return group;
  }

  const left = Math.min(group.x, bounds.left - padding);
  const top = Math.min(group.y, bounds.top - padding);
  const right = Math.max(group.x + group.width, bounds.right + padding);
  const bottom = Math.max(group.y + group.height, bounds.bottom + padding);
  if (
    left === group.x &&
    top === group.y &&
    right === group.x + group.width &&
    bottom === group.y + group.height
  ) {
    return group;
  }

  return {
    ...group,
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

function normalizeModelMediaType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const codeMap = {
    1: 'text',
    text: 'text',
    txt: 'text',
    2: 'image',
    img: 'image',
    image: 'image',
    3: 'video',
    vod: 'video',
    video: 'video',
    4: 'audio',
    voice: 'audio',
    audio: 'audio',
  };

  return codeMap[normalized] || '';
}

function normalizeModelInputMediaTypes(model) {
  const value = model?.input_media_types_json ?? model?.inputMediaTypesJson ?? model?.input_media_types ?? model?.inputMediaTypes;
  let rawTypes = [];

  if (Array.isArray(value)) {
    rawTypes = value;
  } else if (typeof value === 'string' && value.trim()) {
    const parsedArray = parseJsonArray(value);
    rawTypes = parsedArray.length > 0 ? parsedArray : value.split(/[,\s]+/);
  } else if (value && typeof value === 'object') {
    const arrayValue = value.types ?? value.mediaTypes ?? value.media_types ?? value.options ?? value.items;
    rawTypes = Array.isArray(arrayValue)
      ? arrayValue
      : Object.entries(value).reduce((items, [key, item]) => {
          if (typeof item === 'boolean') {
            return item ? [...items, key] : items;
          }
          if (Array.isArray(item)) {
            return [...items, ...item];
          }
          if (normalizeModelMediaType(key) && item !== false && item != null) {
            return [...items, key];
          }
          return item == null ? items : [...items, item];
        }, []);
  }

  return rawTypes.reduce((mediaTypes, item) => {
    const mediaType = normalizeModelMediaType(item);
    if (mediaType && !mediaTypes.includes(mediaType)) {
      mediaTypes.push(mediaType);
    }
    return mediaTypes;
  }, []);
}

function getFreeCanvasModelLabel(model) {
  return String(
    model?.display_name ??
      model?.displayName ??
      model?.name ??
      model?.model_name ??
      model?.modelName ??
      model?.request_model ??
      model?.requestModel ??
      '',
  ).trim();
}

function normalizePointsValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPointsValue(value) {
  const parsed = normalizePointsValue(value);
  if (parsed == null) {
    return '--';
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function resolveQuotePoints(quote) {
  return normalizePointsValue(
    quote?.points ??
      quote?.quotePoints ??
      quote?.estimatedPoints ??
      quote?.estimated_points ??
      quote?.cost_points ??
      quote?.costPoints,
  );
}

function resolveWalletAvailablePoints(wallet) {
  if (!wallet || typeof wallet !== 'object') {
    return null;
  }

  const balancePoints = normalizePointsValue(wallet.balancePoints);
  if (wallet.isMainAccount) {
    return balancePoints;
  }

  const availableQuotaPoints = normalizePointsValue(wallet.availableQuotaPoints);
  if (availableQuotaPoints == null) {
    return balancePoints;
  }

  if (balancePoints == null) {
    return availableQuotaPoints;
  }

  return Math.max(0, Math.min(balancePoints, availableQuotaPoints));
}

function resolveFreeCanvasModelId(model) {
  const modelId = normalizePointsValue(
    model?.model_id ??
      model?.modelId ??
      model?.universal_model_id ??
      model?.universalModelId ??
      model?.ai_model_id ??
      model?.aiModelId ??
      model?.id,
  );

  return Number.isInteger(modelId) && modelId > 0 ? modelId : null;
}

function normalizeAspectRatioOption(item) {
  if (item == null) {
    return '';
  }

  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }

  if (typeof item !== 'object') {
    return '';
  }

  return String(
    item.label ??
      item.name ??
      item.value ??
      item.aspect_ratio ??
      item.aspectRatio ??
      item.ratio ??
      '',
  ).trim();
}

function isAdaptiveAspectRatioOption(ratio) {
  const normalized = String(ratio || '').trim().toLowerCase();
  return normalized === '自适应' || normalized === 'auto' || normalized === 'adaptive';
}

function normalizeAspectRatioOptions(value) {
  let rawOptions = [];

  if (Array.isArray(value)) {
    rawOptions = value;
  } else if (typeof value === 'string' && value.trim()) {
    const parsedArray = parseJsonArray(value);
    if (parsedArray.length > 0) {
      rawOptions = parsedArray;
    } else {
      const parsedObject = parseJsonObject(value);
      rawOptions = Array.isArray(parsedObject.options)
        ? parsedObject.options
        : Array.isArray(parsedObject.items)
          ? parsedObject.items
          : Object.values(parsedObject);
    }
  } else if (value && typeof value === 'object') {
    rawOptions = Array.isArray(value.options)
      ? value.options
      : Array.isArray(value.items)
        ? value.items
        : Object.values(value);
  }

  return rawOptions.reduce((ratios, item) => {
    const ratio = normalizeAspectRatioOption(item);
    if (ratio && !isAdaptiveAspectRatioOption(ratio) && !ratios.includes(ratio)) {
      ratios.push(ratio);
    }
    return ratios;
  }, []);
}

function normalizeResolutionOptions(value) {
  let rawOptions = [];

  if (Array.isArray(value)) {
    rawOptions = value;
  } else if (typeof value === 'string' && value.trim()) {
    const parsedArray = parseJsonArray(value);
    if (parsedArray.length > 0) {
      rawOptions = parsedArray;
    } else {
      const parsedObject = parseJsonObject(value);
      rawOptions = Array.isArray(parsedObject.options)
        ? parsedObject.options
        : Array.isArray(parsedObject.items)
          ? parsedObject.items
          : Object.values(parsedObject);
    }
  } else if (value && typeof value === 'object') {
    rawOptions = Array.isArray(value.options)
      ? value.options
      : Array.isArray(value.items)
        ? value.items
        : Object.values(value);
  }

  return rawOptions.reduce((resolutions, item) => {
    const resolution = normalizeAspectRatioOption(item);
    if (resolution && !resolutions.includes(resolution)) {
      resolutions.push(resolution);
    }
    return resolutions;
  }, []);
}

function normalizeModelInputLimit(value) {
  if (value == null || value === '') {
    return null;
  }

  const limit = Number(value);
  return Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : null;
}

function normalizeModelInputLimits(model) {
  return Object.entries(MODEL_INPUT_LIMIT_FIELDS_BY_MEDIA_TYPE).reduce((limits, [mediaType, keys]) => {
    const rawLimit = keys.map((key) => model?.[key]).find((value) => value != null && value !== '');
    const limit = normalizeModelInputLimit(rawLimit);
    if (limit != null) {
      limits[mediaType] = limit;
    }
    return limits;
  }, {});
}

function normalizeModelExtraJson(model) {
  return firstJsonObject(model?.extra_json, model?.extraJson, model?.metadata_json, model?.metadataJson);
}

function resolveModelThumbnailUrl(model) {
  const extraJson = normalizeModelExtraJson(model);
  const candidates = [
    model?.thumbnail_url,
    model?.thumbnailUrl,
    model?.thumbnail,
    model?.model_thumbnail_url,
    model?.modelThumbnailUrl,
    model?.cover_url,
    model?.coverUrl,
    model?.cover,
    model?.image_url,
    model?.imageUrl,
    model?.image,
    model?.icon_url,
    model?.iconUrl,
    model?.icon,
    model?.logo_url,
    model?.logoUrl,
    model?.logo,
    model?.preview_url,
    model?.previewUrl,
    model?.preview,
    extraJson.thumbnail_url,
    extraJson.thumbnailUrl,
    extraJson.thumbnail,
    extraJson.model_thumbnail_url,
    extraJson.modelThumbnailUrl,
    extraJson.cover_url,
    extraJson.coverUrl,
    extraJson.cover,
    extraJson.image_url,
    extraJson.imageUrl,
    extraJson.image,
    extraJson.icon_url,
    extraJson.iconUrl,
    extraJson.icon,
    extraJson.logo_url,
    extraJson.logoUrl,
    extraJson.logo,
    extraJson.preview_url,
    extraJson.previewUrl,
    extraJson.preview,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === 'object') {
      const nestedUrl = String(
        candidate.url ?? candidate.src ?? candidate.path ?? candidate.file_url ?? candidate.fileUrl ?? '',
      ).trim();
      if (nestedUrl) {
        return nestedUrl;
      }
    }
  }

  return '';
}

function resolveModelDescription(model) {
  const extraJson = normalizeModelExtraJson(model);
  return String(
    model?.description ??
      model?.desc ??
      model?.subtitle ??
      model?.display_description ??
      model?.displayDescription ??
      extraJson.description ??
      extraJson.desc ??
      extraJson.subtitle ??
      '',
  ).trim();
}

function normalizeModelSchema(model) {
  return firstJsonObject(
    model?.schema,
    model?.input_schema,
    model?.inputSchema,
    model?.params_schema,
    model?.paramsSchema,
    model?.parameter_schema,
    model?.parameterSchema,
    model?.json_schema,
    model?.jsonSchema,
    model?.extra_json,
    model?.extraJson,
  );
}

function hasObjectKeyDeep(value, keyName) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, keyName)) {
    return true;
  }

  return Object.values(value).some((item) => hasObjectKeyDeep(item, keyName));
}

function isTruthyConfigValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'enabled', 'on'].includes(normalized);
}

function modelSupportsSeedanceVirtualAssets(model) {
  if (!model) {
    return false;
  }

  const extraJson = normalizeModelExtraJson(model);
  const modelSchema = normalizeModelSchema(model);
  return (
    isTruthyConfigValue(
      model?.virtual_character_library_enabled ??
        model?.virtualCharacterLibraryEnabled ??
        extraJson.virtual_character_library_enabled ??
        extraJson.virtualCharacterLibraryEnabled,
    ) ||
    model?.seedanceVirtualAssets != null ||
    model?.seedance_virtual_assets != null ||
    hasObjectKeyDeep(modelSchema, 'seedanceVirtualAssets') ||
    hasObjectKeyDeep(modelSchema, 'seedance_virtual_assets')
  );
}

function resolveModelCapability(model, snakeCaseKey, camelCaseKey) {
  if (!model) {
    return null;
  }

  const extraJson = normalizeModelExtraJson(model);
  const candidates = [
    model?.[snakeCaseKey],
    model?.[camelCaseKey],
    extraJson?.[snakeCaseKey],
    extraJson?.[camelCaseKey],
  ];
  const configuredValue = candidates.find((value) => value != null);
  return configuredValue == null ? null : isTruthyConfigValue(configuredValue);
}

function normalizeFreeCanvasModelOptions(payload) {
  const nextOptions = {};

  pickFreeCanvasModelArray(payload).forEach((model) => {
    const nodeType = normalizeModelNodeType(model?.output_media_type ?? model?.outputMediaType ?? model?.media_type ?? model?.mediaType);
    const label = getFreeCanvasModelLabel(model);
    if (!nodeType || !label || !FALLBACK_MODEL_OPTIONS_BY_NODE_TYPE[nodeType]) {
      return;
    }

    nextOptions[nodeType] = nextOptions[nodeType] || [];
    if (!nextOptions[nodeType].some((item) => item.label === label)) {
      nextOptions[nodeType].push({
        label,
        nodeType,
        modelId: resolveFreeCanvasModelId(model),
        thumbnailUrl: resolveModelThumbnailUrl(model),
        description: resolveModelDescription(model),
        aspectRatios: normalizeAspectRatioOptions(model?.aspect_ratios_json ?? model?.aspectRatiosJson ?? model?.aspect_ratios ?? model?.aspectRatios),
        resolutions: normalizeResolutionOptions(model?.resolutions_json ?? model?.resolutionsJson ?? model?.resolutions),
        inputMediaTypes: normalizeModelInputMediaTypes(model),
        inputLimits: normalizeModelInputLimits(model),
        seedanceVirtualAssetsEnabled: modelSupportsSeedanceVirtualAssets(model),
        supportsFirstFrame: resolveModelCapability(
          model,
          'supports_first_frame',
          'supportsFirstFrame',
        ),
        supportsEndFrame: resolveModelCapability(
          model,
          'supports_end_frame',
          'supportsEndFrame',
        ),
      });
    }
  });

  return MODEL_NODE_TYPES.reduce((options, nodeType) => {
    options[nodeType] = nextOptions[nodeType] || [];
    return options;
  }, {});
}

function getNodeModelOptions(nodeType, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  return optionsByNodeType[nodeType] || [];
}

function getDefaultNodeModel(nodeType, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  return getNodeModelOptions(nodeType, optionsByNodeType)[0]?.label || '';
}

function getSelectedModelOption(nodeType, modelLabel, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  const modelOptions = getNodeModelOptions(nodeType, optionsByNodeType);
  return modelOptions.find((model) => model.label === modelLabel) || modelOptions[0] || null;
}

function getModelAspectRatioOptions(nodeType, modelLabel, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  return getSelectedModelOption(nodeType, modelLabel, optionsByNodeType)?.aspectRatios || [];
}

function getModelResolutionOptions(nodeType, modelLabel, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  return getSelectedModelOption(nodeType, modelLabel, optionsByNodeType)?.resolutions || [];
}

function normalizeNodeModel(node, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  if (!node || !FALLBACK_MODEL_OPTIONS_BY_NODE_TYPE[node.type]) {
    return node;
  }

  const selectedModel = getSelectedModelOption(node.type, node.model, optionsByNodeType);
  if (!selectedModel) {
    return {
      ...node,
      model: '',
      aspectRatio: node.type === 'image' || node.type === 'video' ? '' : node.aspectRatio,
      resolution: node.type === 'image' || node.type === 'video' ? '' : node.resolution,
    };
  }

  const modelLabel = selectedModel.label;
  const patch = { model: modelLabel };
  if (node.type === 'image' || node.type === 'video') {
    const aspectRatios = selectedModel.aspectRatios || [];
    patch.aspectRatio = aspectRatios.includes(node.aspectRatio) ? node.aspectRatio : aspectRatios[0] || '';
  }
  if (node.type === 'image' || node.type === 'video') {
    const resolutions = selectedModel.resolutions || [];
    patch.resolution = resolutions.includes(node.resolution) ? node.resolution : resolutions[0] || '';
  }

  return {
    ...node,
    ...patch,
  };
}

function normalizeNodesModels(nodes = [], optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  return nodes.map((node) => normalizeNodeModel(node, optionsByNodeType));
}

function normalizeGraphNode(rawNode) {
  const data = parseJsonObject(rawNode?.data);
  const contentJson = firstObject(rawNode?.content_json, rawNode?.contentJson, data.content_json, data.contentJson);
  const uiJson = firstJsonObject(rawNode?.ui_json, rawNode?.uiJson, data.ui_json, data.uiJson, data.ui);
  const extraJson = firstObject(rawNode?.extra_json, rawNode?.extraJson, data.extra_json, data.extraJson);
  const paramValuesJson = firstJsonObject(
    rawNode?.param_values_json,
    rawNode?.paramValuesJson,
    data.param_values_json,
    data.paramValuesJson,
  );
  const position = firstObject(rawNode?.position, data.position, uiJson.position, uiJson);
  const measured = firstObject(rawNode?.measured, data.measured, uiJson.measured, uiJson);
  const generationStatus = normalizeGenerationStatus(
    rawNode?.generation_status,
    rawNode?.generationStatus,
    rawNode?.run_status,
    rawNode?.runStatus,
    contentJson.generation_status,
    contentJson.generationStatus,
    contentJson.run_status,
    contentJson.runStatus,
    uiJson.generation_status,
    uiJson.generationStatus,
    extraJson.generation_status,
    extraJson.generationStatus,
    data.generation_status,
    data.generationStatus,
  );
  const nodeStatus = String(
    rawNode?.node_status ??
      rawNode?.nodeStatus ??
      rawNode?.status ??
      contentJson.node_status ??
      contentJson.nodeStatus ??
      contentJson.status ??
      uiJson.node_status ??
      uiJson.nodeStatus ??
      uiJson.status ??
      data.node_status ??
      data.nodeStatus ??
      data.status ??
      '',
  ).trim();
  const generationRunId = String(
    rawNode?.generation_node_run_id ??
      rawNode?.generationNodeRunId ??
      rawNode?.generation_run_id ??
      rawNode?.generationRunId ??
      rawNode?.node_run_id ??
      rawNode?.nodeRunId ??
      contentJson.generation_node_run_id ??
      contentJson.generationNodeRunId ??
      contentJson.generation_run_id ??
      contentJson.generationRunId ??
      contentJson.node_run_id ??
      contentJson.nodeRunId ??
      uiJson.generation_node_run_id ??
      uiJson.generationNodeRunId ??
      uiJson.generation_run_id ??
      uiJson.generationRunId ??
      extraJson.generation_node_run_id ??
      extraJson.generationNodeRunId ??
      extraJson.generation_run_id ??
      extraJson.generationRunId ??
      data.generation_node_run_id ??
      data.generationNodeRunId ??
      data.generation_run_id ??
      data.generationRunId ??
      '',
  ).trim();
  const rawNodeType = String(
    rawNode?.component_type ??
      rawNode?.componentType ??
      data.component_type ??
      data.componentType ??
      data.type ??
      rawNode?.media_type ??
      rawNode?.node_kind ??
      rawNode?.type ??
      'script',
  );
  const nodeType = rawNodeType === 'text' ? 'script' : rawNodeType;
  const hasSeedanceResourceBinding = Boolean(
    String(
      extraJson.seedanceVirtualAssetTargetNodeId ??
        extraJson.seedance_virtual_asset_target_node_id ??
        data.seedanceVirtualAssetTargetNodeId ??
        data.seedance_virtual_asset_target_node_id ??
        '',
    ).trim(),
  );
  const normalizedNodeType =
    nodeType === 'image' && hasSeedanceResourceBinding ? 'upload_image' : nodeType;
  const normalizedType = NODE_TYPES.some((item) => item.type === normalizedNodeType)
    ? normalizedNodeType
    : 'script';
  const meta = getNodeTypeMeta(normalizedType);
  const nodeId = String(rawNode?.node_id ?? rawNode?.nodeKey ?? rawNode?.id ?? data.id ?? '').trim();
  const parsedConnectableTargetTypes = getNodeConnectableTargetTypes(
    rawNode?.connectable_target_types_json ??
      rawNode?.connectableTargetTypesJson,
    rawNode?.connectable_target_types,
    rawNode?.connectableTargetTypes,
    data.connectable_target_types_json,
    data.connectableTargetTypesJson,
    data.connectable_target_types,
    data.connectableTargetTypes,
    contentJson.connectable_target_types_json,
    contentJson.connectableTargetTypesJson,
    contentJson.connectable_target_types,
    contentJson.connectableTargetTypes,
    uiJson.connectable_target_types_json,
    uiJson.connectableTargetTypesJson,
    uiJson.connectable_target_types,
    uiJson.connectableTargetTypes,
    extraJson.connectable_target_types_json,
    extraJson.connectableTargetTypesJson,
    extraJson.connectable_target_types,
    extraJson.connectableTargetTypes,
  );
  const connectableTargetTypes =
    parsedConnectableTargetTypes.length > 0
      ? parsedConnectableTargetTypes
      : getDefaultConnectableTargetTypes(normalizedType);
  const normalizedModel = String(contentJson.model ?? data.model ?? rawNode?.input_mode ?? meta.label);
  const canvasGroups = parseJsonArray(
    uiJson.canvasGroups ??
      uiJson.canvas_groups ??
      data.canvasGroups ??
      data.canvas_groups,
  )
    .map(normalizeCanvasGroup)
    .filter(Boolean);
  const normalizedContent = normalizeNodeInputContent(
    normalizedType,
    contentJson.content ?? data.content ?? '',
  );
  const normalizedTextPromptContent = String(
    contentJson.textPromptContent ??
      contentJson.text_prompt_content ??
      data.textPromptContent ??
      data.text_prompt_content ??
      '',
  );
  const isMediaPromptNode = isGeneratedMediaNodeType(normalizedType);
  const outputJson = firstObject(contentJson.output);
  const contentUrl = Array.isArray(contentJson.url) ? contentJson.url[0] : contentJson.url;
  const normalizedMediaPreviewUrl =
    String(extraJson.mediaPreviewUrl ?? data.mediaPreviewUrl ?? '').trim() ||
    String(contentUrl ?? outputJson.url ?? '').trim();
  const modeType = String(
    paramValuesJson.modeType ??
      paramValuesJson.mode_type ??
      contentJson.modeType ??
      contentJson.mode_type ??
      data.modeType ??
      data.mode_type ??
      '',
  ).trim();
  const configuredVideoInputMode = String(
    uiJson.videoInputMode ??
      uiJson.video_input_mode ??
      contentJson.videoInputMode ??
      contentJson.video_input_mode ??
      data.videoInputMode ??
      data.video_input_mode ??
      (modeType === VIDEO_INPUT_MODE_FIRST_END_FRAME
        ? VIDEO_INPUT_MODE_FIRST_END_FRAME
        : VIDEO_INPUT_MODE_REFERENCE),
  ).trim();
  const videoInputMode = [
    VIDEO_INPUT_MODE_REFERENCE,
    VIDEO_INPUT_MODE_FIRST_FRAME,
    VIDEO_INPUT_MODE_FIRST_END_FRAME,
  ].includes(configuredVideoInputMode)
    ? configuredVideoInputMode
    : VIDEO_INPUT_MODE_REFERENCE;
  const configuredVideoModelCapabilityMode = String(
    uiJson.videoModelCapabilityMode ??
      uiJson.video_model_capability_mode ??
      data.videoModelCapabilityMode ??
      data.video_model_capability_mode ??
      '',
  ).trim();
  const videoModelCapabilityMode = [
    VIDEO_INPUT_MODE_REFERENCE,
    VIDEO_INPUT_MODE_FIRST_FRAME,
    VIDEO_INPUT_MODE_FIRST_END_FRAME,
    VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER,
  ].includes(configuredVideoModelCapabilityMode)
    ? configuredVideoModelCapabilityMode
    : '';
  const firstFrameAsset =
    normalizeVideoFrameAsset(
      firstObject(
        contentJson.firstFrameAsset,
        contentJson.first_frame_asset,
        paramValuesJson.firstFrameAsset,
        paramValuesJson.first_frame_asset,
        data.firstFrameAsset,
        data.first_frame_asset,
      ),
      VIDEO_INPUT_ROLE_FIRST_FRAME,
    ) ||
    normalizeVideoFrameAsset(
      {
        url:
          contentJson.firstFrameUrl ??
          contentJson.first_frame_url ??
          paramValuesJson.firstFrameUrl ??
          paramValuesJson.first_frame_url ??
          data.firstFrameUrl ??
          data.first_frame_url,
      },
      VIDEO_INPUT_ROLE_FIRST_FRAME,
    );
  const endFrameAsset =
    normalizeVideoFrameAsset(
      firstObject(
        contentJson.endFrameAsset,
        contentJson.end_frame_asset,
        paramValuesJson.endFrameAsset,
        paramValuesJson.end_frame_asset,
        data.endFrameAsset,
        data.end_frame_asset,
      ),
      VIDEO_INPUT_ROLE_END_FRAME,
    ) ||
    normalizeVideoFrameAsset(
      {
        url:
          contentJson.endFrameUrl ??
          contentJson.end_frame_url ??
          paramValuesJson.endFrameUrl ??
          paramValuesJson.end_frame_url ??
          data.endFrameUrl ??
          data.end_frame_url,
      },
      VIDEO_INPUT_ROLE_END_FRAME,
    );

  return {
    id: nodeId,
    type: normalizedType,
    title: String(rawNode?.title ?? rawNode?.name ?? data.title ?? data.name ?? meta.label),
    subtitle: String(contentJson.subtitle ?? data.subtitle ?? meta.description ?? ''),
    x: toFiniteNumber(position.x ?? position.left, 0),
    y: toFiniteNumber(position.y ?? position.top, 0),
    width: toFiniteNumber(measured.width ?? uiJson.width ?? data.width, isMediaNodeType(normalizedType) ? 592 : 320),
    height: toFiniteNumber(measured.height ?? uiJson.height ?? data.height, isMediaNodeType(normalizedType) ? 333 : 200),
    status: getUiStatusFromGenerationStatus(generationStatus, nodeStatus || 'idle'),
    generationStatus,
    generationRunId,
    paramValuesJson,
    modeType,
    videoInputMode,
    videoModelCapabilityMode,
    firstFrameAsset,
    endFrameAsset,
    model:
      isResourceContainerNodeType(normalizedType)
        ? ''
        : normalizedType === 'video' && normalizedModel === meta.label
        ? DEFAULT_VIDEO_MODEL
        : normalizedType === 'image' && normalizedModel === meta.label
          ? DEFAULT_IMAGE_MODEL
        : normalizedType === 'script' && normalizedModel === meta.label
          ? DEFAULT_TEXT_MODEL
          : normalizedModel,
    content: isMediaPromptNode
      ? normalizedTextPromptContent || normalizedContent
      : normalizedContent,
    textPromptContent: normalizedTextPromptContent || (isMediaPromptNode ? normalizedContent : ''),
    aspectRatio: String(contentJson.aspectRatio ?? contentJson.aspect_ratio ?? data.aspectRatio ?? data.aspect_ratio ?? ''),
    resolution: String(contentJson.resolution ?? data.resolution ?? ''),
    durationSeconds:
      contentJson.durationSeconds ??
      contentJson.duration_seconds ??
      data.durationSeconds ??
      data.duration_seconds ??
      (normalizedType === 'video' ? MIN_VIDEO_DURATION_SECONDS : ''),
    seedanceVirtualAssets: normalizeSeedanceVirtualAssets(
      contentJson.seedanceVirtualAssets ??
        contentJson.seedance_virtual_assets ??
        extraJson.seedanceVirtualAssets ??
        extraJson.seedance_virtual_assets ??
        data.seedanceVirtualAssets ??
        data.seedance_virtual_assets,
    ),
    generationMeta: normalizeGenerationMeta(
      contentJson.generationMeta ??
        contentJson.generation_meta ??
        extraJson.generationMeta ??
        extraJson.generation_meta ??
        data.generationMeta ??
        data.generation_meta,
    ),
    pendingGenerationMeta: normalizeGenerationMeta(
      contentJson.pendingGenerationMeta ??
        contentJson.pending_generation_meta ??
        uiJson.pendingGenerationMeta ??
        uiJson.pending_generation_meta ??
        data.pendingGenerationMeta ??
        data.pending_generation_meta,
    ),
    tags: Array.isArray(contentJson.tags) ? contentJson.tags : Array.isArray(data.tags) ? data.tags : [meta.label],
    mediaPreviewUrl: normalizedMediaPreviewUrl,
    mediaFileName: String(extraJson.mediaFileName ?? data.mediaFileName ?? ''),
    mediaFileSize:
      Number(
        extraJson.mediaFileSize ??
          extraJson.media_file_size ??
          contentJson.mediaFileSize ??
          contentJson.media_file_size ??
          data.mediaFileSize ??
          data.media_file_size,
      ) || 0,
    mediaMimeType: String(
      extraJson.mediaMimeType ??
        extraJson.media_mime_type ??
        contentJson.mediaMimeType ??
        contentJson.media_mime_type ??
        data.mediaMimeType ??
        data.media_mime_type ??
        '',
    ).trim(),
    resourceContentJson: isResourceContainerNodeType(normalizedType) ? { ...contentJson } : {},
    seedanceVirtualAssetId: String(
      extraJson.seedanceVirtualAssetId ??
        extraJson.seedance_virtual_asset_id ??
        data.seedanceVirtualAssetId ??
        data.seedance_virtual_asset_id ??
        '',
    ).trim(),
    seedanceVirtualAssetTargetNodeId: String(
      extraJson.seedanceVirtualAssetTargetNodeId ??
        extraJson.seedance_virtual_asset_target_node_id ??
        data.seedanceVirtualAssetTargetNodeId ??
        data.seedance_virtual_asset_target_node_id ??
        '',
    ).trim(),
    videoInputRole: String(
      extraJson.videoInputRole ??
        extraJson.video_input_role ??
        data.videoInputRole ??
        data.video_input_role ??
        '',
    ).trim(),
    videoInputTargetNodeId: String(
      extraJson.videoInputTargetNodeId ??
        extraJson.video_input_target_node_id ??
        data.videoInputTargetNodeId ??
        data.video_input_target_node_id ??
        '',
    ).trim(),
    connectableTargetTypes,
    groupId: String(
      uiJson.groupId ??
        uiJson.group_id ??
        data.groupId ??
        data.group_id ??
        '',
    ).trim(),
    canvasGroups,
  };
}

function normalizeGraphEdge(rawEdge) {
  const uiJson = firstJsonObject(rawEdge?.ui_json, rawEdge?.uiJson);
  const edgeId = String(rawEdge?.edge_id ?? rawEdge?.connectionId ?? rawEdge?.id ?? '').trim();
  const rawSourcePortKey = String(
    rawEdge?.source_port_key ??
      rawEdge?.sourceHandle ??
      uiJson.sourcePortKey ??
      '',
  ).trim();
  const rawTargetPortKey = String(
    rawEdge?.target_port_key ??
      rawEdge?.targetHandle ??
      uiJson.targetPortKey ??
      '',
  ).trim();
  const sortOrderValue =
    rawEdge?.sort_order ??
    rawEdge?.sortOrder ??
    uiJson.sortOrder ??
    uiJson.sort_order;
  const sortOrder = Number(sortOrderValue);

  return normalizeCanvasEdgePorts({
    id: edgeId,
    from: String(rawEdge?.source_node_id ?? rawEdge?.source ?? rawEdge?.from ?? '').trim(),
    to: String(rawEdge?.target_node_id ?? rawEdge?.target ?? rawEdge?.to ?? '').trim(),
    sourcePortKey: ['left', 'right'].includes(rawSourcePortKey) ? '' : rawSourcePortKey,
    targetPortKey: ['left', 'right'].includes(rawTargetPortKey) ? '' : rawTargetPortKey,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
  });
}

function normalizeGraphPayload(graph) {
  const graphNodes = pickGraphArray(graph, 'nodes', 'node_list', 'nodeList');
  const graphEdges = pickGraphArray(graph, 'connections', 'edges', 'edge_list', 'edgeList');
  const normalizedNodes = graphNodes.map(normalizeGraphNode).filter((node) => node.id);
  const groupMap = new Map();
  normalizedNodes.forEach((node) => {
    node.canvasGroups.forEach((group) => {
      groupMap.set(group.id, group);
    });
  });
  const nodes = normalizedNodes.map((node) => {
    const normalizedNode = { ...node };
    delete normalizedNode.canvasGroups;
    return normalizedNode;
  });
  const nodeById = nodes.reduce((map, node) => ({ ...map, [node.id]: node }), {});
  const edges = graphEdges
    .map(normalizeGraphEdge)
    .filter((edge) => edge.id && canConnectNodes(nodeById[edge.from], nodeById[edge.to]))
    .map((edge) => {
      const sourceNode = nodeById[edge.from];
      const targetNode = nodeById[edge.to];
      return {
        ...edge,
        sourcePortKey:
          edge.sourcePortKey ||
          (isResourceContainerNodeType(sourceNode?.type) ? 'output' : ''),
        targetPortKey:
          edge.targetPortKey ||
          (targetNode?.type === 'video'
            ? getReferenceTargetPortKey(sourceNode)
            : ''),
      };
    });

  return { nodes, edges, groups: Array.from(groupMap.values()) };
}

function getNodeMediaType(node) {
  if (node?.type === 'script') {
    return 'text';
  }
  return getNodeTypeMediaType(node?.type) || null;
}

function getReferenceTargetPortKey(sourceNode) {
  return getNodeMediaType(sourceNode) === 'image'
    ? VIDEO_INPUT_ROLE_REFERENCE_IMAGE
    : 'input';
}

function getEffectiveVideoInputMode(node, edges = [], nodeMap = {}) {
  if (!node || node.type !== 'video') {
    return VIDEO_INPUT_MODE_REFERENCE;
  }

  if (
    node.videoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME ||
    node.videoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME
  ) {
    return node.videoInputMode;
  }

  const incomingEdges = edges.filter((edge) => edge.to === node.id);
  const isImageInput = (edge) => getNodeMediaType(nodeMap[edge.from]) === 'image';
  if (
    node.videoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME &&
    incomingEdges.length === 1 &&
    isImageInput(incomingEdges[0]) &&
    incomingEdges[0].targetPortKey === VIDEO_INPUT_ROLE_FIRST_FRAME
  ) {
    return VIDEO_INPUT_MODE_FIRST_FRAME;
  }

  if (
    node.videoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME &&
    incomingEdges.length === 2 &&
    incomingEdges.every(isImageInput)
  ) {
    const roles = new Set(incomingEdges.map((edge) => edge.targetPortKey));
    if (
      roles.has(VIDEO_INPUT_ROLE_FIRST_FRAME) &&
      roles.has(VIDEO_INPUT_ROLE_END_FRAME)
    ) {
      return VIDEO_INPUT_MODE_FIRST_END_FRAME;
    }
  }

  return VIDEO_INPUT_MODE_REFERENCE;
}

function modelOptionSupportsMediaInput(modelOption, mediaType) {
  if (!modelOption || !mediaType) {
    return true;
  }

  const inputLimit = modelOption.inputLimits?.[mediaType];
  if (inputLimit != null && inputLimit <= 0) {
    return false;
  }

  const inputMediaTypes = Array.isArray(modelOption.inputMediaTypes) ? modelOption.inputMediaTypes : [];
  if (inputMediaTypes.length > 0) {
    return inputMediaTypes.includes(mediaType);
  }

  return true;
}

function getVideoModelCapabilityViolation(modelOption, capabilityMode) {
  if (!modelOption || !capabilityMode) {
    return null;
  }

  if (capabilityMode === VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER) {
    return modelOption.seedanceVirtualAssetsEnabled
      ? null
      : '该模型不支持虚拟人像库';
  }

  const requiresFirstFrame = [
    VIDEO_INPUT_MODE_FIRST_FRAME,
    VIDEO_INPUT_MODE_FIRST_END_FRAME,
  ].includes(capabilityMode);
  const requiresEndFrame =
    capabilityMode === VIDEO_INPUT_MODE_FIRST_END_FRAME;
  if (requiresFirstFrame && modelOption.supportsFirstFrame === false) {
    return '该模型不支持首帧输入';
  }
  if (requiresEndFrame && modelOption.supportsEndFrame === false) {
    return '该模型不支持尾帧输入';
  }

  const requiredImageCount = requiresEndFrame ? 2 : requiresFirstFrame ? 1 : 0;
  if (
    requiredImageCount > 0 &&
    !modelOptionSupportsMediaInput(modelOption, 'image')
  ) {
    return '该模型不支持图片输入';
  }
  const imageInputLimit = modelOption.inputLimits?.image;
  if (imageInputLimit != null && imageInputLimit < requiredImageCount) {
    return `该模型最多支持 ${imageInputLimit} 个图片输入`;
  }

  return null;
}

function getVideoModelCapabilityMode(node) {
  if (!node || node.type !== 'video') {
    return '';
  }
  if (node.videoModelCapabilityMode === VIDEO_INPUT_MODE_REFERENCE) {
    return '';
  }
  if (
    [
      VIDEO_INPUT_MODE_FIRST_FRAME,
      VIDEO_INPUT_MODE_FIRST_END_FRAME,
      VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER,
    ].includes(node.videoModelCapabilityMode)
  ) {
    return node.videoModelCapabilityMode;
  }
  if (
    [VIDEO_INPUT_MODE_FIRST_FRAME, VIDEO_INPUT_MODE_FIRST_END_FRAME].includes(
      node.videoInputMode,
    )
  ) {
    return node.videoInputMode;
  }
  return getSeedanceVirtualAssetIds(node.seedanceVirtualAssets).length > 0
    ? VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER
    : '';
}

function getVideoModelSelectionPatch(node, modelOption) {
  if (!modelOption) {
    return {};
  }

  const aspectRatios = modelOption.aspectRatios || [];
  const resolutions = modelOption.resolutions || [];
  return {
    model: modelOption.label,
    aspectRatio: aspectRatios.includes(node?.aspectRatio)
      ? node.aspectRatio
      : aspectRatios[0] || '',
    resolution: resolutions.includes(node?.resolution)
      ? node.resolution
      : resolutions[0] || '',
  };
}

function getConnectionInputLimitViolation(edges = [], nodeMap = {}, sourceNode, targetNode, targetModelOption) {
  if (!sourceNode || !targetNode || !targetModelOption) {
    return null;
  }

  const sourceMediaType = getNodeMediaType(sourceNode);
  if (!sourceMediaType) {
    return null;
  }

  const label = MODEL_MEDIA_TYPE_LABELS[sourceMediaType] || '';
  if (!modelOptionSupportsMediaInput(targetModelOption, sourceMediaType)) {
    return `\u65e0\u6cd5\u8fde\u63a5\uff0c\u8be5\u6a21\u578b\u4e0d\u652f\u6301${label}\u8f93\u5165`;
  }

  const limit = targetModelOption.inputLimits?.[sourceMediaType];
  if (limit == null) {
    return null;
  }

  const currentCount = edges.filter((edge) => {
    if (edge.to !== targetNode.id) {
      return false;
    }
    return getNodeMediaType(nodeMap[edge.from]) === sourceMediaType;
  }).length;

  if (currentCount >= limit) {
    return `\u65e0\u6cd5\u8fde\u63a5\uff0c\u5df2\u8fbe\u5230\u8be5\u6a21\u578b\u7684${label}\u8f93\u5165\u4e0a\u9650`;
  }

  return null;
}

function getExistingConnectionsModelViolation(edges = [], nodeMap = {}, targetNode, modelOption) {
  if (!targetNode || !modelOption) {
    return null;
  }

  const incomingCounts = edges.reduce((counts, edge) => {
    if (edge.to !== targetNode.id) {
      return counts;
    }

    const mediaType = getNodeMediaType(nodeMap[edge.from]);
    if (mediaType) {
      counts[mediaType] = (counts[mediaType] || 0) + 1;
    }
    return counts;
  }, {});

  for (const [mediaType, count] of Object.entries(incomingCounts)) {
    const label = MODEL_MEDIA_TYPE_LABELS[mediaType] || '当前素材';
    if (!modelOptionSupportsMediaInput(modelOption, mediaType)) {
      return `当前已有${label}连线，该模型不支持${label}输入`;
    }

    const limit = modelOption.inputLimits?.[mediaType];
    if (limit != null && count > limit) {
      return `当前已有 ${count} 个${label}输入，该模型最多支持 ${limit} 个`;
    }
  }

  return null;
}

function getModelOptionsByConnectionAvailability(
  modelOptions = [],
  edges = [],
  nodeMap = {},
  targetNode,
  getAdditionalViolation = null,
) {
  return modelOptions
    .map((model, originalIndex) => {
      const additionalViolation =
        typeof getAdditionalViolation === 'function'
          ? getAdditionalViolation(model)
          : null;
      return {
        model,
        originalIndex,
        modelConnectionViolation:
          additionalViolation ||
          getExistingConnectionsModelViolation(
            edges,
            nodeMap,
            targetNode,
            model,
          ),
      };
    })
    .sort((left, right) => {
      const availabilityOrder =
        Number(Boolean(left.modelConnectionViolation)) -
        Number(Boolean(right.modelConnectionViolation));
      return availabilityOrder || left.originalIndex - right.originalIndex;
    });
}

function canConnectNodes(sourceNode, targetNode) {
  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
    return false;
  }

  const allowedTypes = Array.isArray(sourceNode.connectableTargetTypes) && sourceNode.connectableTargetTypes.length > 0
    ? sourceNode.connectableTargetTypes
    : getDefaultConnectableTargetTypes(sourceNode.type);
  const targetType = targetNode.type === 'text' ? 'script' : targetNode.type;

  return allowedTypes.some((item) => CONNECTABLE_TARGET_TYPE_MAP[item] === targetType);
}

function canConnectNodeToNewType(sourceNode, targetType, sourceSide = 'right') {
  if (!sourceNode || !targetType) {
    return false;
  }

  const normalizedSourceType = sourceNode.type === 'text' ? 'script' : sourceNode.type;
  const normalizedTargetType = targetType === 'text' ? 'script' : targetType;

  if (sourceSide === 'left') {
    return getDefaultConnectableTargetTypes(normalizedTargetType).some(
      (item) => CONNECTABLE_TARGET_TYPE_MAP[item] === normalizedSourceType,
    );
  }

  const allowedTypes = Array.isArray(sourceNode.connectableTargetTypes) && sourceNode.connectableTargetTypes.length > 0
    ? sourceNode.connectableTargetTypes
    : getDefaultConnectableTargetTypes(normalizedSourceType);

  return allowedTypes.some((item) => CONNECTABLE_TARGET_TYPE_MAP[item] === normalizedTargetType);
}

function hasConnectionBetween(edges = [], firstNodeId, secondNodeId) {
  if (!firstNodeId || !secondNodeId) {
    return false;
  }

  return edges.some(
    (edge) =>
      (edge.from === firstNodeId && edge.to === secondNodeId) ||
      (edge.from === secondNodeId && edge.to === firstNodeId),
  );
}

function resolveConnection(sourceNode, targetNode, sourceSide = 'right') {
  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
    return null;
  }

  if (sourceSide === 'left') {
    return canConnectNodes(targetNode, sourceNode)
      ? {
          from: targetNode.id,
          fromSide: 'right',
          to: sourceNode.id,
          toSide: 'left',
        }
      : null;
  }

  return canConnectNodes(sourceNode, targetNode)
    ? {
        from: sourceNode.id,
        fromSide: 'right',
        to: targetNode.id,
        toSide: 'left',
      }
    : null;
}

function serializeCanvasNode(node, groups = []) {
  const nodeStatus = node.status || 'idle';
  const generationStatus = node.generationStatus || '';
  const generationRunId = node.generationRunId || '';
  const seedanceVirtualAssets = normalizeSeedanceVirtualAssets(node.seedanceVirtualAssets);
  const isResourceContainer = isResourceContainerNodeType(node.type);
  const isMediaPromptNode = isGeneratedMediaNodeType(node.type);
  const firstFrameAsset = getVideoFrameAsset(node, VIDEO_INPUT_ROLE_FIRST_FRAME);
  const endFrameAsset = getVideoFrameAsset(node, VIDEO_INPUT_ROLE_END_FRAME);
  const firstFrameUrl = String(firstFrameAsset?.url || '').trim();
  const endFrameUrl = String(endFrameAsset?.url || '').trim();
  const videoParamValuesJson = { ...(node.paramValuesJson || {}) };
  delete videoParamValuesJson.mode_type;
  if (node.modeType) {
    videoParamValuesJson.modeType = node.modeType;
  } else {
    delete videoParamValuesJson.modeType;
  }
  if (node.type === 'video') {
    videoParamValuesJson.videoInputMode =
      node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE;
    videoParamValuesJson.video_input_mode =
      node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE;
  }
  if (firstFrameUrl) {
    videoParamValuesJson.firstFrameUrl = firstFrameUrl;
    videoParamValuesJson.first_frame_url = firstFrameUrl;
    videoParamValuesJson.firstFrameAsset = firstFrameAsset;
    videoParamValuesJson.first_frame_asset = firstFrameAsset;
  } else {
    delete videoParamValuesJson.firstFrameUrl;
    delete videoParamValuesJson.first_frame_url;
    delete videoParamValuesJson.firstFrameAsset;
    delete videoParamValuesJson.first_frame_asset;
  }
  if (endFrameUrl) {
    videoParamValuesJson.endFrameUrl = endFrameUrl;
    videoParamValuesJson.end_frame_url = endFrameUrl;
    videoParamValuesJson.endFrameAsset = endFrameAsset;
    videoParamValuesJson.end_frame_asset = endFrameAsset;
  } else {
    delete videoParamValuesJson.endFrameUrl;
    delete videoParamValuesJson.end_frame_url;
    delete videoParamValuesJson.endFrameAsset;
    delete videoParamValuesJson.end_frame_asset;
  }
  const textPromptContent = String(
    isMediaPromptNode
      ? node.content || ''
      : node.textPromptContent || '',
  );

  return {
    node_id: node.id,
    nodeKey: node.id,
    node_kind: isResourceContainer ? 'container' : 'module',
    status: nodeStatus,
    node_status: nodeStatus,
    generation_status: generationStatus,
    generation_run_id: generationRunId,
    media_type: getNodeMediaType(node),
    connectable_target_types_json: Array.isArray(node.connectableTargetTypes) ? node.connectableTargetTypes : [],
    component_type: node.type,
    title: node.title,
    name: node.title,
    input_mode: isResourceContainer ? null : node.model,
    ...(isResourceContainer
      ? {
          model_id: null,
          param_values_json: {},
        }
      : node.type === 'video'
        ? { param_values_json: videoParamValuesJson }
        : {}),
    content_json: isResourceContainer
      ? { ...(node.resourceContentJson || {}) }
      : {
          ...(!isMediaPromptNode ? { content: node.content || '' } : {}),
          textPromptContent,
          subtitle: node.subtitle || '',
          model: node.model || '',
          aspectRatio: node.aspectRatio || '',
          resolution: node.resolution || '',
          durationSeconds: node.durationSeconds || '',
          seedanceVirtualAssets,
          tags: Array.isArray(node.tags) ? node.tags : [],
          status: nodeStatus,
          nodeStatus,
          generationStatus,
          generationRunId,
          generationMeta: normalizeGenerationMeta(node.generationMeta),
          pendingGenerationMeta: normalizeGenerationMeta(node.pendingGenerationMeta),
          ...(node.type === 'video' && node.modeType
            ? { modeType: node.modeType }
            : {}),
          ...(node.type === 'video'
            ? {
                videoInputMode:
                  node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE,
                video_input_mode:
                  node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE,
                ...(firstFrameAsset
                  ? {
                      firstFrameAsset,
                      first_frame_asset: firstFrameAsset,
                      firstFrameUrl,
                      first_frame_url: firstFrameUrl,
                    }
                  : {}),
                ...(endFrameAsset
                  ? {
                      endFrameAsset,
                      end_frame_asset: endFrameAsset,
                      endFrameUrl,
                      end_frame_url: endFrameUrl,
                    }
                  : {}),
              }
            : {}),
        },
    ui_json: {
      status: nodeStatus,
      nodeStatus,
      generationStatus,
      generationRunId,
      generationMeta: normalizeGenerationMeta(node.generationMeta),
      pendingGenerationMeta: normalizeGenerationMeta(node.pendingGenerationMeta),
      width: node.width,
      height: node.height,
      connectableTargetTypes: Array.isArray(node.connectableTargetTypes) ? node.connectableTargetTypes : [],
      ...(node.type === 'video'
        ? {
            videoInputMode: node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE,
            videoModelCapabilityMode: node.videoModelCapabilityMode || '',
          }
        : {}),
      groupId: node.groupId || '',
      canvasGroups: groups,
    },
    extra_json: {
      mediaPreviewUrl: node.mediaPreviewUrl || '',
      mediaFileName: node.mediaFileName || '',
      mediaFileSize: Number(node.mediaFileSize) || 0,
      mediaMimeType: node.mediaMimeType || '',
      seedanceVirtualAssets,
      seedanceVirtualAssetId: node.seedanceVirtualAssetId || '',
      seedanceVirtualAssetTargetNodeId: node.seedanceVirtualAssetTargetNodeId || '',
      videoInputRole: node.videoInputRole || '',
      videoInputTargetNodeId: node.videoInputTargetNodeId || '',
    },
    data: {
      id: node.id,
      type: node.type,
      title: node.title,
      ...(!isMediaPromptNode ? { content: node.content || '' } : {}),
      textPromptContent,
      status: nodeStatus,
      nodeStatus,
      generationStatus,
      generationRunId,
      generationMeta: normalizeGenerationMeta(node.generationMeta),
      pendingGenerationMeta: normalizeGenerationMeta(node.pendingGenerationMeta),
      seedanceVirtualAssets,
      seedanceVirtualAssetId: node.seedanceVirtualAssetId || '',
      seedanceVirtualAssetTargetNodeId: node.seedanceVirtualAssetTargetNodeId || '',
      videoInputRole: node.videoInputRole || '',
      videoInputTargetNodeId: node.videoInputTargetNodeId || '',
      ...(node.type === 'video'
        ? {
            modeType: node.modeType || '',
            videoInputMode: node.videoInputMode || VIDEO_INPUT_MODE_REFERENCE,
            videoModelCapabilityMode: node.videoModelCapabilityMode || '',
            firstFrameAsset,
            first_frame_asset: firstFrameAsset,
            firstFrameUrl,
            first_frame_url: firstFrameUrl,
            endFrameAsset,
            end_frame_asset: endFrameAsset,
            endFrameUrl,
            end_frame_url: endFrameUrl,
          }
        : {}),
      width: node.width,
      height: node.height,
      groupId: node.groupId || '',
    },
    position: {
      x: node.x,
      y: node.y,
    },
    measured: {
      width: node.width,
      height: node.height,
    },
    type: node.type,
  };
}

function clampVideoDurationSeconds(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) {
    return MIN_VIDEO_DURATION_SECONDS;
  }

  return Math.min(MAX_VIDEO_DURATION_SECONDS, Math.max(MIN_VIDEO_DURATION_SECONDS, Math.round(duration)));
}

function shouldInheritVideoNodeConfig(sourceNode, targetType) {
  return sourceNode?.type === 'video' && targetType === 'video';
}

function getInheritedVideoNodeModelLabel(sourceNode, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  if (!sourceNode || sourceNode.type !== 'video') {
    return getDefaultNodeModel('video', optionsByNodeType);
  }

  return (
    getSelectedModelOption('video', sourceNode.model, optionsByNodeType)?.label ||
    sourceNode.model ||
    getDefaultNodeModel('video', optionsByNodeType)
  );
}

function getNewNodeModelLabel(type, sourceNode, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  if (shouldInheritVideoNodeConfig(sourceNode, type)) {
    return getInheritedVideoNodeModelLabel(sourceNode, optionsByNodeType);
  }

  return getDefaultNodeModel(type, optionsByNodeType);
}

function getInheritedVideoNodeConfig(sourceNode, optionsByNodeType = EMPTY_MODEL_OPTIONS_BY_NODE_TYPE) {
  if (!shouldInheritVideoNodeConfig(sourceNode, 'video')) {
    return null;
  }

  return {
    model: getInheritedVideoNodeModelLabel(sourceNode, optionsByNodeType),
    durationSeconds: clampVideoDurationSeconds(sourceNode.durationSeconds ?? MIN_VIDEO_DURATION_SECONDS),
    aspectRatio: sourceNode.aspectRatio || '',
    resolution: sourceNode.resolution || '',
    seedanceVirtualAssets: normalizeSeedanceVirtualAssets(sourceNode.seedanceVirtualAssets),
    connectableTargetTypes:
      Array.isArray(sourceNode.connectableTargetTypes) && sourceNode.connectableTargetTypes.length > 0
        ? [...sourceNode.connectableTargetTypes]
        : getDefaultConnectableTargetTypes('video'),
  };
}

function getAspectRatioPreviewStyle(ratio) {
  if (ratio === '自适应') {
    return { '--ratio-preview-width': '12px', '--ratio-preview-height': '12px' };
  }

  const [width, height] = String(ratio)
    .split(':')
    .map((item) => Number(item));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { '--ratio-preview-width': '15px', '--ratio-preview-height': '10px' };
  }

  if (width === height) {
    return { '--ratio-preview-width': '12px', '--ratio-preview-height': '12px' };
  }

  const isLandscape = width > height;
  const maxSize = 16;
  const minSize = 8;
  const scale = maxSize / Math.max(width, height);
  return {
    '--ratio-preview-width': `${Math.max(minSize, Math.round(width * scale))}px`,
    '--ratio-preview-height': `${Math.max(minSize, Math.round(height * scale))}px`,
    '--ratio-preview-radius': isLandscape ? '2px' : '3px',
  };
}

function serializeCanvasEdge(edge) {
  const normalizedEdge = normalizeCanvasEdgePorts(edge);
  const sourcePortKey = normalizedEdge.sourcePortKey || normalizedEdge.fromSide;
  const targetPortKey = normalizedEdge.targetPortKey || normalizedEdge.toSide;
  return {
    edge_id: normalizedEdge.id,
    connectionId: normalizedEdge.id,
    source_node_id: normalizedEdge.from,
    source: normalizedEdge.from,
    target_node_id: normalizedEdge.to,
    target: normalizedEdge.to,
    source_port_key: sourcePortKey,
    sourceHandle: sourcePortKey,
    target_port_key: targetPortKey,
    targetHandle: targetPortKey,
    ...(Number.isFinite(normalizedEdge.sortOrder)
      ? {
          sort_order: normalizedEdge.sortOrder,
          sortOrder: normalizedEdge.sortOrder,
        }
      : {}),
    ui_json: {
      fromSide: normalizedEdge.fromSide,
      toSide: normalizedEdge.toSide,
      sourcePortKey,
      targetPortKey,
      ...(Number.isFinite(normalizedEdge.sortOrder)
        ? { sortOrder: normalizedEdge.sortOrder }
        : {}),
    },
    type: 'smoothstep',
    deletable: true,
    selectable: true,
  };
}

function buildGraphPatchPayload({
  nodes,
  edges,
  persistedNodeIds,
  persistedEdgeIds,
  groups,
  baseVersion,
  projectId,
  sessionId,
}) {
  const currentNodeIds = new Set(nodes.map((node) => node.id));
  const currentEdgeIds = new Set(edges.map((edge) => edge.id));
  const createNodes = nodes
    .filter((node) => !persistedNodeIds.has(node.id))
    .map((node) => serializeCanvasNode(node, groups));
  const updateNodes = nodes
    .filter((node) => persistedNodeIds.has(node.id))
    .map((node) => serializeCanvasNode(node, groups));
  const deleteNodes = Array.from(persistedNodeIds)
    .filter((nodeId) => !currentNodeIds.has(nodeId))
    .map((nodeId) => ({
      node_id: nodeId,
      nodeKey: nodeId,
      status: 'deleted',
      node_status: 'deleted',
    }));
  const createEdges = edges.filter((edge) => !persistedEdgeIds.has(edge.id)).map(serializeCanvasEdge);
  const updateEdges = edges.filter((edge) => persistedEdgeIds.has(edge.id)).map(serializeCanvasEdge);
  const deleteEdges = Array.from(persistedEdgeIds)
    .filter((edgeId) => !currentEdgeIds.has(edgeId))
    .map((edgeId) => ({ edge_id: edgeId, connectionId: edgeId }));

  return {
    base_version_no: baseVersion,
    projectUuid: projectId,
    request_id: `${sessionId}-${Date.now()}`,
    session_id: sessionId,
    timestamp: Date.now(),
    nodes: {
      create: createNodes,
      update: updateNodes,
      delete: deleteNodes,
    },
    connections: {
      create: createEdges,
      update: updateEdges,
      delete: deleteEdges,
    },
  };
}

function hasGraphPatchChanges(payload) {
  return Boolean(
    payload.nodes.create.length ||
      payload.nodes.update.length ||
      payload.nodes.delete.length ||
      payload.connections.create.length ||
      payload.connections.update.length ||
      payload.connections.delete.length,
  );
}

function createDefaultPointQuote() {
  return {
    loading: false,
    points: null,
    error: '',
  };
}

function pickNodePointQuotes(pointsQuoteSpecs = [], nodeQuotes = {}) {
  return pointsQuoteSpecs.reduce((quotes, spec) => {
    quotes[spec.nodeId] = nodeQuotes[spec.nodeId] || createDefaultPointQuote();
    return quotes;
  }, {});
}

function buildWorkflowPointQuote(pointsQuoteSpecs = [], nodeQuotes = {}) {
  if (pointsQuoteSpecs.length === 0) {
    return createDefaultPointQuote();
  }

  const quotes = pointsQuoteSpecs.map((spec) => nodeQuotes[spec.nodeId] || createDefaultPointQuote());
  if (quotes.some((quote) => quote.loading)) {
    return {
      loading: true,
      points: null,
      error: '',
    };
  }

  const allQuoted = quotes.every((quote) => quote.points != null);
  return {
    loading: false,
    points: allQuoted
      ? quotes.reduce((total, quote) => total + normalizePointsValue(quote.points), 0)
      : null,
    error: allQuoted ? '' : '积分报价失败',
  };
}

function createDefaultPointsTipState() {
  return {
    visible: false,
    text: '',
    left: 0,
    top: 0,
    placement: 'top',
  };
}

function WorkflowPage({
  activeProject,
  onBackHome,
  onEnterCreation,
  onCanvasProjectReady,
  onProjectNameChange,
  onPointsChanged,
  availablePoints,
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [modelOptionsByNodeType, setModelOptionsByNodeType] = useState(EMPTY_MODEL_OPTIONS_BY_NODE_TYPE);
  const [canvasProjectId, setCanvasProjectId] = useState('');
  const [projectNameOverride, setProjectNameOverride] = useState('');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [isProjectNameEditing, setIsProjectNameEditing] = useState(false);
  const [isGraphReady, setIsGraphReady] = useState(false);
  const [viewport, setViewport] = useState({ x: -35, y: 90, zoom: 0.64 });
  const [selectedNodeId, setSelectedNodeId] = useState('setting-extract');
  const [selectedNodeIds, setSelectedNodeIds] = useState(['setting-extract']);
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [draggingNodeIds, setDraggingNodeIds] = useState([]);
  const [generatingNodeIds, setGeneratingNodeIds] = useState([]);
  const [generationFailedNodeIds, setGenerationFailedNodeIds] = useState([]);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [uploadingNodeIds, setUploadingNodeIds] = useState([]);
  const [uploadingVideoFrameKeys, setUploadingVideoFrameKeys] = useState([]);
  const [nodePointQuotes, setNodePointQuotes] = useState({});
  const [workflowPointQuote, setWorkflowPointQuote] = useState(createDefaultPointQuote);
  const [pointsTip, setPointsTip] = useState(createDefaultPointsTipState);
  const [promptFocusNodeId, setPromptFocusNodeId] = useState('');
  const [expandedPromptNodeId, setExpandedPromptNodeId] = useState('');
  const [connectionNotice, setConnectionNotice] = useState(null);
  const [seedanceLibraryOpen, setSeedanceLibraryOpen] = useState(false);
  const [seedanceLibraryNodeId, setSeedanceLibraryNodeId] = useState('');
  const [mediaDetailNodeId, setMediaDetailNodeId] = useState('');
  const [videoFrameExtractor, setVideoFrameExtractor] = useState(
    createDefaultVideoFrameExtractorState,
  );
  const [seedanceCharacters, setSeedanceCharacters] = useState([]);
  const [seedanceCharactersLoading, setSeedanceCharactersLoading] = useState(false);
  const [seedanceCharactersError, setSeedanceCharactersError] = useState('');
  const [seedanceCharacterPage, setSeedanceCharacterPage] = useState(1);
  const [isUploadingSeedanceCharacter, setIsUploadingSeedanceCharacter] = useState(false);
  const [, setRefreshingSeedanceAssetIds] = useState([]);
  const [deletingSeedanceAssetIds, setDeletingSeedanceAssetIds] = useState([]);
  const [hoveredInputReferenceKey, setHoveredInputReferenceKey] = useState('');
  const [blockedConnectionTargetId, setBlockedConnectionTargetId] = useState('');
  const [hoveredEdgeId, setHoveredEdgeId] = useState('');
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [draftPoint, setDraftPoint] = useState(null);
  const [connectionAddMenu, setConnectionAddMenu] = useState(null);
  const [canvasNodeMenu, setCanvasNodeMenu] = useState(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionRegion, setSelectionRegion] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupDropTargetId, setGroupDropTargetId] = useState('');
  const [draggingGroupId, setDraggingGroupId] = useState('');
  const [focusedGroupId, setFocusedGroupId] = useState('');
  const [submittingGroupIds, setSubmittingGroupIds] = useState([]);
  const [isSnapEnabled, setIsSnapEnabled] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  const [editingNodeField, setEditingNodeField] = useState(null);
  const [openMediaGenerationTypeNodeId, setOpenMediaGenerationTypeNodeId] = useState('');
  const [openTextModelNodeId, setOpenTextModelNodeId] = useState('');
  const [openImageModelNodeId, setOpenImageModelNodeId] = useState('');
  const [openImageRatioNodeId, setOpenImageRatioNodeId] = useState('');
  const [openImageResolutionNodeId, setOpenImageResolutionNodeId] = useState('');
  const [openVideoModelNodeId, setOpenVideoModelNodeId] = useState('');
  const [openVideoRatioNodeId, setOpenVideoRatioNodeId] = useState('');
  const [openVideoResolutionNodeId, setOpenVideoResolutionNodeId] = useState('');
  const [openVideoDurationNodeId, setOpenVideoDurationNodeId] = useState('');
  const [openAudioModelNodeId, setOpenAudioModelNodeId] = useState('');
  const [viewportSize, setViewportSize] = useState({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  });
  const projectIdentityKey = String(
    activeProject?.backendProjectId || activeProject?.id || 'new-canvas',
  );
  const projectCreatedAt =
    activeProject?.createdAt || activeProject?.created_at || '';
  const fallbackProjectName = useMemo(
    () => createFreeCanvasUntitledName(projectCreatedAt),
    [projectCreatedAt],
  );
  const configuredProjectName = normalizeFreeCanvasProjectName(
    activeProject?.name,
  );
  const projectDisplayName =
    projectNameOverride || configuredProjectName || fallbackProjectName;

  const viewportRef = useRef(null);
  const interactionRef = useRef(null);
  const addMenuCloseTimerRef = useRef(null);
  const nodeFieldPointerRef = useRef(null);
  const nodeSequenceRef = useRef(0);
  const edgeSequenceRef = useRef(0);
  const groupSequenceRef = useRef(0);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const groupsRef = useRef(groups);
  const focusedGroupIdRef = useRef(focusedGroupId);
  const deleteCanvasGroupRef = useRef(null);
  const removeCanvasItemsRef = useRef(null);
  const groupExecutionIdsRef = useRef(new Set());
  const seedanceCharactersLoadedProjectIdRef = useRef('');
  const canvasVersionRef = useRef(null);
  const persistedNodeIdsRef = useRef(new Set());
  const persistedEdgeIdsRef = useRef(new Set());
  const graphSaveTimerRef = useRef(null);
  const isSavingGraphRef = useRef(false);
  const skipGraphSaveCountRef = useRef(0);
  const sessionIdRef = useRef(`fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const nodeRunSyncTimersRef = useRef({});
  const workflowRunSyncTimerRef = useRef(null);
  const pointsTipTargetRef = useRef(null);
  const pointsQuoteSpecsRef = useRef([]);
  const nodePointQuoteSignaturesRef = useRef({});
  const nodePointQuoteValuesRef = useRef({});
  const seedanceCharacterUploadInputRef = useRef(null);
  const videoFrameExtractorRef = useRef(null);
  const videoFrameExtractionInFlightRef = useRef(false);
  const canvasMediaUploadInputRef = useRef(null);
  const canvasMediaUploadAnchorRef = useRef(null);
  const canvasHistoryRef = useRef(createEmptyCanvasHistoryState());
  const canvasHistoryTimerRef = useRef(null);
  const undoCanvasHistoryRef = useRef(null);
  const redoCanvasHistoryRef = useRef(null);
  const canvasNodeClipboardRef = useRef(null);
  const copySelectedCanvasNodesRef = useRef(null);
  const pasteCopiedCanvasNodesRef = useRef(null);
  const onCanvasProjectReadyRef = useRef(onCanvasProjectReady);
  const modelOptionsByNodeTypeRef = useRef(modelOptionsByNodeType);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedEdgeIdRef = useRef(selectedEdgeId);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);

  const closeMediaDetailViewer = useCallback(() => {
    setMediaDetailNodeId('');
  }, []);

  useEffect(() => {
    const preventManagedVideoMultiClick = (event) => {
      const video = event.target?.closest?.(
        'video[data-disable-native-fullscreen="true"]',
      );
      if (!video || (event.type !== 'dblclick' && event.detail < 2)) {
        return;
      }

      event.preventDefault();
      markVideoDoubleClickFullscreenBlocked(video);
      exitNativeVideoFullscreen(video);
    };
    const leaveManagedVideoFullscreen = (event) => {
      const fullscreenElement = document.fullscreenElement;
      const fullscreenVideo =
        fullscreenElement?.matches?.('video[data-disable-native-fullscreen="true"]')
          ? fullscreenElement
          : fullscreenElement?.querySelector?.(
              'video[data-disable-native-fullscreen="true"]',
            );
      const eventVideo = event?.target?.closest?.(
        'video[data-disable-native-fullscreen="true"]',
      );
      const video = fullscreenVideo || eventVideo;
      if (video && shouldBlockVideoDoubleClickFullscreen(video)) {
        event?.preventDefault?.();
        exitNativeVideoFullscreen(video);
      }
    };

    document.addEventListener('mousedown', preventManagedVideoMultiClick, true);
    document.addEventListener('click', preventManagedVideoMultiClick, true);
    document.addEventListener('dblclick', preventManagedVideoMultiClick, true);
    document.addEventListener('fullscreenchange', leaveManagedVideoFullscreen);
    document.addEventListener(
      'webkitfullscreenchange',
      leaveManagedVideoFullscreen,
    );
    document.addEventListener(
      'webkitbeginfullscreen',
      leaveManagedVideoFullscreen,
      true,
    );

    return () => {
      document.removeEventListener('mousedown', preventManagedVideoMultiClick, true);
      document.removeEventListener('click', preventManagedVideoMultiClick, true);
      document.removeEventListener('dblclick', preventManagedVideoMultiClick, true);
      document.removeEventListener('fullscreenchange', leaveManagedVideoFullscreen);
      document.removeEventListener(
        'webkitfullscreenchange',
        leaveManagedVideoFullscreen,
      );
      document.removeEventListener(
        'webkitbeginfullscreen',
        leaveManagedVideoFullscreen,
        true,
      );
    };
  }, []);

  const zoomAt = useCallback((clientX, clientY, delta) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const viewportPoint = {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0),
    };

    setViewport((current) => {
      const nextZoom = clampZoom(current.zoom + delta);
      const worldX = (viewportPoint.x - current.x) / current.zoom;
      const worldY = (viewportPoint.y - current.y) / current.zoom;
      return {
        x: Math.round(viewportPoint.x - worldX * nextZoom),
        y: Math.round(viewportPoint.y - worldY * nextZoom),
        zoom: nextZoom,
      };
    });
  }, []);

  const nodeMap = useMemo(
    () => nodes.reduce((map, node) => ({ ...map, [node.id]: node }), {}),
    [nodes],
  );
  const mediaDetailNode = mediaDetailNodeId
    ? nodeMap[mediaDetailNodeId] || null
    : null;
  const mediaDetailReferences = useMemo(
    () =>
      mediaDetailNode
        ? getNodeInputReferenceThumbnails(
            mediaDetailNode,
            edges,
            nodeMap,
            seedanceCharacters,
          )
        : [],
    [edges, mediaDetailNode, nodeMap, seedanceCharacters],
  );
  const visibleNodes = useMemo(
    () => nodes.filter((node) => !isInternalVideoFrameNode(node)),
    [nodes],
  );
  const visibleEdges = useMemo(
    () => edges.filter((edge) => !isInternalVideoFrameEdge(edge, nodeMap)),
    [edges, nodeMap],
  );
  const videoFrameExtractorNode = videoFrameExtractor.nodeId
    ? nodeMap[videoFrameExtractor.nodeId] || null
    : null;
  const hasVideoVirtualAssetReferences = nodes.some(
    (node) => node.type === 'video' && getSeedanceVirtualAssetIds(node.seedanceVirtualAssets).length > 0,
  );
  const runningNodeCount = visibleNodes.filter((node) => isActiveGenerationStatus(node.status)).length;
  const zoomPercent = Math.round(viewport.zoom * 100);
  const nodeBounds = useMemo(() => getNodesBounds(visibleNodes), [visibleNodes]);
  const viewportWorldRect = useMemo(
    () => getViewportWorldRect(viewport, viewportSize),
    [viewport, viewportSize],
  );
  const minimapLayout = useMemo(
    () => buildMinimapLayout(visibleNodes, nodeBounds, viewportWorldRect),
    [visibleNodes, nodeBounds, viewportWorldRect],
  );
  const shouldShowReturnToRange = Boolean(
    nodeBounds && viewportWorldRect && !doRectsIntersect(nodeBounds, viewportWorldRect),
  );
  const selectionRegionStyle = selectionRegion
    ? {
        left: selectionRegion.left * viewport.zoom + viewport.x,
        top: selectionRegion.top * viewport.zoom + viewport.y,
        width: (selectionRegion.right - selectionRegion.left) * viewport.zoom,
        height: (selectionRegion.bottom - selectionRegion.top) * viewport.zoom,
      }
    : null;
  const canCreateGroupFromSelection = Boolean(selectionRegion && selectedNodeIds.length >= 2);
  const focusedGroup = groups.find((group) => group.id === focusedGroupId) || null;
  const focusedGroupNodes = focusedGroup
    ? nodes.filter((node) => node.groupId === focusedGroup.id)
    : [];
  const elevatedCanvasNodeIds = useMemo(() => {
    if (focusedGroupId) {
      return new Set(
        nodes
          .filter((node) => node.groupId === focusedGroupId)
          .map((node) => node.id),
      );
    }
    return new Set(selectedNodeId ? [selectedNodeId] : []);
  }, [focusedGroupId, nodes, selectedNodeId]);
  const elevatedCanvasEdges = useMemo(
    () =>
      elevatedCanvasNodeIds.size > 0
        ? visibleEdges.filter(
            (edge) =>
              elevatedCanvasNodeIds.has(edge.from) ||
              elevatedCanvasNodeIds.has(edge.to),
          )
        : [],
    [elevatedCanvasNodeIds, visibleEdges],
  );
  const isFocusedGroupRunning = focusedGroupNodes.some(
    (node) =>
      generatingNodeIds.includes(node.id) ||
      isActiveGenerationStatus(node.generationStatus || node.status),
  );
  const isFocusedGroupSubmitting = Boolean(
    focusedGroup && submittingGroupIds.includes(focusedGroup.id),
  );
  const focusedGroupScreenRect = focusedGroup
    ? {
        left: focusedGroup.x * viewport.zoom + viewport.x,
        top: focusedGroup.y * viewport.zoom + viewport.y,
        right: (focusedGroup.x + focusedGroup.width) * viewport.zoom + viewport.x,
        bottom: (focusedGroup.y + focusedGroup.height) * viewport.zoom + viewport.y,
      }
    : null;
  const focusedGroupToolbarStyle =
    focusedGroupScreenRect &&
    focusedGroupScreenRect.right > 0 &&
    focusedGroupScreenRect.left < viewportSize.width &&
    focusedGroupScreenRect.bottom > 0 &&
    focusedGroupScreenRect.top < viewportSize.height
      ? {
          left: Math.min(
            Math.max((focusedGroupScreenRect.left + focusedGroupScreenRect.right) / 2, 112),
            Math.max(112, viewportSize.width - 112),
          ),
          top: Math.max(12, focusedGroupScreenRect.top - 54),
        }
      : null;
  const seedanceCharacterTotalPages = Math.max(
    1,
    Math.ceil(seedanceCharacters.length / SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE),
  );
  const visibleSeedanceCharacters = useMemo(() => {
    const start = (seedanceCharacterPage - 1) * SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE;
    return seedanceCharacters.slice(start, start + SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE);
  }, [seedanceCharacterPage, seedanceCharacters]);
  const seedanceLibraryNode = seedanceLibraryNodeId ? nodeMap[seedanceLibraryNodeId] : null;
  const selectedSeedanceVirtualAssetIds = getSeedanceVirtualAssetIds(seedanceLibraryNode?.seedanceVirtualAssets);

  selectedNodeIdRef.current = selectedNodeId;
  selectedNodeIdsRef.current = selectedNodeIds;
  selectedEdgeIdRef.current = selectedEdgeId;
  selectedEdgeIdsRef.current = selectedEdgeIds;
  onCanvasProjectReadyRef.current = onCanvasProjectReady;
  modelOptionsByNodeTypeRef.current = modelOptionsByNodeType;
  nodesRef.current = nodes;
  edgesRef.current = edges;
  groupsRef.current = groups;
  focusedGroupIdRef.current = focusedGroupId;
  deleteCanvasGroupRef.current = deleteCanvasGroup;
  removeCanvasItemsRef.current = removeCanvasItems;
  undoCanvasHistoryRef.current = undoCanvasHistory;
  redoCanvasHistoryRef.current = redoCanvasHistory;
  copySelectedCanvasNodesRef.current = copySelectedCanvasNodes;
  pasteCopiedCanvasNodesRef.current = pasteCopiedCanvasNodes;

  useEffect(() => {
    setProjectNameOverride('');
    setProjectNameDraft('');
    setIsProjectNameEditing(false);
  }, [projectIdentityKey]);

  useEffect(() => {
    if (!isGraphReady) {
      return;
    }

    const invalidStructuredVideoIds = new Set(
      nodes
        .filter((node) => {
          if (
            node.type !== 'video' ||
            node.videoInputMode === VIDEO_INPUT_MODE_REFERENCE
          ) {
            return false;
          }
          const modelOption = getSelectedModelOption(
            'video',
            node.model,
            modelOptionsByNodeType,
          );
          const lacksFirstFrame = modelOption?.supportsFirstFrame === false;
          const lacksEndFrame = modelOption?.supportsEndFrame === false;
          const isUnsupportedMode =
            lacksFirstFrame ||
            (node.videoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME &&
              lacksEndFrame);
          return (
            isUnsupportedMode ||
            getEffectiveVideoInputMode(node, edges, nodeMap) ===
              VIDEO_INPUT_MODE_REFERENCE
          );
        })
        .map((node) => node.id),
    );
    if (invalidStructuredVideoIds.size === 0) {
      return;
    }

    const nextNodes = nodes.map((node) =>
      invalidStructuredVideoIds.has(node.id)
        ? {
            ...node,
            modeType: '',
            videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
            videoModelCapabilityMode: VIDEO_INPUT_MODE_REFERENCE,
          }
        : node,
    );
    const nextNodeMap = nextNodes.reduce(
      (map, node) => ({ ...map, [node.id]: node }),
      {},
    );
    const referenceOrderByVideoId = new Map();
    const nextEdges = edges.map((edge) => {
      if (!invalidStructuredVideoIds.has(edge.to)) {
        return edge;
      }
      const sortOrder = referenceOrderByVideoId.get(edge.to) || 0;
      referenceOrderByVideoId.set(edge.to, sortOrder + 1);
      return {
        ...edge,
        sourcePortKey:
          edge.sourcePortKey ||
          (isResourceContainerNodeType(nextNodeMap[edge.from]?.type) ? 'output' : ''),
        targetPortKey: getReferenceTargetPortKey(nextNodeMap[edge.from]),
        sortOrder,
      };
    });

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [edges, isGraphReady, modelOptionsByNodeType, nodeMap, nodes]);

  function showConnectionNotice(clientX, clientY, text = '无法连接到该节点') {
    const point = getViewportPoint(clientX, clientY);
    setConnectionNotice({
      x: point.x,
      y: point.y,
      text,
    });
  }

  function showNoticeAtEvent(event, text) {
    const fallbackX = Math.round(window.innerWidth / 2);
    const fallbackY = 96;
    showConnectionNotice(event?.clientX || fallbackX, event?.clientY || fallbackY, text);
  }

  function beginProjectNameEdit() {
    setProjectNameDraft(projectDisplayName);
    setIsProjectNameEditing(true);
  }

  function commitProjectNameEdit() {
    if (!isProjectNameEditing) {
      return;
    }
    const nextProjectName =
      projectNameDraft.trim() || fallbackProjectName;
    const projectId = String(
      canvasProjectId ||
        activeProject?.backendProjectId ||
        activeProject?.id ||
        '',
    ).trim();

    setProjectNameOverride(nextProjectName);
    setProjectNameDraft(nextProjectName);
    setIsProjectNameEditing(false);
    saveFreeCanvasProjectName(projectId, nextProjectName);
    if (typeof onProjectNameChange === 'function') {
      onProjectNameChange(nextProjectName);
    }
  }

  function cancelProjectNameEdit() {
    setProjectNameDraft(projectDisplayName);
    setIsProjectNameEditing(false);
  }

  const loadSeedanceCharacters = useCallback(async (projectId = canvasProjectId) => {
    if (!projectId) {
      setSeedanceCharacters([]);
      setSeedanceCharactersError('画布项目未就绪');
      return;
    }

    seedanceCharactersLoadedProjectIdRef.current = projectId;
    setSeedanceCharactersLoading(true);
    setSeedanceCharactersError('');
    try {
      const result = await freeCanvasApi.listSeedanceVirtualCharacters(projectId);
      const nextCharacters = normalizeSeedanceCharacters(result);
      setSeedanceCharacters(nextCharacters);
      setSeedanceCharacterPage((current) => {
        const totalPages = Math.max(1, Math.ceil(nextCharacters.length / SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE));
        return Math.min(current, totalPages);
      });
      return nextCharacters;
    } catch (error) {
      seedanceCharactersLoadedProjectIdRef.current = '';
      setSeedanceCharacters([]);
      setSeedanceCharactersError(parseApiErrorMessage(error, '真人照片素材加载失败'));
      return [];
    } finally {
      setSeedanceCharactersLoading(false);
    }
  }, [canvasProjectId]);

  useEffect(() => {
    if (
      !isGraphReady ||
      !canvasProjectId ||
      !hasVideoVirtualAssetReferences ||
      seedanceCharactersLoadedProjectIdRef.current === canvasProjectId
    ) {
      return;
    }

    loadSeedanceCharacters(canvasProjectId);
  }, [
    canvasProjectId,
    hasVideoVirtualAssetReferences,
    isGraphReady,
    loadSeedanceCharacters,
  ]);

  function getFirstAvailableVideoModelForCapability(
    node,
    capabilityMode,
    { ignoreCurrentInputs = false } = {},
  ) {
    if (!node || node.type !== 'video') {
      return null;
    }

    const currentNodes = nodesRef.current;
    const currentNodeMap = currentNodes.reduce(
      (map, currentNode) => ({ ...map, [currentNode.id]: currentNode }),
      {},
    );
    const currentEdges = ignoreCurrentInputs
      ? edgesRef.current.filter((edge) => edge.to !== node.id)
      : edgesRef.current;
    return (
      getModelOptionsByConnectionAvailability(
        getNodeModelOptions('video', modelOptionsByNodeTypeRef.current),
        currentEdges,
        currentNodeMap,
        node,
        (modelOption) =>
          getVideoModelCapabilityViolation(modelOption, capabilityMode),
      ).find(({ modelConnectionViolation }) => !modelConnectionViolation)?.model ||
      null
    );
  }

  async function refreshSeedanceVirtualAsset(virtualAssetId, { silent = false } = {}) {
    const safeAssetId = String(virtualAssetId || '').trim();
    if (!canvasProjectId || !safeAssetId) {
      return null;
    }

    setRefreshingSeedanceAssetIds((current) => (current.includes(safeAssetId) ? current : [...current, safeAssetId]));
    if (!silent) {
      setSeedanceCharactersError('');
    }
    try {
      const result = await freeCanvasApi.refreshSeedanceVirtualCharacterAsset(canvasProjectId, safeAssetId);
      await loadSeedanceCharacters(canvasProjectId);
      return result;
    } catch (error) {
      if (!silent) {
        setSeedanceCharactersError(parseApiErrorMessage(error, '素材状态刷新失败'));
      }
      return null;
    } finally {
      setRefreshingSeedanceAssetIds((current) => current.filter((item) => item !== safeAssetId));
    }
  }

  async function waitForSeedanceVirtualAssetActive(virtualAssetId) {
    const safeAssetId = String(virtualAssetId || '').trim();
    if (!safeAssetId) {
      return null;
    }

    for (let attempt = 0; attempt < SEEDANCE_VIRTUAL_ASSET_REFRESH_MAX_ATTEMPTS; attempt += 1) {
      const result = await refreshSeedanceVirtualAsset(safeAssetId, { silent: true });
      const refreshedCharacters = normalizeSeedanceCharacters(result);
      const refreshedAsset = refreshedCharacters.find((item) => item.virtualAssetId === safeAssetId);
      if (
        refreshedAsset?.isActive ||
        isSeedanceVirtualAssetActive(findSeedanceAssetStatusDeep(result, safeAssetId))
      ) {
        const nextCharacters = await loadSeedanceCharacters(canvasProjectId);
        return (
          nextCharacters.find((item) => item.virtualAssetId === safeAssetId) ||
          refreshedAsset || {
            virtualAssetId: safeAssetId,
            isActive: true,
          }
        );
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, SEEDANCE_VIRTUAL_ASSET_REFRESH_INTERVAL_MS);
      });
    }

    await loadSeedanceCharacters(canvasProjectId);
    return null;
  }

  function removeInternalVideoFrameRoles(videoNodeId, roles) {
    const roleSet = new Set(roles);
    if (!videoNodeId || roleSet.size === 0) {
      return false;
    }
    const internalNodeIds = new Set(
      nodesRef.current
        .filter(
          (node) =>
            isInternalVideoFrameNode(node) &&
            node.videoInputTargetNodeId === videoNodeId &&
            roleSet.has(node.videoInputRole),
        )
        .map((node) => node.id),
    );
    const nextGraph = removeCanvasGraphItems(
      nodesRef.current,
      edgesRef.current,
      internalNodeIds,
      [],
    );
    const nextNodes = nextGraph.nodes.map((node) =>
      node.id === videoNodeId
        ? clearVideoFrameAssetState(node, [...roleSet])
        : node,
    );
    nodesRef.current = nextNodes;
    edgesRef.current = nextGraph.edges;
    setNodes(nextNodes);
    setEdges(nextGraph.edges);
    if (internalNodeIds.size > 0) {
      setUploadingNodeIds((current) =>
        current.filter((nodeId) => !internalNodeIds.has(nodeId)),
      );
      setHoveredEdgeId('');
      setSelectedEdgeId('');
      setSelectedEdgeIds([]);
    }
    return internalNodeIds.size > 0;
  }

  function getExtractedFrameNodeWorldPoint(videoNode) {
    const imageSize = getDefaultNodeSize('upload_image');
    const horizontalGap = 48;
    const centerX =
      videoNode.x + videoNode.width + horizontalGap + imageSize.width / 2;
    const centerY = videoNode.y + videoNode.height / 2;
    const verticalStep = imageSize.height + 24;
    const offsets = [0, 1, -1, 2, -2, 3, -3];
    const availableOffset =
      offsets.find((offset) => {
        const candidate = {
          left: centerX - imageSize.width / 2,
          top: centerY + offset * verticalStep - imageSize.height / 2,
          right: centerX + imageSize.width / 2,
          bottom: centerY + offset * verticalStep + imageSize.height / 2,
        };
        return !nodesRef.current.some(
          (node) =>
            node.id !== videoNode.id &&
            candidate.left < node.x + node.width + 16 &&
            candidate.right > node.x - 16 &&
            candidate.top < node.y + node.height + 16 &&
            candidate.bottom > node.y - 16,
        );
      }) ?? 0;

    return {
      x: centerX,
      y: centerY + availableOffset * verticalStep,
    };
  }

  function setVideoStructuredInputMode(videoNodeId, mode, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const videoNode = nodesRef.current.find(
      (node) => node.id === videoNodeId && node.type === 'video',
    );
    if (!videoNode) {
      return;
    }

    const nextModeModel = getFirstAvailableVideoModelForCapability(
      videoNode,
      mode,
      { ignoreCurrentInputs: true },
    );
    if (!nextModeModel) {
      showNoticeAtEvent(
        event,
        mode === VIDEO_INPUT_MODE_FIRST_END_FRAME
          ? '暂无支持首尾帧的可用模型'
          : '暂无支持首帧的可用模型',
      );
      return;
    }
    const allowedRoles = new Set(getVideoFrameUploadRoles(mode));
    const obsoleteInternalNodeIds = new Set(
      nodesRef.current
        .filter(
          (node) =>
            isInternalVideoFrameNode(node) &&
            node.videoInputTargetNodeId === videoNodeId &&
            !allowedRoles.has(node.videoInputRole),
        )
        .map((node) => node.id),
    );
    const removedInputEdgeIds = new Set(
      edgesRef.current
        .filter(
          (edge) =>
            edge.to === videoNodeId &&
            (!isInternalVideoFrameNode(
              nodesRef.current.find((node) => node.id === edge.from),
            ) || obsoleteInternalNodeIds.has(edge.from)),
        )
        .map((edge) => edge.id),
    );
    const nextGraph = removeCanvasGraphItems(
      nodesRef.current,
      edgesRef.current,
      obsoleteInternalNodeIds,
      removedInputEdgeIds,
    );
    const nextNodes = nextGraph.nodes.map((node) => {
      if (node.id !== videoNodeId) {
        return node;
      }
      const clearedNode = clearVideoFrameAssetState(
        node,
        mode === VIDEO_INPUT_MODE_FIRST_FRAME
          ? [VIDEO_INPUT_ROLE_END_FRAME]
          : [],
      );
      return {
        ...clearedNode,
        ...getVideoModelSelectionPatch(clearedNode, nextModeModel),
        modeType:
          mode === VIDEO_INPUT_MODE_FIRST_END_FRAME
            ? VIDEO_INPUT_MODE_FIRST_END_FRAME
            : '',
        videoInputMode: mode,
        videoModelCapabilityMode: mode,
        seedanceVirtualAssets: [],
      };
    });
    nodesRef.current = nextNodes;
    edgesRef.current = nextGraph.edges;
    setNodes(nextNodes);
    setEdges(nextGraph.edges);
    setHoveredEdgeId((current) =>
      removedInputEdgeIds.has(current) ? '' : current,
    );
    setSelectedEdgeId((current) =>
      removedInputEdgeIds.has(current) ? '' : current,
    );
    setSelectedEdgeIds((current) =>
      current.filter((edgeId) => !removedInputEdgeIds.has(edgeId)),
    );
    selectNodes([videoNodeId], videoNodeId);
    setPromptFocusNodeId(videoNodeId);
  }

  function syncSeedanceVirtualAssetToVideoNode(videoNodeId, character) {
    const virtualAssetId = String(character?.virtualAssetId || '').trim();
    const videoNode = nodesRef.current.find(
      (node) => node.id === videoNodeId && node.type === 'video',
    );
    if (!videoNode || !virtualAssetId) {
      return false;
    }

    const legacyResourceNodeIds = new Set(
      nodesRef.current
        .filter(
          (node) =>
            ['image', 'upload_image'].includes(node.type) &&
            node.seedanceVirtualAssetTargetNodeId === videoNodeId,
        )
        .map((node) => node.id),
    );
    const legacyGroupIds = new Set(
      nodesRef.current
        .filter((node) => legacyResourceNodeIds.has(node.id) && node.groupId)
        .map((node) => node.groupId),
    );
    const removableLegacyGroupIds = new Set(
      [...legacyGroupIds].filter((groupId) => {
        const group = groupsRef.current.find(
          (currentGroup) => currentGroup.id === groupId,
        );
        const groupNodes = nodesRef.current.filter(
          (node) => node.groupId === groupId,
        );
        return (
          group?.title === '角色参考组' &&
          groupNodes.length > 0 &&
          groupNodes.every(
            (node) =>
              node.id === videoNodeId || legacyResourceNodeIds.has(node.id),
          )
        );
      }),
    );
    const cleanedGraph = removeCanvasGraphItems(
      nodesRef.current,
      edgesRef.current,
      legacyResourceNodeIds,
      [],
    );
    const nextNodes = cleanedGraph.nodes.map((node) => {
      if (node.id === videoNodeId) {
        return {
          ...node,
          groupId: removableLegacyGroupIds.has(node.groupId)
            ? ''
            : node.groupId,
          modeType: '',
          videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
          videoModelCapabilityMode:
            VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER,
          seedanceVirtualAssets: [
            {
              virtualAssetId,
              role: 'reference_image',
            },
          ],
        };
      }
      return node;
    });
    const nextGroups = groupsRef.current.filter(
      (group) => !removableLegacyGroupIds.has(group.id),
    );

    nodesRef.current = nextNodes;
    edgesRef.current = cleanedGraph.edges;
    groupsRef.current = nextGroups;
    setNodes(nextNodes);
    setEdges(cleanedGraph.edges);
    setGroups(nextGroups);
    return true;
  }

  function applySeedanceVirtualAssetToNode(character) {
    const virtualAssetId = String(character?.virtualAssetId || '').trim();
    if (!seedanceLibraryNodeId || !virtualAssetId || !character?.isActive) {
      return;
    }

    if (syncSeedanceVirtualAssetToVideoNode(seedanceLibraryNodeId, character)) {
      setSeedanceLibraryOpen(false);
    }
  }

  async function deleteSeedanceVirtualAsset(character) {
    const virtualAssetId = String(character?.virtualAssetId || '').trim();
    if (!canvasProjectId || !virtualAssetId || deletingSeedanceAssetIds.includes(virtualAssetId)) {
      return;
    }

    setDeletingSeedanceAssetIds((current) => (current.includes(virtualAssetId) ? current : [...current, virtualAssetId]));
    setSeedanceCharactersError('');
    try {
      await freeCanvasApi.deleteSeedanceVirtualCharacterAsset(canvasProjectId, virtualAssetId);
      setSeedanceCharacters((current) => {
        const nextCharacters = current.filter((item) => item.virtualAssetId !== virtualAssetId);
        setSeedanceCharacterPage((currentPage) => {
          const totalPages = Math.max(1, Math.ceil(nextCharacters.length / SEEDANCE_CHARACTER_LIBRARY_PAGE_SIZE));
          return Math.min(currentPage, totalPages);
        });
        return nextCharacters;
      });

      if (selectedSeedanceVirtualAssetIds.includes(virtualAssetId) && seedanceLibraryNodeId) {
        updateNode(seedanceLibraryNodeId, {
          seedanceVirtualAssets: normalizeSeedanceVirtualAssets(seedanceLibraryNode?.seedanceVirtualAssets).filter(
            (asset) => asset.virtualAssetId !== virtualAssetId,
          ),
        });
      }

      await loadSeedanceCharacters(canvasProjectId);
    } catch (error) {
      setSeedanceCharactersError(parseApiErrorMessage(error, '删除真人照片素材失败'));
    } finally {
      setDeletingSeedanceAssetIds((current) => current.filter((item) => item !== virtualAssetId));
    }
  }

  function openSeedanceLibrary(nodeId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canvasProjectId) {
      showNoticeAtEvent(event, '画布项目未就绪');
      return;
    }
    const targetNode = nodesRef.current.find((node) => node.id === nodeId);
    const nextVirtualCharacterModel =
      getFirstAvailableVideoModelForCapability(
        targetNode,
        VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER,
      );
    if (!nextVirtualCharacterModel) {
      showNoticeAtEvent(event, '暂无支持虚拟人像库的可用模型');
      return;
    }
    removeInternalVideoFrameRoles(nodeId, [
      VIDEO_INPUT_ROLE_FIRST_FRAME,
      VIDEO_INPUT_ROLE_END_FRAME,
    ]);
    const nextNodes = nodesRef.current.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            ...getVideoModelSelectionPatch(node, nextVirtualCharacterModel),
            modeType: '',
            videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
            videoModelCapabilityMode:
              VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER,
          }
        : node,
    );
    const nextNodeMap = nextNodes.reduce(
      (map, node) => ({ ...map, [node.id]: node }),
      {},
    );
    let referenceOrder = 0;
    const nextEdges = edgesRef.current.map((edge) => {
      if (edge.to !== nodeId) {
        return edge;
      }
      const normalizedEdge = {
        ...edge,
        sourcePortKey:
          edge.sourcePortKey ||
          (isResourceContainerNodeType(nextNodeMap[edge.from]?.type)
            ? 'output'
            : ''),
        targetPortKey: getReferenceTargetPortKey(nextNodeMap[edge.from]),
        sortOrder: referenceOrder,
      };
      referenceOrder += 1;
      return normalizedEdge;
    });
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSeedanceLibraryNodeId(nodeId);
    setSeedanceLibraryOpen(true);
    setSeedanceCharacterPage(1);
    loadSeedanceCharacters(canvasProjectId);
  }

  function closeSeedanceLibrary() {
    setSeedanceLibraryOpen(false);
    setSeedanceLibraryNodeId('');
  }

  function triggerSeedanceCharacterUpload(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (isUploadingSeedanceCharacter) {
      return;
    }
    const uploadInput = seedanceCharacterUploadInputRef.current;
    if (uploadInput) {
      uploadInput.value = '';
      uploadInput.click();
    }
  }

  async function uploadSeedanceCharacterPhoto(event) {
    const file = event.target.files?.[0];
    const targetVideoNodeId = seedanceLibraryNodeId;
    if (event.target) {
      event.target.value = '';
    }
    if (!file || !canvasProjectId) {
      return;
    }

    try {
      await validateImageFileDimensions(file);
    } catch (error) {
      setSeedanceCharactersError(error.message || '图片不符合上传要求');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name || '');
    formData.append('character_name', getFileBaseName(file.name));
    formData.append('description', '');
    formData.append('ark_project_name', projectDisplayName);

    setIsUploadingSeedanceCharacter(true);
    setSeedanceCharactersError('');
    try {
      const result = await freeCanvasApi.uploadSeedanceVirtualCharacterAsset(canvasProjectId, formData);
      const uploadedCharacters = normalizeSeedanceCharacters(result);
      const uploadedAssetId =
        uploadedCharacters.find((item) => item.virtualAssetId)?.virtualAssetId || findSeedanceVirtualAssetIdDeep(result);
      setSeedanceCharacterPage(1);
      await loadSeedanceCharacters(canvasProjectId);
      if (uploadedAssetId) {
        const activeCharacter = await waitForSeedanceVirtualAssetActive(uploadedAssetId);
        if (activeCharacter && targetVideoNodeId) {
          const uploadedCharacter = uploadedCharacters.find(
            (item) => item.virtualAssetId === uploadedAssetId,
          );
          syncSeedanceVirtualAssetToVideoNode(targetVideoNodeId, {
            ...uploadedCharacter,
            ...activeCharacter,
            virtualAssetId: uploadedAssetId,
            name:
              activeCharacter.name ||
              uploadedCharacter?.name ||
              getFileBaseName(file.name) ||
              '虚拟人像',
            imageUrl:
              activeCharacter.imageUrl ||
              uploadedCharacter?.imageUrl ||
              resolveSeedanceImageUrl(result),
          });
          setSeedanceLibraryOpen(false);
        } else if (!activeCharacter) {
          setSeedanceCharactersError('素材仍在处理中，状态变为 Active 后才能参与生成');
        }
      }
    } catch (error) {
      setSeedanceCharactersError(parseApiErrorMessage(error, '真人照片上传失败'));
    } finally {
      setIsUploadingSeedanceCharacter(false);
    }
  }

  function getNodePrompt(node) {
    return String(node?.type === 'script' ? node?.textPromptContent || '' : node?.content || '').trim();
  }

  function getWorkflowPointsCandidateNodes() {
    return visibleNodes.filter((node) => POINTS_QUOTE_NODE_TYPES.includes(node.type) && getNodePrompt(node));
  }

  function getNodePointsQuoteText(nodeId) {
    const quote = nodePointQuotes[nodeId] || createDefaultPointQuote();
    if (quote.loading) {
      return '积分计算中...';
    }
    if (quote.error) {
      return quote.error;
    }
    if (quote.points != null) {
      return `预计扣除 ${formatPointsValue(quote.points)} 积分`;
    }
    return '积分待计算';
  }

  function getWorkflowPointsQuoteText() {
    if (workflowPointQuote.loading) {
      return '积分计算中...';
    }
    if (workflowPointQuote.error) {
      return workflowPointQuote.error;
    }
    if (workflowPointQuote.points != null) {
      return `预计扣除 ${formatPointsValue(workflowPointQuote.points)} 积分`;
    }
    if (pointsQuoteSpecs.length === 0 && getWorkflowPointsCandidateNodes().length === 0) {
      return '预计扣除 0 积分';
    }
    return '积分待计算';
  }

  function getNodeSetPointsQuoteText(targetNodes = []) {
    const candidateNodes = targetNodes.filter(
      (node) => POINTS_QUOTE_NODE_TYPES.includes(node.type) && getNodePrompt(node),
    );
    if (candidateNodes.length === 0) {
      return '预计扣除 0 积分';
    }

    const quotes = candidateNodes.map(
      (node) => nodePointQuotes[node.id] || createDefaultPointQuote(),
    );
    if (quotes.some((quote) => quote.loading)) {
      return '积分计算中...';
    }
    const failedQuote = quotes.find((quote) => quote.error);
    if (failedQuote) {
      return failedQuote.error;
    }
    if (quotes.every((quote) => quote.points != null)) {
      const totalPoints = quotes.reduce(
        (total, quote) => total + normalizePointsValue(quote.points),
        0,
      );
      return `预计扣除 ${formatPointsValue(totalPoints)} 积分`;
    }
    return '积分待计算';
  }

  function showPointsTip(target) {
    const text = String(target?.getAttribute?.('data-points-tip') || '').trim();
    if (!target || !text) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const tooltipPadding = 12;
    const estimatedWidth = Math.min(Math.max(text.length * 12 + 24, 96), 240);
    const minLeft = tooltipPadding + estimatedWidth / 2;
    const maxLeft = Math.max(minLeft, viewportWidth - tooltipPadding - estimatedWidth / 2);
    const centerLeft = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centerLeft, minLeft), maxLeft);
    const placement = rect.top < 54 ? 'bottom' : 'top';
    const top = placement === 'top' ? rect.top : rect.bottom;

    pointsTipTargetRef.current = target;
    setPointsTip({
      visible: true,
      text,
      left,
      top,
      placement,
    });
  }

  function hidePointsTip(target) {
    if (target && pointsTipTargetRef.current && target !== pointsTipTargetRef.current) {
      return;
    }
    pointsTipTargetRef.current = null;
    setPointsTip(createDefaultPointsTipState());
  }

  function handlePointsTipMouseOver(event) {
    const target = event.target?.closest?.('[data-points-tip]');
    if (!target || !event.currentTarget.contains(target)) {
      return;
    }
    if (event.relatedTarget && target.contains(event.relatedTarget)) {
      return;
    }
    showPointsTip(target);
  }

  function handlePointsTipMouseOut(event) {
    const target = event.target?.closest?.('[data-points-tip]');
    if (!target || !event.currentTarget.contains(target)) {
      return;
    }
    if (event.relatedTarget && target.contains(event.relatedTarget)) {
      return;
    }
    hidePointsTip(target);
  }

  function handlePointsTipFocus(event) {
    const target = event.target?.closest?.('[data-points-tip]');
    if (!target || !event.currentTarget.contains(target)) {
      return;
    }
    showPointsTip(target);
  }

  function handlePointsTipBlur(event) {
    const target = event.target?.closest?.('[data-points-tip]');
    if (!target || !event.currentTarget.contains(target)) {
      return;
    }
    hidePointsTip(target);
  }

  function getNodeSelectedModelOption(node) {
    return node ? getSelectedModelOption(node.type, node.model, modelOptionsByNodeType) : null;
  }

  function getConnectionLimitViolation(normalizedEdge) {
    if (!normalizedEdge) {
      return null;
    }

    const sourceNode = nodeMap[normalizedEdge.from];
    const targetNode = nodeMap[normalizedEdge.to];
    return getConnectionInputLimitViolation(
      edges,
      nodeMap,
      sourceNode,
      targetNode,
      getNodeSelectedModelOption(targetNode),
    );
  }

  function getNewNodeConnectionLimitViolation(sourceNode, targetType, sourceSide = 'right') {
    if (!sourceNode || !targetType) {
      return null;
    }

    const defaultModelLabel = getNewNodeModelLabel(targetType, sourceNode, modelOptionsByNodeType);
    const targetNode = {
      id: '__new_node__',
      type: targetType,
      model: defaultModelLabel,
    };
    const sourceIsTarget = sourceSide === 'left';
    return getConnectionInputLimitViolation(
      sourceIsTarget ? edges : [],
      nodeMap,
      sourceIsTarget ? targetNode : sourceNode,
      sourceIsTarget ? sourceNode : targetNode,
      sourceIsTarget
        ? getNodeSelectedModelOption(sourceNode)
        : getSelectedModelOption(targetType, defaultModelLabel, modelOptionsByNodeType),
    );
  }

  const pointsQuoteSpecs = useMemo(
    () =>
      visibleNodes
        .map((node) => {
          const selectedModel = getSelectedModelOption(node.type, node.model, modelOptionsByNodeType);
          const modelId = selectedModel?.modelId || null;
          if (!POINTS_QUOTE_NODE_TYPES.includes(node.type) || !modelId || !getNodePrompt(node)) {
            return null;
          }

          const params = {
            ...getNodeGenerateParams(node, edges, nodes),
            node_type: node.type,
            nodeType: node.type,
            count: 1,
          };

          return {
            nodeId: node.id,
            nodeType: node.type,
            modelId,
            params,
            signature: JSON.stringify({ modelId, params }),
          };
        })
        .filter(Boolean),
    [edges, modelOptionsByNodeType, nodes, visibleNodes],
  );
  const pointsQuoteSignature = useMemo(
    () =>
      JSON.stringify(
        pointsQuoteSpecs.map((spec) => ({
          nodeId: spec.nodeId,
          signature: spec.signature,
        })),
      ),
    [pointsQuoteSpecs],
  );
  pointsQuoteSpecsRef.current = pointsQuoteSpecs;

  useEffect(() => {
    const quoteSpecsSnapshot = pointsQuoteSpecsRef.current;
    if (quoteSpecsSnapshot.length === 0) {
      nodePointQuoteSignaturesRef.current = {};
      nodePointQuoteValuesRef.current = {};
      setNodePointQuotes({});
      setWorkflowPointQuote(createDefaultPointQuote());
      return undefined;
    }

    const previousSignatures = nodePointQuoteSignaturesRef.current;
    const nextSignatures = {};
    const activeNodeIds = new Set();
    const changedSpecs = [];

    quoteSpecsSnapshot.forEach((spec) => {
      activeNodeIds.add(spec.nodeId);
      nextSignatures[spec.nodeId] = spec.signature;
      const cachedQuote = nodePointQuoteValuesRef.current[spec.nodeId];
      const hasCompletedQuote = Boolean(
        cachedQuote &&
          !cachedQuote.loading &&
          (cachedQuote.points != null || cachedQuote.error),
      );
      if (previousSignatures[spec.nodeId] !== spec.signature || !hasCompletedQuote) {
        changedSpecs.push(spec);
      }
    });

    const hasRemovedSpecs = Object.keys(previousSignatures).some((nodeId) => !activeNodeIds.has(nodeId));
    Object.keys(nodePointQuoteValuesRef.current).forEach((nodeId) => {
      if (!activeNodeIds.has(nodeId)) {
        delete nodePointQuoteValuesRef.current[nodeId];
      }
    });
    nodePointQuoteSignaturesRef.current = nextSignatures;

    if (changedSpecs.length === 0) {
      if (hasRemovedSpecs) {
        const nextQuotes = pickNodePointQuotes(quoteSpecsSnapshot, nodePointQuoteValuesRef.current);
        setNodePointQuotes(nextQuotes);
        setWorkflowPointQuote(buildWorkflowPointQuote(quoteSpecsSnapshot, nextQuotes));
      }
      return undefined;
    }

    let ignored = false;
    const timer = window.setTimeout(() => {
      const changedNodeIds = new Set(changedSpecs.map((spec) => spec.nodeId));
      setNodePointQuotes((current) => {
        const next = pickNodePointQuotes(quoteSpecsSnapshot, {
          ...nodePointQuoteValuesRef.current,
          ...current,
        });
        quoteSpecsSnapshot.forEach((spec) => {
          if (changedNodeIds.has(spec.nodeId)) {
            next[spec.nodeId] = {
              ...(current[spec.nodeId] || createDefaultPointQuote()),
              loading: true,
              error: '',
            };
          }
        });
        return next;
      });
      setWorkflowPointQuote((current) => ({
        ...current,
        loading: true,
        error: '',
      }));

      Promise.all(
        changedSpecs.map((spec) =>
          pointsApi.quote({
            modelId: spec.modelId,
            params: spec.params,
          }, {
            timeout: POINTS_QUOTE_TIMEOUT_MS,
          })
            .then((quote) => {
              const points = resolveQuotePoints(quote);
              return {
                nodeId: spec.nodeId,
                points,
                error: points == null ? '积分报价失败' : '',
              };
            })
            .catch(() => ({
              nodeId: spec.nodeId,
              points: null,
              error: '积分报价失败',
            })),
        ),
      ).then((results) => {
        if (ignored) {
          return;
        }

        results.forEach((result) => {
          nodePointQuoteValuesRef.current[result.nodeId] = {
            loading: false,
            points: result.points,
            error: result.error,
          };
        });
        const nextQuotes = pickNodePointQuotes(quoteSpecsSnapshot, nodePointQuoteValuesRef.current);
        setNodePointQuotes(nextQuotes);

        setWorkflowPointQuote(buildWorkflowPointQuote(quoteSpecsSnapshot, nextQuotes));
      });
    }, 300);

    return () => {
      ignored = true;
      window.clearTimeout(timer);
    };
  }, [pointsQuoteSignature]);

  useEffect(() => {
    if (!pointsTip.visible) {
      return undefined;
    }

    const currentTarget = pointsTipTargetRef.current;
    if (
      !currentTarget ||
      !document.body.contains(currentTarget) ||
      currentTarget.disabled ||
      !currentTarget.getAttribute('data-points-tip')
    ) {
      hidePointsTip(currentTarget);
      return undefined;
    }
    showPointsTip(currentTarget);

    function closeFloatingPointsTip() {
      hidePointsTip(pointsTipTargetRef.current);
    }

    window.addEventListener('scroll', closeFloatingPointsTip, true);
    window.addEventListener('resize', closeFloatingPointsTip);

    return () => {
      window.removeEventListener('scroll', closeFloatingPointsTip, true);
      window.removeEventListener('resize', closeFloatingPointsTip);
    };
  }, [focusedGroupId, nodePointQuotes, pointsTip.visible, workflowPointQuote]);

  useEffect(() => {
    let disposed = false;

    async function loadFreeCanvasModels() {
      try {
        const result = await freeCanvasApi.listModels();
        if (disposed) {
          return;
        }

        const nextOptions = normalizeFreeCanvasModelOptions(result);
        modelOptionsByNodeTypeRef.current = nextOptions;
        setModelOptionsByNodeType(nextOptions);
        setNodes((current) => normalizeNodesModels(current, nextOptions));
      } catch {
        // Keep built-in options when the model registry is temporarily unavailable.
      }
    }

    loadFreeCanvasModels();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearAllNodeRunSyncTimers();
      clearWorkflowRunSyncTimer();
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function loadFreeCanvasGraph() {
      setIsGraphReady(false);
      resetCanvasHistory();
      videoFrameExtractionInFlightRef.current = false;
      setVideoFrameExtractor(createDefaultVideoFrameExtractorState());
      setGroups([]);
      setSelectionRegion(null);
      setFocusedGroupId('');
      groupExecutionIdsRef.current.clear();
      setSubmittingGroupIds([]);

      try {
        let projectId = String(activeProject?.backendProjectId || '').trim();
        if (!projectId) {
          const createdProject = await freeCanvasApi.createProject({
            project_name: projectDisplayName,
            description: '',
          });
          projectId = String(createdProject?.project_id ?? createdProject?.projectId ?? createdProject?.canvas_id ?? '').trim();
          if (projectId && typeof onCanvasProjectReadyRef.current === 'function') {
            onCanvasProjectReadyRef.current({
              id: activeProject?.id || projectId,
              backendProjectId: projectId,
              name: projectDisplayName,
              projectType: 'canvas',
            });
          }
        }

        if (!projectId) {
          throw new Error('missing free canvas project id');
        }

        let graph = null;
        try {
          graph = await freeCanvasApi.getGraph(projectId);
        } catch (error) {
          if (!activeProject?.backendProjectId) {
            throw error;
          }

          const createdProject = await freeCanvasApi.createProject({
            project_name: projectDisplayName,
            description: '',
          });
          projectId = String(createdProject?.project_id ?? createdProject?.projectId ?? createdProject?.canvas_id ?? '').trim();
          if (!projectId) {
            throw error;
          }
          if (typeof onCanvasProjectReadyRef.current === 'function') {
            onCanvasProjectReadyRef.current({
              id: activeProject?.id || projectId,
              backendProjectId: projectId,
              name: projectDisplayName,
              projectType: 'canvas',
            });
          }
          graph = await freeCanvasApi.getGraph(projectId);
        }
        if (disposed) {
          return;
        }

        const normalizedGraph = normalizeGraphPayload(graph);
        const nextNodes = normalizeNodesModels(normalizedGraph.nodes, modelOptionsByNodeTypeRef.current);
        const nextEdges = normalizedGraph.edges;
        const nextGroups = normalizedGraph.groups;
        const activeGenerationNodes = nextNodes.filter((node) => isActiveGenerationStatus(node.generationStatus || node.status));
        const failedGenerationNodeIds = nextNodes
          .filter((node) => isFailureGenerationStatus(node.generationStatus || node.status))
          .map((node) => node.id);

        clearAllNodeRunSyncTimers();
        clearWorkflowRunSyncTimer();
        setCanvasProjectId(projectId);
        setNodes(nextNodes);
        setEdges(nextEdges);
        setGroups(nextGroups);
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        setViewport(
          getFittedViewportForNodes(
            nextNodes.filter((node) => !isInternalVideoFrameNode(node)),
            viewportRect?.width || viewportSize.width || window.innerWidth,
            viewportRect?.height || viewportSize.height || window.innerHeight,
          ),
        );
        setGeneratingNodeIds(activeGenerationNodes.map((node) => node.id));
        setGenerationFailedNodeIds(failedGenerationNodeIds);
        canvasVersionRef.current = getGraphVersion(graph);
        persistedNodeIdsRef.current = new Set(normalizedGraph.nodes.map((node) => node.id));
        persistedEdgeIdsRef.current = new Set(normalizedGraph.edges.map((edge) => edge.id));
        nodeSequenceRef.current = getEntitySequenceFloor(nextNodes);
        edgeSequenceRef.current = getEntitySequenceFloor(nextEdges);
        groupSequenceRef.current = getEntitySequenceFloor(nextGroups);
        resetCanvasHistory(nextNodes, nextEdges, nextGroups);
        skipUpcomingGraphSaves(1);
        setIsGraphReady(true);
        activeGenerationNodes.forEach((node) => {
          if (node.generationRunId) {
            scheduleNodeRunSync(projectId, node.id, node.generationRunId);
          }
        });
        await restoreLatestWorkflowRun(projectId, () => disposed, nextNodes);
      } catch {
        if (disposed) {
          return;
        }

        clearAllNodeRunSyncTimers();
        clearWorkflowRunSyncTimer();
        setCanvasProjectId('');
        setNodes([]);
        setEdges([]);
        setGroups([]);
        setFocusedGroupId('');
        setGeneratingNodeIds([]);
        setGenerationFailedNodeIds([]);
        setIsRunningWorkflow(false);
        groupExecutionIdsRef.current.clear();
        setSubmittingGroupIds([]);
        persistedNodeIdsRef.current = new Set();
        persistedEdgeIdsRef.current = new Set();
        canvasVersionRef.current = null;
        resetCanvasHistory();
        setIsGraphReady(false);
      }
    }

    loadFreeCanvasGraph();

    return () => {
      disposed = true;
      clearAllNodeRunSyncTimers();
      clearWorkflowRunSyncTimer();
    };
    // The graph bootstrap should only restart when the active canvas project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.backendProjectId, activeProject?.id]);

  const saveGraphSnapshotNow = useCallback(async (nodesSnapshot, edgesSnapshot) => {
    if (!isGraphReady || !canvasProjectId) {
      return false;
    }

    if (graphSaveTimerRef.current) {
      window.clearTimeout(graphSaveTimerRef.current);
      graphSaveTimerRef.current = null;
    }

    for (let attempt = 0; isSavingGraphRef.current && attempt < 20; attempt += 1) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });
    }

    if (isSavingGraphRef.current) {
      return false;
    }

    const payload = buildGraphPatchPayload({
      nodes: nodesSnapshot,
      edges: edgesSnapshot,
      persistedNodeIds: persistedNodeIdsRef.current,
      persistedEdgeIds: persistedEdgeIdsRef.current,
      groups: groupsRef.current,
      baseVersion: canvasVersionRef.current,
      projectId: canvasProjectId,
      sessionId: sessionIdRef.current,
    });

    if (!hasGraphPatchChanges(payload)) {
      return true;
    }

    isSavingGraphRef.current = true;
    try {
      const result = await freeCanvasApi.patchGraph(canvasProjectId, payload);
      const nextVersion = getGraphVersion(result);
      if (nextVersion != null) {
        canvasVersionRef.current = nextVersion;
      }
      persistedNodeIdsRef.current = new Set(nodesSnapshot.map((node) => node.id));
      persistedEdgeIdsRef.current = new Set(edgesSnapshot.map((edge) => edge.id));
      return true;
    } catch {
      // Keep local edits visible; the next canvas change will retry the graph patch.
      return false;
    } finally {
      isSavingGraphRef.current = false;
    }
  }, [canvasProjectId, isGraphReady]);

  useEffect(() => {
    if (!isGraphReady || !canvasProjectId) {
      return undefined;
    }

    if (skipGraphSaveCountRef.current > 0) {
      skipGraphSaveCountRef.current -= 1;
      return undefined;
    }

    if (graphSaveTimerRef.current) {
      window.clearTimeout(graphSaveTimerRef.current);
    }

    graphSaveTimerRef.current = window.setTimeout(async () => {
      await saveGraphSnapshotNow(nodes, edges);
    }, 500);

    return () => {
      if (graphSaveTimerRef.current) {
        window.clearTimeout(graphSaveTimerRef.current);
      }
    };
  }, [canvasProjectId, edges, groups, isGraphReady, nodes, saveGraphSnapshotNow]);

  useEffect(() => {
    if (!isGraphReady) {
      return;
    }

    const nextSignature = getCanvasHistorySignature({ nodes, edges, groups });
    const history = canvasHistoryRef.current;
    if (history.applyingSignature) {
      if (history.applyingSignature === nextSignature) {
        if (canvasHistoryTimerRef.current) {
          window.clearTimeout(canvasHistoryTimerRef.current);
          canvasHistoryTimerRef.current = null;
        }
        history.present = createCanvasHistorySnapshot(nodes, edges, groups);
        history.pending = null;
        history.applyingSignature = '';
      }
      return;
    }
    if (!history.present) {
      history.present = createCanvasHistorySnapshot(nodes, edges, groups);
      return;
    }
    if (
      history.present.signature === nextSignature ||
      history.pending?.signature === nextSignature
    ) {
      return;
    }

    const nextSnapshot = createCanvasHistorySnapshot(nodes, edges, groups);
    history.pending = nextSnapshot;
    if (canvasHistoryTimerRef.current) {
      window.clearTimeout(canvasHistoryTimerRef.current);
    }
    canvasHistoryTimerRef.current = window.setTimeout(() => {
      const currentHistory = canvasHistoryRef.current;
      const pendingSnapshot = currentHistory.pending;
      currentHistory.pending = null;
      canvasHistoryTimerRef.current = null;
      if (!pendingSnapshot || currentHistory.applyingSignature) {
        return;
      }
      if (!currentHistory.present) {
        currentHistory.present = pendingSnapshot;
        currentHistory.future = [];
        return;
      }
      if (currentHistory.present.signature === pendingSnapshot.signature) {
        currentHistory.present = pendingSnapshot;
        return;
      }
      currentHistory.past = [...currentHistory.past, currentHistory.present].slice(
        -CANVAS_HISTORY_LIMIT,
      );
      currentHistory.present = pendingSnapshot;
      currentHistory.future = [];
    }, CANVAS_HISTORY_COMMIT_DELAY_MS);
  }, [edges, groups, isGraphReady, nodes]);

  useEffect(() => {
    if (isGraphReady && visibleNodes.length === 0 && groups.length > 0) {
      setGroups([]);
      setFocusedGroupId('');
    }
  }, [groups.length, isGraphReady, visibleNodes.length]);

  useEffect(() => {
    if (!isGraphReady) {
      return;
    }
    const uploadingKeys = new Set(uploadingVideoFrameKeys);
    const staleInternalNodes = nodes.filter((node) => {
      if (!isInternalVideoFrameNode(node)) {
        return false;
      }
      const targetVideoNode = nodeMap[node.videoInputTargetNodeId];
      const allowedRoles = getVideoFrameUploadRoles(
        targetVideoNode?.videoInputMode,
      );
      const isUploading = uploadingKeys.has(
        `${node.videoInputTargetNodeId}:${node.videoInputRole}`,
      );
      const hasBindingEdge = edges.some(
        (edge) =>
          edge.from === node.id &&
          edge.to === node.videoInputTargetNodeId &&
          edge.targetPortKey === node.videoInputRole,
      );
      return (
        targetVideoNode?.type !== 'video' ||
        !allowedRoles.includes(node.videoInputRole) ||
        ((!node.mediaPreviewUrl || !hasBindingEdge) && !isUploading)
      );
    });
    if (staleInternalNodes.length === 0) {
      return;
    }
    const staleNodeIds = new Set(staleInternalNodes.map((node) => node.id));
    const clearedRolesByVideoId = staleInternalNodes.reduce((map, node) => {
      const roles = map.get(node.videoInputTargetNodeId) || new Set();
      roles.add(node.videoInputRole);
      map.set(node.videoInputTargetNodeId, roles);
      return map;
    }, new Map());
    const nextGraph = removeCanvasGraphItems(
      nodes,
      edges,
      staleNodeIds,
      [],
    );
    const nextNodes = nextGraph.nodes.map((node) => {
      const roles = clearedRolesByVideoId.get(node.id);
      return roles ? clearVideoFrameAssetState(node, [...roles]) : node;
    });
    nodesRef.current = nextNodes;
    edgesRef.current = nextGraph.edges;
    setNodes(nextNodes);
    setEdges(nextGraph.edges);
  }, [edges, isGraphReady, nodeMap, nodes, uploadingVideoFrameKeys]);

  useEffect(() => {
    function handleKeyDown(event) {
      const isHistoryShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'z' &&
        !isEditableElement(event.target);
      if (isHistoryShortcut) {
        event.preventDefault();
        if (event.shiftKey) {
          redoCanvasHistoryRef.current?.();
        } else {
          undoCanvasHistoryRef.current?.();
        }
        return;
      }

      const isCanvasClipboardShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableElement(event.target);
      if (isCanvasClipboardShortcut && event.key.toLowerCase() === 'c') {
        if (copySelectedCanvasNodesRef.current?.()) {
          event.preventDefault();
        }
        return;
      }
      if (isCanvasClipboardShortcut && event.key.toLowerCase() === 'v') {
        if (pasteCopiedCanvasNodesRef.current?.()) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (!videoFrameExtractionInFlightRef.current) {
          videoFrameExtractorRef.current?.pause?.();
          setVideoFrameExtractor(createDefaultVideoFrameExtractorState());
        }
        setExpandedPromptNodeId('');
        setConnectionAddMenu(null);
        setCanvasNodeMenu(null);
        setCanvasContextMenu(null);
        setIsAddMenuOpen(false);
        setSelectionRegion(null);
        setFocusedGroupId('');
        return;
      }

      const isCanvasDeleteKey = event.key === 'Backspace' || event.key === 'Delete';
      if (isCanvasDeleteKey && !isEditableElement(event.target)) {
        const focusedGroupIdSnapshot = focusedGroupIdRef.current;
        if (
          focusedGroupIdSnapshot &&
          groupsRef.current.some((group) => group.id === focusedGroupIdSnapshot)
        ) {
          event.preventDefault();
          deleteCanvasGroupRef.current?.(focusedGroupIdSnapshot);
          return;
        }

        const selectedEdgeIdsSnapshot =
          selectedEdgeIdsRef.current.length > 0
            ? selectedEdgeIdsRef.current
            : selectedEdgeIdRef.current
              ? [selectedEdgeIdRef.current]
              : [];
        const selectedNodeIdsSnapshot =
          selectedNodeIdsRef.current.length > 0
            ? selectedNodeIdsRef.current
            : selectedNodeIdRef.current
              ? [selectedNodeIdRef.current]
              : [];

        if (selectedEdgeIdsSnapshot.length > 0 || selectedNodeIdsSnapshot.length > 0) {
          event.preventDefault();
          removeCanvasItemsRef.current?.(
            selectedNodeIdsSnapshot,
            selectedEdgeIdsSnapshot,
          );
          clearSelection();
          return;
        }
      }

      if (event.code !== 'Space' || isEditableElement(event.target)) {
        return;
      }
      event.preventDefault();
      setIsSpacePressed(true);
    }

    function handleKeyUp(event) {
      if (event.code !== 'Space') {
        return;
      }
      setIsSpacePressed(false);
    }

    function handleWindowBlur() {
      setIsSpacePressed(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    function handleOutsideCanvasMenuPointerDown(event) {
      if (!event.target.closest?.('[data-canvas-menu="true"]')) {
        setCanvasNodeMenu(null);
        setCanvasContextMenu(null);
      }
    }

    window.addEventListener('pointerdown', handleOutsideCanvasMenuPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideCanvasMenuPointerDown, true);
    };
  }, []);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return undefined;
    }

    function getWheelDelta(event) {
      const deltaModeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      return {
        x: event.deltaX * deltaModeMultiplier,
        y: event.deltaY * deltaModeMultiplier,
      };
    }

    function handleWindowWheel(event) {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      setCanvasNodeMenu(null);
      setCanvasContextMenu(null);
      const { y: deltaY } = getWheelDelta(event);
      if (deltaY !== 0) {
        zoomAt(event.clientX, event.clientY, deltaY > 0 ? -0.08 : 0.08);
      }
    }

    function handleNativeWheel(event) {
      if (event.ctrlKey) {
        return;
      }

      if (shouldLetNestedScrollHandleWheel(event.target, viewportElement)) {
        return;
      }

      event.preventDefault();
      setCanvasNodeMenu(null);
      setCanvasContextMenu(null);

      const { x: deltaX, y: deltaY } = getWheelDelta(event);

      setViewport((current) => ({
        ...current,
        x: current.x - deltaX,
        y: current.y - deltaY,
      }));
    }

    window.addEventListener('wheel', handleWindowWheel, { passive: false, capture: true });
    viewportElement.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWindowWheel, { capture: true });
      viewportElement.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoomAt]);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return undefined;
    }

    function syncViewportSize() {
      const rect = viewportElement.getBoundingClientRect();
      setViewportSize({
        width: rect.width,
        height: rect.height,
      });
    }

    syncViewportSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncViewportSize);
      return () => {
        window.removeEventListener('resize', syncViewportSize);
      };
    }

    const resizeObserver = new ResizeObserver(syncViewportSize);
    resizeObserver.observe(viewportElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => () => {
    if (addMenuCloseTimerRef.current) {
      window.clearTimeout(addMenuCloseTimerRef.current);
    }
    if (canvasHistoryTimerRef.current) {
      window.clearTimeout(canvasHistoryTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!editingNodeField) {
      return;
    }

    const selector = `[data-node-edit-key="${editingNodeField.nodeId}:${editingNodeField.field}"]`;
    const element = viewportRef.current?.querySelector(selector);
    if (!element) {
      return;
    }

    element.focus();
    if (typeof element.setSelectionRange === 'function') {
      const valueLength = String(element.value || '').length;
      element.setSelectionRange(valueLength, valueLength);
    }
  }, [editingNodeField]);

  function clearAddMenuCloseTimer() {
    if (!addMenuCloseTimerRef.current) {
      return;
    }

    window.clearTimeout(addMenuCloseTimerRef.current);
    addMenuCloseTimerRef.current = null;
  }

  function openAddMenu() {
    clearAddMenuCloseTimer();
    setIsAddMenuOpen(true);
  }

  function scheduleAddMenuClose() {
    clearAddMenuCloseTimer();
    addMenuCloseTimerRef.current = window.setTimeout(() => {
      setIsAddMenuOpen(false);
      addMenuCloseTimerRef.current = null;
    }, 500);
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const left = rect?.left || 0;
    const top = rect?.top || 0;

    return {
      x: (clientX - left - viewport.x) / viewport.zoom,
      y: (clientY - top - viewport.y) / viewport.zoom,
    };
  }

  function getViewportPoint(clientX, clientY) {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0),
    };
  }

  function selectNodes(nodeIds = [], focusNodeId = '') {
    const uniqueNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    setSelectedNodeIds(uniqueNodeIds);
    setSelectedNodeId(focusNodeId && uniqueNodeIds.includes(focusNodeId) ? focusNodeId : uniqueNodeIds[0] || '');
    setSelectedEdgeId('');
    setSelectedEdgeIds([]);
    setSelectionRegion(null);
    setFocusedGroupId('');
  }

  function selectCanvasItems(nodeIds = [], edgeIds = []) {
    const uniqueNodeIds = Array.from(new Set(nodeIds.filter(Boolean)));
    const uniqueEdgeIds = Array.from(new Set(edgeIds.filter(Boolean)));
    setSelectedNodeIds(uniqueNodeIds);
    setSelectedNodeId(uniqueNodeIds[0] || '');
    setSelectedEdgeIds(uniqueEdgeIds);
    setSelectedEdgeId(uniqueEdgeIds[0] || '');
    setPromptFocusNodeId('');
    setExpandedPromptNodeId('');
  }

  function clearSelection() {
    setSelectedNodeIds([]);
    setSelectedNodeId('');
    setSelectedEdgeId('');
    setSelectedEdgeIds([]);
    setPromptFocusNodeId('');
    setExpandedPromptNodeId('');
    setOpenMediaGenerationTypeNodeId('');
    setOpenTextModelNodeId('');
    setOpenImageModelNodeId('');
    setOpenImageRatioNodeId('');
    setOpenImageResolutionNodeId('');
    setOpenVideoModelNodeId('');
    setOpenVideoRatioNodeId('');
    setOpenVideoResolutionNodeId('');
    setOpenVideoDurationNodeId('');
    setOpenAudioModelNodeId('');
    setSelectionRegion(null);
    setFocusedGroupId('');
  }

  function copyCanvasNodesToClipboard(nodeIds = [], groupIds = []) {
    const copiedNodeIdSet = new Set(nodeIds.filter(Boolean));
    const copiedGroupIdSet = new Set(groupIds.filter(Boolean));
    const copiedNodes = nodesRef.current.filter((node) =>
      copiedNodeIdSet.has(node.id),
    );
    if (copiedNodes.length === 0) {
      return false;
    }

    const copiedEdges = edgesRef.current.filter(
      (edge) =>
        copiedNodeIdSet.has(edge.from) && copiedNodeIdSet.has(edge.to),
    );
    const copiedGroups = groupsRef.current.filter((group) =>
      copiedGroupIdSet.has(group.id),
    );
    const copiedGraph = cloneCanvasGraphData(
      copiedNodes,
      copiedEdges,
      copiedGroups,
    );
    canvasNodeClipboardRef.current = {
      nodes: copiedGraph.nodes,
      edges: copiedGraph.edges,
      groups: copiedGraph.groups,
      pasteCount: 0,
    };
    return true;
  }

  function copyCanvasGroup(groupId) {
    const copiedGroup = groupsRef.current.find(
      (group) => group.id === groupId,
    );
    if (!copiedGroup) {
      return false;
    }
    const memberNodeIds = nodesRef.current
      .filter((node) => node.groupId === groupId)
      .map((node) => node.id);
    return copyCanvasNodesToClipboard(memberNodeIds, [groupId]);
  }

  function copySelectedCanvasNodes() {
    const focusedGroupIdSnapshot = focusedGroupIdRef.current;
    if (
      focusedGroupIdSnapshot &&
      groupsRef.current.some((group) => group.id === focusedGroupIdSnapshot)
    ) {
      return copyCanvasGroup(focusedGroupIdSnapshot);
    }

    const selectedNodeIdsSnapshot =
      selectedNodeIdsRef.current.length > 0
        ? selectedNodeIdsRef.current
        : selectedNodeIdRef.current
          ? [selectedNodeIdRef.current]
          : [];
    if (selectedNodeIdsSnapshot.length === 0) {
      return false;
    }
    return copyCanvasNodesToClipboard(selectedNodeIdsSnapshot);
  }

  function pasteCopiedCanvasNodes() {
    const clipboard = canvasNodeClipboardRef.current;
    if (!isGraphReady || !clipboard?.nodes?.length) {
      return false;
    }

    clipboard.pasteCount += 1;
    const offset = CANVAS_PASTE_OFFSET * clipboard.pasteCount;
    const reservedNodeIds = new Set(nodesRef.current.map((node) => node.id));
    const reservedGroupIds = new Set(
      groupsRef.current.map((group) => group.id),
    );
    const pastedNodeIdBySourceId = new Map();
    const pastedGroupIdBySourceId = new Map();
    const pasteTimestamp = Date.now();
    (clipboard.groups || []).forEach((sourceGroup) => {
      let pastedGroupId = '';
      do {
        groupSequenceRef.current += 1;
        pastedGroupId = `group-${pasteTimestamp}-${groupSequenceRef.current}`;
      } while (reservedGroupIds.has(pastedGroupId));
      reservedGroupIds.add(pastedGroupId);
      pastedGroupIdBySourceId.set(sourceGroup.id, pastedGroupId);
    });
    clipboard.nodes.forEach((sourceNode) => {
      let pastedNodeId = '';
      do {
        nodeSequenceRef.current += 1;
        pastedNodeId = `${sourceNode.type}-${nodeSequenceRef.current}`;
      } while (reservedNodeIds.has(pastedNodeId));
      reservedNodeIds.add(pastedNodeId);
      pastedNodeIdBySourceId.set(sourceNode.id, pastedNodeId);
    });

    const pastedNodes = clipboard.nodes.map((sourceNode) => {
      const pastedNodeId = pastedNodeIdBySourceId.get(sourceNode.id);
      const remappedVideoInputTargetNodeId =
        pastedNodeIdBySourceId.get(sourceNode.videoInputTargetNodeId) || '';
      const remappedVirtualAssetTargetNodeId =
        pastedNodeIdBySourceId.get(
          sourceNode.seedanceVirtualAssetTargetNodeId,
        ) || '';
      const pastedNode = {
        ...sourceNode,
        id: pastedNodeId,
        x: sourceNode.x + offset,
        y: sourceNode.y + offset,
        groupId: pastedGroupIdBySourceId.get(sourceNode.groupId) || '',
        generationRunId: '',
        generationStatus: '',
        videoInputTargetNodeId: remappedVideoInputTargetNodeId,
        videoInputRole: remappedVideoInputTargetNodeId
          ? sourceNode.videoInputRole
          : '',
        seedanceVirtualAssetTargetNodeId:
          remappedVirtualAssetTargetNodeId,
        seedanceVirtualAssets: sourceNode.seedanceVirtualAssets,
        videoModelCapabilityMode: sourceNode.videoModelCapabilityMode,
        status: isActiveGenerationStatus(sourceNode.status) ? 'idle' : sourceNode.status,
      };
      delete pastedNode.canvasGroups;
      delete pastedNode.isVideoPlaying;
      delete pastedNode.videoCurrentTime;
      delete pastedNode.videoDuration;
      delete pastedNode.videoProgress;
      return pastedNode;
    });
    const pastedGroups = (clipboard.groups || []).map((sourceGroup) => ({
      ...sourceGroup,
      id: pastedGroupIdBySourceId.get(sourceGroup.id),
      x: sourceGroup.x + offset,
      y: sourceGroup.y + offset,
    }));
    const pastedEdges = clipboard.edges.map((sourceEdge) => {
      edgeSequenceRef.current += 1;
      const from = pastedNodeIdBySourceId.get(sourceEdge.from);
      const to = pastedNodeIdBySourceId.get(sourceEdge.to);
      return normalizeCanvasEdgePorts({
        ...sourceEdge,
        id: `edge-${from}-${to}-${edgeSequenceRef.current}`,
        from,
        to,
      });
    });

    nodesRef.current = [...nodesRef.current, ...pastedNodes];
    edgesRef.current = [...edgesRef.current, ...pastedEdges];
    groupsRef.current = [...groupsRef.current, ...pastedGroups];
    setNodes(nodesRef.current);
    setEdges(edgesRef.current);
    setGroups(groupsRef.current);
    if (pastedGroups.length > 0) {
      clearSelection();
      setFocusedGroupId(pastedGroups[0].id);
    } else {
      selectNodes(
        pastedNodes.map((node) => node.id),
        pastedNodes[0]?.id || '',
      );
      setPromptFocusNodeId('');
      setExpandedPromptNodeId('');
    }
    setConnectionAddMenu(null);
    setCanvasNodeMenu(null);
    setCanvasContextMenu(null);
    return true;
  }

  function clearCanvasHistoryCommitTimer() {
    if (canvasHistoryTimerRef.current) {
      window.clearTimeout(canvasHistoryTimerRef.current);
      canvasHistoryTimerRef.current = null;
    }
  }

  function resetCanvasHistory(nodesSnapshot = null, edgesSnapshot = [], groupsSnapshot = []) {
    clearCanvasHistoryCommitTimer();
    const nextHistory = createEmptyCanvasHistoryState();
    if (Array.isArray(nodesSnapshot)) {
      nextHistory.present = createCanvasHistorySnapshot(
        nodesSnapshot,
        edgesSnapshot,
        groupsSnapshot,
      );
    }
    canvasHistoryRef.current = nextHistory;
  }

  function commitCanvasHistorySnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    const history = canvasHistoryRef.current;
    if (!history.present) {
      history.present = snapshot;
      history.future = [];
      return;
    }
    if (history.present.signature === snapshot.signature) {
      history.present = snapshot;
      return;
    }

    history.past = [...history.past, history.present].slice(-CANVAS_HISTORY_LIMIT);
    history.present = snapshot;
    history.future = [];
  }

  function flushPendingCanvasHistory() {
    const history = canvasHistoryRef.current;
    if (history.applyingSignature) {
      return;
    }

    clearCanvasHistoryCommitTimer();
    const currentSnapshot = createCanvasHistorySnapshot(
      nodesRef.current,
      edgesRef.current,
      groupsRef.current,
    );
    history.pending = null;
    commitCanvasHistorySnapshot(currentSnapshot);
  }

  function applyCanvasHistorySnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    clearCanvasHistoryCommitTimer();
    const graphData = cloneCanvasGraphData(snapshot.nodes, snapshot.edges, snapshot.groups);
    const restoredNodes = mergeCanvasHistoryTransientNodeState(
      graphData.nodes,
      nodesRef.current,
    );
    const restoredNodeIds = new Set(restoredNodes.map((node) => node.id));
    const restoredGroupIds = new Set(graphData.groups.map((group) => group.id));

    const restoredEdges = graphData.edges.map(normalizeCanvasEdgePorts);
    nodesRef.current = restoredNodes;
    edgesRef.current = restoredEdges;
    groupsRef.current = graphData.groups;
    interactionRef.current = null;
    skipGraphSaveCountRef.current = 0;
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    setGroups(graphData.groups);
    setGeneratingNodeIds((current) => current.filter((nodeId) => restoredNodeIds.has(nodeId)));
    setGenerationFailedNodeIds((current) => current.filter((nodeId) => restoredNodeIds.has(nodeId)));
    setUploadingNodeIds((current) => current.filter((nodeId) => restoredNodeIds.has(nodeId)));
    groupExecutionIdsRef.current.forEach((groupId) => {
      if (!restoredGroupIds.has(groupId)) {
        groupExecutionIdsRef.current.delete(groupId);
      }
    });
    setSubmittingGroupIds((current) =>
      current.filter((groupId) => restoredGroupIds.has(groupId)),
    );
    setDraggingNodeIds([]);
    setDraggingGroupId('');
    setGroupDropTargetId('');
    setAlignmentGuides({ vertical: [], horizontal: [] });
    setSelectionBox(null);
    setConnectionAddMenu(null);
    setCanvasNodeMenu(null);
    setCanvasContextMenu(null);
    setEditingNodeField(null);
    setSeedanceLibraryOpen(false);
    setSeedanceLibraryNodeId('');
    setHoveredEdgeId('');
    setConnectionNotice(null);
    clearSelection();
  }

  function undoCanvasHistory() {
    if (!isGraphReady) {
      return;
    }

    flushPendingCanvasHistory();
    const history = canvasHistoryRef.current;
    if (!history.present || history.past.length === 0) {
      return;
    }

    const targetSnapshot = history.past[history.past.length - 1];
    history.past = history.past.slice(0, -1);
    history.future = [history.present, ...history.future].slice(0, CANVAS_HISTORY_LIMIT);
    history.present = targetSnapshot;
    history.pending = null;
    history.applyingSignature = targetSnapshot.signature;
    applyCanvasHistorySnapshot(targetSnapshot);
  }

  function redoCanvasHistory() {
    if (!isGraphReady) {
      return;
    }

    flushPendingCanvasHistory();
    const history = canvasHistoryRef.current;
    if (!history.present || history.future.length === 0) {
      return;
    }

    const targetSnapshot = history.future[0];
    history.past = [...history.past, history.present].slice(-CANVAS_HISTORY_LIMIT);
    history.present = targetSnapshot;
    history.future = history.future.slice(1);
    history.pending = null;
    history.applyingSignature = targetSnapshot.signature;
    applyCanvasHistorySnapshot(targetSnapshot);
  }

  function updateNode(nodeId, patch) {
    setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)));
  }

  function changeMediaGenerationType(nodeId, nextType) {
    if (!MEDIA_GENERATION_TYPE_OPTIONS.some((option) => option.type === nextType)) {
      return;
    }

    const currentNode = nodesRef.current.find((node) => node.id === nodeId);
    if (currentNode?.type === 'video' && nextType !== 'video') {
      removeInternalVideoFrameRoles(nodeId, [
        VIDEO_INPUT_ROLE_FIRST_FRAME,
        VIDEO_INPUT_ROLE_END_FRAME,
      ]);
    }

    const targetMeta = getNodeTypeMeta(nextType);
    setNodes((current) =>
      current.map((node) => {
        if (
          node.id !== nodeId ||
          !MEDIA_GENERATION_TYPE_OPTIONS.some((option) => option.type === node.type) ||
          node.type === nextType
        ) {
          return node;
        }

        const targetModel = getSelectedModelOption(
          nextType,
          node.model,
          modelOptionsByNodeType,
        );
        const targetAspectRatios = targetModel?.aspectRatios || [];
        const targetResolutions = targetModel?.resolutions || [];

        return {
          ...node,
          type: nextType,
          title: getMediaNodeTitle(nextType),
          subtitle: targetMeta.description,
          status: 'idle',
          generationStatus: '',
          generationRunId: '',
          model: targetModel?.label || '',
          aspectRatio: targetAspectRatios.includes(node.aspectRatio)
            ? node.aspectRatio
            : targetAspectRatios[0] || '',
          resolution: targetResolutions.includes(node.resolution)
            ? node.resolution
            : targetResolutions[0] || '',
          durationSeconds:
            nextType === 'video'
              ? clampVideoDurationSeconds(node.durationSeconds || MIN_VIDEO_DURATION_SECONDS)
              : '',
          paramValuesJson: {},
          modeType: '',
          videoInputMode:
            nextType === 'video' ? VIDEO_INPUT_MODE_REFERENCE : '',
          videoModelCapabilityMode:
            nextType === 'video' ? VIDEO_INPUT_MODE_REFERENCE : '',
          firstFrameAsset: null,
          endFrameAsset: null,
          seedanceVirtualAssets: [],
          mediaPreviewUrl: '',
          mediaFileName: '',
          mediaFileSize: 0,
          mediaMimeType: '',
          generationMeta: normalizeGenerationMeta(null),
          pendingGenerationMeta: normalizeGenerationMeta(null),
          connectableTargetTypes: getDefaultConnectableTargetTypes(nextType),
          tags: [targetMeta.label],
        };
      }),
    );
    setEdges((current) =>
      current.map((edge) => {
        if (edge.to !== nodeId) {
          return edge;
        }
        if (nextType !== 'video') {
          return { ...edge, targetPortKey: '' };
        }
        const sourceNode = nodesRef.current.find((node) => node.id === edge.from);
        return {
          ...edge,
          targetPortKey: getReferenceTargetPortKey(sourceNode),
        };
      }),
    );
    clearNodeRunSyncTimer(nodeId);
    setGenerationFailedNodeIds((current) => current.filter((item) => item !== nodeId));
    closePromptPopoverOptionMenus();

    window.requestAnimationFrame(() => {
      viewportRef.current
        ?.querySelector(`[data-prompt-editor-node-id="${nodeId}"]`)
        ?.focus?.();
    });
  }

  function closePromptPopoverOptionMenus() {
    setOpenMediaGenerationTypeNodeId('');
    setOpenTextModelNodeId('');
    setOpenImageModelNodeId('');
    setOpenImageRatioNodeId('');
    setOpenImageResolutionNodeId('');
    setOpenVideoModelNodeId('');
    setOpenVideoRatioNodeId('');
    setOpenVideoResolutionNodeId('');
    setOpenVideoDurationNodeId('');
    setOpenAudioModelNodeId('');
  }

  function renderMediaGenerationTypeIcon(type) {
    return type === 'video' ? (
      <svg className={styles.mediaGenerationTypeIcon} aria-hidden="true" viewBox="0 0 18 18">
        <rect x="2.25" y="3.25" width="13.5" height="11.5" rx="2" />
        <path d="M6 3.5v11M12 3.5v11M2.5 7h3.25M12.25 7h3.25M2.5 11h3.25M12.25 11h3.25" />
      </svg>
    ) : (
      <svg className={styles.mediaGenerationTypeIcon} aria-hidden="true" viewBox="0 0 18 18">
        <rect x="2.25" y="2.75" width="13.5" height="12.5" rx="2" />
        <circle cx="11.8" cy="6.2" r="1.35" />
        <path d="m3.5 13 3.25-3.5 2.15 2.15 1.65-1.7 3.95 3.05" />
      </svg>
    );
  }

  function renderMediaGenerationTypeSelect(node) {
    const isMenuOpen = openMediaGenerationTypeNodeId === node.id;
    const selectedOption =
      MEDIA_GENERATION_TYPE_OPTIONS.find((option) => option.type === node.type) ||
      MEDIA_GENERATION_TYPE_OPTIONS[0];

    return (
      <div
        className={`${styles.videoPromptField} ${styles.mediaGenerationTypeSelect}`}
        tabIndex={-1}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpenMediaGenerationTypeNodeId('');
          }
        }}
      >
        <button
          className={styles.videoModelTrigger}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isMenuOpen}
          aria-label={`生成类型：${selectedOption.label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.parentElement?.focus();
            closePromptPopoverOptionMenus();
            setOpenMediaGenerationTypeNodeId(isMenuOpen ? '' : node.id);
          }}
        >
          {renderMediaGenerationTypeIcon(selectedOption.type)}
          <span>{selectedOption.label}</span>
        </button>
        {isMenuOpen ? (
          <div
            className={`${styles.videoModelMenu} ${styles.mediaGenerationTypeMenu}`}
            role="listbox"
            aria-label="生成类型"
          >
            {MEDIA_GENERATION_TYPE_OPTIONS.map((option) => {
              const isSelected = option.type === node.type;
              return (
                <button
                  key={option.type}
                  className={isSelected ? styles.videoModelMenuItemActive : ''}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isSelected) {
                      setOpenMediaGenerationTypeNodeId('');
                      return;
                    }
                    changeMediaGenerationType(node.id, option.type);
                  }}
                >
                  {renderMediaGenerationTypeIcon(option.type)}
                  <span>{option.label}</span>
                  {isSelected ? <span className={styles.mediaGenerationTypeCheck}>✓</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function togglePromptPopoverExpanded(nodeId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const willExpand = expandedPromptNodeId !== nodeId;
    closePromptPopoverOptionMenus();
    setExpandedPromptNodeId(willExpand ? nodeId : '');

    window.requestAnimationFrame(() => {
      const focusTarget = willExpand
        ? viewportRef.current?.querySelector(`[data-prompt-editor-node-id="${nodeId}"]`)
        : viewportRef.current?.querySelector(`[data-prompt-expand-node-id="${nodeId}"]`);
      focusTarget?.focus?.();
    });
  }

  function renderPromptPopoverHeader(node, extraActions = null) {
    const isExpanded = expandedPromptNodeId === node.id;
    return (
      <div className={styles.promptPopoverHeader}>
        {extraActions ? (
          <div className={styles.promptPopoverQuickActions} aria-label={`${node.title} 快捷操作`}>
            {extraActions}
          </div>
        ) : null}
        <button
          className={styles.promptPopoverExpandButton}
          type="button"
          data-prompt-expand-node-id={node.id}
          aria-label={isExpanded ? '还原提示词弹窗' : '放大提示词弹窗'}
          aria-pressed={isExpanded}
          title={isExpanded ? '还原' : '放大'}
          onClick={(event) => togglePromptPopoverExpanded(node.id, event)}
        >
          {isExpanded ? (
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path d="M17 9h-6V3M11 9l6-6M3 11h6v6M9 11l-6 6" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path d="M11 3h6v6M17 3l-7 7M9 17H3v-6M3 17l7-7" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  function renderPromptReferenceRow(node, references, ariaLabel, trailingContent = null) {
    if ((!Array.isArray(references) || references.length === 0) && !trailingContent) {
      return null;
    }

    return (
      <div
        className={styles.promptReferenceRow}
        aria-label={ariaLabel}
      >
        {renderNodeInputReferenceThumbnails(
          node.id,
          references,
          ariaLabel,
          trailingContent,
        )}
      </div>
    );
  }

  function renderVideoFrameUploadButton(node, role) {
    const uploadKey = `${node.id}:${role}`;
    const isUploading = uploadingVideoFrameKeys.includes(uploadKey);
    const roleLabel =
      role === VIDEO_INPUT_ROLE_END_FRAME ? '尾帧' : '首帧';

    return (
      <label
        key={`upload-${role}`}
        className={`${styles.videoFrameUploadButton} ${
          isUploading ? styles.videoFrameUploadButtonLoading : ''
        }`}
        style={{ order: getVideoFrameRoleDisplayOrder(role) }}
        title={`上传${roleLabel}图片`}
        aria-label={`上传${roleLabel}图片`}
        aria-busy={isUploading}
      >
        <input
          type="file"
          accept="image/*"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) {
              uploadVideoFrameAsset(file, node.id, role);
            }
          }}
        />
        {isUploading ? (
          <span className={styles.videoFrameUploadSpinner} aria-hidden />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="m7 16 3.5-3.5 2.5 2.5 1.8-1.8L18 16.5" />
            <circle cx="15.8" cy="9.2" r="1.25" />
            <path d="M12 8v5M9.5 10.5h5" />
          </svg>
        )}
        <span className={styles.videoFrameUploadRole} aria-hidden>
          {roleLabel.slice(0, 1)}
        </span>
      </label>
    );
  }

  function renderVideoFrameUploadButtons(node, mode) {
    const missingRoles = getVideoFrameUploadRoles(mode).filter((role) => {
      const internalFrameNode = getInternalVideoFrameNode(nodes, node.id, role);
      const internalFrameUrl = String(
        internalFrameNode?.mediaPreviewUrl || '',
      ).trim();
      return !internalFrameUrl && !getVideoFrameAsset(node, role);
    });
    if (missingRoles.length === 0) {
      return null;
    }
    return missingRoles.map((role) => renderVideoFrameUploadButton(node, role));
  }

  function removeNodeInputReference(nodeId, reference, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setHoveredInputReferenceKey('');

    if (
      reference?.sourceKind === 'internal-frame' &&
      [VIDEO_INPUT_ROLE_FIRST_FRAME, VIDEO_INPUT_ROLE_END_FRAME].includes(
        reference.frameRole,
      )
    ) {
      removeInternalVideoFrameRoles(nodeId, [reference.frameRole]);
      return;
    }

    if (
      reference?.sourceKind === 'direct-frame' &&
      [VIDEO_INPUT_ROLE_FIRST_FRAME, VIDEO_INPUT_ROLE_END_FRAME].includes(
        reference.frameRole,
      )
    ) {
      const role = reference.frameRole;
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }
          const nextParamValuesJson = { ...(node.paramValuesJson || {}) };
          const isEndFrame = role === VIDEO_INPUT_ROLE_END_FRAME;
          const keysToRemove = isEndFrame
            ? ['endFrameUrl', 'end_frame_url', 'endFrameAsset', 'end_frame_asset']
            : ['firstFrameUrl', 'first_frame_url', 'firstFrameAsset', 'first_frame_asset'];
          keysToRemove.forEach((key) => delete nextParamValuesJson[key]);
          return {
            ...node,
            paramValuesJson: nextParamValuesJson,
            [isEndFrame ? 'endFrameAsset' : 'firstFrameAsset']: null,
          };
        }),
      );
      return;
    }

    if (reference?.sourceKind === 'edge' && reference.edgeId) {
      removeCanvasItems([], [reference.edgeId]);
      setHoveredEdgeId((current) => (current === reference.edgeId ? '' : current));
      setSelectedEdgeId((current) => (current === reference.edgeId ? '' : current));
      setSelectedEdgeIds((current) => current.filter((edgeId) => edgeId !== reference.edgeId));
      return;
    }

    if (reference?.sourceKind === 'virtual-asset' && reference.virtualAssetId) {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }
          const nextVirtualAssets = normalizeSeedanceVirtualAssets(
            node.seedanceVirtualAssets,
          ).filter(
            (asset) => asset.virtualAssetId !== reference.virtualAssetId,
          );
          return {
            ...node,
            seedanceVirtualAssets: nextVirtualAssets,
            ...(nextVirtualAssets.length === 0 &&
            node.videoModelCapabilityMode ===
              VIDEO_MODEL_CAPABILITY_VIRTUAL_CHARACTER
              ? {
                  modeType: '',
                  videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
                  videoModelCapabilityMode: VIDEO_INPUT_MODE_REFERENCE,
                }
              : {}),
          };
        }),
      );
    }
  }

  function renderNodeInputReferenceThumbnails(
    nodeId,
    references,
    ariaLabel = '当前输入参考素材',
    trailingContent = null,
  ) {
    const safeReferences = Array.isArray(references) ? references : [];
    if (safeReferences.length === 0 && !trailingContent) {
      return null;
    }

    const hoveredReferenceIndex = safeReferences.findIndex(
      (reference) => hoveredInputReferenceKey === `${nodeId}:${reference.id}`,
    );
    const hoveredReference = safeReferences[hoveredReferenceIndex] || null;
    const hasHoveredReferencePreview =
      Boolean(hoveredReference?.previewUrl) ||
      (hoveredReference?.previewType === 'text' && Boolean(hoveredReference?.previewText));

    return (
      <div className={styles.videoReferenceStrip}>
        <div
          className={styles.videoReferenceThumbnails}
          aria-label={ariaLabel}
          onWheel={(event) => {
            const container = event.currentTarget;
            if (container.scrollWidth <= container.clientWidth) {
              return;
            }
            const scrollDelta =
              Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (scrollDelta === 0) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            container.scrollLeft += scrollDelta;
          }}
        >
          {safeReferences.map((reference, referenceIndex) => {
            const referenceKey = `${nodeId}:${reference.id}`;
            return (
              <span
                key={reference.id}
                className={styles.videoReferenceThumbnail}
                style={{
                  order: getVideoFrameRoleDisplayOrder(
                    reference.frameRole,
                    referenceIndex,
                  ),
                }}
                title={reference.label}
                tabIndex={0}
                role="group"
                aria-label={reference.label}
                onPointerEnter={() => setHoveredInputReferenceKey(referenceKey)}
                onPointerLeave={() =>
                  setHoveredInputReferenceKey((current) => (current === referenceKey ? '' : current))
                }
                onFocus={() => setHoveredInputReferenceKey(referenceKey)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setHoveredInputReferenceKey((current) => (current === referenceKey ? '' : current));
                  }
                }}
              >
                {reference.previewType === 'image' && reference.previewUrl ? (
                  <img
                    src={reference.previewUrl}
                    alt=""
                    draggable="false"
                  />
                ) : reference.previewType === 'video' && reference.previewUrl ? (
                  <video
                    src={reference.previewUrl}
                    aria-hidden="true"
                    preload="metadata"
                    muted
                    playsInline
                    draggable="false"
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        event.currentTarget.currentTime = Math.min(0.1, duration / 2);
                      }
                    }}
                  />
                ) : (
                  <span className={styles.videoReferenceThumbnailPlaceholder} aria-hidden>
                    <VideoReferencePlaceholderIcon type={reference.previewType} />
                  </span>
                )}
                {reference.previewType === 'video' ? (
                  <span className={styles.videoReferencePlayIcon} aria-hidden />
                ) : null}
                <i className={styles.videoReferenceThumbnailIndex} aria-hidden>
                  {reference.frameRole === VIDEO_INPUT_ROLE_FIRST_FRAME
                    ? 1
                    : reference.frameRole === VIDEO_INPUT_ROLE_END_FRAME
                      ? 2
                      : referenceIndex + 1}
                </i>
                <button
                  className={styles.videoReferenceRemoveButton}
                  type="button"
                  aria-label={`移除${reference.label}`}
                  title={`移除${reference.label}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => removeNodeInputReference(nodeId, reference, event)}
                >
                  <span aria-hidden />
                </button>
              </span>
            );
          })}
          {trailingContent}
        </div>
        {hoveredReference && hasHoveredReferencePreview ? (
          <span
            className={`${styles.videoReferenceHoverPreview} ${
              hoveredReference.previewType === 'text' ? styles.videoReferenceTextPreview : ''
            } ${
              hoveredReferenceIndex === 0 ? styles.videoReferenceHoverPreviewAlignStart : ''
            } ${
              safeReferences.length > 1 && hoveredReferenceIndex === safeReferences.length - 1
                ? styles.videoReferenceHoverPreviewAlignEnd
                : ''
            }`}
            role="tooltip"
          >
            {hoveredReference.previewType === 'video' ? (
              <video
                src={hoveredReference.previewUrl}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
            ) : hoveredReference.previewType === 'image' ? (
              <img src={hoveredReference.previewUrl} alt="" />
            ) : (
              <span>{hoveredReference.previewText}</span>
            )}
          </span>
        ) : null}
      </div>
    );
  }

  function skipUpcomingGraphSaves(count = 1) {
    skipGraphSaveCountRef.current += count;
  }

  function getNodeGenerateParams(
    node,
    currentEdges = edgesRef.current,
    currentNodes = nodesRef.current,
  ) {
    if (!node) {
      return {};
    }

    const prompt = node.type === 'script' ? node.textPromptContent : node.content;
    const seedanceVirtualAssets = normalizeSeedanceVirtualAssets(node.seedanceVirtualAssets);
    const currentNodeMap = currentNodes.reduce(
      (map, currentNode) => ({ ...map, [currentNode.id]: currentNode }),
      {},
    );
    const videoInputMode =
      node.type === 'video'
        ? getEffectiveVideoInputMode(node, currentEdges, currentNodeMap)
        : VIDEO_INPUT_MODE_REFERENCE;
    const incomingImageReferences =
      node.type === 'video'
        ? currentEdges
            .filter((edge) => edge.to === node.id)
            .map((edge) => ({ edge, sourceNode: currentNodeMap[edge.from] }))
            .filter(
              ({ sourceNode }) =>
                getNodeMediaType(sourceNode) === 'image' &&
                Boolean(String(sourceNode?.mediaPreviewUrl || '').trim()),
            )
        : [];
    const findConnectedFrameUrl = (role, fallbackIndex = 0) => {
      const exactReference = incomingImageReferences.find(
        ({ edge }) => edge.targetPortKey === role,
      );
      return String(
        exactReference?.sourceNode?.mediaPreviewUrl ||
          incomingImageReferences[fallbackIndex]?.sourceNode?.mediaPreviewUrl ||
          '',
      ).trim();
    };
    const directFirstFrameAsset = getVideoFrameAsset(
      node,
      VIDEO_INPUT_ROLE_FIRST_FRAME,
    );
    const directEndFrameAsset = getVideoFrameAsset(
      node,
      VIDEO_INPUT_ROLE_END_FRAME,
    );
    const firstFrameUrl =
      videoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME ||
      videoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME
        ? directFirstFrameAsset?.url ||
          findConnectedFrameUrl(VIDEO_INPUT_ROLE_FIRST_FRAME, 0)
        : '';
    const endFrameUrl =
      videoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME
        ? directEndFrameAsset?.url ||
          findConnectedFrameUrl(VIDEO_INPUT_ROLE_END_FRAME, 1)
        : '';
    const videoFrameUrls = [firstFrameUrl, endFrameUrl].filter(Boolean);
    return {
      prompt: prompt || '',
      content: prompt || '',
      model: node.model || '',
      aspect_ratio: node.aspectRatio || '',
      aspectRatio: node.aspectRatio || '',
      resolution: node.resolution || '',
      duration_seconds: node.durationSeconds || '',
      durationSeconds: node.durationSeconds || '',
      ...(node.type === 'video'
        ? {
            videoInputMode,
            video_input_mode: videoInputMode,
          }
        : {}),
      ...(node.type === 'video' && node.modeType
        ? {
            modeType: node.modeType,
            mode_type: node.modeType,
          }
        : {}),
      ...(firstFrameUrl
        ? {
            firstFrameUrl,
            first_frame_url: firstFrameUrl,
            firstFrameImage: firstFrameUrl,
            first_frame_image: firstFrameUrl,
            ...(directFirstFrameAsset
              ? {
                  firstFrameAsset: directFirstFrameAsset,
                  first_frame_asset: directFirstFrameAsset,
                }
              : {}),
          }
        : {}),
      ...(endFrameUrl
        ? {
            endFrameUrl,
            end_frame_url: endFrameUrl,
            endFrameImage: endFrameUrl,
            end_frame_image: endFrameUrl,
            ...(directEndFrameAsset
              ? {
                  endFrameAsset: directEndFrameAsset,
                  end_frame_asset: directEndFrameAsset,
                }
              : {}),
          }
        : {}),
      ...(videoFrameUrls.length > 0
        ? {
            imageUrls: videoFrameUrls,
            image_urls: videoFrameUrls,
            inputImages: videoFrameUrls,
            input_images: videoFrameUrls,
          }
        : {}),
      ...(seedanceVirtualAssets.length > 0
        ? {
            seedanceVirtualAssets,
            seedance_virtual_assets: seedanceVirtualAssets.map((asset) => ({
              virtual_asset_id: asset.virtualAssetId,
              role: asset.role,
            })),
          }
        : {}),
    };
  }

  function buildGenerationMetaSnapshot(
    node,
    currentEdges = edgesRef.current,
    currentNodes = nodesRef.current,
  ) {
    if (!node || !['image', 'video'].includes(node.type)) {
      return normalizeGenerationMeta(node?.generationMeta);
    }
    const currentNodeMap = currentNodes.reduce(
      (map, currentNode) => ({ ...map, [currentNode.id]: currentNode }),
      {},
    );
    const references = getNodeInputReferenceThumbnails(
      node,
      currentEdges,
      currentNodeMap,
      seedanceCharacters,
    ).map((reference, index) => ({
      id: String(reference.id || `reference-${index}`),
      type: String(reference.frameRole || reference.sourceKind || 'reference'),
      label: String(reference.label || `参考素材 ${index + 1}`),
      url: String(reference.previewUrl || '').trim(),
    }));

    return normalizeGenerationMeta({
      requestedAt: new Date().toISOString(),
      model: node.model || '',
      prompt: node.content || '',
      aspectRatio: node.aspectRatio || '',
      resolution: node.resolution || '',
      durationSeconds: node.durationSeconds || 0,
      references,
      outputs: [],
    });
  }

  function getCompletedGenerationMeta(node, result, nodeRunId = '') {
    const pendingMeta = normalizeGenerationMeta(node?.pendingGenerationMeta);
    const previousMeta = pendingMeta.requestedAt || pendingMeta.runId
      ? pendingMeta
      : normalizeGenerationMeta(node?.generationMeta);
    const output = getNodeRunOutputSnapshot(result);
    const outputs = getNodeRunOutputs(result, nodeRunId);
    const generatedAt = String(
      result?.completed_at ??
        result?.completedAt ??
        result?.finished_at ??
        result?.finishedAt ??
        output.completed_at ??
        output.completedAt ??
        '',
    ).trim() || new Date().toISOString();

    return normalizeGenerationMeta({
      ...previousMeta,
      runId: nodeRunId || previousMeta.runId,
      generatedAt,
      outputs: outputs.length > 0 ? outputs : previousMeta.outputs,
    });
  }

  async function refreshPointsAfterGeneration() {
    if (typeof onPointsChanged === 'function') {
      await onPointsChanged();
    }
  }

  async function quoteNodePoints(node) {
    const selectedModel = getSelectedModelOption(node.type, node.model, modelOptionsByNodeTypeRef.current);
    const modelId = selectedModel?.modelId || null;
    if (!modelId) {
      throw new Error('未找到积分报价模型');
    }

    const quote = await pointsApi.quote({
      modelId,
      params: {
        ...getNodeGenerateParams(node),
        node_type: node.type,
        nodeType: node.type,
        count: 1,
      },
    }, {
      timeout: POINTS_QUOTE_TIMEOUT_MS,
    });
    const points = resolveQuotePoints(quote);
    if (points == null) {
      throw new Error('积分报价失败');
    }
    return points;
  }

  async function ensureEnoughPoints(points, event, actionName) {
    const wallet = await pointsApi.getWallet();
    const availablePoints = resolveWalletAvailablePoints(wallet);
    if (availablePoints == null) {
      throw new Error('积分校验失败');
    }

    if (availablePoints < points) {
      showNoticeAtEvent(
        event,
        `${actionName}预计消耗 ${formatPointsValue(points)} 积分，当前可用 ${formatPointsValue(availablePoints)} 积分`,
      );
      return false;
    }

    return true;
  }

  async function canGenerateNodeWithPoints(node, event) {
    if (!POINTS_QUOTE_NODE_TYPES.includes(node?.type)) {
      return true;
    }

    try {
      const points = await quoteNodePoints(node);
      return ensureEnoughPoints(points, event, '本次生成');
    } catch {
      showNoticeAtEvent(event, '积分校验失败，请稍后重试');
      return false;
    }
  }

  async function canRunNodeSetWithPoints(targetNodes, event, actionName = '整组执行') {
    const candidateNodes = targetNodes.filter(
      (node) => POINTS_QUOTE_NODE_TYPES.includes(node.type) && getNodePrompt(node),
    );
    if (candidateNodes.length === 0) {
      return true;
    }

    const hasMissingModel = candidateNodes.some((node) => {
      const selectedModel = getSelectedModelOption(
        node.type,
        node.model,
        modelOptionsByNodeTypeRef.current,
      );
      return !selectedModel?.modelId;
    });
    if (hasMissingModel) {
      showNoticeAtEvent(event, '积分报价模型未就绪，请稍后重试');
      return false;
    }

    try {
      const quoteResults = await Promise.all(candidateNodes.map((node) => quoteNodePoints(node)));
      const totalPoints = quoteResults.reduce((total, points) => total + points, 0);
      return ensureEnoughPoints(totalPoints, event, actionName);
    } catch {
      showNoticeAtEvent(event, '积分校验失败，请稍后重试');
      return false;
    }
  }

  async function canRunWorkflowWithPoints(event) {
    if (pointsQuoteSpecs.length === 0) {
      if (getWorkflowPointsCandidateNodes().length > 0) {
        showNoticeAtEvent(event, '积分报价模型未就绪，请稍后重试');
        return false;
      }
      return true;
    }

    if (pointsQuoteSpecs.length < getWorkflowPointsCandidateNodes().length) {
      showNoticeAtEvent(event, '积分报价模型未就绪，请稍后重试');
      return false;
    }

    try {
      const quoteResults = await Promise.all(
        pointsQuoteSpecs.map((spec) =>
          pointsApi.quote({
            modelId: spec.modelId,
            params: spec.params,
          }, {
            timeout: POINTS_QUOTE_TIMEOUT_MS,
          }),
        ),
      );
      const totalPoints = quoteResults.reduce((total, quote) => {
        const points = resolveQuotePoints(quote);
        if (points == null) {
          throw new Error('积分报价失败');
        }
        return total + points;
      }, 0);
      return ensureEnoughPoints(totalPoints, event, '运行工作流');
    } catch {
      showNoticeAtEvent(event, '积分校验失败，请稍后重试');
      return false;
    }
  }

  function hasNodeGeneratedContent(node) {
    if (!node) {
      return false;
    }

    if (isMediaNodeType(node.type)) {
      return Boolean(node.mediaPreviewUrl);
    }

    return Boolean((node.content || '').trim());
  }

  function getUploadedAssetUrl(result) {
    const contentJson = getUploadedNodeContentJson(result);
    const outputJson = firstObject(contentJson.output);
    const contentUrl = Array.isArray(contentJson.url) ? contentJson.url[0] : contentJson.url;
    return String(
      result?.url ??
        result?.asset_url ??
        result?.assetUrl ??
        result?.file_url ??
        result?.fileUrl ??
        contentUrl ??
        outputJson.url ??
        contentJson.asset_url ??
        contentJson.assetUrl ??
        contentJson.mediaPreviewUrl ??
        contentJson.image_url ??
        contentJson.imageUrl ??
        contentJson.video_url ??
        contentJson.videoUrl ??
        '',
    ).trim();
  }

  function getUploadedNodeContentJson(result) {
    return firstJsonObject(
      result?.content_json,
      result?.contentJson,
      result?.node?.content_json,
      result?.node?.contentJson,
      result?.data?.content_json,
      result?.data?.contentJson,
      result?.data?.node?.content_json,
      result?.data?.node?.contentJson,
    );
  }

  function getUploadedAssetFileName(result, fallback = '') {
    const contentJson = getUploadedNodeContentJson(result);
    return String(
      result?.file_name ??
        result?.fileName ??
        contentJson.file_name ??
        contentJson.fileName ??
        contentJson.mediaFileName ??
        fallback,
    ).trim();
  }

  function getNodeRunId(result) {
    return String(
      result?.node_run_id ??
        result?.nodeRunId ??
        result?.generation_run_id ??
        result?.generationRunId ??
        result?.run_id ??
        result?.runId ??
        result?.id ??
        result?.node_run?.node_run_id ??
        result?.node_run?.generation_run_id ??
        result?.node_run?.generationRunId ??
        result?.node_run?.id ??
        '',
    ).trim();
  }

  function getWorkflowRunId(result) {
    return String(
      result?.workflow_run_id ??
        result?.workflowRunId ??
        result?.workflow_root_run_id ??
        result?.workflowRootRunId ??
        result?.canvas_workflow_run_id ??
        result?.canvasWorkflowRunId ??
        result?.canvas_run_id ??
        result?.canvasRunId ??
        result?.root_run_id ??
        result?.rootRunId ??
        result?.run_id ??
        result?.runId ??
        result?.id ??
        result?.run?.workflow_run_id ??
        result?.run?.workflowRunId ??
        result?.run?.workflow_root_run_id ??
        result?.run?.workflowRootRunId ??
        result?.run?.canvas_workflow_run_id ??
        result?.run?.canvasWorkflowRunId ??
        result?.run?.canvas_run_id ??
        result?.run?.canvasRunId ??
        result?.run?.root_run_id ??
        result?.run?.rootRunId ??
        result?.run?.run_id ??
        result?.run?.runId ??
        result?.run?.id ??
        result?.workflow_run?.workflow_run_id ??
        result?.workflow_run?.workflowRunId ??
        result?.workflow_run?.workflow_root_run_id ??
        result?.workflow_run?.workflowRootRunId ??
        result?.workflow_run?.canvas_workflow_run_id ??
        result?.workflow_run?.canvasWorkflowRunId ??
        result?.workflow_run?.canvas_run_id ??
        result?.workflow_run?.canvasRunId ??
        result?.workflow_run?.root_run_id ??
        result?.workflow_run?.rootRunId ??
        result?.workflow_run?.run_id ??
        result?.workflow_run?.runId ??
        result?.workflowRun?.workflow_run_id ??
        result?.workflowRun?.workflowRunId ??
        result?.workflowRun?.workflow_root_run_id ??
        result?.workflowRun?.workflowRootRunId ??
        result?.workflowRun?.canvas_workflow_run_id ??
        result?.workflowRun?.canvasWorkflowRunId ??
        result?.workflowRun?.canvas_run_id ??
        result?.workflowRun?.canvasRunId ??
        result?.workflowRun?.root_run_id ??
        result?.workflowRun?.rootRunId ??
        result?.workflowRun?.run_id ??
        result?.workflowRun?.runId ??
        result?.workflowRun?.id ??
        result?.workflow_run?.id ??
        '',
    ).trim();
  }

  function getWorkflowRunGroupId(result) {
    return String(
      result?.group_id ??
        result?.groupId ??
        result?.run?.group_id ??
        result?.run?.groupId ??
        result?.workflow_run?.group_id ??
        result?.workflow_run?.groupId ??
        result?.workflowRun?.group_id ??
        result?.workflowRun?.groupId ??
        '',
    ).trim();
  }

  function getWorkflowRunStatus(result) {
    return String(
      result?.status ??
        result?.workflow_status ??
        result?.workflowStatus ??
        result?.run_status ??
        result?.runStatus ??
        result?.state ??
        result?.workflow_run?.status ??
        result?.workflow_run?.workflow_status ??
        result?.workflow_run?.workflowStatus ??
        result?.workflow_run?.run_status ??
        result?.workflow_run?.runStatus ??
        '',
    ).trim().toLowerCase();
  }

  function getWorkflowNodeStatusItems(result) {
    const directItems =
      result?.node_statuses ??
      result?.nodeStatuses ??
      result?.nodes ??
      result?.node_runs ??
      result?.nodeRuns ??
      result?.runs ??
      result?.workflow_run?.node_statuses ??
      result?.workflow_run?.nodeStatuses ??
      result?.workflow_run?.nodes ??
      result?.workflow_run?.node_runs ??
      result?.workflow_run?.nodeRuns ??
      [];

    if (Array.isArray(directItems)) {
      return directItems;
    }

    if (directItems && typeof directItems === 'object') {
      return Object.entries(directItems).map(([nodeId, value]) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? { node_id: nodeId, ...value }
          : { node_id: nodeId, status: value },
      );
    }

    return [];
  }

  function getWorkflowNodeId(item) {
    return String(item?.node_id ?? item?.nodeId ?? item?.nodeKey ?? item?.id ?? item?.node?.node_id ?? '').trim();
  }

  function getWorkflowNodeRunId(item) {
    return getNodeRunId(item);
  }

  function getWorkflowNodeStatus(item) {
    return getNodeRunStatus(item);
  }

  function getNodeRunStatus(result) {
    return String(
      result?.status ??
        result?.generation_status ??
        result?.generationStatus ??
        result?.run_status ??
        result?.runStatus ??
        result?.state ??
        result?.node_run?.status ??
        result?.node_run?.generation_status ??
        result?.node_run?.generationStatus ??
        '',
    ).trim().toLowerCase();
  }

  function isNodeRunSuccessStatus(status) {
    return isSuccessGenerationStatus(status);
  }

  function isNodeRunFailureStatus(status) {
    return isFailureGenerationStatus(status);
  }

  function getNodeRunOutputSnapshot(result) {
    return firstJsonObject(
      result?.output_snapshot,
      result?.outputSnapshot,
      result?.output_json,
      result?.outputJson,
      result?.content_json,
      result?.contentJson,
      result?.node?.content_json,
      result?.node?.contentJson,
      result?.node_run?.output_snapshot,
      result?.node_run?.outputSnapshot,
      result?.node_run?.output_json,
      result?.node_run?.outputJson,
    );
  }

  function getNodeRunTextOutput(result) {
    const output = getNodeRunOutputSnapshot(result);
    return String(
      result?.text ??
        result?.output_text ??
        result?.outputText ??
        output.text ??
        output.output_text ??
        output.outputText ??
        output.content ??
        '',
    ).trim();
  }

  function getNodeRunOutputUrl(result) {
    const output = getNodeRunOutputSnapshot(result);
    return String(
      result?.oss_url ??
        result?.ossUrl ??
        result?.node_run?.oss_url ??
        result?.node_run?.ossUrl ??
        result?.url ??
        result?.output_url ??
        result?.outputUrl ??
        result?.asset_url ??
        result?.assetUrl ??
        result?.output_asset_url ??
        result?.outputAssetUrl ??
        output.url ??
        output.oss_url ??
        output.ossUrl ??
        output.output_url ??
        output.outputUrl ??
        output.asset_url ??
        output.assetUrl ??
        output.mediaPreviewUrl ??
        output.image_url ??
        output.imageUrl ??
        output.video_url ??
        output.videoUrl ??
        '',
    ).trim();
  }

  function getNodeRunOutputs(result, nodeRunId = '') {
    const output = getNodeRunOutputSnapshot(result);
    const arrayCandidates = [
      result?.outputs,
      result?.output_urls,
      result?.outputUrls,
      result?.images,
      result?.videos,
      result?.node_run?.outputs,
      result?.node_run?.output_urls,
      result?.node_run?.outputUrls,
      output.outputs,
      output.output_urls,
      output.outputUrls,
      output.images,
      output.videos,
    ];
    const sourceItems = arrayCandidates.find((candidate) => Array.isArray(candidate)) || [];
    const normalizedItems = sourceItems
      .map((item, index) => {
        const details = typeof item === 'string' ? { url: item } : parseJsonObject(item);
        const url = String(
          details.url ??
            details.oss_url ??
            details.ossUrl ??
            details.output_url ??
            details.outputUrl ??
            details.asset_url ??
            details.assetUrl ??
            details.image_url ??
            details.imageUrl ??
            details.video_url ??
            details.videoUrl ??
            '',
        ).trim();
        if (!url) {
          return null;
        }
        return {
          id: String(details.id || `${nodeRunId || 'output'}-${index}`),
          url,
          width: Number(details.width ?? details.image_width ?? details.video_width) || 0,
          height: Number(details.height ?? details.image_height ?? details.video_height) || 0,
          duration: Number(details.duration ?? details.duration_seconds) || 0,
          fileSize: Number(details.fileSize ?? details.file_size ?? details.size) || 0,
          mimeType: String(
            details.mimeType ?? details.mime_type ?? details.content_type ?? '',
          ).trim(),
        };
      })
      .filter(Boolean);

    if (normalizedItems.length > 0) {
      return normalizedItems;
    }

    const outputUrl = getNodeRunOutputUrl(result);
    return outputUrl
      ? [
          {
            id: String(output.id || nodeRunId || 'output-0'),
            url: outputUrl,
            width: Number(output.width ?? output.image_width ?? output.video_width) || 0,
            height: Number(output.height ?? output.image_height ?? output.video_height) || 0,
            duration: Number(output.duration ?? output.duration_seconds) || 0,
            fileSize: Number(output.fileSize ?? output.file_size ?? output.size) || 0,
            mimeType: String(
              output.mimeType ?? output.mime_type ?? output.content_type ?? '',
            ).trim(),
          },
        ]
      : [];
  }

  function getNodeRunPatch(node, result) {
    if (!node) {
      return {};
    }

    if (node.type === 'script') {
      const outputText = getNodeRunTextOutput(result);
      return outputText ? { content: outputText } : {};
    }

    if (['image', 'video', 'audio'].includes(node.type)) {
      const outputUrl =
        getNodeRunOutputUrl(result) ||
        getNodeRunOutputs(result, getNodeRunId(result))[0]?.url ||
        '';
      return outputUrl
        ? {
          mediaPreviewUrl: outputUrl,
          mediaFileName: '',
          mediaFileSize: 0,
          mediaMimeType: '',
            ...(['image', 'video'].includes(node.type)
              ? {
                  generationMeta: getCompletedGenerationMeta(
                    node,
                    result,
                    getNodeRunId(result),
                  ),
                  pendingGenerationMeta: normalizeGenerationMeta(null),
                }
              : {}),
          }
        : {};
    }

    return {};
  }

  function clearNodeRunSyncTimer(nodeId) {
    const timer = nodeRunSyncTimersRef.current[nodeId];
    if (timer) {
      window.clearTimeout(timer);
      delete nodeRunSyncTimersRef.current[nodeId];
    }
  }

  function clearAllNodeRunSyncTimers() {
    Object.values(nodeRunSyncTimersRef.current).forEach((timer) => {
      window.clearTimeout(timer);
    });
    nodeRunSyncTimersRef.current = {};
  }

  function clearWorkflowRunSyncTimer() {
    if (workflowRunSyncTimerRef.current) {
      window.clearTimeout(workflowRunSyncTimerRef.current);
      workflowRunSyncTimerRef.current = null;
    }
  }

  function scheduleWorkflowRunSync(
    projectId,
    workflowRunId,
    shouldSkipGraphSave = false,
    scopedNodeIds = null,
    groupId = '',
  ) {
    clearWorkflowRunSyncTimer();
    workflowRunSyncTimerRef.current = window.setTimeout(
      () =>
        syncWorkflowRunResult(
          projectId,
          workflowRunId,
          shouldSkipGraphSave,
          scopedNodeIds,
          groupId,
        ),
      WORKFLOW_RUN_SYNC_INTERVAL_MS,
    );
  }

  function finishNodeRunSync(nodeId, isFailed = false) {
    clearNodeRunSyncTimer(nodeId);
    setGeneratingNodeIds((current) => current.filter((item) => item !== nodeId));
    setGenerationFailedNodeIds((current) =>
      isFailed
        ? current.includes(nodeId)
          ? current
          : [...current, nodeId]
        : current.filter((item) => item !== nodeId),
    );
  }

  function scheduleNodeRunSync(projectId, nodeId, nodeRunId) {
    clearNodeRunSyncTimer(nodeId);
    nodeRunSyncTimersRef.current[nodeId] = window.setTimeout(
      () => syncNodeRunResult(projectId, nodeId, nodeRunId),
      NODE_RUN_SYNC_INTERVAL_MS,
    );
  }

  async function syncNodeRunResult(projectId, nodeId, nodeRunId) {
    try {
      const result = await freeCanvasApi.syncNodeRun(projectId, nodeRunId);
      const status = getNodeRunStatus(result);
      if (isNodeRunFailureStatus(status)) {
        updateNode(nodeId, {
          status: 'failed',
          generationStatus: status || 'failed',
          generationRunId: nodeRunId,
          pendingGenerationMeta: normalizeGenerationMeta(null),
        });
        finishNodeRunSync(nodeId, true);
        return;
      }

      if (isNodeRunSuccessStatus(status)) {
        setNodes((current) =>
          current.map((node) => {
            if (node.id !== nodeId) {
              return node;
            }
            return {
              ...node,
            ...getNodeRunPatch(node, result),
            status: 'success',
            generationStatus: status || 'success',
            generationRunId: '',
            pendingGenerationMeta: normalizeGenerationMeta(null),
            };
          }),
        );
        finishNodeRunSync(nodeId, false);
        return;
      }

      updateNode(nodeId, {
        status: isActiveGenerationStatus(status) ? status : 'running',
        generationStatus: status || 'running',
        generationRunId: nodeRunId,
      });
      scheduleNodeRunSync(projectId, nodeId, nodeRunId);
    } catch {
      updateNode(nodeId, {
        status: 'failed',
        generationStatus: 'failed',
        generationRunId: nodeRunId,
        pendingGenerationMeta: normalizeGenerationMeta(null),
      });
      finishNodeRunSync(nodeId, true);
    }
  }

  function applyWorkflowRunSnapshot(result, shouldSkipGraphSave = false, scopedNodeIds = null) {
    const workflowStatus = getWorkflowRunStatus(result);
    const scopedNodeIdSet = Array.isArray(scopedNodeIds)
      ? new Set(scopedNodeIds.filter(Boolean))
      : null;
    const nodeStatusItems = getWorkflowNodeStatusItems(result).filter((item) => {
      if (!scopedNodeIdSet) {
        return true;
      }
      return scopedNodeIdSet.has(getWorkflowNodeId(item));
    });
    const nodeStatusById = new Map(
      nodeStatusItems
        .map((item) => [getWorkflowNodeId(item), item])
        .filter(([nodeId]) => Boolean(nodeId)),
    );
    const activeNodeIds = nodeStatusItems
      .filter((item) => isActiveGenerationStatus(getWorkflowNodeStatus(item)))
      .map((item) => getWorkflowNodeId(item))
      .filter(Boolean);
    const failedNodeIds = nodeStatusItems
      .filter((item) => isFailureGenerationStatus(getWorkflowNodeStatus(item)))
      .map((item) => getWorkflowNodeId(item))
      .filter(Boolean);

    if (nodeStatusItems.length > 0) {
      if (shouldSkipGraphSave) {
        skipUpcomingGraphSaves(1);
      }
      setNodes((current) =>
        current.map((node) => {
          if (scopedNodeIdSet && !scopedNodeIdSet.has(node.id)) {
            return node;
          }
          const item = nodeStatusById.get(node.id);
          if (!item) {
            return node;
          }

          const nodeStatus = getWorkflowNodeStatus(item);
          const nodeRunId = getWorkflowNodeRunId(item);
          const nextStatus = getUiStatusFromGenerationStatus(nodeStatus, node.status);

          return {
            ...node,
            ...getNodeRunPatch(node, item),
            status: nextStatus,
            generationStatus: nodeStatus || node.generationStatus || '',
            generationRunId: isSuccessGenerationStatus(nodeStatus) ? '' : nodeRunId || node.generationRunId || '',
            ...(isSuccessGenerationStatus(nodeStatus) || isFailureGenerationStatus(nodeStatus)
              ? { pendingGenerationMeta: normalizeGenerationMeta(null) }
              : {}),
          };
        }),
      );

      setGeneratingNodeIds((current) =>
        scopedNodeIdSet
          ? [
              ...current.filter((nodeId) => !scopedNodeIdSet.has(nodeId)),
              ...activeNodeIds,
            ]
          : activeNodeIds,
      );
      setGenerationFailedNodeIds((current) =>
        scopedNodeIdSet
          ? [
              ...current.filter((nodeId) => !scopedNodeIdSet.has(nodeId)),
              ...failedNodeIds,
            ]
          : failedNodeIds,
      );
    } else if (isSuccessGenerationStatus(workflowStatus) || isFailureGenerationStatus(workflowStatus)) {
      const nextStatus = isSuccessGenerationStatus(workflowStatus) ? 'success' : 'failed';
      const terminalNodeIds = scopedNodeIdSet
        ? Array.from(scopedNodeIdSet)
        : nodesRef.current
            .filter((node) => isActiveGenerationStatus(node.status))
            .map((node) => node.id);
      if (shouldSkipGraphSave) {
        skipUpcomingGraphSaves(1);
      }
      setNodes((current) =>
        current.map((node) =>
          (!scopedNodeIdSet || scopedNodeIdSet.has(node.id)) &&
          isActiveGenerationStatus(node.status)
            ? {
                ...node,
                status: nextStatus,
                generationStatus: workflowStatus || nextStatus,
                generationRunId: '',
                pendingGenerationMeta: normalizeGenerationMeta(null),
              }
            : node,
        ),
      );
      setGeneratingNodeIds((current) =>
        scopedNodeIdSet
          ? current.filter((nodeId) => !scopedNodeIdSet.has(nodeId))
          : [],
      );
      setGenerationFailedNodeIds((current) =>
        isSuccessGenerationStatus(workflowStatus)
          ? scopedNodeIdSet
            ? current.filter((nodeId) => !scopedNodeIdSet.has(nodeId))
            : []
          : scopedNodeIdSet
            ? Array.from(
                new Set([
                  ...current.filter((nodeId) => !scopedNodeIdSet.has(nodeId)),
                  ...terminalNodeIds,
                ]),
              )
            : terminalNodeIds,
      );
    }

    return workflowStatus;
  }

  function finishWorkflowRunSync(groupId = '') {
    clearWorkflowRunSyncTimer();
    setIsRunningWorkflow(false);
    if (groupId) {
      groupExecutionIdsRef.current.delete(groupId);
      setSubmittingGroupIds((current) => current.filter((item) => item !== groupId));
    }
  }

  async function syncWorkflowRunResult(
    projectId,
    workflowRunId,
    shouldSkipGraphSave = false,
    scopedNodeIds = null,
    groupId = '',
  ) {
    try {
      const result = await freeCanvasApi.syncWorkflowRun(projectId, workflowRunId);
      const workflowStatus = applyWorkflowRunSnapshot(
        result,
        shouldSkipGraphSave,
        scopedNodeIds,
      );
      if (isFailureGenerationStatus(workflowStatus) || isSuccessGenerationStatus(workflowStatus)) {
        finishWorkflowRunSync(groupId);
        return;
      }

      scheduleWorkflowRunSync(
        projectId,
        workflowRunId,
        shouldSkipGraphSave,
        scopedNodeIds,
        groupId,
      );
    } catch {
      finishWorkflowRunSync(groupId);
      setNodes((current) =>
        current.map((node) =>
          (!scopedNodeIds || scopedNodeIds.includes(node.id)) &&
          isActiveGenerationStatus(node.status)
            ? {
                ...node,
                status: 'failed',
                generationStatus: 'failed',
                pendingGenerationMeta: normalizeGenerationMeta(null),
              }
            : node,
        ),
      );
      setGeneratingNodeIds((current) =>
        scopedNodeIds
          ? current.filter((nodeId) => !scopedNodeIds.includes(nodeId))
          : [],
      );
      if (scopedNodeIds) {
        setGenerationFailedNodeIds((current) =>
          Array.from(new Set([...current, ...scopedNodeIds])),
        );
      }
    }
  }

  async function restoreLatestWorkflowRun(
    projectId,
    shouldCancel = () => false,
    graphNodes = nodesRef.current,
  ) {
    try {
      const result = await freeCanvasApi.getLatestWorkflowRun(projectId);
      if (shouldCancel()) {
        return;
      }

      const workflowRunId = getWorkflowRunId(result);
      const groupId = getWorkflowRunGroupId(result);
      const scopedNodeIds = groupId
        ? graphNodes.filter((node) => node.groupId === groupId).map((node) => node.id)
        : null;
      const workflowStatus = applyWorkflowRunSnapshot(result, true, scopedNodeIds);

      if (!workflowRunId || !isActiveGenerationStatus(workflowStatus)) {
        setIsRunningWorkflow(false);
        if (groupId) {
          groupExecutionIdsRef.current.delete(groupId);
          setSubmittingGroupIds((current) => current.filter((item) => item !== groupId));
        }
        return;
      }

      if (groupId) {
        groupExecutionIdsRef.current.add(groupId);
        setSubmittingGroupIds((current) =>
          current.includes(groupId) ? current : [...current, groupId],
        );
      }
      setIsRunningWorkflow(true);
      await syncWorkflowRunResult(
        projectId,
        workflowRunId,
        true,
        scopedNodeIds,
        groupId,
      );
    } catch {
      if (shouldCancel()) {
        return;
      }
      setIsRunningWorkflow(false);
      groupExecutionIdsRef.current.clear();
      setSubmittingGroupIds([]);
    }
  }

  async function handleGenerateNode(nodeId, event) {
    if (!canvasProjectId || generatingNodeIds.includes(nodeId)) {
      return;
    }
    hidePointsTip(event?.currentTarget || pointsTipTargetRef.current);

    const targetNode = nodeMap[nodeId];
    if (!targetNode) {
      return;
    }

    const canGenerate = await canGenerateNodeWithPoints(targetNode, event);
    if (!canGenerate) {
      return;
    }

    setGeneratingNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));
    setGenerationFailedNodeIds((current) => current.filter((item) => item !== nodeId));
    const pendingGenerationMeta = ['image', 'video'].includes(targetNode.type)
      ? buildGenerationMetaSnapshot(targetNode)
      : null;

    try {
      const result = await freeCanvasApi.generateNode(canvasProjectId, nodeId, {
        request_id: `${sessionIdRef.current}-${nodeId}-${Date.now()}`,
        async: true,
        params_override: getNodeGenerateParams(targetNode),
      });
      const nodeRunId = getNodeRunId(result);
      if (!nodeRunId) {
        throw new Error('missing node run id');
      }
      await refreshPointsAfterGeneration();
      updateNode(nodeId, {
        status: 'queued',
        generationStatus: 'queued',
        generationRunId: nodeRunId,
        ...(['image', 'video'].includes(targetNode.type)
          ? {
              pendingGenerationMeta: {
                ...pendingGenerationMeta,
                runId: nodeRunId,
              },
            }
          : {}),
      });
      scheduleNodeRunSync(canvasProjectId, nodeId, nodeRunId);
    } catch {
      updateNode(nodeId, {
        status: 'failed',
        generationStatus: 'failed',
        generationRunId: '',
        pendingGenerationMeta: normalizeGenerationMeta(null),
      });
      finishNodeRunSync(nodeId, true);
    }
  }

  function updateVideoDurationFromPointer(event, nodeId) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const duration = MIN_VIDEO_DURATION_SECONDS + progress * (MAX_VIDEO_DURATION_SECONDS - MIN_VIDEO_DURATION_SECONDS);
    updateNode(nodeId, { durationSeconds: clampVideoDurationSeconds(duration) });
  }

  function handleVideoDurationPointerDown(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateVideoDurationFromPointer(event, nodeId);
  }

  function handleVideoDurationPointerMove(event, nodeId) {
    if (event.buttons !== 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateVideoDurationFromPointer(event, nodeId);
  }

  function handleVideoDurationPointerUp(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleVideoDurationKeyDown(event, nodeId, currentDuration) {
    let nextDuration = currentDuration;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextDuration -= 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextDuration += 1;
    } else if (event.key === 'Home') {
      nextDuration = MIN_VIDEO_DURATION_SECONDS;
    } else if (event.key === 'End') {
      nextDuration = MAX_VIDEO_DURATION_SECONDS;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateNode(nodeId, { durationSeconds: clampVideoDurationSeconds(nextDuration) });
  }

  function getCanvasMediaNodeType(file) {
    const mimeType = String(file?.type || '').toLowerCase();
    const fileName = String(file?.name || '').toLowerCase();
    if (mimeType.startsWith('image/') || /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i.test(fileName)) {
      return 'image';
    }
    if (mimeType.startsWith('video/') || /\.(avi|m4v|mkv|mov|mp4|mpeg|webm)$/i.test(fileName)) {
      return 'video';
    }
    return '';
  }

  async function uploadMediaFileToNode(file, nodeId, nodeType, noticePoint = null) {
    const resolvedNodeType = nodeType || nodeMap[nodeId]?.type || '';
    const resolvedMediaType = getNodeTypeMediaType(resolvedNodeType);
    const fileMediaType = getCanvasMediaNodeType(file);
    if (!fileMediaType || fileMediaType !== resolvedMediaType) {
      if (noticePoint) {
        showConnectionNotice(noticePoint.clientX, noticePoint.clientY, '仅支持上传与节点类型一致的图片或视频');
      }
      return false;
    }
    if (
      !canvasProjectId ||
      !isResourceContainerNodeType(resolvedNodeType) ||
      uploadingNodeIds.includes(nodeId)
    ) {
      if (noticePoint && !canvasProjectId) {
        showConnectionNotice(noticePoint.clientX, noticePoint.clientY, '画布项目未就绪');
      }
      return false;
    }
    if (!persistedNodeIdsRef.current.has(nodeId)) {
      const graphSaved = await saveGraphSnapshotNow(
        nodesRef.current,
        edgesRef.current,
      );
      if (!graphSaved) {
        if (noticePoint) {
          showConnectionNotice(
            noticePoint.clientX,
            noticePoint.clientY,
            '资源节点保存失败，请稍后重试上传',
          );
        }
        return false;
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('slot_key', 'upload');
    setUploadingNodeIds((current) => (current.includes(nodeId) ? current : [...current, nodeId]));

    try {
      const result = await freeCanvasApi.uploadNodeAsset(canvasProjectId, nodeId, formData);
      const uploadedUrl = getUploadedAssetUrl(result);
      if (uploadedUrl) {
        const uploadedFileName = getUploadedAssetFileName(result, file.name);
        const uploadedContentJson = getUploadedNodeContentJson(result);
        updateNode(nodeId, {
          title: uploadedFileName,
          status: 'success',
          mediaPreviewUrl: uploadedUrl,
          mediaFileName: uploadedFileName,
          mediaFileSize: Number(file.size) || 0,
          mediaMimeType: String(file.type || '').trim(),
          resourceContentJson:
            Object.keys(uploadedContentJson).length > 0
              ? uploadedContentJson
              : {
                  type: resolvedMediaType,
                  url: [uploadedUrl],
                  action: `${resolvedMediaType}_resource`,
                  output: {
                    url: uploadedUrl,
                    source: 'upload',
                  },
                },
        });
        return true;
      }
      throw new Error('上传结果未返回文件地址');
    } catch (error) {
      if (noticePoint) {
        showConnectionNotice(
          noticePoint.clientX,
          noticePoint.clientY,
          parseApiErrorMessage(error, '媒体上传失败，请稍后重试'),
        );
      }
      return false;
    } finally {
      setUploadingNodeIds((current) => current.filter((item) => item !== nodeId));
    }
  }

  async function uploadVideoFrameAsset(file, nodeId, role) {
    const uploadKey = `${nodeId}:${role}`;
    const videoNode = nodesRef.current.find(
      (node) => node.id === nodeId && node.type === 'video',
    );
    const isSupportedRole = [
      VIDEO_INPUT_ROLE_FIRST_FRAME,
      VIDEO_INPUT_ROLE_END_FRAME,
    ].includes(role);
    if (!videoNode || !isSupportedRole || uploadingVideoFrameKeys.includes(uploadKey)) {
      return false;
    }
    if (getCanvasMediaNodeType(file) !== 'image') {
      showNoticeAtEvent(null, '首帧和尾帧仅支持上传图片');
      return false;
    }
    if (!canvasProjectId) {
      showNoticeAtEvent(null, '画布项目未就绪');
      return false;
    }
    setUploadingVideoFrameKeys((current) =>
      current.includes(uploadKey) ? current : [...current, uploadKey],
    );

    let frameNode = getInternalVideoFrameNode(
      nodesRef.current,
      nodeId,
      role,
    );
    const createdFrameNode = !frameNode;
    try {
      if (!frameNode) {
        frameNode = buildNewNode('upload_image', {
          worldPoint: {
            x: videoNode.x + videoNode.width / 2,
            y: videoNode.y + videoNode.height / 2,
          },
          title:
            role === VIDEO_INPUT_ROLE_END_FRAME
              ? '内部尾帧素材'
              : '内部首帧素材',
          videoInputRole: role,
          videoInputTargetNodeId: nodeId,
          empty: true,
        });
      }
      let nextNodes = nodesRef.current.some((node) => node.id === frameNode.id)
        ? nodesRef.current
        : [...nodesRef.current, frameNode];
      let nextEdges = edgesRef.current;
      const existingFrameEdge = nextEdges.find(
        (edge) => edge.from === frameNode.id && edge.to === nodeId,
      );
      if (!existingFrameEdge) {
        edgeSequenceRef.current += 1;
        nextEdges = [
          ...nextEdges,
          {
            id: `edge-${frameNode.id}-${nodeId}-${edgeSequenceRef.current}`,
            ...normalizeCanvasEdgePorts({
              from: frameNode.id,
              to: nodeId,
              sourcePortKey: 'output',
              targetPortKey: role,
              sortOrder:
                role === VIDEO_INPUT_ROLE_END_FRAME ? 1 : 0,
            }),
          },
        ];
      } else if (existingFrameEdge.targetPortKey !== role) {
        nextEdges = nextEdges.map((edge) =>
          edge.id === existingFrameEdge.id
            ? { ...edge, targetPortKey: role }
            : edge,
        );
      }
      const graphSaved = await saveGraphSnapshotNow(nextNodes, nextEdges);
      if (!graphSaved) {
        throw new Error('内部图片节点保存失败，请稍后重试上传');
      }
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('slot_key', 'upload');
      const result = await freeCanvasApi.uploadNodeAsset(
        canvasProjectId,
        frameNode.id,
        formData,
      );
      const uploadedUrl = getUploadedAssetUrl(result);
      if (!uploadedUrl) {
        throw new Error('上传结果未返回文件地址');
      }
      const uploadedFileName = getUploadedAssetFileName(result, file.name);
      const uploadedContentJson = getUploadedNodeContentJson(result);
      nextNodes = nodesRef.current.map((node) =>
        node.id === frameNode.id
          ? {
              ...node,
              title: uploadedFileName,
              status: 'success',
              mediaPreviewUrl: uploadedUrl,
              mediaFileName: uploadedFileName,
              resourceContentJson:
                Object.keys(uploadedContentJson).length > 0
                  ? uploadedContentJson
                  : {
                      type: 'image',
                      url: [uploadedUrl],
                      action: 'image_resource',
                      output: {
                        url: uploadedUrl,
                        source: 'upload',
                      },
                    },
            }
          : node.id === nodeId
            ? clearVideoFrameAssetState(node, [role])
            : node,
      );
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      return true;
    } catch (error) {
      if (createdFrameNode && frameNode) {
        const rollbackGraph = removeCanvasGraphItems(
          nodesRef.current,
          edgesRef.current,
          [frameNode.id],
          [],
        );
        nodesRef.current = rollbackGraph.nodes;
        edgesRef.current = rollbackGraph.edges;
        setNodes(rollbackGraph.nodes);
        setEdges(rollbackGraph.edges);
      }
      showNoticeAtEvent(
        null,
        parseApiErrorMessage(error, '图片上传失败，请稍后重试'),
      );
      return false;
    } finally {
      setUploadingVideoFrameKeys((current) =>
        current.filter((item) => item !== uploadKey),
      );
    }
  }

  function openVideoFrameExtractor(nodeId, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const videoNode = nodesRef.current.find(
      (node) =>
        node.id === nodeId &&
        node.type === 'video' &&
        Boolean(node.mediaPreviewUrl),
    );
    if (!videoNode) {
      showNoticeAtEvent(event, '当前视频还没有可提取的生成结果');
      return;
    }

    closePromptPopoverOptionMenus();
    setExpandedPromptNodeId('');
    setPromptFocusNodeId('');
    setVideoFrameExtractor({
      ...createDefaultVideoFrameExtractorState(),
      nodeId,
    });
  }

  function closeVideoFrameExtractor() {
    if (videoFrameExtractionInFlightRef.current) {
      return;
    }
    videoFrameExtractorRef.current?.pause?.();
    setVideoFrameExtractor(createDefaultVideoFrameExtractorState());
  }

  function syncVideoFrameExtractorState(video, options = {}) {
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    const currentTime = Number.isFinite(video?.currentTime)
      ? video.currentTime
      : 0;
    setVideoFrameExtractor((current) => ({
      ...current,
      duration,
      currentTime: Math.min(duration || currentTime, currentTime),
      ...(typeof options.isSeeking === 'boolean'
        ? { isSeeking: options.isSeeking }
        : {}),
    }));
  }

  function handleVideoFrameExtractorError() {
    setVideoFrameExtractor((current) => ({
      ...current,
      error: '视频预览加载失败，暂时无法提取画面。',
    }));
  }

  async function extractCurrentVideoFrame() {
    if (videoFrameExtractionInFlightRef.current) {
      return;
    }
    const videoNode = nodesRef.current.find(
      (node) => node.id === videoFrameExtractor.nodeId,
    );
    const video = videoFrameExtractorRef.current;
    if (
      !videoNode ||
      videoNode.type !== 'video' ||
      !video ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setVideoFrameExtractor((current) => ({
        ...current,
        error: '视频画面尚未准备好，请等待加载完成后重试。',
      }));
      return;
    }

    videoFrameExtractionInFlightRef.current = true;
    video.pause();
    setVideoFrameExtractor((current) => ({
      ...current,
      isExtracting: true,
      error: '',
    }));

    let frameNodeId = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('浏览器无法创建图片画布');
      }
      context.fillStyle = '#000';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('视频帧转换失败')),
          'image/jpeg',
          0.94,
        );
      });
      const timestamp = Number.isFinite(video.currentTime)
        ? video.currentTime
        : videoFrameExtractor.currentTime;
      const fileTimestamp = formatPreciseMediaTime(timestamp).replace(
        /[:.]/g,
        '-',
      );
      const fileName = `video-frame-${fileTimestamp}.jpg`;
      const frameFile = new File([frameBlob], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      const frameNode = buildNewNode('upload_image', {
        worldPoint: getExtractedFrameNodeWorldPoint(videoNode),
        title: `视频帧 ${formatPreciseMediaTime(timestamp)}`,
      });
      frameNodeId = frameNode.id;
      const nextNodes = [...nodesRef.current, frameNode];
      nodesRef.current = nextNodes;
      setNodes(nextNodes);

      const uploaded = await uploadMediaFileToNode(
        frameFile,
        frameNode.id,
        'upload_image',
        {
          clientX: window.innerWidth / 2,
          clientY: 96,
        },
      );
      if (!uploaded) {
        throw new Error('抽取的图片保存失败，请重试');
      }

      setVideoFrameExtractor(createDefaultVideoFrameExtractorState());
      selectNodes([frameNode.id], frameNode.id);
    } catch (error) {
      if (frameNodeId) {
        const nextNodes = nodesRef.current.filter(
          (node) => node.id !== frameNodeId,
        );
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
      }
      const errorText = String(error?.message || '');
      const isCrossOriginError =
        error?.name === 'SecurityError' ||
        /cross-origin|cross origin|tainted|origin-clean/i.test(errorText);
      setVideoFrameExtractor((current) => ({
        ...current,
        isExtracting: false,
        error: isCrossOriginError
          ? '视频存储地址未允许浏览器抽帧，请检查素材跨域访问配置。'
          : errorText || '视频帧提取失败，请稍后重试。',
      }));
    } finally {
      videoFrameExtractionInFlightRef.current = false;
      setVideoFrameExtractor((current) => ({
        ...current,
        isExtracting: false,
      }));
    }
  }

  async function handleMediaNodeUpload(event, nodeId) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const node = nodeMap[nodeId];
    await uploadMediaFileToNode(file, nodeId, node?.type, {
      clientX: window.innerWidth / 2,
      clientY: 96,
    });
    input.value = '';
  }

  function setVideoPlaying(nodeId, isPlaying) {
    updateNode(nodeId, { isVideoPlaying: isPlaying });
  }

  function updateVideoProgress(nodeId, video) {
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    const currentTime = Number.isFinite(video?.currentTime) ? video.currentTime : 0;
    updateNode(nodeId, {
      videoCurrentTime: currentTime,
      videoDuration: duration,
      videoProgress: duration > 0 ? currentTime / duration : 0,
    });
  }

  function isEditingNodeField(nodeId, field) {
    return editingNodeField?.nodeId === nodeId && editingNodeField?.field === field;
  }

  function beginNodeFieldEdit(nodeId, field) {
    setEditingNodeField({ nodeId, field });
    selectNodes([nodeId]);
  }

  function handleNodeDoubleClickCapture(event, nodeId) {
    if (event.target.closest?.('[data-node-popover="true"]')) {
      event.stopPropagation();
      return;
    }

    const node = nodeMap[nodeId];
    const mediaType = getNodeMediaType(node);
    const isMediaPreviewControl = Boolean(
      event.target.closest?.('button, input, textarea, select, a[href]'),
    );
    if (
      ['image', 'video'].includes(mediaType) &&
      node?.mediaPreviewUrl &&
      !isMediaPreviewControl &&
      event.target.closest?.('[data-media-preview="true"]')
    ) {
      if (mediaType === 'video') {
        preventNativeVideoFullscreen(event);
      } else {
        event.preventDefault();
        event.stopPropagation();
      }
      setMediaDetailNodeId(nodeId);
      return;
    }
    if (isResourceContainerNodeType(node?.type)) {
      const uploadInput = event.currentTarget.querySelector?.('input[type="file"]');
      if (uploadInput) {
        event.preventDefault();
        event.stopPropagation();
        uploadInput.click();
      }
      return;
    }

    const editableTarget = event.target.closest?.('[data-node-field]');
    if (!editableTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    beginNodeFieldEdit(nodeId, editableTarget.dataset.nodeField);
  }

  function handleNodePointerDownCapture(event, nodeId) {
    const editableTarget = event.target.closest?.('[data-node-field]');
    if (!editableTarget) {
      return;
    }

    const field = editableTarget.dataset.nodeField;
    const isEditing = isEditingNodeField(nodeId, field);
    if (isEditing) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    const now = Date.now();
    const previous = nodeFieldPointerRef.current;
    const isSecondClickOnSameField =
      previous &&
      previous.nodeId === nodeId &&
      previous.field === field &&
      now - previous.time <= 460 &&
      Math.abs(event.clientX - previous.x) <= 8 &&
      Math.abs(event.clientY - previous.y) <= 8;

    if (isSecondClickOnSameField) {
      event.stopPropagation();
      nodeFieldPointerRef.current = null;
      beginNodeFieldEdit(nodeId, field);
      return;
    }

    nodeFieldPointerRef.current = {
      nodeId,
      field,
      time: now,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleNodeFieldPointerDown(event, isEditing) {
    if (isEditing) {
      event.stopPropagation();
    }
  }

  function stopNodeFieldEdit(nodeId, field) {
    setEditingNodeField((current) =>
      current?.nodeId === nodeId && current?.field === field ? null : current,
    );
  }

  function handleTextNodeResizePointerDown(event, nodeId) {
    if (event.button !== 0) {
      return;
    }

    const node = nodeMap[nodeId];
    if (!node) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: 'resize-node',
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: node.width,
      originHeight: node.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    selectNodes([nodeId]);
  }

  function getDefaultNodeSize(type) {
    return {
      width: isMediaNodeType(type) ? 592 : type === 'storyboard' || type === 'script' ? 340 : 300,
      height: isMediaNodeType(type) ? 333 : type === 'storyboard' || type === 'script' ? 220 : 196,
    };
  }

  function buildNewNode(type, options = {}) {
    const meta = getNodeTypeMeta(type);
    const world = options.worldPoint || screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    const reservedNodeIds = new Set(nodesRef.current.map((node) => node.id));
    let index = 0;
    let nodeId = '';
    do {
      nodeSequenceRef.current += 1;
      index = nodeSequenceRef.current;
      nodeId = `${type}-${index}`;
    } while (reservedNodeIds.has(nodeId));
    const typeNodeNumber =
      nodesRef.current.filter((node) => node.type === type).length + 1;
    const sourceNode = options.sourceNode || (options.sourceNodeId ? nodeMap[options.sourceNodeId] : null);
    const inheritedVideoConfig = shouldInheritVideoNodeConfig(sourceNode, type)
      ? getInheritedVideoNodeConfig(sourceNode, modelOptionsByNodeType)
      : null;
    const defaultModelLabel = getNewNodeModelLabel(type, sourceNode, modelOptionsByNodeType);
    const defaultModel = getSelectedModelOption(type, defaultModelLabel, modelOptionsByNodeType);
    const { width, height } = getDefaultNodeSize(type);

    return {
      id: nodeId,
      type,
      title: options.title || (type === 'script' ? `文本节点${typeNodeNumber}` : `${meta.label}节点 ${index}`),
      subtitle: meta.description,
      x: Math.round(world.x - width / 2 + (options.worldPoint ? 0 : index * 12)),
      y: Math.round(world.y - height / 2 + (options.worldPoint ? 0 : index * 8)),
      width,
      height,
      status: options.status || 'idle',
      paramValuesJson: firstObject(options.paramValuesJson),
      modeType: String(options.modeType || '').trim(),
      videoInputMode:
        type === 'video'
          ? String(options.videoInputMode || VIDEO_INPUT_MODE_REFERENCE).trim()
          : '',
      videoModelCapabilityMode:
        type === 'video'
          ? String(
              options.videoModelCapabilityMode ||
                VIDEO_INPUT_MODE_REFERENCE,
            ).trim()
          : '',
      firstFrameAsset:
        type === 'video'
          ? normalizeVideoFrameAsset(
              options.firstFrameAsset,
              VIDEO_INPUT_ROLE_FIRST_FRAME,
            )
          : null,
      endFrameAsset:
        type === 'video'
          ? normalizeVideoFrameAsset(
              options.endFrameAsset,
              VIDEO_INPUT_ROLE_END_FRAME,
            )
          : null,
      model:
        isResourceContainerNodeType(type)
          ? ''
          : type === 'video'
          ? defaultModelLabel
          : type === 'script'
            ? defaultModelLabel
            : type === 'image'
              ? defaultModelLabel
              : type === 'audio'
                ? defaultModelLabel
              : meta.label,
      content: String(options.content ?? ''),
      textPromptContent: String(options.textPromptContent ?? ''),
      durationSeconds: type === 'video' ? inheritedVideoConfig?.durationSeconds ?? MIN_VIDEO_DURATION_SECONDS : '',
      aspectRatio: type === 'image' || type === 'video' ? (inheritedVideoConfig?.aspectRatio ?? defaultModel?.aspectRatios?.[0] ?? '') : '',
      resolution: type === 'image' || type === 'video' ? (inheritedVideoConfig?.resolution ?? defaultModel?.resolutions?.[0] ?? '') : '',
      tags: [meta.label],
      seedanceVirtualAssets: inheritedVideoConfig?.seedanceVirtualAssets ?? [],
      seedanceVirtualAssetId: String(options.seedanceVirtualAssetId || '').trim(),
      seedanceVirtualAssetTargetNodeId: String(options.seedanceVirtualAssetTargetNodeId || '').trim(),
      videoInputRole: String(options.videoInputRole || '').trim(),
      videoInputTargetNodeId: String(options.videoInputTargetNodeId || '').trim(),
      mediaPreviewUrl: String(options.mediaPreviewUrl || '').trim(),
      mediaFileName: String(options.mediaFileName || '').trim(),
      mediaFileSize: Number(options.mediaFileSize) || 0,
      mediaMimeType: String(options.mediaMimeType || '').trim(),
      generationMeta: normalizeGenerationMeta(options.generationMeta),
      pendingGenerationMeta: normalizeGenerationMeta(options.pendingGenerationMeta),
      resourceContentJson: firstObject(options.resourceContentJson),
      connectableTargetTypes:
        options.connectableTargetTypes ??
        inheritedVideoConfig?.connectableTargetTypes ??
        getDefaultConnectableTargetTypes(type),
      groupId: options.groupId || '',
    };
  }

  function addNode(type, options = {}) {
    const sourceNode = options.sourceNodeId ? nodeMap[options.sourceNodeId] : null;
    const nextNode = buildNewNode(type, { ...options, sourceNode });
    setNodes((current) => [...current, nextNode]);
    if (options.sourceNodeId) {
      const normalizedEdge = resolveConnection(sourceNode, nextNode, options.sourceSide || 'right');
      if (
        normalizedEdge &&
        !hasConnectionBetween(edges, normalizedEdge.from, normalizedEdge.to) &&
        !getNewNodeConnectionLimitViolation(sourceNode, type, options.sourceSide || 'right')
      ) {
        edgeSequenceRef.current += 1;
        const edgeId = `edge-${normalizedEdge.from}-${normalizedEdge.to}-${edgeSequenceRef.current}`;
        setEdges((current) => {
          const exists = current.some(
            (edge) =>
              edge.from === normalizedEdge.from &&
              edge.to === normalizedEdge.to &&
              (edge.fromSide || 'right') === normalizedEdge.fromSide &&
              (edge.toSide || 'left') === normalizedEdge.toSide,
          );
          return exists ? current : [...current, { id: edgeId, ...normalizedEdge }];
        });
      }
    }
    selectNodes([nextNode.id]);
    setPromptFocusNodeId(nextNode.id);
    return nextNode;
  }

  function getCanvasMenuAnchor(clientX, clientY) {
    const viewportPoint = getViewportPoint(clientX, clientY);
    return {
      x: viewportPoint.x,
      y: viewportPoint.y,
      worldPoint: screenToWorld(clientX, clientY),
      clientX,
      clientY,
    };
  }

  function closeCanvasMenus() {
    setCanvasNodeMenu(null);
    setCanvasContextMenu(null);
  }

  function handleCanvasDoubleClick(event) {
    if (event.button !== 0 || event.target.closest?.('[data-canvas-ignore="true"]')) {
      return;
    }

    event.preventDefault();
    setConnectionAddMenu(null);
    setCanvasContextMenu(null);
    setCanvasNodeMenu(getCanvasMenuAnchor(event.clientX, event.clientY));
  }

  function handleCanvasContextMenu(event) {
    if (event.target.closest?.('[data-canvas-ignore="true"]')) {
      return;
    }

    event.preventDefault();
    blurActiveEditableElement();
    setConnectionAddMenu(null);
    setCanvasNodeMenu(null);
    setCanvasContextMenu(getCanvasMenuAnchor(event.clientX, event.clientY));
  }

  function handleCanvasItemContextMenu(event, targetKind, targetId) {
    event.preventDefault();
    event.stopPropagation();
    const targetExists =
      targetKind === 'group'
        ? groupsRef.current.some((group) => group.id === targetId)
        : nodesRef.current.some((node) => node.id === targetId);
    if (!targetExists) {
      return;
    }

    blurActiveEditableElement();
    setConnectionAddMenu(null);
    setCanvasNodeMenu(null);
    if (targetKind === 'group') {
      clearSelection();
      setFocusedGroupId(targetId);
    } else {
      selectNodes([targetId], targetId);
      setPromptFocusNodeId('');
      setExpandedPromptNodeId('');
    }
    setCanvasContextMenu({
      ...getCanvasMenuAnchor(event.clientX, event.clientY),
      targetKind,
      targetId,
    });
  }

  function copyCanvasContextTarget() {
    if (!canvasContextMenu?.targetId) {
      return;
    }
    const copied =
      canvasContextMenu.targetKind === 'group'
        ? copyCanvasGroup(canvasContextMenu.targetId)
        : copyCanvasNodesToClipboard([canvasContextMenu.targetId]);
    if (!copied) {
      showConnectionNotice(
        canvasContextMenu.clientX,
        canvasContextMenu.clientY,
        '没有可复制的内容',
      );
    }
    setCanvasContextMenu(null);
  }

  function pasteCanvasClipboardFromContextMenu() {
    if (!canvasContextMenu) {
      return;
    }
    const anchor = canvasContextMenu;
    if (!pasteCopiedCanvasNodes()) {
      showConnectionNotice(
        anchor.clientX,
        anchor.clientY,
        '请先复制节点或分组',
      );
      setCanvasContextMenu(null);
    }
  }

  function deleteCanvasContextTarget() {
    if (!canvasContextMenu?.targetId) {
      return;
    }
    const { targetKind, targetId } = canvasContextMenu;
    setCanvasContextMenu(null);
    if (targetKind === 'group') {
      deleteCanvasGroup(targetId);
      return;
    }
    removeCanvasItems([targetId]);
    clearSelection();
  }

  function createNodeFromCanvasMenu(type) {
    if (!canvasNodeMenu) {
      return;
    }
    addNode(type, {
      worldPoint: canvasNodeMenu.worldPoint,
      empty: true,
    });
    closeCanvasMenus();
  }

  async function createCanvasMediaNodeFromFile(file, anchor) {
    const mediaType = getCanvasMediaNodeType(file);
    if (!mediaType) {
      showConnectionNotice(anchor.clientX, anchor.clientY, '请选择图片或视频文件');
      return;
    }
    if (!isGraphReady || !canvasProjectId) {
      showConnectionNotice(anchor.clientX, anchor.clientY, '画布项目未就绪');
      return;
    }

    const resourceNodeType = getResourceContainerNodeType(mediaType);
    const nextNode = addNode(resourceNodeType, {
      worldPoint: anchor.worldPoint,
      title: file.name || (mediaType === 'video' ? '上传视频' : '上传图片'),
      mediaFileName: file.name || '',
      mediaFileSize: Number(file.size) || 0,
      mediaMimeType: String(file.type || '').trim(),
      empty: true,
    });
    const nextNodes = [...nodesRef.current, nextNode];
    const graphSaved = await saveGraphSnapshotNow(nextNodes, edges);
    if (!graphSaved) {
      showConnectionNotice(anchor.clientX, anchor.clientY, '节点保存失败，请稍后重试上传');
      return;
    }
    await uploadMediaFileToNode(file, nextNode.id, resourceNodeType, anchor);
  }

  function chooseCanvasMediaFile() {
    if (!canvasContextMenu) {
      return;
    }
    canvasMediaUploadAnchorRef.current = canvasContextMenu;
    setCanvasContextMenu(null);
    canvasMediaUploadInputRef.current?.click();
  }

  async function handleCanvasMediaFileChange(event) {
    const input = event.target;
    const file = input.files?.[0];
    const anchor = canvasMediaUploadAnchorRef.current;
    input.value = '';
    canvasMediaUploadAnchorRef.current = null;
    if (!file || !anchor) {
      return;
    }
    await createCanvasMediaNodeFromFile(file, anchor);
  }

  function openCanvasNodeMenuFromContextMenu() {
    if (!canvasContextMenu) {
      return;
    }
    setCanvasNodeMenu(canvasContextMenu);
    setCanvasContextMenu(null);
  }

  async function pasteCanvasMedia() {
    if (!canvasContextMenu) {
      return;
    }

    const anchor = canvasContextMenu;
    setCanvasContextMenu(null);
    if (!navigator.clipboard?.read) {
      showConnectionNotice(anchor.clientX, anchor.clientY, '当前浏览器不支持读取剪贴板媒体');
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const mimeType = clipboardItem.types.find(
          (type) => type.startsWith('image/') || type.startsWith('video/'),
        );
        if (!mimeType) {
          continue;
        }

        const blob = await clipboardItem.getType(mimeType);
        const extension = mimeType.split('/')[1]?.split(/[;+]/)[0] || 'bin';
        const file = new File([blob], `clipboard-${Date.now()}.${extension}`, {
          type: mimeType,
        });
        await createCanvasMediaNodeFromFile(file, anchor);
        return;
      }
      showConnectionNotice(anchor.clientX, anchor.clientY, '剪贴板中没有可用的图片或视频');
    } catch (error) {
      showConnectionNotice(
        anchor.clientX,
        anchor.clientY,
        parseApiErrorMessage(error, '无法读取剪贴板，请检查浏览器权限'),
      );
    }
  }

  function createEmptyCanvasPreset(preset, event) {
    if (!preset || visibleNodes.length > 0 || groups.length > 0) {
      return;
    }

    event?.preventDefault?.();
    event?.stopPropagation?.();

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) {
      return;
    }

    const centerWorld = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const sourceSize = getDefaultNodeSize(preset.sourceType);
    if (!preset.targetType) {
      const sourceNode = buildNewNode(preset.sourceType, {
        worldPoint: centerWorld,
        title: preset.sourceTitle,
        empty: true,
        connectableTargetTypes: preset.sourceConnectableTargetTypes,
      });
      const nextNodes = [sourceNode];

      nodesRef.current = nextNodes;
      edgesRef.current = [];
      groupsRef.current = [];
      setNodes(nextNodes);
      setEdges([]);
      setGroups([]);
      selectNodes([sourceNode.id], sourceNode.id);
      setPromptFocusNodeId(sourceNode.id);
      window.requestAnimationFrame(() => {
        viewportRef.current
          ?.querySelector(`[data-prompt-editor-node-id="${sourceNode.id}"]`)
          ?.focus?.();
      });
      return;
    }

    const targetSize = getDefaultNodeSize(preset.targetType);
    const gap = preset.targetType === 'video' ? 48 : 130;
    const totalWidth = sourceSize.width + gap + targetSize.width;
    const startX = centerWorld.x - totalWidth / 2;
    let sourceNode = buildNewNode(preset.sourceType, {
      worldPoint: {
        x: startX + sourceSize.width / 2,
        y: centerWorld.y,
      },
      title: preset.sourceTitle,
      empty: true,
      connectableTargetTypes: preset.sourceConnectableTargetTypes,
    });
    let targetNode = buildNewNode(preset.targetType, {
      worldPoint: {
        x: startX + sourceSize.width + gap + targetSize.width / 2,
        y: centerWorld.y,
      },
      title: preset.targetTitle,
      empty: true,
      sourceNode,
    });
    if (preset.videoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME) {
      const firstFrameModel = getFirstAvailableVideoModelForCapability(
        targetNode,
        VIDEO_INPUT_MODE_FIRST_FRAME,
        { ignoreCurrentInputs: true },
      );
      if (!firstFrameModel) {
        showNoticeAtEvent(event, '暂无支持首帧的可用模型');
        return;
      }
      sourceNode = {
        ...sourceNode,
        videoInputRole: VIDEO_INPUT_ROLE_FIRST_FRAME,
        videoInputTargetNodeId: targetNode.id,
      };
      targetNode = {
        ...targetNode,
        ...getVideoModelSelectionPatch(targetNode, firstFrameModel),
        modeType: '',
        videoInputMode: VIDEO_INPUT_MODE_FIRST_FRAME,
        videoModelCapabilityMode: VIDEO_INPUT_MODE_FIRST_FRAME,
      };
    }

    const targetPortKey =
      preset.videoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME
        ? VIDEO_INPUT_ROLE_FIRST_FRAME
        : preset.targetPortKey || '';
    const resolvedEdge =
      targetPortKey && preset.targetType === 'video'
        ? normalizeCanvasEdgePorts({
            from: sourceNode.id,
            to: targetNode.id,
            sourcePortKey: isResourceContainerNodeType(sourceNode.type)
              ? 'output'
              : '',
            targetPortKey,
            sortOrder: 0,
          })
        : resolveConnection(sourceNode, targetNode, 'right');

    if (
      preset.targetType === 'video' &&
      preset.videoInputMode !== VIDEO_INPUT_MODE_FIRST_FRAME
    ) {
      const candidateEdges = resolvedEdge ? [resolvedEdge] : [];
      const candidateNodeMap = {
        [sourceNode.id]: sourceNode,
        [targetNode.id]: targetNode,
      };
      const referenceModel =
        getModelOptionsByConnectionAvailability(
          getNodeModelOptions('video', modelOptionsByNodeTypeRef.current),
          candidateEdges,
          candidateNodeMap,
          targetNode,
        ).find(({ modelConnectionViolation }) => !modelConnectionViolation)
          ?.model || null;
      if (!referenceModel) {
        showNoticeAtEvent(event, '暂无支持参考图片的可用模型');
        return;
      }
      sourceNode = {
        ...sourceNode,
        videoInputRole: VIDEO_INPUT_ROLE_REFERENCE_IMAGE,
        videoInputTargetNodeId: targetNode.id,
      };
      targetNode = {
        ...targetNode,
        ...getVideoModelSelectionPatch(targetNode, referenceModel),
        modeType: '',
        videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
        videoModelCapabilityMode: VIDEO_INPUT_MODE_REFERENCE,
      };
    }

    groupSequenceRef.current += 1;
    const groupId = `group-${Date.now()}-${groupSequenceRef.current}`;
    sourceNode = { ...sourceNode, groupId };
    targetNode = { ...targetNode, groupId };
    const groupRegion = getNodeSelectionRegion(
      [sourceNode, targetNode],
      GROUP_CONTENT_PADDING,
    );
    const nextGroup = {
      id: groupId,
      title: preset.label,
      x: Math.round(groupRegion.left),
      y: Math.round(groupRegion.top),
      width: Math.max(
        GROUP_MIN_WIDTH,
        Math.round(groupRegion.right - groupRegion.left),
      ),
      height: Math.max(
        GROUP_MIN_HEIGHT,
        Math.round(groupRegion.bottom - groupRegion.top),
      ),
    };
    const nextNodes = [sourceNode, targetNode];
    let nextEdges = [];
    if (resolvedEdge) {
      edgeSequenceRef.current += 1;
      nextEdges = [{
        id: `edge-${resolvedEdge.from}-${resolvedEdge.to}-${edgeSequenceRef.current}`,
        ...resolvedEdge,
      }];
    }
    const nextGroups = [nextGroup];

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    groupsRef.current = nextGroups;
    setNodes(nextNodes);
    setEdges(nextEdges);
    setGroups(nextGroups);
    const focusNode = preset.focusNode === 'source' ? sourceNode : targetNode;
    selectNodes([focusNode.id], focusNode.id);
    setPromptFocusNodeId(focusNode.id);
    window.requestAnimationFrame(() => {
      viewportRef.current
        ?.querySelector(`[data-prompt-editor-node-id="${focusNode.id}"]`)
        ?.focus?.();
    });
  }

  function createGroupFromSelection(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!selectionRegion || selectedNodeIds.length < 2) {
      return;
    }

    const selectedNodeIdSet = new Set(selectedNodeIds);
    const memberNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id));
    if (memberNodes.length < 2) {
      return;
    }

    const sharedGroupId = getSharedExistingGroupId(memberNodes, groups);
    if (sharedGroupId) {
      clearSelection();
      setFocusedGroupId(sharedGroupId);
      return;
    }

    const mergedSelectionRegion = getNodeSelectionRegion(memberNodes) || selectionRegion;
    const memberNodeIds = new Set(memberNodes.map((node) => node.id));
    const replacedGroupIds = new Set(memberNodes.map((node) => node.groupId).filter(Boolean));
    groupSequenceRef.current += 1;
    const nextGroup = {
      id: `group-${Date.now()}-${groupSequenceRef.current}`,
      title: `分组 ${groupSequenceRef.current}`,
      x: Math.round(mergedSelectionRegion.left),
      y: Math.round(mergedSelectionRegion.top),
      width: Math.max(1, Math.round(mergedSelectionRegion.right - mergedSelectionRegion.left)),
      height: Math.max(1, Math.round(mergedSelectionRegion.bottom - mergedSelectionRegion.top)),
    };

    replacedGroupIds.forEach((groupId) => groupExecutionIdsRef.current.delete(groupId));
    setSubmittingGroupIds((current) =>
      current.filter((groupId) => !replacedGroupIds.has(groupId)),
    );
    setGroups((current) => [
      ...current.filter((group) => !replacedGroupIds.has(group.id)),
      nextGroup,
    ]);
    setNodes((current) =>
      current.map((node) => {
        if (memberNodeIds.has(node.id)) {
          return { ...node, groupId: nextGroup.id };
        }
        if (replacedGroupIds.has(node.groupId)) {
          return { ...node, groupId: '' };
        }
        return node;
      }),
    );
    clearSelection();
    setFocusedGroupId(nextGroup.id);
  }

  function ungroupCanvasGroup(groupId, event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!groupId) {
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.groupId === groupId ? { ...node, groupId: '' } : node,
      ),
    );
    setGroups((current) => current.filter((group) => group.id !== groupId));
    setFocusedGroupId('');
    setDraggingGroupId('');
  }

  function removeCanvasItems(nodeIds = [], edgeIds = []) {
    const nodeIdSet =
      nodeIds instanceof Set ? nodeIds : new Set(nodeIds.filter(Boolean));
    const edgeIdSet =
      edgeIds instanceof Set ? edgeIds : new Set(edgeIds.filter(Boolean));
    if (nodeIdSet.size === 0 && edgeIdSet.size === 0) {
      return false;
    }

    const nextGraph = removeCanvasGraphItems(
      nodesRef.current,
      edgesRef.current,
      nodeIdSet,
      edgeIdSet,
    );
    nodesRef.current = nextGraph.nodes;
    edgesRef.current = nextGraph.edges;
    setNodes(nextGraph.nodes);
    setEdges(nextGraph.edges);

    if (nodeIdSet.has(seedanceLibraryNodeId)) {
      setSeedanceLibraryOpen(false);
      setSeedanceLibraryNodeId('');
    }
    if (nodeIdSet.has(mediaDetailNodeId)) {
      setMediaDetailNodeId('');
    }
    if (nodeIdSet.has(videoFrameExtractor.nodeId)) {
      videoFrameExtractorRef.current?.pause?.();
      videoFrameExtractionInFlightRef.current = false;
      setVideoFrameExtractor(createDefaultVideoFrameExtractorState());
    }
    return true;
  }

  function deleteCanvasGroup(groupId) {
    if (!groupId) {
      return;
    }

    const memberNodeIds = new Set(
      nodesRef.current
        .filter((node) => node.groupId === groupId)
        .map((node) => node.id),
    );

    memberNodeIds.forEach((nodeId) => clearNodeRunSyncTimer(nodeId));
    groupExecutionIdsRef.current.delete(groupId);
    removeCanvasItems(memberNodeIds);
    setGroups((current) => current.filter((group) => group.id !== groupId));
    setGeneratingNodeIds((current) => current.filter((nodeId) => !memberNodeIds.has(nodeId)));
    setGenerationFailedNodeIds((current) => current.filter((nodeId) => !memberNodeIds.has(nodeId)));
    setSubmittingGroupIds((current) => current.filter((item) => item !== groupId));
    setDraggingGroupId('');
    setGroupDropTargetId('');
    setSeedanceLibraryOpen(false);
    setSeedanceLibraryNodeId('');
    clearSelection();
  }

  function addEdge(fromNodeId, toNodeId, fromSide = 'right', noticePoint = null) {
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      return;
    }

    const sourceNode = nodeMap[fromNodeId];
    const targetNode = nodeMap[toNodeId];
    if (hasConnectionBetween(edges, fromNodeId, toNodeId)) {
      return;
    }

    const resolvedEdge = resolveConnection(sourceNode, targetNode, fromSide);
    if (!resolvedEdge) {
      if (noticePoint) {
        showConnectionNotice(noticePoint.clientX, noticePoint.clientY);
      }
      return;
    }

    const resolvedSourceNode = nodeMap[resolvedEdge.from];
    const resolvedTargetNode = nodeMap[resolvedEdge.to];
    const normalizedEdge = normalizeCanvasEdgePorts({
      ...resolvedEdge,
      sourcePortKey: isResourceContainerNodeType(resolvedSourceNode?.type)
        ? 'output'
        : '',
      targetPortKey:
        resolvedTargetNode?.type === 'video'
          ? getReferenceTargetPortKey(resolvedSourceNode)
          : '',
    });
    const shouldResetStructuredVideoInputs =
      resolvedTargetNode?.type === 'video' &&
      resolvedTargetNode.videoInputMode !== VIDEO_INPUT_MODE_REFERENCE;
    const validationEdges = shouldResetStructuredVideoInputs
      ? edges.filter(
          (edge) =>
            edge.to !== resolvedTargetNode.id ||
            !isInternalVideoFrameEdge(edge, nodeMap),
        )
      : edges;
    const limitViolation = getConnectionInputLimitViolation(
      validationEdges,
      nodeMap,
      resolvedSourceNode,
      resolvedTargetNode,
      getNodeSelectedModelOption(resolvedTargetNode),
    );
    if (limitViolation) {
      if (noticePoint) {
        showConnectionNotice(noticePoint.clientX, noticePoint.clientY, limitViolation);
      }
      return;
    }

    if (shouldResetStructuredVideoInputs) {
      removeInternalVideoFrameRoles(resolvedTargetNode.id, [
        VIDEO_INPUT_ROLE_FIRST_FRAME,
        VIDEO_INPUT_ROLE_END_FRAME,
      ]);
    }

    edgeSequenceRef.current += 1;
    const edgeId = `edge-${normalizedEdge.from}-${normalizedEdge.to}-${edgeSequenceRef.current}`;
    if (resolvedTargetNode?.type === 'video') {
      setNodes((current) =>
        current.map((node) =>
          node.id === resolvedTargetNode.id
            ? {
                ...node,
                modeType: '',
                videoInputMode: VIDEO_INPUT_MODE_REFERENCE,
                videoModelCapabilityMode: VIDEO_INPUT_MODE_REFERENCE,
              }
            : node,
        ),
      );
    }
    setEdges((current) => {
      let referenceOrder = 0;
      const normalizedCurrent =
        resolvedTargetNode?.type === 'video'
          ? current.map((edge) => {
              if (edge.to !== resolvedTargetNode.id) {
                return edge;
              }
              const referenceEdge = {
                ...edge,
                sourcePortKey:
                  edge.sourcePortKey ||
                  (isResourceContainerNodeType(nodeMap[edge.from]?.type)
                    ? 'output'
                    : ''),
                targetPortKey: getReferenceTargetPortKey(nodeMap[edge.from]),
                sortOrder: referenceOrder,
              };
              referenceOrder += 1;
              return referenceEdge;
            })
          : current;
      const exists = current.some(
        (edge) =>
          edge.from === normalizedEdge.from &&
          edge.to === normalizedEdge.to &&
          (edge.fromSide || 'right') === normalizedEdge.fromSide &&
          (edge.toSide || 'left') === normalizedEdge.toSide,
      );
      return exists
        ? normalizedCurrent
        : [
            ...normalizedCurrent,
            {
              id: edgeId,
              ...normalizedEdge,
              ...(resolvedTargetNode?.type === 'video'
                ? { sortOrder: referenceOrder }
                : {}),
            },
          ];
    });
  }

  function removeSelected() {
    const edgeIdsToRemove = selectedEdgeIds.length > 0 ? selectedEdgeIds : selectedEdgeId ? [selectedEdgeId] : [];
    const nodeIdsToRemove = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    if (nodeIdsToRemove.length === 0 && edgeIdsToRemove.length === 0) {
      return;
    }

    removeCanvasItems(nodeIdsToRemove, edgeIdsToRemove);
    clearSelection();
  }

  function handleCanvasPointerDown(event) {
    if ((event.button !== 0 && event.button !== 1) || event.target.closest?.('[data-canvas-ignore="true"]')) {
      return;
    }

    blurActiveEditableElement();
    setConnectionAddMenu(null);
    event.preventDefault();
    const viewportPoint = getViewportPoint(event.clientX, event.clientY);
    const shouldPan = event.button === 1 || event.altKey || isSpacePressed;
    if (shouldPan) {
      interactionRef.current = {
        type: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    interactionRef.current = {
      type: 'select',
      startX: viewportPoint.x,
      startY: viewportPoint.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({
      startX: viewportPoint.x,
      startY: viewportPoint.y,
      currentX: viewportPoint.x,
      currentY: viewportPoint.y,
    });
    clearSelection();
  }

  function handleGroupPointerDown(event, groupId) {
    if (event.button !== 0) {
      return;
    }

    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    const memberNodeOrigins = nodes.reduce((map, node) => {
      if (node.groupId === groupId) {
        map[node.id] = { x: node.x, y: node.y };
      }
      return map;
    }, {});

    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: 'drag-group',
      groupId,
      startX: event.clientX,
      startY: event.clientY,
      originGroup: { x: group.x, y: group.y },
      memberNodeOrigins,
      hasMoved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingGroupId(groupId);
    setConnectionAddMenu(null);
    clearSelection();
    setFocusedGroupId(groupId);
  }

  function handleGroupResizePointerDown(event, groupId, corner) {
    if (event.button !== 0) {
      return;
    }

    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    const memberNodes = nodes.filter((node) => node.groupId === groupId);
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: 'resize-group',
      groupId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      originGroup: {
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
      },
      contentBounds: getNodeSelectionRegion(memberNodes, GROUP_CONTENT_PADDING),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingGroupId(groupId);
    setFocusedGroupId(groupId);
  }

  function handleNodePointerDown(event, nodeId) {
    if (event.button !== 0) {
      return;
    }

    const node = nodeMap[nodeId];
    if (!node) {
      return;
    }

    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      const isSelected = selectedNodeIds.includes(nodeId);
      const nextNodeIds = isSelected
        ? selectedNodeIds.filter((item) => item !== nodeId)
        : [...selectedNodeIds, nodeId];
      selectNodes(nextNodeIds, isSelected ? nextNodeIds[0] : nodeId);
      setPromptFocusNodeId('');
      setExpandedPromptNodeId('');
      return;
    }

    const dragNodeIds = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
    const originByNodeId = dragNodeIds.reduce((map, currentNodeId) => {
      const currentNode = nodeMap[currentNodeId];
      if (currentNode) {
        map[currentNodeId] = { x: currentNode.x, y: currentNode.y };
      }
      return map;
    }, {});

    interactionRef.current = {
      type: 'drag-nodes',
      nodeIds: Object.keys(originByNodeId),
      startX: event.clientX,
      startY: event.clientY,
      originByNodeId,
      originGroupByNodeId: dragNodeIds.reduce((map, currentNodeId) => {
        map[currentNodeId] = nodeMap[currentNodeId]?.groupId || '';
        return map;
      }, {}),
      focusNodeId: nodeId,
      hasMoved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!selectedNodeIds.includes(nodeId)) {
      selectNodes([nodeId], nodeId);
    } else {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId('');
      setSelectedEdgeIds([]);
    }
  }

  function handlePortPointerDown(event, nodeId, side) {
    event.stopPropagation();
    const node = nodeMap[nodeId];
    if (!node) {
      return;
    }

    interactionRef.current = {
      type: 'connect',
      nodeId,
      side,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setConnectionAddMenu(null);
    setConnectingFrom({ nodeId, side });
    setDraftPoint(getNodePortPosition(node, side));
  }

  function handlePortZonePointerMove(event) {
    if (interactionRef.current?.type === 'connect') {
      return;
    }

    const zoneRect = event.currentTarget.getBoundingClientRect();
    if (!zoneRect.width || !zoneRect.height) {
      return;
    }

    const localX =
      (event.clientX - zoneRect.left) *
      (event.currentTarget.offsetWidth / zoneRect.width);
    const localY =
      (event.clientY - zoneRect.top) *
      (event.currentTarget.offsetHeight / zoneRect.height);
    const clampedX = Math.min(event.currentTarget.offsetWidth, Math.max(0, localX));
    const clampedY = Math.min(event.currentTarget.offsetHeight, Math.max(0, localY));
    event.currentTarget.dataset.portActive = 'true';
    event.currentTarget.dataset.portTracking = 'true';
    event.currentTarget.style.setProperty('--port-x', `${clampedX}px`);
    event.currentTarget.style.setProperty('--port-y', `${clampedY}px`);
  }

  function handlePortZonePointerLeave(event) {
    delete event.currentTarget.dataset.portActive;
    delete event.currentTarget.dataset.portTracking;
    event.currentTarget.style.removeProperty('--port-x');
    event.currentTarget.style.removeProperty('--port-y');
  }

  function handlePortPointerUp(event, nodeId) {
    if (!connectingFrom || connectingFrom.nodeId === nodeId) {
      return;
    }

    event.stopPropagation();
    addEdge(connectingFrom.nodeId, nodeId, connectingFrom.side, event);
    setConnectingFrom(null);
    setDraftPoint(null);
    interactionRef.current = null;
  }

  function handlePointerMove(event) {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }

    if (interaction.type === 'pan') {
      setViewport((current) => ({
        ...current,
        x: interaction.originX + event.clientX - interaction.startX,
        y: interaction.originY + event.clientY - interaction.startY,
      }));
      return;
    }

    if (interaction.type === 'drag-nodes') {
      const rawDeltaX = event.clientX - interaction.startX;
      const rawDeltaY = event.clientY - interaction.startY;
      if (!interaction.hasMoved && Math.hypot(rawDeltaX, rawDeltaY) > 4) {
        interaction.hasMoved = true;
        setSelectionRegion(null);
        setDraggingNodeIds(interaction.nodeIds);
      }
      const deltaX = (event.clientX - interaction.startX) / viewport.zoom;
      const deltaY = (event.clientY - interaction.startY) / viewport.zoom;
      const draggedNodeIds = new Set(interaction.nodeIds);
      const movingNodes = nodes
        .filter((node) => draggedNodeIds.has(node.id))
        .map((node) => {
          const origin = interaction.originByNodeId[node.id];
          const nextX = origin.x + deltaX;
          const nextY = origin.y + deltaY;
          return {
            ...node,
            x: isSnapEnabled ? snapToGrid(nextX) : Math.round(nextX),
            y: isSnapEnabled ? snapToGrid(nextY) : Math.round(nextY),
          };
        });

      if (isSnapEnabled && visibleNodes.length >= 2) {
        setAlignmentGuides(buildAlignmentGuides(
          movingNodes,
          visibleNodes.filter((node) => !draggedNodeIds.has(node.id)),
        ));
      } else {
        setAlignmentGuides({ vertical: [], horizontal: [] });
      }

      const movingNodeMap = movingNodes.reduce((map, node) => ({ ...map, [node.id]: node }), {});
      const focusedMovingNode = movingNodeMap[interaction.focusNodeId] || movingNodes[0];
      const originalFocusedGroupId = interaction.originGroupByNodeId?.[interaction.focusNodeId] || '';
      setGroupDropTargetId(
        resolveNodeDropGroup(groups, focusedMovingNode, originalFocusedGroupId)?.id || '',
      );
      setNodes((current) =>
        current.map((node) => {
          return movingNodeMap[node.id] || node;
        }),
      );
      return;
    }

    if (interaction.type === 'drag-group') {
      const rawDeltaX = event.clientX - interaction.startX;
      const rawDeltaY = event.clientY - interaction.startY;
      if (!interaction.hasMoved && Math.hypot(rawDeltaX, rawDeltaY) > 4) {
        interaction.hasMoved = true;
        setDraggingNodeIds(Object.keys(interaction.memberNodeOrigins));
      }

      const deltaX = rawDeltaX / viewport.zoom;
      const deltaY = rawDeltaY / viewport.zoom;
      const rawGroupX = interaction.originGroup.x + deltaX;
      const rawGroupY = interaction.originGroup.y + deltaY;
      const nextGroupX = isSnapEnabled ? snapToGrid(rawGroupX) : Math.round(rawGroupX);
      const nextGroupY = isSnapEnabled ? snapToGrid(rawGroupY) : Math.round(rawGroupY);
      const appliedDeltaX = nextGroupX - interaction.originGroup.x;
      const appliedDeltaY = nextGroupY - interaction.originGroup.y;

      setGroups((current) =>
        current.map((group) =>
          group.id === interaction.groupId
            ? { ...group, x: nextGroupX, y: nextGroupY }
            : group,
        ),
      );
      setNodes((current) =>
        current.map((node) => {
          const origin = interaction.memberNodeOrigins[node.id];
          if (!origin) {
            return node;
          }
          return {
            ...node,
            x: origin.x + appliedDeltaX,
            y: origin.y + appliedDeltaY,
          };
        }),
      );
      return;
    }

    if (interaction.type === 'resize-group') {
      const deltaX = (event.clientX - interaction.startX) / viewport.zoom;
      const deltaY = (event.clientY - interaction.startY) / viewport.zoom;
      const originLeft = interaction.originGroup.x;
      const originTop = interaction.originGroup.y;
      const originRight = originLeft + interaction.originGroup.width;
      const originBottom = originTop + interaction.originGroup.height;
      const contentBounds = interaction.contentBounds;
      let left = originLeft;
      let top = originTop;
      let right = originRight;
      let bottom = originBottom;

      if (interaction.corner.includes('left')) {
        const candidate = originLeft + deltaX;
        const snappedCandidate = isSnapEnabled ? snapToGrid(candidate) : Math.round(candidate);
        const maxLeft = Math.min(
          originRight - GROUP_MIN_WIDTH,
          contentBounds?.left ?? Number.POSITIVE_INFINITY,
        );
        left = Math.min(snappedCandidate, maxLeft);
      }
      if (interaction.corner.includes('right')) {
        const candidate = originRight + deltaX;
        const snappedCandidate = isSnapEnabled ? snapToGrid(candidate) : Math.round(candidate);
        const minRight = Math.max(
          originLeft + GROUP_MIN_WIDTH,
          contentBounds?.right ?? Number.NEGATIVE_INFINITY,
        );
        right = Math.max(snappedCandidate, minRight);
      }
      if (interaction.corner.includes('top')) {
        const candidate = originTop + deltaY;
        const snappedCandidate = isSnapEnabled ? snapToGrid(candidate) : Math.round(candidate);
        const maxTop = Math.min(
          originBottom - GROUP_MIN_HEIGHT,
          contentBounds?.top ?? Number.POSITIVE_INFINITY,
        );
        top = Math.min(snappedCandidate, maxTop);
      }
      if (interaction.corner.includes('bottom')) {
        const candidate = originBottom + deltaY;
        const snappedCandidate = isSnapEnabled ? snapToGrid(candidate) : Math.round(candidate);
        const minBottom = Math.max(
          originTop + GROUP_MIN_HEIGHT,
          contentBounds?.bottom ?? Number.NEGATIVE_INFINITY,
        );
        bottom = Math.max(snappedCandidate, minBottom);
      }

      if (contentBounds) {
        left = Math.min(left, contentBounds.left);
        top = Math.min(top, contentBounds.top);
        right = Math.max(right, contentBounds.right);
        bottom = Math.max(bottom, contentBounds.bottom);
      }

      setGroups((current) =>
        current.map((group) =>
          group.id === interaction.groupId
            ? {
                ...group,
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
              }
            : group,
        ),
      );
      return;
    }

    if (interaction.type === 'resize-node') {
      const deltaX = (event.clientX - interaction.startX) / viewport.zoom;
      const deltaY = (event.clientY - interaction.startY) / viewport.zoom;
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== interaction.nodeId) {
            return node;
          }

          return {
            ...node,
            width: Math.max(TEXT_NODE_MIN_WIDTH, Math.round(interaction.originWidth + deltaX)),
            height: Math.max(TEXT_NODE_MIN_HEIGHT, Math.round(interaction.originHeight + deltaY)),
          };
        }),
      );
      return;
    }

    if (interaction.type === 'select') {
      const viewportPoint = getViewportPoint(event.clientX, event.clientY);
      const nextSelectionBox = {
        startX: interaction.startX,
        startY: interaction.startY,
        currentX: viewportPoint.x,
        currentY: viewportPoint.y,
      };
      const selectionRect = getSelectionWorldRect(nextSelectionBox, viewport);
      setSelectionBox(nextSelectionBox);
      selectCanvasItems(
        visibleNodes.filter((node) => doesNodeIntersectRect(node, selectionRect)).map((node) => node.id),
        visibleEdges
          .filter((edge) => doesEdgeIntersectRect(edge, selectionRect, nodeMap))
          .map((edge) => edge.id),
      );
      return;
    }

    if (interaction.type === 'connect') {
      const point = screenToWorld(event.clientX, event.clientY);
      const sourceNode = nodeMap[interaction.nodeId];
      const targetNode = findNodeAtPoint(visibleNodes, point, interaction.nodeId);
      const normalizedEdge = targetNode ? resolveConnection(sourceNode, targetNode, interaction.side) : null;
      const limitViolation = normalizedEdge ? getConnectionLimitViolation(normalizedEdge) : null;
      setDraftPoint(point);
      if (targetNode && hasConnectionBetween(edges, interaction.nodeId, targetNode.id)) {
        setConnectionNotice(null);
        setBlockedConnectionTargetId(targetNode.id);
      } else if (targetNode && (!normalizedEdge || limitViolation)) {
        setBlockedConnectionTargetId('');
        showConnectionNotice(event.clientX, event.clientY, limitViolation || undefined);
      } else {
        setBlockedConnectionTargetId('');
        if (connectionNotice) {
          setConnectionNotice(null);
        }
      }
    }
  }

  function applyDraggedNodeGroupChanges(interaction) {
    if (!interaction?.hasMoved || !Array.isArray(interaction.nodeIds) || interaction.nodeIds.length === 0) {
      return;
    }

    const draggedNodeIdSet = new Set(interaction.nodeIds);
    const nextGroupByNodeId = new Map();
    const droppedNodesByGroupId = new Map();
    const detachedNodeIds = new Set();

    nodes.forEach((node) => {
      if (!draggedNodeIdSet.has(node.id)) {
        return;
      }

      const originalGroupId = interaction.originGroupByNodeId?.[node.id] || '';
      const nextGroupId = resolveNodeDropGroup(groups, node, originalGroupId)?.id || '';
      nextGroupByNodeId.set(node.id, nextGroupId);
      if (nextGroupId) {
        const groupNodes = droppedNodesByGroupId.get(nextGroupId) || [];
        groupNodes.push(node);
        droppedNodesByGroupId.set(nextGroupId, groupNodes);
      }
      if (originalGroupId && nextGroupId !== originalGroupId) {
        detachedNodeIds.add(node.id);
      }
    });

    setNodes((current) =>
      current.map((node) => {
        if (!nextGroupByNodeId.has(node.id)) {
          return node;
        }
        const nextGroupId = nextGroupByNodeId.get(node.id);
        return node.groupId === nextGroupId ? node : { ...node, groupId: nextGroupId };
      }),
    );

    if (droppedNodesByGroupId.size > 0) {
      setGroups((current) =>
        current.map((group) =>
          expandGroupToContainNodes(
            group,
            droppedNodesByGroupId.get(group.id) || [],
          ),
        ),
      );
    }

    if (detachedNodeIds.size > 0) {
      setEdges((current) =>
        current.filter(
          (edge) => !detachedNodeIds.has(edge.from) && !detachedNodeIds.has(edge.to),
        ),
      );
      setSelectedEdgeId('');
      setSelectedEdgeIds([]);
    }
  }

  function handlePointerUp(event) {
    const interaction = interactionRef.current;
    let nextConnectionAddMenu = null;

    if (interaction?.type === 'connect') {
      const point = screenToWorld(event.clientX, event.clientY);
      const targetNode = findNodeAtPoint(visibleNodes, point, interaction.nodeId);

      if (targetNode) {
        addEdge(interaction.nodeId, targetNode.id, interaction.side, event);
      } else {
        const viewportPoint = getViewportPoint(event.clientX, event.clientY);
        nextConnectionAddMenu = {
          x: viewportPoint.x,
          y: viewportPoint.y,
          worldPoint: point,
          sourceNodeId: interaction.nodeId,
          sourceSide: interaction.side,
        };
      }
    }

    if (interaction?.type === 'drag-nodes' && interaction.focusNodeId) {
      setPromptFocusNodeId(interaction.focusNodeId);
      applyDraggedNodeGroupChanges(interaction);
    }

    if (interaction?.type === 'select') {
      const viewportPoint = getViewportPoint(event.clientX, event.clientY);
      const finalSelectionBox = {
        startX: interaction.startX,
        startY: interaction.startY,
        currentX: viewportPoint.x,
        currentY: viewportPoint.y,
      };
      const normalizedBox = normalizeSelectionBox(finalSelectionBox);
      const pointerSelectionRegion = getSelectionWorldRect(finalSelectionBox, viewport);
      if (
        normalizedBox.width >= MIN_SELECTION_REGION_SIZE &&
        normalizedBox.height >= MIN_SELECTION_REGION_SIZE
      ) {
        const selectedNodes = visibleNodes.filter((node) => doesNodeIntersectRect(node, pointerSelectionRegion));
        const selectedEdges = visibleEdges.filter((edge) =>
          doesEdgeIntersectRect(edge, pointerSelectionRegion, nodeMap),
        );
        const sharedGroupId = getSharedExistingGroupId(selectedNodes, groups);
        if (sharedGroupId) {
          clearSelection();
          setFocusedGroupId(sharedGroupId);
        } else {
          setSelectionRegion(getNodeSelectionRegion(selectedNodes));
          selectCanvasItems(
            selectedNodes.map((node) => node.id),
            selectedEdges.map((edge) => edge.id),
          );
        }
      } else {
        setSelectionRegion(null);
      }
    }

    interactionRef.current = null;
    setDraggingNodeIds([]);
    setConnectionNotice(null);
    setBlockedConnectionTargetId('');
    setConnectingFrom(null);
    setDraftPoint(null);
    setConnectionAddMenu(nextConnectionAddMenu);
    setSelectionBox(null);
    setGroupDropTargetId('');
    setDraggingGroupId('');
    setAlignmentGuides({ vertical: [], horizontal: [] });
  }

  function changeZoom(delta) {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAt((rect?.left || 0) + (rect?.width || window.innerWidth) / 2, (rect?.top || 0) + (rect?.height || window.innerHeight) / 2, delta);
  }

  function fitView() {
    fitNodesIntoView();
  }

  function fitNodesIntoView() {
    const rect = viewportRef.current?.getBoundingClientRect();
    const width = rect?.width || viewportSize.width || window.innerWidth;
    const height = rect?.height || viewportSize.height || window.innerHeight;
    setViewport(getFittedViewportForNodes(visibleNodes, width, height));
  }

  async function runCanvasGroup(groupId, event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (
      !canvasProjectId ||
      !isGraphReady ||
      isRunningWorkflow ||
      groupExecutionIdsRef.current.has(groupId)
    ) {
      return;
    }

    const targetNodes = nodes.filter((node) => node.groupId === groupId);
    if (
      targetNodes.length === 0 ||
      targetNodes.some(
        (node) =>
          generatingNodeIds.includes(node.id) ||
          isActiveGenerationStatus(node.generationStatus || node.status),
      )
    ) {
      return;
    }

    groupExecutionIdsRef.current.add(groupId);
    setSubmittingGroupIds((current) =>
      current.includes(groupId) ? current : [...current, groupId],
    );
    hidePointsTip(event?.currentTarget || pointsTipTargetRef.current);
    const noticePoint = {
      clientX: event?.clientX || window.innerWidth / 2,
      clientY: event?.clientY || 96,
    };
    const targetNodeIds = targetNodes.map((node) => node.id);
    const targetNodeIdSet = new Set(targetNodeIds);
    let workflowRunStarted = false;
    let nodesQueued = false;

    try {
      const canRun = await canRunNodeSetWithPoints(targetNodes, event, '整组执行');
      if (!canRun) {
        return;
      }

      const graphSaved = await saveGraphSnapshotNow(nodes, edges);
      if (!graphSaved) {
        throw new Error('画布保存失败，暂时无法执行当前分组');
      }

      clearWorkflowRunSyncTimer();
      setIsRunningWorkflow(true);
      setGeneratingNodeIds((current) =>
        Array.from(new Set([...current, ...targetNodeIds])),
      );
      setGenerationFailedNodeIds((current) =>
        current.filter((nodeId) => !targetNodeIdSet.has(nodeId)),
      );
      setNodes((current) =>
        current.map((node) =>
          targetNodeIdSet.has(node.id)
            ? {
                ...node,
                status: 'queued',
                generationStatus: 'queued',
                generationRunId: '',
                ...(['image', 'video'].includes(node.type)
                  ? {
                      pendingGenerationMeta: buildGenerationMetaSnapshot(
                        node,
                        edgesRef.current,
                        current,
                      ),
                    }
                  : {}),
              }
            : node,
        ),
      );
      nodesQueued = true;

      const result = await freeCanvasApi.runGroup(canvasProjectId, groupId, {
        request_id: createGroupRunRequestId(),
        params_override: {},
      });
      const workflowRunId = getWorkflowRunId(result);
      if (!workflowRunId) {
        throw new Error('服务端未返回分组运行任务 ID');
      }

      workflowRunStarted = true;
      await refreshPointsAfterGeneration();
      applyWorkflowRunSnapshot(result, true, targetNodeIds);
      await syncWorkflowRunResult(
        canvasProjectId,
        workflowRunId,
        true,
        targetNodeIds,
        groupId,
      );
    } catch (error) {
      workflowRunStarted = false;
      clearWorkflowRunSyncTimer();
      setIsRunningWorkflow(false);
      if (nodesQueued) {
        setGeneratingNodeIds((current) =>
          current.filter((nodeId) => !targetNodeIdSet.has(nodeId)),
        );
        setGenerationFailedNodeIds((current) =>
          Array.from(new Set([...current, ...targetNodeIds])),
        );
        setNodes((current) =>
          current.map((node) =>
            targetNodeIdSet.has(node.id)
              ? {
                  ...node,
                  status: 'failed',
                  generationStatus: 'failed',
                  generationRunId: '',
                  pendingGenerationMeta: normalizeGenerationMeta(null),
                }
              : node,
          ),
        );
      }
      showConnectionNotice(
        noticePoint.clientX,
        noticePoint.clientY,
        parseApiErrorMessage(error, '整组执行失败，请稍后重试'),
      );
    } finally {
      if (!workflowRunStarted) {
        groupExecutionIdsRef.current.delete(groupId);
        setSubmittingGroupIds((current) => current.filter((item) => item !== groupId));
      }
    }
  }

  async function runWorkflow(event) {
    if (!canvasProjectId || isRunningWorkflow) {
      return;
    }
    hidePointsTip(event?.currentTarget || pointsTipTargetRef.current);

    const canRun = await canRunWorkflowWithPoints(event);
    if (!canRun) {
      return;
    }

    await saveGraphSnapshotNow(nodes, edges);

    clearAllNodeRunSyncTimers();
    clearWorkflowRunSyncTimer();
    setIsRunningWorkflow(true);
    setGenerationFailedNodeIds([]);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        status: 'queued',
        generationStatus: 'queued',
        ...(['image', 'video'].includes(node.type)
          ? {
              pendingGenerationMeta: buildGenerationMetaSnapshot(
                node,
                edgesRef.current,
                current,
              ),
            }
          : {}),
      })),
    );

    try {
      const result = await freeCanvasApi.runWorkflow(canvasProjectId, {
        request_id: `${sessionIdRef.current}-workflow-${Date.now()}`,
        params_override: {},
      });
      const workflowRunId = getWorkflowRunId(result);
      if (!workflowRunId) {
        throw new Error('missing workflow run id');
      }

      await refreshPointsAfterGeneration();
      applyWorkflowRunSnapshot(result, true);
      await syncWorkflowRunResult(canvasProjectId, workflowRunId, true);
    } catch {
      clearWorkflowRunSyncTimer();
      setIsRunningWorkflow(false);
      setGeneratingNodeIds([]);
      setNodes((current) =>
        current.map((node) =>
          isActiveGenerationStatus(node.status)
            ? {
                ...node,
                status: 'failed',
                generationStatus: 'failed',
                pendingGenerationMeta: normalizeGenerationMeta(null),
              }
            : node,
        ),
      );
    }
  }


  return (
    <main
      className={styles.page}
      onMouseOver={handlePointsTipMouseOver}
      onMouseOut={handlePointsTipMouseOut}
      onFocus={handlePointsTipFocus}
      onBlur={handlePointsTipBlur}
    >
      <header className={styles.topbar}>
        <div className={styles.projectIdentity}>
          <button className={styles.iconButton} type="button" onClick={onBackHome} aria-label="返回创作首页">
            ←
          </button>
          <div className={styles.projectIdentityContent}>
            {isProjectNameEditing ? (
              <input
                className={styles.projectNameInput}
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.target.value)}
                onBlur={commitProjectNameEdit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitProjectNameEdit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelProjectNameEdit();
                  }
                }}
                aria-label="修改项目名称"
                maxLength={128}
                autoFocus
              />
            ) : (
              <button
                className={styles.projectNameButton}
                type="button"
                title={`${projectDisplayName}，点击修改名称`}
                aria-label={`${projectDisplayName}，点击修改名称`}
                onClick={beginProjectNameEdit}
              >
                {projectDisplayName}
              </button>
            )}
            <span>可视化编排项目生产链路</span>
          </div>
        </div>

        <div className={styles.statusStrip} aria-label="工作流状态">
          <span>{visibleNodes.length} 个节点</span>
          <span>{visibleEdges.length} 条连线</span>
          <span>{runningNodeCount} 个任务运行中</span>
        </div>

        <nav className={styles.topActions} aria-label="工作流操作">
          <button className={styles.secondaryButton} type="button" onClick={onEnterCreation}>
            创作页
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={removeSelected}
            disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0 && !selectedEdgeId}
          >
            删除选中
          </button>
          <span className={styles.workflowPointsBadge}>
            <small>可用积分</small>
            <strong>{availablePoints || '--'}</strong>
          </span>
          {SHOW_GLOBAL_WORKFLOW_RUN_ACTION ? (
            <button
              className={`${styles.primaryButton} ${styles.pointsTipButton}`}
              type="button"
              data-points-tip={!isRunningWorkflow && isGraphReady && canvasProjectId ? getWorkflowPointsQuoteText() : undefined}
              onClick={runWorkflow}
              disabled={!isGraphReady || !canvasProjectId || isRunningWorkflow}
            >
              运行工作流
            </button>
          ) : null}
        </nav>
      </header>

      <section
        ref={viewportRef}
        className={`${styles.canvasViewport} ${isSpacePressed ? styles.canvasViewportSpacePanning : ''}`}
        style={{
          '--canvas-x': `${viewport.x}px`,
          '--canvas-y': `${viewport.y}px`,
          '--canvas-zoom': viewport.zoom,
        }}
        aria-label="工作流画布"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleCanvasContextMenu}
      >
        <input
          ref={canvasMediaUploadInputRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={handleCanvasMediaFileChange}
        />
        <div
          className={`${styles.canvasAddMenu} ${isAddMenuOpen ? styles.canvasAddMenuOpen : ''}`}
          data-canvas-ignore="true"
          onMouseLeave={scheduleAddMenuClose}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              scheduleAddMenuClose();
            }
          }}
        >
          <button
            className={styles.canvasAddButton}
            type="button"
            aria-label="添加节点"
            aria-expanded={isAddMenuOpen}
            onMouseEnter={openAddMenu}
            onFocus={openAddMenu}
          />
          <div
            className={styles.canvasAddPopover}
            role="menu"
            aria-label="添加节点"
            aria-hidden={!isAddMenuOpen}
            onMouseEnter={openAddMenu}
          >
            <strong>添加节点</strong>
            <div className={styles.canvasAddOptions}>
              {QUICK_ADD_NODE_TYPES.map((item) => (
                <button
                  key={item.type}
                  className={styles.canvasAddOption}
                  type="button"
                  role="menuitem"
                  tabIndex={isAddMenuOpen ? 0 : -1}
                  onClick={() => {
                    addNode(item.type);
                    setIsAddMenuOpen(false);
                  }}
                >
                  <span aria-hidden>{item.icon}</span>
                  <b>{item.label}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
        {isGraphReady && visibleNodes.length === 0 && groups.length === 0 ? (
          <div
            className={styles.emptyCanvasPresets}
            data-canvas-ignore="true"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div className={styles.emptyCanvasHint}>
              <span aria-hidden>⌁</span>
              <strong>选择一种生成方式，自动创建对应节点</strong>
            </div>
            <div className={styles.emptyCanvasPresetGrid}>
              {EMPTY_CANVAS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`${styles.emptyCanvasPresetButton} ${styles[`emptyCanvasPresetButton_${preset.tone}`] || ''}`}
                  type="button"
                  onClick={(event) => createEmptyCanvasPreset(preset, event)}
                >
                  <span
                    className={`${styles.emptyCanvasPresetIcon} ${styles[`emptyCanvasPresetIcon_${preset.iconType || preset.sourceType}`] || ''}`}
                    aria-hidden
                  />
                  <span>
                    <strong>{preset.label}</strong>
                    <small>{preset.description}</small>
                  </span>
                  <i aria-hidden>→</i>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {canvasNodeMenu ? (
          <div
            className={`${styles.connectionAddMenu} ${styles.canvasNodeMenu}`}
            data-canvas-ignore="true"
            data-canvas-menu="true"
            role="menu"
            aria-label="添加上下文"
            style={{
              left: Math.max(
                12,
                Math.min(canvasNodeMenu.x, Math.max(12, viewportSize.width - 228)),
              ),
              top: Math.max(
                12,
                Math.min(canvasNodeMenu.y, Math.max(12, viewportSize.height - 196)),
              ),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <strong>添加上下文</strong>
            <div className={styles.connectionAddOptions}>
              {QUICK_ADD_NODE_TYPES.map((item) => (
                <button
                  key={item.type}
                  className={styles.connectionAddOption}
                  type="button"
                  role="menuitem"
                  onClick={() => createNodeFromCanvasMenu(item.type)}
                >
                  <span
                    className={`${styles.connectionAddOptionIcon} ${styles[`connectionAddOptionIcon_${item.type}`] || ''}`}
                    aria-hidden
                  />
                  <b>{item.label}</b>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {canvasContextMenu ? (
          <div
            className={styles.canvasContextMenu}
            data-canvas-ignore="true"
            data-canvas-menu="true"
            role="menu"
            aria-label={
              canvasContextMenu.targetKind === 'group'
                ? '分组操作'
                : canvasContextMenu.targetKind === 'node'
                  ? '节点操作'
                  : '画布操作'
            }
            style={{
              left: Math.max(
                12,
                Math.min(canvasContextMenu.x, Math.max(12, viewportSize.width - 204)),
              ),
              top: Math.max(
                12,
                Math.min(canvasContextMenu.y, Math.max(12, viewportSize.height - 164)),
              ),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {canvasContextMenu.targetKind ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={copyCanvasContextTarget}
                >
                  <span
                    className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconCopy}`}
                    aria-hidden
                  />
                  <b>复制</b>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={pasteCanvasClipboardFromContextMenu}
                  disabled={
                    !isGraphReady ||
                    !canvasNodeClipboardRef.current?.nodes?.length
                  }
                >
                  <span
                    className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconPaste}`}
                    aria-hidden
                  />
                  <b>粘贴</b>
                </button>
                <button
                  className={styles.canvasContextMenuDanger}
                  type="button"
                  role="menuitem"
                  onClick={deleteCanvasContextTarget}
                >
                  <span
                    className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconDelete}`}
                    aria-hidden
                  />
                  <b>删除</b>
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={chooseCanvasMediaFile}>
                  <span className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconUpload}`} aria-hidden />
                  <b>上传</b>
                </button>
                <button type="button" role="menuitem" onClick={openCanvasNodeMenuFromContextMenu}>
                  <span className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconAdd}`} aria-hidden />
                  <b>添加节点</b>
                </button>
                <button type="button" role="menuitem" onClick={pasteCanvasMedia}>
                  <span className={`${styles.canvasContextMenuIcon} ${styles.canvasContextMenuIconPaste}`} aria-hidden />
                  <b>粘贴</b>
                </button>
              </>
            )}
          </div>
        ) : null}
        {connectionAddMenu ? (
          <div
            className={styles.connectionAddMenu}
            data-canvas-ignore="true"
            role="menu"
            aria-label="添加上下文"
            style={{
              left: Math.min(connectionAddMenu.x, Math.max(12, viewportSize.width - 228)),
              top: Math.min(connectionAddMenu.y, Math.max(12, viewportSize.height - 196)),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <strong>添加上下文</strong>
            <div className={styles.connectionAddOptions}>
              {QUICK_ADD_NODE_TYPES.map((item) => {
                const sourceNode = nodeMap[connectionAddMenu.sourceNodeId];
                const isConnectable = canConnectNodeToNewType(
                  sourceNode,
                  item.type,
                  connectionAddMenu.sourceSide,
                ) && !getNewNodeConnectionLimitViolation(sourceNode, item.type, connectionAddMenu.sourceSide);
                return (
                  <button
                    key={item.type}
                    className={`${styles.connectionAddOption} ${!isConnectable ? styles.connectionAddOptionDisabled : ''}`}
                    type="button"
                    role="menuitem"
                    disabled={!isConnectable}
                    onClick={() => {
                      if (!isConnectable) {
                        return;
                      }
                      addNode(item.type, {
                        worldPoint: connectionAddMenu.worldPoint,
                        sourceNodeId: connectionAddMenu.sourceNodeId,
                        sourceSide: connectionAddMenu.sourceSide,
                      });
                      setConnectionAddMenu(null);
                    }}
                  >
                    <span
                      className={`${styles.connectionAddOptionIcon} ${styles[`connectionAddOptionIcon_${item.type}`] || ''}`}
                      aria-hidden
                    />
                    <b>{item.label}</b>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div
          className={styles.canvasWorld}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {groups.map((group) => (
            <section
              key={group.id}
              className={`${styles.canvasGroup} ${groupDropTargetId === group.id ? styles.canvasGroupDropTarget : ''} ${draggingGroupId === group.id ? styles.canvasGroupDragging : ''} ${focusedGroupId === group.id ? styles.canvasGroupFocused : ''}`}
              data-canvas-ignore="true"
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
              aria-label={group.title}
              onPointerDown={(event) => handleGroupPointerDown(event, group.id)}
              onContextMenu={(event) =>
                handleCanvasItemContextMenu(event, 'group', group.id)
              }
            >
              <span className={styles.canvasGroupTitle}>
                <i aria-hidden />
                {group.title}
              </span>
              {focusedGroupId === group.id
                ? GROUP_RESIZE_HANDLES.map((handle) => (
                    <button
                      key={handle.corner}
                      className={`${styles.groupResizeHandle} ${styles[`groupResizeHandle_${handle.corner}`] || ''}`}
                      type="button"
                      data-canvas-ignore="true"
                      aria-label={handle.label}
                      onPointerDown={(event) =>
                        handleGroupResizePointerDown(event, group.id, handle.corner)
                      }
                    />
                  ))
                : null}
            </section>
          ))}
          {isSnapEnabled && alignmentGuides.vertical.map((guideX) => (
            <div
              key={`vertical-${guideX}`}
              className={`${styles.alignmentGuide} ${styles.verticalAlignmentGuide}`}
              style={{ left: guideX, top: -WORLD_EXTENT, height: WORLD_SIZE }}
            />
          ))}
          {isSnapEnabled && alignmentGuides.horizontal.map((guideY) => (
            <div
              key={`horizontal-${guideY}`}
              className={`${styles.alignmentGuide} ${styles.horizontalAlignmentGuide}`}
              style={{ left: -WORLD_EXTENT, top: guideY, width: WORLD_SIZE }}
            />
          ))}
          <svg
            className={styles.edgeLayer}
            width={WORLD_SIZE}
            height={WORLD_SIZE}
            viewBox={`${-WORLD_EXTENT} ${-WORLD_EXTENT} ${WORLD_SIZE} ${WORLD_SIZE}`}
            aria-hidden
          >
            <defs>
              <marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8fdcff" />
              </marker>
            </defs>
            {visibleEdges.map((edge, edgeIndex) => {
              const fromNode = nodeMap[edge.from];
              const toNode = nodeMap[edge.to];
              if (!fromNode || !toNode) {
                return null;
              }

              const startPoint = getNodePortPosition(fromNode, 'right');
              const endPoint = getNodePortPosition(toNode, 'left');
              const path = buildConnectorPath(startPoint, endPoint, 'right', 'left');
              const edgeGradientId = getEdgeGradientId(edge.id, edgeIndex);
              const isEdgeActive =
                hoveredEdgeId === edge.id ||
                selectedEdgeIds.includes(edge.id) ||
                selectedEdgeId === edge.id;

              return (
                <g key={edge.id}>
                  <defs>
                    <linearGradient
                      id={edgeGradientId}
                      gradientUnits="userSpaceOnUse"
                      x1={startPoint.x}
                      y1={startPoint.y}
                      x2={endPoint.x}
                      y2={endPoint.y}
                    >
                      <stop offset="0" stopColor="#5ed7ff" />
                      <stop offset="0.55" stopColor="#b7a0ff" />
                      <stop offset="1" stopColor="#76e8d1" />
                    </linearGradient>
                  </defs>
                  <path
                    className={`${styles.edgePath} ${isEdgeActive ? styles.edgeSelected : ''}`}
                    d={path}
                    stroke={`url(#${edgeGradientId})`}
                    markerEnd="url(#edge-arrow)"
                  />
                  {isEdgeActive && (
                    <path
                      className={styles.edgeMeteorTrail}
                      d={path}
                      pathLength="1"
                    />
                  )}
                  <path
                    className={styles.edgeArrowPath}
                    d={path}
                    markerEnd="url(#edge-arrow)"
                  />
                  <path
                    className={styles.edgeHitPath}
                    d={path}
                    data-canvas-ignore="true"
                    onPointerEnter={() => setHoveredEdgeId(edge.id)}
                    onPointerLeave={() => setHoveredEdgeId((current) => (current === edge.id ? '' : current))}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectionRegion(null);
                      setFocusedGroupId('');
                      setSelectedEdgeId(edge.id);
                      setSelectedEdgeIds([edge.id]);
                      setSelectedNodeId('');
                      setSelectedNodeIds([]);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeCanvasItems([], [edge.id]);
                      setHoveredEdgeId('');
                      setSelectedEdgeId((current) => (current === edge.id ? '' : current));
                      setSelectedEdgeIds((current) => current.filter((item) => item !== edge.id));
                    }}
                  />
                </g>
              );
            })}
            {connectingFrom && draftPoint && nodeMap[connectingFrom.nodeId] && (
              <path
                className={styles.edgeDraft}
                d={buildConnectorPath(
                  getNodePortPosition(nodeMap[connectingFrom.nodeId], connectingFrom.side),
                  draftPoint,
                  connectingFrom.side,
                  'left',
                )}
              />
            )}
          </svg>

          {elevatedCanvasEdges.length > 0 ? (
            <svg
              className={`${styles.edgeLayer} ${styles.edgeFocusLayer}`}
              width={WORLD_SIZE}
              height={WORLD_SIZE}
              viewBox={`${-WORLD_EXTENT} ${-WORLD_EXTENT} ${WORLD_SIZE} ${WORLD_SIZE}`}
              aria-hidden
            >
              <defs>
                <marker
                  id="edge-arrow-focused"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#8fdcff" />
                </marker>
              </defs>
              {elevatedCanvasEdges.map((edge, edgeIndex) => {
                const fromNode = nodeMap[edge.from];
                const toNode = nodeMap[edge.to];
                if (!fromNode || !toNode) {
                  return null;
                }

                const startPoint = getNodePortPosition(fromNode, 'right');
                const endPoint = getNodePortPosition(toNode, 'left');
                const path = buildConnectorPath(startPoint, endPoint, 'right', 'left');
                const edgeGradientId = getEdgeGradientId(
                  `focused-${edge.id}`,
                  edgeIndex,
                );
                const isEdgeActive =
                  hoveredEdgeId === edge.id ||
                  selectedEdgeIds.includes(edge.id) ||
                  selectedEdgeId === edge.id;

                return (
                  <g key={`focused-${edge.id}`}>
                    <defs>
                      <linearGradient
                        id={edgeGradientId}
                        gradientUnits="userSpaceOnUse"
                        x1={startPoint.x}
                        y1={startPoint.y}
                        x2={endPoint.x}
                        y2={endPoint.y}
                      >
                        <stop offset="0" stopColor="#5ed7ff" />
                        <stop offset="0.55" stopColor="#b7a0ff" />
                        <stop offset="1" stopColor="#76e8d1" />
                      </linearGradient>
                    </defs>
                    <path
                      className={`${styles.edgePath} ${styles.edgeFocusedPath} ${isEdgeActive ? styles.edgeSelected : ''}`}
                      d={path}
                      stroke={`url(#${edgeGradientId})`}
                      markerEnd="url(#edge-arrow-focused)"
                    />
                    {isEdgeActive ? (
                      <path
                        className={styles.edgeMeteorTrail}
                        d={path}
                        pathLength="1"
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>
          ) : null}

          {visibleNodes.map((node) => {
            const meta = getNodeTypeMeta(node.type);
            const isResourceContainer = isResourceContainerNodeType(node.type);
            const nodeMediaType = getNodeMediaType(node);
            const connectorSides = isResourceContainer ? ['right'] : CONNECTOR_SIDES;
            const status = STATUS_META[node.status] || STATUS_META.idle;
            const isTitleEditing = isEditingNodeField(node.id, 'title');
            const isContentEditing = isEditingNodeField(node.id, 'content');
            const isNodeSelected = selectedNodeIds.includes(node.id);
            const isNodeGenerating = generatingNodeIds.includes(node.id) || isActiveGenerationStatus(node.status);
            const isNodeGenerationFailed = generationFailedNodeIds.includes(node.id);
            const isNodeUploading = uploadingNodeIds.includes(node.id);
            const hasExistingGeneratedContent = hasNodeGeneratedContent(node);
            const isFocusedSelectedNode = selectedNodeId === node.id;
            const isNodeInFocusedGroup =
              Boolean(focusedGroupId) && node.groupId === focusedGroupId;
            const isConnectionBlocked = blockedConnectionTargetId === node.id;
            const hasPromptFocus = promptFocusNodeId === node.id;
            const isPromptPopoverExpanded = expandedPromptNodeId === node.id;
            const showVideoPromptPopover =
              node.type === 'video' && isNodeSelected && hasPromptFocus && !isNodeGenerating && !draggingNodeIds.includes(node.id);
            const isVideoModelMenuOpen = openVideoModelNodeId === node.id;
            const isVideoRatioMenuOpen = openVideoRatioNodeId === node.id;
            const isVideoResolutionMenuOpen = openVideoResolutionNodeId === node.id;
            const isVideoDurationMenuOpen = openVideoDurationNodeId === node.id;
            const isAudioModelMenuOpen = openAudioModelNodeId === node.id;
            const textModelOptions = getNodeModelOptions('script', modelOptionsByNodeType);
            const imageModelOptions = getNodeModelOptions('image', modelOptionsByNodeType);
            const videoModelOptions = getNodeModelOptions('video', modelOptionsByNodeType);
            const audioModelOptions = getNodeModelOptions('audio', modelOptionsByNodeType);
            const hasTextModelOptions = textModelOptions.length > 0;
            const hasImageModelOptions = imageModelOptions.length > 0;
            const hasVideoModelOptions = videoModelOptions.length > 0;
            const hasAudioModelOptions = audioModelOptions.length > 0;
            const videoDurationSeconds = clampVideoDurationSeconds(node.durationSeconds ?? MIN_VIDEO_DURATION_SECONDS);
            const hasVideoPromptContent = Boolean((node.content || '').trim());
            const isTextModelMenuOpen = openTextModelNodeId === node.id;
            const selectedTextModelOption = getSelectedModelOption('script', node.model, modelOptionsByNodeType);
            const selectedTextModel = selectedTextModelOption?.label || '';
            const hasTextPromptContent = Boolean((node.textPromptContent || '').trim());
            const isImageModelMenuOpen = openImageModelNodeId === node.id;
            const isImageRatioMenuOpen = openImageRatioNodeId === node.id;
            const isImageResolutionMenuOpen = openImageResolutionNodeId === node.id;
            const selectedVideoModelOption = getSelectedModelOption('video', node.model, modelOptionsByNodeType);
            const selectedVideoModel = selectedVideoModelOption?.label || '';
            const selectedImageModelOption = getSelectedModelOption('image', node.model, modelOptionsByNodeType);
            const selectedImageModel = selectedImageModelOption?.label || '';
            const selectedAudioModelOption = getSelectedModelOption('audio', node.model, modelOptionsByNodeType);
            const selectedAudioModel = selectedAudioModelOption?.label || '';
            const videoAspectRatioOptions = getModelAspectRatioOptions('video', selectedVideoModel, modelOptionsByNodeType);
            const videoResolutionOptions = getModelResolutionOptions('video', selectedVideoModel, modelOptionsByNodeType);
            const imageAspectRatioOptions = getModelAspectRatioOptions('image', selectedImageModel, modelOptionsByNodeType);
            const imageResolutionOptions = getModelResolutionOptions('image', selectedImageModel, modelOptionsByNodeType);
            const selectedVideoRatio = videoAspectRatioOptions.includes(node.aspectRatio) ? node.aspectRatio : videoAspectRatioOptions[0] || '';
            const selectedVideoResolution = videoResolutionOptions.includes(node.resolution) ? node.resolution : videoResolutionOptions[0] || '';
            const selectedImageRatio = imageAspectRatioOptions.includes(node.aspectRatio) ? node.aspectRatio : imageAspectRatioOptions[0] || '';
            const selectedImageResolution = imageResolutionOptions.includes(node.resolution) ? node.resolution : imageResolutionOptions[0] || '';
            const hasVideoRatioOptions = videoAspectRatioOptions.length > 0;
            const hasVideoResolutionOptions = videoResolutionOptions.length > 0;
            const hasImageRatioOptions = imageAspectRatioOptions.length > 0;
            const hasImageResolutionOptions = imageResolutionOptions.length > 0;
            const hasImagePromptContent = Boolean((node.content || '').trim());
            const videoModelCapabilityMode = getVideoModelCapabilityMode(node);
            const availableVideoModelOptions =
              getModelOptionsByConnectionAvailability(
                videoModelOptions,
                edges,
                nodeMap,
                node,
                (modelOption) =>
                  getVideoModelCapabilityViolation(
                    modelOption,
                    videoModelCapabilityMode,
                  ),
              );
            const inputReferenceThumbnails = getNodeInputReferenceThumbnails(
              node,
              edges,
              nodeMap,
              seedanceCharacters,
            );
            const effectiveVideoInputMode = getEffectiveVideoInputMode(
              node,
              edges,
              nodeMap,
            );
            const videoFrameUploadRoles =
              node.type === 'video'
                ? getVideoFrameUploadRoles(effectiveVideoInputMode)
                : [];
            const hasVideoPromptReferenceRow =
              inputReferenceThumbnails.length > 0 ||
              videoFrameUploadRoles.length > 0;
            const showTextPromptPopover =
              node.type === 'script' && isNodeSelected && hasPromptFocus && !isNodeGenerating && !draggingNodeIds.includes(node.id);
            const showImagePromptPopover =
              node.type === 'image' && isNodeSelected && hasPromptFocus && !isNodeGenerating && !draggingNodeIds.includes(node.id);
            const showAudioPromptPopover =
              node.type === 'audio' && isNodeSelected && hasPromptFocus && !isNodeGenerating && !draggingNodeIds.includes(node.id);
            return (
              <article
                key={node.id}
                data-canvas-ignore="true"
                className={`${styles.node} ${node.type === 'script' ? styles.textNode : ''} ${isMediaNodeType(node.type) ? styles.imageNode : ''} ${isResourceContainer ? styles.resourceNode : ''} ${isNodeSelected ? styles.nodeSelected : ''} ${selectedNodeIds.length > 1 && isNodeSelected ? styles.nodeMultiSelected : ''} ${isConnectionBlocked ? styles.nodeConnectionBlocked : ''} ${isNodeGenerating ? styles.nodeGenerating : ''} ${isNodeGenerationFailed && hasExistingGeneratedContent ? styles.nodeGenerationFailedWithContent : ''}`}
                style={{
                  '--accent': meta.accent,
                  width: node.width,
                  height: node.height,
                  zIndex:
                    isNodeInFocusedGroup || isFocusedSelectedNode
                      ? 40
                      : isNodeSelected
                        ? 30
                        : 3,
                  transform: `translate(${node.x}px, ${node.y}px)`,
                }}
                onPointerDownCapture={(event) => handleNodePointerDownCapture(event, node.id)}
                onPointerDown={(event) => handleNodePointerDown(event, node.id)}
                onDoubleClickCapture={(event) => handleNodeDoubleClickCapture(event, node.id)}
                onContextMenu={(event) =>
                  handleCanvasItemContextMenu(event, 'node', node.id)
                }
              >
                {isNodeGenerating || isNodeUploading ? (
                  <div className={styles.nodeGenerationOverlay} aria-live="polite">
                    <span className={styles.nodeGenerationSpinner} aria-hidden />
                    <strong>{isNodeUploading ? '上传中' : '生成中'}</strong>
                  </div>
                ) : null}
                {isNodeGenerationFailed && !hasExistingGeneratedContent ? (
                  <div className={`${styles.nodeGenerationOverlay} ${styles.nodeGenerationFailedOverlay}`} aria-live="polite">
                    <strong>生成失败</strong>
                  </div>
                ) : null}
                {connectorSides.map((side) => (
                  <span
                    key={side}
                    className={`${styles.portZone} ${styles[`${side}PortZone`]}`}
                    data-canvas-ignore="true"
                    onPointerEnter={handlePortZonePointerMove}
                    onPointerMove={handlePortZonePointerMove}
                    onPointerLeave={handlePortZonePointerLeave}
                    onPointerDown={(event) => {
                      if (event.target === event.currentTarget) {
                        handlePortPointerDown(event, node.id, side);
                      }
                    }}
                    onPointerUp={(event) => {
                      if (event.target === event.currentTarget) {
                        handlePortPointerUp(event, node.id);
                      }
                    }}
                  >
                    <span className={styles.portMotion}>
                      <button
                        className={`${styles.port} ${styles[`${side}Port`]}`}
                        type="button"
                        aria-label={`${node.title} ${side} connection`}
                        onPointerDown={(event) => handlePortPointerDown(event, node.id, side)}
                        onPointerUp={(event) => handlePortPointerUp(event, node.id)}
                      />
                    </span>
                  </span>
                ))}
                {isMediaNodeType(node.type) ? (
                  <header className={styles.nodeHeader}>
                    <span className={styles.nodeIcon}>{meta.icon}</span>
                    <div>
                      <span className={styles.mediaNodeTitle}>
                        {isResourceContainer
                          ? node.videoInputRole === VIDEO_INPUT_ROLE_FIRST_FRAME
                            ? node.title || '首帧'
                            : node.mediaFileName || node.title
                          : getMediaNodeTitle(node.type)}
                      </span>
                      <span className={styles.imageNodeTitle}>图片节点</span>
                    </div>
                  </header>
                ) : (
                <header className={styles.nodeHeader}>
                  <span className={styles.nodeIcon}>{meta.icon}</span>
                  <div>
                    <input
                      className={isTitleEditing ? styles.nodeFieldEditing : ''}
                      data-node-field="title"
                      data-node-edit-key={`${node.id}:title`}
                      value={node.title}
                      readOnly={!isTitleEditing}
                      tabIndex={isTitleEditing ? 0 : -1}
                      onPointerDown={(event) => handleNodeFieldPointerDown(event, isTitleEditing)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        beginNodeFieldEdit(node.id, 'title');
                      }}
                      onBlur={() => stopNodeFieldEdit(node.id, 'title')}
                      onChange={(event) => updateNode(node.id, { title: event.target.value })}
                      aria-label="节点名称"
                    />
                    <small>{node.subtitle}</small>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[status.tone]}`}>{status.label}</span>
                </header>
                )}
                <div className={styles.nodeBody}>
                  {isMediaNodeType(node.type) ? (
                    <div
                      className={`${styles.imageUploadTarget} ${styles[`${nodeMediaType}UploadTarget`] || ''} ${node.mediaPreviewUrl ? styles.imageUploadTargetHasImage : ''} ${showVideoPromptPopover || showImagePromptPopover || showAudioPromptPopover ? styles.imageUploadTargetPopoverOpen : ''}`}
                      data-canvas-ignore="true"
                      data-media-preview={
                        ['image', 'video'].includes(nodeMediaType) ? 'true' : undefined
                      }
                      role={isResourceContainer ? 'button' : undefined}
                      tabIndex={-1}
                      aria-label={
                        isResourceContainer
                          ? `${node.title}，双击重新上传素材`
                          : `${node.title}预览`
                      }
                      title={
                        node.mediaPreviewUrl && ['image', 'video'].includes(nodeMediaType)
                          ? '双击查看详情'
                          : undefined
                      }
                    >
                      {node.mediaPreviewUrl && nodeMediaType === 'image' ? (
                        <img
                          src={node.mediaPreviewUrl}
                          alt={node.mediaFileName || node.title}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                        />
                      ) : null}
                      {node.mediaPreviewUrl && nodeMediaType === 'audio' ? (
                        <AudioWaveformPlayer
                          key={node.mediaPreviewUrl}
                          src={node.mediaPreviewUrl}
                          fileName={node.mediaFileName || node.title}
                        />
                      ) : null}
                      {node.mediaPreviewUrl && nodeMediaType === 'video' ? (
                        <div className={styles.videoPlayer}>
                          <video
                            src={node.mediaPreviewUrl}
                            data-disable-native-fullscreen="true"
                            controls
                            controlsList="noremoteplayback"
                            disablePictureInPicture
                            disableRemotePlayback
                            preload="metadata"
                            draggable={false}
                            playsInline
                            onDoubleClick={preventNativeVideoFullscreen}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onLoadedMetadata={(event) => updateVideoProgress(node.id, event.currentTarget)}
                            onTimeUpdate={(event) => updateVideoProgress(node.id, event.currentTarget)}
                            onPlay={() => setVideoPlaying(node.id, true)}
                            onPause={(event) => {
                              setVideoPlaying(node.id, false);
                              updateVideoProgress(node.id, event.currentTarget);
                            }}
                            onDragStart={(event) => event.preventDefault()}
                          />
                        </div>
                      ) : null}
                      {node.type === 'video' &&
                      node.mediaPreviewUrl &&
                      !isNodeGenerating ? (
                        <button
                          className={styles.videoFrameExtractButton}
                          type="button"
                          aria-label={`从${node.title}提取一帧图片`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) =>
                            openVideoFrameExtractor(node.id, event)
                          }
                        >
                          <svg
                            aria-hidden="true"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <rect
                              x="3.5"
                              y="5.5"
                              width="17"
                              height="13"
                              rx="2.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M8 5.5v13M16 5.5v13M3.5 10h4.5M16 10h4.5M3.5 14h4.5M16 14h4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M10.2 10.2 14.5 12l-4.3 1.8v-3.6Z"
                              fill="currentColor"
                            />
                          </svg>
                          <span>抽帧</span>
                        </button>
                      ) : null}
                      {isResourceContainer && node.mediaPreviewUrl ? (
                        <button
                          className={styles.mediaReplaceButton}
                          type="button"
                          aria-label="上传替换"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.parentElement?.querySelector('input[type="file"]')?.click();
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            role="img"
                            width="14"
                            height="14"
                            viewBox="0 0 19.8008 19.8006"
                          >
                            <path
                              d="M1.80078 16.9003C1.80087 17.1919 1.91684 17.4714 2.12305 17.6776C2.32932 17.8838 2.60874 17.9999 2.90039 17.9999H16.9004C17.192 17.9999 17.4715 17.8838 17.6777 17.6776C17.8839 17.4714 17.9999 17.1919 18 16.9003V11.9999H19.8008V16.9003C19.8007 17.6693 19.4949 18.4073 18.9512 18.951C18.4073 19.4948 17.6694 19.8006 16.9004 19.8006H2.90039C2.13135 19.8006 1.39345 19.4948 0.849609 18.951C0.305837 18.4073 9.33702e-05 17.6693 0 16.9003V11.9999H1.80078V16.9003ZM9.33203 0.202009C9.68553 -0.086443 10.2076 -0.0660213 10.5371 0.263533L16.1729 5.90025L14.9004 7.17271L10.8008 3.07408V13.8006H9V3.07408L4.90039 7.17271L3.62793 5.90025L9.26367 0.263533L9.33203 0.202009Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      ) : null}
                      {showVideoPromptPopover && viewportRef.current ? createPortal(
                        <div
                          className={`${styles.videoPromptPopover} ${styles.screenPromptPopover} ${
                            isPromptPopoverExpanded ? styles.promptPopoverExpanded : ''
                          }`}
                          style={
                            isPromptPopoverExpanded
                              ? getExpandedPromptPopoverScreenStyle(viewportSize)
                              : getPromptPopoverScreenStyle(
                                  node,
                                  viewport,
                                  viewportSize,
                                  hasVideoPromptReferenceRow,
                                )
                          }
                          data-canvas-ignore="true"
                          data-node-popover="true"
                          role="dialog"
                          aria-label={`${node.title} 视频生成设置`}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {renderPromptPopoverHeader(
                            node,
                            <>
                              <button
                                className={`${styles.characterLibraryButton} ${
                                  effectiveVideoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME
                                    ? styles.characterLibraryButtonActive
                                    : ''
                                }`}
                                type="button"
                                title="使用单张首帧图片生成视频"
                                aria-pressed={
                                  effectiveVideoInputMode === VIDEO_INPUT_MODE_FIRST_FRAME
                                }
                                onClick={(event) =>
                                  setVideoStructuredInputMode(
                                    node.id,
                                    VIDEO_INPUT_MODE_FIRST_FRAME,
                                    event,
                                  )
                                }
                              >
                                首帧
                              </button>
                              <button
                                className={`${styles.characterLibraryButton} ${
                                  effectiveVideoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME
                                    ? styles.characterLibraryButtonActive
                                    : ''
                                }`}
                                type="button"
                                title="使用首帧和尾帧图片生成视频"
                                aria-pressed={
                                  effectiveVideoInputMode === VIDEO_INPUT_MODE_FIRST_END_FRAME
                                }
                                onClick={(event) =>
                                  setVideoStructuredInputMode(
                                    node.id,
                                    VIDEO_INPUT_MODE_FIRST_END_FRAME,
                                    event,
                                  )
                                }
                              >
                                首尾帧
                              </button>
                              <button
                                className={styles.characterLibraryButton}
                                type="button"
                                onClick={(event) => openSeedanceLibrary(node.id, event)}
                                disabled={!canvasProjectId}
                              >
                                角色
                              </button>
                            </>,
                          )}
                          {renderPromptReferenceRow(
                            node,
                            inputReferenceThumbnails,
                            '当前视频输入参考素材',
                            renderVideoFrameUploadButtons(
                              node,
                              effectiveVideoInputMode,
                            ),
                          )}
                          <textarea
                            data-prompt-editor-node-id={node.id}
                            value={node.content || ''}
                            onChange={(event) => updateNode(node.id, { content: event.target.value })}
                            placeholder="描述你想要生成的画面内容"
                            aria-label="视频生成描述"
                          />
                          <div className={styles.videoPromptFooter}>
                            {renderMediaGenerationTypeSelect(node)}
                            <div
                              className={`${styles.videoPromptField} ${styles.videoModelSelect}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasVideoModelOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenVideoModelNodeId(isVideoModelMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenVideoModelNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isVideoModelMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasVideoModelOptions) {
                                    return;
                                  }
                                  setOpenVideoModelNodeId(isVideoModelMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasVideoModelOptions}
                              >
                                <ModelOptionThumbnail model={selectedVideoModelOption} compact />
                                <span className={styles.selectedModelLabel}>{selectedVideoModel || '暂无模型'}</span>
                              </button>
                              {isVideoModelMenuOpen && hasVideoModelOptions ? (
                                <div
                                  className={`${styles.videoModelMenu} ${styles.modelOptionMenu}`}
                                  role="listbox"
                                  aria-label="视频模型列表"
                                >
                                  {availableVideoModelOptions.map(
                                    ({ model, modelConnectionViolation }) => {
                                      const isSelectedModel =
                                        model.label === selectedVideoModel;
                                      return (
                                        <button
                                          key={model.label}
                                          className={isSelectedModel ? styles.videoModelMenuItemActive : ''}
                                          type="button"
                                          role="option"
                                          aria-selected={isSelectedModel}
                                          aria-label={
                                            modelConnectionViolation
                                              ? `${model.label}，不可选择：${modelConnectionViolation}`
                                              : model.label
                                          }
                                          title={modelConnectionViolation || model.label}
                                          disabled={Boolean(modelConnectionViolation)}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            updateNode(node.id, {
                                              model: model.label,
                                              aspectRatio: model.aspectRatios[0] || '',
                                              resolution: model.resolutions[0] || '',
                                            });
                                            setOpenVideoModelNodeId('');
                                            setOpenVideoRatioNodeId('');
                                            setOpenVideoResolutionNodeId('');
                                          }}
                                        >
                                          <ModelOptionThumbnail model={model} />
                                          <span className={styles.modelOptionCopy}>
                                            <strong>{model.label}</strong>
                                            {modelConnectionViolation || model.description ? (
                                              <small>{modelConnectionViolation || model.description}</small>
                                            ) : null}
                                          </span>
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`${styles.videoPromptField} ${styles.videoRatioField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasVideoRatioOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenVideoRatioNodeId(isVideoRatioMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenVideoRatioNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isVideoRatioMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasVideoRatioOptions) {
                                    return;
                                  }
                                  setOpenVideoRatioNodeId(isVideoRatioMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasVideoRatioOptions}
                              >
                                <span
                                  className={styles.videoRatioPreview}
                                  style={getAspectRatioPreviewStyle(selectedVideoRatio)}
                                  aria-hidden
                                />
                                <span>{selectedVideoRatio || '暂无比例'}</span>
                              </button>
                              {isVideoRatioMenuOpen && hasVideoRatioOptions ? (
                                <div className={`${styles.videoModelMenu} ${styles.videoRatioMenu}`} role="listbox" aria-label="视频比例列表">
                                  {videoAspectRatioOptions.map((ratio) => {
                                    const isSelectedRatio = ratio === selectedVideoRatio;
                                    return (
                                      <button
                                        key={ratio}
                                        className={isSelectedRatio ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedRatio}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, { aspectRatio: ratio });
                                          setOpenVideoRatioNodeId('');
                                        }}
                                      >
                                        <span
                                          className={styles.videoRatioPreview}
                                          style={getAspectRatioPreviewStyle(ratio)}
                                          aria-hidden
                                        />
                                        <span>{ratio}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`${styles.videoPromptField} ${styles.videoResolutionField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasVideoResolutionOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenVideoResolutionNodeId(isVideoResolutionMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenVideoResolutionNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isVideoResolutionMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasVideoResolutionOptions) {
                                    return;
                                  }
                                  setOpenVideoResolutionNodeId(isVideoResolutionMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasVideoResolutionOptions}
                              >
                                <span>{selectedVideoResolution || '\u6682\u65e0\u5206\u8fa8\u7387'}</span>
                              </button>
                              {isVideoResolutionMenuOpen && hasVideoResolutionOptions ? (
                                <div className={`${styles.videoModelMenu} ${styles.videoResolutionMenu}`} role="listbox" aria-label="\u89c6\u9891\u5206\u8fa8\u7387\u5217\u8868">
                                  {videoResolutionOptions.map((resolution) => {
                                    const isSelectedResolution = resolution === selectedVideoResolution;
                                    return (
                                      <button
                                        key={resolution}
                                        className={isSelectedResolution ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedResolution}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, { resolution });
                                          setOpenVideoResolutionNodeId('');
                                        }}
                                      >
                                        {resolution}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`${styles.videoPromptField} ${styles.videoDurationField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.currentTarget.focus();
                                setOpenVideoDurationNodeId(isVideoDurationMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenVideoDurationNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="dialog"
                                aria-expanded={isVideoDurationMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setOpenVideoDurationNodeId(isVideoDurationMenuOpen ? '' : node.id);
                                }}
                              >
                                <span>{videoDurationSeconds}s</span>
                              </button>
                              {isVideoDurationMenuOpen ? (
                                <div
                                  className={styles.videoDurationMenu}
                                  role="dialog"
                                  aria-label="视频时长"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <span className={styles.videoDurationTitle}>视频时长</span>
                                  <div className={styles.videoDurationControlRow}>
                                    <div
                                      className={styles.videoDurationSliderShell}
                                      role="slider"
                                      tabIndex={0}
                                      aria-label="视频时长"
                                      aria-valuemin={MIN_VIDEO_DURATION_SECONDS}
                                      aria-valuemax={MAX_VIDEO_DURATION_SECONDS}
                                      aria-valuenow={videoDurationSeconds}
                                      aria-valuetext={`${videoDurationSeconds}s`}
                                      style={{
                                        '--duration-progress': `${
                                          ((videoDurationSeconds - MIN_VIDEO_DURATION_SECONDS) /
                                            (MAX_VIDEO_DURATION_SECONDS - MIN_VIDEO_DURATION_SECONDS)) *
                                          100
                                        }%`,
                                      }}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                      }}
                                      onPointerDown={(event) => handleVideoDurationPointerDown(event, node.id)}
                                      onPointerMove={(event) => handleVideoDurationPointerMove(event, node.id)}
                                      onPointerUp={handleVideoDurationPointerUp}
                                      onPointerCancel={handleVideoDurationPointerUp}
                                      onKeyDown={(event) =>
                                        handleVideoDurationKeyDown(event, node.id, videoDurationSeconds)
                                      }
                                    >
                                      <span className={styles.videoDurationTrack} aria-hidden />
                                      <span className={styles.videoDurationFill} aria-hidden />
                                      <span className={styles.videoDurationThumb} aria-hidden />
                                      <input
                                        className={styles.videoDurationSlider}
                                        type="range"
                                        min={MIN_VIDEO_DURATION_SECONDS}
                                        max={MAX_VIDEO_DURATION_SECONDS}
                                        step="1"
                                        value={videoDurationSeconds}
                                        onChange={(event) =>
                                          updateNode(node.id, { durationSeconds: clampVideoDurationSeconds(event.target.value) })
                                        }
                                        aria-label="视频时长"
                                      />
                                    </div>
                                    <span className={styles.videoDurationValue}>{videoDurationSeconds}s</span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className={styles.videoPromptActions}>
                              <button
                                className={`${styles.videoGenerateButton} ${styles.pointsTipButton}`}
                                type="button"
                                data-points-tip={
                                  !isNodeGenerating && hasVideoPromptContent && selectedVideoModel
                                    ? getNodePointsQuoteText(node.id)
                                    : undefined
                                }
                                aria-label="生成视频"
                                disabled={!canvasProjectId || isNodeGenerating || !hasVideoPromptContent || !selectedVideoModel}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleGenerateNode(node.id, event);
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  xmlnsXlink="http://www.w3.org/1999/xlink"
                                  aria-hidden="true"
                                  role="img"
                                  width="1em"
                                  height="1em"
                                  viewBox="0 0 18 18"
                                >
                                  <path
                                    d="M8.29289 0.292893C8.68342 -0.0976311 9.31658 -0.0976311 9.70711 0.292893L17.7071 8.29289C18.0976 8.68342 18.0976 9.31658 17.7071 9.70711C17.3166 10.0976 16.6834 10.0976 16.2929 9.70711L10 3.41421V17C10 17.5523 9.55229 18 9 18C8.44772 18 8 17.5523 8 17V3.41421L1.70711 9.70711C1.31658 10.0976 0.683418 10.0976 0.292893 9.70711C-0.0976311 9.31658 -0.0976311 8.68342 0.292893 8.29289L8.29289 0.292893Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>,
                        viewportRef.current,
                      ) : null}
                      {showImagePromptPopover && viewportRef.current ? createPortal(
                        <div
                          className={`${styles.imagePromptPopover} ${styles.screenPromptPopover} ${
                            isPromptPopoverExpanded ? styles.promptPopoverExpanded : ''
                          }`}
                          style={
                            isPromptPopoverExpanded
                              ? getExpandedPromptPopoverScreenStyle(viewportSize)
                              : getPromptPopoverScreenStyle(
                                  node,
                                  viewport,
                                  viewportSize,
                                  inputReferenceThumbnails.length > 0,
                                )
                          }
                          data-canvas-ignore="true"
                          data-node-popover="true"
                          role="dialog"
                          aria-label={`${node.title} 图片生成设置`}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {renderPromptPopoverHeader(node)}
                          {renderPromptReferenceRow(
                            node,
                            inputReferenceThumbnails,
                            '当前图片输入参考素材',
                          )}
                          <textarea
                            data-prompt-editor-node-id={node.id}
                            value={node.content || ''}
                            onChange={(event) => updateNode(node.id, { content: event.target.value })}
                            placeholder="描述你想要生成的画面内容"
                            aria-label="图片生成描述"
                          />
                          <div className={styles.imagePromptFooter}>
                            {renderMediaGenerationTypeSelect(node)}
                            <div
                              className={`${styles.videoPromptField} ${styles.videoModelSelect}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasImageModelOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenImageModelNodeId(isImageModelMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenImageModelNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isImageModelMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasImageModelOptions) {
                                    return;
                                  }
                                  setOpenImageModelNodeId(isImageModelMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasImageModelOptions}
                              >
                                <ModelOptionThumbnail model={selectedImageModelOption} compact />
                                <span className={styles.selectedModelLabel}>{selectedImageModel || '暂无模型'}</span>
                              </button>
                              {isImageModelMenuOpen && hasImageModelOptions ? (
                                <div
                                  className={`${styles.videoModelMenu} ${styles.modelOptionMenu}`}
                                  role="listbox"
                                  aria-label="图片模型列表"
                                >
                                  {getModelOptionsByConnectionAvailability(
                                    imageModelOptions,
                                    edges,
                                    nodeMap,
                                    node,
                                  ).map(({ model, modelConnectionViolation }) => {
                                    const isSelectedModel = model.label === selectedImageModel;
                                    return (
                                      <button
                                        key={model.label}
                                        className={isSelectedModel ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedModel}
                                        aria-label={
                                          modelConnectionViolation
                                            ? `${model.label}，不可选择：${modelConnectionViolation}`
                                            : model.label
                                        }
                                        title={modelConnectionViolation || model.label}
                                        disabled={Boolean(modelConnectionViolation)}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, {
                                            model: model.label,
                                            aspectRatio: model.aspectRatios[0] || '',
                                            resolution: model.resolutions[0] || '',
                                          });
                                          setOpenImageModelNodeId('');
                                          setOpenImageRatioNodeId('');
                                          setOpenImageResolutionNodeId('');
                                        }}
                                      >
                                        <ModelOptionThumbnail model={model} />
                                        <span className={styles.modelOptionCopy}>
                                          <strong>{model.label}</strong>
                                          {modelConnectionViolation || model.description ? (
                                            <small>{modelConnectionViolation || model.description}</small>
                                          ) : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`${styles.videoPromptField} ${styles.videoRatioField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasImageRatioOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenImageRatioNodeId(isImageRatioMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenImageRatioNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isImageRatioMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasImageRatioOptions) {
                                    return;
                                  }
                                  setOpenImageRatioNodeId(isImageRatioMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasImageRatioOptions}
                              >
                                <span
                                  className={styles.videoRatioPreview}
                                  style={getAspectRatioPreviewStyle(selectedImageRatio)}
                                  aria-hidden
                                />
                                <span>{selectedImageRatio || '暂无比例'}</span>
                              </button>
                              {isImageRatioMenuOpen && hasImageRatioOptions ? (
                                <div className={`${styles.videoModelMenu} ${styles.videoRatioMenu}`} role="listbox" aria-label="图片比例列表">
                                  {imageAspectRatioOptions.map((ratio) => {
                                    const isSelectedRatio = ratio === selectedImageRatio;
                                    return (
                                      <button
                                        key={ratio}
                                        className={isSelectedRatio ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedRatio}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, { aspectRatio: ratio });
                                          setOpenImageRatioNodeId('');
                                        }}
                                      >
                                        <span
                                          className={styles.videoRatioPreview}
                                          style={getAspectRatioPreviewStyle(ratio)}
                                          aria-hidden
                                        />
                                        <span>{ratio}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`${styles.videoPromptField} ${styles.videoResolutionField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasImageResolutionOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenImageResolutionNodeId(isImageResolutionMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenImageResolutionNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isImageResolutionMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasImageResolutionOptions) {
                                    return;
                                  }
                                  setOpenImageResolutionNodeId(isImageResolutionMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasImageResolutionOptions}
                              >
                                <span>{selectedImageResolution || '\u6682\u65e0\u5206\u8fa8\u7387'}</span>
                              </button>
                              {isImageResolutionMenuOpen && hasImageResolutionOptions ? (
                                <div className={`${styles.videoModelMenu} ${styles.videoResolutionMenu}`} role="listbox" aria-label="\u56fe\u7247\u5206\u8fa8\u7387\u5217\u8868">
                                  {imageResolutionOptions.map((resolution) => {
                                    const isSelectedResolution = resolution === selectedImageResolution;
                                    return (
                                      <button
                                        key={resolution}
                                        className={isSelectedResolution ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedResolution}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, { resolution });
                                          setOpenImageResolutionNodeId('');
                                        }}
                                      >
                                        {resolution}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div className={styles.imagePromptActions}>
                              <button
                                className={`${styles.imageGenerateButton} ${styles.pointsTipButton}`}
                                type="button"
                                data-points-tip={
                                  !isNodeGenerating && hasImagePromptContent && selectedImageModel
                                    ? getNodePointsQuoteText(node.id)
                                    : undefined
                                }
                                aria-label="生成图片"
                                disabled={!canvasProjectId || isNodeGenerating || !hasImagePromptContent || !selectedImageModel}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleGenerateNode(node.id, event);
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  xmlnsXlink="http://www.w3.org/1999/xlink"
                                  aria-hidden="true"
                                  role="img"
                                  width="1em"
                                  height="1em"
                                  viewBox="0 0 18 18"
                                >
                                  <path
                                    d="M8.29289 0.292893C8.68342 -0.0976311 9.31658 -0.0976311 9.70711 0.292893L17.7071 8.29289C18.0976 8.68342 18.0976 9.31658 17.7071 9.70711C17.3166 10.0976 16.6834 10.0976 16.2929 9.70711L10 3.41421V17C10 17.5523 9.55229 18 9 18C8.44772 18 8 17.5523 8 17V3.41421L1.70711 9.70711C1.31658 10.0976 0.683418 10.0976 0.292893 9.70711C-0.0976311 9.31658 -0.0976311 8.68342 0.292893 8.29289L8.29289 0.292893Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>,
                        viewportRef.current,
                      ) : null}
                      {showAudioPromptPopover && viewportRef.current ? createPortal(
                        <div
                          className={`${styles.audioPromptPopover} ${styles.screenPromptPopover} ${
                            isPromptPopoverExpanded ? styles.promptPopoverExpanded : ''
                          }`}
                          style={
                            isPromptPopoverExpanded
                              ? getExpandedPromptPopoverScreenStyle(viewportSize)
                              : getPromptPopoverScreenStyle(
                                  node,
                                  viewport,
                                  viewportSize,
                                  inputReferenceThumbnails.length > 0,
                                )
                          }
                          data-canvas-ignore="true"
                          data-node-popover="true"
                          role="dialog"
                          aria-label={`${node.title} 音频生成设置`}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {renderPromptPopoverHeader(node)}
                          {renderPromptReferenceRow(
                            node,
                            inputReferenceThumbnails,
                            '当前音频输入参考素材',
                          )}
                          <textarea
                            data-prompt-editor-node-id={node.id}
                            value={node.content || ''}
                            onChange={(event) => updateNode(node.id, { content: event.target.value })}
                            placeholder="输入要合成的文本"
                            aria-label="音频合成文本"
                          />
                          <div className={styles.audioPromptChips} aria-label="音频快捷标记">
                            <button type="button">&lt;#&gt; 停顿</button>
                            <button type="button">() 语气词</button>
                          </div>
                          <div className={styles.audioPromptFooter}>
                            <div
                              className={`${styles.audioModelSelect} ${styles.videoPromptField}`}
                              tabIndex={-1}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasAudioModelOptions) {
                                  return;
                                }
                                event.currentTarget.focus();
                                setOpenAudioModelNodeId(isAudioModelMenuOpen ? '' : node.id);
                              }}
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) {
                                  setOpenAudioModelNodeId('');
                                }
                              }}
                            >
                              <button
                                className={styles.videoModelTrigger}
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={isAudioModelMenuOpen}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!hasAudioModelOptions) {
                                    return;
                                  }
                                  setOpenAudioModelNodeId(isAudioModelMenuOpen ? '' : node.id);
                                }}
                                disabled={!hasAudioModelOptions}
                              >
                                <ModelOptionThumbnail model={selectedAudioModelOption} compact />
                                <span className={styles.selectedModelLabel}>{selectedAudioModel || '暂无模型'}</span>
                              </button>
                              {isAudioModelMenuOpen && hasAudioModelOptions ? (
                                <div
                                  className={`${styles.videoModelMenu} ${styles.modelOptionMenu}`}
                                  role="listbox"
                                  aria-label="音频模型列表"
                                >
                                  {getModelOptionsByConnectionAvailability(
                                    audioModelOptions,
                                    edges,
                                    nodeMap,
                                    node,
                                  ).map(({ model, modelConnectionViolation }) => {
                                    const isSelectedModel = model.label === selectedAudioModel;
                                    return (
                                      <button
                                        key={model.label}
                                        className={isSelectedModel ? styles.videoModelMenuItemActive : ''}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelectedModel}
                                        aria-label={
                                          modelConnectionViolation
                                            ? `${model.label}，不可选择：${modelConnectionViolation}`
                                            : model.label
                                        }
                                        title={modelConnectionViolation || model.label}
                                        disabled={Boolean(modelConnectionViolation)}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateNode(node.id, { model: model.label });
                                          setOpenAudioModelNodeId('');
                                        }}
                                      >
                                        <ModelOptionThumbnail model={model} />
                                        <span className={styles.modelOptionCopy}>
                                          <strong>{model.label}</strong>
                                          {modelConnectionViolation || model.description ? (
                                            <small>{modelConnectionViolation || model.description}</small>
                                          ) : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div className={styles.audioPromptActions}>
                              <button type="button" aria-label="翻译">文</button>
                              <button type="button" aria-label="参数">调</button>
                              <span>0/50000</span>
                              <span>1</span>
                              <button
                                className={styles.audioGenerateButton}
                                type="button"
                                aria-label="生成音频"
                                disabled={!selectedAudioModel}
                              >
                                ↑
                              </button>
                            </div>
                          </div>
                        </div>,
                        viewportRef.current,
                      ) : null}
                      {isResourceContainer ? (
                        <input
                          type="file"
                          accept={getMediaAccept(node.type)}
                          onChange={(event) => handleMediaNodeUpload(event, node.id)}
                          aria-label={`${node.title} 重新上传素材`}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <textarea
                    className={isContentEditing ? styles.nodeFieldEditing : ''}
                    data-node-field="content"
                    data-node-edit-key={`${node.id}:content`}
                    value={node.content}
                    readOnly={!isContentEditing}
                    tabIndex={isContentEditing ? 0 : -1}
                    onPointerDown={(event) => handleNodeFieldPointerDown(event, isContentEditing)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      beginNodeFieldEdit(node.id, 'content');
                    }}
                    onBlur={() => stopNodeFieldEdit(node.id, 'content')}
                    onChange={(event) => updateNode(node.id, { content: event.target.value })}
                    aria-label={`${node.title} 内容`}
                    placeholder="输入内容..."
                    />
                  )}
                </div>
                {showTextPromptPopover && viewportRef.current ? createPortal(
                  <div
                    className={`${styles.textPromptPopover} ${styles.screenPromptPopover} ${
                      isPromptPopoverExpanded ? styles.promptPopoverExpanded : ''
                    }`}
                    style={
                      isPromptPopoverExpanded
                        ? getExpandedPromptPopoverScreenStyle(viewportSize)
                        : getPromptPopoverScreenStyle(
                            node,
                            viewport,
                            viewportSize,
                            inputReferenceThumbnails.length > 0,
                          )
                    }
                    data-canvas-ignore="true"
                    data-node-popover="true"
                    role="dialog"
                    aria-label={`${node.title} 文本生成设置`}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {renderPromptPopoverHeader(node)}
                    {renderPromptReferenceRow(
                      node,
                      inputReferenceThumbnails,
                      '当前文本输入参考素材',
                    )}
                    <textarea
                      data-prompt-editor-node-id={node.id}
                      value={node.textPromptContent || ''}
                      onChange={(event) => updateNode(node.id, { textPromptContent: event.target.value })}
                      placeholder="写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。"
                      aria-label="文本生成描述"
                    />
                    <div className={styles.textPromptFooter}>
                      <div
                        className={`${styles.videoPromptField} ${styles.videoModelSelect}`}
                        tabIndex={-1}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!hasTextModelOptions) {
                            return;
                          }
                          event.currentTarget.focus();
                          setOpenTextModelNodeId(isTextModelMenuOpen ? '' : node.id);
                        }}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setOpenTextModelNodeId('');
                          }
                        }}
                      >
                        <button
                          className={styles.videoModelTrigger}
                          type="button"
                          aria-haspopup="listbox"
                          aria-expanded={isTextModelMenuOpen}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!hasTextModelOptions) {
                              return;
                            }
                            setOpenTextModelNodeId(isTextModelMenuOpen ? '' : node.id);
                          }}
                          disabled={!hasTextModelOptions}
                        >
                          <ModelOptionThumbnail model={selectedTextModelOption} compact />
                          <span className={styles.selectedModelLabel}>{selectedTextModel || '暂无模型'}</span>
                        </button>
                        {isTextModelMenuOpen && hasTextModelOptions ? (
                          <div
                            className={`${styles.videoModelMenu} ${styles.modelOptionMenu}`}
                            role="listbox"
                            aria-label="文本模型列表"
                          >
                            {getModelOptionsByConnectionAvailability(
                              textModelOptions,
                              edges,
                              nodeMap,
                              node,
                            ).map(({ model, modelConnectionViolation }) => {
                              const isSelectedModel = model.label === selectedTextModel;
                              return (
                                <button
                                  key={model.label}
                                  className={isSelectedModel ? styles.videoModelMenuItemActive : ''}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelectedModel}
                                  aria-label={
                                    modelConnectionViolation
                                      ? `${model.label}，不可选择：${modelConnectionViolation}`
                                      : model.label
                                  }
                                  title={modelConnectionViolation || model.label}
                                  disabled={Boolean(modelConnectionViolation)}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    updateNode(node.id, { model: model.label });
                                    setOpenTextModelNodeId('');
                                  }}
                                >
                                  <ModelOptionThumbnail model={model} />
                                  <span className={styles.modelOptionCopy}>
                                    <strong>{model.label}</strong>
                                    {modelConnectionViolation || model.description ? (
                                      <small>{modelConnectionViolation || model.description}</small>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      <div className={styles.textPromptActions}>
                        <button
                          className={`${styles.textGenerateButton} ${styles.pointsTipButton}`}
                          type="button"
                          data-points-tip={
                            !isNodeGenerating && hasTextPromptContent && selectedTextModel
                              ? getNodePointsQuoteText(node.id)
                              : undefined
                          }
                          aria-label="生成文本"
                          disabled={!canvasProjectId || isNodeGenerating || !hasTextPromptContent || !selectedTextModel}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleGenerateNode(node.id, event);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            xmlnsXlink="http://www.w3.org/1999/xlink"
                            aria-hidden="true"
                            role="img"
                            width="1em"
                            height="1em"
                            viewBox="0 0 18 18"
                          >
                            <path
                              d="M8.29289 0.292893C8.68342 -0.0976311 9.31658 -0.0976311 9.70711 0.292893L17.7071 8.29289C18.0976 8.68342 18.0976 9.31658 17.7071 9.70711C17.3166 10.0976 16.6834 10.0976 16.2929 9.70711L10 3.41421V17C10 17.5523 9.55229 18 9 18C8.44772 18 8 17.5523 8 17V3.41421L1.70711 9.70711C1.31658 10.0976 0.683418 10.0976 0.292893 9.70711C-0.0976311 9.31658 -0.0976311 8.68342 0.292893 8.29289L8.29289 0.292893Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>,
                  viewportRef.current,
                ) : null}
                {isMediaNodeType(node.type) ? null : (
                  <footer className={styles.nodeFooter}>
                    <span>{node.model}</span>
                    <div>
                      {(node.tags || []).map((tag) => (
                        <small key={tag}>{tag}</small>
                      ))}
                    </div>
                  </footer>
                )}
                {node.type === 'script' ? (
                  <button
                    className={styles.textNodeResizeHandle}
                    type="button"
                    data-canvas-ignore="true"
                    aria-label="调整文本块大小"
                    onPointerDown={(event) => handleTextNodeResizePointerDown(event, node.id)}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
        {selectionBox && (
          <div
            className={styles.selectionBox}
            style={normalizeSelectionBox(selectionBox)}
          />
        )}
        {selectionRegion && selectionRegionStyle ? (
          <div
            className={styles.selectionRegion}
            data-canvas-ignore="true"
            style={selectionRegionStyle}
          >
            {canCreateGroupFromSelection ? (
              <button
                className={styles.selectionGroupButton}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={createGroupFromSelection}
              >
                <span aria-hidden />
                打组
              </button>
            ) : null}
          </div>
        ) : null}
        {focusedGroup && focusedGroupToolbarStyle ? (
          <div
            className={styles.groupFocusToolbar}
            data-canvas-ignore="true"
            style={focusedGroupToolbarStyle}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <button
              className={`${styles.runGroupButton} ${styles.pointsTipButton}`}
              type="button"
              data-points-tip={
                !isFocusedGroupRunning &&
                !isFocusedGroupSubmitting &&
                isGraphReady &&
                canvasProjectId
                  ? getNodeSetPointsQuoteText(focusedGroupNodes)
                  : undefined
              }
              disabled={
                !isGraphReady ||
                !canvasProjectId ||
                focusedGroupNodes.length === 0 ||
                isRunningWorkflow ||
                isFocusedGroupRunning ||
                isFocusedGroupSubmitting
              }
              onClick={(event) => runCanvasGroup(focusedGroup.id, event)}
            >
              <span aria-hidden />
              {isFocusedGroupRunning || isFocusedGroupSubmitting ? '执行中' : '整组执行'}
            </button>
            <button
              className={styles.ungroupButton}
              type="button"
              onClick={(event) => ungroupCanvasGroup(focusedGroup.id, event)}
            >
              <span aria-hidden />
              解组
            </button>
          </div>
        ) : null}
        {connectionNotice ? (
          <div
            className={styles.connectionNotice}
            style={{
              left: connectionNotice.x,
              top: connectionNotice.y,
            }}
          >
            {connectionNotice.text}
          </div>
        ) : null}
        {pointsTip.visible
          ? createPortal(
            <div
              className={`${styles.pointsTooltip} ${
                pointsTip.placement === 'bottom' ? styles.pointsTooltipBottom : styles.pointsTooltipTop
              }`}
              style={{
                left: pointsTip.left,
                top: pointsTip.top,
              }}
              role="tooltip"
            >
              {pointsTip.text}
            </div>,
            document.body,
          )
          : null}
        {videoFrameExtractorNode
          ? createPortal(
            <VideoFrameExtractorDialog
              node={videoFrameExtractorNode}
              state={videoFrameExtractor}
              videoRef={videoFrameExtractorRef}
              onClose={closeVideoFrameExtractor}
              onExtract={extractCurrentVideoFrame}
              onVideoStateChange={syncVideoFrameExtractorState}
              onVideoError={handleVideoFrameExtractorError}
            />,
            document.body,
          )
          : null}
        {mediaDetailNode?.mediaPreviewUrl
          ? createPortal(
            <MediaDetailViewer
              node={mediaDetailNode}
              references={mediaDetailReferences}
              onClose={closeMediaDetailViewer}
            />,
            document.body,
          )
          : null}
        {seedanceLibraryOpen
          ? createPortal(
            <div
              className={styles.seedanceLibraryMask}
              data-canvas-ignore="true"
              role="dialog"
              aria-modal="true"
              aria-label="虚拟人像库"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={closeSeedanceLibrary}
            >
              <div
                className={styles.seedanceLibraryPanel}
                data-canvas-ignore="true"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className={styles.seedanceLibraryHeader}>
                  <div className={styles.seedanceLibraryTitleBlock}>
                    <strong>虚拟人像库</strong>
                    <span>Active 后可参与 Seedance 生成</span>
                  </div>
                  <div className={styles.seedanceLibraryActions}>
                    <button
                      className={styles.seedanceUploadButton}
                      type="button"
                      onClick={triggerSeedanceCharacterUpload}
                      disabled={isUploadingSeedanceCharacter}
                    >
                      {isUploadingSeedanceCharacter ? '上传中...' : '上传人像'}
                    </button>
                    <input
                      ref={seedanceCharacterUploadInputRef}
                      className={styles.seedanceUploadInput}
                      type="file"
                      accept="image/*"
                      onChange={uploadSeedanceCharacterPhoto}
                    />
                    <button
                      className={styles.seedanceLibraryCloseButton}
                      type="button"
                      onClick={closeSeedanceLibrary}
                      aria-label="关闭虚拟人像库"
                    >
                      ×
                    </button>
                  </div>
                </header>

                <div className={styles.seedanceLibraryMeta}>
                  <span>图片宽高需在 300px ~ 6000px 之间，仅 Active 素材可选</span>
                  <span>共 {seedanceCharacters.length} 张</span>
                </div>

                {seedanceCharactersError ? (
                  <div className={styles.seedanceLibraryError} role="alert">
                    {seedanceCharactersError}
                  </div>
                ) : null}

                <div className={styles.seedanceLibraryBody}>
                  {seedanceCharactersLoading ? (
                    <div className={styles.seedanceLibraryState}>素材加载中...</div>
                  ) : visibleSeedanceCharacters.length > 0 ? (
                    <div className={styles.seedanceCharacterGrid}>
                      {visibleSeedanceCharacters.map((character) => {
                        const isSelected = selectedSeedanceVirtualAssetIds.includes(character.virtualAssetId);
                        const isDeletingAsset = deletingSeedanceAssetIds.includes(character.virtualAssetId);
                        return (
                        <article
                          key={character.id}
                          className={`${styles.seedanceCharacterCard} ${
                            isSelected ? styles.seedanceCharacterCardSelected : ''
                          } ${!character.isActive ? styles.seedanceCharacterCardDisabled : ''}`}
                        >
                          <div className={styles.seedanceCharacterImageWrap}>
                            {character.imageUrl ? (
                              <img src={character.imageUrl} alt={character.name} />
                            ) : (
                              <span>暂无预览</span>
                            )}
                            <span
                              className={`${styles.seedanceCharacterStatus} ${
                                character.isActive ? styles.seedanceCharacterStatusActive : ''
                              }`}
                            >
                              {character.status || 'Pending'}
                            </span>
                          </div>
                          <div className={styles.seedanceCharacterInfo}>
                            <strong title={character.name}>{character.name}</strong>
                            <span title={character.description || character.status || '真人照片'}>
                              {character.description || character.status || '真人照片'}
                            </span>
                          </div>
                          <div className={styles.seedanceCharacterActions}>
                            <button
                              className={styles.seedanceCharacterDeleteButton}
                              type="button"
                              onClick={() => deleteSeedanceVirtualAsset(character)}
                              disabled={!character.virtualAssetId || isDeletingAsset}
                            >
                              {isDeletingAsset ? '删除中' : '删除'}
                            </button>
                            <button
                              type="button"
                              onClick={() => applySeedanceVirtualAssetToNode(character)}
                              disabled={!character.isActive || !character.virtualAssetId}
                            >
                              {isSelected ? '已选择' : '选择'}
                            </button>
                          </div>
                        </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.seedanceLibraryState}>暂无真人照片素材</div>
                  )}
                </div>

                <footer className={styles.seedanceLibraryFooter}>
                  <span>
                    第 {seedanceCharacterPage} / {seedanceCharacterTotalPages} 页
                  </span>
                  <div className={styles.seedancePagination}>
                    <button
                      type="button"
                      onClick={() => setSeedanceCharacterPage((current) => Math.max(1, current - 1))}
                      disabled={seedanceCharacterPage <= 1 || seedanceCharactersLoading}
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSeedanceCharacterPage((current) =>
                          Math.min(seedanceCharacterTotalPages, current + 1),
                        )
                      }
                      disabled={
                        seedanceCharacterPage >= seedanceCharacterTotalPages || seedanceCharactersLoading
                      }
                    >
                      下一页
                    </button>
                  </div>
                </footer>
              </div>
            </div>,
            document.body,
          )
          : null}
      </section>

      <div className={styles.zoomBar} aria-label="画布缩放">
        <div className={styles.minimapControl} data-canvas-ignore="true">
          <button
            className={`${styles.mapButton} ${isMinimapOpen ? styles.mapButtonActive : ''}`}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isMinimapOpen}
            onClick={() => setIsMinimapOpen((current) => !current)}
          >
            地图
          </button>
          {isMinimapOpen && minimapLayout ? (
            <div className={styles.minimapPopover} role="dialog" aria-label="画布小地图">
              <div
                className={styles.minimapCanvas}
                style={{
                  width: MINIMAP_WIDTH,
                  height: MINIMAP_HEIGHT,
                }}
              >
                {minimapLayout.nodes.map((item) => (
                  <span
                    key={item.id}
                    className={`${styles.minimapNode} ${styles[`minimapNode_${item.type}`] || ''}`}
                    style={{
                      left: item.rect.left,
                      top: item.rect.top,
                      width: item.rect.width,
                      height: item.rect.height,
                    }}
                  />
                ))}
                {minimapLayout.viewportRect ? (
                  <span
                    className={styles.minimapViewportFrame}
                    style={{
                      left: minimapLayout.viewportRect.left,
                      top: minimapLayout.viewportRect.top,
                      width: minimapLayout.viewportRect.width,
                      height: minimapLayout.viewportRect.height,
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <button className={styles.fitButton} type="button" onClick={fitView}>适配</button>
        <button className={styles.zoomOutButton} type="button" onClick={() => changeZoom(-0.1)} aria-label="缩小">−</button>
        <button
          className={isSnapEnabled ? styles.snapButtonActive : ''}
          type="button"
          onClick={() => setIsSnapEnabled((current) => !current)}
          aria-pressed={isSnapEnabled}
        >
          吸附
        </button>
        <strong>{zoomPercent}%</strong>
        <button className={styles.zoomInButton} type="button" onClick={() => changeZoom(0.1)} aria-label="放大">+</button>
      </div>

      {shouldShowReturnToRange && (
        <button className={styles.returnToRangeButton} type="button" onClick={fitNodesIntoView}>
          回到区间
        </button>
      )}

    </main>
  );
}

export default WorkflowPage;
