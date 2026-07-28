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
// 1-1b. WSL 완료 Job 동기화 (POST /api/sync-wsl-jobs)
// WSL 엔진의 실제 완료 결과를 Node jobStore로 가져와 드롭다운에 표시
// ==========================================
app.post('/api/sync-wsl-jobs', async (req, res) => {
  try {
    const engineRes = await axios.get(`${AF3_ENGINE_URL}/jobs`, { timeout: 10000 });
    const wslJobs = engineRes.data.jobs || [];

    // jobId 기준으로 그룹핑
    // 신규 포맷: "AF3-MPRO-{변이라벨}-{타임스탬프}_{억제제}" (변이 정보가 폴더명에 포함됨)
    // 구 포맷:   "AF3-MPRO-{타임스탬프}_{억제제}" (변이 정보 없음)
    const jobGroups = {};
    for (const wslJob of wslJobs) {
      if (!wslJob.completed || !wslJob.cifFile) continue;
      const newFormatMatch = wslJob.jobId.match(/^(AF3-MPRO-.+-\d{6}-\d{6})_(.+)$/);
      const match = newFormatMatch || wslJob.jobId.match(/^(AF3-[A-Z]+-[\d-]+)_(.+)$/);
      if (!match) continue;
      const [, baseJobId, inhibitorId] = match;
      if (!jobGroups[baseJobId]) jobGroups[baseJobId] = [];
      jobGroups[baseJobId].push({ inhibitorId, wslJob });
    }

    // Mpro 레거시 잡 처리 (Mpro_WT__nirmatrelvir 등)
    for (const wslJob of wslJobs) {
      if (!wslJob.completed || !wslJob.cifFile) continue;
      const legacyMatch = wslJob.jobId.match(/^(Mpro_[^_]+)__(.+)$/);
      if (!legacyMatch) continue;
      const [, baseJobId, inhibitorId] = legacyMatch;
      if (!jobGroups[baseJobId]) jobGroups[baseJobId] = [];
      jobGroups[baseJobId].push({ inhibitorId, wslJob });
    }

    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const [baseJobId, entries] of Object.entries(jobGroups)) {
      // 이미 jobStore에 있으면서 완료된 잡은 건너뜀
      const existing = jobStore.get(baseJobId);
      if (existing && existing.status === 'completed') {
        // CIF 파일 유효성 재검증: structureFilePath가 있으나 실제 파일이 없으면 업데이트
        const hasOrphan = existing.inhibitors?.some(i =>
          i.status === 'completed' && i.structureFilePath &&
          !entries.find(e => e.inhibitorId === i.inhibitorId)
        );
        if (!hasOrphan) { skipped++; continue; }
      }

      // 변이 감지: baseJobId 또는 잡 이름에서 추론
      const mutations = [];
      // 신규 포맷: "AF3-MPRO-E166V-260723-192052" 또는 "AF3-MPRO-L50F_E166A_L167F-260723-192052"
      // (WT는 "AF3-MPRO-WT-260723-192052" — mutations 없음)
      const newFormatLabelMatch = baseJobId.match(/^AF3-MPRO-(.+)-\d{6}-\d{6}$/);
      if (newFormatLabelMatch && newFormatLabelMatch[1] !== 'WT') {
        for (const token of newFormatLabelMatch[1].split('_')) {
          const m = token.match(/^([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3})$/);
          if (!m) continue;
          const pos = parseInt(m[2], 10);
          mutations.push({
            position: pos,
            wildTypeResidue: m[1].toUpperCase(),
            mutantResidue: m[3].toUpperCase(),
            structuralRegion: pos >= 140 && pos <= 170 ? 'Catalytic Loop / Pocket Border' : 'Surface / Loop',
            expectedEffect: 'job 폴더명에서 동기화됨',
          });
        }
      } else {
        // e.g. "Mpro_E166V__" (mutations unknown for pre-변이라벨 AF3 jobs)
        const mutMatch = baseJobId.match(/Mpro_([A-Z]\d+[A-Z])(?:_|$)/i);
        if (mutMatch) {
          const m = mutMatch[1];
          const pos = parseInt(m.slice(1, -1), 10);
          mutations.push({
            position: pos,
            wildTypeResidue: m[0].toUpperCase(),
            mutantResidue: m[m.length - 1].toUpperCase(),
            structuralRegion: pos >= 140 && pos <= 170 ? 'Catalytic Loop / Pocket Border' : 'Surface / Loop',
            expectedEffect: 'WSL 레거시 잡에서 동기화됨',
          });
        }
      }

      const inhibitors = entries.map(({ inhibitorId, wslJob }) => ({
        inhibitorId,
        name: inhibitorId,
        status: 'completed',
        structureFilePath: `/api/af3/output/${wslJob.jobId}/${wslJob.cifFile}`,
        confidence: wslJob.metrics?.ranking_score || null,
        metrics: {
          rankingScore: wslJob.metrics?.ranking_score,
          iptm: wslJob.metrics?.iptm,
          ptm: wslJob.metrics?.ptm,
        },
      }));

      const syncedJob = {
        jobId: baseJobId,
        status: 'completed',
        mutations,
        inhibitors,
        createdAt: entries[0]?.wslJob?.createdAt || now,
        updatedAt: now,
        syncedFromWSL: true,
      };

      jobStore.set(baseJobId, syncedJob);
      imported++;
    }

    return res.json({
      success: true,
      imported,
      skipped,
      total: jobStore.size,
      message: `WSL에서 ${imported}개 잡 동기화 완료 (${skipped}개 이미 존재)`,
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: `WSL 동기화 실패: ${err.message}` });
  }
});


// ==========================================
// 1-2. 현재 세션 전체 Job 목록 (GET /api/analysis/jobs)
// jobStore 인메모리 전체 목록 반환 — WT vs Mutant 비교 패널 선택용
// ==========================================
app.get('/api/analysis/jobs', (req, res) => {
  const jobs = [];
  for (const [, job] of jobStore.entries()) {
    jobs.push({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      mutations: job.mutations || [],
      mutationCount: (job.mutations || []).length,
      mutationLabel: (job.mutations || []).length === 0
        ? 'WT (야생형 — 변이 없음)'
        : (job.mutations || []).map(m => `${m.wildTypeResidue}${m.position}${m.mutantResidue}`).join('/'),
      inhibitorCount: (job.inhibitors || []).length,
      completedCount: (job.inhibitors || []).filter(i => i.status === 'completed').length,
    });
  }
  // 최신 순 정렬
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ jobs, wtSequenceAvailable: true });
});

// ==========================================
// 2. Job 생성 및 서열 검증 (POST /api/analysis)
// ==========================================
// 변이 라벨: WT는 'WT', 그 외는 'E166V' 또는 'L50F_E166A_L167F'처럼 결합 —
// job 폴더명에 변이 정보가 들어가도록 jobId 생성에 사용한다.
function buildMutationLabel(mutations) {
  if (!mutations || mutations.length === 0) return 'WT';
  return mutations
    .map((m) => `${m.wildTypeResidue}${m.position}${m.mutantResidue}`)
    .join('_');
}

app.post('/api/analysis', async (req, res) => {
  const input = req.body;
  const _ts = new Date();
  const _pad = (n) => String(n).padStart(2, '0');
  const _stamp = `${String(_ts.getFullYear()).slice(-2)}${_pad(_ts.getMonth()+1)}${_pad(_ts.getDate())}-${_pad(_ts.getHours())}${_pad(_ts.getMinutes())}${_pad(_ts.getSeconds())}`;
  const now = _ts.toISOString();

  const mutations = parseMutationsFromInput(input);
  const mutationLabel = buildMutationLabel(mutations);
  const jobId = `AF3-MPRO-${mutationLabel}-${_stamp}`;

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
    return res.status(404).json({ error: `Job을 찾을 수 없습니다: ${jobId}. WSL 동기화 버튼으로 과거 잡을 불러오세요.` });
  }
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
    // 공유결합 (Covalent)
    nirmatrelvir:    'Nirmatrelvir (PF-07321332)',
    ibuzatrelvir:    'Ibuzatrelvir (PF-07817883)',
    simnotrelvir:    'Simnotrelvir (SIM0417)',
    leritrelvir:     'Leritrelvir (RAY1216)',
    bofutrelvir:     'Bofutrelvir (FB2001)',
    // 플랫폼 자체 설계 유도체
    a2_derivative:   'A-2 Derivative (E166V 보상형)',
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

  // WSL output 폴더에서 이 jobId 전용 결과를 polling
  // 16종 억제제는 수 시간 소요 가능 → 최대 12시간 대기
  const MAX_POLLS = 2880;  // 2880 * 15s = 12시간
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
      // 구조 기반 자체 계산 지표 (from CIF)
      cys145Distance: summaryJson.cys145Distance,
      hBondCount: summaryJson.hBondCount,
      a166f167Interaction: summaryJson.a166f167Interaction,
      stericClash: summaryJson.stericClash !== undefined ? summaryJson.stericClash : summaryJson.has_clash,
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
                hasClash: m.stericClash,
                fractionDisordered: m.fraction_disordered,
                cys145Distance: m.cys145Distance,
                hBondCount: m.hBondCount,
                a166f167Interaction: m.a166f167Interaction,
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
        // (완료된 억제제가 절반 이상이면 partial_completed로 표시)
        if (completedCount > 0) {
          const ratio = completedCount / expectedInhibitorIds.length;
          j.status = ratio >= 0.5
            ? `partial_completed_${completedCount}_of_${expectedInhibitorIds.length}`
            : `predicting_${completedCount}_of_${expectedInhibitorIds.length}`;
        }
      } catch (e) {
        // WSL 엔진 응답 실패 - 계속 polling
      }

      j.updatedAt = new Date().toISOString();
      console.log(`[AF3 Engine] ⏳ Polling ${attempt + 1}/${MAX_POLLS} for ${jobId}...`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }

    // 시간 초과 (12시간 초과 시에만)
    j.status = 'timeout';
    j.updatedAt = new Date().toISOString();
    console.log(`[AF3 Engine] ⚠️ Timeout (12h exceeded) waiting for ${jobId}`);
    console.log(`[AF3 Engine] 💡 완료된 억제제 수: ${j.inhibitors.filter(i => i.status === 'completed').length}/${j.inhibitors.length}`);
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
    exportOptions: { pdfAvailable: true, csvAvailable: true, chimeraXAvailable: true },
  });
});

// ==========================================
// 8. AF3 전용 API 중계 라우트 (/api/af3/*)
// ==========================================
app.post('/api/af3/prepare', (req, res) => {
  const _t = new Date();
  const _p = (n) => String(n).padStart(2, '0');
  const _s = `${String(_t.getFullYear()).slice(-2)}${_p(_t.getMonth()+1)}${_p(_t.getDate())}-${_p(_t.getHours())}${_p(_t.getMinutes())}${_p(_t.getSeconds())}`;
  return res.json({
    sequenceId: `SEQ-MPRO-${_s}`,
    dimerTemplate: 'Wuhan-Hu-1 Homodimer Template (2 chains, 612 aa total)',
    residueCount: 306,
  });
});

app.post('/api/af3/submit', (req, res) => {
  const { jobId } = req.body;
  const _t2 = new Date();
  const _p2 = (n) => String(n).padStart(2, '0');
  const _s2 = `${String(_t2.getFullYear()).slice(-2)}${_p2(_t2.getMonth()+1)}${_p2(_t2.getDate())}-${_p2(_t2.getHours())}${_p2(_t2.getMinutes())}${_p2(_t2.getSeconds())}`;
  return res.json({
    jobId: jobId || `AF3-SUB-${_s2}`,
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
    currentStep: job && job.status === 'completed'
      ? 'Final CIF structure compiled'
      : 'S1/S2 pocket ligand pose refinement in progress...',
  });
});

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ==========================================
// Phase 3-a: RDKit 스크리닝 API
// ==========================================
app.post('/api/screening/run', (req, res) => {
  const { inhibitors } = req.body;
  if (!inhibitors || !Array.isArray(inhibitors)) {
    return res.status(400).json({ error: 'invalid inhibitors list' });
  }
  const condaExeS = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
  const scriptPathS = path.join(__dirname, 'screening_service.py');
  const pyProcS = spawn(condaExeS, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPathS]);
  let outS = '', errS = '';
  pyProcS.stdout.on('data', (d) => { outS += d.toString(); });
  pyProcS.stderr.on('data', (d) => { errS += d.toString(); });
  pyProcS.on('close', (code) => {
    if (code !== 0) {
      console.error('screening_service.py error:', errS);
      return res.status(500).json({ error: 'RDKit script failed', details: errS });
    }
    try { res.json(JSON.parse(outS)); }
    catch (e) { res.status(500).json({ error: 'Invalid JSON output from python', details: outS }); }
  });
  pyProcS.stdin.write(JSON.stringify({ inhibitors }));
  pyProcS.stdin.end();
});

// ==========================================
// Phase 3-b: AF3 구조 분석 API (ChimeraX 동등)
// POST /api/structure/analyze
// ==========================================
// filepath가 로컬 파일이 아니면 public 폴더 또는 AF3 엔진에서 가져와 임시 파일로 저장한다.
// /api/structure/analyze와 /api/analysis/:jobId/reevaluate/dock이 공유하는 로직.
async function resolveStructureFilepath(filepath, inhibitorId) {
  if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
    return { targetFilepath: filepath, fileContent: null, isTemp: false };
  }
  if (filepath.startsWith('/af3_outputs/')) {
    const localStaticPath = path.join(__dirname, '../public', filepath);
    if (fs.existsSync(localStaticPath)) {
      return { targetFilepath: localStaticPath, fileContent: null, isTemp: false };
    }
    throw new Error(`Local static file not found: ${localStaticPath}`);
  }

  let fetchUrl = filepath;
  if (filepath.startsWith('/api/af3/output/')) {
    fetchUrl = `${AF3_ENGINE_URL}/output/${filepath.replace('/api/af3/output/', '')}`;
  } else if (filepath.startsWith('/output/')) {
    fetchUrl = `${AF3_ENGINE_URL}${filepath}`;
  } else if (filepath.startsWith('/')) {
    fetchUrl = `http://localhost:${PORT}${filepath}`;
  }
  const resp = await axios.get(fetchUrl, { responseType: 'text', timeout: 15000 });
  const fileContent = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);

  const tempFilename = `af3_cif_${Date.now()}_${inhibitorId || 'lig'}.cif`;
  const targetFilepath = path.join(os.tmpdir(), tempFilename);
  fs.writeFileSync(targetFilepath, fileContent, 'utf-8');
  return { targetFilepath, fileContent, isTemp: true };
}

// structure_analysis.py 호출 공용 헬퍼 — /api/structure/analyze와
// AF3 재결합(reevaluate/af3) 완료 후 구조 비교 양쪽에서 재사용
function runStructureAnalysis(targetFilepath, fileContent, inhibitorId, variant) {
  return new Promise((resolve, reject) => {
    const condaExeA = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
    const scriptPathA = path.join(__dirname, 'structure_analysis.py');
    const pyProcA = spawn(condaExeA, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPathA]);
    let outA = '', errA = '';
    pyProcA.stdout.on('data', (d) => { outA += d.toString(); });
    pyProcA.stderr.on('data', (d) => { errA += d.toString(); });
    pyProcA.on('error', reject);
    pyProcA.on('close', (code) => {
      if (code !== 0) return reject(new Error(errA || `exit ${code}`));
      try { resolve(JSON.parse(outA)); }
      catch (e) { reject(new Error(`Invalid JSON from structure_analysis.py: ${outA}`)); }
    });
    pyProcA.stdin.write(JSON.stringify({ filepath: targetFilepath, content: fileContent || '', inhibitorId, variant }));
    pyProcA.stdin.end();
  });
}

app.post('/api/structure/analyze', async (req, res) => {
  const { filepath, inhibitorId, variant } = req.body;
  if (!filepath) return res.status(400).json({ error: 'filepath is required' });

  let resolved;
  try {
    resolved = await resolveStructureFilepath(filepath, inhibitorId);
  } catch (err) {
    console.error(`[Structure Analyze] Failed to fetch file ${filepath}:`, err.message);
    return res.status(404).json({
      error: `AF3 구조 파일(${filepath})을 불러올 수 없습니다.`,
      details: err.message
    });
  }

  try {
    const result = await runStructureAnalysis(resolved.targetFilepath, resolved.fileContent, inhibitorId, variant);
    res.json(result);
  } catch (err) {
    console.error('structure_analysis.py error:', err.message);
    res.status(500).json({ error: 'Structure analysis failed', details: err.message });
  } finally {
    if (resolved.targetFilepath !== filepath && fs.existsSync(resolved.targetFilepath)) {
      try { fs.unlinkSync(resolved.targetFilepath); } catch (e) {}
    }
  }
});

// ==========================================
// Phase 4: 구조변경 후보 생성 (Optimization) API
// ==========================================
app.post('/api/optimization/generate', (req, res) => {
  const { smiles, maxCandidates = 10 } = req.body;
  if (!smiles) return res.status(400).json({ error: 'smiles is required' });
  const condaExeO = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
  const scriptPathO = path.join(__dirname, 'optimization_service.py');
  const pyProcO = spawn(condaExeO, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPathO]);
  let outO = '', errO = '';
  pyProcO.stdout.on('data', (d) => { outO += d.toString(); });
  pyProcO.stderr.on('data', (d) => { errO += d.toString(); });
  pyProcO.on('close', (code) => {
    if (code !== 0) {
      console.error('[Optimization Error]', errO);
      try { const j = JSON.parse(outO); if (j.error) return res.status(500).json({ error: j.error }); } catch {}
      return res.status(500).json({ error: 'Optimization service failed.', details: errO });
    }
    try {
      const result = JSON.parse(outO);
      if (result.error) return res.status(500).json({ error: result.error });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to parse python output', raw: outO });
    }
  });
  pyProcO.stdin.write(JSON.stringify({ smiles, max_candidates: maxCandidates }));
  pyProcO.stdin.end();
});

// ==========================================
// Phase 5: 분자 구조 하이라이트 (Step 7) API
// ==========================================
app.post('/api/molecule/highlight', (req, res) => {
  const { smiles, inhibitorId, contacts, hbonds, buriedArea,
          wtContacts, wtHbonds, mutContacts, mutHbonds, regions } = req.body;
  if (!smiles) return res.status(400).json({ success: false, error: 'smiles is required' });

  // WT/Mutant 구조 데이터가 둘 다 있으면 diff 모드(변화만 하이라이트)로 위임
  const isPlain = req.body.mode === 'plain';
  const isCheckRegions = req.body.mode === 'check_regions';
  const isDiff = !isPlain && !isCheckRegions && (req.body.mode === 'diff' || (wtContacts && mutContacts));

  const condaExeM = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
  const scriptPathM = path.join(__dirname, 'molecule_highlight.py');
  const pyProcM = spawn(condaExeM, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPathM]);

  let outM = '', errM = '';
  pyProcM.stdout.on('data', (d) => { outM += d.toString(); });
  pyProcM.stderr.on('data', (d) => { errM += d.toString(); });
  pyProcM.on('close', (code) => {
    if (code !== 0) {
      console.error('[Molecule Highlight Error]', errM);
      return res.status(500).json({ success: false, error: 'Molecule highlight failed', details: errM });
    }
    try {
      const result = JSON.parse(outM);
      if (!result.success) return res.status(500).json(result);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: 'Invalid JSON from molecule_highlight.py', details: outM.slice(0, 500) });
    }
  });

  if (isPlain) {
    pyProcM.stdin.write(JSON.stringify({ mode: 'plain', smiles }));
  } else if (isCheckRegions) {
    pyProcM.stdin.write(JSON.stringify({ mode: 'check_regions', smiles, regions: regions || [] }));
  } else if (isDiff) {
    pyProcM.stdin.write(JSON.stringify({
      mode: 'diff', smiles, inhibitorId,
      wtContacts, wtHbonds, mutContacts, mutHbonds,
    }));
  } else {
    pyProcM.stdin.write(JSON.stringify({ smiles, inhibitorId, contacts, hbonds, buriedArea }));
  }
  pyProcM.stdin.end();
});

// ==========================================
// Phase 6: 유도체 물성 분석 (STAGE 3) API
// ==========================================

// derivative_analysis.py 호출 공용 헬퍼 — /api/derivative/analyze와
// /api/analysis/:jobId/optimize (parent+candidate 동시 계산) 양쪽에서 재사용
function spawnDerivativeAnalysis(smiles) {
  return new Promise((resolve, reject) => {
    const condaExe = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
    const scriptPath = path.join(__dirname, 'derivative_analysis.py');
    const proc = spawn(condaExe, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPath, '--smiles', smiles]);
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code !== 0) {
        const e = new Error('derivative_analysis.py failed');
        e.details = err;
        return reject(e);
      }
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(new Error(`Invalid JSON from derivative_analysis.py: ${out}`));
      }
    });
  });
}

app.post('/api/derivative/analyze', async (req, res) => {
  const { smiles } = req.body;
  if (!smiles) return res.status(400).json({ success: false, error: 'smiles is required' });

  try {
    const result = await spawnDerivativeAnalysis(smiles);
    if (!result.success && result.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    console.error('[Derivative Analysis Error]', e.details || e.message);
    res.status(500).json({ success: false, error: 'Derivative analysis failed', details: e.details || e.message });
  }
});

// ==========================================
// Phase 7: 유도체 후보 저장 + RDKit 실측 재평가 (STAGE 4)
// ==========================================
const crypto = require('crypto');

// 명세서 11.3 기본값 — 임상 합격 기준이 아니라 플랫폼 내부 후보 정렬 기준
const HARD_FILTER_LIMITS = { maxMolecularWeight: 700, maxTpsa: 180, maxClogp: 6 };

function computeDerivativeDelta(parentAnalysis, candidateAnalysis) {
  const p = parentAnalysis.properties;
  const c = candidateAnalysis.properties;
  const parentFlags = parentAnalysis.admet?.flags || [];
  const candidateFlags = candidateAnalysis.admet?.flags || [];
  return {
    mw: Number((c.mw - p.mw).toFixed(2)),
    tpsa: Number((c.tpsa - p.tpsa).toFixed(2)),
    clogp: Number((c.clogp - p.clogp).toFixed(2)),
    addedAdmetFlags: candidateFlags.filter((f) => !parentFlags.includes(f)),
    removedAdmetFlags: parentFlags.filter((f) => !candidateFlags.includes(f)),
  };
}

function evaluateHardFilter(candidateAnalysis) {
  const p = candidateAnalysis.properties;
  const reasons = [];
  let passed = true;
  if (p.mw > HARD_FILTER_LIMITS.maxMolecularWeight) { passed = false; reasons.push(`분자량 ${p.mw} > ${HARD_FILTER_LIMITS.maxMolecularWeight} 상한 초과`); }
  if (p.tpsa > HARD_FILTER_LIMITS.maxTpsa) { passed = false; reasons.push(`TPSA ${p.tpsa} > ${HARD_FILTER_LIMITS.maxTpsa} 상한 초과`); }
  if (p.clogp > HARD_FILTER_LIMITS.maxClogp) { passed = false; reasons.push(`cLogP ${p.clogp} > ${HARD_FILTER_LIMITS.maxClogp} 상한 초과`); }
  if (reasons.length === 0) reasons.push('물성 기준(MW/TPSA/cLogP) 통과');
  return { passed, reasons };
}

function buildImprovementAssessment(delta, hardFilter) {
  return {
    structuralInteractionRecovery: 'unresolved', // AF3/Vina 재검증 전이라 판정 보류
    toxicityNasalProfile: !hardFilter.passed
      ? 'worsened'
      : (delta.addedAdmetFlags.length === 0 ? 'similar' : 'worsened'),
    predictionConfidence: 'low',
    reasons: hardFilter.reasons,
  };
}

// POST /api/analysis/:jobId/optimize — 후보 생성 시점에 parent/candidate를
// 동일한 방식(derivative_analysis.py)으로 계산해 job에 저장
app.post('/api/analysis/:jobId/optimize', async (req, res) => {
  const { jobId } = req.params;
  const { parentInhibitorId, parentSmiles, smiles, modificationType, rationale } = req.body;

  if (!parentInhibitorId || !parentSmiles || !smiles) {
    return res.status(400).json({ error: 'parentInhibitorId, parentSmiles, smiles가 모두 필요합니다.' });
  }

  const job = getOrCreateJob(jobId);

  let parentAnalysis, candidateAnalysis;
  try {
    [parentAnalysis, candidateAnalysis] = await Promise.all([
      spawnDerivativeAnalysis(parentSmiles),
      spawnDerivativeAnalysis(smiles),
    ]);
  } catch (e) {
    return res.status(500).json({ error: 'RDKit 물성 계산 실패', details: e.details || e.message });
  }
  if (!candidateAnalysis.success) {
    return res.status(400).json({ error: candidateAnalysis.error || '유효하지 않은 후보 SMILES입니다.' });
  }
  if (!parentAnalysis.success) {
    return res.status(400).json({ error: parentAnalysis.error || '유효하지 않은 원본 SMILES입니다.' });
  }

  const candidateId = crypto.randomUUID();
  const delta = computeDerivativeDelta(parentAnalysis, candidateAnalysis);
  const hardFilter = evaluateHardFilter(candidateAnalysis);

  const candidate = {
    candidateId,
    parentInhibitorId,
    smiles,
    canonicalSmiles: smiles,
    modifiedAtomIds: [],
    modificationType: modificationType || 'r_group_replacement',
    rationale: rationale && rationale.length ? rationale : ['사용자 정의 SMILES 수정'],
    expectedRecoveredInteraction: [],
    // 구조 경고는 PAINS/BRENK 부분구조 매칭 결과만 담는다.
    // (MW·cLogP 같은 물성 플래그를 여기 섞으면 Lipinski 초과만으로 High Risk가 된다)
    structuralAlerts: candidateAnalysis.structuralAlerts || [],
    createdAt: new Date().toISOString(),
  };

  if (!job.optimizationRuns) job.optimizationRuns = [];
  job.optimizationRuns.push({
    runId: crypto.randomUUID(),
    jobId,
    inhibitorId: parentInhibitorId,
    status: 'completed',
    candidates: [candidate],
    selectedCandidateIds: [candidateId],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  if (!job.finalCandidates) job.finalCandidates = [];
  job.finalCandidates.push({
    candidateId,
    parentInhibitorId,
    isOriginalInhibitor: false,
    mw: candidateAnalysis.properties.mw,
    tpsa: candidateAnalysis.properties.tpsa,
    clogp: candidateAnalysis.properties.clogp,
    // 비강 전달 적합성 판정용 (derivative_analysis.py가 RDKit으로 실측)
    hbd: candidateAnalysis.properties.hbd ?? null,
    solubilityMgPerMl: candidateAnalysis.properties.solubility?.mgPerMl ?? null,
    solubilityLogS: candidateAnalysis.properties.solubility?.logS ?? null,
    structuralAlertCount: candidate.structuralAlerts.length,
    improvement: buildImprovementAssessment(delta, hardFilter),
    finalCategory: 'insufficient_evidence',
    summaryText: '구조변경 후보 — 물성 기반 재평가 완료, 구조적/결합에너지 재검증 대기 중',
    // 플랫폼 내부 확장 필드 (명세서 FinalCandidateRecord에는 없음) — Reevaluation/FinalRanking이
    // parent 대비 delta를 다시 계산할 필요 없이 그대로 읽어쓴다.
    parentSmiles,
    candidateSmiles: smiles,
    parentAnalysis,
    candidateAnalysis,
  });

  job.updatedAt = new Date().toISOString();

  return res.status(201).json({
    candidateId,
    parentAnalysis,
    candidateAnalysis,
    delta,
    hardFilterPassed: hardFilter.passed,
    reasons: hardFilter.reasons,
  });
});

// POST /api/analysis/:jobId/reevaluate — 저장된 parent/candidate 분석값으로
// soft ranking 판정을 갱신 (순수 계산, 파이썬 재호출 없음)
app.post('/api/analysis/:jobId/reevaluate', (req, res) => {
  const { jobId } = req.params;
  const { candidateId } = req.body;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ error: `Job을 찾을 수 없습니다: ${jobId}` });

  const record = (job.finalCandidates || []).find((f) => f.candidateId === candidateId);
  if (!record || !record.parentAnalysis || !record.candidateAnalysis) {
    return res.status(404).json({ error: `후보를 찾을 수 없습니다: ${candidateId}. 유도체 설계를 다시 진행해주세요.` });
  }

  const delta = computeDerivativeDelta(record.parentAnalysis, record.candidateAnalysis);
  const hardFilter = evaluateHardFilter(record.candidateAnalysis);
  record.improvement = buildImprovementAssessment(delta, hardFilter);
  job.updatedAt = new Date().toISOString();

  return res.json({
    candidateId,
    parentAnalysis: record.parentAnalysis,
    candidateAnalysis: record.candidateAnalysis,
    delta,
    hardFilterPassed: hardFilter.passed,
    reasons: hardFilter.reasons,
    finalCandidate: record,
  });
});

// ==========================================
// Phase 8: 실제 AutoDock Vina(QuickVina2) 재도킹
// ==========================================
function runDockingService(receptorCifPath, ligandSmiles) {
  return new Promise((resolve, reject) => {
    const condaExe = path.join(os.homedir(), 'miniconda3', 'Scripts', 'conda.exe');
    const scriptPath = path.join(__dirname, 'docking_service.py');
    const proc = spawn(condaExe, ['run', '-n', 'af3-rdkit', '--no-capture-output', 'python', scriptPath]);
    let out = '', err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      try {
        const result = JSON.parse(out);
        resolve(result);
      } catch (e) {
        if (code !== 0) return reject(new Error(err || `exit ${code}`));
        reject(new Error(`Invalid JSON from docking_service.py: ${out}`));
      }
    });
    proc.stdin.write(JSON.stringify({ receptorCifPath, ligandSmiles }));
    proc.stdin.end();
  });
}

// POST /api/analysis/:jobId/reevaluate/dock — QuickVina2로 parent/candidate를
// 동일 receptor·box에서 재도킹해 실측 결합에너지(kcal/mol)를 계산한다.
app.post('/api/analysis/:jobId/reevaluate/dock', async (req, res) => {
  const { jobId } = req.params;
  const { candidateId } = req.body;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ error: `Job을 찾을 수 없습니다: ${jobId}` });

  const record = (job.finalCandidates || []).find((f) => f.candidateId === candidateId);
  if (!record || !record.candidateSmiles || !record.parentSmiles) {
    return res.status(404).json({ error: `후보를 찾을 수 없습니다: ${candidateId}. 유도체 설계를 다시 진행해주세요.` });
  }

  const parentInhibitorEntry = (job.inhibitors || []).find((i) => i.inhibitorId === record.parentInhibitorId);
  const structureFilePath = parentInhibitorEntry?.structureFilePath;
  if (!structureFilePath) {
    return res.status(400).json({
      error: '이 후보의 parent 억제제에 대한 AF3 구조 파일이 없습니다. AF3 결합 예측(Step 5)을 먼저 완료해주세요.',
    });
  }

  let resolved;
  try {
    resolved = await resolveStructureFilepath(structureFilePath, record.parentInhibitorId);
  } catch (err) {
    return res.status(404).json({ error: 'AF3 구조 파일을 불러올 수 없습니다.', details: err.message });
  }

  try {
    // parent는 같은 job 안에서 한 번만 도킹해 재사용 — 후보마다 반복 계산하지 않는다
    if (!job.parentDockingCache) job.parentDockingCache = {};
    let parentResult = job.parentDockingCache[record.parentInhibitorId];
    if (parentResult === undefined) {
      const dockResult = await runDockingService(resolved.targetFilepath, record.parentSmiles);
      if (!dockResult.success) throw new Error(dockResult.error || 'parent 도킹 실패');
      parentResult = dockResult.bindingAffinity;
      job.parentDockingCache[record.parentInhibitorId] = parentResult;
    }

    const candidateResult = await runDockingService(resolved.targetFilepath, record.candidateSmiles);
    if (!candidateResult.success) {
      return res.status(400).json({ error: candidateResult.error || '후보 도킹 실패' });
    }

    const delta = Number((candidateResult.bindingAffinity - parentResult).toFixed(2));
    record.bindingAffinity = candidateResult.bindingAffinity;
    record.parentBindingAffinity = parentResult;
    record.bindingAffinityDelta = delta;
    job.updatedAt = new Date().toISOString();

    return res.json({
      candidateId,
      bindingAffinity: candidateResult.bindingAffinity,
      parentBindingAffinity: parentResult,
      delta,
      engine: candidateResult.engine,
    });
  } catch (err) {
    return res.status(500).json({ error: '도킹 계산 중 오류가 발생했습니다.', details: err.message });
  } finally {
    if (resolved.isTemp && fs.existsSync(resolved.targetFilepath)) {
      try { fs.unlinkSync(resolved.targetFilepath); } catch (e) {}
    }
  }
});

// ==========================================
// Phase 9: 실제 AF3 재추론(GPU)으로 구조적 상호작용 회복 판정
// QuickVina2 도킹과 달리 mutant 서열에 대해 candidate SMILES로 AF3 전체 추론을
// 다시 실행해 실측 접촉/H-bond를 얻는다 — structuralInteractionRecovery가
// 영원히 'unresolved'로 남는 문제를 실제 값으로 해소한다.
// ==========================================

async function pollAf3RebindResult(jobId, candidateId, af3InhibitorId) {
  const job = jobStore.get(jobId);
  if (!job || !job.af3Rebind) return;
  const state = job.af3Rebind[candidateId];
  if (!state) return;

  const folderName = `${jobId}_${af3InhibitorId}`;
  const MAX_POLLS = 480;      // 480 * 15s = 최대 2시간 대기
  const POLL_INTERVAL = 15000;

  let found = null;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    try {
      const jobsRes = await axios.get(`${AF3_ENGINE_URL}/jobs`, { timeout: 5000 });
      const allJobs = jobsRes.data.jobs || [];
      const match = allJobs.find((j) => j.jobId === folderName);
      if (match && match.completed && match.cifFile) {
        found = match;
        break;
      }
    } catch (e) {
      // WSL 엔진 응답 실패 - 계속 polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  if (!found) {
    state.status = 'timeout';
    state.error = 'AF3 재결합 예측이 시간 내에 완료되지 않았습니다 (2시간 초과).';
    return;
  }

  // AF3 추론은 완료됨 — 여기부터 실패하면 재시도하지 않고 즉시 실패로 기록한다
  // (구조 분석 실패를 "아직 안 끝남"으로 오인해 타임아웃까지 계속 도는 것을 방지)
  state.status = 'analyzing';
  state.structureFilePath = `/api/af3/output/${folderName}/${found.cifFile}`;

  try {
    const record = (job.finalCandidates || []).find((f) => f.candidateId === candidateId);
    if (!record) throw new Error(`후보 레코드를 찾을 수 없습니다: ${candidateId}`);

    const resolvedCandidate = await resolveStructureFilepath(state.structureFilePath, candidateId);
    let candidateAnalysis;
    try {
      candidateAnalysis = await runStructureAnalysis(
        resolvedCandidate.targetFilepath, resolvedCandidate.fileContent, candidateId, 'Candidate (AF3 재결합)'
      );
    } finally {
      if (resolvedCandidate.isTemp && fs.existsSync(resolvedCandidate.targetFilepath)) {
        try { fs.unlinkSync(resolvedCandidate.targetFilepath); } catch (e) {}
      }
    }

    // parent의 원본 mutant 결합 구조 분석 결과는 job 안에서 후보마다 반복 계산하지 않고 캐시
    if (!job.parentStructureAnalysisCache) job.parentStructureAnalysisCache = {};
    let parentAnalysis = job.parentStructureAnalysisCache[record.parentInhibitorId];
    if (!parentAnalysis) {
      const parentInhibitorEntry = (job.inhibitors || []).find((i) => i.inhibitorId === record.parentInhibitorId);
      if (!parentInhibitorEntry?.structureFilePath) {
        throw new Error('이 후보의 parent 억제제에 대한 AF3 구조 파일이 없습니다.');
      }
      const resolvedParent = await resolveStructureFilepath(parentInhibitorEntry.structureFilePath, record.parentInhibitorId);
      try {
        parentAnalysis = await runStructureAnalysis(
          resolvedParent.targetFilepath, resolvedParent.fileContent, record.parentInhibitorId, 'Parent (원본 mutant 결합)'
        );
      } finally {
        if (resolvedParent.isTemp && fs.existsSync(resolvedParent.targetFilepath)) {
          try { fs.unlinkSync(resolvedParent.targetFilepath); } catch (e) {}
        }
      }
      job.parentStructureAnalysisCache[record.parentInhibitorId] = parentAnalysis;
    }

    // H-bond 개수를 1차 신호로 삼는다 — 이 플랫폼 전반에서 파마코포어 포켓의
    // "실질적 결합" 판정 기준(TIER_RANK: hbond > contact > weak > poor)과 일관되게.
    const hbondDelta = candidateAnalysis.hbonds.count - parentAnalysis.hbonds.count;
    const contactDelta = candidateAnalysis.contacts.total - parentAnalysis.contacts.total;
    let recovery;
    if (hbondDelta > 0) recovery = 'improved';
    else if (hbondDelta < 0) recovery = 'worsened';
    else if (contactDelta > 2) recovery = 'improved';
    else if (contactDelta < -2) recovery = 'worsened';
    else recovery = 'similar';

    const rankingScore = found.metrics?.ranking_score;
    const confidence = typeof rankingScore !== 'number' ? 'low'
      : rankingScore >= 0.8 ? 'high'
      : rankingScore >= 0.5 ? 'moderate'
      : 'low';

    record.af3Confidence = confidence;
    record.retainedInteractionCount = Math.min(candidateAnalysis.hbonds.count, parentAnalysis.hbonds.count);
    record.recoveredInteractionCount = Math.max(hbondDelta, 0);
    record.hasClash = !!found.metrics?.has_clash;
    if (!record.improvement) {
      record.improvement = { toxicityNasalProfile: 'unresolved', predictionConfidence: 'low', reasons: [] };
    }
    record.improvement.structuralInteractionRecovery = recovery;
    record.improvement.predictionConfidence = confidence;
    record.improvement.reasons = [
      ...(record.improvement.reasons || []).filter((r) => !r.startsWith('AF3 재결합 실측')),
      `AF3 재결합 실측: H-bond ${parentAnalysis.hbonds.count} → ${candidateAnalysis.hbonds.count}, 총 접촉 ${parentAnalysis.contacts.total} → ${candidateAnalysis.contacts.total}`,
    ];

    state.status = 'completed';
    state.parentAnalysis = parentAnalysis;
    state.candidateAnalysis = candidateAnalysis;
    state.structuralInteractionRecovery = recovery;
    job.updatedAt = new Date().toISOString();
  } catch (err) {
    state.status = 'failed';
    state.error = err.message;
  }
}

// POST /api/analysis/:jobId/reevaluate/af3 — candidate SMILES로 mutant 서열에 대해
// 실제 AF3 GPU 추론을 다시 실행한다. 완료까지 분 단위 이상 걸릴 수 있어
// 즉시 202로 응답하고, 진행 상태는 아래 GET 라우트로 폴링한다.
app.post('/api/analysis/:jobId/reevaluate/af3', async (req, res) => {
  const { jobId } = req.params;
  const { candidateId } = req.body;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ error: `Job을 찾을 수 없습니다: ${jobId}` });

  const record = (job.finalCandidates || []).find((f) => f.candidateId === candidateId);
  if (!record || !record.candidateSmiles) {
    return res.status(404).json({ error: `후보를 찾을 수 없습니다: ${candidateId}. 유도체 설계를 다시 진행해주세요.` });
  }

  if (!job.af3Rebind) job.af3Rebind = {};
  const existing = job.af3Rebind[candidateId];
  if (existing && existing.status !== 'failed' && existing.status !== 'timeout') {
    return res.status(202).json(existing);
  }

  let sequence = null;
  if (job.input && job.input.fastaText) {
    sequence = job.input.fastaText
      .split('\n')
      .filter((line) => !line.startsWith('>'))
      .join('')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  const af3InhibitorId = `deriv_${candidateId.replace(/-/g, '').slice(0, 10)}`;
  const state = { status: 'running', af3InhibitorId, startedAt: new Date().toISOString() };
  job.af3Rebind[candidateId] = state;

  try {
    await axios.post(`${AF3_ENGINE_URL}/predict`, {
      jobId,
      sequence,
      mutations: job.mutations,
      inhibitorIds: [af3InhibitorId],
      customInhibitors: { [af3InhibitorId]: record.candidateSmiles },
      dimerMode: true,
      fullInference: true,
    }, { timeout: 5000 });
  } catch (err) {
    console.log('[AF3 Rebind] predict request sent to WSL engine (may have timed out, job continues in background).');
  }

  pollAf3RebindResult(jobId, candidateId, af3InhibitorId).catch((e) => {
    console.error('[AF3 Rebind] polling error:', e.message);
    const s = job.af3Rebind[candidateId];
    if (s) { s.status = 'failed'; s.error = e.message; }
  });

  res.status(202).json(state);
});

// GET /api/analysis/:jobId/reevaluate/af3/:candidateId — 진행 상태 폴링
app.get('/api/analysis/:jobId/reevaluate/af3/:candidateId', (req, res) => {
  const { jobId, candidateId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ error: `Job을 찾을 수 없습니다: ${jobId}` });
  const state = (job.af3Rebind || {})[candidateId];
  if (!state) return res.status(404).json({ error: 'AF3 재결합이 아직 시작되지 않았습니다.' });
  res.json(state);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================================`);
  console.log(`🚀 [AF3 Proxy Server] Running on http://localhost:${PORT}`);
  console.log(`🔗 [Target Ubuntu Engine] Configured to: ${AF3_ENGINE_URL}`);
  console.log(`🛡️  [Mode] Research Use Only (No Dummy Biological Metrics)`);
  console.log(`========================================================`);
});
