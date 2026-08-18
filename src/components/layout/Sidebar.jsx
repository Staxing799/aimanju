import aiveoLogo from '../../assets/aiveo-logo.png';
import styles from './Sidebar.module.less';

const MENU_CODE_MAP = {
  creation: 'CR',
  assets: 'AS',
  users: 'UR',
  projects: 'PM',
  points: 'PT',
};

// 左侧导航菜单：负责一级功能切换。
function Sidebar({ menuItems, activeMenu, onMenuChange }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIdentity}>
          <img className={styles.logoImage} src={aiveoLogo} alt="AiVeo" />
          <small>Nebula Drama Studio</small>
        </div>
        <span className={styles.brandPulse} aria-hidden />
      </div>

      <div className={styles.navLabel}>
        <span>创作导航</span>
        <small>STUDIO OS</small>
      </div>

      <nav className={styles.nav} aria-label="主导航">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.menuItem} ${activeMenu === item.id ? styles.active : ''}`}
            onClick={() => onMenuChange(item.id)}
            type="button"
          >
            <span className={styles.menuCode}>{MENU_CODE_MAP[item.id] || 'MN'}</span>
            <span className={styles.menuText}>
              <span className={styles.menuLabel}>{item.label}</span>
              <small>{item.hint}</small>
            </span>
            <span className={styles.menuArrow} aria-hidden />
          </button>
        ))}
      </nav>

      <footer className={styles.sidebarFooter}>
        <span className={styles.systemDot} aria-hidden />
        <span>
          <strong>创作系统在线</strong>
          <small>PRODUCTION READY</small>
        </span>
      </footer>
    </aside>
  );
}

export default Sidebar;
