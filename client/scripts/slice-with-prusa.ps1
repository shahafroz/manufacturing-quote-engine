# Slice every STL in a folder with PrusaSlicer using the same settings as our engine.
# Usage (from the client folder):  .\scripts\slice-with-prusa.ps1 ..\eval\models
param([string]$Folder = "..\eval\models")

$prusa = "C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer-console.exe"
if (-not (Test-Path $prusa)) { Write-Error "PrusaSlicer not found at $prusa. Install it or edit this path."; exit 1 }

Get-ChildItem -Path $Folder -Filter *.stl | ForEach-Object {
  $out = [System.IO.Path]::ChangeExtension($_.FullName, ".gcode")
  Write-Host "Slicing $($_.Name)"
  & $prusa --export-gcode --layer-height 0.2 --first-layer-height 0.2 --fill-density 20% `
    --perimeters 2 --top-solid-layers 4 --bottom-solid-layers 4 --nozzle-diameter 0.4 `
    --filament-diameter 1.75 --filament-density 1.24 --output $out $_.FullName
}
