'use client';

import { useEffect, useMemo, useState } from 'react';
import { SessionCard } from './SessionCard';
import SessionListView from './SessionListView';
import { IconChevronDown } from './kiumIcons';
import { getCourseById } from '@/lib/kium/queries';
import { effectiveStatus, type KiumSession } from '@/lib/kium/sessions';

/** 노출 장수 — PC/TB 6장 · MO 3장 (명세 STEP 4-1) */
const PC_MAX = 6;
const MO_MAX = 3;
const MO_MQ = '(max-width:767px)';

/**
 * 다가오는 일정 스트립 (B type 명세 STEP 4)
 *
 * 스트립은 **일정 축**이고 카드 그리드는 **과정 축**이다. 같은 데이터를 두 번 보여주는 것이 아니라
 * "언제"로 들어온 사람과 "무엇"으로 들어온 사람을 각자의 입구에서 받는다(전략 v1.1 R7).
 *
 * 규칙
 *  · 카드는 A type `SessionCard`를 그대로 쓴다 — 스타일 재정의 없이 `showCourse` prop만 켠다(변인 통제)
 *  · 마감(closed) 회차는 스트립에서 빼고 날짜 오름차순으로 세운다. 필터 결과를 그대로 받는다
 *  · 「전체 일정」은 **인라인 전개**다. 별도 페이지·탭을 만들지 않는다(탭 2개 수치 보호)
 *  · 전개 목록의 회차 행 규격은 A type `SessionListView`를 그대로 재사용한다
 */
export default function UpcomingSessionsStrip({
  sessions,
  now,
  onConsultSession,
  onCourseFocus,
}: {
  /** 필터가 적용된 회차 목록(마감 포함) — 「전체 일정」 전개의 모수 */
  sessions: KiumSession[];
  now: Date | null;
  onConsultSession: (s: KiumSession) => void;
  /** 과정명 클릭 — 그리드의 해당 카드로 보낸다 */
  onCourseFocus: (courseId: string) => void;
}) {
  // 서버 렌더는 PC 기준(6장)으로 나가고 마운트 후 보정한다. 장수 차이라 레이아웃이 깨지지 않는다
  const [mo, setMo] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MO_MQ);
    const sync = () => setMo(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const upcoming = useMemo(
    () =>
      sessions
        .filter((s) => effectiveStatus(s, now) !== 'closed')
        .sort((a, b) => a.start.localeCompare(b.start)),
    [sessions, now]
  );

  const shown = upcoming.slice(0, mo ? MO_MAX : PC_MAX);
  const listId = 'kium-allsched';

  return (
    <div className="kium-ustrip-wrap">
      {shown.length === 0 ? (
        // 필터 결과에 미마감 회차가 없는 경우 — 마감만 남은 상태다. 전개 버튼은 아래에 그대로 남는다
        <p className="kium-noses kium-ustrip-none">
          해당 조건에 신청 가능한 회차가 없습니다 — 전체 일정에서 지난 회차를 확인하실 수 있습니다.
        </p>
      ) : (
        <div className="kium-ustrip">
          {shown.map((s) => {
            const c = getCourseById(s.courseId);
            if (!c) return null;
            return (
              <div
                className="kium-ustrip-cell"
                key={s.id}
                data-evt="kium_session_cta"
                data-evt-course={c.id}
                data-evt-session={s.id}
                data-evt-status={effectiveStatus(s, now)}
                data-evt-reach="A"
              >
                <SessionCard
                  session={s}
                  course={c}
                  now={now}
                  onConsult={onConsultSession}
                  showCourse
                  onCourseClick={() => onCourseFocus(c.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="kium-ustrip-foot">
          <button
            type="button"
            className={mo ? 'kium-chip kium-ustrip-all' : 'kium-cta-quiet'}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((v) => !v)}
          >
            <span>{mo ? `전체 일정 보기 (${sessions.length}개 회차)` : '전체 일정'}</span>
            <IconChevronDown size={16} className={expanded ? 'is-up' : undefined} />
          </button>
        </div>
      )}

      {expanded && (
        <div className="kium-ulist" id={listId}>
          {/* 경로 C(시기만 상담) 미탑재 — 월 그룹 CTA는 렌더하지 않는다(명세 STEP 6) */}
          <SessionListView
            sessions={sessions}
            now={now}
            onConsultSession={onConsultSession}
            showMonthCta={false}
          />
        </div>
      )}
    </div>
  );
}
