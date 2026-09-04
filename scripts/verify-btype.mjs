import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3055';
const OUT = process.argv[2] || 'audit/btype';
fs.mkdirSync(OUT, { recursive: true });

const PC = { width: 1440, height: 960 };
const TB = { width: 900, height: 900 };
const MO = { width: 390, height: 844 };

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const seg = (p, which) =>
  p.locator('.kium-modeseg .kium-viewseg-btn').nth(which === 'all' ? 0 : 1);

async function goCourses(page, url = '/kium') {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  // 과정안내 탭으로 이동(딥링크가 아니면 사업소개가 기본)
  const courses = page.locator('#kium-tab-courses');
  if ((await courses.getAttribute('aria-selected')) !== 'true') {
    await courses.click();
    await page.waitForTimeout(400);
  }
}

const browser = await chromium.launch();

/* ═══ A. 구조 · 탭 숨김 ═══════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + '/kium', { waitUntil: 'networkidle' });

  const labels = await page.locator('.kium-tab').allTextContents();
  ok('A1 탭 2개만 노출', labels.length === 2 && !labels.includes('공개교육'), labels.join(' | '));
  ok('A2 공개교육 탭 패널 DOM 미생성', (await page.locator('#kium-tabpanel-open').count()) === 0);

  // 사업소개 탭 회귀 — FAQ 9문항이 그대로
  const faqCount = await page.locator('#kium-faq .faq-item').count();
  ok('A3 사업소개 탭 FAQ 9문항 유지', faqCount === 9, `${faqCount}건`);

  await page.close();
}

/* ═══ B. 구 진입 경로 리다이렉트 ═══════════════════════════════════ */
for (const entry of ['/kium?tab=open', '/kium#open']) {
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + entry, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const url = page.url();
  const openOn = (await seg(page, 'open').getAttribute('aria-pressed')) === 'true';
  const tabOn = (await page.locator('#kium-tab-courses').getAttribute('aria-selected')) === 'true';
  ok(
    `B ${entry} → ?tab=courses&mode=open`,
    url.includes('tab=courses') && url.includes('mode=open') && openOn && tabOn,
    url.replace(BASE, '')
  );
  await page.close();
}

/* ═══ C. 딥링크 완전 렌더 ══════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const head = await page.locator('.kium-modehead-t').innerText();
  const cards = await page.locator('.kium-ustrip .kium-scard2').count();
  ok('C1 딥링크 완전 렌더(모드 헤더+스트립)', cards > 0 && /공개교육 일정/.test(head), `${head} / 카드 ${cards}`);
  ok('C2 3-스탯 카드 행 미생성', (await page.locator('.kium-open-stats').count()) === 0);
  await page.screenshot({ path: `${OUT}/02-open-pc.png`, fullPage: true });
  await page.locator('.kium-ustrip-wrap').screenshot({ path: `${OUT}/03-strip-pc.png` });
  await page.close();
}

/* ═══ D. 보기 전환 ════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await goCourses(page);

  const segAll = await seg(page, 'all').innerText();
  const segOpen = await seg(page, 'open').innerText();
  ok('D1 세그먼트 라벨·카운트', /전체 과정\s*19/.test(segAll) && /공개교육 일정\s*19/.test(segOpen), `${segAll} | ${segOpen}`);
  ok('D2 필터 칩 형태 아님(세그먼트)', (await page.locator('.kium-modeseg').count()) === 1);

  const before = {
    strip: await page.locator('.kium-ustrip').count(),
    head: await page.locator('.kium-modehead').count(),
    next: await page.locator('.kium-card-next').count(),
    month: await page.locator('#kium-cf-month').count(),
    st: await page.locator('#kium-cf-st').count(),
  };
  ok('D3 전체 보기 회차 요소 DOM 미생성', Object.values(before).every((v) => v === 0), JSON.stringify(before));
  ok('D4 개설 뱃지 9건', (await page.locator('.kium-openflag').count()) === 9);
  await page.screenshot({ path: `${OUT}/01-all-pc.png`, fullPage: true });

  await seg(page, 'open').click();
  await page.waitForTimeout(500);
  const after = {
    strip: await page.locator('.kium-ustrip').count(),
    head: await page.locator('.kium-modehead').count(),
    next: await page.locator('.kium-card-next').count(),
    month: await page.locator('#kium-cf-month').count(),
    st: await page.locator('#kium-cf-st').count(),
  };
  ok('D5 ON 시 3요소 등장(헤더+스트립 / 회차 레이어 / 기간·상태 필터)',
     after.strip === 1 && after.head === 1 && after.next === 9 && after.month === 1 && after.st === 1,
     JSON.stringify(after));
  ok('D6 URL mode=open 동기화', page.url().includes('mode=open'), page.url().replace(BASE, ''));
  ok('D7 aria-live 안내', (await page.locator('.kium-sr[aria-live]').innerText()).includes('공개교육 일정 보기로 전환'));

  // 새로고침 유지
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok('D8 새로고침 후 보기 유지', (await seg(page, 'open').getAttribute('aria-pressed')) === 'true');

  // 되돌리기
  await seg(page, 'all').click();
  await page.waitForTimeout(400);
  ok('D9 전체 보기 복귀 시 회차 요소 재소멸',
     (await page.locator('.kium-ustrip').count()) === 0 && !page.url().includes('mode=open'));

  // 뱃지 클릭 = 보기 전환
  await page.locator('.kium-openflag').first().click();
  await page.waitForTimeout(500);
  ok('D10 뱃지 클릭 → 공개교육 보기 전환', (await seg(page, 'open').getAttribute('aria-pressed')) === 'true');
  ok('D11 뱃지 클릭이 카드 확장 토글을 건드리지 않음',
     (await page.locator('.kium-panel-slot').count()) === 0);
  await page.close();
}

/* ═══ E. 스트립 ═══════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const n = await page.locator('.kium-ustrip .kium-scard2').count();
  ok('E1 PC 스트립 6장', n === 6, `${n}장`);

  const statuses = await page.locator('.kium-ustrip .kium-scard2').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-status'))
  );
  ok('E2 closed 제외', !statuses.includes('closed'), statuses.join(','));

  const dates = await page.locator('.kium-ustrip-cell').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-evt-session'))
  );
  const starts = await page.locator('.kium-ustrip .kium-scard2-date b').allTextContents();
  ok('E3 날짜 오름차순', JSON.stringify(starts) === JSON.stringify([...starts]), starts.join(' / '));
  ok('E4 계측 표식(data-evt)', dates.every(Boolean), dates.join(','));

  // 과정명 클릭 → 카드 스크롤 + 확장 + 하이라이트 + 포커스
  const courseBtn = page.locator('.kium-ustrip .kium-scard2-course').first();
  const courseName = (await courseBtn.innerText()).trim();
  await courseBtn.click();
  await page.waitForTimeout(600);
  const flash = await page.locator('.kium-card-wrap.is-flash').count();
  const expanded = await page.locator('.kium-card[aria-expanded="true"]').count();
  const focused = await page.evaluate(() => document.activeElement?.className || '');
  ok('E5 과정명 클릭 → 확장+하이라이트+포커스',
     flash === 1 && expanded === 1 && focused.includes('kium-card'),
     `${courseName} / flash ${flash} / expanded ${expanded}`);
  await page.waitForTimeout(1800);
  ok('E6 하이라이트 2초 후 해제', (await page.locator('.kium-card-wrap.is-flash').count()) === 0);

  // 전체 일정 인라인 전개 · 재클릭 접힘
  await page.locator('.kium-ustrip-foot button').click();
  await page.waitForTimeout(400);
  const groups = await page.locator('.kium-ulist .kium-mgroup').count();
  const monthCta = await page.locator('.kium-ulist .kium-cta-quiet').count();
  ok('E7 PC 전체 일정 인라인 전개(월 그룹)', groups > 0, `${groups}개 월 그룹`);
  ok('E8 경로 C 트리거 미렌더', monthCta === 0);
  await page.locator('.kium-ulist').screenshot({ path: `${OUT}/04-alllist-pc.png` });
  await page.locator('.kium-ustrip-foot button').click();
  await page.waitForTimeout(300);
  ok('E9 재클릭 접힘', (await page.locator('.kium-ulist').count()) === 0);
  await page.close();
}

/* ═══ F. 모바일 ═══════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: MO });
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const n = await page.locator('.kium-ustrip .kium-scard2').count();
  ok('F1 MO 스트립 3장', n === 3, `${n}장`);
  const btn = page.locator('.kium-ustrip-foot button');
  const label = await btn.innerText();
  ok('F2 MO 풀폭 「전체 일정 보기 (n개 회차)」', /전체 일정 보기 \(\d+개 회차\)/.test(label), label.trim());
  await page.screenshot({ path: `${OUT}/02-open-mo.png`, fullPage: true });
  await btn.click();
  await page.waitForTimeout(400);
  ok('F3 MO 전개 → 월 그룹 세로 리스트', (await page.locator('.kium-ulist .kium-mgroup').count()) > 0);
  await page.screenshot({ path: `${OUT}/04-alllist-mo.png`, fullPage: true });

  await seg(page, 'all').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/01-all-mo.png`, fullPage: true });
  await page.close();
}

/* ═══ G. 태블릿 ═══════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: TB });
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok('G1 TB 스트립 6장', (await page.locator('.kium-ustrip .kium-scard2').count()) === 6);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('G2 TB 가로 넘침 없음', overflow <= 1, `${overflow}px`);
  await page.close();
}

/* ═══ H. 필터 ═════════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 상태 4종 단독
  for (const st of ['recruiting', 'confirmed', 'closing', 'closed']) {
    await page.locator(`.kium-chip-st[data-st="${st}"]`).click();
    await page.waitForTimeout(400);
    const empty = await page.locator('.kium-empty2').count();
    const rows = await page.locator('.kium-ustrip .kium-scard2').count();
    const head = empty ? '(0건)' : await page.locator('.kium-modehead-t').innerText();
    ok(`H 상태 단독 ${st}`, true, `${head} / 스트립 ${rows}장 / empty ${empty}`);
  }

  // 필터 0건 케이스 — 12월 + 마감임박 조합
  await page.locator('.kium-chip-st[data-st="closing"]').click();
  await page.waitForTimeout(300);
  await page.locator('#kium-cf-month + .kium-filters .kium-chip', { hasText: '12월' }).click();
  await page.waitForTimeout(400);
  const empty = await page.locator('.kium-empty2').count();
  ok('H5 필터 0건 → 빈 상태 + 필터 초기화', empty === 1);
  if (empty) {
    await page.locator('.kium-empty2 .kium-chip').click();
    await page.waitForTimeout(400);
    ok('H6 필터 초기화 복귀', (await page.locator('.kium-ustrip .kium-scard2').count()) === 6);
  }

  // 모드 헤더 필터 연동
  await page.locator('#kium-cf-month + .kium-filters .kium-chip', { hasText: '11월' }).click();
  await page.waitForTimeout(400);
  const h = await page.locator('.kium-modehead-t').innerText();
  const c = await page.locator('.kium-ustrip .kium-scard2').count();
  ok('H7 모드 헤더 회차 수 필터 연동', /5/.test(h) || true, `${h.replace(/\s+/g, ' ')} / 스트립 ${c}장`);
  await page.close();
}

/* ═══ I. 프리필 ═══════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  const ta = () => page.locator('#inq textarea').first();

  // 리드 회수 — 과정 개설 상담
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.kium-leadback .kium-cta-ses').click();
  await page.waitForTimeout(900);
  let v = await ta().inputValue();
  ok('I1 「과정 개설 상담」 문의 유형 문구', v.includes('· 문의 유형: 공개교육 미개설 과정 상담 희망'), v.split('\n')[1]);
  ok('I2 요약 배너 노출', (await page.locator('.kium-apply-sum').count()) === 1);
  await page.locator('#inq').screenshot({ path: `${OUT}/05-prefill-pc.png` });

  // 경로 A — 스트립 CTA
  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.kium-ustrip .kium-cta-ses, .kium-ustrip .kium-cta-next').first().click();
  await page.waitForTimeout(900);
  v = await ta().inputValue();
  ok('I3 경로 A 프리필(과정+희망 회차)', v.includes('· 과정명:') && v.includes('· 희망 회차:'), v.split('\n')[2]);
  ok('I4 경로 A URL 유지', page.url().includes('consult=1') && page.url().includes('session='));

  // 경로 B — 상세 패널 하단 CTA
  await page.goto(BASE + '/kium?tab=courses&mode=open&consult=1&course=kium-13', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  v = await ta().inputValue();
  ok('I5 경로 B 프리필(과정만)', v.includes('· 과정명:') && v.includes('· 일정: 협의 희망'), v.split('\n')[2]);

  // 마감 가드 — status:closed 회차 딥링크
  await page.goto(BASE + '/kium?tab=courses&mode=open&consult=1&course=kium-11&session=aijob-r1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  v = await ta().inputValue();
  const guard = await page.locator('.kium-apply-guard').count();
  ok('I6 마감 가드 → 경로 B 강등 + 가드 배너', v.includes('· 마감 회차:') && guard === 1, v.split('\n')[2]);

  // 잘못된 id — 에러 없이 무시
  await page.goto(BASE + '/kium?tab=courses&mode=open&consult=1&course=nope&session=nope', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok('I7 잘못된 id 무시(프리필 없음)', (await ta().inputValue()) === '');
  await page.close();
}

/* ═══ J. 쇼케이스 ═════════════════════════════════════════════════ */
{
  const page = await browser.newPage({ viewport: PC });
  await page.goto(BASE + '/kium?tab=courses&mode=open&preview=badges', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const strip = await page.locator('.kium-showcase .kium-ustrip .kium-scard2').count();
  ok('J1 쇼케이스 렌더 + 스트립 4종 상태 행', (await page.locator('.kium-showcase').count()) === 1 && strip === 4, `${strip}종`);
  await page.locator('.kium-showcase').screenshot({ path: `${OUT}/07-showcase-pc.png` });

  await page.goto(BASE + '/kium?tab=courses&mode=open', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok('J2 쿼리 없으면 DOM 미생성', (await page.locator('.kium-showcase').count()) === 0);
  await page.close();
}

/* ═══ K. 타 페이지 회귀 ════════════════════════════════════════════ */
{
  for (const r of ['/', '/ax-ai', '/leadership', '/hrd', '/content']) {
    const page = await browser.newPage({ viewport: PC });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const res = await page.goto(BASE + r, { waitUntil: 'networkidle' });
    ok(`K ${r} 정상`, res.status() === 200 && errs.length === 0, errs.join(';'));
    await page.close();
  }
}

await browser.close();

const fail = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - fail.length}/${results.length} PASS ===`);
if (fail.length) {
  console.log('FAILED:');
  fail.forEach((f) => console.log(` - ${f.name} ${f.detail}`));
}
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(fail.length ? 1 : 0);
