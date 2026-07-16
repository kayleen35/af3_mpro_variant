from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path

import pandas as pd
import streamlit as st
from PIL import Image
from rdkit.Chem import Draw

from core import (
    COMPOSITE_FORMULA,
    MPRO_FIT_FORMULA,
    NASAL_DELIVERY_FORMULA,
    PRESET_INHIBITORS,
    canonical_smiles,
    descriptors,
    mpro_similarity,
    mpro_fit_score,
    nasal_delivery_score,
    parse_smiles,
    predict_pic50,
    rank_candidates,
    score_molecule,
    spearman_rho,
)

st.set_page_config(page_title="Mpro 비강 항바이러스 후보 평가", page_icon="🧪", layout="wide")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@st.cache_data(show_spinner=False)
def load_library() -> pd.DataFrame:
    rows = json.loads((DATA_DIR / "mpro_library_full.json").read_text(encoding="utf-8"))
    return pd.DataFrame(rows)


@st.cache_data(show_spinner=False)
def load_predictions() -> pd.DataFrame:
    rows = json.loads((DATA_DIR / "mpro_predictions.json").read_text(encoding="utf-8"))
    return pd.DataFrame(rows)


def _mol_image(mol):
    image = Draw.MolToImage(mol, size=(420, 320), kekulize=True)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return Image.open(buffer)


def _format_desc(desc: dict) -> pd.DataFrame:
    rows = [
        ("분자량(MW)", f"{desc['MW']:.2f}"),
        ("MolLogP", f"{desc['MolLogP']:.2f}"),
        ("TPSA", f"{desc['TPSA']:.2f}"),
        ("HBD", desc["NumHDonors"]),
        ("HBA", desc["NumHAcceptors"]),
        ("Rotatable Bonds", desc["NumRotatableBonds"]),
        ("QED", f"{desc['QED']:.4f}"),
        ("Lipinski 통과", "예" if desc["lipinski_pass"] else "아니오"),
        ("Veber 통과", "예" if desc["veber_pass"] else "아니오"),
    ]
    return pd.DataFrame(rows, columns=["항목", "값"])


def _score_chart(scores) -> pd.DataFrame:
    return pd.DataFrame({
        "축": ["결합/적합도", "Mpro 유사도", "비강전달", "QED"],
        "점수": [scores.mpro_fit, round(scores.mpro_similarity * 100, 2), scores.nasal_delivery, scores.qed_score],
    })


def _pic50_verdict(p: float) -> str:
    if p >= 7:
        return "강력 (IC50 ≤ 100nM 추정)"
    if p >= 6:
        return "중등도"
    return "약함"


def _anthropic_summary(desc, scores, smiles: str) -> str | None:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=key)
        message = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
            max_tokens=600,
            messages=[{"role": "user", "content": (
                "한국어로 SARS-CoV-2 Mpro 후보 분자의 비임상 계산 평가를 5단계 파이프라인으로 "
                "짧고 보수적으로 작성하세요. 실험/임상 효능처럼 말하지 마세요.\n"
                f"SMILES: {smiles}\nDescriptors: {desc}\nScores: {scores}\n")}],
        )
        return "\n".join(block.text for block in message.content if hasattr(block, "text"))
    except Exception as exc:
        return f"ANTHROPIC_API_KEY가 감지되었지만 호출에 실패했습니다. 규칙 기반 결과를 사용하세요. 오류: {exc}"


def _pipeline_cards(desc, scores, pred, smiles: str) -> list[tuple[str, str]]:
    fit_level = "높음" if scores.mpro_fit >= 75 else "중간" if scores.mpro_fit >= 55 else "낮음"
    nasal_level = "유리" if scores.nasal_delivery >= 70 else "보완 필요" if scores.nasal_delivery >= 45 else "불리"
    return [
        ("가설생성", f"타겟은 SARS-CoV-2 Mpro(3CLpro). QSAR 예측 pIC50 {pred:.2f} ({_pic50_verdict(pred)}), 기준물질 최대 유사도 {scores.mpro_similarity:.3f}."),
        ("구조/결합", f"결합/적합도 축 {scores.mpro_fit:.1f}/100 ({fit_level}). ML 활성예측이 유사도 휴리스틱을 대체."),
        ("분자최적화", f"MW {desc['MW']:.1f}, logP {desc['MolLogP']:.2f}, TPSA {desc['TPSA']:.1f}, QED {desc['QED']:.3f}. 예측 pIC50 향상 방향으로 아날로그 탐색 권장."),
        ("비강제형", f"비강 전달 휴리스틱 {scores.nasal_delivery:.1f}/100 ({nasal_level}). TPSA·HBD·MW가 주요 감점 요인."),
        ("규제", "출력은 계산 기반 후보 선별 자료입니다. 독성·ADME·제형 안정성·세포/동물/임상 검증 전에는 효능 주장 불가."),
    ]


def _evaluate(smiles: str):
    mol = parse_smiles(smiles)
    desc = descriptors(mol)
    sim = mpro_similarity(mol)
    scores = score_molecule(mol)
    pred = predict_pic50(mol)
    return mol, desc, sim, scores, pred


st.title("SARS-CoV-2 Mpro 표적 비강 항바이러스 후보 평가 플랫폼")
st.caption("제4회 JUMP AI 신약개발 경진대회 | 알파폴드팀(팀장 국경희) | 멘토 홍성현(클리켐바이오 대표) | ML QSAR scaffold-CV ρ=0.81")

SECTIONS = ["개요·대회", "후보 평가", "랭킹", "모델 검증", "실측 라이브러리", "에이전트 파이프라인"]
section = st.sidebar.radio("메뉴", SECTIONS)
st.sidebar.markdown("---")
st.sidebar.caption("활성 예측: 6,368종 실측 pIC50 학습 QSAR(RandomForest). 유사도 휴리스틱(ρ=0.34) → ML(ρ=0.81).")


# ===== 개요·대회 =====
if section == "개요·대회":
    st.subheader("프로젝트 방향 전환")
    st.markdown(
        "- **초기 한계:** AlphaFold3 항체-항원 복합체 예측 정확도가 현저히 낮은 구조적 한계 확인.\n"
        "- **전환:** 타겟을 스파이크 → **Mpro(Main Protease) 리간드/저해제 결합 예측**으로, 응용을 알부민 → **비강 스프레이 국소 전달**로 조정.\n"
        "- **과학적 방법론:** 유사도 휴리스틱(ρ=0.34)을 넘어 6,368종 실측 pIC50 학습 **QSAR 회귀모델** 도입."
    )
    c1, c2, c3 = st.columns(3)
    c1.metric("RandomForest (서버)", "ρ = 0.81", "R²=0.64")
    c2.metric("Ridge 선형 (브라우저)", "ρ = 0.76", "R²=0.54")
    c3.metric("유사도 베이스라인", "ρ = 0.34", "기존")
    st.markdown("#### 개발 시 고려사항")
    st.markdown(
        "- 충분한 비강 점막 체류시간 확보  \n- 점막 투과성 향상  \n- 약물의 화학적 안정성  \n"
        "- 적절한 분무 입자 크기 및 제형 최적화  \n- 동물모델  \n- 국소 독성 및 점막 자극성 평가  \n- 약동학(PK)·약력학(PD) 검증"
    )
    st.markdown("#### 제4회 AI 신약개발 경진대회 (4th JUMP AI)")
    st.markdown(
        "- **주최** 보건복지부 · **주관** 한국보건산업진흥원(KHIDI)  \n"
        "- **테마** 신약개발 단계별 특화 에이전틱(Agentic) AI 설계·구현  \n"
        "- **일정** 예선 ~8/7 · 본선 9/7~10/2 · 수상 11/6 · **시상** 대상 장관상 + 1,000만원  \n"
        "- **팀** 아시아경제교육센터 알파폴드팀(국경희) · **멘토** 홍성현(클리켐바이오)"
    )
    st.info("라이브 웹 데모(오프라인 PWA·엣지 상시): https://mpro.wnffn62.workers.dev")


# ===== 후보 평가 =====
elif section == "후보 평가":
    st.subheader("단일 후보 평가")
    preset_name = st.selectbox("기준/예시 물질", list(PRESET_INHIBITORS.keys()))
    smiles = st.text_area("SMILES", value=PRESET_INHIBITORS[preset_name], height=110)
    if st.button("계산 실행", type="primary"):
        st.session_state["current_smiles"] = smiles

    active_smiles = st.session_state.get("current_smiles", smiles)
    try:
        mol, desc, sim, scores, pred = _evaluate(active_smiles)
        left, right = st.columns([1, 1.2])
        with left:
            st.image(_mol_image(mol), caption="RDKit 구조 렌더링")
            st.code(canonical_smiles(mol), language="text")
        with right:
            m1, m2 = st.columns(2)
            m1.metric("예측 pIC50 (ML QSAR)", f"{pred:.2f}", _pic50_verdict(pred))
            ic50 = 10 ** (9 - pred)
            m2.metric("추정 IC50", f"{ic50/1000:.1f} µM" if ic50 >= 1000 else f"{ic50:.0f} nM")
            st.metric("개발성 종합점수(Composite)", f"{scores.composite:.2f}/100")
            st.dataframe(_format_desc(desc), use_container_width=True, hide_index=True)

        st.bar_chart(_score_chart(scores), x="축", y="점수", height=280)
        with st.expander("투명 산식/가중치 보기", expanded=False):
            st.markdown("**비강 전달 점수**")
            st.table(pd.DataFrame(NASAL_DELIVERY_FORMULA.items(), columns=["항목", "산식"]))
            st.markdown("**Mpro 결합/적합도 점수**")
            st.table(pd.DataFrame(MPRO_FIT_FORMULA.items(), columns=["항목", "산식"]))
            st.markdown("**종합 점수 가중치**")
            st.table(pd.DataFrame(COMPOSITE_FORMULA.items(), columns=["축", "가중치"]))
    except Exception as exc:
        st.error(str(exc))


# ===== 랭킹 =====
elif section == "랭킹":
    st.subheader("다중 후보 랭킹")
    preset_lines = "\n".join(f"{name}\t{smiles}" for name, smiles in PRESET_INHIBITORS.items())
    use_presets = st.checkbox("기준 Mpro 저해제 3종 포함", value=True)
    multi_smiles = st.text_area("후보 SMILES (한 줄에 하나, 선택적으로 '이름<TAB>SMILES')",
                                value=preset_lines if use_presets else "", height=180)
    sort_key = st.radio("정렬 기준", ["예측 pIC50 (활성)", "종합점수 (개발성)"], horizontal=True)
    if st.button("랭킹 계산", type="primary"):
        ranking = rank_candidates(multi_smiles.splitlines())
        if not ranking.empty:
            col = "PredPic50" if sort_key.startswith("예측") else "CompositeScore"
            ranking = ranking.sort_values(by=col, ascending=False, na_position="last").reset_index(drop=True)
        st.session_state["ranking"] = ranking

    if "ranking" in st.session_state:
        ranking = st.session_state["ranking"]
        st.dataframe(ranking, use_container_width=True, hide_index=True)
        st.download_button("CSV 다운로드", ranking.to_csv(index=False).encode("utf-8-sig"),
                           file_name="mpro_candidate_ranking.csv", mime="text/csv")


# ===== 모델 검증 =====
elif section == "모델 검증":
    st.subheader("모델 검증 — 예측 pIC50 vs 실측 pIC50 (scaffold-CV, out-of-fold)")
    st.caption("Murcko 골격 단위 5-fold GroupKFold. 학습에 쓰이지 않은 분자만 예측한 정직한 일반화 성능.")
    df = load_predictions()
    choice = st.radio("예측 소스", ["RandomForest (pred_rf)", "Ridge 선형 (pred_ridge)", "유사도 (similarity)"], horizontal=True)
    col = {"R": "pred_rf", "R2": "pred_ridge"}.get("R" if choice.startswith("Random") else "R2", "similarity")
    if choice.startswith("유사도"):
        col = "similarity"
        x, y = df["similarity"], df["pIC50"]
        rho = spearman_rho(x, y)
        st.metric("Spearman ρ (유사도 vs 실측)", f"{rho:.3f}")
        st.scatter_chart(pd.DataFrame({"유사도": x, "실측 pIC50": y}), x="유사도", y="실측 pIC50", height=440)
    else:
        rho = spearman_rho(df[col], df["pIC50"])
        st.metric(f"Spearman ρ ({col} vs 실측)", f"{rho:.3f}")
        plot = pd.DataFrame({"실측 pIC50": df["pIC50"], "예측 pIC50": df[col]})
        st.scatter_chart(plot, x="실측 pIC50", y="예측 pIC50", height=440)
    st.caption(f"검증 대상 {len(df):,}종. 대각선(예측=실측)에 가까울수록 정확.")


# ===== 실측 라이브러리 =====
elif section == "실측 라이브러리":
    st.subheader("실측 Mpro 라이브러리 (통합 6,368종)")
    df = load_library()
    src_counts = df["src"].value_counts().to_dict()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("총 화합물", f"{len(df):,}")
    c2.metric("ChEMBL", f"{src_counts.get('ChEMBL', 0):,}")
    c3.metric("Moonshot", f"{src_counts.get('Moonshot', 0):,}")
    c4.metric("pIC50 중앙값", f"{df['pIC50'].median():.2f}")
    query = st.text_input("검색 (id / SMILES / 출처)")
    view = df
    if query:
        q = query.lower()
        view = df[df.apply(lambda r: q in str(r["id"]).lower() or q in str(r["smiles"]).lower() or q in str(r["src"]).lower(), axis=1)]
    cols = ["id", "src", "pIC50", "MW", "logP", "similarity", "composite", "composite_act"]
    st.dataframe(view[cols].sort_values("pIC50", ascending=False), use_container_width=True, hide_index=True, height=440)
    st.download_button("전체 CSV 다운로드", df[cols].to_csv(index=False).encode("utf-8-sig"),
                       file_name="mpro_library_6368.csv", mime="text/csv")


# ===== 에이전트 파이프라인 =====
elif section == "에이전트 파이프라인":
    st.subheader("계산 결과 기반 에이전트 파이프라인")
    agent_smiles = st.text_area("파이프라인 입력 SMILES",
                                value=st.session_state.get("current_smiles", PRESET_INHIBITORS["GC376"]), height=110)
    if st.button("파이프라인 생성", type="primary"):
        try:
            mol, desc, _, scores, pred = _evaluate(agent_smiles)
            st.session_state["pipeline_result"] = (desc, scores, pred, canonical_smiles(mol), agent_smiles)
        except Exception as exc:
            st.error(str(exc))

    if "pipeline_result" in st.session_state:
        desc, scores, pred, canon, raw_smiles = st.session_state["pipeline_result"]
        ai_text = _anthropic_summary(desc, scores, raw_smiles)
        if ai_text:
            st.info(ai_text)
        for title, body in _pipeline_cards(desc, scores, pred, canon):
            with st.container(border=True):
                st.markdown(f"**{title}**")
                st.write(body)
        c1, c2 = st.columns(2)
        c1.metric("예측 pIC50", f"{pred:.2f}", _pic50_verdict(pred))
        c2.metric("종합 우선순위", f"{scores.composite:.2f}/100")

st.divider()
st.caption("주의: 모든 결과는 RDKit·ML 기반 계산 예측값입니다. 비임상 참고자료이며 실험/독성/임상 효능 또는 허가 자료가 아닙니다.")
