'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KiumCourseGrid from './KiumCourseGrid';
import KiumFaq from './KiumFaq';
import UpcomingSessionsStrip from './UpcomingSessionsStrip';
import BadgeShowcase from './BadgeShowcase';
import {
  IconAlarmClock,
  IconArrowRight,
  IconCalendarDays,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleSlash,
} from './kiumIcons';
import { KIUM_CONTENT } from '@/lib/kium/content';
import { KIUM_OPEN_THUMBS } from '@/lib/kium/openThumbs';
import { getAllCourses, getCategoryCounts, getCourseById, getOpenFaq } from '@/lib/kium/queries';
import type { KiumCategory, KiumCourse } from '@/lib/kium/data';
import {
  KIUM_SESSIONS,
  KIUM_SESSION_META,
  KIUM_STATUS_ORDER,
  countByStatus,
  effectiveStatus,
  getOpenCourses,
  getSessionById,
  isPast,
  openCategoryCounts,
  type KiumSession,
  type KiumSessionStatus,
} from '@/lib/kium/sessions';
import {
  consultCourse,
  consultOpenRequest,
  consultSession,
  dispatchPrefill,
  prefillTextA,
  prefillTextB,
  scrollToInquiry,
} from '@/lib/kium/openBridge';

type Mode = 'all' | 'open';
type Month = 'all' | 10 | 11 | 12;
type Cat = 'all' | KiumCategory;

const MONTHS = [10, 11, 12] as const;

/** 상태 필터 칩 아이콘 — SessionBadge와 같은 Lucide 심볼. 색은 CSS(data-st)가 준다 */
const STATUS_ICON: Record<KiumSessionStatus, (p: { size?: 14 }) => JSX.Element> = {
  recruiting: IconCircleDashed,
  confirmed: IconCircleCheck,
  closing: IconAlarmClock,
  closed: IconCircleSlash,
};

/**
 * 과정안내 탭 루트 — B type (명세 STEP 2~6)
 *
 * 이 화면의 중심 개념은 **보기 전환**이다. 필터가 아니다.
 *   필터는 목록을 줄이지만 이 컨트롤은 스트립·모드 헤더·회차 레이어를 통째로 켜고 끈다.
 *   그 무게를 컨트롤의 겉모습이 감당해야 하므로 칩이 아니라 세그먼트 토글로 세운다(전략 v1.1 R1).
 *
 * 개설 판별은 `KIUM_SESSIONS`에 courseId가 있는가 **하나**로 한다 — 데이터 플래그를 신설하지 않는다.
 *
 * SSG 규칙: 서버 렌더 경로에서 `new Date()`·`window`를 참조하지 않는다.
 *   now는 null로 시작해 마운트 후 세팅하고, now가 null인 동안 isPast는 호출되지 않으므로
 *   서버 렌더와 첫 클라이언트 렌더의 회차 집합이 동일하다(하이드레이션 불일치 없음).
 */
export default function KiumCoursesTab() {
  const rootRef = useRef<HTMLDivElement>(null);
  const segRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>('all');
  const [cat, setCat] = useState<Cat>('all');
  const [month, setMonth] = useState<Month>('all');
  const [status, setStatus] = useState<'all' | KiumSessionStatus>('all');
  const [now, setNow] = useState<Date | null>(null);
  const [showcase, setShowcase] = useState(false);
  const [live, setLive] = useState('');
  const [entering, setEntering] = useState(false);
  const [focusCourse, setFocusCourse] = useState<{ id: string; nonce: number } | null>(null);
  /** 뱃지 진입 — 전환 후 그 카드를 같은 화면 높이에 되돌려 놓기 위한 좌표 기억 */
  const keepRef = useRef<{ id: string; top: number } | null>(null);
  const nonce = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ── 회차 집합 ────────────────────────────────────────────────────────
     future  = 미래 회차(end >= today). 세그먼트 카운트·시즌 오프 판정의 기준
     scoped  = future ∩ (기간·분야). 모집 상태 칩 카운트의 모수
     visible = scoped ∩ 모집 상태. 모드 헤더·전체 일정·그리드 연동의 최종 목록
     스트립만 여기서 다시 마감을 걷어낸다(STEP 4-1) */
  const future = useMemo(() => KIUM_SESSIONS.filter((s) => !(now && isPast(s, now))), [now]);

  const scoped = useMemo(
    () =>
      future.filter((s) => {
        if (month !== 'all' && s.displayMonth !== month) return false;
        if (cat !== 'all') {
          const c = getCourseById(s.courseId);
          if (!c || c.category !== cat) return false;
        }
        return true;
      }),
    [future, month, cat]
  );

  const visible = useMemo(
    () => (status === 'all' ? scoped : scoped.filter((s) => effectiveStatus(s, now) === status)),
    [scoped, status, now]
  );

  const seasonOff = future.length === 0;

  /* ── 카탈로그 ─────────────────────────────────────────────────────────
     전체 보기 = 19과정 전건. 공개교육 보기 = 필터 결과에 회차가 남은 개설 과정만
     (회차가 하나도 없는 카드를 공개교육 보기에 세우면 "일정 보기"라는 라벨이 거짓말이 된다) */
  const allCourses = useMemo(() => getAllCourses(), []);
  const allCats = useMemo(() => getCategoryCounts(), []);
  const openCats = useMemo(() => openCategoryCounts(), []);

  const openCourses = useMemo(() => {
    const ids = new Set(visible.map((s) => s.courseId));
    return getOpenCourses().filter((c) => ids.has(c.id));
  }, [visible]);

  const isOpenMode = mode === 'open';
  const courses = isOpenMode ? openCourses : allCourses;
  const categories = isOpenMode ? openCats : allCats;
  /**
   * 분야 칩의 [전체] 카운트는 **보기 기준 카탈로그 규모**다(전체 19 / 공개교육 9).
   * 필터를 걸 때마다 이 숫자가 같이 줄면 분류별 카운트(고정)와 축이 어긋나 읽을 수 없게 된다.
   * 필터 연동으로 움직여야 하는 숫자는 모드 헤더의 회차 수 하나뿐이다.
   */
  const catTotal = isOpenMode ? getOpenCourses().length : allCourses.length;
  /**
   * 세그먼트 우측 카운트 — **과정 수**다(회차 수가 아니다).
   * 세그먼트는 '보기 범위'를 고르는 컨트롤이라 양쪽 단위가 같아야 한다.
   * 회차 수는 바로 아래 섹션 헤더가 필터까지 반영해 말한다(§3-3).
   */
  const openCourseTotal = getOpenCourses().length;

  /* ── URL 동기화 — replace라 뒤로가기 스택을 늘리지 않는다 ─────────── */
  const syncQuery = useCallback((next: { mode?: Mode; month?: Month; cat?: Cat }) => {
    const url = new URL(window.location.href);
    if (next.mode !== undefined) {
      if (next.mode === 'open') {
        url.searchParams.set('tab', 'courses');
        url.searchParams.set('mode', 'open');
      } else {
        url.searchParams.delete('mode');
      }
    }
    if (next.month !== undefined) {
      if (next.month === 'all') url.searchParams.delete('month');
      else url.searchParams.set('month', String(next.month));
    }
    if (next.cat !== undefined) {
      if (next.cat === 'all') url.searchParams.delete('cat');
      else url.searchParams.set('cat', next.cat);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  /* ── 보기 전환 ───────────────────────────────────────────────────────
     ①앵커 보정 ②등장 페이드인 ③aria-live 안내. 셋 다 "화면이 튀었다"를 막기 위한 것이다 */
  const changeMode = useCallback(
    (next: Mode, opts?: { anchor?: boolean }) => {
      setMode(next);
      syncQuery({ mode: next });
      setLive(
        next === 'open' ? '공개교육 일정 보기로 전환되었습니다' : '전체 과정 보기로 전환되었습니다'
      );

      const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!rm) {
        setEntering(true);
        clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => setEntering(false), 220);
      }

      if (opts?.anchor === false) return;
      // 세그먼트가 이미 화면 위쪽에 있으면 움직이지 않는다 — 스크롤은 필요할 때만 쓰는 자원이다
      const el = segRef.current;
      if (!el) return;
      const { top } = el.getBoundingClientRect();
      if (top >= 0 && top <= window.innerHeight * 0.5) return;
      el.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
    },
    [syncQuery]
  );

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  /* ── 마운트 1회: 딥링크 반영 · now · 상담 프리필 ─────────────────── */
  useEffect(() => {
    const n = new Date();
    setNow(n);

    const q = new URLSearchParams(window.location.search);
    setShowcase(q.get('preview') === 'badges');

    // 구 진입 경로(`?tab=open` · `#open`)는 KiumTabs가 `?tab=courses&mode=open`으로 바꾸지만,
    // 자식 효과가 부모보다 먼저 실행되므로 여기서도 원본 형태를 그대로 인정한다(실행 순서 의존 제거)
    const legacyOpen = q.get('tab') === 'open' || window.location.hash === '#open';
    if (q.get('mode') === 'open' || legacyOpen) setMode('open');

    const qCat = q.get('cat');
    if (qCat && getCategoryCounts().some((c) => c.key === qCat)) setCat(qCat as KiumCategory);

    const qMonth = Number(q.get('month'));
    if (qMonth === 10 || qMonth === 11 || qMonth === 12) setMonth(qMonth as 10 | 11 | 12);

    /* ── 상담 프리필 딥링크 — A type 로직 승계(경로 A·B·마감 가드). 경로 C는 미탑재 ──
       잘못된 id는 조용히 무시하고 폼 기본 상태로 둔다. 구 링크(`round`/`apply`)도 별칭으로 받는다. */
    const consult = q.get('consult') === '1' || q.get('apply') === '1';
    const course = getCourseById(q.get('course') ?? '');
    const session = getSessionById(q.get('session') ?? q.get('round') ?? '');
    const valid = course && session && session.courseId === course.id ? session : undefined;

    if (consult || course || session) {
      // 한 틱 미룬다 — 형제인 HomeInquiry·KiumApplySummary의 구독 등록보다 먼저 실행되기 때문
      const t = window.setTimeout(() => {
        if (course && valid) {
          if (effectiveStatus(valid, n) === 'closed') {
            // 마감 가드 — 그 회차로 프리필하지 않고 다음 회차 상담(경로 B)으로 넘긴다
            dispatchPrefill(prefillTextB(course, valid), {
              route: 'B',
              courseId: course.id,
              fromClosedSessionId: valid.id,
            });
          } else {
            dispatchPrefill(prefillTextA(course, valid, n), {
              route: 'A',
              courseId: course.id,
              sessionId: valid.id,
            });
          }
        } else if (course) {
          dispatchPrefill(prefillTextB(course), { route: 'B', courseId: course.id });
        } else {
          return; // 유효한 대상 없음 → 프리필 없음, 에러 화면도 없음
        }
        if (consult) scrollToInquiry();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, []);

  /* ── --kium-sticky 주입 — 월 그룹 헤더가 탭바 아래에 붙게 한다 ────── */
  useEffect(() => {
    const set = () => {
      const bar = document.querySelector('.kium-tabbar');
      if (!bar || !rootRef.current) return;
      const v = parseFloat(getComputedStyle(bar).top || '0') + bar.getBoundingClientRect().height;
      rootRef.current.style.setProperty('--kium-sticky', `${v}px`);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);

  /* ── 뱃지 진입: 전환 후 그 카드를 같은 화면 높이로 되돌린다 ──────── */
  useEffect(() => {
    const keep = keepRef.current;
    if (!keep) return;
    keepRef.current = null;
    const el = document.getElementById(`kium-cardwrap-${keep.id}`);
    if (!el) return;
    window.scrollBy({ top: el.getBoundingClientRect().top - keep.top, behavior: 'auto' });
  }, [mode]);

  /* ── 핸들러 ─────────────────────────────────────────────────────────── */
  const onOpenBadge = (courseId: string) => {
    const el = document.getElementById(`kium-cardwrap-${courseId}`);
    if (el) keepRef.current = { id: courseId, top: el.getBoundingClientRect().top };
    // 카드 위치를 유지하는 것이 목적이므로 세그먼트로 끌어올리지 않는다
    changeMode('open', { anchor: false });
  };

  const onCourseFocus = (courseId: string) => {
    nonce.current += 1;
    setFocusCourse({ id: courseId, nonce: nonce.current });
  };

  const onConsultSession = (s: KiumSession) => {
    const c = getCourseById(s.courseId);
    if (c) consultSession(c, s, now);
  };
  const onConsultCourse = (c: KiumCourse) => consultCourse(c);

  const changeCat = (next: Cat) => {
    setCat(next);
    syncQuery({ cat: next });
  };
  const changeMonth = (next: Month) => {
    setMonth(next);
    syncQuery({ month: next });
  };
  const resetFilters = () => {
    setMonth('all');
    setCat('all');
    setStatus('all');
    syncQuery({ month: 'all', cat: 'all' });
  };

  /* ── 카운트 ─────────────────────────────────────────────────────────── */
  const stCount = countByStatus(scoped, now);
  /**
   * 섹션 헤더의 범위 문구 — 필터에서 파생한다.
   * '10~12월'을 하드코딩해 두면 12월만 걸러 본 사용자에게 표시와 상태가 어긋난 화면이 남는다.
   */
  const scopeLabel = [
    month === 'all' ? '10~12월' : `${month}월`,
    cat === 'all' ? null : (categories.find((c) => c.key === cat)?.label ?? null),
    status === 'all' ? null : KIUM_SESSION_META[status].label,
  ]
    .filter(Boolean)
    .join(' · ');
  const monthCount = (m: 10 | 11 | 12) => future.filter((s) => s.displayMonth === m).length;
  const openFaq = getOpenFaq();

  return (
    <div className="kium-coursesview" ref={rootRef}>
      {/* ── 보기 전환 세그먼트 — 필터 바 '위'.
          페이지 탭과 혼동되지 않도록 role="tablist"는 쓰지 않고 aria-pressed 토글 2개로 만든다 ── */}
      <div className="kium-modeseg-row" ref={segRef}>
        <div className="kium-viewseg kium-modeseg" role="group" aria-label="과정 보기 방식">
          <button
            type="button"
            className="kium-viewseg-btn"
            aria-pressed={!isOpenMode}
            onClick={() => changeMode('all')}
          >
            전체 과정 <span className="cnt">{allCourses.length}</span>
          </button>
          <button
            type="button"
            className="kium-viewseg-btn"
            aria-pressed={isOpenMode}
            data-evt="kium_mode_open"
            onClick={() => changeMode('open')}
          >
            공개교육 <span className="cnt">{openCourseTotal}</span>
          </button>
        </div>
      </div>
      {/* ── 필터 — 보기를 고르고, 그 안에서 거른다 ─────────────────────
          분야는 두 보기 공통. 기간·모집 상태는 공개교육 보기에서만 DOM에 생긴다 */}
      <div className="kium-vfilters">
        <div className="kium-frow">
          <span className="kium-frow-lb" id="kium-cf-cat">
            분야
          </span>
          <div className="kium-filters" role="group" aria-labelledby="kium-cf-cat">
            <button
              type="button"
              className="kium-chip"
              aria-pressed={cat === 'all'}
              onClick={() => changeCat('all')}
            >
              전체 <span className="cnt">{catTotal}</span>
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
        </div>

        {isOpenMode && !seasonOff && (
          <>
            <div className="kium-frow">
              <span className="kium-frow-lb" id="kium-cf-month">
                기간
              </span>
              <div className="kium-filters" role="group" aria-labelledby="kium-cf-month">
                {/* 「기간」 행 라벨 아래의 맨숫자는 일수(6일짜리 과정)로 읽힌다.
                    실제 값은 회차 수이므로 이 축에만 단위를 붙인다 — 분야·모집 상태는 무변경.
                    숫자는 .cnt(tabular-nums), 단위는 <i>로 분리해 한글에 등폭이 걸리지 않게 한다. */}
                <button
                  type="button"
                  className="kium-chip"
                  aria-pressed={month === 'all'}
                  aria-label={`기간 전체, ${future.length}개 회차`}
                  onClick={() => changeMonth('all')}
                >
                  전체 <span className="cnt">{future.length}<i>회차</i></span>
                </button>
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
              </div>
            </div>

            {/* 모집 상태 칩은 기간·분야와 완전히 같은 플레인 칩이다.
                상태 구분은 아이콘 stroke 한 축, 선택 표시는 네이비 반전 한 축 — 칩 안의 칩 금지 */}
            <div className="kium-frow">
              <span className="kium-frow-lb" id="kium-cf-st">
                모집 상태
              </span>
              <div className="kium-filters" role="group" aria-labelledby="kium-cf-st">
                <button
                  type="button"
                  className="kium-chip"
                  aria-pressed={status === 'all'}
                  onClick={() => setStatus('all')}
                >
                  전체 <span className="cnt">{scoped.length}</span>
                </button>
                {KIUM_STATUS_ORDER.map((st) => {
                  const Icon = STATUS_ICON[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      className="kium-chip kium-chip-st"
                      data-st={st}
                      aria-pressed={status === st}
                      onClick={() => setStatus(st)}
                    >
                      <Icon size={14} />
                      {KIUM_SESSION_META[st].label} <span className="cnt">{stCount[st]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 보기 전환 안내 — 화면에도 보이고 낭독도 된다.
          .kium-sr로 숨겨 두면 눈으로 보는 사용자는 무엇이 바뀌었는지 알 수 없다.
          빈 문자열이면 렌더하지 않는다(빈 줄 방지). */}
      {live && (
        <p className="kium-livenote" aria-live="polite">
          {live}
        </p>
      )}

      {/* 카드마다 반복되던 '정부지원 환급' 배지를 대신하는 승격 1줄.
          숫자는 쓰지 않는다 — 바로 위 .kium-count("19개 과정")와 겹치기 때문이다.
          공개교육 보기의 .kium-modehead-s와 대칭 위치다. */}
      {!isOpenMode && <p className="kium-allhead">모든 과정이 정부지원 환급 대상입니다</p>}

      {/* ── 전체 보기 인트로 1줄 — 공개교육으로 넘어가는 텍스트 입구.
          첫 문장이 사용자의 장벽('인원이 적어 못 하겠다')을 먼저 해소한다.
          '혼자'는 쓰지 않는다 — 같은 페이지 FAQ가 개인 자격 신청 불가를 명시해 오해를 부른다.
          자연 줄바꿈으로 흘린다(<br> 금지, word-break:keep-all은 CSS가 담당) ── */}
      {!isOpenMode && (
        <p className="kium-openlead">
          인원이 적어도 괜찮습니다. 1명부터 신청할 수 있는 공개교육 일정을 확인해 보세요.{' '}
          <button
            type="button"
            className="kium-openlead-link"
            data-evt="kium_mode_open"
            onClick={() => changeMode('open')}
          >
            공개교육 일정 보기
            <IconArrowRight size={16} />
          </button>
        </p>
      )}

      {/* ── 공개교육 보기 본문 ─────────────────────────────────────────── */}
      {isOpenMode && (
        <div className={`kium-openblock${entering ? ' is-in' : ''}`}>
          {seasonOff ? (
            /* 시즌 오프 — 세그먼트·뱃지·트리거는 숨기지 않는다. 다음 시즌에도 같은 자리에서 발견돼야 한다 */
            <div className="kium-seasonoff">
              <IconCalendarDays size={20} />
              <p>
                지금은 공개교육 모집 기간이 아닙니다. 다음 회차 일정이 확정되면 안내받으실 수
                있습니다.
              </p>
              <button
                type="button"
                className="kium-cta-ses"
                data-evt="kium_consult_reach"
                data-evt-path="B"
                onClick={() => consultOpenRequest('seasonOff')}
              >
                <span>개설 알림 상담</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="kium-empty2">
              <IconCalendarDays size={20} />
              <p>해당 조건의 회차가 없습니다.</p>
              <button type="button" className="kium-chip" onClick={resetFilters}>
                필터 초기화
              </button>
            </div>
          ) : (
            <>
              {/* 모드 헤더 1줄 — 3-스탯 카드 행을 대신한다. 회차 수는 필터와 연동된다 */}
              <div className="kium-modehead">
                <p className="kium-modehead-t">
                  공개교육 일정 <span className="sep">·</span> {scopeLabel} <b>{visible.length}</b>개
                  회차
                </p>
                <p className="kium-modehead-s">1명부터 신청 가능 · 정부지원 환급</p>
              </div>

              <UpcomingSessionsStrip
                sessions={visible}
                now={now}
                onConsultSession={onConsultSession}
                onCourseFocus={onCourseFocus}
              />
            </>
          )}
        </div>
      )}

      {/* ── 카탈로그 — 단일 그리드. 보기에 따라 과정 집합과 카드 변형만 바뀐다 ── */}
      {!(isOpenMode && (seasonOff || visible.length === 0)) && (
        <KiumCourseGrid
          courses={courses}
          categories={categories}
          cat={cat}
          onCat={changeCat}
          hideFilters
          variant={isOpenMode ? 'open' : 'default'}
          thumbs={isOpenMode ? KIUM_OPEN_THUMBS : undefined}
          now={now}
          onConsultSession={onConsultSession}
          onConsultCourse={onConsultCourse}
          onOpenBadge={isOpenMode ? undefined : onOpenBadge}
          focusCourse={isOpenMode ? focusCourse : null}
        />
      )}

      {/* ── 리드 회수 — 막다른 골목마다 상담 출구를 둔다 ─────────────── */}
      {isOpenMode && !seasonOff && (
        <div className="kium-leadback">
          <p className="kium-leadback-t">찾으시는 과정이 공개 일정에 없나요?</p>
          <p className="kium-leadback-s">기업 맞춤 또는 다음 공개교육 개설을 상담해 드립니다.</p>
          <button
            type="button"
            className="kium-cta-ses"
            data-evt="kium_consult_reach"
            data-evt-path="B"
            onClick={() => consultOpenRequest('noCourse')}
          >
            <span>과정 개설 상담</span>
            <IconArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── 공개교육 FAQ 2문항 — 숨긴 탭에서 이관. 문안은 content.ts 단일 출처 ── */}
      {isOpenMode && openFaq.length > 0 && (
        <>
          <h3 className="kium-detail-h">{KIUM_CONTENT.open.faqHeading}</h3>
          <div className="kium-faq">
            <KiumFaq items={openFaq} />
          </div>
          <p className="kium-caption">{KIUM_CONTENT.open.scheduleCaption}</p>
        </>
      )}

      {/* 쿼리가 없으면 이 블록 자체가 DOM에 만들어지지 않는다(명세 STEP 7) */}
      {showcase && <BadgeShowcase />}
    </div>
  );
}
