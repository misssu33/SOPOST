  /* =========================================================
     10-brand.js — Gemini 키 5개 · 브랜드 보이스 A/B · Brand Rules
     ========================================================= */

  /* ---------------- keys ---------------- */
  const KEY_STATUS = { empty: '비어 있음', waiting: '대기', active: '활성', exhausted: '한도초과' };
  const KEY_CLASS = { empty: '', waiting: '', active: 'live', exhausted: 'danger' };

  function loadKeys() {
    const saved = lsGet(LS.keys, null);
    if (saved && Array.isArray(saved.keys) && saved.keys.length) {
      state.keys = saved.keys.slice(0, 5).map(k => ({
        id: k.id || uid('k'), value: k.value || '',
        status: k.value ? (k.status === 'active' ? 'waiting' : (k.status || 'waiting')) : 'empty',
        used: k.used || 0, note: k.note || ''
      }));
      state.activeKey = saved.activeKey || null;
    }
    while (state.keys.length < 5) state.keys.push({ id: uid('k'), value: '', status: 'empty', used: 0, note: '' });
  }
  const realKeys = () => state.keys.filter(k => k.value);
  const usableKeys = () => state.keys.filter(k => k.value && k.status !== 'exhausted');
  const hasAI = () => usableKeys().length > 0;

  function renderKeys() {
    const box = $('#keySlots'); if (!box) return;
    box.innerHTML = state.keys.map((k, i) => {
      const cls = KEY_CLASS[k.status] || '';
      const tip = k.note ? ' title="' + esc(k.note) + '"' : '';
      return '<div class="keyrow" data-i="' + i + '">' +
        '<span class="no">' + (i + 1) + '</span>' +
        '<input class="key-input" type="text" spellcheck="false" autocomplete="off" placeholder="AIza… (비워 두면 데모)" value="' + esc(k.value) + '">' +
        '<span class="badge st ' + cls + '"' + tip + '><span class="dot"></span>' + KEY_STATUS[k.status] + (k.used ? ' · ' + k.used : '') + '</span>' +
        '<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn xs key-save" type="button">저장</button><button class="btn xs ghost key-del" type="button" title="지우기">✕</button></span>' +
        '</div>';
    }).join('');
    updateModeBadge();
  }

  function bindKeyEvents() {
    const box = $('#keySlots'); if (!box) return;
    box.addEventListener('click', e => {
      const row = e.target.closest('.keyrow'); if (!row) return;
      const i = Number(row.dataset.i);
      if (e.target.closest('.key-save')) {
        const v = row.querySelector('.key-input').value.trim();
        const k = state.keys[i];
        k.value = v;
        k.status = v ? 'waiting' : 'empty';
        k.note = ''; k.used = 0;
        persistAll(true); renderKeys();
        toast(v ? (i + 1) + '번 키를 저장했습니다' + (realKeys().length === 1 ? ' · 이제 Gemini로 동작합니다' : '') : (i + 1) + '번 키를 비웠습니다', v ? 'good' : '');
      }
      if (e.target.closest('.key-del')) {
        state.keys[i] = { id: uid('k'), value: '', status: 'empty', used: 0, note: '' };
        persistAll(true); renderKeys(); toast((i + 1) + '번 키를 지웠습니다');
      }
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.classList.contains('key-input')) {
        e.preventDefault();
        const row = e.target.closest('.keyrow');
        row.querySelector('.key-save').click();
      }
    });
  }

  /* ---------------- Gemini ---------------- */
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

  function errMsg(e) {
    if (!e) return '알 수 없는 오류';
    if (e.code === 'no_key') return '사용 가능한 키가 없습니다. 설정에서 키를 추가하세요.';
    if (e.code === 'all_exhausted') return '모든 키가 한도 초과입니다. 내일 다시 시도하거나 데모 모드를 쓰세요.';
    if (e.name === 'AbortError') return '요청 시간 초과';
    return String(e.message || e).slice(0, 180);
  }

  async function geminiCall(model, body, opts) {
    opts = opts || {};
    const cands = usableKeys();
    if (!cands.length) {
      const e = new Error('사용 가능한 Gemini 키가 없습니다');
      e.code = realKeys().length ? 'all_exhausted' : 'no_key';
      throw e;
    }
    let last = null;
    for (let i = 0; i < cands.length; i++) {
      const k = cands[i];
      const url = GEMINI_BASE + '/models/' + model + ':generateContent?key=' + encodeURIComponent(k.value);
      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, opts.timeout || 45000);
      try {
        const res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: ctrl.signal
        });
        clearTimeout(timer);
        if (res.status === 404) {
          const err = new Error('Gemini 모델을 찾을 수 없습니다: ' + model);
          err.code = 'model'; throw err;
        }
        if (res.status === 400) {
          const txt = await res.text().catch(() => '');
          if (/RESOURCE_EXHAUSTED|quota|exceeded/i.test(txt)) {
            k.status = 'exhausted'; k.note = '한도 초과(400)';
            persistAll(true); renderKeys();
            last = new Error('Gemini 400 · 한도 초과'); last.code = 'quota';
            continue;
          }
          const e2 = new Error('Gemini 400 · ' + txt.slice(0, 160)); e2.code = 'http'; throw e2;
        }
        if (res.status === 429 || res.status === 401 || res.status === 403) {
          k.status = 'exhausted';
          k.note = res.status === 429 ? '한도 초과(429)' : '키 거부(' + res.status + ')';
          persistAll(true); renderKeys();
          const nxt = cands[i + 1];
          if (nxt) toast((i + 1) + '번 키 ' + (res.status === 429 ? '한도 초과' : '거부') + ' → ' + (state.keys.indexOf(nxt) + 1) + '번 키로 자동 전환', 'bad');
          last = new Error('Gemini ' + res.status + ' · 키 한도/거부'); last.code = 'quota';
          continue;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          const e3 = new Error('Gemini ' + res.status + (txt ? ' · ' + txt.slice(0, 140) : '')); e3.code = 'http'; throw e3;
        }
        const data = await res.json();
        k.status = 'active'; k.used = (k.used || 0) + 1; k.note = '';
        state.activeKey = k.id;
        persistAll(true); renderKeys();
        return data;
      } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError' || e.code === 'quota') { last = e; continue; }
        throw e;
      }
    }
    const err = new Error('모든 키가 한도 초과입니다'); err.code = 'all_exhausted'; err.last = last;
    throw err;
  }

  function geminiText(data) {
    const c = data && data.candidates && data.candidates[0];
    if (!c) return '';
    return ((c.content && c.content.parts) || []).map(p => p.text || '').join('').trim();
  }
  function parseJSONLoose(text) {
    if (!text) throw new Error('빈 응답');
    let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) {
      const a2 = text.indexOf('['), b2 = text.lastIndexOf(']');
      if (a2 >= 0 && b2 > a2) return JSON.parse(text.slice(a2, b2 + 1));
      throw new Error('JSON 해석 실패: ' + String(text).slice(0, 90));
    }
  }
  const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  async function geminiJSON(prompt, opts) {
    let last = null;
    for (const model of TEXT_MODELS) {
      try {
        const data = await geminiCall(model, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts && opts.temp != null ? opts.temp : 0.8,
            responseMimeType: 'application/json',
            maxOutputTokens: (opts && opts.maxTokens) || 2048
          }
        }, opts);
        const text = geminiText(data);
        if (!text) throw new Error('Gemini 응답이 비어 있습니다');
        return parseJSONLoose(text);
      } catch (e) {
        if (e.code === 'model') { last = e; continue; }
        throw e;
      }
    }
    throw last || new Error('사용 가능한 Gemini 텍스트 모델이 없습니다');
  }

  /** AI가 있으면 실제 호출, 실패하거나 키가 없으면 데모 결과로 이어간다. */
  async function withAI(realFn, demoFn, label) {
    if (hasAI()) {
      try {
        const out = await realFn();
        out.__mode = 'gemini';
        return out;
      } catch (e) {
        toast((label || 'AI') + ' 실패(' + errMsg(e) + ') → 데모 결과로 이어갑니다', 'bad');
      }
    }
    await new Promise(r => setTimeout(r, 120));
    const out = demoFn();
    out.__mode = 'demo';
    return out;
  }

  /* ---------------- brand samples ---------------- */
  const SAMPLE_KINDS = ['내 글', '링크', '샘플 파일'];
  const DEMO_SAMPLES = [
    '3개월 동안 무선청소기를 네 개 써 봤습니다. 결국 남은 기준은 두 가지였어요. 흡입력, 그리고 먼지통을 비우는 데 걸리는 시간. 스펙표에 없는 건 그 두 가지였습니다.',
    '살림은 결국 동선입니다. 손이 두 번 가는 물건은 안 쓰게 되더라고요. 오늘은 주방 동선을 세 번만 줄여도 달라지는 것들을 정리했습니다.',
    '새로 산 물건보다 오래 쓴 물건 이야기를 씁니다. 3년째 쓰는 청소기, 5년째 쓰는 냄비처럼요. 오래 남는 이유는 대체로 단순했습니다.'
  ];

  function renderSamples() {
    const box = $('#brandSamples'); if (!box) return;
    box.innerHTML = state.brand.samples.map((s, i) => {
      const filled = (s.text || '').trim() || (s.kind === '링크' && (s.url || '').trim());
      return '<div class="smp' + (filled ? ' filled' : '') + '" data-i="' + i + '">' +
        '<div class="smp-head"><span class="smp-no">' + (i + 1) + '</span><select class="smp-kind">' +
        SAMPLE_KINDS.map(k => '<option' + (k === s.kind ? ' selected' : '') + '>' + k + '</option>').join('') +
        '</select></div>' +
        (s.kind === '링크' ? '<input type="url" class="smp-url" placeholder="https://..." value="' + esc(s.url || '') + '">' : '') +
        '<textarea class="smp-text" placeholder="' + (s.kind === '링크' ? '글 본문을 붙여넣으면 더 정확합니다' : '내가 쓴 글을 붙여넣으세요') + '">' + esc(s.text || '') + '</textarea>' +
        '</div>';
    }).join('');
    const n = state.brand.samples.filter(s => (s.text || '').trim().length > 0 || (s.kind === '링크' && (s.url || '').trim())).length;
    const c = $('#brandSampleCount'); if (c) c.textContent = n + '/5';
    const st = $('#brandStatus');
    if (st) st.textContent = n ? '샘플 ' + n + '개 준비됨 · A/B를 만들 수 있습니다.' : '샘플 1개 이상이면 만들 수 있습니다.';
  }

  function bindSamples() {
    const box = $('#brandSamples'); if (!box) return;
    box.addEventListener('input', e => {
      const card = e.target.closest('.smp'); if (!card) return;
      const i = Number(card.dataset.i);
      if (e.target.classList.contains('smp-text')) state.brand.samples[i].text = e.target.value;
      if (e.target.classList.contains('smp-url')) state.brand.samples[i].url = e.target.value;
      const filled = (state.brand.samples[i].text || '').trim() || (state.brand.samples[i].kind === '링크' && (state.brand.samples[i].url || '').trim());
      card.classList.toggle('filled', !!filled);
      const n = state.brand.samples.filter(s => (s.text || '').trim() || (s.kind === '링크' && (s.url || '').trim())).length;
      const c = $('#brandSampleCount'); if (c) c.textContent = n + '/5';
      persistAll();
    });
    box.addEventListener('change', e => {
      if (e.target.classList.contains('smp-kind')) {
        const card = e.target.closest('.smp');
        state.brand.samples[Number(card.dataset.i)].kind = e.target.value;
        renderSamples(); persistAll();
      }
    });
    const demo = $('#btnBrandDemoFill');
    if (demo) demo.addEventListener('click', () => {
      DEMO_SAMPLES.forEach((t, i) => { if (i < state.brand.samples.length) { state.brand.samples[i].text = t; state.brand.samples[i].kind = '내 글'; } });
      renderSamples(); persistAll(); toast('예시 3개를 채웠습니다', 'good');
    });
    const clr = $('#btnBrandClear');
    if (clr) clr.addEventListener('click', () => {
      state.brand.samples.forEach(s => { s.text = ''; s.url = ''; });
      state.brand.A = state.brand.B = null; state.brand.picked = null;
      renderSamples(); renderAB(); persistAll(); toast('샘플을 비웠습니다');
    });
    const file = $('#brandFile');
    if (file) file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      const text = await f.text();
      const slot = state.brand.samples.findIndex(s => !(s.text || '').trim());
      const i = slot < 0 ? 0 : slot;
      state.brand.samples[i].text = text.slice(0, 4000);
      state.brand.samples[i].kind = '샘플 파일';
      renderSamples(); persistAll();
      toast(f.name + ' → 샘플 ' + (i + 1) + '에 넣었습니다', 'good');
      file.value = '';
    });
    const btn = $('#btnBrandGen');
    if (btn) btn.addEventListener('click', generateBrand);
  }

  function sampleDigest() {
    return state.brand.samples.map((s, i) => {
      const t = (s.text || '').trim();
      const u = (s.url || '').trim();
      if (!t && !u) return null;
      return { i: i + 1, kind: s.kind, url: u, text: t.slice(0, 1200) };
    }).filter(Boolean);
  }

  function demoTone(texts, variant) {
    const all = texts.join(' ');
    const q = /[?？]/.test(all);
    const num = /[0-9]/.test(all);
    const short = all.split(/[.!?。]/).filter(s => s.trim()).map(s => s.trim().length);
    const avg = short.length ? short.reduce((a, b) => a + b, 0) / short.length : 40;
    const styleA = {
      name: 'A · 정리형', tone: '사실을 먼저, 감정은 뒤에. 짧은 문장과 숫자로 정리하는 존댓말',
      summary: (num ? '숫자·기간을 앞세우고 ' : '구체적인 경험을 앞세우고 ') + (avg < 45 ? '짧은 문장으로 끊어 읽게 합니다.' : '한 문장에 맥락을 담아 차분히 이어 갑니다.'),
      hooking: [num ? '숫자·기간으로 시작하기' : '경험 기간으로 시작하기', '결론을 먼저 한 줄로', '스펙표에 없는 기준 제시'],
      cta: ['필요할 때 꺼내 보시게 저장해 두세요', '더 자세한 비교는 프로필 링크에 정리했습니다'],
      banned: ['최저가', '무조건', '대박', '완벽', '미친'],
      required: ['직접 써 보고 쓴 후기입니다'],
      sample: (texts[0] || '').split(/[.\n]/).filter(Boolean)[0] ? texts[0].split(/[.\n]/)[0].trim() + '. 결국 기준은 두 가지였습니다.' : '결국 기준은 두 가지였습니다. 흡입력과 비우는 시간.'
    };
    const styleB = {
      name: 'B · 대화형', tone: '친근한 구어체, 말 걸듯 묻고 함께 정리하는 톤',
      summary: (q ? '질문을 던져 ' : '공감 한 줄로 시작해 ') + '독자를 대화로 끌어들이고, 마지막에 선택지를 줍니다.',
      hooking: ['질문으로 시작하기', '흔한 오해를 먼저 말하기', '“저도 그랬어요”로 공감 만들기'],
      cta: ['여러분은 어떤 기준 쓰세요? 댓글로 알려주세요', '같이 정리해 봐요, 저장해 두세요'],
      banned: ['최저가', '무조건', '대박', '미친'],
      required: ['광고·협찬 여부는 본문에 표시합니다'],
      sample: '저도 처음엔 스펙만 봤어요. 그런데 3개월 쓰고 나니 남는 기준이 달라지더라고요.'
    };
    return variant === 'B' ? styleB : styleA;
  }

  function demoBrandAB() {
    const texts = sampleDigest().map(s => s.text || s.url);
    return { a: demoTone(texts, 'A'), b: demoTone(texts, 'B') };
  }

  async function generateBrand() {
    const samples = sampleDigest();
    if (!samples.length) { toast('샘플을 1개 이상 넣어 주세요', 'bad'); return; }
    const btn = $('#btnBrandGen'), st = $('#brandStatus');
    btn.disabled = true; const old = btn.innerHTML, oldSt = st.textContent;
    btn.innerHTML = '<span class="spin"></span> 분석 중';
    st.textContent = '샘플 ' + samples.length + '개를 읽는 중…';
    try {
      const out = await withAI(
        () => geminiJSON(
          '너는 한국어 SNS 브랜드 보이스 분석가다. 아래는 한 사람의 글 샘플이다.\n' +
          JSON.stringify(samples) + '\n\n' +
          '두 가지 서로 다른 브랜드 보이스를 만들어라. A는 정리형(사실·숫자 중심, 짧은 문장), B는 대화형(질문·공감 중심, 구어체).\n' +
          '반드시 아래 JSON만 출력:\n' +
          '{"a":{"name":"A · 정리형","tone":"한 문장 톤 설명","summary":"두 문장 설명","hooking":["패턴1","패턴2","패턴3"],"cta":["CTA1","CTA2"],"banned":["금지어1","금지어2"],"required":["필수 문구1"],"sample":"샘플 문장"},\n' +
          ' "b":{"name":"B · 대화형","tone":"...","summary":"...","hooking":["..."],"cta":["..."],"banned":["..."],"required":["..."],"sample":"..."}}\n' +
          '금지어는 이 샘플들에서 상업적으로 남용되기 쉬운 표현 3~6개. 실제 샘플 문장을 인용해 말투를 증명해라.',
          { temp: 0.75, maxTokens: 1800 }
        ),
        demoBrandAB, '브랜드 분석'
      );
      state.brand.A = normStyle(out.a); state.brand.B = normStyle(out.b);
      state.brand.mode = out.__mode || 'demo';
      state.brand.picked = null;
      const badge = $('#abModeBadge');
      if (badge) {
        badge.className = 'badge ' + (state.brand.mode === 'gemini' ? 'live' : 'demo');
        badge.textContent = state.brand.mode === 'gemini' ? 'Gemini 분석' : '데모 분석';
      }
      renderAB(); persistAll(true);
      st.textContent = 'A/B 완성 · 마음에 드는 쪽을 고르세요';
      toast('브랜드 보이스 A/B 완성', 'good');
      logActivity('🎙️', '브랜드 보이스 A/B 생성 · 샘플 ' + samples.length + '개 · ' + (state.brand.mode === 'gemini' ? 'Gemini' : '데모'));
      if (st) st.textContent = (oldSt || '') && 'A/B 완성 · 마음에 드는 쪽을 고르세요';
    } catch (e) {
      st.textContent = errMsg(e); toast('브랜드 분석 실패: ' + errMsg(e), 'bad');
    } finally {
      btn.disabled = false; btn.innerHTML = old;
    }
  }

  function normStyle(s) {
    s = s || {};
    return {
      name: String(s.name || '이름 없음').slice(0, 40),
      tone: String(s.tone || '').slice(0, 160),
      summary: String(s.summary || '').slice(0, 300),
      hooking: (Array.isArray(s.hooking) ? s.hooking : []).map(x => String(x).slice(0, 60)).slice(0, 6),
      cta: (Array.isArray(s.cta) ? s.cta : []).map(x => String(x).slice(0, 80)).slice(0, 5),
      banned: (Array.isArray(s.banned) ? s.banned : []).map(x => String(x).slice(0, 20)).slice(0, 12),
      required: (Array.isArray(s.required) ? s.required : []).map(x => String(x).slice(0, 80)).slice(0, 5),
      sample: String(s.sample || '').slice(0, 300)
    };
  }

  function abCard(style, tag) {
    const picked = state.brand.picked === tag;
    return '<div class="abcard' + (picked ? ' picked' : '') + '" data-tag="' + tag + '">' +
      '<div class="abhead"><span class="abtag">' + (picked ? '선택됨' : tag + '안') + '</span>' +
      '<button class="btn ' + (picked ? 'primary' : '') + ' xs ab-pick" type="button">' + (picked ? '✓ 사용 중' : '이 안 선택') + '</button></div>' +
      '<h4>' + esc(style.name) + '</h4><div class="absub">' + esc(style.summary || style.tone) + '</div>' +
      '<div class="abrow"><b>톤</b>' + esc(style.tone) + '</div>' +
      '<div class="abrow"><b>후킹 패턴</b><div class="chips">' + style.hooking.map(h => '<span class="chip lime">' + esc(h) + '</span>').join('') + '</div></div>' +
      '<div class="abrow"><b>CTA</b><ul class="ablist">' + style.cta.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' +
      '<div class="abrow"><b>금지어</b><div class="chips">' + style.banned.map(w => '<span class="chip red">' + esc(w) + '</span>').join('') + '</div></div>' +
      '<div class="abrow"><b>필수 문구</b><div class="chips">' + style.required.map(w => '<span class="chip cyan">' + esc(w) + '</span>').join('') + '</div></div>' +
      '<div class="abrow"><b>예시 문장</b><span class="dim">“' + esc(style.sample) + '”</span></div>' +
      '</div>';
  }

  function renderAB() {
    const box = $('#brandAB'); if (!box) return;
    if (!state.brand.A || !state.brand.B) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">아직 브랜드 보이스가 없습니다. 위에서 <b>A/B 만들기</b>를 눌러 주세요.</div>';
      return;
    }
    box.innerHTML = abCard(state.brand.A, 'A') + abCard(state.brand.B, 'B');
    box.querySelectorAll('.ab-pick').forEach(b => b.addEventListener('click', () => {
      const tag = b.closest('.abcard').dataset.tag;
      applyBrand(tag);
    }));
  }

  function applyBrand(tag) {
    const s = state.brand[tag];
    if (!s) return;
    state.brand.picked = tag;
    state.brand.rules = {
      tone: s.tone || DEFAULT_RULES.tone,
      hooking: s.hooking.slice(),
      cta: s.cta.slice(),
      banned: uniq(s.banned.concat(state.brand.rules.banned || [])).slice(0, 15),
      required: uniq(s.required.concat((state.brand.rules.required || []).filter(Boolean))).slice(0, 8)
    };
    state.brand.savedAt = Date.now();
    applyRulesToForm();
    renderAB(); updateBrandBadge(); persistAll(true);
    toast(tag + '안을 브랜드 규칙으로 저장했습니다', 'good');
    logActivity('✅', '브랜드 보이스 ' + tag + '안 선택 · 금지어 ' + state.brand.rules.banned.length + '개');
  }

  /* ---------------- rules ---------------- */
  function applyRulesToForm() {
    const r = state.brand.rules;
    const set = (sel, v) => { const el = $(sel); if (el) el.value = v || ''; };
    set('#ruleTone', r.tone);
    set('#ruleHooking', (r.hooking || []).join('\n'));
    set('#ruleCta', (r.cta || []).join('\n'));
    renderRuleChips();
    updateBrandBadge();
  }

  function renderRuleChips() {
    const b = $('#ruleBanned'), q = $('#ruleRequired');
    if (b) b.innerHTML = (state.brand.rules.banned || []).map((w, i) => '<span class="chip red">' + esc(w) + '<span class="x" data-kind="banned" data-i="' + i + '">✕</span></span>').join('') || '<span class="hint">아직 금지어가 없습니다.</span>';
    if (q) q.innerHTML = (state.brand.rules.required || []).map((w, i) => '<span class="chip cyan">' + esc(w) + '<span class="x" data-kind="required" data-i="' + i + '">✕</span></span>').join('') || '<span class="hint">아직 필수 문구가 없습니다.</span>';
  }

  function bindRules() {
    const add = (inputSel, kind) => {
      const input = $(inputSel); if (!input) return;
      const v = input.value.trim(); if (!v) return;
      const arr = state.brand.rules[kind];
      if (arr.indexOf(v) < 0) arr.push(v);
      if (arr.length > 15) arr.length = 15;
      input.value = '';
      renderRuleChips(); persistAll(); toast('추가: ' + v, 'good');
      if (kind === 'banned') refreshBannedChecks();
    };
    const bi = $('#btnAddBanned'); if (bi) bi.addEventListener('click', () => add('#ruleBannedInput', 'banned'));
    const ri = $('#btnAddRequired'); if (ri) ri.addEventListener('click', () => add('#ruleRequiredInput', 'required'));
    const enter = (sel, kind) => { const el = $(sel); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(sel, kind); } }); };
    enter('#ruleBannedInput', 'banned'); enter('#ruleRequiredInput', 'required');

    const box = $('#panel-brand');
    if (box) box.addEventListener('click', e => {
      const x = e.target.closest('.chip .x'); if (!x) return;
      const kind = x.dataset.kind, i = Number(x.dataset.i);
      state.brand.rules[kind].splice(i, 1);
      renderRuleChips(); persistAll(); if (kind === 'banned') refreshBannedChecks();
    });
    const sv = $('#btnSaveRules');
    if (sv) sv.addEventListener('click', () => {
      const r = state.brand.rules;
      r.tone = ($('#ruleTone') || {}).value || '';
      r.hooking = (($('#ruleHooking') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean);
      r.cta = (($('#ruleCta') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean);
      state.brand.savedAt = Date.now();
      updateBrandBadge(); persistAll(true); refreshBannedChecks();
      toast('Brand Rules 저장 · 금지어 ' + r.banned.length + '개', 'good');
      logActivity('📌', 'Brand Rules 저장 · 톤/후킹/CTA/금지어 ' + r.banned.length + '개');
    });
    const rs = $('#btnRulesReset');
    if (rs) rs.addEventListener('click', () => {
      state.brand.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
      state.brand.picked = null;
      applyRulesToForm(); renderAB(); persistAll(true); refreshBannedChecks();
      toast('브랜드 규칙을 기본값으로 되돌렸습니다');
    });
  }

  function refreshBannedChecks() {
    if (typeof renderPlatform === 'function') renderPlatform();
    if (typeof updateBannedWarn === 'function') updateBannedWarn();
  }

  /* ---------------- key test ---------------- */
  function bindKeyTest() {
    const btn = $('#btnTestKeys'), out = $('#keyTestOut');
    if (btn) btn.addEventListener('click', async () => {
      if (!realKeys().length) {
        if (out) { out.className = 'note warn'; out.textContent = '저장된 키가 없습니다 · 데모 모드로 모든 기능이 동작합니다.'; }
        toast('먼저 키를 저장하세요. 없어도 데모로 됩니다.', 'bad');
        return;
      }
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 테스트 중';
      if (out) { out.className = 'note'; out.textContent = '테스트 중…'; }
      try {
        const data = await geminiCall('gemini-2.5-flash', {
          contents: [{ parts: [{ text: 'Reply with exactly one word: OK' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8 }
        }, { timeout: 20000 });
        const txt = geminiText(data) || '(빈 응답)';
        const idx = state.keys.findIndex(k => k.id === state.activeKey) + 1;
        if (out) { out.className = 'note ok'; out.textContent = '연결 성공 · ' + idx + '번 키 · “' + txt.slice(0, 20) + '”'; }
        toast('연결 성공 · ' + idx + '번 키', 'good');
      } catch (e) {
        if (out) { out.className = 'note warn'; out.textContent = errMsg(e); }
        toast(errMsg(e), 'bad');
      } finally {
        btn.disabled = false; btn.innerHTML = '연결 테스트';
      }
    });
    const rs = $('#btnResetKeys');
    if (rs) rs.addEventListener('click', () => {
      state.keys.forEach(k => { if (k.value && k.status === 'exhausted') { k.status = 'waiting'; k.note = ''; } });
      persistAll(true); renderKeys(); toast('한도 초과 표시를 초기화했습니다');
    });
  }

  function initBrand() {
    loadKeys();
    bindKeyEvents(); bindKeyTest(); bindSamples(); bindRules();
    renderKeys(); renderSamples(); renderAB(); applyRulesToForm();
    if (state.brand.A && state.brand.B) { const b = $('#abModeBadge'); if (b) { b.className = 'badge ' + (state.brand.mode === 'gemini' ? 'live' : 'demo'); b.textContent = state.brand.mode === 'gemini' ? 'Gemini 분석' : '데모 분석'; } }
    updateModeBadge(); updateBrandBadge();
  }
