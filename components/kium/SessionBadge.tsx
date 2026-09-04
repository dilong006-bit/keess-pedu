'use client';

import {
  IconAlarmClock,
  IconArrowRight,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleSlash,
  IconCornerDownRight,
} from './kiumIcons';
import { KIUM_SESSION_META, type KiumSessionStatus } from '@/lib/kium/sessions';

/**
 * 회차 모집 상태 배지 (명세 STEP 2)
 *
 * - 색만으로 상태를 전달하지 않는다: 색 + 아이콘 + 텍스트 3중 부호화. `aria-hidden` 금지
 * - 클래스는 `.kium-sbadge` — 기존 `.kium-badge`(과정안내 탭 `정부지원 환급` 칩)를 재정의하면
 *   같은 페이지의 다른 탭 렌더가 바뀌므로 별도 클래스로 격리한다(명세 값은 그대로).
 * - 레드 계열은 마감임박 전용. 지면 안 다른 요소에 레드 신규 사용 금지.
 */
const BADGE_ICON: Record<KiumSessionStatus, (p: { size?: 14 }) => JSX.Element> = {
  recruiting: IconCircleDashed,
  confirmed: IconCircleCheck,
  closing: IconAlarmClock,
  closed: IconCircleSlash,
};

export default function SessionBadge({
  status,
  seatsLeft,
}: {
  status: KiumSessionStatus;
  seatsLeft?: number;
}) {
  const meta = KIUM_SESSION_META[status];
  const Icon = BADGE_ICON[status];
  return (
    <span className="kium-sbadge" data-tone={meta.tone}>
      <Icon size={14} />
      <span>{meta.label}</span>
      {status === 'closing' && seatsLeft != null && <em>잔여 {seatsLeft}석</em>}
    </span>
  );
}

/** 상태별 CTA 라벨 — 명세 §2-3. 문구는 이 상수 한 곳에만 존재한다 */
export const CTA_LABEL: Record<KiumSessionStatus, string> = {
  // 고빈도 2상태만 축약한다(7자 → 4자). 한 화면에 20회 이상 반복되는 문장이라
  // '이 일정으로'는 정보가 아니라 배경이 된다 — 카드 안에 있으면 그 일정인 것이 자명하다.
  recruiting: '상담하기',
  confirmed: '상담하기',
  // 아래 둘은 저빈도이고 문구 자체가 상태 정보를 진다 — 줄이면 정보가 사라진다
  closing: '마감 전 상담',
  closed: '다음 회차 상담',
};

/**
 * 상태별 CTA (명세 §2-3)
 *
 * - recruiting / confirmed → 기본 outline 버튼
 * - closing → 강조 filled(레드). 지면에서 유일하게 filled로 렌더된다
 * - closed → **요소 자체를 교체**한다. `aria-disabled` 버튼은 스크린리더에 혼선을 주므로
 *   버튼이 아니라 텍스트 링크로 바꾸고, 다음 회차 상담(경로 B)으로 보낸다.
 */
export function SessionCta({
  status,
  label,
  onClick,
}: {
  status: KiumSessionStatus;
  /** 접근명 보강용 컨텍스트(과정명·일자). 버튼 텍스트는 CTA_LABEL 고정 */
  label: string;
  onClick: () => void;
}) {
  const text = CTA_LABEL[status];
  if (status === 'closed') {
    return (
      <button type="button" className="kium-cta-next" onClick={onClick} aria-label={`${label} ${text}`}>
        <IconCornerDownRight size={16} />
        <span>{text}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`kium-cta-ses${status === 'closing' ? ' is-urgent' : ''}`}
      onClick={onClick}
      aria-label={`${label} ${text}`}
    >
      <span>{text}</span>
      <IconArrowRight size={16} />
    </button>
  );
}

/**
 * 회차 카드 전용 — 상태와 행동을 **한 버튼**에 담는다 (명세 v2.1 §5-5)
 *
 * 왜 통합인가: 배지와 버튼이 세로로 붙어 같은 회차를 두 번 가리켰다. 카드 요소가
 *   5개(날짜·일수·과정명·배지·버튼)로 많아 세로가 길고, 모바일 가로 스크롤 카드에서 특히 불리했다.
 *
 * 왜 '배지를 버튼으로'가 아닌가: '모집중'은 상태(명사)라 **버튼 라벨이 동작을 말하지 않는다.**
 *   배지는 관례상 '정보'여서 클릭 가능하다고 학습돼 있지도 않다.
 *   → 배지를 버튼 **안으로** 흡수한다. 요소는 2개→1개로 줄고 라벨에 동작이 남는다.
 *
 * 마감은 형태 자체를 바꾼다 — 'aria-disabled' 버튼은 스크린리더에 혼선을 주므로
 *   정적 배지 + 텍스트 링크로 요소를 교체한다('SessionCta'의 closed 철학 승계).
 *   "마감은 이벤트를 걸지 않는다"가 색이 아니라 **형태**로 표현된다.
 *
 * 적용 범위는 `.kium-scard2`(스트립 카드 · 상세 패널 회차 카드)뿐이다.
 *   `SessionListView`의 `.kium-srow`는 가로 배치라 배지와 CTA가 이미 좌우로 갈려 있고
 *   세로 절약 효과가 없으므로 현행을 유지한다.
 */
export function SessionAction({
  status,
  seatsLeft,
  label,
  onClick,
  onNext,
}: {
  status: KiumSessionStatus;
  seatsLeft?: number;
  /** 접근명 보강용 컨텍스트(과정명·일자·금액) */
  label: string;
  onClick: () => void;
  /** 마감 시 다음 회차 상담(경로 B) */
  onNext: () => void;
}) {
  const meta = KIUM_SESSION_META[status];
  const Icon = BADGE_ICON[status];
  // 문구는 CTA_LABEL 한 곳에만 둔다 — 여기서 문자열을 다시 쓰면 출처가 둘이 된다
  const text = CTA_LABEL[status];

  if (status === 'closed') {
    return (
      <div className="kium-sact-closed">
        <span className="kium-sbadge" data-tone="gray">
          <Icon size={14} />
          <span>{meta.label}</span>
        </span>
        <button
          type="button"
          className="kium-cta-next"
          onClick={onNext}
          aria-label={`${label} ${text}`}
        >
          <IconCornerDownRight size={16} />
          <span>{text}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="kium-sact"
      data-tone={meta.tone}
      onClick={onClick}
      aria-label={`${label} ${meta.label} ${text}`}
    >
      <span className="kium-sact-st">
        <Icon size={14} />
        {meta.label}
        {status === 'closing' && seatsLeft != null && <em>잔여 {seatsLeft}석</em>}
      </span>
      <span className="kium-sact-go">
        {text}
        {/* kiumIcons는 14·16·20만 허용한다(파일 규칙) — 명세 예시의 15는 쓸 수 없다.
            기존 SessionCta의 화살표와 같은 16으로 맞춘다 */}
        <IconArrowRight size={16} />
      </span>
    </button>
  );
}
