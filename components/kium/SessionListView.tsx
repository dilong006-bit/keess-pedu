'use client';

import { SessionAction } from './SessionBadge';
import { IconArrowRight, IconCalendarDays, IconClock, IconWallet } from './kiumIcons';
import { KIUM_CATEGORY_META } from '@/lib/kium/data';
import { getCourseById } from '@/lib/kium/queries';
import { fmtPrice, KIUM_PRICE_NOTE } from '@/lib/kium/pricing';
import {
  effectiveStatus,
  fmtRange,
  fmtRangeA11y,
  sessionDays,
  sortByWeight,
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
}) {
  const groups = MONTHS.map((m) => ({
    month: m,
    items: sortByWeight(
      sessions.filter((s) => s.displayMonth === m),
      now
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="kium-slist">
      {groups.map((g) => {
        const hid = `kium-m-${g.month}`;
        return (
          <section className="kium-mgroup" key={g.month} aria-labelledby={hid}>
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
                      <span className="kium-srow-title">{c.titleMarketing}</span>
                    </div>

                    <p className="kium-srow-meta">
                      <span>
                        <IconClock size={16} />
                        {c.hours}시간
                      </span>
                      <span>
                        <IconWallet size={16} />
                        <b className="num">{fmtPrice(c.id)}</b>
                        <i>{KIUM_PRICE_NOTE}</i>
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
