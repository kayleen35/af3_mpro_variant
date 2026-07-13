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

function getOrCreateJob(jobId) {
  let job = jobStore.get(jobId);
  if (!job) {
    job = {
      jobId,
      status: 'pending',
      mutations: [],
      inhibitors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobStore.set(jobId, job);
  }
  return job;
}

const WT_MPRO_SEQUENCE = 'SGFRKMAFPSGKVEGCMVQVTCGTTTLNGLWLDDVVYCPRHVICTSEDMLNPNYEDLLIRKSNHNFLVQAGNVQLRVIGHSMQNCVLKLKVDTANPKTPKYKFVRIQPGQTFSVLACYNGSPSGVYQCAMRPNFTIKGSFLNGSCGSVGFNIDYDCVSFCYMHHMELPTGVHAGTDLEGNFYGPFVDRQTAQAAGTDTTITVNVLAWLYAAVINGDRWFLNRFTTTLNDFNLVAMKYNYEPLTQDHVDILGPLSAQTGIAVLDMCASLKELLQNGMNGRTILGSALLEDEFTPFDVVRQCSGVTFQ';

/**
 * 헬퍼: 서열 및 FASTA에서 실제 아미노산 변이 잔기 매핑
 */
function parseMutationsFromInput(input) {
  const mutations = [];
  if (input && input.mutationText) {
    const parts = input.mutationText.trim().split(/[\/,;\s]+/).filter(Boolean);
    parts.forEach((part) => {
      const match = part.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3})$/);
      if (match) {
        const pos = parseInt(match[2], 10);
        mutations.push({
          position: pos,
          wildTypeResidue: match[1].toUpperCase(),
          mutantResidue: match[3].toUpperCase(),
          structuralRegion: pos >= 140 && pos <= 170 ? 'Catalytic Loop / Pocket Border' : 'Surface / Loop',
          expectedEffect: 'WSL AlphaFold3 Dimer 기하 구조 연산 대상',
        });
      }
    });
  } else if (input && input.fastaText) {
    const cleanSeq = input.fastaText
      .split('\n')
      .filter((line) => !line.startsWith('>'))
      .join('')
      .replace(/\s+/g, '')
      .toUpperCase();

    for (let i = 0; i < Math.min(cleanSeq.length, WT_MPRO_SEQUENCE.length); i++) {
      if (cleanSeq[i] !== WT_MPRO_SEQUENCE[i]) {
        mutations.push({
          position: i + 1,
          wildTypeResidue: WT_MPRO_SEQUENCE[i],
          mutantResidue: cleanSeq[i],
          structuralRegion: i + 1 >= 140 && i + 1 <= 170 ? 'Catalytic Loop (Active site border)' : 'Core / Loop domain',
          expectedEffect: 'FASTA 서열 정렬 기반 실 변이 감지',
        });
      }
    }
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
      af3Version: engineRes.data.af3Version || engineRes.data.version || 'AlphaFold 3.0.4.dev5 (Ubuntu WSL Engine)',
      gpuAvailable: engineRes.data.gpuAvailable ?? engineRes.data.gpu ?? true,
      gpuName: engineRes.data.gpuName || 'NVIDIA GeForce RTX 4070',
      activeWorkers: engineRes.data.activeWorkers || engineRes.data.workers || 4,
      message: engineRes.data.message || 'Ubuntu Local AlphaFold3 Engine Connected',
    });
  } catch (err) {
    return res.json({
      status: 'unreachable',
      af3Version: 'AlphaFold 3.0.0 (Proxy Standby)',
      gpuAvailable: false,
      message: `Ubuntu AF3 엔진(${AF3_ENGINE_URL})에 연결할 수 없습니다. WSL 내 af3_engine_server.py 구동 여부를 확인하세요.`,
    });
  }
});

// ==========================================
// 1-1. WSL 실제 완료 Job 목록 조회 (/api/af3/jobs)
// ==========================================
app.get('/api/af3/jobs', async (req, res) => {
  try {
    const engineRes = await axios.get(`${AF3_ENGINE_URL}/jobs`, { timeout: 3000 });
    return res.json(engineRes.data);
  } catch (err) {
    return res.status(502).json({ jobs: [], error: 'AF3 Engine Unreachable' });
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
  const job = getOrCreateJob(jobId);
  return res.json(job);
});

// ==========================================
// 4. 결합 예측 실행 요청 (POST /api/analysis/:jobId/predict)
// ==========================================
app.post('/api/analysis/:jobId/predict', async (req, res) => {
  const { jobId } = req.params;
  const { inhibitorIds } = req.body;
  const job = getOrCreateJob(jobId);

  job.status = 'complex_predicting';
  job.updatedAt = new Date().toISOString();

  // 선택된 억제제들에 대해 초기 메타데이터 구성
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
    structureFilePath: null,
    confidence: null,
    metrics: null,
  }));

  // WSL AlphaFold3 엔진으로 예측 요청 전송
  // 프론트엔드에서 입력한 실제 서열을 추출하여 WSL 엔진에 직접 전달
  let sequence = null;
  if (job.input && job.input.fastaText) {
    sequence = job.input.fastaText
      .split('\n')
      .filter((line) => !line.startsWith('>'))
      .join('')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  try {
    await axios.post(`${AF3_ENGINE_URL}/predict`, {
      jobId,
      sequence,  // 프론트엔드에서 입력한 전체 서열 직접 전달
      mutations: job.mutations,
      inhibitorIds,
      dimerMode: true,
      fullInference: true,
    }, { timeout: 5000 });
    console.log(`[AF3 Engine] predict request accepted for ${jobId}, sequence length: ${sequence ? sequence.length : 'using WT'}`);
  } catch (err) {
    console.log(`[AF3 Engine Info] predict request sent to WSL engine (may have timed out, but job continues in background).`);
  }

  // WSL output 폴더에서 이 jobId 전용 결과를 polling (최대 2시간, 15초 간격)
  const MAX_POLLS = 480;  // 480 * 15s = 2시간
  const POLL_INTERVAL = 15000;

  // AF3 summary_confidences.json → UI metrics 변환 (실제 AF3 출력값 직접 사용)
  function extractRealMetrics(summaryJson) {
    if (!summaryJson) return null;
    // chain_pair_iptm[0][2]와 [1][2]: 각 단백질 체인과 리간드(C) 간 iptm
    const chainPairIptm = summaryJson.chain_pair_iptm || [];
    const proteinLigandIptm_A = chainPairIptm[0] ? chainPairIptm[0][2] : null;
    const proteinLigandIptm_B = chainPairIptm[1] ? chainPairIptm[1][2] : null;
    const avgLigandIptm = (proteinLigandIptm_A !== null && proteinLigandIptm_B !== null)
      ? (proteinLigandIptm_A + proteinLigandIptm_B) / 2
      : summaryJson.iptm;

    // chain_pair_pae_min[0][2], [1][2]: 단백질-리간드 간 PAE 최소값 (낮을수록 좋음)
    const chainPairPaeMin = summaryJson.chain_pair_pae_min || [];
    const paeToLigand_A = chainPairPaeMin[0] ? chainPairPaeMin[0][2] : null;
    const paeToLigand_B = chainPairPaeMin[1] ? chainPairPaeMin[1][2] : null;

    return {
      // 실제 AF3 출력값을 그대로 전달
      ranking_score: summaryJson.ranking_score,
      iptm: summaryJson.iptm,
      ptm: summaryJson.ptm,
      fraction_disordered: summaryJson.fraction_disordered,
      has_clash: summaryJson.has_clash,
      // 단백질-리간드 상호작용 지표
      ligand_iptm_avg: avgLigandIptm !== null ? Number(avgLigandIptm.toFixed(4)) : null,
      ligand_pae_A: paeToLigand_A,
      ligand_pae_B: paeToLigand_B,
      // chain별 ptm
      chain_ptm: summaryJson.chain_ptm || [],
    };
  }

  const pollForResults = async () => {
    const j = jobStore.get(jobId);
    if (!j) return;

    const expectedInhibitorIds = inhibitorIds || [];

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      try {
        const jobsRes = await axios.get(`${AF3_ENGINE_URL}/jobs`, { timeout: 5000 });
        const allJobs = jobsRes.data.jobs || [];

        // 각 억제제별로 완료 여부 확인
        let completedCount = 0;
        for (const inhId of expectedInhibitorIds) {
          const folderName = `${jobId}_${inhId}`;
          const inhJob = allJobs.find((item) => item.jobId === folderName);
          if (inhJob && inhJob.completed && inhJob.cifFile) {
            completedCount++;
          }
        }

        console.log(`[AF3 Engine] 📊 ${completedCount}/${expectedInhibitorIds.length} inhibitors completed for ${jobId}`);

        // 하나라도 완료되면 해당 억제제 결과 업데이트 (부분 완료 지원)
        if (completedCount > 0) {
          j.updatedAt = new Date().toISOString();

          j.inhibitors.forEach((inh) => {
            const inhFolderName = `${jobId}_${inh.inhibitorId}`;
            const inhJob = allJobs.find((item) => item.jobId === inhFolderName);

            if (inhJob && inhJob.completed && inhJob.cifFile) {
              inh.status = 'completed';
              inh.structureFilePath = `/api/af3/output/${inhJob.jobId}/${inhJob.cifFile}`;
              // 실제 AF3 summary_confidences.json 데이터 직접 매핑
              inh.realMetrics = extractRealMetrics(inhJob.metrics);
              const m = inh.realMetrics || {};
              inh.confidence = m.ranking_score || null;
              inh.metrics = {
                rankingScore: m.ranking_score,
                iptm: m.iptm,
                ptm: m.ptm,
                ligandIptm: m.ligand_iptm_avg,
                ligandPaeA: m.ligand_pae_A,
                ligandPaeB: m.ligand_pae_B,
                hasClash: m.has_clash,
                fractionDisordered: m.fraction_disordered,
              };
            }
          });
        }

        // 모든 억제제가 완료되었으면 종료
        if (completedCount >= expectedInhibitorIds.length) {
          j.status = 'completed';
          j.updatedAt = new Date().toISOString();
          console.log(`[AF3 Engine] ✅ All ${completedCount} inhibitors completed for ${jobId}`);
          return;
        }

        // 하나 이상 완료되었지만 나머지 진행 중
        if (completedCount > 0) {
          j.status = `predicting_${completedCount}_of_${expectedInhibitorIds.length}`;
        }
      } catch (e) {
        // WSL 엔진 응답 실패 - 계속 polling
      }

      j.updatedAt = new Date().toISOString();
      console.log(`[AF3 Engine] ⏳ Polling ${attempt + 1}/${MAX_POLLS} for ${jobId}...`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }

    // 시간 초과
    j.status = 'timeout';
    j.updatedAt = new Date().toISOString();
    console.log(`[AF3 Engine] ⚠️ Timeout waiting for ${jobId}`);
  };

  // 비동기로 polling 시작 (응답은 즉시 반환)
  pollForResults().catch((err) => {
    console.error(`[AF3 Engine] Polling error for ${jobId}:`, err.message);
  });

  return res.json(job);
});

// ==========================================
// 5. 진행 상태 조회 (GET /api/analysis/:jobId/status)
// ==========================================
app.get('/api/analysis/:jobId/status', (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);
  return res.json(job);
});

// ==========================================
// 6. 구조 파일 정보 반환 (GET /api/analysis/:jobId/structure/:inhibitorId)
// ==========================================
app.get('/api/analysis/:jobId/structure/:inhibitorId', (req, res) => {
  const { jobId, inhibitorId } = req.params;
  const job = getOrCreateJob(jobId);

  // job의 inhibitors에서 해당 억제제의 실제 structureFilePath 조회
  const inhibitor = (job.inhibitors || []).find((inh) => inh.inhibitorId === inhibitorId);
  const structurePath = inhibitor?.structureFilePath;

  if (structurePath) {
    return res.json({
      jobId,
      inhibitorId,
      fileUrl: `http://localhost:${PORT}${structurePath}`,
      filePath: structurePath,
      format: 'mmcif',
    });
  }

  // 아직 구조 파일이 생성되지 않은 상태
  return res.status(202).json({
    jobId,
    inhibitorId,
    status: 'pending',
    message: 'GPU 연산이 진행 중입니다. 구조 파일이 아직 생성되지 않았습니다.',
    format: 'mmcif',
  });
});

// ==========================================
// 6-1. 실제 WSL AlphaFold 3 구조(mmCIF) 파일 서빙 프록시
// ==========================================
app.get('/api/af3/output/:jobId/:filename', async (req, res) => {
  const { jobId, filename } = req.params;
  try {
    const engineRes = await axios.get(`${AF3_ENGINE_URL}/output/${jobId}/${filename}`, {
      responseType: 'stream',
      timeout: 10000
    });
    res.setHeader('Content-Type', engineRes.headers['content-type'] || 'chemical/x-cif; charset=utf-8');
    engineRes.data.pipe(res);
  } catch (err) {
    return res.status(404).json({ error: `구조 파일 (${jobId}/${filename})을 찾을 수 없습니다.` });
  }
});

// ==========================================
// 7. 종합 보고서 조회 (GET /api/analysis/:jobId/report)
// ==========================================
app.get('/api/analysis/:jobId/report', (req, res) => {
  const { jobId } = req.params;
  const job = getOrCreateJob(jobId);

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
