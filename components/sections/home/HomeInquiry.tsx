'use client';

import { AlertCircle, Trash2 } from 'lucide-react';
import { EMAIL_RE, INQ_MAX, fmtPhone, hasNonPhoneChar } from '@/lib/utils';
import { readInterestParam } from '@/lib/inquiryPreset';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INQ } from '@/data/home';
import { submitInquiry } from '@/lib/inquiry/submit';
import type { InquiryResult } from '@/lib/inquiry/types';
import { INQUIRY_CONTACT, INQUIRY_MAILTO, INQUIRY_TEL_HREF } from '@/lib/inquiry/contact';
import { useAutoDismissTimer } from '@/hooks/useAutoDismissTimer';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { SUCCESS_AUTO_RESET_MS } from '@/components/common/InquirySuccess';
import { PREFILL_STRIP } from '@/lib/kium/inquiryBridge';

const ALLOWED = ['zip', 'pdf', 'hwp', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif'];
const MAX = 10 * 1024 * 1024;
const FILE_PLACEHOLDER = '파일을 선택하거나 끌어다 놓으세요';
/**
 * 첨부파일 민감정보 유의 문구(정보보호팀 승인 문구 · G2-11). 전문 말미(4. 동의 거부 권리 뒤)와
 * 첨부파일 필드 헬퍼에 동일 문구로 노출한다 — 전문을 열지 않아도 인지 가능하도록.
 */
const FILE_PRIVACY_NOTE =
  '※ 첨부파일에는 개인정보(주민등록번호, 계좌정보 등 민감정보 포함)가 담기지 않도록 유의하여 주시기 바랍니다.';
/** 전문 아코디언 펼침 상한(px) — 교체된 전문이 잘리지 않도록 상향(§G2-11) */
const CONSENT_TEXT_MAXH = 700;

/** 상태 key → 입력 element id (제출 실패 시 첫 미충족 필드로 포커스 이동) */
const FIELD_ID: Record<string, string> = {
  company: 'f-company', name: 'f-name', phone: 'f-phone', position: 'f-position',
  emailLocal: 'f-email', emailDomain: 'f-email', companySize: 'f-csize', trainees: 'f-trainees', message: 'f-msg',
};

/** 상담 신청 제출 페이로드 — A안 정본 스키마(기술명세서 §C). */
export interface InquiryPayload {
  companyName: string;
  managerName: string;
  phone: string;
  position: string;
  email: string; // `${id}@${domain}` 결합값
  companySize: string;
  expectedTrainees: string;
  interests: string[];
  message: string;
  attachment: File | null;
  agreePrivacy: true;
  agreeMarketing: boolean;
  agreeMarketingEmail: boolean;
  agreeMarketingSms: boolean;
  agreeMarketingTel: boolean;
  /** 유입 경로 태깅(예: /kium 경유 = 'kium'). 화면에 노출되지 않는 비수집 메타 필드 */
  lead_source?: string;
}

interface HomeInquiryProps {
  /**
   * 관심 영역 칩 초기 선택값(사용자가 해제 가능). 홈에서는 지정하지 않아 기존 동작 그대로다.
   * ※ 폼의 필드·동의 구조는 변경하지 않는다 — 기존 칩 중 무엇을 켜고 시작할지만 정한다.
   */
  presetInterests?: string[];
  /**
   * '정부 지원' 세부 분야 칩의 초기 선택값(사용자가 해제 가능).
   * 부모 칩이 함께 선택돼 있지 않으면 노출되지 않는다.
   */
  presetInterestSubs?: string[];
  /** 제출 페이로드에 실을 유입 경로 값(UI 미노출) */
  leadSource?: string;
  /** 지정 시 해당 CustomEvent를 구독해 '문의 내용'만 프리필한다(사용자 편집 가능) */
  prefillEventName?: string;
}

/** 제출 진행 상태 (기술명세서 §1) — idle·submitting 을 거쳐 결과 3종 중 하나로 간다. */
type InquiryStatus = 'idle' | 'submitting' | InquiryResult;

/**
 * '문의 내용' 사전 경고 패턴 (기술명세서 §2-4).
 * 입력을 막지 않는다 — 오탐 가능성이 있으므로 안내만 하고 제출 버튼도 활성 상태로 둔다.
 */
const RISKY_PATTERNS = [/<script/i, /onerror=/i, /javascript:/i, /<iframe/i];
const hasRiskyInput = (s: string) =>
  RISKY_PATTERNS.some((re) => re.test(s)) || (/<img/i.test(s) && /src=/i.test(s));
/** 차단 결과 화면과 같은 문구를 쓴다 — 제출 전후로 같은 말을 들어야 무엇을 고칠지 헷갈리지 않는다. */
const RISKY_HINT = ['입력하신 내용 중 일부는 접수할 수 없습니다.', '< > 기호나 코드 형태의 문장을 지운 뒤 다시 시도해 주세요.'];

/** presetInterests → 칩 선택 상태. 미지정(홈)이면 빈 객체 = 기존 동작 */
function initInterests(preset?: string[]): Record<string, boolean> {
  return Object.fromEntries((preset ?? []).map((k) => [k, true]));
}

/** 세부 분야를 가진 부모 칩 value ('gov') */
const SUB_PARENT = INQ.interestSubs.parent;

/**
 * '정부 지원' 관심 영역 값 병합 — 신규 name 필드를 만들지 않기 위한 표기 규칙.
 * 세부 미선택: 'gov'(기존 값 그대로) / 선택: '정부 지원(인재키움·아카이브)'
 */
function mergeGovInterest(value: string, selectedSubs: string[]) {
  return selectedSubs.length ? `${INQ.interestSubs.parentLabel}(${selectedSubs.join('·')})` : value;
}

export default function HomeInquiry({
  presetInterests,
  presetInterestSubs,
  leadSource,
  prefillEventName,
}: HomeInquiryProps = {}) {
  const [v, setV] = useState({
    company: '', name: '', phone: '', position: '',
    emailLocal: '', emailDomain: '', companySize: '', trainees: '', message: '',
  });
  const [customDomain, setCustomDomain] = useState(false);
  const [errs, setErrs] = useState<Record<string, boolean>>({});
  const [interests, setInterests] = useState<Record<string, boolean>>(() => initInterests(presetInterests));
  const [subs, setSubs] = useState<Record<string, boolean>>(() => initInterests(presetInterestSubs));
  const [consent, setConsent] = useState(false);
  const [mkt, setMkt] = useState({ email: false, sms: false, tel: false });
  const [consentErr, setConsentErr] = useState(false);
  const [consentOpen, setConsentOpen] = useState<Record<string, boolean>>({});
  const [hp, setHp] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // 표시 문자열은 file에서 파생한다 — 별도 상태로 두면 file과 어긋날 여지가 생긴다.
  const [fileErr, setFileErr] = useState('');
  /** 첨부 상태 변경을 스크린리더에 알리는 문구 (aria-live) */
  const [fileNotice, setFileNotice] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [phoneHint, setPhoneHint] = useState(false);
  const [lenErr, setLenErr] = useState<string | null>(null);
  const [status, setStatus] = useState<InquiryStatus>('idle');
  /** 완료(감사) 화면 여부 — 기존 자동복귀·렌더 분기가 이 값을 그대로 쓴다. */
  const done = status === 'success';
  const submitting = status === 'submitting';
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 결과 카드 — 상태 전환 시 포커스를 옮길 지점(§5-3). 완료 카드에서는 타이머 관측 ref와 병합되므로 null 허용 타입이어야 한다 */
  const resultRef = useRef<HTMLDivElement | null>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  /** [다시 시도]가 같은 내용으로 재전송할 수 있도록 마지막 페이로드를 보관한다 */
  const lastPayload = useRef<InquiryPayload | null>(null);
  /** 삭제 후 포커스 복귀 지점 — 버튼이 사라지며 포커스가 body로 튀는 것을 막는다 */
  const fileboxRef = useRef<HTMLLabelElement>(null);
  const mktAllRef = useRef<HTMLInputElement>(null);
  const phoneHintTimer = useRef<ReturnType<typeof setTimeout>>();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  /** 쿼리(?interest=)로 들어온 관심 영역 프리셀렉트 — 접수 후 복귀 시에도 같은 값으로 되돌린다 */
  const urlPreset = useRef<string[]>([]);

  /**
   * 진입 출처 기반 '관심 영역' 사전 선택.
   * 최초 마운트에서 1회만 읽는 기본값이며(강제 고정 아님), 이후 사용자가 자유롭게 해제·추가할 수 있다.
   * 서버 렌더에는 반영하지 않고 마운트 후 세팅해 hydration 불일치를 피한다.
   * presetInterests prop(/kium 등 명시 지정)이 있으면 그쪽을 우선한다.
   */
  useEffect(() => {
    if (presetInterests) return;
    const picked = readInterestParam(INQ.interests.map((o) => o.value));
    if (!picked.length) return;
    urlPreset.current = picked;
    setInterests(initInterests(picked));
  }, [presetInterests]);

  // 마케팅 부모 ↔ 3채널 양방향 동기화
  const mktAll = mkt.email && mkt.sms && mkt.tel;
  const mktSome = (mkt.email || mkt.sms || mkt.tel) && !mktAll;
  useEffect(() => {
    if (mktAllRef.current) mktAllRef.current.indeterminate = mktSome;
  }, [mktSome]);
  const toggleMktAll = (checked: boolean) => setMkt({ email: checked, sms: checked, tel: checked });
  const toggleMkt = (k: 'email' | 'sms' | 'tel') => setMkt((p) => ({ ...p, [k]: !p[k] }));

  /*
   * 완료(감사) 상태 자동 복귀 — /leadership·/hrd 인라인 폼과 같은 훅·같은 6초·같은 일시정지 규칙.
   * 종전의 setTimeout 5초 단독은 코드 읽는 중이든, 다른 탭에 가 있든, 카드가 화면 밖에 있든
   * 무조건 사라져 같은 사이트 안에서 완료 UX가 두 갈래가 됐다.
   * blockedByFilter·error 상태에는 걸지 않는다 — 이 두 상태는 자동으로 사라지면 안 된다.
   */
  const reducedMotion = usePrefersReducedMotion();
  const { cardRef: doneCardRef, barRef: doneBarRef } = useAutoDismissTimer({
    durationMs: SUCCESS_AUTO_RESET_MS,
    enabled: done,
    onExpire: () => resetForm(),   // 훅이 ref로 최신값을 잡으므로 타이머가 재시작되지 않는다
    quantizeMs: reducedMotion ? 1000 : 0,
  });

  // 완료 카드는 결과 포커스 지점(resultRef)과 타이머 관측 대상(doneCardRef) 두 역할을 겸한다
  const setDoneCardRef = useCallback((el: HTMLDivElement | null) => {
    resultRef.current = el;
    doneCardRef.current = el;
  }, [doneCardRef]);

  /** 상태 완전 초기화 후 입력 폼으로 복귀 + 첫 필드 포커스 (즉시복귀·자동복귀 공용) */
  function resetForm() {
    clearTimeout(phoneHintTimer.current);
    setV({ company: '', name: '', phone: '', position: '', emailLocal: '', emailDomain: '', companySize: '', trainees: '', message: '' });
    setCustomDomain(false);
    // 초기화 후에도 진입 경로 프리셀렉트는 유지(prop 우선, 없으면 쿼리 기반, 둘 다 없으면 빈 상태)
    setInterests(initInterests(presetInterests ?? urlPreset.current));
    setSubs(initInterests(presetInterestSubs));
    setConsent(false);
    setMkt({ email: false, sms: false, tel: false });
    setErrs({});
    setConsentErr(false);
    setConsentOpen({});
    setLenErr(null);
    setPhoneHint(false);
    setFile(null);
    setFileErr('');
    setFileNotice('');
    if (fileInputRef.current) fileInputRef.current.value = ''; // ③ 제출 성공 후 폼 초기화
    setHp('');
    setStatus('idle');
    lastPayload.current = null;
    requestAnimationFrame(() => firstFieldRef.current?.focus({ preventScroll: true }));
  }

  // 결과 화면 진입 시 결과 카드로 포커스를 옮긴다(§5-3). 입력 필드로는 자동 이동하지 않는다.
  useEffect(() => {
    if (status === 'idle' || status === 'submitting') return;
    resultRef.current?.focus();
  }, [status]);

  /** 차단 안내 → 폼 복귀. 입력값은 그대로 두고 '문의 내용'만 짚어 준다(§2-2 규칙 3·4). */
  function backToForm() {
    setStatus('idle');
    requestAnimationFrame(() => {
      msgRef.current?.focus();
      msgRef.current?.scrollIntoView({ block: 'center' });
    });
  }

  /** 제출 실행 — [다시 시도]도 같은 페이로드로 이 경로를 탄다. */
  async function send(payload: InquiryPayload) {
    lastPayload.current = payload;
    setStatus('submitting');
    setStatus(await submitInquiry(payload));
  }

  // R1: 입력 단계 캡 — maxLength를 우회하는 붙여넣기·IME 조합까지 slice로 차단
  const upd = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const max = (INQ_MAX as Record<string, number | undefined>)[k];
    const next = max ? e.target.value.slice(0, max) : e.target.value;
    setV((s) => ({ ...s, [k]: next }));
  };

  // R3·R4: 연락처 — 숫자만 남기고 자동 하이픈. 포맷·힌트 모두 신고 접수 '전화번호' 정본과 동일.
  const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const bad = hasNonPhoneChar(raw);
    setV((s) => ({ ...s, phone: fmtPhone(raw) }));
    if (bad) {
      setPhoneHint(true);
      clearTimeout(phoneHintTimer.current);
      phoneHintTimer.current = setTimeout(() => setPhoneHint(false), 2500);
    } else setPhoneHint(false);
  };
  useEffect(() => () => clearTimeout(phoneHintTimer.current), []);

  /**
   * 과정 패널 CTA → '문의 내용' 프리필 ([관심 과정: ...]).
   * 값만 넣을 뿐 필드·검증·동의 구조는 그대로이며, 사용자가 자유롭게 편집·삭제할 수 있다.
   * 재클릭 시 앞선 토큰만 교체해 중복 누적을 막는다.
   */
  useEffect(() => {
    if (!prefillEventName) return;
    const onPrefill = (e: Event) => {
      const d = (e as CustomEvent<{ text?: string; trainees?: string; strip?: RegExp[] }>).detail;
      if (!d) return;
      setV((s) => {
        let message = s.message;
        if (d.text) {
          // 기존 프리필 토큰(관심 과정 / 공개교육 신청)을 제거해 재클릭 시 누적을 막는다
          for (const re of d.strip ?? PREFILL_STRIP) message = message.replace(re, '');
          message = (d.text + message).slice(0, INQ_MAX.message);
        }
        return { ...s, message, ...(d.trainees ? { trainees: d.trainees } : {}) };
      });
    };
    window.addEventListener(prefillEventName, onPrefill);
    return () => window.removeEventListener(prefillEventName, onPrefill);
  }, [prefillEventName]);

  const email = `${v.emailLocal.trim()}@${v.emailDomain.trim()}`;

  /**
   * ★ input.value 초기화가 이 기능의 전부다.
   * <input type="file">은 값이 같으면 change를 발화시키지 않는다. 상태만 null로 두고
   * value를 비우지 않으면 "삭제는 되는데 같은 파일 재첨부가 안 되는" 더 나쁜 결함이 된다.
   * 초기화 지점은 ① 삭제 ② 검증 실패 ③ 제출 성공 후 폼 초기화 3곳이며,
   * 여기에 더해 선택창을 열기 직전(openPicker)에도 비워 '변경'으로 같은 파일을 골라도 반영되게 한다.
   */
  function resetFile(msg: string) {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = ''; // ② 검증 실패 시
    if (msg) setFileErr(msg);
  }

  function takeFile(f: File | undefined) {
    // 선택창 취소·빈 드롭 — 기존 첨부를 그대로 둔다(§5-3-3). 여기서 지우면 취소가 삭제가 된다.
    if (!f) return;
    setFileErr('');
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED.includes(ext)) return resetFile('허용되지 않는 파일 형식입니다.');
    if (f.size > MAX) return resetFile('파일 용량은 최대 10MB까지 가능합니다.');
    setFile(f);
    setFileNotice(`${f.name} 첨부되었습니다.`);
  }

  /** 파일 선택창 열기 — Empty의 '파일 선택'과 Selected의 '변경'이 공유한다 */
  function openPicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // 같은 파일을 다시 골라도 change가 발화하도록
      fileInputRef.current.click();
    }
  }

  /** 첨부 해제 — 확인 다이얼로그 없이 즉시 반영(PRD C5) */
  function removeFile() {
    const name = file?.name ?? '';
    setFile(null);
    setFileErr('');
    if (fileInputRef.current) fileInputRef.current.value = ''; // ① 삭제 시
    setFileNotice(`${name} 첨부가 삭제되었습니다.`);
    // 칩이 사라진 뒤에야 드롭존이 렌더되므로 다음 프레임에 포커스를 옮긴다
    requestAnimationFrame(() => fileboxRef.current?.focus({ preventScroll: true }));
  }

  /** R2: 제출 직전 전 필드 길이 재검증 — 초과 시 서버 전송 없이 차단 + 해당 필드 포커스 */
  function findOverflow(): keyof typeof v | null {
    for (const k of Object.keys(v) as (keyof typeof v)[]) {
      const max = (INQ_MAX as Record<string, number | undefined>)[k];
      if (max && (v[k] || '').length > max) return k;
    }
    return null;
  }

  // 제출 차단 = 필수 5개(회사·기관명/담당자명/연락처/직급·직책/이메일) + 개인정보 동의
  async function submit() {
    if (hp) return; // 허니팟
    if (submitting) return;
    const next: Record<string, boolean> = {};
    let ok = true;
    (['company', 'name', 'phone', 'position'] as const).forEach((k) => {
      const bad = !(v[k] || '').trim();
      next[k] = bad;
      if (bad) ok = false;
    });
    const emailOK = !!v.emailLocal.trim() && !!v.emailDomain.trim() && EMAIL_RE.test(email);
    next.email = !emailOK;
    if (!emailOK) ok = false;

    // R2: 길이 초과는 페이로드 조립 전에 차단한다(과다 입력이 서버로 넘어가지 않게)
    const over = findOverflow();
    if (over) {
      next[over === 'emailLocal' || over === 'emailDomain' ? 'email' : over] = true;
      setLenErr(over);
      ok = false;
    } else setLenErr(null);

    setErrs(next);
    const cBad = !consent;
    setConsentErr(cBad);
    if (cBad) ok = false;
    if (fileErr) ok = false;
    if (!ok) {
      const firstBad = over ?? (['company', 'name', 'phone', 'position'] as const).find((k) => next[k]);
      if (firstBad) document.getElementById(FIELD_ID[firstBad])?.focus({ preventScroll: false });
      return;
    }

    const payload: InquiryPayload = {
      companyName: v.company.trim(),
      managerName: v.name.trim(),
      phone: v.phone.trim(),
      position: v.position.trim(),
      email,
      companySize: v.companySize,
      expectedTrainees: v.trainees,
      // 관심 영역 — '정부 지원'은 세부 분야가 선택된 경우 값 자체에 병합해 싣는다.
      // 새 name 필드를 만들지 않으므로 폼 수집 항목 수는 그대로다(신규 수집 0).
      interests: INQ.interests
        .filter((o) => interests[o.value])
        .map((o) => (o.value === SUB_PARENT ? mergeGovInterest(o.value, subLabels) : o.value)),
      message: v.message.trim(),
      attachment: file,
      agreePrivacy: true,
      agreeMarketing: mktAll,
      agreeMarketingEmail: mkt.email,
      agreeMarketingSms: mkt.sms,
      agreeMarketingTel: mkt.tel,
      // 유입 경로 태깅 — 폼에 입력 UI가 없는 비노출 메타(GA4·GTM 코드 삽입 아님)
      ...(leadSource ? { lead_source: leadSource } : {}),
    };
    await send(payload);
  }

  // 세부 분야 — 부모 칩이 켜져 있을 때만 노출/집계. 부모를 끄면 선택값도 초기화한다.
  const govOn = !!interests[SUB_PARENT];
  const subLabels = govOn ? INQ.interestSubs.options.filter((o) => subs[o]) : [];
  const toggleInterest = (value: string) => {
    setInterests((s) => {
      const next = { ...s, [value]: !s[value] };
      if (value === SUB_PARENT && !next[value]) setSubs({});
      return next;
    });
  };

  const fld = (k: string) => `field${errs[k] ? ' invalid' : ''}`;
  const half = { flex: '1 1 160px', width: 'auto', minWidth: 0 } as const;
  const risky = hasRiskyInput(v.message);

  return (
    <section className="section inq" id="inq">
      <div className="wrap">
        <div className="inq-grid">
          <div className="inq-side r">
            <div>
              <p className="lead">{INQ.side.lead}</p>
              <p className="leadsub">{INQ.side.sub}</p>
            </div>
            <div className="trust">
              {INQ.side.trust.map((t, i) => (
                <span key={t} style={{ display: 'contents' }}>
                  <span>{t}</span>
                  {i < INQ.side.trust.length - 1 && <span>·</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="form r">
            {status === 'idle' || submitting ? (
              <div id="form-body">
                {/* 1·2 회사·기관명* / 담당자명* */}
                <div className="frow">
                  <div className={fld('company')}>
                    <label htmlFor="f-company">회사·기관명 <span className="req">*</span></label>
                    <input id="f-company" ref={firstFieldRef} name="company" maxLength={INQ_MAX.company} value={v.company} onChange={upd('company')} aria-required="true" aria-invalid={!!errs.company} />
                    <span className="err" aria-live="polite">회사·기관명을 입력해 주세요.</span>
                  </div>
                  <div className={fld('name')}>
                    <label htmlFor="f-name">담당자명 <span className="req">*</span></label>
                    <input id="f-name" name="contactName" maxLength={INQ_MAX.name} value={v.name} onChange={upd('name')} aria-required="true" aria-invalid={!!errs.name} />
                    <span className="err" aria-live="polite">담당자명을 입력해 주세요.</span>
                  </div>
                </div>

                {/* 3·4 연락처* / 직급·직책* */}
                <div className="frow">
                  <div className={fld('phone')}>
                    <label htmlFor="f-phone">연락처 <span className="req">*</span></label>
                    {/* R3~R5: 숫자만·자동 하이픈·힌트 문구 모두 신고 접수 '전화번호' 정본과 동일 */}
                    <input id="f-phone" name="phone" type="tel" inputMode="numeric" placeholder="010-0000-0000" maxLength={INQ_MAX.phone} value={v.phone} onChange={onPhone} aria-required="true" aria-invalid={!!errs.phone} />
                    {phoneHint && <span className="phone-hint" aria-live="polite">숫자만 입력할 수 있어요.</span>}
                    <span className="err" aria-live="polite">연락처를 입력해 주세요.</span>
                  </div>
                  <div className={fld('position')}>
                    <label htmlFor="f-position">직급/직책 <span className="req">*</span></label>
                    <input id="f-position" name="jobTitle" placeholder="예: 인사팀 과장 / 교육담당" maxLength={INQ_MAX.position} value={v.position} onChange={upd('position')} aria-required="true" aria-invalid={!!errs.position} />
                    <span className="err" aria-live="polite">직급/직책을 입력해 주세요.</span>
                  </div>
                </div>

                {/* 5 이메일* — 아이디 @ 도메인(프리셋/직접입력) */}
                <div className={fld('email')}>
                  <label htmlFor="f-email">이메일 <span className="req">*</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input id="f-email" name="emailLocal" placeholder="이메일 아이디" maxLength={INQ_MAX.emailLocal} style={half} value={v.emailLocal} onChange={upd('emailLocal')} aria-required="true" aria-invalid={!!errs.email} />
                    <span aria-hidden="true" style={{ flex: 'none', color: 'var(--muted)', fontWeight: 700 }}>@</span>
                    {customDomain ? (
                      <input name="emailDomain" aria-label="이메일 도메인 직접 입력" placeholder="직접 입력 (예: company.com)" maxLength={INQ_MAX.emailDomain} style={half} value={v.emailDomain} onChange={upd('emailDomain')} />
                    ) : (
                      <select name="emailDomain" aria-label="이메일 도메인 선택" style={half} value={v.emailDomain} onChange={upd('emailDomain')}>
                        <option value="">이메일 선택</option>
                        {INQ.emailDomains.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    )}
                    <label className="email-direct">
                      <input type="checkbox" checked={customDomain} onChange={(e) => setCustomDomain(e.target.checked)} />
                      직접입력
                    </label>
                  </div>
                  <span className="err" aria-live="polite">이메일을 입력해 주세요.</span>
                </div>

                {/* 6·7 회사 규모 / 예상 교육인원 (별도 필드·선택) */}
                <div className="frow">
                  <div className="field">
                    <label htmlFor="f-csize">회사 규모 <span className="lopt">(임직원 수)</span></label>
                    <select id="f-csize" name="companySize" value={v.companySize} onChange={upd('companySize')}>
                      <option value="">선택</option>
                      {INQ.companySizes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="f-trainees">예상 교육인원</label>
                    <select id="f-trainees" name="expectedTrainees" value={v.trainees} onChange={upd('trainees')}>
                      <option value="">선택</option>
                      {INQ.trainees.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* 8 관심 영역 (선택·다중 5칩) */}
                <div className="field">
                  <label id="f-interests-label" htmlFor="f-interests-label">관심 영역</label>
                  <div className="chips" role="group" aria-labelledby="f-interests-label">
                    {INQ.interests.map((o) => (
                      <button
                        type="button"
                        key={o.value}
                        className={`mchip${interests[o.value] ? ' on' : ''}`}
                        aria-pressed={!!interests[o.value]}
                        onClick={() => toggleInterest(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                    {/* '정부 지원' 세부 분야 — 부모 칩 선택 시 우측 여백에 노출(모바일은 다음 행으로 개행).
                        새 수집 항목이 아니라 관심 영역 분류의 세분화이며, 제출 시 부모 값에 병합된다. */}
                    {govOn && (
                      <span className="mchip-subs" role="group" aria-label={`${INQ.interestSubs.parentLabel} 세부 분야`}>
                        {INQ.interestSubs.options.map((o, i) => (
                          <button
                            type="button"
                            key={o}
                            className={`mchip mchip-sub${subs[o] ? ' on' : ''}`}
                            style={{ animationDelay: `${i * 90}ms` }}
                            aria-pressed={!!subs[o]}
                            onClick={() => setSubs((s) => ({ ...s, [o]: !s[o] }))}
                          >
                            {o}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>

                {/* 9 문의 내용 (선택) */}
                <div className="field">
                  <label htmlFor="f-msg">문의 내용</label>
                  <textarea id="f-msg" ref={msgRef} name="message" rows={3} maxLength={INQ_MAX.message} value={v.message} onChange={upd('message')}
                    aria-describedby={risky ? 'f-msg-risky' : undefined}
                    placeholder="도입을 검토 중인 교육 주제와 예상 인원·시기, 해결하고 싶은 조직 과제를 남겨주시면 담당 컨설턴트가 맞춤 상담으로 안내드립니다. (예: 임직원 300명 대상 AX 전환 교육을 3분기 중 검토 중입니다.)" />
                  {/* 사전 안내 — 입력을 막지도, 제출을 잠그지도 않는다(§2-4) */}
                  {risky && (
                    <span id="f-msg-risky" className="phone-hint" aria-live="polite">
                      {RISKY_HINT[0]}<br />{RISKY_HINT[1]}
                    </span>
                  )}
                  <div className={`len-count${v.message.length >= INQ_MAX.message ? ' max' : ''}`} aria-live="polite">
                    {v.message.length}/{INQ_MAX.message}
                  </div>
                </div>

                {/* 10 첨부파일 (선택·드롭존) */}
                <div className="field"><label htmlFor="f-file">첨부파일</label>
                  {file ? (
                    /* Selected — 파일명·용량과 함께 변경·삭제 컨트롤을 항상 노출한다.
                       label이 아닌 div다: label 안에 버튼을 두면 삭제 버튼이 선택창을 연다. */
                    <div
                      className={`file-chip${dragOver ? ' over' : ''}`}
                      role="group"
                      aria-label="첨부된 파일"
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }}
                    >
                      <span className="file-name" title={file.name}>{file.name}</span>
                      <span className="file-size">({(file.size / 1048576).toFixed(1)}MB)</span>
                      <button type="button" className="file-act" onClick={openPicker} aria-label="첨부파일 변경">변경</button>
                      <button type="button" className="file-del" onClick={removeFile} aria-label={`첨부파일 ${file.name} 삭제`}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    /* Empty · Error — 기존 드롭존을 그대로 둔다(문구·높이·드래그&드롭 무변경).
                       tabIndex=-1은 삭제 후 포커스 복귀 지점을 만들기 위한 것이라 Tab 순서를 바꾸지 않는다. */
                    <label
                      ref={fileboxRef}
                      tabIndex={-1}
                      className={`filebox${dragOver ? ' over' : ''}`}
                      htmlFor="f-file"
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }}
                    >{FILE_PLACEHOLDER}</label>
                  )}
                  <input id="f-file" ref={fileInputRef} name="attachment" type="file" style={{ display: 'none' }} accept=".zip,.pdf,.hwp,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" onChange={(e) => takeFile(e.target.files?.[0])} />
                  <div className="filehint">zip·pdf·hwp·ppt·pptx·doc·docx·xls·xlsx·jpg·png·gif / 최대 10MB</div>
                  <div className="filehint">{FILE_PRIVACY_NOTE}</div>
                  {fileErr && <span className="err" style={{ display: 'block' }} role="alert">{fileErr}</span>}
                  <span className="file-live" aria-live="polite">{fileNotice}</span>
                </div>

                <input className="hp" tabIndex={-1} autoComplete="off" placeholder="website" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" />

                <div className="consent-group">
                  {/* 11 개인정보 수집·이용 동의 (필수) */}
                  <div className={`consent${consentErr ? ' invalid' : ''}`}>
                    <label className="consent-main"><input type="checkbox" name="agreePrivacy" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-required="true" aria-invalid={consentErr} /><span><b className="c-tag req-tag">필수</b> 개인정보 수집·이용 동의</span></label>
                    <button type="button" className="consent-view" onClick={() => setConsentOpen((s) => ({ ...s, priv: !s.priv }))}>{consentOpen.priv ? '접기' : '전문 보기'}</button>
                  </div>
                  {consentErr && <span className="err" style={{ display: 'block', marginTop: 0 }} aria-live="polite">개인정보 수집·이용에 동의해 주세요.</span>}
                  <div className="consent-text" style={{ maxHeight: consentOpen.priv ? CONSENT_TEXT_MAXH : 0 }}><div className="ct-inner"><p><b>개인정보 수집·이용 동의 (필수)</b></p><p>KG에듀원 KEESS 서비스를 제공하기 위해 필요한 필수 정보를 아래와 같이 수집·이용하고자 하오니, 이에 동의하여 주시기를 부탁드립니다.</p><p><b>1. 수집·이용 목적</b><br />상담신청 및 안내: KEESS 직원 교육 상담신청 서비스의 상담·안내를 위한 자료 활용</p><p><b>2. 수집 항목</b><br />(필수) 담당자명, 회사·기관명, 직급/직책, 연락처, 이메일<br />(선택) 회사 규모(임직원 수), 예상 교육인원, 관심 영역, 문의 내용, 첨부파일</p><p><b>3. 보유 및 이용 기간</b><br />법령에 따른 보유·이용 기간 또는 동의받은 기간 내에서 처리·보유합니다. 수집·보유 근거: 정보주체의 동의 / 보유·이용기간: 동의일로부터 1년간(보유목적 달성) 또는 삭제 요청 시 지체 없이 파기.</p><p><b>4. 동의 거부 권리</b><br />동의를 거부할 권리가 있습니다. 다만 거부 시 상담 서비스 이용이 제한될 수 있습니다.</p><p>{FILE_PRIVACY_NOTE}</p></div></div>

                  {/* 12 마케팅 정보 수신 동의 (선택) — 부모 + 3채널 */}
                  <div className="consent">
                    <label className="consent-main"><input ref={mktAllRef} type="checkbox" name="agreeMarketing" checked={mktAll} aria-checked={mktSome ? 'mixed' : mktAll} onChange={(e) => toggleMktAll(e.target.checked)} /><span><b className="c-tag opt-tag">선택</b> 마케팅 정보 수신 동의</span></label>
                    <button type="button" className="consent-view" onClick={() => setConsentOpen((s) => ({ ...s, mkt: !s.mkt }))}>{consentOpen.mkt ? '접기' : '전문 보기'}</button>
                  </div>
                  <div className="filehint">수집 항목: 이름, 전화번호, 이메일 · 마케팅(EDM·이벤트) 정보 발송 목적</div>
                  <div className="mkt-sub" role="group" aria-label="마케팅 정보 수신 채널">
                    <label className="mkt-item"><input type="checkbox" name="agreeMarketingEmail" checked={mkt.email} onChange={() => toggleMkt('email')} /><span>이메일</span></label>
                    <label className="mkt-item"><input type="checkbox" name="agreeMarketingSms" checked={mkt.sms} onChange={() => toggleMkt('sms')} /><span>SMS(문자)</span></label>
                    <label className="mkt-item"><input type="checkbox" name="agreeMarketingTel" checked={mkt.tel} onChange={() => toggleMkt('tel')} /><span>전화(TM)</span></label>
                  </div>
                  <div className="consent-text" style={{ maxHeight: consentOpen.mkt ? CONSENT_TEXT_MAXH : 0 }}><div className="ct-inner"><p><b>마케팅 정보 수신 동의 (선택)</b></p><p>KG에듀원 KEESS는 「개인정보 보호법」 제22조에 의거하여 마케팅 목적의 개인정보 수집·이용에 대해 별도 동의를 받습니다. 동의를 거부하셔도 서비스 이용이 가능하며, 일부 서비스·혜택 제공이 제한될 수 있습니다.</p><p><b>수집·이용 목적</b><br />① 이메일·SMS(문자)·전화(TM)를 통한 EDM·이벤트 등 마케팅 정보 발송<br />② 모바일 상품권(기프티콘) MMS 발송</p><p><b>수집 항목</b><br />이름, 전화번호, 이메일</p><p><b>보유 및 이용 기간</b><br />① EDM·이벤트 마케팅: 동의일로부터 1년간 (또는 삭제 요청 시 지체 없이 파기)<br />② 모바일 상품권(기프티콘): 상품권 수령 완료 시까지</p><p>상기 이외의 마케팅 목적으로 수집·이용 시 별도 동의를 받습니다.</p></div></div>
                </div>
                <button className="btn submit" onClick={submit} disabled={submitting} aria-busy={submitting}>
                  {submitting ? '접수 중…' : '상담 신청'}
                </button>
              </div>
            ) : done ? (
              <div className="form-done show" role="status" aria-live="polite" tabIndex={-1} ref={setDoneCardRef}>
                <div className="check">✓</div>
                <h4>{INQ.success.title}</h4>
                <p>{INQ.success.msg}</p>
                {/* 잔여 시간은 문장이 아니라 바로만 표현한다 — 타이머가 일시정지되므로 시간을 예고하면 반드시 실제와 어긋난다(RD-009 원인) */}
                <div className="done-progress" aria-hidden="true">
                  <div className="done-progress__bar" ref={doneBarRef} />
                </div>
                <button type="button" className="btn btn-line-dark done-again" onClick={resetForm}>새 문의 작성</button>
              </div>
            ) : status === 'blockedByFilter' ? (
              /* 재시도해도 같은 결과이므로 '다시 시도' 계열 안내를 두지 않는다. 고칠 곳만 짚어 준다. */
              <div className="form-done show is-blocked" role="status" aria-live="polite" tabIndex={-1} ref={resultRef}>
                <div className="check"><AlertCircle size={30} aria-hidden="true" /></div>
                <h4>입력하신 내용 중 일부는 접수할 수 없습니다</h4>
                <p>{'< > 기호나 코드 형태의 문장을 지운 뒤 다시 시도해 주세요.'}</p>
                <p className="done-return">
                  어려우시면 <a href={INQUIRY_MAILTO}>{INQUIRY_CONTACT.EMAIL}</a> 또는{' '}
                  <a href={INQUIRY_TEL_HREF}>{INQUIRY_CONTACT.TEL}</a> 로 연락 주세요.
                </p>
                <button type="button" className="btn btn-line-dark done-again" onClick={backToForm}>내용 수정하기</button>
              </div>
            ) : (
              <div className="form-done show is-blocked" role="status" aria-live="polite" tabIndex={-1} ref={resultRef}>
                <div className="check"><AlertCircle size={30} aria-hidden="true" /></div>
                <h4>일시적인 오류로 접수에 실패했습니다</h4>
                <p>잠시 후 다시 시도해 주세요.</p>
                <button type="button" className="btn btn-line-dark done-again" onClick={() => { if (lastPayload.current) void send(lastPayload.current); }}>다시 시도</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
