'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
 * 공개교육 일정 영역 (B-Type 고도화 명세 v2.0 §3-10)
 *
 * 스트립은 **일정 축**이고 카드 그리드는 **과정 축**이다. 같은 데이터를 두 번 보여주는 것이 아니라
 * "언제"로 들어온 사람과 "무엇"으로 들어온 사람을 각자의 입구에서 받는다(전략 v1.1 R7).
 *
 * ★ 「전체 일정」은 **추가 전개(add)가 아니라 교체(swap)**다.
 *   이전 구조는 스트립을 그대로 둔 채 아래에 전체 리스트를 덧붙여, `10.12 Agent` 같은 회차가
 *   한 화면에 두 번 나왔다. 두 영역의 관계가 '요약 → 전체'인데 요약이 사라지지 않으니
 *   경계가 성립하지 않았고, 그것이 "어디서 어디까지 바뀌는지 모르겠다"의 실제 원인이었다.
 *   → 같은 자리에서 **요약 6장 ↔ 전체 목록**을 갈아 끼운다. 중복 노출 0.
 *
 * 규칙
 *  · 카드는 A type `SessionCard`를 그대로 쓴다 — 스타일 재정의 없이 `showCourse` prop만 켠다(변인 통제)
 *  · 마감(closed) 회차는 요약에서 빼고 날짜 오름차순으로 세운다. 필터 결과를 그대로 받는다
 *  · 헤더·본문·토글을 `.kium-schedbox` 한 덩어리로 묶어 시각 경계를 만든다
 *  · 전개 목록의 회차 행 규격은 A type `SessionListView`를 그대로 재사용한다
 */
export default function UpcomingSessionsStrip({
  sessions,
  now,
  onConsultSession,
  onCourseFocus,
  header,
}: {
  /** 필터가 적용된 회차 목록(마감 포함) — 「전체 일정」의 모수 */
  sessions: KiumSession[];
  now: Date | null;
  onConsultSession: (s: KiumSession) => void;
  /** 과정명 클릭 — 그리드의 해당 카드로 보낸다 */
  onCourseFocus: (courseId: string) => void;
  /** 모드 헤더 — 컨테이너 안으로 들여 헤더 행 좌측을 차지한다(§3-10) */
  header: ReactNode;
}) {
  // 서버 렌더는 PC 기준(6장)으로 나가고 마운트 후 보정한다. 장수 차이라 레이아웃이 깨지지 않는다
  const [mo, setMo] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** 전환 고지 — 화면 변화를 스크린리더가 스스로 알아채지 못하므로 이 통로가 유일한 수단이다 */
  const [live, setLive] = useState('');

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
  const bodyId = 'kium-schedbox-body';

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    setLive(
      next
        ? `전체 일정 ${sessions.length}개 회차를 표시했습니다`
        : `임박한 회차 ${shown.length}개를 표시했습니다`
    );
  };

  return (
    <div className="kium-schedbox">
      <div className="kium-schedbox-head">
        {header}
        {sessions.length > 0 && (
          <button
            type="button"
            className="kium-schedbox-toggle"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={toggle}
          >
            {/* 라벨이 '다음 상태'가 아니라 '결과'를 말한다 — 누르면 무엇이 보이는지가 곧 이름이다 */}
            <span>{expanded ? '간략히 보기' : `전체 일정 ${sessions.length}개 회차`}</span>
            <IconChevronDown size={16} className={expanded ? 'is-up' : undefined} />
          </button>
        )}
      </div>

      <div className="kium-schedbox-body" id={bodyId}>
        {expanded ? (
          <div className="kium-ulist">
            {/* 경로 C(시기만 상담) 미탑재 — 월 그룹 CTA는 렌더하지 않는다(명세 STEP 6) */}
            <SessionListView
              sessions={sessions}
              now={now}
              onConsultSession={onConsultSession}
              showMonthCta={false}
            />
          </div>
        ) : shown.length === 0 ? (
          // 필터 결과에 미마감 회차가 없는 경우 — 마감만 남은 상태다. 토글은 헤더에 그대로 있다
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
      </div>

      <p className="kium-sr" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
