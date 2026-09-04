'use client';

import SessionBadge, { SessionCta } from './SessionBadge';
import { SessionCard, SessionPill } from './SessionCard';
import { KIUM_STATUS_ORDER, KIUM_SESSION_META, type KiumSession, type KiumSessionStatus } from '@/lib/kium/sessions';
import { GUARD_CLOSED_TEXT } from '@/lib/kium/openBridge';
import { getCourseById } from '@/lib/kium/queries';

/**
 * 상태 쇼케이스 (명세 STEP 7) — `?preview=badges` 쿼리가 있을 때만 렌더된다.
 *
 * 목적
 *  ① 데이터를 조작하지 않고 4종 상태 UI를 한 화면에서 대조
 *  ② 배지 4톤 명도대비(AA)를 실제 렌더로 실측
 *  ③ 향후 상태 스타일 회귀 검수의 기준 화면
 *
 * 게이트: 쿼리가 없으면 이 컴포넌트 자체가 호출되지 않아 **DOM이 생성되지 않는다**.
 * 사이트 내 어떤 UI에서도 이 쿼리로 가는 링크를 만들지 않는다(유출 방지).
 */
const DEMO_COURSE_ID = 'kium-09';

/** 쇼케이스 전용 가짜 회차 — KIUM_SESSIONS에 넣지 않는다(집계·목록 오염 방지) */
function demoSession(status: KiumSessionStatus, i: number): KiumSession {
  const day = 12 + i * 2;
  return {
    id: `demo-${status}`,
    courseId: DEMO_COURSE_ID,
    displayMonth: 10,
    start: `2026-10-${String(day).padStart(2, '0')}`,
    end: `2026-10-${String(day + 1).padStart(2, '0')}`,
    status,
    seatsLeft: status === 'closing' ? 3 : undefined,
  };
}

export default function BadgeShowcase() {
  const course = getCourseById(DEMO_COURSE_ID);
  if (!course) return null;
  const noop = () => {};

  return (
    <section className="kium-showcase" aria-label="모집 상태 UI 쇼케이스(개발 검수용)">
      <p className="kium-showcase-head">
        상태 쇼케이스 · <code>?preview=badges</code> — 검수 전용 화면입니다. 사이트 내 링크는 없습니다.
      </p>

      <h4>① 상태 배지 4종</h4>
      <div className="kium-showcase-row">
        {KIUM_STATUS_ORDER.map((st) => (
          <span key={st} className="kium-showcase-cell">
            <SessionBadge status={st} />
            <em>{st}</em>
          </span>
        ))}
        <span className="kium-showcase-cell">
          <SessionBadge status="closing" seatsLeft={3} />
          <em>closing + 잔여석</em>
        </span>
      </div>

      <h4>② 상태별 CTA 4종</h4>
      <div className="kium-showcase-row">
        {KIUM_STATUS_ORDER.map((st) => (
          <span key={st} className="kium-showcase-cell">
            <SessionCta status={st} label="쇼케이스" onClick={noop} />
            <em>{KIUM_SESSION_META[st].label}</em>
          </span>
        ))}
      </div>

      <h4>③ 회차 pill 4종 (마감은 비클릭 span)</h4>
      <div className="kium-showcase-row">
        {KIUM_STATUS_ORDER.map((st, i) => (
          <span key={st} className="kium-showcase-cell">
            <SessionPill session={demoSession(st, i)} course={course} now={null} onConsult={noop} />
            <em>{KIUM_SESSION_META[st].label}</em>
          </span>
        ))}
      </div>

      <h4>④ 상세 회차 카드 4종</h4>
      <div className="kium-strip">
        {KIUM_STATUS_ORDER.map((st, i) => (
          <SessionCard key={st} session={demoSession(st, i)} course={course} now={null} onConsult={noop} />
        ))}
      </div>

      <h4>⑤ 스트립 카드 4종 (과정명 1줄 · B type STEP 4-1)</h4>
      <div className="kium-ustrip">
        {KIUM_STATUS_ORDER.map((st, i) => (
          <div className="kium-ustrip-cell" key={st}>
            <SessionCard
              session={demoSession(st, i)}
              course={course}
              now={null}
              onConsult={noop}
              showCourse
              onCourseClick={noop}
            />
          </div>
        ))}
      </div>

      <h4>⑥ 마감 가드 배너</h4>
      <div className="kium-apply-sum" role="status">
        <span className="kium-apply-guard">{GUARD_CLOSED_TEXT}</span>
      </div>

      <h4>⑦ 회차 0개 케이스</h4>
      <p className="kium-noses">다음 회차 준비 중 — 과정만 상담이 가능합니다</p>
    </section>
  );
}
