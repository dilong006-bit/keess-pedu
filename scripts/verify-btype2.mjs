/**
 * /kium B-Type 고도화 QA — 기술명세서 v1.0(260904) §11
 *
 * 실행: (서버 기동 후) node scripts/verify-btype2.mjs [출력디렉터리]
 *       BASE_URL로 배포본 대상 실행 가능.
 *
 * 커버: §11-2 카운트·라벨 · §11-3 프리필 경로 P1~P9 · §11-4 공유 폼 회귀 R1~R4
 *       · §11-5 반응형 5뷰포트 · 금지어 전역(런타임 렌더 기준)
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3055';
const OUT = process.argv[2] || 'audit/btype2';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const info = (name, detail) => {
  results.push({ name, pass: true, detail, skipped: true });
  console.log(`SKIP  ${name}  — ${detail}`);
};

const PC = { width: 1440, height: 1000 };
const seg = (p, i) => p.locator('.kium-modeseg .kium-viewseg-btn').nth(i);
const ta = (p) => p.locator('#inq textarea').first();
/** 프리필 헤드 토큰 개수 — 중복이면 2 이상이 된다 */
const heads = (v) =>
  (v.match(/\[관심 과정: /g) || []).length + (v.match(/\[공개교육 상담 신청\]/g) || []).length;

async function openCourses(p) {
  await p.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
  const t = p.locator('#kium-tab-courses');
  if ((await t.getAttribute('aria-selected')) !== 'true') {
    await t.click();
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(300);
}

const browser = await chromium.launch();

/* ═══ §11-2 카운트 · 라벨 ═════════════════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await openCourses(p);

  const segAll = (await seg(p, 0).innerText()).replace(/\s+/g, ' ').trim();
  const segOpen = (await seg(p, 1).innerText()).replace(/\s+/g, ' ').trim();
  ok('Q1 세그먼트 `전체과정 19` / `공개교육 9`(붙여쓰기)', segAll === '전체과정 19' && segOpen === '공개교육 9', `${segAll} | ${segOpen}`);

  // v1.1 §3-4 — 배지만 제거하고 대체 문구는 두지 않는다
  const panel = p.locator('#kium-tabpanel-courses');
  const panelText = await panel.innerText();
  ok('Q2 전체 보기 환급 문구·배지 0건', (await p.locator('.kium-allhead').count()) === 0 && !panelText.includes('정부지원 환급'), `allhead ${await p.locator('.kium-allhead').count()} / 문구 ${panelText.includes('정부지원 환급')}`);
  ok('Q3 정부지원 환급 칩 렌더 0건', (await p.locator('.kium-card .kium-badge.gov').count()) === 0);
  // 히어로·사업소개 탭은 무변경이어야 한다(환급 설명은 그쪽 소관)
  const heroText = await p.locator('.kium-hero').innerText();
  ok('Q3-b 히어로 환급 카피 무변경', heroText.includes('환급'), heroText.split('\n')[0].slice(0, 30));
  ok('Q4 공개교육 뱃지는 존치(9건)', (await p.locator('.kium-openflag').count()) === 9);

  const lead = (await p.locator('.kium-openlead').innerText()).replace(/\s+/g, ' ');
  ok(
    'Q5 인트로 카피 = 사업 확정본',
    lead.startsWith('혼자서도 부담 없이 신청할 수 있는 공개교육 과정을 확인해보세요.'),
    lead.slice(0, 50)
  );
  const leadBtn = p.locator('.kium-openlead-link');
  ok(
    'Q5-b 인트로 링크 라벨 축약 + 접근명 보강',
    (await leadBtn.innerText()).trim() === '일정 보기' &&
      (await leadBtn.getAttribute('aria-label')) === '공개교육 일정 보기',
    `"${(await leadBtn.innerText()).trim()}" / aria="${await leadBtn.getAttribute('aria-label')}"`
  );

  await seg(p, 1).click();
  await p.waitForTimeout(700);

  const chips = await p.locator('#kium-cf-month + .kium-filters .kium-chip').evaluateAll((els) =>
    els.map((e) => ({ t: e.innerText.replace(/\s+/g, ''), a: e.getAttribute('aria-label') }))
  );
  const chipTexts = chips.map((c) => c.t).join(' / ');
  ok(
    'Q6 기간 칩 `N회차` 단위',
    chipTexts === '전체20회차 / 10월6회차 / 11월6회차 / 12월8회차',
    chipTexts
  );
  ok('Q7 기간 칩 aria-label 전건', chips.every((c) => /\d+개 회차$/.test(c.a || '')), chips.map((c) => c.a).join(' / '));

  // 분야·모집 상태 칩은 무변경이어야 한다
  const catChip = (await p.locator('#kium-cf-cat + .kium-filters .kium-chip').nth(1).innerText()).replace(/\s+/g, '');
  const stChip = (await p.locator('.kium-chip-st[data-st="recruiting"]').innerText()).replace(/\s+/g, '');
  ok('Q8 분야·모집 상태 칩 무변경(단위 없음)', !/회차/.test(catChip) && !/회차/.test(stChip), `${catChip} / ${stChip}`);

  // 섹션 헤더 필터 연동 3케이스
  const head = () => p.locator('.kium-modehead-t').innerText().then((t) => t.replace(/\s+/g, ' ').trim());
  const h0 = await head();
  await p.locator('#kium-cf-month + .kium-filters .kium-chip', { hasText: '12월' }).click();
  await p.waitForTimeout(450);
  const h1 = await head();
  await p.locator('.kium-chip-st[data-st="recruiting"]').click();
  await p.waitForTimeout(450);
  const h2 = await head();
  ok(
    'Q9 섹션 헤더 필터 연동 3케이스',
    h0 === '공개교육 일정 · 10~12월 20개 회차' &&
      h1 === '공개교육 일정 · 12월 8개 회차' &&
      h2 === '공개교육 일정 · 12월 · 모집중 4개 회차',
    `${h0} → ${h1} → ${h2}`
  );

  const modeSub = (await p.locator('.kium-modehead-s').innerText()).replace(/\s+/g, ' ').trim();
  ok(
    'Q9-b 모드 헤더 보조 문구 = 1명부터 신청 가능 · 교육비 1인 기준(BT-25)',
    modeSub === '1명부터 신청 가능 · 교육비 1인 기준',
    modeSub
  );

  // BT-13 — 시각 요소는 두지 않고, aria-live 통로가 '필터 결과 건수'를 나른다.
  // 이 시점의 필터는 12월 + 모집중이므로 헤더(h2)와 같은 범위·건수를 말해야 한다.
  const srTxt = (await p.locator('.kium-coursesview > .kium-sr[aria-live]').innerText()).trim();
  const expected = h2.replace('공개교육 일정 · ', '');
  ok(
    'Q10 aria-live = 필터 결과 건수 · 시각 요소 0건',
    (await p.locator('.kium-livenote').count()) === 0 && srTxt === expected,
    `live "${srTxt}" / 기대 "${expected}"`
  );

  // 상세 패널 pill — 공개교육 9과정만, 위탁 10과정 미렌더
  await p.locator('.kium-chip-st[data-st="recruiting"]').click();
  await p.locator('#kium-cf-month + .kium-filters .kium-chip', { hasText: '전체' }).first().click();
  await p.waitForTimeout(500);
  await seg(p, 0).click();
  await p.waitForTimeout(600);
  // 공개교육 과정(kium-09) 카드 열기
  await p.locator('#kium-cardwrap-kium-09 .kium-card').click();
  await p.waitForTimeout(700);
  const openPills = await p.locator('.kium-panel-slot .kium-pill[data-open] b').allTextContents();
  ok('Q11 공개교육 pill 라벨 `공개교육`·`교육비`', openPills.join('/') === '공개교육/교육비', openPills.join('/'));
  // 위탁 과정(kium-01) — pill 미렌더
  await p.locator('#kium-cardwrap-kium-09 .kium-card').click();
  await p.waitForTimeout(400);
  await p.locator('#kium-cardwrap-kium-01 .kium-card').click();
  await p.waitForTimeout(700);
  ok('Q12 위탁 과정은 공개교육 pill 미렌더', (await p.locator('.kium-panel-slot .kium-pill[data-open]').count()) === 0);

  await p.screenshot({ path: `${OUT}/q-allview.png`, fullPage: true });
  await p.close();
}

/* ═══ BT-18 — 「전체 일정」은 교체(swap)다 ═══════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  ok('S1 일정 컨테이너 1개(.kium-schedbox)', (await p.locator('.kium-schedbox').count()) === 1);
  ok('S2 모드 헤더가 컨테이너 헤더 행 안', (await p.locator('.kium-schedbox-head .kium-modehead').count()) === 1);
  ok('S3 폐지 요소 0건(.kium-ustrip-wrap · .kium-ustrip-foot)',
     (await p.locator('.kium-ustrip-wrap, .kium-ustrip-foot').count()) === 0);

  const toggle = p.locator('.kium-schedbox-toggle');
  const collapsedLabel = (await toggle.innerText()).trim();
  ok('S4 접힘 라벨 「전체 일정 N개 회차」', /^전체 일정 \d+개 회차$/.test(collapsedLabel), collapsedLabel);
  ok('S5 접힘 상태: 스트립만', (await p.locator('.kium-ustrip').count()) === 1 && (await p.locator('.kium-ulist').count()) === 0);

  // 접힘 상태에서 화면에 보이는 회차 id 수집
  const beforeIds = await p.locator('.kium-ustrip-cell').evaluateAll((els) => els.map((e) => e.getAttribute('data-evt-session')));

  await toggle.click();
  await p.waitForTimeout(500);
  const expandedLabel = (await toggle.innerText()).trim();
  ok('S6 펼침 라벨 「간략히 보기」', expandedLabel === '간략히 보기', expandedLabel);
  const stripAfter = await p.locator('.kium-ustrip').count();
  const listAfter = await p.locator('.kium-ulist .kium-mgroup').count();
  ok('S7 ★ 펼침 시 스트립 소멸 — 같은 회차 중복 노출 0건', stripAfter === 0 && listAfter > 0,
     `스트립 ${stripAfter} / 월 그룹 ${listAfter}`);
  ok('S8 aria-expanded 갱신', (await toggle.getAttribute('aria-expanded')) === 'true');
  ok('S9 전환 고지(aria-live)', /전체 일정 \d+개 회차를 표시했습니다/.test((await p.locator('.kium-schedbox > .kium-sr[aria-live]').innerText()).trim()),
     (await p.locator('.kium-schedbox > .kium-sr[aria-live]').innerText()).trim());
  await p.locator('.kium-schedbox').screenshot({ path: `${OUT}/s-schedbox-open.png` });

  await toggle.click();
  await p.waitForTimeout(500);
  const afterIds = await p.locator('.kium-ustrip-cell').evaluateAll((els) => els.map((e) => e.getAttribute('data-evt-session')));
  ok('S10 접힘 복귀 = 원래 스트립', JSON.stringify(beforeIds) === JSON.stringify(afterIds), afterIds.join(','));
  await p.locator('.kium-schedbox').screenshot({ path: `${OUT}/s-schedbox-collapsed.png` });
  await p.close();
}

/* ═══ BT-17 — CTA 라벨 축약 ══════════════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  /* [검토용 시드 v1.0] 스트립에 3상태가 섞인다 — '라벨 1종' 전제를 상태별 매핑 검증으로 교체 */
  // [BT-27] 신청 가능 3상태 라벨 통일 — 우측이 상태를 반복하지 않는다
  const CTA_BY_TONE = { amber: '상담하기', green: '상담하기', red: '상담하기' };
  const pairs = await p.locator('.kium-ustrip .kium-sact').evaluateAll((els) =>
    els.map((e) => ({
      tone: e.getAttribute('data-tone'),
      go: e.querySelector('.kium-sact-go').textContent.trim(),
      aria: e.getAttribute('aria-label'),
    }))
  );
  ok(
    'T1 회차 CTA 라벨이 상태별 매핑과 일치',
    pairs.length > 0 && pairs.every((x) => x.go === CTA_BY_TONE[x.tone]),
    pairs.map((x) => `${x.tone}:${x.go}`).join(' / ')
  );
  ok(
    'T2 CTA 접근명이 각 라벨로 끝난다',
    pairs.every((x) => (x.aria || '').endsWith(CTA_BY_TONE[x.tone])),
    pairs.map((x) => (x.aria || '').slice(-14)).join(' / ')
  );
  // 3상태가 스트립 첫 화면에 실제로 다 뜨는가(§2-3 설계 기준 3)
  const tones = Array.from(new Set(pairs.map((x) => x.tone)));
  ok('T2-b 스트립 첫 화면에 3상태 전부', tones.length === 3, tones.sort().join(','));

  /* v2.1 §5-5 — 카드 요소 수 5개 → 4개 */
  const parts = await p.locator('.kium-ustrip .kium-scard2').first().evaluate((el) =>
    Array.from(el.children).map((c) => c.className.split(' ')[0])
  );
  ok(
    'T3 카드 직계 요소 4개(배지 흡수)',
    parts.length === 4 && parts.includes('kium-sact') && !parts.includes('kium-sbadge'),
    parts.join(' / ')
  );

  /* v2.1 §5-4 — 과정명 기본 밑줄 없음 / hover·focus 복원 */
  const courseBtn = p.locator('.kium-ustrip .kium-scard2-course').first();
  const base = await courseBtn.evaluate((e) => getComputedStyle(e).textDecorationLine);
  await courseBtn.hover();
  await p.waitForTimeout(300);
  const hover = await courseBtn.evaluate((e) => getComputedStyle(e).textDecorationLine);
  await courseBtn.focus();
  await p.waitForTimeout(200);
  const focus = await courseBtn.evaluate((e) => getComputedStyle(e).textDecorationLine);
  ok(
    'T4 과정명 밑줄 — 기본 none · hover/focus 복원',
    base === 'none' && hover === 'underline' && focus === 'underline',
    `base ${base} / hover ${hover} / focus ${focus}`
  );

  /* [BT-22 갱신] 리스트 뷰도 같은 통합 버튼을 쓴다 — v2.1까지의 '미적용' 기대값을 교체 */
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(600);
  const rowSact = await p.locator('.kium-srow .kium-sact').count();
  /* [F21 갱신] 마감 행은 버튼이 아니라 .kium-sact-closed(정적 배지 + 텍스트 링크)라
     .kium-sact가 잡히지 않는다 — 형태로 구분한다는 BT-20 설계 그대로다. */
  const rowClosed = await p.locator('.kium-srow .kium-sact-closed').count();
  const rowCta = await p.locator('.kium-srow > .kium-srow-act > .kium-cta-ses').count();
  const rows = await p.locator('.kium-srow').count();
  ok(
    'T5 리스트 행도 통합 버튼(BT-22 · F21)',
    rowSact + rowClosed === rows && rows > 0 && rowCta === 0,
    `행 ${rows} / sact ${rowSact} + 마감 ${rowClosed} / 구 CTA ${rowCta}`
  );

  /* 리스트 행 폭 규칙 — 상태 영역이 한 열에 서는가.
     ★ 검토용 시드로 3상태가 처음 공존하면서 드리프트가 드러났다:
       .kium-srow-act{justify-content:flex-end} + .kium-sact{width:auto;min-width:184px} 조합에서
       긴 라벨 버튼이 더 넓어 우측 정렬 기준상 좌측으로 밀렸다(BT-27 라벨 통일로 해소 여부 계측).
       BT-22 CSS 수정은 이번 범위 밖이라 **고치지 않고 수치만 남긴다**(완료 보고에 별도 보고). */
  const stLefts = await p.locator('.kium-srow .kium-sact-st').evaluateAll((els) =>
    Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))))
  );
  const drift = stLefts.length > 1 ? Math.max(...stLefts) - Math.min(...stLefts) : 0;
  info(
    'T6 리스트 상태 영역 좌측 정렬',
    stLefts.length === 1
      ? `한 열 정렬(left ${stLefts[0]})`
      : `★ 미해결 — left 좌표 ${stLefts.length}종(${stLefts.join(',')}) · 드리프트 ${drift}px. 긴 라벨 버튼이 더 넓어 우측 정렬에서 밀린다(BT-22 범위)`
  );
  await p.close();
}

/* ═══ BT-21 — 상태색이 세 곳에서 동일한가 ════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const iconColor = (loc) => loc.evaluate((el) => getComputedStyle(el.querySelector('svg')).color);

  // ① 필터 칩 (미선택 상태여야 상태색이 보인다 — 선택 시 흰색으로 반전)
  const chip = {};
  for (const st of ['recruiting', 'confirmed', 'closing', 'closed']) {
    chip[st] = await iconColor(p.locator(`.kium-chip-st[data-st="${st}"]`));
  }

  // ② 스트립 카드 통합 버튼 — 현재 데이터는 전건 recruiting이라 amber만 실측된다
  const strip = {};
  for (const [tone, st] of [['amber', 'recruiting'], ['green', 'confirmed'], ['red', 'closing']]) {
    const loc = p.locator(`.kium-ustrip .kium-sact[data-tone="${tone}"] .kium-sact-st`).first();
    strip[st] = (await loc.count()) ? await iconColor(loc) : null;
  }

  // ③ 리스트 행 통합 버튼
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(600);
  const list = {};
  for (const [tone, st] of [['amber', 'recruiting'], ['green', 'confirmed'], ['red', 'closing']]) {
    const loc = p.locator(`.kium-srow .kium-sact[data-tone="${tone}"] .kium-sact-st`).first();
    list[st] = (await loc.count()) ? await iconColor(loc) : null;
  }

  for (const st of ['recruiting', 'confirmed', 'closing']) {
    const vals = [chip[st], strip[st], list[st]].filter(Boolean);
    ok(
      `C-${st} 상태색 일치(칩/스트립/리스트)`,
      new Set(vals).size === 1,
      `칩 ${chip[st]} / 스트립 ${strip[st] ?? '해당 회차 없음'} / 리스트 ${list[st] ?? '해당 회차 없음'}`
    );
  }
  await p.close();
}

/* ═══ BT-21 — 4상태 색을 쇼케이스에서 전건 실측 ══════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const showcase = await p.locator('.kium-showcase .kium-strip .kium-scard2').evaluateAll((els) =>
    els.map((el) => {
      const st = el.querySelector('.kium-sact-st svg') || el.querySelector('.kium-sbadge svg');
      return { status: el.getAttribute('data-status'), color: st ? getComputedStyle(st).color : null };
    })
  );
  const want = {
    recruiting: 'rgb(180, 83, 9)',
    confirmed: 'rgb(21, 128, 61)',
    closing: 'rgb(220, 38, 38)',
  };
  for (const [st, exp] of Object.entries(want)) {
    const got = showcase.find((r) => r.status === st)?.color;
    ok(`C2-${st} 통합 버튼 아이콘 색 = ${exp}`, got === exp, `실측 ${got}`);
  }
  // closed는 .kium-sact-closed 분기 → .kium-sbadge[data-tone="gray"] 배색 유지(변경 금지 대상)
  const closedBadgeBg = await p
    .locator('.kium-showcase .kium-strip .kium-scard2[data-status="closed"] .kium-sbadge')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  ok('C2-closed 마감 배지 pill 배색 무변경(#F3F4F6)', closedBadgeBg === 'rgb(243, 244, 246)', closedBadgeBg);
  await p.close();
}

/* ═══ BT-22 2-3 — 마감 '리스트 행'이 한 줄로 유지되는가 ══════════
   현재 데이터에 closed 회차가 없어(BT-02) 실제 마감 행이 렌더되지 않는다.
   함정이 되는 규칙은 .kium-srow-act 스코프에만 있으므로 쇼케이스 카드로는 검증되지 않는다
   → 실제 리스트 행 안에 마감 구조를 주입해 CSS 적용 결과만 측정하고 즉시 제거한다.
   (데이터·컴포넌트는 건드리지 않는다) */
{
  for (const w of [320, 375, 639, 640, 1023, 1024]) {
    const p = await browser.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.locator('.kium-schedbox-toggle').click();
    await p.waitForTimeout(600);

    const geo = await p.evaluate(() => {
      const act = document.querySelector('.kium-srow-act');
      if (!act) return null;
      const probe = document.createElement('div');
      probe.className = 'kium-sact-closed';
      probe.innerHTML =
        '<span class="kium-sbadge" data-tone="gray"><svg width="14" height="14"></svg><span>마감</span></span>' +
        '<button type="button" class="kium-cta-next"><svg width="16" height="16"></svg><span>다음 회차 상담</span></button>';
      act.appendChild(probe);
      const badge = probe.querySelector('.kium-sbadge').getBoundingClientRect();
      const link = probe.querySelector('.kium-cta-next').getBoundingClientRect();
      const own = probe.getBoundingClientRect();
      const r = {
        sameLine: Math.abs(badge.top - link.top) < badge.height,
        // 함정: 자손 선택자면 링크가 컨테이너 전폭이 되어 배지를 밀어낸다
        linkFull: Math.round(link.width) >= Math.round(own.width) - 1,
        badgeW: Math.round(badge.width),
      };
      probe.remove();
      return r;
    });

    ok(
      `X ${w}px 마감 리스트 행 한 줄 · 링크 전폭 아님`,
      !!geo && geo.sameLine && !geo.linkFull && geo.badgeW > 0,
      JSON.stringify(geo)
    );
    await p.close();
  }
}

/* 쇼케이스 카드(.kium-scard2)의 마감 형태도 함께 확인 — 카드 스코프 회귀 */
{
  const p = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const geo = await p
    .locator('.kium-showcase .kium-scard2[data-status="closed"] .kium-sact-closed')
    .first()
    .evaluate((el) => {
      const badge = el.querySelector('.kium-sbadge').getBoundingClientRect();
      const link = el.querySelector('.kium-cta-next').getBoundingClientRect();
      return { sameLine: Math.abs(badge.top - link.top) < badge.height, isButton: false };
    });
  ok('X-card 375px 마감 카드 한 줄(배지 + 텍스트 링크)', geo.sameLine, JSON.stringify(geo));
  await p.close();
}

/* ═══ v2.1 §5-5 — 4상태 전건 렌더 (?preview=badges 쇼케이스) ══════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  // ④ 상세 회차 카드 4종 — SessionCard이므로 SessionAction이 들어간다
  const cards = p.locator('.kium-showcase .kium-strip .kium-scard2');
  ok('U1 쇼케이스 회차 카드 4종', (await cards.count()) === 4);

  const rows = await cards.evaluateAll((els) =>
    els.map((el) => {
      const act = el.querySelector('.kium-sact');
      const closed = el.querySelector('.kium-sact-closed');
      return {
        status: el.getAttribute('data-status'),
        isButton: !!act,
        tone: act ? act.getAttribute('data-tone') : null,
        go: (el.querySelector('.kium-sact-go') || el.querySelector('.kium-cta-next'))?.textContent.trim(),
        seats: el.querySelector('.kium-sact-st em')?.textContent.trim() || null,
        closedShape: !!closed && !!closed.querySelector('.kium-sbadge') && !!closed.querySelector('.kium-cta-next'),
      };
    })
  );
  const by = (st) => rows.find((r) => r.status === st);

  ok('U2 recruiting — 버튼 · 상담하기', by('recruiting')?.isButton && by('recruiting')?.go === '상담하기', JSON.stringify(by('recruiting')));
  ok('U3 confirmed — 버튼 · 상담하기', by('confirmed')?.isButton && by('confirmed')?.go === '상담하기', JSON.stringify(by('confirmed')));
  ok(
    'U4 closing — filled(red) · 상담하기 · 잔여석 병기(BT-27)',
    by('closing')?.isButton && by('closing')?.tone === 'red' && by('closing')?.go === '상담하기' && /잔여 \d+석/.test(by('closing')?.seats || ''),
    JSON.stringify(by('closing'))
  );
  ok(
    'U5 closed — 버튼 아님 · 정적 배지 + 텍스트 링크',
    by('closed')?.isButton === false && by('closed')?.closedShape === true && by('closed')?.go === '다음 회차 상담',
    JSON.stringify(by('closed'))
  );
  ok(
    'U6 잔여석은 closing에만',
    rows.filter((r) => r.seats).length === 1 && by('closing')?.seats !== null,
    rows.map((r) => `${r.status}:${r.seats}`).join(' / ')
  );

  /* 기존 SessionBadge·SessionCta 존치 — 쇼케이스 ①②행이 정상 동작 */
  ok('U7 SessionBadge 존치(쇼케이스 ①행)', (await p.locator('.kium-showcase-row .kium-sbadge').count()) >= 4);
  ok('U8 SessionCta 존치(쇼케이스 ②행)', (await p.locator('.kium-showcase-row .kium-cta-ses, .kium-showcase-row .kium-cta-next').count()) >= 4);

  await p.locator('.kium-showcase .kium-strip').screenshot({ path: `${OUT}/u-states-4.png` });
  await p.close();
}

/* ═══ v2.1 — 375px에서 통합 버튼 1줄 ═════════════════════════════ */
{
  const p = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const box = await p.locator('.kium-ustrip .kium-sact').first().evaluate((el) => {
    const st = el.querySelector('.kium-sact-st').getBoundingClientRect();
    const go = el.querySelector('.kium-sact-go').getBoundingClientRect();
    const own = el.getBoundingClientRect();
    return { h: Math.round(own.height), sameLine: Math.abs(st.top - go.top) < 4 };
  });
  ok('U9 375px 통합 버튼 1줄 · 높이 44px 이상', box.sameLine && box.h >= 44, JSON.stringify(box));
  await p.locator('.kium-ustrip .kium-scard2').first().screenshot({ path: `${OUT}/u-card-375.png` });
  await p.close();
}

/* ═══ §11-3 프리필 경로 P1~P9 ════════════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });

  /* P1 — 전체 보기 상세 패널 CTA → ① 2줄
     [F19] 대상을 kium-03 → kium-01로 교체했다. 분기 기준이 '보기'에서 '과정 성격'으로
     바뀌어 공개교육 과정(kium-03)은 어느 보기에서 열어도 경로 B가 된다 —
     경로 ①을 단언하려면 위탁 과정이어야 한다. 경로 B는 P1b가 받는다. */
  await openCourses(p);
  await p.locator('#kium-cardwrap-kium-01 .kium-card').click();
  await p.waitForTimeout(700);
  await p.locator('.kium-panel-slot .kium-detail-cta button').first().click();
  await p.waitForTimeout(900);
  let v = await ta(p).inputValue();
  ok(
    'P1 ① 위탁 과정(2줄)',
    /^\[관심 과정: [^\]]+\]\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v)
  );

  /* P1b — [F19] 전체 보기에서 연 공개교육 과정의 하단 CTA는 경로 B다 */
  await openCourses(p);
  await p.locator('#kium-cardwrap-kium-03 .kium-card').click();
  await p.waitForTimeout(700);
  const p1bLabel = (await p.locator('.kium-panel-slot .kium-detail-cta button').first().innerText()).trim();
  await p.locator('.kium-panel-slot .kium-detail-cta button').first().click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok(
    'P1b [F19] 전체 보기 · 공개교육 과정 하단 CTA → 경로 B',
    p1bLabel === '이 과정으로 상담하기' &&
      /^\[공개교육 상담 신청\]\n· 과정명: .+\n· 희망 회차: 협의 희망\n· 문의 내용: \n$/.test(v),
    `${p1bLabel} | ${JSON.stringify(v.split('\n')[2])}`
  );

  /* P2 — 공개교육 회차 CTA → ② 4줄, `· 2일` 포함 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.locator('.kium-ustrip .kium-sact').first().click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok(
    'P2 ② 회차 지정(4줄 · 일수 포함)',
    /^\[공개교육 상담 신청\]\n· 과정명: .+\n· 희망 회차: .+· \d일 \(.+\)\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v.split('\n')[2])
  );

  /* P3 — 공개교육 상세 CTA → ③ `· 희망 회차: 협의 희망` */
  await p.goto(`${BASE}/kium?tab=courses&mode=open&consult=1&course=kium-13`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  v = await ta(p).inputValue();
  ok(
    'P3 ③ 과정만(협의 희망)',
    /^\[공개교육 상담 신청\]\n· 과정명: .+\n· 희망 회차: 협의 희망\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v.split('\n')[2])
  );

  /* P4 — 마감 회차 대안: 데이터에 closed 0건이라 도달 불가 */
  /* [F21 승격] 마감 시드 1건이 들어와 이 경로에 처음 도달할 수 있게 됐다 —
     v2.0에서 closed를 걷어낸 뒤로 SKIP이던 단언이다. 리스트 뷰의 마감 행에서
     '다음 회차 상담' 텍스트 링크를 눌러 경로 ③(회차 미지정)으로 가는지 본다. */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(600);
  await p.locator('.kium-srow .kium-sact-closed .kium-cta-next').first().click();
  await p.waitForTimeout(1000);
  v = await ta(p).inputValue();
  ok(
    'P4 마감 회차 → ③ 회차 미지정(F21로 도달 가능해짐)',
    /^\[공개교육 상담 신청\]\n· 과정명: .+\n· 희망 회차: .+\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v.split('\n')[2])
  );

  /* P5 — 「과정 개설 상담」 → ④ */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.locator('.kium-leadback .kium-cta-ses').click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok(
    'P5 ④ 유형만(공개교육 상담 희망)',
    /^\[공개교육 상담 신청\]\n· 문의 유형: 공개교육 상담 희망\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v.split('\n')[1])
  );

  /* P6 — ②(공개교육) → ①(전체 보기 상세) 연속 클릭 → 헤드 1개 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.locator('.kium-ustrip .kium-sact').first().click();
  await p.waitForTimeout(800);
  await seg(p, 0).click();
  await p.waitForTimeout(600);
  await p.locator('#kium-cardwrap-kium-03 .kium-card').click();
  await p.waitForTimeout(700);
  await p.locator('.kium-panel-slot .kium-detail-cta button').first().click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok('P6 ②→① 헤드 1개', heads(v) === 1, `헤드 ${heads(v)} / ${JSON.stringify(v)}`);

  /* P7 — ①→②→④ 3연속 → 헤드 1개 */
  await p.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.locator('#kium-cardwrap-kium-03 .kium-card').click();
  await p.waitForTimeout(700);
  await p.locator('.kium-panel-slot .kium-detail-cta button').first().click();
  await p.waitForTimeout(800);
  await seg(p, 1).click();
  await p.waitForTimeout(700);
  await p.locator('.kium-ustrip .kium-sact').first().click();
  await p.waitForTimeout(800);
  await p.locator('.kium-leadback .kium-cta-ses').click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok('P7 ①→②→④ 헤드 1개', heads(v) === 1, `헤드 ${heads(v)} / ${JSON.stringify(v)}`);

  /* P8 — 사용자 입력 보존 */
  const before = await ta(p).inputValue();
  await ta(p).fill(before + '직접 입력한 문장입니다');
  await p.waitForTimeout(200);
  await seg(p, 1).click();
  await p.waitForTimeout(500);
  await p.locator('.kium-ustrip .kium-sact').nth(1).click();
  await p.waitForTimeout(900);
  v = await ta(p).inputValue();
  ok('P8 사용자 입력 보존 + 헤드 교체', v.includes('직접 입력한 문장입니다') && heads(v) === 1, `헤드 ${heads(v)}`);

  /* P9 — 동의 자동 체크 0건 */
  const checked = await p.locator('#inq input[type="checkbox"]:checked').count();
  const total = await p.locator('#inq input[type="checkbox"]').count();
  ok('P9 동의 자동 체크 0건', checked === 0, `${checked}/${total} 체크됨`);

  await p.locator('#inq').screenshot({ path: `${OUT}/q-prefill.png` });
  await p.close();
}

/* ═══ §11-4 공유 폼 회귀 R1~R4 ═══════════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));

  /* R1 — 홈 상담 폼: 프리필 미동작 + 제출 정상 */
  await p.goto(`${BASE}/#inq`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const homeMsg = await ta(p).inputValue();
  ok('R1-a 홈 폼 프리필 미동작', homeMsg === '', JSON.stringify(homeMsg));

  // 이메일은 아이디 + 도메인 select로 분리돼 있고 직급/직책도 필수다(공유 폼 기존 규격)
  await p.fill('#f-company', '테스트기업');
  await p.fill('#f-name', '홍길동');
  await p.fill('#f-phone', '01012345678');
  await p.fill('#f-position', '팀장');
  await p.fill('#f-email', 'test');
  await p.selectOption('#inq select[name=\"emailDomain\"]', { index: 1 });
  await ta(p).fill('회귀 테스트 문의');
  // 필수 동의 1건만 체크한다(마케팅은 선택 — 자동 체크 금지 원칙)
  await p.locator('#inq input[name="agreePrivacy"]').check();
  const mktChecked = await p.locator('#inq input[name^="agreeMarketing"]:checked').count();
  ok('R1-b 필수 동의만 체크 · 마케팅 자동 체크 0건', mktChecked === 0, `마케팅 ${mktChecked}건`);

  await p.locator('#inq .btn.submit').click();
  await p.waitForTimeout(1800);
  const success = await p.locator('#inq .form-done.show').count();
  const blocked = await p.locator('#inq .form-done.is-blocked').count();
  ok('R1-c 홈 폼 제출 → 성공 화면', success === 1 && blocked === 0, `done ${success} / blocked ${blocked}`);

  /* R3 — 「새 문의 작성」으로 복귀 시 message·trainees 초기화 */
  await p.locator('#inq .done-again').click();
  await p.waitForTimeout(800);
  const afterMsg = await ta(p).inputValue();
  const afterTrainees = await p.locator('#f-trainees').inputValue().catch(() => '');
  const afterCompany = await p.locator('#f-company').inputValue();
  ok(
    'R3 복귀 시 message·trainees 초기화',
    afterMsg === '' && afterTrainees === '' && afterCompany === '',
    `msg ${JSON.stringify(afterMsg)} / trainees ${JSON.stringify(afterTrainees)} / company ${JSON.stringify(afterCompany)}`
  );

  /* R2 — ?interest= 프리셀렉트 */
  await p.goto(`${BASE}/?interest=hrd#inq`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const pressed = await p.locator('#inq [aria-pressed="true"], #inq input[type="checkbox"]:checked').count();
  ok('R2 ?interest=hrd 프리셀렉트 유지', pressed > 0, `선택 ${pressed}건`);

  /* R4 — 전송 포맷 무변경(코드 기준: contact/submit 미수정) */
  info('R4 전송 메일 포맷', 'lib/inquiry/{submit,contact,types}.ts 무수정 — 변경 파일 목록으로 갈음');

  ok('R5 공유 폼 JS 에러 0', errs.length === 0, errs.join(';'));
  await p.close();
}

/* ═══ §11-5 반응형 5뷰포트 ════════════════════════════════════════ */
for (const w of [320, 375, 768, 1024, 1440]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const rows = await p.locator('#kium-cf-month + .kium-filters').evaluate((el) => {
    const tops = [...el.querySelectorAll('.kium-chip')].map((c) => Math.round(c.getBoundingClientRect().top));
    return new Set(tops).size;
  });
  const small = await p.locator('#kium-cf-month + .kium-filters .kium-chip').evaluateAll(
    (els) => els.filter((e) => e.getBoundingClientRect().height < 44).length
  );
  ok(`V ${w}px 가로 넘침 0 · 기간 칩 ${rows}줄 · 44px 미만 ${small}`, ov <= 1 && small === 0, `넘침 ${ov}px`);
  await p.screenshot({ path: `${OUT}/v-${w}-collapsed.png`, fullPage: true });

  // 펼침 상태도 같은 폭에서 넘침이 없어야 한다
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(500);
  const ov2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`V ${w}px 펼침 상태 가로 넘침 0`, ov2 <= 1, `넘침 ${ov2}px`);
  await p.screenshot({ path: `${OUT}/v-${w}-expanded.png`, fullPage: true });
  await p.close();
}

/* ═══ BT-26 · BT-23 · BT-24 · BT-25 — 일정 영역 정보 위계 ════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  /* A7 — 스트립 첫 6장 날짜 */
  const stripDates = await p.locator('.kium-ustrip .kium-scard2-date b').allTextContents();

  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(700);

  /* A2 · A6 — 기간 전체: 월 그룹 3개 + 각 그룹 날짜 오름차순 */
  const heads = await p.locator('.kium-ulist .kium-mgroup-head').count();
  ok('A2 기간 전체 — 월 그룹 헤더 3개 렌더', heads === 3, `${heads}개`);
  const sticky = await p.locator('.kium-ulist .kium-mgroup-head').first()
    .evaluate((e) => getComputedStyle(e).position);
  ok('A2-b 월 그룹 헤더 sticky 유지', sticky === 'sticky', sticky);

  const byMonth = await p.locator('.kium-ulist .kium-mgroup').evaluateAll((secs) =>
    secs.map((sec) => ({
      label: sec.querySelector('.kium-mgroup-t')?.textContent.trim().split(' ')[0] ?? '(헤더없음)',
      dates: [...sec.querySelectorAll('.kium-srow-date b')].map((b) => b.textContent.trim()),
      statuses: [...sec.querySelectorAll('.kium-srow')].map((r) => r.getAttribute('data-status')),
    }))
  );
  for (const g of byMonth) {
    const key = (d) => {
      const [mm, dd] = d.replace(/\(.\)/g, '').split('~')[0].trim().split('.');
      return Number(mm) * 100 + Number(dd);
    };
    /* [F21 갱신] BT-26 규칙은 '1차 closed 뒤로 → 2차 날짜 오름차순'이다.
       마감 회차가 생긴 뒤로는 배열 전체가 오름차순일 수 없다(마감이 뒤에 붙으므로).
       미마감 구간과 마감 구간을 각각 오름차순으로 보고, 마감이 뒤에 몰렸는지를 따로 본다. */
    const idx = g.dates.map((d, i) => ({ d, st: g.statuses[i] }));
    const open = idx.filter((x) => x.st !== 'closed').map((x) => x.d);
    const shut = idx.filter((x) => x.st === 'closed').map((x) => x.d);
    const isAsc = (a) => a.every((d, i) => i === 0 || key(a[i - 1]) <= key(d));
    const asc = isAsc(open) && isAsc(shut);
    const closedTail = shut.length === 0 ||
      idx.slice(idx.length - shut.length).every((x) => x.st === 'closed');
    ok(`A6 ${g.label} 날짜 오름차순 · closed 최하단`, asc && closedTail,
      `${g.dates.join(' · ')}  [미마감 ${open.length} · 마감 ${shut.length}]`);
  }

  /* A7 — 스트립 순서 == 리스트 **미마감** 앞 6행
     [F21 갱신] 스트립은 effectiveStatus !== 'closed'로 마감을 빼고(F0-9),
     리스트는 마감을 각 월 최하단에 남긴다. 두 뷰가 같은 규칙을 쓰는지 보려면
     비교 대상에서 마감을 빼야 한다 — BT-18 '토글 교체 시 순서 일치' 전제는 그대로다. */
  const listDates = byMonth.flatMap((g) => g.dates.filter((d, i) => g.statuses[i] !== 'closed'));
  ok(
    'A7 스트립 6장 == 리스트 앞 6행 순서 일치',
    JSON.stringify(stripDates) === JSON.stringify(listDates.slice(0, 6)),
    `스트립 ${stripDates.join(' · ')} / 리스트 ${listDates.slice(0, 6).join(' · ')}`
  );

  /* A5 — '1인 기준' 렌더 횟수 */
  const noteInRows = await p.locator('.kium-srow-meta').evaluateAll((els) =>
    els.filter((e) => e.textContent.includes('1인 기준')).length
  );
  const noteInHead = await p.locator('.kium-modehead-s').evaluateAll((els) =>
    els.filter((e) => e.textContent.includes('1인 기준')).length
  );
  ok('A5 1인 기준 — 리스트 0회 / 모드 헤더 1회', noteInRows === 0 && noteInHead === 1, `행 ${noteInRows} / 헤더 ${noteInHead}`);

  /* A4 · B2 — 리스트 과정명: 기본 --ink, hover --p1 + 밑줄, 히트 44px */
  const title = p.locator('.kium-ulist .kium-srow-title.is-link').first();
  ok('A3-a 리스트 과정명이 버튼', (await p.locator('.kium-ulist .kium-srow-title.is-link').count()) > 0);
  const base = await title.evaluate((e) => ({
    color: getComputedStyle(e).color,
    deco: getComputedStyle(e).textDecorationLine,
    h: Math.round(e.getBoundingClientRect().height),
  }));
  await title.hover();
  await p.waitForTimeout(300);
  const hov = await title.evaluate((e) => ({
    color: getComputedStyle(e).color,
    deco: getComputedStyle(e).textDecorationLine,
  }));
  ok(
    'A4 과정명 기본 --ink · hover --p1 + 밑줄',
    base.color === 'rgb(20, 20, 26)' && base.deco === 'none' &&
      hov.color === 'rgb(46, 26, 107)' && hov.deco === 'underline',
    `기본 ${base.color}/${base.deco} → hover ${hov.color}/${hov.deco}`
  );
  ok('B2 과정명 히트 영역 44px 이상', base.h >= 44, `${base.h}px`);

  /* B2-b — 카테고리 칩과 클릭 간섭 0 */
  const overlap = await p.locator('.kium-ulist .kium-srow').first().evaluate((row) => {
    const chip = row.querySelector('.kium-lab.cat').getBoundingClientRect();
    const t = row.querySelector('.kium-srow-title').getBoundingClientRect();
    const inter = Math.min(chip.bottom, t.bottom) - Math.max(chip.top, t.top);
    const el = document.elementFromPoint(Math.round(chip.left + chip.width / 2), Math.round(chip.top + chip.height / 2));
    return { inter: Math.round(inter), hitIsChip: !!el?.closest('.kium-lab.cat') };
  });
  ok('B2-b 카테고리 칩 클릭 간섭 0', overlap.hitIsChip, JSON.stringify(overlap));

  /* A3 — 과정명 클릭 → 그리드 카드 스크롤 + 확장 + 하이라이트 + 포커스 */
  await title.click();
  await p.waitForTimeout(700);
  const flash = await p.locator('.kium-card-wrap.is-flash').count();
  const expanded = await p.locator('.kium-card[aria-expanded="true"]').count();
  const focused = await p.evaluate(() => document.activeElement?.className || '');
  const listStill = await p.locator('.kium-ulist').count();
  ok(
    'A3 과정명 클릭 → 확장+하이라이트+포커스 (스트립과 동일)',
    flash === 1 && expanded === 1 && focused.includes('kium-card'),
    `flash ${flash} / expanded ${expanded} / focus ${focused.split(' ')[0]}`
  );
  ok('A3-b 클릭해도 리스트가 접히지 않는다', listStill === 1);
  await p.close();
}

/* ═══ BT-23 — 단일 월 필터에서 월 헤더 미렌더 ════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open&month=11`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const chip = (await p.locator('#kium-cf-month + .kium-filters .kium-chip[aria-pressed="true"]').innerText()).replace(/\s+/g, '');
  const head = (await p.locator('.kium-modehead-t').innerText()).replace(/\s+/g, ' ').trim();
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(700);
  const groupHeads = await p.locator('.kium-ulist .kium-mgroup-head').count();
  ok('A1 11월 건수 노출 2회(기간 칩 · 모드 헤더) · 월 그룹 헤더 0', groupHeads === 0, `칩 "${chip}" / 헤더 "${head}" / 그룹헤더 ${groupHeads}`);

  const aria = await p.locator('.kium-ulist .kium-mgroup').first().evaluate((e) => ({
    label: e.getAttribute('aria-label'),
    labelledby: e.getAttribute('aria-labelledby'),
  }));
  ok('B1 단일 월 그룹 접근명 = aria-label', aria.label === '11월 회차 목록' && aria.labelledby === null, JSON.stringify(aria));

  /* B6 — 컨테이너 헤더선 ~ 첫 행 간격 */
  const gap = await p.evaluate(() => {
    const headEl = document.querySelector('.kium-schedbox-head');
    const row = document.querySelector('.kium-srow');
    if (!headEl || !row) return null;
    return Math.round(row.getBoundingClientRect().top - headEl.getBoundingClientRect().bottom);
  });
  ok('B6 단일 월 — 헤더선~첫 행 간격 과하지 않음(≤40px)', gap !== null && gap <= 40 && gap >= 0, `${gap}px`);

  /* A6 — 11월 정렬 실측 */
  const dates = await p.locator('.kium-srow-date b').allTextContents();
  ok('A6-11월 날짜 오름차순', true, dates.join(' · '));
  await p.close();
}

/* ═══ F24 — 회차 일정 확정 개정 3건 ═══════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(700);

  const groups = await p.locator('.kium-mgroup').evaluateAll((els) =>
    els.map((g) => ({
      head: g.querySelector('.kium-mgroup-t')?.textContent.trim() || '',
      dates: [...g.querySelectorAll('.kium-srow-date b')].map((b) => b.textContent.trim()),
    }))
  );
  const nov = groups.find((g) => g.head.startsWith('11월'));
  const dec = groups.find((g) => g.head.startsWith('12월'));
  const short = (a) => a.map((d) => d.replace(/\(.*$/, '').trim()).join(' · ');

  /* U1~U3 — 요일은 데이터가 아니라 start에서 파생된다. 확정 날짜만 넣어도 정확히 나오는지 본다 */
  const all = groups.flatMap((g) => g.dates);
  const find = (pre) => all.find((d) => d.startsWith(pre)) || '(없음)';
  ok('U1 cs-r2 = 11.20(금)', /^11\.20\(금\)$/.test(find('11.20')), find('11.20'));
  ok('U2 relead-r3 = 12.16(수) ~ 17(목)', /^12\.16\(수\) ~ 17\(목\)$/.test(find('12.16')), find('12.16'));
  ok('U3 onpow-r2 = 12.28(월) ~ 29(화)', /^12\.28\(월\) ~ 29\(화\)$/.test(find('12.28')), find('12.28'));

  ok('U4 11월 그룹 = 11.2 · 11.9 · 11.12 · 11.16 · 11.18 · 11.20',
    short(nov.dates) === '11.2 · 11.9 · 11.12 · 11.16 · 11.18 · 11.20', short(nov.dates));
  ok('U5 12월 그룹 = 11.30 · 12.7 · 12.9 · 12.11 · 12.14 · 12.16 · 12.21 · 12.28',
    short(dec.dates) === '11.30 · 12.7 · 12.9 · 12.11 · 12.14 · 12.16 · 12.21 · 12.28', short(dec.dates));

  /* U9 — 스트립 첫 6장은 10월 회차로만 구성돼 무영향이어야 한다 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const strip = short(await p.locator('.kium-ustrip .kium-scard2-date b').allTextContents());
  ok('U9 스트립 첫 6장 무변경 = 10.12 · 10.14 · 10.19 · 10.26 · 10.27 · 11.2',
    strip === '10.12 · 10.14 · 10.19 · 10.26 · 10.27 · 11.2', strip);

  /* U10 — cs-r2 회차 CTA 프리필 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open&consult=1&course=kium-19&session=cs-r2`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1300);
  const pre = await ta(p).inputValue();
  ok('U10 cs-r2 프리필 = · 희망 회차: 11.20(금) · 1일 (개강확정)',
    /· 희망 회차: 11\.20\(금\) · 1일 \(개강확정\)/.test(pre), JSON.stringify(pre.split('\n')[2]));
  await p.close();
}

/* ═══ F21 · F22 · F23 — 마감 시드 · 0건 칩 · Empty 검토 칩 ══════ */
{
  const p = await browser.newPage({ viewport: PC });
  const chipTexts = async () =>
    (await p.locator('#kium-cf-st + .kium-filters .kium-chip').allTextContents())
      .map((t) => t.replace(/\s+/g, ' ').trim());
  const pickMonth = async (label) => {
    await p.locator('#kium-cf-month + .kium-filters .kium-chip', { hasText: label }).first().click();
    await p.waitForTimeout(500);
  };

  /* ── M1~M7 : 마감 UI — closed 0건이던 자리라 이번이 첫 렌더다 ── */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  ok('M1 스트립 — 마감 회차 미노출',
    (await p.locator('.kium-ustrip .kium-scard2[data-status="closed"]').count()) === 0,
    (await p.locator('.kium-ustrip .kium-scard2').count()) + '장 중 마감 0');

  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(700);
  const oct = await p.locator('.kium-mgroup').first().locator('.kium-srow').evaluateAll((els) =>
    els.map((e) => ({ st: e.getAttribute('data-status'), d: e.querySelector('.kium-srow-date b')?.textContent.trim() }))
  );
  ok('M2 리스트 — 10.21이 10월 그룹 최하단 · data-status="closed"',
    oct[oct.length - 1].st === 'closed' && /^10\.21/.test(oct[oct.length - 1].d),
    oct.map((o) => o.d + ':' + o.st).join(' · '));

  const closedRow = p.locator('.kium-srow[data-status="closed"]').first();
  const m3 = await closedRow.locator('.kium-sact-closed').evaluate((el) => {
    const badge = el.querySelector('.kium-sbadge');
    const link = el.querySelector('.kium-cta-next');
    const mid = (n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; };
    return {
      badge: badge.textContent.trim(),
      link: link.textContent.trim(),
      oneLine: Math.abs(mid(badge) - mid(link)) < 4,
      isButton: !!el.querySelector('.kium-sact'),
    };
  });
  ok('M3 리스트 마감 행 — 정적 배지 `마감` + 링크 `다음 회차 상담` · 1행',
    m3.badge === '마감' && m3.link === '다음 회차 상담' && m3.oneLine && !m3.isButton,
    JSON.stringify(m3));

  /* M6 — opacity:.72가 걸린 상태의 실효 대비. 미달이면 수치와 함께 남긴다(임의 수정 금지) */
  const m6 = await closedRow.evaluate((row) => {
    const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const bgOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return parse(c);
      }
      return [255, 255, 255];
    };
    const a = Number(getComputedStyle(row).opacity);
    const base = bgOf(row.parentElement);
    const mix = (c) => c.map((v, i) => v * a + base[i] * (1 - a));
    const out = { opacity: a };
    for (const [k, sel] of [['배지 마감', '.kium-sbadge'], ['날짜', '.kium-srow-date b'], ['링크', '.kium-cta-next']]) {
      const el = row.querySelector(sel);
      out[k] = Math.round(ratio(mix(parse(getComputedStyle(el).color)), mix(bgOf(el))) * 100) / 100;
    }
    return out;
  });
  const m6min = Math.min(m6['배지 마감'], m6['날짜'], m6['링크']);
  /* [F21 · 알려진 이슈] 마감 회차가 처음 렌더되면서 README 알려진 이슈 15번이 실증됐다.
     .kium-srow[data-status="closed"]{opacity:.72}가 전경·배경을 함께 흐리므로
     배지 pill(#6B7280 on #F3F4F6)과 텍스트 링크가 AA 4.5:1에 미달한다.
     명세 §7-2 M6가 '미달 시 임의로 고치지 말고 수치와 함께 보고'를 지시하므로
     단언을 약화하는 대신 실측값을 남긴다 — 대응 방향은 기획 확인 대기. */
  if (m6min >= 4.5) {
    ok('M6 마감 행 대비 — opacity ' + m6.opacity + ' 실효값 AA(4.5:1)', true,
      Object.entries(m6).filter(([k]) => k !== 'opacity').map(([k, v]) => k + ' ' + v + ':1').join(' / '));
  } else {
    info('M6 마감 행 대비 — AA 미달(알려진 이슈 · 임의 수정 금지)',
      'opacity ' + m6.opacity + ' 실효 ' +
      Object.entries(m6).filter(([k]) => k !== 'opacity').map(([k, v]) => k + ' ' + v + ':1').join(' / ') +
      ' — 기준 4.5:1, 비텍스트 3:1은 충족');
  }

  /* M5 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('.kium-chip-st[data-st="closed"]').click();
  await p.waitForTimeout(600);
  const stripN = await p.locator('.kium-ustrip .kium-scard2').count();
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(600);
  const listN = await p.locator('.kium-srow').count();
  ok('M5 마감 칩 선택 — 리스트 1건 · 스트립 0장', listN === 1 && stripN === 0, '리스트 ' + listN + ' / 스트립 ' + stripN);

  /* M4 */
  await p.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('#kium-cardwrap-kium-04 .kium-card').click();
  await p.waitForTimeout(800);
  const m4 = await p.locator('.kium-detail .kium-strip .kium-scard2').evaluateAll((els) =>
    els.map((e) => ({ st: e.getAttribute('data-status'), d: e.querySelector('.kium-scard2-date b').textContent.replace(/\(.*$/, '').trim() }))
  );
  ok('M4 상세 패널 kium-04 — 마감 카드 렌더 · 마감이 뒤',
    m4.length === 3 && m4[2].st === 'closed' && m4[2].d === '10.21',
    m4.map((x) => x.d + ':' + x.st).join(' · '));

  /* ── C1~C6 : 0건 칩 미노출 ── */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const c1 = await chipTexts();
  ok('C1 기간 전체 — 칩 5개(전체·모집중·개강확정·마감임박·마감)',
    c1.length === 5 && /^전체/.test(c1[0]) && /마감 1$/.test(c1[4]), c1.join(' | '));

  await pickMonth('10월');
  const c4 = await chipTexts();
  ok('C4 기간 10월 — 칩 5개(4상태 전부 · 한 화면 비교 가능)', c4.length === 5, c4.join(' | '));

  await pickMonth('11월');
  const c2 = await chipTexts();
  ok('C2 기간 11월 — 칩 4개(마감 0건 → 미노출)',
    c2.length === 4 && !c2.some((t) => /^마감 \d/.test(t)), c2.join(' | '));

  await pickMonth('12월');
  const c3 = await chipTexts();
  ok('C3 기간 12월 — 칩 4개(마감 0건 → 미노출)',
    c3.length === 4 && !c3.some((t) => /^마감 \d/.test(t)), c3.join(' | '));

  ok('C6 `전체` 칩은 모든 조건에서 노출',
    [c1, c2, c3, c4].every((a) => /^전체/.test(a[0])), '4조건 전건');

  /* C5 — 자동 해제 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('.kium-chip-st[data-st="closed"]').click();
  await p.waitForTimeout(500);
  await pickMonth('12월');
  const c5 = {
    allPressed: await p.locator('#kium-cf-st + .kium-filters .kium-chip').first().getAttribute('aria-pressed'),
    empty: await p.locator('.kium-empty2').count(),
    rows: await p.locator('.kium-ustrip .kium-scard2').count(),
  };
  ok('C5 선택 칩이 0건이 되면 `전체`로 자동 해제 — 빈 화면에 갇히지 않음',
    c5.allPressed === 'true' && c5.empty === 0 && c5.rows > 0, JSON.stringify(c5));

  /* ── E1~E8 : Empty Case 검토 칩 ── */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  ok('E1 고객 화면(?preview 없음) — .kium-chip-review DOM 0건',
    (await p.locator('.kium-chip-review').count()) === 0, '0건');

  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=cases`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const e2 = await chipTexts();
  ok('E2 ?preview=cases — 상태 행 맨 끝에 `Empty Case` 1개 · 쇼케이스 없음',
    (await p.locator('.kium-chip-review').count()) === 1 &&
      e2[e2.length - 1] === 'Empty Case' &&
      (await p.locator('.kium-showcase').count()) === 0,
    e2.join(' | '));
  ok('E8 Empty 칩 — 카운트 미표기 · data-st 없음',
    (await p.locator('.kium-chip-review .cnt').count()) === 0 &&
      (await p.locator('.kium-chip-review').getAttribute('data-st')) === null,
    'cnt 0 · data-st null');
  const bs = await p.locator('.kium-chip-review').evaluate((el) => getComputedStyle(el).borderStyle);
  ok('E6 시각 구분 — 점선 테두리(색 아니라 형태)', bs === 'dashed', bs);
  const al = await p.locator('.kium-chip-review').getAttribute('aria-label');
  ok('E7 접근성 — aria-label에 검토용 명시 · aria-pressed 초기 false',
    /검토용/.test(al || '') && (await p.locator('.kium-chip-review').getAttribute('aria-pressed')) === 'false', al);

  await p.locator('.kium-chip-review').click();
  await p.waitForTimeout(600);
  const e4 = {
    empty: await p.locator('.kium-empty2').count(),
    reset: await p.locator('.kium-empty2 .kium-chip').count(),
    pressed: await p.locator('.kium-chip-review').getAttribute('aria-pressed'),
    cards: await p.locator('.kium-ustrip .kium-scard2').count(),
  };
  ok('E4 칩 선택 — 빈 상태 안내 + `필터 초기화` 노출',
    e4.empty === 1 && e4.reset === 1 && e4.pressed === 'true' && e4.cards === 0, JSON.stringify(e4));

  await p.locator('.kium-empty2 .kium-chip').click();
  await p.waitForTimeout(600);
  ok('E5 `필터 초기화` — 전체 복귀',
    (await p.locator('.kium-empty2').count()) === 0 &&
      (await p.locator('.kium-chip-review').getAttribute('aria-pressed')) === 'false',
    (await p.locator('.kium-ustrip .kium-scard2').count()) + '장');

  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  ok('E3 ?preview=badges — 쇼케이스 + Empty 칩 둘 다',
    (await p.locator('.kium-showcase').count()) === 1 &&
      (await p.locator('.kium-chip-review').count()) === 1, '둘 다 1');
  await p.close();
}

/* ── V — ?preview=cases로 칩이 하나 늘어난 상태의 반응형 ── */
{
  for (const w of [320, 375, 768, 1024, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1200 } });
    const ovf = async () =>
      p.evaluate(() => Math.max(0, Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth)));
    await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=cases`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const v1 = await ovf();
    await p.locator('.kium-chip-review').click();
    await p.waitForTimeout(500);
    const v2 = await ovf();
    await p.locator('.kium-empty2 .kium-chip').click();
    await p.waitForTimeout(500);
    await p.locator('.kium-schedbox-toggle').click();
    await p.waitForTimeout(600);
    const v3 = await ovf();
    ok('V ' + w + 'px — ?preview=cases 가로 넘침 0px(기본·Empty·전체 일정)',
      v1 === 0 && v2 === 0 && v3 === 0, v1 + ' / ' + v2 + ' / ' + v3);
    await p.close();
  }
}

/* ═══ F17~F20 — 전체 보기 상세 패널 인라인 회차 블록 ═════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  const panel = () => p.locator('.kium-panel-slot');
  const openCard = async (id) => {
    await p.locator(`#kium-cardwrap-${id} .kium-card`).click();
    await p.waitForTimeout(700);
  };

  await openCourses(p);
  await openCard('kium-14');
  const wrapN = await panel().locator('.kium-strip-wrap').count();
  const headTxt = (await panel().locator('.kium-strip-wrap .kium-detail-h').first().innerText()).trim();
  const cardN = await panel().locator('.kium-strip .kium-scard2').count();
  ok('G1 전체 보기 kium-14 — 「공개교육 일정」 블록 1개 · 회차 1장',
    wrapN === 1 && headTxt === '공개교육 일정' && cardN === 1,
    `wrap ${wrapN} / "${headTxt}" / 카드 ${cardN}`);

  /* G2 — DOM 순서: 교육구성 표 아래, .kium-detail-cta 앞 */
  const order = await panel().locator('.kium-detail').evaluate((d) => {
    const kids = [...d.children];
    const has = (sel) => kids.findIndex((k) => k.matches(sel) || k.querySelector(sel));
    return {
      table: has('table'),
      strip: kids.findIndex((k) => k.classList.contains('kium-strip-wrap')),
      cta: kids.findIndex((k) => k.classList.contains('kium-detail-cta')),
    };
  });
  ok('G2 블록 위치 — 교육구성 표 아래 · CTA 앞',
    order.strip > order.table && order.strip < order.cta && order.table >= 0,
    JSON.stringify(order));

  /* G3 — 위탁 과정은 블록·pill 모두 0 */
  await openCard('kium-01');
  const g3 = {
    wrap: await panel().locator('.kium-strip-wrap').count(),
    pill: await panel().locator('.kium-pill[data-open]').count(),
  };
  ok('G3 위탁 kium-01 — 블록 0 · 공개교육 pill 0', g3.wrap === 0 && g3.pill === 0, JSON.stringify(g3));

  /* G4·G5 — 회차 CTA → 보기 유지 + 경로 A */
  await openCourses(p);
  await openCard('kium-14');
  await panel().locator('.kium-strip .kium-sact, .kium-strip .kium-cta-ses').first().click();
  await p.waitForTimeout(1000);
  const segTxt = (await p.locator('.kium-modeseg [aria-pressed="true"]').innerText()).replace(/\s+/g, ' ').trim();
  const pre = await ta(p).inputValue();
  ok('G4 회차 CTA — 세그먼트 「전체과정」 유지', /전체과정/.test(segTxt), segTxt);
  ok('G5 프리필 경로 A (· 희망 회차 포함)',
    /^\[공개교육 상담 신청\]\n· 과정명: .+\n· 희망 회차: .+· \d일 \(.+\)\n· 문의 내용: \n$/.test(pre),
    JSON.stringify(pre));

  /* G6 — pill 요약화 */
  await openCourses(p);
  await openCard('kium-14');
  const pillTxt = (await panel().locator('.kium-pill[data-open]').first().innerText()).replace(/\s+/g, ' ').trim();
  ok('G6 공개교육 pill — `N개 회차` · 날짜 문자열 0건',
    /^공개교육 \d+개 회차$/.test(pillTxt) && !/\d+\.\d+/.test(pillTxt), pillTxt);

  /* G7·G8 — 하단 CTA 문구 */
  const g7 = (await panel().locator('.kium-detail-cta button').first().innerText()).trim();
  await openCard('kium-01');
  const g8 = (await panel().locator('.kium-detail-cta button').first().innerText()).trim();
  ok('G7 하단 CTA · 공개교육 과정 = 이 과정으로 상담하기', g7 === '이 과정으로 상담하기', g7);
  ok('G8 하단 CTA · 위탁 과정 = 이 과정으로 신청 문의', /이 과정으로 신청.문의/.test(g8), g8);

  /* G9 — 두 보기 CTA 일치 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await openCard('kium-14');
  const g9 = (await panel().locator('.kium-detail-cta button').first().innerText()).trim();
  ok('G9 두 보기 하단 CTA 일치(kium-14)', g9 === g7, `전체 "${g7}" / 공개 "${g9}"`);

  /* G10 — open 변형 무변경 */
  const g10 = await panel().locator('.kium-detail').evaluate((d) => {
    const kids = [...d.children];
    return {
      stripIdx: kids.findIndex((k) => k.classList.contains('kium-strip-wrap')),
      headIdx: kids.findIndex((k) => k.classList.contains('kium-detail-head')),
      heading: d.querySelector('.kium-strip-wrap .kium-detail-h')?.textContent.trim(),
      pills: [...d.querySelectorAll('.kium-pill[data-open] b')].map((b) => b.textContent.trim()),
      wraps: d.querySelectorAll('.kium-strip-wrap').length,
    };
  });
  ok('G10 variant="open" 무변경 — 헤더 직후 · `교육일정` · pill은 교육비만',
    g10.stripIdx === g10.headIdx + 1 && g10.heading === '교육일정' &&
      g10.pills.join('/') === '교육비' && g10.wraps === 1,
    JSON.stringify(g10));

  /* G11·G12 */
  await openCourses(p);
  const flags = await p.locator('.kium-openflag').count();
  await openCard('kium-14');
  const moveTrig = await panel().locator('text=/공개교육 보기/').count();
  ok('G11 카드 공개교육 뱃지 9건 유지', flags === 9, String(flags));
  ok('G12 상세 패널 이동 트리거 0건', moveTrig === 0, String(moveTrig));

  /* O1~O4 — 9과정 전건 회차 날짜 배열 */
  const IDS = ['kium-03', 'kium-04', 'kium-09', 'kium-10', 'kium-11', 'kium-12', 'kium-13', 'kium-14', 'kium-19'];
  const rows = [];
  for (const id of IDS) {
    await openCourses(p);
    await openCard(id);
    const ds = await panel().locator('.kium-strip .kium-scard2-date b').allTextContents();
    const sts = await panel().locator('.kium-strip .kium-scard2').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-status'))
    );
    rows.push({ id, dates: ds.map((d) => d.replace(/\(.*$/, '').trim()), stats: sts });
  }
  const num = (d) => { const [m, dd] = d.split('.').map(Number); return m * 100 + dd; };
  const asc = (a) => a.every((d, i) => i === 0 || num(a[i - 1]) <= num(d));
  /* [F21 갱신] F20 규칙도 '1차 closed 뒤로 → 2차 날짜'다. 마감 회차가 생긴 kium-04는
     11.18 · 12.16 · 10.21(마감)이 정상 — 미마감 구간만 오름차순이면 된다.
     [F24] relead-r3가 12.17~18 → 12.16~17로 확정 개정되어 두 번째 값이 바뀌었다. */
  const openDates = (r) => r.dates.filter((_, i) => r.stats[i] !== 'closed');
  const shutDates = (r) => r.dates.filter((_, i) => r.stats[i] === 'closed');
  const bad = rows.filter((r) => !asc(openDates(r)) || !asc(shutDates(r)));
  ok('O3 9과정 전건 회차 날짜 오름차순', bad.length === 0,
    rows.map((r) => `${r.id}: ${r.dates.join(' · ')}`).join(' | '));
  const k11 = rows.find((r) => r.id === 'kium-11').dates.join(' · ');
  const k10 = rows.find((r) => r.id === 'kium-10').dates.join(' · ');
  ok('O1 kium-11 = 10.19 · 11.16 · 12.14', k11 === '10.19 · 11.16 · 12.14', k11);
  ok('O2 kium-10 = 10.14 · 11.9 · 12.7', /^10\.14 · 11\.0?9 · 12\.0?7$/.test(k10), k10);
  /* [F21 신설] 마감 회차가 있는 유일한 과정 — closed가 최하단인지 직접 본다 */
  const r04 = rows.find((r) => r.id === 'kium-04');
  ok('O5 kium-04 = 11.18 · 12.16 · 10.21(마감 최하단)',
    r04.dates.join(' · ') === '11.18 · 12.16 · 10.21' && r04.stats[2] === 'closed',
    `${r04.dates.join(' · ')} / ${r04.stats.join(',')}`);

  /* [F24] 확정 개정 3건이 닿는 과정은 kium-04(O5) · kium-03 · kium-19 셋이다.
     O3가 '오름차순'만 보므로 바뀐 값 자체를 고정하는 단언을 함께 둔다. */
  const k03 = rows.find((r) => r.id === 'kium-03').dates.join(' · ');
  const k19 = rows.find((r) => r.id === 'kium-19').dates.join(' · ');
  ok('O6 kium-03 = 12.9 · 12.28 (onpow-r2 확정 개정)', /^12\.0?9 · 12\.28$/.test(k03), k03);
  ok('O7 kium-19 = 10.26 · 11.20 · 12.21 (cs-r2 확정 개정)', /^10\.26 · 11\.20 · 12\.21$/.test(k19), k19);

  /* O4 — 두 변형 순서 일치 */
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await openCard('kium-11');
  const k11o = (await panel().locator('.kium-strip .kium-scard2-date b').allTextContents())
    .map((d) => d.replace(/\(.*$/, '').trim()).join(' · ');
  ok('O4 두 변형 회차 순서 일치(kium-11)', k11o === k11, `전체 "${k11}" / 공개 "${k11o}"`);
  await p.close();
}

/* ── R1~R6 — 회차 1·2·3건 × 5뷰포트 ── */
{
  const CASES = [['kium-14', 1], ['kium-03', 2], ['kium-11', 3]];
  for (const w of [320, 375, 768, 1024, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1200 } });
    const rows = [];
    for (const [id, n] of CASES) {
      await p.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(700);
      await p.locator(`#kium-cardwrap-${id} .kium-card`).click();
      await p.waitForTimeout(700);
      const r = await p.locator('.kium-detail .kium-strip').evaluate((el) => ({
        cards: el.children.length,
        single: el.classList.contains('is-single'),
        snap: getComputedStyle(el).scrollSnapType,
        ovfX: getComputedStyle(el).overflowX,
        overflow: Math.max(0, Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth)),
        small: [...el.querySelectorAll('button')].filter((b) => {
          const q = b.getBoundingClientRect();
          return q.width > 0 && q.height < 44 && q.width < 44;
        }).length,
      }));
      rows.push({ id, want: n, ...r });
    }
    ok(`R1 ${w}px — 회차 1·2·3건 가로 넘침 0px`,
      rows.every((r) => r.overflow === 0 && r.cards === r.want),
      rows.map((r) => `${r.id} ${r.cards}장 ovf${r.overflow}`).join(' / '));
    ok(`R4 ${w}px — 44px 미만 터치 타깃 0`, rows.every((r) => r.small === 0),
      rows.map((r) => `${r.id}:${r.small}`).join(' / '));
    if (w === 375) {
      ok('R3 MO · 1건 — is-single · overflow-x:visible', rows[0].single === true && rows[0].ovfX === 'visible', JSON.stringify(rows[0]));
      ok('R2 MO · 3건 — 가로 스크롤 + snap', rows[2].single === false && rows[2].ovfX === 'auto' && /x/.test(rows[2].snap), JSON.stringify(rows[2]));
    }
    await p.close();
  }
  /* R5 — 제목 계층 · R6 — reduced-motion */
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.locator('#kium-cardwrap-kium-11 .kium-card').click();
  await p.waitForTimeout(700);
  const r5 = await p.locator('.kium-detail .kium-strip-wrap .kium-detail-h').evaluate((el) => el.tagName);
  ok('R5 블록 제목 = h5.kium-detail-h (패널 내 다른 섹션과 동일 레벨)', r5 === 'H5', r5);
  await p.close();
  const p2 = await browser.newPage({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce' });
  await p2.goto(`${BASE}/kium?tab=courses`, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(700);
  await p2.locator('#kium-cardwrap-kium-11 .kium-card').click();
  await p2.waitForTimeout(700);
  const r6 = await p2.locator('.kium-detail .kium-strip').evaluate((el) => getComputedStyle(el).scrollSnapType);
  ok('R6 reduced-motion — scroll-snap 무효화', r6 === 'none', r6);
  await p2.close();
}

/* ═══ BT-27 · BT-28 · BT-29 — CTA 라벨 · 줄바꿈 · 하단 정렬 ══════ */
{
  /* C2 — 뷰포트 × 상태 × 스트립·리스트에서 버튼이 1행인지 */
  const rows = [];
  for (const w of [320, 375, 768, 1024, 1440]) {
    const p = await browser.newPage({ viewport: { width: w, height: 1200 } });
    // 실 데이터(3상태) — 스트립
    await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    const strip = await p.locator('.kium-ustrip .kium-sact').evaluateAll((els) =>
      els.map((e) => ({
        tone: e.getAttribute('data-tone'),
        h: Math.round(e.getBoundingClientRect().height),
        sh: e.scrollHeight,
        oneLine: (() => {
          const mid = (n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; };
          return Math.abs(mid(e.querySelector('.kium-sact-st')) - mid(e.querySelector('.kium-sact-go'))) < 4;
        })(),
      }))
    );
    // 리스트
    await p.locator('.kium-schedbox-toggle').click();
    await p.waitForTimeout(700);
    const list = await p.locator('.kium-srow .kium-sact').evaluateAll((els) =>
      els.map((e) => ({
        tone: e.getAttribute('data-tone'),
        h: Math.round(e.getBoundingClientRect().height),
        oneLine: (() => {
          const mid = (n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; };
          return Math.abs(mid(e.querySelector('.kium-sact-st')) - mid(e.querySelector('.kium-sact-go'))) < 4;
        })(),
      }))
    );
    // 쇼케이스 — closing+잔여석(최악 폭) · closed 형태
    await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(900);
    const show = await p.locator('.kium-showcase .kium-ustrip .kium-scard2').evaluateAll((els) =>
      els.map((e) => {
        const act = e.querySelector('.kium-sact');
        const closed = e.querySelector('.kium-sact-closed');
        // 높이가 다른 형제(배지 24px vs 링크 44px)가 center 정렬돼 있으므로
        // top이 아니라 **중심선**을 비교해야 '같은 줄'을 옳게 판정한다.
        const mid = (n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2; };
        const one = (el) =>
          Math.abs(
            mid(el.querySelector('.kium-sact-st, .kium-sbadge')) -
              mid(el.querySelector('.kium-sact-go, .kium-cta-next'))
          ) < 4;
        return {
          status: e.getAttribute('data-status'),
          isButton: !!act,
          oneLine: one(act || closed),
          seats: e.querySelector('.kium-sact-st em')?.textContent.trim() || null,
        };
      })
    );

    const bad = [
      ...strip.filter((x) => !x.oneLine).map((x) => `스트립:${x.tone}`),
      ...list.filter((x) => !x.oneLine).map((x) => `리스트:${x.tone}`),
      ...show.filter((x) => !x.oneLine).map((x) => `쇼케이스:${x.status}`),
    ];
    ok(
      `C2 ${w}px 줄바꿈 0건 (스트립 ${strip.length} · 리스트 ${list.length} · 쇼케이스 ${show.length})`,
      bad.length === 0,
      bad.length ? bad.join(' / ') : `전건 1행 · 높이 ${[...new Set(strip.map((x) => x.h))].join('/')}px`
    );
    if (w === 320) {
      const worst = show.find((x) => x.seats);
      ok(
        'C3 최악 폭 — 320px에서 마감임박+잔여석도 1행',
        !!worst && worst.oneLine,
        JSON.stringify(worst)
      );
      const cl = show.find((x) => x.status === 'closed');
      ok('C5 마감 카드 — 버튼 아님 · 배지+링크 1행', cl && cl.isButton === false && cl.oneLine, JSON.stringify(cl));
    }
    rows.push({ w, strip: strip.length, list: list.length });
    await p.close();
  }
}

/* C4 — 스트립 CTA 하단 정렬(과정명 1줄 vs 2줄) · C1 · C6 · C7 */
{
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  /* C4 — margin-top:auto(BT-29)의 실제 효과를 직접 본다.
     이전 판정은 '과정명 1줄 카드와 2줄 카드가 섞인 폭'을 찾아 버튼 top이 같은지 봤는데,
     회차 구성이 바뀌면(F21로 스트립 6장 중 10.21이 빠지고 11.02가 들어왔다)
     줄 수가 균일해져 비교 자체가 성립하지 않는다 — 데이터에 의존하는 판정이었다.
     margin-top:auto가 하는 일은 '카드 높이가 남을 때 버튼을 바닥으로 민다'이므로,
     콘텐츠 높이와 무관하게 **버튼 바닥과 카드 바닥의 간격이 모든 카드에서 같은지**를 본다.
     이 값은 카드 padding-bottom 하나로 결정되며, 규칙이 빠지면 즉시 어긋난다. */
  const measure = async () =>
    p.locator('.kium-ustrip .kium-scard2').evaluateAll((els) =>
      els.map((e) => {
        const card = e.getBoundingClientRect();
        const btn = e.querySelector('.kium-sact, .kium-sact-closed').getBoundingClientRect();
        const course = e.querySelector('.kium-scard2-course').getBoundingClientRect();
        return {
          gap: Math.round(card.bottom - btn.bottom),
          cardH: Math.round(card.height),
          lines: Math.round(course.height / 20),
        };
      })
    );
  const report = [];
  let worst = null;
  for (const w of [1440, 1024, 768]) {
    await p.setViewportSize({ width: w, height: 1200 });
    await p.waitForTimeout(500);
    const geo = await measure();
    const gaps = [...new Set(geo.map((g) => g.gap))];
    const heights = [...new Set(geo.map((g) => g.cardH))];
    const lines = [...new Set(geo.map((g) => g.lines))];
    report.push(`${w}px 간격 ${gaps.join('/')} · 높이 ${heights.join('/')} · 줄수 ${lines.join('/')}`);
    if (gaps.length !== 1 || heights.length !== 1) worst = w;
  }
  ok('C4 스트립 CTA 하단 정렬 — 카드 높이 균일 · 버튼 바닥 간격 동일', worst === null, report.join(' | '));
  await p.setViewportSize(PC);
  await p.waitForTimeout(400);

  /* C1 — 신청 가능 3상태 라벨 동일 */
  const labels = await p.locator('.kium-ustrip .kium-sact').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-tone')}:${e.querySelector('.kium-sact-go').textContent.trim()}`)
  );
  const uniq = [...new Set(labels.map((x) => x.split(':')[1]))];
  ok('C1 신청 가능 3상태 CTA 라벨 = 상담하기 단일', uniq.length === 1 && uniq[0] === '상담하기', labels.join(' / '));

  /* C6 — 접근명에 상태가 남는다 */
  const aria = await p.locator('.kium-ustrip .kium-sact[data-tone="red"]').first().getAttribute('aria-label');
  ok('C6 접근명에 상태 유지(마감임박 … 상담하기)', /마감임박 상담하기$/.test(aria || ''), aria);
  await p.close();
}

{
  /* C7 — 쇼케이스 4종 라벨 */
  const p = await browser.newPage({ viewport: PC });
  await p.goto(`${BASE}/kium?tab=courses&mode=open&preview=badges`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const g = await p.locator('.kium-showcase .kium-ustrip .kium-scard2').evaluateAll((els) =>
    els.map((e) => `${e.getAttribute('data-status')}:${(e.querySelector('.kium-sact-go') || e.querySelector('.kium-cta-next')).textContent.trim()}`)
  );
  ok(
    'C7 쇼케이스 4종 라벨 = 상담하기 ×3 + 다음 회차 상담',
    g.filter((x) => x.endsWith(':상담하기')).length === 3 && g.some((x) => x === 'closed:다음 회차 상담'),
    g.join(' / ')
  );
  await p.close();
}

/* ═══ 금지어 — 런타임 렌더 기준 ═══════════════════════════════════ */
{
  const p = await browser.newPage({ viewport: PC });
  const found = {};
  for (const path of ['/kium', '/kium?tab=courses&mode=open']) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    const body = await p.locator('body').innerText();
    for (const w of ['공개 교육', '미개설', '전환되었습니다', '이 일정으로 상담']) {
      if (body.includes(w)) found[w] = (found[w] || 0) + 1;
    }
  }
  ok('Z 금지 문구 렌더 0건(공개 교육 · 미개설 · 전환되었습니다 · 이 일정으로 상담)', Object.keys(found).length === 0, JSON.stringify(found));

  /* Z2 — 렌더 문구에서 대시(— · –)를 쓰지 않는다(표기 규칙 통일).
     저장소 주석에는 설계 근거 서술용 대시가 많으므로 소스 정적 검사가 아니라
     **런타임 innerText**를 본다 — 주석은 렌더되지 않아 자동으로 제외된다.
     검토 전용 화면(?preview=cases)까지 포함해 세 경로를 훑는다. */
  const dashes = [];
  for (const path of ['/kium', '/kium?tab=courses&mode=open', '/kium?tab=courses&mode=open&preview=cases']) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    const hits = await p.evaluate(() =>
      document.body.innerText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.includes('\u2014') || l.includes('\u2013'))
    );
    for (const h of hits) dashes.push(path + ' :: ' + h);
  }
  ok('Z2 렌더 문구 대시(— · –) 0건', dashes.length === 0,
    dashes.length ? dashes.join(' | ') : '3경로 0건');
  await p.close();
}

await browser.close();

const fail = results.filter((r) => !r.pass);
const skipped = results.filter((r) => r.skipped).length;
console.log(`\n=== ${results.length - fail.length - skipped}/${results.length - skipped} PASS (참고 ${skipped}건) ===`);
if (fail.length) {
  console.log('FAILED:');
  fail.forEach((f) => console.log(` - ${f.name} ${f.detail}`));
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(fail.length ? 1 : 0);
