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
  ok('Q1 세그먼트 `전체 과정 19` / `공개교육 9`', segAll === '전체 과정 19' && segOpen === '공개교육 9', `${segAll} | ${segOpen}`);

  ok('Q2 전체 보기 승격 1줄', (await p.locator('.kium-allhead').innerText()) === '모든 과정이 정부지원 환급 대상입니다');
  ok('Q3 정부지원 환급 칩 렌더 0건', (await p.locator('.kium-card .kium-badge.gov').count()) === 0);
  ok('Q4 공개교육 뱃지는 존치(9건)', (await p.locator('.kium-openflag').count()) === 9);

  const lead = (await p.locator('.kium-openlead').innerText()).replace(/\s+/g, ' ');
  ok('Q5 인트로 카피 교체', lead.startsWith('인원이 적어도 괜찮습니다.') && !lead.includes('혼자'), lead.slice(0, 46));

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

  ok('Q10 결과 문구 시각 노출(.kium-livenote)', (await p.locator('.kium-livenote').count()) === 1 &&
     (await p.locator('.kium-livenote').getAttribute('aria-live')) === 'polite',
     await p.locator('.kium-livenote').innerText());

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
  await p.locator('.kium-ustrip .kium-cta-ses').first().click();
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
  await p.locator('.kium-ustrip .kium-cta-ses').first().click();
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
  await p.locator('.kium-ustrip .kium-cta-ses').first().click();
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
  await p.locator('.kium-ustrip .kium-cta-ses').nth(1).click();
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
  await p.screenshot({ path: `${OUT}/v-${w}.png`, fullPage: true });
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
    for (const w of ['공개 교육', '미개설']) {
      if (body.includes(w)) found[w] = (found[w] || 0) + 1;
    }
  }
  ok('Z 금지어 렌더 0건(`공개 교육` · `미개설`)', Object.keys(found).length === 0, JSON.stringify(found));
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
