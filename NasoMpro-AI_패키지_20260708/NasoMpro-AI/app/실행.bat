@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
echo.
echo [클리켐바이오] Mpro 비강 항바이러스 후보 평가 플랫폼
echo 첫 실행은 Python 가상환경 생성 및 패키지 설치 때문에 시간이 걸릴 수 있습니다.
echo.
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 (
        echo Python 가상환경 생성에 실패했습니다. Python 설치와 PATH를 확인하세요.
        pause
        exit /b 1
    )
)
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo 패키지 설치에 실패했습니다. 위 오류 메시지를 확인하세요.
    pause
    exit /b 1
)
echo.
echo 브라우저가 자동으로 열립니다. 종료하려면 이 창에서 Ctrl+C를 누르세요.
start "" powershell -WindowStyle Hidden -Command "Start-Sleep 6; Start-Process 'http://localhost:8501'"
streamlit run app.py
pause
