const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, ExternalHyperlink
} = require(process.env.DOCX_PATH || 'docx');

const IMG = path.join(__dirname, 'img');
const FONT = 'Malgun Gothic';
const BRAND = '0B3B39';
const CW = 9360; // content width DXA

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const cellM = { top: 70, bottom: 70, left: 120, right: 120 };

function h(text, level) { return new Paragraph({ heading: level, children: [new TextRun({ text, font: FONT })] }); }
function p(runs) { return new Paragraph({ spacing: { after: 120, line: 276 }, children: (Array.isArray(runs) ? runs : [new TextRun({ text: runs, font: FONT, size: 22 })]) }); }
function t(text, opt = {}) { return new TextRun({ text, font: FONT, size: opt.size || 22, bold: opt.bold, color: opt.color, italics: opt.italics }); }
function bullet(text) { return new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: FONT, size: 22 })] }); }

function cell(text, { w, head, bold, fill, align } = {}) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cellM,
    shading: { fill: fill || (head ? 'E7EFED' : 'FFFFFF'), type: ShadingType.CLEAR },
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT, children: [new TextRun({ text, font: FONT, size: 20, bold: bold || head, color: head ? BRAND : '14211F' })] })]
  });
}
function table(widths, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, ri) => new TableRow({ children: r.map((c, ci) => cell(String(c), { w: widths[ci], head: ri === 0, align: ci > 0 ? AlignmentType.CENTER : AlignmentType.LEFT })) }))
  });
}
function img(file, w) {
  const data = fs.readFileSync(path.join(IMG, file));
  const dim = { shot_single: [2400, 1280], shot_agent: [2248, 2864], shot_validation: [2248, 1224] }[file.replace('.png', '')];
  const hgt = Math.round(w * dim[1] / dim[0]);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [new ImageRun({ type: 'png', data, transformation: { width: w, height: hgt }, altText: { title: file, description: file, name: file } })] });
}
function caption(text) { return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text, font: FONT, size: 18, italics: true, color: '65736F' })] }); }

const heading1Border = { bottom: { style: BorderStyle.SINGLE, size: 6, color: '17A58F', space: 4 } };

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: FONT, color: BRAND }, paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0, border: heading1Border } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, font: FONT, color: '155E52' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, font: FONT }, paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 260 } } } }] }] },
  footnotes: {},
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NasalMpro · ALBOMB 기술보고서 — ', font: FONT, size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '999999' })] })] }) },
    children: [
      // ===== 표지 =====
      new Paragraph({ spacing: { before: 1400, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NasalMpro · ALBOMB', font: FONT, size: 56, bold: true, color: BRAND })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Mpro 표적 비강 항바이러스 후보 발굴 + 자율 에이전트 AI', font: FONT, size: 26, color: '155E52' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: '제4회 AI 신약개발 경진대회 (4th JUMP AI) 기술 보고서', font: FONT, size: 22, bold: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '팀: 아시아경제교육센터 알파폴드팀 (팀장 국경희)', font: FONT, size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '멘토: 홍성현 ((주)클리켐바이오 대표이사)', font: FONT, size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: '주최 보건복지부 · 주관 한국보건산업진흥원(KHIDI)', font: FONT, size: 20, color: '65736F' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '라이브 데모: ', font: FONT, size: 22 }), new ExternalHyperlink({ link: 'https://mpro.wnffn62.workers.dev', children: [new TextRun({ text: 'https://mpro.wnffn62.workers.dev', style: 'Hyperlink', font: FONT, size: 22 })] })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: '오프라인 PWA · 엣지 상시 호스팅 (PC 전원과 무관)', font: FONT, size: 18, color: '65736F' })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 목차 =====
      h('목차', HeadingLevel.HEADING_1),
      new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== 1. 개요 =====
      h('1. 개요 및 프로젝트 방향 전환', HeadingLevel.HEADING_1),
      p('본 프로젝트는 SARS-CoV-2의 Main Protease(3CLpro, 이하 Mpro)를 표적하는 저해제 후보를 계산으로 선별하고, 이를 비강 스프레이 형태의 국소 항바이러스제 관점에서 평가·최적화하는 자율 에이전트 AI 시스템이다.'),
      h('1.1 초기 방향과 기술적 한계', HeadingLevel.HEADING_2),
      p('초기에는 AlphaFold3로 항체-항원 결합 복합체를 예측하려 하였으나, 약 한 달간 seed 수를 높여가며 반복했음에도 항체-항원 복합체 예측 정확도가 다른 복합체 유형 대비 현저히 낮은 구조적 한계를 확인하였다.'),
      h('1.2 전환된 접근', HeadingLevel.HEADING_2),
      p([t('‘코로나바이러스’ 테마는 유지하되, 타겟을 스파이크 단백질에서 ', { size: 22 }), t('Mpro를 표적하는 리간드/저해제 결합 예측', { bold: true }), t('으로 전환하였다. 응용 전망 또한 알부민 중심 접근에서 ', { size: 22 }), t('비강 스프레이 국소 전달 전략', { bold: true }), t('으로 조정하였다. Mpro는 바이러스 폴리단백질 절단에 필수적이며 인간 프로테아제와 상동성이 낮아 선택적 항바이러스 표적으로 검증된 부위이다(Nirmatrelvir, Ensitrelvir 등 승인·임상 저해제 존재).', { size: 22 })]),

      // ===== 2. 데이터 =====
      h('2. 데이터셋', HeadingLevel.HEADING_1),
      p('공개 실측 활성 데이터를 통합하여 학습·검증에 사용하였다. 모든 화합물은 실측 pIC50(= −log10 IC50[M])을 보유한다.'),
      table([3900, 2000, 3460], [
        ['출처', '화합물 수', '설명'],
        ['ChEMBL (CHEMBL4523582)', '4,415', 'SARS-CoV-2 Mpro 저해 활성 assay'],
        ['COVID Moonshot', '1,944', '오픈사이언스 신규 합성·측정 데이터'],
        ['ChEMBL + Moonshot 중복', '9', '두 출처 공통'],
        ['통합 (고유)', '6,368', '학습·검증 전체'],
      ]),
      p([t('유사도 기준물질로는 실측 강활성 상위 100종을 사용하였다. 데이터는 활성/개발성 지표가 사전 계산된 형태로 앱에 내장되며, 상위 400종은 웹 라이브러리 탐색 UI로 제공된다.', { size: 22 })]),

      // ===== 3. 방법론 =====
      h('3. 방법론', HeadingLevel.HEADING_1),
      h('3.1 QSAR 활성 예측 모델', HeadingLevel.HEADING_2),
      p([t('기존 접근은 기준물질과의 Morgan fingerprint Tanimoto 유사도라는 단순 휴리스틱(Spearman ρ≈0.34)에 의존했다. 본 시스템은 이를 넘어 ', { size: 22 }), t('6,368종 실측 pIC50으로 학습한 QSAR 회귀 모델', { bold: true }), t('을 도입한다.', { size: 22 })]),
      bullet('특징(feature): Morgan fingerprint (radius=2, 2048 bit) + 7개 물성(MW, logP, TPSA, HBD, HBA, RotB, QED) 표준화. 총 2,055차원.'),
      bullet('모델 A — RandomForest (서버/로컬 Streamlit): 고정밀 예측용.'),
      bullet('모델 B — Ridge 선형 (브라우저): 가중치를 JSON으로 export하여 오프라인 브라우저에서 임의 SMILES를 실시간 예측(RDKit-WASM으로 지문 계산 후 내적).'),
      h('3.2 검증 — Scaffold 기반 교차검증', HeadingLevel.HEADING_2),
      p([t('활성 데이터에는 서로 유사한 아날로그가 많아, 무작위 분할은 학습/평가 세트에 near-duplicate가 섞여 성능을 과대평가한다. 이를 방지하기 위해 ', { size: 22 }), t('Murcko 골격(generic scaffold) 단위 5-fold GroupKFold', { bold: true }), t(' 교차검증을 사용하였다(1,960개 고유 골격). 아래 지표는 학습에 쓰이지 않은 분자에 대한 out-of-fold 예측 기준의 정직한 일반화 성능이다.', { size: 22 })]),
      img('shot_validation.png', 560),
      caption('그림 1. 모델 검증 뷰 — 예측 pIC50 vs 실측 pIC50 (out-of-fold). 대각선에 가까울수록 정확.'),
      h('3.3 자율 에이전트 파이프라인', HeadingLevel.HEADING_2),
      p('대회 테마인 ‘신약개발 단계별 특화 에이전틱 AI’에 맞춰, 시드 분자를 입력하면 4개 에이전트가 순차 실행되는 파이프라인을 구현하였다. 전 과정이 브라우저에서 오프라인으로 재현된다.'),
      table([1400, 3400, 4560], [
        ['에이전트', '역할', '도구·방법'],
        ['Agent 1', '가설 생성', 'Mpro 표적 근거·목적함수 정의(활성·비강·SAR)'],
        ['Agent 2', '활성·물성 평가', 'QSAR 예측 pIC50 + 유사도 + Lipinski/Veber'],
        ['Agent 3', '분자 최적화 루프', '실측 라이브러리 아날로그 검색 + ML 스코어 hill-climb 재앵커'],
        ['Agent 4', '규제·제형 판정', '구조알림 스캔 + 비강 전달성·비임상 판정'],
      ]),
      p([t('Agent 3의 최적화 효용은 ', { size: 22 }), t('U = 0.60·정규화 예측활성 + 0.25·비강전달성 + 0.15·SAR 연속성', { bold: true }), t('으로 정의된다. 매 라운드 현재 앵커의 아날로그(지문 유사도 ≥ 0.15) 중 효용 최대 후보로 재앵커하며, 개선이 없으면 수렴한다.', { size: 22 })]),
      img('shot_agent.png', 430),
      caption('그림 2. 자율 에이전트 파이프라인 실행 결과 (4개 에이전트 + 최적화 트레이스 + 최종 추천).'),

      // ===== 4. 결과 =====
      h('4. 결과', HeadingLevel.HEADING_1),
      h('4.1 모델 성능 (scaffold-CV)', HeadingLevel.HEADING_2),
      table([3560, 1900, 1900, 2000], [
        ['모델', 'Spearman ρ', 'R²', 'RMSE'],
        ['RandomForest (서버)', '0.809', '0.643', '0.727'],
        ['Ridge 선형 (브라우저)', '0.755', '0.536', '0.828'],
        ['유사도 베이스라인(기존)', '0.338', '—', '—'],
      ]),
      p([t('QSAR 모델은 기존 유사도 대비 순위상관을 ', { size: 22 }), t('ρ 0.34 → 0.81(RF) / 0.76(Ridge)', { bold: true, color: BRAND }), t('로 약 2.4배 향상시켰으며, 이는 골격 분할 기준의 보수적(정직한) 지표이다.', { size: 22 })]),
      h('4.2 자율 최적화 사례', HeadingLevel.HEADING_2),
      p([t('GC376(공유결합형 Mpro 저해제)을 시드로 자율 최적화를 실행한 결과, 예측 pIC50 ', { size: 22 }), t('6.93 → 7.94', { bold: true, color: BRAND }), t('의 아날로그를 2라운드 만에 도출하였다. 트레이스에 함께 표기되는 측정 pIC50(에이전트가 사용하지 않은 검증값)은 도출 후보가 실제 강활성 영역으로 수렴했음을 확인해 준다.', { size: 22 })]),
      h('4.3 단일 분자 실시간 평가', HeadingLevel.HEADING_2),
      p('임의 SMILES 입력 시 브라우저에서 예측 pIC50(추정 IC50 nM 환산), 개발성 Composite, 비강 전달성, 강활성 유사도, 약물성 지표를 즉시 산출한다.'),
      img('shot_single.png', 600),
      caption('그림 3. 단일 분자 평가 — 예측 pIC50을 헤드라인으로, 물성·유사도·구조를 함께 제시.'),

      // ===== 5. 시스템/배포 =====
      h('5. 시스템 및 배포', HeadingLevel.HEADING_1),
      bullet('구현: 단일 정적 PWA(RDKit MinimalLib WebAssembly) — 서버·빌드 없이 브라우저에서 실행.'),
      bullet('오프라인: Service Worker가 앱 셸·모델·라이브러리·WASM을 프리캐시(최초 1회 온라인 후 오프라인 동작).'),
      bullet('배포: Cloudflare Worker 엣지 상시 호스팅 — 개발 PC 전원과 무관하게 접속 가능. 고정 주소 https://mpro.wnffn62.workers.dev'),
      bullet('로컬 no-code 도구: Streamlit + 실제 RDKit/RandomForest(더블클릭 실행) 병행 제공.'),
      h('5.1 대회 4개 영역 매핑', HeadingLevel.HEADING_2),
      table([3400, 5960], [
        ['대회 영역', '본 시스템의 구현'],
        ['자율 가설생성·검증', 'Agent 1 가설 + Agent 2 QSAR 활성 검증'],
        ['도구기반 분자 최적화 루프', 'Agent 3 아날로그 검색·ML 스코어 hill-climb'],
        ['규제·지능형 임상 설계', 'Agent 4 구조알림·비임상·PK/PD 판정'],
        ['융합', '비강 제형 설계 + 통합 파이프라인 + ALBOMB 연계'],
      ]),

      // ===== 6. ALBOMB =====
      h('6. 연계 플랫폼 — ALBOMB (당화알부민 tPDC)', HeadingLevel.HEADING_1),
      p([t('클리켐바이오의 원천기술인 ', { size: 22 }), t('클릭화학 기반 tPDC 당화알부민 나노플랫폼', { bold: true }), t('을 동일 웹앱에 통합 배포하였다(', { size: 22 }), new ExternalHyperlink({ link: 'https://mpro.wnffn62.workers.dev/albumin.html', children: [new TextRun({ text: '/albumin.html', style: 'Hyperlink', font: FONT, size: 22 })] }), t('). 당밀도를 6.8로 정밀 설계하여 간 흡수를 회피하고 신장을 선택적으로 타겟, 급성신장손상(AKI)→만성신부전(CKD) 이행을 M1→M2 마크로파지 전환으로 차단하는 First-in-Class 접근이다. 두 플랫폼은 결합·구조 예측 도구를 공유하며 상호 링크로 연결된다.', { size: 22 })]),

      // ===== 7. 한계 =====
      h('7. 한계 및 향후 과제', HeadingLevel.HEADING_1),
      bullet('본 도구의 pIC50 예측은 리간드 기반 QSAR로, 실제 3D 도킹·결합 자유에너지 계산을 대체하지 않는다. 향후 Mpro 구조 기반 도킹(예: AutoDock Vina) 연동으로 보강 예정.'),
      bullet('비강 전달성·독성은 투명한 물성 휴리스틱이며, in vitro/in vivo 실측(점막 투과·체류·자극성)으로 대체·검증되어야 한다.'),
      bullet('Ridge 브라우저 모델(ρ=0.76)은 경량화를 위한 선형 근사로, 서버 RandomForest(ρ=0.81) 대비 정밀도가 낮다.'),
      bullet('최적화 루프의 후보 공간은 현재 실측 라이브러리로 한정되며, 생성모델 기반 de novo 확장이 향후 과제다.'),
      p([t('공통 고지: 본 산출물의 모든 수치는 공개 데이터로 학습·검증한 ', { size: 20, italics: true }), t('비임상 계산 예측값', { size: 20, bold: true }), t('이며, 실험·독성·임상 데이터 또는 품목허가 판단을 대체하지 않는다.', { size: 20, italics: true })]),

      // ===== 부록 =====
      h('부록 A. 재현 방법', HeadingLevel.HEADING_1),
      bullet('QSAR 학습: python ml/train_qsar.py → ml/qsar_metrics.json, web/qsar_model.json, ml/qsar_rf.pkl, data/mpro_predictions.json 생성.'),
      bullet('웹 배포: python deploy_mpro.py → web/ 전체를 엣지 Worker로 업로드.'),
      bullet('로컬 앱: app/실행.bat 더블클릭(최초 1회 venv 구성 후 Streamlit 자동 실행).'),
      bullet('검증: scaffold 5-fold GroupKFold out-of-fold 예측 기준 Spearman/R²/RMSE.'),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'NasalMpro_ALBOMB_기술보고서.docx');
  fs.writeFileSync(out, buf);
  console.log('작성 완료:', out, (buf.length / 1024).toFixed(0) + 'KB');
});
