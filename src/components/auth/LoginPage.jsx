import { useState } from 'react';
import aiveoLogo from '../../assets/aiveo-logo.png';
import workflowVisual from '../../assets/home-ai-short-drama-workflow.png';
import styles from './LoginPage.module.less';

// 登录页：收集账号密码并交给上层处理鉴权逻辑。
function LoginPage({ onLogin, loading = false }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  // 阻止默认提交，统一走回调以便上层控制流程。
  function handleSubmit(event) {
    event.preventDefault();
    onLogin({ account, password });
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden />

      <section className={styles.showcase} aria-label="AiVeo 创作平台介绍">
        <div className={styles.showcaseTop}>
          <img className={styles.showcaseLogo} src={aiveoLogo} alt="" />
          <span className={styles.productTag}>AI DRAMA PRODUCTION SUITE</span>
        </div>

        <div className={styles.showcaseCopy}>
          <span className={styles.eyebrow}>FROM IDEA TO SCREEN</span>
          <h2>把灵感，变成<br />可交付的故事。</h2>
          <p>一个面向短剧团队的智能制作空间，从剧本解析到分镜成片，让创作链路更清晰。</p>
        </div>

        <div className={styles.visualFrame}>
          <img src={workflowVisual} alt="" />
          <div className={styles.visualOverlay} aria-hidden />
          <div className={styles.visualMeta}>
            <span>01 剧本</span>
            <span>02 设定</span>
            <span>03 分镜</span>
            <span>04 成片</span>
          </div>
        </div>
      </section>

      <section className={styles.authPanel}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.mobileBrand}>
            <img className={styles.logo} src={aiveoLogo} alt="AiVeo" />
          </div>
          <div className={styles.formHeader}>
            <span>WELCOME BACK</span>
            <h1 className={styles.title}>AI剧创作一体化平台</h1>
            <p className={styles.subtitle}>主账号登录后选择团队，子账号登录后直接进入项目工作台。</p>
          </div>

          <label>
            账号
            <input
              type="text"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
              disabled={loading}
              required
            />
          </label>

          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </label>

          <button className={styles.primaryButton} type="submit" disabled={loading}>
            <span>{loading ? '登录中...' : '登录'}</span>
            {!loading && <span aria-hidden>进入工作台 →</span>}
          </button>

          <p className={styles.securityNote}><span aria-hidden>●</span> 安全连接 · 团队数据独立存储</p>
        </form>
      </section>
    </div>
  );
}

export default LoginPage;
