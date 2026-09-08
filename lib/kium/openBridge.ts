'use client';

import { KIUM_PREFILL_EVENT, PREFILL_STRIP } from './inquiryBridge';
import {
  KIUM_SESSION_META,
  effectiveStatus,
  formatSessionRange,
  getNextOpenSession,
  type KiumSession,
} from './sessions';
import type { KiumCourse } from './data';

/**
 * 프리필 토큰 제거 목록 — 정의는 inquiryBridge에 있다(순환 import 방지).
 * 여기서는 재수출만 해 기존 import 경로를 깨뜨리지 않는다.
 */
export { PREFILL_STRIP };

/** 요약 배너가 구독하는 이벤트 */
export const KIUM_OPEN_SELECT_EVENT = 'kium:open-select';

/** 프리필 경로 — A 과정+일정 / B 과정만 / C 일정(시기)만 */
export type PrefillRoute = 'A' | 'B' | 'C';

export type OpenSelection =
  | { route: 'A'; courseId: string; sessionId: string; guard?: 'closed' | 'invalid' }
  | { route: 'B'; courseId: string; fromClosedSessionId?: string }
  /** 경로 B 변형 — 과정을 특정하지 않는 상담 요청(B type STEP 4-3 · 5-3). `request` 유무로 좁힌다 */
  | { route: 'B'; request: OpenRequestKind }
  | { route: 'C'; month: 10 | 11 | 12 };

/**
 * 리드 회수 문의 유형 (B type 명세 STEP 4-3 · STEP 5-3).
 * 프리필 본문과 요약 배너가 같은 문자열을 쓰도록 여기 한 곳에만 둔다 — 문구 어긋남을 구조적으로 막는다.
 */
export const OPEN_REQUEST_TYPE = {
  /** 그리드 하단 「과정 개설 상담」 — 원하는 과정이 공개 일정에 없을 때 */
  noCourse: '공개교육 상담 희망',
  /** 시즌 오프 「개설 알림 상담」 — 미래 회차 0건 구간 */
  seasonOff: '공개교육 개설 일정 안내 요청',
} as const;

export type OpenRequestKind = keyof typeof OPEN_REQUEST_TYPE;

/* ── 문의 내용 본문 조립 ─────────────────────────────────────────────
   placeholder가 아니라 실제 value로 주입한다. 사용자가 자유롭게 편집·삭제할 수 있다. */

const HEAD = '[공개교육 상담 신청]';

/** 경로 A — 과정 + 희망 회차 */
export function prefillTextA(course: KiumCourse, session: KiumSession, now: Date | null): string {
  const st = effectiveStatus(session, now);
  return (
    `${HEAD}\n` +
    `· 과정명: ${course.titleMarketing}\n` +
    `· 희망 회차: ${formatSessionRange(session)} (${KIUM_SESSION_META[st].label})\n` +
    // 블록을 개행으로 닫는다 — 사용자 입력이 다음 줄에서 시작해야 재클릭 시 토큰만 정확히 교체된다
    `· 문의 내용: \n`
  );
}

/** 경로 B — 과정만. 마감 회차에서 넘어온 경우 그 사실을 문장으로 남긴다 */
export function prefillTextB(course: KiumCourse, closedFrom?: KiumSession): string {
  const line = closedFrom
    ? `· 희망 회차: ${formatSessionRange(closedFrom)} 마감 → 다음 회차 문의\n`
    : `· 희망 회차: 협의 희망\n`;
  return `${HEAD}\n` + `· 과정명: ${course.titleMarketing}\n` + line + `· 문의 내용: \n`;
}

/** 경로 C — 시기만 */
export function prefillTextC(month: 10 | 11 | 12): string {
  return `${HEAD}\n` + `· 희망 시기: ${month}월 개강 과정 상담 희망\n` + `· 문의 내용: \n`;
}

/**
 * 경로 B 변형 본문 — 과정을 특정하지 않는 상담 요청.
 * `· 과정명` 자리에 `· 문의 유형` 한 줄을 넣는다(명세 STEP 4-3 · 5-3 문구 고정).
 */
export function prefillTextBRequest(kind: OpenRequestKind): string {
  return `${HEAD}
` + `· 문의 유형: ${OPEN_REQUEST_TYPE[kind]}
` + `· 문의 내용: 
`;
}

/** 마감 가드 문구 — 요약 배너가 그대로 출력한다 */
export const GUARD_CLOSED_TEXT = '해당 회차는 마감되었습니다. 다음 회차 상담으로 안내됩니다.';

/**
 * 상담 폼으로 이동 + 프리필.
 *
 * 폼의 필드·검증·동의 구조는 그대로 두고 '문의 내용'만 채운다.
 * 관심 영역 `인재키움`은 /kium 페이지가 이미 presetInterestSubs로 선택 상태로 시작한다.
 * 개인정보 동의·마케팅 동의는 어떤 경우에도 자동 체크하지 않는다.
 */
export function dispatchPrefill(text: string, selection: OpenSelection) {
  window.dispatchEvent(
    new CustomEvent(KIUM_PREFILL_EVENT, {
      detail: {
        text,
        // 기존 프리필 토큰만 걷어내고 사용자가 직접 쓴 문장은 그대로 뒤에 남긴다(prepend)
        strip: PREFILL_STRIP,
      },
    })
  );
  window.dispatchEvent(new CustomEvent(KIUM_OPEN_SELECT_EVENT, { detail: selection }));
}

/**
 * sticky로 덮이는 상단 높이. 하드코딩하지 않고 실측한다.
 *
 * /kium의 sticky 2단은 `.nav`(fixed) + `.kium-tabbar`(sticky)다 —
 * `.subnav`는 이 페이지에 렌더되지 않는다(hero-shell 계열 페이지 전용).
 * `.kium-apply-sum`은 모바일에서만 sticky이므로 position 검사로 자동 제외된다.
 */
function topInset(): number {
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  const h = (el: HTMLElement | null) =>
    el && getComputedStyle(el).position !== 'static' ? el.getBoundingClientRect().height : 0;
  return h(q('.nav')) + h(q('.subnav')) + h(q('.kium-tabbar')) + h(q('.kium-apply-sum'));
}

/**
 * 키보드가 올라온 뒤 포커스 대상이 가려졌는지 확인하고 보정한다.
 *
 * 브라우저 기본 보정은 두 가지를 모른다.
 *   ① focus({preventScroll:true}) 가 걸려 있으면 아예 동작하지 않는다
 *   ② sticky 요소(nav · tabbar · 요약 배너)가 덮는 영역을 계산하지 않는다
 * visualViewport 는 키보드가 덮고 남은 실제 가시 영역을 알려 준다.
 */
function ensureVisibleWithKeyboard(el: HTMLElement, inset: number) {
  const vv = window.visualViewport;
  if (!vv) return; // 미지원 브라우저는 기본 동작에 맡긴다 — 잘못된 보정이 무보정보다 나쁘다
  const pad = 12;
  const r = el.getBoundingClientRect();
  const top = vv.offsetTop + inset + pad;
  const bottom = vv.offsetTop + vv.height - pad;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  if (r.bottom > bottom) window.scrollBy({ top: r.bottom - bottom, behavior });
  else if (r.top < top) window.scrollBy({ top: r.top - top, behavior });
}

/**
 * 상담 섹션으로 이동 + 첫 빈 필수 필드로 포커스.
 *
 * [MI-01] 앵커는 #inq(섹션)가 아니라 #inq-form(폼 컨테이너)이다.
 *   모바일에서 #inq는 첫 자식이 .inq-side(소개 340px)라 입력 필드가 화면 밖으로 밀린다.
 *   결과 화면에서는 #inq-form이 없으므로 #inq로 폴백한다.
 *
 * [MI-04] preventScroll:true 는 그대로 둔다 —
 *   스무스 스크롤이 진행 중일 때 브라우저 기본 포커스 스크롤이 끼어들면 화면이 두 번 튄다.
 *   대신 키보드가 실제로 올라온 뒤(visualViewport resize) 가시성을 직접 보정한다.
 *   두 장치는 역할이 다르다: preventScroll 은 '스크롤 중 간섭 차단',
 *   ensureVisibleWithKeyboard 는 '스크롤이 끝난 뒤 키보드까지 감안한 최종 보정'이다.
 */
export function scrollToInquiry() {
  const el = document.getElementById('inq-form') ?? document.getElementById('inq');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  // 스크롤 후 포커스 — preventScroll로 화면을 두 번 흔들지 않는다
  window.setTimeout(() => {
    const field = document.getElementById('f-company');
    field?.focus({ preventScroll: true });
    if (!field) return;

    const vv = window.visualViewport;
    if (!vv) return;
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      vv.removeEventListener('resize', run); // 남기면 이후 모든 키보드 개폐에 스크롤이 끼어든다
      window.setTimeout(() => ensureVisibleWithKeyboard(field, topInset()), 60);
    };
    vv.addEventListener('resize', run, { once: true });
    window.setTimeout(run, 700); // 키보드가 뜨지 않는 환경(데스크톱·외장 키보드) 폴백
  }, reduce ? 0 : 480);
}

/** URL 쿼리 반영 — 새로고침·링크 공유에도 프리필이 유지된다 */
export function syncConsultQuery(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  url.searchParams.set('consult', '1');
  for (const [k, v] of Object.entries(params)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/* ── 경로별 진입점 ─────────────────────────────────────────────────── */

/** 경로 A — 일정 행 CTA · 회차 pill · 상세 회차 카드 CTA */
export function consultSession(course: KiumCourse, session: KiumSession, now: Date | null) {
  if (effectiveStatus(session, now) === 'closed') {
    // 마감 회차는 그 회차로 프리필하지 않는다 — 다음 회차 상담(경로 B)으로 넘긴다
    consultCourse(course, session);
    return;
  }
  dispatchPrefill(prefillTextA(course, session, now), {
    route: 'A',
    courseId: course.id,
    sessionId: session.id,
  });
  syncConsultQuery({ course: course.id, session: session.id, month: null });
  scrollToInquiry();
}

/** 경로 B — 「과정만 상담」 · 상세 하단 CTA · 마감 회차의 「다음 회차 상담」 */
export function consultCourse(course: KiumCourse, closedFrom?: KiumSession) {
  dispatchPrefill(prefillTextB(course, closedFrom), {
    route: 'B',
    courseId: course.id,
    fromClosedSessionId: closedFrom?.id,
  });
  syncConsultQuery({ course: course.id, session: closedFrom?.id ?? null, month: null });
  scrollToInquiry();
}

/** 경로 C — 월 그룹 헤더 「이 시기 교육 상담」 */
export function consultMonth(month: 10 | 11 | 12) {
  dispatchPrefill(prefillTextC(month), { route: 'C', month });
  syncConsultQuery({ month: String(month), course: null, session: null });
  scrollToInquiry();
}

/**
 * 경로 B 변형 진입점 — 「과정 개설 상담」·「개설 알림 상담」.
 * 과정·회차 쿼리는 비운다 — 직전 선택이 남아 폼 본문과 요약 배너가 어긋나는 것을 막는다.
 */
export function consultOpenRequest(kind: OpenRequestKind) {
  dispatchPrefill(prefillTextBRequest(kind), { route: 'B', request: kind });
  syncConsultQuery({ course: null, session: null, month: null });
  scrollToInquiry();
}

/** 마감 회차에서 안내할 다음 회차 (없으면 undefined) */
export { getNextOpenSession };
