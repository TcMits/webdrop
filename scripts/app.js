import { joinRoom, selfId } from './trystero-nostr.min.js'
import { funAnimalName } from './name.js'
import { v4 as getUUID } from './uuid.js';

function getUA() {
  let device = "Unknown";
  const ua = {
    "Generic Linux": /Linux/i,
    "Android": /Android/i,
    "BlackBerry": /BlackBerry/i,
    "Bluebird": /EF500/i,
    "Chrome OS": /CrOS/i,
    "Datalogic": /DL-AXIS/i,
    "Honeywell": /CT50/i,
    "IPad": /iPad/i,
    "IPhone": /iPhone/i,
    "IPod": /iPod/i,
    "MacOS": /Macintosh/i,
    "Windows": /IEMobile|Windows/i,
    "Zebra": /TC70|TC55/i,
  }
  Object.keys(ua).map(v => navigator.userAgent.match(ua[v]) && (device = v));
  return device;
}

window.URL = window.URL || window.webkitURL;
window.isDownloadSupported = (typeof document.createElement('a').download !== 'undefined');
window.iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const $ = query => document.getElementById(query);
const $$ = query => document.body.querySelector(query);
const displayName = funAnimalName(selfId)
const deviceName = getUA()

class PeersManager {

  constructor(onReceiveMeta) {
    this._peers = {};
    this._onReceiveMeta = onReceiveMeta;
    this._connect();
    Events.on('beforeunload', _ => { this._disconnect() });
    Events.on('pagehide', _ => { this._disconnect() });
    document.addEventListener('visibilitychange', _ => { this._onVisibilityChange() });
  }

  _connect() {
    if (this._isConnected()) return;
    this._room = joinRoom({ appId: encodeURI(window.location.origin) }, "webdrop" + new Date().getFullYear().toString());
    const [sendMessage, getMessage] = this._room.makeAction('message');
    const [sendFile, getFile] = this._room.makeAction('file');

    this._room.onPeerJoin(peerId => {
      const peer = new Peer(peerId, (meta) => sendMessage({ type: 'receive-meta', meta }, peerId));
      this._peers[peerId] = peer;
      sendMessage({ type: 'introduce', info: { displayName: displayName, deviceName: deviceName } }, peerId);
    });

    this._room.onPeerLeave(peerId => {
      this._peers[peerId].close();
      delete this._peers[peerId];
    });

    getMessage((message, peerId) => {
      switch (message.type) {
        case 'introduce':
          this._peers[peerId].setInfo(message.info.displayName, message.info.deviceName);
          break;
        case 'receive-meta':
          this._onReceiveMeta(message.meta, () => {
            this._peers[peerId].initStorageForMeta(message.meta);
            sendMessage({ type: 'accept-meta', meta: message.meta }, peerId)
          });
          break;
        case 'accept-meta':
          this._peers[peerId].onAcceptMeta(message.meta, (chunk, meta, onProgress) => {
            return sendFile(chunk, peerId, meta, (percent, id) => {
              console.assert(peerId === id);
              onProgress(percent);
            });
          });
          break;
      }
    });

    getFile((chunk, peerId, meta) => this._peers[peerId].onReceiveChunk(chunk, meta));
  }

  _disconnect() {
    if (!this._room) return;
    for (let peerId in this._peers) {
      this._peers[peerId].close();
      delete this._peers[peerId];
    }
    this._room.leave();
    this._room = null;
  }

  _onVisibilityChange() {
    if (document.hidden) return;
    this._connect();
  }

  _isConnected() {
    return !!this._room;
  }
}

class Peer {

  constructor(peerId, sendMeta) {
    this._sendMeta = sendMeta;
    this._files = {};
    this._store = {};
    this._totalSize = 0.0;
    this._remainingSize = 0.0;
    this._peerId = peerId;
    this._abortController = new AbortController();
    this.info = {
      displayName: 'Unknown',
      deviceName: 'Unknown',
    }
    this._ui = new PeerUI(this);
  }

  get id() {
    return this._peerId;
  }

  get progress() {
    return this._totalSize === 0.0 ? 1.0 : (this._totalSize - this._remainingSize) / this._totalSize;
  }

  close() {
    this._ui.$el.remove();
    this._abortController.abort();

    for (let key in Object.keys(this._store)) {
      delete this._store[key];
    }

    for (let key in Object.keys(this._files)) {
      delete this._files[key];
    }
  }

  setInfo(displayName, deviceName) {
    if (this._abortController.aborted) return;
    this.info.displayName = displayName || "";
    this.info.deviceName = deviceName || "";
    this._ui.refresh();
  }

  getInfo() {
    return {
      displayName: this.info.displayName,
      deviceName: this.info.deviceName
    };
  }

  sendFiles(files) {
    if (this._abortController.aborted) return;
    for (let i = 0; i < files.length; i++) {
      const id = getUUID();
      const meta = {
        id: id,
        name: files[i].name,
        type: files[i].type,
        size: files[i].size,
        chunkSize: 1024 * 1024,
      };
      this._files[id] = { file: files[i] }
      this._sendMeta(meta);
    }
  }

  _increaseSize(size) {
    this._remainingSize += size;
    this._totalSize += size;
    this._ui.setProgress(this.progress);
  }

  _decreaseSize(size) {
    this._remainingSize -= Math.ceil(size);
    if (this._remainingSize <= 0.0) {
      this._resetSize();
    }
    this._ui.setProgress(this.progress);
  }

  _resetSize() {
    this._remainingSize = 0.0;
    this._totalSize = 0.0;
  }

  initStorageForMeta(meta) {
    const abortController = this._abortController;
    if (abortController.aborted) return;
    this._store[meta.id] = { store: {} }
    const store = this._store[meta.id].store;
    const chunkLength = Math.ceil(meta.size / meta.chunkSize);
    const size = meta.size;
    const name = meta.name;
    const updateDownload = (decreaseSize) => this._decreaseSize(decreaseSize);
    this._increaseSize(size);

    const fileGen = (async function*() {
      for (let i = 0; i < chunkLength; i++) {
        yield await new Promise((res, reject) => {
          const abort = _ => reject("peer closed");
          const resolve = (chunk) => {
            abortController.signal.removeEventListener("abort", abort);
            if (!abortController.aborted) res(chunk);
          };
          abortController.signal.addEventListener("abort", abort, { once: true });

          if (store[i] !== undefined) {
            resolve(store[i]);
            delete store[i]
            return;
          }

          store[i] = resolve;
        })
      }
    })();

    (async function() {
      const writer = streamSaver.createWriteStream(name, { size: size }).getWriter();
      const abort = _ => writer.abort();
      Events.on('beforeunload', abort);
      try {
        for await (const chunk of fileGen) {
          writer.write(chunk);
          updateDownload(chunk.length);
        }

        Events.off('beforeunload', abort)
        writer.close();
      } catch (e) {
        Events.off('beforeunload', abort)
        writer.abort();
        throw e;
      }
    })().then(() => {
      delete this._store[meta.id];
      Events.fire('notify-user', `${meta.name} file transfer completed.`);
    });
  }

  onAcceptMeta(meta, sendChunk) {
    const fileWrap = this._files[meta.id];
    if (!fileWrap) return;
    const file = fileWrap.file;
    const chunkSize = meta.chunkSize;
    const size = meta.size;
    const chunkLength = Math.ceil(size / chunkSize);
    const abortController = this._abortController;
    const updateUpload = (decreaseSize) => this._decreaseSize(decreaseSize);
    this._increaseSize(size);

    const pump = (i) => {
      if (i >= chunkLength) {
        delete this._files[meta.id]
        Events.fire('notify-user', `${meta.name} file transfer completed.`);
        return;
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, size);
      const chunk = file.slice(start, end)
      const actualChunkSize = chunk.size;
      let lastSentSize = 0;
      sendChunk(chunk, { ...meta, chunkIndex: i }, (percent) => {
        const delta = percent * actualChunkSize - lastSentSize;
        lastSentSize = percent * actualChunkSize;
        updateUpload(delta);
      }).then(() => {
        if (abortController.aborted) return;
        pump(i + 1);
      });
    }

    pump(0);
  }

  onReceiveChunk(chunk, meta) {
    const storeWrap = this._store[meta.id];
    if (!storeWrap) return;
    if (storeWrap.store[meta.chunkIndex] !== undefined) {
      storeWrap.store[meta.chunkIndex](chunk)
      delete storeWrap.store[meta.chunkIndex];
      return;
    }
    storeWrap.store[meta.chunkIndex] = chunk;
  }
}

class Events {
  static fire(type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail: detail }));
  }

  static on(type, callback) {
    return window.addEventListener(type, callback, false);
  }

  static off(type, callback) {
    return window.removeEventListener(type, callback, false);
  }
}

class PeerUI {

  html() {
    return `
            <label class="column center" title="Click to send files">
                <input type="file" multiple>
                <x-icon shadow="1">
                    <svg class="icon"><use xlink:href="#"/></svg>
                </x-icon>
                <div class="progress">
                  <div class="circle"></div>
                  <div class="circle right"></div>
                </div>
                <div class="name font-subheading"></div>
                <div class="device-name font-body2"></div>
                <div class="status font-body2"></div>
            </label>`
  }

  constructor(peer) {
    this._peer = peer;
    this._initDom();
    this._bindListeners(this.$el);
    $$('x-peers').appendChild(this.$el);
    setTimeout(_ => window.animateBackground(false), 1750); // Stop animation
  }

  _initDom() {
    const el = document.createElement('x-peer');
    el.id = this._peer.id;
    el.innerHTML = this.html();
    el.ui = this;
    el.querySelector('svg use').setAttribute('xlink:href', this._icon());
    el.querySelector('.name').textContent = this._displayName();
    el.querySelector('.device-name').textContent = this._deviceName();
    this.$el = el;
    this.$progress = el.querySelector('.progress');
  }

  refresh() {
    this.$el.querySelector('svg use').setAttribute('xlink:href', this._icon());
    this.$el.querySelector('.name').textContent = this._displayName();
    this.$el.querySelector('.device-name').textContent = this._deviceName();
  }

  _bindListeners(el) {
    el.querySelector('input').addEventListener('change', e => this._onFilesSelected(e));
    el.addEventListener('drop', e => this._onDrop(e));
    el.addEventListener('dragend', e => this._onDragEnd(e));
    el.addEventListener('dragleave', e => this._onDragEnd(e));
    el.addEventListener('dragover', e => this._onDragOver(e));
    // prevent browser's default file drop behavior
    Events.on('dragover', e => e.preventDefault());
    Events.on('drop', e => e.preventDefault());
  }

  _displayName() {
    return this._peer.getInfo().displayName;
  }

  _deviceName() {
    return this._peer.getInfo().deviceName;
  }

  _icon() {
    const deviceName = this._deviceName();
    if (deviceName === 'IPad') {
      return '#tablet-mac';
    }

    if (
      deviceName !== 'Windows'
      && deviceName !== 'Generic Linux'
      && deviceName !== 'Chrome OS'
      && deviceName !== 'MacOS'
    ) {
      return '#phone-iphone';
    }

    return '#desktop-mac';
  }

  _onFilesSelected(e) {
    const $input = e.target;
    const files = $input.files;
    this._peer.sendFiles(files);
    $input.value = null; // reset input
  }

  setProgress(progress) {
    if (progress > 0) {
      this.$el.setAttribute('transfer', '1');
    }
    if (progress > 0.5) {
      this.$progress.classList.add('over50');
    } else {
      this.$progress.classList.remove('over50');
    }
    const degrees = `rotate(${360 * progress}deg)`;
    this.$progress.style.setProperty('--progress', degrees);
    if (progress >= 1) {
      this.setProgress(0);
      this.$el.removeAttribute('transfer');
    }
  }

  _onDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    this._peer.sendFiles(files);
    this._onDragEnd();
  }

  _onDragOver() {
    this.$el.setAttribute('drop', 1);
  }

  _onDragEnd() {
    this.$el.removeAttribute('drop');
  }
}


class Dialog {
  constructor(id) {
    this.$el = $(id);
    this.$el.querySelectorAll('[close]').forEach(el => el.addEventListener('click', _ => this.hide()))
    this.$autoFocus = this.$el.querySelector('[autofocus]');
  }

  show() {
    this.$el.setAttribute('show', 1);
    if (this.$autoFocus) this.$autoFocus.focus();
  }

  hide() {
    this.$el.removeAttribute('show');
    document.activeElement.blur();
  }
}


class ReceiveMetaDialog extends Dialog {

  constructor() {
    super('receiveMetaDialog');
    this._metaQueue = [];
  }

  onReceiveMeta(metadata, acceptCB) {
    this._nextMeta(metadata, acceptCB);
  }

  _nextMeta(metadata, acceptCB) {
    if (metadata && acceptCB) this._metaQueue.push({ metadata, acceptCB });
    if (this._busy) return;
    this._busy = true;
    const m = this._metaQueue.shift();
    this._displayMeta(m.metadata, m.acceptCB);
  }

  _dequeueMeta() {
    if (!this._metaQueue.length) { // nothing to do
      this._busy = false;
      return;
    }
    setTimeout(_ => {
      this._busy = false;
      this._nextMeta();
    }, 300);
  }

  _displayMeta(metadata, acceptCB) {
    const $a = this.$el.querySelector('#accept');
    $a.onclick = _ => acceptCB();
    this.$el.querySelector('#fileName').textContent = metadata.name;
    this.$el.querySelector('#fileSize').textContent = this._formatFileSize(metadata.size);
    this.show();
  }

  _formatFileSize(bytes) {
    if (bytes >= 1e9) {
      return (Math.round(bytes / 1e8) / 10) + ' GB';
    } else if (bytes >= 1e6) {
      return (Math.round(bytes / 1e5) / 10) + ' MB';
    } else if (bytes > 1000) {
      return Math.round(bytes / 1000) + ' KB';
    } else {
      return bytes + ' Bytes';
    }
  }

  hide() {
    super.hide();
    this._dequeueMeta();
  }
}

class Toast extends Dialog {
  constructor() {
    super('toast');
    Events.on('notify-user', e => this._onNotfiy(e.detail));
  }

  _onNotfiy(message) {
    this.$el.textContent = message;
    this.show();
    setTimeout(_ => this.hide(), 3000);
  }
}

class NetworkStatusUI {

  constructor() {
    window.addEventListener('offline', _ => this._showOfflineMessage(), false);
    window.addEventListener('online', _ => this._showOnlineMessage(), false);
    if (!navigator.onLine) this._showOfflineMessage();
  }

  _showOfflineMessage() {
    Events.fire('notify-user', 'You are offline');
  }

  _showOnlineMessage() {
    Events.fire('notify-user', 'You are back online');
  }
}

class WebShareTargetUI {
  constructor() {
    const parsedUrl = new URL(window.location);
    const title = parsedUrl.searchParams.get('title');
    const text = parsedUrl.searchParams.get('text');
    const url = parsedUrl.searchParams.get('url');

    let shareTargetText = title ? title : '';
    shareTargetText += text ? shareTargetText ? ' ' + text : text : '';

    if (url) shareTargetText = url; // We share only the Link - no text. Because link-only text becomes clickable.

    if (!shareTargetText) return;
    window.shareTargetText = shareTargetText;
    history.pushState({}, 'URL Rewrite', '/');
    console.log('Shared Target Text:', '"' + shareTargetText + '"');
  }
}

Events.on('load', () => {
  const receiveMetaDialog = new ReceiveMetaDialog();
  const _ = [
    new PeersManager((m, cb) => receiveMetaDialog.onReceiveMeta(m, cb)),
    new Toast(),
    new NetworkStatusUI(),
    new WebShareTargetUI(),
  ]
  const $displayName = $('displayName')
  $displayName.textContent = 'You are known as ' + displayName;
  $displayName.title = deviceName;
})


window.addEventListener('beforeinstallprompt', e => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    // don't display install banner when installed
    return e.preventDefault();
  } else {
    const btn = document.querySelector('#install')
    btn.hidden = false;
    btn.onclick = _ => e.prompt();
    return e.preventDefault();
  }
});

// Background Animation
Events.on('load', () => {
  let c = document.createElement('canvas');
  document.body.appendChild(c);
  let style = c.style;
  style.width = '100%';
  style.position = 'absolute';
  style.zIndex = -1;
  style.top = 0;
  style.left = 0;
  let ctx = c.getContext('2d');
  let x0, y0, w, h, dw;

  function init() {
    w = window.innerWidth;
    h = window.innerHeight;
    c.width = w;
    c.height = h;
    let offset = h > 380 ? 100 : 65;
    offset = h > 800 ? 116 : offset;
    x0 = w / 2;
    y0 = h - offset;
    dw = Math.max(w, h, 1000) / 13;
    drawCircles();
  }
  window.onresize = init;

  function drawCircle(radius) {
    ctx.beginPath();
    let color = Math.round(197 * (1 - radius / Math.max(w, h)));
    ctx.strokeStyle = 'rgba(' + color + ',' + color + ',' + color + ',0.1)';
    ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 2;
  }

  let step = 0;
  function drawCircles() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      drawCircle(dw * i + step);
    }
    step = (step + 1) % dw;
  }

  let loading = true;

  function animate() {
    if (loading || step < dw - 5) {
      requestAnimationFrame(function() {
        drawCircles();
        animate();
      });
    }
  }
  window.animateBackground = function(l) {
    loading = l;
    animate();
  };
  init();
  animate();
});

document.body.onclick = _ => { // safari hack to fix audio
  document.body.onclick = null;
  if (!(/.*Version.*Safari.*/.test(navigator.userAgent))) return;
  blop.play();
}
