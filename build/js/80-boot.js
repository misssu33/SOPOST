  /* =========================================================
     80-boot.js — 저장된 상태 복원 · 초기화 · 전역 노출
     ========================================================= */

  function loadState() {
    const brand = lsGet(LS.brand, null);
    if (brand) {
      const samples = Array.isArray(brand.samples) && brand.samples.length === 5 ? brand.samples : state.brand.samples;
      state.brand = Object.assign({}, state.brand, brand, { samples });
      if (!state.brand.rules) state.brand.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
    }
    const collect = lsGet(LS.collect, null);
    if (collect) state.collect = Object.assign({}, state.collect, collect, { rss: Object.assign({}, state.collect.rss, collect.rss || {}) });
    const deck = lsGet(LS.carousel, null);
    if (deck && Array.isArray(deck.slides)) {
      state.carousel = Object.assign({}, state.carousel, deck);
      state.carousel.slides = deck.slides.map(s => newSlide(s));
    }
    const post = lsGet(LS.post, null);
    if (post) state.post = Object.assign({}, state.post, post, { platforms: Object.assign({}, state.post.platforms, post.platforms || {}) });
    const clip = lsGet(LS.clip, null);
    if (clip) {
      state.clip = Object.assign({}, state.clip, clip, { videos: [], segs: [] });
      state.clip.tts = Object.assign({}, state.clip.tts, clip.tts || {});
    }
    const cal = lsGet(LS.cal, null);
    if (cal) state.cal = Object.assign({}, state.cal, cal);
    const ana = lsGet(LS.ana, null);
    if (ana) state.ana = Object.assign({}, state.ana, ana);
    state.activity = lsGet(LS.act, []) || [];
    const exp = lsGet(LS.exp, 0);
    if (typeof exp === 'number') state.exported = exp;
  }

  function boot() {
    loadState();
    initBrand();
    initCollect();
    initCarousel();
    initPost();
    initClip();
    initCalendar();
    initAnalytics();
    renderHome();

    // 내비게이션
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('[data-goto]').forEach(b => b.addEventListener('click', () => setView(b.dataset.goto)));
    const lim = $('#btnLimits'); if (lim) lim.addEventListener('click', () => setView('limits'));
    const hide = $('#btnHideLimit');
    if (hide) hide.addEventListener('click', () => $('#limitBar').classList.add('hide'));

    // 해시로 들어온 경우
    const h = (location.hash || '').replace('#', '');
    if (h && VIEW_TITLES[h]) setView(h);
    else setView('home');

    // 키 입력 후 상태 갱신
    updateModeBadge(); updateBrandBadge();

    // 탭이 다시 보일 때 캔버스 재렌더 (폰트 로딩·레이아웃 변화 대비)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { drawCarousel(); renderStrip(); drawClip(); drawChart(); }
    });
    window.addEventListener('resize', () => { drawChart(); }, { passive: true });

    // 저장 안 된 변경을 닫기 전에 저장
    window.addEventListener('beforeunload', () => { try { persistAll(true); } catch (e) {} });
    persistAll(true);
  }

  window.SOPOST = {
    state,
    setView,
    zipStore,
    crc32,
    RATIOS,
    PLATFORM_ORDER,
    LIMIT_NOTE,
    buildCarouselDraft,
    buildPlatforms,
    buildTts,
    exportClip,
    carouselPng,
    carouselZip,
    expandMonth,
    calPayload,
    summarize,
    er,
    hitBanned,
    demoDeck,
    persistAll,
    get clipAudio() { return clipAudio; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
