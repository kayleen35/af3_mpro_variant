import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dna, FileText, Play, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { REFERENCE_SEQUENCES, validateMutationText, validateFastaText } from '../utils';
import { createAnalysisJob } from '../api/analysisApi';
import type { MutationInput } from '../types/analysis';

export const SequenceInputPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'mutation' | 'fasta'>('mutation');
  const [referenceId, setReferenceId] = useState<string>(REFERENCE_SEQUENCES[0].id);
  const [mutationText, setMutationText] = useState<string>('');
  const [fastaText, setFastaText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 입력 검증
    if (mode === 'mutation') {
      const val = validateMutationText(mutationText);
      if (!val.valid) {
        setError(val.errorMessage || '변이 표기 검증 오류');
        return;
      }
    } else {
      const val = validateFastaText(fastaText);
      if (!val.valid) {
        setError(val.errorMessage || 'FASTA 서열 검증 오류');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const input: MutationInput = {
        mode,
        referenceId,
        mutationText: mode === 'mutation' ? mutationText.trim() : undefined,
        fastaText: mode === 'fasta' ? fastaText.trim() : undefined,
      };

      const job = await createAnalysisJob(input);
      // 성공하면 /mutation?jobId=... 이동
      navigate(`/mutation?jobId=${job.jobId}`);
    } catch (err: any) {
      console.error('Job creation failed:', err);
      setError(
        err?.response?.data?.message ||
          '백엔드 Proxy 또는 로컬 Ubuntu AF3 서버에 분석 요청을 보내는 중 오류가 발생했습니다. 서버 연결 상태를 확인해주세요.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-[#243047] pb-4">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
          <Dna className="w-7 h-7 text-cyan-400" />
          <span>단백질 서열 및 변이 입력</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          SARS-CoV-2 Mpro(3CLpro) 변이 정보를 입력하여 로컬 AlphaFold3 연산 및 구조 분석을 시작합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-6">
            {/* Reference Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Reference Sequence (참고 서열 기준)
              </label>
              <select
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-200 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {REFERENCE_SEQUENCES.map((seq) => (
                  <option key={seq.id} value={seq.id}>
                    {seq.label}
                  </option>
                ))}
              </select>
              <p className="text-[14px] text-gray-500 mt-1.5 font-mono">
                * Wuhan-Hu-1 Wild-Type Mpro 서열 (306 아미노산)을 기본 템플릿으로 사용합니다.
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                입력 방식 선택
              </label>
              <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl bg-[#141b2d] border border-[#243047]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('mutation');
                    setError(null);
                  }}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    mode === 'mutation'
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Dna className="w-4 h-4" />
                  <span>변이 표기 입력</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('fasta');
                    setError(null);
                  }}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    mode === 'fasta'
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>FASTA 서열 입력</span>
                </button>
              </div>
            </div>

            {/* Input Area */}
            <div>
              {mode === 'mutation' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-300 font-mono">
                    변이 표기 목록 (슬래시 `/`, 콤마 `,`, 공백 구분)
                  </label>
                  <input
                    type="text"
                    value={mutationText}
                    onChange={(e) => setMutationText(e.target.value)}
                    placeholder="예: L50F/E166A/L167F"
                    className="w-full px-4 py-3.5 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-100 font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <p className="text-[14px] text-gray-500">
                    * 잔기 번호와 변이 아미노산을 입력하세요. (예: L50F는 50번 류신이 페닐알라닌으로 치환됨을 의미)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-300 font-mono">
                    전체 단백질 서열 (FASTA Format)
                  </label>
                  <textarea
                    rows={8}
                    value={fastaText}
                    onChange={(e) => setFastaText(e.target.value)}
                    placeholder=">SARS-CoV-2 Mpro Mutant&#10;SGFRKMAFPSGKVEGCMVQVTCGTTTLNGLWLDDVVYCPRHVICTSEDMLNPNYEDLLIRKSNHNFLVQAGNVQLRVIGHSMQNCVLKLKVDTANPKTPKYKFVRIQPGQTFSVLACYNGSPSGVYQCAMRPNFTIKGSFLNGSCGSVGFNIDYDCVSFCYMHHMELPTGVHAGTDLEGNFYGPFVDRQTAQAAGTDTTITVNVLAWLYAAVINGDRWFLNRFTTTLNDFNLVAMKYNYEPLTQDHVDILGPLSAQTGIAVLDMCASLKELLQNGMNGRTILGSALLEDEFTPFDVVRQCSGVTFQ"
                    className="w-full p-4 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-100 font-mono text-xs placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
                  />
                  <p className="text-[14px] text-gray-500">
                    * 헤더 Line(&gt;)은 자동 필터링되며, 20개 표준 아미노산 기호만 허용됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-mono">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>로컬 AF3 서버 검증 및 Job 생성 중...</span>
                  </span>
                ) : (
                  <>
                    <span>변이 분석 시작</span>
                    <Play className="w-4 h-4 fill-current" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Info Panel */}
        <div className="space-y-6">
          <div className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-5">
            <div className="flex items-center gap-2 border-b border-[#243047] pb-3">
              <Info className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-gray-100">Mpro 구조 분석 가이드</h3>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <p>
                <strong className="text-cyan-300">SARS-CoV-2 Mpro (3CLpro)</strong>는 바이러스 복제에 필수적인
                시스테인 프로테아제로, 항바이러스제 개발의 가장 중요한 타겟 중 하나입니다.
              </p>
              <div className="p-3 rounded-xl bg-[#141b2d] border border-[#243047] font-mono text-[14px] text-violet-300">
                <span className="block font-bold text-gray-200 mb-1">Dimer-based Analysis</span>
                Mpro는 2량체(Dimer) 상태에서 촉매 활성을 나타내므로, 본 플랫폼의 모든 AlphaFold3 연산은
                Homodimer 복합체 모드로 고정 실행됩니다.
              </div>
            </div>

            <div className="pt-3 border-t border-[#243047] space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-2.5 text-[14px] text-amber-200/90">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-300 mb-0.5">Research Use Only</span>
                  본 플랫폼은 구조 예측 기반 연구용 분석 도구입니다. 산출된 복합체 구조는 임상 진단이나 치료 의사결정에
                  직접 사용할 수 없습니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SequenceInputPage;
