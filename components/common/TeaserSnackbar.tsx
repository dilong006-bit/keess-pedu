'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNoticeFlag } from '@/hooks/useNoticeFlag';

/**
 * 원타임 티저 스낵바 (기술명세서 v1.0 §2 M3 · 기능 플래그)
 *
 * NEXT_PUBLIC_KIUM_TEASER='on' 일 때만 존재한다. 플래그가 off 면 훅 아래 모든 타이머·DOM 이
 * 생기지 않는다(= DOM 미렌더). 값은 빌드 시 인라인되므로 아래 상수 비교로 충분하다.
 *
 * 소멸 경로는 셋(CTA·X·6초 만료)이지만 결과는 하나다 — kiumTeaserSeen=true.
 * "한 번 보여주고 끝"이 이 컴포넌트의 전부이므로, 어느 경로로 사라졌는지는 구분하지 않는다.
 */

const ENABLED = process.env.NEXT_PUBLIC_KIUM_TEASER === 'on';

/** 진입 후 등장까지 */
const SHOW_DELAY = 1200;
/** 등장 후 자동 소멸까지 */
const LIFETIME = 6000;
/** 슬라이드다운이 끝나고 DOM 에서 빠지기까지. CSS transition 과 동일. */
const EXIT_MS = 280;

export default function TeaserSnackbar() {
  const pathname = usePathname();
  const { unseen, dismiss } = useNoticeFlag('kiumTeaserSeen', { mobileOnly: true });
  const [rendered, setRendered] = useState(false);
  const [open, setOpen] = useState(false);
  // 등장 시퀀스는 페이지 체류 중 단 한 번 — dismiss 로 unseen 이 꺼져도 재실행되면 안 된다
  const startedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const active = ENABLED && pathname !== '/kium' && unseen;

  const close = useCallback(() => {
    setOpen(false);
    dismiss();
    const t = window.setTimeout(() => setRendered(false), EXIT_MS);
    timersRef.current.push(t);
  }, [dismiss]);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    setRendered(true);
    timersRef.current.push(
      window.setTimeout(() => setOpen(true), SHOW_DELAY),
      window.setTimeout(close, SHOW_DELAY + LIFETIME)
    );
  }, [active, close]);

  // 언마운트 시 남은 타이머 정리 (라우트 이동 중 setState 방지)
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(window.clearTimeout);
  }, []);

  // 떠 있는 동안에는 '맨 위로' FAB 을 위로 밀어 겹침을 막는다 (§2 M3 제약)
  useEffect(() => {
    document.body.classList.toggle('teaser-on', rendered && open);
    return () => document.body.classList.remove('teaser-on');
  }, [rendered, open]);

  if (!rendered) return null;

  return (
    <div className={`teaser${open ? ' show' : ''}`} role="status">
      <p className="teaser-msg">2026 정부지원 훈련 신설 · 훈련비 90~95% 환급</p>
      <Link className="teaser-cta" href="/kium" data-ga-id="teaser-kium-cta" onClick={close}>
        보러가기
      </Link>
      <button
        className="teaser-close"
        type="button"
        data-ga-id="teaser-kium-close"
        aria-label="알림 닫기"
        onClick={close}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
