  /* =========================================================
     70-analytics.js — 6 성과 분석 · 리믹스 제안 · 홈 요약
     ========================================================= */

  const ANA_PLAT = { ig: '인스타그램', tt: '틱톡', yt: '유튜브', th: '스레드', x: 'X', blog: '블로그' };

  function er(p) {
    const v = Number(p.views) || 0;
    if (!v) return null;
    return ((Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saves) || 0)) / v * 100;
  }
  function pct(n) { return n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2) + '%'; }

  function renderMetrics() {
    const body = $('#metricsBody'), empty = $('#metricsEmpty');
    const rows = state.ana.posts;
    if (empty) empty.classList.toggle('hidden', rows.length > 0);
    if (body) {
      body.innerHTML = rows.map(p =>
        '<tr data-id="' + p.id + '"><td>' + esc(ANA_PLAT[p.platform] || p.platform) + '</td>' +
        '<td>' + esc(p.title) + '</td><td class="nowrap">' + esc(p.date || '') + '</td>' +
        '<td class="num">' + fmtNum(p.views) + '</td><td class="num">' + fmtNum(p.likes) + '</td>' +
        '<td class="num">' + fmtNum(p.comments) + '</td><td class="num">' + fmtNum(p.saves) + '</td>' +
        '<td class="num">' + pct(er(p)) + '</td>' +
        '<td class="nowrap"><button class="btn xs ghost" type="button" data-edit="' + p.id + '">수정</button> ' +
        '<button class="btn xs ghost" type="button" data-del="' + p.id + '">✕</button></td></tr>'
      ).join('');
    }
    renderAnaStats();
    drawChart();
  }

  function summarize() {
    const rows = state.ana.posts;
    const views = rows.reduce((s, p) => s + (Number(p.views) || 0), 0);
    const eng = rows.reduce((s, p) => s + (Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saves) || 0), 0);
    const ers = rows.filter(p => er(p) != null);
    const avg = ers.length ? ers.reduce((s, p) => s + er(p), 0) / ers.length : null;
    const byPlat = {};
    ers.forEach(p => { const k = p.platform; (byPlat[k] = byPlat[k] || []).push(er(p)); });
    let bestPlat = null, bestVal = -1;
    Object.keys(byPlat).forEach(k => {
      const v = byPlat[k].reduce((a, b) => a + b, 0) / byPlat[k].length;
      if (v > bestVal) { bestVal = v; bestPlat = k; }
    });
    const top = ers.slice().sort((a, b) => er(b) - er(a))[0] || null;
    const byDay = {};
    ers.forEach(p => { if (p.date) (byDay[p.date] = byDay[p.date] || []).push(er(p)); });
    let bestDay = null, dayVal = -1;
    Object.keys(byDay).forEach(d => {
      const v = byDay[d].reduce((a, b) => a + b, 0) / byDay[d].length;
      if (v > dayVal) { dayVal = v; bestDay = d; }
    });
    return { rows: rows.length, views, eng, avg, bestPlat, bestVal, top, bestDay, dayVal, byPlat };
  }

  function renderAnaStats() {
    const box = $('#anaStats'); if (!box) return;
    const s = summarize();
    const cards = [
      { k: '게시물', v: s.rows, s: '직접 입력', cls: '' },
      { k: '총 조회', v: fmtNum(s.views), s: '합계', cls: 'cyan' },
      { k: '총 참여', v: fmtNum(s.eng), s: '좋아요+댓글+저장', cls: 'violet' },
      { k: '평균 참여율', v: pct(s.avg), s: '행 평균', cls: 'lime' },
      { k: '잘 된 채널', v: s.bestPlat ? (ANA_PLAT[s.bestPlat] || s.bestPlat) : '—', s: s.bestPlat ? '평균 ' + pct(s.bestVal) : '데이터 없음', cls: '' },
      { k: '잘 된 날', v: s.bestDay ? s.bestDay.slice(5) : '—', s: s.bestDay ? '평균 ' + pct(s.dayVal) : '데이터 없음', cls: '' }
    ];
    box.innerHTML = cards.map(c => '<div class="stat ' + c.cls + '"><div class="k">' + c.k + '</div><div class="v">' + c.v + '</div><div class="s">' + esc(c.s) + '</div></div>').join('');
  }

  function drawChart() {
    const cv = $('#chart'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const s = summarize();
    const keys = Object.keys(s.byPlat);
    const note = $('#chartNote');
    if (!keys.length) {
      ctx.fillStyle = '#5b6376';
      ctx.font = '500 ' + Math.round(H * 0.10) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('성과를 입력하면 채널별 참여율이 그려집니다', W / 2, H / 2);
      if (note) note.textContent = '데이터 없음';
      return;
    }
    const vals = keys.map(k => s.byPlat[k].reduce((a, b) => a + b, 0) / s.byPlat[k].length);
    const max = Math.max.apply(null, vals.concat([0.1]));
    const padL = 64, padB = 34, padT = 18, padR = 16;
    const bw = (W - padL - padR) / keys.length;
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (H - padT - padB) * i / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = '#6d7587'; ctx.font = '500 11px ' + FONT; ctx.textAlign = 'right';
      ctx.fillText((max * (1 - i / 4)).toFixed(1) + '%', padL - 8, y + 4);
    }
    keys.forEach((k, i) => {
      const v = vals[i];
      const h = (v / max) * (H - padT - padB);
      const x = padL + bw * i + bw * 0.22;
      const w = bw * 0.56;
      const y = H - padB - h;
      const g = ctx.createLinearGradient(0, y, 0, H - padB);
      g.addColorStop(0, '#c8f751'); g.addColorStop(1, '#4be0c6');
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, Math.max(3, h), 6); ctx.fill();
      ctx.fillStyle = '#e9edf5'; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(v.toFixed(2) + '%', x + w / 2, y - 6);
      ctx.fillStyle = '#949cb0'; ctx.font = '600 11px ' + FONT;
      ctx.fillText(ANA_PLAT[k] || k, x + w / 2, H - 12);
    });
    if (note) note.textContent = keys.length + '개 채널 · 평균 참여율 기준';
  }

  function addMetric() {
    const v = sel => { const el = $(sel); return el ? el.value : ''; };
    const title = (v('#mTitle') || '').trim();
    if (!title) { toast('제목을 입력하세요', 'bad'); return; }
    const p = {
      id: uid('p'), platform: v('#mPlatform'), title,
      date: v('#mDate') || todayISO(),
      views: Math.max(0, Number(v('#mViews')) || 0),
      likes: Math.max(0, Number(v('#mLikes')) || 0),
      comments: Math.max(0, Number(v('#mComments')) || 0),
      saves: Math.max(0, Number(v('#mSaves')) || 0)
    };
    if (state.ana.editing) {
      const old = state.ana.posts.find(x => x.id === state.ana.editing);
      if (old) Object.assign(old, p, { id: old.id });
      state.ana.editing = null;
      toast('성과를 수정했습니다', 'good');
    } else {
      state.ana.posts.unshift(p);
      toast('성과를 추가했습니다 · 참여율 ' + pct(er(p)), 'good');
    }
    ['#mTitle', '#mViews', '#mLikes', '#mComments', '#mSaves'].forEach(sel => { const el = $(sel); if (el) el.value = el.type === 'number' ? '0' : ''; });
    renderMetrics(); persistAll(true);
    logActivity('📊', '성과 입력 · ' + title.slice(0, 24) + ' · 참여율 ' + pct(er(p)));
  }

  const DEMO_METRICS = [
    { platform: 'ig', title: '무선청소기 3개월 후기 카드뉴스', views: 18400, likes: 1240, comments: 96, saves: 610 },
    { platform: 'tt', title: '3초 요약 · 청소기 고르는 기준', views: 46200, likes: 3180, comments: 142, saves: 980 },
    { platform: 'yt', title: '무선청소기 4종 비교 (롱폼 6분)', views: 9800, likes: 520, comments: 88, saves: 210 },
    { platform: 'th', title: '스레드 · 결국 기준 두 가지', views: 7300, likes: 410, comments: 64, saves: 190 }
  ];

  function demoRecs() {
    const s = summarize();
    if (!s.rows) return { items: [] };
    const best = s.bestPlat ? (ANA_PLAT[s.bestPlat] || s.bestPlat) : '인스타그램';
    const top = s.top;
    return {
      items: [
        { type: '리믹스', title: (top ? top.title : '잘 된 글') + ' → 카드뉴스 6장', why: '참여율 ' + pct(top ? er(top) : null) + '로 가장 잘 된 글입니다. 같은 내용을 카드뉴스로 바꾸면 저장이 늘어납니다.', from: top ? top.title : '' },
        { type: '다음 글감', title: '‘처음 사는 사람’ 기준 체크리스트', why: best + '에서 반응이 좋았던 주제입니다. 초보자 타깃으로 한 번 더 파생할 수 있습니다.', from: best },
        { type: '다음 글감', title: '안 쓰게 된 물건의 공통점 3가지', why: '후기 글의 반대편 각도입니다. 저장·댓글을 부르는 비교형 소재입니다.', from: '' },
        { type: '채널', title: best + '에는 같은 글을 3일 뒤 재구성', why: '채널별 평균 참여율 1위입니다. 같은 소재를 다른 형식(스레드→카드뉴스)으로 돌리세요.', from: best }
      ]
    };
  }

  async function aiRecs() {
    if (!state.ana.posts.length) { toast('성과를 1개 이상 입력하세요', 'bad'); return; }
    const btn = $('#btnAIrecs'), old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 생각 중';
    const s = summarize();
    try {
      const out = await withAI(
        () => geminiJSON(
          'SNS 성과 분석가다. 아래 성과 표를 보고 다음 글감·리믹스 제안을 4개 만들어라.\n' +
          JSON.stringify(state.ana.posts.map(p => ({ platform: p.platform, title: p.title, views: p.views, likes: p.likes, comments: p.comments, saves: p.saves, er: er(p) }))) + '\n' +
          (state.brand.picked ? '브랜드 톤: ' + state.brand.rules.tone + ' / 금지어: ' + state.brand.rules.banned.join(', ') + '\n' : '') +
          'JSON만: {"items":[{"type":"리믹스|다음 글감|채널","title":"제목","why":"근거 한두 문장(숫자 인용)","from":"근거 글"}]}',
          { temp: 0.8, maxTokens: 1400 }
        ), demoRecs, '리믹스 제안'
      );
      state.ana.recs = (out.items || []).slice(0, 6);
      state.ana.recsMode = out.__mode || 'demo';
      renderRecs();
      toast('제안 ' + state.ana.recs.length + '개 · ' + (state.ana.recsMode === 'gemini' ? 'Gemini' : '데모'), 'good');
      logActivity('🤖', '성과 기반 제안 ' + state.ana.recs.length + '개');
      persistAll();
    } catch (e) { toast('제안 실패: ' + errMsg(e), 'bad'); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function renderRecs() {
    const box = $('#recs'), empty = $('#recsEmpty');
    const items = state.ana.recs || [];
    if (empty) empty.classList.toggle('hidden', items.length > 0);
    if (!box) return;
    box.innerHTML = items.map((x, i) =>
      '<div class="item" data-ri="' + i + '"><span class="ic">' + (x.type === '리믹스' ? '♻️' : x.type === '채널' ? '📡' : '💡') + '</span>' +
      '<div class="body"><b>' + esc(x.title) + '</b><small>' + esc(x.type || '') + (x.from ? ' · 근거: ' + esc(String(x.from).slice(0, 30)) : '') + '</small>' +
      '<p>' + esc(x.why || '') + '</p></div>' +
      '<div class="acts"><button class="btn xs" type="button" data-to="carousel">카드뉴스</button>' +
      '<button class="btn xs ghost" type="button" data-to="post">포스트</button></div></div>'
    ).join('');
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-to]'); if (!b) return;
        const item = e.target.closest('.item');
        const x = state.ana.recs[Number(item.dataset.ri)]; if (!x) return;
        const text = x.title;
        if (b.dataset.to === 'carousel') sendToCarousel(text);
        else sendToPost(text);
      });
    }
  }

  function bindAnalytics() {
    const add = $('#btnMetricAdd'); if (add) add.addEventListener('click', addMetric);
    const demo = $('#btnMetricDemo');
    if (demo) demo.addEventListener('click', () => {
      const d = new Date();
      DEMO_METRICS.forEach((m, i) => {
        state.ana.posts.push(Object.assign({ id: uid('p'), date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(Math.max(1, d.getDate() - i * 3)) }, m));
      });
      renderMetrics(); persistAll(true); toast('예시 4개를 넣었습니다', 'good');
      logActivity('📊', '성과 예시 4개 입력');
    });
    const clr = $('#btnMetricClear');
    if (clr) clr.addEventListener('click', () => { state.ana.posts = []; state.ana.recs = []; state.ana.editing = null; renderMetrics(); renderRecs(); persistAll(true); toast('성과를 비웠습니다'); });
    const body = $('#metricsBody');
    if (body) body.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { state.ana.posts = state.ana.posts.filter(p => p.id !== del.dataset.del); renderMetrics(); persistAll(true); return; }
      const ed = e.target.closest('[data-edit]');
      if (ed) {
        const p = state.ana.posts.find(x => x.id === ed.dataset.edit); if (!p) return;
        const set = (sel, v) => { const el = $(sel); if (el) el.value = v; };
        set('#mPlatform', p.platform); set('#mTitle', p.title); set('#mDate', p.date);
        set('#mViews', p.views); set('#mLikes', p.likes); set('#mComments', p.comments); set('#mSaves', p.saves);
        state.ana.editing = p.id;
        $('#mTitle').scrollIntoView({ block: 'center', behavior: 'smooth' });
        toast('수정 중 · 제목을 고치고 「성과 추가」를 누르면 반영됩니다');
      }
    });
    const ar = $('#btnAIrecs'); if (ar) ar.addEventListener('click', aiRecs);
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target && e.target.id === 'mTitle') { e.preventDefault(); addMetric(); }
    });
  }

  function initAnalytics() {
    bindAnalytics();
    const d = $('#mDate'); if (d && !d.value) d.value = todayISO();
    renderMetrics(); renderRecs();
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    const box = $('#homeStats'); if (!box) return;
    const slides = state.carousel.slides.length;
    const platFilled = PLATFORM_ORDER.filter(k => ((state.post.platforms[k] || {}).text || '').trim()).length;
    const thread = state.post.thread.filter(p => p.text.trim()).length;
    const calCount = expandMonth(state.cal.ym).length;
    const s = summarize();
    const cards = [
      { k: '카드뉴스', v: slides + '장', s: RATIOS[state.carousel.ratio].label, cls: 'lime' },
      { k: '채널 글', v: platFilled + ' / 6', s: '스레드 ' + thread + '개', cls: 'violet' },
      { k: '예약', v: calCount + '건', s: state.cal.ym + ' 기준', cls: 'cyan' },
      { k: '성과', v: s.rows + '개', s: '평균 참여율 ' + pct(s.avg), cls: '' },
      { k: '내보낸 파일', v: state.exported + '개', s: 'PNG · ZIP · WebM · JSON', cls: '' }
    ];
    box.innerHTML = cards.map(c => '<div class="stat ' + c.cls + '"><div class="k">' + c.k + '</div><div class="v">' + c.v + '</div><div class="s">' + esc(c.s) + '</div></div>').join('');
    renderActivity();
  }
