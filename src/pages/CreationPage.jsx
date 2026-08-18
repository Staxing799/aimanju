
import { InputNumber, Modal, Space } from 'antd';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import defaultProjectCover from '../assets/default-project-cover.svg';
import homeAiShortDramaWorkflow from '../assets/home-ai-short-drama-workflow.png';
import AppSelect from '../components/common/AppSelect';
import { VOICE_PRESETS } from '../constants/models';
import { createId } from '../utils/id';
import { readTextFileWithEncodingFallback } from '../utils/textEncoding';
import { characterApi, managedProjectApi, pointsApi, projectApi, sceneApi, storyboardApi, taskApi, ttsApi } from '../api';
import {
  mapApiProjectToStudioProject,
  mergeApiStoryboardIntoStudioProject,
  mergeApiStoryboardsIntoStudioProject,
  parseApiErrorMessage,
  toApiCreationMode,
  toApiFilmType,
} from '../utils/projectAdapter';
import { fetchLatestProjectSnapshot } from '../utils/projectRemoteSync';
import styles from './CreationPage.module.less';

const FLOW_STEPS = [
  { id: 1, label: '项目创建' },
  { id: 2, label: '剧本设定' },
  { id: 3, label: '分镜成片' },
];

const DELIVERY_TYPES = ['剧情演绎', '旁白解说'];
const CREATION_MODES = ['单图模式', '宫格模式'];
const ASPECT_RATIOS = ['16:9', '9:16'];
const SCRIPT_UPLOAD_ALLOWED_EXTENSIONS = ['.txt', '.docx', '.pdf'];
const STORYBOARD_VIDEO_DURATION_DEFAULT = 5;
const STORYBOARD_VIDEO_DURATION_MIN = 5;
const STORYBOARD_VIDEO_DURATION_MAX = 15;

const SETTING_TABS = [
  { id: 'script', label: '剧本概览' },
  { id: 'characters', label: '角色设定' },
  { id: 'scenes', label: '场景设定' },
];

const SCRIPT_SAMPLES = [
  `《将军又哭了》 长公主嘉和在登基前夜收到一封来自边关的密报，信上说她那位名震天下的将军夫君卫青珏已私下与东洋海商往来，疑似准备在新帝继位之日调兵入京。三年前，嘉和不顾满朝反对，下嫁寒门出身的卫青珏，将半数亲信与母族势力押在他身上，甚至为他挡下谋逆旧案，让他从人人鄙夷的冷门副将，一步步成为镇北大将军。可如今，城楼风起，旧臣离散，父皇病危，她在权势旋涡里骤然发现自己最信任的人，也许正是那把最锋利的刀。故事从一场雪夜归朝开始。卫青珏凯旋回京，满城灯火为他庆功，却无人知道他盔甲之下伤痕纵横，怀里还藏着一份能颠覆朝局的通敌名册。嘉和在宫宴上以笑示人，暗中命心腹女官调查东洋客商、兵部旧档与皇城布防，越查越发现所有线索都指向卫家旧部。与此同时，后宫贵妃借机挑拨，太子党逼她交出兵符，御史台日日弹劾卫青珏功高震主，连嘉和一手抚养长大的幼弟也开始畏惧这个姐夫。嘉和表面冷淡疏离，实则一次次试探卫青珏，想逼他亲口说出真相；卫青珏却像故意承受她的误解，宁肯背上负心与谋逆之名，也不肯解释自己为何深夜接见海商、为何秘密转移边军粮草、为何把一封写着“若我不归，焚于城下”的信锁在书房暗格。两人从并肩作战的夫妻，变成步步设防的对手。可越是对立，越能看见彼此还未熄灭的牵挂。嘉和在围猎场上险遭刺杀，是卫青珏徒手接箭替她挡下；卫青珏被押入诏狱时，嘉和又在暴雨夜中独自去天牢，用一句“你若真反，本宫亲手送你上路”掩住颤抖。随着调查深入，嘉和发现真正与东洋勾结的不是卫青珏，而是她一直信任的舅父与掌管漕运的内廷旧臣。他们意图借新旧皇权交替制造兵乱，再把所有罪名扣到卫青珏头上，逼嘉和交权。卫青珏之所以沉默，是因为他早已布下反制之局，只差最后一步就能连根拔起叛党，但若提前泄露，嘉和与幼帝都会成为靶子。高潮发生在登基大典当日，京城水门失守、叛军假借迎驾名义逼宫，嘉和披凤冠执长剑登上宫城，卫青珏则率残部自外城杀回。夫妻二人在烈火、钟鼓与万民惊呼中重新并肩，一个稳住朝臣，一个血战禁军，终于在黎明前扭转大局。可胜利之后，嘉和必须面对更残酷的抉择：为了平息天下猜疑，她要么赐死功高震主的卫青珏，要么以自己的皇室身份为他担下所有非议。这个故事不只是先婚后爱的误会追妻，更是权谋婚姻中两个强者在信任与权力之间反复撕扯的过程。嘉和会从高高在上的长公主，成长为敢于为所爱之人重新定义秩序的掌权者；卫青珏也会从只会独自扛下风雨的孤臣，学会把真心与命运交给嘉和。所有眼泪、隐忍、误会和反转，最终都将汇成一句迟来的告白：我不是怕你不信我，我是怕你信我以后，再也没有退路。`,
  `《夜老板打压后我觉醒了》 打工人许棠是星曜传媒连续三年业绩第一的招商主管，白天替公司谈下百万合作，夜里却还要替老板秦峥润色朋友圈、陪客户喝酒、给新来的关系户擦屁股。她原以为只要足够拼命，就能换来升职、期权和在这座城市站稳脚跟的资格，直到公司年会那晚，她精心准备了一整年的项目被老板一句“团队荣誉要高于个人得失”轻飘飘抹去。原本属于她的年度奖金，被临时转给老板的小舅子；本该由她负责的新项目，被强行交给空降副总；她在台下强撑笑容，回到家却因长期过劳晕倒，醒来时看见电脑屏幕上还停留着自己加班到凌晨写完的复盘文档。就在那一刻，她突然听见一个冷静到近乎残酷的声音在脑海中响起，像是在为她的人生结算成本：你并不缺努力，你只是把努力投喂给了错误的系统。这个“觉醒”并不是超能力，而是她终于开始以经营者而不是被管理者的视角看待职场。第二天起，许棠第一次没有为老板的情绪兜底，而是默默备份合同、梳理客户资源、记录所有被侵占成果的证据。她发现公司所谓的狼性文化，本质上是用荣誉感掩盖不合理分配；那些总在会议上谈理想、谈家庭、谈奉献的人，真正关心的从来只有自己的分红和权力半径。许棠开始不再无条件救火，而是学会拒绝无偿背锅、学会在会议上追问责任边界、学会把每一份成果都留痕存档。与此同时，她也结识了被边缘化的法务顾问程野，一个表面散漫、实则洞察人性的前投行律师。程野提醒她，真正的反击不是情绪化辞职，而是在对方最依赖你的时候，让系统看到谁才是价值创造者。于是，许棠一边稳住工作，一边悄悄和曾经合作过的客户重建私人信任；她帮助被压榨的同事拿回应得提成，也把关系户闯下的祸一次次用数据和事实甩回管理层。公司内部很快分成两派，一派仍旧迷信老板画的大饼，一派则在许棠的影响下开始清醒。秦峥察觉她不再顺从后，先用升职诱惑，再用“你一个女孩别太强势”的话术打压，最后甚至试图用竞业协议和行业封杀威胁她。可许棠早已不是那个把自我价值建立在领导评价上的人。她开始筹备自己的内容咨询工作室，以前那些被她真诚服务过的客户纷纷愿意跟着她走；曾经嘲笑她“太拼没前途”的前同事，也在看到她的专业能力和清晰边界后主动请求加入。高潮发生在集团季度发布会前夕，老板团队为了保住融资，试图拿许棠做替罪羊，逼她签下一份承认决策失误的说明。许棠没有像过去那样沉默，而是在会议室里放出完整邮件链、审批记录和项目贡献数据，当众揭穿管理层如何吞掉员工奖金、如何把业务失败包装成员工执行不力。那一刻，她不是为了争一口气，而是在替所有被“公司像家一样”绑架的人撕开幻象。发布会之后，星曜传媒信誉崩塌，秦峥被董事会架空，许棠则带着真正信任她的团队离开，成立了自己的公司。她第一次租下明亮的办公室，第一次制定“不以牺牲生活为荣”的团队规则，也第一次意识到，觉醒不是立刻逆袭成爽文女王，而是终于承认自己的价值不需要靠讨好权力来证明。这个故事聚焦现代职场中隐形剥削、成果掠夺与自我重建的全过程，既有打脸反转、会议博弈、证据翻盘的爽感，也有成年人重新学习边界、尊严和合作关系的成长痛感。许棠最终赢下的，不只是奖金和事业，而是重新拿回定义自己人生的主动权。`,
  `《好孕奶兔》 兔族庶女月清璎前世活得像一件被反复转手的礼物。她自幼生于偏院，母亲早亡，因天生带着罕见的治愈灵息，被嫡姐月绾音和继母视作随时可利用的血脉容器。成年礼那夜，继母以“联姻可保全族”为名，将她迷晕后献给了虎族最冷酷的战将裴砚骁。传闻裴砚骁杀伐无情，天生煞气缠身，所有靠近他的雌族都无福承受，可月清璎被送去后才发现，所谓噩梦并非来自裴砚骁，而是来自自己至亲设计好的死局。她被迫替嫡姐承担禁术反噬，被抽走灵骨，还在生产前夕被人诬陷私通，最终抱着尚未出世的幼崽惨死在雪夜祭台。再睁眼时，她重生回到被送入虎族军帐的前一晚。铜镜前的自己尚未被毁容折骨，窗外的风雪还未掩埋命运，月清璎握紧发颤的手指，第一件事不是逃，而是决定彻底改写所有人眼中的“柔弱奶兔”剧本。她知道自己若连夜出走，只会被族中以叛逃之罪抓回；她也知道裴砚骁并非传闻中那般暴戾，相反，这个男人背负的是虎族王庭的兵权倾轧和血脉诅咒，前世他曾在她最绝望时给过唯一一次体面。于是月清璎选择主动入局。她带着前世记忆进入虎族军营，不再唯唯诺诺，而是凭借对草药、阵纹和各族势力的了解，一步步让自己从献祭品变成不可替代的军医与谋士。她先在军帐内救下中毒的小狼崽，赢得边军信任；又在虎族王庭派来的审查使面前，揭穿有人故意在军粮中掺入引兽粉，借机挑起边境混战。裴砚骁起初只把她当成被迫送来的联姻棋子，冷眼旁观她如何在陌生领地求生，可月清璎的聪明、韧劲与偶尔露出的奶兔本性，却一点点让这个被诅咒束缚的男人动了心。两人的关系从互相试探到并肩作战，中间夹杂着身份压制、族群偏见、朝堂猜疑和前世创伤。月清璎害怕再次沦为生育工具，所以即便察觉裴砚骁的温柔，也始终给自己留后路；裴砚骁则第一次学着收敛锋芒，笨拙地用兵权、战功和誓言替她筑起安全感。与此同时，兔族旧宅那边并未放过她。嫡姐月绾音发现“祭品”不仅没死，反而在虎族声名鹊起，便联合狐族巫师伪造预言，宣称月清璎腹中的灵胎将祸乱诸族，意图逼裴砚骁亲手舍弃她。月清璎这才明白，前世自己的死亡牵扯的并不只是宅斗，而是一场关于血脉神力、王权更替与边境联盟的大局。她的治愈灵息并非单纯辅助能力，而是能平衡虎族煞气、唤醒远古守护血统的关键。真正想要她死的人，不止继母和嫡姐，还有觊觎王庭与战神血脉的幕后主使。高潮发生在万族盟会上，月绾音故技重施，想当众揭开月清璎“血脉不洁”的罪名，并借阵法夺走她腹中灵胎。月清璎却提前布下反制，将前世今生所有证据、公文、禁术残卷和证人一并呈到众族面前，彻底揭露兔族主母多年以亲女换命、以庶女祭阵的罪行。裴砚骁则率边军当庭护妻，以战神名义宣布谁敢动她，便视作对整个虎族宣战。在阵法崩裂、神息回涌的瞬间，月清璎终于不再只是被保护的人，她以自身血脉稳定失控灵阵，救下诸族幼崽，也为自己和腹中的孩子争出一个真正被尊重的位置。这个故事融合了重生复仇、先婚后爱、兽世权谋与萌宝孕宠等强情绪元素，核心并非“她靠怀孕上位”，而是一个曾被当作工具的女孩，如何借第二次人生重新定义爱、力量与命运。月清璎会一步步从被牺牲的庶女，成长为能够左右各族格局的守护者；而裴砚骁也会从人人畏惧的冷面战将，变成甘愿把软肋与王权都交到她手里的偏爱疯批。最后，她不再求谁怜惜，而是让所有人记住，奶兔也能长出最锋利的獠牙。`,
];

const VIDEO_CREATION_CARDS = [
  {
    id: 'comic',
    title: 'AI短剧创作',
    badge: '核心入口',
    description: '围绕剧本解析、角色场景生成、分镜出片的一体化AI短剧工作流',
    cover: 'https://picsum.photos/seed/create-comic/900/500',
    enter: true,
  },
  {
    id: 'canvas-flow',
    title: '画布流程',
    badge: '新入口',
    description: '以画布视角串联项目创建、剧本设定与分镜成片，适合快速梳理制作链路',
    cover: 'https://picsum.photos/seed/canvas-flow/900/500',
    enter: true,
    entryType: 'canvas',
  },
];

const SCRIPT_CREATION_CARDS = [
  {
    id: 'extract-script',
    title: 'AI剧本提取',
    badge: '推荐',
    description: '上传小说或原始文本，自动提取可编辑的短剧分集剧本',
    tone: 'violet',
    available: true,
  },
];

function formatTime() {
  return new Date().toLocaleString();
}

function normalizeStoryboardVideoDuration(value) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue)) {
    return STORYBOARD_VIDEO_DURATION_DEFAULT;
  }

  return Math.min(
    STORYBOARD_VIDEO_DURATION_MAX,
    Math.max(STORYBOARD_VIDEO_DURATION_MIN, parsedValue),
  );
}

function isStoryboardVideoDurationOutOfRange(value) {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue)) {
    return false;
  }

  return (
    parsedValue < STORYBOARD_VIDEO_DURATION_MIN ||
    parsedValue > STORYBOARD_VIDEO_DURATION_MAX
  );
}

function buildStoryboardVideoBatchQuoteParams(storyboards = []) {
  const storyboardParams = (Array.isArray(storyboards) ? storyboards : [])
    .filter(Boolean)
    .map((storyboard) => {
      const storyboardId = normalizeEntityId(storyboard?.id);
      const duration = normalizeStoryboardVideoDuration(storyboard?.videoDuration);

      return {
        storyboardId,
        storyboard_id: storyboardId,
        prompt: storyboard?.videoPrompt || storyboard?.description || '',
        duration,
        duration_seconds: duration,
        hasImage: Boolean(storyboard?.firstImage),
        has_image: Boolean(storyboard?.firstImage),
      };
    })
    .filter((storyboard) => storyboard.storyboardId);

  const totalDuration = storyboardParams.reduce((total, storyboard) => total + storyboard.duration, 0);
  const averageDuration =
    storyboardParams.length > 0 ? totalDuration / storyboardParams.length : STORYBOARD_VIDEO_DURATION_DEFAULT;

  return {
    count: storyboardParams.length,
    storyboardCount: storyboardParams.length,
    storyboard_count: storyboardParams.length,
    storyboardIds: storyboardParams.map((storyboard) => storyboard.storyboardId),
    storyboard_ids: storyboardParams.map((storyboard) => storyboard.storyboardId),
    durations: storyboardParams.map((storyboard) => storyboard.duration),
    duration_seconds_list: storyboardParams.map((storyboard) => storyboard.duration),
    duration: averageDuration,
    averageDuration,
    average_duration: averageDuration,
    totalDuration,
    total_duration: totalDuration,
    storyboards: storyboardParams,
  };
}

// 根据选中的视觉风格返回默认封面图。
function normalizeManagedProjectStyles(styleItems = []) {
  if (!Array.isArray(styleItems)) {
    return [];
  }

  return styleItems
    .map((item) => {
      const id = String(item?.style_id ?? item?.id ?? '').trim();
      const styleName = String(item?.style_name ?? '').trim();
      const describeName = String(item?.describe ?? '').trim();
      const legacyName = String(item?.name ?? '').trim();
      const name = styleName || describeName || legacyName;
      const cover = String(item?.image_url ?? item?.cover ?? '').trim();
      if (!id || !name) {
        return null;
      }

      const aliases = Array.from(
        new Set([styleName, describeName, legacyName].filter(Boolean)),
      );

      return { id, name, cover, aliases };
    })
    .filter(Boolean);
}

function findMatchedVisualStyle(styleList = [], styleValue = '') {
  const normalizedValue = String(styleValue || '').trim();
  if (!normalizedValue || !Array.isArray(styleList) || styleList.length === 0) {
    return null;
  }

  return (
    styleList.find((item) =>
      item.id === normalizedValue ||
      item.name === normalizedValue ||
      item.aliases?.includes(normalizedValue),
    ) ||
    null
  );
}

function getStyleCover(styleList = [], styleValue = '') {
  return findMatchedVisualStyle(styleList, styleValue)?.cover || styleList[0]?.cover || defaultProjectCover;
}

function normalizeVoiceGender(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return { key: '', label: '' };
  }

  if (normalized === 'female') {
    return { key: 'female', label: '女' };
  }

  if (normalized === 'male') {
    return { key: 'male', label: '男' };
  }

  if (normalized === 'unknown' || normalized === 'unk') {
    return { key: 'unknown', label: '未知' };
  }

  if (/[男m]/.test(normalized) || normalized.includes('male') || normalized.includes('man') || normalized.includes('boy')) {
    return { key: 'male', label: '男' };
  }

  if (/[女f]/.test(normalized) || normalized.includes('female') || normalized.includes('woman') || normalized.includes('girl')) {
    return { key: 'female', label: '女' };
  }

  return { key: normalized, label: String(value || '').trim() };
}

function normalizeVoiceAge(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return { key: '', label: '' };
  }

  if (normalized === 'unknown' || normalized === 'unk') {
    return { key: 'unknown', label: '未知' };
  }

  if (normalized.includes('adult')) {
    return { key: 'adult', label: '成人' };
  }

  if (normalized.includes('child') || normalized.includes('kid')) {
    return { key: 'child', label: '儿童' };
  }

  if (normalized.includes('cartoon') || normalized.includes('anime')) {
    return { key: 'cartoon', label: '卡通' };
  }

  if (
    normalized.includes('青年') ||
    normalized.includes('young') ||
    normalized.includes('teen') ||
    normalized.includes('youth')
  ) {
    return { key: 'youth', label: '青年' };
  }

  if (normalized.includes('中年') || normalized.includes('middle')) {
    return { key: 'middle', label: '中年' };
  }

  if (
    normalized.includes('老年') ||
    normalized.includes('老人') ||
    normalized.includes('senior') ||
    normalized.includes('elder') ||
    normalized.includes('old')
  ) {
    return { key: 'senior', label: '老年' };
  }

  return { key: normalized, label: String(value || '').trim() };
}

function normalizeVoiceOption(item, index = 0) {
  if (!item) {
    return null;
  }

  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) {
      return null;
    }

    return {
      id: trimmed,
      voiceId: trimmed,
      name: trimmed,
      gender: '',
      genderLabel: '',
      age: '',
      ageLabel: '',
    };
  }

  const voiceId = String(item.voice_id ?? item.id ?? item.code ?? item.voice_code ?? '').trim();
  const name = String(
    item.voice_name ??
    item.name ??
    item.title ??
    item.label ??
    item.display_name ??
    item.voice ??
    voiceId ??
    '',
  ).trim();

  if (!voiceId && !name) {
    return null;
  }

  const genderInfo = normalizeVoiceGender(
    item.gender_label ?? item.gender ?? item.sex_label ?? item.sex ?? item.category_gender ?? '',
  );
  const ageInfo = normalizeVoiceAge(
    item.age_label ?? item.age_group ?? item.age ?? item.stage ?? item.category_age ?? '',
  );

  return {
    id: voiceId || name || `voice-${index + 1}`,
    voiceId: voiceId || name || `voice-${index + 1}`,
    name: name || voiceId || `音色${index + 1}`,
    previewAudioUrl: String(item.preview_audio_url ?? item.previewAudioUrl ?? item.audio_url ?? '').trim(),
    gender: genderInfo.key,
    genderLabel: genderInfo.label,
    age: ageInfo.key,
    ageLabel: ageInfo.label,
  };
}

function normalizeVoiceOptions(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : payload?.voices ||
    payload?.voice_profiles ||
    payload?.profiles ||
    payload?.items ||
    payload?.list ||
    payload?.records ||
    payload?.results ||
    [];

  if (!Array.isArray(candidates)) {
    return [];
  }

  const dedupe = new Set();
  return candidates
    .map((item, index) => normalizeVoiceOption(item, index))
    .filter((item) => {
      if (!item) {
        return false;
      }

      const key = `${item.voiceId}__${item.name}`;
      if (dedupe.has(key)) {
        return false;
      }
      dedupe.add(key);
      return true;
    });
}

function getProjectDefaultStep(project) {
  if (!project) {
    return 1;
  }

  const hasStoryboard = Array.isArray(project.episodes)
    && project.episodes.some((episode) => Array.isArray(episode?.storyboards) && episode.storyboards.length > 0);

  if (hasStoryboard) {
    return 3;
  }

  const parseStatus = String(project.parseStatus || '').trim().toLowerCase();
  const hasParsedScript = parseStatus === 'done' && Array.isArray(project.episodes) && project.episodes.length > 0;

  if (hasParsedScript) {
    return 2;
  }

  return 1;
}

const TASK_POLL_INTERVAL_MS = 3000;
const MESSAGE_HIDE_DURATION_MS = 2500;
const SCRIPT_ANALYSIS_FEATURE_NAME = '剧本解析';
const SCRIPT_ANALYSIS_FEATURE_ALIASES = [
  SCRIPT_ANALYSIS_FEATURE_NAME,
  'script_analysis',
];
const CHARACTER_GENERATION_FEATURE_NAME = '角色生成';
const CHARACTER_GENERATION_FEATURE_ALIASES = [
  CHARACTER_GENERATION_FEATURE_NAME,
  'character_generation',
  'character_image',
  'character_avatar',
];
const SCENE_GENERATION_FEATURE_NAME = '场景生成';
const SCENE_GENERATION_FEATURE_ALIASES = [
  SCENE_GENERATION_FEATURE_NAME,
  'scene_generation',
  'scene_image',
];
const STORYBOARD_GENERATION_FEATURE_NAME = '生成分镜';
const STORYBOARD_GENERATION_FEATURE_ALIASES = [
  STORYBOARD_GENERATION_FEATURE_NAME,
  '分镜规划',
  'storyboard_generation',
  'storyboard_plan',
];
const STORYBOARD_COVER_GENERATION_FEATURE_NAME = '生成首图';
const STORYBOARD_COVER_GENERATION_FEATURE_ALIASES = [
  STORYBOARD_COVER_GENERATION_FEATURE_NAME,
  '分镜首图',
  '生成预览图',
  'storyboard_cover',
];
const STORYBOARD_VIDEO_GENERATION_FEATURE_NAME = '生成视频';
const STORYBOARD_VIDEO_GENERATION_FEATURE_ALIASES = [
  STORYBOARD_VIDEO_GENERATION_FEATURE_NAME,
  '分镜视频',
  'storyboard_video',
];
const MODEL_MEDIA_TYPE_CODES = {
  text: 1,
  image: 2,
  video: 3,
  audio: 4,
};
const MODEL_CAPABILITY_REQUIREMENTS = {
  scriptAnalysis: { input: ['text'], output: ['text', 'json'] },
  storyboardGeneration: { input: ['text'], output: ['text', 'json'] },
  textToImage: { input: ['text'], output: ['image'] },
  imageToImage: { input: ['image'], output: ['image'] },
  textImageToVideo: { input: ['text', 'image'], output: ['video'] },
};
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isSupportedScriptUploadFile(file) {
  const fileName = String(file?.name || '').toLowerCase();
  return SCRIPT_UPLOAD_ALLOWED_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function isFileDragTransfer(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes('Files');
}

function stripFileExtension(fileName = '') {
  return String(fileName || '').trim().replace(/\.[^.]+$/, '');
}

function deriveSampleProjectName(sampleText, index = 0) {
  const safeText = String(sampleText || '').trim();
  const bracketTitleMatch = safeText.match(/^《([^》]+)》/);
  if (bracketTitleMatch?.[1]) {
    return bracketTitleMatch[1].trim();
  }

  return `示例剧本${index + 1}`;
}

function deriveScriptDraftProjectName(scriptDraft) {
  const explicitName = String(scriptDraft?.projectName || '').trim();
  if (explicitName) {
    return explicitName;
  }

  const fileBaseName = stripFileExtension(scriptDraft?.scriptFileName || '');
  if (fileBaseName) {
    return fileBaseName;
  }

  const safeScriptText = String(scriptDraft?.scriptText || '').trim();
  const bracketTitleMatch = safeScriptText.match(/^《([^》]+)》/);
  if (bracketTitleMatch?.[1]) {
    return bracketTitleMatch[1].trim();
  }

  return '';
}

function hasExistingProjectCreationData(project) {
  if (!project || typeof project !== 'object') {
    return false;
  }

  return Boolean(
    String(project.backendProjectId || '').trim() ||
    String(project.scriptText || '').trim() ||
    String(project.scriptFileName || '').trim() ||
    project.scriptUploadFile ||
    String(project.parseStatus || 'idle') !== 'idle' ||
    String(project.analysisTaskId || '').trim() ||
    String(project.analysisErrorMessage || '').trim() ||
    String(project.storyboardStatus || 'idle') !== 'idle' ||
    String(project.storyboardTaskId || '').trim() ||
    String(project.storyboardErrorMessage || '').trim() ||
    (Array.isArray(project.episodes) && project.episodes.length > 0) ||
    (Array.isArray(project.characters) && project.characters.length > 0) ||
    (Array.isArray(project.scenes) && project.scenes.length > 0)
  );
}

function createDefaultConfirmDialogState() {
  return {
    open: false,
    title: '',
    content: '',
    confirmText: '确认',
    cancelText: '取消',
    closeOnConfirm: false,
    onConfirm: null,
    onCancel: null,
  };
}

function createDefaultExportVideoModalState() {
  return {
    open: false,
    selectedEpisodeIds: [],
    isExporting: false,
    statusText: '',
  };
}

function createDefaultImagePreviewState() {
  return {
    open: false,
    title: '',
    url: '',
    alt: '',
  };
}

function createDefaultQuoteState() {
  return {
    loading: false,
    points: null,
    error: '',
  };
}

function createDefaultGenerationQuoteState() {
  return {
    characterSingle: createDefaultQuoteState(),
    characterBatch: createDefaultQuoteState(),
    sceneSingle: createDefaultQuoteState(),
    sceneBatch: createDefaultQuoteState(),
    storyboard: createDefaultQuoteState(),
    storyboardCoverBatch: createDefaultQuoteState(),
    storyboardVideoBatch: createDefaultQuoteState(),
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

const ACTION_BATCH_IMAGES = 'batch:images';
const ACTION_BATCH_VIDEOS = 'batch:videos';
const ACTION_ADD_CHARACTER = 'entity:add-character';
const ACTION_ADD_SCENE = 'entity:add-scene';

const IN_PROGRESS_TASK_STATUSES = new Set([
  'queued',
  'pending',
  'running',
  'processing',
  'in_progress',
  'in-progress',
  'started',
  'generating',
]);

const SUCCESS_TASK_STATUSES = new Set([
  'success',
  'succeeded',
  'done',
  'completed',
  'finished',
]);

const FAILED_TASK_STATUSES = new Set([
  'failed',
  'error',
  'errored',
  'cancelled',
  'canceled',
  'aborted',
  'timeout',
  'timed_out',
  'timed-out',
]);

function normalizeTaskStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isTaskInProgressStatus(status) {
  return IN_PROGRESS_TASK_STATUSES.has(normalizeTaskStatus(status));
}

function isTaskSuccessStatus(status) {
  return SUCCESS_TASK_STATUSES.has(normalizeTaskStatus(status));
}

function isTaskFailedStatus(status) {
  return FAILED_TASK_STATUSES.has(normalizeTaskStatus(status));
}

function createStoryboardMediaError(message, storyboardSnapshot) {
  const error = new Error(message);
  error.storyboardSnapshot = storyboardSnapshot;
  return error;
}

function getEpisodeComposeStatusValue(project) {
  return normalizeTaskStatus(project?.episodeComposeStatus);
}

function getEpisodeComposeTaskIdValue(project) {
  return String(project?.episodeComposeTaskId || '').trim();
}


function resolveBindingId(value) {
  const bindingId = Number(value);
  return Number.isInteger(bindingId) && bindingId > 0 ? bindingId : null;
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

function resolveFeatureModelIdByBindingId(featureModels = [], bindingId) {
  const targetBindingId = resolveBindingId(bindingId);
  if (!targetBindingId) {
    return null;
  }

  const groups = Array.isArray(featureModels) ? featureModels : [];
  for (const group of groups) {
    const models = Array.isArray(group?.models) ? group.models : [];
    const matchedModel = models.find((model) => resolveBindingId(model?.binding_id) === targetBindingId);
    const modelId = normalizePointsValue(
      matchedModel?.model_id ??
        matchedModel?.modelId ??
        matchedModel?.universal_model_id ??
        matchedModel?.universalModelId ??
        matchedModel?.ai_model_id ??
        matchedModel?.aiModelId ??
        matchedModel?.id,
    );
    if (Number.isInteger(modelId) && modelId > 0) {
      return modelId;
    }
  }

  return targetBindingId;
}

function pickFeatureModelArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of ['items', 'data', 'list', 'models', 'feature_models', 'featureModels']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function parseMaybeJsonArray(value) {
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

function normalizeModelMediaType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const codeMap = {
    1: 'text',
    text: 'text',
    txt: 'text',
    json: 'json',
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

  return codeMap[normalized] || normalized;
}

function normalizeModelInputMediaTypes(model) {
  return parseMaybeJsonArray(
    model?.input_media_types_json ?? model?.inputMediaTypesJson ?? model?.input_media_types ?? model?.inputMediaTypes,
  )
    .map((item) => {
      if (typeof item === 'number') {
        return normalizeModelMediaType(item);
      }

      const normalized = normalizeModelMediaType(item);
      return normalized || normalizeModelMediaType(MODEL_MEDIA_TYPE_CODES[normalized]);
    })
    .filter(Boolean);
}

function hasUnifiedModelCapabilityFields(model) {
  return Boolean(
    model &&
      typeof model === 'object' &&
      (
        model.output_media_type != null ||
        model.outputMediaType != null ||
        model.input_media_types_json != null ||
        model.inputMediaTypesJson != null ||
        model.max_image_inputs != null ||
        model.maxImageInputs != null ||
        model.max_video_inputs != null ||
        model.maxVideoInputs != null ||
        model.parameter_schema_json != null ||
        model.parameterSchemaJson != null ||
        model.request_model != null ||
        model.requestModel != null
      ),
  );
}

function isFeatureModelAvailableFor(model, requirement) {
  if (!requirement || !hasUnifiedModelCapabilityFields(model)) {
    return true;
  }

  const outputType = normalizeModelMediaType(
    model?.output_media_type ?? model?.outputMediaType ?? model?.media_type ?? model?.mediaType,
  );
  const inputTypes = normalizeModelInputMediaTypes(model);
  const outputMatches = requirement.output.includes(outputType);
  const inputMatches = requirement.input.every((type) => inputTypes.includes(type));

  return outputMatches && inputMatches;
}

function getFeatureModelLabel(model, bindingId) {
  return String(
    model?.display_name ??
      model?.displayName ??
      model?.model_name ??
      model?.modelName ??
      model?.name ??
      model?.request_model ??
      model?.requestModel ??
      model?.model_code ??
      model?.modelCode ??
      `绑定模型 ${bindingId}`,
  ).trim();
}

function toFeatureModelOptions(models = []) {
  return models.reduce((items, model) => {
    const bindingId = resolveBindingId(model?.binding_id);
    if (!bindingId) {
      return items;
    }

    items.push({
      value: String(bindingId),
      label: getFeatureModelLabel(model, bindingId),
    });
    return items;
  }, []);
}

function resolveFeatureModelsByName(featureModels = [], featureName = '') {
  if (!Array.isArray(featureModels) || !featureName) {
    return [];
  }

  const normalizedFeatureName = String(featureName);
  const feature = featureModels.find(
    (item) =>
      String(item?.feature_name || '') === normalizedFeatureName ||
      String(item?.feature_key || '') === normalizedFeatureName,
  );

  return Array.isArray(feature?.models) ? feature.models : [];
}

function resolveFeatureModelsByNames(featureModels = [], featureNames = []) {
  if (!Array.isArray(featureNames) || featureNames.length === 0) {
    return [];
  }

  for (const featureName of featureNames) {
    const models = resolveFeatureModelsByName(featureModels, featureName);
    if (models.length > 0) {
      return models;
    }
  }

  return [];
}

function filterFeatureModelsByCapability(models = [], requirement) {
  return models.filter((model) => isFeatureModelAvailableFor(model, requirement));
}

function resolveScriptAnalysisBindingId(featureModels = []) {
  const models = resolveFeatureModelsByNames(featureModels, SCRIPT_ANALYSIS_FEATURE_ALIASES);
  const availableModels = filterFeatureModelsByCapability(models, MODEL_CAPABILITY_REQUIREMENTS.scriptAnalysis);
  return resolveBindingId(availableModels[0]?.binding_id);
}

function getEpisodeDisplayLabel(episode, index = 0) {
  const episodeNo = Number(episode?.episodeNo);


  if (Number.isInteger(episodeNo) && episodeNo > 0) {
    return `第${episodeNo}集`;
  }

  return `第${index + 1}集`;
}

function getStoryboardVideoUrl(storyboard) {
  return String(storyboard?.video?.url || '').trim();
}

function resolveStoryboardGenerationBindingId(featureModels = []) {
  const models = resolveFeatureModelsByNames(featureModels, STORYBOARD_GENERATION_FEATURE_ALIASES);
  const availableModels = filterFeatureModelsByCapability(models, MODEL_CAPABILITY_REQUIREMENTS.storyboardGeneration);
  return resolveBindingId(availableModels[0]?.binding_id);
}

function hasPendingStoryboardMediaTasks(project) {



  if (!project || !Array.isArray(project.episodes)) {
    return false;
  }

  return project.episodes.some((episode) =>
    (episode.storyboards || []).some(
      (storyboard) =>
        isTaskInProgressStatus(storyboard.coverStatus) || isTaskInProgressStatus(storyboard.videoStatus),
    ),
  );
}

function hasPendingProjectAsyncTasks(project) {
  if (!project) {
    return false;
  }

  const parseStatus = String(project.parseStatus || '').trim().toLowerCase();
  const hasPendingAnalysis = parseStatus === 'parsing' || isTaskInProgressStatus(parseStatus);
  const hasPendingStoryboardPipeline = isTaskInProgressStatus(project.storyboardStatus);
  const hasPendingStoryboardCoverBatch = isTaskInProgressStatus(project.storyboardCoverBatchStatus);
  const hasPendingCharacterAssets = Array.isArray(project.characters)
    ? project.characters.some((character) => isTaskInProgressStatus(character?.avatarStatus))
    : false;
  const hasPendingSceneAssets = Array.isArray(project.scenes)
    ? project.scenes.some((scene) => isTaskInProgressStatus(scene?.imageStatus))
    : false;

  return (
    hasPendingAnalysis ||
    hasPendingStoryboardPipeline ||
    hasPendingStoryboardCoverBatch ||
    hasPendingCharacterAssets ||
    hasPendingSceneAssets
  );
}

function getRemoveCharacterActionKey(characterId) {
  return `entity:remove-character:${characterId || 'unknown'}`;
}

function getRemoveSceneActionKey(sceneId) {
  return `entity:remove-scene:${sceneId || 'unknown'}`;
}

function getUploadCharacterAvatarActionKey(characterId) {
  return `entity:upload-character-avatar:${characterId || 'unknown'}`;
}

function getRegenerateCharacterAvatarActionKey(characterId) {
  return `entity:regenerate-character-avatar:${characterId || 'unknown'}`;
}

function getUpdateCharacterActionKey(characterId) {
  return `entity:update-character:${characterId || 'unknown'}`;
}

function getUploadSceneImageActionKey(sceneId) {
  return `entity:upload-scene-image:${sceneId || 'unknown'}`;
}

function getRegenerateSceneImageActionKey(sceneId) {
  return `entity:regenerate-scene-image:${sceneId || 'unknown'}`;
}

function getUpdateSceneActionKey(sceneId) {
  return `entity:update-scene:${sceneId || 'unknown'}`;
}

function isCharacterAvatarReady(character) {
  if (!character) {
    return false;
  }

  return Boolean(String(character.avatarUrl || '').trim());
}

function isSceneImageReady(scene) {
  if (!scene) {
    return false;
  }

  return Boolean(String(scene.imageUrl || '').trim());
}

function handleStyleCoverError(event) {
  const nextTarget = event?.currentTarget;
  if (!nextTarget || nextTarget.dataset.fallbackApplied === 'true') {
    return;
  }

  nextTarget.dataset.fallbackApplied = 'true';
  nextTarget.src = defaultProjectCover;
}

function getUpdateStoryboardInfoActionKey(storyboardId) {
  return `storyboard:update:${storyboardId || 'unknown'}`;
}

function getUpdateEpisodeScriptActionKey(episodeId) {
  return `episode:update-script:${episodeId || 'unknown'}`;
}

function getRemoveStoryboardActionKey(storyboardId) {
  return `storyboard:remove:${storyboardId || 'unknown'}`;
}

function getReorderStoryboardsActionKey(episodeId) {
  return `storyboard:reorder:${episodeId || 'unknown'}`;
}

function getGenerateFirstImageActionKey(storyboardId) {
  return `image:generate:${storyboardId || 'unknown'}`;
}

function getUploadFirstImageActionKey(storyboardId) {
  return `image:upload:${storyboardId || 'unknown'}`;
}

function getGenerateVideoActionKey(storyboardId) {
  return `video:generate:${storyboardId || 'unknown'}`;
}

function getUpdateStoryboardVideoDurationActionKey(storyboardId) {
  return `storyboard:update-video-duration:${storyboardId || 'unknown'}`;
}

function normalizeEntityId(value) {
  return String(value ?? '').trim();
}

function buildStoryboardDisplayTitle(shotNo) {
  const normalizedShotNo = Number(shotNo);
  return `分镜 ${Number.isFinite(normalizedShotNo) && normalizedShotNo > 0 ? normalizedShotNo : 1}`;
}

function getStoryboardSortOrderValue(storyboard) {
  const normalizedSortOrder = Number(storyboard?.sortOrder ?? storyboard?.sort_order);
  if (Number.isFinite(normalizedSortOrder)) {
    return normalizedSortOrder;
  }

  const normalizedShotNo = Number(storyboard?.shotNo ?? storyboard?.shot_no);
  if (Number.isFinite(normalizedShotNo)) {
    return normalizedShotNo;
  }

  return null;
}

function normalizeStoryboardSequence(storyboards = [], options = {}) {
  const { syncSortOrder = false } = options;
  if (!Array.isArray(storyboards)) {
    return [];
  }

  return storyboards.map((storyboard, index) => {
    const nextShotNo = index + 1;
    return {
      ...storyboard,
      shotNo: nextShotNo,
      title: buildStoryboardDisplayTitle(nextShotNo),
      ...(syncSortOrder ? { sortOrder: nextShotNo } : {}),
    };
  });
}

function reorderStoryboards(storyboards = [], sourceStoryboardId, targetStoryboardId) {
  if (!Array.isArray(storyboards) || storyboards.length === 0) {
    return null;
  }

  const normalizedSourceId = normalizeEntityId(sourceStoryboardId);
  const normalizedTargetId = normalizeEntityId(targetStoryboardId);
  if (!normalizedSourceId || !normalizedTargetId || normalizedSourceId === normalizedTargetId) {
    return null;
  }

  const sourceIndex = storyboards.findIndex(
    (storyboard) => normalizeEntityId(storyboard?.id) === normalizedSourceId,
  );
  const targetIndex = storyboards.findIndex(
    (storyboard) => normalizeEntityId(storyboard?.id) === normalizedTargetId,
  );
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return null;
  }

  const nextStoryboards = [...storyboards];
  const [movedStoryboard] = nextStoryboards.splice(sourceIndex, 1);
  nextStoryboards.splice(targetIndex, 0, movedStoryboard);

  return nextStoryboards;
}

function buildStoryboardReorderPayload(storyboards = [], movingStoryboardId) {
  if (!Array.isArray(storyboards) || storyboards.length === 0) {
    return null;
  }

  const normalizedMovingStoryboardId = normalizeEntityId(movingStoryboardId);
  if (!normalizedMovingStoryboardId) {
    return null;
  }

  const movingStoryboardIndex = storyboards.findIndex(
    (storyboard) => normalizeEntityId(storyboard?.id) === normalizedMovingStoryboardId,
  );
  if (movingStoryboardIndex === -1) {
    return null;
  }

  const movingStoryboard = storyboards[movingStoryboardIndex];
  const afterStoryboard = movingStoryboardIndex > 0 ? storyboards[movingStoryboardIndex - 1] : null;

  return {
    moving_shot_id: normalizedMovingStoryboardId,
    moving_sort_order: getStoryboardSortOrderValue(movingStoryboard),
    after_shot_id: afterStoryboard ? normalizeEntityId(afterStoryboard.id) || null : null,
    after_sort_order: afterStoryboard ? getStoryboardSortOrderValue(afterStoryboard) : null,
  };
}

function normalizeStoryboardPresentCharacterEntry(entry, fallbackCharacterId = '') {
  const normalizedCharacterId = normalizeEntityId(
    entry?.characterId ?? entry?.character_id ?? fallbackCharacterId,
  );
  if (!normalizedCharacterId) {
    return null;
  }

  const normalizedPresentId = normalizeEntityId(
    entry?.presentId ?? entry?.present_id ?? entry?.id,
  );

  return {
    id: normalizedPresentId || normalizedCharacterId,
    presentId: normalizedPresentId,
    characterId: normalizedCharacterId,
    characterAction: String(entry?.characterAction ?? entry?.character_action ?? '').trim(),
    characterPosition: String(entry?.characterPosition ?? entry?.character_position ?? '').trim(),
  };
}

function getStoryboardPresentCharacters(storyboard) {
  const nextPresentCharacters = Array.isArray(storyboard?.presentCharacters)
    ? storyboard.presentCharacters
      .map((item) => normalizeStoryboardPresentCharacterEntry(item))
      .filter(Boolean)
    : [];

  if (nextPresentCharacters.length > 0) {
    const seenKeys = new Set();
    return nextPresentCharacters.filter((item) => {
      const dedupeKey = item.presentId || item.characterId;
      if (!dedupeKey || seenKeys.has(dedupeKey)) {
        return false;
      }
      seenKeys.add(dedupeKey);
      return true;
    });
  }

  if (Array.isArray(storyboard?.presentCharacterIds)) {
    return Array.from(
      new Set(
        storyboard.presentCharacterIds
          .map((value) => normalizeEntityId(value))
          .filter(Boolean),
      ),
    ).map((characterId) => ({
      id: characterId,
      presentId: '',
      characterId,
      characterAction: '',
      characterPosition: '',
    }));
  }

  return [];
}

function getStoryboardPresentCharacterIds(storyboard) {
  return Array.from(
    new Set(
      getStoryboardPresentCharacters(storyboard)
        .map((item) => normalizeEntityId(item.characterId))
        .filter(Boolean),
    ),
  );
}

// 创作主页面：首页入口 + 三步工作流。
function CreationPage({
  projects,
  activeProject,
  onCreateProject,
  onUpdateProject,
  onLayoutModeChange,
  routeMode = false,
  initialViewMode = 'home',
  onRequestHome,
  onRequestCreation,
  onRequestWorkflow,
  onPointsChanged,
  availablePoints,
}) {
  const location = useLocation();
  const [viewMode, setViewMode] = useState(initialViewMode);
  const effectiveViewMode = activeProject ? viewMode : 'home';
  const [activeStep, setActiveStep] = useState(() => getProjectDefaultStep(activeProject));
  const [activeSettingTab, setActiveSettingTab] = useState('script');

  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [collapsedStoryboardIds, setCollapsedStoryboardIds] = useState(() => new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [settingQuote, setSettingQuote] = useState({
    loading: false,
    points: null,
    error: '',
  });
  const [generationQuotes, setGenerationQuotes] = useState(createDefaultGenerationQuoteState);
  const [storyboardCoverQuotes, setStoryboardCoverQuotes] = useState({});
  const [storyboardVideoQuotes, setStoryboardVideoQuotes] = useState({});
  const [isGeneratingCharacterAssets, setIsGeneratingCharacterAssets] = useState(false);
  const [isGeneratingSceneAssets, setIsGeneratingSceneAssets] = useState(false);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isConfirmingDialog, setIsConfirmingDialog] = useState(false);
  const [characterConfigModal, setCharacterConfigModal] = useState({
    open: false,
    characterId: '',
  });
  const [characterConfigDraft, setCharacterConfigDraft] = useState(null);
  const [sceneConfigModal, setSceneConfigModal] = useState({
    open: false,
    sceneId: '',
  });
  const [exportVideoModal, setExportVideoModal] = useState(createDefaultExportVideoModalState);
  const [downloadComposeTaskId, setDownloadComposeTaskId] = useState('');
  const [imagePreview, setImagePreview] = useState(createDefaultImagePreviewState);
  const [selectedCharacterAssetId, setSelectedCharacterAssetId] = useState('');
  const [characterAvatarUploadTargetId, setCharacterAvatarUploadTargetId] = useState('');
  const [selectedSceneAssetId, setSelectedSceneAssetId] = useState('');
  const [sceneImageUploadTargetId, setSceneImageUploadTargetId] = useState('');
  const [batchStoryboardCoverBindingId, setBatchStoryboardCoverBindingId] = useState('');
  const [batchStoryboardVideoBindingId, setBatchStoryboardVideoBindingId] = useState('');
  const [messageState, setMessageState] = useState({
    visible: false,
    text: '',
    type: 'info',
  });
  const [pointsTip, setPointsTip] = useState(createDefaultPointsTipState);
  const [confirmDialog, setConfirmDialog] = useState(createDefaultConfirmDialogState);
  const messageTimerRef = useRef(0);
  const pointsTipTargetRef = useRef(null);
  const characterAvatarUploadInputRef = useRef(null);
  const sceneImageUploadInputRef = useRef(null);
  const characterAvatarUploadTargetIdRef = useRef('');
  const sceneImageUploadTargetIdRef = useRef('');
  const latestProjectRef = useRef(activeProject);
  const featureModelsConfigRef = useRef([]);
  const [featureModelsConfig, setFeatureModelsConfig] = useState([]);
  const managedProjectStylesRef = useRef([]);
  const [managedProjectStyles, setManagedProjectStyles] = useState([]);
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [draggingStoryboardId, setDraggingStoryboardId] = useState('');
  const [storyboardDropTargetId, setStoryboardDropTargetId] = useState('');
  const [storyboardDragLayerStyle, setStoryboardDragLayerStyle] = useState(null);
  const [isScriptUploadDragging, setIsScriptUploadDragging] = useState(false);

  const pendingActionKeysRef = useRef(new Set());
  const serialUpdateQueueRef = useRef(new Map());
  const storyboardCoverQuoteSignaturesRef = useRef({});
  const storyboardVideoQuoteSignaturesRef = useRef({});
  const scriptUploadDragDepthRef = useRef(0);
  const storyboardDragSessionRef = useRef({
    episodeId: '',
    pressedStoryboardId: '',
    draggingStoryboardId: '',
    overStoryboardId: '',
    hasReordered: false,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    width: 0,
    height: 64,
  });
  const storyboardDragOrderRef = useRef({
    episodeId: '',
    storyboards: [],
    originalStoryboards: [],
  });
  const finalizeStoryboardDragSessionRef = useRef(() => { });
  const [, forcePendingActionRender] = useState(0);
  latestProjectRef.current = activeProject;

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
    setMessageState({
      visible: true,
      text,
      type,
    });
    messageTimerRef.current = window.setTimeout(() => {
      setMessageState((current) => ({
        ...current,
        visible: false,
      }));
      messageTimerRef.current = 0;
    }, MESSAGE_HIDE_DURATION_MS);
  }

  function refreshStoryboardVideoQuoteForDuration(storyboardId, duration) {
    const storyboardForQuote = getProjectStoryboardById(storyboardId);
    if (!storyboardForQuote) {
      return;
    }

    void refreshStoryboardVideoQuote({
      ...storyboardForQuote,
      videoDuration: normalizeStoryboardVideoDuration(duration),
    });
  }

  async function handleStoryboardVideoDurationBlur(episodeId, storyboardId, currentValue) {
    if (isStoryboardVideoDurationOutOfRange(currentValue)) {
      showMessage('视频时间范围 5-15 秒', 'warning');
    }

    const normalizedDuration = normalizeStoryboardVideoDuration(currentValue);
    updateStoryboard(episodeId, storyboardId, (current) => ({
      ...current,
      videoDuration: normalizedDuration,
    }));
    refreshStoryboardVideoQuoteForDuration(storyboardId, normalizedDuration);

    if (!activeProject?.backendProjectId || !storyboardId) {
      return;
    }

    await withActionPending(
      getUpdateStoryboardVideoDurationActionKey(storyboardId),
      async () => {
        try {
          await storyboardApi.updateProjectStoryboardVideoDuration(
            activeProject.backendProjectId,
            storyboardId,
            { duration: normalizedDuration },
          );
        } catch (error) {
          showMessage(parseApiErrorMessage(error, '分镜视频时长更新失败'), 'error');
        }
      },
      '分镜视频时长保存中，请稍候',
    );
  }

  function openConfirmDialog(options) {
    setIsConfirmingDialog(false);
    setConfirmDialog({
      open: true,
      title: options.title || '提示',
      content: options.content || '',
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      closeOnConfirm: options.closeOnConfirm === true,
      onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null,
      onCancel: typeof options.onCancel === 'function' ? options.onCancel : null,
    });
  }

  function closeConfirmDialog() {
    if (isConfirmingDialog) {
      return;
    }
    const cancelAction = confirmDialog.onCancel;
    setIsConfirmingDialog(false);
    setConfirmDialog(createDefaultConfirmDialogState());
    if (typeof cancelAction === 'function') {
      cancelAction();
    }
  }

  function openImagePreview(options) {
    const imageUrl = String(options?.url || '').trim();
    if (!imageUrl) {
      return;
    }

    setImagePreview({
      open: true,
      title: String(options?.title || '图片预览').trim() || '图片预览',
      url: imageUrl,
      alt: String(options?.alt || options?.title || '图片预览').trim() || '图片预览',
    });
  }

  function closeImagePreview() {
    setImagePreview(createDefaultImagePreviewState());
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

  async function handleConfirmDialogConfirm() {
    if (isConfirmingDialog) {
      return;
    }
    const shouldCloseOnConfirm = confirmDialog.closeOnConfirm === true;
    const action = confirmDialog.onConfirm;
    if (!action) {
      closeConfirmDialog();
      return;
    }

    setIsConfirmingDialog(true);
    if (shouldCloseOnConfirm) {
      setConfirmDialog(createDefaultConfirmDialogState());
    }
    try {
      await action();
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '操作失败'), 'error');
    } finally {
      setIsConfirmingDialog(false);
      if (!shouldCloseOnConfirm) {
        setConfirmDialog(createDefaultConfirmDialogState());
      }
    }
  }

  function markActionPending(actionKey, pending) {
    if (!actionKey) {
      return false;
    }

    const pendingKeys = pendingActionKeysRef.current;
    if (pending) {
      if (pendingKeys.has(actionKey)) {
        return false;
      }
      pendingKeys.add(actionKey);
    } else if (pendingKeys.has(actionKey)) {
      pendingKeys.delete(actionKey);
    } else {
      return false;
    }

    forcePendingActionRender((count) => count + 1);
    return true;
  }

  function isActionPending(actionKey) {
    if (!actionKey) {
      return false;
    }
    return pendingActionKeysRef.current.has(actionKey);
  }

  function getEpisodeStoryboards(episodeId) {
    return (latestProjectRef.current?.episodes || []).find((episode) => episode.id === episodeId)?.storyboards || [];
  }

  function collapseStoryboardsForDrag(episodeId) {
    const storyboardIds = getEpisodeStoryboards(episodeId)
      .map((storyboard) => normalizeEntityId(storyboard?.id))
      .filter(Boolean);

    if (storyboardIds.length === 0) {
      return;
    }

    setCollapsedStoryboardIds(() => new Set(storyboardIds));
  }

  function finalizeStoryboardDragSession() {
    const dragSession = storyboardDragSessionRef.current;
    const draftStoryboards =
      storyboardDragOrderRef.current.episodeId === dragSession.episodeId
        ? storyboardDragOrderRef.current.storyboards
        : [];
    const originalStoryboards =
      storyboardDragOrderRef.current.episodeId === dragSession.episodeId
        ? storyboardDragOrderRef.current.originalStoryboards
        : [];
    const projectId = (latestProjectRef.current || activeProject)?.backendProjectId || '';
    const reorderPayload =
      dragSession.hasReordered && draftStoryboards.length > 0
        ? buildStoryboardReorderPayload(draftStoryboards, dragSession.draggingStoryboardId)
        : null;
    if (dragSession.hasReordered && dragSession.episodeId && draftStoryboards.length > 0) {
      const finalizedStoryboards = normalizeStoryboardSequence(draftStoryboards, {
        syncSortOrder: Boolean(projectId),
      });
      updateEpisode(dragSession.episodeId, (episode) => ({
        ...episode,
        storyboards: finalizedStoryboards,
      }));
    }

    storyboardDragSessionRef.current = {
      episodeId: '',
      pressedStoryboardId: '',
      draggingStoryboardId: '',
      overStoryboardId: '',
      hasReordered: false,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      width: 0,
      height: 64,
    };
    storyboardDragOrderRef.current = {
      episodeId: '',
      storyboards: [],
      originalStoryboards: [],
    };
    setDraggingStoryboardId('');
    setStoryboardDropTargetId('');
    setStoryboardDragLayerStyle(null);
    setCollapsedStoryboardIds(() => new Set());
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    if (projectId && dragSession.hasReordered && reorderPayload) {
      void syncStoryboardReorder(
        dragSession.episodeId,
        reorderPayload,
        originalStoryboards,
      );
    }
  }

  function clearStoryboardDragHoverTarget() {
    const dragSession = storyboardDragSessionRef.current;
    if (!dragSession.pressedStoryboardId && !dragSession.overStoryboardId) {
      return;
    }

    storyboardDragSessionRef.current = {
      ...dragSession,
      overStoryboardId: '',
    };
    setStoryboardDropTargetId('');
  }

  async function syncStoryboardReorder(episodeId, reorderPayload, fallbackStoryboards = []) {
    const projectId = (latestProjectRef.current || activeProject)?.backendProjectId || '';
    if (!projectId || !episodeId || !reorderPayload?.moving_shot_id) {
      return;
    }

    const actionKey = getReorderStoryboardsActionKey(episodeId);
    try {
      await withActionPending(
        actionKey,
        async () => {
          try {
            await storyboardApi.reorderProjectStoryboards(projectId, reorderPayload);
          } catch (error) {
            if (Array.isArray(fallbackStoryboards) && fallbackStoryboards.length > 0) {
              updateEpisode(episodeId, (episode) => ({
                ...episode,
                storyboards: fallbackStoryboards,
              }));
            }
            throw error;
          }
        },
        '分镜顺序同步中，请稍候',
      );
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '更新分镜顺序失败'), 'error');
    }
  }

  function handleStoryboardCardPointerMove(episodeId, targetStoryboardId) {
    const dragSession = storyboardDragSessionRef.current;
    if (!dragSession.draggingStoryboardId || dragSession.episodeId !== episodeId) {
      return;
    }

    const normalizedTargetStoryboardId = normalizeEntityId(targetStoryboardId);
    if (
      !normalizedTargetStoryboardId ||
      dragSession.draggingStoryboardId === normalizedTargetStoryboardId ||
      dragSession.overStoryboardId === normalizedTargetStoryboardId
    ) {
      return;
    }

    const sourceStoryboards =
      storyboardDragOrderRef.current.episodeId === episodeId
        ? storyboardDragOrderRef.current.storyboards
        : getEpisodeStoryboards(episodeId);
    const reorderedStoryboards = reorderStoryboards(
      sourceStoryboards,
      dragSession.draggingStoryboardId,
      normalizedTargetStoryboardId,
    );
    if (!reorderedStoryboards) {
      return;
    }

    storyboardDragSessionRef.current = {
      ...dragSession,
      overStoryboardId: normalizedTargetStoryboardId,
      hasReordered: true,
    };
    storyboardDragOrderRef.current = {
      episodeId,
      storyboards: reorderedStoryboards,
    };
    setStoryboardDropTargetId(normalizedTargetStoryboardId);
    updateEpisode(episodeId, (episode) => ({
      ...episode,
      storyboards: reorderedStoryboards,
    }));
  }

  function handleStoryboardTitleMouseDown(episodeId, storyboardId, event) {
    if (event.button !== 0) {
      return;
    }

    if (isActionPending(getReorderStoryboardsActionKey(episodeId))) {
      showMessage('分镜顺序同步中，请稍候', 'info');
      return;
    }

    const normalizedStoryboardId = normalizeEntityId(storyboardId);
    const storyboards = getEpisodeStoryboards(episodeId);
    const dragCard = event.currentTarget.closest('article');
    if (!normalizedStoryboardId || storyboards.length === 0 || !dragCard) {
      return;
    }

    event.preventDefault();
    collapseStoryboardsForDrag(episodeId);

    const dragCardRect = dragCard.getBoundingClientRect();
    const layerHeight = 64;
    storyboardDragSessionRef.current = {
      episodeId,
      pressedStoryboardId: normalizedStoryboardId,
      draggingStoryboardId: normalizedStoryboardId,
      overStoryboardId: normalizedStoryboardId,
      hasReordered: false,
      pointerOffsetX: event.clientX - dragCardRect.left,
      pointerOffsetY: Math.min(Math.max(event.clientY - dragCardRect.top, 0), layerHeight - 1),
      width: dragCardRect.width,
      height: layerHeight,
    };
    storyboardDragOrderRef.current = {
      episodeId,
      storyboards: [...storyboards],
      originalStoryboards: [...storyboards],
    };
    setDraggingStoryboardId(normalizedStoryboardId);
    setStoryboardDropTargetId('');
    setStoryboardDragLayerStyle({
      left: dragCardRect.left,
      top: dragCardRect.top,
      width: dragCardRect.width,
      height: layerHeight,
    });
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  finalizeStoryboardDragSessionRef.current = finalizeStoryboardDragSession;

  async function withActionPending(actionKey, action, waitingMessage = '操作进行中，请稍候') {
    if (!markActionPending(actionKey, true)) {
      showMessage(waitingMessage, 'info');
      return false;
    }

    try {
      await action();
      return true;
    } finally {
      markActionPending(actionKey, false);
    }
  }

  async function confirmPointsBeforeGeneration(actionKey, confirmOptions, errorFallback = '积分校验失败') {
    let canGenerate = false;

    try {
      const submitted = await withActionPending(
        `${actionKey}:points-confirm`,
        async () => {
          canGenerate = await confirmPointsForGeneration(confirmOptions);
        },
        '积分确认中，请稍候',
      );

      return Boolean(submitted && canGenerate);
    } catch (error) {
      showMessage(parseApiErrorMessage(error, errorFallback), 'error');
      return false;
    }
  }

  async function confirmPointsForGeneration({
    bindingId,
    title = '确认消耗积分',
    actionName = '本次生成',
    params = {},
  }) {
    hidePointsTip(pointsTipTargetRef.current);
    const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, bindingId);
    if (!modelId) {
      throw new Error('未找到积分报价模型，请检查 feature-models 配置');
    }

    const quote = await pointsApi.quote({
      modelId,
      params,
    });
    const points = resolveQuotePoints(quote);
    if (points == null) {
      throw new Error('积分报价失败：接口未返回预计消耗积分');
    }

    const wallet = await pointsApi.getWallet();
    const availablePoints = resolveWalletAvailablePoints(wallet);
    if (availablePoints == null) {
      throw new Error('积分校验失败：接口未返回可用积分');
    }

    if (availablePoints < points) {
      showMessage(
        `${actionName}预计消耗 ${formatPointsValue(points)} 积分，当前可用 ${formatPointsValue(availablePoints)} 积分，积分不足`,
        'warning',
      );
      return false;
    }

    const confirmed = await new Promise((resolve) => {
      openConfirmDialog({
        title,
        content: `${actionName}预计消耗 ${formatPointsValue(points)} 积分，当前可用 ${formatPointsValue(availablePoints)} 积分。是否继续？`,
        confirmText: '确认生成',
        cancelText: '取消',
        closeOnConfirm: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    return confirmed;
  }

  async function refreshPointsAfterGeneration() {
    if (typeof onPointsChanged === 'function') {
      await onPointsChanged();
    }
  }

  function getProjectStoryboardById(storyboardId, projectSnapshot = latestProjectRef.current || activeProject) {
    const normalizedStoryboardId = normalizeEntityId(storyboardId);
    if (!normalizedStoryboardId) {
      return null;
    }

    return (projectSnapshot?.episodes || [])
      .flatMap((episode) => episode.storyboards || [])
      .find((storyboard) => normalizeEntityId(storyboard?.id) === normalizedStoryboardId) || null;
  }

  function buildStoryboardCoverQuoteSpec(storyboard) {
    const storyboardId = normalizeEntityId(storyboard?.id);
    const bindingId = resolveBindingId(activeProject?.modelConfig?.storyboardCoverModel);
    const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, bindingId);
    if (!activeProject?.backendProjectId || !storyboardId || !modelId) {
      return null;
    }

    const params = {
      storyboardId,
      prompt: storyboard.imagePrompt || storyboard.description || '',
      count: 1,
    };

    return {
      storyboardId,
      modelId,
      params,
      signature: JSON.stringify({ modelId, params }),
    };
  }

  function buildStoryboardVideoQuoteSpec(storyboard) {
    const storyboardId = normalizeEntityId(storyboard?.id);
    const bindingId = resolveBindingId(activeProject?.modelConfig?.storyboardVideoModel);
    const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, bindingId);
    if (!activeProject?.backendProjectId || !storyboardId || !modelId) {
      return null;
    }

    const params = {
      storyboardId,
      prompt: storyboard.videoPrompt || storyboard.description || '',
      count: 1,
      duration: normalizeStoryboardVideoDuration(storyboard.videoDuration),
      hasImage: Boolean(storyboard.firstImage),
    };

    return {
      storyboardId,
      modelId,
      params,
      signature: JSON.stringify({ modelId, params }),
    };
  }

  async function refreshStoryboardCoverQuote(storyboard) {
    const quoteSpec = buildStoryboardCoverQuoteSpec(storyboard);
    if (!quoteSpec) {
      return;
    }

    if (storyboardCoverQuoteSignaturesRef.current[quoteSpec.storyboardId] === quoteSpec.signature) {
      return;
    }

    storyboardCoverQuoteSignaturesRef.current[quoteSpec.storyboardId] = quoteSpec.signature;
    setStoryboardCoverQuotes((current) => ({
      ...current,
      [quoteSpec.storyboardId]: {
        ...(current[quoteSpec.storyboardId] || createDefaultQuoteState()),
        loading: true,
        error: '',
      },
    }));

    try {
      const quote = await pointsApi.quote({
        modelId: quoteSpec.modelId,
        params: quoteSpec.params,
      });

      if (storyboardCoverQuoteSignaturesRef.current[quoteSpec.storyboardId] !== quoteSpec.signature) {
        return;
      }

      setStoryboardCoverQuotes((current) => ({
        ...current,
        [quoteSpec.storyboardId]: {
          loading: false,
          points: resolveQuotePoints(quote),
          error: '',
        },
      }));
    } catch (error) {
      if (storyboardCoverQuoteSignaturesRef.current[quoteSpec.storyboardId] !== quoteSpec.signature) {
        return;
      }

      setStoryboardCoverQuotes((current) => ({
        ...current,
        [quoteSpec.storyboardId]: {
          loading: false,
          points: null,
          error: parseApiErrorMessage(error, '积分报价失败'),
        },
      }));
    }
  }

  async function refreshStoryboardVideoQuote(storyboard) {
    const quoteSpec = buildStoryboardVideoQuoteSpec(storyboard);
    if (!quoteSpec) {
      return;
    }

    if (storyboardVideoQuoteSignaturesRef.current[quoteSpec.storyboardId] === quoteSpec.signature) {
      return;
    }

    storyboardVideoQuoteSignaturesRef.current[quoteSpec.storyboardId] = quoteSpec.signature;
    setStoryboardVideoQuotes((current) => ({
      ...current,
      [quoteSpec.storyboardId]: {
        ...(current[quoteSpec.storyboardId] || createDefaultQuoteState()),
        loading: true,
        error: '',
      },
    }));

    try {
      const quote = await pointsApi.quote({
        modelId: quoteSpec.modelId,
        params: quoteSpec.params,
      });

      if (storyboardVideoQuoteSignaturesRef.current[quoteSpec.storyboardId] !== quoteSpec.signature) {
        return;
      }

      setStoryboardVideoQuotes((current) => ({
        ...current,
        [quoteSpec.storyboardId]: {
          loading: false,
          points: resolveQuotePoints(quote),
          error: '',
        },
      }));
    } catch (error) {
      if (storyboardVideoQuoteSignaturesRef.current[quoteSpec.storyboardId] !== quoteSpec.signature) {
        return;
      }

      setStoryboardVideoQuotes((current) => ({
        ...current,
        [quoteSpec.storyboardId]: {
          loading: false,
          points: null,
          error: parseApiErrorMessage(error, '积分报价失败'),
        },
      }));
    }
  }

  useEffect(() => {
    const safeScript = String(activeProject?.scriptText || '').trim();
    const hasScriptUploadFile = Boolean(activeProject?.scriptUploadFile);
    const bindingId = resolveScriptAnalysisBindingId(featureModelsConfigRef.current);
    const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, bindingId);

    if (!activeProject || (!safeScript && !hasScriptUploadFile) || !modelId) {
      setSettingQuote({
        loading: false,
        points: null,
        error: '',
      });
      return undefined;
    }

    let ignored = false;
    const timer = window.setTimeout(() => {
      setSettingQuote((current) => ({
        ...current,
        loading: true,
        error: '',
      }));

      pointsApi.quote({
        modelId,
        params: {
          scriptLength: safeScript.length,
          hasUploadFile: hasScriptUploadFile,
        },
      })
        .then((quote) => {
          if (ignored) {
            return;
          }

          setSettingQuote({
            loading: false,
            points: resolveQuotePoints(quote),
            error: '',
          });
        })
        .catch((error) => {
          if (ignored) {
            return;
          }

          setSettingQuote({
            loading: false,
            points: null,
            error: parseApiErrorMessage(error, '积分报价失败'),
          });
        });
    }, 350);

    return () => {
      ignored = true;
      window.clearTimeout(timer);
    };
  }, [
    activeProject?.id,
    activeProject?.scriptText,
    activeProject?.scriptUploadFile,
    featureModelsConfig,
  ]);

  const maxReachableStep = useMemo(() => getProjectDefaultStep(activeProject), [activeProject]);

  const visibleStep = Math.min(activeStep, maxReachableStep);

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

    const nextText = String(currentTarget.getAttribute('data-points-tip') || '').trim();
    if (nextText && nextText !== pointsTip.text) {
      setPointsTip((current) => ({
        ...current,
        text: nextText,
      }));
    }

    function closeFloatingPointsTip() {
      hidePointsTip(pointsTipTargetRef.current);
    }

    window.addEventListener('scroll', closeFloatingPointsTip, true);
    window.addEventListener('resize', closeFloatingPointsTip);

    return () => {
      window.removeEventListener('scroll', closeFloatingPointsTip, true);
      window.removeEventListener('resize', closeFloatingPointsTip);
    };
  }, [pointsTip.visible, pointsTip.text, storyboardCoverQuotes, storyboardVideoQuotes]);

  useEffect(() => {
    setActiveStep(getProjectDefaultStep(activeProject));
  }, [activeProject?.id]);

  const scriptTabEpisodes = useMemo(
    () => (Array.isArray(activeProject?.episodes) ? activeProject.episodes : []),
    [activeProject?.episodes],
  );

  const selectedEpisode = useMemo(
    () =>
      scriptTabEpisodes.find((episode) => episode.id === selectedEpisodeId) ??
      scriptTabEpisodes[0] ??
      null,
    [scriptTabEpisodes, selectedEpisodeId],
  );

  const draggingStoryboard = useMemo(() => {
    if (!draggingStoryboardId) {
      return null;
    }

    return (
      selectedEpisode?.storyboards.find(
        (storyboard) => normalizeEntityId(storyboard?.id) === normalizeEntityId(draggingStoryboardId),
      ) ||
      storyboardDragOrderRef.current.storyboards.find(
        (storyboard) => normalizeEntityId(storyboard?.id) === normalizeEntityId(draggingStoryboardId),
      ) ||
      null
    );
  }, [draggingStoryboardId, selectedEpisode]);

  useEffect(() => {
    if (!draggingStoryboardId) {
      return undefined;
    }

    function handleWindowMouseMove(event) {
      const dragSession = storyboardDragSessionRef.current;
      if (!dragSession.draggingStoryboardId) {
        return;
      }

      const nextLeft = event.clientX - dragSession.pointerOffsetX;
      const nextTop = event.clientY - dragSession.pointerOffsetY;
      setStoryboardDragLayerStyle((current) =>
        current
          ? {
            ...current,
            left: nextLeft,
            top: nextTop,
          }
          : current,
      );

      const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
      const hoveredStoryboardCard = hoveredElement?.closest?.('[data-storyboard-card="true"]');
      if (!hoveredStoryboardCard) {
        clearStoryboardDragHoverTarget();
        return;
      }

      const targetEpisodeId = hoveredStoryboardCard.getAttribute('data-episode-id') || '';
      const targetStoryboardId = hoveredStoryboardCard.getAttribute('data-storyboard-id') || '';
      if (
        targetEpisodeId !== dragSession.episodeId ||
        normalizeEntityId(targetStoryboardId) === normalizeEntityId(dragSession.draggingStoryboardId)
      ) {
        clearStoryboardDragHoverTarget();
        return;
      }

      handleStoryboardCardPointerMove(targetEpisodeId, targetStoryboardId);
    }

    function handleWindowMouseUp() {
      if (!storyboardDragSessionRef.current.pressedStoryboardId) {
        return;
      }

      finalizeStoryboardDragSessionRef.current();
    }

    function handleWindowBlur() {
      if (!storyboardDragSessionRef.current.pressedStoryboardId) {
        return;
      }

      finalizeStoryboardDragSessionRef.current();
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [draggingStoryboardId]);

  const selectedEpisodeScript = useMemo(() => {
    if (!selectedEpisode || !activeProject) {
      return '';
    }

    return selectedEpisode.scriptContent || '';
  }, [activeProject, selectedEpisode]);

  const characterFeatureModels = useMemo(

    () =>
      filterFeatureModelsByCapability(
        resolveFeatureModelsByNames(featureModelsConfig, CHARACTER_GENERATION_FEATURE_ALIASES),
        MODEL_CAPABILITY_REQUIREMENTS.textToImage,
      ),
    [featureModelsConfig],
  );
  const resolvedCharacterBindingId = useMemo(() => {
    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.characterModel);
    if (currentBindingId) {
      const exists = characterFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === currentBindingId,
      );
      if (exists) {
        return currentBindingId;
      }
    }

    return resolveBindingId(characterFeatureModels[0]?.binding_id);
  }, [activeProject?.modelConfig?.characterModel, characterFeatureModels]);
  const sceneFeatureModels = useMemo(
    () =>
      filterFeatureModelsByCapability(
        resolveFeatureModelsByNames(featureModelsConfig, SCENE_GENERATION_FEATURE_ALIASES),
        MODEL_CAPABILITY_REQUIREMENTS.textToImage,
      ),
    [featureModelsConfig],
  );
  const resolvedSceneBindingId = useMemo(() => {
    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.sceneModel);
    if (currentBindingId) {
      const exists = sceneFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === currentBindingId,
      );
      if (exists) {
        return currentBindingId;
      }
    }

    return resolveBindingId(sceneFeatureModels[0]?.binding_id);
  }, [activeProject?.modelConfig?.sceneModel, sceneFeatureModels]);
  const storyboardCoverFeatureModels = useMemo(
    () =>
      filterFeatureModelsByCapability(
        resolveFeatureModelsByNames(
          featureModelsConfig,
          STORYBOARD_COVER_GENERATION_FEATURE_ALIASES,
        ),
        MODEL_CAPABILITY_REQUIREMENTS.imageToImage,
      ),
    [featureModelsConfig],
  );
  const resolvedStoryboardCoverBindingId = useMemo(() => {
    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.storyboardCoverModel);
    if (currentBindingId) {
      const exists = storyboardCoverFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === currentBindingId,
      );
      if (exists) {
        return currentBindingId;
      }
    }

    return resolveBindingId(storyboardCoverFeatureModels[0]?.binding_id);
  }, [activeProject?.modelConfig?.storyboardCoverModel, storyboardCoverFeatureModels]);
  const storyboardVideoFeatureModels = useMemo(
    () =>
      filterFeatureModelsByCapability(
        resolveFeatureModelsByNames(featureModelsConfig, STORYBOARD_VIDEO_GENERATION_FEATURE_ALIASES),
        MODEL_CAPABILITY_REQUIREMENTS.textImageToVideo,
      ),
    [featureModelsConfig],
  );
  const resolvedStoryboardVideoBindingId = useMemo(() => {
    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.storyboardVideoModel);
    if (currentBindingId) {
      const exists = storyboardVideoFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === currentBindingId,
      );
      if (exists) {
        return currentBindingId;
      }
    }

    return resolveBindingId(storyboardVideoFeatureModels[0]?.binding_id);
  }, [activeProject?.modelConfig?.storyboardVideoModel, storyboardVideoFeatureModels]);
  const rawVisualStyleValue = String(activeProject?.visualStyleId || '').trim();
  const selectedVisualStyleId = useMemo(() => {
    if (!rawVisualStyleValue) {
      return '';
    }

    return findMatchedVisualStyle(managedProjectStyles, rawVisualStyleValue)?.id || '';
  }, [managedProjectStyles, rawVisualStyleValue]);
  const resolvedBatchStoryboardCoverBindingId = useMemo(() => {
    const selectedBindingId = resolveBindingId(batchStoryboardCoverBindingId);
    if (selectedBindingId) {
      const exists = storyboardCoverFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === selectedBindingId,
      );
      if (exists) {
        return selectedBindingId;
      }
    }

    return resolveBindingId(storyboardCoverFeatureModels[0]?.binding_id);
  }, [batchStoryboardCoverBindingId, storyboardCoverFeatureModels]);
  const resolvedBatchStoryboardVideoBindingId = useMemo(() => {
    const selectedBindingId = resolveBindingId(batchStoryboardVideoBindingId);
    if (selectedBindingId) {
      const exists = storyboardVideoFeatureModels.some(
        (model) => resolveBindingId(model?.binding_id) === selectedBindingId,
      );
      if (exists) {
        return selectedBindingId;
      }
    }

    return resolveBindingId(storyboardVideoFeatureModels[0]?.binding_id);
  }, [batchStoryboardVideoBindingId, storyboardVideoFeatureModels]);
  const generationQuoteCharacterCount = Array.isArray(activeProject?.characters)
    ? activeProject.characters.length
    : 0;
  const generationQuoteSceneCount = Array.isArray(activeProject?.scenes)
    ? activeProject.scenes.length
    : 0;
  const generationQuoteEpisodes = useMemo(
    () => (Array.isArray(activeProject?.episodes) ? activeProject.episodes : []),
    [activeProject?.episodes],
  );
  const generationQuoteEpisodeCount = generationQuoteEpisodes.length;
  const generationQuoteStoryboards = useMemo(
    () => generationQuoteEpisodes.flatMap((episode) =>
      Array.isArray(episode?.storyboards) ? episode.storyboards : [],
    ),
    [generationQuoteEpisodes],
  );
  const generationQuoteStoryboardCount = generationQuoteStoryboards.length;
  const storyboardVideoBatchQuoteParams = useMemo(
    () => buildStoryboardVideoBatchQuoteParams(generationQuoteStoryboards),
    [generationQuoteStoryboards],
  );
  const storyboardVideoBatchQuoteSignature = useMemo(
    () => JSON.stringify({
      bindingId: resolvedBatchStoryboardVideoBindingId,
      params: storyboardVideoBatchQuoteParams,
    }),
    [resolvedBatchStoryboardVideoBindingId, storyboardVideoBatchQuoteParams],
  );

  useEffect(() => {
    if (!activeProject?.backendProjectId) {
      setGenerationQuotes(createDefaultGenerationQuoteState());
      return undefined;
    }

    const characterCount = generationQuoteCharacterCount;
    const sceneCount = generationQuoteSceneCount;
    const episodeCount = generationQuoteEpisodeCount;
    const storyboardCount = generationQuoteStoryboardCount;
    const quoteSpecs = [
      {
        key: 'characterSingle',
        bindingId: resolvedCharacterBindingId,
        enabled: characterCount > 0,
        params: { count: 1 },
      },
      {
        key: 'characterBatch',
        bindingId: resolvedCharacterBindingId,
        enabled: characterCount > 0,
        params: { count: characterCount, characterCount },
      },
      {
        key: 'sceneSingle',
        bindingId: resolvedSceneBindingId,
        enabled: sceneCount > 0,
        params: { count: 1 },
      },
      {
        key: 'sceneBatch',
        bindingId: resolvedSceneBindingId,
        enabled: sceneCount > 0,
        params: { count: sceneCount, sceneCount },
      },
      {
        key: 'storyboard',
        bindingId: resolveStoryboardGenerationBindingId(featureModelsConfigRef.current),
        enabled: episodeCount > 0,
        params: {
          episodeCount,
          characterCount,
          sceneCount,
        },
      },
      {
        key: 'storyboardCoverBatch',
        bindingId: resolvedBatchStoryboardCoverBindingId,
        enabled: storyboardCount > 0,
        params: { count: storyboardCount, storyboardCount },
      },
    ];

    let ignored = false;
    const timer = window.setTimeout(() => {
      setGenerationQuotes((current) => {
        const next = { ...current };
        quoteSpecs.forEach((spec) => {
          const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, spec.bindingId);
          next[spec.key] = spec.enabled && modelId
            ? { ...next[spec.key], loading: true, error: '' }
            : createDefaultQuoteState();
        });
        return next;
      });

      quoteSpecs.forEach((spec) => {
        const modelId = resolveFeatureModelIdByBindingId(featureModelsConfigRef.current, spec.bindingId);
        if (!spec.enabled || !modelId) {
          return;
        }

        pointsApi.quote({
          modelId,
          params: spec.params,
        })
          .then((quote) => {
            if (ignored) {
              return;
            }
            setGenerationQuotes((current) => ({
              ...current,
              [spec.key]: {
                loading: false,
                points: resolveQuotePoints(quote),
                error: '',
              },
            }));
          })
          .catch((error) => {
            if (ignored) {
              return;
            }
            setGenerationQuotes((current) => ({
              ...current,
              [spec.key]: {
                loading: false,
                points: null,
                error: parseApiErrorMessage(error, '积分报价失败'),
              },
            }));
          });
      });
    }, 300);

    return () => {
      ignored = true;
      window.clearTimeout(timer);
    };
  }, [
    activeProject?.backendProjectId,
    generationQuoteCharacterCount,
    generationQuoteSceneCount,
    generationQuoteEpisodeCount,
    generationQuoteStoryboardCount,
    featureModelsConfig,
    resolvedCharacterBindingId,
    resolvedSceneBindingId,
    resolvedBatchStoryboardCoverBindingId,
  ]);

  useEffect(() => {
    if (
      !activeProject?.backendProjectId ||
      generationQuoteStoryboardCount === 0 ||
      !resolvedBatchStoryboardVideoBindingId
    ) {
      setGenerationQuotes((current) => ({
        ...current,
        storyboardVideoBatch: createDefaultQuoteState(),
      }));
      return undefined;
    }

    const modelId = resolveFeatureModelIdByBindingId(
      featureModelsConfigRef.current,
      resolvedBatchStoryboardVideoBindingId,
    );
    if (!modelId) {
      setGenerationQuotes((current) => ({
        ...current,
        storyboardVideoBatch: createDefaultQuoteState(),
      }));
      return undefined;
    }

    let ignored = false;
    const timer = window.setTimeout(() => {
      setGenerationQuotes((current) => ({
        ...current,
        storyboardVideoBatch: {
          ...current.storyboardVideoBatch,
          loading: true,
          error: '',
        },
      }));

      pointsApi.quote({
        modelId,
        params: storyboardVideoBatchQuoteParams,
      })
        .then((quote) => {
          if (ignored) {
            return;
          }

          setGenerationQuotes((current) => ({
            ...current,
            storyboardVideoBatch: {
              loading: false,
              points: resolveQuotePoints(quote),
              error: '',
            },
          }));
        })
        .catch((error) => {
          if (ignored) {
            return;
          }

          setGenerationQuotes((current) => ({
            ...current,
            storyboardVideoBatch: {
              loading: false,
              points: null,
              error: parseApiErrorMessage(error, '积分报价失败'),
            },
          }));
        });
    }, 300);

    return () => {
      ignored = true;
      window.clearTimeout(timer);
    };
  }, [
    activeProject?.backendProjectId,
    featureModelsConfig,
    generationQuoteStoryboardCount,
    resolvedBatchStoryboardVideoBindingId,
    storyboardVideoBatchQuoteParams,
    storyboardVideoBatchQuoteSignature,
  ]);

  useEffect(() => {
    storyboardCoverQuoteSignaturesRef.current = {};
    setStoryboardCoverQuotes({});
  }, [activeProject?.id, resolvedStoryboardCoverBindingId]);

  useEffect(() => {
    storyboardVideoQuoteSignaturesRef.current = {};
    setStoryboardVideoQuotes({});
  }, [activeProject?.id, resolvedStoryboardVideoBindingId]);




  const configuredCharacter = useMemo(
    () =>
      activeProject?.characters?.find(
        (character) => character.id === characterConfigModal.characterId,
      ) || null,
    [activeProject, characterConfigModal.characterId],
  );
  const configuredCharacterDraft = useMemo(
    () =>
      configuredCharacter
        ? {
          ...configuredCharacter,
          ...(characterConfigDraft || {}),
        }
        : null,
    [characterConfigDraft, configuredCharacter],
  );
  const configuredScene = useMemo(
    () => activeProject?.scenes?.find((scene) => scene.id === sceneConfigModal.sceneId) || null,
    [activeProject, sceneConfigModal.sceneId],
  );
  const generatedCharacterAssets = useMemo(
    () =>
      (activeProject?.characters || []).filter((character) =>
        isCharacterAvatarReady(character),
      ),
    [activeProject],
  );
  const generatedSceneAssets = useMemo(
    () => (activeProject?.scenes || []).filter((scene) => isSceneImageReady(scene)),
    [activeProject],
  );
  const exportableStoryboardVideosByEpisode = useMemo(
    () =>
      (activeProject?.episodes || []).map((episode, episodeIndex) => {
        const storyboards = episode?.storyboards || [];
        const videos = storyboards.reduce((items, storyboard, storyboardIndex) => {
          const videoUrl = getStoryboardVideoUrl(storyboard);
          if (!videoUrl) {
            return items;
          }

          const episodeLabel = getEpisodeDisplayLabel(episode, episodeIndex).replace(/[\\/:*?"<>|]/g, '-');
          const storyboardLabel = String(
            storyboard?.title || storyboard?.description || `分镜${storyboardIndex + 1}`,
          )
            .trim()
            .replace(/[\\/:*?"<>|]/g, '-');

          items.push({
            url: videoUrl,
            fileName: `${episodeLabel}-${storyboardLabel}-视频.mp4`,
          });
          return items;
        }, []);
        const storyboardCount = storyboards.length;
        const generatedVideoCount = videos.length;
        const missingVideoCount = Math.max(storyboardCount - generatedVideoCount, 0);
        const isExportReady = storyboardCount > 0 && missingVideoCount === 0;

        return {
          episodeId: String(episode?.id || ''),
          episodeNo:
            Number.isInteger(Number(episode?.episodeNo)) && Number(episode?.episodeNo) > 0
              ? Number(episode.episodeNo)
              : episodeIndex + 1,
          episodeLabel: getEpisodeDisplayLabel(episode, episodeIndex),
          title: String(episode?.title || '').trim(),
          storyboardCount,
          generatedVideoCount,
          missingVideoCount,
          isExportReady,
          videos,
        };
      }),
    [activeProject],
  );
  const exportableStoryboardVideos = useMemo(
    () => exportableStoryboardVideosByEpisode.filter((item) => item.isExportReady).flatMap((item) => item.videos),
    [exportableStoryboardVideosByEpisode],
  );
  const replaceableCharacterAssets = useMemo(() => {
    if (!configuredCharacter) {
      return [];
    }
    return generatedCharacterAssets.filter((asset) => asset.id !== configuredCharacter.id);
  }, [configuredCharacter, generatedCharacterAssets]);
  const replaceableSceneAssets = useMemo(() => {
    if (!configuredScene) {
      return [];
    }
    return generatedSceneAssets.filter((asset) => asset.id !== configuredScene.id);
  }, [configuredScene, generatedSceneAssets]);
  const selectedCharacterAsset = useMemo(
    () =>
      activeProject?.characters?.find((character) => character.id === selectedCharacterAssetId) || null,
    [activeProject, selectedCharacterAssetId],
  );
  const selectedSceneAsset = useMemo(
    () => activeProject?.scenes?.find((scene) => scene.id === selectedSceneAssetId) || null,
    [activeProject, selectedSceneAssetId],
  );
  const isAddingCharacter = isActionPending(ACTION_ADD_CHARACTER);
  const isAddingScene = isActionPending(ACTION_ADD_SCENE);
  const isBatchGeneratingImages = isActionPending(ACTION_BATCH_IMAGES);

  const isBatchGeneratingVideos = isActionPending(ACTION_BATCH_VIDEOS);
  useEffect(() => {
    if (!activeProject) {
      return;
    }

    if (!resolvedCharacterBindingId) {
      return;
    }

    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.characterModel);
    if (currentBindingId === resolvedCharacterBindingId) {
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        characterModel: String(resolvedCharacterBindingId),
      },
    }));
  }, [activeProject, onUpdateProject, resolvedCharacterBindingId]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    if (!resolvedSceneBindingId) {
      return;
    }

    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.sceneModel);
    if (currentBindingId === resolvedSceneBindingId) {
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        sceneModel: String(resolvedSceneBindingId),
      },
    }));
  }, [activeProject, onUpdateProject, resolvedSceneBindingId]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    if (!resolvedStoryboardCoverBindingId) {
      return;
    }

    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.storyboardCoverModel);
    if (currentBindingId === resolvedStoryboardCoverBindingId) {
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        storyboardCoverModel: String(resolvedStoryboardCoverBindingId),
      },
    }));
  }, [activeProject, onUpdateProject, resolvedStoryboardCoverBindingId]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    if (!resolvedStoryboardVideoBindingId) {
      return;
    }

    const currentBindingId = resolveBindingId(activeProject?.modelConfig?.storyboardVideoModel);
    if (currentBindingId === resolvedStoryboardVideoBindingId) {
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        storyboardVideoModel: String(resolvedStoryboardVideoBindingId),
      },
    }));
  }, [activeProject, onUpdateProject, resolvedStoryboardVideoBindingId]);

  useEffect(() => {
    const resolvedBindingId = resolveBindingId(batchStoryboardCoverBindingId);
    if (resolvedBindingId) {
      return;
    }
    if (!resolvedBatchStoryboardCoverBindingId) {
      return;
    }
    setBatchStoryboardCoverBindingId(String(resolvedBatchStoryboardCoverBindingId));
  }, [batchStoryboardCoverBindingId, resolvedBatchStoryboardCoverBindingId]);

  useEffect(() => {
    const resolvedBindingId = resolveBindingId(batchStoryboardVideoBindingId);
    if (resolvedBindingId) {
      return;
    }
    if (!resolvedBatchStoryboardVideoBindingId) {
      return;
    }
    setBatchStoryboardVideoBindingId(String(resolvedBatchStoryboardVideoBindingId));
  }, [batchStoryboardVideoBindingId, resolvedBatchStoryboardVideoBindingId]);

  const isUploadingConfiguredCharacterAvatar = isActionPending(
    getUploadCharacterAvatarActionKey(characterConfigModal.characterId),
  );
  const isSavingConfiguredCharacter = isActionPending(
    getUpdateCharacterActionKey(characterConfigModal.characterId),
  );
  const isRegeneratingConfiguredCharacterAvatar = isActionPending(
    getRegenerateCharacterAvatarActionKey(characterConfigModal.characterId),
  );
  const isUploadingConfiguredSceneImage = isActionPending(
    getUploadSceneImageActionKey(sceneConfigModal.sceneId),
  );
  const isSavingConfiguredScene = isActionPending(
    getUpdateSceneActionKey(sceneConfigModal.sceneId),
  );
  const isRegeneratingConfiguredSceneImage = isActionPending(
    getRegenerateSceneImageActionKey(sceneConfigModal.sceneId),
  );
  const isConfiguredCharacterAvatarGenerating = Boolean(
    isRegeneratingConfiguredCharacterAvatar ||
    isTaskInProgressStatus(configuredCharacter?.avatarStatus),
  );
  const isConfiguredSceneImageGenerating = Boolean(
    isRegeneratingConfiguredSceneImage || isTaskInProgressStatus(configuredScene?.imageStatus),
  );
  const hasPendingCharacterAssetSelection = Boolean(
    configuredCharacter &&
    selectedCharacterAssetId &&
    selectedCharacterAssetId !== configuredCharacter.id,
  );
  const hasPendingSceneAssetSelection = Boolean(
    configuredScene && selectedSceneAssetId && selectedSceneAssetId !== configuredScene.id,
  );
  const isPreviewingCharacterAsset = Boolean(
    hasPendingCharacterAssetSelection && selectedCharacterAsset?.avatarUrl,
  );
  const isPreviewingSceneAsset = Boolean(hasPendingSceneAssetSelection && selectedSceneAsset?.imageUrl);
  const characterPreviewAvatarUrl = isPreviewingCharacterAsset
    ? selectedCharacterAsset.avatarUrl
    : configuredCharacterDraft?.avatarUrl || '';
  const characterPreviewPrompt = isPreviewingCharacterAsset
    ? selectedCharacterAsset.avatarPrompt || configuredCharacterDraft?.avatarPrompt || ''
    : configuredCharacterDraft?.avatarPrompt || '';
  const scenePreviewImageUrl = isPreviewingSceneAsset
    ? selectedSceneAsset.imageUrl
    : configuredScene?.imageUrl || '';
  const scenePreviewPrompt = isPreviewingSceneAsset
    ? selectedSceneAsset.prompt || configuredScene?.prompt || ''
    : configuredScene?.prompt || '';
  const isSettingGenerating = Boolean(
    isParsing || String(activeProject?.parseStatus || '').toLowerCase() === 'parsing',
  );
  const hasSettingQuoteSource = Boolean(
    String(activeProject?.scriptText || '').trim() || activeProject?.scriptUploadFile,
  );
  const settingQuoteButtonText = !hasSettingQuoteSource
    ? '添加剧本后计算'
    : settingQuote.loading
    ? '积分计算中...'
    : settingQuote.points != null
      ? `预计扣除 ${formatPointsValue(settingQuote.points)} 积分`
      : '积分待计算';
  function getGenerationQuoteText(key) {
    const quote = generationQuotes[key] || createDefaultQuoteState();
    if (quote.loading) {
      return '积分计算中...';
    }
    if (quote.points != null) {
      return `预计扣除 ${formatPointsValue(quote.points)} 积分`;
    }
    return '积分待计算';
  }
  function getStoryboardCoverQuoteText(storyboard) {
    const storyboardId = normalizeEntityId(storyboard?.id);
    const quote = storyboardId ? storyboardCoverQuotes[storyboardId] : null;
    if (!quote) {
      return '积分待计算';
    }
    if (quote.loading) {
      return '积分计算中...';
    }
    if (quote.points != null) {
      return `预计扣除 ${formatPointsValue(quote.points)} 积分`;
    }
    return quote.error || '积分待计算';
  }
  function getStoryboardVideoQuoteText(storyboard) {
    const storyboardId = normalizeEntityId(storyboard?.id);
    const quote = storyboardId ? storyboardVideoQuotes[storyboardId] : null;
    if (!quote) {
      return '积分待计算';
    }
    if (quote.loading) {
      return '积分计算中...';
    }
    if (quote.points != null) {
      return `预计扣除 ${formatPointsValue(quote.points)} 积分`;
    }
    return quote.error || '积分待计算';
  }
  const isCharacterAssetsGenerating = Boolean(
    isGeneratingCharacterAssets ||
    (activeProject?.characters || []).some((character) =>
      isTaskInProgressStatus(character?.avatarStatus),
    ),
  );
  const isSceneAssetsGenerating = Boolean(
    isGeneratingSceneAssets ||
    (activeProject?.scenes || []).some((scene) =>
      isTaskInProgressStatus(scene?.imageStatus),
    ),
  );
  const isStoryboardGenerating = Boolean(
    isGeneratingStoryboard || isTaskInProgressStatus(activeProject?.storyboardStatus),
  );
  const showFullscreenGenerationMask =
    location.pathname === '/creation' && (isSettingGenerating || isStoryboardGenerating);
  const fullscreenGenerationMaskText = isStoryboardGenerating
    ? '分镜生成中，预计需要8-10分钟'
    : '剧本设定生成中，预计需要8-10分钟';
  const storyboardItems = useMemo(

    () => activeProject?.episodes?.flatMap((episode) => episode.storyboards || []) || [],
    [activeProject],
  );
  const storyboardCoverBatchStatus = normalizeTaskStatus(activeProject?.storyboardCoverBatchStatus);
  const hasStoryboardCoverBatchTask = Boolean(
    String(activeProject?.storyboardCoverBatchTaskId || '').trim(),
  );
  const isStoryboardCoverBatchRunning = isTaskInProgressStatus(storyboardCoverBatchStatus);
  const episodeComposeStatus = getEpisodeComposeStatusValue(activeProject);
  const episodeComposeTaskId =
    getEpisodeComposeTaskIdValue(activeProject) || String(downloadComposeTaskId || '').trim();
  const isEpisodeComposeRunning = isTaskInProgressStatus(episodeComposeStatus);
  const isEpisodeComposeSuccess = isTaskSuccessStatus(episodeComposeStatus);
  const isEpisodeComposeDownloadEnabled = Boolean(
    activeProject?.backendProjectId && episodeComposeTaskId && isEpisodeComposeSuccess,
  );
  const storyboardCoverBatchButtonText = getStoryboardCoverBatchButtonText(
    storyboardCoverBatchStatus,
    hasStoryboardCoverBatchTask,
  );
  const missingFirstImageCountForBatchVideo = useMemo(
    () => storyboardItems.filter((storyboard) => !storyboard?.firstImage).length,
    [storyboardItems],
  );



  const backendProjectId = activeProject?.backendProjectId || '';
  const hasRunningProjectAsyncTasks = useMemo(
    () => hasPendingProjectAsyncTasks(activeProject),
    [activeProject],
  );
  const hasRunningStoryboardMediaTasks = useMemo(
    () => hasPendingStoryboardMediaTasks(activeProject),
    [activeProject],
  );
  const messageTypeClassMap = {
    info: styles.messageInfo,
    success: styles.messageSuccess,
    warning: styles.messageWarning,
    error: styles.messageError,
  };
  const currentMessageClass = messageTypeClassMap[messageState.type] || styles.messageInfo;

  function closeCharacterConfigModal() {
    setCharacterConfigModal({
      open: false,
      characterId: '',
    });
    setCharacterConfigDraft(null);
    setSelectedCharacterAssetId('');
    characterAvatarUploadTargetIdRef.current = '';
    setCharacterAvatarUploadTargetId('');
    if (characterAvatarUploadInputRef.current) {
      characterAvatarUploadInputRef.current.value = '';
    }
  }

  function closeSceneConfigModal() {
    setSceneConfigModal({
      open: false,
      sceneId: '',
    });
    setSelectedSceneAssetId('');
    sceneImageUploadTargetIdRef.current = '';
    setSceneImageUploadTargetId('');
    if (sceneImageUploadInputRef.current) {
      sceneImageUploadInputRef.current.value = '';
    }
  }

  function updateCharacterFields(characterId, patch) {
    if (!characterId || !patch || typeof patch !== 'object') {
      return;
    }
    onUpdateProject((current) => ({
      ...current,
      characters: current.characters.map((item) =>
        item.id === characterId
          ? {
            ...item,
            ...patch,
          }
          : item,
      ),
    }));
  }

  function updateCharacterConfigDraft(patch) {
    if (!patch || typeof patch !== 'object') {
      return;
    }

    setCharacterConfigDraft((current) => ({
      ...(current || {}),
      ...patch,
    }));
  }

  function buildCharacterUpdatePayload(character, overrides = {}) {
    const nextCharacter = {
      ...(character || {}),
      ...(overrides || {}),
    };
    const payload = {
      name: nextCharacter.name || '',
      description: nextCharacter.bio || '',
      voice_name: nextCharacter.defaultVoice || '',
      voice_id: nextCharacter.voiceId || '',
      image_prompt: nextCharacter.avatarPrompt || nextCharacter.imagePrompt || '',
    };

    if (Array.isArray(nextCharacter.styleKeywords)) {
      payload.style_keywords = nextCharacter.styleKeywords;
    }

    if (Array.isArray(nextCharacter.possibleScenes)) {
      payload.possible_scenes = nextCharacter.possibleScenes;
    }

    return payload;
  }

  async function updateBackendCharacter(characterId, payload, errorFallback = '角色更新失败') {
    if (!activeProject.backendProjectId || !characterId) {
      return true;
    }

    try {
      await characterApi.updateProjectCharacter(activeProject.backendProjectId, characterId, payload);
      return true;
    } catch (error) {
      showMessage(parseApiErrorMessage(error, errorFallback), 'error');
      return false;
    }
  }

  function buildSceneUpdatePayload(scene, overrides = {}) {
    const nextScene = {
      ...(scene || {}),
      ...(overrides || {}),
    };

    return {
      name: nextScene.name || '',
      prompt: nextScene.prompt || '',
      description: nextScene.description || '',
      related_characters: Array.isArray(nextScene.relatedCharacters) ? nextScene.relatedCharacters : [],
    };
  }

  async function updateBackendScene(sceneId, payload, errorFallback = '场景更新失败') {
    if (!activeProject.backendProjectId || !sceneId) {
      return true;
    }

    try {
      await sceneApi.updateProjectScene(activeProject.backendProjectId, sceneId, payload);
      return true;
    } catch (error) {
      showMessage(parseApiErrorMessage(error, errorFallback), 'error');
      return false;
    }
  }

  function getDefaultCharacterVoice(index = 0) {
    if (voiceOptions.length > 0) {
      const voice = voiceOptions[index % voiceOptions.length];
      return {
        defaultVoice: voice?.name || '',
        voiceId: voice?.voiceId || voice?.id || '',
      };
    }

    return {
      defaultVoice: VOICE_PRESETS[index % VOICE_PRESETS.length],
      voiceId: '',
    };
  }

  function getConfiguredCharacterSnapshot(applySelectedAsset = true) {
    if (!configuredCharacterDraft) {
      return null;
    }

    if (!applySelectedAsset || !hasPendingCharacterAssetSelection || !selectedCharacterAsset?.avatarUrl) {
      return configuredCharacterDraft;
    }

    return {
      ...configuredCharacterDraft,
      avatarUrl: selectedCharacterAsset.avatarUrl,
      avatarPrompt: selectedCharacterAsset.avatarPrompt || configuredCharacterDraft.avatarPrompt || '',
      avatarStatus: 'success',
      avatarErrorMessage: '',
    };
  }

  async function confirmCharacterConfig() {
    if (!configuredCharacter) {
      return;
    }

    const nextCharacter = getConfiguredCharacterSnapshot(true);
    if (!nextCharacter) {
      return;
    }

    if (activeProject.backendProjectId && configuredCharacter.id) {
      const actionKey = getUpdateCharacterActionKey(configuredCharacter.id);
      let saveSucceeded = false;
      const submitted = await withActionPending(
        actionKey,
        async () => {
          const success = await updateBackendCharacter(
            configuredCharacter.id,
            buildCharacterUpdatePayload(nextCharacter),
            '角色配置保存失败',
          );
          if (success) {
            saveSucceeded = true;
            showMessage('角色配置已保存', 'success');
          }
        },
        '角色配置保存中，请稍候',
      );

      if (!submitted || !saveSucceeded) {
        return;
      }
    }

    updateCharacterFields(configuredCharacter.id, {
      bio: nextCharacter.bio || '',
      defaultVoice: nextCharacter.defaultVoice || '',
      voiceId: nextCharacter.voiceId || '',
      avatarPrompt: nextCharacter.avatarPrompt || '',
      avatarUrl: nextCharacter.avatarUrl || '',
      avatarStatus: nextCharacter.avatarStatus || configuredCharacter.avatarStatus || 'idle',
      avatarErrorMessage: nextCharacter.avatarErrorMessage || '',
    });

    if (hasPendingCharacterAssetSelection && selectedCharacterAssetId && selectedCharacterAssetId !== configuredCharacter.id) {
      setSelectedCharacterAssetId(configuredCharacter.id);
    }

    closeCharacterConfigModal();
  }

  function updateSceneFields(sceneId, patch) {
    if (!sceneId || !patch || typeof patch !== 'object') {
      return;
    }
    onUpdateProject((current) => ({
      ...current,
      scenes: current.scenes.map((item) =>
        item.id === sceneId
          ? {
            ...item,
            ...patch,
          }
          : item,
      ),
    }));
  }

  function markAllCharacterCardsGenerating(nextStatus = 'queued') {
    onUpdateProject((current) => ({
      ...current,
      characters: current.characters.map((character) => ({
        ...character,
        avatarStatus: nextStatus,
        avatarErrorMessage: '',
      })),
    }));
  }

  function markAllSceneCardsGenerating(nextStatus = 'queued') {
    onUpdateProject((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => ({
        ...scene,
        imageStatus: nextStatus,
        imageErrorMessage: '',
      })),
    }));
  }

  function openCharacterConfigModal(characterId) {
    setCharacterConfigModal({
      open: true,
      characterId,
    });
    setCharacterConfigDraft(null);
    setSelectedCharacterAssetId(characterId || '');
  }

  function openSceneConfigModal(sceneId) {
    setSceneConfigModal({
      open: true,
      sceneId,
    });
    setSelectedSceneAssetId(sceneId || '');
  }

  function cancelCharacterAssetSelection() {
    closeCharacterConfigModal();
  }

  function getConfiguredSceneSnapshot(applySelectedAsset = true) {
    if (!configuredScene) {
      return null;
    }

    if (!applySelectedAsset || !hasPendingSceneAssetSelection || !selectedSceneAsset?.imageUrl) {
      return configuredScene;
    }

    return {
      ...configuredScene,
      imageUrl: selectedSceneAsset.imageUrl,
      prompt: selectedSceneAsset.prompt || configuredScene.prompt || '',
      imageStatus: 'success',
      imageErrorMessage: '',
    };
  }

  async function confirmSceneConfig() {
    if (!configuredScene) {
      return;
    }

    const nextScene = getConfiguredSceneSnapshot(true);
    if (!nextScene) {
      return;
    }

    if (activeProject.backendProjectId && configuredScene.id) {
      const actionKey = getUpdateSceneActionKey(configuredScene.id);
      let saveSucceeded = false;
      const submitted = await withActionPending(
        actionKey,
        async () => {
          const success = await updateBackendScene(
            configuredScene.id,
            buildSceneUpdatePayload(nextScene),
            '场景配置保存失败',
          );
          if (success) {
            saveSucceeded = true;
            showMessage('场景配置已保存', 'success');
          }
        },
        '场景配置保存中，请稍候',
      );

      if (!submitted || !saveSucceeded) {
        return;
      }
    }

    updateSceneFields(configuredScene.id, {
      prompt: nextScene.prompt || '',
      description: nextScene.description || '',
      imageUrl: nextScene.imageUrl || '',
      imageStatus: nextScene.imageStatus || configuredScene.imageStatus || 'idle',
      imageErrorMessage: nextScene.imageErrorMessage || '',
    });

    if (hasPendingSceneAssetSelection && selectedSceneAssetId && selectedSceneAssetId !== configuredScene.id) {
      setSelectedSceneAssetId(configuredScene.id);
    }

    closeSceneConfigModal();
  }

  function cancelSceneAssetSelection() {
    closeSceneConfigModal();
  }

  function triggerCharacterAvatarUploadForCharacter(characterId = '') {
    const resolvedCharacterId = normalizeEntityId(characterId);
    if (!resolvedCharacterId) {
      return;
    }

    characterAvatarUploadTargetIdRef.current = resolvedCharacterId;
    setCharacterAvatarUploadTargetId(resolvedCharacterId);
    if (characterAvatarUploadInputRef.current) {
      characterAvatarUploadInputRef.current.value = '';
    }
    characterAvatarUploadInputRef.current?.click();
  }

  function triggerCharacterAvatarUpload() {
    if (!configuredCharacter) {
      return;
    }

    triggerCharacterAvatarUploadForCharacter(configuredCharacter.id);
  }

  function triggerSceneImageUploadForScene(sceneId = '') {
    const resolvedSceneId = normalizeEntityId(sceneId);
    if (!resolvedSceneId) {
      return;
    }

    sceneImageUploadTargetIdRef.current = resolvedSceneId;
    setSceneImageUploadTargetId(resolvedSceneId);
    if (sceneImageUploadInputRef.current) {
      sceneImageUploadInputRef.current.value = '';
    }
    sceneImageUploadInputRef.current?.click();
  }

  function triggerSceneImageUpload() {
    if (!configuredScene) {
      return;
    }

    triggerSceneImageUploadForScene(configuredScene.id);
  }

  function downloadConfiguredCharacterAvatar() {
    if (!characterPreviewAvatarUrl) {
      showMessage('当前角色暂无可下载外观图', 'warning');
      return;
    }

    const link = document.createElement('a');
    link.href = characterPreviewAvatarUrl;
    link.download = `${configuredCharacter.name || '角色'}-外观.png`;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadConfiguredSceneImage() {
    if (!scenePreviewImageUrl) {
      showMessage('当前场景暂无可下载图片', 'warning');
      return;
    }

    const link = document.createElement('a');
    link.href = scenePreviewImageUrl;
    link.download = `${configuredScene.name || '场景'}-画面.png`;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openExportVideoModal() {
    if (exportableStoryboardVideos.length === 0) {
      showMessage('暂无可导出的集数，请先生成该集所有分镜视频', 'warning');
      return;
    }

    setExportVideoModal({
      open: true,
      selectedEpisodeIds: exportableStoryboardVideosByEpisode
        .filter((item) => item.isExportReady)
        .map((item) => item.episodeId),
    });
  }

  function closeExportVideoModal() {
    setExportVideoModal((current) =>
      current.isExporting ? current : createDefaultExportVideoModalState(),
    );
  }

  function toggleExportEpisodeSelection(episodeId) {
    const targetEpisode = exportableStoryboardVideosByEpisode.find((item) => item.episodeId === episodeId);
    if (!targetEpisode?.isExportReady) {
      showMessage('这一集还有分镜未生成视频，暂不能导出', 'warning');
      return;
    }

    setExportVideoModal((current) => {
      const selectedEpisodeIds = current.selectedEpisodeIds.includes(episodeId)
        ? current.selectedEpisodeIds.filter((item) => item !== episodeId)
        : [...current.selectedEpisodeIds, episodeId];

      return {
        ...current,
        selectedEpisodeIds,
      };
    });
  }

  async function downloadEpisodeComposeArchive(projectId, taskId) {
    const token = localStorage.getItem('token') || '';
    const response = await fetch(`/api/projects/${projectId}/episodes/compose/${taskId}/download`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '下载导出文件失败');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${String(activeProject?.name || '项目').trim() || '项目'}-剧集合成.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async function downloadComposedEpisodes() {
    const resolvedTaskId =
      getEpisodeComposeTaskIdValue(activeProject) || String(downloadComposeTaskId || '').trim();
    const resolvedStatus = getEpisodeComposeStatusValue(activeProject);

    if (!activeProject?.backendProjectId || !resolvedTaskId || !isTaskSuccessStatus(resolvedStatus)) {
      showMessage('当前暂无可下载导出文件', 'warning');
      return;
    }

    try {
      await downloadEpisodeComposeArchive(activeProject.backendProjectId, resolvedTaskId);
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '下载导出文件失败'), 'error');
    }
  }

  async function syncEpisodeComposeTaskSnapshot(projectId, taskId, fallbackProject = null) {
    if (!projectId || !taskId) {
      return {
        composeStatus: null,
        normalizedStatus: '',
      };
    }

    const composeStatus = await projectApi.getProjectEpisodeComposeStatus(projectId, taskId);
    const normalizedStatus = normalizeTaskStatus(
      composeStatus?.status || composeStatus?.task_status || composeStatus?.state,
    );
    const nextTaskId = String(composeStatus?.task_id || composeStatus?.id || taskId).trim();
    const fallbackBase = fallbackProject || latestProjectRef.current || activeProject;

    applyProjectSnapshot({
      ...fallbackBase,
      episodeComposeStatus: normalizedStatus || getEpisodeComposeStatusValue(fallbackBase) || 'idle',
      episodeComposeTaskId: nextTaskId,
      episodeComposeErrorMessage: composeStatus?.error_message || composeStatus?.message || '',
    });

    return {
      composeStatus,
      normalizedStatus,
    };
  }

  async function waitProjectEpisodeComposeCompleted(projectId, taskId) {
    for (; ;) {
      const { composeStatus, normalizedStatus } = await syncEpisodeComposeTaskSnapshot(projectId, taskId);

      if (isTaskFailedStatus(normalizedStatus)) {
        throw new Error(composeStatus?.error_message || composeStatus?.message || '视频导出失败');
      }

      if (isTaskSuccessStatus(normalizedStatus)) {
        return composeStatus;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }

  async function exportStoryboardVideos() {
    const selectedEpisodes = exportableStoryboardVideosByEpisode.filter(
      (item) => exportVideoModal.selectedEpisodeIds.includes(item.episodeId) && item.isExportReady,
    );

    if (selectedEpisodes.length === 0) {
      showMessage('请至少选择一个已完成全部分镜视频的集数', 'warning');
      return;
    }

    if (!activeProject?.backendProjectId) {
      const selectedVideos = selectedEpisodes.flatMap((item) => item.videos);
      selectedVideos.forEach((item, index) => {
        window.setTimeout(() => {
          const link = document.createElement('a');
          link.href = item.url;
          link.download = item.fileName;
          link.target = '_blank';
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, index * 120);
      });
      showMessage(`开始导出 ${selectedVideos.length} 个视频`, 'success');
      closeExportVideoModal();
      return;
    }

    setExportVideoModal((current) => ({
      ...current,
      isExporting: true,
      statusText: '正在提交导出任务...',
    }));

    try {
      const composeTask = await projectApi.composeProjectEpisodes(activeProject.backendProjectId, {
        episode_nos: selectedEpisodes.map((item) => item.episodeNo),
      });
      const taskId = String(composeTask?.task_id || composeTask?.id || '').trim();
      const initialStatus = normalizeTaskStatus(
        composeTask?.status || composeTask?.task_status || composeTask?.state || 'queued',
      );
      if (!taskId) {
        throw new Error(composeTask?.message || '导出任务创建失败');
      }

      applyProjectSnapshot({
        ...(latestProjectRef.current || activeProject),
        episodeComposeStatus: initialStatus || 'queued',
        episodeComposeTaskId: taskId,
        episodeComposeErrorMessage: '',
      });

      setExportVideoModal((current) => ({
        ...current,
        isExporting: true,
        statusText: '正在合成导出文件...',
      }));

      await waitProjectEpisodeComposeCompleted(activeProject.backendProjectId, taskId);
      setDownloadComposeTaskId(taskId);
      showMessage('视频导出成功', 'success');
      setExportVideoModal(createDefaultExportVideoModalState());
    } catch (error) {
      applyProjectSnapshot({
        ...(latestProjectRef.current || activeProject),
        episodeComposeStatus: 'failed',
        episodeComposeTaskId: '',
        episodeComposeErrorMessage: parseApiErrorMessage(error, '视频导出失败'),
      });
      setDownloadComposeTaskId('');
      setExportVideoModal((current) => ({
        ...current,
        isExporting: false,
        statusText: '',
      }));
      showMessage(parseApiErrorMessage(error, '视频导出失败'), 'error');
    }
  }

  async function handleCharacterAvatarUpload(event) {
    const file = event.target.files?.[0];
    const resolvedCharacterId = normalizeEntityId(
      characterAvatarUploadTargetIdRef.current || characterAvatarUploadTargetId || configuredCharacter?.id,
    );
    const targetCharacter =
      activeProject.characters.find((character) => normalizeEntityId(character.id) === resolvedCharacterId) || null;
    if (!file || !targetCharacter?.id) {
      characterAvatarUploadTargetIdRef.current = '';
      setCharacterAvatarUploadTargetId('');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    if (activeProject.backendProjectId && targetCharacter.id) {
      await withActionPending(
        getUploadCharacterAvatarActionKey(targetCharacter.id),
        async () => {
          try {
            const formData = new FormData();
            formData.append('file', file);
            await characterApi.uploadProjectCharacterAvatar(
              activeProject.backendProjectId,
              targetCharacter.id,
              formData,
            );
            await refreshProjectFromServer(activeProject.backendProjectId, {
              includeAnalysis: true,
            });
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '上传角色外观失败'), 'error');
          }
        },
        '角色外观上传中，请稍候',
      );
    } else {
      const localAvatarUrl = URL.createObjectURL(file);
      updateCharacterFields(targetCharacter.id, {
        avatarUrl: localAvatarUrl,
        avatarStatus: 'success',
        avatarErrorMessage: '',
      });
    }

    if (characterAvatarUploadTargetIdRef.current === resolvedCharacterId) {
      characterAvatarUploadTargetIdRef.current = '';
      setCharacterAvatarUploadTargetId('');
    }
    if (event.target) {
      event.target.value = '';
    }
  }

  async function handleSceneImageUpload(event) {
    const file = event.target.files?.[0];
    const resolvedSceneId = normalizeEntityId(
      sceneImageUploadTargetIdRef.current || sceneImageUploadTargetId || configuredScene?.id,
    );
    const targetScene =
      activeProject.scenes.find((scene) => normalizeEntityId(scene.id) === resolvedSceneId) || null;
    if (!file || !targetScene?.id) {
      sceneImageUploadTargetIdRef.current = '';
      setSceneImageUploadTargetId('');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    if (activeProject.backendProjectId && targetScene.id) {
      await withActionPending(
        getUploadSceneImageActionKey(targetScene.id),
        async () => {
          try {
            const formData = new FormData();
            formData.append('file', file);
            await sceneApi.uploadProjectSceneImage(
              activeProject.backendProjectId,
              targetScene.id,
              formData,
            );
            await refreshProjectFromServer(activeProject.backendProjectId, {
              includeAnalysis: true,
            });
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '上传场景图片失败'), 'error');
          }
        },
        '场景图片上传中，请稍候',
      );
    } else {
      const localImageUrl = URL.createObjectURL(file);
      updateSceneFields(targetScene.id, {
        imageUrl: localImageUrl,
        imageStatus: 'success',
        imageErrorMessage: '',
      });
    }

    if (sceneImageUploadTargetIdRef.current === resolvedSceneId) {
      sceneImageUploadTargetIdRef.current = '';
      setSceneImageUploadTargetId('');
    }
    if (event.target) {
      event.target.value = '';
    }
  }

  const feedbackLayer = (
    <>
      {messageState.visible && (
        <div className={`${styles.topMessage} ${currentMessageClass}`} role="status" aria-live="polite">
          {messageState.text}
        </div>
      )}
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
      {confirmDialog.open && (
        <div className={styles.confirmMask} role="dialog" aria-modal="true" aria-label={confirmDialog.title}>
          <div className={styles.confirmDialog}>
            <h4 className={styles.confirmTitle}>{confirmDialog.title}</h4>
            <p className={styles.confirmContent}>{confirmDialog.content}</p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancelButton}
                type="button"
                onClick={closeConfirmDialog}
                disabled={isConfirmingDialog}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                className={styles.confirmPrimaryButton}
                type="button"
                onClick={handleConfirmDialogConfirm}
                disabled={isConfirmingDialog}
              >
                {isConfirmingDialog ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>处理中...</span>
                  </span>
                ) : (
                  confirmDialog.confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showFullscreenGenerationMask && (
        <div
          className={styles.settingGeneratingMask}
          role="status"
          aria-live="polite"
          aria-label={fullscreenGenerationMaskText}
        >
          <div className={styles.settingGeneratingPanel}>
            <div className={styles.settingGeneratingLoader} aria-hidden>
              <span className={styles.settingGeneratingHalo} />
              <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingOuter}`} />
              <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingInner}`} />
              <span className={styles.settingGeneratingSweep} />
              <span className={styles.settingGeneratingCore} />
              <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitSlow}`}>
                <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleMain}`} />
              </span>
              <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitFast}`}>
                <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleAccent}`} />
              </span>
              <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitTiny}`}>
                <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleTiny}`} />
              </span>
            </div>
            <p className={styles.settingGeneratingText}>{fullscreenGenerationMaskText}</p>
          </div>
        </div>
      )}
      {characterConfigModal.open && configuredCharacter && (
        <div
          className={styles.characterConfigMask}
          role="dialog"
          aria-modal="true"
          aria-label="角色配置"
          onClick={closeCharacterConfigModal}
        >
          <div className={styles.characterConfigDialog} onClick={(event) => event.stopPropagation()}>
            <div className={styles.characterConfigHeader}>
              <h4 className={styles.characterConfigTitle}>角色配置</h4>
              <button
                type="button"
                className={styles.characterConfigClose}
                onClick={closeCharacterConfigModal}
                aria-label="关闭角色配置"
              >
                ×
              </button>
            </div>
            <div className={styles.characterConfigBody}>
              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>角色描述</div>
                <textarea
                  className={styles.characterConfigTextarea}
                  value={configuredCharacterDraft?.bio || ''}
                  rows={3}
                  onChange={(event) =>
                    updateCharacterConfigDraft({
                      bio: event.target.value,
                    })
                  }
                />
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>角色外观</div>
                <div className={styles.characterConfigImagePanel}>
                  <div className={styles.characterConfigImageWrap}>
                    {characterPreviewAvatarUrl ? (
                      <img
                        className={styles.characterConfigImage}
                        src={characterPreviewAvatarUrl}
                        alt={`${configuredCharacter.name || '角色'}外观`}
                      />
                    ) : (
                      <div className={styles.characterConfigImageEmpty}>暂无角色外观</div>
                    )}
                  </div>
                  <div className={styles.characterConfigImageActions}>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={triggerCharacterAvatarUpload}
                      disabled={isUploadingConfiguredCharacterAvatar}
                    >
                      {isUploadingConfiguredCharacterAvatar ? '上传中...' : '上传角色'}
                    </button>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={downloadConfiguredCharacterAvatar}
                      disabled={!characterPreviewAvatarUrl}
                    >
                      下载图片
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionHeader}>
                  <div className={styles.characterConfigSectionTitle}>角色提示词</div>
                  <button
                    type="button"
                    className={`${styles.characterConfigGenerateButton} ${styles.characterConfigInlineGenerateButton} ${styles.pointsTipButton}`}
                    data-points-tip={isConfiguredCharacterAvatarGenerating ? undefined : getGenerationQuoteText('characterSingle')}
                    onClick={() => regenerateCharacterAvatar(configuredCharacter.id)}
                    disabled={isConfiguredCharacterAvatarGenerating}
                  >
                    {isConfiguredCharacterAvatarGenerating ? '生成中...' : '生成角色'}
                  </button>
                </div>
                <textarea
                  className={styles.characterConfigTextarea}
                  value={characterPreviewPrompt}
                  rows={4}
                  disabled={isPreviewingCharacterAsset}
                  onChange={(event) =>
                    updateCharacterConfigDraft({
                      avatarPrompt: event.target.value,
                    })
                  }
                />
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>替换已生成角色素材</div>
                <div className={styles.configAssetSelectWrap}>
                  <AppSelect
                    className={`${styles.compactSelect} ${styles.configAssetSelect}`}
                    value={selectedCharacterAssetId}
                    onChange={setSelectedCharacterAssetId}
                    disabled={replaceableCharacterAssets.length === 0}
                    options={[
                      { value: configuredCharacter.id, label: '当前角色素材（不替换）' },
                      ...replaceableCharacterAssets.map((asset) => ({
                        value: asset.id,
                        label: asset.name || '未命名角色',
                      })),
                    ]}
                  />
                  <small className={styles.configAssetHint}>
                    {replaceableCharacterAssets.length === 0
                      ? '暂无可替换的已生成角色素材'
                      : hasPendingCharacterAssetSelection
                        ? `已选中：${selectedCharacterAsset?.name || '未命名角色'}（点击确定后生效）`
                        : '当前为原素材，点击确定不会变更'}
                  </small>
                </div>
              </section>

            </div>
            <div className={styles.characterConfigFooter}>
              <button
                type="button"
                className={styles.characterConfigCancelButton}
                onClick={cancelCharacterAssetSelection}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.characterConfigConfirmButton}
                onClick={confirmCharacterConfig}
                disabled={isSavingConfiguredCharacter}
              >
                {isSavingConfiguredCharacter ? '保存中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={characterAvatarUploadInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={handleCharacterAvatarUpload}
      />
      {sceneConfigModal.open && configuredScene && (
        <div
          className={styles.characterConfigMask}
          role="dialog"
          aria-modal="true"
          aria-label="场景配置"
          onClick={closeSceneConfigModal}
        >
          <div className={styles.characterConfigDialog} onClick={(event) => event.stopPropagation()}>
            <div className={styles.characterConfigHeader}>
              <h4 className={styles.characterConfigTitle}>场景配置</h4>
              <button
                type="button"
                className={styles.characterConfigClose}
                onClick={closeSceneConfigModal}
                aria-label="关闭场景配置"
              >
                ×
              </button>
            </div>
            <div className={styles.characterConfigBody}>
              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>场景描述</div>
                <textarea
                  className={styles.characterConfigTextarea}
                  value={configuredScene.description || ''}
                  rows={3}
                  onChange={(event) =>
                    updateSceneFields(configuredScene.id, {
                      description: event.target.value,
                    })
                  }
                />
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>场景画面</div>
                <div className={styles.characterConfigImagePanel}>
                  <div className={styles.characterConfigImageWrap}>
                    {scenePreviewImageUrl ? (
                      <img
                        className={styles.characterConfigImage}
                        src={scenePreviewImageUrl}
                        alt={`${configuredScene.name || '场景'}画面`}
                      />
                    ) : (
                      <div className={styles.characterConfigImageEmpty}>暂无场景画面</div>
                    )}
                  </div>
                  <div className={styles.characterConfigImageActions}>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={triggerSceneImageUpload}
                      disabled={isUploadingConfiguredSceneImage}
                    >
                      {isUploadingConfiguredSceneImage ? '上传中...' : '上传场景'}
                    </button>
                    <button
                      type="button"
                      className={styles.subtleButton}
                      onClick={downloadConfiguredSceneImage}
                      disabled={!scenePreviewImageUrl}
                    >
                      下载图片
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionHeader}>
                  <div className={styles.characterConfigSectionTitle}>场景提示词</div>
                  <button
                    type="button"
                    className={`${styles.characterConfigGenerateButton} ${styles.characterConfigInlineGenerateButton} ${styles.pointsTipButton}`}
                    data-points-tip={isConfiguredSceneImageGenerating ? undefined : getGenerationQuoteText('sceneSingle')}
                    onClick={() => regenerateSceneImage(configuredScene.id)}
                    disabled={isConfiguredSceneImageGenerating}
                  >
                    {isConfiguredSceneImageGenerating ? '生成中...' : '生成场景'}
                  </button>
                </div>
                <textarea
                  className={styles.characterConfigTextarea}
                  value={scenePreviewPrompt}
                  rows={4}
                  disabled={isPreviewingSceneAsset}
                  onChange={(event) =>
                    updateSceneFields(configuredScene.id, {
                      prompt: event.target.value,
                    })
                  }
                />
              </section>

              <section className={styles.characterConfigSection}>
                <div className={styles.characterConfigSectionTitle}>替换已生成场景素材</div>
                <div className={styles.configAssetSelectWrap}>
                  <AppSelect
                    className={`${styles.compactSelect} ${styles.configAssetSelect}`}
                    value={selectedSceneAssetId}
                    onChange={setSelectedSceneAssetId}
                    disabled={replaceableSceneAssets.length === 0}
                    options={[
                      { value: configuredScene.id, label: '当前场景素材（不替换）' },
                      ...replaceableSceneAssets.map((asset) => ({
                        value: asset.id,
                        label: asset.name || '未命名场景',
                      })),
                    ]}
                  />
                  <small className={styles.configAssetHint}>
                    {replaceableSceneAssets.length === 0
                      ? '暂无可替换的已生成场景素材'
                      : hasPendingSceneAssetSelection
                        ? `已选中：${selectedSceneAsset?.name || '未命名场景'}（点击确定后生效）`
                        : '当前为原素材，点击确定不会变更'}
                  </small>
                </div>
              </section>
            </div>
            <div className={styles.characterConfigFooter}>
              <button
                type="button"
                className={styles.characterConfigCancelButton}
                onClick={cancelSceneAssetSelection}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.characterConfigConfirmButton}
                onClick={confirmSceneConfig}
                disabled={isSavingConfiguredScene}
              >
                {isSavingConfiguredScene ? '保存中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={sceneImageUploadInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={handleSceneImageUpload}
      />
    </>
  );

  useEffect(() => {
    if (!onLayoutModeChange) {
      return undefined;
    }

    onLayoutModeChange(effectiveViewMode === 'workflow');
    return () => {
      onLayoutModeChange(false);
    };
  }, [onLayoutModeChange, effectiveViewMode]);

  useEffect(() => {
    const shouldLoadManagedProjectResources =
      location.pathname === '/creation' || effectiveViewMode === 'workflow';
    if (!shouldLoadManagedProjectResources) {
      return undefined;
    }

    let disposed = false;

    (async () => {
      try {
        const [featureModelsResponse, stylesResponse, voicesResponse] = await Promise.all([
          managedProjectApi.getFeatureModels(),
          managedProjectApi.getStyles(),
          ttsApi.getVoices(),
        ]);
        if (!disposed) {
          const safeFeatureModels = pickFeatureModelArray(featureModelsResponse);
          const safeStyles = normalizeManagedProjectStyles(stylesResponse);
          const safeVoices = normalizeVoiceOptions(voicesResponse);
          featureModelsConfigRef.current = safeFeatureModels;
          managedProjectStylesRef.current = safeStyles;
          setFeatureModelsConfig(safeFeatureModels);
          setManagedProjectStyles(safeStyles);
          setVoiceOptions(safeVoices);
        }
      } catch {
        if (!disposed) {
          featureModelsConfigRef.current = [];
          managedProjectStylesRef.current = [];
          setFeatureModelsConfig([]);
          setManagedProjectStyles([]);
          setVoiceOptions([]);
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [effectiveViewMode, location.pathname]);

  useEffect(() => {
    if (!activeProject || managedProjectStyles.length === 0 || rawVisualStyleValue) {
      return;
    }

    const defaultStyleId = managedProjectStyles[0]?.id || '';
    if (!defaultStyleId) {
      return;
    }

    onUpdateProject((current) => {
      if (!current) {
        return current;
      }

      const currentVisualStyleValue = String(current.visualStyleId || '').trim();
      if (currentVisualStyleValue) {
        return current;
      }

      return {
        ...current,
        visualStyleId: defaultStyleId,
      };
    });
  }, [activeProject, managedProjectStyles, onUpdateProject, rawVisualStyleValue]);

  useEffect(
    () => () => {
      clearMessageTimer();
    },
    [],
  );

  useEffect(() => {
    if (!characterConfigModal.open) {
      return;
    }
    const exists = activeProject?.characters?.some((character) => character.id === characterConfigModal.characterId);
    if (!exists) {
      setCharacterConfigModal({
        open: false,
        characterId: '',
      });
      characterAvatarUploadTargetIdRef.current = '';
      setCharacterAvatarUploadTargetId('');
      if (characterAvatarUploadInputRef.current) {
        characterAvatarUploadInputRef.current.value = '';
      }
    }
  }, [activeProject?.characters, characterConfigModal.characterId, characterConfigModal.open]);

  useEffect(() => {
    if (!sceneConfigModal.open) {
      return;
    }
    const exists = activeProject?.scenes?.some((scene) => scene.id === sceneConfigModal.sceneId);
    if (!exists) {
      setSceneConfigModal({
        open: false,
        sceneId: '',
      });
      sceneImageUploadTargetIdRef.current = '';
      setSceneImageUploadTargetId('');
      if (sceneImageUploadInputRef.current) {
        sceneImageUploadInputRef.current.value = '';
      }
    }
  }, [activeProject?.scenes, sceneConfigModal.sceneId, sceneConfigModal.open]);

  useEffect(() => {
    if (!backendProjectId || !hasRunningProjectAsyncTasks || isParsing) {
      return undefined;
    }

    let disposed = false;
    let timerId = 0;

    const pollRunningProjectTasks = async () => {
      if (disposed) {
        return;
      }

      try {
        const latestProject = await fetchLatestProjectSnapshot(
          backendProjectId,
          latestProjectRef.current,
          { includeAnalysis: true },
        );
        if (!disposed && latestProject) {
          onUpdateProject(() => latestProject);
        }
      } catch {
        // Keep polling on transient failures until task settles.
      }

      if (disposed) {
        return;
      }

      if (hasPendingProjectAsyncTasks(latestProjectRef.current)) {
        timerId = window.setTimeout(pollRunningProjectTasks, TASK_POLL_INTERVAL_MS);
      }
    };

    timerId = window.setTimeout(pollRunningProjectTasks, TASK_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [backendProjectId, hasRunningProjectAsyncTasks, isParsing, onUpdateProject]);

  useEffect(() => {
    if (!backendProjectId || !hasRunningStoryboardMediaTasks || hasRunningProjectAsyncTasks) {
      return undefined;
    }

    let disposed = false;
    let timerId = 0;

    const pollRunningStoryboardMediaTasks = async () => {
      if (disposed) {
        return;
      }

      try {
        const storyboards = await storyboardApi.getProjectStoryboards(backendProjectId);
        if (!disposed && Array.isArray(storyboards)) {
          applyStoryboardsSnapshotToProject(storyboards);
        }
      } catch {
        // Keep polling on transient failures until task settles.
      }

      if (disposed) {
        return;
      }

      if (hasPendingStoryboardMediaTasks(latestProjectRef.current)) {
        timerId = window.setTimeout(pollRunningStoryboardMediaTasks, TASK_POLL_INTERVAL_MS);
      }
    };

    timerId = window.setTimeout(pollRunningStoryboardMediaTasks, TASK_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [backendProjectId, hasRunningProjectAsyncTasks, hasRunningStoryboardMediaTasks, onUpdateProject]);

  useEffect(() => {
    const taskId = getEpisodeComposeTaskIdValue(activeProject);
    const status = getEpisodeComposeStatusValue(activeProject);

    if (isTaskSuccessStatus(status) && taskId) {
      setDownloadComposeTaskId(taskId);
      return;
    }

    setDownloadComposeTaskId('');
  }, [activeProject?.id, activeProject?.episodeComposeStatus, activeProject?.episodeComposeTaskId]);

  useEffect(() => {
    const projectId = activeProject?.backendProjectId || '';
    const taskId = getEpisodeComposeTaskIdValue(activeProject);
    const status = getEpisodeComposeStatusValue(activeProject);

    if (!projectId || !taskId || !isTaskInProgressStatus(status)) {
      return undefined;
    }

    let disposed = false;
    let timerId = 0;

    const pollEpisodeComposeStatus = async () => {
      if (disposed) {
        return;
      }

      try {
        const { normalizedStatus } = await syncEpisodeComposeTaskSnapshot(projectId, taskId);
        if (disposed || !isTaskInProgressStatus(normalizedStatus)) {
          return;
        }
      } catch {
        if (disposed) {
          return;
        }
      }

      timerId = window.setTimeout(pollEpisodeComposeStatus, TASK_POLL_INTERVAL_MS);
    };

    void pollEpisodeComposeStatus();

    return () => {
      disposed = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [activeProject?.backendProjectId, activeProject?.episodeComposeStatus, activeProject?.episodeComposeTaskId]);

  // 轮询异步任务状态直到结束。
  async function waitTaskCompleted(taskId) {
    while (true) {
      let task = null;
      try {
        task = await taskApi.getTask(taskId);
      } catch {
        // Keep polling on transient query failures.
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const status = normalizeTaskStatus(task?.status || task?.task_status || task?.state);

      if (isTaskSuccessStatus(status)) {
        await refreshPointsAfterGeneration();
        return task;
      }

      if (isTaskFailedStatus(status)) {
        await refreshPointsAfterGeneration();
        throw new Error(task?.error_message || task?.message || '任务执行失败');
      }

      // Some backends return terminal custom statuses that are neither running nor failed/success.
      // Avoid false timeout when status has already left the in-progress state.
      if (status && !isTaskInProgressStatus(status)) {
        await refreshPointsAfterGeneration();
        return task;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }




  // 分镜生成专用轮询：优先以项目级状态为准，并补充查询 /storyboards 列表。
  async function waitProjectStoryboardCompleted(projectId) {
    while (true) {
      const [projectResult, storyboardsResult] = await Promise.allSettled([
        projectApi.getProject(projectId),
        storyboardApi.getProjectStoryboards(projectId),
      ]);


      const projectStatus =
        projectResult.status === 'fulfilled'
          ? normalizeTaskStatus(projectResult.value?.storyboard_status)
          : '';
      const projectErrorMessage =
        projectResult.status === 'fulfilled'
          ? projectResult.value?.storyboard_error_message || ''
          : '';
      const storyboards =
        storyboardsResult.status === 'fulfilled' && Array.isArray(storyboardsResult.value)
          ? storyboardsResult.value
          : [];

      if (isTaskFailedStatus(projectStatus)) {
        await refreshPointsAfterGeneration();
        throw new Error(projectErrorMessage || '分镜生成失败');
      }

      if (isTaskSuccessStatus(projectStatus)) {
        await refreshPointsAfterGeneration();
        return storyboards;
      }

      // Some backends use custom terminal statuses (e.g. completed/done) on project level.
      if (projectStatus && !isTaskInProgressStatus(projectStatus)) {
        await refreshPointsAfterGeneration();
        return storyboards;
      }


      // Fallback for backends that do not expose project-level storyboard status.
      if (!projectStatus && storyboards.length > 0) {
        await refreshPointsAfterGeneration();
        return storyboards;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }

  async function waitStoryboardCoverCompleted(projectId, shotId) {
    while (true) {
      let shot = null;
      try {
        shot = await storyboardApi.getProjectStoryboard(projectId, shotId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const status = normalizeTaskStatus(shot.cover_status);
      const hasAsset = Boolean(shot.cover_image_url || shot.cover_image_local_path);

      if (isTaskFailedStatus(status)) {
        await refreshPointsAfterGeneration();
        throw createStoryboardMediaError(shot.cover_error_message || '参考图生成失败', shot);
      }

      if (hasAsset || isTaskSuccessStatus(status)) {
        await refreshPointsAfterGeneration();
        return shot;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }

  // 单分镜视频专用轮询：通过 /storyboards/{shot_id} 刷新当前分镜的视频状态。
  async function waitStoryboardVideoCompleted(projectId, shotId) {
    while (true) {
      let shot = null;
      try {
        shot = await storyboardApi.getProjectStoryboard(projectId, shotId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }
      const status = normalizeTaskStatus(shot.video_status);

      if (isTaskFailedStatus(status)) {
        await refreshPointsAfterGeneration();
        throw createStoryboardMediaError(shot.video_error_message || '视频生成失败', shot);
      }

      if (isTaskSuccessStatus(status)) {
        await refreshPointsAfterGeneration();
        return shot;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  // 解析专用轮询：根据 /projects 的 analysis_status 判断是否完成，成功后再取一次 /analysis。
  async function waitProjectAnalysisCompleted(projectId) {
    while (true) {
      let projectData = null;
      try {
        projectData = await projectApi.getProject(projectId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const analysisStatus = normalizeTaskStatus(projectData.analysis_status);

      if (isTaskFailedStatus(analysisStatus)) {
        await refreshPointsAfterGeneration();
        throw new Error(projectData.analysis_error_message || '剧本解析失败');
      }

      if (isTaskSuccessStatus(analysisStatus)) {
        await refreshPointsAfterGeneration();
        return projectData;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  function isBatchAssetSettled(status, imageUrl, localPath) {
    if (imageUrl || localPath) {
      return true;
    }

    const normalizedStatus = normalizeTaskStatus(status);
    return isTaskSuccessStatus(normalizedStatus) || isTaskFailedStatus(normalizedStatus);
  }

  function getStoryboardCoverBatchButtonText(status, hasTaskId) {
    const normalizedStatus = normalizeTaskStatus(status);

    if (!hasTaskId) {
      return '批量参考图';
    }

    if (isTaskInProgressStatus(normalizedStatus)) {
      return '参考图批量生成中...';
    }

    if (isTaskSuccessStatus(normalizedStatus)) {
      return '参考图批量已完成';
    }

    if (isTaskFailedStatus(normalizedStatus)) {
      return '参考图批量生成失败';
    }

    return '参考图批量已触发';
  }


  function clearGeneratedProjectData(projectSnapshot) {
    return {
      ...projectSnapshot,
      parseStatus: 'idle',
      analysisTaskId: '',
      analysisErrorMessage: '',
      storyboardStatus: 'idle',
      storyboardTaskId: '',
      storyboardErrorMessage: '',
      storyboardCoverBatchStatus: 'idle',
      storyboardCoverBatchTaskId: '',
      storyboardCoverBatchErrorMessage: '',
      episodeComposeStatus: 'idle',
      episodeComposeTaskId: '',
      episodeComposeErrorMessage: '',
      scriptOverview: '',
      episodes: [],
      characters: [],
      scenes: [],
    };
  }

  // 角色设定轮询：通过 /characters 观察角色头像状态。
  async function waitProjectCharacterAssetGenerationCompleted(projectId, expectedCount = 0) {
    while (true) {
      let characters = null;
      try {
        characters = await characterApi.getProjectCharacters(projectId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (!Array.isArray(characters)) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }


      if (expectedCount > 0 && characters.length < expectedCount) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const settled = characters.every((character) =>
        isBatchAssetSettled(
          character.avatar_status,
          character.avatar_image_url,
          character.avatar_local_path,
        ),
      );

      if (settled) {
        await refreshPointsAfterGeneration();
        return characters;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  // 角色单体轮询：用于角色配置弹窗里的“再次生成形象”。
  async function waitProjectCharacterAssetGenerationCompletedById(projectId, characterId) {
    while (true) {
      let characters = null;
      try {
        characters = await characterApi.getProjectCharacters(projectId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (!Array.isArray(characters)) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }


      const target = characters.find((item) => item.id === characterId);
      if (!target) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const status = normalizeTaskStatus(target.avatar_status);
      const hasAsset = Boolean(target.avatar_image_url || target.avatar_local_path);
      if (isTaskFailedStatus(status)) {
        await refreshPointsAfterGeneration();
        throw new Error(target.avatar_error_message || '角色形象生成失败');
      }
      if (hasAsset || isTaskSuccessStatus(status)) {
        await refreshPointsAfterGeneration();
        return target;
      }


      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  // 场景设定轮询：通过 /scenes 观察场景图状态。
  async function waitProjectSceneAssetGenerationCompleted(projectId, expectedCount = 0) {
    while (true) {
      let scenes = null;
      try {
        scenes = await sceneApi.getProjectScenes(projectId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (!Array.isArray(scenes)) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }


      if (expectedCount > 0 && scenes.length < expectedCount) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const settled = scenes.every((scene) =>
        isBatchAssetSettled(
          scene.image_status,
          scene.image_url,
          scene.image_local_path,
        ),
      );

      if (settled) {
        await refreshPointsAfterGeneration();
        return scenes;
      }

      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  // 场景单体轮询：用于场景配置弹窗里的“再次生成场景图”。
  async function waitProjectSceneAssetGenerationCompletedById(projectId, sceneId) {
    while (true) {
      let scenes = null;
      try {
        scenes = await sceneApi.getProjectScenes(projectId);
      } catch {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }
      if (!Array.isArray(scenes)) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }


      const target = scenes.find((item) => item.id === sceneId);
      if (!target) {
        await sleep(TASK_POLL_INTERVAL_MS);
        continue;
      }

      const status = normalizeTaskStatus(target.image_status);
      const hasAsset = Boolean(target.image_url || target.image_local_path);
      if (isTaskFailedStatus(status)) {
        await refreshPointsAfterGeneration();
        throw new Error(target.image_error_message || '场景图生成失败');
      }
      if (hasAsset || isTaskSuccessStatus(status)) {
        await refreshPointsAfterGeneration();
        return target;
      }


      await sleep(TASK_POLL_INTERVAL_MS);
    }
  }


  function applyProjectSnapshot(nextProject) {
    if (!nextProject) {
      return nextProject;
    }

    latestProjectRef.current = nextProject;
    onUpdateProject(() => nextProject);
    return nextProject;
  }

  function applyStoryboardSnapshotToProject(storyboardPayload, fallbackProject = null) {
    if (!storyboardPayload || typeof storyboardPayload !== 'object') {
      return fallbackProject || latestProjectRef.current || activeProject;
    }

    const fallbackBase = fallbackProject || latestProjectRef.current || activeProject;
    return applyProjectSnapshot(
      mergeApiStoryboardIntoStudioProject(fallbackBase, storyboardPayload),
    );
  }

  function applyStoryboardsSnapshotToProject(storyboardsPayload, fallbackProject = null) {
    if (!Array.isArray(storyboardsPayload)) {
      return fallbackProject || latestProjectRef.current || activeProject;
    }

    const fallbackBase = fallbackProject || latestProjectRef.current || activeProject;
    return applyProjectSnapshot(
      mergeApiStoryboardsIntoStudioProject(fallbackBase, storyboardsPayload),
    );
  }

  // 拉取并合并后端项目数据，必要时附带 analysis。
  async function refreshProjectFromServer(projectId, options = {}) {

    const {
      includeAnalysis = true,
      includeStoryboards = true,
      fallbackProject = null,
      initialProjectData = null,
    } = options;
    const fallbackBase = fallbackProject || latestProjectRef.current || activeProject;
    const projectData = initialProjectData || await projectApi.getProject(projectId);
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
        // Ignore analysis fetch error and keep project payload.
      }

      // Use dedicated endpoints as authoritative source for entity fields to avoid
      // cross-task stale /analysis payload overriding generated assets.
      const [charactersResult, scenesResult, storyboardsResult] = await Promise.allSettled([
        characterApi.getProjectCharacters(projectId),
        sceneApi.getProjectScenes(projectId),
        includeStoryboards ? storyboardApi.getProjectStoryboards(projectId) : Promise.resolve([]),
      ]);

      const fallbackCharacters = Array.isArray(fallbackBase?.characters) ? fallbackBase.characters : [];
      const fallbackScenes = Array.isArray(fallbackBase?.scenes) ? fallbackBase.scenes : [];
      const fallbackStoryboards =
        includeStoryboards && Array.isArray(projectData.storyboards) ? projectData.storyboards : [];
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

    if (!includeStoryboards) {
      mergedProject = {
        ...mergedProject,
        storyboards: [],
        storyboard_status: 'idle',
        storyboard_task_id: '',
        storyboard_error_message: '',
        storyboard_cover_batch_status: 'idle',
        storyboard_cover_batch_task_id: '',
        storyboard_cover_batch_error_message: '',
        episode_compose_status: 'idle',
        episode_compose_task_id: '',
        episode_compose_error_message: '',
      };
    }

    const mappedProject = mapApiProjectToStudioProject(mergedProject, fallbackBase);
    return applyProjectSnapshot(mappedProject);
  }

  // 确保后端存在项目：已存在则更新脚本，不存在则走上传创建。
  async function ensureRemoteProject(scriptText) {
    if (activeProject.backendProjectId) {
      await projectApi.updateProjectScript(activeProject.backendProjectId, {
        script_text: scriptText,
      });
      return activeProject.backendProjectId;
    }

    const sourceFile = activeProject.scriptUploadFile;
    const baseFileName = activeProject.scriptFileName || '剧本文本.txt';
    const fileName = /\.(txt|docx|pdf)$/i.test(baseFileName) ? baseFileName : `${baseFileName}.txt`;
    const uploadFile =
      sourceFile ||
      new File([scriptText], fileName, {
        type: 'text/plain;charset=utf-8',
      });

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('project_name', activeProject.name.trim() || `新建项目${projects.length + 1}`);
    formData.append('film_type', toApiFilmType(activeProject.deliveryType));
    formData.append('creation_mode', toApiCreationMode(activeProject.creationMode));
    formData.append('aspect_ratio', activeProject.aspectRatio || '16:9');
    formData.append('visual_style', activeProject.visualStyleId || '');
    formData.append('style_id', selectedVisualStyleId || activeProject.visualStyleId || '');

    const projectData = await projectApi.uploadScript(formData);
    const mappedProject = mapApiProjectToStudioProject(projectData, activeProject);
    onUpdateProject(() => mappedProject);
    return projectData.id;
  }

  // 将步骤二编辑结果（分集/角色/场景）同步回后端。
  async function syncProjectDraftToServer(projectSnapshot, projectId) {
    const [serverEpisodes, serverCharacters, serverScenes] = await Promise.all([
      projectApi.getProjectEpisodes(projectId),
      characterApi.getProjectCharacters(projectId),
      sceneApi.getProjectScenes(projectId),
    ]);

    const serverCharacterIdSet = new Set(
      serverCharacters
        .map((item) => item.id)
        .filter(Boolean),
    );
    const serverSceneIdSet = new Set(
      serverScenes
        .map((item) => item.id)
        .filter(Boolean),
    );
    const serverEpisodeNoSet = new Set(
      serverEpisodes
        .map((item) => item.episode_no)
        .filter((item) => Number.isInteger(item)),
    );

    for (const character of projectSnapshot.characters || []) {
      const payload = {
        name: character.name || '',
        description: character.bio || '',
        voice_name: character.defaultVoice || '',
        voice_id: character.voiceId || '',
      };

      const matchedCharacterId = (character.id && serverCharacterIdSet.has(character.id))
        ? character.id
        : '';

      if (matchedCharacterId) {
        await characterApi.updateProjectCharacter(projectId, matchedCharacterId, payload);
      } else if (payload.name.trim()) {
        await characterApi.createProjectCharacter(projectId, payload);
      }
    }

    for (const scene of projectSnapshot.scenes || []) {
      const payload = {
        name: scene.name || '',
        prompt: scene.prompt || '',
        description: scene.description || '',
        related_characters: scene.relatedCharacters || [],
      };

      const matchedSceneId = (scene.id && serverSceneIdSet.has(scene.id))
        ? scene.id
        : '';

      if (matchedSceneId) {
        await sceneApi.updateProjectScene(projectId, matchedSceneId, payload);
      } else if (payload.name.trim()) {
        await sceneApi.createProjectScene(projectId, payload);
      }
    }

    for (const episode of projectSnapshot.episodes || []) {
      if (!Number.isInteger(episode.episodeNo) || !serverEpisodeNoSet.has(episode.episodeNo)) {
        continue;
      }
      await projectApi.updateEpisodeScript(projectId, episode.episodeNo, {
        script_content: episode.scriptContent || episode.summary || '',
        title: episode.title || null,
        summary: episode.summary || null,
      });
    }
  }

  function enqueueSerialUpdate(actionKey, taskFactory) {
    const queuedTask = serialUpdateQueueRef.current.get(actionKey) || Promise.resolve();
    const nextTask = queuedTask.catch(() => undefined).then(taskFactory);
    serialUpdateQueueRef.current.set(actionKey, nextTask);
    nextTask.finally(() => {
      if (serialUpdateQueueRef.current.get(actionKey) === nextTask) {
        serialUpdateQueueRef.current.delete(actionKey);
      }
    });
    return nextTask;
  }

  function normalizeTaskResult(taskStatus) {
    if (!taskStatus || typeof taskStatus !== 'object') {
      return taskStatus;
    }

    if (taskStatus.id) {
      return taskStatus;
    }

    if (taskStatus.task_id) {
      return {
        ...taskStatus,
        id: taskStatus.task_id,
      };
    }

    return taskStatus;
  }

  function buildStoryboardInfoUpdatePayload(projectSnapshot, storyboard) {
    const scenes = Array.isArray(projectSnapshot?.scenes) ? projectSnapshot.scenes : [];
    const sceneName =
      scenes.find((scene) => normalizeEntityId(scene.id) === normalizeEntityId(storyboard.sceneId))?.name ||
      storyboard.sceneName ||
      '';

    return {
      shot_description: storyboard.description || '',
      scene_id: storyboard.sceneId || '',
      scene_name: sceneName,
      cover_prompt: storyboard.imagePrompt || '',
      video_prompt: storyboard.videoPrompt || '',
    };
  }

  function buildStoryboardInfoPatchPayload(projectSnapshot, patch = {}) {
    const scenes = Array.isArray(projectSnapshot?.scenes) ? projectSnapshot.scenes : [];
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
      payload.shot_description = String(patch.description ?? '');
    }

    if (
      Object.prototype.hasOwnProperty.call(patch, 'sceneId') ||
      Object.prototype.hasOwnProperty.call(patch, 'sceneName')
    ) {
      const sceneId = normalizeEntityId(patch.sceneId);
      const matchedScene = scenes.find((scene) => normalizeEntityId(scene.id) === sceneId) || null;
      payload.scene_id = sceneId || '';
      payload.scene_name = String(matchedScene?.name || patch.sceneName || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'imagePrompt')) {
      payload.cover_prompt = String(patch.imagePrompt ?? '');
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'videoPrompt')) {
      payload.video_prompt = String(patch.videoPrompt ?? '');
    }

    return payload;
  }

  // 持久化单个分镜的信息字段，供生成任务与手动编辑使用。
  async function persistStoryboardInfoDraft(projectId, storyboard) {
    if (!projectId || !storyboard?.id) {
      return;
    }
    const projectSnapshot = latestProjectRef.current || activeProject;
    const payload = buildStoryboardInfoUpdatePayload(projectSnapshot, storyboard);

    await storyboardApi.updateProjectStoryboard(projectId, storyboard.id, payload);
  }

  async function persistStoryboardInfoPatch(episodeId, storyboardId, patch, errorFallback) {
    const projectId = activeProject.backendProjectId;
    if (!projectId || !storyboardId || !patch || typeof patch !== 'object') {
      return;
    }

    const storyboard =
      activeProject.episodes
        .find((episode) => episode.id === episodeId)
        ?.storyboards.find((item) => item.id === storyboardId) ||
      activeProject.episodes
        .flatMap((episode) => episode.storyboards)
        .find((item) => item.id === storyboardId);
    if (!storyboard?.id) {
      return;
    }

    const projectSnapshot = latestProjectRef.current || activeProject;
    const payload = buildStoryboardInfoPatchPayload(projectSnapshot, patch);
    if (Object.keys(payload).length === 0) {
      return;
    }

    const actionKey = getUpdateStoryboardInfoActionKey(storyboard.id);
    await enqueueSerialUpdate(actionKey, async () => {
      markActionPending(actionKey, true);
      try {
        await storyboardApi.updateProjectStoryboard(projectId, storyboard.id, payload);
      } catch (error) {
        showMessage(parseApiErrorMessage(error, errorFallback), 'error');
      } finally {
        markActionPending(actionKey, false);
      }
    });
  }

  async function waitTaskSucceeded(taskStatus, fallbackMessage = '任务执行失败') {
    let completedTask = taskStatus;
    if (taskStatus?.id) {
      completedTask = await waitTaskCompleted(taskStatus.id);
    }
    const finalStatus = normalizeTaskStatus(
      completedTask?.status || completedTask?.task_status || completedTask?.state,
    );
    if (isTaskFailedStatus(finalStatus)) {
      await refreshPointsAfterGeneration();
      throw new Error(completedTask?.error_message || completedTask?.message || fallbackMessage);
    }
    return completedTask;
  }

  function ensureBatchStoryboardGenerationAccepted(taskStatus, fallbackMessage = '任务执行失败') {
    const normalizedTask = normalizeTaskResult(taskStatus);
    const finalStatus = normalizeTaskStatus(
      normalizedTask?.status || normalizedTask?.task_status || normalizedTask?.state,
    );

    if (isTaskFailedStatus(finalStatus)) {
      throw new Error(normalizedTask?.error_message || normalizedTask?.message || fallbackMessage);
    }

    return normalizedTask;
  }

  // 更新项目顶层字段。
  function updateProjectField(field, value) {
    onUpdateProject((current) => ({ ...current, [field]: value }));
  }

  // 更新模型配置字段。
  function updateModelConfig(key, value) {
    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        [key]: value,
      },
    }));
  }

  function applyScriptDraftToProject(scriptDraft) {
    const draftProjectName = deriveScriptDraftProjectName(scriptDraft);
    const normalizedDraft = {
      scriptText: scriptDraft?.scriptText || '',
      scriptFileName: scriptDraft?.scriptFileName || '',
      scriptUploadFile: scriptDraft?.scriptUploadFile || null,
    };

    if (hasExistingProjectCreationData(activeProject)) {
      onCreateProject({
        name: draftProjectName,
        seriesName: activeProject.seriesName || '第一季',
        genre: activeProject.genre || '古风',
        targetPlatform: activeProject.targetPlatform || '抖音',
        episodeCount: activeProject.episodeCount || 12,
        dueDate: activeProject.dueDate || '',
        template: activeProject.template || '空白模板',
        coverUrl: activeProject.coverUrl || '',
        deliveryType: activeProject.deliveryType || DELIVERY_TYPES[0],
        creationMode: activeProject.creationMode || CREATION_MODES[0],
        aspectRatio: activeProject.aspectRatio || ASPECT_RATIOS[0],
        visualStyleId: activeProject.visualStyleId || managedProjectStyles[0]?.id || '',
        ...normalizedDraft,
      });
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      name: current.name.trim() || draftProjectName,
      ...normalizedDraft,
    }));
  }

  async function applyScriptUploadFile(file) {
    if (!file) {
      return;
    }

    if (!isSupportedScriptUploadFile(file)) {
      showMessage('仅支持上传 .txt、.docx、.pdf 文件', 'warning');
      return;
    }

    let nextText = '';
    const lowerCaseFileName = String(file.name || '').toLowerCase();
    if (file.type.includes('text') || lowerCaseFileName.endsWith('.txt')) {
      nextText = await readTextFileWithEncodingFallback(file);
    }

    applyScriptDraftToProject({
      scriptFileName: file.name,
      scriptText: nextText,
      scriptUploadFile: file,
    });
  }

  // 读取本地脚本文件并更新草稿。
  async function handleScriptUpload(event) {
    const file = event.target.files?.[0];
    await applyScriptUploadFile(file);
    event.target.value = '';
  }

  function handleScriptUploadDragEnter(event) {
    if (!isFileDragTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    scriptUploadDragDepthRef.current += 1;
    setIsScriptUploadDragging(true);
  }

  function handleScriptUploadDragOver(event) {
    if (!isFileDragTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (!isScriptUploadDragging) {
      setIsScriptUploadDragging(true);
    }
  }

  function handleScriptUploadDragLeave(event) {
    if (!isFileDragTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    scriptUploadDragDepthRef.current = Math.max(0, scriptUploadDragDepthRef.current - 1);
    if (scriptUploadDragDepthRef.current === 0) {
      setIsScriptUploadDragging(false);
    }
  }

  async function handleScriptUploadDrop(event) {
    if (!isFileDragTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    scriptUploadDragDepthRef.current = 0;
    setIsScriptUploadDragging(false);
    const file = event.dataTransfer?.files?.[0];
    await applyScriptUploadFile(file);
  }

  // 触发脚本解析：上传/更新脚本 -> 调用 analyze -> 轮询 /analysis -> 刷新项目。
  async function parseScriptAndMove(stepTo = 2, options = {}) {
    const { clearExistingGeneratedData = false } = options;
    const safeScript = activeProject.scriptText.trim();
    const hasScriptUploadFile = Boolean(activeProject.scriptUploadFile);
    if (!safeScript && !hasScriptUploadFile) {
      showMessage('请先上传或输入剧本内容', 'warning');
      return;
    }
    const fallbackProjectForRefresh = clearExistingGeneratedData
      ? clearGeneratedProjectData({
        ...activeProject,
        scriptText: safeScript,
      })
      : activeProject;

    const analysisBindingId = resolveScriptAnalysisBindingId(featureModelsConfigRef.current);
    if (!analysisBindingId) {
      showMessage('未配置剧本解析模型，请检查 feature-models 配置', 'error');
      return;
    }

    try {
      const canGenerate = await confirmPointsForGeneration({
        bindingId: analysisBindingId,
        title: '确认生成设定',
        actionName: '剧本设定生成',
        params: {
          scriptLength: safeScript.length,
          hasUploadFile: hasScriptUploadFile,
        },
      });
      if (!canGenerate) {
        return;
      }
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '积分校验失败'), 'error');
      return;
    }

    setIsParsing(true);
    setSelectedEpisodeId('');

    onUpdateProject((current) => ({
      ...(clearExistingGeneratedData ? clearGeneratedProjectData(current) : current),
      scriptText: safeScript,
      parseStatus: 'parsing',
    }));

    try {
      const projectId = await ensureRemoteProject(safeScript);
      await projectApi.analyzeProject(projectId, {
        binding_id: analysisBindingId,
      });
      await refreshPointsAfterGeneration();
      const completedProjectData = await waitProjectAnalysisCompleted(projectId);

      const nextProject = await refreshProjectFromServer(projectId, {
        includeAnalysis: true,
        includeStoryboards: !clearExistingGeneratedData,
        fallbackProject: fallbackProjectForRefresh,
        initialProjectData: completedProjectData,
      });
      setSelectedEpisodeId(nextProject.episodes[0]?.id || '');
      setActiveStep(stepTo);
    } catch (error) {
      const message = parseApiErrorMessage(error, '解析剧本失败');
      showMessage(message, 'error');
      onUpdateProject((current) => ({
        ...current,
        parseStatus: 'failed',
      }));
    } finally {
      setIsParsing(false);
    }
  }

  // 第一步“生成设定”入口。
  function handleGenerateSetting() {
    if (!activeProject.name.trim()) {
      showMessage('请先填写项目名称', 'warning');
      return;
    }

    if (!selectedVisualStyleId) {
      showMessage('请先选择视觉风格', 'warning');
      return;
    }

    if (isSettingGenerating) {
      showMessage('正在生成设定，请稍候', 'info');
      return;
    }

    const hasGeneratedSetting =
      activeProject.parseStatus === 'done' ||
      activeProject.episodes.length > 0 ||
      activeProject.characters.length > 0 ||
      activeProject.scenes.length > 0;

    if (!hasGeneratedSetting) {
      parseScriptAndMove(2);
      return;
    }

    openConfirmDialog({
      title: '确认重新生成设定',
      content: '重新生成会覆盖当前剧本设定（分集/角色/场景），是否继续？',
      confirmText: '确认生成',
      cancelText: '取消',
      closeOnConfirm: true,
      onConfirm: async () => {
        await parseScriptAndMove(2, {
          clearExistingGeneratedData: true,
        });
      },
    });
  }

  // 新建前端本地项目。
  function handleCreateProject() {
    onCreateProject({
      name: '',
      seriesName: '第一季',
      genre: '古风',
      targetPlatform: '抖音',
      episodeCount: 12,
      template: '空白模板',
      deliveryType: DELIVERY_TYPES[0],
      creationMode: CREATION_MODES[0],
      aspectRatio: ASPECT_RATIOS[0],
      visualStyleId: managedProjectStyles[0]?.id || '',
    });
  }

  // 生成分镜入口：先同步草稿，再调用后端生成任务。
  async function handleGenerateStoryboard() {
    if (isStoryboardGenerating) {
      showMessage('分镜生成中，请稍候', 'info');
      return;
    }

    if (activeProject.episodes.length === 0) {
      showMessage('请先在第 1 步解析剧本', 'warning');
      return;
    }

    if (!activeProject.backendProjectId) {
      showMessage('请先上传并解析剧本', 'warning');
      return;
    }

    const missingCharacterImageCount = activeProject.characters.filter(
      (character) => !String(character.avatarUrl || '').trim(),
    ).length;
    const missingSceneImageCount = activeProject.scenes.filter(
      (scene) => !String(scene.imageUrl || '').trim(),
    ).length;

    if (missingCharacterImageCount > 0 || missingSceneImageCount > 0) {
      const missingParts = [];
      if (missingCharacterImageCount > 0) {
        missingParts.push(`角色设定有 ${missingCharacterImageCount} 个未生成图片`);
      }
      if (missingSceneImageCount > 0) {
        missingParts.push(`场景设定有 ${missingSceneImageCount} 个未生成图片`);
      }
      showMessage(`${missingParts.join('，')}，请先补全后再生成分镜`, 'warning');
      return;
    }

    const storyboardBindingId = resolveStoryboardGenerationBindingId(featureModelsConfigRef.current);
    if (!storyboardBindingId) {
      showMessage('未配置分镜生成模型，请检查 feature-models 配置', 'error');
      return;
    }

    try {
      const canGenerate = await confirmPointsForGeneration({
        bindingId: storyboardBindingId,
        title: '确认生成分镜',
        actionName: '分镜生成',
        params: {
          episodeCount: activeProject.episodes.length,
          characterCount: activeProject.characters.length,
          sceneCount: activeProject.scenes.length,
        },
      });
      if (!canGenerate) {
        return;
      }
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '积分校验失败'), 'error');
      return;
    }

    setIsGeneratingStoryboard(true);
    try {
      await syncProjectDraftToServer(activeProject, activeProject.backendProjectId);
      await storyboardApi.generateProjectStoryboards(activeProject.backendProjectId, {
        overwrite: true,
        binding_id: storyboardBindingId,
      });
      await refreshPointsAfterGeneration();
      await waitProjectStoryboardCompleted(activeProject.backendProjectId);
      const nextProject = await refreshProjectFromServer(activeProject.backendProjectId, {
        includeAnalysis: true,
      });
      setSelectedEpisodeId(nextProject.episodes[0]?.id || '');
      setActiveStep(3);
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '生成分镜失败'), 'error');
    } finally {
      setIsGeneratingStoryboard(false);
    }
  }

  // 更新单个分集对象。
  function updateEpisode(episodeId, updater) {
    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => (episode.id === episodeId ? updater(episode) : episode)),
    }));
  }

  function handleEpisodeScriptChange(episodeId, scriptContent) {
    updateEpisode(episodeId, (episode) => ({
      ...episode,
      scriptContent,
    }));
  }

  async function handleEpisodeScriptBlur(episodeId, scriptContent) {
    const projectSnapshot = latestProjectRef.current || activeProject;
    const projectId = projectSnapshot?.backendProjectId || '';
    const episode = (projectSnapshot?.episodes || []).find((item) => item.id === episodeId);
    const episodeNo = Number(episode?.episodeNo);

    if (!projectId || !Number.isInteger(episodeNo) || episodeNo <= 0) {
      return;
    }

    const actionKey = getUpdateEpisodeScriptActionKey(episodeId);
    await enqueueSerialUpdate(actionKey, async () => {
      markActionPending(actionKey, true);
      try {
        await projectApi.updateEpisodeScript(projectId, episodeNo, {
          script_content: scriptContent || '',
          title: episode.title || null,
          summary: episode.summary || null,
        });
      } catch (error) {
        showMessage(parseApiErrorMessage(error, '保存分集剧本失败'), 'error');
      } finally {
        markActionPending(actionKey, false);
      }
    });
  }

  // 更新单个分镜对象。
  function updateStoryboard(episodeId, storyboardId, updater) {
    updateEpisode(episodeId, (episode) => ({
      ...episode,
      storyboards: episode.storyboards.map((storyboard) =>
        storyboard.id === storyboardId ? updater(storyboard) : storyboard,
      ),
    }));
  }

  function markBatchStoryboardMediaStatus(mediaType, nextStatus = 'queued', taskId = '') {
    const normalizedTaskId = String(taskId || '').trim();
    onUpdateProject((current) => ({
      ...current,
      ...(mediaType === 'cover'
        ? {
          storyboardCoverBatchStatus: nextStatus,
          storyboardCoverBatchTaskId: normalizedTaskId,
          storyboardCoverBatchErrorMessage: '',
        }
        : {}),
      episodes: current.episodes.map((episode) => ({
        ...episode,
        storyboards: episode.storyboards.map((storyboard) => {
          if (!storyboard?.id) {
            return storyboard;
          }

          if (mediaType === 'cover') {
            return {
              ...storyboard,
              coverStatus: nextStatus,
              coverTaskId: normalizedTaskId,
              coverErrorMessage: '',
            };
          }

          return {
            ...storyboard,
            videoStatus: nextStatus,
            videoTaskId: normalizedTaskId,
            videoErrorMessage: '',
          };
        }),
      })),
    }));
  }

  function toggleStoryboardCollapse(storyboardId) {
    setCollapsedStoryboardIds((current) => {
      const next = new Set(current);
      if (next.has(storyboardId)) {
        next.delete(storyboardId);
      } else {
        next.add(storyboardId);
      }
      return next;
    });
  }

  function cleanupRemovedStoryboardUiState(storyboardId) {
    setCollapsedStoryboardIds((current) => {
      if (!current.has(storyboardId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(storyboardId);
      return next;
    });
  }

  function removeStoryboardFromProject(projectSnapshot, episodeId, storyboardId) {
    if (!projectSnapshot) {
      return projectSnapshot;
    }

    return {
      ...projectSnapshot,
      episodes: projectSnapshot.episodes.map((episode) =>
        episode.id === episodeId
          ? {
            ...episode,
            storyboards: normalizeStoryboardSequence(
              episode.storyboards.filter((storyboard) => storyboard.id !== storyboardId),
              { syncSortOrder: true },
            ),
          }
          : episode,
      ),
    };
  }

  // 删除分镜：后端项目走删除接口，本地项目直接更新内存。
  function removeStoryboard(episodeId, storyboardId) {
    const targetEpisode =
      activeProject.episodes.find((episode) => episode.id === episodeId) || null;
    const targetStoryboard =
      targetEpisode?.storyboards.find((storyboard) => storyboard.id === storyboardId) || null;

    if (!targetEpisode || !targetStoryboard) {
      return;
    }

    openConfirmDialog({
      title: '删除分镜',
      content: `确认删除${targetStoryboard.title || '该分镜'}吗？`,
      confirmText: '删除',
      onConfirm: async () => {
        if (activeProject.backendProjectId && storyboardId) {
          await withActionPending(
            getRemoveStoryboardActionKey(storyboardId),
            async () => {
              await storyboardApi.removeProjectStoryboard(activeProject.backendProjectId, storyboardId);

              const baseProject = latestProjectRef.current || activeProject;
              const nextProject = applyProjectSnapshot(
                removeStoryboardFromProject(baseProject, episodeId, storyboardId),
              );
              cleanupRemovedStoryboardUiState(storyboardId);

              try {
                await refreshProjectFromServer(activeProject.backendProjectId, {
                  includeAnalysis: true,
                  fallbackProject: nextProject,
                });
              } catch {
                showMessage('分镜已删除，最新分镜列表刷新失败', 'warning');
              }
            },
            '正在删除分镜，请稍候',
          );
          return;
        }

        applyProjectSnapshot(removeStoryboardFromProject(activeProject, episodeId, storyboardId));
        cleanupRemovedStoryboardUiState(storyboardId);
      },
    });
  }

  async function handleStoryboardDescriptionBlur(episodeId, storyboardId, description) {
    await persistStoryboardInfoPatch(
      episodeId,
      storyboardId,
      { description },
      '保存分镜描述失败',
    );
  }

  async function handleStoryboardSceneChange(episodeId, storyboardId, sceneId) {
    const matchedScene = activeProject.scenes.find(
      (scene) => normalizeEntityId(scene.id) === normalizeEntityId(sceneId),
    ) || null;

    updateStoryboard(episodeId, storyboardId, (current) => ({
      ...current,
      sceneId,
      sceneName: matchedScene?.name || '',
    }));

    await persistStoryboardInfoPatch(
      episodeId,
      storyboardId,
      {
        sceneId,
        sceneName: matchedScene?.name || '',
      },
      '切换场景失败',
    );
  }

  async function handleStoryboardImagePromptBlur(episodeId, storyboardId, imagePrompt) {
    const storyboardForQuote = getProjectStoryboardById(storyboardId);
    if (storyboardForQuote) {
      void refreshStoryboardCoverQuote({
        ...storyboardForQuote,
        imagePrompt,
      });
    }

    await persistStoryboardInfoPatch(
      episodeId,
      storyboardId,
      { imagePrompt },
      '保存参考图提示词失败',
    );
  }

  async function handleStoryboardVideoPromptBlur(episodeId, storyboardId, videoPrompt) {
    const storyboardForQuote = getProjectStoryboardById(storyboardId);
    if (storyboardForQuote) {
      void refreshStoryboardVideoQuote({
        ...storyboardForQuote,
        videoPrompt,
      });
    }

    await persistStoryboardInfoPatch(
      episodeId,
      storyboardId,
      { videoPrompt },
      '保存视频提示词失败',
    );
  }

  // 生成单张参考图：后端任务或本地兜底。
  async function generateFirstImage(episodeId, storyboardId) {
    if (activeProject.backendProjectId) {
      const storyboard = activeProject.episodes
        .flatMap((episode) => episode.storyboards)
        .find((item) => item.id === storyboardId);
      if (!storyboard?.id) {
        return;
      }

      const actionKey = getGenerateFirstImageActionKey(storyboard.id);
      const bindingId = resolveBindingId(activeProject?.modelConfig?.storyboardCoverModel);
      if (!bindingId) {
        showMessage('未配置参考图生成模型，请检查 feature-models 配置', 'error');
        return;
      }
      const canGenerate = await confirmPointsBeforeGeneration(
        actionKey,
        {
          bindingId,
          title: '确认生成参考图',
          actionName: '参考图生成',
          params: {
            storyboardId: storyboard.id,
            prompt: storyboard.imagePrompt || storyboard.description || '',
            count: 1,
          },
        },
        '生成参考图失败',
      );
      if (!canGenerate) {
        return;
      }

      await withActionPending(
        actionKey,
        async () => {
          try {
            await persistStoryboardInfoDraft(activeProject.backendProjectId, storyboard);
            const taskStatus = await storyboardApi.generateProjectStoryboardCover(
              activeProject.backendProjectId,
              storyboard.id,
              {
                binding_id: bindingId,
              },
            );
            await refreshPointsAfterGeneration();
            await waitTaskSucceeded(taskStatus, '生成参考图失败');
            const completedStoryboard = await waitStoryboardCoverCompleted(
              activeProject.backendProjectId,
              storyboard.id,
            );
            applyStoryboardSnapshotToProject(completedStoryboard);
          } catch (error) {
            if (error?.storyboardSnapshot) {
              applyStoryboardSnapshotToProject(error.storyboardSnapshot);
            }
            showMessage(parseApiErrorMessage(error, '生成参考图失败'), 'error');
          }
        },
        '该分镜参考图生成中，请稍候',
      );
      return;
    }

    const cover = getStyleCover(managedProjectStylesRef.current, activeProject.visualStyleId);
    updateStoryboard(episodeId, storyboardId, (storyboard) => ({
      ...storyboard,
      firstImage: {
        name: `${storyboard.title}-参考图.png`,
        at: formatTime(),
        prompt: storyboard.imagePrompt,
        preview: cover,
      },
    }));
  }

  // 上传单张参考图：后端上传或本地 FileReader 预览。
  async function uploadFirstImage(event, episodeId, storyboardId) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (activeProject.backendProjectId) {
      const storyboard = activeProject.episodes
        .flatMap((episode) => episode.storyboards)
        .find((item) => item.id === storyboardId);
      if (!storyboard?.id) {
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      await withActionPending(
        getUploadFirstImageActionKey(storyboard.id),
        async () => {
          try {
            await storyboardApi.uploadProjectStoryboardCover(
              activeProject.backendProjectId,
              storyboard.id,
              formData,
            );
            await refreshProjectFromServer(activeProject.backendProjectId, {
              includeAnalysis: true,
            });
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '上传参考图失败'), 'error');
          }
        },
        '该分镜图片上传中，请稍候',
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateStoryboard(episodeId, storyboardId, (storyboard) => ({
        ...storyboard,
        firstImage: {
          name: file.name,
          at: formatTime(),
          prompt: storyboard.imagePrompt,
          preview: typeof reader.result === 'string' ? reader.result : '',
        },
      }));
    };
    reader.readAsDataURL(file);
  }

  // 生成视频：后端任务或本地兜底。
  async function generateVideo(episodeId, storyboardId, mode = '生成') {
    if (activeProject.backendProjectId) {
      const storyboard = activeProject.episodes
        .flatMap((episode) => episode.storyboards)
        .find((item) => item.id === storyboardId);
      if (!storyboard?.id) {
        return;
      }

      if (!storyboard.firstImage) {
        showMessage('请先生成或上传参考图', 'warning');
        return;
      }

      const actionKey = getGenerateVideoActionKey(storyboard.id);
      const bindingId = resolveBindingId(activeProject?.modelConfig?.storyboardVideoModel);
      if (!bindingId) {
        showMessage('未配置视频生成模型，请检查 feature-models 配置', 'error');
        return;
      }
      const canGenerate = await confirmPointsBeforeGeneration(
        actionKey,
        {
          bindingId,
          title: '确认生成视频',
          actionName: '视频生成',
          params: {
            storyboardId: storyboard.id,
            prompt: storyboard.videoPrompt || storyboard.description || '',
            count: 1,
            duration: normalizeStoryboardVideoDuration(storyboard.videoDuration),
            hasImage: true,
          },
        },
        `${mode}视频失败`,
      );
      if (!canGenerate) {
        return;
      }

      await withActionPending(
        actionKey,
        async () => {
          try {
            await persistStoryboardInfoDraft(activeProject.backendProjectId, storyboard);
            const taskStatus = await storyboardApi.generateProjectStoryboardVideo(
              activeProject.backendProjectId,
              storyboard.id,
              {
                binding_id: bindingId,
              },
            );
            await refreshPointsAfterGeneration();
            await waitTaskSucceeded(taskStatus, `${mode}视频失败`);
            const completedStoryboard = await waitStoryboardVideoCompleted(
              activeProject.backendProjectId,
              storyboard.id,
            );
            applyStoryboardSnapshotToProject(completedStoryboard);
          } catch (error) {
            if (error?.storyboardSnapshot) {
              applyStoryboardSnapshotToProject(error.storyboardSnapshot);
            }
            showMessage(parseApiErrorMessage(error, `${mode}视频失败`), 'error');
          }
        },
        '该分镜视频生成中，请稍候',
      );
      return;
    }

    const storyboard = activeProject.episodes
      .flatMap((episode) => episode.storyboards)
      .find((item) => item.id === storyboardId);
    if (!storyboard?.firstImage) {
      showMessage('请先生成或上传参考图', 'warning');
      return;
    }

    updateStoryboard(episodeId, storyboardId, (current) => ({
      ...current,
      video: {
        name: `${current.title}-video.mp4`,
        mode,
        at: formatTime(),
        prompt: current.videoPrompt,
      },
    }));
  }

  function handleRegenerateFirstImage(episodeId, storyboardId) {
    const storyboard = activeProject.episodes
      .flatMap((episode) => episode.storyboards)
      .find((item) => item.id === storyboardId);
    if (!storyboard?.firstImage) {
      generateFirstImage(episodeId, storyboardId);
      return;
    }

    openConfirmDialog({
      title: '确认重新生成参考图',
      content: '重新生成会覆盖当前参考图内容，是否继续？',
      confirmText: '确认重新生成',
      cancelText: '取消',
      closeOnConfirm: true,
      onConfirm: async () => {
        await generateFirstImage(episodeId, storyboardId);
      },
    });
  }

  function handleGenerateVideoAction(episodeId, storyboardId) {
    const storyboard = activeProject.episodes
      .flatMap((episode) => episode.storyboards)
      .find((item) => item.id === storyboardId);
    if (!storyboard) {
      return;
    }

    if (!storyboard.video) {
      void generateVideo(episodeId, storyboardId, '生成');
      return;
    }

    openConfirmDialog({
      title: '确认重新生成视频',
      content: '重新生成会覆盖当前视频内容，是否继续？',
      confirmText: '确认重新生成',
      cancelText: '取消',
      closeOnConfirm: true,
      onConfirm: async () => {
        await generateVideo(episodeId, storyboardId, '重新生成');
      },
    });
  }

  // 批量生成参考图：后端逐个任务执行或本地批量兜底。
  async function batchGenerateImages() {
    if (activeProject.backendProjectId) {
      const allStoryboards = activeProject.episodes.flatMap((episode) => episode.storyboards);
      if (allStoryboards.length === 0) {
        showMessage('暂无可生成参考图的分镜', 'warning');
        return;
      }

      const bindingId = resolvedBatchStoryboardCoverBindingId;
      if (!bindingId) {
        showMessage('未配置参考图批量生成模型，请检查 feature-models 配置', 'error');
        return;
      }
      const canGenerate = await confirmPointsBeforeGeneration(
        ACTION_BATCH_IMAGES,
        {
          bindingId,
          title: '确认批量生成参考图',
          actionName: '批量生成参考图',
          params: {
            count: allStoryboards.length,
            storyboardCount: allStoryboards.length,
          },
        },
        '批量生成参考图失败',
      );
      if (!canGenerate) {
        return;
      }

      await withActionPending(
        ACTION_BATCH_IMAGES,
        async () => {
          try {
            const taskStatus = await storyboardApi.generateProjectStoryboardCoverBatch(
              activeProject.backendProjectId,
              {
                binding_id: bindingId,
              },
            );
            await refreshPointsAfterGeneration();
            const acceptedTask = ensureBatchStoryboardGenerationAccepted(taskStatus, '批量生成参考图失败');
            markBatchStoryboardMediaStatus('cover', 'queued', acceptedTask?.id || '');
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '批量生成参考图失败'), 'error');
          }
        },
        '正在批量生成参考图，请稍候',
      );
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => ({
        ...episode,
        storyboards: episode.storyboards.map((storyboard) => ({
          ...storyboard,
          firstImage: {
            name: `${storyboard.title}-参考图.png`,
            at: formatTime(),
            prompt: storyboard.imagePrompt,
            preview: getStyleCover(managedProjectStylesRef.current, current.visualStyleId),
          },
        })),
      })),
    }));
  }


  // 批量转视频：后端逐个任务执行或本地批量兜底。
  async function batchGenerateVideos() {

    if (activeProject.backendProjectId) {
      const allStoryboards = activeProject.episodes.flatMap((episode) => episode.storyboards);
      if (allStoryboards.length === 0) {
        showMessage('暂无可转视频的分镜', 'warning');
        return;
      }

      const missingCoverCount = allStoryboards.filter((storyboard) => !storyboard.firstImage).length;
      if (missingCoverCount > 0) {
        showMessage(`还有 ${missingCoverCount} 个分镜未生成参考图，请先完成参考图生成`, 'warning');
        return;
      }


      const bindingId = resolvedBatchStoryboardVideoBindingId;
      if (!bindingId) {
        showMessage('未配置视频批量生成模型，请检查 feature-models 配置', 'error');
        return;
      }
      const videoBatchQuoteParams = buildStoryboardVideoBatchQuoteParams(allStoryboards);
      const canGenerate = await confirmPointsBeforeGeneration(
        ACTION_BATCH_VIDEOS,
        {
          bindingId,
          title: '确认批量转视频',
          actionName: '批量转视频',
          params: videoBatchQuoteParams,
        },
        '批量转视频失败',
      );
      if (!canGenerate) {
        return;
      }

      await withActionPending(
        ACTION_BATCH_VIDEOS,
        async () => {
          try {
            const taskStatus = await storyboardApi.generateProjectStoryboardVideoBatch(
              activeProject.backendProjectId,
              {
                binding_id: bindingId,
              },
            );
            await refreshPointsAfterGeneration();
            const acceptedTask = ensureBatchStoryboardGenerationAccepted(taskStatus, '批量转视频失败');
            markBatchStoryboardMediaStatus('video', 'queued', acceptedTask?.id || '');
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '批量转视频失败'), 'error');
          }
        },
        '正在批量转视频，请稍候',
      );
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => ({
        ...episode,
        storyboards: episode.storyboards.map((storyboard) =>
          storyboard.firstImage
            ? {
              ...storyboard,
              video: {
                name: `${storyboard.title}-video.mp4`,
                mode: '一键生成',
                at: formatTime(),
                prompt: storyboard.videoPrompt,
              },
            }
            : storyboard,
        ),
      })),
    }));
  }

  // 新增角色：后端项目走创建接口，本地项目走内存添加。
  async function addCharacter() {
    const defaultVoice = getDefaultCharacterVoice(activeProject.characters.length);
    if (activeProject.backendProjectId) {
      const nextName = `角色${activeProject.characters.length + 1}`;
      await withActionPending(
        ACTION_ADD_CHARACTER,
        async () => {
          try {
            await characterApi.createProjectCharacter(activeProject.backendProjectId, {
              name: nextName,
              description: '请补充角色设定',
              voice_name: defaultVoice.defaultVoice,
              voice_id: defaultVoice.voiceId,
            });
            await refreshProjectFromServer(activeProject.backendProjectId, {
              includeAnalysis: true,
            });
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '新增角色失败'), 'error');
          }
        },
        '正在新增角色，请稍候',
      );
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      characters: [
        ...current.characters,
        {
          id: createId('char'),
          name: `角色${current.characters.length + 1}`,
          bio: '请补充角色设定',
          defaultVoice: defaultVoice.defaultVoice,
          voiceId: defaultVoice.voiceId,
        },
      ],
    }));
  }

  async function regenerateCharacterAvatar(characterId) {
    const sourceCharacter = activeProject.characters.find((item) => item.id === characterId);
    const targetCharacter =
      characterConfigModal.open && configuredCharacter?.id === characterId
        ? getConfiguredCharacterSnapshot(false) || sourceCharacter
        : sourceCharacter;
    if (!targetCharacter) {
      return;
    }

    if (characterConfigModal.open && configuredCharacter?.id === characterId) {
      updateCharacterFields(characterId, {
        bio: targetCharacter.bio || '',
        defaultVoice: targetCharacter.defaultVoice || '',
        voiceId: targetCharacter.voiceId || '',
        avatarPrompt: targetCharacter.avatarPrompt || '',
      });
    }

    if (!activeProject.backendProjectId) {
      const cover = getStyleCover(managedProjectStylesRef.current, activeProject.visualStyleId);
      updateCharacterFields(characterId, {
        avatarUrl: cover,
        avatarStatus: 'success',
        avatarErrorMessage: '',
      });
      showMessage('已使用当前风格生成本地角色外观', 'success');
      return;
    }

    await withActionPending(
      getRegenerateCharacterAvatarActionKey(characterId),
      async () => {
        try {
          const payload = {
            name: targetCharacter.name || '',
            description: targetCharacter.bio || '',
            voice_name: targetCharacter.defaultVoice || '',
            voice_id: targetCharacter.voiceId || '',
            image_prompt: targetCharacter.avatarPrompt || '',
          };
          const bindingId = resolveBindingId(activeProject?.modelConfig?.characterModel);
          if (!bindingId) {
            throw new Error('未配置角色生成模型，请检查 feature-models 配置');
          }
          const canGenerate = await confirmPointsForGeneration({
            bindingId,
            title: '确认生成角色',
            actionName: '角色形象生成',
            params: {
              characterId,
              prompt: targetCharacter.avatarPrompt || '',
              count: 1,
            },
          });
          if (!canGenerate) {
            return;
          }
          await characterApi.updateProjectCharacter(activeProject.backendProjectId, characterId, payload);
          await characterApi.generateProjectCharacterAvatar(activeProject.backendProjectId, characterId, {
            binding_id: bindingId,
          });
          await refreshPointsAfterGeneration();
          await waitProjectCharacterAssetGenerationCompletedById(
            activeProject.backendProjectId,
            characterId,
          );
          await refreshProjectFromServer(activeProject.backendProjectId, {
            includeAnalysis: true,
          });
        } catch (error) {
          showMessage(parseApiErrorMessage(error, '角色形象生成失败'), 'error');
        }
      },
      '角色形象生成中，请稍候',
    );
  }

  // 一键生成角色设定：批量生成角色头像并轮询 /characters。
  async function generateCharacterAssets() {
    if (isCharacterAssetsGenerating) {
      showMessage('角色设定生成中，请稍候', 'info');
      return;
    }

    if (!activeProject.backendProjectId) {
      showMessage('请先在第 1 步解析剧本', 'warning');
      return;
    }

    if (activeProject.characters.length === 0) {
      showMessage('暂无可生成角色设定的角色', 'warning');
      return;
    }

    const bindingId = resolveBindingId(activeProject?.modelConfig?.characterModel);
    if (!bindingId) {
      showMessage('未配置角色生成模型，请检查 feature-models 配置', 'error');
      return;
    }

    try {
      const canGenerate = await confirmPointsForGeneration({
        bindingId,
        title: '确认批量生成角色',
        actionName: '批量生成角色',
        params: {
          count: activeProject.characters.length,
          characterCount: activeProject.characters.length,
        },
      });
      if (!canGenerate) {
        return;
      }
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '积分校验失败'), 'error');
      return;
    }

    setIsGeneratingCharacterAssets(true);
    try {
      await characterApi.generateProjectCharactersAvatarBatch(activeProject.backendProjectId, {
        binding_id: bindingId,
      });
      await refreshPointsAfterGeneration();
      markAllCharacterCardsGenerating();
      await waitProjectCharacterAssetGenerationCompleted(
        activeProject.backendProjectId,
        activeProject.characters.length,
      );
      await refreshProjectFromServer(activeProject.backendProjectId, {
        includeAnalysis: true,
      });
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '一键生成角色设定失败'), 'error');
    } finally {
      setIsGeneratingCharacterAssets(false);
    }
  }

  // 新增场景：后端项目走创建接口，本地项目走内存添加。
  async function addScene() {
    if (activeProject.backendProjectId) {
      const nextName = `场景${activeProject.scenes.length + 1}`;
      await withActionPending(
        ACTION_ADD_SCENE,
        async () => {
          try {
            await sceneApi.createProjectScene(activeProject.backendProjectId, {
              name: nextName,
              description: '请补充场景描述',
              prompt: '',
              related_characters: [],
            });
            await refreshProjectFromServer(activeProject.backendProjectId, {
              includeAnalysis: true,
            });
          } catch (error) {
            showMessage(parseApiErrorMessage(error, '新增场景失败'), 'error');
          }
        },
        '正在新增场景，请稍候',
      );
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      scenes: [
        ...current.scenes,
        {
          id: createId('scene'),
          name: `场景${current.scenes.length + 1}`,
          description: '请补充场景描述',
        },
      ],
    }));
  }

  async function removeCharacter(characterId) {
    const targetCharacter = activeProject.characters.find((item) => item.id === characterId);
    if (!targetCharacter) {
      return;
    }

    function removeCharacterFromLocalDraft() {
      onUpdateProject((current) => ({
        ...current,
        characters: current.characters.filter((item) => item.id !== characterId),
        scenes: current.scenes.map((scene) => ({
          ...scene,
          relatedCharacters: Array.isArray(scene.relatedCharacters)
            ? scene.relatedCharacters.filter((itemId) => itemId !== characterId)
            : [],
        })),
        episodes: current.episodes.map((episode) => ({
          ...episode,
          storyboards: episode.storyboards.map((storyboard) => ({
            ...storyboard,
            presentCharacters: getStoryboardPresentCharacters(storyboard).filter(
              (item) => item.characterId !== characterId,
            ),
            presentCharacterIds: getStoryboardPresentCharacterIds(storyboard).filter(
              (itemId) => itemId !== characterId,
            ),
            cast: storyboard.cast.filter((castLine) => castLine.characterId !== characterId),
          })),
        })),
      }));
    }

    openConfirmDialog({
      title: '删除角色',
      content: `确认删除角色「${targetCharacter.name || '未命名角色'}」吗？`,
      confirmText: '删除',
      onConfirm: async () => {
        if (activeProject.backendProjectId && characterId) {
          await withActionPending(
            getRemoveCharacterActionKey(characterId),
            async () => {
              await characterApi.deleteProjectCharacter(activeProject.backendProjectId, characterId);
              removeCharacterFromLocalDraft();
              await refreshProjectFromServer(activeProject.backendProjectId, {
                includeAnalysis: true,
              });
            },
            '正在删除角色，请稍候',
          );
          return;
        }

        removeCharacterFromLocalDraft();
      },
    });
  }

  async function removeScene(sceneId) {
    const targetScene = activeProject.scenes.find((item) => item.id === sceneId);
    if (!targetScene) {
      return;
    }

    function removeSceneFromLocalDraft() {
      onUpdateProject((current) => {
        const nextScenes = current.scenes.filter((item) => item.id !== sceneId);
        const fallbackScene = nextScenes[0] || null;
        return {
          ...current,
          scenes: nextScenes,
          episodes: current.episodes.map((episode) => ({
            ...episode,
            storyboards: episode.storyboards.map((storyboard) =>
              storyboard.sceneId === sceneId
                ? {
                  ...storyboard,
                  sceneId: fallbackScene?.id || '',
                  sceneName: fallbackScene?.name || '',
                }
                : storyboard,
            ),
          })),
        };
      });
    }

    openConfirmDialog({
      title: '删除场景',
      content: `确认删除场景「${targetScene.name || '未命名场景'}」吗？`,
      confirmText: '删除',
      onConfirm: async () => {
        if (activeProject.backendProjectId && sceneId) {
          await withActionPending(
            getRemoveSceneActionKey(sceneId),
            async () => {
              await sceneApi.deleteProjectScene(activeProject.backendProjectId, sceneId);
              await refreshProjectFromServer(activeProject.backendProjectId, {
                includeAnalysis: true,
              });
            },
            '正在删除场景，请稍候',
          );
          return;
        }

        removeSceneFromLocalDraft();
      },
    });
  }

  async function regenerateSceneImage(sceneId) {
    const targetScene = activeProject.scenes.find((item) => item.id === sceneId);
    if (!targetScene) {
      return;
    }

    if (!activeProject.backendProjectId) {
      const cover = getStyleCover(managedProjectStylesRef.current, activeProject.visualStyleId);
      updateSceneFields(sceneId, {
        imageUrl: cover,
        imageStatus: 'success',
        imageErrorMessage: '',
      });
      showMessage('已使用当前风格生成本地场景图', 'success');
      return;
    }

    await withActionPending(
      getRegenerateSceneImageActionKey(sceneId),
      async () => {
        try {
          const payload = {
            name: targetScene.name || '',
            prompt: targetScene.prompt || '',
            description: targetScene.description || '',
            related_characters: targetScene.relatedCharacters || [],
          };
          const bindingId = resolveBindingId(activeProject?.modelConfig?.sceneModel);
          if (!bindingId) {
            throw new Error('未配置场景生成模型，请检查 feature-models 配置');
          }
          const canGenerate = await confirmPointsForGeneration({
            bindingId,
            title: '确认生成场景',
            actionName: '场景图生成',
            params: {
              sceneId,
              prompt: targetScene.prompt || targetScene.description || '',
              count: 1,
            },
          });
          if (!canGenerate) {
            return;
          }
          await sceneApi.updateProjectScene(activeProject.backendProjectId, sceneId, payload);
          await sceneApi.generateProjectSceneImage(activeProject.backendProjectId, sceneId, {
            binding_id: bindingId,
          });
          await refreshPointsAfterGeneration();
          await waitProjectSceneAssetGenerationCompletedById(
            activeProject.backendProjectId,
            sceneId,
          );
          await refreshProjectFromServer(activeProject.backendProjectId, {
            includeAnalysis: true,
          });
        } catch (error) {
          showMessage(parseApiErrorMessage(error, '场景图生成失败'), 'error');
        }
      },
      '场景图生成中，请稍候',
    );
  }

  // 一键生成场景设定：批量生成场景图并轮询 /scenes。
  async function generateSceneAssets() {
    if (isSceneAssetsGenerating) {
      showMessage('场景设定生成中，请稍候', 'info');
      return;
    }

    if (!activeProject.backendProjectId) {
      showMessage('请先在第 1 步解析剧本', 'warning');
      return;
    }

    if (activeProject.scenes.length === 0) {
      showMessage('暂无可生成场景设定的场景', 'warning');
      return;
    }

    const bindingId = resolveBindingId(activeProject?.modelConfig?.sceneModel);
    if (!bindingId) {
      showMessage('未配置场景生成模型，请检查 feature-models 配置', 'error');
      return;
    }

    try {
      const canGenerate = await confirmPointsForGeneration({
        bindingId,
        title: '确认批量生成场景',
        actionName: '批量生成场景',
        params: {
          count: activeProject.scenes.length,
          sceneCount: activeProject.scenes.length,
        },
      });
      if (!canGenerate) {
        return;
      }
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '积分校验失败'), 'error');
      return;
    }

    setIsGeneratingSceneAssets(true);
    try {
      await sceneApi.generateProjectSceneImageBatch(activeProject.backendProjectId, {
        binding_id: bindingId,
      });
      await refreshPointsAfterGeneration();
      markAllSceneCardsGenerating();
      await waitProjectSceneAssetGenerationCompleted(
        activeProject.backendProjectId,
        activeProject.scenes.length,
      );
      await refreshProjectFromServer(activeProject.backendProjectId, {
        includeAnalysis: true,
      });
    } catch (error) {
      showMessage(parseApiErrorMessage(error, '一键生成场景设定失败'), 'error');
    } finally {
      setIsGeneratingSceneAssets(false);
    }
  }

  // 工作流步骤切换（仅允许到达可达步骤）。
  function goToStep(stepId) {
    if (stepId > maxReachableStep) {
      return;
    }
    setActiveStep(stepId);
  }

  // 从首页入口进入工作流。
  function enterWorkflow() {
    if (!activeProject) {
      handleCreateProject();
    }
    setActiveStep(getProjectDefaultStep(activeProject));
    if (routeMode) {
      onRequestCreation?.();
      return;
    }
    setViewMode('workflow');
  }

  // 从首页进入画布流程入口。
  function enterCanvasWorkflow() {
    if (routeMode) {
      onRequestWorkflow?.();
      return;
    }

    enterWorkflow();
  }

  function handleHomeEntryClick(card) {
    if (!card.enter) {
      return;
    }

    if (card.entryType === 'canvas') {
      enterCanvasWorkflow();
      return;
    }

    enterWorkflow();
  }

  // 返回首页入口视图。
  function backToHome() {
    if (routeMode) {
      onRequestHome?.();
      return;
    }
    setViewMode('home');
  }

  if (effectiveViewMode === 'home') {
    return (
      <div className={`${styles.page} ${styles.homePage}`}>
        <section className={styles.homeMasthead}>
          <div className={styles.homeMastheadMain}>
            <p className={styles.homeKicker}>AI短剧 Studio</p>
            <h2 className={styles.homeHeadline}>重新定义短剧生产：脚本、设定、分镜、视频一次完成</h2>
            <p className={styles.homeSubline}>
              以项目为中心组织创作流程，自动衔接角色场景素材与分镜出片，减少重复操作和沟通成本。
            </p>
            <div className={styles.homeActionRow}>
              <button type="button" className={styles.homePrimaryAction} onClick={enterWorkflow}>
                AI短剧创作
              </button>
            </div>
          </div>
          <div className={styles.homeMastheadVisual}>
            <img src={homeAiShortDramaWorkflow} alt="AI短剧一键生成工作流展示" />
          </div>
        </section>

        <section className={styles.homeSection}>
          <h3 className={styles.homeSectionTitle}>创作入口</h3>
          <div className={styles.homeEntryGrid}>
            {VIDEO_CREATION_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`${styles.homeEntryCard} ${card.enter ? styles.entryCard : styles.videoCardDisabled}`}
                onClick={() => handleHomeEntryClick(card)}
                disabled={!card.enter}
              >
                <img className={styles.homeEntryMedia} src={card.cover} alt={card.title} />
                <div className={styles.homeEntryOverlay} />
                <div className={styles.homeEntryBody}>
                  <div className={styles.cardTitleRow}>
                    <strong>{card.title}</strong>
                    {card.badge && <span className={styles.cardBadge}>{card.badge}</span>}
                  </div>
                  <p>{card.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {feedbackLayer}
      </div>
    );
  }




  return (
    <div
      className={`${styles.page} ${styles.workflowPage}`}
      onMouseOver={handlePointsTipMouseOver}
      onMouseOut={handlePointsTipMouseOut}
      onFocus={handlePointsTipFocus}
      onBlur={handlePointsTipBlur}
    >
      <div className={styles.workflowHeader}>
        <button className={styles.backHomeButton} type="button" onClick={backToHome}>
          返回创作首页
        </button>
        <div className={styles.flowBar}>
          {FLOW_STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`${styles.flowStep} ${visibleStep === step.id ? styles.activeStep : ''} ${step.id < visibleStep ? styles.reachedStep : ''}`}
              onClick={() => goToStep(step.id)}
              disabled={step.id > maxReachableStep}
            >
              <span className={styles.stepNumber}>{step.id}</span>
              <span>{step.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.projectTools}>
          <button className={styles.subtleButton} type="button" onClick={handleCreateProject}>
            新建空白项目
          </button>
          <span className={styles.workflowPointsBadge}>
            <small>可用积分</small>
            <strong>{availablePoints || '--'}</strong>
          </span>
        </div>
      </div>

      <section className={styles.panel}>
        {visibleStep === 1 && (
          <div className={styles.stepOne}>
            <div className={styles.stepOneBody}>
              <div className={styles.fieldLine}>
                <span className={styles.fieldLabel}>项目名称:</span>
                <input
                  className={styles.titleInput}
                  value={activeProject.name}
                  onChange={(event) => updateProjectField('name', event.target.value)}
                  placeholder="请输入项目名称"
                />
              </div>

              <div className={styles.fieldLine}>
                <span className={styles.fieldLabel}>成片类型:</span>
                <div className={styles.chipGroup}>
                  {DELIVERY_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`${styles.chipButton} ${activeProject.deliveryType === type ? styles.activeChip : ''}`}
                      onClick={() => updateProjectField('deliveryType', type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <span className={styles.fieldLabel}>创作模式:</span>
                <div className={styles.chipGroup}>
                  {CREATION_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`${styles.chipButton} ${activeProject.creationMode === mode ? styles.activeChip : ''}`}
                      onClick={() => updateProjectField('creationMode', mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldLine}>
                <span className={styles.fieldLabel}>画面比例:</span>
                <div className={styles.chipGroup}>
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      className={`${styles.chipButton} ${activeProject.aspectRatio === ratio ? styles.activeChip : ''}`}
                      onClick={() => updateProjectField('aspectRatio', ratio)}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.uploadAndSample}>
                <div className={styles.uploadBox}>
                  <p className={styles.uploadTitle}>上传文件:</p>
                  <label
                    className={`${styles.uploadDrop} ${isScriptUploadDragging ? styles.uploadDropActive : ''}`}
                    onDragEnter={handleScriptUploadDragEnter}
                    onDragOver={handleScriptUploadDragOver}
                    onDragLeave={handleScriptUploadDragLeave}
                    onDrop={handleScriptUploadDrop}
                  >
                    <input type="file" accept=".txt,.docx,.pdf" onChange={handleScriptUpload} />
                    <strong>
                      {isScriptUploadDragging
                        ? '松手即可上传剧本文件'
                        : activeProject.scriptFileName || '点击上传剧本文件（.txt/.docx/.pdf）'}
                    </strong>
                    <span>支持覆盖上传，也可以直接把本地文件拖到这里。</span>
                  </label>
                  <p className={styles.uploadMeta}>
                    当前文本状态：{activeProject.scriptText.trim() ? '已存在剧本文本' : '暂无文本'}
                  </p>
                </div>

                <div className={styles.sampleList}>
                  <p className={styles.uploadTitle}>试一试</p>
                  {SCRIPT_SAMPLES.map((sample, index) => (
                    <button
                      key={sample}
                      type="button"
                      className={styles.sampleItem}
                      onClick={() =>
                        applyScriptDraftToProject({
                          projectName: deriveSampleProjectName(sample, index),
                          scriptText: sample,
                          scriptFileName: `${deriveSampleProjectName(sample, index)}.txt`,
                          scriptUploadFile: null,
                        })
                      }
                    >
                      <span className={styles.sampleItemText}>{sample}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.styleSection}>
                <div className={styles.styleSectionHeader}>
                  <div className={styles.fieldLine}>
                    <span className={styles.fieldLabel}>视觉风格:</span>
                  </div>
                  <div className={styles.styleIntro}>
                    <p className={styles.styleIntroTitle}>选择本项目的统一画面气质</p>
                  </div>
                </div>
                <div className={styles.styleGrid}>
                  {managedProjectStyles.length > 0 ? (
                    managedProjectStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        className={`${styles.styleCard} ${selectedVisualStyleId === style.id ? styles.activeStyle : ''}`}
                        onClick={() => updateProjectField('visualStyleId', style.id)}
                      >
                        <img
                          className={styles.styleThumb}
                          src={style.cover || defaultProjectCover}
                          alt={`${style.name}风格预览`}
                          onError={handleStyleCoverError}
                        />
                        <span className={styles.styleName}>{style.name}</span>
                        <span className={styles.styleHint}>
                          {selectedVisualStyleId === style.id ? '当前已应用' : '点击应用此风格'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className={styles.statusText}>暂无可用视觉风格</p>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.stepActionRow}>
              <button
                className={`${styles.primaryButton} ${styles.pointsTipButton}`}
                type="button"
                data-points-tip={isSettingGenerating ? undefined : settingQuoteButtonText}
                onClick={handleGenerateSetting}
                disabled={isSettingGenerating}
              >
                {isSettingGenerating ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>生成中...</span>
                  </span>
                ) : (
                  '生成设定'
                )}
              </button>
              <span className={styles.statusText}>
                {isSettingGenerating
                  ? '解析分集/角色/场景中'
                  : settingQuote.error || '生成后进入设定编辑'}
              </span>
            </div>
          </div>
        )}

        {visibleStep === 2 && (
          <div className={styles.stepTwo}>
            <div className={styles.settingTabs}>
              {SETTING_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tabButton} ${activeSettingTab === tab.id ? styles.activeTab : ''}`}
                  onClick={() => setActiveSettingTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.stepTwoBody}>
              {activeSettingTab === 'script' && (
                <div className={styles.scriptLayout}>
                  <div className={styles.episodeList}>
                    <h4>分集</h4>
                    {scriptTabEpisodes.map((episode, index) => {
                      const episodeLabel = getEpisodeDisplayLabel(episode, index);
                      const episodeTitle = String(episode.title || '').trim();
                      const buttonText = episodeTitle && episodeTitle !== episodeLabel
                        ? `${episodeLabel} · ${episodeTitle}`
                        : episodeLabel;

                      return (
                        <button
                          key={episode.id}
                          type="button"
                          className={`${styles.episodeItem} ${selectedEpisode?.id === episode.id ? styles.activeEpisode : ''}`}
                          onClick={() => setSelectedEpisodeId(episode.id)}
                        >
                          {buttonText}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.scriptDetail}>
                    <h4>{selectedEpisode ? getEpisodeDisplayLabel(selectedEpisode) : '暂无分集'}</h4>
                    <textarea
                      className={styles.scriptTextarea}
                      value={selectedEpisodeScript}
                      onChange={(event) => {
                        if (!selectedEpisode) {
                          return;
                        }
                        handleEpisodeScriptChange(selectedEpisode.id, event.target.value);
                      }}
                      onBlur={(event) => {
                        if (!selectedEpisode) {
                          return;
                        }
                        handleEpisodeScriptBlur(selectedEpisode.id, event.target.value);
                      }}
                    />
                  </div>
                </div>
              )}

              {activeSettingTab === 'characters' && (
                <div className={styles.stepTwoPane}>
                  <div className={styles.entityTopBar}>
                    <AppSelect
                      className={styles.compactSelect}
                      fullWidth={false}
                      value={resolvedCharacterBindingId ? String(resolvedCharacterBindingId) : ''}
                      onChange={(value) => updateModelConfig('characterModel', value)}
                      disabled={characterFeatureModels.length === 0}
                      options={toFeatureModelOptions(characterFeatureModels)}
                    />
                    <button
                      className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                      type="button"
                      data-points-tip={isCharacterAssetsGenerating ? undefined : getGenerationQuoteText('characterBatch')}
                      onClick={generateCharacterAssets}
                      disabled={isCharacterAssetsGenerating}
                    >
                      {isCharacterAssetsGenerating ? (
                        <span className={styles.loadingButtonContent}>
                          <span className={styles.loadingSpinner} aria-hidden />
                          <span>角色设定生成中...</span>
                        </span>
                      ) : (
                        '批量生成角色'
                      )}
                    </button>
                  </div>
                  <div className={styles.stepTwoGridScroll}>
                    <div className={styles.characterGrid}>
                      <button
                        className={styles.characterAddCard}
                        type="button"
                        onClick={addCharacter}
                        disabled={isAddingCharacter}
                      >
                        <span className={styles.characterAddInner}>
                          <span className={styles.characterAddIcon} aria-hidden>
                            +
                          </span>
                          <span className={styles.characterAddTitle}>
                            {isAddingCharacter ? '新增中...' : '新增角色'}
                          </span>
                          <small className={styles.characterAddSub}>
                            {isAddingCharacter ? '正在同步角色数据' : '从角色库选择或手动创建角色'}
                          </small>
                          <span className={styles.characterAddHint}>
                            {isAddingCharacter ? '请稍候' : '点击添加'}
                          </span>
                        </span>
                      </button>
                      {activeProject.characters.map((character, index) => {
                        const isRemovingCharacter = isActionPending(getRemoveCharacterActionKey(character.id));
                        const isUploadingCharacterAvatar = isActionPending(
                          getUploadCharacterAvatarActionKey(character.id),
                        );
                        const isGeneratingCharacterAvatar =
                          isActionPending(getRegenerateCharacterAvatarActionKey(character.id)) ||
                          isTaskInProgressStatus(character.avatarStatus);
                        const isCharacterAvatarStatusGenerating =
                          isGeneratingCharacterAvatar || isCharacterAssetsGenerating;
                        const isCharacterAvatarGenerated = Boolean(character.avatarUrl);
                        const isCharacterAvatarFailed = character.avatarStatus === 'failed';
                        return (
                          <article
                            key={character.id}
                            className={`${styles.characterCard} ${styles.clickableCharacterCard} ${isCharacterAvatarFailed ? styles.characterCardFailed : ''
                              }`}
                            onClick={() => openCharacterConfigModal(character.id)}
                          >
                            <button
                              type="button"
                              className={styles.characterDeleteButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeCharacter(character.id);
                              }}
                              disabled={isRemovingCharacter}
                              aria-label={`删除角色${character.name || index + 1}`}
                            >
                              {isRemovingCharacter ? '...' : '×'}
                            </button>
                            <div className={styles.characterAvatar}>
                              {isCharacterAvatarGenerated ? (
                                <img
                                  className={styles.characterAvatarImage}
                                  src={character.avatarUrl}
                                  alt={`${character.name || `角色${index + 1}`}头像`}
                                />
                              ) : (
                                <div className={styles.sceneEmptyState}>
                                  <button
                                    type="button"
                                    className={styles.sceneEmptyUploadButton}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      triggerCharacterAvatarUploadForCharacter(character.id);
                                    }}
                                    disabled={isUploadingCharacterAvatar || isGeneratingCharacterAvatar}
                                  >
                                    <span className={styles.sceneEmptyUploadIcon} aria-hidden>
                                      +
                                    </span>
                                    <span>{isUploadingCharacterAvatar ? '上传中...' : '上传角色'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.sceneEmptyGenerateButton} ${styles.pointsTipButton}`}
                                    data-points-tip={isGeneratingCharacterAvatar ? undefined : getGenerationQuoteText('characterSingle')}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void regenerateCharacterAvatar(character.id);
                                    }}
                                    disabled={isUploadingCharacterAvatar || isGeneratingCharacterAvatar}
                                  >
                                    {isGeneratingCharacterAvatar ? '生成中...' : '生成角色'}
                                  </button>
                                </div>
                              )}
                            </div>
                            <small className={styles.characterStatus}>
                              {isCharacterAvatarFailed
                                ? ''
                                : isCharacterAvatarStatusGenerating
                                  ? '角色头像生成中...'
                                  : character.avatarUrl
                                    ? '角色头像已生成'
                                    : '未生成角色头像'}
                            </small>
                            <div className={styles.characterFieldList}>
                              <div className={styles.characterField}>
                                <span className={styles.characterFieldLabel}>角色名</span>
                                <p
                                  className={styles.characterNameText}
                                  title={character.name || `角色${index + 1}`}
                                >
                                  {character.name || `角色${index + 1}`}
                                </p>
                              </div>
                              <div className={`${styles.characterField} ${styles.characterDescField}`}>
                                <span className={styles.characterFieldLabel}>描述</span>
                                <p
                                  className={styles.characterDescText}
                                  title={character.bio || '请补充角色设定'}
                                >
                                  {character.bio || '请补充角色设定'}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {activeSettingTab === 'scenes' && (
                <div className={styles.stepTwoPane}>
                  <div className={styles.entityTopBar}>
                    <AppSelect
                      className={styles.compactSelect}
                      fullWidth={false}
                      value={resolvedSceneBindingId ? String(resolvedSceneBindingId) : ''}
                      onChange={(value) => updateModelConfig('sceneModel', value)}
                      disabled={sceneFeatureModels.length === 0}
                      options={toFeatureModelOptions(sceneFeatureModels)}
                    />
                    <button
                      className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                      type="button"
                      data-points-tip={isSceneAssetsGenerating ? undefined : getGenerationQuoteText('sceneBatch')}
                      onClick={generateSceneAssets}
                      disabled={isSceneAssetsGenerating}
                    >
                      {isSceneAssetsGenerating ? (
                        <span className={styles.loadingButtonContent}>
                          <span className={styles.loadingSpinner} aria-hidden />
                          <span>场景设定生成中...</span>
                        </span>
                      ) : (
                        '批量生成场景'
                      )}
                    </button>
                  </div>
                  <div className={styles.stepTwoGridScroll}>
                    <div className={styles.characterGrid}>
                      <button className={styles.characterAddCard} type="button" onClick={addScene} disabled={isAddingScene}>
                        <span className={styles.characterAddInner}>
                          <span className={styles.characterAddIcon} aria-hidden>
                            +
                          </span>
                          <span className={styles.characterAddTitle}>
                            {isAddingScene ? '新增中...' : '新增场景'}
                          </span>
                          <small className={styles.characterAddSub}>
                            {isAddingScene ? '正在同步场景数据' : '从场景库选择或手动创建场景'}
                          </small>
                          <span className={styles.characterAddHint}>
                            {isAddingScene ? '请稍候' : '点击添加'}
                          </span>
                        </span>
                      </button>
                      {activeProject.scenes.map((scene, index) => {
                        const isRemovingScene = isActionPending(getRemoveSceneActionKey(scene.id));
                        const isUploadingSceneImage = isActionPending(getUploadSceneImageActionKey(scene.id));
                        const isGeneratingSceneImage =
                          isActionPending(getRegenerateSceneImageActionKey(scene.id)) ||
                          isTaskInProgressStatus(scene.imageStatus);
                        const isSceneImageStatusGenerating =
                          isGeneratingSceneImage || isSceneAssetsGenerating;
                        const isSceneImageReady = Boolean(scene.imageUrl);
                        const isSceneImageFailed = scene.imageStatus === 'failed';
                        return (
                          <article
                            key={scene.id}
                            className={`${styles.characterCard} ${styles.clickableSceneCard} ${isSceneImageFailed ? styles.characterCardFailed : ''
                              }`}
                            onClick={() => openSceneConfigModal(scene.id)}
                          >
                            <button
                              type="button"
                              className={styles.characterDeleteButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeScene(scene.id);
                              }}
                              disabled={isRemovingScene}
                              aria-label={`删除场景${scene.name || index + 1}`}
                            >
                              {isRemovingScene ? '...' : '×'}
                            </button>
                            <div className={styles.characterAvatar}>
                              {isSceneImageReady ? (
                                <img
                                  className={styles.characterAvatarImage}
                                  src={scene.imageUrl}
                                  alt={`${scene.name || `场景${index + 1}`}预览`}
                                />
                              ) : (
                                <div className={styles.sceneEmptyState}>
                                  <button
                                    type="button"
                                    className={styles.sceneEmptyUploadButton}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      triggerSceneImageUploadForScene(scene.id);
                                    }}
                                    disabled={isUploadingSceneImage || isGeneratingSceneImage}
                                  >
                                    <span className={styles.sceneEmptyUploadIcon} aria-hidden>
                                      +
                                    </span>
                                    <span>{isUploadingSceneImage ? '上传中...' : '上传场景'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.sceneEmptyGenerateButton} ${styles.pointsTipButton}`}
                                    data-points-tip={isGeneratingSceneImage ? undefined : getGenerationQuoteText('sceneSingle')}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void regenerateSceneImage(scene.id);
                                    }}
                                    disabled={isUploadingSceneImage || isGeneratingSceneImage}
                                  >
                                    {isGeneratingSceneImage ? '生成中...' : '生成场景'}
                                  </button>
                                </div>
                              )}
                            </div>
                            <small className={styles.characterStatus}>
                              {isSceneImageFailed
                                ? ''
                                : isSceneImageStatusGenerating
                                  ? '场景图生成中...'
                                  : scene.imageUrl
                                    ? '场景图已生成'
                                    : '未生成场景图'}
                            </small>
                            <div className={styles.characterFieldList}>
                              <div className={styles.characterField}>
                                <span className={styles.characterFieldLabel}>场景名</span>
                                <p className={styles.characterNameText} title={scene.name || `场景${index + 1}`}>
                                  {scene.name || `场景${index + 1}`}
                                </p>
                              </div>
                              <div className={`${styles.characterField} ${styles.characterDescField}`}>
                                <span className={styles.characterFieldLabel}>描述</span>
                                <p className={styles.characterDescText} title={scene.description || '请补充场景描述'}>
                                  {scene.description || '请补充场景描述'}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.stepFooter}>
              <button
                className={`${styles.primaryButton} ${styles.pointsTipButton}`}
                type="button"
                data-points-tip={isStoryboardGenerating ? undefined : getGenerationQuoteText('storyboard')}
                onClick={handleGenerateStoryboard}
                disabled={isStoryboardGenerating}
              >
                {isStoryboardGenerating ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>分镜生成中...</span>
                  </span>
                ) : (
                  '生成分镜'
                )}
              </button>
            </div>
          </div>
        )}

        {visibleStep === 3 && (
          <div className={styles.stepThree}>
            <div className={styles.topActionRow}>
              <AppSelect
                wrapperClassName={styles.storyboardModelSelectWrap}
                className={`${styles.compactSelect} ${styles.storyboardModelSelect}`}
                popupClassName={styles.storyboardModelSelectPopup}
                fullWidth={false}
                value={resolvedBatchStoryboardCoverBindingId ? String(resolvedBatchStoryboardCoverBindingId) : ''}
                onChange={setBatchStoryboardCoverBindingId}
                disabled={isBatchGeneratingImages || storyboardCoverFeatureModels.length === 0}
                options={toFeatureModelOptions(storyboardCoverFeatureModels)}
              />
              <button
                className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                type="button"
                data-points-tip={
                  isBatchGeneratingImages || isStoryboardCoverBatchRunning || hasStoryboardCoverBatchTask
                    ? undefined
                    : getGenerationQuoteText('storyboardCoverBatch')
                }
                onClick={batchGenerateImages}
                disabled={isBatchGeneratingImages || hasStoryboardCoverBatchTask}
                title={activeProject?.storyboardCoverBatchErrorMessage || undefined}
              >
                {isBatchGeneratingImages || isStoryboardCoverBatchRunning ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>{storyboardCoverBatchButtonText}</span>
                  </span>
                ) : (
                  storyboardCoverBatchButtonText
                )}
              </button>
              <AppSelect
                wrapperClassName={styles.storyboardModelSelectWrap}
                className={`${styles.compactSelect} ${styles.storyboardModelSelect}`}
                popupClassName={styles.storyboardModelSelectPopup}
                fullWidth={false}
                value={resolvedBatchStoryboardVideoBindingId ? String(resolvedBatchStoryboardVideoBindingId) : ''}
                onChange={setBatchStoryboardVideoBindingId}
                disabled={
                  isBatchGeneratingVideos ||
                  isBatchGeneratingImages ||
                  missingFirstImageCountForBatchVideo > 0 ||
                  storyboardVideoFeatureModels.length === 0
                }
                options={toFeatureModelOptions(storyboardVideoFeatureModels)}
              />
              <button
                className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                type="button"
                data-points-tip={isBatchGeneratingVideos ? undefined : getGenerationQuoteText('storyboardVideoBatch')}
                onClick={batchGenerateVideos}
                disabled={
                  isBatchGeneratingVideos ||
                  isBatchGeneratingImages ||
                  missingFirstImageCountForBatchVideo > 0
                }
              >
                {isBatchGeneratingVideos ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>视频批量生成中...</span>
                  </span>
                ) : (
                  '批量视频'
                )}
              </button>
              <button
                className={styles.subtleButton}
                type="button"
                onClick={openExportVideoModal}
                disabled={
                  isBatchGeneratingVideos ||
                  isBatchGeneratingImages ||
                  exportableStoryboardVideos.length === 0 ||
                  isEpisodeComposeRunning
                }
              >
                {isEpisodeComposeRunning ? (
                  <span className={styles.loadingButtonContent}>
                    <span className={styles.loadingSpinner} aria-hidden />
                    <span>导出中...</span>
                  </span>
                ) : (
                  '导出'
                )}
              </button>
              <button
                className={styles.subtleButton}
                type="button"
                onClick={downloadComposedEpisodes}
                disabled={!isEpisodeComposeDownloadEnabled}
              >
                下载
              </button>
            </div>

            <div className={styles.storyboardLayout}>
              <aside className={styles.episodeRail}>
                {activeProject.episodes.map((episode, index) => (
                  <button
                    key={episode.id}
                    type="button"
                    className={`${styles.railItem} ${selectedEpisode?.id === episode.id ? styles.activeEpisode : ''}`}
                    onClick={() => {
                      setSelectedEpisodeId(episode.id);
                    }}
                  >
                    <span className={styles.railItemTitle}>{`第${index + 1}集`}</span>
                    <span className={styles.railItemSummary} title={episode.title || '暂无分集标题'}>
                      {episode.title || '暂无分集标题'}
                    </span>
                  </button>
                ))}
              </aside>

              <section className={styles.storyboardColumn}>
                {!selectedEpisode && <p className={styles.statusText}>暂无可编辑分镜</p>}
                {selectedEpisode?.storyboards.map((storyboard, index) => {
                  const selectedSceneForShot =
                    activeProject.scenes.find((scene) => scene.id === storyboard.sceneId) || null;
                  const resolvedSceneId = selectedSceneForShot?.id || '';
                  const presentCharacters = getStoryboardPresentCharacters(storyboard);
                  const storyboardCharacters = presentCharacters
                    .map((presentCharacter) => {
                      const characterId = presentCharacter.characterId;
                      const matchedCharacter = activeProject.characters.find(
                        (character) => character.id === characterId,
                      );

                      if (!matchedCharacter) {
                        return null;
                      }

                      return {
                        key: presentCharacter.presentId || characterId,
                        presentId: presentCharacter.presentId,
                        characterId,
                        name: matchedCharacter.name || '角色',
                        avatarUrl: matchedCharacter.avatarUrl || '',
                      };
                    })
                    .filter(Boolean);
                  const isRemovingStoryboard = isActionPending(getRemoveStoryboardActionKey(storyboard.id));
                  const isCoverTaskRunning = isTaskInProgressStatus(storyboard.coverStatus);
                  const isVideoTaskRunning = isTaskInProgressStatus(storyboard.videoStatus);
                  const isCoverTaskFailed = isTaskFailedStatus(storyboard.coverStatus);
                  const isVideoTaskFailed = isTaskFailedStatus(storyboard.videoStatus);
                  const isGeneratingImage =
                    isActionPending(getGenerateFirstImageActionKey(storyboard.id)) || isCoverTaskRunning;
                  const isUploadingImage = isActionPending(getUploadFirstImageActionKey(storyboard.id));
                  const isGeneratingVideo =
                    isActionPending(getGenerateVideoActionKey(storyboard.id)) || isVideoTaskRunning;
                  const hasStoryboardFirstImage = Boolean(storyboard.firstImage);
                  const isCoverPreviewLoading = isGeneratingImage || isBatchGeneratingImages;
                  const isVideoPreviewLoading = isGeneratingVideo || isBatchGeneratingVideos;
                  const isVideoBlockedByCover =
                    !hasStoryboardFirstImage ||
                    isGeneratingImage ||
                    isUploadingImage ||
                    isBatchGeneratingImages;
                  const isImageActionBusy = isGeneratingImage || isUploadingImage || isBatchGeneratingImages;
                  const isVideoActionBusy =
                    isGeneratingVideo || isBatchGeneratingVideos || isVideoBlockedByCover;

                  const isStoryboardExpanded = !collapsedStoryboardIds.has(storyboard.id);
                  const isStoryboardDragActive = draggingStoryboardId === storyboard.id;
                  const isStoryboardDropTarget =
                    Boolean(draggingStoryboardId) &&
                    storyboardDropTargetId === storyboard.id &&
                    draggingStoryboardId !== storyboard.id;

                  return (
                    <article
                      key={storyboard.id}
                      data-storyboard-card="true"
                      data-episode-id={selectedEpisode.id}
                      data-storyboard-id={storyboard.id}
                      className={`${styles.shotCard} ${!isStoryboardExpanded ? styles.shotCardCollapsed : ''} ${isStoryboardDragActive ? styles.shotCardDragging : ''
                        } ${isStoryboardDropTarget ? styles.shotCardDropTarget : ''}`}
                    >
                      <div className={styles.shotHeader}>
                        <div
                          className={`${styles.shotTitleInput} ${styles.shotTitleDisplay} ${isStoryboardDragActive ? styles.shotTitleDragging : ''
                            }`}
                          title={storyboard.title}
                          onMouseDown={(event) => handleStoryboardTitleMouseDown(selectedEpisode.id, storyboard.id, event)}
                        >
                          {storyboard.title}
                        </div>
                        <div className={styles.shotActions}>
                          <button
                            type="button"
                            onClick={() => toggleStoryboardCollapse(storyboard.id)}
                            disabled={isRemovingStoryboard}
                          >
                            {isStoryboardExpanded ? '折叠' : '展开'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStoryboard(selectedEpisode.id, storyboard.id)}
                            disabled={isRemovingStoryboard}
                          >
                            {isRemovingStoryboard ? '删除中...' : '删除'}
                          </button>
                        </div>
                      </div>

                      {isStoryboardExpanded && (
                        <>
                          <div className={styles.shotBody}>
                            <div className={styles.shotGrid}>
                              <div className={`${styles.shotPanel} ${styles.shotPanelSidebar}`}>
                                <h4>分镜描述</h4>
                                <textarea
                                  className={styles.descriptionInput}
                                  value={storyboard.description}
                                  onChange={(event) =>
                                    updateStoryboard(selectedEpisode.id, storyboard.id, (current) => ({
                                      ...current,
                                      description: event.target.value,
                                    }))
                                  }
                                  onBlur={(event) =>
                                    handleStoryboardDescriptionBlur(
                                      selectedEpisode.id,
                                      storyboard.id,
                                      event.target.value,
                                    )
                                  }
                                />

                                <h4>场景</h4>
                                <AppSelect
                                  className={styles.sceneSelect}
                                  value={resolvedSceneId}
                                  onChange={(value) =>
                                    handleStoryboardSceneChange(selectedEpisode.id, storyboard.id, value)
                                  }
                                  options={activeProject.scenes.map((scene) => ({
                                    value: scene.id,
                                    label: scene.name,
                                  }))}
                                />
                                {selectedSceneForShot?.imageUrl ? (
                                  <button
                                    className={`${styles.scenePreviewCard} ${styles.previewSurfaceButton}`}
                                    type="button"
                                    onClick={() =>
                                      openImagePreview({
                                        title: `${selectedSceneForShot.name || '场景'}预览`,
                                        url: selectedSceneForShot.imageUrl,
                                        alt: `${selectedSceneForShot.name || '场景'}场景图`,
                                      })
                                    }
                                    aria-label={`预览${selectedSceneForShot.name || '当前场景'}场景图`}
                                    aria-haspopup="dialog"
                                  >
                                    <img
                                      className={`${styles.scenePreviewImage} ${styles.previewInteractiveImage}`}
                                      src={selectedSceneForShot.imageUrl}
                                      alt={`${selectedSceneForShot.name || '场景'}场景图`}
                                    />
                                    <span className={styles.previewHoverMask} aria-hidden="true">
                                      <span className={styles.previewHoverLabel}>预览</span>
                                    </span>
                                  </button>
                                ) : (
                                  <div className={styles.scenePreviewCard}>
                                    <div className={styles.scenePreviewEmpty}>当前场景未生成图片</div>
                                  </div>
                                )}

                                <div className={styles.storyboardSectionBlock}>
                                  <div className={styles.storyboardSectionHeader}>
                                    <h4>出场人物</h4>
                                  </div>
                                  <div className={styles.storyboardCharacterPicker}>
                                    <div className={styles.storyboardCharacterRow}>
                                      {storyboardCharacters.length > 0 ? (
                                        storyboardCharacters.map((character) => (
                                          <span
                                            key={character.key}
                                            className={styles.storyboardCharacterPill}
                                            title={character.name}
                                          >
                                            {character.avatarUrl ? (
                                              <img
                                                className={styles.storyboardCharacterAvatar}
                                                src={character.avatarUrl}
                                                alt={`${character.name}头像`}
                                              />
                                            ) : (
                                              <span className={styles.storyboardCharacterFallback}>
                                                {character.name.slice(0, 1)}
                                              </span>
                                            )}
                                            <span className={styles.storyboardCharacterName}>{character.name}</span>
                                          </span>
                                        ))
                                      ) : (
                                        <span className={styles.storyboardCharacterEmpty}>当前分镜暂无出场人物</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                              </div>
                              <div className={styles.shotPanel}>
                                <div className={styles.shotPanelHeader}>
                                  <h4>参考图</h4>
                                  <div className={styles.panelActions}>
                                    <button
                                      className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                                      type="button"
                                      data-points-tip={
                                        isGeneratingImage || isUploadingImage || isBatchGeneratingImages
                                          ? undefined
                                          : getStoryboardCoverQuoteText(storyboard)
                                      }
                                      onMouseEnter={() => refreshStoryboardCoverQuote(storyboard)}
                                      onFocus={() => refreshStoryboardCoverQuote(storyboard)}
                                      onClick={() => handleRegenerateFirstImage(selectedEpisode.id, storyboard.id)}
                                      disabled={isImageActionBusy}
                                    >
                                      {isGeneratingImage ? (
                                        '生成中...'
                                      ) : isUploadingImage ? (
                                        '上传中...'
                                      ) : isBatchGeneratingImages ? (
                                        '批量生成中...'
                                      ) : (
                                        '生成'
                                      )}
                                    </button>
                                    <label
                                      className={`${styles.subtleButton} ${isImageActionBusy ? styles.disabledActionLabel : ''}`}
                                    >
                                      {isUploadingImage ? (
                                        <span className={styles.loadingButtonContent}>
                                          <span className={styles.loadingSpinner} aria-hidden />
                                          <span>上传中...</span>
                                        </span>
                                      ) : (
                                        '上传'
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        disabled={isImageActionBusy}
                                        onChange={(event) => uploadFirstImage(event, selectedEpisode.id, storyboard.id)}
                                      />
                                    </label>
                                  </div>
                                </div>
                                <div className={styles.mediaPreview} aria-busy={isCoverPreviewLoading}>
                                  {isCoverTaskFailed ? (
                                    <div className={`${styles.previewPlaceholder} ${styles.previewFailed}`} role="alert">
                                      <strong>生成失败</strong>
                                      {storyboard.coverErrorMessage ? <small>{storyboard.coverErrorMessage}</small> : null}
                                    </div>
                                  ) : storyboard.firstImage?.preview ? (
                                    <button
                                      className={`${styles.previewSurfaceButton} ${styles.mediaPreviewButton}`}
                                      type="button"
                                      onClick={() =>
                                        openImagePreview({
                                          title: `${storyboard.title || '分镜参考图'}预览`,
                                          url: storyboard.firstImage.preview,
                                          alt: `${storyboard.title || '分镜'}参考图`,
                                        })
                                      }
                                      aria-label={`预览${storyboard.title || '当前分镜'}参考图`}
                                      aria-haspopup="dialog"
                                      disabled={isCoverPreviewLoading}
                                    >
                                      <img
                                        className={`${styles.previewImage} ${styles.previewInteractiveImage}`}
                                        src={storyboard.firstImage.preview}
                                        alt={`${storyboard.title || '分镜'}参考图`}
                                      />
                                      <span className={styles.previewHoverMask} aria-hidden="true">
                                        <span className={styles.previewHoverLabel}>预览</span>
                                      </span>
                                    </button>
                                  ) : (
                                    <div className={styles.previewPlaceholder}>待生成参考图</div>
                                  )}
                                  {isCoverPreviewLoading && (
                                    <div
                                      className={styles.coverPreviewLoading}
                                      role="status"
                                      aria-live="polite"
                                      aria-label="参考图生成中"
                                    >
                                      <div className={styles.coverPreviewLoadingContent}>
                                        <div
                                          className={`${styles.settingGeneratingLoader} ${styles.coverPreviewLoader}`}
                                          aria-hidden
                                        >
                                          <span className={styles.settingGeneratingHalo} />
                                          <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingOuter}`} />
                                          <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingInner}`} />
                                          <span className={styles.settingGeneratingSweep} />
                                          <span className={styles.settingGeneratingCore} />
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitSlow}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleMain}`} />
                                          </span>
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitFast}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleAccent}`} />
                                          </span>
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitTiny}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleTiny}`} />
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <AppSelect
                                  wrapperClassName={styles.storyboardModelSelectWrap}
                                  className={`${styles.compactSelect} ${styles.storyboardModelSelect}`}
                                  popupClassName={styles.storyboardModelSelectPopup}
                                  fullWidth={false}
                                  value={resolvedStoryboardCoverBindingId ? String(resolvedStoryboardCoverBindingId) : ''}
                                  onChange={(value) => updateModelConfig('storyboardCoverModel', value)}
                                  disabled={storyboardCoverFeatureModels.length === 0}
                                  options={toFeatureModelOptions(storyboardCoverFeatureModels)}
                                />
                                <textarea
                                  className={styles.promptInput}
                                  rows={9}
                                  value={storyboard.imagePrompt}
                                  onChange={(event) =>
                                    updateStoryboard(selectedEpisode.id, storyboard.id, (current) => ({
                                      ...current,
                                      imagePrompt: event.target.value,
                                    }))
                                  }
                                  onBlur={(event) =>
                                    handleStoryboardImagePromptBlur(
                                      selectedEpisode.id,
                                      storyboard.id,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="参考图提示词"
                                />
                                <small className={styles.metadata}>
                                  {storyboard.firstImage ? `更新时间：${storyboard.firstImage.at}` : '参考图尚未生成'}
                                </small>
                              </div>

                              <div className={styles.shotPanel}>
                                <div className={styles.shotPanelHeader}>
                                  <h4>视频</h4>
                                  <div className={styles.panelActions}>
                                    <button
                                      className={`${styles.subtleButton} ${styles.pointsTipButton}`}
                                      type="button"
                                      data-points-tip={
                                        isGeneratingVideo || isBatchGeneratingVideos || !hasStoryboardFirstImage
                                          ? undefined
                                          : getStoryboardVideoQuoteText(storyboard)
                                      }
                                      onMouseEnter={() => refreshStoryboardVideoQuote(storyboard)}
                                      onFocus={() => refreshStoryboardVideoQuote(storyboard)}
                                      onClick={() => handleGenerateVideoAction(selectedEpisode.id, storyboard.id)}
                                      disabled={isVideoActionBusy}
                                    >
                                      {isGeneratingVideo || isBatchGeneratingVideos ? (
                                        '处理中...'
                                      ) : !hasStoryboardFirstImage ? (
                                        '先生成参考图'
                                      ) : (
                                        '生成'
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div
                                  className={`${styles.mediaPreview} ${storyboard.video?.url && isVideoTaskFailed ? styles.videoPreviewFailedWithAsset : ''}`}
                                  aria-busy={isVideoPreviewLoading}
                                >
                                  {storyboard.video?.url ? (
                                    <video
                                      className={styles.previewVideo}
                                      src={storyboard.video.url}
                                      controls
                                      preload="metadata"
                                    />
                                  ) : isVideoTaskFailed ? (
                                    <div className={`${styles.previewPlaceholder} ${styles.previewFailed}`} role="alert">
                                      <strong>生成失败</strong>
                                      {storyboard.videoErrorMessage ? <small>{storyboard.videoErrorMessage}</small> : null}
                                    </div>
                                  ) : storyboard.video ? (
                                    <div className={styles.previewPlaceholder}>
                                      <strong>{storyboard.video.name}</strong>
                                      <small>{storyboard.video.mode}</small>
                                    </div>
                                  ) : (
                                    <div className={styles.previewPlaceholder}>待生成视频</div>
                                  )}
                                  {isVideoPreviewLoading && (
                                    <div
                                      className={styles.coverPreviewLoading}
                                      role="status"
                                      aria-live="polite"
                                      aria-label="视频生成中"
                                    >
                                      <div className={styles.coverPreviewLoadingContent}>
                                        <div
                                          className={`${styles.settingGeneratingLoader} ${styles.coverPreviewLoader}`}
                                          aria-hidden
                                        >
                                          <span className={styles.settingGeneratingHalo} />
                                          <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingOuter}`} />
                                          <span className={`${styles.settingGeneratingRing} ${styles.settingGeneratingRingInner}`} />
                                          <span className={styles.settingGeneratingSweep} />
                                          <span className={styles.settingGeneratingCore} />
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitSlow}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleMain}`} />
                                          </span>
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitFast}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleAccent}`} />
                                          </span>
                                          <span className={`${styles.settingGeneratingOrbit} ${styles.settingGeneratingOrbitTiny}`}>
                                            <span className={`${styles.settingGeneratingParticle} ${styles.settingGeneratingParticleTiny}`} />
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className={styles.storyboardVideoControlRow}>
                                  <AppSelect
                                    wrapperClassName={styles.storyboardModelSelectWrap}
                                    className={`${styles.compactSelect} ${styles.storyboardModelSelect}`}
                                    popupClassName={styles.storyboardModelSelectPopup}
                                    fullWidth={false}
                                    value={resolvedStoryboardVideoBindingId ? String(resolvedStoryboardVideoBindingId) : ''}
                                    onChange={(value) => updateModelConfig('storyboardVideoModel', value)}
                                    disabled={storyboardVideoFeatureModels.length === 0}
                                    options={toFeatureModelOptions(storyboardVideoFeatureModels)}
                                  />
                                  <Space.Compact className={styles.storyboardDurationCompact}>
                                    <InputNumber
                                      className={styles.storyboardDurationInput}
                                      min={STORYBOARD_VIDEO_DURATION_MIN}
                                      max={STORYBOARD_VIDEO_DURATION_MAX}
                                      step={1}
                                      precision={0}
                                      value={storyboard.videoDuration ?? STORYBOARD_VIDEO_DURATION_DEFAULT}
                                      onChange={(value) => {
                                        if (typeof value !== 'number') {
                                          return;
                                        }
                                        updateStoryboard(selectedEpisode.id, storyboard.id, (current) => ({
                                          ...current,
                                          videoDuration: value,
                                        }));
                                        refreshStoryboardVideoQuoteForDuration(storyboard.id, value);
                                      }}
                                      onBlur={() =>
                                        handleStoryboardVideoDurationBlur(
                                          selectedEpisode.id,
                                          storyboard.id,
                                          storyboard.videoDuration,
                                        )
                                      }
                                      disabled={isGeneratingVideo}
                                    />
                                    <span className={styles.storyboardDurationSuffix}>秒</span>
                                  </Space.Compact>
                                </div>
                                <textarea
                                  className={styles.promptInput}
                                  rows={9}
                                  value={storyboard.videoPrompt}
                                  onChange={(event) =>
                                    updateStoryboard(selectedEpisode.id, storyboard.id, (current) => ({
                                      ...current,
                                      videoPrompt: event.target.value,
                                    }))
                                  }
                                  onBlur={(event) =>
                                    handleStoryboardVideoPromptBlur(
                                      selectedEpisode.id,
                                      storyboard.id,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="视频提示词"
                                />
                                <small className={styles.metadata}>
                                  {storyboard.video ? `更新时间：${storyboard.video.at}` : '视频尚未生成'}
                                </small>
                              </div>
                            </div>
                          </div>

                          <span className={styles.statusText}>分镜序号：{index + 1}</span>
                        </>
                      )}
                    </article>
                  );
                })}
              </section>
            </div>
          </div>
        )}
      </section>
      {storyboardDragLayerStyle && draggingStoryboard
        ? createPortal(
          <article
            className={`${styles.shotCard} ${styles.shotCardCollapsed} ${styles.storyboardDragLayer}`}
            style={storyboardDragLayerStyle}
            aria-hidden="true"
          >
            <div className={styles.shotHeader}>
              <div className={`${styles.shotTitleInput} ${styles.shotTitleDisplay} ${styles.shotTitleDragging}`}>
                {draggingStoryboard.title}
              </div>
              <div className={styles.shotActions}>
                <button type="button" tabIndex={-1}>
                  折叠
                </button>
                <button type="button" tabIndex={-1}>
                  删除
                </button>
              </div>
            </div>
          </article>,
          document.body,
        )
        : null}
      <Modal
        open={imagePreview.open}
        title={imagePreview.title || '图片预览'}
        footer={null}
        centered
        onCancel={closeImagePreview}
        width={960}
      >
        <div className={styles.imagePreviewModalBody}>
          {imagePreview.url ? (
            <img
              className={styles.imagePreviewModalImage}
              src={imagePreview.url}
              alt={imagePreview.alt || imagePreview.title || '图片预览'}
            />
          ) : null}
        </div>
      </Modal>
      <Modal
        open={exportVideoModal.open}
        title="导出视频"
        centered
        onCancel={closeExportVideoModal}
        footer={null}
        closable={!exportVideoModal.isExporting}
        mask={{ closable: !exportVideoModal.isExporting }}
      >
        <div className={styles.exportVideoModalPanel}>
          <div className={styles.exportVideoModalBody}>
            {exportableStoryboardVideosByEpisode.map((item) => {
              const isChecked = exportVideoModal.selectedEpisodeIds.includes(item.episodeId);
              const isDisabled = !item.isExportReady;
              const description = item.title ? `${item.episodeLabel} · ${item.title}` : item.episodeLabel;
              const metaText =
                item.storyboardCount === 0
                  ? '暂无分镜'
                  : item.isExportReady
                    ? `${item.generatedVideoCount}/${item.storyboardCount} 个视频`
                    : `还差 ${item.missingVideoCount} 个视频`;

              return (
                <label
                  key={item.episodeId || item.episodeLabel}
                  className={`${styles.exportVideoEpisodeOption} ${isDisabled ? styles.exportVideoEpisodeOptionDisabled : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled || exportVideoModal.isExporting}
                    onChange={() => toggleExportEpisodeSelection(item.episodeId)}
                  />
                  <span className={styles.exportVideoEpisodeText}>{description}</span>
                  <span className={styles.exportVideoEpisodeMeta}>
                    {metaText}
                  </span>
                </label>
              );
            })}
          </div>
          <div className={styles.exportVideoModalFooter}>
            <button
              type="button"
              className={styles.exportVideoModalCancelButton}
              onClick={closeExportVideoModal}
              disabled={exportVideoModal.isExporting}
            >
              取消
            </button>
            <button
              type="button"
              className={styles.exportVideoModalConfirmButton}
              onClick={exportStoryboardVideos}
              disabled={exportVideoModal.selectedEpisodeIds.length === 0 || exportVideoModal.isExporting}
            >
              导出
            </button>
          </div>
          {exportVideoModal.isExporting ? (
            <div className={styles.exportVideoModalLoadingMask} role="status" aria-live="polite">
              <div className={styles.exportVideoModalLoadingCard}>
                <span className={styles.loadingSpinner} aria-hidden />
                <span>{exportVideoModal.statusText || '正在导出...'}</span>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
      {feedbackLayer}
    </div>
  );
}

export default CreationPage;


