# `/kium` 드로어 상담 진입 기술명세서 v1.0

- 대상 저장소: `KEESS_pedu` · 기준 커밋 `bb17c15`
- 기능 ID: **MI-06 ~ MI-08** (MI-05에서 이어짐)
- 상위 문서: `ref/kium/strategy/KEESS_kium_드로어_상담진입_UX전략_v1.0_260908.md`
- 대상 파일
  - `lib/kium/openBridge.ts` (잠금 해제 게이트)
  - `components/kium/KiumCoursePanel.tsx` (`onBeforeConsult` 옵션 prop)
  - `components/kium/KiumCourseGrid.tsx` (시트 경로에만 prop 전달)
- 성격: **순서 결함 교정**. UI·레이아웃·문구 변경 없음

---

## 1. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F1 | `useModal`이 열림 시 `body.style.position='fixed'` · `top='-{y}px'` · `overflow='hidden'` | `lib/useModal.ts:35~42` |
| F2 | `useModal` cleanup이 `Object.assign(body.style, prev)` 후 `window.scrollTo(0, y)`로 **스크롤 위치를 되돌림** | `lib/useModal.ts:84~91` |
| F3 | cleanup의 포커스 복귀는 `focus({preventScroll:true})` | `lib/useModal.ts:92~94` |
| F4 | 포커스 트랩이 `Tab` 키만 처리. 프로그램적 `.focus()`는 막지 못함 | `lib/useModal.ts:58~73` |
| F5 | 시트는 `useModal(sheet && !!openCourse, closeSheet)` | `KiumCourseGrid.tsx:216` |
| F6 | `closeSheet = useCallback(() => setOpenId(null), [])` | `KiumCourseGrid.tsx:215` |
| F7 | 시트는 `createPortal`로 렌더. `openCourse` 유무로 `.open` 토글 | `KiumCourseGrid.tsx:333~346` |
| F8 | `consultSession`·`consultCourse`·`consultMonth`·`consultOpenRequest` **4개 진입점 전부** 마지막에 `scrollToInquiry()` 호출. **시트를 닫는 코드 없음** | `openBridge.ts:196~240` |
| F9 | `scrollToInquiry()`가 `scrollIntoView` 후 480ms 뒤 `f-company.focus({preventScroll:true})` + `visualViewport` 보정 | `openBridge.ts` |
| F10 | `KiumCoursePanel`이 인라인 패널(`KiumCourseGrid.tsx:316`)과 시트(`:364`) **양쪽에 렌더** | 실측 |
| F11 | 시트 안 상담 CTA는 3종: 회차 행 `onConsultSession` · 「이 과정으로 상담하기」 `onConsultCourse` · 「상담 신청」 `requestKiumInquiry`(MI-05) | `KiumCoursePanel.tsx:215~240` |
| F12 | `.kium-sheet` 닫힘 전환은 `transform .3s`. 잠금 해제는 React 커밋 시점이라 **애니메이션과 무관하게 즉시** 일어남 | `kium.css:553~557` |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**합니다.

---

## 2. MI-06: 시트 안 상담 CTA가 시트를 먼저 닫는다

### 2-1. `KiumCoursePanel`에 옵션 prop 신설

```tsx
onBeforeConsult?: () => void;
```

기존 옵션 prop 관습(`showCourse`·`onCourseClick`·`onCourseFocus`·`heading`)과 같습니다. **미지정 시 현행 동작 그대로**입니다.

### 2-2. 상담 CTA 3종 전부에서 맨 앞에 호출

| CTA | 변경 |
| --- | --- |
| 회차 행 「상담하기」 | `onConsultSession` 호출 **직전**에 `onBeforeConsult?.()` |
| 「이 과정으로 상담하기」 | `onConsultCourse(course)` 호출 **직전**에 `onBeforeConsult?.()` |
| 「상담 신청」 (MI-05 경로) | `requestKiumInquiry(...)` 호출 **직전**에 `onBeforeConsult?.()` |

예시

```tsx
onClick={() => {
  onBeforeConsult?.();
  onConsultCourse(course);
}}
```

### 2-3. `KiumCourseGrid`에서 시트 경로에만 전달

```tsx
{/* 시트 렌더(:364 인근) */}
<KiumCoursePanel
  ...
  onBeforeConsult={closeSheet}
/>
```

**인라인 패널(`:316` 인근)에는 전달하지 않습니다.** 데스크톱 경로 무변경이 조건입니다.

### 금지
- `openBridge`에 시트 닫기 로직·이벤트를 넣지 말 것
- 인라인 패널에 `onBeforeConsult` 전달 금지
- `closeSheet` 시그니처 변경 금지
- CTA의 문구·클래스·`aria-label` 변경 금지

---

## 3. MI-07: 잠금 해제 게이트

### 3-1. 왜 필요한가

`closeSheet()`는 React 상태 갱신입니다. 그 직후 동기 실행되는 `scrollToInquiry()` 시점에는 **아직 `body`가 잠겨 있습니다.** 게이트가 없으면

- `scrollIntoView`가 무효 (문서 스크롤 높이가 뷰포트로 붕괴)
- 이어서 React 커밋의 `window.scrollTo(0, y)`가 위치를 되돌림 (F2)
- 배경 입력에 포커스가 걸림 (F4)

즉 **닫기만 추가하면 증상이 바뀔 뿐 해결되지 않습니다.**

### 3-2. 유틸 신설 (`openBridge.ts` 내부)

```ts
/**
 * body 스크롤 잠금이 풀린 뒤 실행한다.
 *
 * 시트·모달이 열려 있는 동안 body 는 position:fixed 다(useModal MO-03).
 * 이 상태에서는 문서 스크롤 높이가 뷰포트로 붕괴해 scrollIntoView·scrollBy 가
 * 모두 무효이고, 배경 요소에 포커스가 걸리면 키보드만 올라온다.
 *
 * 시점을 추측하지 않고 body.style.position 을 직접 관측한다.
 * 잠기지 않은 경로(데스크톱 인라인 패널)에서는 첫 프레임에 그대로 실행된다.
 */
function whenUnlocked(fn: () => void, maxFrames = 24) {
  const locked = () => document.body.style.position === 'fixed';
  if (!locked()) { fn(); return; }
  let left = maxFrames;
  const step = () => {
    if (!locked()) { fn(); return; }
    if (--left <= 0) return;   // ★ 강행하지 않는다. §3-4 참조
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

### 3-3. 적용

`scrollToInquiry()`의 **본문 전체**를 감쌉니다. 앵커 조회부터 포커스·`visualViewport` 보정까지 전부 게이트 안입니다.

```ts
export function scrollToInquiry() {
  whenUnlocked(() => {
    const el = document.getElementById('inq-form') ?? document.getElementById('inq');
    if (!el) return;
    ... 현행 본문 그대로 ...
  });
}
```

### 3-4. ★ 타임아웃 시 강행하지 않는다

`maxFrames`(약 24프레임 · 400ms)를 넘도록 잠금이 풀리지 않으면 **아무것도 하지 않습니다.**

잠긴 상태에서 강행하면 배경 포커스가 걸려 **이번 버그를 그대로 재현**합니다. 아무 일도 일어나지 않는 편이 낫습니다. 프리필과 요약 배너는 이미 반영되어 있으므로 사용자가 시트를 닫으면 정상 상태를 만납니다.

### 3-5. 주의

| # | 주의 |
| --- | --- |
| 1 | `requestAnimationFrame`만 사용. `setInterval` 폴링 금지 |
| 2 | 게이트를 `scrollToInquiry` **안**에 둡니다. 4개 진입점(F8)을 각각 고치지 않습니다 |
| 3 | 기존 480ms 지연·`preventScroll:true`·`visualViewport` 보정 로직을 **바꾸지 않습니다.** 게이트로 감싸기만 합니다 |
| 4 | `whenUnlocked`를 export 하지 마십시오. 파일 내부 유틸입니다 |
| 5 | Nav 드로어가 잠근 경우에도 같은 게이트가 동작합니다. 의도된 동작입니다 |

---

## 4. MI-08: 모달 열림 중 배경 포커스 금지

MI-07이 이를 보장하지만, **요구사항으로 명시하고 검증**합니다.

| 규칙 |
| --- |
| `aria-modal="true"` 다이얼로그가 열린 동안 **다이얼로그 밖 요소에 프로그램적 포커스를 주지 않는다** |
| 포커스 트랩은 `Tab` 키만 막는다(F4). 프로그램적 `.focus()`는 **호출부의 책임**이다 |

`useModal`은 변경하지 않습니다. 5개 페이지가 공유하는 훅이고, 호출부에서 해결 가능합니다.

---

## 5. 전역 금지

- `lib/useModal.ts` 변경 금지
- `openBridge`의 4개 진입점(`consultSession`·`consultCourse`·`consultMonth`·`consultOpenRequest`) 시그니처·본문 변경 금지 (`scrollToInquiry` 내부만 수정)
- MO-03 스크롤 잠금 되돌리기 금지
- MI-01~MI-05 결과 되돌리기 금지 (앵커 `#inq-form` · 모바일 순서 · 배너 sticky · `visualViewport` 보정 · selection 발행)
- `HomeInquiry` 변경 금지
- 데스크톱 인라인 패널 동작 변경 금지
- UI·문구·클래스·레이아웃 변경 금지
- 신규 의존성 · 신규 브레이크포인트 금지
- `lib/kium/sessions.ts` 무변경

---

## 6. 검증

### 6-1. 시나리오 (실기기 또는 모바일 에뮬레이션 · 390px 기준)

| # | 절차 | 기대 |
| --- | --- | --- |
| S1 | 과정 카드 탭 → 시트 열림 → 회차 행 「상담하기」 | 시트가 **닫히고** 폼으로 이동 |
| S2 | 시트 열림 → 「이 과정으로 상담하기」 | 시트가 **닫히고** 폼으로 이동 |
| S3 | 공개교육 아닌 과정 → 시트 → 「상담 신청」 | 시트가 **닫히고** 폼으로 이동 · 배너에 `<과정명> · 일정 협의 희망` |
| S4 | S1~S3 직후 화면 | 입력 필드 + 요약 배너가 보임. **스크롤이 되돌아가지 않음** |
| S5 | S1~S3 직후 키보드 | `회사·기관명` 입력이 가려지지 않음 |
| S6 | 시트를 **깊이 스크롤한 뒤** CTA 탭 | 동일하게 동작 (스크롤 위치와 무관) |
| S7 | 시트 열고 CTA 없이 닫기 | 기존 위치로 복원 (MO-03 동작 유지) |
| S8 | 마감 회차에서 CTA | 경로 B 전환 + 가드 문구 + 시트 닫힘 |
| S9 | 데스크톱 인라인 패널 CTA | **무변경** (패널이 닫히지 않고 폼으로 이동) |
| S10 | 시트 밖 CTA (카드 그리드·리스트·스트립) | **무변경** |
| S11 | 월 그룹 「이 시기 교육 상담」(경로 C) | 시트와 무관하므로 무변경 |
| S12 | `prefers-reduced-motion` | 즉시 이동 |

### 6-2. 계측

| # | 항목 | 기대 |
| --- | --- | --- |
| V1 | CTA 탭 직후 `document.body.style.position` | 400ms 이내 `'fixed'` **해제** |
| V2 | 스크롤 정지 후 `window.scrollY` | 시트 열기 직전 값이 **아님** (폼 위치) |
| V3 | 포커스 시점의 `document.activeElement` | `#f-company` · 시트 DOM **밖이 아님을 확인**(시트는 이미 닫힘) |
| V4 | 시트가 열린 동안 `document.activeElement` | **항상 시트 내부** |
| V5 | `#f-company`의 `bottom` (키보드 등장 후) | `visualViewport` 가시 영역 **안** |
| V6 | `visualViewport` resize 리스너 | 보정 후 잔존 **0건** |
| V7 | `requestAnimationFrame` 루프 | 실행 종료 후 잔존 **0건** |

### 6-3. 회귀

| # | 항목 |
| --- | --- |
| R1 | MO-01~MO-08 전건 유지 |
| R2 | MI-01~MI-05 전건 유지 |
| R3 | 홈(`/`) · 타 페이지 5경로 회귀 0 |
| R4 | `Modal.tsx` · `ReportModal.tsx` 열기·스크롤·닫기 정상 (잠금 공유) |
| R5 | 부정훈련 신고 3탭 모달 정상 (CLAUDE.md 필수 기능) |
| R6 | `verify-btype.mjs` · `verify-btype2.mjs` 전건 통과 |
| R7 | `PREFILL_STRIP` 누적 방지 유지 |
| R8 | `npm run build` 경고 0 · `tsc --noEmit` 0 |

### 6-4. 문서

| # | 조치 |
| --- | --- |
| N1 | README 작업 이력에 **MI-06~MI-08** 신설. §2의 실패 연쇄 6단계를 그대로 기록 |
| N2 | `openBridge.ts` `whenUnlocked` 주석에 **왜 강행하지 않는지**(§3-4) 명기 |
| N3 | `KiumCoursePanel`의 `onBeforeConsult` prop에 한 줄 주석: 시트 경로 전용이며 미지정 시 현행 동작 |
| N4 | `lib/useModal.ts`의 포커스 트랩이 `Tab`만 막는다는 사실(F4)을 README 주의사항으로 등록. 향후 모달 안에서 배경 요소에 포커스하는 코드를 막기 위함 |

---

## 7. 완료 보고 양식

1. §1 F1~F12 대조 결과
2. 변경 파일 목록 (**`lib/useModal.ts`가 목록에 없어야 함**)
3. `openBridge.ts` diff 원문 (게이트 적용 범위 확인용)
4. §6-1 S1~S12 결과
5. §6-2 V1~V7 계측값 **원문 그대로**
6. §6-3 R1~R8
7. §6-4 문서 갱신 결과
8. 화면 녹화 또는 연속 스크린샷 (필수)
   - 시트 열림 → CTA 탭 → 시트 닫힘 → 폼 도달 → 키보드 등장까지 **한 흐름**
   - 데스크톱 인라인 패널 CTA (회귀 0 확인)
9. 명세와 달리 판단한 부분과 사유
