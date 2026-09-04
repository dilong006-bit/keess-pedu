# KEESS `/kium` 일정 영역 정보 위계 고도화 기술명세서 v1.0

- **작성일**: 2026-09-04
- **대상 저장소**: `KEESS_pedu` (`github.com/dilong006-bit/keess-pedu`) · 기준 커밋 `070f384` + 회차 상태 시드
- **대상 화면**: `/kium` 과정안내 탭 — 공개교육 보기 · 일정 영역(`.kium-schedbox`)
- **전략 근거**: `ref/kium/strategy/KEESS_kium_일정영역_정보위계_UIUX전략_v1.0_260904.md`
- **문서 지위**: 본 건 구현의 **단일 기준**. `BType고도화_기술명세서_v2.1` 위에 얹는 **증분**이며, 기존 확정 사항은 변경하지 않는다.

---

## 0. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F1 | `SessionListView`가 `sortByWeight(items, now)`로 정렬 — **weight ASC → start ASC** | `components/kium/SessionListView.tsx` `groups` 선언부 |
| F2 | `KIUM_SESSION_META` weight = `confirmed 1 · closing 1 · recruiting 2 · closed 4` | `lib/kium/sessions.ts` |
| F3 | 월 그룹 헤더가 `<section aria-labelledby={hid}>` + `<h4 id={hid}>{월} <span class="cnt">{N}개 회차</span></h4>` | `SessionListView.tsx` |
| F4 | `.kium-srow-title`이 정적 `<span>` — 이벤트·hover 단서 없음 | 동일 |
| F5 | `.kium-srow-meta`에 `<i>{KIUM_PRICE_NOTE}</i>` 렌더 (`KIUM_PRICE_NOTE = '1인 기준'`) | 동일 · `lib/kium/pricing.ts` |
| F6 | `UpcomingSessionsStrip`이 `onCourseFocus`를 이미 받아 `SessionCard.onCourseClick`에 넘김 | `components/kium/UpcomingSessionsStrip.tsx` |
| F7 | 모드 헤더 보조 문구 = `1명부터 신청 가능` | `components/kium/KiumCoursesTab.tsx` `header` prop |
| F8 | `.kium-scard2-course`는 `padding:12px 0;margin:-12px 0`로 44px 히트 영역 확보 · 기본 밑줄 없음 · hover에서 밑줄 복원 | `styles/kium-open.css` |
| F9 | `.kium-srows{list-style:none;margin-top:10px;display:grid;gap:10px}` | 동일 |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**한다.

---

## 1. 변경 항목 요약

| ID | 항목 | 우선도 | 파일 |
| --- | --- | --- | --- |
| **BT-23** | 월 그룹 헤더 — 그룹 1개일 때 미렌더 | P0 | `SessionListView.tsx` · `kium-open.css` |
| **BT-24** | 리스트 과정명 — 스트립과 동일 동작 부여 | P0 | `SessionListView.tsx` · `UpcomingSessionsStrip.tsx` · `kium-open.css` |
| **BT-25** | `1인 기준` — 행 20회 → 영역 헤더 1회 | P0 | `SessionListView.tsx` · `KiumCoursesTab.tsx` |
| **BT-26** | 리스트 정렬 — `closed` 뒤로 · 나머지 날짜 오름차순 | **P0 (결함)** | `SessionListView.tsx` |

---

## 2. BT-26 — 리스트 정렬 (먼저 적용할 것)

### 2-1. 결함 내용

전건 `recruiting`이던 동안에는 weight가 같아 결과적으로 날짜순이었다.
**회차 상태 시드가 적용되는 순간 날짜가 뒤섞인다.**

| 월 | 현행 렌더 순서 (시드 적용 후) |
| --- | --- |
| 10월 | 10.12 · 10.14 · 10.21 · 10.26 · **10.19** · 10.27 |
| 11월 | 11.2 · 11.12 · 11.16 · 11.17 · **11.9** · 11.18 |
| 12월 | 11.30 · 12.7 · 12.11 · 12.14 · **12.9** · 12.16 · 12.17 · 12.21 |

「전체 **일정**」은 시간 축이 축이다. 날짜가 튀면 훑기가 성립하지 않는다.
스트립은 순수 날짜순이므로 **같은 자리 토글로 교체되는 두 뷰의 순서가 어긋난다.**

### 2-2. 확정 규칙

1차 `closed ? 1 : 0` ASC → 2차 `start` ASC.
지난 회차가 미래 회차 사이에 끼는 것도 훑기를 방해하므로 `closed`만 뒤로 보낸다.

```tsx
const groups = MONTHS.map((m) => ({
  month: m,
  /**
   * [BT-26] 「전체 일정」은 시간 축이다 — 날짜 오름차순이 1순위다.
   *   이전 sortByWeight()는 weight ASC → start ASC라 상태 시드가 들어가는 순간
   *   같은 월 안에서 날짜가 뒤섞였다(11월 11.9가 네 칸 뒤로 밀림).
   *   상태 우선 정렬은 '추천순'의 논리이고, 월 그룹으로 묶인 날짜 목록에는 맞지 않는다.
   *   스트립이 순수 날짜순이므로 이 규칙으로 두 뷰의 순서도 일치한다(BT-18 토글 교체).
   *   단 closed는 지난 회차라 미래 회차 사이에 끼면 안 되므로 각 그룹 최하단으로 보낸다.
   *   ※ sortByWeight()는 CourseListView·KiumSchedule이 참조하므로 함수 자체는 건드리지 않는다.
   */
  items: sessions
    .filter((s) => s.displayMonth === m)
    .sort((a, b) => {
      const ca = effectiveStatus(a, now) === 'closed' ? 1 : 0;
      const cb = effectiveStatus(b, now) === 'closed' ? 1 : 0;
      return ca - cb || a.start.localeCompare(b.start);
    }),
})).filter((g) => g.items.length > 0);
```

- `sortByWeight` import가 미사용이 되면 **제거**한다(빌드 경고 0 유지).
- `lib/kium/sessions.ts`의 `sortByWeight` **함수 자체는 무변경**이다.

---

## 3. BT-23 — 월 그룹 헤더 조건부 미렌더

### 3-1. 판정 기준

**필터 값이 아니라 렌더된 그룹 수로 판정한다.** 데이터가 바뀌어도 규칙이 성립한다.

| 그룹 수 | 헤더 | 근거 |
| --- | --- | --- |
| 2개 이상 | **렌더** | 스크롤 중 "지금 몇 월"을 답하는 sticky 구분자. 필수 |
| 1개 | **미렌더** | 구분할 대상이 없고, 건수는 모드 헤더가 이미 말한다 |

### 3-2. 구현

```tsx
// [BT-23] 그룹이 하나뿐이면 월 헤더는 역할이 없다 —
//   구분할 대상이 없고 건수는 모드 헤더('공개교육 일정 · 11월 6개 회차')가 이미 말한다.
//   필터 값이 아니라 '렌더된 그룹 수'로 판정해 데이터가 바뀌어도 규칙이 성립하게 한다.
const showGroupHead = groups.length > 1;
```

`<section>` 렌더부를 아래로 교체한다. **헤더가 없을 때 `aria-labelledby`가 깨지므로 `aria-label`로 대체**한다.

```tsx
<section
  className="kium-mgroup"
  key={g.month}
  {...(showGroupHead
    ? { 'aria-labelledby': hid }
    : { 'aria-label': `${g.month}월 회차 목록` })}
>
  {showGroupHead && (
    <div className="kium-mgroup-head">
      <h4 className="kium-mgroup-t" id={hid}>
        {g.month}월 <span className="cnt">{g.items.length}개 회차</span>
      </h4>
      {showMonthCta && onConsultMonth && (
        <button
          type="button"
          className="kium-cta-quiet"
          onClick={() => onConsultMonth(g.month)}
          aria-label={`${g.month}월 개강 과정 상담 문의`}
        >
          <span>이 시기 교육 상담</span>
          <IconArrowRight size={16} />
        </button>
      )}
    </div>
  )}
  <ul className="kium-srows"> … </ul>
</section>
```

> ⚠️ `showMonthCta`(경로 C) 블록은 헤더 안에 그대로 둔다. 삭제하지 않는다.
> 단일 월 + `showMonthCta=true` 조합에서는 월 CTA도 함께 사라지는데, B안은 경로 C 미탑재라 영향이 없다.
> 숨김 보존된 `KiumSchedule`에서만 발생하며 그쪽은 렌더 경로가 없다.

### 3-3. 여백 (`styles/kium-open.css`)

헤더가 빠진 만큼 상단 여백을 흡수한다. **새 클래스를 만들지 않고 `:only-child`로 판정**한다 — TSX의 `groups.length > 1`과 정확히 같은 조건이다.

```css
/* [BT-23] 그룹이 하나면 월 헤더가 렌더되지 않는다 — 헤더 몫 여백을 걷는다 */
.kium-mgroup:only-child .kium-srows{margin-top:0}
```

---

## 4. BT-24 — 리스트 과정명 인터랙티브

### 4-1. `SessionListView.tsx` — 옵션 prop 추가

```tsx
  /**
   * [BT-24] 과정명 클릭 시 동작. 없으면 정적 <span>으로 렌더된다.
   *   옵션으로 둬서 숨김 보존된 KiumSchedule의 A type 렌더가 한 픽셀도 바뀌지 않게 한다.
   *   SessionCard의 onCourseClick과 같은 패턴이다.
   */
  onCourseFocus,
```

타입:

```tsx
  onCourseFocus?: (courseId: string) => void;
```

과정명 렌더부:

```tsx
{/* [BT-24] 요약(스트립)과 전체(리스트)는 '깊이'가 다를 뿐 기능이 달라선 안 된다.
    BT-18에서 두 뷰를 같은 자리 토글 교체로 만들었기 때문에,
    토글 하나에 조금 전까지 되던 동작이 사라지면 그대로 인지 비용이 된다. */}
{onCourseFocus ? (
  <button
    type="button"
    className="kium-srow-title is-link"
    onClick={() => onCourseFocus(c.id)}
    aria-label={`${c.titleMarketing} 과정 카드로 이동`}
  >
    {c.titleMarketing}
  </button>
) : (
  <span className="kium-srow-title">{c.titleMarketing}</span>
)}
```

### 4-2. `UpcomingSessionsStrip.tsx` — 전달

`SessionListView` 호출부에 `onCourseFocus={onCourseFocus}` **한 줄 추가**. 다른 prop 무변경.

### 4-3. CSS — 색 정책이 스트립과 다르다

```css
/* [BT-24] 전체 일정 리스트 과정명 — 스트립 카드와 같은 동작, 다른 색 정책.
   스트립은 6장이라 기본 색을 --p1로 둬도 됐지만 리스트는 20행이다.
   기본 상태를 보라로 칠하면 지면이 시끄러워진다 —
   리스트에서 과정명은 이미 가장 큰 텍스트(15px/800)라 색 없이도 위계가 선다.
   어포던스는 hover·focus에서만 준다(v2.1 §5-4의 밑줄 정책과 동일). */
.kium-srow-title.is-link{border:0;background:transparent;text-align:left;
  padding:11px 0;margin:-11px 0;
  text-decoration:none;text-underline-offset:3px;
  transition:color .18s var(--ease)}
.kium-srow-title.is-link:hover,
.kium-srow-title.is-link:focus-visible{color:var(--p1);text-decoration:underline}
```

- `padding` / `margin` 상쇄로 **레이아웃을 바꾸지 않고 히트 영역만 44px 이상**으로 넓힌다(F8과 같은 방식).
- 위쪽 히트 영역이 카테고리 칩과 5px 겹치나 칩은 비인터랙티브 `<span>`이라 충돌이 없다. **실측으로 확인할 것.**
- `.kium-srow-title` 기본 규칙(`font-size:15px;font-weight:800;color:var(--ink)` 등)은 **무변경**이다.

### 4-4. 하지 않을 것

| 항목 | 사유 |
| --- | --- |
| hover 툴팁 신설 | 터치 기기에서 발화하지 않아 접근 경로가 갈린다. 클릭 → 카드 확장이 모든 입력 수단에서 동일하게 동작하는 유일한 답이다 |
| 클릭 시 리스트 자동 접힘 | 사용자가 연 상태를 시스템이 되돌리지 않는다. 카드를 보고 일정으로 돌아올 때 펼침이 유지돼야 자연스럽다 |
| 행 전체를 클릭 대상으로 | 기존 원칙 유지 — 오클릭 방지. 인터랙티브는 과정명과 CTA 둘뿐이다 |

---

## 5. BT-25 — 「1인 기준」 위치 이관

### 5-1. 리스트 행에서 제거

`SessionListView.tsx`의 `.kium-srow-meta` 가격 블록에서 `<i>{KIUM_PRICE_NOTE}</i>` **한 줄 제거**.

```tsx
<span>
  <IconWallet size={16} />
  <b className="num">{fmtPrice(c.id)}</b>
</span>
```

`KIUM_PRICE_NOTE` import가 미사용이 되면 **제거**한다.

### 5-2. 모드 헤더에 1회

`KiumCoursesTab.tsx`의 `header` prop 안 보조 문구를 교체한다.

```tsx
{/* [BT-25] '1인 기준'은 공개교육 9과정 전건 동일한 값이다.
    행마다 반복하면 20회가 되는데, 지워도 어떤 행의 의미도 달라지지 않는다.
    전건 같은 값은 항목이 아니라 영역에 속한다 — 컨테이너 헤더에서 한 번만 말한다.
    문구 출처는 KIUM_PRICE_NOTE 하나로 유지해 상세 패널과 어긋날 수 없게 한다. */}
<p className="kium-modehead-s">1명부터 신청 가능 · 교육비 {KIUM_PRICE_NOTE}</p>
```

- `KiumCoursesTab.tsx`에 `import { KIUM_PRICE_NOTE } from '@/lib/kium/pricing';` 추가(이미 있으면 그대로).
- **상세 패널 pill의 note는 유지**한다 — 한 과정만 보는 화면이라 반복이 아니고, 딥링크로 바로 들어온 사용자에겐 이곳이 유일한 고지처다.
- `CourseListView.tsx`는 미참조 컴포넌트라 **무변경**이다.
- `lib/kium/pricing.ts`의 `KIUM_PRICE_NOTE` 상수 **무변경**.

---

## 6. 금지

- `sortByWeight()` · `effectiveStatus()` 등 `lib/kium/sessions.ts` 유틸 함수 무변경
- `KIUM_PRICE_NOTE` 상수 값 변경 금지 · 상세 패널 pill note 제거 금지
- 월 그룹 헤더 **코드 삭제** 금지 — 조건부 렌더만 (그룹 2개 이상에서 필요)
- `showMonthCta` / `onConsultMonth`(경로 C) 코드 삭제 금지
- 신규 색 토큰 · 신규 클래스 발명 금지 (`.is-link`는 기존 `.kium-srow-title`의 변형자)
- 리스트 과정명 **기본 색을 `--p1`로 바꾸지 말 것** — hover·focus에서만
- hover 툴팁 신설 금지 · 클릭 시 리스트 자동 접힘 금지
- 행 전체를 클릭 대상으로 만들지 말 것
- `SessionCard` · `UpcomingSessionsStrip`의 스트립 렌더 무변경 (전달 1줄 외)
- 회차 데이터(`sessions.ts`) · 프리필 · `HomeInquiry` 무변경

---

## 7. 검증

### 7-1. 기능 (전략서 완료 조건)

| # | 항목 | 기대 |
| --- | --- | --- |
| A1 | `?month=11` 에서 「11월 N개 회차」 노출 횟수 | **2회** — 기간 칩 · 모드 헤더 |
| A2 | 기간 전체에서 월 그룹 헤더 | **3개** 노출 · sticky 동작 유지 |
| A3 | 리스트 과정명 클릭 | 그리드 카드로 스크롤 + 확장 + 2초 하이라이트 + 포커스 (스트립과 동일) |
| A4 | 리스트 과정명 색 | 기본 `--ink` · hover·focus에서 `--p1` + 밑줄 |
| A5 | `1인 기준` 렌더 횟수 | 리스트 **0회** / 모드 헤더 **1회** / 상세 패널 과정당 1회 |
| A6 | 리스트 정렬 | 각 월 그룹이 **날짜 오름차순** · `closed`만 최하단 |
| A7 | 순서 일치 | 스트립 첫 6장 == 리스트 앞 6행(미마감 구간) |
| A8 | `KiumSchedule` 렌더 | 무변경 — `onCourseFocus` 미지정 경로에서 정적 `<span>` |

> A6 실측 예시(시드 기준) — 10월 `10.12 · 10.14 · 10.19 · 10.21 · 10.26 · 10.27` / 11월 `11.2 · 11.9 · 11.12 · 11.16 · 11.17 · 11.18`

### 7-2. 접근성·반응형

| # | 항목 | 기대 |
| --- | --- | --- |
| B1 | 단일 월 그룹 접근명 | `<section aria-label="11월 회차 목록">` — `aria-labelledby` 미참조 |
| B2 | 과정명 히트 영역 | **44×44px 이상** · 카테고리 칩 클릭 간섭 0 |
| B3 | Tab 순서 | 과정명 → 상태·CTA 버튼 |
| B4 | 모드 헤더 보조 문구 | 320/375px에서 줄바꿈·넘침 확인 |
| B5 | 반응형 | 320/375/768/1024/1440 가로 넘침 0px (접힘·펼침 두 상태) |
| B6 | 여백 | 단일 월에서 컨테이너 헤더선 ~ 첫 행 간격이 과하지 않은지 실측 |

### 7-3. 회귀

- 기존 스위트 `verify-btype.mjs` · `verify-btype2.mjs` 전건 통과
- **월 그룹 개수를 단언하는 항목**(`E7` · `F3` 등)이 단일 월 필터 상태에서 실행되면 깨진다 → 전수 조사 후 갱신하고 목록 보고
- **리스트 순서를 단언하는 항목**이 있으면 새 정렬 기준으로 갱신
- 타 페이지 5경로(`/`, `/ax-ai`, `/leadership`, `/hrd`, `/content`) 회귀 0
- `npm run build` 경고 0 · `tsc --noEmit` 0 · 신규 npm 의존성 0

---

## 8. 이번 범위 밖 (전략서 §5)

| # | 항목 | 판단 |
| --- | --- | --- |
| N1 | 스트립 카드 교육비 미노출 | 유지 — 깊이 단계로 정당. v2.1에서 카드 요소 5→4로 줄인 직후라 되돌리지 않는다 |
| N2 | `· 2일` + `14시간` 중복 인상 | 유지 — 일수는 일정 계획, 시간은 훈련시간(환급 산정 기준). 성격이 다르다 |
| N3 | 모집 상태 칩 맨숫자 | 유지 — BT-04 근거 동일 |

---

## 9. 완료 보고 양식

1. §0 F1~F9 대조 결과
2. 변경 파일 목록 (TSX / CSS / 검증 스크립트)
3. §7-1 기능 표 A1~A8 — 실측값 (A6·A7은 **렌더된 날짜 배열을 그대로** 적을 것)
4. §7-2 접근성·반응형 표 B1~B6 — 실측값
5. 갱신한 검증 단언 목록 (항목명 · 이전 기대값 → 새 기대값)
6. `npm run build` · `tsc` 결과
7. 스크린샷 — `?month=11` 펼침(단일 월) / 기간 전체 펼침(3그룹) / 과정명 hover / 320·375·1440
8. 명세와 달리 판단한 부분과 사유
