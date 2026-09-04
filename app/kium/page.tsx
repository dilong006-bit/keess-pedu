import type { Metadata } from 'next';
import '@/styles/home.css';
import '@/styles/kium.css';
import '@/styles/kium-open.css';
import Nav from '@/components/common/Nav';
import RevealInit from '@/components/common/RevealInit';
import HomeInquiry from '@/components/sections/home/HomeInquiry';
import KiumHero from '@/components/kium/KiumHero';
import KiumBenefitStats from '@/components/kium/KiumBenefitStats';
import KiumTabs from '@/components/kium/KiumTabs';
import KiumOverviewTable from '@/components/kium/KiumOverviewTable';
import KiumEligibility from '@/components/kium/KiumEligibility';
import KiumProcess from '@/components/kium/KiumProcess';
import KiumCautions from '@/components/kium/KiumCautions';
import KiumFaq from '@/components/kium/KiumFaq';
import KiumCoursesTab from '@/components/kium/KiumCoursesTab';
import KiumOpenTab from '@/components/kium/KiumOpenTab';
import KiumApplySummary from '@/components/kium/KiumApplySummary';
import { KIUM_CONTENT } from '@/lib/kium/content';

export const metadata: Metadata = {
  title: '인재키움 프리미엄 | KEESS',
  description:
    '2026 중소기업 인재 키움 프리미엄 훈련 — 지원대상 확인부터 과정 설계·정부 신청·환급까지 KG에듀원이 함께합니다.',
};

/** 제도 근거 표기 — 기술명세서 최종 v2.0 §2 외부 링크 맵 3번(공단 공고) */
const NOTICE_LINK = KIUM_CONTENT.officialLinks[2];

export default function KiumPage() {
  // 탭1 — 사업소개
  const intro = (
    <>
      <section className="kium-sec" id="kium-overview">
        <div className="wrap">
          <p className="eyebrow r">지원개요</p>
          <h2 className="kium-sec-title r" tabIndex={-1} data-panel-heading>
            {KIUM_CONTENT.sectionLeads.overview}
          </h2>
          {/* 섹션 리드 — 자격확인(KiumEligibility)이 쓰는 .kium-sec-sub 재사용. 신규 클래스 없음 */}
          <p className="kium-sec-sub r">{KIUM_CONTENT.sectionLeads.overviewSub}</p>
          <div className="r">
            <KiumOverviewTable />
          </div>
          <p className="kium-caption r">
            제도 근거 ·{' '}
            <a href={NOTICE_LINK.url} target="_blank" rel="noopener noreferrer">
              {NOTICE_LINK.label}
              <span className="kium-sr">(새 창에서 열림)</span>
            </a>
          </p>
        </div>
      </section>

      <section className="kium-sec alt" id="kium-eligibility">
        <div className="wrap">
          <p className="eyebrow r">자격확인 가이드</p>
          <h2 className="kium-sec-title r">{KIUM_CONTENT.sectionLeads.eligibility}</h2>
          <div className="r">
            <KiumEligibility />
          </div>
        </div>
      </section>

      <section className="kium-sec" id="kium-process">
        <div className="wrap">
          <p className="eyebrow r">신청절차</p>
          <h2 className="kium-sec-title r">{KIUM_CONTENT.sectionLeads.process}</h2>
          {/* 고객 혜택 선제시 — 히어로와 동일한 검증 facts 재사용 */}
          <KiumBenefitStats variant="band" />
          <KiumProcess />
          <div className="r">
            <KiumCautions />
          </div>
        </div>
      </section>

      <section className="kium-sec alt" id="kium-faq">
        <div className="wrap">
          <p className="eyebrow r">자주 묻는 질문</p>
          <h2 className="kium-sec-title r">{KIUM_CONTENT.sectionLeads.faq}</h2>
          <div className="kium-faq r">
            <KiumFaq />
          </div>
          <div className="kium-faq-foot r">
            <span className="t">{'더 궁금한 점은 신청\u00A0문의로 남겨 주세요.'}</span>
            <a className="btn btn-ink faq-cta" href="#inq">
              신청 문의
            </a>
          </div>
        </div>
      </section>
    </>
  );

  // 탭2 — 과정안내 (B type: 전체 과정 ↔ 공개교육 일정 보기 전환을 이 패널이 소유한다)
  const coursesPanel = (
    <section className="kium-sec" id="kium-courses">
      <div className="wrap">
        <p className="eyebrow r">과정안내</p>
        <h2 className="kium-sec-title r" tabIndex={-1} data-panel-heading>
          {KIUM_CONTENT.sectionLeads.courses}
        </h2>
        <KiumCoursesTab />
      </div>
    </section>
  );

  /* 탭3 — 공개교육 (§5-12). 데이터·상태는 전부 KiumOpenTab이 lib에서 조회한다.
     [B type STEP 1-1] 이 패널은 **보존**된다. KiumTabs의 SHOW_OPEN_TAB=false인 동안
     렌더 트리에 오르지 않아 DOM이 생성되지 않을 뿐, 플래그를 true로 돌리면 그대로 되살아난다. */
  const openPanel = (
    <section className="kium-sec" id="kium-open">
      <div className="wrap">
        <p className="eyebrow r">{KIUM_CONTENT.open.eyebrow}</p>
        <h2 className="kium-sec-title r" tabIndex={-1} data-panel-heading>
          {KIUM_CONTENT.open.title}
        </h2>
        <KiumOpenTab />
      </div>
    </section>
  );

  return (
    <main id="main" className="kium-page" tabIndex={-1}>
      {/* GNB 정식 메뉴는 추가하지 않는다(§6-8) — 진입은 홈 히어로 슬라이드·Nav 이벤트 칩 */}
      <Nav current="home" consultHref="#inq" forceSolid />
      <RevealInit />

      <KiumHero />
      <KiumTabs intro={intro} courses={coursesPanel} open={openPanel} />

      {/* CTA 밴드 — 양 탭 하단 공통. 기존 도입문의 폼 그대로 재사용(필드·동의 구조 무변경).
          /kium 경유 진입이므로 '정부 지원' 칩을 선택된 상태로 시작하고(해제 가능),
          제출 페이로드에는 lead_source를 비노출 필드로 싣는다. */}
      {/* data-evt: dataLayer(GTM) 미탑재 구간의 계측 표식(명세 STEP 8).
          kium_consult_submit은 5개 페이지가 공유하는 HomeInquiry의 제출 버튼에 걸려야 하는데,
          공유 폼을 고치면 타 페이지 회귀 위험이 생긴다 → /kium 제출 스코프에만 표식을 남기고
          실제 바인딩은 dataLayer 도입 시점으로 미룬다(완료 보고 명시). */}
      <div className="kium-cta-band" data-evt="kium_consult_submit" data-evt-scope="form">
        {/* 신청 요약 배너 — 공유 폼을 건드리지 않고 프리필 상태를 시각화한다(§7-2).
            회차 선택 전에는 아예 렌더되지 않는다. */}
        <KiumApplySummary />
        <HomeInquiry
          presetInterests={['gov']}
          presetInterestSubs={['인재키움']}
          leadSource={KIUM_CONTENT.leadSource}
          prefillEventName="kium:inquiry-prefill"
        />
      </div>
    </main>
  );
}
