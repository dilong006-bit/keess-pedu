'use client';

import { KIUM_CONTENT } from './content';

/**
 * 과정 패널 CTA → 도입문의 폼 브리지 (기술명세서 최종 v2.0 §4 KiumCtaBand ⑤)
 *
 * 폼(HomeInquiry)의 필드·동의 구조는 그대로 두고, '문의 내용' 초기값만 채운다.
 * 채워진 값은 일반 textarea 값이므로 사용자가 자유롭게 편집·삭제할 수 있다.
 */
export const KIUM_PREFILL_EVENT = 'kium:inquiry-prefill';

/** 공개교육 프리필 블록 — 헤더 + 연속된 '· ' 줄 전체 */
export const KIUM_OPEN_PREFILL_RE = /^\[공개교육 상담 신청\]\n(?:· [^\n]*\n)+/;
/** 관심 과정 블록 — 헤더 + (선택) '· 문의 내용:' 줄 */
export const KIUM_PREFILL_RE = /^\[관심 과정: [^\]]*\][^\n]*\n?(?:· 문의 내용:[^\n]*\n?)?/;

/**
 * 프리필 헤더 블록 제거 목록 — **모든 지시자가 이 배열 하나를 쓴다**.
 *
 * 각 브리지가 자기 토큰만 지우던 구조에서는 경로를 바꿔 가며 누르면 헤더가 겹쳐 쌓였다
 * (`[관심 과정: …]`와 `[공개교육 상담 신청]`이 한 본문에 동시 존재).
 * 제거 대상은 헤더 블록뿐이고 사용자가 직접 쓴 문장은 그대로 남는다.
 *
 * ※ 이 상수는 반드시 inquiryBridge에 산다 — openBridge → inquiryBridge 단방향 import라
 *   반대로 두면 순환 import가 된다.
 */
export const PREFILL_STRIP: RegExp[] = [KIUM_OPEN_PREFILL_RE, KIUM_PREFILL_RE];

export function kiumPrefillText(titleMarketing: string) {
  return `[관심 과정: ${titleMarketing}]\n· 문의 내용: \n`;
}

/** 제출 페이로드 태깅 값 — UI에는 노출하지 않는다 */
export const KIUM_LEAD_SOURCE = KIUM_CONTENT.leadSource;

/** 문의 내용 프리필 요청 + 폼으로 이동 */
export function requestKiumInquiry(titleMarketing: string) {
  window.dispatchEvent(
    new CustomEvent(KIUM_PREFILL_EVENT, {
      // strip을 넘기지 않으면 폼이 기본값으로 폴백해 공개교육 블록이 남는다(헤드 중복의 원인)
      detail: { text: kiumPrefillText(titleMarketing), strip: PREFILL_STRIP },
    })
  );
  const el = document.getElementById('inq');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
