@echo off
REM =============================================================================
REM AutoResearch - Launcher for Windows
REM =============================================================================
REM
REM Usage:
REM   autoresearch.bat                    # Интерактивный режим
REM   autoresearch.bat 10                 # 10 итераций
REM   autoresearch.bat 10 2               # 10 итераций, 2 мин интервал
REM   autoresearch.bat --configure        # Только настройка
REM
REM =============================================================================

setlocal enabledelayedexpansion

REM Парсинг аргументов
set PROJECT_DIR=%1
set ITERATIONS=%2
set TIMEOUT=%3

REM Если проект не указан - используем текущую директорию
if "%PROJECT_DIR%"=="" set PROJECT_DIR=.
if "%PROJECT_DIR%"=="--configure" set PROJECT_DIR=.
if "%PROJECT_DIR%"=="--reconfigure" set PROJECT_DIR=.
if "%PROJECT_DIR%"=="-c" set PROJECT_DIR=.
if "%PROJECT_DIR%"=="-r" set PROJECT_DIR=.

REM Если итерации не указаны - используем дефолт
if "%ITERATIONS%"=="" set ITERATIONS=10
if "%ITERATIONS%"=="--configure" set ITERATIONS=10
if "%ITERATIONS%"=="--reconfigure" set ITERATIONS=10
if "%ITERATIONS%"=="-c" set ITERATIONS=10
if "%ITERATIONS%"=="-r" set ITERATIONS=10

REM Если таймаут не указан - используем дефолт
if "%TIMEOUT%"=="" set TIMEOUT=5
echo %TIMEOUT% | findstr /r "^[0-9][0-9]*$">nul
if errorlevel 1 set TIMEOUT=5

echo.
echo ========================================================================
echo    AutoResearch
echo ========================================================================
echo.
echo   Проект: %PROJECT_DIR%
echo   Итераций: %ITERATIONS%
echo   Интервал: %TIMEOUT% мин
echo.

REM Проверка Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python не найден
    echo Установите Python 3.10+ и добавьте в PATH
    pause
    exit /b 1
)

REM Проверка Claude CLI
where claude >nul 2>&1
if errorlevel 1 (
    echo ERROR: Claude CLI не найден
    echo.
    echo Установите Claude Code CLI:
    echo   npm install -g @anthropic-ai/claude-code
    echo.
    pause
    exit /b 1
)

echo Все зависимости найдены!
echo.

REM Запуск
echo Запуск AutoResearch...
echo.
python "%~dp0autoresearch.py" --project %PROJECT_DIR% --iter %ITERATIONS% --timeout %TIMEOUT% %*

echo.
pause
