'use client';

import { ChevronRight } from 'lucide-react';
import SessionStrip from './SessionCard';
import { IconArrowRight } from './kiumIcons';
import { KIUM_CATEGORY_META, type KiumCourse } from '@/lib/kium/data';
import { requestKiumInquiry } from '@/lib/kium/inquiryBridge';
import { fmtRange, getSessionsByDate, getSessionsOfCourse, isOpenCourse, type KiumSession } from '@/lib/kium/sessions';
import { fmtPrice, KIUM_PRICE_NOTE } from '@/lib/kium/pricing';

/** 회차 나열 상한 — 3건까지 나열하고 나머지는 '외 n건'으로 접는다(§5-11) */
const SCHEDULE_MAX = 3;

/**
 * F9 상세 패널 — 3차 개정 [수정 10]
 *
 * 과정개요서(HRD솔루션팀 원안)의 설득 구조를 웹으로 번안한 순서:
 *   ①헤더(카테고리·titleMarketing·titleOfficial) → ②슬로건 밴드 → ③메타 pill 4종
 *   → ④과정목표 인용 블록 → ⑤특장점 3스텝 → ⑥교육구성 표(합계 행) → ⑦CTA
 *
 * 데이터는 data.ts 기존 필드만 사용한다. 개요서에 있던 '특장점 섹션 헤드라인'에 해당하는
 * 필드는 data.ts에 존재하지 않으므로 표기를 생략했다(완료 보고 명시).
 * 교육 단가는 원칙적으로 데이터에도 화면에도 없다. 단 공개교육 9과정은 예외로,
 * 1인 단가(lib/kium/pricing.ts N열)와 개강 일정을 메타 pill 2종으로 노출한다
 * (공개교육 탭 명세 §1-1 · §5-11). 위탁 10과정은 종전대로 두 pill 자체를 렌더하지 않는다.
 *
 * [고도화 §4-2] `variant="open"`은 공개교육 탭 전용 배치다. 회차 카드 스트립을
 *   헤더 바로 아래(정보 순서 ①)로 올려 "언제 열리는지"를 첫 화면에 둔다.
 *   과정안내 탭(`variant` 미지정) 렌더는 한 픽셀도 바뀌지 않는다.
 */
export default function KiumCoursePanel({
  course,
  titleId,
  variant = 'default',
  now = null,
  onConsultSession,
  onConsultCourse,
}: {
  course: KiumCourse;
  titleId: string;
  variant?: 'default' | 'open';
  now?: Date | null;
  onConsultSession?: (s: KiumSession) => void;
  onConsultCourse?: (c: KiumCourse) => void;
}) {
  const isOpenVar = variant === 'open';
  const totalHours = course.modules.reduce((sum, m) => sum + m.hours, 0);
  const hasSlogan = !!course.slogan?.trim();

  return (
    <div className="kium-detail">
      {/* ① 헤더 */}
      <div className="kium-detail-head">
        <span className="kium-lab cat" data-cat={course.category}>
          <span className="kium-dot" aria-hidden="true" />
          {KIUM_CATEGORY_META[course.category].label}
        </span>
        <h4 className="kium-detail-title" id={titleId}>
          {course.titleMarketing}
        </h4>
        {/*
          [수정 14] "공식 신청명 · {titleOfficial}" 캡션은 렌더에서 제거했다.
          마케팅명과 거의 같은 문자열이 반복돼 의사결정 정보가 되지 못하기 때문이다.
          data.ts의 titleOfficial 필드·값은 그대로 보존한다(고용24 신청 실무·검증 대조용).
          고객 고지가 필요하다고 확인되면 FAQ 또는 패널 하단 각주로 복원한다.
        */}
      </div>

      {/* ① 교육일정 — open 변형에서만, 정보 순서 최상단(§4-2) */}
      {isOpenVar && (
        <SessionStrip
          course={course}
          sessions={getSessionsOfCourse(course.id)}
          now={now}
          onConsult={(s) => onConsultSession?.(s)}
        />
      )}

      {/* ② 슬로건 밴드 — slogan이 비어 있으면 밴드 자체를 렌더하지 않는다 */}
      {hasSlogan && (
        <p className="kium-slogan-band">{course.slogan}</p>
      )}

      {/* ③ 메타 pill 4종 — 단가는 미노출 */}
      <div className="kium-meta-pills">
        <span className="kium-pill">
          <b>교육 대상</b>
          {course.target}
        </span>
        <span className="kium-pill">
          <b>교육 형태</b>
          {course.delivery}
        </span>
        <span className="kium-pill">
          <b>교육 시간</b>
          <span className="num">
            {course.hours}시간 · {course.days}일
          </span>
        </span>
        <span className="kium-pill">
          <b>정원</b>
          <span className="num">{course.capacity}명</span>
        </span>
        {/* 공개교육 9과정 한정 — 위탁 10과정은 미렌더('-' 표기 금지).
            open 변형은 스트립이 일정을 이미 보여주므로 '교육 일정' pill을 중복 렌더하지 않는다. */}
        {isOpenCourse(course.id) && !isOpenVar && (
          <>
            {/* 라벨이 '교육 일정'이면 이 과정 전체의 일정으로 읽힌다 — 실제로는 공개교육 회차만
                나열한 것이고 이 과정은 기업 위탁으로도 운영된다(schedule: '연중상시'). */}
            <span className="kium-pill" data-open>
              <b>공개교육</b>
              {(() => {
                const list = getSessionsByDate().filter((s) => s.courseId === course.id);
                const head = list.slice(0, SCHEDULE_MAX).map(fmtRange).join(', ');
                return list.length > SCHEDULE_MAX ? `${head} 외 ${list.length - SCHEDULE_MAX}건` : head;
              })()}
            </span>
            <span className="kium-pill" data-open>
              <b>교육비</b>
              <span className="num">{fmtPrice(course.id)}</span>
              <i className="kium-pill-note">{KIUM_PRICE_NOTE}</i>
            </span>
          </>
        )}
        {isOpenCourse(course.id) && isOpenVar && (
          <span className="kium-pill" data-open>
            <b>교육비</b>
            <span className="num">{fmtPrice(course.id)}</span>
            <i className="kium-pill-note">{KIUM_PRICE_NOTE}</i>
          </span>
        )}
      </div>

      {/* ④ 과정목표 — 인용 블록 */}
      <div>
        <h5 className="kium-detail-h">과정목표</h5>
        <blockquote className="kium-goals-quote">
          <ul className="kium-goals">
            {course.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </blockquote>
      </div>

      {/* ⑤ 특장점 3스텝 — 01 채움 / 02·03 아웃라인 + 화살표 */}
      <div>
        <h5 className="kium-detail-h">특장점</h5>
        <ol className="kium-hl-steps">
          {course.highlights.map((h, i) => (
            <li className="kium-hl-step" key={h.no} data-first={i === 0}>
              <div className="kium-hl-card">
                <span className="kium-hl-no">{h.no}</span>
                <p className="kium-hl-t">{h.title}</p>
                <p className="kium-hl-d">{h.desc}</p>
              </div>
              {i < course.highlights.length - 1 && (
                <ChevronRight className="kium-hl-arrow" size={18} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* ⑥ 교육구성 표 — zebra + 시간 우측 tabular-nums + 합계 행 */}
      <div>
        <h5 className="kium-detail-h">교육구성</h5>
        <div className="kium-mod-wrap">
          <table className="kium-modules">
            <thead>
              <tr>
                <th scope="col">영역</th>
                <th scope="col">주요 학습내용</th>
                <th scope="col" className="hrs">시간</th>
              </tr>
            </thead>
            <tbody>
              {course.modules.map((m) => (
                <tr key={`${m.area}-${m.content}`}>
                  <td>{m.area}</td>
                  <td>{m.content}</td>
                  <td className="hrs">{m.hours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>합계</td>
                <td className="hrs">총 {totalHours}시간</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ⑦ CTA — open 변형은 일정 미정 상담(경로 B)으로 보낸다 */}
      <div className="kium-detail-cta">
        {isOpenVar ? (
          <button
            type="button"
            className="kium-cta-ses"
            onClick={() => onConsultCourse?.(course)}
            aria-label={`${course.titleMarketing} 이 과정으로 상담하기`}
          >
            <span>이 과정으로 상담하기</span>
            <IconArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => requestKiumInquiry(course.titleMarketing)}
          >
            {'이 과정으로 신청\u00A0문의'}
          </button>
        )}
      </div>
    </div>
  );
}
