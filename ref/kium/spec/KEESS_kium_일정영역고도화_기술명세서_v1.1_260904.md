# KEESS `/kium` 일정 영역 정보 위계 고도화 기술명세서 v1.1

- **작성일**: 2026-09-04
- **개정**: v1.0 BT-23~26 · **v1.1 BT-27~29 추가**(회차 카드 CTA 줄밀림·정렬)
- **대상 저장소**: `KEESS_pedu` · 기준 커밋 `cf513cf`
- **대상 화면**: `/kium` 과정안내 탭 — 공개교육 보기 · 일정 영역(`.kium-schedbox`)
- **전략 근거**: `ref/kium/strategy/KEESS_kium_일정영역_정보위계_UIUX전략_v1.1_260904.md`
- **문서 지위**: 본 건 구현의 **단일 기준**. `BType고도화_기술명세서_v2.1` 위의 **증분**이며 기존 확정 사항은 변경하지 않는다.
- **v1.0은 구버전** — 본 문서가 대체한다(BT-23~26 전문 포함).

---

## 0. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F1 | `SessionListView`가 `sortByWeight(items, now)`로 정렬 — weight ASC → start ASC | `SessionListView.tsx` |
| F2 | weight = `confirmed 1 · closing 1 · recruiting 2 · closed 4` | `lib/kium/sessions.ts` |
| F3 | 월 그룹이 `<section aria-labelledby={hid}>` + `<h4 id={hid}>` 구조 | `SessionListView.tsx` |
| F4 | `.kium-srow-title`이 정적 `<span>` | 동일 |
| F5 | `.kium-srow-meta`에 `<i>{KIUM_PRICE_NOTE}</i>` (`= '1인 기준'`) | 동일 · `lib/kium/pricing.ts` |
| F6 | `UpcomingSessionsStrip`이 `onCourseFocus`를 이미 받아 `SessionCard.onCourseClick`에 전달 | `UpcomingSessionsStrip.tsx` |
| F7 | 모드 헤더 보조 문구 = `1명부터 신청 가능` | `KiumCoursesTab.tsx` `header` prop |
| F8 | `.kium-scard2-course`가 `padding:12px 0;margin:-12px 0`로 44px 히트 영역 확보 | `styles/kium-open.css` |
| F9 | `.kium-srows{list-style:none;margin-top:10px;display:grid;gap:10px}` | 동일 |
| **F10** | `CTA_LABEL.closing = '마감 전 상담'` · `CTA_LABEL.closed = '다음 회차 상담'` | `components/kium/SessionBadge.tsx` |
| **F11** | `.kium-sact{gap:10px;padding:0 12px}` · `.kium-sact-st{flex:none}` · `.kium-sact-go`에 `white-space` 선언 **없음** | `styles/kium-open.css` |
| **F12** | `.kium-ustrip{grid-auto-columns:minmax(212px,1fr)}` · 모바일 `82%` | 동일 |
| **F13** | `margin-top:auto` 규칙 대상이 `.kium-cta-ses` · `.kium-cta-next` **2개뿐** — `.kium-sact` · `.kium-sact-closed` 누락 | 동일 (`.kium-ustrip .kium-scard2 …`) |
| **F14** | `SessionAction`의 상태 라벨(`{meta.label}`)이 **텍스트 노드**로 직접 렌더 — 감싸는 요소 없음 | `SessionBadge.tsx` |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**한다.

---

## 1. 변경 항목

| ID | 항목 | 우선도 | 파일 |
| --- | --- | --- | --- |
| **BT-26** | 리스트 정렬 — `closed` 뒤로 · 나머지 날짜 오름차순 | **P0** | `SessionListView.tsx` |
| **BT-27** | CTA 라벨 통일 — `마감 전 상담` → `상담하기` | **P0** | `SessionBadge.tsx` |
| **BT-28** | 줄바꿈 원천 차단 — 축소 우선순위 명시 | **P0** | `SessionBadge.tsx` · `kium-open.css` |
| **BT-29** | 스트립 카드 CTA 하단 정렬 복구 (BT-20 이월) | **P0** | `kium-open.css` |
| **BT-23** | 월 그룹 헤더 — 그룹 1개일 때 미렌더 | P0 | `SessionListView.tsx` · `kium-open.css` |
| **BT-24** | 리스트 과정명 — 스트립과 동일 동작 | P0 | `SessionListView.tsx` · `UpcomingSessionsStrip.tsx` · `kium-open.css` |
| **BT-25** | `1인 기준` — 행 20회 → 헤더 1회 | P0 | `SessionListView.tsx` · `KiumCoursesTab.tsx` |

**적용 순서는 위 표 그대로** — BT-26~29(현재 화면에 드러난 결함)를 먼저 끝내고 BT-23~25로 간다.

---

## 2. BT-26 — 리스트 정렬

전건 `recruiting`이던 동안에는 weight가 같아 결과적으로 날짜순이었으나, 상태 시드 적용 후 뒤섞인다.

| 월 | 현행 렌더 순서 |
| --- | --- |
| 10월 | 10.12 · 10.14 · 10.21 · 10.26 · **10.19** · 10.27 |
| 11월 | 11.2 · 11.12 · 11.16 · 11.17 · **11.9** · 11.18 |
| 12월 | 11.30 · 12.7 · 12.11 · 12.14 · **12.9** · 12.16 · 12.17 · 12.21 |

```tsx
const groups = MONTHS.map((m) => ({
  month: m,
  /**
   * [BT-26] 「전체 일정」은 시간 축이다 — 날짜 오름차순이 1순위다.
   *   sortByWeight()는 weight ASC → start ASC라 상태 시드가 들어가는 순간
   *   같은 월 안에서 날짜가 뒤섞였다(11월 11.9가 네 칸 뒤로 밀림).
   *   상태 우선 정렬은 '추천순'의 논리이고 월 그룹 날짜 목록에는 맞지 않는다.
   *   스트립이 순수 날짜순이므로 이 규칙으로 두 뷰의 순서도 일치한다(BT-18 토글 교체).
   *   단 closed는 지난 회차라 미래 회차 사이에 끼면 안 되므로 각 그룹 최하단으로 보낸다.
   *   ※ sortByWeight()는 CourseListView·KiumSchedule이 참조하므로 함수 자체는 무변경.
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

- `sortByWeight` import가 미사용이 되면 **제거**(빌드 경고 0 유지).
- `lib/kium/sessions.ts`의 `sortByWeight` **함수 무변경**.

---

## 3. BT-27 — CTA 라벨 통일

### 3-1. 근거

`마감 전 상담`의 **'마감 전'은 좌측 `마감임박` 배지와 같은 사실**이다.
v2.0 BT-17이 이 문구를 축약하지 않은 근거는 *"문구 자체가 상태 정보를 진다"* 였는데,
그때는 **배지와 CTA가 분리**돼 CTA 라벨이 단독으로 읽히는 맥락이었다.
BT-20에서 배지를 버튼 **안으로** 흡수한 뒤로 전제가 바뀌었다 —
**좌측이 상태를, 우측이 동작을 말하는 구조**에서 우측이 상태를 반복할 이유가 없다.

정보 손실은 없다. 상태는 **배지 텍스트 + 아이콘 + 색(#DC2626) + 배경 tint + `aria-label`**이 5중으로 진다.

### 3-2. 확정

```ts
export const CTA_LABEL: Record<KiumSessionStatus, string> = {
  // 신청 가능 3상태는 라벨이 같다.
  // BT-20에서 배지를 버튼 안으로 흡수한 뒤로 좌측이 상태를, 우측이 동작을 말한다.
  // 우측이 상태를 다시 말하면(예: '마감 전 상담') 좌측 배지와 같은 사실이 두 번 나온다.
  // 마감임박의 긴박감은 문구가 아니라 배경 tint(--p2)와 아이콘 색이 진다.
  recruiting: '상담하기',
  confirmed: '상담하기',
  closing: '상담하기',
  // closed만 다르다 — '다음 회차'는 *다른 회차*를 가리키는 정보이지 상태 반복이 아니다.
  // 형태도 버튼이 아니라 정적 배지 + 텍스트 링크로 갈린다.
  closed: '다음 회차 상담',
};
```

- `CTA_LABEL`은 **단일 출처**다. `SessionCta`(쇼케이스 · 숨김 `KiumOpenHero`)도 같은 값을 쓴다 — 별도 오버라이드를 만들지 않는다.
- `.kium-sact[data-tone="red"]`의 배경·테두리 강조는 **무변경**.
- `SessionAction`의 `aria-label`(`${label} ${meta.label} ${text}`) **무변경** — 접근명에 상태가 그대로 남는다.

### 3-3. 채택하지 않는 대안

| 대안 | 판정 |
| --- | --- |
| CTA 라벨 자체를 제거 | **기각.** v2.1 §5-5의 통합 근거가 *"'모집중'은 상태(명사)라 버튼 라벨이 동작을 말하지 않는다"* 였다. 동작 라벨을 빼면 버튼이 다시 배지로 읽혀 클릭 가능성이 학습되지 않는다 |
| 화살표(`→`) 제거 | **기각.** 카드 안 유일한 방향 어포던스다. 20px 절약보다 손실이 크고, 폭 문제는 BT-28이 구조적으로 푼다 |

---

## 4. BT-28 — 줄바꿈 원천 차단

### 4-1. 왜 라벨 통일만으로는 부족한가

| 항목 | 값 |
| --- | --- |
| 카드 최소 폭 (`grid-auto-columns:minmax(212px,1fr)`) | **212px** |
| − `.kium-scard2` padding 16 × 2 | 카드 내부 **180px** |
| − `.kium-sact` padding 12 × 2 + border 2 | 버튼 내부 **154px** |

| 상태 | 좌 | gap | 우 | 합계 | 판정 |
| --- | --- | --- | --- | --- | --- |
| `마감임박` (현행) | `⏰ 마감임박` ≈ 71 | 10 | `마감 전 상담 →` ≈ 98 | **179px** | 초과 → 줄바꿈 |
| `개강확정` (현행) | `✓ 개강확정` ≈ 71 | 10 | `상담하기 →` ≈ 72 | **153px** | **여유 1px** |

라벨 통일 후에도 **여유가 한 자리 수**다. 폰트 렌더링 편차 · 브라우저 확대 · 잔여석 표기가 붙으면 즉시 재발한다.
현재 `.kium-sact-st{flex:none}`이고 `.kium-sact-go`에 `white-space`가 없어 **넘치면 우측이 줄바꿈되는 것이 기본 동작**이다.

### 4-2. 축소 우선순위 — 우측을 보호한다

우측은 이 버튼의 **목적**이다. 좌측 상태는 아이콘·색으로도 부호화돼 있어 텍스트가 줄어도 판독이 유지된다.

| 영역 | 규칙 |
| --- | --- |
| 우측(동작) | `flex:none` + `white-space:nowrap` — 절대 줄바꿈·축소하지 않는다 |
| 좌측(상태) | `flex:0 1 auto` + `min-width:0` + 라벨 말줄임 — 넘치면 여기가 줄어든다 |

### 4-3. TSX — 라벨을 감싸는 요소 신설 (`SessionBadge.tsx` `SessionAction`)

`{meta.label}`이 텍스트 노드라 `text-overflow`가 적용되지 않는다(F14). `<span>`으로 감싼다.

```tsx
      <span className="kium-sact-st">
        <Icon size={14} />
        {/* [BT-28] 텍스트 노드로 두면 말줄임이 걸리지 않는다.
            넘칠 때 줄어드는 쪽은 좌측(상태)이다 — 우측(동작)이 이 버튼의 목적이고,
            상태는 아이콘·색으로도 부호화돼 있어 텍스트가 줄어도 판독이 유지된다. */}
        <span className="kium-sact-lb">{meta.label}</span>
        {status === 'closing' && seatsLeft != null && <em>잔여 {seatsLeft}석</em>}
      </span>
```

`.kium-sact-go` 블록은 **구조 무변경**(CSS만 바뀐다).

### 4-4. CSS (`styles/kium-open.css`)

`.kium-sact` 블록을 아래로 교체한다.

```css
/* ── 회차 카드 상태·CTA 통합 버튼 (BT-20 · BT-28) ────────────────
   좌: 상태(아이콘+라벨) / 우: 동작. 요소 2개를 1개로 합치고 라벨에 동작을 남긴다.
   ★ 폭이 모자랄 때 줄어드는 쪽을 명시한다 — 우측(동작)은 절대 줄바꿈하지 않는다.
     카드 최소 212px 기준 버튼 내부 158px, 필요 151px(=71+8+72) → 여유 7px. */
.kium-sact{display:flex;align-items:center;justify-content:space-between;gap:8px;
  width:100%;min-height:44px;margin-top:2px;padding:0 10px;
  border:1px solid var(--line);border-radius:10px;background:#fff;
  font-size:13px;font-weight:700;color:var(--ink);
  transition:border-color .18s var(--ease),background .18s var(--ease)}
.kium-sact:hover,.kium-sact:focus-visible{border-color:var(--p1);background:var(--surface)}
.kium-sact-st{display:inline-flex;align-items:center;gap:5px;flex:0 1 auto;min-width:0}
.kium-sact-lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kium-sact-st em{font-style:normal;font-size:11.5px;font-weight:700;color:var(--muted);
  margin-left:2px;flex:none;white-space:nowrap}
.kium-sact-go{display:inline-flex;align-items:center;gap:4px;color:var(--p1);font-weight:800;
  flex:none;white-space:nowrap}
/* 마감임박만 지면에서 유일하게 강조 — 긴박감은 문구가 아니라 색이 진다(BT-27) */
.kium-sact[data-tone="red"]{background:color-mix(in srgb,var(--p2) 10%,#fff);
  border-color:color-mix(in srgb,var(--p2) 32%,#fff)}
.kium-sact[data-tone="red"] .kium-sact-go{color:var(--p2)}
/* 마감 — 버튼이 아니라 정적 배지 + 텍스트 링크. 형태로 구분한다 */
.kium-sact-closed{display:flex;align-items:center;justify-content:space-between;gap:8px;
  width:100%;margin-top:2px}
.kium-sact-closed .kium-sbadge{min-width:0}
.kium-sact-closed .kium-cta-next{flex:none;white-space:nowrap}
@media(max-width:479px){
  .kium-sact{padding:0 8px;font-size:12.5px}
}
```

- `.kium-sbadge` **전역 규칙은 무변경** — `.kium-sact-closed` 스코프에서만 `min-width:0`을 준다.
- 신규 클래스는 `.kium-sact-lb` 하나이며 기존 `.kium-sact-*` 계열의 하위 요소다.

---

## 5. BT-29 — 스트립 카드 CTA 하단 정렬 복구

### 5-1. 결함

BT-20에서 카드 버튼이 `.kium-sact` / `.kium-sact-closed`로 바뀌었는데 정렬 규칙이 따라가지 않았다(F13).
스트립은 그리드 행이 stretch되어 카드 높이가 최댓값에 맞춰지는데, `margin-top:auto`가 없으면
버튼이 콘텐츠 바로 아래에 붙어 **과정명 1줄 카드와 2줄 카드의 버튼 높이가 어긋난다.**

### 5-2. 확정

```css
/* [BT-29] BT-20에서 버튼 클래스가 바뀔 때 따라가지 않은 규칙이다.
   ★ 직계 자식(>)으로 좁힌다 — .kium-sact-closed 안의 .kium-cta-next까지 잡으면
     align-items:center인 행에서 margin auto가 정렬을 덮어 링크가 아래로 밀린다. */
.kium-ustrip .kium-scard2>.kium-cta-ses,
.kium-ustrip .kium-scard2>.kium-cta-next,
.kium-ustrip .kium-scard2>.kium-sact,
.kium-ustrip .kium-scard2>.kium-sact-closed{margin-top:auto}
```

기존 2줄 규칙을 위 4줄로 **교체**한다(직계 자식 결합자 추가가 필수).

---

## 6. BT-23 — 월 그룹 헤더 조건부 미렌더

### 6-1. 판정 기준

**필터 값이 아니라 렌더된 그룹 수로 판정한다.**

| 그룹 수 | 헤더 | 근거 |
| --- | --- | --- |
| 2개 이상 | 렌더 | 스크롤 중 "지금 몇 월"을 답하는 sticky 구분자 |
| 1개 | **미렌더** | 구분할 대상이 없고 건수는 모드 헤더가 이미 말한다 |

### 6-2. 구현

```tsx
// [BT-23] 그룹이 하나뿐이면 월 헤더는 역할이 없다 —
//   구분할 대상이 없고 건수는 모드 헤더('공개교육 일정 · 11월 6개 회차')가 이미 말한다.
//   필터 값이 아니라 '렌더된 그룹 수'로 판정해 데이터가 바뀌어도 규칙이 성립하게 한다.
const showGroupHead = groups.length > 1;
```

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
      {showMonthCta && onConsultMonth && ( … 기존 블록 그대로 … )}
    </div>
  )}
  <ul className="kium-srows"> … </ul>
</section>
```

> `showMonthCta`(경로 C) 블록은 헤더 안에 **그대로 둔다.** 삭제 금지.
> 단일 월 + `showMonthCta=true` 조합에서는 월 CTA도 함께 사라지나, B안은 경로 C 미탑재라 영향이 없다.

### 6-3. 여백

```css
/* [BT-23] 그룹이 하나면 월 헤더가 렌더되지 않는다 — 헤더 몫 여백을 걷는다.
   :only-child가 TSX의 groups.length > 1 과 정확히 같은 조건이라 새 클래스가 필요 없다. */
.kium-mgroup:only-child .kium-srows{margin-top:0}
```

---

## 7. BT-24 — 리스트 과정명 인터랙티브

### 7-1. `SessionListView.tsx` — 옵션 prop

```tsx
  /**
   * [BT-24] 과정명 클릭 시 동작. 없으면 정적 <span>으로 렌더된다.
   *   옵션으로 둬서 숨김 보존된 KiumSchedule의 A type 렌더가 한 픽셀도 바뀌지 않게 한다.
   *   SessionCard의 onCourseClick과 같은 패턴이다.
   */
  onCourseFocus?: (courseId: string) => void;
```

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

### 7-2. `UpcomingSessionsStrip.tsx`

`SessionListView` 호출부에 `onCourseFocus={onCourseFocus}` **1줄 추가**. 다른 prop 무변경.

### 7-3. CSS — 색 정책이 스트립과 다르다

```css
/* [BT-24] 전체 일정 리스트 과정명 — 스트립 카드와 같은 동작, 다른 색 정책.
   스트립은 6장이라 기본 색을 --p1로 둬도 됐지만 리스트는 20행이다.
   기본을 보라로 칠하면 지면이 시끄러워진다 —
   과정명은 이미 행에서 가장 큰 텍스트(15px/800)라 색 없이도 위계가 선다.
   어포던스는 hover·focus에서만 준다(v2.1 §5-4 밑줄 정책과 동일). */
.kium-srow-title.is-link{border:0;background:transparent;text-align:left;
  padding:11px 0;margin:-11px 0;
  text-decoration:none;text-underline-offset:3px;
  transition:color .18s var(--ease)}
.kium-srow-title.is-link:hover,
.kium-srow-title.is-link:focus-visible{color:var(--p1);text-decoration:underline}
```

- `padding`/`margin` 상쇄로 **레이아웃 불변 + 히트 영역 44px 이상**(F8과 같은 방식).
- 위쪽 히트 영역이 카테고리 칩과 약 5px 겹치나 칩은 비인터랙티브 `<span>`이라 충돌이 없다 — **실측 확인**.
- `.kium-srow-title` 기본 규칙 **무변경**.

### 7-4. 하지 않을 것

| 항목 | 사유 |
| --- | --- |
| hover 툴팁 신설 | 터치 기기에서 발화하지 않아 접근 경로가 갈린다 |
| 클릭 시 리스트 자동 접힘 | 사용자가 연 상태를 시스템이 되돌리지 않는다 |
| 행 전체 클릭 대상화 | 기존 원칙 유지(오클릭 방지). 인터랙티브는 과정명·CTA 둘뿐 |

---

## 8. BT-25 — 「1인 기준」 위치 이관

### 8-1. 리스트 행에서 제거

```tsx
<span>
  <IconWallet size={16} />
  <b className="num">{fmtPrice(c.id)}</b>
</span>
```

`KIUM_PRICE_NOTE` import가 미사용이 되면 **제거**.

### 8-2. 모드 헤더에 1회 (`KiumCoursesTab.tsx`)

```tsx
{/* [BT-25] '1인 기준'은 공개교육 9과정 전건 동일한 값이다.
    행마다 반복하면 20회가 되는데, 지워도 어떤 행의 의미도 달라지지 않는다.
    전건 같은 값은 항목이 아니라 영역에 속한다 — 컨테이너 헤더에서 한 번만 말한다.
    문구 출처는 KIUM_PRICE_NOTE 하나로 유지해 상세 패널과 어긋날 수 없게 한다. */}
<p className="kium-modehead-s">1명부터 신청 가능 · 교육비 {KIUM_PRICE_NOTE}</p>
```

- `import { KIUM_PRICE_NOTE } from '@/lib/kium/pricing';` 추가(이미 있으면 그대로).
- **상세 패널 pill의 note는 유지** — 한 과정만 보는 화면이라 반복이 아니고, 딥링크 진입 시 유일한 고지처다.
- `CourseListView.tsx`(미참조) · `pricing.ts` 상수 **무변경**.

---

## 9. 금지

- `sortByWeight()` · `effectiveStatus()` 등 `sessions.ts` 유틸 함수 무변경
- `CTA_LABEL`을 **컴포넌트에서 오버라이드하지 말 것** — 단일 출처 유지
- `CTA_LABEL.closed`(`다음 회차 상담`) 변경 금지 · `closed`의 '정적 배지 + 텍스트 링크' 형태 변경 금지
- CTA 라벨 **자체 제거 금지** · 화살표(`→`) 제거 금지
- `.kium-sact[data-tone="red"]` 강조 배색 변경 금지
- `.kium-sbadge` **전역 규칙** 변경 금지 (`.kium-sact-closed` 스코프만 허용)
- 월 그룹 헤더 **코드 삭제** 금지 — 조건부 렌더만
- `showMonthCta` / `onConsultMonth`(경로 C) 코드 삭제 금지
- `KIUM_PRICE_NOTE` 상수 변경 금지 · 상세 패널 pill note 제거 금지
- 리스트 과정명 **기본 색을 `--p1`로 바꾸지 말 것**
- hover 툴팁 신설 금지 · 클릭 시 리스트 자동 접힘 금지 · 행 전체 클릭화 금지
- 신규 색 토큰 금지 · 신규 클래스는 `.kium-sact-lb` · `.kium-srow-title.is-link` 둘뿐
- 회차 데이터(`sessions.ts`) · 프리필 · `HomeInquiry` 무변경

---

## 10. 검증

### 10-1. CTA·레이아웃 (v1.1 신규)

| # | 항목 | 기대 |
| --- | --- | --- |
| C1 | CTA 라벨 | 신청 가능 3상태 전건 `상담하기` · `closed`만 `다음 회차 상담` |
| C2 | **줄바꿈 0건** | 320/375/768/1024/1440 × 상태 4종 × **스트립·리스트 양쪽**에서 버튼 텍스트가 1행 유지 — `.kium-sact`의 `scrollHeight`가 1행 높이인지 실측 |
| C3 | 최악 폭 시뮬레이션 | 임시로 `seatsLeft`를 부여해 `마감임박 잔여 3석 / 상담하기 →` 렌더 시에도 **2줄이 되지 않는지**(좌측 말줄임으로 흡수) 확인 후 **원복** |
| C4 | 스트립 CTA 하단 정렬 | 과정명 1줄 카드와 2줄 카드의 버튼 상단 y좌표 **일치** |
| C5 | 마감 카드 | `closed` 시뮬레이션 시 `.kium-sact-closed`가 1행 유지 · 배지와 링크가 좌우 정렬 후 **원복** |
| C6 | 접근명 | `aria-label`에 상태가 그대로 남는지(`… 마감임박 상담하기`) |
| C7 | 쇼케이스 | `?preview=badges` 4종 라벨이 새 값으로 정상 렌더 |

### 10-2. 정보 위계 (v1.0)

| # | 항목 | 기대 |
| --- | --- | --- |
| A1 | `?month=11` 「11월 N개 회차」 노출 | **2회** — 기간 칩 · 모드 헤더 |
| A2 | 기간 전체 월 그룹 헤더 | **3개** · sticky 유지 |
| A3 | 리스트 과정명 클릭 | 카드 스크롤 + 확장 + 2초 하이라이트 + 포커스 (스트립과 동일) |
| A4 | 리스트 과정명 색 | 기본 `--ink` · hover·focus에서 `--p1` + 밑줄 |
| A5 | `1인 기준` 렌더 | 리스트 **0회** / 모드 헤더 **1회** / 상세 패널 과정당 1회 |
| A6 | 리스트 정렬 | 각 월 **날짜 오름차순** · `closed`만 최하단 |
| A7 | 순서 일치 | 스트립 첫 6장 == 리스트 앞 6행(미마감 구간) |
| A8 | `KiumSchedule` | 렌더 무변경(옵션 prop 미지정 경로) |

> A6 기대 — 10월 `10.12 · 10.14 · 10.19 · 10.21 · 10.26 · 10.27` / 11월 `11.2 · 11.9 · 11.12 · 11.16 · 11.17 · 11.18`

### 10-3. 접근성·반응형

| # | 항목 | 기대 |
| --- | --- | --- |
| B1 | 단일 월 그룹 접근명 | `<section aria-label="11월 회차 목록">` |
| B2 | 과정명 히트 영역 | 44×44px 이상 · 카테고리 칩 클릭 간섭 0 |
| B3 | Tab 순서 | 과정명 → 상태·CTA 버튼 |
| B4 | 모드 헤더 보조 문구 | 320/375px 줄바꿈·넘침 확인 |
| B5 | 반응형 | 320~1440 가로 넘침 0px (접힘·펼침 두 상태) |
| B6 | 여백 | 단일 월에서 컨테이너 헤더선 ~ 첫 행 간격 실측 |

### 10-4. 회귀

- `verify-btype.mjs` · `verify-btype2.mjs` 전건 통과
- **CTA 라벨을 단언하는 항목**(`T1` 등)은 이제 `상담하기` 단일값이 된다 → 기대값 갱신
- **월 그룹 개수를 단언하는 항목**(`E7` · `F3` 등)이 단일 월 필터에서 실행되면 깨진다 → 전수 조사 후 갱신
- **리스트 순서를 단언하는 항목**이 있으면 새 정렬 기준으로 갱신
- 단언을 **삭제하지 말고 교체**하며 갱신 목록을 보고
- 타 페이지 5경로 회귀 0 · `npm run build` 경고 0 · `tsc --noEmit` 0 · 신규 의존성 0

---

## 11. 이번 범위 밖

| # | 항목 | 판단 |
| --- | --- | --- |
| N1 | 스트립 카드 교육비 미노출 | 유지 — 깊이 단계로 정당 |
| N2 | `· 2일` + `14시간` 중복 인상 | 유지 — 일정 계획 vs 훈련시간(환급 산정 기준) |
| N3 | 모집 상태 칩 맨숫자 | 유지 — BT-04 근거 동일 |
| N4 | CTA 화살표 제거 | 유지 — 유일한 방향 어포던스 |
| S1 | **잔여석 표기 + 스트립 폭** | 회신값 반영 시점에 결정 — 스트립 미표기 / 리스트만 표기 방안 검토 |

---

## 12. 완료 보고 양식

1. §0 F1~F14 대조 결과
2. 변경 파일 목록 (TSX / CSS / 검증 스크립트)
3. §10-1 CTA·레이아웃 C1~C7 — **C2는 뷰포트 × 상태별 버튼 높이 실측값**을 표로
4. §10-2 정보 위계 A1~A8 — A6·A7은 **렌더된 날짜 배열 그대로**
5. §10-3 접근성·반응형 B1~B6
6. 갱신한 검증 단언 목록 (항목명 · 이전 기대값 → 새 기대값)
7. `npm run build` · `tsc` 결과
8. 스크린샷 — 스트립 4상태 / `?month=11` 펼침(단일 월) / 기간 전체 펼침(3그룹) / 과정명 hover / 320·375·1440
9. 명세와 달리 판단한 부분과 사유
