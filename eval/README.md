# Accuracy evaluation vs PrusaSlicer

1. Put test models in `eval/models/` (not committed; they belong to their authors).
2. Slice them with PrusaSlicer using the same settings as the engine (Windows):
   ```powershell
   cd client
   .\scripts\slice-with-prusa.ps1 ..\eval\models
   ```
3. Run the comparison:
   ```powershell
   node scripts/evaluate.mjs ../eval/models
   ```
   This rewrites `eval/results.md`, `results.csv`, `accuracy-time.svg`, `accuracy-filament.svg` and `speed.svg`.

Settings on both sides: 0.2 mm layers, 20 % infill, 2 perimeters, 4 top/bottom layers, 0.4 mm nozzle,
1.75 mm PLA at 1.24 g/cm³, no supports, PrusaSlicer's default printer speeds and 1500 mm/s² acceleration.
