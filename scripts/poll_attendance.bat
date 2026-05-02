@echo off
REM Poll the latest .mdb in data_in\ and sync to Supabase.
REM Prompts the user for a date range, or syncs the full mdb.
REM Optional CLI usage: poll_attendance.bat 2026-04-01 2026-04-30

setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0\.."

where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set "PY=py -3"
) else (
    set "PY=python"
)

%PY% -c "import pyodbc, requests" 2>nul
if errorlevel 1 (
    echo Installing required packages: pyodbc, requests
    %PY% -m pip install --quiet pyodbc requests || goto :fail
)

set "START_DATE=%~1"
set "END_DATE=%~2"

if not "%START_DATE%"=="" if not "%END_DATE%"=="" goto :run

echo.
echo ================================================================
echo  D'Aisle Attendance - Poll mdb -^> Supabase
echo ================================================================
echo.
echo  Choose what to sync:
echo    [1] Full mdb (all dates found in the file)
echo    [2] Specific date range
echo    [3] Today only
echo    [4] Last 7 days
echo    [5] Current month
echo    [Q] Quit
echo.
set /p "CHOICE=Selection [1-5/Q]: "

if /i "%CHOICE%"=="Q" exit /b 0
if "%CHOICE%"=="1" goto :run
if "%CHOICE%"=="2" goto :ask_range
if "%CHOICE%"=="3" goto :today
if "%CHOICE%"=="4" goto :last7
if "%CHOICE%"=="5" goto :month
echo Invalid choice.
goto :fail

:ask_range
echo.
set /p "START_DATE=Start date (YYYY-MM-DD): "
set /p "END_DATE=End date   (YYYY-MM-DD): "
goto :run

:today
for /f %%i in ('%PY% -c "from datetime import date;print(date.today().isoformat())"') do set "START_DATE=%%i"
set "END_DATE=%START_DATE%"
goto :run

:last7
for /f %%i in ('%PY% -c "from datetime import date,timedelta;print((date.today()-timedelta(days=6)).isoformat())"') do set "START_DATE=%%i"
for /f %%i in ('%PY% -c "from datetime import date;print(date.today().isoformat())"') do set "END_DATE=%%i"
goto :run

:month
for /f %%i in ('%PY% -c "from datetime import date;print(date.today().replace(day=1).isoformat())"') do set "START_DATE=%%i"
for /f %%i in ('%PY% -c "from datetime import date;print(date.today().isoformat())"') do set "END_DATE=%%i"
goto :run

:run
echo.
if "%START_DATE%"=="" (
    %PY% scripts\poll_attendance.py
) else (
    echo Range: %START_DATE% .. %END_DATE%
    %PY% scripts\poll_attendance.py --start "%START_DATE%" --end "%END_DATE%"
)
if errorlevel 1 goto :fail

echo.
echo [OK] Poll complete.
exit /b 0

:fail
echo.
echo [FAIL] Poll script exited with an error.
exit /b 1
