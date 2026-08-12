export const FREE_CANVAS_RENAME_STORAGE_KEY =
  'ai-animedrama:free-canvas-renames:v1';
const LEGACY_UNTITLED_PROJECT_NAMES = new Set([
  '未命名',
  '自由画布项目',
]);

export function normalizeFreeCanvasProjectName(projectName) {
  const normalizedProjectName = String(projectName || '').trim();
  return LEGACY_UNTITLED_PROJECT_NAMES.has(normalizedProjectName)
    ? ''
    : normalizedProjectName;
}

export function createFreeCanvasUntitledName(dateValue = '') {
  const parsedDate = dateValue ? new Date(dateValue) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `未命名-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function loadFreeCanvasRenameMap() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(FREE_CANVAS_RENAME_STORAGE_KEY) || '{}',
    );
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function saveFreeCanvasRenameMap(renameMap) {
  try {
    localStorage.setItem(
      FREE_CANVAS_RENAME_STORAGE_KEY,
      JSON.stringify(renameMap || {}),
    );
  } catch {
    // Local rename persistence is best-effort.
  }
}

export function saveFreeCanvasProjectName(projectId, projectName) {
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedProjectName = String(projectName || '').trim();
  if (!normalizedProjectId || !normalizedProjectName) {
    return;
  }
  saveFreeCanvasRenameMap({
    ...loadFreeCanvasRenameMap(),
    [normalizedProjectId]: normalizedProjectName,
  });
}
