import { createId } from '../../utils/id';
import styles from './EntityEditorPanel.module.less';

// 实体编辑面板：维护分集、角色、场景三类结构化数据。
function EntityEditorPanel({ project, onUpdateProject }) {
  // 统一封装三类实体的写回逻辑，减少重复 setState。
  function updateEpisodes(nextEpisodes) {
    onUpdateProject((current) => ({ ...current, episodes: nextEpisodes }));
  }

  function updateCharacters(nextCharacters) {
    onUpdateProject((current) => ({ ...current, characters: nextCharacters }));
  }

  function updateScenes(nextScenes) {
    onUpdateProject((current) => ({ ...current, scenes: nextScenes }));
  }

  // 追加一个空分集，方便人工补录。
  function addEpisode() {
    const next = [
      ...project.episodes,
      {
        id: createId('ep'),
        title: `第${project.episodes.length + 1}集 新分集`,
        summary: '',
        storyboards: [],
      },
    ];
    updateEpisodes(next);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3>2. 编辑分集、角色与场景</h3>
        <p>解析完成后可手动增删改，后续分镜会读取这里的最新数据。</p>
      </div>

      <div className={styles.columns}>
        <div className={styles.editorColumn}>
          <div className={styles.columnHeader}>
            <h4>分集</h4>
            <button type="button" onClick={addEpisode}>
              新增分集
            </button>
          </div>
          {project.episodes.length === 0 && <p className={styles.empty}>暂无分集，请先解析剧本。</p>}
          {project.episodes.map((episode, index) => (
            <div className={styles.editorItem} key={episode.id}>
              <input
                value={episode.title}
                onChange={(event) =>
                  updateEpisodes(
                    project.episodes.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                rows={3}
                value={episode.summary}
                onChange={(event) =>
                  updateEpisodes(
                    project.episodes.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, summary: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  updateEpisodes(project.episodes.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.columnHeader}>
            <h4>角色</h4>
            <button
              type="button"
              onClick={() =>
                updateCharacters([
                  ...project.characters,
                  { id: createId('char'), name: '新角色', bio: '', defaultVoice: '温柔女声' },
                ])
              }
            >
              新增角色
            </button>
          </div>
          {project.characters.length === 0 && <p className={styles.empty}>暂无角色。</p>}
          {project.characters.map((character, index) => (
            <div className={styles.editorItem} key={character.id}>
              <input
                value={character.name}
                onChange={(event) =>
                  updateCharacters(
                    project.characters.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                rows={3}
                value={character.bio}
                onChange={(event) =>
                  updateCharacters(
                    project.characters.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, bio: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  updateCharacters(project.characters.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.columnHeader}>
            <h4>场景</h4>
            <button
              type="button"
              onClick={() =>
                updateScenes([...project.scenes, { id: createId('scene'), name: '新场景', description: '' }])
              }
            >
              新增场景
            </button>
          </div>
          {project.scenes.length === 0 && <p className={styles.empty}>暂无场景。</p>}
          {project.scenes.map((scene, index) => (
            <div className={styles.editorItem} key={scene.id}>
              <input
                value={scene.name}
                onChange={(event) =>
                  updateScenes(
                    project.scenes.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                rows={3}
                value={scene.description}
                onChange={(event) =>
                  updateScenes(
                    project.scenes.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() => updateScenes(project.scenes.filter((_, itemIndex) => itemIndex !== index))}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default EntityEditorPanel;
