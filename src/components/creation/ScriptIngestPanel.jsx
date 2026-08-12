import { SCRIPT_MODELS } from '../../constants/models';
import { readTextFileWithEncodingFallback } from '../../utils/textEncoding';
import styles from './ScriptIngestPanel.module.less';

// 脚本导入面板：上传文本、编辑提示词并触发解析。
function ScriptIngestPanel({ project, onUpdateProject, onParseScript }) {
  // 读取本地文件并写入项目脚本文本。
  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    let nextText = project.scriptText;
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      nextText = await readTextFileWithEncodingFallback(file);
    }

    onUpdateProject((current) => ({
      ...current,
      scriptFileName: file.name,
      scriptText: nextText,
    }));
  }

  // 切换脚本模型，供后续解析使用。
  function updateModel(modelId) {
    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        scriptModel: modelId,
      },
    }));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3>1. 上传并解析剧本</h3>
        <p>支持上传 .txt/.docx/.pdf，解析时将并行生成分集、角色、场景。</p>
      </div>

      <div className={styles.uploadRow}>
        <label className={styles.filePicker}>
          上传剧本
          <input type="file" accept=".txt,.docx,.pdf" onChange={handleFileUpload} />
        </label>
        <span className={styles.fileLabel}>已选文件：{project.scriptFileName || '未上传'}</span>
      </div>

      <label>
        剧本文本
        <textarea
          value={project.scriptText}
          onChange={(event) =>
            onUpdateProject((current) => ({ ...current, scriptText: event.target.value }))
          }
          rows={8}
          placeholder="可直接粘贴剧本内容，解析后支持继续编辑。"
        />
      </label>

      <label>
        解析提示词
        <input
          value={project.parsePrompt}
          onChange={(event) =>
            onUpdateProject((current) => ({ ...current, parsePrompt: event.target.value }))
          }
          placeholder="例如：强化古风场景，角色关系复杂化"
        />
      </label>

      <div className={styles.modelGrid}>
        {SCRIPT_MODELS.map((model) => (
          <button
            key={model.id}
            type="button"
            className={`${styles.modelCard} ${project.modelConfig.scriptModel === model.id ? styles.selected : ''}`}
            onClick={() => updateModel(model.id)}
          >
            <strong>{model.name}</strong>
            <small>速度：{model.speed}</small>
            <small>算力：{model.cost}</small>
            <p>{model.description}</p>
          </button>
        ))}
      </div>

      <div className={styles.actionRow}>
        <button className={styles.primaryButton} type="button" onClick={onParseScript}>
          解析剧本并并行生成分集/角色/场景
        </button>
        <span className={styles.statusTag}>
          状态：{project.parseStatus === 'parsing' ? '解析中...' : '待解析/已完成'}
        </span>
      </div>
    </section>
  );
}

export default ScriptIngestPanel;
