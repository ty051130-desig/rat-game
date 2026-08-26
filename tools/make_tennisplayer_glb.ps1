$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Blend = Join-Path $Root "assets\source\tennisplayer.blend"
$Exporter = Join-Path $Root "tools\export_tennisplayer_glb.py"
$Output = Join-Path $Root "assets\models\tennisplayer.glb"

Write-Host "============================================"
Write-Host " Rat Escape v9.3 - Tennis Player Export"
Write-Host "============================================"

if (!(Test-Path $Blend)) {
    throw "tennisplayer.blend was not found: $Blend"
}

$Blender = $null
$cmd = Get-Command blender.exe -ErrorAction SilentlyContinue
if ($cmd) { $Blender = $cmd.Source }

if (!$Blender) {
    $roots = @(
        (Join-Path $env:ProgramFiles "Blender Foundation"),
        (Join-Path $env:LOCALAPPDATA "Programs\Blender Foundation")
    )
    foreach ($r in $roots) {
        if ($r -and (Test-Path $r)) {
            $found = Get-ChildItem $r -Filter blender.exe -File -Recurse -ErrorAction SilentlyContinue |
                Sort-Object FullName -Descending |
                Select-Object -First 1
            if ($found) {
                $Blender = $found.FullName
                break
            }
        }
    }
}

if (!$Blender) {
    Write-Host ""
    Write-Host "Blender.exe could not be found automatically." -ForegroundColor Red
    Write-Host "Add Blender to PATH or use MAKE_TENNISPLAYER_GLB.bat."
    exit 2
}

Write-Host "Blender: $Blender"
Write-Host "Blend  : $Blend"
Write-Host "Output : $Output"
Write-Host ""

& $Blender -b $Blend --python $Exporter -- --output $Output
if ($LASTEXITCODE -ne 0) {
    throw "Blender export failed (exit code $LASTEXITCODE)"
}

if (!(Test-Path $Output)) {
    throw "tennisplayer.glb was not created."
}

$size = (Get-Item $Output).Length
Write-Host ""
Write-Host "Export complete: assets\models\tennisplayer.glb" -ForegroundColor Green
Write-Host "Size: $size bytes"
Write-Host "Stage 2 is ready to run."
