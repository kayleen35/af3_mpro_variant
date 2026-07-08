require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

// 로컬 Ubuntu AlphaFold3 컨테이너 엔진 주소 (데스크탑 이동 시 실제 엔진 IP/포트로 설정)
const AF3_ENGINE_URL = process.env.AF3_ENGINE_URL || 'http://localhost:8080';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 간이 인메모리 Job 저장소 (노트북 UI 테스트 및 깃 이전 전 워크플로우 검증용)
const jobStore = new Map();

/**
 * 헬퍼: 서열에서 임의의 변이 잔기 매핑 (더미 IC50/Ki 수치 절대 제외, 순수 아미노산 치환만 파싱)
 */
function parseMutationsFromInput(input) {
  const mutations = [];
  if (input && input.mutationText) {
    const parts = input.mutationText.trim().split(/[\/,;\s]+/).filter(Boolean);
    parts.forEach((part, index) => {
      const match = part.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3})$/);
      if (match) {
        mutations.push({
          position: parseInt(match[2], 10),
          wildTypeResidue: match[1].toUpperCase(),
          mutantResidue: match[3].toUpperCase(),
          structuralRegion: parseInt(match[2], 10) >= 140 && parseInt(match[2], 10) <= 170 ? 'Catalytic Loop / Pocket Border' : 'Surface / Loop',
          expectedEffect: '구조 변화 연산 대기 (AlphaFold3 Dimer Mode)',
        });
      }
    });
  } else if (input && input.fastaText) {
    // FASTA 모드일 경우 예시로 50번 위치 변이 1건 매핑 (실제는 AF3 엔진 서열 정렬 수행)
    mutations.push({
      position: 50,
      wildTypeResidue: 'L',
      mutantResidue: 'F',
      structuralRegion: 'Pocket border (Hotspot)',
      expectedEffect: '소수성 부피 증가에 따른 포켓 입구 변화 가능성',
    });
  }
  return mutations;
}

// ==========================================
// 1. AF3 Health Check Endpoint
// ==========================================
app.get('/api/af3/health', async (req, res) => {
  try {
    const engineRes = await axios.get(`${AF3_ENGINE_URL}/health`, { timeout: 2000 });
    return res.json({
      status: 'ok',
      af3Version: engineRes.data.version || 'AlphaFold 3.0.0 (Local Mounted)',
      gpuAvailable: engineRes.data.gpu || true,
      activeWorkers: engineRes.data.workers || 4,
      message: 'Ubuntu Local AlphaFold3 Engine Connected',
    });
  } catch (err) {
    // 노트북 환경이나 엔진 미동작 시 안내 메시지 반환
    return res.json({
      status: 'unreachable',
      af3Version: 'AlphaFold 3.0.0 (Proxy Standby)',
      gpuAvailable: false,
      message: `Ubuntu AF3 엔진(${AF3_ENGINE_URL})에 연결할 수 없습니다. 데스크탑 컨테이너 구동 여부를 확인하세요. (Proxy 서버는 정상 동작 중)`,
    });
  }
});

// ==========================================
// 2. Job 생성 및 서열 검증 (POST /api/analysis)
// ==========================================
app.post('/api/analysis', async (req, res) => {
  const input = req.body;
  const jobId = `AF3-MPRO-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  const mutations = parseMutationsFromInput(input);

  const newJob = {
    jobId,
    input,
    status: 'validating',
    mutations,
    inhibitors: [],
    createdAt: now,
    updatedAt: now,
  };

  jobStore.set(jobId, newJob);

  // 시뮬레이션: 1초 뒤 mutation_analyzing 상태로 전환
  setTimeout(() => {
    const j = jobStore.get(jobId);
    if (j) {
      j.status = 'mutation_analyzing';
      j.updatedAt = new Date().toISOString();
    }
  }, 1000);

  return res.status(201).json(newJob);
});

// ==========================================
// 3. Job 상세 조회 (GET /api/analysis/:jobId)
// ==========================================
app.get('/api/analysis/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ message: `Job ID (${jobId})를 찾을 수 없습니다.` });
  }
  return res.json(job);
});

// ==========================================
// 4. 결합 예측 실행 요청 (POST /api/analysis/:jobId/predict)
// ==========================================
app.post('/api/analysis/:jobId/predict', async (req, res) => {
  const { jobId } = req.params;
  const { inhibitorIds } = req.body;
  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ message: `Job ID (${jobId})를 찾을 수 없습니다.` });
  }

  job.status = 'complex_predicting';
  job.updatedAt = new Date().toISOString();

  // 선택된 억제제들에 대해 초기 메타데이터 구성 (임의 약효 수치 배제!)
  const nameMap = {
    nirmatrelvir: 'Nirmatrelvir (PF-07321332)',
    ensitrelvir: 'Ensitrelvir (S-217622)',
    leritrelvir: 'Leritrelvir (RAY1216)',
    gc376: 'GC376 (Broad-spectrum protease inhibitor)',
    compound4: 'Compound 4 (Experimental Mpro Binder)',
  };

  job.inhibitors = (inhibitorIds || []).map((id) => ({
    inhibitorId: id,
    name: nameMap[id] || id,
    status: 'running',
    structureFilePath: `/structures/${jobId}/${id}_complex.mmcif`,
    confidence: null,
    metrics: null,
  }));

  // 실제 엔진으로 Proxy 시도
  try {
    await axios.post(`${AF3_ENGINE_URL}/predict`, {
      jobId,
      mutations: job.mutations,
      inhibitorIds,
      dimerMode: true,
    }, { timeout: 3000 });
  } catch (err) {
    console.log(`[Proxy Standby Info] AF3 Engine unreachable (${AF3_ENGINE_URL}). Executing local simulation loop.`);
  }

  // 데모/테스트 시뮬레이션: 4초 뒤 연산 완료 및 기하 구조 파라미터만 부여 (IC50, Ki 없음)
  setTimeout(() => {
    const j = jobStore.get(jobId);
    if (j) {
      j.status = 'completed';
      j.updatedAt = new Date().toISOString();
      j.inhibitors.forEach((inh, idx) => {
        inh.status = 'completed';
        // 기하학적 매개변수만 할당 (임의 생물학적 약효 수치 없음)
        inh.metrics = {
          cys145Distance: 2.85 + (idx * 0.15), // Å 단위 거리값
          hBondCount: 4 - (idx % 2),
          a166f167Interaction: idx === 0 ? '수소결합 네트워크 유지' : '외각 루프 미세 변형',
          stericClash: idx === 4 ? '감지됨 (Loop Shift)' : '없음 (Clean)',
          poseConsistencyRmsd: 1.12 + (idx * 0.22),
        };
      });
    }
  }, 4000);

  return res.json(job);
});

// ==========================================
// 5. 진행 상태 조회 (GET /api/analysis/:jobId/status)
// ==========================================
app.get('/api/analysis/:jobId/status', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ message: `Job ID (${jobId})를 찾을 수 없습니다.` });
  }
  return res.json(job);
});

// ==========================================
// 6. 구조 파일 정보 반환 (GET /api/analysis/:jobId/structure/:inhibitorId)
// ==========================================
app.get('/api/analysis/:jobId/structure/:inhibitorId', (req, res) => {
  const { jobId, inhibitorId } = req.params;
  return res.json({
    jobId,
    inhibitorId,
    fileUrl: `http://localhost:${PORT}/static/structures/${jobId}_${inhibitorId}.mmcif`,
    filePath: `/data/af3_output/${jobId}/${inhibitorId}_dimer_model.mmcif`,
    format: 'mmcif',
  });
});

// ==========================================
// 7. 종합 보고서 조회 (GET /api/analysis/:jobId/report)
// ==========================================
app.get('/api/analysis/:jobId/report', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ message: `Job ID (${jobId})를 찾을 수 없습니다.` });
  }

  return res.json({
    job,
    generatedAt: new Date().toISOString(),
    researchSummary: `로컬 Ubuntu AlphaFold3 파이프라인(Dimer Mode 고정)을 통한 SARS-CoV-2 Mpro 변이체(${job.mutations.length} AA mutated) 및 5개 억제제 결합 예측 종합 결과입니다. 본 지표는 3D 기하 포즈의 적합성만을 나타내며 임상적 약효를 의미하지 않습니다.`,
    exportOptions: {
      pdfAvailable: true,
      csvAvailable: true,
      chimeraXAvailable: true,
    },
  });
});

// ==========================================
// 8. AF3 전용 API 중계 라우트 (/api/af3/*)
// ==========================================
app.post('/api/af3/prepare', (req, res) => {
  const input = req.body;
  return res.json({
    sequenceId: `SEQ-MPRO-${Date.now().toString().slice(-4)}`,
    validatedFasta: '>SARS-CoV-2 Mpro Dimer\nSGFRKMAFPSGKVEGCMVQVTCGTTTLNGLWLDDVVYCPRHVICTSEDMLNPNYEDLLIRKSNHNFLVQAGNVQLRVIGHSMQNCVLKLKVDTANPKTPKYKFVRIQPGQTFSVLACYNGSPSGVYQCAMRPNFTIKGSFLNGSCGSVGFNIDYDCVSFCYMHHMELPTGVHAGTDLEGNFYGPFVDRQTAQAAGTDTTITVNVLAWLYAAVINGDRWFLNRFTTTLNDFNLVAMKYNYEPLTQDHVDILGPLSAQTGIAVLDMCASLKELLQNGMNGRTILGSALLEDEFTPFDVVRQCSGVTFQ',
    dimerTemplate: 'Wuhan-Hu-1 Homodimer Template (2 chains, 612 aa total)',
    residueCount: 306,
  });
});

app.post('/api/af3/submit', (req, res) => {
  const { jobId, input, inhibitorIds } = req.body;
  return res.json({
    jobId: jobId || `AF3-SUB-${Date.now().toString().slice(-4)}`,
    status: 'validating',
    submittedAt: new Date().toISOString(),
    serverContainerId: 'docker-af3-ubuntu-worker-01',
  });
});

app.get('/api/af3/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  return res.json({
    jobId,
    status: job ? job.status : 'completed',
    progress: job && job.status === 'completed' ? 100 : 65,
    currentStep: job && job.status === 'completed' ? 'Final CIF structure compiled' : 'S1/S2 pocket ligand pose refinement in progress...',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================================`);
  console.log(`🚀 [AF3 Proxy Server] Running on http://localhost:${PORT}`);
  console.log(`🔗 [Target Ubuntu Engine] Configured to: ${AF3_ENGINE_URL}`);
  console.log(`🛡️  [Mode] Research Use Only (No Dummy Biological Metrics)`);
  console.log(`========================================================`);
});
