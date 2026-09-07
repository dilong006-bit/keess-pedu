'use client';
import { useEffect, useRef } from 'react';

/**
 * 모달 제어 (TECHSPEC §8): body 스크롤 잠금, 포커스 트랩, ESC·스크림 닫기,
 * 닫을 때 트리거로 포커스 복귀.
 */
export function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;

    /* [MO-03] body 스크롤 잠금 — overflow:hidden 단독으로는 iOS Safari에서 배경이 막히지 않는다.
       position:fixed 로 잠그되 스크롤 위치를 잃으므로 복원이 필수다.
       Nav.tsx(모바일 드로어)가 이미 쓰고 있는 패턴을 이 훅으로 가져온다 —
       시트·Modal·ReportModal 세 곳이 전부 이 훅을 쓰므로 한 곳만 고치면 된다. */
    const y = window.scrollY;
    const body = document.body;
    /* [이중 잠금 가드] Nav 드로어가 열린 상태에서 모달이 열리면 두 구현이 같은 body.style 을
       각자 저장·복원한다. Nav가 먼저 잠그면 이 훅의 prev 에 position:fixed 가 담겨
       모달을 닫아도 그 값이 되살아난다 → 이미 잠겨 있으면 잠금도 복원도 하지 않는다.
       이펙트 1회 실행에 묶인 값이라 지역 변수로 충분하다(ref 불필요). */
    const alreadyLocked = body.style.position === 'fixed';
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    if (!alreadyLocked) {
      body.style.position = 'fixed';
      body.style.top = `-${y}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    const dialog = ref.current;
    // 첫 포커스 대상
    const first =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      /* 순서가 곧 정확성이다:
         ① body.style 복원 ② scrollBehavior 를 임시 auto(부드러운 스크롤이 끼어들면
         복원이 애니메이션으로 보인다 — Nav.tsx 가 이미 그렇게 한다) ③ 위치 복원
         ④ 원복 ⑤ 포커스. focus() 는 대상으로 스크롤을 유발해 scrollTo 와 경쟁하므로
         마지막에 두고 preventScroll 을 준다. */
      if (!alreadyLocked) {
        Object.assign(body.style, prev);
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, y);
        html.style.scrollBehavior = prevBehavior;
      }
      if (lastFocus.current && lastFocus.current.focus) {
        lastFocus.current.focus({ preventScroll: true });
      }
    };
  }, [open, onClose]);

  return ref;
}
