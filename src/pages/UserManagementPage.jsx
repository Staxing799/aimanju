import { useEffect, useMemo, useRef, useState } from 'react';
import { userApi } from '../api';
import PaginationBar from '../components/common/PaginationBar';
import { parseApiErrorMessage } from '../utils/projectAdapter';
import styles from './UserManagementPage.module.less';

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 16, 24, 40];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 3 * ONE_DAY_MS;
const RECENT_WINDOW_MS = 7 * ONE_DAY_MS;
const COPY = {
  inviteButton: '\u9080\u8bf7\u5b50\u8d26\u53f7',
  inviteSubmit: '\u53d1\u9001\u9080\u8bf7',
  inviteAccount: '\u9080\u8bf7\u8d26\u53f7',
  inviteTitle: '\u8f93\u5165\u5df2\u6ce8\u518c\u7684\u8d26\u53f7\u7528\u6237\u540d',
  invitePlaceholder: '\u4f8b\u5982\uff1aalex_li',
  inviteDescription: '\u52a0\u5165\u540e\u5c06\u5171\u4eab\u5f53\u524d\u56e2\u961f\u5de5\u4f5c\u533a\uff0c\u79ef\u5206\u989d\u5ea6\u53ef\u5728\u6210\u5458\u5217\u8868\u4e2d\u5355\u72ec\u8bbe\u7f6e\u3002',
  inviteRequired: '\u8bf7\u8f93\u5165\u8d26\u53f7\u7528\u6237\u540d',
  inviteWhitespace: '\u7528\u6237\u540d\u4e0d\u80fd\u5305\u542b\u7a7a\u683c',
  inviteLength: '\u8d26\u53f7\u683c\u5f0f\uff1a2\u201364 \u4e2a\u5b57\u7b26\uff0c\u4e0d\u80fd\u5305\u542b\u7a7a\u683c',
  inviteDuplicate: '\u8be5\u8d26\u53f7\u5df2\u7ecf\u5728\u5f53\u524d\u6210\u5458\u5217\u8868\u4e2d',
  inviteSuccess: '\u9080\u8bf7\u5df2\u53d1\u9001',
  inviteLoading: '\u6b63\u5728\u9080\u8bf7...',
  inviteError: '\u9080\u8bf7\u53d1\u9001\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
  inviteClose: '\u5173\u95ed\u9080\u8bf7\u5f39\u7a97',
  cancel: '\u53d6\u6d88',
  remove: '\u79fb\u51fa',
  removeTitle: '\u79fb\u51fa\u5b50\u8d26\u53f7\uff1f',
  removeDescription: '\u79fb\u51fa\u540e\uff0c\u8be5\u8d26\u53f7\u5c06\u65e0\u6cd5\u7ee7\u7eed\u8bbf\u95ee\u5f53\u524d\u56e2\u961f\uff0c\u4f46\u4e0d\u4f1a\u5220\u9664\u8d26\u53f7\u672c\u8eab\u3002',
  removeConfirm: '\u786e\u8ba4\u79fb\u51fa',
  removeLoading: '\u79fb\u51fa\u4e2d...',
  removeError: '\u79fb\u51fa\u5b50\u8d26\u53f7\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
  removeClose: '\u5173\u95ed\u79fb\u51fa\u786e\u8ba4',
  removedPrefix: '\u5df2\u5c06',
  removedSuffix: '\u79fb\u51fa\u56e2\u961f',
  permissions: '\u8d26\u53f7\u6743\u9650',
  workspaceAccess: '\u56e2\u961f\u9879\u76ee\u4e0e\u7d20\u6750',
  accessibleAfterJoin: '\u52a0\u5165\u540e\u53ef\u8bbf\u95ee',
  pointsQuota: '\u79ef\u5206\u6d88\u8d39\u989d\u5ea6',
  configurableAfterJoin: '\u52a0\u5165\u540e\u53ef\u8bbe\u7f6e',
  irreversible: '\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500',
};

function toDisplayText(value, fallback = '-') {
  const safeText = String(value ?? '').trim();
  return safeText || fallback;
}

function toDisplayDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return toDisplayText(value);
  }

  return date.toLocaleString();
}

function toDateObject(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinWindow(value, windowMs) {
  const date = toDateObject(value);
  if (!date) {
    return false;
  }

  return Date.now() - date.getTime() <= windowMs;
}

function resolveRoleLabel(value) {
  const text = toDisplayText(value, '未定义');
  return text.toLowerCase();
}

function normalizePointsValue(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatPointsValue(value, fallback = '--') {
  const parsed = normalizePointsValue(value);
  if (parsed == null) {
    return fallback;
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function resolveMemberId(member) {
  return member?.user_id ?? member?.userId ?? member?.id ?? null;
}

function resolveMemberQuota(member) {
  return member?.points_quota ?? member?.pointsQuota ?? null;
}

function resolveMemberPointsUsed(member) {
  return member?.points_used ?? member?.pointsUsed ?? null;
}

function resolveMemberAvailableQuota(member) {
  return member?.available_quota_points ?? member?.availableQuotaPoints ?? null;
}

function resolveQuotaUsagePercent(pointsUsed, quota) {
  const normalizedUsed = normalizePointsValue(pointsUsed) || 0;
  const normalizedQuota = normalizePointsValue(quota);
  if (normalizedQuota == null) {
    return null;
  }

  if (normalizedQuota === 0) {
    return normalizedUsed > 0 ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Math.round((normalizedUsed / normalizedQuota) * 100)));
}

function isMainMember(member) {
  const accountType = String(member?.account_type ?? member?.accountType ?? '').trim().toLowerCase();
  const role = resolveRoleLabel(member?.member_role ?? member?.memberRole);
  const userType = String(member?.user_type ?? member?.userType ?? '').trim().toLowerCase();
  return accountType === 'main' || role.includes('owner') || userType === 'owner' || userType === 'main';
}

function resolveActivityStatus(value) {
  const date = toDateObject(value);
  if (!date) {
    return {
      label: '未知',
      tone: 'activityUnknown',
    };
  }

  const elapsed = Date.now() - date.getTime();
  if (elapsed <= ACTIVE_WINDOW_MS) {
    return {
      label: '活跃',
      tone: 'activityActive',
    };
  }

  if (elapsed <= RECENT_WINDOW_MS) {
    return {
      label: '近期在线',
      tone: 'activityRecent',
    };
  }

  return {
    label: '不活跃',
    tone: 'activityIdle',
  };
}

function normalizeMemberPageResponse(response) {
  const items = Array.isArray(response?.items) ? response.items : [];
  const parsedTotal = Number(response?.total);
  return {
    items,
    total: Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : items.length,
  };
}

function UserManagementPage({
  teamId,
  canInviteMembers = false,
  canManagePointsQuota = false,
  mainAvailablePoints = null,
  pointsWalletLoading = false,
  onRefreshMainAvailablePoints,
  onNotify,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [inviteUsername, setInviteUsername] = useState('');
  const [editingMemberId, setEditingMemberId] = useState('');
  const [quotaDraft, setQuotaDraft] = useState('');
  const [quotaUnlimited, setQuotaUnlimited] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaError, setQuotaError] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const activeTeamIdRef = useRef(teamId);

  useEffect(() => {
    activeTeamIdRef.current = teamId;
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setInviteOpen(false);
    setInviteUsername('');
    setInviteLoading(false);
    setInviteError('');
    setEditingMemberId('');
    setQuotaDraft('');
    setQuotaUnlimited(false);
    setQuotaSaving(false);
    setQuotaError('');
    setRemovingMemberId('');
    setRemoveLoading(false);
    setRemoveError('');
  }, [teamId]);

  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      setLoading(false);
      setErrorMessage('');
      setTotal(0);
      return;
    }

    let disposed = false;

    async function loadTeamMembers() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await userApi.getTeamMembers(teamId, page, pageSize);
        if (disposed) {
          return;
        }
        const normalized = normalizeMemberPageResponse(response);
        setMembers(normalized.items);
        setTotal(normalized.total);
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = parseApiErrorMessage(error, '团队成员加载失败，请稍后重试');
        setMembers([]);
        setTotal(0);
        setErrorMessage(message);
        if (typeof onNotify === 'function') {
          onNotify(message, 'error');
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    loadTeamMembers();

    return () => {
      disposed = true;
    };
  }, [teamId, page, pageSize, refreshNonce, onNotify]);

  const remoteTotal =
    Number.isFinite(Number(total)) && Number(total) >= 0 ? Number(total) : members.length;
  const totalPages = Math.max(1, Math.ceil(remoteTotal / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const summary = useMemo(() => {
    const ownerCount = members.filter((member) => {
      const role = resolveRoleLabel(member?.member_role);
      return role.includes('owner') || role.includes('admin') || role.includes('负责人');
    }).length;
    const activeCount = members.filter((member) => isWithinWindow(member?.last_active_at, ACTIVE_WINDOW_MS)).length;
    const recentCount = members.filter((member) => isWithinWindow(member?.last_active_at, RECENT_WINDOW_MS)).length;
    const subMembers = members.filter((member) => !isMainMember(member));
    const pointsConfiguredCount = subMembers.filter((member) => resolveMemberQuota(member) != null).length;

    return {
      ownerCount,
      activeCount,
      recentCount,
      pointsConfiguredCount,
      unlimitedPointsCount: Math.max(0, subMembers.length - pointsConfiguredCount),
    };
  }, [members]);

  const loadingAnnouncement = loading ? '正在同步成员数据...' : `当前显示 ${members.length} 名成员`;
  const normalizedMainAvailablePoints = normalizePointsValue(mainAvailablePoints);
  const maxAssignablePoints =
    normalizedMainAvailablePoints == null ? null : Math.floor(normalizedMainAvailablePoints);
  const editingMember = members.find(
    (member) => String(resolveMemberId(member)) === editingMemberId,
  );
  const removingMember = members.find(
    (member) => String(resolveMemberId(member)) === removingMemberId,
  );
  const removingMemberName = toDisplayText(
    removingMember?.real_name ?? removingMember?.username,
    COPY.inviteAccount,
  );
  const editingMemberQuota = resolveMemberQuota(editingMember);
  const editingMemberPointsUsed = resolveMemberPointsUsed(editingMember);
  const editingMemberAvailableQuota = resolveMemberAvailableQuota(editingMember);
  const editingMemberUsagePercent = resolveQuotaUsagePercent(
    editingMemberPointsUsed,
    editingMemberQuota,
  );

  useEffect(() => {
    if (!editingMemberId && !inviteOpen && !removingMemberId) {
      return undefined;
    }

    function handleDialogKeyDown(event) {
      if (event.key !== 'Escape' || quotaSaving || inviteLoading || removeLoading) {
        return;
      }

      if (inviteOpen) {
        setInviteOpen(false);
        setInviteUsername('');
        setInviteError('');
      } else if (removingMemberId) {
        setRemovingMemberId('');
        setRemoveError('');
      } else {
        setEditingMemberId('');
        setQuotaDraft('');
        setQuotaUnlimited(false);
        setQuotaError('');
      }
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleDialogKeyDown);
    };
  }, [editingMemberId, inviteLoading, inviteOpen, quotaSaving, removeLoading, removingMemberId]);

  function handleRefreshMembers() {
    if (!teamId || loading) {
      return;
    }

    if (page !== 1) {
      setPage(1);
      return;
    }

    setRefreshNonce((current) => current + 1);
  }

  function openInviteDialog() {
    if (!teamId || !canInviteMembers) {
      return;
    }

    setInviteUsername('');
    setInviteError('');
    setInviteOpen(true);
  }

  function closeInviteDialog() {
    if (inviteLoading) {
      return;
    }

    setInviteOpen(false);
    setInviteUsername('');
    setInviteError('');
  }

  async function handleInviteMember(event) {
    event.preventDefault();

    if (!teamId || !canInviteMembers || inviteLoading) {
      return;
    }

    const username = inviteUsername.trim();
    if (!username) {
      setInviteError(COPY.inviteRequired);
      return;
    }

    if (username.length < 2 || username.length > 64) {
      setInviteError(COPY.inviteLength);
      return;
    }

    if (/\s/.test(username)) {
      setInviteError(COPY.inviteWhitespace);
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const memberAlreadyExists = members.some(
      (member) => String(member?.username || '').trim().toLowerCase() === normalizedUsername,
    );
    if (memberAlreadyExists) {
      setInviteError(COPY.inviteDuplicate);
      return;
    }

    const requestedTeamId = teamId;
    setInviteLoading(true);
    setInviteError('');
    try {
      await userApi.inviteTeamMember(teamId, { username });
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      setErrorMessage('');
      setInviteOpen(false);
      setInviteUsername('');
      if (page !== 1) {
        setPage(1);
      } else {
        setRefreshNonce((current) => current + 1);
      }
      if (typeof onNotify === 'function') {
        onNotify(`${COPY.inviteSuccess}\uff1a${username}`, 'success');
      }
    } catch (error) {
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      const message = parseApiErrorMessage(error, COPY.inviteError);
      setInviteError(message);
    } finally {
      if (activeTeamIdRef.current === requestedTeamId) {
        setInviteLoading(false);
      }
    }
  }

  function beginRemoveMember(member) {
    const memberId = resolveMemberId(member);
    if (!canInviteMembers || memberId == null || isMainMember(member) || removeLoading) {
      return;
    }

    setRemovingMemberId(String(memberId));
    setRemoveError('');
  }

  function cancelRemoveMember() {
    if (removeLoading) {
      return;
    }

    setRemovingMemberId('');
    setRemoveError('');
  }

  async function handleRemoveMember() {
    if (!teamId || !removingMember || removeLoading) {
      return;
    }

    const memberId = resolveMemberId(removingMember);
    const memberName = toDisplayText(
      removingMember?.real_name ?? removingMember?.username,
      COPY.inviteAccount,
    );
    const requestedTeamId = teamId;

    setRemoveLoading(true);
    setRemoveError('');
    try {
      await userApi.removeTeamMember(teamId, memberId);
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      setMembers((currentMembers) =>
        currentMembers.filter(
          (member) => String(resolveMemberId(member)) !== String(memberId),
        ),
      );
      setTotal((currentTotal) => Math.max(0, (Number(currentTotal) || 0) - 1));
      setRemovingMemberId('');
      setRefreshNonce((current) => current + 1);
      if (typeof onNotify === 'function') {
        onNotify(`${COPY.removedPrefix} ${memberName} ${COPY.removedSuffix}`, 'success');
      }
    } catch (error) {
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      setRemoveError(parseApiErrorMessage(error, COPY.removeError));
    } finally {
      if (activeTeamIdRef.current === requestedTeamId) {
        setRemoveLoading(false);
      }
    }
  }

  function beginQuotaEdit(member) {
    const memberId = resolveMemberId(member);
    if (!canManagePointsQuota || memberId == null || isMainMember(member) || quotaSaving) {
      return;
    }

    const currentQuota = resolveMemberQuota(member);
    setEditingMemberId(String(memberId));
    setQuotaDraft(currentQuota == null ? '' : String(currentQuota));
    setQuotaUnlimited(currentQuota == null);
    setQuotaError('');
  }

  function cancelQuotaEdit() {
    if (quotaSaving) {
      return;
    }

    setEditingMemberId('');
    setQuotaDraft('');
    setQuotaUnlimited(false);
    setQuotaError('');
  }

  async function handleQuotaSubmit(event, member) {
    event.preventDefault();

    const memberId = resolveMemberId(member);
    if (!teamId || !canManagePointsQuota || memberId == null || isMainMember(member) || quotaSaving) {
      return;
    }

    let nextQuota = null;
    if (!quotaUnlimited) {
      const normalizedDraft = quotaDraft.trim();
      if (!/^\d+$/.test(normalizedDraft)) {
        setQuotaError('请输入大于或等于 0 的整数额度');
        return;
      }

      nextQuota = Number(normalizedDraft);
      if (!Number.isSafeInteger(nextQuota)) {
        setQuotaError('额度数值过大，请重新输入');
        return;
      }

      if (maxAssignablePoints == null) {
        setQuotaError('主账号可用积分尚未加载，请刷新后重试');
        return;
      }

      if (nextQuota > maxAssignablePoints) {
        setQuotaError(`额度不能超过主账号当前可用的 ${formatPointsValue(maxAssignablePoints)} 积分`);
        return;
      }
    }

    const requestedTeamId = teamId;
    setQuotaSaving(true);
    setQuotaError('');

    try {
      if (!quotaUnlimited && typeof onRefreshMainAvailablePoints === 'function') {
        const latestAvailablePoints = normalizePointsValue(await onRefreshMainAvailablePoints());
        if (activeTeamIdRef.current !== requestedTeamId) {
          return;
        }

        if (latestAvailablePoints == null) {
          setQuotaError('主账号可用积分刷新失败，请稍后重试');
          return;
        }

        const latestMaxAssignablePoints = Math.floor(latestAvailablePoints);
        if (nextQuota > latestMaxAssignablePoints) {
          setQuotaError(
            `余额已变化，额度不能超过主账号当前可用的 ${formatPointsValue(latestMaxAssignablePoints)} 积分`,
          );
          return;
        }
      }

      const updatedMember = await userApi.updateTeamMemberPointsQuota(teamId, memberId, nextQuota);
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      const usedPoints = normalizePointsValue(resolveMemberPointsUsed(member)) || 0;
      const optimisticAvailable = nextQuota == null ? null : Math.max(0, nextQuota - usedPoints);
      setMembers((currentMembers) =>
        currentMembers.map((currentMember) => {
          if (String(resolveMemberId(currentMember)) !== String(memberId)) {
            return currentMember;
          }

          return {
            ...currentMember,
            ...(updatedMember && typeof updatedMember === 'object' ? updatedMember : {}),
            points_quota: nextQuota,
            available_quota_points:
              updatedMember?.available_quota_points ??
              updatedMember?.availableQuotaPoints ??
              optimisticAvailable,
          };
        }),
      );
      setEditingMemberId('');
      setQuotaDraft('');
      setQuotaUnlimited(false);
      if (typeof onNotify === 'function') {
        const memberName = toDisplayText(member?.real_name ?? member?.username, '该子账号');
        onNotify(
          nextQuota == null
            ? `${memberName} 已设为不限额`
            : `${memberName} 的累计额度已设置为 ${formatPointsValue(nextQuota)} 积分`,
          'success',
        );
      }
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      if (activeTeamIdRef.current !== requestedTeamId) {
        return;
      }

      const message = parseApiErrorMessage(error, '积分额度设置失败，请稍后重试');
      setQuotaError(message);
      if (typeof onNotify === 'function') {
        onNotify(message, 'error');
      }
    } finally {
      if (activeTeamIdRef.current === requestedTeamId) {
        setQuotaSaving(false);
      }
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="team-member-heading">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h3 id="team-member-heading">团队成员</h3>
            <p>
              {canManagePointsQuota
                ? '管理成员邀请、活跃状态与子账号累计积分额度'
                : '查看成员角色、积分额度和活跃状态；额度仅主账号可修改'}
            </p>
          </div>
          {canInviteMembers && (
            <div className={styles.headerAction}>
              <button
                className={styles.inviteMemberButton}
                type="button"
                onClick={openInviteDialog}
                disabled={!teamId}
              >
                <span className={styles.inviteMemberIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M9.25 11.1a3.35 3.35 0 1 0 0-6.7 3.35 3.35 0 0 0 0 6.7Z" />
                    <path d="M3.75 18.8c.5-3.05 2.35-4.7 5.5-4.7s5 1.65 5.5 4.7" />
                    <path d="M18.25 9.5v5.5M15.5 12.25H21" />
                  </svg>
                </span>
                <span className={styles.inviteMemberLabel}>{COPY.inviteButton}</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>当前页成员</span>
            <strong className={styles.metricValue}>{members.length}</strong>
            <small className={styles.metricHint}>分页总数 {remoteTotal}</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>近 72 小时活跃</span>
            <strong className={styles.metricValue}>{summary.activeCount}</strong>
            <small className={styles.metricHint}>近 7 天活跃 {summary.recentCount}</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>管理员/负责人</span>
            <strong className={styles.metricValue}>{summary.ownerCount}</strong>
            <small className={styles.metricHint}>覆盖核心协作者</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>
              {canManagePointsQuota ? '主账号可用积分' : '受额度限制子账号'}
            </span>
            <strong className={styles.metricValue}>
              {canManagePointsQuota
                ? pointsWalletLoading
                  ? '加载中'
                  : formatPointsValue(maxAssignablePoints)
                : summary.pointsConfiguredCount}
            </strong>
            <small className={styles.metricHint}>
              本页限额 {summary.pointsConfiguredCount} · 不限额 {summary.unlimitedPointsCount}
            </small>
          </article>
        </div>

        <p className={styles.liveRegion} role="status" aria-live="polite">
          {loadingAnnouncement}
        </p>

        {!teamId && (
          <div className={styles.stateCard}>
            <h4>未选择团队</h4>
            <p>请先在顶部切换团队后，再进行成员管理。</p>
          </div>
        )}

        {teamId && errorMessage && (
          <div className={`${styles.stateCard} ${styles.stateError}`}>
            <h4>成员加载失败</h4>
            <p>{errorMessage}</p>
            <button className={styles.secondaryButton} type="button" onClick={handleRefreshMembers} disabled={loading}>
              {loading ? '重试中...' : '重试'}
            </button>
          </div>
        )}

        {teamId && !errorMessage && (
          <>
            <div className={styles.listMeta}>
              <strong>成员列表</strong>
              <span>
                第 {page} / {totalPages} 页，共 {remoteTotal} 条
              </span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">成员</th>
                    <th scope="col">角色</th>
                    <th scope="col">类型</th>
                    <th scope="col">累计积分额度</th>
                    <th scope="col">最近活跃</th>
                    <th className={styles.actionHeader} scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => {
                    const roleText = toDisplayText(member?.member_role, '未定义');
                    const typeText = toDisplayText(member?.user_type, '未定义');
                    const activity = resolveActivityStatus(member?.last_active_at);
                    const roleClassName = /owner|admin|负责人/.test(roleText.toLowerCase())
                      ? styles.roleOwner
                      : styles.roleMember;
                    const typeClassName = /internal|staff|core|owner|admin|内部|核心/.test(typeText.toLowerCase())
                      ? styles.typeCore
                      : /guest|external|partner|访客|外部/.test(typeText.toLowerCase())
                        ? styles.typeExternal
                        : styles.typeCommon;
                    const memberId = resolveMemberId(member);
                    const rowKey = memberId || `${toDisplayText(member?.username, 'user')}-${index}`;
                    const memberIsMain = isMainMember(member);
                    const quota = resolveMemberQuota(member);
                    const pointsUsed = resolveMemberPointsUsed(member);
                    const availableQuota = resolveMemberAvailableQuota(member);
                    const quotaUsagePercent = resolveQuotaUsagePercent(pointsUsed, quota);
                    const isEditingQuota = memberId != null && editingMemberId === String(memberId);

                    return (
                      <tr key={rowKey}>
                        <td data-label="成员">
                          <div className={styles.memberCell}>
                            <strong>{toDisplayText(member?.real_name)}</strong>
                            <span>@{toDisplayText(member?.username, 'unknown')}</span>
                          </div>
                        </td>
                        <td data-label="角色">
                          <span className={`${styles.badge} ${roleClassName}`}>{roleText}</span>
                        </td>
                        <td data-label="类型">
                          <span className={`${styles.badge} ${typeClassName}`}>{typeText}</span>
                        </td>
                        <td data-label="累计积分额度">
                          {memberIsMain ? (
                            <div className={styles.quotaCell}>
                              <div className={styles.quotaValueRow}>
                                <strong>
                                  {pointsWalletLoading
                                    ? '加载中...'
                                    : `${formatPointsValue(maxAssignablePoints)} 积分`}
                                </strong>
                                <span className={`${styles.quotaModeBadge} ${styles.quotaModeMain}`}>主账号</span>
                              </div>
                              <div className={styles.quotaStats}>
                                <span>全部积分</span>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.quotaCell}>
                              <div className={styles.quotaValueRow}>
                                <strong>{quota == null ? '不限额' : `${formatPointsValue(quota)} 积分`}</strong>
                                <span
                                  className={`${styles.quotaModeBadge} ${
                                    quota == null ? styles.quotaModeUnlimited : styles.quotaModeLimited
                                  }`}
                                >
                                  {quota == null ? '跟随余额' : '已限额'}
                                </span>
                              </div>
                              <div className={styles.quotaStats}>
                                <span>已用 {formatPointsValue(pointsUsed, '0')}</span>
                                <span>
                                  剩余 {quota == null ? '跟随主账号' : formatPointsValue(availableQuota, '0')}
                                </span>
                              </div>
                              {quotaUsagePercent != null && (
                                <div
                                  className={styles.quotaProgress}
                                  role="progressbar"
                                  aria-label={`${toDisplayText(member?.real_name ?? member?.username, '子账号')} 额度使用进度`}
                                  aria-valuemin="0"
                                  aria-valuemax="100"
                                  aria-valuenow={quotaUsagePercent}
                                >
                                  <span style={{ width: `${quotaUsagePercent}%` }} />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label="最近活跃">
                          <div className={styles.activityCell}>
                            <span>{toDisplayDateTime(member?.last_active_at)}</span>
                            <span className={`${styles.badge} ${styles[activity.tone]}`}>{activity.label}</span>
                          </div>
                        </td>
                        <td className={styles.actionCell} data-label="操作">
                          <div className={styles.actionCellInner}>
                            {memberIsMain || memberId == null || (!canManagePointsQuota && !canInviteMembers) ? (
                              <span className={styles.actionPlaceholder}>—</span>
                            ) : (
                              <>
                                {canManagePointsQuota && (
                                  <button
                                    className={`${styles.quotaEditButton} ${isEditingQuota ? styles.quotaEditButtonActive : ''}`}
                                    type="button"
                                    onClick={() => beginQuotaEdit(member)}
                                    disabled={quotaSaving || removeLoading || pointsWalletLoading || maxAssignablePoints == null}
                                    aria-label={`设置 ${toDisplayText(member?.real_name ?? member?.username, '子账号')} 的累计积分额度`}
                                  >
                                    {isEditingQuota ? '正在设置' : '设置额度'}
                                  </button>
                                )}
                                {canInviteMembers && (
                                  <button
                                    className={styles.removeMemberButton}
                                    type="button"
                                    onClick={() => beginRemoveMember(member)}
                                    disabled={quotaSaving || removeLoading}
                                    aria-label={`${COPY.remove} ${toDisplayText(member?.real_name ?? member?.username, COPY.inviteAccount)}`}
                                  >
                                    {COPY.remove}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && members.length === 0 && (
                    <tr className={styles.emptyRow}>
                      <td colSpan={6}>当前团队暂无成员数据。</td>
                    </tr>
                  )}

                  {loading && (
                    <tr className={styles.emptyRow}>
                      <td colSpan={6}>正在同步成员数据，请稍候...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalItems={remoteTotal}
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize || DEFAULT_PAGE_SIZE);
                setPage(1);
              }}
              disabled={loading}
              summaryText={`\u5171 ${remoteTotal} \u6761`}
              pageSizeAriaLabel="\u6bcf\u9875\u6210\u5458\u6570\u91cf"
            />
          </>
        )}
      </section>

      {inviteOpen && (
        <div
          className={styles.memberDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeInviteDialog();
            }
          }}
        >
          <section
            className={styles.memberDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-member-dialog-title"
            aria-describedby="invite-member-dialog-description"
          >
            <div className={styles.memberDialogHeader}>
              <div className={styles.memberDialogHeading}>
                <span className={styles.inviteDialogIcon} aria-hidden="true">+</span>
                <div>
                  <span className={styles.memberDialogEyebrow}>{COPY.inviteButton}</span>
                  <h4 id="invite-member-dialog-title">{COPY.inviteTitle}</h4>
                  <p id="invite-member-dialog-description">{COPY.inviteDescription}</p>
                </div>
              </div>
              <button
                className={styles.memberDialogClose}
                type="button"
                onClick={closeInviteDialog}
                disabled={inviteLoading}
                aria-label={COPY.inviteClose}
              >
                &times;
              </button>
            </div>

            <form className={styles.inviteDialogForm} onSubmit={handleInviteMember}>
              <div className={styles.inviteField}>
                <label htmlFor="invite-sub-account-input">{COPY.inviteAccount}</label>
                <div className={styles.inviteDialogInputWrap}>
                  <span aria-hidden="true">@</span>
                  <input
                    id="invite-sub-account-input"
                    type="text"
                    value={inviteUsername}
                    onChange={(event) => {
                      setInviteUsername(event.target.value);
                      setInviteError('');
                    }}
                    placeholder={COPY.invitePlaceholder}
                    autoComplete="off"
                    autoFocus
                    disabled={inviteLoading}
                    aria-invalid={Boolean(inviteError)}
                    aria-describedby={inviteError ? 'invite-account-error' : 'invite-account-help'}
                  />
                </div>
                {inviteError ? (
                  <small id="invite-account-error" className={styles.memberDialogError} role="alert">
                    {inviteError}
                  </small>
                ) : (
                  <small id="invite-account-help" className={styles.inviteFieldHelp}>
                    {COPY.inviteLength}
                  </small>
                )}
              </div>

              <div className={styles.invitePermissions} aria-label={COPY.permissions}>
                <div>
                  <span className={styles.permissionIcon} aria-hidden="true">01</span>
                  <p>
                    <strong>{COPY.workspaceAccess}</strong>
                    <small>{COPY.accessibleAfterJoin}</small>
                  </p>
                </div>
                <div>
                  <span className={styles.permissionIcon} aria-hidden="true">02</span>
                  <p>
                    <strong>{COPY.pointsQuota}</strong>
                    <small>{COPY.configurableAfterJoin}</small>
                  </p>
                </div>
              </div>

              <div className={styles.memberDialogActions}>
                <button
                  className={styles.quotaCancelButton}
                  type="button"
                  onClick={closeInviteDialog}
                  disabled={inviteLoading}
                >
                  {COPY.cancel}
                </button>
                <button
                  className={styles.quotaSaveButton}
                  type="submit"
                  disabled={inviteLoading || !inviteUsername.trim()}
                >
                  {inviteLoading ? COPY.inviteLoading : COPY.inviteSubmit}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {removingMember && (
        <div
          className={styles.memberDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelRemoveMember();
            }
          }}
        >
          <section
            className={`${styles.memberDialog} ${styles.removeDialog}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-member-dialog-title"
            aria-describedby="remove-member-dialog-description"
          >
            <div className={styles.memberDialogHeader}>
              <div className={styles.memberDialogHeading}>
                <span className={styles.removeDialogIcon} aria-hidden="true">!</span>
                <div>
                  <span className={styles.removeDialogEyebrow}>
                    {COPY.remove}
                  </span>
                  <h4 id="remove-member-dialog-title">{COPY.removeTitle}</h4>
                </div>
              </div>
              <button
                className={styles.memberDialogClose}
                type="button"
                onClick={cancelRemoveMember}
                disabled={removeLoading}
                aria-label={COPY.removeClose}
              >
                &times;
              </button>
            </div>

            <div className={styles.removeMemberIdentity}>
              <span aria-hidden="true">{removingMemberName.charAt(0).toUpperCase()}</span>
              <p>
                <strong>{removingMemberName}</strong>
                <small>@{toDisplayText(removingMember?.username, 'unknown')}</small>
              </p>
            </div>

            <p id="remove-member-dialog-description" className={styles.removeDialogDescription}>
              {COPY.removeDescription}
            </p>

            {removeError && (
              <small className={styles.memberDialogError} role="alert">
                {removeError}
              </small>
            )}

            <div className={styles.removeDialogNotice}>
              <span aria-hidden="true">!</span>
              <small>{COPY.irreversible}</small>
            </div>

            <div className={styles.memberDialogActions}>
              <button
                className={styles.quotaCancelButton}
                type="button"
                onClick={cancelRemoveMember}
                disabled={removeLoading}
                autoFocus
              >
                {COPY.cancel}
              </button>
              <button
                className={styles.removeConfirmButton}
                type="button"
                onClick={handleRemoveMember}
                disabled={removeLoading}
              >
                {removeLoading
                  ? COPY.removeLoading
                  : COPY.removeConfirm}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingMember && (
        <div
          className={styles.quotaDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelQuotaEdit();
            }
          }}
        >
          <section
            className={styles.quotaDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-dialog-title"
          >
            <div className={styles.quotaDialogHeader}>
              <div className={styles.quotaDialogIdentity}>
                <span className={styles.quotaDialogAvatar} aria-hidden="true">P</span>
                <div>
                  <span className={styles.quotaDialogEyebrow}>子账号额度</span>
                  <h4 id="quota-dialog-title">设置积分使用上限</h4>
                  <p>
                    {toDisplayText(editingMember?.real_name, '子账号')} · @
                    {toDisplayText(editingMember?.username, 'unknown')}
                  </p>
                </div>
              </div>
              <button
                className={styles.quotaDialogClose}
                type="button"
                onClick={cancelQuotaEdit}
                disabled={quotaSaving}
                aria-label="关闭额度设置"
              >
                ×
              </button>
            </div>

            <div className={styles.quotaDialogSummary}>
              <div className={styles.quotaDialogUsage}>
                <div className={styles.quotaDialogUsageHeader}>
                  <span>当前使用情况</span>
                  <strong>
                    {formatPointsValue(editingMemberPointsUsed, '0')}
                    <small>
                      {' '}/ {editingMemberQuota == null ? '不限额' : formatPointsValue(editingMemberQuota)}
                    </small>
                  </strong>
                </div>
                <div className={styles.quotaDialogProgress} aria-hidden="true">
                  <span style={{ width: `${editingMemberUsagePercent || 0}%` }} />
                </div>
                <small>
                  {editingMemberQuota == null
                    ? '当前跟随主账号可用余额'
                    : `剩余额度 ${formatPointsValue(editingMemberAvailableQuota, '0')} 积分`}
                </small>
              </div>
              <div className={styles.quotaDialogBalance}>
                <span>主账号可用</span>
                <strong>{formatPointsValue(maxAssignablePoints)}</strong>
                <small>本次可设置的最高额度</small>
              </div>
            </div>

            <form className={styles.quotaEditForm} onSubmit={(event) => handleQuotaSubmit(event, editingMember)}>
              <div className={styles.quotaModeField}>
                <span className={styles.quotaInputLabel}>额度模式</span>
                <div className={styles.quotaModeSelector} role="radiogroup" aria-label="额度模式">
                  <button
                    className={!quotaUnlimited ? styles.quotaModeOptionActive : ''}
                    type="button"
                    role="radio"
                    aria-checked={!quotaUnlimited}
                    onClick={() => {
                      setQuotaUnlimited(false);
                      setQuotaError('');
                    }}
                    disabled={quotaSaving}
                  >
                    <strong>指定额度</strong>
                    <small>设置累计使用上限</small>
                  </button>
                  <button
                    className={quotaUnlimited ? styles.quotaModeOptionActive : ''}
                    type="button"
                    role="radio"
                    aria-checked={quotaUnlimited}
                    autoFocus={quotaUnlimited}
                    onClick={() => {
                      setQuotaUnlimited(true);
                      setQuotaError('');
                    }}
                    disabled={quotaSaving}
                  >
                    <strong>不限额度</strong>
                    <small>跟随主账号余额</small>
                  </button>
                </div>
              </div>

              {!quotaUnlimited ? (
                <div className={styles.quotaNumberField}>
                  <div className={styles.quotaNumberLabelRow}>
                    <label className={styles.quotaInputLabel} htmlFor="points-quota-input">
                      累计积分额度
                    </label>
                    <span>最高 {formatPointsValue(maxAssignablePoints)}</span>
                  </div>
                  <div className={styles.quotaInputRow}>
                    <input
                      id="points-quota-input"
                      type="number"
                      min="0"
                      max={maxAssignablePoints ?? undefined}
                      step="1"
                      inputMode="numeric"
                      value={quotaDraft}
                      onChange={(event) => {
                        setQuotaDraft(event.target.value);
                        setQuotaError('');
                      }}
                      disabled={quotaSaving}
                      aria-invalid={Boolean(quotaError)}
                      aria-describedby="points-quota-help"
                      autoFocus
                    />
                    <span>积分</span>
                  </div>
                  <small id="points-quota-help" className={styles.quotaHelp}>
                    额度为累计上限，已使用积分不会因修改额度而清零
                  </small>
                </div>
              ) : (
                <div className={styles.quotaUnlimitedNotice}>
                  <span aria-hidden="true">∞</span>
                  <p>
                    <strong>子账号不设独立上限</strong>
                    <small>实际消费仍不会超过主账号当前可用积分</small>
                  </p>
                </div>
              )}

              {quotaError && (
                <small className={styles.quotaError} role="alert">
                  {quotaError}
                </small>
              )}
              <div className={styles.quotaEditActions}>
                <button
                  className={styles.quotaCancelButton}
                  type="button"
                  onClick={cancelQuotaEdit}
                  disabled={quotaSaving}
                >
                  取消
                </button>
                <button
                  className={styles.quotaSaveButton}
                  type="submit"
                  disabled={quotaSaving || (!quotaUnlimited && !quotaDraft.trim())}
                >
                  {quotaSaving ? '保存中...' : '保存设置'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
