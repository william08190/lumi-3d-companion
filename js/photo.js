// photo.js — 照片生成 3D 形象：Avaturn / Ready Player Me 内嵌创建器
// 两家服务均通过 iframe + postMessage 回传生成的 GLB 模型地址

export class PhotoAvatarCreator {
  constructor(onModelReady) {
    this.onModelReady = onModelReady; // (url, sourceName) => void
    this.overlay = null;
    this.iframe = null;
    this.active = null; // 'avaturn' | 'rpm'
    window.addEventListener('message', (e) => this._onMessage(e));
  }

  openAvaturn() {
    this.active = 'avaturn';
    this._open('https://demo.avaturn.dev', 'Avaturn · 上传照片生成形象');
  }

  openRPM() {
    this.active = 'rpm';
    this._open('https://demo.readyplayer.me/avatar?frameApi&clearCache', 'Ready Player Me · 拍照生成形象');
  }

  _open(src, title) {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';
    overlay.innerHTML = `
      <div class="photo-overlay__box">
        <div class="photo-overlay__bar">
          <span>${title}</span>
          <button class="photo-overlay__close" title="关闭">✕</button>
        </div>
        <iframe allow="camera *; microphone *; clipboard-write" src="${src}"></iframe>
        <p class="photo-overlay__tip">生成完成点击服务内的「下一步 / Next」按钮，形象会自动载入</p>
      </div>`;
    overlay.querySelector('.photo-overlay__close').addEventListener('click', () => this.close());
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) this.close(); });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.iframe = overlay.querySelector('iframe');
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.iframe = null;
      this.active = null;
    }
  }

  _onMessage(event) {
    let json;
    try {
      json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (!json || typeof json !== 'object') return;

    // ---- Avaturn 协议 ----
    if (json.source === 'avaturn' && json.eventName === 'v2.avatar.exported') {
      const url = json.data?.url;
      if (url) {
        this.close();
        this.onModelReady(url, 'avaturn');
      }
      return;
    }

    // ---- Ready Player Me 协议 ----
    if (json.source === 'readyplayerme') {
      if (json.eventName === 'v1.frame.ready' && this.iframe) {
        this.iframe.contentWindow.postMessage(
          JSON.stringify({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.**' }), '*'
        );
      } else if (json.eventName === 'v1.avatar.exported') {
        const url = json.data?.url;
        if (url) {
          this.close();
          const sep = url.includes('?') ? '&' : '?';
          this.onModelReady(`${url}${sep}morphTargets=ARKit&textureAtlas=1024`, 'rpm');
        }
      }
    }
  }
}
