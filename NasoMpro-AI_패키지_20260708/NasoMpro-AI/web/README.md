# NasalMpro

`NasalMpro`는 SARS-CoV-2 Mpro 저해제 후보를 비강 항바이러스 후보 관점에서 빠르게 선별하기 위한 정적 PWA입니다. 서버와 빌드 과정 없이 브라우저에서만 실행되며, RDKit MinimalLib WebAssembly를 사용해 SMILES 파싱, 분자량, logP, TPSA, HBD/HBA, 회전결합 수, Morgan fingerprint, Tanimoto 유사도, SVG 구조 렌더링을 실제로 계산합니다.

## 실행

```powershell
cd web
python -m http.server 8787
```

브라우저에서 `http://127.0.0.1:8787/`을 엽니다.

## 오프라인/PWA 동작

첫 접속 시 `sw.js` 서비스 워커가 앱 셸(`index.html`, `manifest.json`)과 RDKit CDN 파일을 캐시에 저장합니다.

- `https://cdn.jsdelivr.net/npm/@rdkit/rdkit/dist/RDKit_minimal.js`
- `https://cdn.jsdelivr.net/npm/@rdkit/rdkit/dist/RDKit_minimal.wasm`

이후 같은 브라우저에서 다시 접속하면 네트워크가 꺼져 있어도 캐시된 파일로 실행됩니다. 단, 완전 오프라인 사용은 최소 한 번 온라인으로 정상 로드되어 서비스 워커 설치와 캐시 저장이 끝난 뒤 가능합니다.

## 점수

점수는 데스크톱 core 로직과 맞추기 위해 지정된 식을 그대로 사용합니다.

- 비강 전달성: MW, logP, TPSA, HBD, RotB, QED 기반
- Mpro 적합도: Morgan fingerprint Tanimoto 유사도, QED, TPSA, MW, HBA, RotB, Lipinski 통과 여부 기반
- Composite: Mpro 적합도, 유사도, 비강 전달성, QED 가중합

RDKit descriptor에 QED가 없으면 실제 descriptor로 만든 투명한 약물성 proxy를 쓰며, 화면과 CSV에 `QED(근사)`로 표시합니다.

## 주의

본 도구는 비임상 예측 및 후보 우선순위화 보조 도구입니다. 실험 데이터, 독성시험, 임상 데이터, 품목허가 판단을 대체하지 않습니다.
