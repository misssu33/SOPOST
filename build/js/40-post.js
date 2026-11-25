  /* =========================================================
     40-post.js — 3 멀티채널 포스트 · 스레드(최대 15) · 금지어 검사
     ========================================================= */

  const LIMIT_NOTE = { instagram: 2200, tiktok: 2200, youtube: 5000, threads: 500, x: 280, blog: 0 };

  function hashtagsFor(text, n) {
    const base = (state.brand.rules.required || []).join(' ');
    const seed = [text, state.carousel.topic, base].join(' ');
    const dict = ['살림', '리뷰', '무선청소기', '정리', '가성비', '1인가구', '홈카페', '청소', '비교', '후기'];
    const r = rng(hash32(seed));
    const pickedWords = [];
    for (let i = 0; i < n; i++) {
      const w = dict[Math.floor(r() * dict.length)];
      if (pickedWords.indexOf(w) < 0) pickedWords.push(w);
    }
    return pickedWords.map(w => '#' + w).join(' ');
  }
  function sentencesOf(text) {
    return String(text || '').split(/(?<=[.!?。！？])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  }
  function cutAt(text, limit) {
    const s = String(text || '');
    if (countChars(s) <= limit) return s;
    const arr = Array.from(s).slice(0, limit - 1).join('');
    return arr.replace(/[\s,，、]+$/, '') + '…';
  }
  function ctaLine(i) {
    const c = state.brand.rules.cta || [];
    return c[i % Math.max(1, c.length)] || '저장해 두고 필요할 때 꺼내 보세요';
  }

  function demoPlatforms(base) {
    const sents = sentencesOf(base);
    const title = (sents[0] || base || '제목 없는 글').replace(/^#+\s*/, '').slice(0, 80);
    const body = sents.slice(1).join(' ') || base;
    const tags3 = state.post.hashtags ? hashtagsFor(base, 3) : '';
    const tags5 = state.post.hashtags ? hashtagsFor(base, 5) : '';
    const tone = state.brand.rules.tone || '';
    const friendly = /구어|대화|친근/.test(tone);

    const instagram = cutAt(
      (friendly ? '저도 처음엔 반대였어요.\n\n' : '') + base + '\n\n' +
      ctaLine(0) + '\n.\n.\n' + (tags5 || ''), LIMIT_NOTE.instagram);

    const tiktok = cutAt(
      (friendly ? '이거 모르고 사면 돈 아깝습니다 👀\n' : '3초 요약.\n') +
      (sents[0] || '') + '\n' + (sents[1] || '') + '\n' + ctaLine(1) + '\n' + tags3, LIMIT_NOTE.tiktok);

    const youtube = cutAt(
      '제목: ' + cutAt(title, 95) + '\n\n' +
      '설명:\n' + body + '\n\n' +
      sents.map((s, i) => (i + 1) + '. ' + s).join('\n') + '\n\n' +
      '태그: ' + (state.post.hashtags ? hashtagsFor(base, 6).replace(/#/g, '') : '') + '\n' +
      ctaLine(0), LIMIT_NOTE.youtube);

    const threads = cutAt(base.split(/\n{2,}/)[0] + (base.length > 400 ? '' : '\n\n' + ctaLine(0)), LIMIT_NOTE.threads);

    const xCore = sentencesOf(base).slice(0, 3).join(' ');
    const x = cutAt(xCore + '\n' + ctaLine(1).slice(0, 40) + ' ' + (tags3 ? tags3.split(' ').slice(0, 1).join('') : ''), 280);

    const blog = '## ' + title + '\n\n' +
      sents.map((s, i) => (i === 0 ? s : s)).join('\n\n') +
      '\n\n### 정리\n' + (sents.slice(-2).join(' ') || body) + '\n\n' + ctaLine(0) +
      '\n\n' + (tags5 || '');

    return { instagram, tiktok, youtube, threads, x, blog };
  }

  async function buildPlatforms() {
    const base = ($('#postBase') ? $('#postBase').value : state.post.base).trim();
    if (base.length < 5) { toast('Base 글을 먼저 써 주세요 (5자 이상)', 'bad'); return; }
    state.post.base = base;
    const btn = $('#btnBuildPlatforms'), old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 변환 중';
    try {
      const out = await withAI(
        () => geminiJSON(
          '한국어 SNS 카피라이터다. 아래 Base 글을 6개 채널 형식으로 바꿔라.\nBase: ' + base.slice(0, 2000) + '\n' +
          (state.post.brand && state.brand.picked ? '브랜드 톤: ' + state.brand.rules.tone + ' / CTA: ' + state.brand.rules.cta.join(' | ') + ' / 금지어(절대 쓰지 말 것): ' + state.brand.rules.banned.join(', ') + '\n' : '') +
          '제한: instagram 2200자(해시태그 포함), tiktok 2200자(첫 줄 훅), youtube 제목 100자+설명 5000자, threads 500자, x 280자, blog 네이버 블로그 형식(소제목 ##, 1500자 내외).\n' +
          'JSON만: {"instagram":"...","tiktok":"...","youtube":"...","threads":"...","x":"...","blog":"..."}',
          { temp: 0.85, maxTokens: 3000 }
        ),
        () => demoPlatforms(base), '채널 변환'
      );
      PLATFORM_ORDER.forEach(k => {
        const v = out[k];
        if (typeof v === 'string' && v.trim()) {
          const lim = LIMIT_NOTE[k] || 0;
          state.post.platforms[k] = { text: lim ? cutAt(v.trim(), lim) : v.trim() };
        }
      });
      renderPlatformTabs(); renderPlatform(); persistAll(true);
      toast('6채널 문구 완성 · ' + (out.__mode === 'gemini' ? 'Gemini' : '데모'), 'good');
      logActivity('📮', '6채널 문구 변환 · ' + countChars(base) + '자 Base');
    } catch (e) {
      toast('변환 실패: ' + errMsg(e), 'bad');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function renderPlatformTabs() {
    const box = $('#platTabs'); if (!box) return;
    box.innerHTML = PLATFORM_ORDER.map(k => {
      const m = platMeta(k);
      const txt = (state.post.platforms[k] || {}).text || '';
      return '<button type="button" class="' + (state.post.active === k ? 'on' : '') + '" data-plat="' + k + '">' +
        '<span>' + m.icon + '</span>' + m.name + '<span class="c">' + (txt ? countChars(txt) : '—') + '</span></button>';
    }).join('');
  }

  function renderPlatform() {
    const box = $('#platTabs'); if (!box) return;
    renderPlatformTabs();
    const k = state.post.active;
    const m = platMeta(k);
    const ta = $('#platText');
    if (ta) ta.value = (state.post.platforms[k] || {}).text || '';
    const nm = $('#platName'); if (nm) nm.textContent = m.name;
    const lim = LIMIT_NOTE[k] || 0;
    const lh = $('#platLimitHint');
    if (lh) lh.textContent = lim ? '제한 ' + lim.toLocaleString('ko-KR') + '자' : '길이 제한 없음 (권장 1,500자)';
    updatePlatformCounter();
    updateBannedWarn();
    renderThread();
  }

  function updatePlatformCounter() {
    const k = state.post.active;
    const ta = $('#platText');
    const txt = ta ? ta.value : ((state.post.platforms[k] || {}).text || '');
    const lim = LIMIT_NOTE[k] || 0;
    const n = countChars(txt);
    const c = $('#platCounter');
    if (c) {
      c.textContent = lim ? n.toLocaleString('ko-KR') + ' / ' + lim.toLocaleString('ko-KR') + '자' : n.toLocaleString('ko-KR') + '자';
      c.className = 'counter' + (lim && n > lim ? ' over' : '');
    }
    const chips = $('#platBannedChips');
    const hits = hitBanned(txt);
    if (chips) chips.innerHTML = hits.length ? hits.map(w => '<span class="chip red">금지어 · ' + esc(w) + '</span>').join('') : '<span class="chip lime">금지어 없음</span>';
  }

  function updateBannedWarn() {
    const base = $('#postBase') ? $('#postBase').value : state.post.base;
    const all = base + ' ' + PLATFORM_ORDER.map(k => (state.post.platforms[k] || {}).text || '').join(' ');
    const hits = hitBanned(all);
    const b = $('#bannedWarn');
    if (b) {
      if (hits.length) { b.classList.remove('hidden'); b.className = 'badge danger'; b.textContent = '금지어 ' + hits.length + ' · ' + hits.slice(0, 3).join(', '); }
      else { b.classList.add('hidden'); b.textContent = '금지어 0'; }
    }
    const bc = $('#postBaseCount');
    if (bc) bc.textContent = countChars(base) + '자';
  }

  /* ---------------- thread ---------------- */
  const THREAD_MAX = 15, THREAD_LIMIT = 500;

  function renderThread() {
    const box = $('#threadList'), empty = $('#threadEmpty');
    const t = state.post.thread;
    if (empty) empty.classList.toggle('hidden', t.length > 0);
    if (!box) return;
    box.innerHTML = t.map((p, i) =>
      '<div class="tw" data-i="' + i + '"><div class="railnum"><span>' + (i + 1) + '</span>' + (i < t.length - 1 ? '<i></i>' : '') + '</div>' +
      '<div><textarea data-part="' + i + '" placeholder="' + (i === 0 ? '스레드 첫 글 — 훅을 넣으세요' : '이어지는 글') + '">' + esc(p.text) + '</textarea>' +
      '<div class="tw-foot"><span class="counter' + (countChars(p.text) > THREAD_LIMIT ? ' over' : '') + '" data-cnt="' + i + '">' + countChars(p.text) + ' / ' + THREAD_LIMIT + '</span>' +
      '<span class="row" style="gap:3px">' +
      '<button class="btn xs ghost" type="button" data-t="up" data-i="' + i + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
      '<button class="btn xs ghost" type="button" data-t="down" data-i="' + i + '" ' + (i === t.length - 1 ? 'disabled' : '') + '>↓</button>' +
      '<button class="btn xs ghost" type="button" data-t="del" data-i="' + i + '">✕</button></span></div></div></div>'
    ).join('');
    const badge = $('#threadBadge');
    if (badge) {
      badge.textContent = t.length + ' / ' + THREAD_MAX;
      badge.className = 'badge ' + (t.length >= THREAD_MAX ? 'demo' : t.length ? 'cyan' : '');
    }
    const total = $('#threadTotal');
    if (total) {
      const n = t.reduce((s, p) => s + countChars(p.text), 0);
      total.textContent = '총 ' + n.toLocaleString('ko-KR') + '자 · ' + t.length + '개';
    }
    const add = $('#btnAddPart');
    if (add) add.disabled = t.length >= THREAD_MAX;
  }

  function splitIntoThread(base, max) {
    const sents = sentencesOf(base);
    const parts = [];
    let cur = '';
    for (const s of sents) {
      const next = cur ? cur + ' ' + s : s;
      if (countChars(next) > max - 2) {
        if (cur) parts.push(cur);
        if (countChars(s) > max - 2) {
          // 문장 하나가 너무 길면 500자 단위로 자른다
          let rest = s;
          while (countChars(rest) > max - 2) {
            parts.push(Array.from(rest).slice(0, max - 2).join(''));
            rest = Array.from(rest).slice(max - 2).join('');
          }
          cur = rest;
        } else cur = s;
      } else cur = next;
    }
    if (cur) parts.push(cur);
    return parts.slice(0, THREAD_MAX).map(p => ({ text: p }));
  }

  function buildThreadFromBase() {
    const base = ($('#postBase') ? $('#postBase').value : state.post.base).trim();
    if (!base) { toast('Base 글이 비어 있습니다', 'bad'); return; }
    state.post.thread = splitIntoThread(base, THREAD_LIMIT);
    renderThread(); persistAll();
    toast('스레드 ' + state.post.thread.length + '개로 나눴습니다', 'good');
    logActivity('🧵', '스레드 ' + state.post.thread.length + '개 구성');
  }

  function bindPost() {
    const base = $('#postBase');
    if (base) base.addEventListener('input', () => {
      state.post.base = base.value;
      updateBannedWarn(); persistAll();
    });
    const h = $('#postHashtags'); if (h) h.addEventListener('change', () => { state.post.hashtags = h.checked; persistAll(); });
    const b = $('#postBrand'); if (b) b.addEventListener('change', () => { state.post.brand = b.checked; persistAll(); });
    const bb = $('#btnBuildPlatforms'); if (bb) bb.addEventListener('click', buildPlatforms);

    const tabs = $('#platTabs');
    if (tabs) tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-plat]'); if (!btn) return;
      // 현재 편집 중인 글 저장
      const ta = $('#platText');
      if (ta && state.post.active) state.post.platforms[state.post.active] = { text: ta.value };
      state.post.active = btn.dataset.plat;
      renderPlatform(); persistAll();
    });
    const ta = $('#platText');
    if (ta) ta.addEventListener('input', () => {
      state.post.platforms[state.post.active] = { text: ta.value };
      updatePlatformCounter(); updateBannedWarn(); persistAll();
      const btn = $('#platTabs [data-plat="' + state.post.active + '"] .c');
      if (btn) btn.textContent = countChars(ta.value) || '—';
    });
    const ap = $('#btnPlatApply');
    if (ap) ap.addEventListener('click', () => {
      const v = $('#platText').value;
      state.post.platforms[state.post.active] = { text: v };
      renderPlatformTabs(); persistAll(true);
      toast(platMeta(state.post.active).name + ' 글 저장 · ' + countChars(v) + '자', 'good');
    });
    const cp = $('#btnCopyPlat');
    if (cp) cp.addEventListener('click', () => copyText($('#platText').value, platMeta(state.post.active).name));
    const bfi = $('#btnBaseFromIdea');
    if (bfi) bfi.addEventListener('click', () => {
      const t = pickedText();
      if (!t) { toast('기획에서 글감을 먼저 고르세요', 'bad'); return; }
      $('#postBase').value = t; state.post.base = t;
      updateBannedWarn(); persistAll(); toast('글감을 불러왔습니다', 'good');
    });

    const add = $('#btnAddPart');
    if (add) add.addEventListener('click', () => {
      if (state.post.thread.length >= THREAD_MAX) { toast('스레드는 최대 ' + THREAD_MAX + '개까지입니다', 'bad'); return; }
      state.post.thread.push({ text: '' });
      renderThread(); persistAll();
      const tas = $$('#threadList textarea');
      if (tas.length) tas[tas.length - 1].focus();
    });
    const sp = $('#btnThreadSplit'); if (sp) sp.addEventListener('click', buildThreadFromBase);

    const list = $('#threadList');
    if (list) {
      list.addEventListener('input', e => {
        const i = Number(e.target.dataset.part);
        if (isNaN(i) || !state.post.thread[i]) return;
        state.post.thread[i].text = e.target.value;
        const cnt = list.querySelector('[data-cnt="' + i + '"]');
        if (cnt) { const n = countChars(e.target.value); cnt.textContent = n + ' / ' + THREAD_LIMIT; cnt.className = 'counter' + (n > THREAD_LIMIT ? ' over' : ''); }
        const total = $('#threadTotal');
        if (total) { const n = state.post.thread.reduce((s, p) => s + countChars(p.text), 0); total.textContent = '총 ' + n.toLocaleString('ko-KR') + '자 · ' + state.post.thread.length + '개'; }
        persistAll();
      });
      list.addEventListener('click', e => {
        const btn = e.target.closest('[data-t]'); if (!btn) return;
        const i = Number(btn.dataset.i), t = state.post.thread;
        if (btn.dataset.t === 'del') t.splice(i, 1);
        if (btn.dataset.t === 'up' && i > 0) [t[i - 1], t[i]] = [t[i], t[i - 1]];
        if (btn.dataset.t === 'down' && i < t.length - 1) [t[i + 1], t[i]] = [t[i], t[i + 1]];
        renderThread(); persistAll();
      });
    }
    const ct = $('#btnCopyThread');
    if (ct) ct.addEventListener('click', () => {
      const parts = state.post.thread.map((p, i) => p.text.trim()).filter(Boolean);
      if (!parts.length) { toast('스레드가 비어 있습니다', 'bad'); return; }
      const tooLong = state.post.thread.filter(p => countChars(p.text) > THREAD_LIMIT).length;
      copyText(parts.map((p, i) => p + '\n(' + (i + 1) + '/' + parts.length + ')').join('\n\n— — —\n\n'), '스레드');
      if (tooLong) toast(tooLong + '개 칸이 500자를 넘습니다 · 복사는 됐지만 잘릴 수 있어요', 'bad');
    });

    const fc = $('#firstComment');
    if (fc) fc.addEventListener('input', () => { state.post.firstComment = fc.value; persistAll(); });
    const cf = $('#btnCopyFirst');
    if (cf) cf.addEventListener('click', () => copyText($('#firstComment').value, '첫 댓글'));
    const rq = $('#btnRequiredIntoComment');
    if (rq) rq.addEventListener('click', () => {
      const req = (state.brand.rules.required || []).filter(Boolean);
      if (!req.length) { toast('브랜드 규칙에 필수 문구가 없습니다', 'bad'); return; }
      const el = $('#firstComment');
      const has = req.filter(r => el.value.indexOf(r) >= 0);
      const addText = req.filter(r => has.indexOf(r) < 0).join(' ');
      if (addText) el.value = (el.value ? el.value.replace(/\s+$/, '') + '\n' : '') + addText;
      state.post.firstComment = el.value;
      persistAll(); toast('필수 문구를 넣었습니다', 'good');
    });
    const ca = $('#btnCopyAll');
    if (ca) ca.addEventListener('click', () => {
      const p = state.post.platforms;
      const blocks = [
        '[Base]', state.post.base.trim(), '',
        '[채널별]',
        ...PLATFORM_ORDER.map(k => '## ' + platMeta(k).name + '\n' + ((p[k] || {}).text || '').trim()),
        '', '[스레드]',
        ...state.post.thread.map((t, i) => (i + 1) + '. ' + t.text.trim()),
        '', '[첫 댓글]', ($('#firstComment') || {}).value || ''
      ];
      copyText(blocks.filter(x => x !== '').join('\n'), '전체 세트');
      state.post.copied++;
      const cs = $('#copyStatus');
      if (cs) cs.textContent = '복사 ' + state.post.copied + '회 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      logActivity('📋', '포스트 전체 세트 복사');
    });
  }

  function initPost() {
    bindPost();
    const el = $('#postBase');
    if (el) el.value = state.post.base || '';
    const fc = $('#firstComment');
    if (fc) fc.value = state.post.firstComment || '';
    const h = $('#postHashtags'); if (h) h.checked = state.post.hashtags !== false;
    const b = $('#postBrand'); if (b) b.checked = state.post.brand !== false;
    renderPlatform();
    updateBannedWarn();
  }
