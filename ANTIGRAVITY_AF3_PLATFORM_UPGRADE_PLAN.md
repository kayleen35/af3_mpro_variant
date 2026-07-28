# Mpro 변이–억제제 분석 플랫폼 고도화 개발 명세

> 목적: Antigravity에 입력하여 기존 AlphaFold 3 기반 Mpro 변이 분석 플랫폼을 단계적으로 고도화하기 위한 구현 명세  
> 성격: 연구·교육·포트폴리오용 인실리코 분석 플랫폼  
> 사용 제한: 임상 진단, 치료 결정, 실제 투여, 독성 확정, 약효 확정에 사용하지 않음

---

## 0. 플랫폼 최종 목표

사용자가 SARS-CoV-2 Mpro 서열 또는 변이 정보를 입력하면 다음 과정을 하나의 워크플로우로 실행한다.

```text
Mpro 서열 입력
→ WT 대비 변이 검출
→ 16개 억제제 기초 정보 불러오기
→ 1차 독성·비강 적합성 스크리닝
→ 통과 후보의 WT/변이 Mpro 복합체 AF3 예측
→ 변이 전후 상호작용 비교
→ 구조변경 후보 생성
→ 변경 후보의 독성·비강 적합성 재평가
→ 통과 후보만 AF3 재예측
→ 최종 비교
```

이 플랫폼의 핵심 가치는 새로운 치료제를 자동으로 확정하는 것이 아니라 다음 세 가지다.

1. Mpro 변이가 기존 억제제의 결합 포즈와 상호작용에 미치는 영향을 구조적으로 비교한다.
2. 독성 및 비강 제형 관련 인실리코 위험을 이용해 AF3 계산 우선순위를 정한다.
3. 변이로 소실된 상호작용을 보완할 수 있는 제한적 구조변경 후보를 생성하고 재평가한다.

---

# 1. 반드시 지켜야 할 과학적·기술적 원칙

## 1.1 임의 생물학 수치 생성 금지

다음 값은 실제 계산 결과나 출처가 없으면 절대 생성하지 않는다.

- IC50
- EC50
- EC90
- Ki
- Kd
- 결합 자유에너지
- 세포독성 수치
- 비강 투과율
- 실제 약효 점수
- 실제 임상 안전성 점수

데이터가 없을 때는 다음 상태 중 하나로 표시한다.

```text
미평가
계산 대기
실험자료 없음
예측 불가
외부 근거 필요
```

## 1.2 AF3 점수의 의미 제한

AF3 출력의 다음 값은 구조 예측 신뢰도 또는 상대적 포즈 신뢰도를 나타내는 용도로만 사용한다.

- ranking score
- ipTM
- pTM
- chain-pair ipTM
- chain-pair PAE
- ligand PAE
- clash
- pLDDT 계열 값

다음처럼 표현하지 않는다.

```text
잘 붙는다
강한 억제제다
약효가 좋다
결합력이 높다
```

대신 다음처럼 표현한다.

```text
예측 포즈 신뢰도가 높다
활성 포켓 배치가 일관되게 예측되었다
WT 대비 구조적 상호작용이 유지되었다
내성 가능성이 구조적으로 관찰되었다
```

## 1.3 Mpro는 homodimer 기준

모든 AF3 구조 예측은 원칙적으로 다음 입력을 사용한다.

```text
Protein chain A: Mpro
Protein chain B: 동일 Mpro
Ligand chain C: 억제제 1개
```

변이 Mpro 예측에서는 A와 B 두 체인에 같은 변이를 반영한다.

## 1.4 공유결합과 비공유결합 억제제 분리

억제제를 최소한 다음 유형으로 분리한다.

```text
reversible_covalent
covalent
non_covalent
```

공유결합 계열은 Cys145와 warhead의 거리·배치 분석이 필요하다.  
비공유결합 계열은 수소결합, 소수성 접촉, 방향족 상호작용, 포켓 점유 등을 중심으로 분석한다.

## 1.5 독성 및 비강 적합성은 “예측 위험”으로 표현

다음 표현을 사용한다.

```text
인실리코 독성 위험
비강 제형 적합성 예측
상피세포 투과 위험
추가 실험 필요
```

다음 표현은 사용하지 않는다.

```text
안전함
독성이 없음
비강스프레이 사용 가능
치료제로 적합
```

---

# 2. 전체 화면 및 라우트 구조

기존 페이지를 유지하면서 아래 흐름으로 확장한다.

```text
/
├── /dashboard
├── /sequence
├── /mutation
├── /screening
│   ├── /screening/toxicity
│   └── /screening/nasal
├── /prediction
├── /comparison
├── /interaction
├── /optimization
├── /reevaluation
├── /final-ranking
├── /viewer
└── /report
```

권장 사이드바 순서:

1. 대시보드
2. Mpro 서열 입력
3. 변이 분석
4. 1차 후보 스크리닝
5. AF3 결합 구조 예측
6. WT–변이 비교
7. 상호작용 분석
8. 구조변경 후보
9. 재평가
10. 최종 비교
11. 3D 구조 뷰어
12. 연구 보고서

---

# 3. 공통 분석 Job 상태 설계

각 분석은 하나의 `analysisJob`으로 관리한다.

## 3.1 Job 상태

```ts
type AnalysisStatus =
  | 'created'
  | 'sequence_validating'
  | 'mutation_detecting'
  | 'screening_ready'
  | 'screening_running'
  | 'screening_completed'
  | 'af3_queued'
  | 'af3_running'
  | 'af3_partial_completed'
  | 'af3_completed'
  | 'interaction_analyzing'
  | 'optimization_ready'
  | 'optimization_running'
  | 'reevaluation_running'
  | 'finalized'
  | 'failed'
  | 'cancelled';
```

## 3.2 공통 Job 데이터

```ts
interface AnalysisJob {
  jobId: string;
  status: AnalysisStatus;

  input: SequenceInput;
  reference: ReferenceSequenceInfo;
  mutations: MutationRecord[];

  inhibitorScreening: InhibitorScreeningSummary[];
  af3Predictions: Af3PredictionRecord[];
  interactionComparisons: InteractionComparisonRecord[];

  optimizationRuns: OptimizationRun[];
  finalCandidates: FinalCandidateRecord[];

  createdAt: string;
  updatedAt: string;

  warnings: string[];
  errors: JobError[];
}
```

---

# 4. 1단계 — Mpro 서열 입력

## 4.1 목적

사용자가 분석할 Mpro 변이체를 입력하고, 입력이 mature Mpro 분석에 적합한지 검증한다.

## 4.2 입력 방식

두 가지 탭을 제공한다.

### A. FASTA 전체 서열 입력

```text
>Mpro_variant
SGFRKMAFPSGKVEGCMV...
```

### B. 변이 표기 입력

```text
E166V
L50F/E166A/L167F
S144A, A173V
```

## 4.3 입력 검증

확인 항목:

- FASTA 헤더 제거
- 공백 및 줄바꿈 제거
- 대문자 변환
- 표준 아미노산 20종 외 문자 검출
- 서열 길이 확인
- WT 길이와 차이가 있는 경우 삽입·결실 가능성 경고
- Mpro 기준 길이와 현저히 다를 경우 분석 중단
- mutation text의 WT 잔기와 기준 서열 잔기가 일치하는지 확인
- 동일 위치 중복 입력 차단
- 촉매 잔기 H41, C145 변이 시 강한 경고

## 4.4 UI 구성

왼쪽:

- 입력 방식 탭
- FASTA textarea 또는 mutation input
- 예제 불러오기
- 입력 초기화
- 분석 시작 버튼

오른쪽:

- 기준 서열 정보
- 입력 길이
- 유효 아미노산 수
- 예상 변이 수
- 경고
- Mpro dimer mode 고정 표시

## 4.5 API

```http
POST /api/analysis
```

요청:

```json
{
  "inputType": "fasta",
  "fastaText": ">Mpro_variant\nSGFR...",
  "referenceId": "wuhan_hu_1_mpro",
  "dimerMode": true
}
```

응답:

```json
{
  "jobId": "AF3-MPRO-123456",
  "status": "sequence_validating"
}
```

## 4.6 완료 조건

- 유효한 서열이 저장됨
- 기준 서열 ID가 기록됨
- `jobId`가 생성됨
- 다음 단계인 변이 분석으로 이동 가능

---

# 5. 2단계 — WT 대비 변이 검출

## 5.1 목적

입력된 Mpro 서열과 기준 WT Mpro를 정렬하여 변이 위치와 구조적 의미를 표시한다.

## 5.2 변이 유형

```text
substitution
insertion
deletion
```

MVP에서는 substitution을 우선 구현하고 insertion/deletion은 경고 또는 제한 지원으로 둔다.

## 5.3 변이 데이터 모델

```ts
interface MutationRecord {
  mutationId: string;
  position: number;
  wildTypeResidue: string;
  mutantResidue: string;
  mutationType: 'substitution' | 'insertion' | 'deletion';

  structuralRegion:
    | 'catalytic_site'
    | 'substrate_binding_pocket'
    | 'dimer_interface'
    | 'domain_core'
    | 'surface_loop'
    | 'unknown';

  nearbyKeyResidues: string[];
  distanceToCatalyticResidue?: number | null;
  literatureEvidence?: EvidenceReference[];
  interpretation: string;
}
```

## 5.4 구조 영역 분류

최소 분류:

- 촉매 잔기: H41, C145
- S1 포켓 관련: F140, N142, H163, E166
- S2/S4 포켓 관련: M49, M165, Q189 등
- dimer interface
- N-finger
- 도메인 III
- 원거리 표면 영역

## 5.5 UI

### 상단 요약

- 총 변이 수
- 활성 포켓 변이 수
- dimer interface 변이 수
- 촉매 잔기 직접 변이 여부
- 분석 위험 경고

### 중앙 서열 뷰

- WT와 mutant 서열 정렬
- 변이 위치 색상 표시
- 잔기 클릭 시 상세 패널 표시

### 변이 테이블

컬럼:

```text
Position
WT
Mutant
Region
Pocket proximity
Known resistance evidence
Interpretation
```

## 5.6 판정 규칙

예:

```text
E166V
→ 활성 포켓 경계
→ 여러 억제제의 수소결합 및 S1 포켓 배치에 영향을 줄 가능성
→ AF3 WT/Mutant 비교 우선순위 높음
```

```text
L50F
→ 직접 결합 잔기가 아닐 수 있음
→ 단독보다 복합 변이 맥락에서 구조 안정성 및 내성 보상 가능성 검토
```

## 5.7 완료 조건

- 모든 변이 위치가 표에 기록됨
- 구조 영역이 매핑됨
- 다음 단계에서 사용할 mutant sequence가 생성됨
- 사용자에게 “직접 결합 부위 변이”와 “간접 영향 변이”가 구분되어 보임

---

# 6. 3단계 — 16개 억제제 기초 정보 불러오기

## 6.1 목적

분석에 사용할 16개 억제제의 구조, 분류, 알려진 개발 정보, SMILES를 통일된 형식으로 제공한다.

## 6.2 억제제 목록

### 공유결합 또는 가역적 공유결합 계열

- Nirmatrelvir
- Ibuzatrelvir
- Simnotrelvir
- Leritrelvir
- Pomotrelvir
- GC376
- PF-00835231
- Boceprevir
- Bofutrelvir

### 비공유결합 계열

- Ensitrelvir
- X77
- ML188
- MAT-POS-e194df51
- MAT-POS-b3e365b9
- Secutrelvir
- Olgotrelvir

## 6.3 데이터 모델

```ts
interface Inhibitor {
  id: string;
  name: string;
  aliases: string[];
  smiles: string;
  canonicalSmiles?: string;

  bindingType:
    | 'covalent'
    | 'reversible_covalent'
    | 'non_covalent';

  warheadType?: string | null;
  knownRoute?: string | null;
  developmentStatus?: string | null;

  sourceReferences: EvidenceReference[];
  enabled: boolean;
}
```

## 6.4 구조 표준화

RDKit 또는 동등한 cheminformatics 도구로 다음을 수행한다.

- SMILES 파싱
- canonical SMILES 생성
- 입체화학 유지
- InChIKey 생성
- 중복 검사
- 분자량 계산
- TPSA 계산
- cLogP 계산
- HBD/HBA 계산
- 회전 가능 결합 수 계산
- formal charge 계산
- ring 수 계산

## 6.5 UI

카드당 표시:

- 이름
- binding type
- 2D 분자 구조
- SMILES 복사 버튼
- MW
- TPSA
- cLogP
- 알려진 투여 경로
- 개발 상태
- 데이터 출처 여부
- 분석 포함 체크박스

## 6.6 완료 조건

- 16개 모두 유효한 SMILES로 로드됨
- 각 억제제에 고유 ID가 있음
- 2D 구조 렌더링 가능
- 공유결합/비공유결합 분류 완료

---

# 7. 4단계 — 1차 독성·비강 적합성 스크리닝

## 7.1 목적

AF3 계산 전에 일반 독성 위험과 비강 국소 전달 적합성을 예측해 계산 우선순위를 설정한다.

이 단계는 후보를 확정 탈락시키기 위한 단계가 아니라 다음 중 하나로 분류하는 단계다.

```text
priority
review
low_priority
unresolved
```

## 7.2 일반 독성 예측 항목

최소 endpoint:

- Ames mutagenicity
- hERG inhibition
- DILI
- ClinTox
- CYP3A4 inhibition
- CYP2D6 inhibition
- CYP2C9 inhibition
- CYP2C19 inhibition
- CYP1A2 inhibition
- 일반 cytotoxicity
- LD50 예측값이 제공될 경우 표시
- 구조적 toxicophore alert
- PAINS alert
- reactive group alert

## 7.3 비강 적합성 평가 항목

### 계산 가능 항목

- MW
- TPSA
- cLogP
- logD at pH 5.5–6.5 예측값
- pKa
- aqueous solubility
- HBD/HBA
- formal charge
- 회전 가능 결합 수
- 예측 세포 투과성
- P-gp substrate/inhibitor 가능성
- 점액 결합 위험
- 제형 농도 위험
- 화학적 안정성 위험

### 계산만으로 확정 불가능한 항목

- 비강 점막 자극
- 섬모 운동 저하
- 후각상피 독성
- 반복 분무 독성
- 실제 비강 조직 체류 시간
- HNE-ALI EC90
- 세포 내 농도
- 실제 spray pattern

이 항목들은 반드시 `실험 필요`로 표시한다.

## 7.4 내부 분류 규칙

점수 하나로 모든 것을 합치지 말고 최소 세 개 축을 분리한다.

```ts
interface ScreeningDecision {
  toxicityRisk: 'low' | 'moderate' | 'high' | 'unresolved';
  nasalFeasibility: 'favorable' | 'borderline' | 'challenging' | 'unresolved';
  evidenceConfidence: 'A' | 'B' | 'C' | 'D' | 'E';
  af3Priority: 'priority' | 'review' | 'low_priority';
  reasons: string[];
}
```

### 예시 판정

```text
독성 모델 위험 낮음
+ 비강 물성 적합성 양호
→ priority
```

```text
독성 위험 중간
+ 용해도 불리
+ 세포 투과성은 양호
→ review
```

```text
다수 모델에서 높은 위험
+ 비강 제형 농도 달성 어려움
→ low_priority
```

단, 사용자가 `전체 16종 분석`을 선택하면 low_priority도 AF3 실행 가능하게 한다.

## 7.5 UI

### 상단 요약

- 전체 후보 수
- priority 수
- review 수
- low_priority 수
- 미평가 수

### 필터

- 공유결합/비공유결합
- 독성 위험
- 비강 적합성
- 개발 단계
- AF3 실행 대상

### 비교 테이블

```text
Name
Binding Type
Ames
hERG
DILI
ClinTox
CYP burden
MW
TPSA
cLogP
Solubility
Nasal feasibility
Evidence confidence
AF3 priority
```

### 상세 패널

- 2D 구조
- endpoint별 결과
- 예측 모델명
- 예측 버전
- 데이터 생성 시각
- 구조 경고
- 비강 국소독성 데이터 공백
- 다음 실험 필요 항목

## 7.6 API

```http
GET /api/toxicity/results
POST /api/screening/run
GET /api/screening/:jobId
POST /api/screening/:jobId/select
```

## 7.7 완료 조건

- 16개 후보가 모두 screening 상태를 가짐
- AF3 실행 우선순위가 결정됨
- 사용자가 후보를 수동 추가·제외 가능
- 모든 판정에는 이유가 기록됨
- 실제 값이 없으면 미평가로 표시됨

---

# 8. 5단계 — 통과 후보의 WT/변이 Mpro 복합체 AF3 예측

## 8.1 목적

동일한 억제제를 WT Mpro와 mutant Mpro에 각각 입력하여 구조적 차이를 비교할 수 있는 결과를 생성한다.

## 8.2 예측 조합

억제제 하나당 최소 두 가지 예측이 필요하다.

```text
WT Mpro dimer + inhibitor
Mutant Mpro dimer + inhibitor
```

가능하면 WT 결과를 캐시하여 동일 억제제에 대해 반복 계산하지 않는다.

## 8.3 입력 JSON 생성 규칙

```json
{
  "name": "WT_nirmatrelvir",
  "modelSeeds": [1, 2, 3, 4, 5],
  "sequences": [
    {
      "protein": {
        "id": "A",
        "sequence": "WT_MPRO_SEQUENCE"
      }
    },
    {
      "protein": {
        "id": "B",
        "sequence": "WT_MPRO_SEQUENCE"
      }
    },
    {
      "ligand": {
        "id": "C",
        "smiles": "INHIBITOR_SMILES"
      }
    }
  ],
  "dialect": "alphafold3",
  "version": 4
}
```

Mutant는 A와 B 모두 동일한 mutant sequence로 입력한다.

## 8.4 Seed 전략

MVP:

```text
5 seeds × 1 diffusion sample
```

정밀 모드:

```text
10–20 seeds
```

후보 최종 검증:

```text
상위 후보에만 seed 수 확대
```

## 8.5 Job 큐

필수 기능:

- 대기
- 실행 중
- 부분 완료
- 완료
- 실패
- 재시도
- 취소
- 로그 보기
- 예상 계산량 표시
- 결과 폴더 경로 표시

## 8.6 저장 결과

억제제별:

```text
input.json
model.cif
summary_confidences.json
confidences.json
ranking_scores.csv
run_metadata.json
stdout.log
stderr.log
```

## 8.7 결과 데이터 모델

```ts
interface Af3PredictionRecord {
  predictionId: string;
  jobId: string;
  inhibitorId: string;
  targetType: 'wt' | 'mutant';
  seed: number;
  status: 'queued' | 'running' | 'completed' | 'failed';

  structureFilePath?: string;
  summaryFilePath?: string;

  rankingScore?: number | null;
  iptm?: number | null;
  ptm?: number | null;
  ligandIptm?: number | null;
  ligandPae?: number | null;
  hasClash?: boolean | null;

  createdAt: string;
  completedAt?: string;
}
```

## 8.8 완료 조건

- 선택된 모든 후보의 WT/Mutant 구조가 생성됨
- 결과 파일이 저장됨
- 각 결과가 inhibitor ID, target type, seed와 연결됨
- 실패한 결과는 원인과 함께 표시됨

---

# 9. 6단계 — 변이 전후 상호작용 비교

## 9.1 목적

WT와 mutant 복합체를 정렬하여 변이가 억제제 상호작용에 어떤 구조적 차이를 만들었는지 분석한다.

## 9.2 전처리

- WT와 mutant의 단백질 backbone 정렬
- 동일 억제제의 ligand atom mapping
- chain A/B 중 실제 ligand가 결합한 포켓 확인
- 비정상 포켓 배치 제거
- 심한 clash 결과 제외
- seed 간 포즈 일관성 계산

## 9.3 분석 항목

### 단백질 구조

- backbone RMSD
- 활성 포켓 RMSD
- 변이 잔기 주변 RMSD
- pocket volume 변화
- solvent accessible surface area 변화
- 주요 side-chain rotamer 변화
- dimer interface 변화

### 리간드 구조

- ligand RMSD after protein alignment
- ligand center displacement
- ligand orientation change
- pocket occupancy
- seed별 pose consistency

### 상호작용

- 수소결합 유지
- 수소결합 소실
- 새 수소결합
- 소수성 접촉 유지·소실
- salt bridge
- π–π interaction
- π–cation interaction
- halogen interaction
- steric clash
- 물 매개 상호작용은 데이터가 있을 때만 표시

### 공유결합 계열 추가 항목

- Cys145 sulfur–warhead 거리
- 접근 각도
- pre-reaction pose 일관성
- Cys145 주변 clash
- warhead orientation 변화

## 9.4 interaction fingerprint

억제제별 WT와 mutant fingerprint를 만든다.

```ts
interface ResidueInteraction {
  residueId: string;
  residueName: string;
  chainId: string;

  interactionTypes: (
    | 'hydrogen_bond'
    | 'hydrophobic'
    | 'salt_bridge'
    | 'pi_stacking'
    | 'pi_cation'
    | 'halogen'
    | 'steric_clash'
    | 'covalent_geometry'
  )[];

  ligandAtomIds: number[];
  distance?: number | null;
}
```

## 9.5 비교 결과

```ts
interface InteractionComparisonRecord {
  inhibitorId: string;
  wtPredictionId: string;
  mutantPredictionId: string;

  retainedInteractions: ResidueInteraction[];
  lostInteractions: ResidueInteraction[];
  gainedInteractions: ResidueInteraction[];
  clashInteractions: ResidueInteraction[];

  ligandRmsd?: number | null;
  pocketRmsd?: number | null;
  poseConsistency?: number | null;

  structuralResistanceRisk:
    | 'low'
    | 'moderate'
    | 'high'
    | 'unresolved';

  interpretation: string[];
}
```

## 9.6 UI

### 좌우 3D 비교

왼쪽:

```text
WT Mpro + inhibitor
```

오른쪽:

```text
Mutant Mpro + inhibitor
```

동기화 기능:

- 회전 동기화
- 확대 동기화
- 동일 잔기 강조
- ligand 표시
- mutation 표시
- active site 표시

### 중앙 변화 패널

- Lost
- Retained
- Gained
- Clash
- Covalent geometry

### WT/Mutant overlay

- WT ligand: 반투명
- mutant ligand: 실색
- 변이 잔기: 강조
- 소실된 interaction: 빨간 점선
- 새 interaction: 파란 점선

## 9.7 결과 표현

잘못된 표현:

```text
결합 실패
약효 소실
내성 확정
```

권장 표현:

```text
WT 대비 수소결합 2개 소실
Mutant 구조에서 ligand pose 이동 관찰
E166 주변 입체 충돌 가능성
구조 기반 내성 위험 높음
실험적 IC50 변화 확인 필요
```

## 9.8 완료 조건

- 모든 WT/Mutant 쌍에 interaction comparison 생성
- 변화 유형이 구조적으로 시각화됨
- resistance risk에는 근거 목록이 있음
- AF3 confidence가 낮은 결과는 `unresolved` 처리

---

# 10. 7단계 — 억제제 구조변경 후보 생성

## 10.1 목적

변이로 소실된 상호작용을 보완할 수 있는 제한적이고 설명 가능한 구조변경 후보를 생성한다.

이 단계는 새로운 약물을 자동 설계하는 기능이 아니라 다음을 수행한다.

```text
소실 interaction 확인
→ 관련 ligand atom 및 부분구조 확인
→ 수정 가능한 R-group 위치 선정
→ 제한된 fragment 교체
→ 후보 구조 생성
```

## 10.2 구현 방식

MVP에서는 생성형 AI보다 RDKit 기반 규칙형 접근을 우선한다.

사용 가능 방식:

- BRICS fragmentation
- RECAP fragmentation
- R-group decomposition
- matched molecular pair transformation
- 사전 정의 fragment library
- pharmacophore-based substitution
- scaffold 고정 후 substituent 교체

## 10.3 보호해야 할 구조

다음 영역은 기본적으로 고정한다.

- core scaffold
- 알려진 warhead
- 주요 chiral center
- WT에서 유지되는 핵심 interaction 관련 원자
- 합성 가능성이 알려진 핵심 골격

## 10.4 수정 가능 위치 선정 규칙

수정 후보 위치:

- mutant에서 interaction을 잃은 ligand atom 주변
- 심한 clash를 만든 말단 substituent
- solvent-exposed group
- WT/Mutant 모두 interaction이 없는 peripheral group

수정 금지 또는 경고:

- 공유결합 warhead 직접 제거
- 모든 chiral center 무작위 변경
- scaffold 전체 교체
- formal charge 급격한 변화
- 알려진 독성 구조 추가
- 반응성이 과도한 electrophile 추가

## 10.5 후보 생성 수 제한

MVP 기준:

```text
억제제 1개당 최대 10개
```

고급 모드:

```text
최대 50개 생성
→ 빠른 필터 후 상위 5개만 정밀 계산
```

## 10.6 후보 데이터 모델

```ts
interface OptimizedCandidate {
  candidateId: string;
  parentInhibitorId: string;

  smiles: string;
  canonicalSmiles: string;

  modifiedAtomIds: number[];
  modificationType:
    | 'r_group_replacement'
    | 'fragment_replacement'
    | 'linker_change'
    | 'functional_group_addition'
    | 'functional_group_removal';

  rationale: string[];
  expectedRecoveredInteraction: string[];

  syntheticAccessibility?: number | null;
  structuralAlerts: string[];
}
```

## 10.7 2D UI

화면 구성:

- Parent inhibitor 2D 구조
- 소실 interaction 관련 원자 빨간 하이라이트
- 수정 위치 주황 하이라이트
- 생성 후보 2D 구조
- 변경 전후 atom mapping
- 변경 이유
- 예상 복원 interaction
- 구조 경고

SMILES 문자열 글자 자체를 주된 시각화로 사용하지 않는다.  
RDKit 2D molecular graph에서 atom ID 기준으로 하이라이트한다.

## 10.8 완료 조건

- 후보마다 parent 구조가 연결됨
- 어떤 원자를 왜 변경했는지 표시됨
- 변경 후 SMILES가 유효함
- 중복 후보가 제거됨
- 합성 가능성 및 구조 경고가 포함됨

---

# 11. 8단계 — 변경 후보의 독성·비강 적합성 재평가

## 11.1 목적

구조변경으로 인한 독성, 용해도, 투과성, 비강 적합성 악화를 AF3 재계산 전에 제거한다.

## 11.2 원본 대비 변화량 표시

후보별로 parent와 delta를 보여준다.

```text
ΔMW
ΔTPSA
ΔcLogP
Δsolubility
ΔhERG risk
ΔAmes risk
ΔDILI risk
ΔCYP burden
Δsynthetic accessibility
```

## 11.3 Hard filter

다음은 자동 보류 또는 탈락 조건으로 사용할 수 있다.

- invalid SMILES
- valence error
- 과도한 formal charge
- 반응성 독성 경고 증가
- 모델 다수에서 높은 독성 위험
- 극단적으로 낮은 예측 용해도
- 원본 대비 비강 적합성 현저히 악화
- synthetic accessibility 기준 초과
- 분자량 상한 초과
- 동일 후보 중복

단, 내부 기준값은 설정 파일에서 수정 가능해야 한다.

```json
{
  "maxMolecularWeight": 700,
  "maxTpsa": 180,
  "maxClogp": 6,
  "maxSyntheticAccessibility": 7,
  "highRiskProbability": 0.65,
  "moderateRiskProbability": 0.35
}
```

이 값은 임상 합격 기준이 아니라 프로젝트 내부 후보 정렬 기준임을 표시한다.

## 11.4 Soft ranking

Hard filter 통과 후보를 다음 축으로 정렬한다.

- 독성 위험 감소
- 비강 적합성 유지 또는 개선
- 예상 상호작용 복원 가능성
- parent scaffold 보존
- 합성 가능성
- 구조 단순성

## 11.5 UI

후보 비교 카드:

```text
Parent vs Candidate
2D overlay
Toxicity delta
Nasal property delta
Structural alerts
Pass / Review / Hold
```

## 11.6 완료 조건

- 모든 생성 후보가 재스크리닝됨
- parent 대비 변화량이 표시됨
- AF3 재예측 대상이 선택됨
- 제외 이유가 저장됨

---

# 12. 9단계 — 통과 후보만 AF3 재예측

## 12.1 목적

재평가를 통과한 구조변경 후보가 실제로 mutant Mpro 포켓에서 더 일관된 구조적 상호작용을 만드는지 확인한다.

## 12.2 예측 대상

필수:

```text
Mutant Mpro dimer + optimized candidate
```

선택:

```text
WT Mpro dimer + optimized candidate
```

WT 재예측은 다음을 확인할 때 사용한다.

- mutant에만 선택적으로 맞는지
- WT 결합 포즈를 과도하게 잃는지
- parent 대비 전체 상호작용 패턴이 어떻게 바뀌는지

## 12.3 Seed 전략

빠른 필터:

```text
3–5 seeds
```

상위 후보 정밀 검증:

```text
10–20 seeds
```

## 12.4 비교 항목

```text
Parent inhibitor + Mutant Mpro
vs
Optimized candidate + Mutant Mpro
```

확인 지표:

- 동일 포켓 배치 비율
- ligand pose consistency
- lost interaction recovery
- new clash 발생 여부
- ligand PAE
- chain-pair ipTM
- pocket interaction fingerprint
- Cys145–warhead geometry
- ligand RMSD
- pocket RMSD
- seed별 결과 분산

## 12.5 개선 판정

다음 세 축을 분리한다.

```ts
interface ImprovementAssessment {
  structuralInteractionRecovery:
    | 'improved'
    | 'similar'
    | 'worsened'
    | 'unresolved';

  toxicityNasalProfile:
    | 'improved'
    | 'similar'
    | 'worsened'
    | 'unresolved';

  predictionConfidence:
    | 'high'
    | 'moderate'
    | 'low';

  reasons: string[];
}
```

하나의 종합점수만으로 개선을 확정하지 않는다.

## 12.6 완료 조건

- 후보별 mutant AF3 결과 생성
- parent 대비 interaction recovery 비교 완료
- AF3 confidence가 낮은 후보는 개선 판정 보류
- 최종 후보 테이블에 전달됨

---

# 13. 10단계 — 최종 비교

## 13.1 목적

기존 억제제와 변경 후보를 구조, 독성, 비강 적합성, 근거 수준으로 비교한다.

## 13.2 최종 비교 축

### 구조적 분석

- AF3 confidence
- ligand pose consistency
- retained interactions
- recovered interactions
- clash
- covalent geometry
- WT–Mutant ligand RMSD
- parent–optimized ligand RMSD

### 독성

- Ames
- hERG
- DILI
- ClinTox
- CYP burden
- structural alerts

### 비강 적합성

- MW
- TPSA
- cLogP/logD
- solubility
- pKa
- permeability risk
- P-gp risk
- formulation difficulty
- local toxicity evidence gap

### 개발 가능성

- synthetic accessibility
- scaffold complexity
- chiral center 수
- reactive group
- known development evidence
- evidence confidence

## 13.3 최종 상태

```text
Top structural candidate
Top nasal-feasibility candidate
Balanced candidate
High-risk candidate
Insufficient evidence
```

“최고 약물” 한 개만 고르지 않는다.

## 13.4 최종 테이블

```text
Candidate
Parent
Type
Structural confidence
Interaction retention
Resistance risk
Toxicity risk
Nasal feasibility
Synthetic accessibility
Evidence confidence
Final category
```

## 13.5 Pareto 방식 표시

두 개 이상의 목표가 충돌하므로 다음 차트를 제공한다.

- X축: structural interaction recovery
- Y축: nasal feasibility
- 점 크기: toxicity risk inverse
- 점 테두리: evidence confidence

## 13.6 최종 결론 문구

예시:

```text
Candidate-A는 mutant Mpro에서 parent 대비 소실된 H163 상호작용이
구조적으로 복원되는 포즈가 반복 seed에서 관찰되었다.

다만 비강 국소독성, 실제 세포 내 농도 및 Mpro 억제 활성은
계산 결과로 확정할 수 없으며 HNE-ALI 및 효소·세포 기반 검증이 필요하다.
```

## 13.7 완료 조건

- 기존 억제제와 변경 후보가 동일한 기준으로 비교됨
- 구조 점수와 독성·제형 점수가 분리됨
- 최종 카테고리와 근거가 표시됨
- 연구 한계가 명시됨

---

# 14. 대시보드 고도화

## 14.1 KPI 카드

- 총 분석 Job 수
- 완료 Job 수
- 실행 중 Job 수
- 입력된 변이 수
- 1차 스크리닝 통과 후보 수
- AF3 완료 구조 수
- 생성된 최적화 후보 수
- 최종 검토 후보 수

## 14.2 최근 분석

컬럼:

```text
Job ID
Mutation
Selected inhibitors
Screening status
AF3 progress
Optimization status
Updated at
```

## 14.3 워크플로우 진행률

```text
1. Sequence
2. Mutation
3. Screening
4. AF3
5. Interaction
6. Optimization
7. Reevaluation
8. Final
```

각 단계에 다음 상태 표시:

```text
not_started
ready
running
completed
failed
```

## 14.4 시스템 상태

- AF3 Ubuntu server
- GPU
- ADMET service
- RDKit service
- DB
- job queue
- storage free space

---

# 15. 백엔드 아키텍처

## 15.1 권장 서비스 분리

```text
React Frontend
    ↓
Node/Express API Gateway
    ├── Analysis Service
    ├── Sequence/Mutation Service
    ├── Screening Service
    ├── AF3 Job Service
    ├── Interaction Analysis Service
    ├── Optimization Service
    └── Report Service
         ↓
Python Scientific Workers
    ├── RDKit Worker
    ├── ADMET-AI Worker
    ├── Structure Analysis Worker
    └── AF3 Ubuntu Engine
```

## 15.2 로컬 MVP

처음에는 다음 구조로도 충분하다.

```text
server/index.js
server/services/
├── toxicityService.js
├── nasalService.js
├── af3Service.js
├── interactionService.js
└── optimizationService.js

scripts/
├── toxicity_screening.py
├── nasal_screening.py
├── interaction_analysis.py
└── generate_derivatives.py
```

## 15.3 Job Queue

권장:

- MVP: 인메모리 + 파일 저장
- 고도화: BullMQ + Redis
- 과학 계산 worker는 별도 process

필수 기능:

- job retry
- timeout
- partial completion
- cancellation
- progress event
- result persistence
- log persistence

---

# 16. 데이터베이스 설계

SQLite 또는 PostgreSQL을 사용할 수 있다.

## 16.1 주요 테이블

```text
analysis_jobs
sequence_inputs
mutations
inhibitors
screening_runs
screening_results
af3_runs
af3_models
interaction_results
optimization_runs
optimized_candidates
candidate_screening_results
final_rankings
evidence_references
audit_logs
```

## 16.2 파일 저장

DB에는 경로와 메타데이터만 저장하고 큰 구조 파일은 파일시스템에 저장한다.

```text
storage/
└── jobs/
    └── AF3-MPRO-123456/
        ├── input/
        ├── screening/
        ├── af3/
        │   ├── wt/
        │   └── mutant/
        ├── interaction/
        ├── optimization/
        ├── reevaluation/
        └── report/
```

---

# 17. 필수 API 목록

## 분석

```http
POST   /api/analysis
GET    /api/analysis/:jobId
DELETE /api/analysis/:jobId
POST   /api/analysis/:jobId/cancel
```

## 서열·변이

```http
POST /api/sequence/validate
POST /api/mutation/detect
GET  /api/mutation/:jobId
```

## 억제제

```http
GET  /api/inhibitors
GET  /api/inhibitors/:id
POST /api/inhibitors/validate-smiles
```

## 스크리닝

```http
POST /api/screening/:jobId/run
GET  /api/screening/:jobId
POST /api/screening/:jobId/select
```

## AF3

```http
POST /api/af3/:jobId/submit
GET  /api/af3/:jobId/status
GET  /api/af3/:jobId/results
POST /api/af3/:jobId/retry
POST /api/af3/:jobId/cancel
```

## 상호작용

```http
POST /api/interaction/:jobId/run
GET  /api/interaction/:jobId
GET  /api/interaction/:jobId/:inhibitorId
```

## 최적화

```http
POST /api/optimization/:jobId/generate
GET  /api/optimization/:jobId
POST /api/optimization/:jobId/select
```

## 재평가

```http
POST /api/reevaluation/:jobId/run
GET  /api/reevaluation/:jobId
```

## 최종 결과

```http
GET /api/final-ranking/:jobId
GET /api/report/:jobId
```

---

# 18. 공통 UI 컴포넌트

재사용 컴포넌트:

```text
ResearchUseOnlyBanner
WorkflowStepper
JobStatusPill
EvidenceConfidenceBadge
RiskBadge
EmptyState
LoadingState
ErrorState
MetricCard
Molecule2DViewer
Structure3DViewer
SequenceAlignmentViewer
MutationBadge
InteractionChangePanel
ScreeningDecisionCard
CandidateComparisonCard
ModelSourceBadge
DownloadResultButton
```

---

# 19. 오류 및 예외 처리

## 19.1 입력 오류

- invalid FASTA
- invalid mutation notation
- WT residue mismatch
- unsupported insertion/deletion
- invalid SMILES
- duplicate candidate

## 19.2 계산 오류

- ADMET-AI unavailable
- RDKit error
- AF3 server unreachable
- GPU memory error
- AF3 timeout
- output file missing
- summary JSON malformed
- structure alignment failure
- ligand atom mapping failure

## 19.3 UI 원칙

오류 발생 시 임의 결과를 채우지 않는다.

예:

```text
AF3 결과 파일이 생성되지 않았습니다.
서버 로그와 output 폴더를 확인한 뒤 재시도하세요.
```

---

# 20. 보고서 출력

최종 보고서는 다음 섹션을 포함한다.

1. 분석 정보
2. 입력 서열
3. WT 대비 변이
4. 16종 억제제 목록
5. 1차 독성 스크리닝
6. 비강 적합성 스크리닝
7. AF3 실행 설정
8. WT 구조 결과
9. Mutant 구조 결과
10. 상호작용 비교
11. 구조변경 후보
12. 재평가 결과
13. AF3 재예측 결과
14. 최종 비교
15. 한계
16. 필요한 실험 검증
17. 데이터 및 모델 출처

다운로드 형식:

- CSV
- JSON
- ChimeraX command script
- mmCIF
- Markdown report
- PDF는 추후 확장

---

# 21. 필요한 실험 검증 항목 표시

플랫폼 최종 화면에 계산 이후 필요한 실험을 명확히 보여준다.

## 효소 수준

- Mpro IC50
- Ki
- 공유결합 억제제의 kinact/KI

## 세포 수준

- antiviral EC50
- EC90
- CC50
- selectivity index
- intracellular concentration

## 비강 상피

- HNE-ALI efficacy
- TEER
- ciliary beat frequency
- IL-6
- IL-8
- 반복투여 독성
- 후각상피 안전성

## 제형

- 실제 수용해도
- pH 안정성
- 삼투압
- 점도
- spray content uniformity
- droplet size distribution
- spray pattern
- plume geometry

---

# 22. 구현 우선순위

## Phase 1 — 기존 플랫폼 정리

- 16종 억제제 통합
- 라우트 정리
- 공통 Job 상태 정리
- 더미 수치 제거 확인
- 파일 저장 구조 정리

완료 기준:

```text
기존 AF3 결합 예측이 16종 기준으로 정상 동작
```

## Phase 2 — 독성·비강 1차 스크리닝

- ADMET-AI 실행
- RDKit descriptor
- 비강 적합성 규칙
- `/screening` 페이지
- 결과 저장
- 후보 선택

완료 기준:

```text
16종을 screening하고 AF3 실행 대상을 선택 가능
```

## Phase 3 — WT/Mutant 이중 AF3

- WT cache
- mutant prediction
- queue
- progress
- 결과 연결

완료 기준:

```text
한 억제제에 대해 WT와 Mutant 구조를 모두 생성하고 조회 가능
```

## Phase 4 — 상호작용 비교

- structure alignment
- ligand mapping
- interaction fingerprint
- lost/retained/gained/clash
- 3D overlay

완료 기준:

```text
변이 전후 상호작용 변화가 자동으로 표와 3D에 표시
```

## Phase 5 — 구조변경 후보 생성

- atom highlighting
- R-group replacement
- fragment library
- 후보 최대 10개
- 중복 제거
- SA score

완료 기준:

```text
변경 이유가 설명되는 유효 SMILES 후보 생성
```

## Phase 6 — 재평가

- parent–candidate delta
- hard filter
- soft ranking
- AF3 대상 선택

완료 기준:

```text
변경 후보 중 재예측 대상만 선별
```

## Phase 7 — AF3 재예측 및 최종 비교

- optimized candidate prediction
- parent comparison
- final ranking
- report

완료 기준:

```text
기존 억제제와 변경 후보가 동일한 표에서 비교
```

---

# 23. Antigravity 구현 지시문

아래 요구사항을 기존 프로젝트에 단계적으로 반영한다.

## 공통 지시

1. 기존 React + TypeScript + Vite + Tailwind 구조를 유지한다.
2. 기존 Node.js/Express 서버를 API Gateway로 유지한다.
3. 과학 계산은 Python script 또는 Python worker로 분리한다.
4. 실제 계산 결과가 없으면 임의 값을 생성하지 않는다.
5. 모든 페이지에 Research Use Only 안내를 유지한다.
6. 모바일보다 데스크톱 연구 대시보드 사용성을 우선한다.
7. 한 번에 전체 기능을 구현하지 말고 Phase별로 빌드 가능한 상태를 유지한다.
8. 각 Phase 완료 후 `npm run build`가 통과해야 한다.
9. API 에러, 빈 상태, 로딩 상태를 모든 화면에 구현한다.
10. 기존 AF3 서버 연결 코드와 output polling 로직을 재사용한다.

## 첫 번째 구현 작업

다음 기능부터 구현한다.

```text
1. WorkflowStepper 공통 컴포넌트
2. /screening 페이지
3. 독성 결과 + 비강 적합성 결과 통합 테이블
4. 16종 후보 선택 기능
5. 선택 후보를 /prediction 단계로 전달
6. analysisJob에 screening 결과 저장
```

## 두 번째 구현 작업

```text
1. WT AF3 prediction cache
2. Mutant AF3 prediction
3. inhibitor별 WT/Mutant pair 연결
4. 진행률 UI
5. 부분 완료 결과 표시
```

## 세 번째 구현 작업

```text
1. interaction analysis Python script
2. interaction fingerprint JSON
3. WT/Mutant 3D side-by-side viewer
4. lost/retained/gained/clash table
5. ligand 2D atom highlighting
```

## 네 번째 구현 작업

```text
1. RDKit R-group replacement
2. 후보 최대 10개 생성
3. parent–candidate 구조 비교
4. 재스크리닝
5. 통과 후보 AF3 재예측
6. final-ranking 페이지
```

---

# 24. 최종 성공 기준

플랫폼이 다음 시나리오를 처음부터 끝까지 수행할 수 있어야 한다.

```text
사용자가 E166V Mpro 서열 입력
→ WT 대비 E166V 검출
→ 16종 억제제 screening
→ 후보 5개 선택
→ WT/Mutant AF3 예측
→ E166 주변 상호작용 소실 확인
→ 해당 ligand atom 2D 하이라이트
→ R-group 변경 후보 생성
→ 독성·비강 재스크리닝
→ 상위 후보 AF3 재예측
→ parent 대비 구조적 interaction recovery 비교
→ 최종 보고서 출력
```

최종 화면은 다음 질문에 답할 수 있어야 한다.

1. 어떤 Mpro 변이가 입력되었는가?
2. 이 변이는 활성 부위와 얼마나 관련 있는가?
3. 16개 억제제 중 어떤 후보가 계산 우선순위가 높은가?
4. WT와 mutant에서 억제제 포즈가 어떻게 달라졌는가?
5. 어떤 상호작용이 유지·소실·새로 형성되었는가?
6. 어느 ligand atom 또는 부분구조가 변화와 관련 있는가?
7. 어떤 구조변경 후보가 생성되었는가?
8. 변경 후보의 독성·비강 물성이 악화되었는가?
9. 재예측에서 구조적 상호작용이 회복되었는가?
10. 어떤 추가 실험이 필요한가?

---

# 25. 최종 안내 문구

플랫폼 전체 하단에 다음 문구를 고정 표시한다.

> 본 플랫폼은 AlphaFold 3, cheminformatics 및 ADMET 예측 모델을 이용한 연구·교육용 인실리코 후보 탐색 도구입니다. 예측 구조와 계산 점수는 실제 결합 친화도, 항바이러스 효과, 독성, 임상 안전성 또는 비강 투여 가능성을 확정하지 않습니다. 모든 결과는 효소·세포·비강 상피·동물 및 임상 검증이 필요합니다.
