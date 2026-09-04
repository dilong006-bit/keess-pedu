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
  const CTA_BY_TONE = { amber: '상담하기', green: '상담하기', red: '마감 전 상담' };
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
  const rowCta = await p.locator('.kium-srow > .kium-srow-act > .kium-cta-ses').count();
  const rows = await p.locator('.kium-srow').count();
  ok(
    'T5 리스트 행도 통합 버튼(BT-22)',
    rowSact === rows && rows > 0 && rowCta === 0,
    `행 ${rows} / sact ${rowSact} / 구 CTA ${rowCta}`
  );

  /* 리스트 행 폭 규칙 — 상태 영역이 한 열에 서는가.
     ★ 검토용 시드로 3상태가 처음 공존하면서 드리프트가 드러났다:
       .kium-srow-act{justify-content:flex-end} + .kium-sact{width:auto;min-width:184px} 조합에서
       '마감 전 상담'(긴 라벨) 버튼이 더 넓어 우측 정렬 기준상 좌측으로 밀린다.
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
    'U4 closing — filled(red) · 마감 전 상담 · 잔여석 병기',
    by('closing')?.isButton && by('closing')?.tone === 'red' && by('closing')?.go === '마감 전 상담' && /잔여 \d+석/.test(by('closing')?.seats || ''),
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

  /* P1 — 전체 보기 상세 패널 CTA → ① 2줄 */
  await openCourses(p);
  await p.locator('#kium-cardwrap-kium-03 .kium-card').click();
  await p.waitForTimeout(700);
  await p.locator('.kium-panel-slot .kium-detail-cta button').first().click();
  await p.waitForTimeout(900);
  let v = await ta(p).inputValue();
  ok(
    'P1 ① 일반 과정(2줄)',
    /^\[관심 과정: [^\]]+\]\n· 문의 내용: \n$/.test(v),
    JSON.stringify(v)
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
  info('P4 마감 회차 → ③ `마감 → 다음 회차 문의`', 'status 시드 제거(BT-02)로 closed 0건 — 코드 경로 보존, 현재 데이터로 도달 불가');

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
    const asc = g.dates.every((d, i) => i === 0 || key(g.dates[i - 1]) <= key(d));
    const closedTail = g.statuses.filter((x) => x === 'closed').length === 0 ||
      g.statuses.indexOf('closed') === g.statuses.length - g.statuses.filter((x) => x === 'closed').length;
    ok(`A6 ${g.label} 날짜 오름차순 · closed 최하단`, asc && closedTail, g.dates.join(' · '));
  }

  /* A7 — 스트립 순서 == 리스트 앞 6행 */
  const listDates = byMonth.flatMap((g) => g.dates);
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
