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
      h2 === '공개교육 일정 · 12월 · 모집중 8개 회차',
    `${h0} → ${h1} → ${h2}`
  );

  const modeSub = (await p.locator('.kium-modehead-s').innerText()).replace(/\s+/g, ' ').trim();
  ok('Q9-b 모드 헤더 보조 문구 = 1명부터 신청 가능(환급 제거)', modeSub === '1명부터 신청 가능', modeSub);

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
  const labels = await p.locator('.kium-ustrip .kium-sact-go')
    .evaluateAll((els) => Array.from(new Set(els.map((e) => e.textContent.trim()))));
  ok('T1 회차 CTA 라벨 = 상담하기', labels.length === 1 && labels[0] === '상담하기', labels.join(' / '));
  const aria = await p.locator('.kium-ustrip .kium-sact').first().getAttribute('aria-label');
  ok('T2 CTA 접근명이 라벨과 일치', /상담하기$/.test(aria || ''), aria);

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

  /* 리스트 뷰(.kium-srow)에는 통합을 적용하지 않는다 */
  await p.locator('.kium-schedbox-toggle').click();
  await p.waitForTimeout(500);
  const rowSact = await p.locator('.kium-srow .kium-sact').count();
  const rowBadge = await p.locator('.kium-srow .kium-sbadge').count();
  const rowCta = await p.locator('.kium-srow .kium-cta-ses').count();
  ok(
    'T5 리스트 행은 현행 유지(통합 미적용)',
    rowSact === 0 && rowBadge > 0 && rowCta > 0,
    `sact ${rowSact} / badge ${rowBadge} / cta ${rowCta}`
  );
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
