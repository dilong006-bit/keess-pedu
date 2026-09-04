'use client';

import { SessionAction } from './SessionBadge';
import { IconArrowRight, IconCalendarDays, IconClock, IconWallet } from './kiumIcons';
import { KIUM_CATEGORY_META } from '@/lib/kium/data';
import { getCourseById } from '@/lib/kium/queries';
import { fmtPrice } from '@/lib/kium/pricing';
import {
  effectiveStatus,
  fmtRange,
  fmtRangeA11y,
  sessionDays,
  type KiumSession,
} from '@/lib/kium/sessions';

const MONTHS = [10, 11, 12] as const;

/**
 * 일정순 뷰 (명세 STEP 3-3) — 월 그룹 리스트. 공개교육 탭 기본 보기.
 *
 * - 행 구성(좌→우, 모바일 위→아래): ①날짜 블록 ②카테고리 dot-칩 + 과정명 ③메타(시간·가격)
 *   ④상태 배지 ⑤상태별 CTA
 * - 날짜가 행에서 가장 크고 진한 요소다. 이 위계가 뒤집히면 과정별 뷰의 열화판이 된다.
 * - 정렬: weight ASC → start ASC (개강확정·마감임박 위, 마감 아래)
 * - 행 전체는 클릭 대상이 아니다 — CTA만 인터랙티브(오클릭 방지)
 */
export default function SessionListView({
  sessions,
  now,
  onConsultSession,
  onConsultMonth,
  showMonthCta = true,
  onCourseFocus,
}: {
  sessions: KiumSession[];
  now: Date | null;
  onConsultSession: (s: KiumSession) => void;
  /** 월 그룹 헤더 「이 시기 교육 상담」(프리필 경로 C). showMonthCta=false면 호출되지 않는다 */
  onConsultMonth?: (m: 10 | 11 | 12) => void;
  /**
   * [B type STEP 6] 경로 C는 미탑재다 — 트리거를 렌더하지 않는다(코드는 보존).
   * 기본 true라 기존 호출부(KiumSchedule)의 렌더는 그대로다.
   */
  showMonthCta?: boolean;
  /**
   * [BT-24] 과정명 클릭 시 동작. 없으면 정적 `<span>`으로 렌더된다.
   *   옵션으로 둬서 숨김 보존된 `KiumSchedule`의 A type 렌더가 한 픽셀도 바뀌지 않게 한다.
   *   `SessionCard`의 `onCourseClick`과 같은 패턴이다.
   */
  onCourseFocus?: (courseId: string) => void;
}) {
  const groups = MONTHS.map((m) => ({
    month: m,
    /**
     * [BT-26] 「전체 일정」의 축은 시간이다 — 날짜 오름차순이 1순위다.
     *   이전 sortByWeight()는 weight ASC → start ASC라, 상태 시드가 들어가는 순간
     *   같은 월 안에서 날짜가 뒤섞였다(11월 11.9가 네 칸 뒤로 밀림).
     *   상태 우선 정렬은 '추천순'의 논리이고, 월 그룹으로 묶인 날짜 목록에는 맞지 않는다.
     *   스트립이 날짜 오름차순이므로 이 규칙으로 두 뷰의 순서도 일치한다(BT-18 토글 교체).
     *   단 closed는 지난 회차라 미래 회차 사이에 끼면 안 되므로 각 그룹 최하단으로 보낸다.
     *   ※ sortByWeight()는 CourseListView·KiumSchedule이 참조하므로 함수 자체는 건드리지 않는다.
     */
    items: sessions
      .filter((s) => s.displayMonth === m)
      .sort((a, b) => {
        const ca = effectiveStatus(a, now) === 'closed' ? 1 : 0;
        const cb = effectiveStatus(b, now) === 'closed' ? 1 : 0;
        return ca - cb || a.start.localeCompare(b.start);
      }),
  })).filter((g) => g.items.length > 0);

  // [BT-23] 그룹이 하나뿐이면 월 헤더는 역할이 없다 —
  //   구분할 대상이 없고 건수는 모드 헤더('공개교육 일정 · 11월 6개 회차')가 이미 말한다.
  //   필터 값이 아니라 '렌더되는 그룹 수'로 판정해 데이터가 바뀌어도 규칙이 성립하게 한다.
  const showGroupHead = groups.length > 1;

  return (
    <div className="kium-slist">
      {groups.map((g) => {
        const hid = `kium-m-${g.month}`;
        return (
          <section
            className="kium-mgroup"
            key={g.month}
            // 헤더가 없으면 aria-labelledby가 존재하지 않는 id를 가리킨다 → aria-label로 대체
            {...(showGroupHead
              ? { 'aria-labelledby': hid }
              : { 'aria-label': `${g.month}월 회차 목록` })}
          >
            {showGroupHead && (
              <div className="kium-mgroup-head">
                <h4 className="kium-mgroup-t" id={hid}>
                  {g.month}월 <span className="cnt">{g.items.length}개 회차</span>
                </h4>
                {showMonthCta && onConsultMonth && (
                  <button
                    type="button"
                    className="kium-cta-quiet"
                    onClick={() => onConsultMonth(g.month)}
                    aria-label={`${g.month}월 개강 과정 상담 문의`}
                  >
                    <span>이 시기 교육 상담</span>
                    <IconArrowRight size={16} />
                  </button>
                )}
              </div>
            )}

            <ul className="kium-srows">
              {g.items.map((s) => {
                const c = getCourseById(s.courseId);
                if (!c) return null;
                const st = effectiveStatus(s, now);
                const a11y = `${c.titleMarketing}, ${fmtRangeA11y(s)}, ${sessionDays(s)}일 과정, ${fmtPrice(c.id)}`;
                return (
                  <li className="kium-srow" data-status={st} key={s.id}>
                    <p className="kium-srow-date">
                      <IconCalendarDays size={16} />
                      <b>{fmtRange(s)}</b>
                      <span className="d">· {sessionDays(s)}일</span>
                    </p>

                    <div className="kium-srow-main">
                      <span className="kium-lab cat" data-cat={c.category}>
                        <span className="kium-dot" aria-hidden="true" />
                        {KIUM_CATEGORY_META[c.category].label}
                      </span>
                      {/* [BT-24] 요약(스트립)과 전체(리스트)는 '깊이'가 다를 뿐 기능이 달라선 안 된다.
                          BT-18에서 두 뷰를 같은 자리 토글 교체로 만들었으니,
                          토글 하나에 조금 전까지 되던 동작이 사라지면 그대로 인지 비용이 된다. */}
                      {onCourseFocus ? (
                        <button
                          type="button"
                          className="kium-srow-title is-link"
                          onClick={() => onCourseFocus(c.id)}
                          aria-label={`${c.titleMarketing} 과정 카드로 이동`}
                        >
                          {c.titleMarketing}
                        </button>
                      ) : (
                        <span className="kium-srow-title">{c.titleMarketing}</span>
                      )}
                    </div>

                    <p className="kium-srow-meta">
                      <span>
                        <IconClock size={16} />
                        {c.hours}시간
                      </span>
                      <span>
                        <IconWallet size={16} />
                        {/* [BT-25] '1인 기준'은 공개교육 9과정 전건 동일한 값이다.
                            행마다 반복하면 20회가 되는데, 지워도 어떤 행의 의미도 달라지지 않는다.
                            전건 같은 값은 항목이 아니라 영역에 속한다 → 컨테이너 헤더에서 한 번만. */}
                        <b className="num">{fmtPrice(c.id)}</b>
                      </span>
                    </p>

                    {/* [BT-22] 카드와 같은 통합 버튼을 쓴다. 명세 v2.1 §5-5는 "가로 배치라
                        세로 절약 효과가 없다"며 리스트를 제외했지만, 실제 CSS는 ≤1023px에서
                        .kium-srow가 1열로 접히고 ≤479px에서 CTA가 전폭이 되어 배지 1줄 + 버튼 1줄
                        = 2줄이 된다. 카드에서 고친 것과 같은 구조가 모바일 리스트에 남아 있었다.
                        스트립↔리스트는 BT-18에서 같은 자리 토글 교체이므로 형태까지 달라지면
                        인지 비용이 생긴다. 다른 것은 폭 규칙(.kium-srow-act 스코프)뿐이다. */}
                    <div className="kium-srow-act">
                      <SessionAction
                        status={st}
                        seatsLeft={s.seatsLeft}
                        label={a11y}
                        onClick={() => onConsultSession(s)}
                        onNext={() => onConsultSession(s)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
