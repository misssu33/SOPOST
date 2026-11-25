  /* =========================================================
     60-calendar.js — 5 월간 캘린더: 예약 · 반복 · 끌어 옮기기 · JSON
     ========================================================= */

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const CAL_PLAT = { ig: '인스타그램', tt: '틱톡', yt: '유튜브', th: '스레드', x: 'X', blog: '블로그' };

  function ymOf(dateStr) { return String(dateStr || '').slice(0, 7); }
  function dateISO(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parseISO(s) { const a = String(s || '').split('-').map(Number); return new Date(a[0], (a[1] || 1) - 1, a[2] || 1); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function expandMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m - 1, daysInMonth(y, m));
    const out = [];
    state.cal.events.forEach(ev => {
      const base = parseISO(ev.date);
      if (isNaN(base.getTime())) return;
      const push = d => out.push({
        id: ev.id, date: dateISO(d.getFullYear(), d.getMonth() + 1, d.getDate()),
        time: ev.time || '19:00', title: ev.title, platform: ev.platform, repeat: ev.repeat, note: ev.note || '',
        isRepeat: dateISO(d.getFullYear(), d.getMonth() + 1, d.getDate()) !== ev.date
      });
      if (!ev.repeat || ev.repeat === 'none') {
        if (base >= first && base <= last) push(base);
      } else if (ev.repeat === 'weekly') {
        let cur = new Date(base);
        if (cur < first) {
          const diffDays = Math.ceil((first - cur) / 86400000 / 7) * 7;
          cur = new Date(cur.getTime() + diffDays * 86400000);
        }
        while (cur <= last) { push(new Date(cur)); cur = new Date(cur.getTime() + 7 * 86400000); }
      } else if (ev.repeat === 'monthly') {
        for (let k = 0; k < 36; k++) {
          const d = new Date(base.getFullYear(), base.getMonth() + k, Math.min(base.getDate(), daysInMonth(base.getFullYear(), base.getMonth() + k + 1)));
          if (d > last) break;
          if (d >= first) push(d);
          if (d > last) break;
        }
      }
    });
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function renderCalendar() {
    const grid = $('#calGrid'), dow = $('#calDowRow'), title = $('#calTitle');
    if (!grid) return;
    const [y, m] = state.cal.ym.split('-').map(Number);
    if (dow) dow.innerHTML = DOW.map((d, i) => '<div class="cal-dow' + (i === 0 ? ' sun' : '') + '">' + d + '</div>').join('');
    if (title) title.textContent = y + '년 ' + m + '월';
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay();
    const dim = daysInMonth(y, m);
    const prevDim = daysInMonth(y, m === 1 ? 12 : m - 1);
    const occ = expandMonth(state.cal.ym);
    const byDate = {};
    occ.forEach(o => { (byDate[o.date] = byDate[o.date] || []).push(o); });
    const today = todayISO();
    const cells = [];
    for (let i = 0; i < startPad; i++) {
      const d = prevDim - startPad + i + 1;
      const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
      cells.push({ y: py, m: pm, d, out: true });
    }
    for (let d = 1; d <= dim; d++) cells.push({ y, m, d, out: false });
    let next = 1;
    while (cells.length % 7 !== 0) { cells.push({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: next++, out: true }); }

    grid.innerHTML = cells.map(c => {
      const ds = dateISO(c.y, c.m, c.d);
      const evs = byDate[ds] || [];
      const wd = new Date(c.y, c.m - 1, c.d).getDay();
      const cls = ['cal-day'];
      if (c.out) cls.push('out');
      if (wd === 0) cls.push('sun');
      if (ds === today) cls.push('today');
      return '<div class="' + cls.join(' ') + '" data-date="' + ds + '">' +
        '<div class="dnum"><span>' + c.d + '</span><button class="add" type="button" data-add="' + ds + '" title="이 날 예약 추가">＋</button></div>' +
        evs.slice(0, 3).map(e => {
          const cls2 = 'cal-ev ' + (({ ig: 'p-ig', tt: 'p-tt', yt: 'p-yt', th: 'p-th', x: 'p-x', blog: 'p-blog' })[e.platform] || '');
          return '<div class="' + cls2 + '" draggable="true" data-id="' + e.id + '" data-date="' + ds + '" title="' + esc(e.title + ' · ' + e.time + (e.repeat && e.repeat !== 'none' ? ' · 반복 ' + (e.repeat === 'weekly' ? '매주' : '매월') : '')) + '">' +
            (e.time ? e.time + ' ' : '') + esc(e.title) + '</div>';
        }).join('') +
        (evs.length > 3 ? '<div class="hint" style="font-size:9px">+' + (evs.length - 3) + '</div>' : '') +
        '</div>';
    }).join('');

    const cnt = $('#calCount'); if (cnt) cnt.textContent = occ.length + '개 (이번 달)';
    renderCalJson();
  }

  function calPayload() {
    const occ = expandMonth(state.cal.ym);
    const events = state.cal.events.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    return {
      app: 'SOPOST schedule',
      version: 1,
      timezone: 'Asia/Seoul',
      generatedAt: new Date().toISOString(),
      month: state.cal.ym,
      events: events.map(e => ({
        id: e.id, title: e.title, platform: e.platform, platformName: CAL_PLAT[e.platform] || e.platform,
        start: e.date + 'T' + (e.time || '19:00') + ':00+09:00', repeat: e.repeat || 'none', note: e.note || ''
      })),
      occurrences: occ.map(o => ({
        eventId: o.id, date: o.date, time: o.time,
        start: o.date + 'T' + o.time + ':00+09:00', title: o.title,
        platform: o.platform, repeat: o.repeat || 'none'
      })),
      handoff: { command: 'sopost-scheduler --file sopost-schedule-' + state.cal.ym + '.json' },
      limits: { note: '브라우저가 닫히면 자동 게시할 수 없습니다. 이 파일을 PC 스케줄러가 읽어 준비합니다.' }
    };
  }

  function renderCalJson() {
    const pre = $('#calJson');
    if (!pre) return;
    const p = calPayload();
    pre.textContent = JSON.stringify({ month: p.month, events: p.events.length, occurrences: p.occurrences.length, sample: p.events.slice(0, 2) }, null, 2);
  }

  function exportCal() {
    const payload = calPayload();
    downloadText(JSON.stringify(payload, null, 2), 'sopost-schedule-' + state.cal.ym + '.json');
    state.exported++;
    toast('sopost-schedule-' + state.cal.ym + '.json 내보냈습니다', 'good');
    logActivity('📅', '스케줄 JSON 내보내기 · ' + payload.occurrences.length + '건 · ' + state.cal.ym);
  }

  function readEventForm() {
    return {
      date: $('#evDate').value,
      time: $('#evTime').value || '19:00',
      title: ($('#evTitle').value || '').trim(),
      platform: $('#evPlatform').value,
      repeat: $('#evRepeat').value,
      note: ($('#evNote').value || '').trim()
    };
  }
  function fillEventForm(ev, date) {
    const set = (sel, v) => { const el = $(sel); if (el) el.value = v == null ? '' : v; };
    set('#evDate', ev ? ev.date : (date || todayISO()));
    set('#evTime', ev ? ev.time : '19:00');
    set('#evTitle', ev ? ev.title : '');
    set('#evPlatform', ev ? ev.platform : 'ig');
    set('#evRepeat', ev ? (ev.repeat || 'none') : 'none');
    set('#evNote', ev ? (ev.note || '') : '');
    state.cal.editing = ev ? ev.id : null;
    const m = $('#evMode');
    if (m) m.textContent = ev ? '수정 중 · ' + ev.title : '새 예약';
    const del = $('#btnEvDelete');
    if (del) del.disabled = !ev;
  }

  function saveEvent() {
    const f = readEventForm();
    if (!f.title) { toast('제목을 입력하세요', 'bad'); $('#evTitle').focus(); return; }
    if (!f.date) { toast('날짜를 고르세요', 'bad'); return; }
    if (state.cal.editing) {
      const ev = state.cal.events.find(e => e.id === state.cal.editing);
      if (ev) { Object.assign(ev, f); toast('예약을 수정했습니다', 'good'); }
    } else {
      state.cal.events.push(Object.assign({ id: uid('e') }, f));
      toast('예약을 추가했습니다 · ' + f.date + ' ' + f.time, 'good');
    }
    state.cal.ym = ymOf(f.date) || state.cal.ym;
    renderCalendar(); persistAll(true);
    logActivity('📅', (state.cal.editing ? '예약 수정 · ' : '예약 추가 · ') + f.date + ' ' + f.time + ' ' + f.title);
    fillEventForm(null, f.date);
  }

  function deleteEvent() {
    if (!state.cal.editing) { toast('수정 중인 예약이 없습니다', 'bad'); return; }
    state.cal.events = state.cal.events.filter(e => e.id !== state.cal.editing);
    state.cal.editing = null;
    renderCalendar(); persistAll(true); fillEventForm(null, todayISO());
    toast('예약을 삭제했습니다');
  }

  function shiftYM(delta) {
    const [y, m] = state.cal.ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    state.cal.ym = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    renderCalendar(); persistAll();
  }

  function bindCalendar() {
    const box = $('#panel-calendar');
    if (box) box.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      if (add) { fillEventForm(null, add.dataset.add); $('#evTitle').focus(); return; }
      const chip = e.target.closest('.cal-ev');
      if (chip) {
        const ev = state.cal.events.find(x => x.id === chip.dataset.id);
        if (ev) { fillEventForm(ev, ev.date); document.querySelector('#evTitle').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return;
      }
      const cell = e.target.closest('.cal-day');
      if (cell) { fillEventForm(null, cell.dataset.date); $('#evTitle').focus({ preventScroll: true }); }
    });
    // drag & drop
    let dragId = null, dragDate = null;
    if (box) {
      box.addEventListener('dragstart', e => {
        const chip = e.target.closest('.cal-ev'); if (!chip) return;
        dragId = chip.dataset.id; dragDate = chip.dataset.date;
        try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
        e.dataTransfer.effectAllowed = 'move';
      });
      box.addEventListener('dragover', e => {
        const cell = e.target.closest('.cal-day'); if (!cell) return;
        e.preventDefault();
        $$('.cal-day').forEach(c => c.classList.remove('drop'));
        cell.classList.add('drop');
      });
      box.addEventListener('dragleave', e => {
        const cell = e.target.closest('.cal-day');
        if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('drop');
      });
      box.addEventListener('drop', e => {
        const cell = e.target.closest('.cal-day'); if (!cell || !dragId) return;
        e.preventDefault();
        const ev = state.cal.events.find(x => x.id === dragId);
        const target = cell.dataset.date;
        if (ev && target && target !== dragDate) {
          const delta = Math.round((parseISO(target) - parseISO(dragDate)) / 86400000);
          const nd = new Date(parseISO(ev.date).getTime() + delta * 86400000);
          ev.date = dateISO(nd.getFullYear(), nd.getMonth() + 1, nd.getDate());
          if (ev.repeat && ev.repeat !== 'none') toast('반복 일정이라 시작일을 옮겼습니다 · ' + ev.date, '');
          else toast('옮겼습니다 · ' + ev.date + ' ' + ev.time, 'good');
          renderCalendar(); persistAll(true);
          logActivity('📅', '예약 이동 · ' + ev.title + ' → ' + ev.date);
        }
        $$('.cal-day').forEach(c => c.classList.remove('drop'));
        dragId = null; dragDate = null;
      });
      box.addEventListener('dragend', () => { $$('.cal-day').forEach(c => c.classList.remove('drop')); dragId = null; });
    }
    const prev = $('#btnPrev'); if (prev) prev.addEventListener('click', () => shiftYM(-1));
    const next = $('#btnNext'); if (next) next.addEventListener('click', () => shiftYM(1));
    const td = $('#btnToday');
    if (td) td.addEventListener('click', () => {
      const d = new Date();
      state.cal.ym = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      renderCalendar(); fillEventForm(null, todayISO()); persistAll();
    });
    const sv = $('#btnEvSave'); if (sv) sv.addEventListener('click', saveEvent);
    const del = $('#btnEvDelete'); if (del) del.addEventListener('click', deleteEvent);
    const nw = $('#btnEvNew'); if (nw) nw.addEventListener('click', () => fillEventForm(null, todayISO()));
    const ex = $('#btnCalExport'); if (ex) ex.addEventListener('click', exportCal);
    const ex2 = $('#btnCalExport2'); if (ex2) ex2.addEventListener('click', exportCal);
    const js = $('#btnCalJson'); if (js) js.addEventListener('click', () => { renderCalJson(); toast('JSON 미리보기를 갱신했습니다'); });
  }

  function initCalendar() {
    bindCalendar();
    // 예시 일정 (처음 한 번)
    if (!state.cal.events.length) {
      const d = new Date();
      const base = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      state.cal.events = [
        { id: uid('e'), date: base + '-26', time: '19:00', title: '무선청소기 카드뉴스', platform: 'ig', repeat: 'none', note: '첫 댓글에 비교표 링크' },
        { id: uid('e'), date: base + '-27', time: '12:30', title: '쇼츠 3편 예약', platform: 'tt', repeat: 'weekly', note: '' },
        { id: uid('e'), date: base + '-28', time: '09:00', title: '주간 성과 정리', platform: 'blog', repeat: 'weekly', note: '조회·저장 입력' }
      ];
      persistAll(true);
    }
    const td = new Date();
    if (!/^\d{4}-\d{2}$/.test(state.cal.ym || '')) state.cal.ym = td.getFullYear() + '-' + pad(td.getMonth() + 1);
    renderCalendar();
    fillEventForm(null, todayISO());
  }
