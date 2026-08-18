// Team options used by login team-selection modal.
export const TEAM_OPTIONS = [
  { id: 'team-nebula', name: '星云短剧组', memberCount: 18 },
  { id: 'team-lantern', name: '青灯短剧组', memberCount: 9 },
  { id: 'team-orbit', name: '轨道创意组', memberCount: 12 },
];

// Script parsing/generation model catalog.
export const SCRIPT_MODELS = [
  {
    id: 'script-general',
    name: '通用创作版',
    speed: '约15秒/集',
    cost: '中',
    description: '适配全部短剧题材，剧情逻辑稳定，适合多数团队。',
  },
  {
    id: 'script-pro',
    name: '专业创作版',
    speed: '约30秒/集',
    cost: '高',
    description: '剧情细节与台词表现更强，适合复杂角色关系。',
  },
  {
    id: 'script-fast',
    name: '极速版',
    speed: '约8秒/集',
    cost: '低',
    description: '快速产出剧本初稿，便于试错和头脑风暴。',
  },
];

// Storyboard decomposition model catalog.
export const STORYBOARD_MODELS = [
  {
    id: 'storyboard-comic',
    name: '短剧专用分镜模型',
    speed: '约20秒/集',
    cost: '中',
  },
  {
    id: 'storyboard-fast',
    name: '极速分镜模型',
    speed: '约10秒/集',
    cost: '低',
  },
];

// Image generation model catalog.
export const IMAGE_MODELS = [
  {
    id: 'image-comic',
    name: '短剧专用绘画模型',
    speed: '约15秒/张',
    cost: '中',
    styles: ['二次元', '国风手绘', 'Q版', '简约线稿'],
  },
  {
    id: 'image-anime',
    name: '通用动漫模型',
    speed: '约10秒/张',
    cost: '中低',
    styles: ['赛博朋克', '复古动漫', '二次元'],
  },
  {
    id: 'image-realistic',
    name: '写实风模型',
    speed: '约25秒/张',
    cost: '高',
    styles: ['写实插画'],
  },
];

// Video generation model catalog.
export const VIDEO_MODELS = [
  {
    id: 'video-hd',
    name: '高清画质模型',
    speed: '约1.5分钟/15秒视频',
    cost: '高',
    dynamicRange: ['弱', '中', '强'],
    frameRates: [24, 30, 60],
  },
  {
    id: 'video-fast',
    name: '极速模型',
    speed: '约40秒/15秒视频',
    cost: '低',
    dynamicRange: ['弱', '中'],
    frameRates: [24, 30],
  },
];

// Voice presets used by character lines.
export const VOICE_PRESETS = [
  '温柔女声',
  '青年男声',
  '元气少女',
  '沉稳旁白',
  '热血少年',
];

// New project templates.
export const PROJECT_TEMPLATES = ['空白模板', '甜宠短剧模板', '古风短剧模板', '悬疑分镜模板'];

// Sidebar menu items.
export const MENU_ITEMS = [
  { id: 'creation', label: '短剧创建', hint: 'AI流程工作台' },
  { id: 'assets', label: '素材库', hint: '素材与版本' },
  { id: 'users', label: '用户管理', hint: '角色权限' },
  { id: 'projects', label: '项目管理', hint: '进度与状态' },
  { id: 'points', label: '积分流水', hint: '消费与退款记录' },
];
