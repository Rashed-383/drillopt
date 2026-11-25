# DrillOpt

Optimum drilling parameters calculator and liner casing job assistant for drilling engineers.

## Features

**Parameters Calculator**
- Recommended Weight on Bit (WOB), rotary speed (RPM), flow rate and estimated ROP
- Well profiles: vertical, directional and horizontal (weight-transfer losses, boosted cleaning flow, ROP adjustment)
- By formation type (unconsolidated → hard → evaporites), bit size (26″ down to 4¾″) and bit type (PDC, milled tooth, TCI)
- Depth correction to 5000 m TVD (compaction effects on WOB/RPM/ROP)
- Hydraulics: annular velocity, nozzle sizing (3-jet), bit pressure drop, hydraulic horsepower and HSI
- Formation-specific operational notes and automatic warnings (abrasive formations, HTHP, low annular velocity, ECD)

**Directional & Horizontal Guide**
- BHA and tools (steerable motor vs RSS, agitators, MWD/LWD), kickoff and build rates, sliding vs rotating practice, high-angle hole cleaning, and lateral/geosteering specifics

**Liner Casing Job Guide**
- 6-phase, 41-step field checklist: pre-job planning → surface preparation → running the liner → setting the hanger → cementing → post-job testing
- Each step with practical detail notes; progress saved locally on the device

**Reference Tables**
- Common bit sizes and applications, formation drillability classes, and the field hydraulics formulas used by the engine

## Engineering basis

Recommendations are standard industry rule-of-thumb starting points (offset-well practice, klb-per-inch WOB guidelines, and classic field hydraulics formulas):

- Annular velocity: `AV = 24.51 × Q / (Dh² − Dp²)` (ft/min, gpm, in)
- Jet velocity: `Vn = 0.3208 × Q / At` (ft/s, gpm, in²)
- Bit pressure drop: `ΔPb = MW × Vn² / 1120` (psi, ppg)
- Bit HHP: `ΔPb × Q / 1714`; HSI = HHP / bit face area

Always calibrate against offset wells, bit vendor IADC records and the well plan.

## Running it

Pure static site — no build step. Open `index.html`, or deploy anywhere static:

- **Vercel:** import the repo, framework preset "Other", no build command, output = repo root
- **GitHub Pages:** Settings → Pages → serve from root

## Files

- `index.html` — markup
- `styles.css` — styling
- `app.js` — parameters engine + liner checklist
- `vercel.json` — static deploy config
