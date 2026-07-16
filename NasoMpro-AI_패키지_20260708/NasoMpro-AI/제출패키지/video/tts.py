# -*- coding: utf-8 -*-
import sys, os, re
from pathlib import Path
TK = Path(r"C:\Users\에스앤피랩\Desktop\클로드테스트\tools\claude-code-video-toolkit\.env")
key = ""
for line in TK.read_text(encoding="utf-8").splitlines():
    m = re.match(r"ELEVENLABS_API_KEY=(.*)", line)
    if m: key = m.group(1).strip()
os.environ["ELEVENLABS_API_KEY"] = key
from elevenlabs.client import ElevenLabs
client = ElevenLabs(api_key=key)
VOICE = "EXAVITQu4vr4xnSDxMaL"  # Sarah (female, multilingual)
def synth(text, out):
    audio = client.text_to_speech.convert(voice_id=VOICE, model_id="eleven_multilingual_v2",
        text=text, output_format="mp3_44100_128")
    with open(out, "wb") as f:
        for chunk in audio: f.write(chunk)
    return out
if __name__ == "__main__":
    out = sys.argv[2] if len(sys.argv) > 2 else "test.mp3"
    synth(sys.argv[1], out); print("OK", out, os.path.getsize(out), "bytes")
