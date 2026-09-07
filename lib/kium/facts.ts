import { KIUM_CONTENT } from './content';

/**
 * 수치 검증 게이트 — 기술명세서 최종 v2.0 §3-2 · §6-2
 *
 * content.ts의 facts 중 `verified:false` 항목은 화면에 절대 렌더하지 않는다.
 * (공고 2025-237호 원문 검증 전 수치 — 오제공 방지)
 *
 * 렌더 컴포넌트는 이 모듈만 경유한다. 게이트 우회(= KIUM_CONTENT.facts 직접 접근)는 금지.
 */

/** 미검증 항목 접근 시 화면에 대신 노출하는 확정 문구 */
export const FACT_FALLBACK = '기업별 상이 · 상담 시 확인';

export type KiumFact = (typeof KIUM_CONTENT.facts)[number];

/** 검증 완료 항목만 — 목록 렌더는 반드시 이 함수를 사용 */
export function getVerifiedFacts(): readonly KiumFact[] {
  return KIUM_CONTENT.facts.filter((f) => f.verified);
}

/**
 * key로 수치 1건 조회.
 * - verified:true  → { value, verified:true }
 * - verified:false → { value: 대체 문구, verified:false } + 개발 모드 콘솔 경고
 * - 미존재         → 대체 문구 + 개발 모드 콘솔 경고
 */
export function getFact(key: string): { label: string; value: string; verified: boolean } {
  const fact = KIUM_CONTENT.facts.find((f) => f.key === key);

  if (!fact) {
    warn(`[kium/facts] 등록되지 않은 fact key "${key}" — 대체 문구를 반환합니다.`);
    return { label: '', value: FACT_FALLBACK, verified: false };
  }
  if (!fact.verified) {
    warn(
      `[kium/facts] 미검증 수치 "${key}"(${fact.label}) 접근 — 렌더 금지 항목입니다. ` +
        `대체 문구로 치환합니다. (출처 상태: ${fact.source})`
    );
    return { label: fact.label, value: FACT_FALLBACK, verified: false };
  }
  return { label: fact.label, value: fact.value, verified: true };
}

function warn(msg: string) {
  if (process.env.NODE_ENV !== 'production') console.warn(msg);
}
