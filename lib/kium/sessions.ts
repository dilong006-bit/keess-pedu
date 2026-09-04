import { KIUM_COURSES, KIUM_CATEGORY_META, type KiumCategory, type KiumCourse } from './data';

/**
 * 공개교육 회차 데이터 — 요청 원문 「※공개교육 일자※」 표(260903) 1:1.
 * 규칙: 이 파일의 **일자**는 요청 원문 외 수정 금지. 요일 표기는 저장하지 않고 start에서 파생한다
 *       (요일 오기를 구조적으로 불가능하게 만든다 — 원문 표에서 실제 1건 발견됨).
 *
 * [고도화 v1.0 §STEP 1] 모집 상태를 4종 단일 enum으로 확정하고, 상태별 UI를 화면에서 직접
 * 확인할 수 있도록 시드 커버리지(§8-1)를 만족시킨다.
 */
export type KiumSessionStatus = 'recruiting' | 'confirmed' | 'closing' | 'closed';

export type KiumSession = {
  /** 딥링크 키 */
  id: string;
  /** KIUM_COURSES.id 참조 — 과정 메타는 전부 조인해서 쓴다(중복 저장 금지) */
  courseId: string;
  /** 일정표 열 배치 기준월. 11/30~12/1 회차는 12(사업부 원안 준수) */
  displayMonth: 10 | 11 | 12;
  /** 정렬·과거 판정의 단일 기준 (ISO 'YYYY-MM-DD') */
  start: string;
  /** 1일 과정은 start와 동일 */
  end: string;
  status: KiumSessionStatus;
  /** 마감임박 시 잔여석 (선택) — 값이 없으면 배지에 병기하지 않는다 */
  seatsLeft?: number;
};

/**
 * 상태 메타 — 라벨·톤·정렬 가중치의 단일 출처.
 * weight ASC로 정렬하므로 개강확정·마감임박이 위로, 마감이 맨 아래로 간다.
 */
export const KIUM_SESSION_META: Record<
  KiumSessionStatus,
  { label: string; tone: 'amber' | 'green' | 'red' | 'gray'; weight: number }
> = {
  confirmed: { label: '개강확정', tone: 'green', weight: 1 },
  closing: { label: '마감임박', tone: 'red', weight: 1 },
  recruiting: { label: '모집중', tone: 'amber', weight: 2 },
  closed: { label: '마감', tone: 'gray', weight: 4 },
};

/** 상태 칩·쇼케이스가 쓰는 고정 순서 */
export const KIUM_STATUS_ORDER: KiumSessionStatus[] = ['recruiting', 'confirmed', 'closing', 'closed'];

/**
 * ⚠ status는 **사업부 회신 전 값**이다(부록 C8 — 원문 근거 없음). 일자만 원문 확정본이다.
 *
 * [검토용 시드 v1.0] A/B안 택1 검토를 위해 3상태를 배분한다.
 *   전건 'recruiting'이면 배지·CTA 4종 중 1종만 화면에 떠 상태별 UI를 확인할 수 없다.
 *
 *   ★ 'closed'는 넣지 않는다 — 이것이 v2.0에서 시드를 걷어낸 이유다.
 *     effectiveStatus()는 과거를 마감으로 올리는 **단방향** 안전장치라
 *     잘못 박힌 closed를 되돌리지 못하고, 이른 회차를 닫아 보이면 신청 자체가 들어오지 않는다.
 *     recruiting·confirmed·closing 셋은 모두 신청 경로가 열려 있어 그 손실이 없다.
 *     또한 모집 상태 필터의 '마감 0건' 빈 상태 안내를 시연하려면 0건이 유지되어야 한다.
 *     (단 2026-10-12 이후에는 effectiveStatus()가 지난 회차를 알아서 승격시킨다 — 정상 동작)
 *
 *   ★ seatsLeft는 데이터에 두지 않는다 — '잔여 N석'은 근거 없는 재고 주장이다.
 *     잔여석 표시 검증은 ?preview=badges 쇼케이스가 전담한다.
 *
 *   배분 기준: 월별 3상태 전부 · 스트립 첫 화면(MO 3 · PC 6)에 3상태 전부 ·
 *              kium-11/kium-19는 한 과정 안에 3상태 · 이른 회차일수록 마감임박
 *
 *   ※ 오픈 전 실제 모집 상태를 회신 받아 이 필드만 전건 교체할 것. 일자는 건드리지 않는다.
 */
export const KIUM_SESSIONS: KiumSession[] = [
  // AI활용 — 업무효율화: Agent (kium-09)
  { id: 'agent-r1',  courseId: 'kium-09', displayMonth: 10, start: '2026-10-12', end: '2026-10-13', status: 'closing' },
  { id: 'agent-r2',  courseId: 'kium-09', displayMonth: 11, start: '2026-11-02', end: '2026-11-03', status: 'confirmed' },
  { id: 'agent-r3',  courseId: 'kium-09', displayMonth: 12, start: '2026-11-30', end: '2026-12-01', status: 'closing' },
  // AI활용 — 업무효율화: Data (kium-10)
  { id: 'data-r1',   courseId: 'kium-10', displayMonth: 10, start: '2026-10-14', end: '2026-10-15', status: 'confirmed' },
  { id: 'data-r2',   courseId: 'kium-10', displayMonth: 11, start: '2026-11-09', end: '2026-11-10', status: 'recruiting' },
  { id: 'data-r3',   courseId: 'kium-10', displayMonth: 12, start: '2026-12-07', end: '2026-12-08', status: 'confirmed' },
  // AI활용 — AI 직무전문화 (kium-11)
  { id: 'aijob-r1',  courseId: 'kium-11', displayMonth: 10, start: '2026-10-19', end: '2026-10-20', status: 'recruiting' },
  { id: 'aijob-r2',  courseId: 'kium-11', displayMonth: 11, start: '2026-11-16', end: '2026-11-17', status: 'closing' },
  { id: 'aijob-r3',  courseId: 'kium-11', displayMonth: 12, start: '2026-12-14', end: '2026-12-15', status: 'confirmed' },
  // 비즈니스 역량 — 전략적 비즈니스 협상 스킬 (kium-12)
  { id: 'nego-r1',   courseId: 'kium-12', displayMonth: 10, start: '2026-10-27', end: '2026-10-27', status: 'recruiting' },
  // 비즈니스 역량 — 스피치&프레젠테이션 클리닉 (kium-13)
  { id: 'speech-r1', courseId: 'kium-13', displayMonth: 11, start: '2026-11-12', end: '2026-11-13', status: 'closing' },
  // 비즈니스 역량 — 인정받는 직장인의 구두보고 스킬 (kium-14)
  { id: 'report-r1', courseId: 'kium-14', displayMonth: 12, start: '2026-12-11', end: '2026-12-11', status: 'confirmed' },
  // CS·민원응대 — CS 종합 솔루션 (kium-19)
  { id: 'cs-r1',     courseId: 'kium-19', displayMonth: 10, start: '2026-10-26', end: '2026-10-26', status: 'closing' },
  { id: 'cs-r2',     courseId: 'kium-19', displayMonth: 11, start: '2026-11-17', end: '2026-11-17', status: 'confirmed' },
  { id: 'cs-r3',     courseId: 'kium-19', displayMonth: 12, start: '2026-12-21', end: '2026-12-21', status: 'recruiting' },
  // 리더십·관리자 — 진단 기반 팀장 리더십 Re-Lead (kium-04)
  { id: 'relead-r1', courseId: 'kium-04', displayMonth: 10, start: '2026-10-21', end: '2026-10-22', status: 'confirmed' },
  { id: 'relead-r2', courseId: 'kium-04', displayMonth: 11, start: '2026-11-18', end: '2026-11-19', status: 'recruiting' },
  // 원문 표기 `12/17(수)~18(금)`에서 틀린 것은 **요일 라벨 (수) 하나뿐**이다(2026-12-17=목).
  //   날짜 17~18은 2일로 과정 길이(14시간·2일)와 정합하고, 요일은 이 파일이 start에서 파생하므로
  //   화면에는 `12.17(목) ~ 18(금)`으로 자동 교정되어 출력된다. 원문 날짜를 그대로 신뢰한다.
  { id: 'relead-r3', courseId: 'kium-04', displayMonth: 12, start: '2026-12-17', end: '2026-12-18', status: 'recruiting' },
  // 신입·온보딩 — On-Powering 리텐션 (kium-03)
  { id: 'onpow-r1',  courseId: 'kium-03', displayMonth: 12, start: '2026-12-09', end: '2026-12-10', status: 'recruiting' },
  { id: 'onpow-r2',  courseId: 'kium-03', displayMonth: 12, start: '2026-12-16', end: '2026-12-17', status: 'recruiting' },
];

/** 공개교육 개설 과정 id — KIUM_SESSIONS에서 파생(수기 목록 금지) */
export const KIUM_OPEN_COURSE_IDS: string[] = Array.from(
  new Set(KIUM_SESSIONS.map((s) => s.courseId))
);

export function isOpenCourse(courseId: string): boolean {
  return KIUM_OPEN_COURSE_IDS.includes(courseId);
}

/** 공개교육 9과정 — KIUM_COURSES 기존 정렬(카테고리 order → 연번) 유지 */
export function getOpenCourses(): KiumCourse[] {
  return KIUM_COURSES.filter((c) => isOpenCourse(c.id));
}

export function getSessionsOfCourse(courseId: string): KiumSession[] {
  return KIUM_SESSIONS.filter((s) => s.courseId === courseId);
}

/** 시작일 오름차순 */
export function getSessionsByDate(): KiumSession[] {
  return [...KIUM_SESSIONS].sort((a, b) => a.start.localeCompare(b.start));
}

export function getSessionById(id: string): KiumSession | undefined {
  return KIUM_SESSIONS.find((s) => s.id === id);
}

export function countByMonth(month: 10 | 11 | 12): number {
  return KIUM_SESSIONS.filter((s) => s.displayMonth === month).length;
}

/** 총 회차 수 — 히어로 지표. 수기 숫자 금지 */
export const KIUM_SESSION_TOTAL = KIUM_SESSIONS.length;

/** 공개교육 9과정 기준 카테고리 카운트 (0건 카테고리는 칩 자체를 만들지 않는다) */
export function openCategoryCounts(): { key: KiumCategory; label: string; count: number }[] {
  const open = getOpenCourses();
  return (Object.keys(KIUM_CATEGORY_META) as KiumCategory[])
    .map((key) => ({ key, label: KIUM_CATEGORY_META[key].label, count: open.filter((c) => c.category === key).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => KIUM_CATEGORY_META[a.key].order - KIUM_CATEGORY_META[b.key].order);
}

/* ── 표기 유틸 — 요일은 전부 여기서 파생한다 ───────────────────────── */
const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY-MM-DD' → Date. 타임존 영향 없이 로컬 자정으로 고정 */
function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 두 날짜 사이 일수(양끝 포함) */
export function sessionDays(s: KiumSession): number {
  const a = toDate(s.start).getTime();
  const b = toDate(s.end).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

/** '10.12(월)' */
export function fmtDay(iso: string): string {
  const d = toDate(iso);
  return `${d.getMonth() + 1}.${d.getDate()}(${DOW[d.getDay()]})`;
}

/** 1일: '10.27(화)' / 2일: '10.12(월) ~ 13(화)' / 월 경계: '11.30(월) ~ 12.1(화)' */
export function fmtRange(s: KiumSession): string {
  const a = toDate(s.start);
  const b = toDate(s.end);
  const head = fmtDay(s.start);
  if (s.start === s.end) return head;
  const tail =
    a.getMonth() === b.getMonth()
      ? `${b.getDate()}(${DOW[b.getDay()]})`
      : `${b.getMonth() + 1}.${b.getDate()}(${DOW[b.getDay()]})`;
  return `${head} ~ ${tail}`;
}

/** 명세 §1-1 표기 유틸 — '10.12(월) ~ 10.13(화) · 2일' / 1일 과정 '10.27(화) · 1일' */
export function formatSessionRange(s: KiumSession): string {
  return `${fmtRange(s)} · ${sessionDays(s)}일`;
}

/** 회차 pill 축약 — '10.12~13' / 1일 '10.27' */
export function fmtRangeShort(s: KiumSession): string {
  const a = toDate(s.start);
  const b = toDate(s.end);
  const head = `${a.getMonth() + 1}.${a.getDate()}`;
  if (s.start === s.end) return head;
  return a.getMonth() === b.getMonth()
    ? `${head}~${b.getDate()}`
    : `${head}~${b.getMonth() + 1}.${b.getDate()}`;
}

/** 스크린리더용 완전 표기 — '2026년 10월 12일 월요일부터 10월 13일 화요일까지' */
export function fmtRangeA11y(s: KiumSession): string {
  const a = toDate(s.start);
  const b = toDate(s.end);
  const one = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
  return s.start === s.end
    ? `${a.getFullYear()}년 ${one(a)}`
    : `${a.getFullYear()}년 ${one(a)}부터 ${one(b)}까지`;
}

/** 프리필용 — '10.12(월) ~ 10.13(화) · 2일' (formatSessionRange와 동일 근거) */
export function fmtRangePrefill(s: KiumSession): string {
  return formatSessionRange(s);
}

/** 종료일이 오늘 이전인가 — 클라이언트 마운트 후에만 호출할 것(SSG 규칙) */
export function isPast(s: KiumSession, now: Date): boolean {
  const end = toDate(s.end);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
}

/**
 * 렌더 단계 상태 오버라이드 (명세 §1-2 · §8 안전장치).
 * 데이터의 status가 무엇이든 종료일이 지난 회차는 closed로 강제 승격한다.
 * **데이터 원본은 불변** — 화면 표시만 바꾼다.
 * now가 null(서버 렌더·마운트 전)이면 데이터 값을 그대로 신뢰한다.
 */
export function effectiveStatus(s: KiumSession, now: Date | null): KiumSessionStatus {
  if (now && isPast(s, now)) return 'closed';
  return s.status;
}

/** 정렬 — weight ASC → start ASC (개강확정·마감임박 위, 마감 아래) */
export function sortByWeight(list: KiumSession[], now: Date | null): KiumSession[] {
  return [...list].sort((a, b) => {
    const d =
      KIUM_SESSION_META[effectiveStatus(a, now)].weight - KIUM_SESSION_META[effectiveStatus(b, now)].weight;
    return d !== 0 ? d : a.start.localeCompare(b.start);
  });
}

/** 상태별 건수 — 필터 칩 카운트. 현재 월·카테고리 필터가 적용된 목록을 넘긴다 */
export function countByStatus(list: KiumSession[], now: Date | null): Record<KiumSessionStatus, number> {
  const out: Record<KiumSessionStatus, number> = { recruiting: 0, confirmed: 0, closing: 0, closed: 0 };
  for (const s of list) out[effectiveStatus(s, now)] += 1;
  return out;
}

/** 특정 과정의 가장 임박한 '미마감' 회차 — 카드 최근접 회차 배지(§4-1 ⑥) */
export function getNearestSession(courseId: string, now: Date | null): KiumSession | undefined {
  return getSessionsByDate()
    .filter((s) => s.courseId === courseId && effectiveStatus(s, now) !== 'closed')
    .at(0);
}

/** 마감 회차 클릭 시 안내할 다음 회차 — 같은 과정 우선, 없으면 전체에서 가장 빠른 미마감 */
export function getNextOpenSession(s: KiumSession, now: Date | null): KiumSession | undefined {
  const sameCourse = getSessionsByDate().find(
    (o) => o.courseId === s.courseId && o.id !== s.id && effectiveStatus(o, now) !== 'closed'
  );
  if (sameCourse) return sameCourse;
  return getSessionsByDate().find((o) => o.id !== s.id && effectiveStatus(o, now) !== 'closed');
}
