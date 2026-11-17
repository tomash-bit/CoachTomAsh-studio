/* CoachTomAsh Studio v1.1.1: offline animation timeline + native GIF writer.
   Additive upgrade: intentionally uses the original localStorage key and drill format.
   No external services, dependencies, CDNs, or third-party scripts. */
'use strict';
(() => {
  const playButton = document.getElementById('playBtn');
  const slider = document.getElementById('timelineScrub');
  const label = document.getElementById('timelineLabel');
  const speedControl = document.getElementById('speedControl');
  const gifFpsControl = document.getElementById('gifFps');
  const loopControl = document.getElementById('loopAnimation');
  const hint = document.getElementById('animationHint');
  const gifButton = document.getElementById('exportGif');
  const dialog = document.getElementById('gifDialog');
  if (!playButton || !slider || !gifButton || !dialog) return;

  const TRANSITION_MS = 1600;
  let position = 0;
  let lastTimestamp = null;
  let exporting = false;
  let gifUrl = '';
  let gifBlob = null;
  let gifFilename = '';

  const numberOfFrames = () => current().frames.length;
  const limit = () => Math.max(0, numberOfFrames() - 1);
  const speed = () => Number(speedControl.value) || 1;
  const exportFPS = () => Number(gifFpsControl?.value) || 20;

  // Always derive animation frames from the saved positions. No animation state is
  // written into the practice library and older JSON backups remain valid.
  function showPosition() {
    const end = limit();
    position = clamp(position, 0, end);
    const from = Math.min(Math.floor(position), end);
    const fraction = position - from;
    frameIndex = from;
    if (fraction > 0.00001 && from < end) {
      renderPitch(tweenFrames(current().frames[from], current().frames[from + 1], fraction));
    } else {
      renderPitch();
    }
    slider.max = String(Math.max(1, end * 1000));
    slider.disabled = end === 0 || exporting;
    slider.value = String(Math.round(position * 1000));
    label.textContent = `${(position + 1).toFixed(Number.isInteger(position) ? 0 : 1)} / ${numberOfFrames()}`;
    document.querySelectorAll('#frameDots [data-frame]').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.frame) === Math.round(position));
    });
  }

  function updatePlayButton() {
    playButton.textContent = playing ? 'Ⅱ Pause' : (position > 0 && position < limit() ? '▶ Resume' : '▶ Play');
    playButton.setAttribute('aria-label', playing ? 'Pause animation' : 'Play or resume animation');
    playButton.disabled = exporting || numberOfFrames() < 2;
  }
  function cancelFrame() {
    if (playbackRequest) cancelAnimationFrame(playbackRequest);
    playbackRequest = 0;
    lastTimestamp = null;
    playing = false;
  }

  // The old v1 editor invokes stopPlayback() before changing drills/frames.
  // Rebind it, retaining its contract and resetting any fractional preview.
  stopPlayback = function () {
    cancelFrame();
    position = clamp(frameIndex, 0, limit());
    showPosition();
    updatePlayButton();
  };

  const renderFramesV1 = renderFrames;
  renderFrames = function () {
    renderFramesV1();
    position = clamp(frameIndex, 0, limit());
    showPosition();
    updatePlayButton();
  };

  function tick(timestamp) {
    if (!playing) return;
    if (lastTimestamp !== null) {
      // Cap elapsed time for a locked screen/backgrounded iPad.
      const dt = Math.min(150, timestamp - lastTimestamp);
      position += dt * speed() / TRANSITION_MS;
    }
    lastTimestamp = timestamp;
    if (position >= limit()) {
      if (loopControl.checked) position = position % limit();
      else {
        position = limit();
        cancelFrame();
      }
    }
    showPosition();
    updatePlayButton();
    if (playing) playbackRequest = requestAnimationFrame(tick);
  }

  playButton.onclick = () => {
    if (exporting) return;
    if (playing) {
      cancelFrame();
      showPosition();
      updatePlayButton();
      return;
    }
    if (numberOfFrames() < 2) { toast('Add a second frame to animate movement.'); return; }
    if (position >= limit()) position = 0;
    playing = true;
    selectedId = null;
    selectedPath = null;
    lastTimestamp = null;
    updatePlayButton();
    playbackRequest = requestAnimationFrame(tick);
  };
  document.getElementById('restartAnimation').onclick = () => {
    cancelFrame();
    position = 0;
    showPosition();
    updatePlayButton();
  };
  slider.addEventListener('input', () => {
    cancelFrame();
    position = clamp(Number(slider.value) / 1000, 0, limit());
    selectedId = null;
    selectedPath = null;
    showPosition();
    updatePlayButton();
    hint.textContent = 'Scrubbing previews motion. Tap a numbered frame to edit player positions.';
  });
  speedControl.addEventListener('change', () => {
    hint.textContent = `Playback at ${speed()}×. GIF export also follows the chosen speed.`;
  });
  // Editing starts only at stored keyframes, never at a synthesized in-between state.
  pitch.addEventListener('pointerdown', () => {
    if (!playing && position !== Math.floor(position)) {
      position = frameIndex;
      showPosition();
      updatePlayButton();
    }
  }, {capture: true});

  gifFpsControl?.addEventListener('change', () => {
    hint.textContent = `GIF export: ${exportFPS()} FPS at ${speed()}× movement speed. Higher FPS is smoother but creates larger files.`;
  });

  // ---- GIF89a encoder (RGB332 palette, LZW, no external library) ----
  // GIF is limited to 256 colours. RGB332 gives predictable local/offline output.
  class ByteWriter {
    constructor() { this.parts = []; }
    bytes(...values) { this.parts.push(Uint8Array.from(values)); }
    raw(data) { this.parts.push(data instanceof Uint8Array ? data : Uint8Array.from(data)); }
    str(s) { this.raw(Uint8Array.from(s, c => c.charCodeAt(0))); }
    word(n) { this.bytes(n & 255, (n >> 8) & 255); }
    blob() { return new Blob(this.parts, {type:'image/gif'}); }
  }
  const PALETTE = (() => {
    const rgb = new Uint8Array(768);
    for (let i = 0; i < 256; i++) {
      rgb[i * 3] = Math.round(((i >> 5) & 7) * 255 / 7);
      rgb[i * 3 + 1] = Math.round(((i >> 2) & 7) * 255 / 7);
      rgb[i * 3 + 2] = Math.round((i & 3) * 255 / 3);
    }
    return rgb;
  })();

  function indexPixels(img) {
    const rgba = img.data;
    const pixels = new Uint8Array(rgba.length / 4);
    for (let p = 0, i = 0; i < rgba.length; i += 4, p++) {
      // Canvas compositing has an opaque pitch background, but guard alpha.
      const a = rgba[i + 3] / 255;
      const r = Math.round(rgba[i] * a + 255 * (1 - a));
      const g = Math.round(rgba[i + 1] * a + 255 * (1 - a));
      const b = Math.round(rgba[i + 2] * a + 255 * (1 - a));
      pixels[p] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
    }
    return pixels;
  }

  function lzwEncode(pixels) {
    const CLEAR = 256, EOI = 257;
    const bytes = [];
    let bits = 0, bitCount = 0, codeSize = 9, nextCode = 258;
    const dictionary = new Map();
    const emit = code => {
      bits |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        bytes.push(bits & 255);
        bits >>>= 8;
        bitCount -= 8;
      }
    };
    emit(CLEAR);
    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const next = pixels[i];
      const key = prefix * 256 + next;
      const found = dictionary.get(key);
      if (found !== undefined) { prefix = found; continue; }
      emit(prefix);
      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        // Decoder's table is one symbol behind the encoder's table.
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(CLEAR);
        dictionary.clear();
        nextCode = 258;
        codeSize = 9;
      }
      prefix = next;
    }
    emit(prefix);
    emit(EOI);
    if (bitCount) bytes.push(bits & 255);
    return Uint8Array.from(bytes);
  }

  class GifWriter {
    constructor(width, height, fps) {
      this.output = new ByteWriter();
      this.w = width; this.h = height; this.fps = fps; this.frameCount = 0;
      const o = this.output;
      o.str('GIF89a');
      o.word(width); o.word(height);
      o.bytes(0xF7, 0, 0); // global 256-colour palette
      o.raw(PALETTE);
      o.bytes(0x21, 0xFF, 0x0B); o.str('NETSCAPE2.0');
      o.bytes(3, 1, 0, 0, 0); // loop forever
    }
    frame(pixels) {
      const o = this.output;
      o.bytes(0x21, 0xF9, 4, 0x08); // disposal=2, no transparency
      // GIF stores delays in 1/100 second. A fixed 3 cs delay would
      // incorrectly turn 30 FPS into 33.3 FPS. Alternate 3/3/4 cs so the
      // cumulative playback duration averages exactly 30 FPS.
      const startCS = Math.round(this.frameCount * 100 / this.fps);
      const endCS = Math.round((this.frameCount + 1) * 100 / this.fps);
      o.word(Math.max(2, endCS - startCS)); o.bytes(0, 0);
      this.frameCount++;
      o.bytes(0x2C); o.word(0); o.word(0); o.word(this.w); o.word(this.h); o.bytes(0);
      o.bytes(8); // 8-bit initial LZW code size
      const compressed = lzwEncode(pixels);
      for (let k = 0; k < compressed.length; k += 255) {
        const chunk = compressed.subarray(k, k + 255);
        o.bytes(chunk.length); o.raw(chunk);
      }
      o.bytes(0); // image data terminator
    }
    finish() { this.output.bytes(0x3B); return this.output.blob(); }
  }

  async function drawExportFrame(ctx, diagram, pitchType, canvas) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="728" viewBox="-60 -39 1120 728">' +
      draw(diagram.objects, diagram.paths, pitchType, null) + '</svg>';
    const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Unable to render the football pitch for GIF export'));
        img.src = url;
      });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return indexPixels(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } finally { URL.revokeObjectURL(url); }
  }

  function setExportUI(busy, message) {
    exporting = busy;
    gifButton.disabled = busy;
    gifButton.textContent = busy ? '⏳ Creating GIF…' : '⬇ Animated GIF';
    slider.disabled = busy || limit() === 0;
    updatePlayButton();
    if (message) hint.textContent = message;
  }

  gifButton.onclick = async () => {
    if (exporting) return;
    if (numberOfFrames() < 2) { toast('Create at least two animation frames to export a GIF.'); return; }
    cancelFrame();
    updatePlayButton();
    const drill = copy(current());
    const previousSelection = selectedId;
    const previousPath = selectedPath;
    selectedId = null; selectedPath = null;
    setExportUI(true, 'Rendering your animation on this device. Keep the app open.');
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 312;
    try {
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      if (!ctx) throw new Error('Canvas rendering is unavailable on this device');
      const fps = exportFPS();
      const transitions = drill.frames.length - 1;
      // Preserve the original animation length regardless of export FPS.
      // Never silently reduce the number of frames, which makes motion faster.
      const perSegment = Math.max(2, Math.round(TRANSITION_MS / 1000 * fps / speed()));
      const holdFrames = Math.max(2, Math.round(fps * 0.5));
      const total = transitions * perSegment + holdFrames;
      // Bound memory/CPU for iPad. Recommend lower FPS rather than
      // quietly shortening a user's full animation.
      if (total > 360) throw new Error(`This would render ${total} frames. Select a lower GIF FPS, increase playback speed, or split the practice into shorter animations (360-frame limit).`);
      const writer = new GifWriter(canvas.width, canvas.height, fps);
      let n = 0;
      const pitchType = drill.pitchType || 'full';
      for (let i = 0; i < transitions; i++) {
        for (let j = 0; j < perSegment; j++) {
          const diagram = tweenFrames(drill.frames[i], drill.frames[i + 1], j / perSegment);
          writer.frame(await drawExportFrame(ctx, diagram, pitchType, canvas));
          n++;
          if (n % 3 === 0) {
            hint.textContent = `Creating GIF: ${Math.round(100 * n / total)}% (${n}/${total} frames)`;
            // Yield to let the iPad update the progress label and remain responsive.
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      for (let j = 0; j < holdFrames; j++) {
        writer.frame(await drawExportFrame(ctx, drill.frames[drill.frames.length - 1], pitchType, canvas));
      }
      const result = writer.finish();
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      gifBlob = result;
      gifFilename = `CoachTomAsh_${safeFilename(drill.name)}_${fps}FPS.gif`;
      gifUrl = URL.createObjectURL(result);
      document.getElementById('gifPreview').src = gifUrl;
      document.getElementById('gifInfo').textContent = `${drill.frames.length} keyframes · ${fps} FPS · ${(result.size / 1048576).toFixed(1)} MB. Save the file, or share it using the iPad share sheet.`;
      const canShare = typeof navigator.canShare === 'function' && navigator.canShare({files:[new File([gifBlob],gifFilename,{type:'image/gif'})]});
      document.getElementById('shareGif').hidden = !canShare;
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      hint.textContent = 'GIF created locally. Your practice data has not been uploaded anywhere.';
    } catch (error) {
      console.error('CoachTomAsh GIF export:', error);
      toast(`GIF export failed: ${error.message || 'unknown error'}`);
      hint.textContent = `GIF export could not finish: ${error.message || 'unknown error'}. Try a shorter drill.`;
    } finally {
      selectedId = previousSelection;
      selectedPath = previousPath;
      setExportUI(false);
      showPosition();
    }
  };

  document.getElementById('saveGif').onclick = () => {
    if (!gifUrl) return;
    const a = document.createElement('a');
    a.href = gifUrl; a.download = gifFilename;
    document.body.appendChild(a); a.click(); a.remove();
    toast('GIF download requested. On iPad, check Downloads / Files.');
  };
  document.getElementById('shareGif').onclick = async () => {
    if (!gifBlob || typeof navigator.share !== 'function') return;
    try {
      const file = new File([gifBlob], gifFilename, {type:'image/gif'});
      await navigator.share({files:[file],title:'CoachTomAsh Studio animation'});
    } catch (error) {
      if (error.name !== 'AbortError') toast('Sharing unavailable. Try Save GIF instead.');
    }
  };
  document.getElementById('closeGif').onclick = () => dialog.close ? dialog.close() : dialog.removeAttribute('open');
  // Ensure no hidden background animation continues when iPad screen is switched away.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) {
      cancelFrame();
      updatePlayButton();
    }
  });
  // Initialize timeline after the v1 app's boot() has loaded saved drills.
  position = frameIndex;
  showPosition();
  updatePlayButton();
})();
