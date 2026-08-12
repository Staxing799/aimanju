import { IMAGE_MODELS, STORYBOARD_MODELS, VIDEO_MODELS } from '../../constants/models';
import { buildStoryboards, createDefaultCast } from '../../utils/studioGenerators';
import { createId } from '../../utils/id';
import AppSelect from '../common/AppSelect';
import StoryboardCard from './StoryboardCard';
import styles from './StoryboardWorkspace.module.less';

function StoryboardWorkspace({ project, onUpdateProject }) {
  function updateModel(key, value) {
    onUpdateProject((current) => ({
      ...current,
      modelConfig: {
        ...current.modelConfig,
        [key]: value,
      },
    }));
  }

  function updateStoryboard(episodeId, storyboardId, updater) {
    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => {
        if (episode.id !== episodeId) {
          return episode;
        }

        return {
          ...episode,
          storyboards: episode.storyboards.map((storyboard) =>
            storyboard.id === storyboardId ? updater(storyboard) : storyboard,
          ),
        };
      }),
    }));
  }

  function removeStoryboard(episodeId, storyboardId) {
    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) =>
        episode.id === episodeId
          ? {
              ...episode,
              storyboards: episode.storyboards.filter((storyboard) => storyboard.id !== storyboardId),
            }
          : episode,
      ),
    }));
  }

  function addStoryboard(episodeId) {
    onUpdateProject((current) => ({
      ...current,
      episodes: current.episodes.map((episode) => {
        if (episode.id !== episodeId) {
          return episode;
        }

        return {
          ...episode,
          storyboards: [
            ...episode.storyboards,
            {
              id: createId('sb'),
              title: `分镜 ${episode.storyboards.length + 1}`,
              description: '',
              sceneId: current.scenes[0]?.id || '',
              cast: createDefaultCast(current.characters),
              shotPrompt: '',
              imagePrompt: '',
              firstImage: null,
              videoPrompt: '',
              video: null,
            },
          ],
        };
      }),
    }));
  }

  function generateStoryboards() {
    if (!project.modelConfig.storyboardModel) {
      window.alert('请先选择 AI 分镜模型');
      return;
    }

    if (project.episodes.length === 0) {
      window.alert('请先完成剧本解析，生成分集信息。');
      return;
    }

    onUpdateProject((current) => ({
      ...current,
      episodes: buildStoryboards(current, current.storyboardPrompt),
    }));
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3>3. 分镜生产工作区</h3>
        <p>先选择模型再生成分镜，每个分镜都可以继续补充场景、角色、首图、视频和提示词。</p>
      </div>

      <div className={styles.selectorGrid}>
        <label>
          分镜拆解模型
          <AppSelect
            value={project.modelConfig.storyboardModel}
            onChange={(value) => updateModel('storyboardModel', value)}
            options={STORYBOARD_MODELS.map((model) => ({
              value: model.id,
              label: `${model.name} | ${model.speed} | 算力${model.cost}`,
            }))}
          />
        </label>

        <label>
          分镜图片模型
          <AppSelect
            value={project.modelConfig.imageModel}
            onChange={(value) => updateModel('imageModel', value)}
            options={IMAGE_MODELS.map((model) => ({
              value: model.id,
              label: `${model.name} | ${model.speed} | 算力${model.cost}`,
            }))}
          />
        </label>

        <label>
          视频生成模型
          <AppSelect
            value={project.modelConfig.videoModel}
            onChange={(value) => updateModel('videoModel', value)}
            options={VIDEO_MODELS.map((model) => ({
              value: model.id,
              label: `${model.name} | ${model.speed} | 算力${model.cost}`,
            }))}
          />
        </label>
      </div>

      <div className={styles.actionRow}>
        <label className={styles.grow}>
          分镜生成提示词
          <input
            value={project.storyboardPrompt}
            onChange={(event) =>
              onUpdateProject((current) => ({ ...current, storyboardPrompt: event.target.value }))
            }
            placeholder="例如：节奏明快，多用近景和情绪特写"
          />
        </label>
        <button className={styles.primaryButton} type="button" onClick={generateStoryboards}>
          生成分镜
        </button>
      </div>

      <div className={styles.episodeList}>
        {project.episodes.map((episode) => (
          <section key={episode.id} className={styles.episodeSection}>
            <div className={styles.sectionHeader}>
              <h4>
                {episode.title}（{episode.storyboards.length} 个分镜）
              </h4>
              <button type="button" onClick={() => addStoryboard(episode.id)}>
                新增分镜
              </button>
            </div>

            <p className={styles.muted}>{episode.summary || '暂无分集摘要。'}</p>

            {episode.storyboards.length === 0 && (
              <p className={styles.muted}>当前分集还没有分镜，点击上方“生成分镜”或手动新增即可。</p>
            )}

            {episode.storyboards.map((storyboard) => (
              <StoryboardCard
                key={storyboard.id}
                storyboard={storyboard}
                scenes={project.scenes}
                characters={project.characters}
                imageModel={project.modelConfig.imageModel}
                videoModel={project.modelConfig.videoModel}
                onChange={(updater) => updateStoryboard(episode.id, storyboard.id, updater)}
                onDelete={() => removeStoryboard(episode.id, storyboard.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

export default StoryboardWorkspace;
