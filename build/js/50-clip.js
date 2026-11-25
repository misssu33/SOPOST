  /* =========================================================
     50-clip.js — 4 쇼츠/릴스·롱폼 클립: 자르기 · Safe Zone · TTS · WebM
     ========================================================= */

  const TTS_VOICES = {
    kore: { pitch: 210, rate: 0.98, name: 'Kore', desc: '여성 · 따뜻한' },
    aoede: { pitch: 236, rate: 1.06, name: 'Aoede', desc: '여성 · 밝은' },
    charon: { pitch: 104, rate: 0.92, name: 'Charon', desc: '남성 · 낮은' },
    puck: { pitch: 142, rate: 1.10, name: 'Puck', desc: '남성 · 에너지' },
    fenrir: { pitch: 118, rate: 0.96, name: 'Fenrir', desc: '남성 · 중저음' }
  };
  const TTS_ORDER = ['kore', 'aoede', 'charon', 'puck', 'fenrir'];
  const ttsVoice = k => TTS_VOICES[k] || TTS_VOICES.kore;

  /* ---------------- Web Audio ---------------- */
  let AC = null;
  function getAC() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      AC = new C({ latencyHint: 'interactive' });
    }
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  const KO_VOWELS = ['a', 'e', 'a', 'e', 'eo', 'e', 'eo', 'e', 'o', 'a', 'e', 'e', 'o', 'u', 'eo', 'e', 'i', 'u', 'eu', 'i', 'i'];
  const FORMANTS = {
    a: [820, 1250], e: [560, 1850], i: [330, 2350], o: [540, 900], u: [350, 820],
    eo: [600, 1400], eu: [440, 1500], ae: [700, 1600], schwa: [560, 1300]
  };
  function splitSyllables(text) {
    const out = [];
    for (const ch of Array.from(String(text || ''))) {
      if (/\s/.test(ch)) { out.push({ t: 'space' }); continue; }
      if (/[.!?。！？]/.test(ch)) { out.push({ t: 'pause', d: 0.26 }); continue; }
      if (/[,，·]/.test(ch)) { out.push({ t: 'pause', d: 0.13 }); continue; }
      const code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const vi = Math.floor((code - 0xAC00) % 588 / 28);
        const li = Math.floor((code - 0xAC00) / 588);
        out.push({ t: 'syl', v: KO_VOWELS[vi] || 'a', con: li });
      } else if (/[a-zA-Z0-9]/.test(ch)) {
        const lc = ch.toLowerCase();
        out.push({ t: 'syl', v: 'aeiou'.includes(lc) ? lc : (lc === 'y' ? 'i' : 'schwa'), con: 0, latin: true });
      } else out.push({ t: 'syl', v: 'a', con: 0 });
    }
    return out;
  }
  /** 데모용 브라우저 합성음 — Gemini 키가 없을 때도 실제 길이의 오디오를 만든다. */
  function synthSpeechBuffer(text, opt) {
    const ac = getAC();
    const sr = ac.sampleRate;
    const vp = ttsVoice(opt.voice);
    const rate = clamp(opt.speed || 1, 0.6, 2);
    const pitch = vp.pitch * (0.98 + (rate - 1) * 0.12);
    const tokens = splitSyllables(text);
    const baseDur = 0.135 / (rate * vp.rate);
    let total = 0.06;
    const plan = [];
    for (const tk of tokens) {
      if (tk.t === 'space') { const d = 0.045 / rate; total += d; plan.push({ tk, dur: d }); continue; }
      if (tk.t === 'pause') { const d = (tk.d || 0.15) / rate; total += d; plan.push({ tk, dur: d }); continue; }
      const dur = baseDur * (tk.latin ? 0.82 : 1);
      total += dur; plan.push({ tk, dur });
    }
    total += 0.12;
    const buf = ac.createBuffer(1, Math.max(1, Math.ceil(total * sr)), sr);
    const out = buf.getChannelData(0);
    let t = 0.06;
    for (const item of plan) {
      const tk = item.tk, dur = item.dur;
      const start = Math.floor(t * sr), len = Math.max(1, Math.floor(dur * sr));
      if (tk.t === 'syl') {
        const F = FORMANTS[tk.v] || FORMANTS.schwa;
        const f1 = F[0] * (vp.pitch / 196 * 0.25 + 0.75), f2 = F[1];
        const r1 = Math.exp(-Math.PI * 90 / sr), th1 = 2 * Math.PI * f1 / sr;
        const r2 = Math.exp(-Math.PI * 150 / sr), th2 = 2 * Math.PI * f2 / sr;
        const b11 = 2 * r1 * Math.cos(th1), b12 = -r1 * r1;
        const b21 = 2 * r2 * Math.cos(th2), b22 = -r2 * r2;
        let y1 = 0, z1 = 0, y2 = 0, z2 = 0;
        const f0s = pitch * 1.06, f0e = pitch * (tk.v === 'i' || tk.v === 'e' ? 1.12 : 0.94);
        let ph = 0;
        for (let i = 0; i < len; i++) {
          const k = i / len;
          const f0 = f0s + (f0e - f0s) * k;
          ph += f0 / sr; if (ph >= 1) ph -= 1;
          let src = Math.exp(-ph * 9) * (ph < 0.5 ? 1 : -1);
          if (tk.con % 3 === 1 && i < len * 0.16) src += (Math.random() * 2 - 1) * 0.5;
          y1 = src + b11 * z1 + b12 * z2; z2 = z1; z1 = y1;
          y2 = y1 + b21 * z1 * 0.35 + b22 * z2 * 0.35; z2 = z1; z1 = y2;
          const env = Math.min(1, i / (sr * 0.012)) * Math.min(1, (len - i) / (sr * 0.02)) * 0.5;
          const idx = start + i;
          if (idx < out.length) out[idx] += y2 * env * 0.55;
        }
      }
      t += dur;
    }
    let peak = 0;
    for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    const norm = peak > 0 ? Math.min(2.2, 0.82 / peak) : 1;
    for (let i = 0; i < out.length; i++) out[i] *= norm;
    return buf;
  }
  function pcmToBuffer(b64, rate) {
    const ac = getAC();
    const bin = atob(b64);
    const n = Math.floor(bin.length / 2);
    const buf = ac.createBuffer(1, n, rate || 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      let v = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8));
      if (v >= 32768) v -= 65536;
      ch[i] = v / 32768;
    }
    return buf;
  }
  async function geminiTTS(text, voiceKey) {
    const voiceName = ttsVoice(voiceKey).name;
    const data = await geminiCall('gemini-2.5-flash-preview-tts', {
      contents: [{ parts: [{ text: '다음 문장을 자연스러운 쇼츠 내레이션으로 읽어 주세요: ' + text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
    }, { timeout: 60000 });
    const part = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0];
    const inline = part && (part.inlineData || part.inline_data);
    if (!inline || !inline.data) throw new Error('TTS 응답에 오디오가 없습니다');
    const mt = inline.mimeType || inline.mime_type || '';
    const m = /rate=(\d+)/.exec(mt);
    return pcmToBuffer(inline.data, m ? Number(m[1]) : 24000);
  }

  /* ---------------- videos & segments ---------------- */
  const clipEls = {};
  function videoById(id) { return state.clip.videos.find(v => v.id === id); }

  function renderClipVideos() {
    const sel = $('#clipVideoSel'); if (!sel) return;
    sel.innerHTML = state.clip.videos.length
      ? state.clip.videos.map(v => '<option value="' + v.id + '"' + (state.clip.activeVideo === v.id ? ' selected' : '') + '>' + esc(v.name) + ' · ' + v.duration.toFixed(1) + 's</option>').join('')
      : '<option value="">영상을 먼저 올리세요</option>';
    const nm = $('#clipVideoName');
    const v = videoById(state.clip.activeVideo);
    if (nm) nm.textContent = v ? v.name : '—';
    const inR = $('#segIn'), outR = $('#segOut');
    const dur = v ? v.duration : 10;
    [inR, outR].forEach(r => { if (r) { r.max = dur; r.step = 0.1; } });
    if (outR && (!outR.value || Number(outR.value) > dur || Number(outR.value) <= Number(inR.value))) outR.value = Math.min(dur, dur).toFixed(1);
    updateSegLabels();
  }

  function updateSegLabels() {
    const iv = $('#inVal'), ov = $('#outVal');
    const i = Number(($('#segIn') || {}).value) || 0;
    const o = Number(($('#segOut') || {}).value) || 0;
    if (iv) iv.textContent = i.toFixed(1) + 's';
    if (ov) ov.textContent = o.toFixed(1) + 's';
  }

  function renderSegs() {
    const box = $('#segs'), empty = $('#segEmpty'), total = $('#segTotal');
    if (!box) return;
    const segs = state.clip.segs;
    if (empty) empty.classList.toggle('hidden', segs.length > 0);
    box.innerHTML = segs.map((s, i) => {
      const v = videoById(s.videoId);
      const d = Math.max(0, s.end - s.start);
      return '<div class="seg" data-id="' + s.id + '"><span class="sn">' + (i + 1) + '</span>' +
        '<div><div class="st">' + esc(v ? v.name : '영상') + ' · <b>' + s.start.toFixed(1) + 's → ' + s.end.toFixed(1) + 's</b> · ' + d.toFixed(1) + '초</div>' +
        '<div class="bar" style="width:' + Math.round(Math.min(100, d / 10 * 100)) + '%"></div></div>' +
        '<button class="btn xs ghost" type="button" data-del="' + s.id + '">✕</button></div>';
    }).join('');
    const sum = segs.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
    if (total) total.textContent = segs.length + '개 · ' + sum.toFixed(1) + '초';
    const addBtn = $('#btnAddSeg');
    if (addBtn) addBtn.disabled = segs.length >= 5;
    drawClip();
  }

  async function addClipFiles(files) {
    let added = 0;
    for (const f of Array.from(files || [])) {
      const url = URL.createObjectURL(f);
      const el = document.createElement('video');
      el.src = url; el.muted = true; el.playsInline = true; el.preload = 'metadata';
      const meta = await new Promise(res => {
        let done = false;
        const finish = () => { if (done) return; done = true; res({ duration: el.duration || 0, w: el.videoWidth || 0, h: el.videoHeight || 0 }); };
        el.onloadedmetadata = finish;
        el.onerror = finish;
        setTimeout(finish, 6000);
      });
      if (!meta.duration || !isFinite(meta.duration)) { toast(f.name + ' · 길이를 읽지 못했습니다(브라우저가 이 형식을 못 읽을 수 있습니다)', 'bad'); continue; }
      const v = { id: uid('v'), name: f.name, url, duration: meta.duration, w: meta.w, h: meta.h, size: f.size };
      state.clip.videos.push(v);
      clipEls[v.id] = el;
      if (!state.clip.activeVideo) state.clip.activeVideo = v.id;
      added++;
    }
    if (added) {
      const active = videoById(state.clip.activeVideo);
      const inR = $('#segIn'), outR = $('#segOut');
      if (active) {
        if (inR) { inR.value = 0; inR.max = active.duration; }
        if (outR) { outR.value = Math.min(active.duration, 3).toFixed(1); outR.max = active.duration; }
      }
      renderClipVideos(); drawClip();
      const hint = $('#clipFileHint');
      if (hint) { hint.textContent = added + '개 불러옴 · 길이/해상도 확인 완료'; hint.className = 'hint'; }
      toast(added + '개 영상을 불러왔습니다', 'good');
      logActivity('🎬', '영상 ' + added + '개 불러오기 · ' + (videoById(state.clip.activeVideo) || {}).name);
    } else toast('읽을 수 있는 영상이 없습니다', 'bad');
    persistAll();
  }

  function activeVideoEl() { const v = videoById(state.clip.activeVideo); return v ? clipEls[v.id] : null; }

  /* ---------------- canvas ---------------- */
  const SAFE_ZONES = {
    youtube: [{ x: 0, y: 0, w: 1, h: 0.10, label: '제목 · 상단 UI' }, { x: 0, y: 0.83, w: 1, h: 0.17, label: '채널 · 설명 UI' }, { x: 0, y: 0.10, w: 0.10, h: 0.73, label: '여백' }, { x: 0.90, y: 0.10, w: 0.10, h: 0.73, label: '여백' }],
    instagram: [{ x: 0, y: 0, w: 1, h: 0.12, label: '프로필 · 상단' }, { x: 0, y: 0.78, w: 1, h: 0.22, label: '캡션 · 오디오' }, { x: 0.84, y: 0.42, w: 0.16, h: 0.36, label: '버튼' }],
    tiktok: [{ x: 0, y: 0, w: 1, h: 0.08, label: '상단' }, { x: 0, y: 0.76, w: 1, h: 0.24, label: '캡션 · 오디오' }, { x: 0.80, y: 0.36, w: 0.20, h: 0.42, label: '우측 버튼' }]
  };

  function drawClipFrame(ctx, W, H, opts) {
    opts = opts || {};
    const v = opts.video || activeVideoEl();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (v && v.videoWidth) {
      const sc = Math.min(W / v.videoWidth, H / v.videoHeight);
      const dw = v.videoWidth * sc, dh = v.videoHeight * sc;
      try { ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) {}
    } else {
      ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#4a5265'; ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(W * 0.045) + 'px ' + FONT;
      ctx.fillText(state.clip.videos.length ? '구간을 추가하고 미리보기를 누르세요' : '영상을 올리면 여기에 보입니다', W / 2, H / 2 - W * 0.04);
      ctx.font = '500 ' + Math.round(W * 0.028) + 'px ' + FONT;
      ctx.fillStyle = '#39404f';
      ctx.fillText('올린 영상은 이 브라우저 밖으로 나가지 않습니다', W / 2, H / 2 + W * 0.03);
      ctx.textAlign = 'left';
    }
    // 그라데이션 안전 띠
    const g1 = ctx.createLinearGradient(0, 0, 0, H * 0.22);
    g1.addColorStop(0, 'rgba(0,0,0,.55)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H * 0.22);
    const g2 = ctx.createLinearGradient(0, H * 0.72, 0, H);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.65)');
    ctx.fillStyle = g2; ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // Safe zone
    if (state.clip.safe !== 'off') {
      const zones = SAFE_ZONES[state.clip.safe] || [];
      ctx.save();
      zones.forEach(z => {
        ctx.fillStyle = 'rgba(255,107,125,.10)';
        ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H);
        ctx.strokeStyle = 'rgba(255,107,125,.45)';
        ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
        ctx.strokeRect(z.x * W + 1, z.y * H + 1, z.w * W - 2, z.h * H - 2);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,180,180,.75)';
        ctx.font = '700 ' + Math.round(W * 0.024) + 'px ' + FONT;
        ctx.fillText(z.label, z.x * W + 8, z.y * H + z.h * H / 2);
      });
      ctx.restore();
    }

    // 제목
    if (state.clip.titleOn && state.clip.title) {
      ctx.font = '800 ' + Math.round(W * 0.062) + 'px ' + FONT;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      const lines = wrapLines(ctx, state.clip.title, W * 0.86).slice(0, 2);
      lines.forEach((ln, i) => {
        const y = H * 0.055 + i * W * 0.075;
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(W * 0.06, y - 4, ctx.measureText(ln).width + 14, W * 0.072);
        ctx.fillStyle = '#fff';
        ctx.fillText(ln, W * 0.075, y);
      });
    }
    // 자막
    if (state.clip.subOn && state.clip.sub) {
      const size = Math.round(W * (state.clip.subSize / 720));
      ctx.font = '700 ' + size + 'px ' + FONT;
      ctx.textAlign = 'center';
      const y = H * (state.clip.subPos / 100);
      const lines = wrapLines(ctx, state.clip.sub, W * 0.84).slice(0, 3);
      lines.forEach((ln, i) => {
        const tw = ctx.measureText(ln).width;
        ctx.fillStyle = 'rgba(0,0,0,.62)';
        roundRect(ctx, W / 2 - tw / 2 - 10, y + i * size * 1.3 - 4, tw + 20, size * 1.24, size * 0.24);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(ln, W / 2, y + i * size * 1.3);
      });
      ctx.textAlign = 'left';
    }
    // 구간 표시
    if (opts.badge) {
      ctx.font = '700 ' + Math.round(W * 0.028) + 'px ' + FONT;
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(opts.badge, W * 0.06, H - W * 0.055);
    }
    // 9:16 프레임 표기
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function drawClip() {
    const cv = $('#clipCanvas'); if (!cv) return;
    const ctx = cv.getContext('2d');
    drawClipFrame(ctx, cv.width, cv.height, { badge: state.clip.segs.length ? 'SEG 1/' + state.clip.segs.length : '' });
  }

  /* ---------------- TTS ---------------- */
  function ttsSentences() {
    return String(state.clip.tts.script || '').split('\n').map(s => s.trim()).filter(Boolean);
  }

  function renderTtsTimeline() {
    const box = $('#ttsTimeline'); if (!box) return;
    const t = state.clip.tts;
    if (!t.timeline || !t.timeline.length) {
      box.innerHTML = '<tr><td colspan="4" style="color:var(--dim2);padding:8px">음성을 만들면 문장별 시간표가 나옵니다.</td></tr>';
      return;
    }
    box.innerHTML = t.timeline.map((r, i) =>
      '<tr><td class="num">' + pad(i + 1) + '</td><td>' + esc((r.text || '').slice(0, 26)) + '</td>' +
      '<td class="num">' + r.start.toFixed(2) + '~' + r.end.toFixed(2) + 's</td>' +
      '<td><div class="bar" style="width:' + Math.round(r.dur / (t.total || 1) * 100) + '%"></div></td></tr>').join('');
  }

  async function buildTts() {
    const script = ($('#ttsScript') ? $('#ttsScript').value : state.clip.tts.script).trim();
    if (!script) { toast('대본을 먼저 입력하세요', 'bad'); return; }
    const sents = script.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 30);
    const voice = $('#ttsVoice') ? $('#ttsVoice').value : 'kore';
    const gap = $('#ttsGap') ? Number($('#ttsGap').value) : 0.3;
    const btn = $('#btnTts'), st = $('#ttsStatus'), mode = $('#ttsMode');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 만드는 중';
    const useGemini = hasAI();
    let modeUsed = useGemini ? 'gemini' : 'demo';
    const buffers = [], timeline = [];
    let t = 0;
    try {
      for (let i = 0; i < sents.length; i++) {
        if (st) st.textContent = '음성 ' + (i + 1) + '/' + sents.length + '…';
        let buf;
        if (useGemini) {
          try { buf = await geminiTTS(sents[i], voice); }
          catch (e) { modeUsed = 'mixed'; buf = synthSpeechBuffer(sents[i], { voice }); }
        } else buf = synthSpeechBuffer(sents[i], { voice });
        buffers.push(buf);
        timeline.push({ i, text: sents[i], start: t, dur: buf.duration, end: t + buf.duration });
        t += buf.duration + gap;
      }
      const total = timeline.length ? timeline[timeline.length - 1].end : 0;
      clipAudio = { buffers, timeline, total };
      state.clip.tts = { script, voice, gap, timeline: timeline.map(r => ({ i: r.i, text: r.text, start: r.start, dur: r.dur, end: r.end })), total, mode: modeUsed };
      renderTtsTimeline();
      if (mode) { mode.className = 'badge ' + (modeUsed === 'gemini' ? 'live' : modeUsed === 'mixed' ? 'demo' : 'demo'); mode.textContent = modeUsed === 'gemini' ? 'Gemini TTS' : modeUsed === 'mixed' ? '혼합' : '데모 합성음'; }
      if (st) st.textContent = '';
      const tot = $('#ttsTotal');
      if (tot) tot.textContent = sents.length + '문장 · ' + total.toFixed(1) + '초 · 간격 ' + gap + 's · ' + ttsVoice(voice).name;
      toast('음성 ' + total.toFixed(1) + '초 완성', 'good');
      logActivity('🔊', 'TTS ' + sents.length + '문장 · ' + total.toFixed(1) + '초 · ' + ttsVoice(voice).name);
      persistAll();
    } catch (e) {
      if (st) st.textContent = errMsg(e);
      toast('음성 실패: ' + errMsg(e), 'bad');
    } finally { btn.disabled = false; btn.innerHTML = '🔊 음성 만들기'; }
  }

  function playAudioPreview() {
    if (!clipAudio.buffers.length) return;
    const ac = getAC();
    const start = ac.currentTime + 0.08;
    clipAudio.timeline.forEach((r, i) => {
      const src = ac.createBufferSource(); src.buffer = clipAudio.buffers[i];
      const g = ac.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(ac.destination);
      try { src.start(start + r.start); } catch (e) {}
    });
  }

  /* ---------------- segments / preview ---------------- */
  function effectiveSegments() {
    if (state.clip.segs.length) return state.clip.segs.slice();
    const v = videoById(state.clip.activeVideo);
    if (!v) return [];
    return [{ id: 'full', videoId: v.id, start: 0, end: Math.min(v.duration, 30) }];
  }

  function seekTo(v, t, timeout) {
    return new Promise(res => {
      let done = false;
      const finish = () => { if (done) return; done = true; v.removeEventListener('seeked', finish); res(); };
      v.addEventListener('seeked', finish);
      try { v.currentTime = clamp(t, 0, Math.max(0, (v.duration || 0) - 0.05)); } catch (e) { finish(); }
      setTimeout(finish, timeout || 1200);
    });
  }

  let clipPlaying = false;
  async function previewSegments() {
    const segs = effectiveSegments();
    if (!segs.length) { toast('영상이 없습니다', 'bad'); return; }
    if (clipPlaying) { clipPlaying = false; return; }
    clipPlaying = true;
    const cv = $('#clipCanvas');
    const ctx = cv.getContext('2d');
    const btn = $('#btnPreviewSeg'); const old = btn.innerHTML; btn.innerHTML = '■ 정지';
    for (const seg of segs) {
      if (!clipPlaying) break;
      const v = clipEls[seg.videoId]; if (!v) continue;
      await seekTo(v, seg.start);
      try { await v.play(); } catch (e) {}
      await new Promise(resolve => {
        const t0 = performance.now();
        function frame() {
          if (!clipPlaying) { resolve(); return; }
          drawClipFrame(ctx, cv.width, cv.height, { video: v, badge: '재생 · ' + seg.start.toFixed(1) + '→' + seg.end.toFixed(1) + 's' });
          if (v.currentTime >= seg.end - 0.03 || (performance.now() - t0) / 1000 > (seg.end - seg.start) + 0.6) { resolve(); return; }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      try { v.pause(); } catch (e) {}
    }
    clipPlaying = false;
    btn.innerHTML = old;
    drawClip();
  }

  /* ---------------- WebM export ---------------- */
  let exporting = false;
  function pickMime() {
    const cands = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const c of cands) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; } catch (e) {} }
    return '';
  }

  async function exportClip() {
    if (exporting) { toast('이미 내보내는 중입니다'); return; }
    if (!window.MediaRecorder) { toast('이 브라우저는 MediaRecorder를 지원하지 않습니다', 'bad'); return; }
    const segs = effectiveSegments();
    if (!segs.length) { toast('영상을 올리고 구간을 추가하세요', 'bad'); return; }
    const totalVideo = segs.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
    if (totalVideo < 0.3) { toast('구간이 너무 짧습니다', 'bad'); return; }
    const cap = Math.min(totalVideo, 90);
    exporting = true; clipPlaying = false;
    const W = 720, H = 1280;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;height:1280px';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const stream = cv.captureStream(30);
    const ac = getAC();
    const dest = ac.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4200000, audioBitsPerSecond: 128000 } : undefined);
    } catch (e) {
      toast('녹화기를 시작할 수 없습니다: ' + e.message, 'bad'); cv.remove(); exporting = false; return;
    }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })); });
    const btn = $('#btnExportClip'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 내보내는 중';
    const bar = $('#clipProg'), info = $('#clipExportInfo');
    const startAt = ac.currentTime + 0.2;
    const sources = [];
    if (clipAudio.buffers.length) {
      clipAudio.timeline.forEach((r, i) => {
        const src = ac.createBufferSource(); src.buffer = clipAudio.buffers[i];
        const g = ac.createGain(); g.gain.value = 1;
        src.connect(g); g.connect(dest);
        try { src.start(startAt + r.start); sources.push(src); } catch (e) {}
      });
    }
    rec.start(400);
    drawClipFrame(ctx, W, H, { badge: 'SOPOST' });
    let elapsed = 0;
    try {
      for (const seg of segs) {
        const v = clipEls[seg.videoId]; if (!v) continue;
        await seekTo(v, seg.start);
        try { await v.play(); } catch (e) {}
        await new Promise(resolve => {
          const t0 = performance.now();
          const dur = Math.min(seg.end - seg.start, cap - elapsed);
          function frame() {
            try { drawClipFrame(ctx, W, H, { video: v, badge: 'SOPOST · ' + (state.clip.title || '') }); } catch (e) {}
            const el = (performance.now() - t0) / 1000;
            if (bar) bar.style.width = Math.round(Math.min(1, (elapsed + el) / cap) * 100) + '%';
            if (info) info.textContent = '녹화 중… ' + (elapsed + el).toFixed(1) + ' / ' + cap.toFixed(1) + '초';
            if (el >= dur || elapsed + el >= cap) { resolve(); return; }
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
        try { v.pause(); } catch (e) {}
        elapsed += seg.end - seg.start;
        if (elapsed >= cap) break;
      }
      // 마지막 프레임 유지
      await new Promise(r => setTimeout(r, 120));
    } finally {
      try { rec.stop(); } catch (e) {}
    }
    const blob = await done;
    sources.forEach(s => { try { s.stop(); } catch (e) {} });
    stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    dest.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    cv.remove();
    exporting = false;
    btn.disabled = false; btn.innerHTML = '🎬 WebM 내보내기';
    if (!blob || blob.size < 1024) {
      if (info) info.textContent = '내보내기 실패 · 데이터가 없습니다(브라우저가 이 영상 형식을 못 읽을 수 있습니다)';
      toast('WebM 데이터가 만들어지지 않았습니다', 'bad');
      return;
    }
    const duration = elapsed;
    state.clip.lastExport = { size: blob.size, duration, segments: segs.length, at: Date.now() };
    const name = 'sopost-clip-' + todayISO().replace(/-/g, '') + '.webm';
    download(blob, name);
    const wrap = $('#clipDlWrap'), a = $('#clipDl');
    if (wrap && a) { wrap.classList.remove('hidden'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = '⬇ ' + name + ' (' + (blob.size / 1048576).toFixed(2) + 'MB)'; }
    if (info) info.textContent = '완료 · ' + (blob.size / 1048576).toFixed(2) + 'MB · ' + duration.toFixed(1) + '초 · 720×1280 · 구간 ' + segs.length + '개' + (clipAudio.buffers.length ? ' · 음성 포함' : '');
    if (bar) bar.style.width = '100%';
    state.exported++;
    toast('WebM 완성 · ' + (blob.size / 1048576).toFixed(2) + 'MB', 'good');
    logActivity('🎬', 'WebM 내보내기 · ' + duration.toFixed(1) + '초 · ' + (blob.size / 1048576).toFixed(2) + 'MB');
    persistAll();
    return blob;
  }

  /* ---------------- bind ---------------- */
  function bindClip() {
    const file = $('#clipFile');
    if (file) file.addEventListener('change', () => { addClipFiles(file.files); file.value = ''; });
    const sel = $('#clipVideoSel');
    if (sel) sel.addEventListener('change', () => {
      state.clip.activeVideo = sel.value;
      const v = videoById(sel.value);
      if (v) {
        const inR = $('#segIn'), outR = $('#segOut');
        if (inR) { inR.max = v.duration; inR.value = 0; }
        if (outR) { outR.max = v.duration; outR.value = Math.min(v.duration, 3).toFixed(1); }
      }
      renderClipVideos(); drawClip(); persistAll();
    });
    ['#segIn', '#segOut'].forEach(s => { const el = $(s); if (el) el.addEventListener('input', () => { updateSegLabels(); drawClip(); }); });
    const add = $('#btnAddSeg');
    if (add) add.addEventListener('click', () => {
      if (state.clip.segs.length >= 5) { toast('구간은 최대 5개까지입니다', 'bad'); return; }
      const v = videoById(state.clip.activeVideo);
      if (!v) { toast('영상을 먼저 올리세요', 'bad'); return; }
      const a = Number($('#segIn').value), b = Number($('#segOut').value);
      if (!(b > a + 0.1)) { toast('끝이 시작보다 커야 합니다', 'bad'); return; }
      state.clip.segs.push({ id: uid('g'), videoId: v.id, start: a, end: Math.min(b, v.duration) });
      renderSegs(); persistAll();
      toast('구간 ' + state.clip.segs.length + '개 · ' + state.clip.segs.reduce((x, s) => x + (s.end - s.start), 0).toFixed(1) + '초', 'good');
    });
    const segsBox = $('#segs');
    if (segsBox) segsBox.addEventListener('click', e => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      state.clip.segs = state.clip.segs.filter(s => s.id !== b.dataset.del);
      renderSegs(); persistAll();
    });
    const clr = $('#btnClearSegs');
    if (clr) clr.addEventListener('click', () => { state.clip.segs = []; renderSegs(); persistAll(); toast('구간을 비웠습니다'); });
    const pv = $('#btnPreviewSeg'); if (pv) pv.addEventListener('click', previewSegments);

    const safe = $('#safeSel');
    if (safe) safe.addEventListener('change', () => { state.clip.safe = safe.value; drawClip(); persistAll(); toast('Safe Zone · ' + safe.options[safe.selectedIndex].text); });

    const tts = $('#ttsScript');
    if (tts) tts.addEventListener('input', () => { state.clip.tts.script = tts.value; persistAll(); });
    ['#ttsVoice', '#ttsGap'].forEach(s => { const el = $(s); if (el) el.addEventListener('change', () => { if (s === '#ttsVoice') state.clip.tts.voice = el.value; else state.clip.tts.gap = Number(el.value); persistAll(); }); });
    const bt = $('#btnTts'); if (bt) bt.addEventListener('click', () => { buildTts(); playAudioPreview(); });

    const tit = $('#clipTitle');
    if (tit) tit.addEventListener('input', () => { state.clip.title = tit.value; drawClip(); persistAll(); });
    const sub = $('#clipSub');
    if (sub) sub.addEventListener('input', () => { state.clip.sub = sub.value; drawClip(); persistAll(); });
    const ton = $('#clipTitleOn');
    if (ton) ton.addEventListener('change', () => { state.clip.titleOn = ton.checked; drawClip(); persistAll(); });
    const son = $('#clipSubOn');
    if (son) son.addEventListener('change', () => { state.clip.subOn = son.checked; drawClip(); persistAll(); });
    const ss = $('#clipSubSize');
    if (ss) ss.addEventListener('input', () => { state.clip.subSize = Number(ss.value); $('#subSizeVal').textContent = ss.value; drawClip(); persistAll(); });
    const sp = $('#clipSubPos');
    if (sp) sp.addEventListener('input', () => { state.clip.subPos = Number(sp.value); $('#subPosVal').textContent = sp.value + '%'; drawClip(); persistAll(); });
    const ex = $('#btnExportClip'); if (ex) ex.addEventListener('click', exportClip);
  }

  function initClip() {
    bindClip();
    const setV = (sel, v) => { const el = $(sel); if (el && v != null) el.value = v; };
    setV('#ttsScript', state.clip.tts.script);
    setV('#ttsVoice', state.clip.tts.voice);
    setV('#ttsGap', String(state.clip.tts.gap));
    setV('#safeSel', state.clip.safe);
    setV('#clipTitle', state.clip.title);
    setV('#clipSub', state.clip.sub);
    setV('#clipSubSize', state.clip.subSize);
    setV('#clipSubPos', state.clip.subPos);
    const ton = $('#clipTitleOn'); if (ton) ton.checked = state.clip.titleOn !== false;
    const son = $('#clipSubOn'); if (son) son.checked = state.clip.subOn !== false;
    const sv = $('#subSizeVal'); if (sv) sv.textContent = state.clip.subSize;
    const pv = $('#subPosVal'); if (pv) pv.textContent = state.clip.subPos + '%';
    // 저장된 타임라인은 오디오 버퍼가 없으므로 안내만 남긴다
    renderTtsTimeline();
    const tot = $('#ttsTotal');
    if (tot && state.clip.tts.total) tot.textContent = state.clip.tts.timeline.length + '문장 · ' + state.clip.tts.total.toFixed(1) + '초 (저장됨 · 다시 만들면 소리 포함)';
    renderClipVideos(); renderSegs(); drawClip();
  }
