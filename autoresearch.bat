@echo off
REM =============================================================================
REM AutoResearch - Launcher for Windows
REM =============================================================================
REM
REM Usage:
REM   autoresearch.bat                        # 10 iterations, current dir
REM   autoresearch.bat 10                     # 10 iterations
REM   autoresearch.bat 10 2                   # 10 iterations, 2 min interval
REM   autoresearch.bat --configure            # Setup only
REM   autoresearch.bat /path/to/project       # Custom project dir
REM   autoresearch.bat /path/to/project 10    # Custom project, 10 iterations
REM
REM =============================================================================

setlocal enabledelayedexpansion

REM Handle flags first (no argument parsing needed)
if "%~1"=="--configure" goto :configure
if "%~1"=="-c" goto :configure
if "%~1"=="--reconfigure" goto :reconfigure
if "%~1"=="-r" goto :reconfigure

REM Parse arguments: first positional can be project dir OR iterations
set "PROJECT_DIR=%~1"
set "ITERATIONS=%~2"
set "TIMEOUT=%~3"

REM If first arg is a number, it's iterations (not project dir)
set /a "NUM_TEST=%~1" 2>nul
if not "%NUM_TEST%"=="" (
    if "%~1"=="%NUM_TEST%" (
        set "PROJECT_DIR=."
        set "ITERATIONS=%~1"
        set "TIMEOUT=%~2"
    )
)

REM Defaults
if "%PROJECT_DIR%"=="" set "PROJECT_DIR=."
if "%ITERATIONS%"=="" set "ITERATIONS=10"
if "%TIMEOUT%"=="" set "TIMEOUT=5"

REM Validate iterations is a number
set /a "ITER_CHECK=%ITERATIONS%" 2>nul
if "%ITER_CHECK%"=="" set "ITERATIONS=10"
if "%ITER_CHECK%"=="0" if not "%ITERATIONS%"=="0" set "ITERATIONS=10"

REM Validate timeout is a number
set /a "TIMEOUT_CHECK=%TIMEOUT%" 2>nul
if "%TIMEOUT_CHECK%"=="" set "TIMEOUT=5"
if "%TIMEOUT_CHECK%"=="0" if not "%TIMEOUT%"=="0" set "TIMEOUT=5"

goto :run

:configure
echo.
echo ========================================================================
echo    AutoResearch - Setup
echo ========================================================================
echo.
python "%~dp0autoresearch.py" --project . --configure
echo.
pause
exit /b 0

:reconfigure
echo.
echo ========================================================================
echo    AutoResearch - Reconfigure
echo ========================================================================
echo.
python "%~dp0autoresearch.py" --project . --reconfigure
echo.
pause
exit /b 0

:run
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
python "%~dp0autoresearch.py" --project %PROJECT_DIR% --iter %ITERATIONS% --timeout %TIMEOUT%

echo.
pause
