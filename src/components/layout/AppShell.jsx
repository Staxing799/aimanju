import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppShell.module.less';

// 应用布局骨架：左侧菜单 + 顶部信息栏 + 内容区。
function AppShell({
  menuItems,
  activeMenu,
  onMenuChange,
  currentUser,
  teamName,
  availablePoints,
  onLogout,
  hideNavigation = false,
  children,
}) {
  // 当前页面标题由菜单配置驱动。
  const currentTitle = menuItems.find((item) => item.id === activeMenu)?.label ?? '工作台';

  return (
    <div className={`${styles.shell} ${hideNavigation ? styles.shellFullscreen : ''}`}>
      {!hideNavigation && (
        <Sidebar menuItems={menuItems} activeMenu={activeMenu} onMenuChange={onMenuChange} />
      )}
      <section className={styles.workspace}>
        {!hideNavigation && (
          <TopBar
            title={currentTitle}
            teamName={teamName}
            account={currentUser}
            availablePoints={availablePoints}
            onLogout={onLogout}
          />
        )}
        <main className={`${styles.content} ${hideNavigation ? styles.contentFullscreen : ''}`}>
          {children}
        </main>
      </section>
    </div>
  );
}

export default AppShell;
