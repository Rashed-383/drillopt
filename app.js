/* DrillOpt — drilling parameters engine (field rule-of-thumb models) */
"use strict";

const BIT_SIZES = [
  {in:26,    use:"Conductor / surface hole"},
  {in:24,    use:"Surface hole"},
  {in:22,    use:"Surface hole"},
  {in:17.5,  use:"Surface / intermediate"},
  {in:16,    use:"Intermediate"},
  {in:12.25, use:"Intermediate / production"},
  {in:9.875, use:"Intermediate / production"},
  {in:8.5,   use:"Production hole (most common)"},
  {in:8.375, use:"Production hole"},
  {in:6.5,   use:"Slim production / liner section"},
  {in:6.125, use:"Slim production / liner section"},
  {in:6,     use:"Slim hole"},
  {in:5.875, use:"Slim hole / lateral"},
  {in:4.75,  use:"Slim hole / lateral"}
];

/* WOB in klb per inch of bit diameter; RPM ranges; rop0 = reference ROP (m/h)
   at mid-range WOB/RPM near surface; compaction factor applied with depth. */
const FORMATIONS = [
  {id:"uncons", name:"Unconsolidated / Very Soft (clay, gumbo, loose sand)",
   drill:"Very fast drilling, risk of washout & bit balling",
   wob:{pdc:[0.5,1.5], mt:[1.5,3.0], tci:[2.0,3.5]},
   rpm:{pdc:[100,180], mt:[90,140], tci:[70,110]},
   rop0:30, abras:1,
   notes:["High flow rate for hole cleaning; watch washouts.",
          "Bit balling risk in gumbo — keep mud inhibitive, avoid excessive WOB.",
          "Milled-tooth or PDC with large cutters / open face preferred."]},
  {id:"soft", name:"Soft (soft shale, chalk, soft limestone)",
   drill:"Fast drilling",
   wob:{pdc:[1.0,2.5], mt:[2.0,4.0], tci:[2.5,4.5]},
   rpm:{pdc:[90,160], mt:[80,120], tci:[60,100]},
   rop0:20, abras:2,
   notes:["Standard PDC or milled-tooth bits perform well.",
          "Maintain annular velocity for cuttings transport."]},
  {id:"medium", name:"Medium (firm shale, limestone, sandstone)",
   drill:"Moderate drilling",
   wob:{pdc:[1.5,3.5], mt:[3.0,5.0], tci:[3.0,5.5]},
   rpm:{pdc:[80,140], mt:[60,100], tci:[50,90]},
   rop0:12, abras:3,
   notes:["PDC gives best economics where shale is stable.",
          "Watch for vibration (stick-slip) at low RPM with high WOB."]},
  {id:"medhard", name:"Medium-Hard (hard shale, dolomitic lime, cemented sand)",
   drill:"Slow-moderate, abrasive streaks",
   wob:{pdc:[2.0,4.0], mt:[3.5,5.5], tci:[3.5,6.0]},
   rpm:{pdc:[60,110], mt:[50,80], tci:[40,70]},
   rop0:7, abras:4,
   notes:["Consider TCI or heavier-set PDC; check abrasion on gauge.",
          "Interbedded streaks cause torque fluctuation — control WOB."]},
  {id:"hard", name:"Hard (dolomite, quartzite, chert, granite)",
   drill:"Slow, abrasive",
   wob:{pdc:[2.5,4.5], mt:[4.0,6.0], tci:[4.0,7.0]},
   rpm:{pdc:[50,90], mt:[40,70], tci:[35,60]},
   rop0:3.5, abras:5,
   notes:["TCI or impregnated bits usually out-perform PDC.",
          "High WOB with moderate RPM; consider downhole motor for RPM without surface torque.",
          "Watch bit life — pull on dull grading, not only ROP."]},
  {id:"evap", name:"Salt / Anhydrite (evaporites)",
   drill:"Fast in salt (creeping), moderate in anhydrite",
   wob:{pdc:[1.0,2.5], mt:[2.0,4.0], tci:[2.5,4.5]},
   rpm:{pdc:[80,140], mt:[70,110], tci:[55,90]},
   rop0:18, abras:2,
   notes:["Use salt-saturated or inhibitive mud to avoid washout.",
          "Salt creep risk — plan under-reamed hole / robust casing design.",
          "Anhydrite streaks: expect sudden ROP drops and possible mud contamination."]}
];

const BIT_LABELS = {pdc:"PDC", mt:"Milled Tooth", tci:"TCI"};

/* Directional/horizontal adjustments: weight-transfer losses, cleaning flow, ROP */
const WELL_ADJ = {
  vertical:   {wob:1.0, rpm:1.0, flow:1.0, rop:1.0, avMin:90},
  directional:{wob:0.9, rpm:0.9, flow:1.1, rop:0.85, avMin:120},
  horizontal: {wob:0.75, rpm:0.85, flow:1.2, rop:0.7, avMin:150}
};

/* --- element refs --- */
const $ = id => document.getElementById(id);
const selBit = $("in-bitsize"), selFm = $("in-formation");
BIT_SIZES.forEach(b=>{
  const o=document.createElement("option");
  o.value=b.in; o.textContent=b.in+"″"; if(b.in===8.5)o.selected=true;
  selBit.appendChild(o);
});
FORMATIONS.forEach(f=>{
  const o=document.createElement("option");
  o.value=f.id; o.textContent=f.name; if(f.id==="medium")o.selected=true;
  selFm.appendChild(o);
});

function num(v,d){v=Math.round(v*10)/10; return (""+v).replace(".0",""); }

function calc(){
  const D   = parseFloat(selBit.value);            // bit size, in
  const bt  = $("in-bittype").value;               // bit type key
  const fm  = FORMATIONS.find(f=>f.id===selFm.value);
  const Z   = Math.min(5000, Math.max(0, parseFloat($("in-depth").value)||0)); // m
  const MW  = parseFloat($("in-mw").value)||10;    // ppg
  const DP  = parseFloat($("in-dp").value);        // in
  const WT  = $("in-welltype").value;               // well profile
  const adj = WELL_ADJ[WT] || WELL_ADJ.vertical;

  /* Depth compaction + well-profile adjustment */
  const wobF  = (1 + 0.15*(Z/5000)) * adj.wob;
  const rpmF  = (1 - 0.10*(Z/5000)) * adj.rpm;
  const ropF  = adj.rop / (1 + Z/4500);

  const wobPerIn = fm.wob[bt];                     // klb/in
  const wobMin = wobPerIn[0]*D*wobF, wobMax = wobPerIn[1]*D*wobF;
  const rpm = fm.rpm[bt].map(r=>Math.round(r*rpmF));

  /* Flow: 35–55 gpm per inch of bit diameter, boosted for high-angle cleaning */
  let qMin = 35*D*adj.flow, qMax = 55*D*adj.flow;
  if(D<=6.5){ qMin=Math.min(qMin,260*adj.flow); qMax=Math.min(qMax,360*adj.flow); }
  const Q = Math.round((qMin+qMax)/2/10)*10;       // recommended gpm

  /* Annular velocity at recommended Q: AV = 24.51*Q/(Dh²−Dp²) ft/min */
  const AV = 24.51*Q/(D*D - DP*DP);

  /* Nozzles: target jet velocity ~350 ft/s, 3 nozzles.
     At (in²) = 0.3208*Q / Vjet ; ΔPb = MW*V²/1120 ; HHP = ΔP*Q/1714 ; HSI = HHP / (π D²/4) */
  const Vjet = 350;
  const At = 0.3208*Q/Vjet;
  const dP = MW*Vjet*Vjet/1120;
  const HHP = dP*Q/1714;
  const HSI = HHP/(Math.PI*D*D/4);
  /* convert total area to 3 nozzle sizes in 32nds: area of one nozzle = π/4*(n/32)² */
  const perNozzle32 = Math.sqrt(At/3*4/Math.PI)*32;
  const n32 = Math.round(perNozzle32);

  /* ROP estimate (mid-range WOB & RPM), m/h */
  const rop = fm.rop0 * ropF;

  /* --- render --- */
  $("r-wob").textContent = `${Math.round(wobMin)}–${Math.round(wobMax)} klb`;
  $("r-wob-sub").innerHTML = `${num(wobPerIn[0]*wobF)}–${num(wobPerIn[1]*wobF)} klb/in × ${D}″ bit (${BIT_LABELS[bt]})`;
  $("r-rpm").textContent = `${rpm[0]}–${rpm[1]} RPM`;
  $("r-rpm-sub").innerHTML = `${BIT_LABELS[bt]} in ${fm.drill.toLowerCase()} formation`;
  $("r-flow").textContent = `${qMin}–${qMax} gpm`;
  $("r-flow-sub").innerHTML = `Recommended ≈ <b>${Q} gpm</b> · Annular velocity ≈ <b>${Math.round(AV)} ft/min</b> (vs 5″ class DP)`;
  $("r-rop").textContent = `${num(rop)} m/h`;
  $("r-rop-sub").innerHTML = `at ${Math.round(Z)} m · surface-class ROP ${fm.rop0} m/h with depth correction`;
  $("r-nozzles").innerHTML =
    `Jet velocity target <b>${Vjet} ft/s</b> → total nozzle area <b>${num(At)} in²</b> → <b>3 × ${n32}/32″</b> nozzles (adjust ±1 size to pump pressure). ` +
    `Bit pressure drop ≈ <b>${Math.round(dP)} psi</b> · Bit HHP ≈ <b>${Math.round(HHP)} hp</b> · <b>HSI ≈ ${num(HSI)} hp/in²</b> (target 2.0–4.0 for good cleaning).`;

  /* notes */
  const notes = [...fm.notes];
  if(WT==="directional") notes.push("Directional well: values include weight-transfer losses and +10% flow for cleaning. Keep annular velocity above 120 ft/min and trend torque & drag.");
  if(WT==="horizontal") notes.push("Horizontal/high-angle: values include weight-transfer losses and +20% flow. Target ≥150 ft/min annular velocity, rotate 120+ RPM where possible, pump regular high-vis sweeps against cuttings beds.");
  if(AV < adj.avMin) notes.push(`Annular velocity ${Math.round(AV)} ft/min is below the ${adj.avMin} ft/min this profile needs — raise flow rate or expect poor hole cleaning.`);
  else if(AV > 180) notes.push(`Annular velocity ${Math.round(AV)} ft/min is high — watch ECD / hole erosion in soft formations.`);
  if(HSI < 2) notes.push("HSI below 2 hp/in² — consider smaller nozzles to improve bottom-hole cleaning.");
  if(HSI > 5) notes.push("HSI above 5 hp/in² — check standpipe pressure limits and bit erosion risk.");
  $("r-notes").innerHTML = notes.map(n=>`<li>${n}</li>`).join("");

  /* warnings */
  const warn = [];
  if(WT!=="vertical" && bt==="mt") warn.push("Milled-tooth bits in directional/horizontal work: PDC with a motor or RSS is the standard for steerability and bit life.");
  if(WT==="horizontal" && bt!=="pdc") warn.push("Horizontal laterals are drilled almost exclusively with PDC on a motor (sliding/rotating) or RSS.");
  if(WT!=="vertical" && Z>3000) warn.push("Deep directional section: model torque and drag before drilling; consider agitator tools to restore weight transfer while sliding.");
  if(bt==="pdc" && fm.abras>=4) warn.push("PDC in hard/abrasive formations wears fast — TCI or impregnated bit is usually more economic here.");
  if(bt==="mt" && fm.abras>=3) warn.push("Milled-tooth bits dull quickly in abrasive formations — consider TCI.");
  if(Z>3500 && fm.abras>=4) warn.push("Deep hard section: consider a downhole motor (PDM) or turbine to deliver RPM without surface torque and improve bit life.");
  if(Z>4000) warn.push("Below ~4000 m expect HTHP conditions — confirm mud stability, tool ratings and ECD management.");
  if(fm.id==="evap") warn.push("Evaporite section: verify mud salinity before drilling and monitor torque for salt creep.");
  const wc=$("r-warnings-card");
  if(warn.length){wc.hidden=false; $("r-warnings").innerHTML=warn.map(w=>`<li>${w}</li>`).join("");}
  else wc.hidden=true;
}

["in-bitsize","in-bittype","in-formation","in-depth","in-mw","in-dp","in-welltype"]
  .forEach(id=>$(id).addEventListener("input",calc));

/* --- reference tables --- */
$("ref-bits").innerHTML = "<tr><th>Size</th><th>Typical application</th></tr>" +
  BIT_SIZES.map(b=>`<tr><td>${b.in}″</td><td>${b.use}</td></tr>`).join("");
$("ref-formations").innerHTML = "<tr><th>Class</th><th>Drillability</th><th>Ref ROP (m/h)</th><th>Abrasiveness (1–5)</th></tr>" +
  FORMATIONS.map(f=>`<tr><td>${f.name.split(" (")[0]}</td><td>${f.drill}</td><td>${f.rop0}</td><td>${f.abras}</td></tr>`).join("");
$("ref-formulas").innerHTML =
  "<tr><th>Quantity</th><th>Field formula</th></tr>" +
  [["Annular velocity","AV (ft/min) = 24.51 × Q / (Dₕ² − Dₚ²), Q in gpm, diameters in in"],
   ["Jet velocity","Vₙ (ft/s) = 0.3208 × Q / Aₜ, Aₜ = total nozzle area (in²)"],
   ["Bit pressure drop","ΔP_b (psi) = MW (ppg) × Vₙ² / 1120"],
   ["Bit hydraulic HP","HHP = ΔP_b × Q / 1714"],
   ["HSI","HSI (hp/in²) = HHP / bit face area"],
   ["WOB guideline","WOB = (klb per inch of bit diameter) × bit size, by formation & bit type"]]
  .map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("");

/* --- directional guide --- */
const DIR_GUIDE = [
 ["Bottom-hole assembly",[
  "Steerable motor BHA: PDC bit on a bent-housing mud motor (1–2° bend) with MWD above — the workhorse for kickoffs and corrections.",
  "Rotary steerable systems (RSS): continuous rotation, better hole cleaning and smoother wellbore; preferred in long 8½″ sections and horizontals when budget allows.",
  "Heavy-weight drill pipe in the build section; keep tool joints out of high doglegs.",
  "Agitator / friction-reduction tools restore weight transfer while sliding in long laterals.",
  "MWD/LWD: gamma ray and resistivity for geosteering; survey every stand or per plan."]],
 ["Building angle",[
  "Kick off in soft-to-medium formations where possible; hard streaks deflect and create doglegs.",
  "Typical build rates: 2–4°/30 m with motors, up to 8–12°/30 m with RSS for tight-radius work.",
  "Azimuth control is hardest at kickoff; orient toolface carefully at low angle.",
  "Keep dogleg severity below ~5°/30 m through the build for casing and fishing friendliness."]],
 ["Sliding vs rotating",[
  "Sliding: WOB limited by drag; expect 30–50% of surface weight to reach the bit in a long lateral. Use agitators, work the string.",
  "Rotating: full RPM plus motor RPM; best ROP and hole cleaning, but no directional control with a motor.",
  "Plan slide/rotate ratios; excess sliding kills ROP and builds cuttings beds.",
  "Gravity toolface above ~5° inclination, magnetic below; re-orient after every connection.",
  "Differential sticking risk rises with angle: keep mud lubricity up, minimize static time."]],
 ["Cleaning high-angle wells",[
  "Above ~35° cuttings form beds on the low side; above 55° they avalanche. Cleaning is the limit, not bit power.",
  "Maximize flow within ECD limits; target ≥150 ft/min annular velocity in the high-angle section.",
  "Rotation at 120–180 RPM stirs beds back into the stream — rotation cleans better than viscosity.",
  "High-vis sweeps every stand or two in the lateral; weighted sweep before trips.",
  "Circulate bottoms-up and work the pipe before every trip; a tight pull is a cleaning problem announcing itself.",
  "Trend torque and drag against the model: rising trend means beds are building before pack-off."]],
 ["Drilling the lateral",[
  "Land smoothly: reach 90° at target entry with minimum dogleg; casing and completions must pass it.",
  "Geosteer with LWD; small corrections early beat large doglegs late.",
  "Weight transfer: agitators, rotate whenever the directional plan allows, lighter BHA / more HWDP in the horizontal.",
  "ECD management: long laterals raise annular losses; check frac-margin before raising flow.",
  "Verify top drive and drill pipe torque ratings for TD torque in the planning phase.",
  "Plan wiper trips to the shoe as cuttings-load indicators in very long laterals."]]
];
$("dir-guide").innerHTML = DIR_GUIDE.map(g=>
  `<div class="card wide"><h3>${g[0]}</h3><ul class="notes">${g[1].map(p=>`<li>${p}</li>`).join("")}</ul></div>`
).join("");

/* --- tabs --- */
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));
  document.querySelectorAll(".tabpane").forEach(p=>p.classList.toggle("active",p.id==="tab-"+t.dataset.tab));
}));

calc();
/* ============ LINER CASING JOB ASSISTANT ============ */
const LINER_PHASES = [
 {t:"Pre-Job Planning & Engineering", steps:[
  ["Review the well plan, geological prognosis and offset liner jobs","Confirm liner setting depth, overlap (typically 100–150 m into previous casing), shoe depth and expected formations across the section. Review offset cement jobs for losses, gas channels and top-of-cement results."],
  ["Finalize liner design","Confirm liner size, weight, grade and connections vs burst/collapse/tension loads with worst-case cementing and production cases. Verify drift diameter for planned completions/tools."],
  ["Select hanger & packer system","Hydraulic-set hanger with liner-top packer is standard. Match to casing program; confirm setting ball/dart sizes, shear pressures and bypass area."],
  ["Engineer the cement job","Design slurry (density, thickening time + safety margin, fluid loss, free water = 0, compressive strength) and spacers/flushes for mud removal. Model ECD to stay below frac gradient — liner annuli are tight."],
  ["Centralizer & scratchers program","Place centralizers to reach ≥70% standoff across pay and the liner lap. Consider rotating scratchers across permeable zones."],
  ["Mud conditioning plan","Plan to condition mud before cementing: low gels, low fluid loss, rheology pumpable at liner annular rates."],
  ["Well control & contingency planning","Kick tolerance, lost circulation plan (LCM on site), hanger fails to set, plug bump pressure not reached, and cement in casing contingency."],
  ["Pre-job meeting with all crews","Drilling, cementing, mud, wireline and rig crews walk through the program, pump rates, volumes, pressures and the decision points."]]},
 {t:"Surface Preparation & Equipment Check", steps:[
  ["Tally and drift the liner joints","Strap and tally every joint; drift with the correct drift mandrel. Number the tally including shoe track, float equipment and hanger assembly."],
  ["Inspect float equipment","Float shoe and float collar: check valves function, PDC-drillable materials confirmed, correct thread and grade. Verify shoe track length (usually 2 joints + shoe to float collar)."],
  ["Function-test the liner hanger assembly","On surface per vendor procedure: check slips, cones, hydraulic setting cylinder, setting ball seat and shear pins. Record expected setting pressures."],
  ["Check the running/setting tool","Confirm pack-off seals, dogs/collets, release mechanism (normally right-hand rotation) and that the tool matches the hanger."],
  ["Verify liner-top packer & tie-back receptacle","Inspect packer elements, bore and tie-back polished bore receptacle length for future tie-back."],
  ["Prepare cement head, darts and plugs","Liner cement manifold/head with correct dropping dart (wiper dart) and pump-down plug if used; verify flag/indicators work; plug sizes match liner ID."],
  ["Calibrate tanks and confirm volumes","Pit volumes, cement unit displacement tanks calibrated; calculate and reconcile all volumes: spacer, slurry, displacement to bump."]]},
 {t:"Running the Liner", steps:[
  ["RIH with liner on drill pipe (setting tool)","Make up shoe track and liner joints per tally with correct torque; use thread lock only per program. Fill up regularly — typically every 5–10 joints and ALWAYS through the shoe track."],
  ["Control running speed","Run at controlled speed, especially through the previous casing shoe, doglegs and open hole, to limit surge pressures (narrow annulus = high surge). Monitor trip tank continuously."],
  ["Circulate periodically while running","Break circulation every few hundred meters (and before entering open hole) to condition the hole and avoid packing off."],
  ["Wash last stands to bottom","Tag bottom gently (max 5–10 klb) to confirm depth, then pull up and wash/ream the last section to planned setting depth."],
  ["Circulate bottoms-up at depth","Circulate at least one full bottoms-up at planned rate until mud is conditioned: consistent weight in/out, low gels. Record circulation pressures at planned cementing rates for ECD reference."],
  ["Work the liner & confirm free movement","Reciprocate and rotate (if the system allows) to verify nothing is stuck BEFORE setting the hanger."]]},
  {t:"Setting the Hanger & Releasing the Tool", steps:[
  ["Position the hanger at setting depth","Space out so the shoe is at planned depth with the liner in slight compression/tension per hanger vendor spec."],
  ["Drop the setting ball (hydraulic hanger)","Circulate while the ball falls (calculate fall time) or drop and wait per vendor. Confirm ball seated by pressure response."],
  ["Pressure up and set the hanger","Apply pressure in staged increments to the vendor's setting pressure; hold and observe. Confirm set by slack-off: liner weight transfers to the hanger (typically set down 10–20 klb and pick up to verify no movement)."],
  ["Set the liner-top packer (if integral)","Apply the additional pressure/weight steps per vendor to pack off the liner top. Verify with annular pressure response."],
  ["Release the running tool","Usually 8–12 right-hand turns while holding slight set-down weight. Confirm release by overpull and free rotation. Note: release BEFORE cementing so the tool cannot be cemented in."],
  ["Confirm circulation path","Circulate through the released tool to verify full returns and no pack-off before pumping cement."]]},
 {t:"Cementing the Liner", steps:[
  ["Pump spacer and flushes","Pump the designed spacer train at the engineered rate (usually turbulent for spacers if ECD allows). Monitor returns and pit levels continuously."],
  ["Mix and pump cement slurry","Mix at design density — check with pressurized mud balance every few minutes; adjust on the fly. Record actual volume vs design."],
  ["Release the dropping dart","Launch the liner wiper dart from the cement head on completion of slurry; confirm launch indicator. The dart wipes the drill pipe and latches into the liner wiper plug at the shoe track."],
  ["Displace at controlled rate","Displacement volume = drill pipe capacity + liner capacity to the float collar. Slow down (e.g. to 2–3 bpm) for the last few barrels before bump."],
  ["Bump the plug","Shear the liner plug and displace until pressure rises sharply — bump pressure per design (typically 500–1500 psi over circulating pressure). If no bump at calculated volume + small overage: STOP, do not over-displace — pressure up to set value and hold per contingency."],
  ["Verify floats hold","Bleed off pressure and check for flow back. If the floats hold: no backflow. If they fail, re-pressurize and hold until cement sets, or pump back contamination per procedure."],
  ["Pressure-test the liner lap","Test the liner top / lap to the planned test pressure (often 1000–1500 psi above expected leak-off or per program) after bumping or after WOC per program."]]},
 {t:"Post-Job: POOH, WOC & Evaluation", steps:[
  ["Pull the running string above the liner top","Pull out of the liner; reverse out excess cement if the program calls for it, then POOH. Do not rotate/ream inside the fresh liner lap once cement is setting."],
  ["Wait on cement","WOC per lab thickening time plus safety margin and strength requirement (typically until surface samples reach 500 psi compressive strength for drilling out)."],
  ["Nipple up / test BOP as required","Prepare for drilling out; pressure test BOP and wellhead per regulations."],
  ["RIH and drill out shoe track","Drill out cement, float collar and shoe track with the planned assembly. Tag the float collar depth and compare with tally — confirms top of cement inside."],
  ["Pressure test the liner & lap","Perform the liner integrity test and formation integrity/leak-off test at the shoe to the planned EMW. Record and plot."],
  ["Run cement evaluation if programmed","Cement bond log / ultrasonic across the lap and pay intervals if the job objectives require; remediate (squeeze) if the liner-top seal fails."],
  ["Document the job","Final job report: actual vs planned volumes, rates, pressures, bump, test results and lessons learned — feed back into the well file."]]}
];

const LKEY="drillopt_liner_v1";
let linerState={}; try{linerState=JSON.parse(localStorage.getItem(LKEY)||"{}")||{};}catch(e){linerState={};}

function saveLiner(){ try{localStorage.setItem(LKEY,JSON.stringify(linerState));}catch(e){} }
function updateProgress(){
  let tot=0,done=0;
  LINER_PHASES.forEach((p,pi)=>p.steps.forEach((s,si)=>{tot++; if(linerState[pi+"-"+si])done++;}));
  const pct=tot?Math.round(done/tot*100):0;
  document.getElementById("liner-progress").style.width=pct+"%";
  document.getElementById("liner-progress-text").textContent=done+" / "+tot+" steps ("+pct+"%)";
}

function buildLiner(){
  const host=document.getElementById("liner-phases"); host.innerHTML="";
  LINER_PHASES.forEach((p,pi)=>{
    const ph=document.createElement("div"); ph.className="phase"+(pi===0?" open":"");
    const head=document.createElement("div"); head.className="phase-head";
    head.innerHTML='<div class="phase-num">'+(pi+1)+'</div><div class="phase-title">'+p.t+'</div><div class="phase-count" id="pc-'+pi+'"></div>';
    head.addEventListener("click",()=>ph.classList.toggle("open"));
    const body=document.createElement("div"); body.className="phase-body";
    p.steps.forEach((s,si)=>{
      const key=pi+"-"+si;
      const st=document.createElement("div"); st.className="step"+(linerState[key]?" done":"");
      const lb=document.createElement("label");
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!linerState[key];
      cb.addEventListener("change",()=>{ linerState[key]=cb.checked; if(!cb.checked)delete linerState[key]; saveLiner(); st.classList.toggle("done",cb.checked); updateProgress(); });
      const txt=document.createElement("span"); txt.className="step-title"; txt.textContent=s[0];
      lb.appendChild(cb); lb.appendChild(txt);
      const det=document.createElement("div"); det.className="step-detail"; det.textContent=s[1];
      st.appendChild(lb); st.appendChild(det); body.appendChild(st);
    });
    ph.appendChild(head); ph.appendChild(body); host.appendChild(ph);
  });
  updateProgress();
}
document.getElementById("liner-reset").addEventListener("click",()=>{
  linerState={}; saveLiner(); buildLiner();
});
buildLiner();
