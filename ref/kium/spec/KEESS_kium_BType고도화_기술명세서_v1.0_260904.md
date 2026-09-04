# KEESS `/kium` B-Type 고도화 기술명세서 v1.0

- **작성일**: 2026-09-04
- **대상 저장소**: `KEESS_pedu` (`github.com/dilong006-bit/keess-pedu`) · 기준 커밋 `fa119ea`
- **대상 화면**: `/kium` 과정안내 탭 — 전체 보기 · 공개교육 보기
- **문서 지위**: 본 건 구현의 **단일 기준**. 전략 `KEESS_kium_과정카탈로그_UIUX고도화전략_v2.1_260904.md`를 구현 계약으로 확정한다.
- **코드 그라운딩**: 2026-09-04 실사 완료. 파일·행 번호·심볼·정규식은 **전부 실제 코드에서 확인된 값**이다.

---

## 0. 실사로 확정된 사실

| # | 항목 | 실측 |
| --- | --- | --- |
| F1 | `KIUM_SESSIONS` | **19건** — `relead-r3`가 주석 처리됨(`sessions.ts` 78~80행) |
| F2 | `status` 시드 | `agent-r3`=`closed`(start 2026-11-30) · `aijob-r1`=`closed`(start 2026-10-19) — **미래 회차인데 마감** |
| F3 | 세그먼트 카운트 | 좌 `allCourses.length`(과정 19) / 우 `future.length`(**회차** 19) — **단위 불일치** |
| F4 | 월 필터 | `countByMonth`가 `displayMonth` 기준 — **규칙대로 동작** |
| F5 | 섹션 헤더 | `10~12월`이 **하드코딩**(`KiumCoursesTab.tsx:483`) — 필터 미반영 |
| F6 | `live` 문구 | `.kium-sr`로 **시각 은닉**(331행) — 스크린리더만 인지 |
| F7 | **프리필 누적 원인** | `requestKiumInquiry`가 `strip`을 **전달하지 않는다**(`inquiryBridge.ts:26`) → `HomeInquiry`가 기본값 `[/^\[관심 과정: …\]\s*/]`로 폴백 → **공개교육 블록이 제거되지 않는다** |
| F8 | `Img` 컴포넌트 | `loading="lazy"` · `decoding="async"` · `onError` 폴백 **이미 구현** — 추가 작업 없음 |
| F9 | `formatSessionRange` | `'10.12(월) ~ 13(화) · 2일'` — **일수 포함 유틸이 이미 존재** |
| F10 | 순환 import 위험 | `openBridge` → `inquiryBridge`(`KIUM_PREFILL_EVENT`) 단방향. **역방향 import 금지** |

---

## 1. 확정 요구사항

| ID | 요구사항 | 우선 |
| --- | --- | --- |
| **BT-01** | `relead-r3` 복원 → **20회차** 성립 | P0 |
| **BT-02** | `status` 시드 전건 교체(회신값) 또는 **`recruiting` 초기화** | P0 |
| **BT-03** | 세그먼트 → `전체 과정 19` / **`공개교육 9`** (양쪽 과정 수) | P0 |
| **BT-04** | 기간 칩에 **`회차` 단위** + `aria-label` | P0 |
| **BT-05** | 프리필 **4종 포맷 확정 + 토큰 누적 제거** | P0 |
| **BT-06** | `정부지원 환급` 칩 제거 + **섹션 1줄 승격** | P0 |
| **BT-07** | 공개교육 인트로 **카피 교체** | P0 |
| **BT-08** | 상세 패널 `교육 일정` → **`공개교육`** + 공개교육 pill 시각 구분 | P1 |
| **BT-09** | 섹션 헤더 **필터 연동** | P1 |
| **BT-10** | 썸네일 **19장 전건 실사화** · `openThumbs.ts` 폐지 · `alt=""` | P1 |
| **BT-11** | 필터 결과 문구 **시각 노출** | P2 |
| **BT-12** | 표기 **`공개교육` 붙여쓰기 통일** | P1 |

---

## 2. 데이터 계층 — `lib/kium/sessions.ts`

### 2-1. BT-01 `relead-r3` 복원

**78~80행**의 주석 블록을 아래로 교체한다.

```ts
// 수정 전
  // ⚠ 12월 회차(부록 C1)는 원문 표기 `12/17(수)~18(금)`이 실제 달력과 불일치(2026-12-17=목)하고
  //   2일 과정인데 수~금 3일이라 **일자 자체가 미확정**이다. 새 데이터 모델에는 일자 없는 회차를
  //   놓을 자리가 없으므로(정렬 기준이 start) 배열에 넣지 않는다. 회신 후 아래 한 줄을 살린다.
  // { id: 'relead-r3', courseId: 'kium-04', displayMonth: 12, start: '2026-12-__', end: '2026-12-__', status: 'recruiting' },

// 수정 후
  // 원문 표기 `12/17(수)~18(금)`에서 오류는 **요일 라벨 (수) 하나뿐**이다(2026-12-17=목).
  // 날짜 17~18은 2일로 과정 길이(14시간·2일)와 정합하며, 요일은 이 파일이 start에서 파생하므로
  // 화면에는 `12.17(목) ~ 18(금)`으로 자동 교정되어 출력된다. 원문 날짜를 그대로 신뢰한다.
  { id: 'relead-r3', courseId: 'kium-04', displayMonth: 12, start: '2026-12-17', end: '2026-12-18', status: 'recruiting' },
```

**검증**: `KIUM_SESSION_TOTAL === 20` · `countByMonth(10)===6` · `countByMonth(11)===6` · `countByMonth(12)===8`

### 2-2. BT-02 `status` 시드 제거 🔴

`KIUM_SESSIONS` 20건의 `status`·`seatsLeft`는 **배지 4종 UI 검증용 시드**이며 원문 근거가 없다(파일 주석이 명시).

| 상황 | 조치 |
| --- | --- |
| 사업부 회신값 **있음** | 20건 전건 회신값으로 교체 |
| 회신값 **없음** | **전건 `status: 'recruiting'`** · `seatsLeft` 프로퍼티 **전건 삭제** |

```ts
// 예 — 회신 전 초기화 형태
{ id: 'agent-r1',  courseId: 'kium-09', displayMonth: 10, start: '2026-10-12', end: '2026-10-13', status: 'recruiting' },
{ id: 'agent-r2',  courseId: 'kium-09', displayMonth: 11, start: '2026-11-02', end: '2026-11-03', status: 'recruiting' },
{ id: 'agent-r3',  courseId: 'kium-09', displayMonth: 12, start: '2026-11-30', end: '2026-12-01', status: 'recruiting' },
// … 20건 동일
```

> **왜 `recruiting`이 안전 기본값인가**: `effectiveStatus()`는 **과거를 마감으로 승격**시키는 단방향 안전장치라, 잘못 박힌 `closed`는 되돌리지 못한다. 열린 회차를 닫아 보이는 손실(신청 자체가 안 들어옴)이, 닫힌 회차를 열어 보이는 손실(상담에서 회수 가능)보다 크다.

**배지 4종 시각 검증은 `components/kium/BadgeShowcase.tsx`로 한다. 운영 데이터로 하지 않는다.**

### 2-3. 유틸 무변경

`fmtRange` · `formatSessionRange` · `sessionDays` · `effectiveStatus` · `isPast` · `sortByWeight` · `countByStatus` · `getNearestSession` · `getNextOpenSession` — **전건 그대로**. 요일 파생 설계가 BT-01을 자동으로 옳게 만든다.

---

## 3. 카운트·라벨 — `components/kium/KiumCoursesTab.tsx`

### 3-1. BT-03 세그먼트 (317 · 326행)

```tsx
// 수정 전 (326행)
공개교육 일정 <span className="cnt">{future.length}</span>

// 수정 후 — 라벨에서 '일정' 제거, 카운트를 과정 수로 통일
공개교육 <span className="cnt">{openCourseTotal}</span>
```

```tsx
// 컴포넌트 상단에 상수 1개 추가 (getOpenCourses는 이미 import돼 있다)
const openCourseTotal = getOpenCourses().length;   // 9
```

- 좌측 `전체 과정 {allCourses.length}`(19)는 **무변경**
- 세그먼트는 **보기 범위**를 고르는 컨트롤이므로 양쪽 단위가 같아야 한다. 회차 수는 §3-3 헤더가 말한다

### 3-2. BT-04 기간 칩 단위 (376~390행)

```tsx
// 전체 칩 — 수정 후
<button
  type="button"
  className="kium-chip"
  aria-pressed={month === 'all'}
  aria-label={`기간 전체, ${future.length}개 회차`}
  onClick={() => changeMonth('all')}
>
  전체 <span className="cnt">{future.length}<i>회차</i></span>
</button>

// 월 칩 — 수정 후
{MONTHS.map((m) => (
  <button
    key={m}
    type="button"
    className="kium-chip"
    aria-pressed={month === m}
    aria-label={`${m}월, ${monthCount(m)}개 회차`}
    onClick={() => changeMonth(m)}
  >
    {m}월 <span className="cnt">{monthCount(m)}<i>회차</i></span>
  </button>
))}
```

| 규칙 | 내용 |
| --- | --- |
| 적용 범위 | **기간 축만.** 분야·모집 상태 칩은 **무변경** |
| 사유 | 「기간」 라벨 옆 숫자는 **일수로 오독**된다. 분야·상태 라벨 옆 숫자는 자연히 '개수'로 읽혀 오독 위험이 없고, 세 축에 모두 단위를 붙이면 모바일 필터 바가 3줄이 된다 |
| 마크업 | 숫자는 `.cnt`(tabular-nums), 단위는 `<i>`로 분리 — 한글에 등폭 숫자 서체가 적용되지 않게 한다 |

### 3-3. BT-09 섹션 헤더 필터 연동 (481~487행)

```tsx
// 수정 전
<p className="kium-modehead-t">
  공개교육 일정 <span className="sep">·</span> 10~12월 <b>{visible.length}</b>개 회차
</p>

// 수정 후 — 범위 문구를 필터에서 파생한다
<p className="kium-modehead-t">
  공개교육 일정 <span className="sep">·</span> {scopeLabel} <b>{visible.length}</b>개 회차
</p>
```

```tsx
// 파생 — 컴포넌트 내부
const scopeLabel = [
  month === 'all' ? '10~12월' : `${month}월`,
  cat === 'all' ? null : categories.find((c) => c.key === cat)?.label ?? null,
  status === 'all' ? null : KIUM_SESSION_META[status].label,
].filter(Boolean).join(' · ');
```

| 필터 | 결과 |
| --- | --- |
| 미적용 | `공개교육 일정 · 10~12월 20개 회차` |
| 12월 | `공개교육 일정 · 12월 8개 회차` |
| 12월 + 모집중 | `공개교육 일정 · 12월 · 모집중 6개 회차` |

### 3-4. BT-06 정부지원 환급 승격 (전체 보기 1줄 신설)

`!isOpenMode`일 때, 인트로 문구(`.kium-openlead`) **바로 위**에 1줄을 둔다.

```tsx
{!isOpenMode && (
  <p className="kium-allhead">모든 과정이 정부지원 환급 대상입니다</p>
)}
```

- **숫자를 쓰지 않는다** — 바로 아래 `.kium-count`("19개 과정")와 중복되지 않게
- 공개교육 보기의 `.kium-modehead-s`("1명부터 신청 가능 · 정부지원 환급")와 **대칭 위치**

### 3-5. BT-07 인트로 카피 (435행)

```tsx
// 수정 전
일부 과정은 공개교육으로 1명부터 신청하실 수 있습니다.{' '}

// 수정 후
인원이 적어도 괜찮습니다. 1명부터 신청할 수 있는 공개교육 일정을 확인해 보세요.{' '}
```

버튼 문구 `공개교육 일정 보기`는 **무변경**.

> **`혼자`라는 단어는 금지한다.** 같은 페이지 FAQ가 "개인 자격의 신청·결제는 지원되지 않습니다"라고 명시하므로 개인 결제로 오해될 수 있다.

### 3-6. BT-11 필터 결과 문구 시각 노출 (331행)

```tsx
// 수정 전 — 스크린리더 전용
<p className="kium-sr" aria-live="polite">{live}</p>

// 수정 후 — 시각 + 낭독 겸용. 필터 바 하단으로 이동
<p className="kium-livenote" aria-live="polite">{live}</p>
```

- 위치: `.kium-vfilters` 닫는 태그 **직후**
- `live`가 빈 문자열이면 렌더하지 않는다(빈 줄 방지)

---

## 4. 상세 패널 — `components/kium/KiumCoursePanel.tsx`

### 4-1. BT-08 라벨 교체 (108~121행)

```tsx
// 수정 전
<span className="kium-pill">
  <b>교육 일정</b>
  …
</span>
<span className="kium-pill">
  <b>교육비</b>
  …
</span>

// 수정 후 — 라벨 교체 + data-open 부여
<span className="kium-pill" data-open>
  <b>공개교육</b>
  …
</span>
<span className="kium-pill" data-open>
  <b>교육비</b>
  …
</span>
```

**124~130행의 `isOpenVar` 분기 `교육비` pill에도 동일하게 `data-open`을 부여한다.**

| 사유 | 내용 |
| --- | --- |
| `교육 일정` → `공개교육` | 현행 라벨은 **이 과정 전체의 일정**으로 읽히나 실제로는 공개교육 회차만 나열한 것이다. 이 과정은 기업 위탁으로도 운영된다(`schedule: '연중상시'`). **라벨이 사실과 다르게 읽히는 문제**다 |
| 4자 | `교육 대상`·`교육 형태`·`교육 시간`과 같은 리듬 |
| `data-open` | 위탁 공통 정보(대상·형태·시간·정원)와 공개교육 전용 정보(공개교육·교육비)를 시각적으로 구분한다 |

---

## 5. 카드 — `components/kium/KiumCourseCard.tsx`

### 5-1. BT-06 정부지원 환급 칩 제거 (86~88행)

```tsx
// 수정 전
{/* 정부지원 환급 배지 — 단가(원) 미노출을 갈음하는 B2B 환급 구조 표기. */}
{!isOpen && <span className="kium-badge gov">정부지원 환급</span>}

// 수정 후 — 행 전체 삭제
// (섹션 1줄로 승격 — §3-4. 19/19 전 카드 반복은 변별력 0이며 스크린리더가 19번 낭독한다)
```

- `공개교육` 칩은 **존치** — 9/19에만 붙어 변별력이 있다
- `.kium-badge.gov` CSS 규칙은 **삭제하지 않는다** — `/hrd` 등 타 페이지가 사용 중일 수 있으므로 전역 검색 후 판단

---

## 6. 프리필 — 4종 포맷 + 누적 제거 ★

### 6-1. 결함의 정확한 원인 (F7)

```ts
// lib/kium/inquiryBridge.ts:25-27 — strip을 전달하지 않는다
window.dispatchEvent(
  new CustomEvent(KIUM_PREFILL_EVENT, { detail: { text: kiumPrefillText(titleMarketing) } })
);
```

```ts
// HomeInquiry.tsx:266 — 기본값으로 폴백
for (const re of d.strip ?? [/^\[관심 과정: [^\]]*\]\s*/]) message = message.replace(re, '');
```

→ 과정안내 상세 CTA를 누르면 **공개교육 블록이 제거되지 않은 채** `[관심 과정: …]`이 앞에 붙는다. 첨부 화면의 헤드 중복이 정확히 이 경로다.

### 6-2. `PREFILL_STRIP` 단일 출처 — `inquiryBridge.ts`

> **`openBridge`가 `inquiryBridge`를 import하는 단방향 구조이므로(F10), 공용 상수는 반드시 `inquiryBridge` 쪽에 둔다.** 반대로 두면 순환 import가 된다.

```ts
// lib/kium/inquiryBridge.ts — 추가

/** 공개교육 프리필 블록 — 헤드 + 연속된 '· ' 줄 전체 */
export const KIUM_OPEN_PREFILL_RE = /^\[공개교육 상담 신청\]\n(?:· [^\n]*\n)+/;
/** 관심 과정 블록 — 헤드 + (선택) '· 문의 내용:' 줄 */
export const KIUM_PREFILL_RE = /^\[관심 과정: [^\]]*\][^\n]*\n?(?:· 문의 내용:[^\n]*\n?)?/;

/**
 * 프리필 헤드 블록 제거 목록 — 모든 진입점이 이 배열 하나를 쓴다.
 * 사용자가 직접 입력한 문장은 보존한다(제거 대상은 헤드 블록만).
 */
export const PREFILL_STRIP: RegExp[] = [KIUM_OPEN_PREFILL_RE, KIUM_PREFILL_RE];
```

### 6-3. 포맷 4종 (확정 · 문구 고정)

**① 일반 과정** — 전체 보기 상세 패널 CTA

```
[관심 과정: On-Powering 리텐션 과정]
· 문의 내용: 
```

**② 공개교육 · 회차 지정** — 회차 카드 「이 일정으로 상담」

```
[공개교육 상담 신청]
· 과정명: On-Powering 리텐션 과정
· 희망 회차: 12.9(수) ~ 10(목) · 2일 (모집중)
· 문의 내용: 
```

**③ 공개교육 · 과정만** — 공개교육 보기 상세 CTA · 마감 회차 대안

```
[공개교육 상담 신청]
· 과정명: On-Powering 리텐션 과정
· 희망 회차: 협의 희망
· 문의 내용: 
```

마감 회차에서 넘어온 경우 3번째 줄만 교체한다.

```
· 희망 회차: 12.9(수) ~ 10(목) · 2일 마감 → 다음 회차 문의
```

**④ 공개교육 · 유형만** — 「과정 개설 상담」·「개설 알림 상담」

```
[공개교육 상담 신청]
· 문의 유형: 공개교육 상담 희망
· 문의 내용: 
```

> ②③의 `· 희망 회차`에 **`· 2일`을 포함**한다. `formatSessionRange()`가 이미 그 형식을 반환하므로(F9) **코드 변경 없이 충족**된다. 화면 카드가 이미 "2일 과정"을 노출하므로 **화면과 폼이 같은 말을 한다.**

### 6-4. `inquiryBridge.ts` 개정

```ts
// 수정 전
export function kiumPrefillText(titleMarketing: string) {
  return `[관심 과정: ${titleMarketing}] `;
}

export function requestKiumInquiry(titleMarketing: string) {
  window.dispatchEvent(
    new CustomEvent(KIUM_PREFILL_EVENT, { detail: { text: kiumPrefillText(titleMarketing) } })
  );
  const el = document.getElementById('inq');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
```

```ts
// 수정 후 — 2줄 포맷 + strip 전달
export function kiumPrefillText(titleMarketing: string) {
  return `[관심 과정: ${titleMarketing}]\n· 문의 내용: \n`;
}

export function requestKiumInquiry(titleMarketing: string) {
  window.dispatchEvent(
    new CustomEvent(KIUM_PREFILL_EVENT, {
      // ★ strip 전달 — 이것이 없으면 폼이 기본값으로 폴백해 공개교육 블록이 남는다
      detail: { text: kiumPrefillText(titleMarketing), strip: PREFILL_STRIP },
    })
  );
  const el = document.getElementById('inq');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
```

### 6-5. `openBridge.ts` 개정

```ts
// 수정 전 — 지역 정규식 2개 선언
export const KIUM_OPEN_PREFILL_RE = /^\[공개교육 상담 신청\]\n(?:· [^\n]*\n)+/;
export const KIUM_COURSE_PREFILL_RE = /^\[관심 과정: [^\]]*\]\s*/;

// 수정 후 — 삭제하고 공용 목록을 재수출
import { KIUM_PREFILL_EVENT, PREFILL_STRIP } from './inquiryBridge';
export { PREFILL_STRIP };
```

```ts
// dispatchPrefill — strip을 공용 목록으로 교체
detail: { text, strip: PREFILL_STRIP },
```

**문의 유형 문구**

```ts
// 수정 전
export const OPEN_REQUEST_TYPE = {
  noCourse: '공개교육 미개설 과정 상담 희망',
  seasonOff: '공개교육 개설 일정 안내 요청',
} as const;

// 수정 후 — 내부 용어('미개설') 제거
export const OPEN_REQUEST_TYPE = {
  noCourse: '공개교육 상담 희망',
  seasonOff: '공개교육 개설 일정 안내 요청',   // 시즌 오프는 맥락이 달라 유지(부록 B D3)
} as const;
```

**경로 B 본문 — ③ 포맷으로 통일**

```ts
// 수정 전
export function prefillTextB(course: KiumCourse, closedFrom?: KiumSession): string {
  const line = closedFrom
    ? `· 마감 회차: ${formatSessionRange(closedFrom)} → 다음 회차 문의\n`
    : `· 일정: 협의 희망\n`;
  return `${HEAD}\n` + `· 과정명: ${course.titleMarketing}\n` + line + `· 문의 내용: \n`;
}

// 수정 후 — ②와 줄 구조를 통일한다(수신 담당자가 같은 위치에서 같은 항목을 읽는다)
export function prefillTextB(course: KiumCourse, closedFrom?: KiumSession): string {
  const line = closedFrom
    ? `· 희망 회차: ${formatSessionRange(closedFrom)} 마감 → 다음 회차 문의\n`
    : `· 희망 회차: 협의 희망\n`;
  return `${HEAD}\n` + `· 과정명: ${course.titleMarketing}\n` + line + `· 문의 내용: \n`;
}
```

`prefillTextA` · `prefillTextC` · `prefillTextBRequest`는 **무변경**(이미 확정 포맷과 일치).

### 6-6. `HomeInquiry.tsx` — 기본값만 교체 (266행)

```tsx
// 수정 전
for (const re of d.strip ?? [/^\[관심 과정: [^\]]*\]\s*/]) message = message.replace(re, '');

// 수정 후 — 기본값도 공용 목록을 쓴다(전달 누락 시에도 안전)
for (const re of d.strip ?? PREFILL_STRIP) message = message.replace(re, '');
```

**이 파일에서 허용되는 변경은 위 1줄과 상단 import 1줄뿐이다.** 다른 어떤 줄도 건드리지 않는다.

### 6-7. 불변 원칙

| 항목 | 상태 |
| --- | --- |
| 신규 수집 필드 | **0건** |
| 개인정보·마케팅 동의 자동 체크 | **어떤 경우에도 금지** |
| 관심 영역 `정부 지원` + `인재키움` 프리셀렉트 | 기존 동작 유지 |
| `문의 내용` 편집 가능 | 유지 |

---

## 7. 썸네일 — BT-10

### 7-1. 정책 (선행 조건)

**인물 얼굴 식별 컷 배제**(부록 B D1 확정 시). Unsplash License는 **저작권만** 다루며 **초상권·퍼블리시티권은 별개**이고, 광고성 맥락에서는 게시자가 책임진다.

### 7-2. 자산

| 항목 | 값 |
| --- | --- |
| 경로 | `public/images/kium/kium-01.jpg` ~ `kium-19.jpg` |
| 비율·해상도 | 4:3 · 1200×900 (코드 크롭 없음 — 제작 단계에서 크롭) |
| 포맷 | WebP 권장(JPG 대비 30~40% 감소, `<img src>` 단일 경로라 코드 수정 0) |
| 용량 | 장당 300KB 이내 · 총합 3.5MB 이하 |
| 승계 | `public/images/kium/open/` 9장 → 상위로 이동·개명(규격·정책 충족, 재선정 불필요) |
| 신규 | **10장** — kium-01·02·05·06·07·08·15·16·17·18 |
| 폐기 | `*.sample.jpg` 3장 |
| 기록 | `public/images/kium/README.md` — 19건 출처·촬영자·용량 표 (`open/README.md` 형식 승계) |
| 금지 | 텍스트 합성 · 워터마크 · 로고 · 비율 왜곡 · 원격 핫링크 · `plus.unsplash.com` |

### 7-3. 코드 일원화

```ts
// lib/kium/data.ts — 19건 전건 설정
"thumbSrc": "/images/kium/kium-01.jpg",
```

| 파일 | 조치 |
| --- | --- |
| `lib/kium/openThumbs.ts` | **삭제** |
| `KiumCoursesTab.tsx` | `KIUM_OPEN_THUMBS` import 및 `thumbs={…}` 전달 **제거** |
| `KiumCourseGrid.tsx` | `thumbs` prop 및 사용처 **제거** |

> **1과정 = 1장.** 같은 과정이 보기에 따라 다른 사진이면 사용자는 "다른 과정인가?"로 읽는다.

### 7-4. 접근성 — `KiumThumb.tsx`

```tsx
// 수정 전
<Img className="kium-thumb-img" src={thumbSrc} alt={title} />

// 수정 후 — 썸네일은 장식. 과정명은 본문 .kium-card-title이 담당한다(중복 낭독 제거)
<Img className="kium-thumb-img" src={thumbSrc} />
```

### 7-5. 성능

| 항목 | 조치 |
| --- | --- |
| lazy | `Img`에 이미 구현(F8) — **추가 작업 없음** |
| eager | 첫 행 **3장만** `eager` 전달 |
| CLS | `.kium-thumb`의 `aspect-ratio:4/3` **유지 확인만** |
| 폴백 | `onError` → `display:none` → 그라디언트 배경 노출. **텍스트 모드는 폴백 표면으로 영구 존치** |

---

## 8. CSS — `styles/kium-open.css` 추가

**기존 토큰과 `color-mix` 파생만 사용한다. 신규 색·라운드·그림자 값 금지.**

```css
/* ── 기간 칩 단위 (BT-04) — 숫자는 등폭, 단위는 일반 서체 ── */
.kium-chip .cnt i{font-style:normal;font-variant-numeric:normal;margin-left:1px;font-weight:700}

/* ── 전체 보기 승격 1줄 (BT-06) — .kium-modehead-s와 같은 무게 ── */
.kium-allhead{margin-top:16px;font-size:13.5px;font-weight:700;color:var(--muted)}

/* ── 필터 결과 문구 시각 노출 (BT-11) ── */
.kium-livenote{margin-top:10px;font-size:13px;color:var(--muted);
  font-variant-numeric:tabular-nums}

/* ── 공개교육 전용 pill 구분 (BT-08) — 위탁 공통 정보와 시각 분리 ── */
.kium-pill[data-open]{background:color-mix(in srgb,var(--p3) 7%,#fff);
  border-color:color-mix(in srgb,var(--p3) 22%,#fff)}
.kium-pill[data-open] b{color:var(--p3)}
```

---

## 9. 반응형 · 접근성

| 항목 | 명세 |
| --- | --- |
| 검증 뷰포트 | **320 / 375 / 768 / 1024 / 1440** |
| 기간 칩 | 4개뿐이라 `6회차` 3글자를 더해도 375px 2줄 이내. **가로 스크롤 금지** |
| 카드 메타 행 | 정부지원 환급 칩 제거로 모바일 1열에서 **2줄 → 1줄** |
| 인트로 문구 | 375px 2줄 예상. `.kium-openlead`의 `word-break:keep-all` 유지 |
| 썸네일 | 모바일 1열에서 화면 폭 전체. lazy 필수(기구현) |
| 터치 타깃 | 전 인터랙티브 요소 **≥44×44px** |
| 칩 접근명 | 기간 칩 전건 `aria-label` (§3-2) |
| 결과 고지 | `.kium-livenote`의 `aria-live="polite"` 유지 |
| 상태 배지 | 색 + 텍스트 병기. `aria-hidden` 금지 |
| 모션 | `prefers-reduced-motion: reduce` 대응 유지. `transition: all` 금지 |

---

## 10. 금지사항

1. **데이터·문안 창작 금지** — 회차 20건·교육비 9건·FAQ 문안은 원문 그대로
2. **`status`를 날짜로 추론 금지** — 데이터 명시값 + `effectiveStatus()` 승격만
3. **금액 임의 산출·환산·할인 표기 금지**. O열(총 훈련비) 사용 금지
4. **신규 폼 수집 필드·동의 문구 변경 금지**. `HomeInquiry` 변경은 §6-6의 2줄뿐
5. **동의 자동 체크 절대 금지**
6. **신규 색·라운드·그림자 토큰 발명 금지** — `:root` 토큰과 `color-mix` 파생만
7. **`inquiryBridge` → `openBridge` 역방향 import 금지**(순환)
8. 위탁 10과정에 `공개교육`·`교육비` pill 노출 금지
9. `transition: all` · `dangerouslySetInnerHTML` 금지
10. 표기는 **`공개교육` 붙여쓰기**로 통일 — `공개 교육` 금지
11. **검토 전 commit·push 금지**

---

## 11. QA · 회귀

### 11-1. 데이터

- [ ] `KIUM_SESSION_TOTAL === 20`
- [ ] `countByMonth` → 10월 **6** · 11월 **6** · 12월 **8**
- [ ] `relead-r3` 화면 출력 **`12.17(목) ~ 18(금)`** · 2일
- [ ] `status` 전건이 회신값 또는 `recruiting` — **`closed` 하드코딩 0건**
- [ ] 미래 회차가 「마감」으로 노출되는 건 **0건**
- [ ] 교육비 9건이 `pricing.ts`와 일치 · 임의 산출 0건

### 11-2. 카운트·라벨

- [ ] 세그먼트 `전체 과정 19` / `공개교육 9`
- [ ] 기간 칩 `전체 20회차` / `10월 6회차` / `11월 6회차` / `12월 8회차`
- [ ] 분야·상태 칩 **무변경**
- [ ] 섹션 헤더가 필터를 반영(3케이스)
- [ ] 상세 패널 `공개교육` pill — 공개교육 9과정만, 위탁 10과정 미렌더
- [ ] `공개 교육`(띄어쓰기) 전역 검색 **0건**

### 11-3. 프리필 — 경로 회귀 ★

| # | 시나리오 | 기대 |
| --- | --- | --- |
| P1 | 전체 보기 상세 CTA | ① 포맷 2줄 |
| P2 | 공개교육 회차 CTA | ② 포맷 4줄, `· 2일` 포함 |
| P3 | 공개교육 상세 CTA | ③ 포맷, `· 희망 회차: 협의 희망` |
| P4 | 마감 회차 CTA | ③ 포맷, `마감 → 다음 회차 문의` |
| P5 | 「과정 개설 상담」 | ④ 포맷, `공개교육 상담 희망` |
| **P6** | **②(공개교육) → ①(전체 보기 상세) 연속 클릭** | **헤드 1개만 남는다** (F7 결함 수정 확인) |
| **P7** | **①→②→④ 3연속 클릭** | **헤드 1개만 남는다** |
| P8 | 프리필 후 사용자 입력 → 다른 회차 클릭 | 사용자 입력 **보존**, 헤드만 교체 |
| P9 | 동의 체크박스 | **자동 체크 0건** |

### 11-4. 공유 폼 회귀 (고위험)

| # | 시나리오 | 기대 |
| --- | --- | --- |
| R1 | `/` 홈에서 상담 폼 제출 | 기존과 동일. 프리필 미동작 |
| R2 | `?interest=hrd`로 홈 진입 | 쿼리 프리셀렉트 정상 |
| R3 | 폼 제출 성공 → 자동 복귀 | `trainees`·`message` 초기화 |
| R4 | 접수 메일 형식 | **변형 없음** |

### 11-5. 반응형·접근성·빌드

- [ ] 320/375/768/1024/1440 전 구간 **가로 스크롤 0**
- [ ] 기간 칩 375px 2줄 이내
- [ ] 카드 메타 행 모바일 1줄
- [ ] 썸네일 19장 전건 로드 · lazy 동작 · CLS 0
- [ ] `alt` 중복 낭독 없음
- [ ] `npm run build` **경고 0건**
- [ ] 금지어 전역 검색: `공개 교육` · `미개설` · O열 총액 계열 숫자 → **0건**

---

## 12. Claude Code 빌드 프롬프트

```
KEESS_pedu 저장소에서 /kium 과정안내 탭을 고도화합니다.

[단일 기준 문서]
ref/kium/spec/KEESS_kium_BType고도화_기술명세서_v1.0_260904.md
전략 근거: ref/kium/strategy/KEESS_kium_과정카탈로그_UIUX고도화전략_v2.1_260904.md
→ 기술명세서를 처음부터 끝까지 읽으세요. 문서에 없는 것은 만들지 않습니다.
   저장소의 CLAUDE.md / AGENTS.md 규칙도 함께 준수합니다.

[작업 0] 현행 확인 — 건너뛰지 마세요
  명세 §0 "실사로 확정된 사실" F1~F10을 실제 코드와 대조하세요.
  하나라도 불일치하면 구현을 멈추고 불일치 내역을 보고하세요.

[작업 1] 데이터 (§2) — P0
  relead-r3 복원(12/17~18) → 20회차.
  status 20건: 회신값이 없으면 전건 'recruiting'으로 초기화하고 seatsLeft를 전건 삭제.
  ※ 미래 회차가 '마감'으로 보이는 현재 상태가 이 작업의 이유입니다. 시드값을 남기지 마세요.
  유틸 함수는 한 줄도 바꾸지 마세요.

[작업 2] 카운트·라벨 (§3) — P0
  세그먼트 '공개교육 9'(과정 수) / 기간 칩 'N회차' + aria-label /
  섹션 헤더 필터 연동 / 전체 보기 승격 1줄 / 인트로 카피 / 결과 문구 시각 노출.
  분야·모집 상태 칩은 무변경입니다.

[작업 3] 프리필 (§6) — P0 · 가장 주의
  PREFILL_STRIP은 반드시 inquiryBridge.ts에 둡니다(openBridge에 두면 순환 import).
  requestKiumInquiry에 strip 전달 — 이것이 누락돼 헤드가 중복되던 결함입니다.
  포맷 4종을 §6-3 그대로 적용. formatSessionRange()가 이미 '· 2일'을 포함하므로
  회차 표기는 그 함수를 그대로 씁니다.
  HomeInquiry.tsx는 §6-6의 1줄 + import 1줄만 수정. 그 외 어떤 줄도 건드리지 마세요.

[작업 4] 라벨·카드 (§4·§5) — P0~P1
  KiumCoursePanel: '교육 일정' → '공개교육', 공개교육 pill 2종에 data-open.
  KiumCourseCard: .kium-badge.gov 렌더 제거(공개교육 칩은 존치).
  .kium-badge.gov CSS는 타 페이지 사용 여부를 전역 검색 후 판단하세요.

[작업 5] 스타일 (§8)
  styles/kium-open.css에 4개 규칙 추가. 기존 토큰과 color-mix 파생만.

[작업 6] 썸네일 (§7) — P1 · 이미지 자산이 준비된 경우에만
  이미지가 아직 없으면 이 작업은 건너뛰고 보고에 명시하세요.
  준비돼 있으면: data.ts thumbSrc 19건 → openThumbs.ts 삭제 →
  KiumCoursesTab/KiumCourseGrid의 thumbs prop 제거 → KiumThumb alt prop 제거.

[작업 7] 검증 후 표로 보고
  (1) 생성·수정·삭제 파일 목록
  (2) 회차 20건 — 명세 부록 A 대조 결과 (월별 6/6/8 확인)
  (3) status에 'closed' 하드코딩 0건 확인
  (4) §11-3 프리필 경로 P1~P9 결과 — 특히 P6·P7(헤드 중복)
  (5) §11-4 공유 폼 회귀 R1~R4 결과
  (6) §11-2 카운트·라벨 결과
  (7) 금지어 전역 검색: '공개 교육' / '미개설' / O열 총액 숫자
  (8) 명세와 달리 판단한 부분과 사유
  npm run build 경고 0건 확인.
  스크린샷 도구가 있으면 320/375/768/1024/1440 5뷰포트 캡처.

[금지] 명세 §10 전 항목. 특히:
  - status를 날짜로 추론하지 말 것
  - 동의 자동 체크 금지
  - HomeInquiry는 지정된 2줄 외 무변경
  - 신규 색 토큰 발명 금지
  - '공개 교육'(띄어쓰기) 사용 금지
  - commit·push 금지 (검토 후 별도 지시)
```

---

## 부록 A — 회차 20건 (검증 완료본)

| # | id | courseId | 과정 | displayMonth | start | end | 화면 표기 | 일수 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | agent-r1 | kium-09 | 업무효율화: Agent | 10 | 2026-10-12 | 2026-10-13 | 10.12(월) ~ 13(화) | 2 |
| 2 | agent-r2 | kium-09 | 〃 | 11 | 2026-11-02 | 2026-11-03 | 11.2(월) ~ 3(화) | 2 |
| 3 | agent-r3 | kium-09 | 〃 | 12 | 2026-11-30 | 2026-12-01 | 11.30(월) ~ 12.1(화) | 2 |
| 4 | data-r1 | kium-10 | 업무효율화: Data | 10 | 2026-10-14 | 2026-10-15 | 10.14(수) ~ 15(목) | 2 |
| 5 | data-r2 | kium-10 | 〃 | 11 | 2026-11-09 | 2026-11-10 | 11.9(월) ~ 10(화) | 2 |
| 6 | data-r3 | kium-10 | 〃 | 12 | 2026-12-07 | 2026-12-08 | 12.7(월) ~ 8(화) | 2 |
| 7 | aijob-r1 | kium-11 | AI 직무전문화 | 10 | 2026-10-19 | 2026-10-20 | 10.19(월) ~ 20(화) | 2 |
| 8 | aijob-r2 | kium-11 | 〃 | 11 | 2026-11-16 | 2026-11-17 | 11.16(월) ~ 17(화) | 2 |
| 9 | aijob-r3 | kium-11 | 〃 | 12 | 2026-12-14 | 2026-12-15 | 12.14(월) ~ 15(화) | 2 |
| 10 | nego-r1 | kium-12 | 전략적 비즈니스 협상 스킬 | 10 | 2026-10-27 | 2026-10-27 | 10.27(화) | 1 |
| 11 | speech-r1 | kium-13 | 스피치&프레젠테이션 클리닉 | 11 | 2026-11-12 | 2026-11-13 | 11.12(목) ~ 13(금) | 2 |
| 12 | report-r1 | kium-14 | 인정받는 직장인의 구두보고 스킬 | 12 | 2026-12-11 | 2026-12-11 | 12.11(금) | 1 |
| 13 | cs-r1 | kium-19 | CS 종합 솔루션 | 10 | 2026-10-26 | 2026-10-26 | 10.26(월) | 1 |
| 14 | cs-r2 | kium-19 | 〃 | 11 | 2026-11-17 | 2026-11-17 | 11.17(화) | 1 |
| 15 | cs-r3 | kium-19 | 〃 | 12 | 2026-12-21 | 2026-12-21 | 12.21(월) | 1 |
| 16 | relead-r1 | kium-04 | 진단 기반 팀장 리더십 Re-Lead | 10 | 2026-10-21 | 2026-10-22 | 10.21(수) ~ 22(목) | 2 |
| 17 | relead-r2 | kium-04 | 〃 | 11 | 2026-11-18 | 2026-11-19 | 11.18(수) ~ 19(목) | 2 |
| 18 | **relead-r3** | kium-04 | 〃 | 12 | **2026-12-17** | **2026-12-18** | **12.17(목) ~ 18(금)** | 2 |
| 19 | onpow-r1 | kium-03 | On-Powering 리텐션 | 12 | 2026-12-09 | 2026-12-10 | 12.9(수) ~ 10(목) | 2 |
| 20 | onpow-r2 | kium-03 | 〃 | 12 | 2026-12-16 | 2026-12-17 | 12.16(수) ~ 17(목) | 2 |

**집계**: 총 20회차 · 9과정 · 10월 6 / 11월 6 / 12월 8 · 2일 15건 / 1일 5건

---

## 부록 B — 확인 필요 항목

| # | 항목 | 우선 | 미확정 시 |
| --- | --- | --- | --- |
| **D1** | 썸네일 인물 정책 — 얼굴 배제 / 인물 허용 | 최우선 | §7 작업 보류 |
| **D2** | **모집 상태 20건 실제값** | 최우선 | 전건 `recruiting` 초기화 |
| D3 | 시즌 오프 문의 유형 문구 유지 여부 | 중 | `공개교육 개설 일정 안내 요청` 유지 |
| D4 | Re-Lead 12월 `12/17~18` 최종 확인 | 중 | 데이터 반영하고 진행 |
| D5 | Google Sheets 원본과 부록 A 일치 여부 | 중 | 부록 A 기준 진행 |
| D6 | `공개교육` 붙여쓰기 승인 | 중 | 붙여쓰기 진행 |
| D7 | 교육비 VAT 표기 | 중 | `1인 기준`만 |
| D8 | `INQ.trainees` `1~9명` 옵션 승인 | 중 | 프리필에서 인원 제외 |
| D9 | 「캘린더에 추가」(ICS) 도입 | 낮음 | 보류 |

---

**문서 끝**
