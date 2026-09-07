'use client';

import { useState } from 'react';
import KiumCoursePanel from './KiumCoursePanel';
import { SessionPill } from './SessionCard';
import { IconArrowRight, IconChevronDown, IconClock, IconWallet } from './kiumIcons';
import { KIUM_CATEGORY_META, type KiumCourse } from '@/lib/kium/data';
import { getCourseById } from '@/lib/kium/queries';
import { fmtPrice, KIUM_PRICE_NOTE } from '@/lib/kium/pricing';
import { sortByWeight, type KiumSession } from '@/lib/kium/sessions';

/**
 * 과정별 뷰 (명세 STEP 3-4) — 과정 1행 + 회차 pill 목록.
 *
 * - 과정명은 행에 1회만 나온다. 회차는 pill로 접어 세로 길이를 억제한다
 * - pill 클릭 = 해당 회차 프리필(경로 A). 마감 pill은 `<span>`이라 클릭 대상이 아니다
 * - [과정 상세]는 인라인 확장 — 같은 문맥에서 펼쳐야 어디를 보고 있었는지 잃지 않는다
 */
export default function CourseListView({
  courses,
  sessions,
  now,
  onConsultSession,
  onConsultCourse,
}: {
  courses: KiumCourse[];
  sessions: KiumSession[];
  now: Date | null;
  onConsultSession: (s: KiumSession) => void;
  onConsultCourse: (c: KiumCourse) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="kium-clist">
      {courses.map((c) => {
        const mine = sortByWeight(
          sessions.filter((s) => s.courseId === c.id),
          now
        );
        const isOpen = openId === c.id;
        const panelId = `kium-clist-panel-${c.id}`;
        return (
          <li className="kium-crow" key={c.id}>
            <div className="kium-crow-head">
              <div className="kium-crow-main">
                <span className="kium-lab cat" data-cat={c.category}>
                  <span className="kium-dot" aria-hidden="true" />
                  {KIUM_CATEGORY_META[c.category].label}
                </span>
                <span className="kium-crow-title">{c.titleMarketing}</span>
                <span className="kium-crow-meta">
                  <span>
                    <IconClock size={16} />
                    {c.hours}시간 · {c.days}일
                  </span>
                  <span>
                    <IconWallet size={16} />
                    <b className="num">{fmtPrice(c.id)}</b>
                    <i>{KIUM_PRICE_NOTE}</i>
                  </span>
                </span>
              </div>

              <div className="kium-crow-acts">
                <button
                  type="button"
                  className="kium-cta-quiet"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                >
                  <span>과정 상세</span>
                  <IconChevronDown size={16} className={isOpen ? 'is-up' : undefined} />
                </button>
                <button
                  type="button"
                  className="kium-cta-ses"
                  onClick={() => onConsultCourse(c)}
                  aria-label={`${c.titleMarketing} 과정만 상담`}
                >
                  <span>과정만 상담</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>

            {mine.length > 0 ? (
              <ul className="kium-pills" aria-label={`${c.titleMarketing} 회차`}>
                {mine.map((s) => (
                  <li key={s.id}>
                    <SessionPill session={s} course={c} now={now} onConsult={onConsultSession} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="kium-noses">다음 회차 준비 중입니다. 과정만 상담이 가능합니다.</p>
            )}

            {isOpen && (
              <div className="kium-clist-panel" id={panelId} role="region" aria-label={`${c.titleMarketing} 상세`}>
                <KiumCoursePanel
                  course={c}
                  titleId={`${panelId}-title`}
                  variant="open"
                  now={now}
                  onConsultSession={onConsultSession}
                  onConsultCourse={onConsultCourse}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 과정별 뷰가 노출할 과정 목록 — 필터 결과에 회차가 남은 과정만(빈 행 생성 금지) */
export function coursesWithSessions(all: KiumCourse[], sessions: KiumSession[]): KiumCourse[] {
  return all.filter((c) => sessions.some((s) => s.courseId === c.id));
}

export { getCourseById };
