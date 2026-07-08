export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
}

/**
 * 변이 표기 문자열 검증
 * 예: L50F/E166A/L167F 또는 L50F, E166A
 */
export const validateMutationText = (text?: string): ValidationResult => {
  if (!text || text.trim().length === 0) {
    return { valid: false, errorMessage: '변이 표기를 입력해주세요. (예: L50F/E166A/L167F)' };
  }

  const cleanText = text.trim();
  // 정규식: 1개 이상의 아미노산(1문자 또는 3문자) + 위치(숫자) + 변이아미노산, 구분자는 /, comma, 공백
  const mutationParts = cleanText.split(/[\/,;\s]+/).filter(Boolean);

  if (mutationParts.length === 0) {
    return { valid: false, errorMessage: '유효한 변이 표기 형식을 찾을 수 없습니다.' };
  }

  const partRegex = /^[A-Za-z]{1,3}\d+[A-Za-z]{1,3}$/;
  for (const part of mutationParts) {
    if (!partRegex.test(part)) {
      return {
        valid: false,
        errorMessage: `"${part}"는 올바른 변이 표기 형식이 아닙니다. (예시: L50F, E166A, L167F)`,
      };
    }
  }

  return { valid: true };
};

/**
 * FASTA 서열 검증
 */
export const validateFastaText = (text?: string): ValidationResult => {
  if (!text || text.trim().length === 0) {
    return { valid: false, errorMessage: 'FASTA 형식의 서열을 입력해주세요.' };
  }

  const lines = text.trim().split('\n');
  const sequenceLines = lines.filter((line) => !line.startsWith('>')).join('').replace(/\s+/g, '');

  if (sequenceLines.length === 0) {
    return { valid: false, errorMessage: 'FASTA 헤더 이외에 단백질 서열 데이터가 없습니다.' };
  }

  if (sequenceLines.length < 50) {
    return { valid: false, errorMessage: `입력된 서열 길이가 너무 짧습니다 (${sequenceLines.length} aa). 최소 50 아미노산 이상의 Mpro 서열이 필요합니다.` };
  }

  const validAaRegex = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
  if (!validAaRegex.test(sequenceLines)) {
    return { valid: false, errorMessage: '서열 내에 표준 20개 아미노산 외의 비정상 문자가 포함되어 있습니다.' };
  }

  return { valid: true };
};
