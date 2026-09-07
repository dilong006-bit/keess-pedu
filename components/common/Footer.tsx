'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ReportModal from './ReportModal';
import Modal from './Modal';
import PrivacyModal from './PrivacyModal';
import {
  FAMILY_SITES,
  SNS,
  COMPANY_INFO,
  FOOT_NOTE,
  COPYRIGHT,
  ISMS_MARK_SRC,
  ISMS_CERT_SRC,
  ISMS_CERT_PLACEHOLDER,
} from '@/data/footer';

function SnsIcon({ icon }: { icon: 'instagram' | 'facebook' | 'blog' }) {
  if (icon === 'instagram')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
    );
  if (icon === 'facebook')
    return (
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V5.5h-3c-2 0-3.5 1.6-3.5 3.6V11H8v3h2.5v7H14v-7h2.6l.4-3H14V9.4c0-.3.2-.4.5-.4z" /></svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11a2 2 0 012 2v14l-4-3H5a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M8 9h7M8 13h5" /></svg>
  );
}

export default function Footer() {
  const [famOpen, setFamOpen] = useState(false);
  const [report, setReport] = useState<{ open: boolean; tab: 'info' | 'report' | 'lookup' }>({
    open: false,
    tab: 'info',
  });
  const [ismsOpen, setIsmsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const famRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (famRef.current && !famRef.current.contains(e.target as Node)) setFamOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFamOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <>
      <footer className="foot" id="site-footer">
        <div className="wrap">
          <div className="foot-util">
            <div className="famsite" ref={famRef}>
              <button
                className={`fam-btn${famOpen ? ' open' : ''}`}
                aria-expanded={famOpen}
                aria-haspopup="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setFamOpen((o) => !o);
                }}
              >
                FAMILY SITE
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <ul className={`fam-menu${famOpen ? ' open' : ''}`} role="menu">
                {FAMILY_SITES.map((f) => (
                  <li role="none" key={f.href}>
                    <a role="menuitem" href={f.href} target="_blank" rel="noopener">{f.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* '맨 위로 ↑'는 플로팅 상단이동 버튼(ToTop)과 중복되어 제거 — 상단이동 수단은 ToTop이 담당 */}
          </div>

          <div className="foot-main">
            <div className="foot-brand">
              <div className="logo">KEESS</div>
              <p className="note">{FOOT_NOTE}</p>
              <div className="sns">
                {SNS.map((s) => (
                  <a key={s.href} className="tap44" href={s.href} target="_blank" rel="noopener" aria-label={s.label}>
                    <SnsIcon icon={s.icon} />
                  </a>
                ))}
              </div>
            </div>
            <div className="foot-company">
              <dl className="cinfo">
                {COMPANY_INFO.map((c) => (
                  <div key={c.dt}><dt>{c.dt}</dt><dd>{c.dd}</dd></div>
                ))}
              </dl>
              <div className="foot-policy">
                {/* 이용약관은 페이지 미제작 확정(8/6)으로 구분점과 함께 삭제 — 구분점 2개 연속 금지 */}
                <button className="report-link priv tap44" type="button" aria-haspopup="dialog"
                        onClick={() => setPrivacyOpen(true)}>개인정보처리방침</button>
                <span>·</span>
                <Link href="/csr">KG그룹 사회공헌</Link>
                <span>·</span>
                <button className="report-link tap44" type="button" onClick={() => setReport({ open: true, tab: 'info' })}>부정훈련 예방 안내</button>
                <span>·</span>
                <button className="report-link tap44" type="button" onClick={() => setReport({ open: true, tab: 'report' })}>부정훈련 신고</button>
                <button type="button" className="isms-btn" onClick={() => setIsmsOpen(true)} aria-label="정보보호 관리체계(ISMS) 인증서 보기" aria-haspopup="dialog">
                  <Image className="isms-mark" src={ISMS_MARK_SRC} alt="ISMS 정보보호 관리체계 인증" width={116} height={82} />
                </button>
              </div>
            </div>
          </div>

          <div className="foot-bottom">
            <div className="copy">{COPYRIGHT}</div>
          </div>
        </div>
      </footer>

      <ReportModal open={report.open} initialTab={report.tab} onClose={() => setReport((r) => ({ ...r, open: false }))} />

      {/* 개인정보처리방침 모달 — 문구는 data/privacy.ts 단일 소스 */}
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />

      {/* ISMS 인증서 모달 — 공통 Modal(포커스 트랩·ESC·오버레이 클릭·배경 스크롤 잠금·포커스 복귀 내장) */}
      <Modal open={ismsOpen} onClose={() => setIsmsOpen(false)} labelledBy="isms-cert-title" title="정보보호 관리체계(ISMS) 인증서" maxWidth={460}>
        <div className="isms-cert">
          {/* 원본 수급 전: placeholder 노출(404 방지). 수급 후 src를 ISMS_CERT_SRC(/certificates/isms.jpg)로 교체. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ISMS_CERT_PLACEHOLDER} data-cert-src={ISMS_CERT_SRC} alt="정보보호 관리체계(ISMS) 인증서" />
        </div>
      </Modal>
    </>
  );
}
