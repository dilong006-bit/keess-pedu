'use client';

import { useEffect, useState } from 'react';
import { IconCalendarRange } from './kiumIcons';
import {
  GUARD_CLOSED_TEXT,
  KIUM_OPEN_SELECT_EVENT,
  OPEN_REQUEST_TYPE,
  type OpenSelection,
} from '@/lib/kium/openBridge';
import { getCourseById } from '@/lib/kium/queries';
import { formatSessionRange, getSessionById } from '@/lib/kium/sessions';

/**
 * 신청 확인 배너 (명세 §5-2)
 *
 * 공유 폼(HomeInquiry)을 건드리지 않고 프리필 상태를 시각화하기 위해 **폼 바깥**에 둔다.
 * 이것이 회귀 위험을 낮추는 핵심 설계다 — 폼의 필드·검증·동의 구조는 이 컴포넌트와 무관하다.
 *
 * · 선택 없음 → 렌더하지 않는다
 * · role="status" → 암묵 aria-live="polite". 프리필 완료가 스크린리더에 고지된다
 * · [변경] → 일정 섹션으로 복귀
 * · 마감 가드: 경로 B이면서 마감 회차에서 넘어온 경우 안내 문구를 함께 띄운다(§5-3)
 */
export default function KiumApplySummary() {
  const [sel, setSel] = useState<OpenSelection | null>(null);

  useEffect(() => {
    const onSelect = (e: Event) => {
      const d = (e as CustomEvent<OpenSelection>).detail;
      if (!d) return;
      setSel(d);
    };
    window.addEventListener(KIUM_OPEN_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(KIUM_OPEN_SELECT_EVENT, onSelect);
  }, []);

  if (!sel) return null;

  let body: React.ReactNode = null;
  let guard: string | null = null;

  if (sel.route === 'A') {
    const c = getCourseById(sel.courseId);
    const s = getSessionById(sel.sessionId);
    if (!c || !s) return null;
    body = (
      <>
        <b>{c.titleMarketing}</b> · {formatSessionRange(s)}
      </>
    );
  } else if (sel.route === 'B' && 'request' in sel) {
    // 경로 B 변형 — 과정을 특정하지 않는 상담 요청. 문구는 OPEN_REQUEST_TYPE 단일 출처
    body = (
      <>
        <b>공개교육 상담</b> · {OPEN_REQUEST_TYPE[sel.request]}
      </>
    );
  } else if (sel.route === 'B') {
    const c = getCourseById(sel.courseId);
    if (!c) return null;
    const from = sel.fromClosedSessionId ? getSessionById(sel.fromClosedSessionId) : undefined;
    body = (
      <>
        <b>{c.titleMarketing}</b> · 일정 협의 희망
      </>
    );
    if (from) guard = GUARD_CLOSED_TEXT;
  } else {
    body = (
      <>
        <b>{sel.month}월 개강 과정</b> · 시기 상담
      </>
    );
  }

  return (
    <div className="kium-apply-sum" role="status">
      <span className="kium-apply-line">
        <IconCalendarRange size={16} />
        {body}
        <span className="t">상담으로 작성 중입니다</span>
      </span>
      {guard && <span className="kium-apply-guard">{guard}</span>}
      {/* 공개교육 탭 숨김(B type STEP 1-1)으로 #kium-open 패널은 렌더되지 않는다.
          되돌아갈 곳은 회차 UI가 실제로 사는 과정안내 섹션이다. */}
      <a className="chg" href="#kium-courses">
        변경
      </a>
    </div>
  );
}
