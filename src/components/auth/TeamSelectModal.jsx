import styles from './TeamSelectModal.module.less';

// 团队选择弹窗：登录后进入具体协作团队。
function TeamSelectModal({
  open,
  teams,
  selectedTeamId,
  onSelectTeam,
  onConfirm,
  onClose,
  confirmLoading = false,
}) {
  // 关闭态时不渲染，避免占用事件层与布局。
  if (!open) {
    return null;
  }

  return (
    <div className={styles.mask} role="presentation">
      <section
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-select-title"
        aria-describedby="team-select-description"
      >
        <h2 className={styles.title} id="team-select-title">选择团队</h2>
        <p className={styles.subtitle} id="team-select-description">
          请选择当前登录账号需要进入的协作团队
        </p>

        <div className={styles.teamList}>
          {teams.map((team) => (
            <button
              key={team.id}
              className={`${styles.teamItem} ${selectedTeamId === team.id ? styles.selected : ''}`}
              onClick={() => onSelectTeam(team.id)}
              type="button"
              aria-pressed={selectedTeamId === team.id}
            >
              <span className={styles.teamName}>{team.name}</span>
              <small>{team.memberCount ? `${team.memberCount} 人协作中` : '团队协作空间'}</small>
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelButton}
            type="button"
            onClick={onClose}
            disabled={confirmLoading}
          >
            取消
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? '进入中...' : '确认进入'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default TeamSelectModal;
