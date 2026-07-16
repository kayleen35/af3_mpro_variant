const path = require("path");
const pptxgen = require(process.env.PPTX_PATH || "pptxgenjs");
const IMG = path.join(__dirname, "img");

const C = {
  dark: "0B3B39", teal: "0F766E", mint: "17A58F", violet: "7C3AED",
  bg: "F6F8F7", card: "FFFFFF", line: "DCE5E1", ink: "14211F", mut: "65736F",
  good: "047857", warn: "B45309", white: "FFFFFF", ice: "CDE8E3",
};
const F = "Malgun Gothic";
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";
const W = 13.33, H = 7.5, M = 0.55;

// bullet list without trailing-\n empty-bullet artifact
function bl(items, code, color) {
  return items.map((t) => ({ text: t, options: { bullet: { code: code || "2022", indent: 14 }, color: color || C.ink, breakLine: true } }));
}
function footer(s, n, dark) {
  s.addText("NasoMpro-AI 통합 플랫폼 · 비임상 연구지원 지표(임상·투여·합성·치료 판단 아님)", {
    x: M, y: H - 0.42, w: 9.5, h: 0.3, fontFace: F, fontSize: 8, color: dark ? "8FB8B0" : C.mut, align: "left",
  });
  s.addText(String(n), { x: W - 1.1, y: H - 0.42, w: 0.5, h: 0.3, fontFace: F, fontSize: 9, color: dark ? "8FB8B0" : C.mut, align: "right" });
}
function head(s, kicker, title) {
  s.background = { color: C.bg };
  s.addText(kicker, { x: M, y: 0.42, w: 12, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: C.mint, charSpacing: 2 });
  s.addText(title, { x: M, y: 0.72, w: 12.2, h: 0.7, fontFace: F, fontSize: 30, bold: true, color: C.dark });
}
function card(s, x, y, w, h, opt = {}) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: opt.fill || C.card }, line: { color: opt.line || C.line, width: 1 }, shadow: { type: "outer", color: "9AA5A2", opacity: 0.18, blur: 6, offset: 2, angle: 90 } });
  if (opt.bar) s.addShape(p.ShapeType.roundRect, { x, y, w: 0.09, h, rectRadius: 0.03, fill: { color: opt.bar } });
}
function statCard(s, x, y, w, num, label, numColor) {
  card(s, x, y, w, 1.55, { bar: numColor });
  s.addText(num, { x: x + 0.2, y: y + 0.18, w: w - 0.3, h: 0.7, fontFace: F, fontSize: 34, bold: true, color: numColor, align: "left" });
  s.addText(label, { x: x + 0.2, y: y + 0.92, w: w - 0.3, h: 0.5, fontFace: F, fontSize: 11.5, color: C.mut, align: "left", valign: "top" });
}

/* 1. TITLE */
let s = p.addSlide(); s.background = { color: C.dark };
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: C.mint } });
s.addText("연구지원 · 의사결정 지원 플랫폼", { x: M, y: 1.5, w: 12, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.mint, charSpacing: 2 });
s.addText("NasoMpro-AI", { x: M, y: 2.0, w: 12.2, h: 1.1, fontFace: F, fontSize: 54, bold: true, color: C.white });
s.addText("SARS-CoV-2 Mpro 표적 비강 항바이러스 후보 발굴 + 자율 에이전트 AI", { x: M, y: 3.15, w: 12, h: 0.6, fontFace: F, fontSize: 22, color: C.ice });
s.addText("기술 브리핑 — 사용설명서 · 기능정의서 · 검증 · 근거 · 정합성", { x: M, y: 3.8, w: 12, h: 0.4, fontFace: F, fontSize: 15, color: "9FC7C0" });
s.addShape(p.ShapeType.line, { x: M, y: 4.7, w: 5.5, h: 0, line: { color: C.teal, width: 1.5 } });
s.addText([{ text: "대상: ", options: { bold: true, color: C.mint } }, { text: "개발자 · 홍성현 박사((주)클리켐바이오)", options: { color: C.ice } }], { x: M, y: 4.85, w: 12, h: 0.35, fontFace: F, fontSize: 14 });
s.addText([{ text: "팀: ", options: { bold: true, color: C.mint } }, { text: "아시아경제교육센터 알파폴드팀 · 제4회 JUMP AI 신약개발 경진대회", options: { color: C.ice } }], { x: M, y: 5.2, w: 12, h: 0.35, fontFace: F, fontSize: 14 });
s.addText("라이브 데모  https://mpro.wnffn62.workers.dev", { x: M, y: 5.75, w: 12, h: 0.35, fontFace: F, fontSize: 13, color: "9FC7C0" });
footer(s, 1, true);

/* 2. EXECUTIVE SUMMARY */
s = p.addSlide(); head(s, "OVERVIEW", "한눈에 — 무엇을 만들었고 무엇이 강한가");
statCard(s, M, 1.6, 3.9, "0.34 → 0.81", "활성 예측 정확도(Spearman ρ)\n유사도 휴리스틱 → ML QSAR (2.4배↑)", C.teal);
statCard(s, M + 4.1, 1.6, 3.9, "6,368종", "실측 pIC50 학습 데이터\nChEMBL 4,424 + COVID Moonshot 1,944", C.mint);
statCard(s, M + 8.2, 1.6, 3.9, "6.94 → 7.94", "자율 에이전트 리드 최적화(GC376)\n예측 pIC50 향상, 측정값이 확인", C.violet);
card(s, M, 3.45, 5.95, 3.35, { bar: C.teal });
s.addText("① 배포형 — 오프라인 PWA + 엣지", { x: M + 0.3, y: 3.6, w: 5.5, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["RDKit-WASM로 브라우저에서 임의 분자의 pIC50 실시간 예측", "자율 에이전트·검증 산점도·실측 라이브러리 탭", "PC가 꺼져도·오프라인에서도 동작(엣지 상시 호스팅)", "QR 1장으로 어디서나 시연 — 대회 데모용"]),
  { x: M + 0.35, y: 4.15, w: 5.35, h: 2.5, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.25, valign: "top" });
card(s, M + 6.25, 3.45, 5.95, 3.35, { bar: C.violet });
s.addText("② 제품형 — 풀스택 웹앱", { x: M + 6.55, y: 3.6, w: 5.5, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["FastAPI + SQLAlchemy + PostgreSQL + Next.js + Docker", "후보·복합체 CRUD, 점수화 이력, 감사로그, 관리자", "동일 과학엔진 공유(예측 pIC50·에이전트·검증)", "다중 사용자·영속성 — 사내 운영/확장용"]),
  { x: M + 6.6, y: 4.15, w: 5.35, h: 2.5, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.25, valign: "top" });
footer(s, 2);

/* 3. RATIONALE */
s = p.addSlide(); head(s, "근거 · RATIONALE", "왜 Mpro·비강인가 — 방향 전환의 논리");
const steps = [
  ["현황·한계", "AlphaFold3로 항체-항원 복합체를 예측하려 했으나, 한 달간 seed를 높여도 정확도가 타 복합체 대비 현저히 낮은 구조적 한계 확인.", C.warn],
  ["타깃 전환", "‘코로나바이러스’ 테마 유지 + 타깃을 스파이크→Mpro(Main Protease, 3CLpro) 리간드/저해제 결합 예측으로 전환.", C.teal],
  ["응용 전환", "알부민 중심 → 비강 스프레이 국소 전달 전략. 상기도 초기 감염 단계에서 바이러스 복제를 국소 차단하는 치료 가설.", C.mint],
];
let yy = 1.7;
steps.forEach((st, i) => {
  card(s, M, yy, 12.2, 1.45, { bar: st[2] });
  s.addShape(p.ShapeType.ellipse, { x: M + 0.28, y: yy + 0.42, w: 0.6, h: 0.6, fill: { color: st[2] } });
  s.addText(String(i + 1), { x: M + 0.28, y: yy + 0.42, w: 0.6, h: 0.6, fontFace: F, fontSize: 22, bold: true, color: C.white, align: "center", valign: "middle" });
  s.addText(st[0], { x: M + 1.1, y: yy + 0.2, w: 3.0, h: 1.05, fontFace: F, fontSize: 18, bold: true, color: C.dark, valign: "middle" });
  s.addText(st[1], { x: M + 4.1, y: yy + 0.2, w: 7.9, h: 1.05, fontFace: F, fontSize: 13, color: C.ink, valign: "middle", lineSpacingMultiple: 1.1 });
  yy += 1.6;
});
s.addText("Mpro는 인간 프로테아제와 상동성이 낮아 선택적 항바이러스 표적으로 검증됨 — Nirmatrelvir·Ensitrelvir·GC376 등 승인·임상 저해제 존재.", { x: M, y: yy + 0.05, w: 12.2, h: 0.5, fontFace: F, fontSize: 12, italic: true, color: C.mut });
footer(s, 3);

/* 4. EVIDENCE / DATA */
s = p.addSlide(); head(s, "논문·데이터 근거", "검증된 표적 · 실측 데이터 기반");
card(s, M, 1.65, 5.9, 2.5, { bar: C.teal });
s.addText("표적 근거 (문헌)", { x: M + 0.3, y: 1.8, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["Mpro(3CLpro/nsp5)는 viral polyprotein 절단 필수 효소 — 저해 시 복제 차단", "FDA: Nirmatrelvir = SARS-CoV-2 Mpro 저해제(Paxlovid 성분)", "기준물질 3종: Nirmatrelvir · Ensitrelvir · GC376(공유결합형)"]),
  { x: M + 0.35, y: 2.28, w: 5.35, h: 1.8, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.2, valign: "top" });
card(s, M + 6.3, 1.65, 5.9, 2.5, { bar: C.mint });
s.addText("데이터셋 (실측 활성)", { x: M + 6.6, y: 1.8, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["ChEMBL SARS-CoV-2 Mpro (CHEMBL4523582): 4,424종", "COVID Moonshot(오픈사이언스): 1,944종", "통합 고유 6,368종 — 전량 실측 pIC50 = −log₁₀(IC50[M]) 보유"]),
  { x: M + 6.65, y: 2.28, w: 5.35, h: 1.8, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.2, valign: "top" });
card(s, M, 4.35, 12.2, 2.4, { bar: C.dark });
s.addText("데이터 → 지표 정의", { x: M + 0.3, y: 4.5, w: 11.6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addTable([
  [{ text: "지표", options: { bold: true, color: C.white, fill: { color: C.teal } } }, { text: "정의", options: { bold: true, color: C.white, fill: { color: C.teal } } }, { text: "해석", options: { bold: true, color: C.white, fill: { color: C.teal } } }],
  ["pIC50", "−log₁₀(IC50[mol/L])", "높을수록 강한 저해(≥7 ≈ IC50 100nM 이하)"],
  ["Morgan fingerprint", "반경 2 · 2,048비트 구조 지문", "분자 구조를 기계학습 입력 벡터로"],
  ["Tanimoto 유사도", "지문 간 교집합/합집합", "알려진 강활성과의 구조 근접도"],
], { x: M + 0.3, y: 4.95, w: 11.6, h: 1.6, fontFace: F, fontSize: 12, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "middle", rowH: 0.38, colW: [2.6, 3.8, 5.2] });
footer(s, 4);

/* 5. ARCHITECTURE */
s = p.addSlide(); head(s, "시스템 아키텍처", "하나의 과학엔진, 두 가지 전달 방식");
card(s, M, 1.7, 3.5, 4.6, { bar: C.teal });
s.addText("① 배포형 PWA", { x: M + 0.25, y: 1.85, w: 3.0, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.dark });
s.addText(bl(["브라우저(RDKit-WASM)", "Ridge QSAR 가중치(JSON)", "Service Worker 오프라인", "Cloudflare Worker 엣지", "PC 전원 무관"]),
  { x: M + 0.3, y: 2.35, w: 3.05, h: 3.7, fontFace: F, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.35, valign: "top" });
card(s, M + 3.85, 2.35, 4.5, 3.3, { fill: C.dark });
s.addText("공유 과학 엔진", { x: M + 3.85, y: 2.55, w: 4.5, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.mint, align: "center" });
s.addText(bl(["RDKit 물성·지문", "QSAR pIC50 예측(RF/Ridge)", "다성분 후보 점수", "4-에이전트 최적화 루프", "scaffold-CV 검증"], "2022", C.white),
  { x: M + 4.25, y: 3.05, w: 3.9, h: 2.4, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.3, valign: "top" });
card(s, M + 8.7, 1.7, 3.5, 4.6, { bar: C.violet });
s.addText("② 제품형 풀스택", { x: M + 8.95, y: 1.85, w: 3.0, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.dark });
s.addText(bl(["Next.js(App Router)", "FastAPI(비동기)", "SQLAlchemy + PostgreSQL", "(로컬은 SQLite 무설치)", "Docker Compose", "감사로그·다중 사용자"]),
  { x: M + 8.95, y: 2.3, w: 3.1, h: 3.8, fontFace: F, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.2, valign: "top" });
s.addText("→", { x: M + 3.35, y: 3.6, w: 0.55, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: C.mut, align: "center" });
s.addText("→", { x: M + 8.3, y: 3.6, w: 0.55, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: C.mut, align: "center" });
s.addText("동일한 학습·검증 산출물(qsar_model.json · agent_library.json)을 두 채널이 공유하므로 결과가 일관됩니다.", { x: M, y: 6.55, w: 12.2, h: 0.4, fontFace: F, fontSize: 12, italic: true, color: C.mut });
footer(s, 5);

/* 6. FUNCTIONAL SPEC */
s = p.addSlide(); head(s, "기능정의서 · FUNCTIONAL SPEC", "기능 · 입력 · 출력");
s.addTable([
  [{ text: "기능", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "입력", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "출력", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "모듈", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["단일 분자 평가", "SMILES 1개", "예측 pIC50·추정 IC50·비강전달성·유사도·물성", "predictor / scoring"],
  ["다중 랭킹", "SMILES 여러 개", "예측 pIC50/개발성 기준 정렬 + CSV", "rank_candidates"],
  ["자율 에이전트", "시드 SMILES", "4에이전트 트레이스·최적화 후보·근거", "agent.optimize"],
  ["다성분 후보 점수", "후보(SMILES)", "Mpro결합·ADMET·비강·안정성·일치도 종합", "services/scoring §7"],
  ["모델 검증", "(사전학습)", "scaffold-CV ρ·R²·RMSE, 예측-실측 산점도", "validation"],
  ["실측 라이브러리", "필터/정렬", "6,368종 실측 pIC50 탐색", "library"],
  ["데이터 관리(CRUD)", "타깃·복합체·후보", "영속 저장·목록·대시보드·감사로그", "FastAPI + DB"],
], { x: M, y: 1.7, w: 12.2, h: 5.0, fontFace: F, fontSize: 12.5, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "middle", rowH: 0.6, fill: { color: C.card }, colW: [2.6, 2.3, 4.9, 2.4] });
footer(s, 6);

/* 7. QSAR ENGINE */
s = p.addSlide(); head(s, "과학 엔진 ①", "QSAR 활성 예측 — SMILES에서 pIC50를 직접 계산");
const flow = [["SMILES 입력", C.mut], ["RDKit 파싱\n물성·Morgan 지문", C.teal], ["QSAR 회귀\nRF / Ridge", C.mint], ["예측 pIC50\n+ 추정 IC50", C.violet]];
let fx = M;
flow.forEach((f, i) => {
  card(s, fx, 1.75, 2.7, 1.5, { fill: i === 3 ? C.dark : C.card, bar: i === 3 ? null : f[1] });
  s.addText(f[0], { x: fx + 0.15, y: 1.75, w: 2.4, h: 1.5, fontFace: F, fontSize: 13.5, bold: true, color: i === 3 ? C.white : C.dark, align: "center", valign: "middle", lineSpacingMultiple: 1.05 });
  if (i < 3) s.addText("→", { x: fx + 2.72, y: 2.15, w: 0.42, h: 0.6, fontFace: F, fontSize: 22, bold: true, color: C.mut, align: "center" });
  fx += 3.12;
});
card(s, M, 3.55, 5.95, 3.2, { bar: C.teal });
s.addText("모델 구성", { x: M + 0.3, y: 3.7, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["특징: Morgan(r=2, 2048bit) + 7개 물성(MW·logP·TPSA·HBD·HBA·RotB·QED) 표준화 = 2,055차원", "RandomForest(서버·Streamlit): 고정밀", "Ridge 선형(브라우저): 가중치 JSON export → 오프라인 실시간 예측", "기획서 §10이 명시한 ‘Morgan+GBM pIC50 회귀’를 실제 구현"]),
  { x: M + 0.35, y: 4.2, w: 5.35, h: 2.5, fontFace: F, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.2, valign: "top" });
card(s, M + 6.3, 3.55, 5.9, 3.2, { bar: C.violet });
s.addText("검증된 예측력", { x: M + 6.6, y: 3.7, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText([{ text: "RandomForest  ρ = 0.81", options: { fontSize: 18, bold: true, color: C.teal } }], { x: M + 6.6, y: 4.25, w: 5.4, h: 0.5, fontFace: F, valign: "middle" });
s.addText([{ text: "Ridge(브라우저)  ρ = 0.76", options: { fontSize: 15, bold: true, color: C.mint } }], { x: M + 6.6, y: 4.85, w: 5.4, h: 0.45, fontFace: F, valign: "middle" });
s.addText([{ text: "유사도 베이스라인  ρ = 0.34", options: { fontSize: 14, color: C.mut } }], { x: M + 6.6, y: 5.35, w: 5.4, h: 0.45, fontFace: F, valign: "middle" });
s.addText("Nirmatrelvir 예측 pIC50 = 7.0 (강활성으로 정확히 분류)", { x: M + 6.6, y: 5.95, w: 5.4, h: 0.6, fontFace: F, fontSize: 12, italic: true, color: C.ink, valign: "top" });
footer(s, 7);

/* 8. CONCORDANCE & VALIDATION */
s = p.addSlide(); head(s, "정합성 · 검증", "정직한 일반화 성능 — Scaffold 기반 교차검증");
card(s, M, 1.7, 5.6, 4.95, { bar: C.teal });
s.addText("왜 Scaffold 분할인가", { x: M + 0.3, y: 1.9, w: 5.0, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText("활성 데이터엔 유사 아날로그가 많아, 무작위 분할은 학습/평가에 near-duplicate가 섞여 성능을 과대평가합니다. 이를 막기 위해 Murcko 골격(1,960개) 단위 5-fold GroupKFold로 분리했습니다.\n\n아래 지표는 학습에 쓰이지 않은 분자에 대한 예측(out-of-fold) 기준의 정직한 일반화 성능입니다.\n\n정합성(Concordance): 예측 pIC50와 실측/도킹의 방향 일치도를 후보 점수의 신뢰도 성분으로 명시합니다.",
  { x: M + 0.3, y: 2.45, w: 5.0, h: 4.0, fontFace: F, fontSize: 13.5, color: C.ink, lineSpacingMultiple: 1.25, valign: "top" });
s.addImage({ path: path.join(IMG, "ui_validation.png"), x: M + 6.05, y: 1.7, w: 6.15, h: 4.95, sizing: { type: "contain", w: 6.15, h: 4.95 } });
footer(s, 8);

/* 9. AGENT */
s = p.addSlide(); head(s, "자율 에이전트 · AGENTIC AI", "가설 → 평가 → 최적화 → 규제, 4-에이전트 파이프라인");
const ag = [["1 가설", "Mpro 표적·목적함수 정의"], ["2 QSAR 평가", "예측 pIC50·유사도·물성"], ["3 최적화 루프", "아날로그 검색·ML hill-climb"], ["4 규제·제형", "구조알림·비강 판정"]];
let ay = 1.7;
ag.forEach((a) => {
  card(s, M, ay, 5.6, 1.02, { bar: C.violet });
  s.addText(a[0], { x: M + 0.25, y: ay, w: 2.0, h: 1.02, fontFace: F, fontSize: 15, bold: true, color: C.dark, valign: "middle" });
  s.addText(a[1], { x: M + 2.2, y: ay, w: 3.3, h: 1.02, fontFace: F, fontSize: 12, color: C.ink, valign: "middle" });
  ay += 1.14;
});
s.addText("사례: GC376 시드 → 예측 pIC50 6.94 → 7.94 (측정 7.82가 확인). 대회 4영역(가설·도구기반 최적화·규제·융합)에 매핑.", { x: M, y: ay + 0.02, w: 5.6, h: 0.75, fontFace: F, fontSize: 11.5, italic: true, color: C.mut, valign: "top" });
s.addImage({ path: path.join(IMG, "ui_agent.png"), x: M + 6.05, y: 1.7, w: 6.15, h: 4.95, sizing: { type: "contain", w: 6.15, h: 4.95 } });
footer(s, 9);

/* 10. MULTI-COMPONENT SCORE */
s = p.addSlide(); head(s, "다성분 후보 점수 (기획서 §7)", "Total Candidate Score — 구조에서 자동 산출");
const comps = [["Mpro 결합", "0.30", "예측 pIC50(QSAR)", C.teal], ["핵심 상호작용", "0.15", "강활성 구조 유사(대리)", C.mint], ["ADMET 안전성", "0.15", "QED·Lipinski·Veber·알림", C.teal], ["비강 전달성", "0.15", "MW·logP·TPSA·HBD 휴리스틱", C.mint], ["화학 안정성", "0.10", "반응성 구조알림·logP", C.teal], ["정합성", "0.10", "예측-도킹/커버리지 일치", C.mint], ["합성·신규성", "0.05", "신규성 지표", C.teal]];
let cx = M, cy = 1.75;
comps.forEach((c, i) => {
  card(s, cx, cy, 3.85, 1.35, { bar: c[3] });
  s.addText(c[1], { x: cx + 0.2, y: cy + 0.12, w: 1.2, h: 0.55, fontFace: F, fontSize: 22, bold: true, color: c[3] });
  s.addText("가중", { x: cx + 0.2, y: cy + 0.68, w: 1.2, h: 0.3, fontFace: F, fontSize: 9, color: C.mut });
  s.addText(c[0], { x: cx + 1.45, y: cy + 0.15, w: 2.3, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.dark });
  s.addText(c[2], { x: cx + 1.45, y: cy + 0.58, w: 2.3, h: 0.7, fontFace: F, fontSize: 10.5, color: C.mut, valign: "top", lineSpacingMultiple: 1.0 });
  cx += 4.12; if ((i + 1) % 3 === 0) { cx = M; cy += 1.5; }
});
s.addText("SMILES만 입력하면 7개 성분이 구조에서 자동 계산되어 0~100 연구 우선순위로 종합됩니다. (기존 ChatGPT 스캐폴드는 이 값들을 손으로 입력해야 했음)", { x: M, y: 6.5, w: 12.2, h: 0.5, fontFace: F, fontSize: 12, italic: true, color: C.mut });
footer(s, 10);

/* 11. USER MANUAL 1 - PWA */
s = p.addSlide(); head(s, "사용설명서 ① — 배포형 PWA", "브라우저만 있으면, 설치 없이");
card(s, M, 1.7, 5.6, 4.95, { bar: C.teal });
s.addText([
  { text: "1. 접속  ", options: { bold: true, color: C.dark } }, { text: "https://mpro.wnffn62.workers.dev (QR 1장) — PC 꺼져도 접속됨\n\n", options: { color: C.ink } },
  { text: "2. 단일 평가  ", options: { bold: true, color: C.dark } }, { text: "SMILES 입력→‘평가’. 예측 pIC50·IC50·비강·구조 즉시 표시. 프리셋(Nirmatrelvir 등) 버튼 제공\n\n", options: { color: C.ink } },
  { text: "3. 자율 에이전트  ", options: { bold: true, color: C.dark } }, { text: "시드 SMILES→‘자율 최적화 실행’→4에이전트·트레이스·추천 후보\n\n", options: { color: C.ink } },
  { text: "4. 검증/라이브러리  ", options: { bold: true, color: C.dark } }, { text: "예측-실측 산점도·ρ, 6,368종 탐색\n\n", options: { color: C.ink } },
  { text: "5. 오프라인  ", options: { bold: true, color: C.dark } }, { text: "최초 1회 접속 후 네트워크 없이도 동작", options: { color: C.ink } },
], { x: M + 0.3, y: 2.05, w: 5.0, h: 4.4, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.15, valign: "top" });
s.addImage({ path: path.join(IMG, "ui_dashboard.png"), x: M + 6.05, y: 2.05, w: 6.15, h: 3.55, sizing: { type: "contain", w: 6.15, h: 3.55 } });
s.addText("동일 엔진의 대시보드 — 후보/복합체/평균 우선순위/검증 리포트 요약", { x: M + 6.05, y: 5.7, w: 6.15, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: C.mut, align: "center" });
footer(s, 11);

/* 12. USER MANUAL 2 - FULLSTACK */
s = p.addSlide(); head(s, "사용설명서 ② — 제품형 풀스택", "로컬 무설치 실행 · Docker 운영");
card(s, M, 1.7, 5.6, 4.95, { bar: C.violet });
s.addText("A. 로컬(무설치, SQLite)", { x: M + 0.3, y: 1.9, w: 5.0, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: C.dark });
s.addText("cd mvp_fullstack/backend\nuvicorn app.main:app --reload --port 8000\n→ http://localhost:8000/docs (Swagger)", { x: M + 0.3, y: 2.3, w: 5.0, h: 0.95, fontFace: "Consolas", fontSize: 11.5, color: "9FE8DD", fill: { color: "0E2A28" }, valign: "middle", align: "left", margin: 6 });
s.addText("B. 풀스택(Docker)", { x: M + 0.3, y: 3.45, w: 5.0, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: C.dark });
s.addText("cd mvp_fullstack\ncp .env.example .env\ndocker compose up --build\n→ 프론트 :3000 · API :8000 · Postgres", { x: M + 0.3, y: 3.85, w: 5.0, h: 1.2, fontFace: "Consolas", fontSize: 11.5, color: "9FE8DD", fill: { color: "0E2A28" }, valign: "middle", align: "left", margin: 6 });
s.addText([{ text: "화면  ", options: { bold: true, color: C.dark } }, { text: "Dashboard·Candidates(예측 pIC50)·Agent·Complexes·Validation·Admin", options: { color: C.ink } }], { x: M + 0.3, y: 5.25, w: 5.0, h: 1.2, fontFace: F, fontSize: 12, valign: "top", lineSpacingMultiple: 1.1 });
s.addImage({ path: path.join(IMG, "ui_candidates.png"), x: M + 6.05, y: 2.05, w: 6.15, h: 3.55, sizing: { type: "contain", w: 6.15, h: 3.55 } });
s.addText("후보 목록 — SMILES만으로 예측 pIC50·Mpro결합·비강 자동 채움", { x: M + 6.05, y: 5.7, w: 6.15, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: C.mut, align: "center" });
footer(s, 12);

/* 13. VALIDATION & DEV TOOLS */
s = p.addSlide(); head(s, "검증 및 개발도구", "무엇으로 만들고, 어떻게 검증했나");
card(s, M, 1.7, 5.95, 2.9, { bar: C.teal });
s.addText("개발·과학 스택", { x: M + 0.3, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["과학: RDKit · scikit-learn(RF/Ridge) · NumPy", "백엔드: FastAPI · SQLAlchemy · SQLite/PostgreSQL", "프론트: Next.js · TypeScript · Tailwind", "배포: Cloudflare Worker(엣지) · Docker · Streamlit"]),
  { x: M + 0.35, y: 2.35, w: 5.35, h: 2.1, fontFace: F, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.3, valign: "top" });
card(s, M + 6.25, 1.7, 5.95, 2.9, { bar: C.mint });
s.addText("검증 증적 (실제 실행)", { x: M + 6.55, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["pytest 4/4 통과(구조스코어·에이전트·검증)", "Playwright 라이브 스모크 — 콘솔에러 0", "라이브 API: 예측 7.02 · GC376 6.94→7.94", "Streamlit health ok · 풀스택 UI 4화면 검증"], "2713", C.good),
  { x: M + 6.6, y: 2.35, w: 5.35, h: 2.1, fontFace: F, fontSize: 12, lineSpacingMultiple: 1.3, valign: "top" });
card(s, M, 4.8, 12.2, 1.9, { bar: C.dark });
s.addText("모델 검증 방법 = 기계장치", { x: M + 0.3, y: 4.95, w: 11.6, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.dark });
s.addText([
  { text: "정확도 지표는 사람 눈이 아니라 스크립트로 산출 — 6,368종 골격분할 5-fold → out-of-fold 예측 → Spearman/R²/RMSE 자동 계산·기록. 재현: ", options: { color: C.ink } },
  { text: "python ml/train_qsar.py", options: { fontFace: "Consolas", color: C.teal, bold: true } },
  { text: ". 결과는 qsar_metrics.json에 저장되어 UI·API·리포트가 동일 값을 참조합니다.", options: { color: C.ink } },
], { x: M + 0.3, y: 5.4, w: 11.6, h: 1.15, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.2, valign: "top" });
footer(s, 13);

/* 14. EFFECTS / ADVANTAGES */
s = p.addSlide(); head(s, "효과 · 특성 · 실무 장점", "왜 유용한가");
s.addTable([
  [{ text: "특성", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "실무적 장점 / 효과", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
  ["SMILES 하나로 즉시 평가", "docking·ADMET 수동 입력 불필요 — 리드 선별 시간을 초 단위로 단축"],
  ["정직한 검증(ρ=0.81)", "골격분할로 과대평가 차단 — 대회·심사·내부 의사결정에서 방어 가능한 수치"],
  ["자율 에이전트 최적화", "시드에서 더 강한·전달성 좋은 아날로그를 자동 제안 → 탐색 공간 축소"],
  ["오프라인·PC꺼져도 동작", "현장/발표/네트워크 불안정 환경에서도 QR 1장으로 시연"],
  ["영속 DB·감사로그(풀스택)", "다중 연구원 협업, 점수 이력·의사결정 추적, 내부 운영·확장"],
  ["동일 엔진 이원 배포", "데모(PWA)와 제품(풀스택)이 같은 결과 — 신뢰·유지보수 용이"],
], { x: M, y: 1.7, w: 12.2, h: 4.7, fontFace: F, fontSize: 13, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "middle", rowH: 0.66, fill: { color: C.card }, colW: [3.8, 8.4] });
footer(s, 14);

/* 15. LIMITS & ROADMAP */
s = p.addSlide(); head(s, "한계 · 로드맵", "정직한 경계와 다음 단계");
card(s, M, 1.7, 5.95, 4.4, { bar: C.warn });
s.addText("현재 한계 (비임상 지표)", { x: M + 0.3, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["QSAR는 리간드 기반 예측 — 실제 3D 도킹·결합자유에너지 아님", "‘핵심 상호작용’은 구조 유사 대리지표(pose 없음)", "비강 전달·독성은 투명 휴리스틱 — 실측 대체 필요", "최적화 후보 공간 = 실측 라이브러리로 한정", "효능·안전성·임상 성공률 판단 아님"]),
  { x: M + 0.35, y: 2.35, w: 5.35, h: 3.7, fontFace: F, fontSize: 12.5, color: C.ink, lineSpacingMultiple: 1.35, valign: "top" });
card(s, M + 6.25, 1.7, 5.95, 4.4, { bar: C.mint });
s.addText("로드맵 (고도화)", { x: M + 6.55, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
s.addText(bl(["실제 도킹(AutoDock Vina/GNINA)·pose·상호작용맵", "단백질-리간드 GNN·앙상블 불확실성·적용가능영역", "ADMET 전용 예측기(CYP·hERG·Ames)", "생성모델 기반 de novo 최적화", "RBAC/SSO·ChEMBL/BindingDB 커넥터·CSV/SDF 업로드"], "2192", C.ink),
  { x: M + 6.6, y: 2.35, w: 5.35, h: 3.7, fontFace: F, fontSize: 12.5, lineSpacingMultiple: 1.35, valign: "top" });
s.addText("공통 고지: 본 산출물의 모든 수치는 공개 실측 데이터로 학습·검증한 비임상 연구지원 지표이며, 임상·투여·합성·치료 판단을 대체하지 않는다.", { x: M, y: 6.35, w: 12.2, h: 0.5, fontFace: F, fontSize: 11, italic: true, color: C.mut });
footer(s, 15);

/* 16. CLOSING */
s = p.addSlide(); s.background = { color: C.dark };
s.addShape(p.ShapeType.rect, { x: 0, y: H - 0.16, w: W, h: 0.16, fill: { color: C.mint } });
s.addText("요약", { x: M, y: 1.2, w: 12, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.mint, charSpacing: 2 });
s.addText("빈 껍데기 제품이 아니라, 검증된 과학이 들어간 플랫폼", { x: M, y: 1.6, w: 12.2, h: 1.0, fontFace: F, fontSize: 32, bold: true, color: C.white });
s.addText("실측 6,368종 QSAR(ρ=0.81) · 자율 에이전트(6.94→7.94) · 오프라인 PWA + 풀스택 제품, 하나의 엔진.", { x: M, y: 2.75, w: 12, h: 0.5, fontFace: F, fontSize: 15, color: C.ice });
const inf = [["라이브 데모", "https://mpro.wnffn62.workers.dev"], ["풀스택 코드", "Desktop\\클리켐바이오_신약개발플랫폼\\mvp_fullstack"], ["통합 노트", "mvp_fullstack\\MERGE_NOTES.md"], ["기술 보고서", "제출패키지\\NasalMpro_ALBOMB_기술보고서.docx"]];
let iy = 3.7;
inf.forEach((r) => {
  s.addText(r[0], { x: M, y: iy, w: 3.0, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: C.mint });
  s.addText(r[1], { x: M + 3.1, y: iy, w: 9.0, h: 0.4, fontFace: "Consolas", fontSize: 12.5, color: C.ice });
  iy += 0.5;
});
s.addText("대상: 개발자 · 홍성현 박사((주)클리켐바이오)  |  아시아경제교육센터 알파폴드팀 · 제4회 JUMP AI", { x: M, y: 6.2, w: 12, h: 0.4, fontFace: F, fontSize: 12, color: "9FC7C0" });
footer(s, 16, true);

const outFile = path.join(__dirname, "NasoMpro-AI_기술브리핑.pptx");
p.writeFile({ fileName: outFile }).then(() => console.log("작성 완료:", outFile));
