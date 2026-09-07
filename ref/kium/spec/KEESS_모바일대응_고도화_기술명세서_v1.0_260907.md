# KEESS 모바일 대응 고도화 기술명세서 v1.1

> **개정 이력**
> - **v1.0 (260907)** — 최초 작성.
> - **v1.1 (260907)** — 구현 전 §1 대조에서 **F2 · F4 · F8 · F14 4건 불일치**가 확인되어 개정.
>   문서 상단 제목만 v1.1로 올리고 **파일명은 유지**한다(참조 링크 보존).
>   틀렸던 서술은 지우지 않고 **무엇이 왜 틀렸는지 한 줄씩 남긴다** — 다음 사람이 같은 조사 누락을 반복하지 않게 하는 것이 목적이다.
>
> | # | v1.0 서술 | 실제 | 왜 틀렸나 |
> | --- | --- | --- | --- |
> | F2 | `:hover` 60건 | **소스 전체 105건**(`:focus` 결합 34건) | **홈 페이지 런타임 스캔값(50건 내외)을 소스 전체 수치로 오기**했다. 런타임 스캔은 그 페이지가 실제로 로드한 CSS만 보므로 페이지마다 다르다 |
> | F4 | body scroll lock 0건 | **`lib/useModal.ts` · `Nav.tsx` 2곳에 존재** | `lib/` 를 조사 범위에서 빠뜨렸다. 특히 **시트가 이미 `useModal` 을 쓰고 있어**(`KiumCourseGrid.tsx:216`) v1.0의 §4-2 지시대로 하면 이중 잠금이 된다 |
> | F8 | `.report-link{padding:0}` | `padding` **선언 없음** | 실효는 동일(기본값 0)하나 표기가 다르다. 결론 무영향 |
> | F14 | 320px clientWidth **257** | **272** (scrollWidth 665는 일치) | 측정 시점의 스크롤바/여백 차이로 보인다. "뷰포트의 2.6배"가 2.4배로 완화될 뿐 **조치 방향은 동일** |

- 대상 저장소: `KEESS_pedu` · 기준 커밋 `81f6935`
- 기능 ID: **MO-01 ~ MO-08**
- 상위 문서: `ref/kium/strategy/KEESS_모바일대응_고도화전략_v1.0_260907.md`
- 대상 파일: `styles/components.css` · `styles/kium.css` · `styles/kium-open.css` · `styles/home.css` · `components/kium/KiumCourseGrid.tsx`
- 성격: **CSS 중심 + 시트 스크롤 잠금 1건**. 레이아웃 구조·컴포넌트 트리 변경 없음

---

## 1. 실사로 확정된 사실 (구현 전 대조)

| # | 사실 | 위치 |
| --- | --- | --- |
| F1 | 폼 입력 전건 `font-size:15px` (단일 선언) | `components.css:250` `.field input,.field select,.field textarea` |
| F2 | ~~`:hover` 규칙 60건~~ → **소스 전체 105건**(`:focus`/`:focus-visible` 결합 **34건**), `@media (hover:hover)` 가드 **0건**. 런타임 스캔값은 페이지별로 다르다(홈 50건) — v1.0은 이 값을 소스 전체로 오기했다. 파일별: `components.css` 29 · `content.css` 12 · `csr.css` 12(전건 결합) · `kium-open.css` 11(전건 결합) · `kium.css` 11(9건 결합) · `home.css` 10 · `axai.css` 9 · `hrd.css` 5 · `error.css` 3 · `leadership.css` 3 | 전 CSS (소스 스캔) |
| F3 | `overscroll-behavior` 선언 **1건뿐** | `components.css:550` `.subnav-in{overscroll-behavior-x:contain}` |
| F4 | ~~body scroll lock 구현 0건~~ → **2곳에 존재**. ① `lib/useModal.ts:15` `body.style.overflow='hidden'` — **시트가 이미 이 훅을 사용 중**(`KiumCourseGrid.tsx:216`)이며 `Modal`·`ReportModal`도 같다. ② `Nav.tsx:88~159` — `position:fixed` + `scrollTo` **완성형**(복원 시 `scrollBehavior`를 임시 `auto`로 두는 처리까지 포함) | `lib/useModal.ts` · `components/common/Nav.tsx` |
| F5 | `.kium-sheet-close` = `width:34px;height:34px` | `kium.css:561` |
| F6 | `.consent-main input` = `width:18px;height:18px` | `components.css:301` |
| F7 | `.consent-view` = `padding:4px;font-size:12.5px` (실측 53×28) | `components.css:307` |
| F8 | `.report-link` — ~~`padding:0`~~ → **`padding` 선언 없음**(실효 동일 · 표기만 상이, 실측 높이 21) | `components.css:382` |
| F9 | `.mchip` = `padding:8px 14px` (실측 높이 40) / **`.mchip-sub`는 이미 `min-height:44px`** | `components.css:256·264` |
| F10 | `.sns a` = `width:36px;height:36px` | `components.css:367` |
| F11 | `.hero{min-height:100vh}` (dvh 미적용) | `home.css:14` |
| F12 | `.kium-sheet{max-height:88vh}` (dvh 미적용) | `kium.css:554` |
| F13 | `.kium-filters` 가로 스크롤 · snap 없음 · mask 있음 / `.kium-ustrip`·`.kium-strip` snap 있음 · mask 없음 | `kium.css:325` · `kium-open.css:246·405` |
| F14 | 320px 실측: `.kium-filters` clientWidth ~~257~~ → **272** vs scrollWidth **665**(일치). 뷰포트의 2.4배 — v1.0이 든 2.6배보다 완화되나 **조치 방향 동일** | 실측 |
| F15 | 문서 가로 스크롤 320·390px **0건** (현행 정상) | 실측 |

하나라도 다르면 **구현을 중단하고 불일치 내역을 보고**합니다.

---

## 2. MO-01: 입력 폰트 16px 하한 (P0)

### 대상
`components.css:250`

### 변경
```css
.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:11px;
  padding:12px 14px;font-family:inherit;font-size:16px;background:#fff;color:var(--ink);
  transition:border-color .25s var(--ease)}
```

`15px` → **`16px`** 단일 값 변경.

### 근거
iOS Safari는 16px 미만 입력에 포커스하면 페이지를 강제 확대하고 **복귀시키지 않습니다.** 확대 후에는 전 영역에 가로 스크롤이 생겨 폼 이탈로 이어집니다.

### 금지
- `user-scalable=no` / `maximum-scale=1`로 우회 **금지** (확대 자체를 막는 것은 WCAG 1.4.4 위반)
- 데스크톱만 15px로 되돌리는 분기 금지 (1px 차이로 분기를 늘리지 않습니다)

### 파급
입력 높이 50px는 `padding:12px 14px` 기준이므로 폰트 1px 증가분만큼 **52px 내외로 증가**합니다. 폼 전체 높이가 소폭 늘어나는 것은 허용합니다.

---

## 3. MO-02: hover 가드 (P0)

### 원칙
`:hover` 선언은 **hover 가능한 기기에서만** 적용합니다. `:focus-visible`은 가드 **밖에 유지**합니다(키보드 접근성).

### 방법
각 CSS 파일에서 `:hover`를 포함한 규칙을 다음 래퍼로 감쌉니다.

```css
@media (hover:hover) and (pointer:fine){
  /* 기존 :hover 규칙 그대로 이동 */
}
```

### ★ 분리 규칙 (중요)

현행 다수 규칙이 `A:hover,A:focus-visible{...}` 형태로 **묶여 있습니다.** 통째로 가드 안에 넣으면 **터치 기기에서 포커스 링이 사라집니다.**

반드시 둘로 나눕니다.

```css
/* 변경 전 */
.kium-sact:hover,.kium-sact:focus-visible{border-color:var(--p1);background:var(--surface)}

/* 변경 후 */
.kium-sact:focus-visible{border-color:var(--p1);background:var(--surface)}
@media (hover:hover) and (pointer:fine){
  .kium-sact:hover{border-color:var(--p1);background:var(--surface)}
}
```

### 우선 대상 (터치 고착이 눈에 보이는 것)

| 셀렉터 | 위치 | 고착 시 증상 |
| --- | --- | --- |
| `.kium-sheet-close:hover` | `kium.css:565` | 닫기 버튼이 **검은 원**으로 남음 |
| `.kium-scard2-course:hover` | `kium-open.css:434` | 과정명 밑줄 잔류 |
| `.kium-sact:hover` | `kium-open.css:356` | 회차 버튼 테두리·배경 잔류 |
| `.kium-openflag:hover` | `kium-open.css:454` | 뱃지 반전 잔류 |
| `.consent-view:hover` | `components.css:308` | 동의 보기 링크 색 잔류 |
| `.mchip:hover` 계열 | `components.css` | 필터 칩 잔류 |

**전 CSS 60건 전수 처리**하되, 위 6종은 검증에서 개별 확인합니다.

### 금지
- `:focus-visible`을 가드 안으로 넣지 말 것
- `:active` 규칙은 가드 대상 아님 (터치에서 정상 동작)
- hover 규칙을 **삭제하지 말 것** (데스크톱 렌더 무변경이 조건)

---

## 4. MO-03: 배경 스크롤 잠금 (P0) — **v1.1 전면 재작성**

> **v1.0의 지시는 철회한다.** v1.0은 `KiumCourseGrid.tsx`에 새 `useEffect`를 추가하라고 했으나,
> **시트는 이미 `lib/useModal.ts`를 통해 `body.style.overflow='hidden'`으로 잠그고 있다**(F4).
> 그 위에 두 번째 잠금을 얹으면 두 이펙트가 각자 `body.style`을 저장·복원하게 되고,
> cleanup 순서에 따라 `overflow:hidden`(또는 `position:fixed`)이 남아 **페이지 전체가 굳는다.**
>
> v1.0 §4-3의 *"잠금 로직을 전역 유틸로 분리하지 말 것 (현재 시트는 1개소)"* 문장도 **철회한다** —
> 이미 전역 유틸이 존재한다는 사실을 모르고 쓰인 문장이었다.

### 4-1. CSS: 스크롤 연쇄 차단 (v1.0과 동일 · 유지)

```css
.kium-sheet-body{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  padding:0 0 calc(20px + env(safe-area-inset-bottom))}
```

`overscroll-behavior:contain` **1선언 추가**. TSX와 독립적으로 유효하므로 커밋 1에 포함한다.

### 4-2. 대상은 `lib/useModal.ts` **하나**

시트 · `Modal` · `ReportModal` **세 곳이 전부 이 훅을 쓴다.** 훅을 고치면 세 곳이 동시에 해결되고
**이중 잠금 가능성 자체가 생기지 않는다.**

`Nav.tsx`는 **건드리지 않는다** — 이미 완성형이고 CLAUDE.md §5-1 필수 기능(모바일 드로어)에 묶여 있다.
두 구현이 남는 것은 중복이 아니라 **위험 분리**다.

```ts
// 잠금
const y = window.scrollY;
const body = document.body;
// [이중 잠금 가드] Nav 드로어가 이미 잠갔다면 손대지 않는다.
const alreadyLocked = body.style.position === 'fixed';
const prev = { position: body.style.position, top: body.style.top, left: body.style.left,
               right: body.style.right, width: body.style.width, overflow: body.style.overflow };
if (!alreadyLocked) {
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
}

// 복원 — 순서가 곧 정확성이다
return () => {
  if (!alreadyLocked) {
    Object.assign(body.style, prev);                 // ① body.style 복원
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';              // ② 부드러운 스크롤 차단
    window.scrollTo(0, y);                           // ③ 위치 복원
    html.style.scrollBehavior = prevBehavior;        // ④ 원복
  }
  lastFocus.current?.focus({ preventScroll: true }); // ⑤ 포커스 (스크롤 유발 금지)
};
```

### 4-3. 세 가지 필수 조건

| # | 조건 | 빠뜨리면 |
| --- | --- | --- |
| 1 | `position:fixed` 방식 | `overflow:hidden` 단독으로는 **iOS Safari에서 배경 스크롤이 막히지 않는다** |
| 2 | `scrollBehavior`를 임시 `auto` | 부드러운 스크롤이 끼어들어 **복원이 애니메이션으로 보인다**(`Nav.tsx`가 이미 그렇게 하고 있다) |
| 3 | `focus({ preventScroll: true })`를 **마지막**에 | `focus()`는 대상으로 스크롤을 유발해 `window.scrollTo`와 **경쟁한다**. v1.0 시점 `useModal:53`은 body 복원 뒤 그냥 `focus()`를 호출하고 있었다 |

### 4-4. 이중 잠금 가드

Nav 드로어가 열린 상태에서 모달이 열리면 두 구현이 같은 `body.style`을 각자 저장·복원한다.
Nav가 먼저 잠그면 모달의 `prev`에는 이미 `position:fixed`가 담기고, 모달을 닫아도 그 값이 되살아난다.

→ **잠금 직전에 `body.style.position === 'fixed'`를 확인**해 이미 잠겨 있으면 잠금도 복원도 하지 않는다.
`alreadyLocked`는 이펙트 스코프 지역 변수로 둔다(ref 불필요 — 이펙트 1회 실행에 묶인 값이다).

### 4-5. 컨테이닝 블록 주의 (v1.0과 동일 · 유지)

`kium.css:129` 주석에 이미 기록된 사항이다. 조상에 `transform`·`filter`·`contain`이 남아 있으면
`position:fixed` 자손(시트)의 기준이 그 조상이 된다. **시트 조상에 변환 계열 속성을 새로 추가하지 않는다.**

### 4-6. 회귀 확인 대상 3곳 (전부 필수)

| # | 대상 | 확인 |
| --- | --- | --- |
| 1 | `/kium` 모바일 시트 (`KiumCourseGrid.tsx:216`) | 열기 → 내부 스크롤 → 닫기 → **스크롤 위치가 열기 직전과 동일** |
| 2 | `components/common/Modal.tsx` 사용 전 지점 | 동일 |
| 3 | `components/common/ReportModal.tsx` | 동일 + **부정훈련 신고 3탭 모달은 CLAUDE.md §5-1 필수 기능** — 3탭 전환 · 폼 입력 · 제출 · ESC · 스크림 닫기 전건 확인. 입력 폼을 포함하므로 `position:fixed` 상태에서 포커스 시 화면이 튀지 않는지도 본다(MO-01로 16px이 되어 확대는 발생하지 않아야 한다) |

### 금지

- 스크롤 위치 복원 생략 금지
- `body{overflow:hidden}` 단독 사용 금지
- `Nav.tsx` 통합 금지 (위험 분리)
- `KiumCourseGrid.tsx`에 새 잠금 `useEffect` 추가 금지 (이중 잠금)

---

## 5. MO-04: 터치 타깃 44px (P0)

### 원칙
**보이는 크기는 바꾸지 않고 히트 영역만 확장**합니다. 시각 회귀를 만들지 않기 위해서입니다.

### 5-1. 확장 유틸 (신규 1개)

`components.css`에 추가합니다.

```css
/* 히트 영역 확장: 시각 크기는 그대로 두고 터치 타깃만 44px로 넓힌다.
   ::after 를 쓰므로 레이아웃에 영향이 없다(부모 position:relative 필요). */
.tap44{position:relative}
.tap44::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  width:max(100%,44px);height:max(100%,44px)}
```

### 5-2. 적용 대상

| # | 대상 | 현행 | 조치 |
| --- | --- | --- | --- |
| 1 | `.kium-sheet-close` (`kium.css:561`) | 34×34 | `width:44px;height:44px`로 **직접 확대**. 아이콘 크기는 유지. 우상단 위치값(`top:12px;right:14px`)은 `top:8px;right:10px`로 조정해 시각 정렬 보존 |
| 2 | `.consent-main` (`components.css:300`) | 라벨 높이 약 32 | `min-height:44px` 추가. **라벨이 체크박스의 실제 터치 타깃**이므로 input 크기는 18px 유지 |
| 3 | `.consent-view` (`components.css:307`) | 53×28 | `padding:4px` → `padding:4px 8px` + `min-height:44px` + `display:inline-flex;align-items:center` |
| 4 | `.report-link` (`components.css:382`) | 높이 21 | `.tap44` 유틸 클래스를 마크업에 부여 (푸터 레이아웃 보존) |
| 5 | `.mchip` (`components.css:256`) | 높이 40 | `min-height:44px` 추가. **`.mchip-sub`가 이미 44px이므로 같은 파일 안의 선례를 따르는 것** |
| 6 | `.sns a` (`components.css:367`) | 36×36 | 시각 원은 36px 유지, `.tap44` 유틸 적용 |

### 5-3. 인접 간격 (MO-04b)

`.kium-tab` 간 실측 4px → **8px 이상**으로. 탭 컨테이너의 `gap`만 조정합니다.

### 금지
- 체크박스 `input` 자체를 44px로 키우지 말 것 (동의 폼 시각 붕괴)
- `.tap44::after`에 배경·테두리 부여 금지 (투명 히트 영역 전용)
- 아이콘 SVG 크기 변경 금지

---

## 6. MO-05: `dvh` 승격 (P1)

`components.css:183`에 이미 확립된 정책(`100vh` 선언 후 `100dvh`로 덮어쓰기)을 두 곳에 적용합니다.

| 대상 | 변경 |
| --- | --- |
| `home.css:14` `.hero` | `min-height:100vh` → `min-height:100vh;min-height:100dvh` |
| `kium.css:554` `.kium-sheet` | `max-height:88vh` → `max-height:88vh;max-height:88dvh` |

**미지원 브라우저 폴백을 위해 `vh` 선언을 앞에 남깁니다.** 삭제하지 마십시오.

---

## 7. MO-06: 가로 스크롤 정책 단일화 (P1)

가로 스크롤 컨테이너 4종에 **동일 3속성**을 부여합니다.

| 컨테이너 | 위치 | 현재 부족분 |
| --- | --- | --- |
| `.kium-filters` | `kium.css:325` | snap 없음 · overscroll 없음 |
| `.kium-ustrip` | `kium-open.css:405` | overscroll 없음 · mask 없음 |
| `.kium-strip` (MO) | `kium-open.css:246` | overscroll 없음 · mask 없음 |
| `.subnav-in` | `components.css:550` | snap 없음 (overscroll 보유) |

### 공통 부여

```css
overscroll-behavior-x:contain;   /* 전 4종: 뒤로가기 제스처 연쇄 차단 */
scroll-snap-type:x proximity;    /* .kium-filters · .subnav-in 에 추가 */
```

### ★ snap 강도 주의
칩 행에는 `mandatory`가 아니라 **`proximity`**를 씁니다. `mandatory`는 칩 개수가 적을 때 스크롤이 튀어 조작감을 해칩니다. 스트립(`.kium-ustrip`·`.kium-strip`)의 기존 `x mandatory`는 **카드 단위 훑기 목적이므로 그대로 둡니다.**

### mask 페이드 승격
`.kium-filters`의 `mask-image` 패턴을 `.kium-ustrip`·`.kium-strip`에도 적용해 "우측에 더 있음"을 동일하게 알립니다.

---

## 8. MO-07: 필터 칩 가시성 (P1)

320px에서 `.kium-filters` 콘텐츠가 뷰포트의 **2.6배**(257 vs 665)입니다. 「마감」·「Empty Case」가 초기 화면 밖입니다.

### 조치 (구조 변경 없이)
1. 칩 좌우 `padding`을 `10px 14px` → **`10px 12px`**로 축소 (칩당 약 4px 절감)
2. 상태 칩 행의 `gap` `8px` → **`6px`**
3. MO-06의 mask 페이드 + snap으로 스크롤 가능성 인지 강화

### 금지
- 칩 라벨 축약 금지 (「마감임박」을 「임박」으로 줄이는 등)
- 칩 행을 2줄로 되돌리지 말 것 (모바일 세로 공간 손실)
- **F22(0건 칩 미노출) 규칙을 건드리지 말 것**

---

## 9. MO-08: 시트 핸들 어포던스 정합 (P2 · 본 건 포함)

`.kium-sheet-handle{cursor:grab;touch-action:none}`은 드래그를 암시하나 드래그 닫기 동작이 없습니다.

### 조치
- `cursor:grab` **제거** (드래그 가능하다는 잘못된 신호 제거)
- `touch-action:none` **제거** (제스처를 막을 이유가 없음)
- 시각적 핸들 바(`span`)는 **유지** (바텀시트 관습 표기)

드래그 닫기 구현은 별건입니다.

---

## 10. 전역 금지

- 레이아웃 구조·컴포넌트 트리 변경 금지
- **데스크톱 렌더 변경 금지** (전 변경은 터치·모바일 조건에서만 발현되거나 시각 중립)
- 신규 브레이크포인트 추가 금지. 불가피하면 **560 / 767 / 880 중 택1**
- `user-scalable=no` · `maximum-scale` 사용 금지
- `:hover` 규칙 삭제 금지 (가드로 감싸기만)
- 폰트 하한(11px 계열) 일괄 상향 금지 (2차 범위)
- 브레이크포인트 19종 통합 금지 (별건)
- 신규 의존성 추가 금지
- `/kium` 회차 데이터(`lib/kium/sessions.ts`) 무변경

---

## 11. 검증

### 11-1. 계측 (320 / 360 / 390 / 430px)

| # | 항목 | 기대 |
| --- | --- | --- |
| V1 | 문서 가로 스크롤 | 전 뷰포트 **0건** (현행 유지) |
| V2 | 조상 클리핑 제외 오버플로 | **0건** |
| V3 | 폼 입력 `font-size` | 전건 **16px 이상** |
| V4 | `:hover` 규칙 중 가드 밖 | **0건** — 소스 전체 **105건 기준**(v1.0의 60건은 오기). 런타임 스타일시트 스캔 + 소스 스캔 양쪽으로 확인 |
| V5 | `:focus-visible` 규칙 | 가드 **밖에 존재** (터치 기기에서도 유효) |
| V6 | `.kium-sheet-close` | **44×44** |
| V7 | `.consent-main` · `.consent-view` · `.mchip` | **높이 44 이상** |
| V8 | `.report-link` · `.sns a` | 히트 영역 **44 이상** (시각 크기는 각각 21 · 36 유지) |
| V9 | 가로 스크롤 컨테이너 4종 | 전건 `overscroll-behavior-x:contain` |
| V10 | `.kium-filters` | `scroll-snap-type` = `x proximity` |
| V11 | `.kium-ustrip` · `.kium-strip` | `scroll-snap-type` = `x mandatory` (**무변경**) |
| V12 | `.kium-filters` scrollWidth | 320px에서 **665 미만으로 감소** |
| V13 | `.hero` · `.kium-sheet` | `dvh` 적용 · `vh` 폴백 **잔존** |

### 11-2. 동작

| # | 항목 | 기대 |
| --- | --- | --- |
| B1 | **모달 3종**(시트 · `Modal` · `ReportModal`) 열림 중 배경 스크롤 | **0px** |
| B2 | **모달 3종** 닫은 뒤 스크롤 위치 | **열기 직전 위치로 복원** (v1.1 §4-2가 훅 하나를 고치므로 3종 전건이 대상) |
| B3 | 모달 내부 스크롤 끝 | 배경으로 연쇄 **없음** |
| B3-b | Nav 드로어 열린 상태에서 모달 열기·닫기 | `alreadyLocked` 가드 동작 — `position:fixed` 잔류 **0** |
| B4 | 터치 후 hover 잔류 | 우선 대상 6종 전건 **없음** |
| B5 | 키보드 Tab 이동 | 포커스 링 **정상 표시** (V5 연동) |
| B6 | 폼 입력 포커스 | iOS에서 확대 **미발생** |
| B7 | 필터 칩 가장자리 스와이프 | 브라우저 뒤로가기 **미발생** |

### 11-3. 회귀

| # | 항목 |
| --- | --- |
| R1 | **데스크톱(1280·1920px) 시각 회귀 0** |
| R2 | 기존 검증 스크립트 2종 전건 통과 (`verify-btype.mjs` · `verify-btype2.mjs`) |
| R3 | 타 페이지 5경로 회귀 0 |
| R4 | `npm run build` 경고 0 · `tsc --noEmit` 0 |
| R5 | F22(0건 칩 미노출) · BT-27(CTA 줄밀림) 동작 유지 |

### 11-4. 문서

| # | 조치 |
| --- | --- |
| N1 | README 작업 이력에 **MO-01~MO-08** 항목 신설. 계측 근거(실측 수치)와 제외 범위(M9 브레이크포인트 통합 · M10 폰트 하한) 명기 |
| N2 | `components.css` 상단에 hover 가드 정책 주석 추가: "`:hover`는 `@media (hover:hover) and (pointer:fine)` 안에서만 선언한다. `:focus-visible`은 가드 밖에 둔다" |

---

## 12. 완료 보고 양식

1. §1 F1~F15 대조 결과
2. 변경 파일 목록
3. `:hover` 가드 처리 건수 (전체 **105건** 대비 처리 수 · 분리한 `:focus`/`:focus-visible` 수 — **34건과 일치해야 한다**)
4. §11-1 V1~V13 계측값 **원문 그대로** (뷰포트 4종)
5. §11-2 B1~B7 동작 확인
6. §11-3 R1~R5
7. §11-4 README·주석 갱신 결과
8. 스크린샷: 320px 필터 칩 행 · 시트 열림 상태 · 도입문의 폼 입력 포커스 · 데스크톱 1280px 비교
9. 명세와 달리 판단한 부분과 사유
