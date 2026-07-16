const path = require("path");
const pptxgen = require(process.env.PPTX_PATH || "pptxgenjs");
const IMG = path.join(__dirname, "img");
const C = { dark: "0B3B39", teal: "0F766E", mint: "17A58F", violet: "7C3AED", bg: "F6F8F7", card: "FFFFFF", line: "DCE5E1", ink: "14211F", mut: "65736F", warn: "B45309", good: "047857", white: "FFFFFF", ice: "CDE8E3", amber: "F59E0B" };
const F = "Malgun Gothic";
const W = 13.33, H = 7.5, M = 0.55;

function mk() {
  const p = new pptxgen(); p.defineLayout({ name: "W", width: W, height: H }); p.layout = "W"; return p;
}
function bl(items, code, color) { return items.map((t) => ({ text: t, options: { bullet: { code: code || "2022", indent: 16 }, color: color || C.ink, breakLine: true } })); }
function foot(p, s, n, txt, dark) {
  s.addText(txt, { x: M, y: H - 0.42, w: 10, h: 0.3, fontFace: F, fontSize: 8, color: dark ? "8FB8B0" : C.mut });
  s.addText(String(n), { x: W - 1.1, y: H - 0.42, w: 0.5, h: 0.3, fontFace: F, fontSize: 9, color: dark ? "8FB8B0" : C.mut, align: "right" });
}
function head(p, s, kicker, title, kc) {
  s.background = { color: C.bg };
  s.addText(kicker, { x: M, y: 0.42, w: 12, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: kc || C.mint, charSpacing: 2 });
  s.addText(title, { x: M, y: 0.72, w: 12.2, h: 0.75, fontFace: F, fontSize: 29, bold: true, color: C.dark });
}
function card(p, s, x, y, w, h, opt = {}) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: opt.fill || C.card }, line: { color: opt.line || C.line, width: 1 }, shadow: { type: "outer", color: "9AA5A2", opacity: 0.18, blur: 6, offset: 2, angle: 90 } });
  if (opt.bar) s.addShape(p.ShapeType.roundRect, { x, y, w: 0.09, h, rectRadius: 0.03, fill: { color: opt.bar } });
}

/* =================== DECK A — 홍성현 리뷰 요청 =================== */
(function () {
  const p = mk();
  const FT = "NasoMpro-AI · 홍성현 박사님 리뷰 요청 · 비임상 연구지원 지표";
  // 1 title
  let s = p.addSlide(); s.background = { color: C.dark };
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: C.mint } });
  s.addText("리뷰 & 피드백 요청", { x: M, y: 1.7, w: 12, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.mint, charSpacing: 2 });
  s.addText("홍성현 박사님께", { x: M, y: 2.2, w: 12, h: 1.0, fontFace: F, fontSize: 46, bold: true, color: C.white });
  s.addText("NasoMpro-AI — SARS-CoV-2 Mpro 비강 항바이러스 후보 발굴 + 자율 에이전트 AI", { x: M, y: 3.3, w: 12, h: 0.5, fontFace: F, fontSize: 18, color: C.ice });
  s.addText("만든 것을 먼저 봐 주시고, 과학적 타당성과 다음 방향에 대해 의견을 부탁드립니다.", { x: M, y: 3.95, w: 12, h: 0.5, fontFace: F, fontSize: 14, color: "9FC7C0" });
  s.addText("라이브 데모  https://mpro.wnffn62.workers.dev   (바로 눌러보실 수 있습니다)", { x: M, y: 4.8, w: 12, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.mint });
  s.addText("아시아경제교육센터 알파폴드팀 · 제4회 JUMP AI 신약개발 경진대회", { x: M, y: 5.3, w: 12, h: 0.4, fontFace: F, fontSize: 12, color: "9FC7C0" });
  foot(p, s, 1, FT, true);
  // 2 summary
  s = p.addSlide(); head(p, s, "한 장 요약", "무엇을 만들었나");
  const st = (x, num, lab, col) => { card(p, s, x, 1.65, 3.9, 1.5, { bar: col }); s.addText(num, { x: x + 0.2, y: 1.8, w: 3.6, h: 0.65, fontFace: F, fontSize: 30, bold: true, color: col }); s.addText(lab, { x: x + 0.2, y: 2.5, w: 3.6, h: 0.55, fontFace: F, fontSize: 11.5, color: C.mut, valign: "top" }); };
  st(M, "0.34 → 0.81", "활성 예측 정확도(ρ) — 단순 유사도 대비 2.4배", C.teal);
  st(M + 4.1, "6,368종", "실측 pIC50 학습 (ChEMBL + COVID Moonshot)", C.mint);
  st(M + 8.2, "6.94 → 7.94", "AI 에이전트가 스스로 더 강한 후보 도출", C.violet);
  card(p, s, M, 3.4, 12.2, 3.35, { bar: C.dark });
  s.addText("핵심 기능", { x: M + 0.3, y: 3.55, w: 11.6, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
  s.addText(bl([
    "SMILES(화학식) 하나만 넣으면 Mpro 저해 활성(pIC50)을 실시간 예측 + 비강 전달성 평가",
    "6,368종 실측 데이터로 학습·검증한 QSAR 모델 (골격분할 교차검증으로 정직하게)",
    "자율 에이전트가 가설→평가→최적화→규제 판정을 수행하며 더 좋은 아날로그를 탐색",
    "오프라인 PWA(어디서나·PC꺼져도) + 연구원 협업용 풀스택 제품, 두 형태로 제공",
  ]), { x: M + 0.35, y: 4.05, w: 11.5, h: 2.5, fontFace: F, fontSize: 13.5, color: C.ink, lineSpacingMultiple: 1.3, valign: "top" });
  foot(p, s, 2, FT);
  // 3 assumptions to validate
  s = p.addSlide(); head(p, s, "검증 부탁", "박사님께서 봐 주셨으면 하는 과학적 가정");
  p.addSlide; // noop
  s.addTable([
    [{ text: "우리의 가정 / 구현", options: { bold: true, color: C.white, fill: { color: C.teal } } }, { text: "여쭙고 싶은 점", options: { bold: true, color: C.white, fill: { color: C.teal } } }],
    ["Mpro(3CLpro)를 표적, 비강 스프레이 국소 전달 전략", "상기도 초기 감염에서 이 전략의 과학적 타당성 / 맹점은?"],
    ["활성 예측 = 리간드 기반 QSAR (pIC50), ρ=0.81", "실무에서 이 예측을 어디까지 신뢰/활용 가능한가?"],
    ["'핵심 상호작용'은 구조 유사도로 대리(pose 없음)", "실제 도킹(Vina/GNINA)으로 교체가 얼마나 시급한가?"],
    ["비강 전달성 = MW·logP·TPSA·HBD 휴리스틱 점수", "제형 관점에서 가중치·기준이 타당한가?"],
    ["정합성(concordance) = 예측-도킹 방향 일치 대리지표", "더 나은 정합성 정의/지표가 있는가?"],
  ], { x: M, y: 1.7, w: 12.2, h: 4.6, fontFace: F, fontSize: 13, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "middle", rowH: 0.75, fill: { color: C.card }, colW: [6.1, 6.1] });
  foot(p, s, 3, FT);
  // 4 feedback questions
  s = p.addSlide(); head(p, s, "피드백 요청", "여섯 가지 질문");
  const qs = [
    ["1", "타깃·전략", "Mpro / 비강 스프레이 방향이 과학적으로 타당한가요? 더 나은 대안은?"],
    ["2", "예측 신뢰", "ρ=0.81 QSAR 예측을 실제 리드 선별에 어느 정도 신뢰하시겠습니까?"],
    ["3", "우선순위", "다음에 가장 먼저 보강할 것은? (도킹 / ADMET / 생성모델 / 데이터)"],
    ["4", "실측 데이터", "클리켐바이오 보유 자산 중 학습에 연동 가능한 데이터가 있을까요?"],
    ["5", "제형", "비강 제형 관점에서 놓친 지표(체류시간·점막자극 등)가 있나요?"],
    ["6", "대회", "제4회 JUMP AI 제출·발표에서 강조하면 좋을 포인트는?"],
  ];
  let qy = 1.7;
  qs.forEach((q, i) => {
    const col = i % 2 === 0 ? M : M + 6.15;
    if (i % 2 === 0 && i > 0) qy += 1.6;
    const yy = 1.7 + Math.floor(i / 2) * 1.6;
    card(p, s, col, yy, 6.0, 1.45, { bar: C.violet });
    s.addShape(p.ShapeType.ellipse, { x: col + 0.22, y: yy + 0.45, w: 0.55, h: 0.55, fill: { color: C.violet } });
    s.addText(q[0], { x: col + 0.22, y: yy + 0.45, w: 0.55, h: 0.55, fontFace: F, fontSize: 20, bold: true, color: C.white, align: "center", valign: "middle" });
    s.addText(q[1], { x: col + 0.95, y: yy + 0.18, w: 4.9, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.dark });
    s.addText(q[2], { x: col + 0.95, y: yy + 0.55, w: 4.9, h: 0.85, fontFace: F, fontSize: 11.5, color: C.ink, valign: "top", lineSpacingMultiple: 1.05 });
  });
  foot(p, s, 4, FT);
  // 5 feedback fill-in
  s = p.addSlide(); head(p, s, "의견 기입란", "이 표에 바로 코멘트를 적어 주세요");
  s.addTable([
    [{ text: "항목", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "현재 구현", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "박사님 의견 (자유 기입)", options: { bold: true, color: C.white, fill: { color: C.amber } } }],
    ["타깃/전략", "Mpro · 비강 스프레이", ""],
    ["활성 예측", "QSAR pIC50 ρ=0.81", ""],
    ["결합/도킹", "유사도 대리지표", ""],
    ["비강 전달성", "물성 휴리스틱", ""],
    ["다음 우선순위", "(미정)", ""],
    ["종합 의견", "", ""],
  ], { x: M, y: 1.7, w: 12.2, h: 4.7, fontFace: F, fontSize: 12.5, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "top", rowH: 0.66, fill: { color: C.card }, colW: [2.4, 3.6, 6.2] });
  s.addText("※ PowerPoint에서 오른쪽 칸을 클릭해 바로 타이핑하시면 됩니다. 회신은 이 파일 그대로 주셔도 좋습니다.", { x: M, y: 6.5, w: 12.2, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: C.mut });
  foot(p, s, 5, FT);
  // 6 how to use
  s = p.addSlide(); head(p, s, "사용·패키지 안내", "직접 써 보시는 법");
  card(p, s, M, 1.7, 5.95, 4.9, { bar: C.teal });
  s.addText("바로 써 보기", { x: M + 0.3, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
  s.addText(bl([
    "브라우저에서 https://mpro.wnffn62.workers.dev 접속 (설치 불필요)",
    "'단일 평가' 탭에 SMILES 입력 → 예측 pIC50 확인 (프리셋 버튼도 있음)",
    "'자율 에이전트' 탭에서 시드 넣고 '실행' → 최적화 결과 확인",
    "'모델 검증' 탭에서 예측-실측 산점도·정확도 확인",
  ]), { x: M + 0.35, y: 2.35, w: 5.4, h: 4.1, fontFace: F, fontSize: 12.5, color: C.ink, lineSpacingMultiple: 1.3, valign: "top" });
  card(p, s, M + 6.25, 1.7, 5.95, 4.9, { bar: C.violet });
  s.addText("첨부 패키지 구성", { x: M + 6.55, y: 1.85, w: 5.4, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: C.dark });
  s.addText(bl([
    "README.md · _시작하기.bat (메뉴 실행기)",
    "web/ — 오프라인 PWA (그대로 배포 가능)",
    "mvp_fullstack/ — FastAPI + Next.js 풀스택 (코드)",
    "app/ — 로컬 Streamlit 분석 도구",
    "ml/ — QSAR 학습 스크립트 + 모델",
    "제출패키지/ — 기술보고서·브리핑·쉬운설명·영상",
  ]), { x: M + 6.6, y: 2.35, w: 5.4, h: 4.1, fontFace: F, fontSize: 12.5, color: C.ink, lineSpacingMultiple: 1.25, valign: "top" });
  foot(p, s, 6, FT);
  // 7 next steps
  s = p.addSlide(); s.background = { color: C.dark };
  s.addShape(p.ShapeType.rect, { x: 0, y: H - 0.16, w: W, h: 0.16, fill: { color: C.mint } });
  s.addText("다음 단계 · 협업 포인트", { x: M, y: 1.3, w: 12, h: 0.5, fontFace: F, fontSize: 26, bold: true, color: C.white });
  s.addText(bl([
    "실측 데이터 연동 — 클리켐바이오 보유 활성/구조 데이터로 모델 강화",
    "실제 도킹(AutoDock Vina/GNINA) 연동으로 '핵심 상호작용'을 실측화",
    "ADMET 전용 예측기·생성모델 기반 de novo 최적화",
    "제4회 JUMP AI 제출물 방향 확정 (예선 ~8/7)",
  ], "2192", C.ice), { x: M, y: 2.1, w: 12, h: 2.6, fontFace: F, fontSize: 15, lineSpacingMultiple: 1.5, valign: "top" });
  s.addText("연락 · 회신", { x: M, y: 4.9, w: 12, h: 0.4, fontFace: F, fontSize: 13, bold: true, color: C.mint });
  s.addText("이 파일에 의견 기입 후 회신 주시거나, 통화로 말씀 주셔도 됩니다. 빠르게 반영하겠습니다.", { x: M, y: 5.3, w: 12, h: 0.5, fontFace: F, fontSize: 14, color: C.ice });
  foot(p, s, 7, FT, true);

  p.writeFile({ fileName: path.join(__dirname, "NasoMpro-AI_홍성현_리뷰요청.pptx") }).then((f) => console.log("A 작성:", f));
})();

/* =================== DECK B — 쉬운 설명 (비전문가용) =================== */
(function () {
  const p = mk();
  const FT = "NasoMpro-AI · 쉬운 설명 · 비임상 연구지원 도구(치료·임상 아님)";
  const big = (s, x, y, w, txt, col, size) => s.addText(txt, { x, y, w, h: 1.0, fontFace: F, fontSize: size || 40, bold: true, color: col });
  // 1 title
  let s = p.addSlide(); s.background = { color: C.dark };
  s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: C.amber } });
  s.addText("3분 쉬운 설명", { x: M, y: 1.9, w: 12, h: 0.5, fontFace: F, fontSize: 16, bold: true, color: C.amber, charSpacing: 2 });
  s.addText("이 프로그램, 한마디로 뭐예요?", { x: M, y: 2.4, w: 12, h: 1.1, fontFace: F, fontSize: 44, bold: true, color: C.white });
  s.addText("“코로나 바이러스를 막는 약 후보를, AI가 더 빠르고 정확하게 골라주는 도구”", { x: M, y: 3.6, w: 12, h: 0.7, fontFace: F, fontSize: 20, color: C.ice });
  s.addText("전문 지식 없이도 이해할 수 있게 설명드립니다.", { x: M, y: 4.4, w: 12, h: 0.4, fontFace: F, fontSize: 14, color: "9FC7C0" });
  foot(p, s, 1, FT, true);
  // 2 problem
  s = p.addSlide(); head(p, s, "STEP 1 · 문제", "왜 'Mpro'라는 걸 막나요?", C.amber);
  card(p, s, M, 1.75, 12.2, 2.3, { bar: C.amber });
  s.addText("바이러스가 몸속에서 '복사'되려면 'Mpro(엠프로)'라는 가위 같은 효소가 꼭 필요합니다.", { x: M + 0.35, y: 1.95, w: 11.5, h: 0.7, fontFace: F, fontSize: 18, bold: true, color: C.dark, valign: "top" });
  s.addText("이 가위를 막으면 → 바이러스가 스스로를 복사하지 못하고 → 못 퍼집니다.  (실제로 화이자 팍스로비드도 이 원리입니다.)", { x: M + 0.35, y: 2.75, w: 11.5, h: 1.1, fontFace: F, fontSize: 15, color: C.ink, valign: "top", lineSpacingMultiple: 1.2 });
  card(p, s, M, 4.35, 12.2, 2.0, { bar: C.teal });
  s.addText("그래서 우리는", { x: M + 0.35, y: 4.5, w: 11.5, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.teal });
  s.addText("“수많은 후보 물질 중, 어떤 것이 이 가위(Mpro)를 잘 막을까?” 를 AI로 빠르게 골라냅니다. 게다가 '코에 뿌리는 스프레이'로 쓰기 좋은지도 함께 봅니다.", { x: M + 0.35, y: 4.95, w: 11.5, h: 1.2, fontFace: F, fontSize: 15, color: C.ink, valign: "top", lineSpacingMultiple: 1.2 });
  foot(p, s, 2, FT);
  // 3 what it does
  s = p.addSlide(); head(p, s, "STEP 2 · 무엇을 하나", "화학식만 넣으면, 몇 초 만에 점수가 나옵니다", C.amber);
  card(p, s, M, 1.75, 5.6, 4.8, { bar: C.teal });
  s.addText(bl([
    "분자의 '화학식(SMILES)'을 입력창에 붙여넣기",
    "AI가 즉시 '예측 점수(pIC50)'를 계산 — 높을수록 잘 막음",
    "코 스프레이로 적합한지 '비강 점수'도 함께",
    "여러 개를 한 번에 넣어 순위도 매김",
  ]), { x: M + 0.35, y: 2.25, w: 5.35, h: 4.1, fontFace: F, fontSize: 14, color: C.ink, lineSpacingMultiple: 1.4, valign: "top" });
  s.addImage({ path: path.join(IMG, "shot_single.png"), x: M + 6.05, y: 2.1, w: 6.15, h: 3.3, sizing: { type: "contain", w: 6.15, h: 3.3 } });
  s.addText("실제 화면 — 큰 숫자가 '예측 점수'입니다", { x: M + 6.05, y: 5.5, w: 6.15, h: 0.4, fontFace: F, fontSize: 11, italic: true, color: C.mut, align: "center" });
  foot(p, s, 3, FT);
  // 4 trust
  s = p.addSlide(); head(p, s, "STEP 3 · 믿을 수 있나요", "실제 데이터로 '채점'해 정확도를 확인했습니다", C.amber);
  card(p, s, M, 1.8, 12.2, 2.0, { bar: C.teal });
  s.addText("이미 정답(실측값)이 있는 물질 6,368개로 AI 예측을 채점했습니다. 그것도 '한 번도 안 본 문제'로만 시험 보듯 엄격하게요.", { x: M + 0.35, y: 2.0, w: 11.5, h: 1.5, fontFace: F, fontSize: 16, color: C.ink, valign: "top", lineSpacingMultiple: 1.25 });
  const scoreCard = (x, num, lab, col, sub) => { card(p, s, x, 4.0, 3.9, 2.3, { bar: col }); s.addText(num, { x: x + 0.2, y: 4.25, w: 3.6, h: 0.9, fontFace: F, fontSize: 40, bold: true, color: col }); s.addText(lab, { x: x + 0.2, y: 5.15, w: 3.6, h: 0.5, fontFace: F, fontSize: 14, bold: true, color: C.dark }); s.addText(sub, { x: x + 0.2, y: 5.6, w: 3.6, h: 0.6, fontFace: F, fontSize: 11, color: C.mut, valign: "top" }); };
  scoreCard(M, "0.34", "예전 방식", C.mut, "단순 구조 비교 — 부정확");
  scoreCard(M + 4.1, "0.81", "우리 AI", C.teal, "정답과 훨씬 잘 맞음 (2.4배↑)");
  scoreCard(M + 8.2, "정직", "검증 방식", C.mint, "본 문제로 채점 안 함 → 부풀리기 없음");
  foot(p, s, 4, FT);
  // 5 smart agent
  s = p.addSlide(); head(p, s, "STEP 4 · 똑똑한 점", "AI가 스스로 '더 좋은 후보'를 찾아옵니다", C.amber);
  card(p, s, M, 1.75, 5.6, 4.8, { bar: C.violet });
  s.addText(bl([
    "물질 하나를 시작점으로 주면,",
    "AI 에이전트가 비슷하지만 '더 강한' 후보들을 스스로 탐색",
    "예) 점수 6.94 → 7.94 로 끌어올림",
    "실제 측정값이 이 결과를 확인해 줌 (요행 아님)",
  ]), { x: M + 0.35, y: 2.25, w: 5.35, h: 4.1, fontFace: F, fontSize: 14, color: C.ink, lineSpacingMultiple: 1.4, valign: "top" });
  s.addImage({ path: path.join(IMG, "ui_agent.png"), x: M + 6.05, y: 1.8, w: 6.15, h: 4.7, sizing: { type: "contain", w: 6.15, h: 4.7 } });
  foot(p, s, 5, FT);
  // 6 convenient
  s = p.addSlide(); head(p, s, "STEP 5 · 편한 점", "설치 없이, 어디서나, 컴퓨터가 꺼져 있어도", C.amber);
  const conv = [["🔗", "주소 하나로", "인터넷 주소(또는 QR)만 있으면 바로 사용. 프로그램 설치 불필요."], ["📴", "오프라인 OK", "한 번 열어두면 인터넷이 끊겨도 동작."], ["💤", "PC 꺼져도", "우리 컴퓨터가 꺼져 있어도 항상 접속됨(엣지 호스팅)."], ["👥", "함께 쓰기", "연구원들이 같이 쓰는 '제품형 웹사이트'로도 제공."]];
  let cvx = M;
  conv.forEach((c, i) => {
    card(p, s, cvx, 1.85, 2.9, 4.2, { bar: C.teal });
    s.addText(c[0], { x: cvx + 0.2, y: 2.1, w: 2.5, h: 0.8, fontFace: F, fontSize: 34, align: "center" });
    s.addText(c[1], { x: cvx + 0.15, y: 3.05, w: 2.6, h: 0.5, fontFace: F, fontSize: 16, bold: true, color: C.dark, align: "center" });
    s.addText(c[2], { x: cvx + 0.2, y: 3.6, w: 2.5, h: 2.2, fontFace: F, fontSize: 12, color: C.ink, align: "center", valign: "top", lineSpacingMultiple: 1.2 });
    cvx += 3.05;
  });
  foot(p, s, 6, FT);
  // 7 who uses / effect
  s = p.addSlide(); head(p, s, "STEP 6 · 효과", "한마디로, 이런 점이 좋습니다", C.amber);
  s.addTable([
    [{ text: "무엇이", options: { bold: true, color: C.white, fill: { color: C.dark } } }, { text: "어떻게 좋아지나 (쉬운 말)", options: { bold: true, color: C.white, fill: { color: C.dark } } }],
    ["빠르게", "손으로 며칠 걸릴 후보 추리기를 몇 초 만에"],
    ["정확하게", "실제 데이터로 채점된, 믿을 수 있는 점수"],
    ["똑똑하게", "AI가 스스로 더 나은 후보까지 제안"],
    ["편하게", "설치·전문 지식 없이 주소 하나로"],
    ["근거 있게", "'왜 이 점수인지' 이유와 검증을 함께 제시"],
  ], { x: M, y: 1.75, w: 12.2, h: 4.4, fontFace: F, fontSize: 15, color: C.ink, border: { type: "solid", color: C.line, pt: 0.5 }, align: "left", valign: "middle", rowH: 0.75, fill: { color: C.card }, colW: [3.2, 9.0] });
  foot(p, s, 7, FT);
  // 8 closing
  s = p.addSlide(); s.background = { color: C.dark };
  s.addShape(p.ShapeType.rect, { x: 0, y: H - 0.16, w: W, h: 0.16, fill: { color: C.amber } });
  s.addText("한 줄 요약", { x: M, y: 1.6, w: 12, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: C.amber, charSpacing: 2 });
  s.addText("“신약 후보를 더 빠르게, 더 정확하게,\n근거를 갖고 골라내는 AI 도구”", { x: M, y: 2.1, w: 12, h: 1.8, fontFace: F, fontSize: 34, bold: true, color: C.white, lineSpacingMultiple: 1.15 });
  s.addText("직접 눌러보기:  https://mpro.wnffn62.workers.dev", { x: M, y: 4.3, w: 12, h: 0.5, fontFace: F, fontSize: 17, bold: true, color: C.amber });
  s.addText("※ 이 도구의 모든 숫자는 '연구용 예측'입니다. 실제 치료·투여·임상 판단이 아닙니다.", { x: M, y: 5.9, w: 12, h: 0.4, fontFace: F, fontSize: 12, italic: true, color: "9FC7C0" });
  foot(p, s, 8, FT, true);

  p.writeFile({ fileName: path.join(__dirname, "NasoMpro-AI_쉬운설명.pptx") }).then((f) => console.log("B 작성:", f));
})();
