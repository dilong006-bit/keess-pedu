'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import KiumCourseCard from './KiumCourseCard';
import KiumCoursePanel from './KiumCoursePanel';
import { useModal } from '@/lib/useModal';
import type { KiumCategory, KiumCourse } from '@/lib/kium/data';
import { isOpenCourse, type KiumSession } from '@/lib/kium/sessions';
import { IconCalendarDays } from './kiumIcons';

/** K6 — 필터 교체 out fade 120ms(FLIP 금지) */
const OUT_MS = 120;
/** K3 — 인라인 패널 grid-rows morph 시간(.kium-panel-slot transition .3s)과 맞춘다 */
const PANEL_MS = 300;
/** 패널 상단이 이 높이만큼 이미 드러나 있으면 "보인다"로 보고 스크롤하지 않는다(헤더·타이틀 노출 기준) */
const PANEL_REVEAL_PX = 160;
/** 스티키 바 하단과 패널 상단 사이 숨 쉴 여백 — 과정명이 바에 붙어 보이지 않게 한다 */
const PANEL_GAP_PX = 16;

/**
 * 스티키 크롬(전역 .nav + .kium-tabbar)의 고정 시 하단 y좌표.
 *
 * html{scroll-padding-top:35px}는 nav 하나만 있는 페이지 기준이라 이 페이지에서는 92px 모자란다.
 * 그대로 두면 패널 상단이 바 아래로 파고들어 과정명(.kium-detail-title)이 가려진다.
 * 탭바의 sticky top(=nav 높이)과 실제 높이를 읽어 계산하므로 바 높이가 바뀌어도 따라간다.
 */
function stickyBottom() {
  const bar = document.querySelector('.kium-tabbar');
  if (!bar) return 0;
  return parseFloat(getComputedStyle(bar).top || '0') + bar.getBoundingClientRect().height;
}
/** 데스크톱 인라인 확장 ↔ 모바일 바텀시트 분기 (전략 §6) */
const SHEET_MQ = '(max-width:767px)';

type Filter = 'all' | KiumCategory;

interface Props {
  courses: KiumCourse[];
  categories: { key: KiumCategory; label: string; count: number }[];
  /**
   * 상세 패널 DOM id 접두어. 기본 ''(기존 동작 그대로).
   * 공개교육 탭이 같은 과정으로 두 번째 그리드를 렌더하므로 id 충돌을 막기 위해 붙인다
   * — getElementById가 숨겨진 다른 탭의 패널을 잡아 스크롤 계산이 어긋나는 것을 방지한다.
   */
  idPrefix?: string;
  /**
   * 'open'이면 공개교육 탭 렌더(칩 축소·실사 썸네일·최근접 회차 배지·상세 회차 스트립).
   * 미지정이면 과정안내 탭 기존 렌더 그대로다.
   */
  variant?: 'default' | 'open';
  /** 공개교육 탭 전용 썸네일 맵 (data.ts 무변경) */
  thumbs?: Record<string, string>;
  now?: Date | null;
  onConsultSession?: (s: KiumSession) => void;
  onConsultCourse?: (c: KiumCourse) => void;
  /**
   * [B type STEP 2-3] 카테고리 필터 제어 모드.
   * 넘기면 상위(KiumCoursesTab)가 상태를 소유한다 — 세그먼트·스트립·모드 헤더가 같은 필터를 봐야 하기 때문.
   * 미지정이면 기존처럼 이 컴포넌트가 내부 state로 소유한다(과정안내 원래 동작).
   */
  cat?: Filter;
  onCat?: (c: Filter) => void;
  /**
   * [B type STEP 2-3] 필터 칩 행을 이 컴포넌트가 렌더하지 않는다.
   * 상위가 기간·모집 상태 행과 같은 골격(.kium-frow)으로 함께 렌더할 때 쓴다.
   */
  hideFilters?: boolean;
  /**
   * [B type STEP 5-1] 전체 보기 전용 — 개설 과정 카드에 '공개교육' 아웃라인 뱃지를 얹는다.
   * 카드가 `<button>`이라 뱃지를 그 안에 넣으면 중첩 인터랙티브가 된다 →
   * 카드 **바깥**(.kium-card-wrap)에 절대 배치해 확장 토글과 이벤트를 물리적으로 분리한다.
   */
  onOpenBadge?: (courseId: string) => void;
  /**
   * [B type STEP 4-2] 스트립 과정명 클릭 → 해당 카드로 스크롤 + 확장 + 2초 하이라이트 + 포커스.
   * 같은 과정을 연속으로 눌러도 반응해야 하므로 id가 아니라 nonce 변화를 신호로 쓴다.
   */
  focusCourse?: { id: string; nonce: number } | null;
}

/**
 * F7 과정 그리드 — 필터 칩 + 카드 그리드 + 상세 패널
 *
 * - 필터 상태는 `?cat=` 쿼리로 유지(history replace — 뒤로가기 스택 오염 없음)
 * - 데스크톱: 클릭한 카드의 행 아래 전폭 인라인 확장(그리드 문맥 유지)
 * - 모바일(<768px): 바텀시트(포커스 트랩·ESC·스와이프 다운 닫기·dim 40%)
 * - 정렬 옵션·검색 없음(§1-2). 카테고리당 최소 1과정이라 0건은 방어 문구만 유지
 */
export default function KiumCourseGrid({
  courses, categories, idPrefix = '', variant = 'default', thumbs, now = null,
  onConsultSession, onConsultCourse,
  cat: catProp, onCat, hideFilters = false, onOpenBadge, focusCourse = null,
}: Props) {
  // 제어/비제어 겸용 — catProp이 오면 상위가 소유, 아니면 종전대로 내부 state
  const controlled = catProp !== undefined;
  const [catUn, setCatUn] = useState<Filter>('all');
  const cat = controlled ? catProp : catUn;
  const setCat = (next: Filter) => (controlled ? onCat?.(next) : setCatUn(next));
  const [openId, setOpenId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const [cols, setCols] = useState(3);
  const [sheet, setSheet] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const outTimer = useRef<ReturnType<typeof setTimeout>>();
  /**
   * focusCourse 경로에서는 카드 기준으로 이미 스크롤했으므로 패널 기준 재보정을 한 번 건너뛴다.
   * 두 스크롤이 겹치면 화면이 두 번 튄다.
   */
  const skipPanelScroll = useRef(false);

  const visible = cat === 'all' ? courses : courses.filter((c) => c.category === cat);
  const openCourse = visible.find((c) => c.id === openId) ?? null;

  // ── 반응형 열 수 + 시트 분기 (인라인 패널 삽입 위치 계산에 필요) ────────
  useEffect(() => {
    const sheetMq = window.matchMedia(SHEET_MQ);
    const twoMq = window.matchMedia('(max-width:1000px)');
    const sync = () => {
      setSheet(sheetMq.matches);
      setCols(sheetMq.matches ? 1 : twoMq.matches ? 2 : 3);
    };
    sync();
    sheetMq.addEventListener('change', sync);
    twoMq.addEventListener('change', sync);
    return () => {
      sheetMq.removeEventListener('change', sync);
      twoMq.removeEventListener('change', sync);
    };
  }, []);

  // ── ?cat= 초기 반영 (잘못된 값 → 전체) ────────────────────────────────
  useEffect(() => {
    if (controlled) return; // 제어 모드: ?cat= 초기 반영은 상위(KiumCoursesTab) 책임
    const raw = new URLSearchParams(window.location.search).get('cat');
    if (raw && categories.some((c) => c.key === raw)) setCatUn(raw as KiumCategory);
  }, [categories, controlled]);

  useEffect(() => () => clearTimeout(outTimer.current), []);

  // K3 — 인라인 패널은 닫힌 상태로 마운트한 뒤 다음 프레임에 열어 height morph를 태운다.
  // 이어서 패널을 뷰포트 안으로 끌어와, 화면 밖에서 열려 놓치는 경우를 없앤다.
  //
  // 스크롤은 morph가 끝난 뒤에 건다. 확장 전 패널은 grid-template-rows:0fr이라 높이가 0이고,
  // 0px 요소를 기준으로 계산하면 패널이 그대로 화면 밖에서 펼쳐진다.
  // 모바일 바텀시트(sheet)는 이 분기를 타지 않는다.
  useEffect(() => {
    if (!openId || sheet) {
      setSlotOpen(false);
      return;
    }
    const raf = requestAnimationFrame(() => setSlotOpen(true));
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      if (skipPanelScroll.current) {
        skipPanelScroll.current = false;
        return;
      }
      const panel = document.getElementById(`${idPrefix}kium-panel-${openId}`);
      if (!panel) return;
      const chrome = stickyBottom();
      const { top } = panel.getBoundingClientRect();
      // 스티키 바 아래로 이미 충분히 드러나 있으면 화면을 흔들지 않는다.
      // 기준선이 0이 아니라 chrome인 것이 핵심 — 바에 가려진 패널은 "보이는" 게 아니다.
      if (top >= chrome && top <= window.innerHeight - PANEL_REVEAL_PX) return;
      // 패널 상단을 스티키 바 바로 아래에 세워 과정명이 첫 시선에 걸리게 한다.
      window.scrollBy({ top: top - chrome - PANEL_GAP_PX, behavior: rm ? 'auto' : 'smooth' });
    }, PANEL_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [openId, sheet, idPrefix]);

  /**
   * [B type STEP 4-2] 외부 요청으로 카드를 연다.
   * 순서가 중요하다 — ①카드를 화면 중앙으로 ②확장 ③2초 하이라이트 ④포커스(preventScroll).
   * 포커스가 스크롤을 다시 잡으면 ①이 무의미해지므로 preventScroll은 선택이 아니라 필수다.
   */
  useEffect(() => {
    if (!focusCourse) return;
    const wrap = document.getElementById(`${idPrefix}kium-cardwrap-${focusCourse.id}`);
    if (!wrap) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    skipPanelScroll.current = true;
    wrap.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'center' });
    setOpenId(focusCourse.id);
    setFlashId(focusCourse.id);
    wrap.querySelector<HTMLButtonElement>('.kium-card')?.focus({ preventScroll: true });
    const t = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(t);
    // nonce만 신호로 쓴다 — 같은 과정을 다시 눌러도 재실행되어야 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCourse?.nonce, idPrefix]);

  /** 필터 교체 — out fade 120ms → in stagger */
  const changeCat = (next: Filter) => {
    if (next === cat) return;
    setOpenId(null);
    setPhase('leaving');
    clearTimeout(outTimer.current);
    outTimer.current = setTimeout(() => {
      setCat(next);
      setPhase('entering');
      // 쿼리 동기화(공유 가능) — replace라 뒤로가기 스택을 늘리지 않는다
      const url = new URL(window.location.href);
      if (next === 'all') url.searchParams.delete('cat');
      else url.searchParams.set('cat', next);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      outTimer.current = setTimeout(() => setPhase('idle'), 300);
    }, OUT_MS);
  };

  const closeSheet = useCallback(() => setOpenId(null), []);
  const sheetRef = useModal(sheet && !!openCourse, closeSheet);

  // 스와이프 다운 닫기 (바텀시트)
  const dragY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    dragY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragY.current === null) return;
    if (e.changedTouches[0].clientY - dragY.current > 60) closeSheet();
    dragY.current = null;
  };

  // 인라인 패널은 "열린 카드가 속한 행"의 마지막 카드 뒤에 삽입한다
  const openIndex = openCourse ? visible.findIndex((c) => c.id === openCourse.id) : -1;
  const insertAfter = openIndex < 0 ? -1 : Math.min(Math.floor(openIndex / cols) * cols + cols - 1, visible.length - 1);

  const panelId = (id: string) => `${idPrefix}kium-panel-${id}`;
  const panelTitleId = (id: string) => `${idPrefix}kium-panel-title-${id}`;

  return (
    <>
      {/* 필터 칩 — [전체] + 7카테고리, 카운트 병기.
          hideFilters면 상위가 .kium-frow 행으로 같은 칩을 렌더한다(중복 생성 금지) */}
      {!hideFilters && (
      <div className="kium-filters" role="group" aria-label="과정 카테고리 필터">
        <button
          type="button"
          className="kium-chip"
          aria-pressed={cat === 'all'}
          onClick={() => changeCat('all')}
        >
          전체 <span className="cnt">{courses.length}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className="kium-chip"
            aria-pressed={cat === c.key}
            onClick={() => changeCat(c.key)}
          >
            {c.label} <span className="cnt">{c.count}</span>
          </button>
        ))}
      </div>
      )}

      <p className="kium-count" aria-live="polite">
        {visible.length}개 과정
      </p>

      {visible.length === 0 ? (
        <p className="kium-empty">해당 카테고리의 과정을 준비하고 있습니다.</p>
      ) : (
        <div className={`kium-grid${phase === 'idle' ? '' : ` ${phase}`}`}>
          {visible.map((course, i) => (
            <Fragment key={course.id}>
              <div
                className={`kium-card-wrap${flashId === course.id ? ' is-flash' : ''}`}
                id={`${idPrefix}kium-cardwrap-${course.id}`}
                style={{ animationDelay: `${(i % 9) * 0.04}s` }}
              >
                <KiumCourseCard
                  course={course}
                  open={openCourse?.id === course.id}
                  panelId={panelId(course.id)}
                  onToggle={() => setOpenId(openCourse?.id === course.id ? null : course.id)}
                  variant={variant}
                  thumbSrc={thumbs?.[course.id]}
                  now={now}
                />
                {/* 개설 뱃지 — 카드(button) 형제라 확장 토글과 이벤트가 섞이지 않는다 */}
                {onOpenBadge && isOpenCourse(course.id) && (
                  <button
                    type="button"
                    className="kium-openflag"
                    data-evt="kium_mode_open"
                    onClick={() => onOpenBadge(course.id)}
                    aria-label={`${course.titleMarketing} — 공개교육 일정 보기로 전환`}
                  >
                    <IconCalendarDays size={14} />
                    <span>공개교육</span>
                  </button>
                )}
              </div>
              {/* 인라인 확장(데스크톱·태블릿) — 행의 마지막 카드 뒤 전폭 슬롯 */}
              {!sheet && i === insertAfter && openCourse && (
                <div
                  className={`kium-panel-slot${slotOpen ? ' open' : ''}`}
                  id={panelId(openCourse.id)}
                  role="region"
                  aria-labelledby={panelTitleId(openCourse.id)}
                >
                  <div className="kium-panel-clip">
                    <KiumCoursePanel
                      course={openCourse}
                      titleId={panelTitleId(openCourse.id)}
                      variant={variant}
                      now={now}
                      onConsultSession={onConsultSession}
                      onConsultCourse={onConsultCourse}
                    />
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {/*
        모바일 바텀시트 — document.body로 포털한다.
        position:fixed는 transform/filter를 가진 조상이 있으면 그 조상을 기준으로 배치되는데,
        이 컴포넌트는 애니메이션이 걸린 탭 패널 안에 있어 시트가 뷰포트 밖으로 밀리는 문제가 있었다.
        포털로 올려 두면 조상의 스택 컨텍스트 변화와 무관하게 항상 뷰포트 기준으로 고정된다.
      */}
      {sheet && createPortal(
        <>
          <div
            className={`kium-sheet-dim${openCourse ? ' open' : ''}`}
            onClick={closeSheet}
            aria-hidden="true"
          />
          <div
            className={`kium-sheet${openCourse ? ' open' : ''}`}
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={openCourse ? panelTitleId(openCourse.id) : undefined}
            aria-hidden={!openCourse}
            id={openCourse ? panelId(openCourse.id) : undefined}
          >
            <div className="kium-sheet-handle" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <span />
            </div>
            <button type="button" className="kium-sheet-close" onClick={closeSheet} aria-label="닫기" data-autofocus>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="kium-sheet-body">
              {openCourse && (
                <KiumCoursePanel
                  course={openCourse}
                  titleId={panelTitleId(openCourse.id)}
                  variant={variant}
                  now={now}
                  onConsultSession={onConsultSession}
                  onConsultCourse={onConsultCourse}
                />
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
