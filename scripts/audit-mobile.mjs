import { chromium, devices } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3055';
const VPS = [
  { n: 'SE 320', w: 320, h: 568, dpr: 2 },
  { n: 'A 360',  w: 360, h: 740, dpr: 3 },
  { n: '14 390', w: 390, h: 844, dpr: 3 },
  { n: 'PM 430', w: 430, h: 932, dpr: 3 },
];
const PATHS = [
  ['/kium?tab=courses&mode=open', 'kium 공개교육'],
  ['/kium?tab=courses', 'kium 전체과정'],
  ['/kium', 'kium 기본'],
  ['/', '홈'],
];
const AUDIT = () => {
  const vw = window.innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const nm = (el) => { const t = el.tagName.toLowerCase();
    const c = (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : '');
    const tx = (el.textContent||'').trim().replace(/\s+/g,' ').slice(0,24);
    return `${t}${c}${tx?` "${tx}"`:''}`; };
  // 1) 가로 오버플로 유발 요소
  const over = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      const p = el.parentElement; const ps = p ? getComputedStyle(p) : null;
      const clipped = ps && /auto|scroll|hidden/.test(ps.overflowX);
      if (!clipped) over.push({ el: nm(el), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) });
    }
  });
  // 2) 터치 타깃
  const SEL = 'a,button,[role="button"],[role="tab"],input,select,summary,[tabindex]:not([tabindex="-1"])';
  const small = [], seen = new Set();
  document.querySelectorAll(SEL).forEach((el) => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) return;
    if (r.width < 44 || r.height < 44) {
      const k = nm(el) + Math.round(r.width) + 'x' + Math.round(r.height);
      if (seen.has(k)) return; seen.add(k);
      small.push({ el: nm(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
    }
  });
  // 3) 폰트 하한
  const tiny = {}; 
  document.querySelectorAll('*').forEach((el) => {
    if (!vis(el) || !el.childNodes.length) return;
    const has = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!has) return; const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) { const k = fs + 'px ' + nm(el).split('"')[0]; tiny[k] = (tiny[k]||0)+1; }
  });
  // 4) 인접 터치 타깃 간격
  const rects = [...document.querySelectorAll(SEL)].filter(vis).map((el)=>({n:nm(el),r:el.getBoundingClientRect()}));
  const near = [];
  for (let i=0;i<rects.length;i++) for (let j=i+1;j<rects.length;j++) {
    const a=rects[i].r,b=rects[j].r;
    const gx = b.left - a.right, gy = b.top - a.bottom;
    const ovY = a.top < b.bottom && b.top < a.bottom, ovX = a.left < b.right && b.left < a.right;
    let g = null;
    if (ovY && gx >= 0) g = gx; else if (ovX && gy >= 0) g = gy;
    if (g !== null && g < 8) near.push({ a: rects[i].n, b: rects[j].n, gap: +g.toFixed(1) });
  }
  // 5) 100vh / dvh
  const vh100 = [];
  document.querySelectorAll('*').forEach((el)=>{ if(!vis(el))return; const s=getComputedStyle(el);
    if (el.getBoundingClientRect().height >= window.innerHeight - 1 && /vh/.test(el.style.height||'')) vh100.push(nm(el)); });
  return {
    scrollW: document.documentElement.scrollWidth, vw,
    overflowX: document.documentElement.scrollWidth > vw + 1,
    over: over.slice(0, 12), overN: over.length,
    small: small.slice(0, 20), smallN: small.length,
    tiny, near: near.slice(0, 10), nearN: near.length,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
  };
};
const b = await chromium.launch();
const out = [];
for (const vp of VPS) {
  const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, deviceScaleFactor:vp.dpr, isMobile:true, hasTouch:true,
    userAgent: devices['iPhone 13'].userAgent });
  const p = await ctx.newPage();
  for (const [path, label] of PATHS) {
    try {
      await p.goto(BASE + path, { waitUntil:'networkidle', timeout:20000 });
      await p.waitForTimeout(600);
      const r = await p.evaluate(AUDIT);
      out.push({ vp: vp.n, path: label, ...r });
    } catch (e) { out.push({ vp: vp.n, path: label, error: e.message.slice(0,80) }); }
  }
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
