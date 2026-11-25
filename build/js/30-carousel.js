  /* =========================================================
     30-carousel.js — 2 카드뉴스: 5비율 · 스토리 구조 · PNG/ZIP
     ========================================================= */

  const RATIOS = {
    '1:1': { w: 1080, h: 1080, label: '1:1 · 1080×1080' },
    '3:4': { w: 1080, h: 1440, label: '3:4 · 1080×1440' },
    '4:5': { w: 1080, h: 1350, label: '4:5 · 1080×1350' },
    '9:16': { w: 1080, h: 1920, label: '9:16 · 1080×1920' },
    '16:9': { w: 1920, h: 1080, label: '16:9 · 1920×1080' }
  };
  const PRESETS = {
    ink: { bg1: '#1b2436', bg2: '#080a0e', text: '#ffffff', accent: '#c8f751' },
    violet: { bg1: '#241d42', bg2: '#0b0a14', text: '#f2efff', accent: '#9a8cff' },
    paper: { bg1: '#f4f1e8', bg2: '#ded8c8', text: '#12141a', accent: '#12141a' },
    mint: { bg1: '#0f2a26', bg2: '#07100f', text: '#eafff9', accent: '#4be0c6' }
  };
  const STRUCT_NAME = { myth: '오류 깨기', problem: '문제 → 해결', beforeafter: '비포 · 애프터', checklist: '체크리스트' };
  const FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';

  function newSlide(extra) {
    return Object.assign({
      id: uid('s'), kicker: '', title: '', body: '', cta: false, badge: true,
      bgType: 'gradient', bg1: '#1b2436', bg2: '#080a0e', img: null, overlay: 40,
      text: '#ffffff', accent: '#c8f751', preset: 'ink'
    }, extra || {});
  }

  function ratioSize() { return RATIOS[state.carousel.ratio] || RATIOS['4:5']; }

  /* ---------------- canvas text helpers ---------------- */
  function wrapLines(ctx, text, maxWidth) {
    const out = [];
    String(text || '').split('\n').forEach(para => {
      const chars = Array.from(para);
      let line = '';
      for (let i = 0; i < chars.length; i++) {
        const test = line + chars[i];
        if (ctx.measureText(test).width > maxWidth && line) {
          // 공백이 가까이 있으면 그 지점에서 끊는다
          const sp = line.lastIndexOf(' ');
          if (sp > line.length * 0.55) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + chars[i]; }
          else { out.push(line); line = chars[i]; }
        } else line = test;
      }
      out.push(line);
    });
    return out.filter(l => l.trim().length);
  }
  function fitTitle(ctx, text, maxWidth, base, maxLines, weight) {
    let size = base;
    while (size > base * 0.52) {
      ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
      const lines = wrapLines(ctx, text, maxWidth);
      if (lines.length <= maxLines) return { size, lines };
      size -= Math.max(2, Math.round(base * 0.03));
    }
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT;
    let lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    return { size, lines };
  }

  function drawSlide(cv, slide, idx, total, opts) {
    opts = opts || {};
    const W = cv.width, H = cv.height;
    const ctx = cv.getContext('2d');
    const S = Math.min(W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // 배경
    if (slide.img) {
      const im = slide.imgEl;
      if (im && im.complete && im.naturalWidth) {
        const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
        ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = slide.bg2 || '#080a0e'; ctx.fillRect(0, 0, W, H);
      }
    } else if (slide.bgType === 'solid') {
      ctx.fillStyle = slide.bg1 || '#141821'; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, slide.bg1 || '#1b2436');
      g.addColorStop(1, slide.bg2 || '#080a0e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const ov = clamp(Number(slide.overlay) || 0, 0, 90) / 100;
    if (ov > 0) { ctx.fillStyle = 'rgba(0,0,0,' + ov + ')'; ctx.fillRect(0, 0, W, H); }

    // 장식 — 왼쪽 세로 액센트 바
    const padX = Math.round(W * 0.082);
    const accent = slide.accent || '#c8f751';
    const textCol = slide.text || '#ffffff';
    ctx.fillStyle = accent;
    ctx.fillRect(padX, Math.round(H * 0.085), Math.round(W * 0.075), Math.max(4, Math.round(S * 0.008)));

    // 번호 배지
    if (slide.badge) {
      const num = String(idx + 1);
      ctx.font = '800 ' + Math.round(S * 0.05) + 'px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillText(num + ' / ' + total, W - padX, Math.round(H * 0.072));
    }

    const maxW = W - padX * 2;
    const titleText = slide.title || '';
    const tBase = slide.cta ? Math.round(S * 0.088) : Math.round(S * 0.084);
    const fit = fitTitle(ctx, titleText, maxW, tBase, slide.cta ? 4 : 5);
    const tLh = Math.round(fit.size * 1.16);
    const bSize = Math.round(S * 0.036);
    const bLh = Math.round(bSize * 1.55);
    const kickerH = slide.kicker ? Math.round(S * 0.05) : 0;
    const ruleH = Math.round(S * 0.035) + Math.round(S * 0.018);
    // 본문 줄 수는 남는 높이에 맞춰 제한한다
    let bodyLines = [];
    if (slide.body) {
      ctx.font = '500 ' + bSize + 'px ' + FONT;
      const available = (slide.cta ? H * 0.68 : H * 0.86) - (kickerH + fit.lines.length * tLh + ruleH);
      const cap = Math.max(2, Math.floor(available / bLh));
      bodyLines = wrapLines(ctx, slide.body, maxW).slice(0, slide.cta ? Math.min(cap, 4) : cap);
    }
    const blockH = kickerH + fit.lines.length * tLh + ruleH + bodyLines.length * bLh;
    const bias = H > W * 1.2 ? 0.38 : 0.47;
    let y = Math.round(Math.max(H * 0.15, (H - blockH) * bias));
    y = Math.min(y, Math.round(H * 0.40));

    if (slide.kicker) {
      ctx.textAlign = 'left';
      ctx.font = '800 ' + Math.round(S * 0.027) + 'px ' + FONT;
      ctx.fillStyle = accent;
      ctx.fillText(String(slide.kicker).toUpperCase(), padX, y);
      y += kickerH;
    }

    ctx.fillStyle = textCol;
    ctx.font = '800 ' + fit.size + 'px ' + FONT;
    fit.lines.forEach((ln, i) => ctx.fillText(ln, padX, y + i * tLh));
    y += fit.lines.length * tLh + Math.round(S * 0.035);

    ctx.fillStyle = accent;
    ctx.fillRect(padX, y - Math.round(S * 0.016), Math.round(S * 0.06), Math.max(3, Math.round(S * 0.006)));
    y += Math.round(S * 0.018);

    if (bodyLines.length) {
      ctx.font = '500 ' + bSize + 'px ' + FONT;
      ctx.fillStyle = slide.preset === 'paper' ? 'rgba(18,20,26,.82)' : 'rgba(255,255,255,.80)';
      bodyLines.forEach((ln, i) => ctx.fillText(ln, padX, y + i * bLh));
      y += bodyLines.length * bLh;
    }

    // CTA
    if (slide.cta) {
      const by = Math.min(H - Math.round(S * 0.24), y + Math.round(S * 0.05));
      const bw = Math.min(maxW, Math.round(W * 0.66)), bh = Math.round(S * 0.094);
      ctx.fillStyle = accent;
      roundRect(ctx, padX, by, bw, bh, Math.round(bh * 0.28));
      ctx.fill();
      ctx.fillStyle = slide.preset === 'paper' ? '#ffffff' : '#0a0b0e';
      ctx.font = '800 ' + Math.round(S * 0.036) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('저장 · 팔로우', padX + bw / 2, by + bh * 0.30);
      ctx.textAlign = 'left';
    }

    // 하단 핸들 · 브랜드
    const footY = H - Math.round(S * 0.075);
    ctx.font = '700 ' + Math.round(S * 0.024) + 'px ' + FONT;
    ctx.fillStyle = slide.preset === 'paper' ? 'rgba(18,20,26,.55)' : 'rgba(255,255,255,.5)';
    if (state.carousel.handleOn) ctx.fillText(state.carousel.handle || '@sosone', padX, footY);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = '800 ' + Math.round(S * 0.02) + 'px ' + FONT;
    ctx.fillText('SOPOST', W - padX, footY + Math.round(S * 0.003));
    ctx.textAlign = 'left';
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- deck ---------------- */
  function ensureSlideImages() {
    state.carousel.slides.forEach(s => {
      if (s.img && !s.imgEl) {
        const im = new Image();
        im.onload = () => { s.imgEl = im; drawCarousel(); renderStrip(); };
        im.src = s.img;
        s.imgEl = im;
      }
    });
  }

  function currentSlide() { return state.carousel.slides[state.carousel.idx] || null; }

  function drawCarousel() {
    const cv = $('#carouselCanvas'); if (!cv) return;
    const size = ratioSize();
    if (cv.width !== size.w || cv.height !== size.h) { cv.width = size.w; cv.height = size.h; }
    const s = currentSlide();
    const total = state.carousel.slides.length;
    if (!s) {
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#5b6376'; ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(Math.min(cv.width, cv.height) * 0.045) + 'px ' + FONT;
      ctx.fillText('초안을 만들면 슬라이드가 여기에 보입니다', cv.width / 2, cv.height / 2);
      ctx.font = '500 ' + Math.round(Math.min(cv.width, cv.height) * 0.028) + 'px ' + FONT;
      ctx.fillText('위에서 구조를 고르고 「초안 만들기」', cv.width / 2, cv.height / 2 + Math.round(Math.min(cv.width, cv.height) * 0.06));
      const meta = $('#slideMeta'); if (meta) meta.textContent = '0 / 0';
      return;
    }
    drawSlide(cv, s, state.carousel.idx, total);
    const meta = $('#slideMeta'); if (meta) meta.textContent = (state.carousel.idx + 1) + ' / ' + total;
    const sz = $('#slideSize'); if (sz) sz.textContent = size.w + '×' + size.h;
    const kind = $('#slideKind'); if (kind) kind.textContent = s.cta ? 'CTA' : state.carousel.idx === 0 ? '표지' : '본문';
    const editNo = $('#editSlideNo'); if (editNo) editNo.textContent = '#' + (state.carousel.idx + 1);
    const rn = $('#ratioNow'); if (rn) rn.textContent = RATIOS[state.carousel.ratio].label;
  }

  function renderStrip() {
    const box = $('#slideStrip'); if (!box) return;
    const size = ratioSize();
    const tw = 64, th = Math.round(tw * size.h / size.w);
    box.innerHTML = state.carousel.slides.map((s, i) => {
      const c = document.createElement('canvas');
      c.width = tw * 2; c.height = th * 2;
      drawSlide(c, s, i, state.carousel.slides.length, { thumb: true });
      const url = c.toDataURL('image/png');
      return '<button class="slide-thumb' + (i === state.carousel.idx ? ' on' : '') + (s.cta ? ' cta' : '') + '" type="button" data-i="' + i + '" title="' + esc(s.title || ('슬라이드 ' + (i + 1))) + '">' +
        '<img src="' + url + '" alt="슬라이드 ' + (i + 1) + '"><span class="n">' + (s.cta ? 'C' : i + 1) + '</span></button>';
    }).join('');
  }

  function syncSlideForm() {
    const s = currentSlide();
    const set = (sel, v) => { const el = $(sel); if (el) el.value = v; };
    const chk = (sel, v) => { const el = $(sel); if (el) el.checked = !!v; };
    const dis = !s;
    $$('#panel-carousel input, #panel-carousel select, #panel-carousel textarea').forEach(el => {
      if (el.closest('#brandSamples')) return;
      if (['structSel'].indexOf(el.id) >= 0) return;
      if (el.id === 'slHandleText') { el.disabled = false; return; }
      el.disabled = dis && ['slKicker', 'slTitle', 'slBody', 'slBg1', 'slBg2', 'slImage', 'slOverlay', 'slText', 'slAccent', 'slPreset', 'slBadge', 'slCta', 'slBgType'].indexOf(el.id) >= 0;
    });
    if (!s) return;
    set('#slKicker', s.kicker || ''); set('#slTitle', s.title || ''); set('#slBody', s.body || '');
    chk('#slBadge', s.badge); chk('#slCta', s.cta);
    set('#slBgType', s.bgType || 'gradient'); set('#slBg1', s.bg1 || '#1b2436'); set('#slBg2', s.bg2 || '#080a0e');
    set('#slOverlay', s.overlay == null ? 40 : s.overlay);
    set('#slText', s.text || '#ffffff'); set('#slAccent', s.accent || '#c8f751');
    set('#slPreset', s.preset || 'ink');
    const ov = $('#slOverlayVal'); if (ov) ov.textContent = (s.overlay == null ? 40 : s.overlay) + '%';
    set('#slHandleText', state.carousel.handle || '@sosone');
    chk('#slHandle', state.carousel.handleOn);
  }

  function setSlideField(fn) {
    const s = currentSlide(); if (!s) return;
    fn(s);
    drawCarousel(); renderStrip(); syncSlideForm(); persistAll();
  }

  /* ---------------- draft ---------------- */
  const STRUCT_STEPS = {
    myth: [
      { kicker: '흔한 오해', title: (t) => t, body: () => '다들 반대로 알고 있는 경우가 많습니다. 오늘 기준을 한 번만 바꿔 봅니다.' },
      { kicker: '오해', title: () => '“비싼 게 오래 간다”는 말', body: () => '값이 아니라 ‘손이 가는 횟수’가 수명을 정합니다. 비싼데 안 쓰면 더 빨리 버리게 됩니다.' },
      { kicker: '실제로는', title: () => '오래 쓰는 사람의 공통점', body: () => '① 꺼내는 자리가 정해져 있다 ② 관리가 30초 안에 끝난다 ③ 고장 나도 수리 부품이 있다' },
      { kicker: '확인 방법', title: () => '사기 전에 3가지만', body: () => '무게 · 소모품 가격 · 먼지통 분리 방식. 이 세 개는 스펙표가 아니라 매뉴얼에 있습니다.' },
      { kicker: '정리', title: (t) => t + ', 결국 두 가지', body: () => '기준이 두 개로 줄면 비교가 빨라지고, 안 사는 선택도 쉬워집니다.', cta: true }
    ],
    problem: [
      { kicker: '문제', title: (t) => t, body: () => '원인은 따로 있습니다. 증상부터 순서대로 정리했습니다.' },
      { kicker: '증상', title: () => '이런 일이 반복된다면', body: () => '① 같은 문제가 두 번 이상 ② 해결이 매번 임시방편 ③ 결국 다시 원점' },
      { kicker: '원인', title: () => '대부분 여기서 어긋납니다', body: () => '기준이 없다 → 비교가 안 된다 → 선택이 늦다. 문제는 물건이 아니라 순서였습니다.' },
      { kicker: '해결 1', title: () => '기준을 두 개로 줄이기', body: () => '고르는 기준을 두 개만 남기면 나머지는 자동으로 걸러집니다. 나머지는 있으면 좋은 것.' },
      { kicker: '해결 2', title: () => '한 번 정하고 다시 안 보기', body: () => '정한 뒤에는 비교 영상을 안 봅니다. 보는 순간 기준이 흔들리기 때문입니다.' },
      { kicker: '정리', title: (t) => t + ' · 남은 기준', body: () => '결국 오래 쓰는 물건은 두 가지를 만족했습니다.', cta: true }
    ],
    beforeafter: [
      { kicker: '비포 · 애프터', title: (t) => t, body: () => '바꾸기 전과 후, 뭐가 달라졌는지 숫자로 정리했습니다.' },
      { kicker: '비포', title: () => '바꾸기 전', body: () => '매번 같은 자리에서 막혔습니다. 시간은 들고, 결과는 그대로. 문제를 물건 탓으로만 돌렸습니다.' },
      { kicker: '바꾼 것', title: () => '딱 하나만 바꿨습니다', body: () => '사는 기준을 ‘스펙’에서 ‘쓰는 동선’으로. 이 한 줄이 나머지를 바꿨습니다.' },
      { kicker: '애프터', title: () => '바꾼 뒤', body: () => '준비 시간 5분 → 1분, 다시 사는 일 3번 → 0번. 큰 변화는 아니지만 매일 반복됩니다.' },
      { kicker: '유지 팁', title: () => '이 상태를 유지하는 법', body: () => '자리를 정하고, 소모품을 미리 사 두고, 한 달에 한 번 30초만 손봅니다.' },
      { kicker: '정리', title: () => '바꾼 건 하나였습니다', body: () => '기준을 동선으로 바꾼 것. 그 뒤로는 같은 문제가 생기지 않았습니다.', cta: true }
    ],
    checklist: [
      { kicker: '체크리스트', title: (t) => t + ' 전에 볼 것', body: () => '사기 전 5분, 이 다섯 개만 확인하면 됩니다.' },
      { kicker: '체크 1', title: () => '무게와 크기', body: () => '보관 자리에 실제로 들어가는지. 숫자보다 내 집 기준으로 재 보세요.' },
      { kicker: '체크 2', title: () => '소모품 가격', body: () => '본체 값보다 1년 소모품 값이 더 중요합니다. 미리 검색해 보세요.' },
      { kicker: '체크 3', title: () => '분리·세척 시간', body: () => '30초 안에 끝나야 매일 씁니다. 3분이면 일주일에 한 번이 됩니다.' },
      { kicker: '체크 4', title: () => '수리 부품', body: () => '배터리·필터를 따로 살 수 있는지. 이게 수명을 결정합니다.' },
      { kicker: '정리', title: () => '다섯 개면 충분합니다', body: () => '체크리스트는 저장해 두고, 살 때마다 꺼내 보세요.', cta: true }
    ]
  };

  function demoDeck(topic, struct) {
    const t = (topic || '이 주제, 결국 기준 두 가지').trim().replace(/\s+/g, ' ').slice(0, 52);
    const steps = STRUCT_STEPS[struct] || STRUCT_STEPS.problem;
    const p = PRESETS.ink;
    const brandCta = (state.brand.rules.cta || [])[0] || '';
    const slides = steps.map((st, i) => newSlide({
      kicker: st.kicker,
      title: typeof st.title === 'function' ? st.title(t) : st.title,
      body: (typeof st.body === 'function' ? st.body(t) : st.body) + (st.cta && brandCta ? ' ' + brandCta : ''),
      cta: !!st.cta,
      badge: true,
      bg1: i % 2 ? p.bg1 : '#141a26',
      bg2: p.bg2, text: p.text, accent: p.accent, preset: 'ink', overlay: 30
    }));
    return { slides, title: t, structure: struct };
  }

  async function buildCarouselDraft(topicOverride) {
    const topic = topicOverride || state.carousel.topic || pickedText() || ($('#postBase') ? $('#postBase').value.trim().slice(0, 80) : '') || '이 주제, 결국 기준 두 가지';
    const struct = $('#structSel') ? $('#structSel').value : state.carousel.struct;
    state.carousel.struct = struct;
    const btn = $('#btnCarouselDraft'), st = $('#carouselStatus');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 쓰는 중';
    try {
      const out = await withAI(
        () => geminiJSON(
          '한국어 SNS 카드뉴스 작가다. 주제: "' + topic + '"\n스토리 구조: ' + (STRUCT_NAME[struct] || struct) + '\n' +
          (state.brand.picked ? '브랜드 톤: ' + state.brand.rules.tone + '\n금지어(쓰지 말 것): ' + state.brand.rules.banned.join(', ') + '\n' : '') +
          '슬라이드 5~6장. 첫 장은 표지, 마지막은 CTA. 각 슬라이드 title은 22자 이내, body는 2문장 이내.\n' +
          'JSON만: {"slides":[{"kicker":"3자~8자","title":"제목","body":"본문","cta":false}],"title":"덱 제목"}',
          { temp: 0.85, maxTokens: 1600 }
        ),
        () => demoDeck(topic, struct), '카드뉴스 초안'
      );
      let slides = (out.slides || []).map((s, i) => newSlide({
        kicker: s.kicker || '', title: s.title || '', body: s.body || '', cta: !!s.cta || i === (out.slides.length - 1) && i > 0
      }));
      if (!slides.length) slides = demoDeck(topic, struct).slides;
      if (slides.length && !slides[slides.length - 1].cta) slides[slides.length - 1].cta = true;
      state.carousel.slides = slides;
      state.carousel.idx = 0;
      state.carousel.topic = out.title || topic;
      ensureSlideImages(); drawCarousel(); renderStrip(); syncSlideForm(); persistAll(true);
      if (st) st.textContent = '초안 ' + slides.length + '장 · ' + (STRUCT_NAME[struct] || struct) + ' · ' + (out.__mode === 'gemini' ? 'Gemini' : '데모') + ' — 각 장을 고치고 PNG/ZIP으로 저장하세요.';
      toast('카드뉴스 초안 ' + slides.length + '장', 'good');
      logActivity('🎨', '카드뉴스 초안 ' + slides.length + '장 · ' + (STRUCT_NAME[struct] || struct));
      setView('carousel');
    } catch (e) {
      if (st) st.textContent = errMsg(e);
      toast('초안 실패: ' + errMsg(e), 'bad');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  /* ---------------- export ---------------- */
  async function carouselPng() {
    const s = currentSlide(); if (!s) { toast('슬라이드가 없습니다', 'bad'); return; }
    const size = ratioSize();
    const cv = document.createElement('canvas');
    cv.width = size.w; cv.height = size.h;
    drawSlide(cv, s, state.carousel.idx, state.carousel.slides.length);
    const blob = await canvasBlob(cv, 'image/png');
    const name = 'sopost-card-' + pad(state.carousel.idx + 1) + '-' + state.carousel.ratio.replace(':', 'x') + '.png';
    download(blob, name);
    state.exported++;
    const st = $('#carouselStatus');
    if (st) st.textContent = 'PNG 저장 · ' + name + ' · ' + size.w + '×' + size.h + ' · ' + Math.round(blob.size / 1024) + 'KB';
    logActivity('⬇️', '카드뉴스 PNG · ' + size.w + '×' + size.h + ' · ' + name);
    toast('PNG 저장 · ' + size.w + '×' + size.h, 'good');
    return blob;
  }

  async function carouselZip() {
    if (!state.carousel.slides.length) { toast('슬라이드가 없습니다', 'bad'); return; }
    const btn = $('#btnCarouselZip'), st = $('#carouselStatus');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 묶는 중';
    try {
      const size = ratioSize();
      const files = [];
      for (let i = 0; i < state.carousel.slides.length; i++) {
        const cv = document.createElement('canvas');
        cv.width = size.w; cv.height = size.h;
        drawSlide(cv, state.carousel.slides[i], i, state.carousel.slides.length);
        const blob = await canvasBlob(cv, 'image/png');
        const buf = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: 'sopost-' + pad(i + 1) + (i === 0 ? '-cover' : '') + '.png', data: buf });
      }
      files.push({
        name: 'deck.json', data: new TextEncoder().encode(JSON.stringify({
          app: 'SOPOST', ratio: state.carousel.ratio, size: { w: size.w, h: size.h },
          structure: STRUCT_NAME[state.carousel.struct] || state.carousel.struct,
          topic: state.carousel.topic || '', handle: state.carousel.handle,
          slides: state.carousel.slides.map((s, i) => ({ n: i + 1, kicker: s.kicker, title: s.title, body: s.body, cta: !!s.cta })),
          generatedAt: new Date().toISOString()
        }, null, 2))
      });
      const zip = zipStore(files);
      const name = 'sopost-cardnews-' + state.carousel.ratio.replace(':', 'x') + '.zip';
      download(zip, name);
      state.exported++;
      const w = $('#carouselDlWrap'), a = $('#carouselDl');
      if (w && a) { w.classList.remove('hidden'); a.href = URL.createObjectURL(zip); a.download = name; a.textContent = '⬇ ' + name + ' (' + Math.round(zip.size / 1024) + 'KB)'; }
      if (st) st.textContent = 'ZIP 저장 · ' + files.length + '개 파일 · ' + Math.round(zip.size / 1024) + 'KB · PNG ' + state.carousel.slides.length + '장 + deck.json';
      logActivity('🗜️', '카드뉴스 ZIP · ' + state.carousel.slides.length + '장 · ' + Math.round(zip.size / 1024) + 'KB');
      toast('ZIP 저장 · ' + state.carousel.slides.length + '장', 'good');
    } catch (e) {
      toast('ZIP 실패: ' + e.message, 'bad');
    } finally { btn.disabled = false; btn.innerHTML = '⬇ 전체 ZIP'; }
  }

  /* ---------------- events ---------------- */
  function bindCarousel() {
    $$('#ratioBtns button').forEach(b => b.addEventListener('click', () => {
      $$('#ratioBtns button').forEach(x => x.classList.toggle('on', x === b));
      state.carousel.ratio = b.dataset.ratio;
      drawCarousel(); renderStrip(); persistAll();
      toast('비율 ' + RATIOS[state.carousel.ratio].label, 'good');
    }));
    const ss = $('#structSel');
    if (ss) ss.addEventListener('change', () => { state.carousel.struct = ss.value; persistAll(); });
    const bd = $('#btnCarouselDraft');
    if (bd) bd.addEventListener('click', () => buildCarouselDraft());

    const strip = $('#slideStrip');
    if (strip) strip.addEventListener('click', e => {
      const b = e.target.closest('.slide-thumb'); if (!b) return;
      state.carousel.idx = Number(b.dataset.i) || 0;
      drawCarousel(); renderStrip(); syncSlideForm(); persistAll();
    });

    const field = (sel, evt, fn) => { const el = $(sel); if (el) el.addEventListener(evt, fn); };
    field('#slKicker', 'input', e => setSlideField(s => { s.kicker = e.target.value; }));
    field('#slTitle', 'input', e => setSlideField(s => { s.title = e.target.value; }));
    field('#slBody', 'input', e => setSlideField(s => { s.body = e.target.value; }));
    field('#slBadge', 'change', e => setSlideField(s => { s.badge = e.target.checked; }));
    field('#slCta', 'change', e => setSlideField(s => { s.cta = e.target.checked; }));
    field('#slBgType', 'change', e => setSlideField(s => { s.bgType = e.target.value; }));
    field('#slBg1', 'input', e => setSlideField(s => { s.bg1 = e.target.value; }));
    field('#slBg2', 'input', e => setSlideField(s => { s.bg2 = e.target.value; }));
    field('#slOverlay', 'input', e => setSlideField(s => { s.overlay = Number(e.target.value); }));
    field('#slText', 'input', e => setSlideField(s => { s.text = e.target.value; }));
    field('#slAccent', 'input', e => setSlideField(s => { s.accent = e.target.value; }));
    field('#slPreset', 'change', e => setSlideField(s => {
      const p = PRESETS[e.target.value] || PRESETS.ink;
      s.preset = e.target.value; s.bg1 = p.bg1; s.bg2 = p.bg2; s.text = p.text; s.accent = p.accent;
    }));
    field('#slImage', 'change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        setSlideField(s => {
          s.img = fr.result; s.bgType = 'image';
          const im = new Image();
          im.onload = () => { s.imgEl = im; drawCarousel(); renderStrip(); };
          im.src = fr.result;
        });
        const nm = $('#slImageName'); if (nm) nm.textContent = f.name;
        toast('배경 이미지를 넣었습니다', 'good');
      };
      fr.readAsDataURL(f);
      e.target.value = '';
    });
    field('#slHandle', 'change', e => { state.carousel.handleOn = e.target.checked; drawCarousel(); renderStrip(); persistAll(); });
    field('#slHandleText', 'input', e => { state.carousel.handle = e.target.value; drawCarousel(); renderStrip(); persistAll(); });

    const add = $('#btnAddSlide');
    if (add) add.addEventListener('click', () => {
      state.carousel.slides.splice(state.carousel.idx + 1, 0, newSlide({ title: '새 슬라이드', body: '', bgType: 'gradient' }));
      state.carousel.idx++;
      drawCarousel(); renderStrip(); syncSlideForm(); persistAll(); toast('슬라이드를 추가했습니다');
    });
    const dup = $('#btnDupSlide');
    if (dup) dup.addEventListener('click', () => {
      const s = currentSlide(); if (!s) return;
      const copy = newSlide(Object.assign({}, s, { id: uid('s') }));
      copy.imgEl = s.imgEl;
      state.carousel.slides.splice(state.carousel.idx + 1, 0, copy);
      state.carousel.idx++;
      drawCarousel(); renderStrip(); syncSlideForm(); persistAll(); toast('슬라이드를 복제했습니다');
    });
    const del = $('#btnDelSlide');
    if (del) del.addEventListener('click', () => {
      if (!state.carousel.slides.length) return;
      state.carousel.slides.splice(state.carousel.idx, 1);
      state.carousel.idx = clamp(state.carousel.idx, 0, Math.max(0, state.carousel.slides.length - 1));
      drawCarousel(); renderStrip(); syncSlideForm(); persistAll(); toast('슬라이드를 삭제했습니다');
    });
    const move = d => () => {
      const i = state.carousel.idx, j = i + d;
      if (j < 0 || j >= state.carousel.slides.length) return;
      const a = state.carousel.slides;
      [a[i], a[j]] = [a[j], a[i]];
      state.carousel.idx = j;
      drawCarousel(); renderStrip(); syncSlideForm(); persistAll();
    };
    const ml = $('#btnMoveLeft'), mr = $('#btnMoveRight');
    if (ml) ml.addEventListener('click', move(-1));
    if (mr) mr.addEventListener('click', move(1));

    const png = $('#btnCarouselPng'); if (png) png.addEventListener('click', carouselPng);
    const zip = $('#btnCarouselZip'); if (zip) zip.addEventListener('click', carouselZip);
  }

  function initCarousel() {
    bindCarousel();
    ensureSlideImages();
    $$('#ratioBtns button').forEach(b => b.classList.toggle('on', b.dataset.ratio === state.carousel.ratio));
    const ss = $('#structSel'); if (ss) ss.value = state.carousel.struct || 'problem';
    drawCarousel(); renderStrip(); syncSlideForm();
  }
