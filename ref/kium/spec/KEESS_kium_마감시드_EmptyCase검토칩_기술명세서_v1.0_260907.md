# KEESS `/kium` 마감 회차 시드 + Empty Case 검토 칩 기술명세서 v1.0

- **작성일**: 2026-09-07
- **대상 저장소**: `KEESS_pedu` · 기준 커밋 `2652241`
- **대상 화면**: 과정안내 탭 — 공개교육 보기 · 모집 상태 필터 행 · 회차 카드
- **근거**: 9/7 개발 브리핑 결정 + 기획서 검토 요건
- **기능 ID**: **F21 · F22 · F23** (PRD upgrade-02의 F20에서 이어짐)
- **문서 지위**: 본 건 구현의 **단일 기준**. 선행 명세 위의 증분이며 기존 확정 사항은 변경하지 않는다.

---

## 1. 배경 — 이 배포본의 이중 역할

`keess-pedu.vercel.app`은 **고객이 보는 사이트이면서 동시에 사업부·개발이 보는 기획서**다.
지금까지도 그 전제로 운영해 왔다 — `?preview=badges` 쇼케이스 · 회차 상태 검토용 시드 · `마감 0` 유지.

### 1-1. 현재 상태의 문제

`마감 0`이 **두 역할을 겸하고 있다.**

| 확인 대상 | 현재 | |
| --- | --- | --- |
| 마감 회차 **카드 UI** | **불가** — 마감 회차가 데이터에 0건 | ❌ |
| **Empty Case** 화면 | 가능 — 마감 칩 선택 시 발현 | ✅ |

기획서에서 **확인할 수 없는 상태가 남아 있으면 안 된다.** 마감 카드는 오픈 후 10월 중순부터
`effectiveStatus()` 자동 승격으로 실제 발생하는데, 그 UI를 지금 검토할 방법이 없다.

### 1-2. 요구사항

1. 마감 상태 회차를 **1건** 데이터에 넣어 마감 카드 UI를 확인 가능하게 한다
2. 그러면 마감 칩이 더 이상 Empty Case를 만들지 않으므로, **Empty Case 확인 수단을 별도로 마련**한다
3. 9/7 회의 결정 — **0건인 모집 상태 칩은 노출하지 않는다**

### 1-3. 세 항목은 한 세트다

| 관계 |
| --- |
| `0건 칩 미노출`(F22) → 12월 필터에서 마감 칩이 사라짐 → **마감 칩으로 Empty Case를 만들 수 없음** |
| `마감 시드 1건`(F21) → 전체 상태에서 마감 칩이 노출됨 → **마감 칩이 Empty Case를 만들지 않음** |
| → **Empty Case 전용 검토 칩(F23)이 반드시 필요해진다** |

따로 반영하면 중간 상태에서 앞뒤가 맞지 않는다. **한 빌드에 함께 넣는다.**

---

## 2. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F0-1 | `status` 상태 타입이 `'all' \| KiumSessionStatus` | `KiumCoursesTab.tsx:78` |
| F0-2 | `visible`이 `status === 'all' ? scoped : scoped.filter(effectiveStatus === status)` | `KiumCoursesTab.tsx:109~111` |
| F0-3 | `scopeLabel`이 `KIUM_SESSION_META[status].label`을 참조 (`status !== 'all'`일 때) | `KiumCoursesTab.tsx:316` |
| F0-4 | 모집 상태 칩이 `KIUM_STATUS_ORDER.map`으로 **4종 무조건 렌더** · 카운트는 `stCount[st]` | `KiumCoursesTab.tsx:440~455` |
| F0-5 | `KIUM_STATUS_ORDER = ['recruiting','confirmed','closing','closed']` | `lib/kium/sessions.ts:44` |
| F0-6 | 쇼케이스 게이트 = `setShowcase(q.get('preview') === 'badges')` | `KiumCoursesTab.tsx:201` |
| F0-7 | 현재 상태 분포 — `recruiting 8 / confirmed 7 / closing 5 / closed 0` | `lib/kium/sessions.ts` |
| F0-8 | 스트립 첫 화면(MO 3장) = `10.12 closing / 10.14 confirmed / 10.19 recruiting` — **3상태 각 1건** | 실측 |
| F0-9 | 스트립은 `effectiveStatus !== 'closed'`로 마감을 제외 | `UpcomingSessionsStrip.tsx` |
| F0-10 | `.kium-sact-closed`(마감 카드)가 **아직 한 번도 렌더된 적 없음** — `closed` 0건 | 실측 |
| F0-11 | `.kium-srow[data-status="closed"]{opacity:.72}` · `.kium-scard2[data-status="closed"]{opacity:.72}` | `styles/kium-open.css` |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**한다.

---

## 3. F21 — 마감 회차 시드 1건

### 3-1. 대상 선정 — `relead-r1` (10.21~22)

| 후보 | 판정 |
| --- | --- |
| `agent-r1` 10.12 (가장 이른 회차) | **기각** — 스트립 MO 3장의 `closing`이 사라진다(F0-8) |
| `data-r1` 10.14 · `aijob-r1` 10.19 | **기각** — 같은 이유로 `confirmed` / `recruiting`이 사라진다 |
| **`relead-r1` 10.21~22** | **채택** |

**채택 근거**

| # | 근거 |
| --- | --- |
| 1 | **스트립 첫 화면 커버리지 보존** — MO 3장(10.12·10.14·10.19)과 PC 6장에 3상태가 그대로 남는다 |
| 2 | **마감 카드는 스트립에 안 나온다**(F0-9). 확인은 「전체 일정」 리스트·상세 패널에서 하므로, 스트립 커버리지를 희생할 이유가 없다 |
| 3 | **10월 그룹 하나에 4상태가 모두 모인다** — 기간 `10월` 필터 하나로 4종을 한 화면에서 비교할 수 있다(검토 효율 최고) |
| 4 | `kium-04`(Re-Lead) 과정 내 상태 조합은 2상태로 **변화 없음** |

**개연성** — "10.12·10.14는 열려 있는데 10.21이 마감"은 이상해 보이지만,
**마감은 날짜가 아니라 정원으로 결정된다.** 인기 과정이 먼저 차는 것은 흔하다.
`effectiveStatus()`의 날짜 기반 자동 승격과 달리, **시드 `closed`는 「정원 충족 마감」**을 뜻한다.

### 3-2. 변경

`lib/kium/sessions.ts` — **`relead-r1` 한 건의 `status`만** `'confirmed'` → `'closed'`.
일자 · `id` · `courseId` · `displayMonth` · 배열 순서 · 유틸 함수 **전부 무변경**.

주석 블록에 아래 문단을 추가한다.

```
 *   ★ closed 1건(relead-r1)은 「정원 충족 조기 마감」을 뜻하는 검토용 값이다.
 *     날짜 기반 자동 승격(effectiveStatus)과 성격이 다르므로 이른 회차가 열려 있어도 모순이 아니다.
 *     가장 이른 3회차(10.12·10.14·10.19)는 스트립 첫 화면의 3상태 커버리지라 건드리지 않는다.
 *     10월 그룹 하나에 4상태가 모두 모여 기간 필터 하나로 전 상태를 비교할 수 있다.
```

### 3-3. 검산 — 구현 후 이 표와 일치해야 한다

**전체**

| 상태 | 건수 |
| --- | --- |
| recruiting | 8 |
| confirmed | **6** |
| closing | 5 |
| **closed** | **1** |
| 합계 | 20 |

**월별**

| 월 | 회차 | recruiting | confirmed | closing | closed |
| --- | --- | --- | --- | --- | --- |
| 10월 | 6 | 2 | **1** | 2 | **1** |
| 11월 | 6 | 2 | 2 | 2 | 0 |
| 12월 | 8 | 4 | 3 | 1 | 0 |

**스트립 첫 화면 (마감 제외 · 날짜 오름차순)** — 변화 없음

| 순번 | 회차 | 상태 | MO 3 | PC 6 |
| --- | --- | --- | --- | --- |
| 1 | 10.12 | closing | ● | ● |
| 2 | 10.14 | confirmed | ● | ● |
| 3 | 10.19 | recruiting | ● | ● |
| 4 | 10.26 | closing | | ● |
| 5 | 10.27 | recruiting | | ● |
| 6 | 11.02 | confirmed | | ● |

> `relead-r1`이 빠진 자리를 `11.02`가 채워 PC 6장은 그대로 3상태를 유지한다.

---

## 4. F22 — 0건인 모집 상태 칩 미노출 (9/7 회의 결정)

### 4-1. 규칙

| 조건 | 처리 |
| --- | --- |
| `stCount[st] === 0` | 해당 칩 **미렌더** |
| `stCount[st] > 0` | 현행 그대로 |
| `전체` 칩 | **항상 렌더** — 필터 해제 수단이므로 사라지면 안 된다 |

**상태 정의 4종(`KIUM_STATUS_ORDER`) · 데이터 · `effectiveStatus()` 로직은 그대로 유지한다.**
바뀌는 것은 **칩의 노출 조건 하나**다.

### 4-2. 구현

```tsx
{KIUM_STATUS_ORDER.map((st) => {
  /* [F22 · 9/7 회의 결정] 0건인 칩은 선택지가 아니라 잡음이다 —
     누르면 빈 화면만 나오므로 고르는 데 기여하지 않는다.
     상태 정의 4종과 데이터·로직은 그대로 두고 '노출 조건' 하나만 바꾼다.
     10월 중순 첫 회차 종료 후 effectiveStatus()가 마감을 자동 승격시키면
     마감 칩이 스스로 다시 나타난다 — 운영 중 조치가 필요 없다. */
  if (stCount[st] === 0) return null;
  const Icon = STATUS_ICON[st];
  return ( … 현행 그대로 … );
})}
```

### 4-3. 부작용 — 선택된 칩이 사라지는 경우

`모집중`을 선택한 상태에서 기간 필터를 바꿔 해당 상태가 0건이 되면
**선택된 칩이 DOM에서 사라지고 화면은 빈 상태가 된다.**

→ **`stCount[status] === 0`이면 `status`를 `'all'`로 되돌린다.**

```tsx
/* [F22] 선택된 칩이 0건이 되어 사라지면 사용자가 해제할 수단을 잃는다.
   빈 화면 + 해제 불가는 막다른 골목이므로 자동으로 전체로 되돌린다. */
useEffect(() => {
  if (status !== 'all' && status !== 'empty' && stCount[status] === 0) setStatus('all');
}, [status, stCount]);
```

---

## 5. F23 — Empty Case 검토 칩

### 5-1. ★ 상시 노출하지 않는다 — `?preview` 쿼리 게이트

원 제안은 「마감 우측에 `Empty Case` 칩을 가상 생성」이다. **위치는 맞고 노출 조건이 문제다.**

| # | 상시 노출 시 문제 |
| --- | --- |
| 1 | **축 오염** — 「모집 상태」 행은 회차의 **데이터 값**을 고르는 축이다. `Empty Case`는 데이터가 아니라 **화면 상태**다. 같은 행에 두면 "Empty Case라는 모집 상태가 있나?"로 읽힌다 |
| 2 | **고객 노출** — 9/10 배포본은 고객이 보는 화면이다. 필터에 영어 개발 용어가 상시 노출되면 신뢰를 깎는다 |
| 3 | **회의 결정과 충돌** — 「0건 칩 미노출」(F22)이 결정됐는데 Empty 칩은 **정의상 항상 0건**을 만든다 |
| 4 | **오픈 후 정리 부담** — 검토 장치가 운영본에 남으면 걷어내는 작업이 또 필요하다 |

→ **이미 있는 `?preview` 규약을 쓴다**(F0-6). 검토 모드에서만 칩이 나타난다.

| | 상시 노출 | **쿼리 게이트** |
| --- | --- | --- |
| 고객 화면 | 노출 ❌ | **DOM 미생성** ✅ |
| 검토자 비용 | 클릭 1회 | URL 하나 공유 → 클릭 1회 |
| 축 오염 | 있음 | 검토 모드에서만 |
| 오픈 후 정리 | 코드 제거 필요 | **URL을 안 쓰면 끝** |

**의도(= Empty Case 확인 수단 보존)는 100% 충족하면서 리스크만 걷어낸다.**

### 5-2. 게이트 조건

기존 `showcase` 상태를 **`preview` 파라미터 존재 여부**로 확장한다.

```tsx
const [showcase, setShowcase] = useState(false);   // ?preview=badges — 쇼케이스 블록
const [reviewMode, setReviewMode] = useState(false); // ?preview=* — 검토 모드

useEffect(() => {
  const q = new URLSearchParams(window.location.search);
  const p = q.get('preview');
  setShowcase(p === 'badges');
  /* [F23] preview 파라미터가 있으면 검토 모드 —
     ?preview=badges(쇼케이스+칩) · ?preview=cases(칩만) 둘 다 동작한다.
     고객 화면에는 이 파라미터가 없으므로 칩이 DOM에 생성되지 않는다. */
  setReviewMode(p !== null);
}, []);
```

> SSG 하이드레이션 안전 — 서버 렌더 시 `false`, 마운트 후 결정. 기존 `showcase`와 동일 패턴.

### 5-3. 상태 타입 확장

```tsx
type StatusFilter = 'all' | KiumSessionStatus | 'empty';
const [status, setStatus] = useState<StatusFilter>('all');
```

`visible` 계산:

```tsx
const visible = useMemo(() => {
  /* [F23] 'empty'는 데이터 필터가 아니라 '빈 상태 화면'을 강제로 만드는 검토용 값이다. */
  if (status === 'empty') return [];
  return status === 'all' ? scoped : scoped.filter((s) => effectiveStatus(s, now) === status);
}, [scoped, status, now]);
```

`scopeLabel`(F0-3) 가드:

```tsx
status === 'all' || status === 'empty' ? null : KIUM_SESSION_META[status].label,
```

`resetFilters()`가 `setStatus('all')`을 호출하므로 Empty 해제는 기존 「필터 초기화」로 동작한다.

### 5-4. 칩 마크업 — 모집 상태 행 맨 끝

```tsx
{/* [F23] 검토용 — ?preview 쿼리가 있을 때만 렌더된다. 고객 화면에는 존재하지 않는다.
    마감 시드 1건(F21)이 들어가면서 마감 칩이 더는 Empty Case를 만들지 않으므로,
    빈 상태 화면을 확인할 전용 수단이 필요해졌다.
    점선 테두리로 '실제 필터가 아님'을 형태로 말한다 — 색이 아니라 형태다. */}
{reviewMode && (
  <button
    type="button"
    className="kium-chip kium-chip-review"
    aria-pressed={status === 'empty'}
    aria-label="검토용 — 조건에 맞는 회차가 없는 화면 확인"
    onClick={() => setStatus('empty')}
  >
    Empty Case
  </button>
)}
```

- 카운트(`.cnt`)는 **표시하지 않는다** — 항상 0이라 정보가 없다.
- `data-st` 속성을 주지 않는다 — 상태 아이콘 색 규칙(`.kium-chip-st[data-st]`)에 걸리면 안 된다.

### 5-5. CSS — 1개 규칙 추가 (`styles/kium-open.css`)

```css
/* [F23] 검토용 칩 — 실제 필터가 아님을 '형태'로 구분한다(점선).
   ?preview 쿼리가 있을 때만 렌더되므로 고객 화면에는 나타나지 않는다.
   기존 .kium-chip 규칙을 상속하고 테두리 스타일만 덮는다 — 신규 색 토큰 0. */
.kium-chip-review{border-style:dashed}
.kium-chip-review[aria-pressed="true"]{border-style:dashed}
```

---

## 6. 금지

- `KIUM_STATUS_ORDER` · `KIUM_SESSION_META` · `effectiveStatus()` 등 **유틸·상수 무변경**
- 회차 데이터에서 `relead-r1`의 `status` **외 어떤 값도 바꾸지 말 것** (일자 · id · courseId · displayMonth · 순서)
- `closed` 시드를 **2건 이상 만들지 말 것** — 1건이 요구사항이다
- **`seatsLeft` 추가 금지** — 근거 없는 재고 주장(선행 명세 승계)
- `Empty Case` 칩을 **상시 노출하지 말 것** — `?preview` 게이트 필수
- Empty 칩에 `data-st` 부여 금지 · 카운트 표기 금지
- `전체` 칩을 0건 미노출 규칙에 포함시키지 말 것 — 필터 해제 수단이다
- 신규 색 토큰 금지 · 신규 CSS 규칙은 `.kium-chip-review` 2줄뿐
- 프리필 · `HomeInquiry` · `SessionCard` · `SessionAction` 렌더 무변경
- `status`를 날짜로 추론하는 로직 신설 금지

---

## 7. 검증

### 7-1. 데이터 (F21)

| # | 항목 | 기대 |
| --- | --- | --- |
| D1 | 상태 분포 | `recruiting 8 / confirmed 6 / closing 5 / closed 1` |
| D2 | 월별 분포 | §3-3 표와 1:1 일치 |
| D3 | 변경 범위 | diff에서 `relead-r1`의 `status` **1개 값만** 변경 |
| D4 | `seatsLeft` | 데이터 0건 유지 |

### 7-2. 마감 UI — **처음 렌더된다 (F0-10)**

| # | 항목 | 기대 |
| --- | --- | --- |
| M1 | 스트립 | 마감 회차 **미노출**(closed 제외 규칙) |
| M2 | 「전체 일정」 리스트 | `10.21` 행이 **10월 그룹 최하단** · `data-status="closed"` |
| M3 | 리스트 행 마감 UI | `.kium-sact-closed` — 정적 배지 `마감` + 텍스트 링크 `다음 회차 상담` · **1행 유지** |
| M4 | 상세 패널(`kium-04`) | 회차 블록에 `10.21` 마감 카드 렌더 · 정렬은 날짜순(마감은 뒤) |
| M5 | 모집 상태 `마감` 칩 선택 | 리스트 1건 · 스트립 0장 |
| M6 | **대비 실측** | `opacity:.72` 적용 상태에서 마감 배지·날짜 텍스트가 **AA(4.5:1) 충족**하는지. 미달 시 임의 수정 말고 **수치와 함께 보고** |
| M7 | 「다음 회차 상담」 클릭 | 프리필 **경로 B** 도달 (`· 희망 회차: … 마감 → 다음 회차 문의`) |

> M6는 README 후속 15번(마감 회차 대비 AA 미달 잠재)이 **처음 실제로 발현되는 지점**이다.

### 7-3. 0건 칩 미노출 (F22)

| # | 조건 | 기대 노출 칩 |
| --- | --- | --- |
| C1 | 기간 `전체` | `전체 / 모집중 / 개강확정 / 마감임박 / 마감` — **5개** |
| C2 | 기간 `11월` | `전체 / 모집중 / 개강확정 / 마감임박` — **4개** (마감 0건 → 미노출) |
| C3 | 기간 `12월` | `전체 / 모집중 / 개강확정 / 마감임박` — **4개** |
| C4 | 기간 `10월` | **5개 전부** — 4상태가 한 화면에 모인다 |
| C5 | 자동 해제 | `마감` 선택 상태에서 기간을 `12월`로 바꾸면 `status`가 `'all'`로 복귀 · 빈 화면에 갇히지 않음 |
| C6 | `전체` 칩 | 어떤 조건에서도 **항상 노출** |

### 7-4. Empty Case 검토 칩 (F23)

| # | 항목 | 기대 |
| --- | --- | --- |
| E1 | 고객 화면(`?preview` 없음) | `.kium-chip-review` **DOM 0건** |
| E2 | `?preview=cases` | 모집 상태 행 **맨 끝**에 `Empty Case` 칩 1개 |
| E3 | `?preview=badges` | 쇼케이스 블록 + `Empty Case` 칩 **둘 다** 노출 |
| E4 | 칩 선택 | `해당 조건의 회차가 없습니다.` + `필터 초기화` 버튼 노출 |
| E5 | 해제 | `필터 초기화` 클릭 → 전체 복귀 |
| E6 | 시각 구분 | 점선 테두리 — 다른 칩과 형태로 구분 |
| E7 | 접근성 | `aria-label`에 검토용임이 명시 · `aria-pressed` 갱신 |
| E8 | 카운트 | Empty 칩에 숫자 **미표기** |

### 7-5. 회귀

| # | 항목 | 조치 |
| --- | --- | --- |
| R1 | `verify-btype.mjs` `I6` 마감 노출 0건 | ★ **깨진다** — 이제 마감 1건이다. `마감 1건 · 스트립 0장`으로 기대값 교체 |
| R2 | `verify-btype.mjs` `H` 상태 단독 4종 | 새 분포로 갱신 (§3-3) |
| R3 | `verify-btype2.mjs` `Q8` 모집 상태 칩 | ★ **깨진다** — 칩 개수·카운트가 바뀐다. C1~C4 기준으로 교체 |
| R4 | `verify-btype2.mjs` `P4` 마감 회차 프리필 | ★ **SKIP 해제 가능** — `closed` 회차가 생겼으므로 실제 단언으로 승격 |
| R5 | 그 밖 | 전건 전수 조사 후 **단언을 삭제하지 말고 교체**하며 갱신 목록 보고 |

- 타 페이지 5경로 회귀 0 · `npm run build` 경고 0 · `tsc --noEmit` 0 · 신규 의존성 0
- 320/375/768/1024/1440 가로 넘침 0px — **`?preview=cases`로 칩이 하나 늘어난 상태 포함**

---

## 8. 완료 보고 양식

1. §2 F0-1~F0-11 대조 결과
2. 변경 파일 목록
3. §7-1 데이터 D1~D4 — **D3는 diff 원문**
4. §7-2 마감 UI M1~M7 — **M6은 대비 수치를 그대로**
5. §7-3 0건 칩 C1~C6 — **조건별 노출 칩 목록을 그대로**
6. §7-4 Empty 칩 E1~E8
7. §7-5 갱신한 단언 목록 (항목명 · 이전 기대값 → 새 기대값)
8. `npm run build` · `tsc` 결과
9. 스크린샷 — 기간 전체/10월/11월 칩 행 · 마감 카드(리스트·상세 패널) · `?preview=cases` Empty 화면 · 320/375/1440
10. 명세와 달리 판단한 부분과 사유
