# `/kium` 모바일 상담 진입 기술명세서 v1.0

- 대상 저장소: `KEESS_pedu` · 기준 커밋 `43e22de`
- 기능 ID: **MI-01 ~ MI-05**
- 상위 문서: `ref/kium/strategy/KEESS_kium_모바일_상담진입_UX전략_v1.0_260908.md`
- 대상 파일
  - `lib/kium/openBridge.ts` (앵커·포커스 보정)
  - `lib/kium/inquiryBridge.ts` (앵커)
  - `components/sections/home/HomeInquiry.tsx` (**id 부여 1건만**)
  - `components/kium/KiumCoursePanel.tsx` (selection 발행)
  - `styles/kium-open.css` · `styles/kium.css` (`/kium` 스코프 CSS)
- 성격: **진입 경로 교정**. 폼의 필드·검증·동의 구조 무변경

---

## 1. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F1 | `scrollToInquiry()`가 `#inq`로 스크롤 후 480ms 뒤 `f-company`에 `focus({preventScroll:true})` | `openBridge.ts:108~119` |
| F2 | `requestKiumInquiry()`도 `#inq`로 스크롤 (포커스 없음) | `inquiryBridge.ts:45~48` |
| F3 | `#inq` 첫 자식은 `.inq-side`(소개), 폼은 그 다음 | `HomeInquiry.tsx:410~428` |
| F4 | `.inq-grid`가 880px 이하에서 1열 | `home.css:209` |
| F5 | `.inq-side` = `min-height:340px;padding:40px` | `home.css:210` |
| F6 | `<KiumApplySummary />`가 `<HomeInquiry />` **앞**에 렌더 | `app/kium/page.tsx:143` |
| F7 | `.kium-apply-sum`은 sticky 아님 | `kium-open.css:278` |
| F8 | `scroll-margin` 선언 **전 CSS 0건** | 전수 |
| F9 | `.nav` = `position:fixed` / `.subnav` = `position:sticky;top:72px` | `components.css:23·559` |
| F10 | 폼 컨테이너는 `<div className="form r">`, **id 없음** | `HomeInquiry.tsx:428` |
| F11 | `KiumCoursePanel.tsx:229`가 `requestKiumInquiry(course.titleMarketing)` 호출. **호출부가 `course` 객체를 보유** | `KiumCoursePanel.tsx` |
| F12 | `scrollToInquiry` 호출부 2곳 (`KiumCoursesTab.tsx:256` · `KiumOpenTab.tsx:151`) | 전수 |
| F13 | `openBridge` → `inquiryBridge` 단방향 import (역방향 금지) | `inquiryBridge.ts:25` 주석 |
| F14 | `.kium-cta-band{padding-top:64px}` · `.kium-cta-band .inq{padding-top:0}` | `kium.css:603~604` |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**합니다.

---

## 2. MI-01: 스크롤 앵커 교체

### 2-1. 앵커 id 부여 (공유 폼 변경은 이것 하나뿐)

`HomeInquiry.tsx:428`

```tsx
<div className="form r" id="inq-form">
```

**`id` 속성 1개만 추가합니다.** 클래스·구조·자식 요소는 건드리지 않습니다. 타 페이지에서는 이 id를 아무도 쓰지 않으므로 무해합니다.

### 2-2. 앵커 대상 교체

`openBridge.ts` `scrollToInquiry()` · `inquiryBridge.ts` `requestKiumInquiry()`

```ts
const el = document.getElementById('inq-form') ?? document.getElementById('inq');
```

**폴백을 반드시 둡니다.** 폼이 결과 화면(`status !== 'idle'`)일 때 `#inq-form`이 렌더되지 않기 때문입니다(`HomeInquiry.tsx:430` 조건부 렌더).

### 2-3. `scroll-margin-top`

`styles/kium.css` `/kium` 스코프

```css
.kium-cta-band #inq-form{scroll-margin-top:calc(var(--nav-h,56px) + 64px)}
```

- `--nav-h`는 `components.css:154`에서 모바일에 정의되며, 미정의 구간을 위해 `56px` 폴백을 둡니다
- `64px`는 subnav(52px) + 여백(12px)입니다
- ★ 실제 겹침을 **육안으로 확인**하고 값을 확정하십시오. 명세값은 시작점입니다

### 금지
- `#inq` id 제거 금지 (타 페이지·해시 링크가 사용)
- `HomeInquiry`에 다른 변경 금지
- 앵커를 `.kium-apply-sum`으로 잡지 말 것 (조건부 렌더라 불안정)

---

## 3. MI-02: 모바일 순서 재배치

### 대상
`styles/kium.css` (`/kium` 스코프 전용)

```css
/* 상담 진입 시 첫 화면에 입력 필드가 오도록 소개 블록을 폼 아래로 보낸다.
   삭제가 아니라 순서 변경이며, /kium 스코프에 한정해 홈(/)의 #inq는 무변경이다. */
@media(max-width:880px){
  .kium-cta-band .inq-grid>.form{order:1}
  .kium-cta-band .inq-grid>.inq-side{order:2}
}
```

### 근거
`.inq-grid`는 grid이므로 `order`가 그대로 동작합니다. DOM 순서는 바뀌지 않아 **탭 순서와 스크린리더 읽기 순서가 유지**됩니다.

### ★ 브레이크포인트
`880px`는 `.inq-grid`가 1열로 바뀌는 값(F4)과 **반드시 같아야** 합니다. 다른 값을 쓰면 2열 구간에서 순서가 뒤바뀝니다. 신규 브레이크포인트가 아니라 기존 값에 맞추는 것입니다.

### 금지
- `.inq-side`를 `display:none` 처리 금지
- DOM 순서 변경 금지 (`order`로만)
- 스코프를 `.kium-cta-band` 밖으로 넓히지 말 것

---

## 4. MI-03: 요약 배너 sticky

### 4-1. sticky 고정

`styles/kium-open.css`

```css
@media(max-width:880px){
  .kium-cta-band .kium-apply-sum{position:sticky;top:calc(var(--nav-h,56px) + 52px);z-index:5;
    margin:0 0 12px;padding:10px 14px;font-size:13.5px;
    box-shadow:0 2px 10px rgba(20,20,26,.06)}
  .kium-cta-band .kium-apply-line{flex-wrap:nowrap;min-width:0}
  .kium-cta-band .kium-apply-line b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
```

### 4-2. 요구 조건

| # | 조건 |
| --- | --- |
| 1 | 모바일에서 배너 높이 **44px 이하** (키보드 공존 시 가시 영역 손실 최소화) |
| 2 | 과정명이 길면 말줄임. 회차 정보는 **줄이지 않는다** |
| 3 | `[변경]` 링크 유지 · 터치 타깃 44px 유지(`min-height:44px` 기존값) |
| 4 | 배경 불투명 유지 (뒤 콘텐츠가 비치면 안 됨) |
| 5 | 마감 가드 문구(`.kium-apply-guard`)가 있을 때는 2줄 허용 |

### ★ 겹침 검증 (필수)
`top` 값이 `.subnav`와 겹치면 배너가 subnav 뒤로 들어갑니다. `.nav`·`.subnav`·배너 3단이 **세로로 쌓여 보이는지** 실기기에서 확인하십시오. 겹치면 `top` 값만 조정하고, sticky 자체를 포기하지 마십시오.

### 금지
- `position:fixed` 사용 금지 (섹션 밖에서도 떠다니게 됨)
- 데스크톱에 sticky 적용 금지
- `z-index`를 `.nav`(70)·`.subnav`(40) 이상으로 올리지 말 것

---

## 5. MI-04: 키보드 가시성 보정

### 대상
`lib/kium/openBridge.ts` `scrollToInquiry()`

### 5-1. 유틸 신설 (같은 파일 내부)

```ts
/**
 * 키보드가 올라온 뒤 포커스 대상이 가리는지 확인하고 보정한다.
 *
 * 브라우저 기본 보정은 두 가지를 모른다.
 *   ① focus({preventScroll:true}) 가 걸려 있으면 아예 동작하지 않는다
 *   ② sticky 요소(nav · subnav · 요약 배너)가 덮는 영역을 계산하지 않는다
 * visualViewport 는 키보드가 덮고 남은 실제 가시 영역을 알려 준다.
 */
function ensureVisibleWithKeyboard(el: HTMLElement, topInset: number) {
  const vv = window.visualViewport;
  if (!vv) return;                       // 미지원 브라우저는 기본 동작에 맡긴다
  const pad = 12;
  const r = el.getBoundingClientRect();
  const top = vv.offsetTop + topInset + pad;
  const bottom = vv.offsetTop + vv.height - pad;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  if (r.bottom > bottom) window.scrollBy({ top: r.bottom - bottom, behavior });
  else if (r.top < top) window.scrollBy({ top: r.top - top, behavior });
}
```

### 5-2. 호출 시점

포커스 직후가 아니라 **키보드가 실제로 올라온 뒤**입니다.

```ts
const field = document.getElementById('f-company');
field?.focus({ preventScroll: true });

const vv = window.visualViewport;
if (vv) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    vv.removeEventListener('resize', run);
    window.setTimeout(() => ensureVisibleWithKeyboard(field!, topInset()), 60);
  };
  vv.addEventListener('resize', run, { once: true });
  window.setTimeout(run, 700);   // 키보드가 뜨지 않는 환경(데스크톱·외장 키보드) 폴백
}
```

### 5-3. `topInset()`

sticky로 덮이는 상단 높이입니다. **하드코딩하지 말고 실측**하십시오.

```ts
function topInset(): number {
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  const h = (el: HTMLElement | null) =>
    el && getComputedStyle(el).position !== 'static' ? el.getBoundingClientRect().height : 0;
  return h(q('.nav')) + h(q('.subnav')) + h(q('.kium-apply-sum'));
}
```

### ★ 주의
| # | 주의 |
| --- | --- |
| 1 | `resize` 리스너는 **반드시 해제**하십시오. 남으면 이후 모든 키보드 개폐에 스크롤이 끼어듭니다 |
| 2 | `done` 플래그로 **1회만** 실행합니다. `resize`와 타임아웃이 겹쳐 두 번 도는 것을 막습니다 |
| 3 | `visualViewport` 미지원이면 아무것도 하지 않습니다. 잘못된 보정이 무보정보다 나쁩니다 |
| 4 | 480ms 기존 지연은 유지합니다. 스무스 스크롤이 끝나기 전에 포커스가 걸리면 위치가 어긋납니다 |
| 5 | 데스크톱에서는 `resize`가 발생하지 않고 700ms 폴백이 돌지만, 필드가 이미 보이므로 `scrollBy` 값이 0입니다. 무해합니다 |

### 금지
- `focus({preventScroll:false})`로 바꾸지 말 것 (스무스 스크롤과 충돌해 화면이 두 번 튐)
- `window.scrollTo` 절대값 사용 금지 (`scrollBy` 상대값만)
- 폴링(`setInterval`) 사용 금지

---

## 6. MI-05: 과정 패널 CTA에도 배너 표시

### 대상
`components/kium/KiumCoursePanel.tsx:229`

### 현행
```tsx
onClick={() => requestKiumInquiry(course.titleMarketing)}
```
프리필만 발생하고 `KIUM_OPEN_SELECT_EVENT`가 없어 배너가 뜨지 않습니다.

### 변경
호출부에서 selection을 **함께** 발행합니다.

```tsx
onClick={() => {
  requestKiumInquiry(course.titleMarketing);
  window.dispatchEvent(
    new CustomEvent(KIUM_OPEN_SELECT_EVENT, {
      detail: { route: 'B', courseId: course.id } satisfies OpenSelection,
    })
  );
}}
```

### ★ 왜 브리지가 아니라 호출부인가
`requestKiumInquiry`는 `inquiryBridge`에 있고, `KIUM_OPEN_SELECT_EVENT`는 `openBridge`에 있습니다. `inquiryBridge`가 `openBridge`를 import하면 **순환 import**가 됩니다(F13). 호출부인 `KiumCoursePanel`은 이미 클라이언트 컴포넌트이며 양쪽을 모두 import할 수 있습니다.

### 검증
`KiumApplySummary`의 경로 B 분기(`sel.route === 'B'`, `fromClosedSessionId` 없음)가 그대로 처리해 `<과정명> · 일정 협의 희망`을 출력합니다. 배너 컴포넌트 변경은 **불필요**합니다.

### 금지
- `inquiryBridge`에서 `openBridge`를 import 금지
- `KIUM_OPEN_SELECT_EVENT` 상수 이동 금지
- `KiumApplySummary` 변경 금지

---

## 7. 전역 금지

- `HomeInquiry`의 필드·검증·동의 구조 변경 금지 (**id 1개 추가가 전부**)
- 홈(`/`) 및 타 페이지의 `#inq` 렌더 변경 금지
- 데스크톱 렌더·동작 변경 금지
- 신규 브레이크포인트 추가 금지 (`880px`은 기존값에 맞추는 것)
- MO-01~MO-08 결과 되돌리기 금지 (입력 16px · 터치 44px · hover 가드 · dvh · overscroll)
- 자동 포커스 제거 금지
- 신규 의존성 추가 금지
- `lib/kium/sessions.ts` 무변경

---

## 8. 검증

### 8-1. 시나리오 (실기기 또는 모바일 에뮬레이션 · 320 / 390 / 430px)

| # | 절차 | 기대 |
| --- | --- | --- |
| S1 | 회차 카드 「상담하기」 탭 | 스크롤 정지 시 **입력 필드가 화면에 보인다** |
| S2 | 같은 화면 | **과정명 + 회차**가 배너에 보인다 |
| S3 | 키보드 등장 후 | **`회사·기관명` 입력이 가려지지 않는다** |
| S4 | 폼을 아래로 스크롤 | 배너가 상단에 **고정되어 남는다** |
| S5 | 배너 `[변경]` 탭 | 일정 섹션으로 복귀 |
| S6 | 과정 패널 「상담 신청」 탭 | 배너에 `<과정명> · 일정 협의 희망` |
| S7 | 마감 회차 경유 | 마감 가드 문구가 배너에 함께 표시 |
| S8 | 소개 블록 | 폼 **아래**에 그대로 존재 (삭제되지 않음) |
| S9 | 제출 완료 후 | 결과 화면 정상. 앵커 폴백(`#inq`)이 동작 |
| S10 | `prefers-reduced-motion` | 스크롤·보정이 즉시 이동으로 수행 |

### 8-2. 계측

| # | 항목 | 기대 |
| --- | --- | --- |
| V1 | 탭 직후 `#f-company`의 `getBoundingClientRect().top` | `visualViewport` 가시 영역 **안** |
| V2 | 키보드 등장 후 `#f-company`의 `bottom` | `vv.offsetTop + vv.height` **미만** |
| V3 | 배너 높이 (모바일) | **44px 이하** (가드 문구 없을 때) |
| V4 | 배너 `position` (모바일 / 데스크톱) | `sticky` / `static` |
| V5 | `.nav` · `.subnav` · 배너 | 세로로 쌓임 · **겹침 0** |
| V6 | 문서 가로 스크롤 | 320/390/430px **0건** (MO 결과 유지) |
| V7 | `visualViewport` resize 리스너 | 보정 후 **잔존 0건** |

### 8-3. 회귀

| # | 항목 |
| --- | --- |
| R1 | 홈(`/`) `#inq` 렌더·순서 **무변경** |
| R2 | 데스크톱 1280·1920px `/kium` 렌더 **무변경** (소개 좌 · 폼 우) |
| R3 | 타 페이지 5경로 회귀 0 |
| R4 | `verify-btype.mjs` · `verify-btype2.mjs` 전건 통과 |
| R5 | 프리필 누적 방지(`PREFILL_STRIP`) 동작 유지 · 경로를 바꿔 가며 눌러도 헤더 1개 |
| R6 | MO-01~MO-08 전건 유지 |
| R7 | `npm run build` 경고 0 · `tsc --noEmit` 0 |

### 8-4. 문서

| # | 조치 |
| --- | --- |
| N1 | README 작업 이력에 **MI-01~MI-05** 신설. 원인 5건과 스크린샷 근거를 명기 |
| N2 | `openBridge.ts` `scrollToInquiry` 주석 갱신: `preventScroll:true`를 유지하는 이유와 `visualViewport` 보정을 함께 두는 이유 |
| N3 | `HomeInquiry.tsx`의 `id="inq-form"`에 한 줄 주석: `/kium` 상담 진입 앵커이며 타 페이지는 사용하지 않음 |
| N4 | `scroll-margin-top` 부재(F8)를 후속 항목으로 등록. 본 건은 앵커 1개만 처리 |

---

## 9. 완료 보고 양식

1. §1 F1~F14 대조 결과
2. 변경 파일 목록 (`HomeInquiry.tsx` diff는 **id 1줄이어야 함**)
3. §8-1 S1~S10 결과
4. §8-2 V1~V7 계측값 **원문 그대로** (뷰포트 3종)
5. §8-3 R1~R7
6. `scroll-margin-top`과 배너 `top` **최종 확정값**과 그렇게 정한 근거
7. §8-4 문서 갱신 결과
8. 스크린샷 (필수)
   - 탭 직후 · 키보드 등장 상태 (제안 스크린샷과 대조 가능한 구도)
   - 폼 하단까지 스크롤한 상태 (배너 고정 확인)
   - 과정 패널 CTA 경유 배너
   - 데스크톱 1280px `/kium` 및 홈 `/` (회귀 0 확인)
9. 명세와 달리 판단한 부분과 사유
