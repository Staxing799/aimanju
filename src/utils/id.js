let counter = 0;

// 生成本地唯一 ID：时间戳 + 递增序号，足够覆盖当前前端会话场景。
export function createId(prefix = 'id') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
