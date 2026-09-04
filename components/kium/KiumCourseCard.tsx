'use client';

import { ChevronDown } from 'lucide-react';
import KiumThumb from './KiumThumb';
import SessionBadge from './SessionBadge';
import { IconCalendarDays } from './kiumIcons';
import { KIUM_CATEGORY_META, type KiumCourse } from '@/lib/kium/data';
import { effectiveStatus, fmtRangeShort, getNearestSession } from '@/lib/kium/sessions';

/**
 * F7/F8 과정 카드 — 기술명세서 v1.0 §4
 *
 * 카드 = button 시맨틱(aria-expanded로 상세 패널 연동). 노출 필드는 화이트리스트(§1-1) 한정:
 * 썸네일 · 카테고리 라벨 · 과정명 · summary · 대상 · 시간/일수 · 정부지원 환급.
 * 단가·강사·NCS·정원은 카드에 노출하지 않는다.
 * [260824] 소분류(subCategory) 삭제 · 'AI융합형' 칩 삭제.
 *
 * [공개교육 고도화 §4-1] `variant="open"`은 공개교육 탭 전용 렌더다.
 *   과정안내 탭(`variant` 미지정)의 렌더는 **한 픽셀도 바뀌지 않는다** — 두 탭이 이 컴포넌트를
 *   공유하므로 칩 제거·썸네일 전환을 무조건 적용하면 과정안내 탭까지 변형된다.
 *   open 변형에서만: 정부지원 환급 칩 제거(C3 — 섹션 스탯 카드가 담당) · 공개교육 개설 칩
 *   제거(C4 — 탭 자체가 그 정보다) · 최근접 회차 배지 노출(⑥) · 실사 썸네일 주입.
 */
export default function KiumCourseCard({
  course,
  open,
  panelId,
  onToggle,
  variant = 'default',
  thumbSrc,
  now = null,
}: {
  course: KiumCourse;
  open: boolean;
  panelId: string;
  onToggle: () => void;
  variant?: 'default' | 'open';
  /** 공개교육 탭 전용 썸네일 경로 override (data.ts 무변경) */
  thumbSrc?: string;
  now?: Date | null;
}) {
  const isOpen = variant === 'open';
  const nearest = isOpen ? getNearestSession(course.id, now) : undefined;

  return (
    <button
      type="button"
      className={`kium-card${isOpen ? ' is-openvar' : ''}`}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <KiumThumb
        category={course.category}
        title={course.titleMarketing}
        thumbSrc={thumbSrc ?? course.thumbSrc}
      />

      <span className="kium-card-body">
        <span className="kium-card-labels">
          <span className="kium-lab cat" data-cat={course.category}>
            {/* 카테고리 컬러 dot — 썸네일 표면과 같은 --mesh-a로 그리드 스캔 시 그룹핑을 돕는다 */}
            <span className="kium-dot" aria-hidden="true" />
            {KIUM_CATEGORY_META[course.category].label}
          </span>
        </span>

        {/*
          [수정 12] 본문 과정명 행은 텍스트 모드에서 제거 — 과정명을 썸네일 텍스트가 담당한다(중복 노출 제거).
          이미지 모드(thumbSrc 있음)에서는 썸네일이 과정명을 더 이상 노출하지 않으므로 본문에 복원한다.
          [고도화 §4-1] open 변형은 전 과정 실사라 항상 이미지 모드 → 본문 타이틀 1회만 나온다.
        */}
        {(thumbSrc ?? course.thumbSrc) && <span className="kium-card-title">{course.titleMarketing}</span>}

        <span className="kium-card-summary">{course.summary}</span>

        <span className="kium-card-meta">
          <span className="kium-meta-t">
            대상 <b>{course.target}</b>
          </span>
          <span className="kium-meta-t">
            <b>{course.hours}</b>시간 · <b>{course.days}</b>일
          </span>
          {/* [260824] 'AI융합형' 칩은 사업 지시로 렌더에서 제거.
              data.ts의 `type` 필드·값은 보존한다(고용24 신청 실무·검증 대조용 — titleOfficial과 동일 취급). */}
          {/* [B-Type 고도화 §5-1] 정부지원 환급 배지는 렌더하지 않는다.
              19/19 전 카드에 붙던 라벨이라 변별력이 0이고, 지면에서 가장 진한 색(--gov)이라
              카드마다 다른 대상·시간보다 먼저 읽혔다. 스크린리더는 카탈로그를 훑을 때 19번 반복 낭독했다.
              같은 사실은 섹션 승격 1줄(.kium-allhead)이 한 번만 말한다.
              CSS 규칙 .kium-badge.gov는 남겨 둔다(전역 검색 결과 다른 사용처는 없으나 토큰 삭제는 별건). */}
          {/* 펼침 방향 인디케이터 — .kium-elig-chev(KiumEligibility)와 동일 패턴 재사용 */}
          <ChevronDown className="kium-card-chev" size={16} aria-hidden="true" />
        </span>

        {/* 최근접 회차 — 카드 단계에서 "언제"가 보이게 한다(§4-1 ⑥) */}
        {isOpen && (
          <span className="kium-card-next">
            {nearest ? (
              <>
                <IconCalendarDays size={16} />
                <b>{fmtRangeShort(nearest)}</b>
                <SessionBadge status={effectiveStatus(nearest, now)} seatsLeft={nearest.seatsLeft} />
              </>
            ) : (
              <span className="soft">다음 회차 준비 중</span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}
