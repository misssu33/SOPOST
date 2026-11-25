  /* =========================================================
     20-collect.js — 1 기획: 수집 · 리믹스 · 글감 보드 · 수집기 JSON
     ========================================================= */

  const PLAT_DETECT = [
    [/instagram\.com/i, '인스타그램', '📷'], [/tiktok\.com/i, '틱톡', '🎵'],
    [/youtube\.com|youtu\.be/i, '유튜브', '▶️'], [/threads\.(net|com)/i, '스레드', '🧵'],
    [/(^|\.)x\.com|twitter\.com/i, 'X', '𝕏'], [/blog\.naver\.com|naver\.com\/blog/i, '블로그', '📝'],
    [/(coupang|smartstore|naver\.com\/shopping)/i, '쇼핑', '🛒']
  ];
  function detectPlatform(url) {
    for (const [re, name, icon] of PLAT_DETECT) if (re.test(url)) return { name, icon };
    return { name: '기타', icon: '🔗' };
  }
  function titleFromUrl(url) {
    try {
      const u = new URL(url);
      const path = decodeURIComponent(u.pathname).replace(/\/+$/, '');
      const seg = path.split('/').filter(Boolean).pop() || u.hostname;
      return (u.hostname.replace(/^www\./, '') + ' · ' + seg).slice(0, 90);
    } catch (e) { return String(url).slice(0, 90); }
  }
  function firstLine(text, n) {
    const line = String(text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '(제목 없음)';
    return line.slice(0, n || 60);
  }

  function addCollectItem(item) {
    state.collect.items.unshift(Object.assign({ id: uid('c'), at: Date.now() }, item));
    if (state.collect.items.length > 60) state.collect.items.length = 60;
    renderCollect();
    persistAll();
  }

  function renderCollect() {
    const box = $('#collectList'), empty = $('#collectEmpty'), cnt = $('#collectCount');
    if (!box) return;
    if (cnt) cnt.textContent = state.collect.items.length + '개';
    if (!state.collect.items.length) {
      box.innerHTML = ''; if (empty) empty.classList.remove('hidden'); return;
    }
    if (empty) empty.classList.add('hidden');
    box.innerHTML = state.collect.items.map(it => {
      const ic = it.icon || '🔗';
      return '<div class="item" data-id="' + it.id + '">' +
        '<span class="ic">' + ic + '</span>' +
        '<div class="body"><b>' + esc(it.title) + '</b><small>' + esc(it.platform || it.kind) + (it.url ? ' · ' + esc(it.url.slice(0, 58)) : '') + '</small>' +
        (it.text ? '<p>' + esc(it.text.slice(0, 120)) + (it.text.length > 120 ? '…' : '') + '</p>' : '') + '</div>' +
        '<div class="acts"><button class="btn xs" type="button" data-act="idea">글감으로</button>' +
        '<button class="btn xs ghost" type="button" data-act="remix">리믹스</button>' +
        '<button class="btn xs ghost" type="button" data-act="del">✕</button></div></div>';
    }).join('');
  }

  async function collectFromFiles(files) {
    let n = 0;
    for (const f of Array.from(files || [])) {
      try {
        const text = await f.text();
        addCollectItem({ kind: 'file', title: f.name, platform: '파일 · ' + Math.max(1, Math.round(f.size / 1024)) + 'KB', text: text.slice(0, 4000), file: f.name });
        n++;
      } catch (e) { toast(f.name + ' 읽기 실패', 'bad'); }
    }
    const note = $('#ctFileNote');
    if (note && n) { note.className = 'note ok'; note.textContent = n + '개 파일을 브라우저에서 읽어 수집 목록에 넣었습니다(서버 전송 없음).'; }
  }

  function bindCollect() {
    $$('#ctTabs button').forEach(b => b.addEventListener('click', () => {
      $$('#ctTabs button').forEach(x => x.classList.toggle('on', x === b));
      ['link', 'text', 'file'].forEach(k => { const p = $('#ctPane-' + k); if (p) p.classList.toggle('hidden', k !== b.dataset.ct); });
    }));
    const add = $('#btnCollectAdd');
    if (add) add.addEventListener('click', () => {
      const tab = ($('#ctTabs .on') || {}).dataset ? $('#ctTabs .on').dataset.ct : 'link';
      let n = 0;
      if (tab === 'link') {
        const raw = ($('#ctLink').value || '').split('\n').map(s => s.trim()).filter(Boolean);
        raw.slice(0, 20).forEach(url => {
          if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
          const p = detectPlatform(url);
          addCollectItem({ kind: 'link', title: titleFromUrl(url), platform: p.name, icon: p.icon, url });
          n++;
        });
        if (n) $('#ctLink').value = '';
      } else if (tab === 'text') {
        const text = ($('#ctText').value || '').trim();
        if (text) { addCollectItem({ kind: 'text', title: firstLine(text, 70), platform: '텍스트', icon: '📝', text }); n = 1; $('#ctText').value = ''; }
      } else {
        toast('파일은 선택하면 바로 목록에 들어갑니다');
      }
      if (n) { toast(n + '개를 수집했습니다', 'good'); logActivity('📥', '수집 ' + n + '개 추가'); }
      else if (tab !== 'file') toast('넣을 내용이 없습니다', 'bad');
    });
    const file = $('#ctFile');
    if (file) file.addEventListener('change', () => {
      const nm = $('#ctFileName');
      if (nm && file.files.length) nm.textContent = Array.from(file.files).map(f => f.name).join(', ').slice(0, 60);
      collectFromFiles(file.files); file.value = '';
    });
    const clr = $('#btnClearCollect');
    if (clr) clr.addEventListener('click', () => {
      if (!state.collect.items.length) return;
      state.collect.items = []; renderCollect(); persistAll(); toast('수집 목록을 비웠습니다');
    });
    const list = $('#collectList');
    if (list) list.addEventListener('click', e => {
      const item = e.target.closest('.item'); if (!item) return;
      const it = state.collect.items.find(x => x.id === item.dataset.id); if (!it) return;
      const act = (e.target.closest('[data-act]') || {}).dataset ? e.target.closest('[data-act]').dataset.act : '';
      if (act === 'del') { state.collect.items = state.collect.items.filter(x => x.id !== it.id); renderCollect(); persistAll(); }
      if (act === 'remix') { $('#remixSrc').value = it.text || it.title; $('#remixSrc').scrollIntoView({ block: 'center' }); toast('원본 글에 넣었습니다 · 리믹스를 눌러 주세요'); }
      if (act === 'idea') {
        const idea = { id: uid('m'), text: it.text ? firstLine(it.text, 80) : it.title, from: it.url || it.kind, tag: '내 글감' };
        state.collect.myIdeas.unshift(idea);
        state.collect.picked = idea.id;
        renderIdeas(); persistAll(); toast('내 글감에 추가하고 선택했습니다', 'good');
      }
    });

    // remix
    const rb = $('#btnRemix');
    if (rb) rb.addEventListener('click', doRemix);

    // ideas
    const gi = $('#btnGenIdeas');
    if (gi) gi.addEventListener('click', genIdeas);
    const ai = $('#btnAddIdea');
    if (ai) ai.addEventListener('click', () => {
      const t = ($('#myIdeaText').value || '').trim();
      if (!t) { toast('글감을 입력하세요', 'bad'); return; }
      const idea = { id: uid('m'), text: t, from: '', tag: '내 글감' };
      state.collect.myIdeas.unshift(idea); state.collect.picked = idea.id;
      $('#myIdeaText').value = '';
      renderIdeas(); persistAll(); toast('내 글감에 추가했습니다', 'good');
    });
    const mt = $('#myIdeaText');
    if (mt) mt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#btnAddIdea').click(); } });

    const board = $('#panel-collect');
    if (board) board.addEventListener('click', e => {
      const card = e.target.closest('.idea'); if (!card) return;
      const id = card.dataset.id;
      const col = card.dataset.col;
      if (e.target.closest('[data-act="del"]')) {
        state.collect[col === 'ai' ? 'aiIdeas' : 'myIdeas'] = state.collect[col === 'ai' ? 'aiIdeas' : 'myIdeas'].filter(x => x.id !== id);
        if (state.collect.picked === id) state.collect.picked = null;
        renderIdeas(); persistAll(); return;
      }
      state.collect.picked = id;
      renderIdeas(); persistAll();
    });
    const tc = $('#btnIdeaToCarousel');
    if (tc) tc.addEventListener('click', () => { const t = pickedText(); if (!t) return toast('글감을 먼저 고르세요', 'bad'); sendToCarousel(t); });
    const tp = $('#btnIdeaToPost');
    if (tp) tp.addEventListener('click', () => { const t = pickedText(); if (!t) return toast('글감을 먼저 고르세요', 'bad'); sendToPost(t); });

    // rss
    const ex = $('#btnExportCollector');
    if (ex) ex.addEventListener('click', exportCollector);
    ['#rssFeeds', '#ytChannels', '#rssKeywords', '#rssPerDay', '#rssTz'].forEach(sel => {
      const el = $(sel);
      if (el) el.addEventListener('input', () => { readRss(); persistAll(); if (sel === '#rssPerDay' || sel === '#rssTz') renderCollectorPreview(); });
    });
    renderCollect();
  }

  function readRss() {
    const g = sel => { const el = $(sel); return el ? el.value : ''; };
    state.collect.rss = {
      feeds: g('#rssFeeds'), channels: g('#ytChannels'), keywords: g('#rssKeywords'),
      perDay: clamp(Number(g('#rssPerDay')) || 5, 1, 50), tz: g('#rssTz') || 'Asia/Seoul'
    };
  }
  function collectorPayload() {
    readRss();
    const r = state.collect.rss;
    return {
      app: 'SOPOST collector',
      version: 1,
      generatedAt: new Date().toISOString(),
      timezone: r.tz,
      output: 'sopost-collected.json',
      rss: { feeds: r.feeds.split('\n').map(s => s.trim()).filter(Boolean), maxPerDay: r.perDay },
      youtube: { channels: r.channels.split('\n').map(s => s.trim()).filter(Boolean), mode: 'channel-feed' },
      keywords: r.keywords.split(',').map(s => s.trim()).filter(Boolean),
      dedupe: { by: ['url', 'title'], windowDays: 30 },
      handoff: { module: 'collect', command: 'sopost-collector --config sopost-collector.json' },
      limits: { note: '브라우저는 주기 수집을 할 수 없습니다. 이 파일은 PC 수집기가 읽습니다.' }
    };
  }
  function renderCollectorPreview() {
    const pre = $('#collectorJson'); if (!pre) return;
    pre.textContent = JSON.stringify(collectorPayload(), null, 2);
  }
  function exportCollector() {
    const payload = collectorPayload();
    renderCollectorPreview();
    downloadText(JSON.stringify(payload, null, 2), 'sopost-collector.json');
    state.exported++;
    toast('sopost-collector.json 내보냈습니다', 'good');
    logActivity('📡', '수집기 설정 JSON 내보내기 · RSS ' + payload.rss.feeds.length + ' · 유튜브 ' + payload.youtube.channels.length);
  }

  /* ---------------- ideas ---------------- */
  const IDEA_DEFAULTS = [
    '3개월 써 보고 남은 기준 두 가지', '처음 사는 사람이 가장 많이 하는 실수',
    '스펙표에 없는 비교 기준', '값이 아니라 시간을 아끼는 선택', '안 쓰게 되는 물건의 공통점',
    '한 달 뒤에도 쓰는지 확인하는 법'
  ];
  function ideaPool() {
    const fromItems = state.collect.items.slice(0, 8).map(it => it.text ? firstLine(it.text, 80) : it.title);
    const brandHint = (state.brand.rules.tone || '').indexOf('구어') >= 0 ? '말 걸듯' : '정리형';
    const seeds = uniq(fromItems.concat(IDEA_DEFAULTS)).slice(0, 6);
    const angles = ['오류 깨기', '문제→해결', '비포·애프터', '체크리스트', '숫자 비교', '1년 후 후기', '초보자 가이드', '실패담'];
    const r = rng(hash32(seeds.join('|') + brandHint));
    return seeds.map((s, i) => ({
      id: uid('a'),
      text: s,
      tag: 'AI 글감',
      ang: angles[i % angles.length],
      why: '수집한 ' + (fromItems.length ? '재료' : '주제') + '에서 ' + angles[i % angles.length] + ' 각도로 자르면 새 글이 됩니다.'
    }));
  }

  function renderIdeas() {
    const ai = $('#aiIdeas'), mine = $('#myIdeas'), empty = $('#ideasEmpty');
    const card = (x, col) => '<div class="idea' + (state.collect.picked === x.id ? ' sel' : '') + '" data-id="' + x.id + '" data-col="' + col + '">' +
      '<div class="k">' + esc(x.tag || (col === 'ai' ? 'AI 글감' : '내 글감')) + (x.ang ? ' · ' + esc(x.ang) : '') + '</div>' +
      '<div class="t">' + esc(x.text) + '</div>' +
      '<div class="m">' + esc(x.why || x.from || '') + '</div>' +
      '<div class="acts"><span class="chip ' + (state.collect.picked === x.id ? 'lime' : '') + '">' + (state.collect.picked === x.id ? '선택됨' : '선택') + '</span>' +
      '<button class="btn xs ghost" type="button" data-act="del">✕</button></div></div>';
    if (ai) ai.innerHTML = state.collect.aiIdeas.map(x => card(x, 'ai')).join('');
    if (mine) mine.innerHTML = state.collect.myIdeas.map(x => card(x, 'mine')).join('');
    if (empty) empty.classList.toggle('hidden', !!(state.collect.aiIdeas.length || state.collect.myIdeas.length));
    const p = state.collect.picked ? findIdea(state.collect.picked) : null;
    const lbl = $('#pickedIdea');
    if (lbl) lbl.textContent = p ? '선택: ' + p.text.slice(0, 28) : '선택 없음';
    const tc = $('#btnIdeaToCarousel'), tp = $('#btnIdeaToPost');
    if (tc) tc.disabled = !p; if (tp) tp.disabled = !p;
  }
  function findIdea(id) {
    return state.collect.aiIdeas.concat(state.collect.myIdeas).find(x => x.id === id) || null;
  }
  function pickedText() {
    const p = state.collect.picked ? findIdea(state.collect.picked) : null;
    return p ? p.text : '';
  }

  function genIdeas() {
    state.collect.aiIdeas = ideaPool();
    if (!state.collect.picked) state.collect.picked = state.collect.aiIdeas[0].id;
    renderIdeas(); persistAll();
    toast('AI 글감 6개 · 수집 재료 ' + state.collect.items.length + '개 반영', 'good');
    logActivity('💡', 'AI 글감 6개 생성');
  }

  /* ---------------- remix ---------------- */
  const REMIX_ANGLES = ['오류 깨기', '문제→해결', '비포·애프터', '체크리스트', '1년 후 시점'];
  function demoRemix(src, n) {
    const core = firstLine(src, 40).replace(/[.。]$/, '');
    const r = rng(hash32(src + n));
    const items = [];
    const banks = {
      '오류 깨기': { hook: '다들 반대로 알고 있습니다', title: core + ' — 흔한 오해 3개', outline: '흔한 오해 → 실제로는 → 확인 방법 → 정리' },
      '문제→해결': { hook: '이 문제, 원인은 따로 있습니다', title: core + ' 문제가 생기는 진짜 이유', outline: '증상 → 원인 → 해결 2가지 → 결과' },
      '비포·애프터': { hook: '바꾸기 전과 후가 이렇게 다릅니다', title: core + ' 전 / 후 비교', outline: '전 → 바꾼 것 → 후 → 유지 팁' },
      '체크리스트': { hook: '사기 전에 이 5개만 보세요', title: core + ' 체크리스트 5', outline: '체크1~5 → 왜 중요한지 → 마무리' },
      '1년 후 시점': { hook: '1년 뒤에도 쓸까?', title: core + ', 1년 뒤 솔직 후기', outline: '기대 → 실제 → 아쉬운 점 → 남은 이유' }
    };
    for (let i = 0; i < n; i++) {
      const ang = REMIX_ANGLES[i % REMIX_ANGLES.length];
      const b = banks[ang];
      items.push({ angle: ang, hook: b.hook, title: b.title, outline: b.outline, cta: state.brand.rules.cta[0] || '저장해 두고 필요할 때 꺼내 보세요', brand: state.brand.picked || '' });
    }
    return { items: items, seed: hash32(src) % 1000 };
  }

  async function doRemix() {
    const src = ($('#remixSrc').value || '').trim();
    if (src.length < 10) { toast('원본 글을 10자 이상 붙여넣어 주세요', 'bad'); return; }
    const n = Number($('#remixCount').value) || 5;
    const btn = $('#btnRemix'); btn.disabled = true; const old = btn.innerHTML;
    btn.innerHTML = '<span class="spin"></span> 리믹스 중';
    try {
      const out = await withAI(
        () => geminiJSON(
          '한국어 SNS 콘텐츠 기획자다. 아래 잘 된 글을 같은 소재·다른 각도로 ' + n + '개 리믹스하라.\n' +
          '원문: ' + src.slice(0, 1500) + '\n' +
          (state.brand.picked ? '브랜드 톤: ' + state.brand.rules.tone + ' / 금지어: ' + state.brand.rules.banned.join(', ') + '\n' : '') +
          'JSON만: {"items":[{"angle":"각도","hook":"첫 문장 후킹","title":"제목","outline":"구조 4단계","cta":"CTA"}]} 개수 ' + n,
          { temp: 0.9, maxTokens: 1600 }
        ), () => demoRemix(src, n), '리믹스'
      );
      const items = (out.items || []).slice(0, 6);
      state.collect.remixes = items;
      renderRemix(items);
      toast('리믹스 ' + items.length + '개 완성', 'good');
      logActivity('♻️', '리믹스 ' + items.length + '개 · ' + (out.__mode === 'gemini' ? 'Gemini' : '데모'));
    } catch (e) {
      toast('리믹스 실패: ' + errMsg(e), 'bad');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function renderRemix(items) {
    const box = $('#remixOut'); if (!box) return;
    if (!items || !items.length) { box.innerHTML = ''; return; }
    box.innerHTML = items.map((x, i) =>
      '<div class="item" data-ri="' + i + '"><span class="ic">♻️</span><div class="body">' +
      '<b>' + esc(x.title || '') + '</b><small>' + esc(x.angle || '') + ' · ' + esc(x.outline || '') + '</small>' +
      '<p>“' + esc(x.hook || '') + '”</p></div>' +
      '<div class="acts"><button class="btn xs" type="button" data-act="car">카드뉴스</button>' +
      '<button class="btn xs ghost" type="button" data-act="post">포스트</button></div></div>'
    ).join('');
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', e => {
        const item = e.target.closest('.item'); if (!item) return;
        const x = state.collect.remixes[Number(item.dataset.ri)]; if (!x) return;
        const act = e.target.closest('[data-act]');
        if (!act) return;
        const text = (x.title || '') + ' — ' + (x.hook || '');
        if (act.dataset.act === 'car') sendToCarousel(text);
        else sendToPost(text);
      });
    }
  }

  /* ---------------- handoff to other modules ---------------- */
  function sendToCarousel(topic) {
    const ideas = state.collect.aiIdeas.concat(state.collect.myIdeas);
    const hit = ideas.find(x => x.text === topic);
    if (hit) { state.collect.picked = hit.id; renderIdeas(); }
    state.carousel.topic = topic;
    const hint = $('#carouselTopicHint');
    if (hint) { hint.textContent = '주제: ' + topic.slice(0, 60); hint.className = 'hint'; }
    setView('carousel');
    buildCarouselDraft(topic);
    persistAll();
  }
  function sendToPost(text) {
    state.post.base = text;
    const el = $('#postBase'); if (el) el.value = text;
    if (typeof renderPlatform === 'function') { buildPlatforms(); }
    setView('post');
    persistAll();
    toast('포스트로 보냈습니다 · 6채널 변환을 눌러 주세요', 'good');
  }

  function initCollect() {
    bindCollect();
    const r = state.collect.rss || {};
    const set = (sel, v) => { const el = $(sel); if (el && v != null) el.value = v; };
    set('#rssFeeds', r.feeds); set('#ytChannels', r.channels); set('#rssKeywords', r.keywords);
    set('#rssPerDay', r.perDay); set('#rssTz', r.tz);
    renderIdeas(); renderRemix(state.collect.remixes);
    if (state.collect.remixes && state.collect.remixes.length) { /* 유지 */ }
    renderCollectorPreview();
  }
