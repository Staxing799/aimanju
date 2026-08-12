import styles from './TopBar.module.less';

// 顶部栏：展示页面标题、团队信息、积分与登录账号。
function TopBar({ title, teamName, account, availablePoints, onLogout }) {
  const accountInitial = String(account || 'A').trim().slice(0, 1).toUpperCase();

  return (
    <header className={styles.topbar}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>WORKSPACE / {title}</span>
        <h2>{title}</h2>
        <p><span className={styles.onlineDot} aria-hidden />{teamName} | 团队协作模式</p>
      </div>

      <div className={styles.meta}>
        <span className={styles.pointsBadge}>
          <span className={styles.pointsIcon} aria-hidden>✦</span>
          <small>可用积分</small>
          <strong>{availablePoints || '--'}</strong>
        </span>
        <span className={styles.account}>
          <span className={styles.avatar} aria-hidden>{accountInitial}</span>
          <span className={styles.accountCopy}>
            <small>当前账号</small>
            <strong>{account}</strong>
          </span>
        </span>
        <button className={styles.logoutButton} type="button" onClick={onLogout}>
          退出登录
          <span aria-hidden>↗</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
