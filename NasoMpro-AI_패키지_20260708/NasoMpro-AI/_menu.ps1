$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$py = Join-Path $root "app\.venv\Scripts\python.exe"
$backend = Join-Path $root "mvp_fullstack\backend"
$url = "https://mpro.wnffn62.workers.dev"
$pdf = Join-Path $root "제출패키지\NasalMpro_ALBOMB_기술보고서.pdf"
$ppt = Join-Path $root "제출패키지\NasoMpro-AI_기술브리핑.pptx"
$readme = Join-Path $root "README.md"

function Show-Menu {
  Clear-Host
  Write-Host ""
  Write-Host "  NasoMpro-AI  통합 실행 메뉴" -ForegroundColor Cyan
  Write-Host "  SARS-CoV-2 Mpro 비강 항바이러스 + 자율 에이전트" -ForegroundColor DarkCyan
  Write-Host "  --------------------------------------------------"
  Write-Host "   1) 배포형 PWA 열기            (오프라인·대회 데모)"
  Write-Host "   2) 제품형 풀스택 로컬 실행     (FastAPI + Swagger)"
  Write-Host "   3) 로컬 Streamlit 분석 도구"
  Write-Host "   4) 기술 보고서(PDF) 열기"
  Write-Host "   5) 기술 브리핑(PPT) 열기"
  Write-Host "   6) 통합 안내(README) 열기"
  Write-Host "   0) 종료"
  Write-Host "  --------------------------------------------------"
}

while ($true) {
  Show-Menu
  $c = Read-Host "  선택"
  switch ($c) {
    "1" { Start-Process $url }
    "2" {
      if (Test-Path $py) {
        $cmd = "Set-Location '$backend'; `$env:PYTHONIOENCODING='utf-8'; & '$py' -m uvicorn app.main:app --reload --port 8000"
        Start-Process powershell -ArgumentList "-NoExit","-NoProfile","-Command",$cmd
        Start-Sleep -Seconds 4
        Start-Process "http://localhost:8000/docs"
        Write-Host "  -> 백엔드가 새 창에서 실행 중입니다. 창을 닫으면 종료됩니다." -ForegroundColor Green
        Start-Sleep -Seconds 2
      } else { Write-Host "  venv를 찾을 수 없습니다: $py" -ForegroundColor Red; Start-Sleep 3 }
    }
    "3" {
      $bat = Join-Path $root "app\실행.bat"
      if (Test-Path $bat) { Start-Process $bat } else { Write-Host "  app\실행.bat 없음" -ForegroundColor Red; Start-Sleep 3 }
    }
    "4" { Start-Process $pdf }
    "5" { Start-Process $ppt }
    "6" { Start-Process $readme }
    "0" { break }
    default { }
  }
}
