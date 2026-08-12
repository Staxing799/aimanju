import { VOICE_PRESETS } from '../../constants/models';
import { createId } from '../../utils/id';
import AppSelect from '../common/AppSelect';
import styles from './StoryboardCard.module.less';

// 单个分镜编辑卡片：维护描述、台词、首图和视频信息。
function StoryboardCard({
  storyboard,
  scenes,
  characters,
  imageModel,
  videoModel,
  onChange,
  onDelete,
}) {
  function updateField(field, value) {
    onChange((current) => ({ ...current, [field]: value }));
  }

  function updateCast(castId, updater) {
    onChange((current) => ({
      ...current,
      cast: current.cast.map((cast) => (cast.id === castId ? updater(cast) : cast)),
    }));
  }

  function addCast() {
    const defaultCharacter = characters[0];
    onChange((current) => ({
      ...current,
      cast: [
        ...current.cast,
        {
          id: createId('cast'),
          characterId: defaultCharacter?.id || '',
          line: '',
          voice: defaultCharacter?.defaultVoice || VOICE_PRESETS[0],
          voicePrompt: '',
          audio: null,
        },
      ],
    }));
  }

  function removeCast(castId) {
    onChange((current) => ({
      ...current,
      cast: current.cast.filter((cast) => cast.id !== castId),
    }));
  }

  function generateVoice(castId) {
    updateCast(castId, (cast) => {
      if (!cast.line.trim()) {
        window.alert('请先填写该人物台词文本');
        return cast;
      }

      return {
        ...cast,
        audio: {
          name: `${cast.characterId || '角色'}-voice.wav`,
          at: new Date().toLocaleString(),
        },
      };
    });
  }

  function uploadFirstImage(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onChange((current) => ({
      ...current,
      firstImage: {
        source: 'upload',
        name: file.name,
        at: new Date().toLocaleString(),
      },
    }));
  }

  function generateFirstImage() {
    if (!imageModel) {
      window.alert('请先选择AI生成模型');
      return;
    }

    onChange((current) => ({
      ...current,
      firstImage: {
        source: 'generate',
        name: `${current.title}-首图.png`,
        at: new Date().toLocaleString(),
        prompt: current.imagePrompt,
      },
    }));
  }

  function generateVideo(mode) {
    if (!videoModel) {
      window.alert('请先选择AI生成模型');
      return;
    }
    if (!storyboard.firstImage) {
      window.alert('请先生成或上传首图，再生成视频');
      return;
    }

    onChange((current) => ({
      ...current,
      video: {
        name: `${current.title}-video.mp4`,
        mode,
        model: videoModel,
        at: new Date().toLocaleString(),
        prompt: current.videoPrompt,
      },
    }));
  }

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <input
          className={styles.titleInput}
          value={storyboard.title}
          onChange={(event) => updateField('title', event.target.value)}
        />
        <button type="button" onClick={onDelete}>
          删除分镜
        </button>
      </div>

      <label>
        分镜描述
        <textarea
          rows={3}
          value={storyboard.description}
          onChange={(event) => updateField('description', event.target.value)}
          placeholder="描述镜头运动、景别和氛围。"
        />
      </label>

      <div className={styles.twoColumnGrid}>
        <label>
          场景素材
          <AppSelect
            value={storyboard.sceneId}
            onChange={(value) => updateField('sceneId', value)}
            options={[
              { value: '', label: '请选择场景' },
              ...scenes.map((scene) => ({
                value: scene.id,
                label: scene.name,
              })),
            ]}
          />
        </label>

        <label>
          分镜生成提示词
          <input
            value={storyboard.shotPrompt}
            onChange={(event) => updateField('shotPrompt', event.target.value)}
            placeholder="例如：快节奏切镜，突出口型特写"
          />
        </label>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <h5>出场人物与台词</h5>
          <button type="button" onClick={addCast}>
            新增人物
          </button>
        </div>

        {storyboard.cast.map((cast) => (
          <div className={styles.castRow} key={cast.id}>
            <AppSelect
              value={cast.characterId}
              onChange={(value) =>
                updateCast(cast.id, (current) => ({ ...current, characterId: value }))
              }
              options={[
                { value: '', label: '选择角色' },
                ...characters.map((character) => ({
                  value: character.id,
                  label: character.name,
                })),
              ]}
            />

            <textarea
              rows={2}
              value={cast.line}
              onChange={(event) => updateCast(cast.id, (current) => ({ ...current, line: event.target.value }))}
              placeholder="人物台词"
            />

            <div className={styles.castLineControls}>
              <AppSelect
                value={cast.voice}
                onChange={(value) => updateCast(cast.id, (current) => ({ ...current, voice: value }))}
                options={VOICE_PRESETS.map((voice) => ({
                  value: voice,
                  label: voice,
                }))}
              />

              <input
                value={cast.voicePrompt || ''}
                onChange={(event) =>
                  updateCast(cast.id, (current) => ({ ...current, voicePrompt: event.target.value }))
                }
                placeholder="声音提示词"
              />
            </div>

            <div className={styles.castActions}>
              <button type="button" onClick={() => generateVoice(cast.id)}>
                生成声音
              </button>

              <button type="button" onClick={() => removeCast(cast.id)}>
                删除人物
              </button>
            </div>

            <small className={styles.muted}>
              {cast.audio ? `音频已生成：${cast.audio.name}` : '未生成音频'}
            </small>
          </div>
        ))}
      </div>

      <div className={styles.block}>
        <h5 className={styles.blockTitle}>首图生成（必选）</h5>
        <p className={styles.muted}>只有首图存在时，才允许生成视频。</p>

        <label>
          首图提示词
          <input
            value={storyboard.imagePrompt}
            onChange={(event) => updateField('imagePrompt', event.target.value)}
            placeholder="例如：半身构图，雨夜蓝调光"
          />
        </label>

        <div className={styles.actionRow}>
          <button type="button" onClick={generateFirstImage}>
            生成首图
          </button>
          <label className={styles.filePicker}>
            上传首图
            <input type="file" accept="image/*" onChange={uploadFirstImage} />
          </label>
          <span className={styles.muted}>
            {storyboard.firstImage ? `首图已就绪：${storyboard.firstImage.name}` : '首图未生成/上传'}
          </span>
        </div>
      </div>

      <div className={styles.block}>
        <h5 className={styles.blockTitle}>视频生成</h5>
        <label>
          视频提示词
          <input
            value={storyboard.videoPrompt}
            onChange={(event) => updateField('videoPrompt', event.target.value)}
            placeholder="例如：推进镜头 + 轻微运镜 + 风吹衣摆"
          />
        </label>

        <div className={styles.actionRow}>
          <button type="button" onClick={() => generateVideo('generate')}>
            生成视频
          </button>
          <button type="button" onClick={() => generateVideo('replace')}>
            替换视频
          </button>
          <button type="button" onClick={() => generateVideo('regenerate')}>
            重新生成
          </button>
          <span className={styles.muted}>{storyboard.video ? `视频已生成：${storyboard.video.name}` : '暂无视频'}</span>
        </div>
      </div>
    </article>
  );
}

export default StoryboardCard;
