import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import infiniteCanvasHero from '../../assets/home-infinite-canvas-hero.png';
import lightWaterfall from '../../assets/home-light-waterfall-v6.png';
import characterMemoryVisual from '../../assets/home-cards/character-memory.png';
import continuousFlowVisual from '../../assets/home-cards/continuous-flow.png';
import directedMotionVisual from '../../assets/home-cards/directed-motion.png';
import finalDeliveryVisual from '../../assets/home-cards/final-delivery.png';
import infiniteCanvasVisual from '../../assets/home-cards/infinite-canvas.png';
import storyboardControlVisual from '../../assets/home-cards/storyboard-control.png';
import aiyoLogo from '../../assets/login/app-logo.png';
import showcaseArtwork from '../../assets/login/martial-artist-background.png';
import styles from './HomeLandingPage.module.less';

const STORY_CARDS = [
  {
    id: 'canvas',
    eyebrow: '01 / One canvas',
    title: '不再被步骤切断的创作思路',
    description: '把灵感、文本、参考图、角色与镜头放回同一个空间。自由连接、随时调整，让每一次发散都有迹可循。',
    tags: ['自由连接', '无限延展', '实时预览'],
    visualType: 'image',
    image: infiniteCanvasVisual,
    imageAlt: '电影画面、角色设定与故事参考在发光的无限画布中连接',
    visualLabel: 'Infinite canvas / live view',
    frameClass: 'canvasImageFrame',
  },
  {
    id: 'flow',
    eyebrow: '02 / One continuous flow',
    title: '从一个念头，到一条完整叙事链路',
    description: '每个节点既能独立创作，也能承接上下文继续生长。画布不规定你的流程，只负责让想法彼此发生关系。',
    tags: ['灵感承接', '上下文生长', '链路预览'],
    visualType: 'image',
    image: continuousFlowVisual,
    imageAlt: '从草图到电影画面的连续叙事链路沿发光轨迹展开',
    visualLabel: 'Continuous narrative / live flow',
    frameClass: 'flowImageFrame',
  },
  {
    id: 'character',
    eyebrow: '03 / Character memory',
    title: '让角色与世界，在每个镜头里保持一致',
    compactTitle: true,
    description: '沉淀角色外观、服装、场景与视觉风格。无论故事延展到多少镜头，核心设定始终稳定、可复用。',
    tags: ['角色资产', '世界设定', '风格锁定'],
    visualType: 'image',
    image: characterMemoryVisual,
    imageAlt: '同一位幻想角色的造型、表情、服装与场景参考设定',
    visualLabel: 'Character memory / style lock',
    frameClass: 'characterImageFrame',
  },
  {
    id: 'storyboard',
    eyebrow: '04 / Storyboard control',
    title: '把一段文字，拆成真正可控的镜头',
    description: '从景别、构图到镜头顺序，把叙事节奏落实到每一格分镜。既能快速生成，也能逐镜精细调整。',
    tags: ['智能分镜', '镜头调度', '节奏控制'],
    visualType: 'image',
    image: storyboardControlVisual,
    imageAlt: '导演工作台中的连续镜头、景别构图与机位调度',
    visualLabel: 'Storyboard / shot control',
    frameClass: 'workflowImageFrame',
  },
  {
    id: 'motion',
    eyebrow: '05 / Directed motion',
    title: '让静态画面，顺畅地动起来',
    description: '用首尾帧、动作描述和运镜控制生成动态片段，让角色表演、镜头运动与情绪节奏彼此配合。',
    tags: ['首尾帧', '动作控制', '运镜预览'],
    visualType: 'image',
    image: directedMotionVisual,
    imageAlt: '月夜未来古城中带有紫色运动轨迹的角色动态镜头',
    visualLabel: 'Motion direction / keyframe',
    frameClass: 'motionImageFrame',
  },
  {
    id: 'delivery',
    eyebrow: '06 / Final delivery',
    title: '从创作现场，到可以交付的完整成片',
    description: '统一管理生成结果、版本与素材，把分散的创作节点收束为可预览、可复用、可导出的最终作品。',
    tags: ['版本管理', '高清输出', '云端协作'],
    visualType: 'delivery',
    image: finalDeliveryVisual,
  },
];

const FLOW_ENTRY_DURATION = 2.6;
const FLOW_CARD_DURATION = 3.4;
const FLOW_BRIDGE_DURATION = 3.2;
const FLOW_LOOP_PAUSE = 1.8;
const FLOW_TIMELINE_DURATION =
  FLOW_ENTRY_DURATION +
  STORY_CARDS.length * FLOW_CARD_DURATION +
  (STORY_CARDS.length - 1) * FLOW_BRIDGE_DURATION +
  FLOW_LOOP_PAUSE;
const FLOW_ENTRY_TIMING = {
  start: 0,
  end: FLOW_ENTRY_DURATION,
  total: FLOW_TIMELINE_DURATION,
};

function getCardFlowTiming(index) {
  const start = FLOW_ENTRY_DURATION + index * (FLOW_CARD_DURATION + FLOW_BRIDGE_DURATION);
  return { start, end: start + FLOW_CARD_DURATION, total: FLOW_TIMELINE_DURATION };
}

function getBridgeFlowTiming(index) {
  const start = FLOW_ENTRY_DURATION + (index + 1) * FLOW_CARD_DURATION + index * FLOW_BRIDGE_DURATION;
  return { start, end: start + FLOW_BRIDGE_DURATION, total: FLOW_TIMELINE_DURATION };
}

const LIGHT_STREAK_LAYERS = [
  { id: 'aura', className: 'lightRunnerAura', dashLength: 0.2, opacity: 0.48 },
  { id: 'trail', className: 'lightRunnerTrail', dashLength: 0.12, opacity: 0.86 },
  { id: 'core', className: 'lightRunnerCore', dashLength: 0.014, opacity: 0.98 },
];

function getMotionTimeline(timing, dashLength = 0.014, maxOpacity = 1) {
  const start = timing.start / timing.total;
  const end = timing.end / timing.total;
  const fade = Math.min(0.006, (end - start) * 0.12);
  const format = (value) => Math.max(0, Math.min(1, value)).toFixed(4);
  const startOffset = dashLength.toFixed(3);
  const endOffset = (dashLength - 1).toFixed(3);
  const visibleOpacity = maxOpacity.toFixed(2);

  if (start === 0) {
    return {
      duration: `${timing.total}s`,
      motionKeyTimes: `0;${format(end)};1`,
      motionKeySplines: '0.35 0 0.65 1;0 0 1 1',
      strokeOffsetValues: `${startOffset};${endOffset};${endOffset}`,
      opacityValues: `0;${visibleOpacity};${visibleOpacity};0;0`,
      opacityKeyTimes: `0;${format(fade)};${format(end - fade)};${format(end)};1`,
    };
  }

  return {
    duration: `${timing.total}s`,
    motionKeyTimes: `0;${format(start)};${format(end)};1`,
    motionKeySplines: '0 0 1 1;0.35 0 0.65 1;0 0 1 1',
    strokeOffsetValues: `${startOffset};${startOffset};${endOffset};${endOffset}`,
    opacityValues: `0;0;${visibleOpacity};${visibleOpacity};0;0`,
    opacityKeyTimes: `0;${format(start)};${format(start + fade)};${format(end - fade)};${format(end)};1`,
  };
}

function getArrivalPulseTimeline(timing, peakOpacity = 1) {
  const format = (value) => Math.max(0, Math.min(1, value / timing.total)).toFixed(4);
  const peak = Math.min(timing.end, timing.start + 0.32);
  const settle = Math.min(timing.end, timing.start + 1.15);

  return {
    duration: `${timing.total}s`,
    values: `0.08;0.08;${peakOpacity};0.2;0.08;0.08`,
    keyTimes: `0;${format(timing.start)};${format(peak)};${format(settle)};${format(timing.end)};1`,
  };
}

function getExitPulseTimeline(timing) {
  const format = (value) => Math.max(0, Math.min(1, value / timing.total)).toFixed(4);
  const wake = Math.max(timing.start, timing.end - 0.8);
  const peak = Math.max(wake, timing.end - 0.18);
  const fade = Math.min(timing.total, timing.end + 0.28);

  return {
    duration: `${timing.total}s`,
    values: '0.14;0.14;0.58;1;0.14;0.14',
    keyTimes: `0;${format(wake)};${format(peak)};${format(timing.end)};${format(fade)};1`,
  };
}

const HERO_GALLERY_SLOTS = [
  { id: 'visual-01', x: 8.5, y: 34, width: 230, mobileWidth: 96, ratio: '16 / 10', accent: '#9674ff' },
  { id: 'visual-02', x: 22, y: 68, width: 188, mobileWidth: 86, ratio: '4 / 3', accent: '#5d8dff' },
  { id: 'visual-03', x: 36, y: 28, width: 218, mobileWidth: 94, ratio: '16 / 10', accent: '#61d8ff' },
  { id: 'visual-04', x: 50, y: 64, width: 248, mobileWidth: 104, ratio: '16 / 10', accent: '#a56fff' },
  { id: 'visual-05', x: 64, y: 27, width: 196, mobileWidth: 88, ratio: '4 / 3', accent: '#62c5ff' },
  { id: 'visual-06', x: 78, y: 68, width: 228, mobileWidth: 98, ratio: '16 / 10', accent: '#7a80ff' },
  { id: 'visual-07', x: 91.5, y: 36, width: 190, mobileWidth: 86, ratio: '4 / 3', accent: '#b16dff' },
];

const DEFAULT_ENTRY_ROUTE = 'M 640 -220 V 214';
const DEFAULT_BRIDGE_ROUTE = 'M 905 -140 V 44 Q 905 78 871 78 H 129 Q 95 78 95 112 V 360';

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createHeroGalleryFrames() {
  return HERO_GALLERY_SLOTS.map((slot, index) => {
    const finalRotation = randomBetween(-5.2, 5.2);
    const delay = randomBetween(60, 620);
    const duration = randomBetween(1080, 1480);
    const floatHorizontalDirection = Math.random() < 0.5 ? -1 : 1;
    const floatVerticalDirection = Math.random() < 0.5 ? -1 : 1;

    return {
      ...slot,
      index: index + 1,
      x: Math.min(93, Math.max(7, slot.x + randomBetween(-1.35, 1.35))),
      y: Math.min(78, Math.max(21, slot.y + randomBetween(-4.5, 4.5))),
      finalRotation,
      startRotation: finalRotation + randomBetween(-11, 11),
      startX: randomBetween(-90, 90),
      delay,
      duration,
      floatX: randomBetween(2.4, 5.8) * floatHorizontalDirection,
      floatY: randomBetween(1.8, 4.5) * floatVerticalDirection,
      floatRotation: randomBetween(0.28, 0.82) * floatHorizontalDirection,
      floatDuration: randomBetween(4200, 6800),
      floatDelay: delay + duration,
      layer: Math.round(randomBetween(1, 5)),
    };
  });
}

function LightStreak({ path, timing, scopeClassName }) {
  return LIGHT_STREAK_LAYERS.map((layer) => {
    const timeline = getMotionTimeline(timing, layer.dashLength, layer.opacity);

    return (
      <path
        key={layer.id}
        className={`${styles.lightRunner} ${styles[layer.className]} ${scopeClassName}`}
        pathLength="1"
        d={path}
        opacity="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          values={timeline.strokeOffsetValues}
          keyTimes={timeline.motionKeyTimes}
          keySplines={timeline.motionKeySplines}
          calcMode="spline"
          dur={timeline.duration}
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values={timeline.opacityValues}
          keyTimes={timeline.opacityKeyTimes}
          dur={timeline.duration}
          repeatCount="indefinite"
        />
      </path>
    );
  });
}

function RouteStreak({ path, timing }) {
  return <LightStreak path={path} timing={timing} scopeClassName={styles.routeRunner} />;
}

function FlowFrameGlow({ id, side, timing }) {
  const edgeGradientId = `flow-frame-edge-${id}-${side}`;
  const beamGradientId = `flow-frame-beam-${id}-${side}`;
  const impactGradientId = `flow-frame-impact-${id}-${side}`;
  const framePaths = [
    'M 720 1 H 976 Q 999 1 999 24 V 538 Q 999 561 976 561 H 280',
    'M 720 1 H 24 Q 1 1 1 24 V 538 Q 1 561 24 561 H 280',
  ];
  const beamShape = 'M 706 -225 C 710 -162 710 -78 700 -32 C 696 -14 684 -5 660 1 H 780 C 756 -5 744 -14 740 -32 C 730 -78 730 -162 734 -225 Z';
  const beamCoreShape = 'M 714 -225 C 716 -148 717 -66 710 -28 C 707 -12 700 -4 688 1 H 752 C 740 -4 733 -12 730 -28 C 723 -66 724 -148 726 -225 Z';
  const arrivalAuraTimeline = getArrivalPulseTimeline(timing, 0.72);
  const arrivalCoreTimeline = getArrivalPulseTimeline(timing, 0.96);
  const impactTimeline = getArrivalPulseTimeline(timing, 1);
  const exitTimeline = getExitPulseTimeline(timing);

  return (
    <svg
      className={`${styles.flowFrameGlow} ${side === 'left' ? styles.flowFrameGlowLeft : ''}`}
      viewBox="0 0 1000 562"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id={edgeGradientId}
          gradientUnits="userSpaceOnUse"
          cx="720"
          cy="1"
          r="760"
        >
          <stop offset="0" stopColor="#fffaff" stopOpacity="1" />
          <stop offset="0.12" stopColor="#efe7ff" stopOpacity="0.98" />
          <stop offset="0.34" stopColor="#bda5ff" stopOpacity="0.88" />
          <stop offset="0.7" stopColor="#8169ee" stopOpacity="0.5" />
          <stop offset="1" stopColor="#536fe0" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient
          id={beamGradientId}
          gradientUnits="userSpaceOnUse"
          x1="720"
          y1="-330"
          x2="720"
          y2="4"
        >
          <stop offset="0" stopColor="#8a72ff" stopOpacity="0" />
          <stop offset="0.24" stopColor="#9f83ff" stopOpacity="0.24" />
          <stop offset="0.7" stopColor="#d8c8ff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fffaff" stopOpacity="1" />
        </linearGradient>
        <radialGradient id={impactGradientId}>
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.2" stopColor="#f4ebff" stopOpacity="0.96" />
          <stop offset="0.55" stopColor="#baa2ff" stopOpacity="0.58" />
          <stop offset="1" stopColor="#8067f1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        className={styles.flowFrameBeamAura}
        fill={`url(#${beamGradientId})`}
        d={beamShape}
      >
        <animate
          attributeName="opacity"
          values={arrivalAuraTimeline.values}
          keyTimes={arrivalAuraTimeline.keyTimes}
          dur={arrivalAuraTimeline.duration}
          repeatCount="indefinite"
        />
      </path>
      <path
        className={styles.flowFrameBeamCore}
        fill={`url(#${beamGradientId})`}
        d={beamCoreShape}
      >
        <animate
          attributeName="opacity"
          values={arrivalCoreTimeline.values}
          keyTimes={arrivalCoreTimeline.keyTimes}
          dur={arrivalCoreTimeline.duration}
          repeatCount="indefinite"
        />
      </path>
      <ellipse
        className={styles.flowFrameImpact}
        cx="720"
        cy="1"
        rx="104"
        ry="15"
        fill={`url(#${impactGradientId})`}
      >
        <animate
          attributeName="opacity"
          values={impactTimeline.values}
          keyTimes={impactTimeline.keyTimes}
          dur={impactTimeline.duration}
          repeatCount="indefinite"
        />
      </ellipse>
      {framePaths.map((framePath, index) => (
        <path
          key={`halo-${index}`}
          className={styles.flowFrameHalo}
          stroke={`url(#${edgeGradientId})`}
          d={framePath}
        />
      ))}
      {framePaths.map((framePath, index) => (
        <path
          key={`core-${index}`}
          className={styles.flowFrameCore}
          stroke={`url(#${edgeGradientId})`}
          d={framePath}
        />
      ))}
      <ellipse
        className={styles.flowFrameExit}
        cx="280"
        cy="561"
        rx="76"
        ry="10"
        fill={`url(#${impactGradientId})`}
      >
        <animate
          attributeName="opacity"
          values={exitTimeline.values}
          keyTimes={exitTimeline.keyTimes}
          dur={exitTimeline.duration}
          repeatCount="indefinite"
        />
      </ellipse>
      {framePaths.map((framePath, index) => (
        <LightStreak
          key={`runner-${index}`}
          path={framePath}
          timing={timing}
          scopeClassName={styles.flowFrameRunner}
        />
      ))}
    </svg>
  );
}

function StoryVisual({ card }) {
  if (card.visualType === 'delivery') {
    return (
      <div className={`${styles.featureFrame} ${styles.deliveryFrame}`} role="img" aria-label="作品生成与交付状态预览">
        <img src={card.image} alt="" loading="lazy" decoding="async" />
        <div className={styles.deliveryShade} aria-hidden />
        <span className={styles.frameLabel}>Final delivery / ready</span>
        <div className={styles.deliveryStatus}>
          <span><i /> RENDER COMPLETE</span>
          <strong>04:32</strong>
        </div>
        <div className={styles.deliveryMetrics} aria-hidden>
          <span><strong>4K</strong> Resolution</span>
          <span><strong>24</strong> FPS</span>
          <span><strong>16:9</strong> Master</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.featureFrame} ${styles[card.frameClass] || ''}`}>
      <img
        src={card.image}
        alt={card.imageAlt}
        loading="lazy"
        decoding="async"
      />
      <span className={styles.frameLabel}>{card.visualLabel}</span>
    </div>
  );
}

function HomeLandingPage({ onEnterCanvas }) {
  const [galleryFrames] = useState(createHeroGalleryFrames);
  const [lightRoutes, setLightRoutes] = useState({
    entry: DEFAULT_ENTRY_ROUTE,
    bridges: Array.from({ length: STORY_CARDS.length - 1 }, () => DEFAULT_BRIDGE_ROUTE),
  });
  const showcaseCardRef = useRef(null);
  const storySectionRefs = useRef([]);
  const flowVisualRefs = useRef([]);
  const bridgeRefs = useRef([]);

  useLayoutEffect(() => {
    let animationFrameId;

    const updateLightRoutes = () => {
      const showcaseCard = showcaseCardRef.current;
      const firstStory = storySectionRefs.current[0];
      const firstFlowVisual = flowVisualRefs.current[0];
      const bridges = bridgeRefs.current.slice(0, STORY_CARDS.length - 1);
      const flowVisuals = flowVisualRefs.current.slice(0, STORY_CARDS.length);

      if (
        !firstStory ||
        !showcaseCard ||
        !firstFlowVisual ||
        bridges.some((bridge) => !bridge) ||
        flowVisuals.some((visual) => !visual)
      ) return;

      const storyRect = firstStory.getBoundingClientRect();
      const showcaseRect = showcaseCard.getBoundingClientRect();
      const firstVisualRect = firstFlowVisual.getBoundingClientRect();

      if (!storyRect.width || !storyRect.height) return;

      const entryTargetX = ((firstVisualRect.left + firstVisualRect.width * 0.28 - storyRect.left) / storyRect.width) * 1000;
      const entryStartY = ((showcaseRect.bottom - storyRect.top) / storyRect.height) * 760;
      const entryTargetY = ((firstVisualRect.top - storyRect.top) / storyRect.height) * 760;
      const entryRoute = `M ${entryTargetX.toFixed(1)} ${entryStartY.toFixed(1)} V ${entryTargetY.toFixed(1)}`;

      const bridgeRoutes = bridges.map((bridge, index) => {
        const bridgeRect = bridge.getBoundingClientRect();
        const startRect = flowVisuals[index].getBoundingClientRect();
        const endRect = flowVisuals[index + 1].getBoundingClientRect();

        if (!bridgeRect.width || !bridgeRect.height) return DEFAULT_BRIDGE_ROUTE;

        const bridgeStartX = ((startRect.left + startRect.width * 0.72 - bridgeRect.left) / bridgeRect.width) * 1000;
        const bridgeEndX = ((endRect.left + endRect.width * 0.28 - bridgeRect.left) / bridgeRect.width) * 1000;
        const bridgeStartY = ((startRect.bottom - bridgeRect.top) / bridgeRect.height) * 220;
        const bridgeEndY = ((endRect.top - bridgeRect.top) / bridgeRect.height) * 220;
        const bridgeGap = Math.max(1, bridgeEndY - bridgeStartY);
        const bridgeTurnY = bridgeStartY + bridgeGap * 0.48;
        const bridgeRadius = Math.min(34, Math.max(22, bridgeGap * 0.08));
        const horizontalDirection = bridgeEndX > bridgeStartX ? 1 : -1;

        return [
          `M ${bridgeStartX.toFixed(1)} ${bridgeStartY.toFixed(1)} V ${(bridgeTurnY - bridgeRadius).toFixed(1)}`,
          `Q ${bridgeStartX.toFixed(1)} ${bridgeTurnY.toFixed(1)} ${(bridgeStartX + horizontalDirection * bridgeRadius).toFixed(1)} ${bridgeTurnY.toFixed(1)}`,
          `H ${(bridgeEndX - horizontalDirection * bridgeRadius).toFixed(1)}`,
          `Q ${bridgeEndX.toFixed(1)} ${bridgeTurnY.toFixed(1)} ${bridgeEndX.toFixed(1)} ${(bridgeTurnY + bridgeRadius).toFixed(1)}`,
          `V ${bridgeEndY.toFixed(1)}`,
        ].join(' ');
      });

      setLightRoutes((currentRoutes) => (
        currentRoutes.entry === entryRoute &&
        currentRoutes.bridges.length === bridgeRoutes.length &&
        currentRoutes.bridges.every((route, index) => route === bridgeRoutes[index])
          ? currentRoutes
          : { entry: entryRoute, bridges: bridgeRoutes }
      ));
    };

    const scheduleLightRouteUpdate = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateLightRoutes);
    };

    const resizeObserver = new ResizeObserver(scheduleLightRouteUpdate);
    const observedElements = [
      showcaseCardRef.current,
      ...storySectionRefs.current,
      ...flowVisualRefs.current,
      ...bridgeRefs.current,
    ].filter(Boolean);
    observedElements.forEach((element) => resizeObserver.observe(element));
    window.addEventListener('resize', scheduleLightRouteUpdate);
    scheduleLightRouteUpdate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleLightRouteUpdate);
    };
  }, []);

  return (
    <div className={styles.page}>
      <main>
        <section className={styles.hero} aria-labelledby="home-hero-title">
          <img
            className={styles.heroImage}
            src={infiniteCanvasHero}
            alt="发光的故事画面与分镜节点在无限画布中相互连接"
            fetchPriority="high"
          />
          <div className={styles.heroShade} aria-hidden />
          <div className={styles.heroGrid} aria-hidden />

          <div className={styles.heroGallery} role="group" aria-label="图片展示位">
            {galleryFrames.map((frame) => (
              <figure
                key={frame.id}
                className={styles.galleryFrame}
                aria-label={`图片展示位 ${frame.index}，等待添加图片`}
                style={{
                  '--frame-x': `${frame.x}%`,
                  '--frame-y': `${frame.y}%`,
                  '--frame-width': `${frame.width}px`,
                  '--frame-mobile-width': `${frame.mobileWidth}px`,
                  '--frame-ratio': frame.ratio,
                  '--frame-accent': frame.accent,
                  '--frame-rotation': `${frame.finalRotation}deg`,
                  '--frame-start-rotation': `${frame.startRotation}deg`,
                  '--frame-start-x': `${frame.startX}px`,
                  '--frame-delay': `${frame.delay}ms`,
                  '--frame-duration': `${frame.duration}ms`,
                  '--frame-float-x': `${frame.floatX}px`,
                  '--frame-float-y': `${frame.floatY}px`,
                  '--frame-float-rotation': `${frame.floatRotation}deg`,
                  '--frame-float-duration': `${frame.floatDuration}ms`,
                  '--frame-float-delay': `${frame.floatDelay}ms`,
                  '--frame-layer': frame.layer,
                }}
              >
                <div className={styles.galleryFrameSurface}>
                  <figcaption className={styles.galleryFrameBar}>
                    <span><i /> VISUAL {String(frame.index).padStart(2, '0')}</span>
                    <small>EMPTY</small>
                  </figcaption>
                  <div className={styles.galleryPlaceholder} aria-hidden>
                    <span className={styles.galleryReticle}>+</span>
                    <small>IMAGE SLOT</small>
                    <div className={styles.galleryCorners}><i /><i /><i /><i /></div>
                  </div>
                </div>
              </figure>
            ))}
          </div>

          <h1 id="home-hero-title" className={styles.visuallyHidden}>AIYO 无限画布</h1>
          <div className={styles.portalLight} aria-hidden>
            <img
              className={`${styles.waterfallImage} ${styles.waterfallImageTop}`}
              src={lightWaterfall}
              alt=""
            />
            <img className={styles.waterfallImage} src={lightWaterfall} alt="" />
          </div>

          <button className={styles.primaryAction} type="button" onClick={onEnterCanvas}>
            <span>进入无限画布</span>
          </button>
        </section>

        <section className={styles.showcaseSection} aria-labelledby="showcase-title">
          <div className={styles.sectionIntro}>
            <p>Featured / 近期作品与活动</p>
            <h2 id="showcase-title">让好故事，先被看见</h2>
            <span>精选创作、平台活动与灵感专题会在这里持续更新。</span>
          </div>

          <article ref={showcaseCardRef} className={styles.showcaseCard}>
            <img
              src={showcaseArtwork}
              alt="霓虹光影下的东方侠客角色视觉作品"
              loading="lazy"
              decoding="async"
            />
            <div className={styles.showcaseShade} aria-hidden />
            <div className={styles.showcaseCopy}>
              <p>AIYO Featured Work · 001</p>
              <h3>光影新国风角色视觉实验</h3>
              <span>从人物概念到氛围定调，在无限画布中沉淀一套完整视觉语言。</span>
            </div>
            <div className={styles.showcaseNumber} aria-hidden>01 / 03</div>
          </article>
        </section>

        {STORY_CARDS.map((card, index) => {
          const isReverse = index % 2 === 1;
          const titleId = `story-${card.id}-title`;
          const route = lightRoutes.bridges[index] || DEFAULT_BRIDGE_ROUTE;
          const copy = (
            <div className={`${styles.storyCopy} ${card.compactTitle ? styles.storyCopyCompact : ''}`}>
              <p className={styles.storyIndex}>{card.eyebrow}</p>
              <h2 id={titleId}>{card.title}</h2>
              <p>{card.description}</p>
              <div className={styles.tagRow} aria-label={`${card.title}能力`}>
                {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          );
          const visual = (
            <div
              ref={(element) => { flowVisualRefs.current[index] = element; }}
              className={styles.flowVisual}
            >
              <StoryVisual card={card} />
              <FlowFrameGlow id={card.id} side="left" timing={getCardFlowTiming(index)} />
            </div>
          );

          return (
            <Fragment key={card.id}>
              <section
                ref={(element) => { storySectionRefs.current[index] = element; }}
                className={`${styles.storySection} ${isReverse ? styles.storySectionReverse : ''}`}
                aria-labelledby={titleId}
              >
                {index === 0 && (
                  <svg
                    className={styles.storyEntryRoute}
                    viewBox="0 0 1000 760"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <defs>
                      <linearGradient id="story-entry-light" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#8270ff" stopOpacity="0.08" />
                        <stop offset="0.2" stopColor="#f8f5ff" stopOpacity="0.95" />
                        <stop offset="0.72" stopColor="#b49bff" stopOpacity="0.88" />
                        <stop offset="1" stopColor="#f8f5ff" stopOpacity="0.96" />
                      </linearGradient>
                    </defs>
                    <path className={styles.routeHalo} d={lightRoutes.entry} />
                    <path className={styles.routeAura} d={lightRoutes.entry} />
                    <path className={styles.routeCore} stroke="url(#story-entry-light)" d={lightRoutes.entry} />
                    <RouteStreak path={lightRoutes.entry} timing={FLOW_ENTRY_TIMING} />
                  </svg>
                )}

                {isReverse ? <>{visual}{copy}</> : <>{copy}{visual}</>}
              </section>

              {index < STORY_CARDS.length - 1 && (
                <div
                  ref={(element) => { bridgeRefs.current[index] = element; }}
                  className={styles.lightBridge}
                  aria-hidden
                >
                  <svg className={styles.bridgeRoute} viewBox="0 0 1000 220" preserveAspectRatio="none" focusable="false">
                    <defs>
                      <linearGradient id={`story-bridge-light-${index}`} x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#f8f5ff" stopOpacity="0.96" />
                        <stop offset="0.5" stopColor="#a68cff" stopOpacity="0.84" />
                        <stop offset="1" stopColor="#f8f5ff" stopOpacity="0.96" />
                      </linearGradient>
                    </defs>
                    <path className={styles.routeHalo} d={route} />
                    <path className={styles.routeAura} d={route} />
                    <path className={styles.routeCore} stroke={`url(#story-bridge-light-${index})`} d={route} />
                    <RouteStreak path={route} timing={getBridgeFlowTiming(index)} />
                  </svg>
                </div>
              )}
            </Fragment>
          );
        })}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerGlow} aria-hidden />
        <div className={styles.footerLead}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogoShell}>
              <img src={aiyoLogo} alt="AIYO" />
            </span>
            <span className={styles.footerBrandCopy}>
              <strong>AIYO</strong>
              <small>AI NATIVE FILM STUDIO</small>
            </span>
          </div>
          <p>CREATE BEYOND THE FRAME</p>
          <h2>让想象，抵达下一帧。</h2>
          <span className={styles.footerDescription}>
            在同一张无限画布里，完成灵感、角色、分镜与成片。
          </span>
        </div>

        <button className={styles.footerAction} type="button" onClick={onEnterCanvas}>
          <span>进入无限画布</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>

        <div className={styles.footerMeta}>
          <span>AI NATIVE STORY WORKSPACE</span>
          <span>© 2026 AIYO STUDIO</span>
          <span className={styles.footerStatus}><i /> CREATIVE SYSTEM ONLINE</span>
        </div>
      </footer>
    </div>
  );
}

export default HomeLandingPage;
