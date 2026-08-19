import aiveoLogo from '../../assets/aiveo-logo.png';
import infiniteCanvasHero from '../../assets/home-infinite-canvas-hero.png';
import lightWaterfall from '../../assets/home-light-waterfall-v6.png';
import showcaseArtwork from '../../assets/login/martial-artist-background.png';
import styles from './HomeLandingPage.module.less';

const CREATIVE_STAGES = [
  { id: 'idea', index: '01', label: '故事灵感', tone: 'violet' },
  { id: 'world', index: '02', label: '角色与世界', tone: 'blue' },
  { id: 'shot', index: '03', label: '分镜画面', tone: 'cyan' },
  { id: 'film', index: '04', label: '动态成片', tone: 'coral' },
];

function HomeLandingPage({ onEnterCanvas }) {
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

          <h1 id="home-hero-title" className={styles.visuallyHidden}>AiVeo 无限画布</h1>
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

          <article className={styles.showcaseCard}>
            <img
              src={showcaseArtwork}
              alt="霓虹光影下的东方侠客角色视觉作品"
              loading="lazy"
              decoding="async"
            />
            <div className={styles.showcaseShade} aria-hidden />
            <div className={styles.showcaseCopy}>
              <p>AiVeo Featured Work · 001</p>
              <h3>光影新国风角色视觉实验</h3>
              <span>从人物概念到氛围定调，在无限画布中沉淀一套完整视觉语言。</span>
            </div>
            <div className={styles.showcaseNumber} aria-hidden>01 / 03</div>
          </article>
        </section>

        <section className={styles.storySection} aria-labelledby="canvas-story-title">
          <div className={styles.storyCopy}>
            <p className={styles.storyIndex}>01 / One canvas</p>
            <h2 id="canvas-story-title">不再被步骤切断的创作思路</h2>
            <p>
              把灵感、文本、参考图、角色与镜头放回同一个空间。自由连接、随时调整，让每一次发散都有迹可循。
            </p>
            <div className={styles.tagRow} aria-label="画布能力">
              <span>自由连接</span>
              <span>无限延展</span>
              <span>实时预览</span>
            </div>
          </div>

          <div className={styles.featureFrame}>
            <img
              src={infiniteCanvasHero}
              alt="多个故事画面在无限画布中连接成创作网络"
              loading="lazy"
              decoding="async"
            />
            <span className={styles.frameLabel}>Infinite canvas / live view</span>
          </div>
        </section>

        <div className={styles.lightBridge} aria-hidden>
          <span />
        </div>

        <section className={`${styles.storySection} ${styles.storySectionReverse}`} aria-labelledby="flow-story-title">
          <div className={styles.canvasPreview} role="img" aria-label="故事灵感、角色、分镜和动态成片节点组成的画布流程">
            <div className={styles.previewTopbar}>
              <span><i /> AIVEO CANVAS</span>
              <small>LIVE FLOW</small>
            </div>
            <div className={styles.previewGrid} aria-hidden>
              <svg className={styles.previewLines} viewBox="0 0 760 430" preserveAspectRatio="none">
                <path d="M150 216 C230 216 212 110 305 110 S390 196 457 196" />
                <path d="M150 216 C240 216 235 320 330 320 S410 250 505 250" />
                <path d="M457 196 C540 196 530 118 620 118" />
                <path d="M505 250 C580 250 558 335 650 335" />
              </svg>
              {CREATIVE_STAGES.map((stage) => (
                <div key={stage.id} className={`${styles.previewNode} ${styles[`node${stage.index}`]}`}>
                  <span className={styles[`tone${stage.tone}`]}>{stage.index}</span>
                  <strong>{stage.label}</strong>
                  <small>NODE / {stage.index}</small>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.storyCopy}>
            <p className={styles.storyIndex}>02 / One continuous flow</p>
            <h2 id="flow-story-title">从一个念头，到一条完整叙事链路</h2>
            <p>
              每个节点既能独立创作，也能承接上下文继续生长。画布不规定你的流程，只负责让想法彼此发生关系。
            </p>
            <div className={styles.processLine} aria-label="创作流程">
              <span>灵感</span><i />
              <span>设定</span><i />
              <span>分镜</span><i />
              <span>成片</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <img src={aiveoLogo} alt="AiVeo" />
          <span>Nebula Drama Studio</span>
        </div>
        <p>Make every story visible.</p>
        <small>© 2026 AIVEO STUDIO</small>
      </footer>
    </div>
  );
}

export default HomeLandingPage;
