# -*- coding: utf-8 -*-
"""쉬운 설명 PPT(8장) → 한국어 내레이션 영상(mp4). ffmpeg 합성, moviepy 불필요."""
import subprocess, sys, os
from pathlib import Path
import fitz
sys.path.insert(0, str(Path(__file__).parent))
from tts import synth

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
PDF = PKG / "NasoMpro-AI_쉬운설명.pdf"
FR = HERE / "frames"; AU = HERE / "audio"; SEG = HERE / "segments"
for d in (FR, AU, SEG): d.mkdir(parents=True, exist_ok=True)
OUT = PKG / "NasoMpro-AI_쉬운설명_영상.mp4"

# 슬라이드별 내레이션 (8장)
NARR = [
 "코로나 바이러스를 막는 약 후보를, 인공지능이 더 빠르고 정확하게 골라주는 도구를 소개합니다.",
 "바이러스가 몸속에서 복사되려면, 엠프로라는 가위 같은 효소가 꼭 필요합니다. 이 가위를 막으면 바이러스는 퍼지지 못합니다.",
 "분자의 화학식만 넣으면, 인공지능이 몇 초 만에 예측 점수를 계산하고, 코 스프레이로 쓰기 좋은지까지 알려줍니다.",
 "이 예측이 얼마나 정확한지, 정답이 있는 육천삼백여 개 물질로 엄격하게 채점했습니다. 예전 방식 영점 삼사보다 훨씬 정확한 영점 팔일을 기록했습니다.",
 "더 나아가, 인공지능 에이전트가 스스로 더 강한 후보를 찾아냅니다. 예를 들어 한 물질을 육점 구사 점에서 칠점 구사 점으로 끌어올렸습니다.",
 "복잡한 설치 없이 인터넷 주소 하나로, 인터넷이 끊겨도, 심지어 우리 컴퓨터가 꺼져 있어도 언제든 접속됩니다.",
 "정리하면, 신약 후보를 더 빠르게, 더 정확하게, 그리고 근거를 갖고 골라낼 수 있습니다.",
 "지금 바로 인터넷 주소로 직접 확인해 보세요. 단, 모든 숫자는 연구용 예측이며 실제 치료 판단은 아닙니다.",
]

def probe(p):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(p)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())

# 1) 프레임 렌더 (1920x1080)
doc = fitz.open(str(PDF))
assert doc.page_count == len(NARR), f"슬라이드 {doc.page_count} != 내레이션 {len(NARR)}"
mat = fitz.Matrix(1920/ (13.333*72) * 72, 1080/(7.5*72) * 72)  # scale to 1920x1080
for i in range(doc.page_count):
    pix = doc[i].get_pixmap(matrix=fitz.Matrix(1920/doc[i].rect.width, 1080/doc[i].rect.height))
    pix.save(str(FR / f"f{i+1}.png"))
print("프레임", doc.page_count, "장 렌더")

# 2) 오디오 생성 + 세그먼트
seg_list = HERE / "concat.txt"
lines = []
for i, text in enumerate(NARR, 1):
    a = AU / f"s{i}.mp3"
    if not a.exists():
        synth(text, str(a)); print(f"  음성 {i} 생성")
    dur = probe(a)
    total = round(dur + 0.9, 2)  # 말 끝 여유
    seg = SEG / f"seg{i}.mp4"
    vf = f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.35,fade=t=out:st={total-0.4}:d=0.4"
    subprocess.run(["ffmpeg","-y","-loop","1","-i",str(FR/f'f{i}.png'),"-i",str(a),
        "-c:v","libx264","-t",str(total),"-r","30","-pix_fmt","yuv420p","-vf",vf,
        "-c:a","aac","-b:a","192k","-af","apad",
        str(seg)], check=True, capture_output=True)
    lines.append(f"file '{seg.as_posix()}'")
    print(f"  세그먼트 {i}: {total}s")
seg_list.write_text("\n".join(lines), encoding="utf-8")

# 3) concat
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(seg_list),
    "-c","copy",str(OUT)], check=True, capture_output=True)
print("완성:", OUT, round(OUT.stat().st_size/1024/1024,2), "MB", "·", round(probe(OUT),1), "초")
