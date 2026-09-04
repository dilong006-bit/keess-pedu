'use client';

import SessionBadge, { SessionCta } from './SessionBadge';
import {
  IconAlarmClock,
  IconCalendarDays,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleSlash,
} from './kiumIcons';
import type { KiumCourse } from '@/lib/kium/data';
import { fmtPrice } from '@/lib/kium/pricing';
import {
  KIUM_SESSION_META,
  effectiveStatus,
  fmtRange,
  fmtRangeA11y,
  fmtRangeShort,
  sessionDays,
  sortByWeight,
  type KiumSession,
  type KiumSessionStatus,
} from '@/lib/kium/sessions';

const PILL_ICON: Record<KiumSessionStatus, (p: { size?: 14 }) => JSX.Element> = {
  recruiting: IconCircleDashed,
  confirmed: IconCircleCheck,
  closing: IconAlarmClock,
  closed: IconCircleSlash,
};

/**
 * 회차 pill (명세 §3-4)
 *
 * 마감 pill은 `<button disabled>`가 아니라 **`<span>`으로 요소를 바꾼다**.
 * 비활성 버튼은 포커스를 못 받아 스크린리더가 존재를 놓치거나, 받으면 눌러도 반응이 없어
 * 고장으로 읽힌다. 취소선은 쓰지 않고 흐림으로만 후퇴시킨다(가독성 보호).
 */
export function SessionPill({
  session,
  course,
  now,
  onConsult,
}: {
  session: KiumSession;
  course: KiumCourse;
  now: Date | null;
  onConsult: (s: KiumSession) => void;
}) {
  const st = effectiveStatus(session, now);
  const Icon = PILL_ICON[st];
  const label = `${course.titleMarketing} ${fmtRangeA11y(session)} ${KIUM_SESSION_META[st].label}`;

  if (st === 'closed') {
    return (
      <span className="kium-pill-ses" data-tone="gray" aria-label={`${label} — 신청 불가`}>
        <Icon size={14} />
        <span>{fmtRangeShort(session)}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="kium-pill-ses"
      data-tone={KIUM_SESSION_META[st].tone}
      onClick={() => onConsult(session)}
      aria-label={`${label} 이 일정으로 상담`}
    >
      <Icon size={14} />
      <span>{fmtRangeShort(session)}</span>
    </button>
  );
}

/**
 * 상세 패널 회차 카드 (명세 §4-2)
 *
 * 날짜가 헤드라인, 상태 배지가 그 아래, CTA가 바닥. 상태별 CTA 규칙은 §2-3 그대로 따른다.
 *
 * [B type STEP 4-1] 다가오는 일정 스트립이 같은 카드를 재사용한다. 스트립은 여러 과정이 섞이므로
 *   과정명 1줄이 필요한데, 상세 패널은 이미 과정명이 헤더에 있어 중복이 된다.
 *   → `showCourse`를 **옵션**으로 둬서 미지정 시 A type 렌더가 한 픽셀도 바뀌지 않게 한다.
 *   `onCourseClick`이 있으면 과정명을 버튼으로 올려 그리드의 해당 카드로 보낸다.
 */
export function SessionCard({
  session,
  course,
  now,
  onConsult,
  showCourse = false,
  onCourseClick,
}: {
  session: KiumSession;
  course: KiumCourse;
  now: Date | null;
  onConsult: (s: KiumSession) => void;
  /** 과정명 1줄 노출 여부. 기본 false = 상세 패널 스트립(A type) 렌더 유지 */
  showCourse?: boolean;
  /** 과정명 클릭 시 동작. 없으면 과정명은 정적 텍스트로 렌더된다 */
  onCourseClick?: () => void;
}) {
  const st = effectiveStatus(session, now);
  const a11y = `${course.titleMarketing}, ${fmtRangeA11y(session)}, ${sessionDays(session)}일 과정, ${fmtPrice(course.id)}`;
  return (
    <div className="kium-scard2" data-status={st}>
      <p className="kium-scard2-date">
        <IconCalendarDays size={16} />
        <b>{fmtRange(session)}</b>
      </p>
      <p className="kium-scard2-days">{sessionDays(session)}일 과정</p>
      {showCourse &&
        (onCourseClick ? (
          <button
            type="button"
            className="kium-scard2-course"
            onClick={onCourseClick}
            aria-label={`${course.titleMarketing} 과정 카드로 이동`}
          >
            {course.titleMarketing}
          </button>
        ) : (
          <p className="kium-scard2-course is-static">{course.titleMarketing}</p>
        ))}
      <SessionBadge status={st} seatsLeft={session.seatsLeft} />
      <SessionCta status={st} label={a11y} onClick={() => onConsult(session)} />
    </div>
  );
}

/**
 * 회차 스트립 — 상세 패널 최상단(명세 §4-2).
 *
 * 모바일에서 2장 이상이면 가로 스크롤 + scroll-snap. 마지막 카드가 일부 잘려 보이는
 * peek 폭을 남겨 "뒤에 더 있다"를 알린다(어포던스).
 * 회차 0장이면 스트립 대신 안내 문구를 렌더한다.
 */
export default function SessionStrip({
  course,
  sessions,
  now,
  onConsult,
}: {
  course: KiumCourse;
  sessions: KiumSession[];
  now: Date | null;
  onConsult: (s: KiumSession) => void;
}) {
  const list = sortByWeight(sessions, now);

  return (
    <div className="kium-strip-wrap">
      <h5 className="kium-detail-h">교육일정</h5>
      {list.length === 0 ? (
        <p className="kium-noses">다음 회차 준비 중 — 과정만 상담이 가능합니다</p>
      ) : (
        <div className={`kium-strip${list.length === 1 ? ' is-single' : ''}`}>
          {list.map((s) => (
            <SessionCard key={s.id} session={s} course={course} now={now} onConsult={onConsult} />
          ))}
        </div>
      )}
    </div>
  );
}
