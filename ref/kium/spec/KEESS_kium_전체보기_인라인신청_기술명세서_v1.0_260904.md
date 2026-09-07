# KEESS `/kium` 전체과정 보기 인라인 신청 경로 기술명세서 v1.0

- **작성일**: 2026-09-04
- **대상 저장소**: `KEESS_pedu` · 기준 커밋 `79ec2af`
- **대상 화면**: 과정안내 탭 — **전체과정 보기의 상세 패널**(`KiumCoursePanel` `variant="default"`)
- **상위 문서**: PRD `ref/kium/prd/KEESS_G2-01-02_인재키움프리미엄_PRD_upgrade-02_260904.md` (**F17~F20**)
- **전략 근거**: `ref/kium/strategy/KEESS_kium_전체보기_인라인신청_UIUX전략_v1.0_260904.md`
- **문서 지위**: 본 건 구현의 **단일 기준**. 선행 명세(`BType고도화 v2.1` · `일정영역고도화 v1.1`) 위의 **증분**이며 기존 확정 사항은 변경하지 않는다.

---

## 0. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F0-1 | `KiumCoursePanel`이 `variant: 'default' \| 'open'`을 받고 `isOpenVar`로 분기 | `components/kium/KiumCoursePanel.tsx` |
| F0-2 | `SessionStrip`이 **`isOpenVar &&`** 조건으로 헤더 바로 아래에만 렌더 | 동일 |
| F0-3 | `공개교육` pill이 `getSessionsByDate().filter(...)` + `fmtRange`로 **날짜를 나열** (상한 `SCHEDULE_MAX = 3`) | 동일 |
| F0-4 | 하단 CTA가 **`isOpenVar` 기준**으로 분기 — open은 `onConsultCourse`(경로 B), default는 `requestKiumInquiry`(경로 ①) | 동일 |
| F0-5 | `onConsultSession` · `onConsultCourse`가 **두 보기 모두에** 전달됨 (`KiumCoursesTab` → `KiumCourseGrid` → `KiumCoursePanel`, `isOpenMode` 조건 없음) | `KiumCoursesTab.tsx` · `KiumCourseGrid.tsx` |
| F0-6 | `SessionStrip`의 제목이 `<h5 className="kium-detail-h">교육일정</h5>` **하드코딩** | `components/kium/SessionCard.tsx` |
| F0-7 | `SessionStrip`이 `sortByWeight(sessions, now)`로 정렬 | 동일 |
| F0-8 | `.kium-strip{grid-auto-flow:column;grid-auto-columns:minmax(210px,1fr)}` · `.is-single{minmax(210px,320px)}` · 모바일 `82%` + `overflow-x:auto` | `styles/kium-open.css` |
| F0-9 | `.kium-strip-wrap{margin-top:16px}` · `.kium-detail-cta{margin-top:24px}` · `.kium-detail-h{margin-top:24px}` | `styles/kium-open.css` · `styles/kium.css` |
| F0-10 | 검증 `D3`의 측정 대상은 `.kium-ustrip` · `.kium-modehead` · `.kium-next` · `#kium-cf-month` · `#kium-cf-st` — **`.kium-strip` 미포함** | `scripts/verify-btype.mjs` |
| F0-11 | 검증 `P1`이 **`kium-03`(공개교육 과정)** 상세 CTA로 프리필 **경로 ①**을 단언 | `scripts/verify-btype2.mjs` |
| F0-12 | 상세 패널 스트립 정렬이 weight 우선이라 **kium-11 · kium-10에서 날짜가 뒤섞임** (kium-11: `11.16 / 12.14 / 10.19`) | 실측 |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**한다.

---

## 1. 변경 항목

| ID | 기능 | 우선도 | 파일 |
| --- | --- | --- | --- |
| **F20** | 상세 패널 회차 정렬 — 날짜 오름차순 (`closed` 뒤로) | **P0 (결함)** | `SessionCard.tsx` |
| **F17** | 전체 보기 상세 패널에 **인라인 회차 블록** 신설 | **P0** | `KiumCoursePanel.tsx` · `SessionCard.tsx` |
| **F18** | `공개교육` pill 요약화 — 날짜 나열 → `N개 회차` | **P0** | `KiumCoursePanel.tsx` |
| **F19** | 하단 CTA 분기 기준을 `variant` → **과정 성격**으로 | P1 | `KiumCoursePanel.tsx` |

**적용 순서는 위 표 그대로.** F20을 먼저 고치지 않으면 F17이 뒤섞인 날짜를 그대로 노출한다.

> **CSS 변경 0건.** 기존 `.kium-strip` · `.kium-pill[data-open]` · `.kium-cta-ses` 규칙을 그대로 재사용한다.
> 신규 클래스·신규 색 토큰 **0건**.

---

## 2. F20 — 상세 패널 회차 정렬 (먼저 적용)

### 2-1. 결함

`SessionStrip`이 `sortByWeight`(weight ASC → start ASC)를 쓴다.
weight는 `confirmed 1 · closing 1 · recruiting 2 · closed 4`이므로 **상태가 날짜를 이긴다.**

| 과정 | 현행 렌더 순서 | 기대 |
| --- | --- | --- |
| `kium-11` AI 직무전문화 | **11.16 · 12.14 · 10.19** | 10.19 · 11.16 · 12.14 |
| `kium-10` 업무효율화: Data | **10.14 · 12.07 · 11.09** | 10.14 · 11.09 · 12.07 |

한 과정의 회차 1~3장을 보는 사용자의 과업은 **"이 과정 언제 하지?"** 다. 시간 축이 축이다.
`10.19`가 `12.14` 뒤에 오는 것은 판독을 방해한다.

**F17이 이 스트립을 전체 보기에도 노출시키므로, 고치지 않으면 결함이 두 배로 드러난다.**

### 2-2. 확정 — BT-26과 동일 규칙

1차 `closed ? 1 : 0` ASC → 2차 `start` ASC.

```tsx
export default function SessionStrip({ course, sessions, now, onConsult, heading = '교육일정' }: {
  …
}) {
  /**
   * [F20] 한 과정의 회차를 보는 과업은 "이 과정 언제 하지?"다 — 시간 축이 축이다.
   *   sortByWeight()는 weight ASC → start ASC라 상태가 날짜를 이겨,
   *   상태 시드 적용 후 kium-11이 11.16 / 12.14 / 10.19 순으로 렌더됐다.
   *   「전체 일정」 리스트에 적용한 BT-26과 같은 규칙을 쓴다.
   *   closed만 뒤로 보낸다 — 지난 회차가 미래 회차 사이에 끼면 판독을 방해한다.
   *   ※ sortByWeight()는 다른 호출부가 참조하므로 함수 자체는 무변경.
   */
  const list = [...sessions].sort((a, b) => {
    const ca = effectiveStatus(a, now) === 'closed' ? 1 : 0;
    const cb = effectiveStatus(b, now) === 'closed' ? 1 : 0;
    return ca - cb || a.start.localeCompare(b.start);
  });
```

- `effectiveStatus` import 확인(이미 `SessionCard.tsx`에서 사용 중).
- `sortByWeight` import가 이 파일에서 미사용이 되면 **제거**(빌드 경고 0 유지).
- `lib/kium/sessions.ts`의 `sortByWeight` **함수 무변경**.
- **`variant="open"` 상세 패널에도 함께 적용된다** — 같은 결함이 그쪽에도 있었으므로 의도된 개선이다.

---

## 3. F17 — 인라인 회차 블록

### 3-1. `SessionStrip` — `heading` 옵션 prop

제목이 하드코딩(`교육일정`)이라 전체 보기에서 그대로 쓰면 **이 과정 전체의 일정으로 읽힌다.**
실제로는 공개교육 회차만이고 이 과정들은 기업 위탁으로도 운영된다(`schedule: '연중상시'`).
BT-08에서 pill 라벨을 `교육 일정` → `공개교육`으로 바꾼 것과 같은 근거다.

```tsx
  /**
   * [F17] 블록 제목. 미지정 시 '교육일정' — variant="open" 렌더가 한 글자도 바뀌지 않는다.
   *   전체 보기에서는 '공개교육 일정'을 넘긴다:
   *   이 과정들은 기업 위탁으로도 운영되므로(schedule: '연중상시')
   *   '교육일정'이라 쓰면 과정 전체의 일정으로 읽힌다.
   */
  heading = '교육일정',
```

타입: `heading?: string;`

렌더:

```tsx
      <h5 className="kium-detail-h">{heading}</h5>
```

### 3-2. `KiumCoursePanel` — 블록 배치

**⑥ 교육구성 표 블록과 ⑦ CTA 사이**에 삽입한다.

```tsx
      {/* ⑥-2 공개교육 일정 — 전체 보기 전용 인라인 신청 경로 (F17)
          위치 근거: 이 패널의 주제는 "이 과정이 무엇인가"다. 회차는 결정을 돕는 부가 정보다.
            최상단(open 변형의 위치)에 두면 과정 소개보다 일정이 먼저 나와 축이 뒤집힌다.
            사용자의 인지 순서 `이 과정 알겠다 → 그럼 언제 하지? → 신청`에 맞춰 결정 직전에 둔다.
          open 변형은 이미 헤더 아래(①)에 같은 블록이 있으므로 여기서는 렌더하지 않는다.
          위탁 10과정은 isOpenCourse()가 false라 블록 자체가 생성되지 않는다('-' 표기 금지). */}
      {!isOpenVar && isOpenCourse(course.id) && (
        <SessionStrip
          course={course}
          sessions={getSessionsOfCourse(course.id)}
          now={now}
          onConsult={(s) => onConsultSession?.(s)}
          heading="공개교육 일정"
        />
      )}
```

- 기존 `{isOpenVar && <SessionStrip … />}`(①) 블록은 **무변경**.
- 회차 CTA는 `SessionCard` → `SessionAction` → `onConsult` → `onConsultSession` → `consultSession()` 경로로
  **프리필 경로 A**(회차 지정)에 도달한다. **신규 브리지·신규 핸들러 0건.**
- 보기 전환은 일어나지 않는다 — `onConsultSession`은 `changeMode`를 호출하지 않는다.

### 3-3. 반응형

**신규 규칙 0건.** `.kium-strip`의 기존 규칙을 그대로 승계한다(F0-8).

| 뷰포트 | 동작 |
| --- | --- |
| PC / TB | 회차 수만큼 가로 배열 (`minmax(210px,1fr)`) |
| 회차 1건 | `.is-single` — 최대 320px |
| MO | 가로 스크롤 + peek + snap (`82%`) |
| MO · 1건 | 전폭 · 스크롤 없음 |
| reduced-motion | `scroll-snap-type:none` |

공개교육 9과정의 회차 수는 **최대 3 · 최소 1**이라 PC 3열에 여유가 있다.

---

## 4. F18 — `공개교육` pill 요약화

### 4-1. 현행

```tsx
<span className="kium-pill" data-open>
  <b>공개교육</b>
  {(() => {
    const list = getSessionsByDate().filter((s) => s.courseId === course.id);
    const head = list.slice(0, SCHEDULE_MAX).map(fmtRange).join(', ');
    return list.length > SCHEDULE_MAX ? `${head} 외 ${list.length - SCHEDULE_MAX}건` : head;
  })()}
</span>
```

F17 블록이 들어오면 **같은 날짜가 한 패널에 두 번** 나온다.

### 4-2. 확정

```tsx
{/* [F18] pill은 '이 과정은 공개교육으로도 됩니다'라는 사실을 메타 영역에서 알린다.
    날짜라는 값은 아래 「공개교육 일정」 블록이 진다 —
    같은 패널에 같은 날짜가 두 번 나오면 두 번째는 정보가 아니라 잡음이다.
    '교육비'는 회차 카드에 없는 정보라 유지한다. */}
<span className="kium-pill" data-open>
  <b>공개교육</b>
  <span className="num">{getSessionsOfCourse(course.id).length}개 회차</span>
</span>
```

- `<b>` 라벨은 **`공개교육` 그대로** — 검증 `Q11`이 라벨을 단언한다.
- `.num`은 `정원` pill과 같은 표기 패턴(`{n}명`)을 따른다.
- `getSessionsByDate` · `fmtRange` · `SCHEDULE_MAX`가 이 파일에서 미사용이 되면 **전부 제거**.
- `variant="open"`의 pill 블록(`교육비`만)은 **무변경**.

---

## 5. F19 — CTA 분기 기준 전환

### 5-1. 근거

현행은 `isOpenVar`(보고 있는 화면)로 분기해 **같은 과정인데 화면에 따라 신청 경로가 달라진다.**
CTA가 가리키는 것은 보기가 아니라 **그 과정의 신청 방식**이다.

### 5-2. 확정

```tsx
      {/* ⑦ CTA — 분기 기준은 '보기'가 아니라 '과정의 신청 방식'이다(F19).
          공개교육 9과정은 어느 보기에서 열어도 경로 B로 간다("회차 중 맞는 게 없으면 일정 협의").
          블록의 회차 CTA(경로 A)와 중복이 아니다 — 의도가 갈린다.
          onConsultCourse가 없는 호출부에서는 기존 경로 ①로 폴백해 동작을 잃지 않는다. */}
      <div className="kium-detail-cta">
        {isOpenCourse(course.id) && onConsultCourse ? (
          <button
            type="button"
            className="kium-cta-ses"
            onClick={() => onConsultCourse(course)}
            aria-label={`${course.titleMarketing} 이 과정으로 상담하기`}
          >
            <span>이 과정으로 상담하기</span>
            <IconArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => requestKiumInquiry(course.titleMarketing)}
          >
            {'이 과정으로 신청 문의'}
          </button>
        )}
      </div>
```

| 과정 | CTA | 프리필 |
| --- | --- | --- |
| 공개교육 9과정 | `이 과정으로 상담하기` | 경로 B (`· 희망 회차: 협의 희망`) |
| 위탁 10과정 | `이 과정으로 신청 문의` | 경로 ① (`[관심 과정: …]`) |

`requestKiumInquiry` import는 폴백 경로가 남으므로 **유지**한다.

---

## 6. 금지

- `lib/kium/sessions.ts` 유틸 함수 무변경 (`sortByWeight` · `effectiveStatus` · `isOpenCourse` …)
- `SessionCard` · `SessionAction`의 **카드 렌더·스타일 재정의 금지** (A/B 변인 통제)
- **CSS 파일 수정 금지** — 본 건은 CSS 변경 0건이다. 필요하다고 판단되면 중단하고 보고할 것
- 신규 클래스 · 신규 색 토큰 · 신규 컴포넌트 발명 금지
- `variant="open"` 상세 패널의 **블록 위치 · 제목 · pill 구성 변경 금지** (F20 정렬 개선만 함께 적용)
- 회차 CTA에서 **보기 전환(`changeMode`) 호출 금지** — 그 자리에서 끝내는 것이 본 건의 목적이다
- 위탁 10과정에 `'-'` · `미개설` 등 **대체 표기 금지** — 블록·pill 자체를 렌더하지 않는다
- 데이터 플래그 신설 금지 — 개설 판별은 `isOpenCourse()` 단일 기준
- 회차 데이터(`sessions.ts`) · 프리필 브리지 · `HomeInquiry` 무변경
- 전체 보기 **상시 노출 영역**(그리드 · 카드 · 필터 행 · 모드 헤더)에 회차 요소 신설 금지
- **카드 `공개교육` 뱃지(`.kium-openflag` · `onOpenBadge`) 무변경** — 보조 경로다. 제거·이동·문구 변경 금지
- **상세 패널에 「공개교육 보기로 이동」 트리거를 병설하지 말 것** — 같은 자리에서 회차를 볼 수 있는데
  이동 링크를 함께 두면 선택지만 늘고 결정이 늦어진다(전략 §8-3)

---

## 7. 검증

### 7-1. 기능

| # | 항목 | 기대 |
| --- | --- | --- |
| G1 | 전체 보기 · `kium-14` 상세 | `공개교육 일정` 블록 1개 · 회차 카드 1장 |
| G2 | 블록 위치 | 교육구성 표 **아래**, `.kium-detail-cta` **위** (DOM 순서 실측) |
| G3 | 전체 보기 · `kium-01`(위탁) | 블록 **0개** · `공개교육` pill **0개** |
| G4 | 회차 CTA 클릭 | 세그먼트가 **`전체과정` 유지** · 상담 폼 이동 · 프리필에 `· 희망 회차:` 포함 |
| G5 | G4 프리필 전문 | `[공개교육 상담 신청]\n· 과정명: …\n· 희망 회차: … · N일 (상태)\n· 문의 내용: \n` |
| G6 | `공개교육` pill | `공개교육` + `N개 회차` · **날짜 문자열 0건** |
| G7 | 하단 CTA — 공개교육 과정 | `이 과정으로 상담하기` · 경로 B(`· 희망 회차: 협의 희망`) |
| G8 | 하단 CTA — 위탁 과정 | `이 과정으로 신청 문의` · 경로 ① |
| G9 | 두 보기 CTA 일치 | `kium-14`를 전체 보기 / 공개교육 보기에서 열었을 때 하단 CTA 문구·프리필 동일 |
| G10 | `variant="open"` 무변경 | 블록이 헤더 바로 아래(①) 위치 · 제목 `교육일정` · pill은 `교육비`만 |
| G11 | 카드 `공개교육` 뱃지 | 전체 보기에서 **9건 유지** · 클릭 시 보기 전환 + 카드 위치 복원 동작 무변경 |
| G12 | 상세 패널 이동 트리거 | **0건** — 「공개교육 보기로 이동」류 요소 미신설 |

### 7-2. 정렬 (F20)

| # | 항목 | 기대 |
| --- | --- | --- |
| O1 | `kium-11` 상세 패널 회차 순서 | **10.19 · 11.16 · 12.14** (현행 `11.16 · 12.14 · 10.19`) |
| O2 | `kium-10` 상세 패널 회차 순서 | **10.14 · 11.09 · 12.07** (현행 `10.14 · 12.07 · 11.09`) |
| O3 | 9과정 전건 | 각 과정의 회차가 날짜 오름차순 · `closed`만 뒤 |
| O4 | 두 변형 일치 | 전체 보기와 공개교육 보기의 같은 과정 회차 순서가 동일 |

### 7-3. 반응형·접근성

| # | 항목 | 기대 |
| --- | --- | --- |
| R1 | 320/375/768/1024/1440 × 회차 **1·2·3건** | 가로 넘침 0px |
| R2 | MO 3건 | 가로 스크롤 + peek 동작 · snap |
| R3 | MO 1건 | 전폭 · `overflow-x:visible` |
| R4 | 터치 타깃 | 44×44px 미만 0건 |
| R5 | 제목 계층 | 블록 제목이 `<h5 class="kium-detail-h">` — 패널 내 다른 섹션 제목과 동일 레벨 |
| R6 | reduced-motion | scroll-snap 무효화 |

### 7-4. 회귀

| # | 항목 | 조치 |
| --- | --- | --- |
| C1 | `D3` 전체 보기 회차 요소 DOM 미생성 | **무변경 통과해야 한다** — 측정 대상에 `.kium-strip` 미포함(F0-10) |
| C2 | **`P1` 프리필 경로 ①** | ★ **대상 교체 필수** — 현재 `kium-03`(공개교육 과정)을 쓰는데 F19 적용 후 경로 B가 된다. **위탁 과정(예: `kium-01`)으로 교체** |
| C3 | `Q11` pill 라벨 | 라벨은 `공개교육`·`교육비` 그대로라 통과. 값 단언이 있으면 갱신 |
| C4 | `Q12` 위탁 과정 pill 미렌더 | 무변경 통과 |
| C5 | `P6`·`P7` 헤드 중복 | 헤드 개수 단언이라 통과. 상세값이 바뀌면 로그만 갱신 |
| C6 | 기타 | 전건 전수 조사 후 **단언을 삭제하지 말고 교체**하며 갱신 목록 보고 |

- 타 페이지 5경로(`/`, `/ax-ai`, `/leadership`, `/hrd`, `/content`) 회귀 0
- `npm run build` 경고 0 · `tsc --noEmit` 0 · 신규 npm 의존성 0

---

## 8. 완료 보고 양식

1. §0 F0-1~F0-12 대조 결과
2. 변경 파일 목록 — **CSS 파일이 목록에 없어야 한다**
3. §7-1 기능 G1~G10 — **G5는 프리필 전문을 그대로** 인용
4. §7-2 정렬 O1~O4 — **9과정 전건의 회차 날짜 배열을 그대로** 표로
5. §7-3 반응형·접근성 R1~R6 — 회차 1·2·3건 × 5뷰포트 실측
6. §7-4 회귀 — 갱신한 단언 목록(항목명 · 이전 기대값 → 새 기대값). **C2는 필수**
7. `npm run build` · `tsc` 결과
8. 스크린샷 — 전체 보기 상세(회차 1건/3건) · 위탁 과정 상세 · 공개교육 보기 상세(무변경 확인) · 프리필 폼 · 320/375/1440
9. 명세와 달리 판단한 부분과 사유
