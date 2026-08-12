import { useState } from 'react';
import { PROJECT_TEMPLATES } from '../../constants/models';
import AppSelect from '../common/AppSelect';
import styles from './ProjectSetupPanel.module.less';

// 项目入口面板：创建项目并切换当前项目。
function ProjectSetupPanel({ projects, activeProjectId, activeProject, onSwitchProject, onCreateProject }) {
  const [form, setForm] = useState({
    name: '',
    seriesName: '',
    genre: '悬疑',
    targetPlatform: '抖音',
    episodeCount: 12,
    dueDate: '',
    template: PROJECT_TEMPLATES[0],
  });

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCreateProject(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      window.alert('请先填写项目名称');
      return;
    }
    onCreateProject(form);
    setForm((prev) => ({ ...prev, name: '', seriesName: '' }));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3>项目入口</h3>
        <p>创建或切换短剧项目，后续流程全部围绕当前项目执行。</p>
      </div>

      <div className={styles.inlineGrid}>
        <label>
          当前项目
          <AppSelect
            value={activeProjectId || ''}
            onChange={onSwitchProject}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
        </label>

        <div className={styles.projectMeta}>
          <span>题材：{activeProject?.genre || '-'}</span>
          <span>目标平台：{activeProject?.targetPlatform || '-'}</span>
          <span>预计集数：{activeProject?.episodeCount || '-'}</span>
        </div>
      </div>

      <form className={styles.formGrid} onSubmit={handleCreateProject}>
        <label>
          项目名称
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="例如：都市追凶录"
          />
        </label>

        <label>
          系列名称
          <input
            value={form.seriesName}
            onChange={(event) => updateField('seriesName', event.target.value)}
            placeholder="例如：第一季"
          />
        </label>

        <label>
          题材
          <input value={form.genre} onChange={(event) => updateField('genre', event.target.value)} />
        </label>

        <label>
          目标平台
          <input
            value={form.targetPlatform}
            onChange={(event) => updateField('targetPlatform', event.target.value)}
          />
        </label>

        <label>
          项目模板
          <AppSelect
            value={form.template}
            onChange={(value) => updateField('template', value)}
            options={PROJECT_TEMPLATES.map((template) => ({
              value: template,
              label: template,
            }))}
          />
        </label>

        <label>
          预计完成时间
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => updateField('dueDate', event.target.value)}
          />
        </label>

        <button className={styles.primaryButton} type="submit">
          新建短剧项目
        </button>
      </form>
    </section>
  );
}

export default ProjectSetupPanel;
