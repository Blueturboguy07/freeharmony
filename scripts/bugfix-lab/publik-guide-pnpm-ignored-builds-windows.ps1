# bugfix-lab oracle body for cluster publik-guide-pnpm-ignored-builds-windows.
#
# Runs the LITERAL publik FreeHarmony Windows guide steps that a guide-installer
# runs today (rendered from lib/guides/freeharmony.ts, version 9):
#   step 3  npm.cmd install -g pnpm
#   step 4  git clone https://github.com/Blueturboguy07/freeharmony.git
#   step 6  git checkout <sourceCommit>
#   step 7  pnpm.cmd install --frozen-lockfile        <-- the observed step
#
# BUGFIX_LAB_PRESENT (exit 1) = step 7 exits non-zero AND its output carries
#   ERR_PNPM_IGNORED_BUILDS -- the exact failure both reporters in this cluster
#   pasted/screenshotted (esbuild/sharp/workerd build scripts refused).
# BUGFIX_LAB_ABSENT  (exit 0) = step 7 completes non-interactively, exit 0.
# exit 3 = harness could not run (setup failure, or step 7 failed for some
#   OTHER reason) -- never reported as present or absent.

param([string]$PinSha = "420374370549f7e90603f030820128bfc9f62fc0")

$ErrorActionPreference = "Continue"
Write-Host "BUGFIX_LAB_PIN=$PinSha"

if ([string]::IsNullOrWhiteSpace($PinSha)) {
  Write-Host "BUGFIX_LAB_SETUP_FAILED empty pin sha"
  exit 3
}

# --- guide step 3: Install pnpm (un-pinned, exactly as the guide says) -------
Write-Host "=== guide step 3: npm.cmd install -g pnpm ==="
npm.cmd install -g pnpm
if ($LASTEXITCODE -ne 0) { Write-Host "BUGFIX_LAB_SETUP_FAILED npm install -g pnpm exit $LASTEXITCODE"; exit 3 }
$pnpmVer = (pnpm.cmd --version) 2>&1
Write-Host "EVIDENCE pnpm_version_installed_by_guide=$pnpmVer"

# --- guide steps 4-6: clone + checkout the pinned commit ---------------------
$root = Join-Path $env:RUNNER_TEMP "guiderun"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Force -Path $root | Out-Null
Set-Location $root
Write-Host "=== guide step 4: git clone ==="
git clone https://github.com/Blueturboguy07/freeharmony.git
if ($LASTEXITCODE -ne 0) { Write-Host "BUGFIX_LAB_SETUP_FAILED git clone exit $LASTEXITCODE"; exit 3 }
Set-Location (Join-Path $root "freeharmony")
Write-Host "=== guide step 6: git checkout $PinSha ==="
git checkout $PinSha
if ($LASTEXITCODE -ne 0) { Write-Host "BUGFIX_LAB_SETUP_FAILED git checkout exit $LASTEXITCODE"; exit 3 }
Write-Host "EVIDENCE head=$(git rev-parse HEAD)"

# --- guide step 7: THE OBSERVED STEP ----------------------------------------
Write-Host "=== guide step 7: pnpm.cmd install --frozen-lockfile ==="
$log = Join-Path $env:RUNNER_TEMP "step7.log"
pnpm.cmd install --frozen-lockfile 2>&1 | Tee-Object -FilePath $log
$code = $LASTEXITCODE
$out = ""
if (Test-Path $log) { $out = Get-Content $log -Raw }
Write-Host "EVIDENCE step7_exit_code=$code"

if ($out -match 'ERR_PNPM_IGNORED_BUILDS') {
  Write-Host "EVIDENCE matched lines:"
  ($out -split "`r?`n") | Where-Object { $_ -match 'ERR_PNPM_IGNORED_BUILDS|Ignored build scripts|approve-builds' } | ForEach-Object { Write-Host "EVIDENCE $_" }
  if ($code -eq 0) {
    Write-Host "EVIDENCE note: gate message present but step exited 0"
  }
  Write-Host "BUGFIX_LAB_PRESENT"
  exit 1
}

if ($code -ne 0) {
  Write-Host "EVIDENCE step 7 exited $code with no ERR_PNPM_IGNORED_BUILDS -- a different failure, not this cluster's bug"
  Write-Host "EVIDENCE tail:"
  ($out -split "`r?`n") | Select-Object -Last 40 | ForEach-Object { Write-Host "EVIDENCE $_" }
  Write-Host "BUGFIX_LAB_INCONCLUSIVE"
  exit 3
}

# --- corroboration only (never decides the verdict): did build scripts run? --
$esb = Get-ChildItem -Path . -Recurse -Filter esbuild.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($esb) { Write-Host "EVIDENCE esbuild_binary_present=$($esb.FullName)" }
else { Write-Host "EVIDENCE esbuild_binary_present=NONE_FOUND" }

Write-Host "BUGFIX_LAB_ABSENT"
exit 0
