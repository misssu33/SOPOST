/* =========================================================
   SOPOST · Posteady 스타일 SNS 올인원 스튜디오
   00-core.js — 유틸 · 상태 · 저장 · 화면 전환 · ZIP 빌더
   (build.py가 js/*.js 를 순서대로 이어 붙여 하나의 IIFE로 만든다)
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- utils ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = n => {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '만';
    return n.toLocaleString('ko-KR');
  };
  const fmtSec = t => {
    t = Math.max(0, Number(t) || 0);
    return t < 60 ? t.toFixed(1) + 's' : Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60).toFixed(1);
  };
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  const uid = (() => { let n = 0; return p => (p || 'i') + (++n).toString(36) + Date.now().toString(36).slice(-4); })();

  function hash32(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (arr, r) => arr[Math.floor((r ? r() : Math.random()) * arr.length) % arr.length];
  const uniq = arr => Array.from(new Set(arr.filter(Boolean)));

  function toast(msg, kind) {
    const t = $('#toast'); if (!t) return;
    $('#toastMsg').textContent = msg;
    t.className = 'show ' + (kind || '');
    t.querySelector('.ico').textContent = kind === 'bad' ? '⚠️' : kind === 'good' ? '✅' : 'ℹ️';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = ''; }, 3400);
  }

  /* ---------------- storage ---------------- */
  const LS = {
    keys: 'sp.keys.v1', brand: 'sp.brand.v1', collect: 'sp.collect.v1',
    carousel: 'sp.carousel.v1', post: 'sp.post.v1', clip: 'sp.clip.v1',
    cal: 'sp.cal.v1', ana: 'sp.ana.v1', act: 'sp.act.v1', exp: 'sp.exported.v1'
  };
  function lsGet(key, fb) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; } catch (e) { return fb; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); flashSaved(); return true; }
    catch (e) { flashSaved(true); return false; }
  }
  let savedT = null;
  function flashSaved(failed) {
    const b = $('#saveBadge'); if (!b) return;
    if (failed) { b.className = 'badge danger'; b.innerHTML = '<span class="dot"></span>저장 공간 부족'; return; }
    b.className = 'badge live';
    b.innerHTML = '<span class="dot"></span>저장됨';
    clearTimeout(savedT);
    savedT = setTimeout(() => { b.className = 'badge'; b.innerHTML = '<span class="dot"></span>자동 저장'; }, 1500);
  }

  /* ---------------- state ---------------- */
  const DEFAULT_RULES = {
    tone: '담백한 존댓말, 과장 없이 사실 중심',
    hooking: ['숫자로 시작하기', '질문으로 던지기', '결론을 먼저 말하기'],
    cta: ['저장해 두고 필요할 때 꺼내 보세요', '더 자세한 비교는 프로필 링크에'],
    banned: ['최저가', '무조건', '대박', '미친', '완벽'],
    required: ['자세한 비교는 프로필 링크']
  };

  const state = {
    view: 'home',
    demo: true,
    keys: [],
    activeKey: null,
    brand: {
      samples: [{ kind: '내 글', text: '', url: '' }, { kind: '내 글', text: '', url: '' }, { kind: '링크', text: '', url: '' }, { kind: '샘플 파일', text: '', url: '' }, { kind: '내 글', text: '', url: '' }],
      A: null, B: null, picked: null, mode: 'demo', savedAt: 0,
      rules: JSON.parse(JSON.stringify(DEFAULT_RULES))
    },
    collect: { items: [], aiIdeas: [], myIdeas: [], picked: null, remixes: [], rss: { feeds: '', channels: '', keywords: '', perDay: 5, tz: 'Asia/Seoul' } },
    carousel: { ratio: '4:5', struct: 'problem', slides: [], idx: 0, handle: '@sosone', handleOn: true },
    post: {
      base: '', active: 'instagram', hashtags: true, brand: true,
      platforms: {
        instagram: { text: '' }, tiktok: { text: '' }, youtube: { text: '' },
        threads: { text: '' }, x: { text: '' }, blog: { text: '' }
      },
      thread: [], firstComment: '', copied: 0
    },
    clip: {
      videos: [], segs: [], activeVideo: null, safe: 'youtube',
      tts: { script: '', voice: 'kore', gap: 0.3, timeline: [], total: 0, mode: 'demo' },
      title: '3개월 써 본 무선청소기', sub: '남은 기준은 두 가지', titleOn: true, subOn: true, subSize: 44, subPos: 78,
      lastExport: null
    },
    cal: { ym: '2026-11', events: [], editing: null },
    ana: { posts: [], recs: [], recsMode: 'demo' },
    activity: [],
    exported: 0
  };
  let clipAudio = { buffers: [], timeline: [], total: 0 };

  /* ---------------- activity ---------------- */
  function logActivity(ic, text) {
    state.activity.unshift({ ic, text, at: Date.now() });
    state.activity = state.activity.slice(0, 60);
    lsSet(LS.act, state.activity);
    renderActivity();
  }
  function renderActivity() {
    const box = $('#homeActivity'), cnt = $('#homeActCount'), empty = $('#homeActEmpty');
    if (!box) return;
    if (!state.activity.length) {
      box.innerHTML = ''; if (empty) empty.classList.remove('hidden');
      if (cnt) cnt.textContent = '0건';
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (cnt) cnt.textContent = state.activity.length + '건';
    box.innerHTML = state.activity.slice(0, 12).map(a => {
      const d = new Date(a.at);
      return '<div class="act"><span class="ic">' + a.ic + '</span><div class="body">' + esc(a.text) + '</div>' +
        '<span class="tm">' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</span></div>';
    }).join('');
  }

  /* ---------------- view routing ---------------- */
  const VIEW_TITLES = {
    home: '홈', brand: '설정 · 브랜드 보이스', collect: '1 기획', carousel: '2 카드뉴스',
    post: '3 포스트 · 스레드', clip: '4 클립 스튜디오', calendar: '5 월간 캘린더',
    analytics: '6 성과 분석', limits: '브라우저 한계'
  };
  function setView(v) {
    if (!VIEW_TITLES[v]) v = 'home';
    state.view = v;
    $$('.panel').forEach(p => p.classList.toggle('show', p.dataset.view === v));
    $$('.nav-btn').forEach(b => {
      const on = b.dataset.view === v;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
    if (window.innerWidth <= 860) {
      const on = document.querySelector('.nav-btn.active');
      if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = (v === 'home' ? 'SOPOST' : VIEW_TITLES[v] + ' · SOPOST');
  }

  /* ---------------- downloads ---------------- */
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.position = 'fixed'; a.style.left = '-9999px';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
    return url;
  }
  function downloadText(text, name, mime) {
    return download(new Blob([text], { type: mime || 'application/json;charset=utf-8' }), name);
  }
  function canvasBlob(cv, type) {
    return new Promise(res => {
      if (cv.toBlob) cv.toBlob(b => res(b), type || 'image/png', 0.96);
      else {
        const data = atob(cv.toDataURL(type || 'image/png').split(',')[1]);
        const u8 = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) u8[i] = data.charCodeAt(i);
        res(new Blob([u8], { type: type || 'image/png' }));
      }
    });
  }

  /* ---------------- clipboard ---------------- */
  async function copyText(text, label) {
    const t = String(text || '');
    if (!t.trim()) { toast('복사할 내용이 없습니다', 'bad'); return false; }
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(t); ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch (e) { ok = false; }
    }
    if (ok) toast((label || '복사') + ' 완료 · ' + t.length + '자', 'good');
    else toast('복사가 막혔습니다. 직접 선택해 주세요.', 'bad');
    return ok;
  }

  /* ---------------- pure JS ZIP (store, no compression) ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /**
   * files: [{name, data(Uint8Array)}] → Blob (application/zip)
   * ZIP 스펙: local file header + central directory + EOCD. 압축 없이 stored(0).
   * UTF-8 파일명 플래그(bit 11)를 켜서 한글 이름도 깨지지 않는다.
   */
  function zipStore(files) {
    const enc = new TextEncoder();
    const d = new Date();
    const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF;
    const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
      const nameU8 = enc.encode(f.name);
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      const crc = crc32(data);
      const lh = new Uint8Array(30 + nameU8.length);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);          // version needed
      lv.setUint16(6, 0x0800, true);      // utf-8 flag
      lv.setUint16(8, 0, true);           // stored
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameU8.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nameU8, 30);
      locals.push(lh, data);

      const ch = new Uint8Array(46 + nameU8.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameU8.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameU8, 46);
      centrals.push(ch);
      offset += lh.length + data.length;
    }
    const centralSize = centrals.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob(locals.concat(centrals, [end]), { type: 'application/zip' });
  }

  /* ---------------- common formatters ---------------- */
  const PLATFORM = {
    ig: { key: 'instagram', name: '인스타그램', icon: '📷', cls: 'p-ig', limit: 2200 },
    tt: { key: 'tiktok', name: '틱톡', icon: '🎵', cls: 'p-tt', limit: 2200 },
    yt: { key: 'youtube', name: '유튜브', icon: '▶️', cls: 'p-yt', limit: 5000 },
    th: { key: 'threads', name: '스레드', icon: '🧵', cls: 'p-th', limit: 500 },
    x: { key: 'x', name: 'X', icon: '𝕏', cls: 'p-x', limit: 280 },
    blog: { key: 'blog', name: '블로그', icon: '📝', cls: 'p-blog', limit: 0 }
  };
  const PLATFORM_ORDER = ['instagram', 'tiktok', 'youtube', 'threads', 'x', 'blog'];
  const platKeyName = k => (Object.keys(PLATFORM).find(p => PLATFORM[p].key === k) || 'ig');
  function platMeta(key) { return PLATFORM[platKeyName(key)]; }

  function hitBanned(text) {
    const list = (state.brand.rules.banned || []).filter(Boolean);
    const s = String(text || '');
    return list.filter(w => s.indexOf(w) >= 0);
  }
  function countChars(s) { return Array.from(String(s || '')).length; }

  function updateModeBadge() {
    const b = $('#modeBadge'); if (!b) return;
    const real = state.keys.filter(k => k.value).length;
    const usable = state.keys.filter(k => k.value && k.status !== 'exhausted').length;
    if (usable > 0) { b.className = 'badge live'; b.innerHTML = '<span class="dot"></span>AI 연결 · 키 ' + usable + '/' + (real || state.keys.length) + ' 사용'; }
    else if (real > 0) { b.className = 'badge danger'; b.innerHTML = '<span class="dot"></span>키 한도 초과 · 데모로 전환'; }
    else { b.className = 'badge demo'; b.innerHTML = '<span class="dot"></span>데모 모드 · 키 0/5'; }
    state.demo = usable === 0;
    const ks = $('#keySummary'); if (ks) ks.textContent = usable + '개 사용 가능 / ' + state.keys.length + '칸';
  }
  function updateBrandBadge() {
    const b = $('#brandBadge'); if (!b) return;
    if (state.brand.savedAt) {
      const ab = state.brand.picked ? ' · ' + state.brand.picked + '안' : '';
      b.className = 'badge violet';
      b.innerHTML = '<span class="dot"></span>브랜드 규칙 저장됨' + ab;
    } else {
      b.className = 'badge';
      b.innerHTML = '<span class="dot"></span>브랜드 규칙 없음';
    }
    const st = $('#brandRulesState');
    if (st) st.textContent = state.brand.savedAt ? '저장됨 · ' + new Date(state.brand.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '저장 안 됨';
  }

  let saveTimer = null;
  function persistAll(now) {
    const doIt = () => {
      lsSet(LS.keys, { keys: state.keys.map(k => ({ id: k.id, value: k.value, status: k.status, used: k.used, note: k.note })), activeKey: state.activeKey });
      lsSet(LS.brand, state.brand);
      lsSet(LS.collect, state.collect);
      const deck = JSON.parse(JSON.stringify(state.carousel));
      deck.slides.forEach(s => { if (s.img && s.img.length > 400000) s.img = null; });
      if (!lsSet(LS.carousel, deck)) { deck.slides.forEach(s => { s.img = null; }); lsSet(LS.carousel, deck); }
      lsSet(LS.post, state.post);
      const clip = JSON.parse(JSON.stringify({ segs: state.clip.segs, safe: state.clip.safe, tts: { script: state.clip.tts.script, voice: state.clip.tts.voice, gap: state.clip.tts.gap, timeline: state.clip.tts.timeline, total: state.clip.tts.total, mode: state.clip.tts.mode }, title: state.clip.title, sub: state.clip.sub, titleOn: state.clip.titleOn, subOn: state.clip.subOn, subSize: state.clip.subSize, subPos: state.clip.subPos }));
      lsSet(LS.clip, clip);
      lsSet(LS.cal, state.cal);
      lsSet(LS.ana, state.ana);
      lsSet(LS.exp, state.exported);
    };
    clearTimeout(saveTimer);
    if (now) doIt(); else saveTimer = setTimeout(doIt, 260);
  }
