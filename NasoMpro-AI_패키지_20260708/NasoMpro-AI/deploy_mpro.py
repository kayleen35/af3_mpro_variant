# -*- coding: utf-8 -*-
r"""전용 Cloudflare Worker 'mpro' 로 정적 PWA(web/ 전체) 를 엣지 완전호스팅.

- QR 고정주소: https://mpro.<subdomain>.workers.dev  (PC 꺼져도 엣지가 서빙)
- 기존 go 허브/와치독은 건드리지 않음(별도 스크립트라 덮어쓰기 없음).
- web/ 안의 모든 파일(html/js/json/css)을 자동 포함해 서빙.
- RDKit-WASM 은 jsdelivr CDN + PWA service worker 캐시로 오프라인 동작.

사용: python deploy_mpro.py            # web/ 배포
      python deploy_mpro.py --status  # 토큰/서브도메인 확인만
"""
import json
import re
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
WD = Path(r"C:\Users\에스앤피랩\Desktop\클로드테스트\상시접속_와치독")
TOKEN = (WD / ".cf_token").read_text(encoding="utf-8").strip()
_ENV = Path(r"C:\Users\에스앤피랩\Desktop\클로드테스트\tools\claude-code-video-toolkit\.env")
ACCOUNT_ID = re.search(r"R2_ACCOUNT_ID=(\w+)", _ENV.read_text(encoding="utf-8")).group(1)
SCRIPT_NAME = "mpro"

API = "https://api.cloudflare.com/client/v4"
H = {"Authorization": f"Bearer {TOKEN}"}

CT_BY_EXT = {
    ".html": "text/html;charset=utf-8",
    ".js": "application/javascript;charset=utf-8",
    ".json": "application/json;charset=utf-8",
    ".css": "text/css;charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain;charset=utf-8",
    ".md": "text/plain;charset=utf-8",
}


def get_subdomain():
    r = requests.get(f"{API}/accounts/{ACCOUNT_ID}/workers/subdomain", headers=H, timeout=20)
    j = r.json()
    if j.get("success"):
        return (j.get("result") or {}).get("subdomain")
    print("subdomain 조회 실패:", json.dumps(j.get("errors"), ensure_ascii=False)[:300])
    return None


def read_web_files():
    """web/ 안 모든 텍스트 파일을 {경로: 본문}, {경로: content-type} 으로."""
    if not (WEB / "index.html").exists():
        raise RuntimeError(f"web/index.html 없음: {WEB/'index.html'}")
    files, ct = {}, {}
    for p in sorted(WEB.rglob("*")):
        if not p.is_file():
            continue
        rel = "/" + p.relative_to(WEB).as_posix()
        ext = p.suffix.lower()
        content_type = CT_BY_EXT.get(ext, "text/plain;charset=utf-8")
        if ext == ".json" and p.name == "manifest.json":
            content_type = "application/manifest+json;charset=utf-8"
        try:
            body = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue  # 바이너리는 스킵(현재 없음)
        files[rel] = body
        ct[rel] = content_type
    # 루트 별칭
    files["/"] = files["/index.html"]
    ct["/"] = ct["/index.html"]
    return files, ct


def build_script(files, ct) -> str:
    return (
        "// NasalMpro 정적 PWA 엣지 호스팅 (자동 생성 · web/ 전체)\n"
        f"const FILES = {json.dumps(files, ensure_ascii=False)};\n"
        f"const CT = {json.dumps(ct, ensure_ascii=False)};\n"
        "addEventListener('fetch', (event) => {\n"
        "  const url = new URL(event.request.url);\n"
        "  let p = url.pathname;\n"
        "  if (p === '') p = '/';\n"
        "  let body = FILES[p];\n"
        "  let ctype = CT[p] || 'text/html;charset=utf-8';\n"
        "  if (body === undefined) { body = FILES['/']; ctype = CT['/']; }\n"  # SPA fallback
        "  event.respondWith(new Response(body, { headers: {\n"
        "    'content-type': ctype,\n"
        "    'cache-control': 'no-cache',\n"
        "    'service-worker-allowed': '/'\n"
        "  }}));\n"
        "});\n"
    )


def deploy() -> str:
    files, ct = read_web_files()
    script = build_script(files, ct)
    size_kb = len(script.encode("utf-8")) / 1024
    print(f"Worker 스크립트 크기: {size_kb:.1f} KB (파일 {len(files)}개: {', '.join(sorted(k for k in files if k!='/'))})")
    r = requests.put(
        f"{API}/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}",
        headers={**H, "Content-Type": "application/javascript"},
        data=script.encode("utf-8"), timeout=60,
    )
    j = r.json()
    if not j.get("success"):
        raise RuntimeError(f"Worker 배포 실패: {json.dumps(j.get('errors'), ensure_ascii=False)[:400]}")
    requests.post(
        f"{API}/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/subdomain",
        headers={**H, "Content-Type": "application/json"},
        json={"enabled": True}, timeout=20,
    )
    sub = get_subdomain()
    base = f"https://{SCRIPT_NAME}.{sub}.workers.dev"
    (HERE / "고정주소.txt").write_text(base + "\n", encoding="utf-8")
    print("배포 완료:", base)
    return base


if __name__ == "__main__":
    if "--status" in sys.argv:
        print("subdomain:", get_subdomain() or "(없음)")
    else:
        deploy()
