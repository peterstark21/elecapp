import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const TEAM_NUM       = "115";
const TEAM_KEY       = "frc115";
const EVENT_KEY      = "2026caoec";
const EVENT_NAME     = "2026 OC District";
const EVENT_DATES    = "April 2–4, 2026";
const EVENT_LOCATION = "Capistrano Valley HS";
const NEXUS_EVENT    = "2026caoec";
const DEMO_TBA_EVENT = "2025capin";
const DEMO_TBA_TEAM  = "frc115";
const TBA_KEY        = "CeAknKFak2QzpNHDnlx5k7l28hIqe6JwLywSYXtAMPiNPnyxHMyf7awc5Qowl5Z0";
const EJS_SERVICE    = "service_4ssfaza";
const EJS_TEMPLATE   = "template_xxoll7o";
const EJS_PUBKEY     = "OkpYMX237horE3-2j";
const NOTIFY_EMAIL   = "sreevatsa.pervela@gmail.com";
const DEFAULT_PIN    = "1028";
const HARDCODED_NEXUS_KEY = "rVnKYGMmwYp7N-GlkYvywj0_iPs";
const YOUTUBE_STREAM_URL  = ""; // paste YouTube livestream URL when available

// ── STORAGE KEYS ─────────────────────────────────────────────────────────────
const SK = {
  elec:     "frc115_cl_elec_v6",
  mech:     "frc115_cl_mech_v6",
  sw:       "frc115_cl_sw_v6",
  archElec: "frc115_arch_elec_v6",
  archMech: "frc115_arch_mech_v6",
  archSW:   "frc115_arch_sw_v6",
  archDemo: "frc115_arch_demo_v6",
  announce: "frc115_announce_v2",
  issues:   "frc115_issues_v2",
  nexus:    "frc115_nexus_key_v1",
  dirPin:   "frc115_dir_pin_v1",
};
const SYNC_KEYS = Object.values(SK);

// ── UPSTASH ───────────────────────────────────────────────────────────────────
const UPS_URL   = "https://real-goshawk-81449.upstash.io";
const UPS_TOKEN = "gQAAAAAAAT4pAAIncDFmNThjN2Y3OGZhZmI0YTBhYmNiMzJmZDE3N2NiMjNlYXAxODE0NDk";
let _bc = null;
try { _bc = new BroadcastChannel("frc115"); } catch {}

async function upsGet(k) {
  try {
    const r = await fetch(`${UPS_URL}/get/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${UPS_TOKEN}` }, cache: "no-store"
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.result == null ? null : JSON.parse(j.result);
  } catch { return null; }
}
async function upsSet(k, v) {
  try {
    await fetch(`${UPS_URL}/set/${encodeURIComponent(k)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(v))
    });
  } catch(e) { console.warn("Upstash write failed:", e.message); }
}

const ls = async (k) => {
  if (SYNC_KEYS.some(p => k === p || k.startsWith(p + ":"))) {
    const v = await upsGet(k);
    if (v !== null) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} return v; }
  }
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
};
const ss = async (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  _bc && _bc.postMessage({ k, v });
  if (SYNC_KEYS.some(p => k === p || k.startsWith(p + ":"))) await upsSet(k, v);
};

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg:    "#0a0118", card:  "#120828", card2: "#1a0d3a", card3: "#22104a",
  bord:  "rgba(139,92,246,.2)", bordB: "rgba(139,92,246,.45)",
  pur:   "#9333ea", purL:  "#c4b5fd", purD:  "#6d28d9", purXL: "#f3e8ff",
  text:  "#f5f3ff", textM: "#c4b5fd", textD: "#7c6fad",
  green: "#4ade80", red:   "#f87171", amber: "#fb923c", gold:  "#fbbf24",
  glow:  "0 0 24px rgba(147,51,234,.35)",
  grad:  "linear-gradient(135deg,#1e0a3c 0%,#2d1b69 55%,#1a1f5e 100%)",
};

// Division config
const DIVS = {
  elec: { id:"elec", label:"Electrical",  emoji:"⚡", color:"#f59e0b", storKey: SK.elec, archKey: SK.archElec },
  mech: { id:"mech", label:"Mechanical",  emoji:"🔧", color:"#34d399", storKey: SK.mech, archKey: SK.archMech },
  sw:   { id:"sw",   label:"Software",    emoji:"💻", color:"#60a5fa", storKey: SK.sw,   archKey: SK.archSW  },
};

// Priority config
const PC = {
  CRITICAL:  { label:"CRITICAL",  bg:"#fee2e2", text:"#991b1b", dot:"#dc2626" },
  HIGH:      { label:"HIGH",      bg:"#ffedd5", text:"#9a3412", dot:"#ea580c" },
  MEDIUM:    { label:"MEDIUM",    bg:"#fefce8", text:"#854d0e", dot:"#ca8a04" },
  SECONDARY: { label:"SECONDARY", bg:"#f0fdf4", text:"#166534", dot:"#16a34a" },
};


// ── ELECTRICAL CHECKLIST DATA ─────────────────────────────────────────────────
const ELEC_SECTIONS = [
  {id:"power",title:"⚡ Power & Battery",color:"#b91c1c",bg:"#fef2f2",items:[
    {id:"p1",priority:"CRITICAL",text:"Battery fully charged (≥ 120%)",note:"Use Battery Beak — ideally 130%+"},
    {id:"p2",priority:"CRITICAL",text:"Anderson PowerPole battery connector fully seated & locked",note:"Tug test — zero give"},
    {id:"p3",priority:"CRITICAL",text:"120A main breaker ON and reset (button fully out)",note:"Press to reset if tripped"},
    {id:"p4",priority:"CRITICAL",text:"Circuit breaker tight — no loose nuts or corrosion",note:"Corrosion causes voltage drop"},
    {id:"p5",priority:"CRITICAL",text:"Battery secured in mount",note:"Must not move under hard acceleration"},
    {id:"p6",priority:"CRITICAL",text:"Main power leads (red/black) have no exposed copper",note:"Inspect ferrule crimp ends and full wire run"},
    {id:"p7",priority:"HIGH",text:"REV PDH 2.0 (main) mounted firmly — no flex or wobble",note:"Main PDH handles CAN termination and voltage display"},
    {id:"p8",priority:"HIGH",text:"REV PDH 2.0 voltage display reading 12.0–13.0V",note:"Only PDH with display — blue digits stable and visible"},
    {id:"p9",priority:"HIGH",text:"All REV PDH 2.0 breaker slots occupied or blanked",note:"Open ports = short circuit risk"},
    {id:"p10",priority:"HIGH",text:"REV PDH 2.0 ferrule crimp power input fully seated — tug tested",note:"Partial insertion = full power loss"},
    {id:"p11",priority:"HIGH",text:"Mini PDH #1 mounted firmly and power input ferrule crimps fully seated",note:"Mini PDHs have no display — physical check only"},
    {id:"p12",priority:"HIGH",text:"Mini PDH #2 mounted firmly and power input ferrule crimps fully seated",note:"Tug both input leads"},
    {id:"p13",priority:"MEDIUM",text:"All three PDH breaker ratings match assigned device requirements",note:"Verify no breakers swapped between matches"},
  ]},
  {id:"roborio",title:"🖥️ RoboRIO 2.0 & Radio",color:"#1d4ed8",bg:"#eff6ff",items:[
    {id:"r1",priority:"CRITICAL",text:"RoboRIO STATUS light solid green, COMM light green",note:"Solid red/orange = fault; investigate before queue"},
    {id:"r2",priority:"CRITICAL",text:"RSL connected and blinking orange",note:"Required by rules — blinking = enabled"},
    {id:"r3",priority:"CRITICAL",text:"Radio powered — COMM LED green",note:"Confirm correct team number config"},
    {id:"r4",priority:"CRITICAL",text:"Ethernet cable RoboRIO ↔ radio fully seated on both ends",note:"Click-lock test; half-seated = no comms"},
    {id:"r5",priority:"HIGH",text:"RoboRIO power ferrule crimps fully seated — tug tested",note:"Loose ferrule = brownsout entire RIO"},
    {id:"r6",priority:"HIGH",text:"Radio power cable firmly connected",note:"Common transport damage point"},
    {id:"r7",priority:"HIGH",text:"CANivore USB cable to RoboRIO strain-relieved and seated",note:"This is the entire drivetrain CAN backbone"},
    {id:"r8",priority:"MEDIUM",text:"RoboRIO mounting screws tight — no vibration movement",note:"Loose RIO = intermittent ground faults"},
  ]},
  {id:"can",title:"🔌 CAN Bus",color:"#15803d",bg:"#f0fdf4",items:[
    {id:"c1",priority:"CRITICAL",text:"Standalone 120Ω termination resistor seated at open end of CAN chain",note:"Tug test JST — can vibrate loose"},
    {id:"c2",priority:"CRITICAL",text:"CAN chain end at REV PDH fully plugged in",note:"PDH provides built-in 120Ω — Mini PDHs have no CAN ports"},
    {id:"c3",priority:"CRITICAL",text:"No CAN wire pinched in cross rails or pivot zones",note:"Walk full CAN run; pinched wire fails under vibration"},
    {id:"c4",priority:"CRITICAL",text:"Kraken X60 #1 (FL drive) CAN connector seated — tug tested",note:"One loose joint drops all downstream devices"},
    {id:"c5",priority:"CRITICAL",text:"Kraken X60 #2 (FR drive) CAN connector seated — tug tested",note:null},
    {id:"c6",priority:"CRITICAL",text:"Kraken X60 #3 (BL drive) CAN connector seated — tug tested",note:null},
    {id:"c7",priority:"CRITICAL",text:"Kraken X60 #4 (BR drive) CAN connector seated — tug tested",note:null},
    {id:"c8",priority:"CRITICAL",text:"Falcon 500 #1 (FL turn) CAN connector seated — tug tested",note:"Falcon CAN loosens under vibration"},
    {id:"c9",priority:"CRITICAL",text:"Falcon 500 #2 (FR turn) CAN connector seated — tug tested",note:null},
    {id:"c10",priority:"CRITICAL",text:"Falcon 500 #3 (BL turn) CAN connector seated — tug tested",note:null},
    {id:"c11",priority:"CRITICAL",text:"Falcon 500 #4 (BR turn) CAN connector seated — tug tested",note:null},
    {id:"c12",priority:"CRITICAL",text:"CANcoder #1 (FL steer) seated",note:"Lost CANcoder = wrong wheel angle = dangerous enable"},
    {id:"c13",priority:"CRITICAL",text:"CANcoder #2 (FR steer) seated",note:null},
    {id:"c14",priority:"CRITICAL",text:"CANcoder #3 (BL steer) seated",note:null},
    {id:"c15",priority:"CRITICAL",text:"CANcoder #4 (BR steer) seated",note:null},
    {id:"c16",priority:"CRITICAL",text:"Pigeon 2.0 CAN connector seated — tug tested",note:"Lost Pigeon = no field-centric drive"},
    {id:"c17",priority:"HIGH",text:"Kraken X60 #1 LED — solid orange, no fault blink",note:"Rapid red blink = fault; check Tuner X"},
    {id:"c18",priority:"HIGH",text:"Kraken X60 #2 LED — no fault blink",note:null},
    {id:"c19",priority:"HIGH",text:"Kraken X60 #3 LED — no fault blink",note:null},
    {id:"c20",priority:"HIGH",text:"Kraken X60 #4 LED — no fault blink",note:null},
    {id:"c21",priority:"HIGH",text:"Falcon 500 #1 LED — no fault blink",note:null},
    {id:"c22",priority:"HIGH",text:"Falcon 500 #2 LED — no fault blink",note:null},
    {id:"c23",priority:"HIGH",text:"Falcon 500 #3 LED — no fault blink",note:null},
    {id:"c24",priority:"HIGH",text:"Falcon 500 #4 LED — no fault blink",note:null},
    {id:"c25",priority:"HIGH",text:"CANcoder #1 LED — solid or slow blink, no fast fault blink",note:null},
    {id:"c26",priority:"HIGH",text:"CANcoder #2 LED — no fast fault blink",note:null},
    {id:"c27",priority:"HIGH",text:"CANcoder #3 LED — no fast fault blink",note:null},
    {id:"c28",priority:"HIGH",text:"CANcoder #4 LED — no fast fault blink",note:null},
    {id:"c29",priority:"HIGH",text:"Pigeon 2.0 LED — boot-complete pattern after power-on",note:"Rapid blink = IMU fault"},
    {id:"c30",priority:"HIGH",text:"CANivore LED — solid green after boot",note:"Red/off = USB issue; re-seat USB to RoboRIO"},
    {id:"c31",priority:"HIGH",text:"All CAN device IDs unique — no conflicts in Tuner X",note:"Duplicate IDs = unpredictable behavior"},
    {id:"c32",priority:"HIGH",text:"All CAN devices visible in Tuner X with no active faults",note:"Any red entry = do not queue"},
    {id:"c33",priority:"MEDIUM",text:"CAN bus utilization below 90%",note:"High utilization = delayed motor commands"},
  ]},
  {id:"swerve",title:"🌀 Swerve Drive (×4)",color:"#7e22ce",bg:"#faf5ff",items:[
    {id:"s1",priority:"CRITICAL",text:"All 4 Kraken X60 power connectors fully seated — tug tested",note:"Check at PDH and at motor"},
    {id:"s2",priority:"CRITICAL",text:"All 4 Falcon 500 power connectors fully seated — tug tested",note:"Falcons loosen under vibration"},
    {id:"s3",priority:"CRITICAL",text:"All 4 CANcoder connectors secure on steer modules",note:"Loose = incorrect wheel angle on enable"},
    {id:"s4",priority:"CRITICAL",text:"All 4 CANcoder absolute positions correct",note:"Verify in Tuner X — bad offsets = unsafe enable"},
    {id:"s5",priority:"CRITICAL",text:"No motor wires in swerve rotation path — free flex through full range",note:"Rotate each module by hand and watch wires"},
    {id:"s6",priority:"HIGH",text:"All 4 Kraken LEDs — no fault pattern",note:"Check Phoenix Tuner X"},
    {id:"s7",priority:"HIGH",text:"All 4 Falcon LEDs — no fault pattern",note:"Check Phoenix Tuner X"},
    {id:"s8",priority:"HIGH",text:"Spin each motor by hand — no grinding or resistance",note:"Binding = overcurrent in-match"},
    {id:"s9",priority:"MEDIUM",text:"Swerve module mounting bolts tight",note:"Loose modules = steering angle drift"},
    {id:"s10",priority:"MEDIUM",text:"Krakens and Falcons cool to touch",note:"Too hot = thermal issue; check airflow"},
  ]},
  {id:"pigeon",title:"📡 Pigeon 2.0",color:"#0f766e",bg:"#f0fdfa",items:[
    {id:"g1",priority:"CRITICAL",text:"Pigeon 2.0 rigidly mounted — zero looseness",note:"IMU movement corrupts heading for field-centric drive"},
    {id:"g2",priority:"CRITICAL",text:"Pigeon CAN and power connections seated — tug tested",note:"JST connector"},
    {id:"g3",priority:"HIGH",text:"Pigeon heading reads 0° after yaw reset",note:"Reset before each match"},
    {id:"g4",priority:"MEDIUM",text:"Pigeon firmware current (check Tuner X)",note:null},
  ]},
  {id:"limelight",title:"📷 Limelight",color:"#166534",bg:"#f0fdf4",items:[
    {id:"l1",priority:"CRITICAL",text:"Limelight power cable fully seated — LED ring on at boot",note:"Check green status LED"},
    {id:"l2",priority:"CRITICAL",text:"Limelight Ethernet fully clicked in to network switch",note:"Required for vision data"},
    {id:"l3",priority:"HIGH",text:"Limelight mounting rigid — bracket bolts tight",note:"Camera angle shift corrupts targeting"},
    {id:"l4",priority:"HIGH",text:"Limelight reachable on network (ping limelight.local)",note:"No network = no auto vision"},
    {id:"l5",priority:"MEDIUM",text:"Correct pipeline selected for current game mode",note:null},
    {id:"l6",priority:"MEDIUM",text:"Camera lens clean — no smudges or debris",note:"Quick microfiber wipe before queue"},
  ]},
  {id:"connections",title:"🔗 Connection Integrity",color:"#92400e",bg:"#fffbeb",items:[
    {id:"cn1",priority:"CRITICAL",text:"Tug test ALL PowerPole connectors — none pull loose",note:"Battery, main PDH, both Mini PDHs, all branches"},
    {id:"cn2",priority:"CRITICAL",text:"Tug test ALL ferrule crimp ends",note:"Any movement = re-crimp before queuing"},
    {id:"cn3",priority:"CRITICAL",text:"No blackened, burned, or melted connectors",note:"Discoloration = arcing; fix root cause"},
    {id:"cn4",priority:"HIGH",text:"All Wago lever connectors fully closed",note:"Check lever is fully down"},
    {id:"cn5",priority:"HIGH",text:"All RJ45 Ethernet connectors click-lock tested",note:"RoboRIO, radio, Limelight"},
    {id:"cn6",priority:"HIGH",text:"No exposed bare wire strands outside connectors",note:"Stray strands = short circuit"},
    {id:"cn7",priority:"MEDIUM",text:"Ferrule crimps show no green corrosion or blackening",note:"Discoloration = heat damage"},
  ]},
  {id:"motors",title:"⚙️ Motor Function Check",color:"#be185d",bg:"#fdf2f8",items:[
    {id:"m1",priority:"CRITICAL",text:"Enable robot — all 4 swerve modules respond to joystick",note:"Each wheel should steer and drive correctly"},
    {id:"m2",priority:"CRITICAL",text:"All 4 Krakens spin in correct direction",note:"Verify in Phoenix Tuner X if unsure"},
    {id:"m3",priority:"CRITICAL",text:"All 4 Falcons respond and hold wheel angle",note:"Wheel resists manual rotation when enabled"},
    {id:"m4",priority:"CRITICAL",text:"No motor throws a fault or brownout on enable",note:"Tuner X red entries = do not queue"},
    {id:"m5",priority:"HIGH",text:"All mechanism motors respond to test commands",note:"Run full range in pits"},
    {id:"m6",priority:"HIGH",text:"No unusual sounds from any motor",note:"Listen during pit enable"},
    {id:"m7",priority:"HIGH",text:"Battery voltage stays above 11.0V during full drivetrain enable",note:"Below 10.5V = brownout risk"},
  ]},
  {id:"wiremgmt",title:"🔒 Wire Management",color:"#374151",bg:"#f9fafb",items:[
    {id:"w1",priority:"CRITICAL",text:"No wires near spinning mechanisms, belts, pulleys, or chain",note:"Walk every drivetrain mechanism"},
    {id:"w2",priority:"CRITICAL",text:"All corrugated conduit exits capped or taped",note:"Conduit exits = highest-wear points"},
    {id:"w3",priority:"CRITICAL",text:"All 3D printed cross rail snap-in clips snapped in — none cracked",note:"Popped clip = wires drop into moving parts"},
    {id:"w4",priority:"CRITICAL",text:"All wires seated flush inside cross rail channels",note:"Wire above edge catches on mechanisms"},
    {id:"w5",priority:"HIGH",text:"Inspect clips for cracks — replace any damaged ones",note:"Cracked tabs create sharp points"},
    {id:"w6",priority:"HIGH",text:"All zip ties tight and trimmed — no protruding tails",note:"Tails snag wires under vibration"},
    {id:"w7",priority:"HIGH",text:"No wire under tension — all runs have service loop",note:"Tight wire = broken ferrule after collision"},
    {id:"w8",priority:"SECONDARY",text:"Visual sweep for new wire chafe from last match",note:null},
    {id:"w9",priority:"SECONDARY",text:"No loose screws near electrical board",note:"Metal screw on live PDH = fire"},
  ]},
  {id:"signoff",title:"✅ Pre-Queue Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"f1",priority:"CRITICAL",text:"Robot boots — RIO STATUS green, radio COMM green, RSL blinking",note:"All three must be correct"},
    {id:"f2",priority:"CRITICAL",text:"Driver Station shows robot enabled, all CAN devices visible, no faults",note:"Tuner X must be all green"},
    {id:"f3",priority:"HIGH",text:"Bumpers on or confirmed at queue",note:"OK to install at queue line"},
    {id:"f4",priority:"HIGH",text:"Spare battery on charger for next match",note:"Never queue without charged spare"},
    {id:"f5",priority:"HIGH",text:"Electrical lead has verbally signed off",note:"Two-person verification recommended"},
  ]},
];

// ── MECHANICAL CHECKLIST (placeholder — full list coming) ──────────────────────
const MECH_SECTIONS = [
  {id:"mech_general",title:"🔧 General Mechanical",color:"#059669",bg:"#ecfdf5",items:[
    {id:"mg1",priority:"CRITICAL",text:"[PLACEHOLDER] Full mechanical checklist coming soon",note:"Awaiting checklist from mechanical lead"},
    {id:"mg2",priority:"HIGH",text:"All fasteners checked for tightness after last match",note:null},
    {id:"mg3",priority:"HIGH",text:"No cracked or broken structural components",note:null},
    {id:"mg4",priority:"HIGH",text:"All mechanisms operate through full range of motion",note:null},
  ]},
  {id:"mech_drivetrain",title:"🌀 Drivetrain",color:"#0d9488",bg:"#f0fdfa",items:[
    {id:"md1",priority:"CRITICAL",text:"[PLACEHOLDER] Drivetrain mechanical checks coming soon",note:null},
    {id:"md2",priority:"HIGH",text:"All wheel modules spin freely — no binding",note:null},
    {id:"md3",priority:"HIGH",text:"No debris caught in drivetrain",note:null},
  ]},
  {id:"mech_mechanisms",title:"⚙️ Game Mechanisms",color:"#7c3aed",bg:"#faf5ff",items:[
    {id:"mm1",priority:"CRITICAL",text:"[PLACEHOLDER] Game mechanism checks coming soon",note:null},
    {id:"mm2",priority:"HIGH",text:"All pneumatic connections secure (if applicable)",note:null},
    {id:"mm3",priority:"MEDIUM",text:"Game piece handler inspected for damage",note:null},
  ]},
  {id:"mech_signoff",title:"✅ Mechanical Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"ms1",priority:"CRITICAL",text:"Mechanical lead has verified robot is ready to compete",note:null},
    {id:"ms2",priority:"HIGH",text:"All safety pins and locks removed before enable",note:null},
  ]},
];

// ── SOFTWARE CHECKLIST ─────────────────────────────────────────────────────────
const SW_SECTIONS = [
  {id:"sw_boot",title:"💻 Boot & Comms",color:"#2563eb",bg:"#eff6ff",items:[
    {id:"sw1",priority:"CRITICAL",text:"Robot code deployed and running — DS shows robot enabled",note:"Check Driver Station status indicators"},
    {id:"sw2",priority:"CRITICAL",text:"All subsystems initialized — no null pointer or startup errors in DS log",note:"Check FRC Driver Station message log"},
    {id:"sw3",priority:"CRITICAL",text:"NetworkTables connected — Shuffleboard/Glass showing live data",note:"Required for vision and dashboard monitoring"},
  ]},
  {id:"sw_auto",title:"🤖 Autonomous",color:"#7c3aed",bg:"#faf5ff",items:[
    {id:"sw4",priority:"CRITICAL",text:"Correct autonomous routine selected for this match",note:"Verify with drive team before queue"},
    {id:"sw5",priority:"CRITICAL",text:"Starting position set and verified on field",note:"Robot starting pose must match auto routine"},
    {id:"sw6",priority:"HIGH",text:"Autonomous ran successfully in last practice",note:"If not tested this session, flag to drive team"},
  ]},
  {id:"sw_vision",title:"📷 Vision & Localization",color:"#0891b2",bg:"#ecfeff",items:[
    {id:"sw7",priority:"CRITICAL",text:"Limelight pipeline active and returning valid targets",note:"Check NetworkTables for tv/tx/ty values"},
    {id:"sw8",priority:"HIGH",text:"Pose estimation within expected field bounds",note:"Check odometry on Shuffleboard"},
    {id:"sw9",priority:"HIGH",text:"No vision pipeline errors in DS log",note:null},
  ]},
  {id:"sw_teleop",title:"🕹️ Teleop",color:"#059669",bg:"#ecfdf5",items:[
    {id:"sw10",priority:"CRITICAL",text:"Full systems check passed — all driver controls verified",note:"Run through every button binding with driver"},
    {id:"sw11",priority:"CRITICAL",text:"Drive team confirmed controller layout and all bindings correct",note:null},
    {id:"sw12",priority:"HIGH",text:"No persistent error messages in Driver Station",note:"Yellow/red DS messages = investigate"},
  ]},
  {id:"sw_signoff",title:"✅ Software Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"sw13",priority:"CRITICAL",text:"Software lead has confirmed robot code is ready to compete",note:null},
    {id:"sw14",priority:"HIGH",text:"Drive team is aware of any software limitations this match",note:null},
  ]},
];

// ── CHECKLIST MAP ─────────────────────────────────────────────────────────────
const DIVISION_SECTIONS = { elec: ELEC_SECTIONS, mech: MECH_SECTIONS, sw: SW_SECTIONS };
const getAllItems = (div) => (DIVISION_SECTIONS[div]||[]).flatMap(s=>s.items);
const getCritItems = (div) => getAllItems(div).filter(i=>i.priority==="CRITICAL");


// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtTime = ms=>!ms?"TBD":new Date(ms).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDate = ms=>!ms?"":new Date(ms).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
const fmtDT   = ms=>!ms?"":new Date(ms).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtCD   = ms=>{const s=Math.abs(ms)/1000,h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=Math.floor(s%60);
  return h>0?`${h}h ${String(m).padStart(2,"0")}m ${String(sc).padStart(2,"0")}s`:`${String(m).padStart(2,"0")}m ${String(sc).padStart(2,"0")}s`;};
const getTS = m=>m?.predicted_time||m?.time||null;
const mLbl  = m=>{if(!m)return"";return`${m.comp_level==="qm"?"Q":m.comp_level==="sf"?"SF":"F"}${m.match_number}`};
const getAl = (m,c)=>(m?.alliances?.[c]?.team_keys||[]).map(k=>k.replace("frc",""));

function useNow(ms=1000){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),ms);return()=>clearInterval(t);},[ms]);
  return now;}

function parseNexusLabel(lbl=""){
  if(!lbl)return null;const l=lbl.toLowerCase();
  if(l.startsWith("qualification"))return{level:"qm",num:parseInt(l.replace(/\D/g,""))||0};
  if(l.startsWith("playoff"))return{level:"sf",num:parseInt(l.replace(/\D/g,""))||0};
  if(l.startsWith("final"))return{level:"f",num:parseInt(l.replace(/\D/g,""))||0};
  return null;}
const matchLabelFromParsed=p=>!p?"":p.level==="qm"?`Q${p.num}`:p.level==="sf"?`SF${p.num}`:`F${p.num}`;
function findNexusMatch(nx=[],parsed){if(!parsed)return null;
  return nx.find(m=>{const p=parseNexusLabel(m.label);return p&&p.level===parsed.level&&p.num===parsed.num;})||null;}
function findQueueTrigger(nx=[],ourM){if(!ourM)return null;
  const idx=nx.findIndex(m=>m.label===ourM.label);if(idx<0)return null;
  return idx>=2?nx[idx-2]:nx[0]!==ourM?nx[0]:null;}
function bestMatchTime(nxM,tbaM){
  if(nxM?.times?.estimatedStartTime)return nxM.times.estimatedStartTime;
  const t=getTS(tbaM);return t?t*1000:null;}
function bestQueueTime(trigNx,ourMs){
  if(trigNx?.times?.estimatedStartTime)return trigNx.times.estimatedStartTime;
  return ourMs?ourMs-10*60*1000:null;}
function getAlliances(nxM,tbaM){
  const red=nxM?(nxM.redTeams||[]):getAl(tbaM,"red");
  const blue=nxM?(nxM.blueTeams||[]):getAl(tbaM,"blue");
  const mc=red.includes(TEAM_NUM)?"red":"blue";
  return{myColor:mc,partners:(mc==="red"?red:blue).filter(t=>t!==TEAM_NUM),opponents:mc==="red"?blue:red};}
function nexusSS(status){if(!status)return null;const s=status.toLowerCase();
  if(s.includes("queuing"))return{bg:"#fef9c3",text:"#854d0e",label:status};
  if(s.includes("deck"))return{bg:"#ffedd5",text:"#9a3412",label:status};
  if(s.includes("field"))return{bg:"#fee2e2",text:"#991b1b",label:status};
  if(s.includes("complete"))return{bg:"#f1f5f9",text:"#64748b",label:status};
  return{bg:"#eff6ff",text:"#1d4ed8",label:status};}

async function sendEmail(mLabel,leadName,div,completed,total,quickMode){
  try{
    const r=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
      method:"POST",headers:{"Content-Type":"application/json","Origin":"https://claude.ai"},
      body:JSON.stringify({service_id:EJS_SERVICE,template_id:EJS_TEMPLATE,user_id:EJS_PUBKEY,accessToken:EJS_PUBKEY,
        template_params:{to_email:NOTIFY_EMAIL,team_number:"115",match_label:mLabel,
          lead_name:`${leadName||"Unknown"} (${div})`,completed:String(completed),total:String(total),
          submitted_time:new Date().toLocaleTimeString(),event:EVENT_NAME,
          method:quickMode?"Quick Complete":"Manual"}})});
    return r.ok;
  }catch(e){console.warn("Email failed:",e);return false;}}

function buildMockNexus(){
  const now=Date.now(),min=60000;
  const TM=new Set([1,4,7,10,13,16]);
  const F=[["330","2910","3538","1323","4255","6036"],["4150","2984","5507","6418","3255","1678"]];
  const matches=Array.from({length:18},(_,i)=>{
    const q=i+1,startMs=now+10*min+14*min+i*7*min,h=TM.has(q);
    const red=h?(q%2===0?["115","254","1678"]:["115","3538","4255"]):[F[0][i%6],F[1][i%6],F[0][(i+2)%6]];
    const blue=h?(q%2===0?["330","2910","6036"]:["330","2910","1323"]):[F[1][(i+1)%6],F[0][(i+3)%6],F[1][(i+4)%6]];
    const qAt=startMs-14*min,odAt=startMs-6*min,ofAt=startMs-2*min;
    let st="Scheduled";
    if(startMs<now-2*min)st="Complete";
    else if(now>=ofAt)st="On Field";
    else if(now>=odAt)st="On Deck";
    else if(now>=qAt)st="Now Queuing";
    return{label:`Qualification ${q}`,status:st,redTeams:red,blueTeams:blue,
      times:{estimatedQueueTime:qAt,estimatedOnDeckTime:odAt,estimatedOnFieldTime:ofAt,estimatedStartTime:startMs}};});
  const qm=matches.find(m=>m.status==="Now Queuing");
  return{eventKey:"demo",dataAsOfTime:now,nowQueuing:qm?.label||null,matches,announcements:[],partsRequests:[]};}

// ── SHARED UI ATOMS ───────────────────────────────────────────────────────────
function Badge({p}){const c=PC[p]||PC.SECONDARY;
  return (<span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,background:c.bg,color:c.text,whiteSpace:"nowrap",flexShrink:0}}>{c.label}</span>);}

function GlassCard({children,style={}}){
  return (<div style={{background:T.card,border:`1px solid ${T.bord}`,borderRadius:14,...style}}>{children}</div>);}

function SyncStatus(){
  const [status,setStatus]=useState("checking");
  useEffect(()=>{
    const check=async()=>{
      try{const r=await fetch(`${UPS_URL}/ping`,{headers:{Authorization:`Bearer ${UPS_TOKEN}`}});
        const j=await r.json();setStatus(j.result==="PONG"?"synced":"error");}
      catch{setStatus("error");}};
    check();const t=setInterval(check,30000);return()=>clearInterval(t);
  },[]);
  const cfg={synced:{dot:T.green,glow:`0 0 5px ${T.green}`,txt:"Live Sync ✓"},
    checking:{dot:T.gold,glow:null,txt:"Connecting…"},error:{dot:T.red,glow:null,txt:"Sync Error"}}[status]||{dot:"#888",txt:"…"};
  return(
    <div style={{fontSize:10,display:"flex",alignItems:"center",gap:4,color:T.textD,marginTop:1}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:cfg.dot,boxShadow:cfg.glow,flexShrink:0}}/>
      <span>MVRT 115 · {EVENT_NAME} · {cfg.txt}</span>
    </div>);}

function AnnouncementBanner(){
  const [ann,setAnn]=useState([]);
  useEffect(()=>{
    const poll=()=>ls(SK.announce).then(d=>setAnn(d||[]));
    poll();const t=setInterval(poll,3000);return()=>clearInterval(t);
  },[]);
  if(!ann.length)return null;
  const C={queue:{bg:"#fef2f2",border:"#dc2626",text:"#991b1b"},urgent:{bg:"#fffbeb",border:"#f59e0b",text:"#854d0e"},info:{bg:"#faf5ff",border:"#9333ea",text:"#6d28d9"}};
  const sorted=[...ann].sort((a,b)=>({queue:0,urgent:1,info:2}[a.urgency]??2)-({queue:0,urgent:1,info:2}[b.urgency]??2));
  return(
    <div>
      {sorted.map((a,i)=>{const c=C[a.urgency]||C.info;return(
        <div key={a.id} style={{background:c.bg,borderLeft:`4px solid ${c.border}`,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${c.border}40`}}>
          <span style={{fontSize:16}}>{a.urgency==="queue"?"🚨":a.urgency==="urgent"?"⚠️":"📢"}</span>
          <div style={{flex:1,fontSize:13,fontWeight:700,color:c.text}}>{a.text}</div>
          <div style={{fontSize:10,color:c.text,opacity:.6}}>{new Date(a.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
        </div>);})}
    </div>);}

// Error boundary
class ErrorBoundary extends React.Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:e};}
  componentDidCatch(e,i){console.error("Crash:",e,i);}
  render(){
    if(this.state.err)return(
      <div style={{padding:32,background:T.card,color:T.red,minHeight:"100vh",fontFamily:"monospace"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:10}}>⚠️ App Error</div>
        <div style={{fontSize:12,whiteSpace:"pre-wrap",wordBreak:"break-all",color:T.textM}}>{String(this.state.err)}</div>
        <button onClick={()=>this.setState({err:null})} style={{marginTop:16,padding:"8px 16px",background:T.pur,color:"white",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700}}>Retry</button>
      </div>);
    return this.props.children;}}


// ── HOME PAGE ─────────────────────────────────────────────────────────────────
function HomePage({onLeadMode,onDirectorMode,archive}){
  const now=useNow(1000);
  // Countdown to event start: April 2, 2026 7:00 AM PT
  const eventStart=new Date("2026-04-02T07:00:00-07:00").getTime();
  const diffToEvent=eventStart-now;
  const eventStarted=diffToEvent<=0;

  // Stats from archive
  const totalSubs=Object.values(archive).reduce((a,arr)=>a+(arr?.length||0),0);
  const lastSub=Object.values(archive).flatMap(arr=>arr||[]).sort((a,b)=>b.submittedAt-a.submittedAt)[0];

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"0 0 40px"}}>
      {/* Hero header */}
      <div style={{width:"100%",background:T.grad,padding:"40px 24px 32px",textAlign:"center",boxShadow:`0 8px 32px rgba(80,0,180,.4)`,position:"relative",overflow:"hidden"}}>
        {/* Background glow */}
        <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:300,borderRadius:"50%",background:"rgba(147,51,234,.15)",filter:"blur(60px)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          {/* Logo mark */}
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:20,background:"rgba(147,51,234,.3)",border:`2px solid ${T.bordB}`,marginBottom:16,boxShadow:T.glow}}>
            <span style={{fontSize:36}}>🤖</span>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:T.purL,letterSpacing:3,textTransform:"uppercase",marginBottom:4}}>MVRT Team 115</div>
          <div style={{fontSize:28,fontWeight:900,color:T.text,letterSpacing:.5,marginBottom:4}}>Pit CheckList App</div>
          <div style={{fontSize:13,color:T.textD,marginBottom:20}}>{EVENT_NAME} · {EVENT_DATES} · {EVENT_LOCATION}</div>

          {/* Event countdown */}
          <div style={{display:"inline-block",background:"rgba(0,0,0,.3)",borderRadius:12,padding:"10px 20px",border:`1px solid ${T.bord}`}}>
            {eventStarted?(
              <div style={{fontSize:14,fontWeight:700,color:T.green}}>🏆 Event In Progress!</div>
            ):(
              <div>
                <div style={{fontSize:10,color:T.textD,letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>Event starts in</div>
                <div style={{fontFamily:"monospace",fontSize:20,fontWeight:800,color:T.purL,letterSpacing:2}}>{fmtCD(diffToEvent)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status summary */}
      {totalSubs>0&&(
        <div style={{width:"100%",maxWidth:480,padding:"12px 20px",background:T.card2,borderBottom:`1px solid ${T.bord}`,display:"flex",gap:16,alignItems:"center"}}>
          <div style={{display:"flex",gap:16}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:T.purL}}>{totalSubs}</div>
              <div style={{fontSize:10,color:T.textD}}>Submitted</div>
            </div>
            {lastSub&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.text}}>Last: Match {lastSub.matchNum||"?"}</div>
              <div style={{fontSize:10,color:T.textD}}>{lastSub.division?.toUpperCase()} · {fmtTime(lastSub.submittedAt)}</div>
            </div>}
          </div>
          <div style={{flex:1,textAlign:"right",fontSize:10,color:T.textD}}>
            {Object.entries({elec:"⚡",mech:"🔧",sw:"💻"}).map(([div,emoji])=>{
              const count=(archive[div]||[]).length;
              return <div key={div}>{emoji} {count} {div}</div>;
            })}
          </div>
        </div>
      )}

      {/* Mode selection */}
      <div style={{width:"100%",maxWidth:480,padding:"24px 20px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:2,textTransform:"uppercase",marginBottom:4,textAlign:"center"}}>Select Your Role</div>

        {/* Lead Mode card */}
        <button onClick={onLeadMode}
          style={{width:"100%",background:T.card,border:`1px solid ${T.bord}`,borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",transition:"all .2s",boxShadow:T.glow}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:14,background:"rgba(147,51,234,.2)",border:`1px solid ${T.pur}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>📋</div>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:T.text,marginBottom:3}}>Lead Mode</div>
              <div style={{fontSize:12,color:T.textD,lineHeight:1.5}}>For Electrical, Mechanical, and Software leads — complete your pre-queue checklist</div>
            </div>
            <span style={{fontSize:20,color:T.purL}}>›</span>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            {[{e:"⚡",l:"Electrical"},{e:"🔧",l:"Mechanical"},{e:"💻",l:"Software"}].map(({e,l})=>(
              <div key={l} style={{flex:1,background:"rgba(147,51,234,.1)",borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
                <div style={{fontSize:16}}>{e}</div>
                <div style={{fontSize:9,fontWeight:700,color:T.textM,marginTop:2}}>{l}</div>
              </div>))}
          </div>
        </button>

        {/* Director Mode card */}
        <button onClick={onDirectorMode}
          style={{width:"100%",background:"rgba(109,40,217,.1)",border:`1px solid ${T.purD}`,borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:14,background:"rgba(109,40,217,.25)",border:`1px solid ${T.pur}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🎛️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:T.text,marginBottom:3}}>Director Mode</div>
              <div style={{fontSize:12,color:T.textD,lineHeight:1.5}}>Monitor all divisions, push announcements, and manage the event — PIN required</div>
            </div>
            <span style={{fontSize:16,padding:"4px 8px",borderRadius:8,background:"rgba(147,51,234,.2)",color:T.purL,fontWeight:700,fontSize:10}}>🔐 PIN</span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div style={{fontSize:10,color:T.textD,textAlign:"center",marginTop:8}}>
        Data: TBA · Nexus · Statbotics · Sync: Upstash
      </div>
    </div>);}

// ── PIN SCREEN ─────────────────────────────────────────────────────────────────
function PinScreen({onUnlock,onBack,activePin}){
  const [pin,setPin]=useState("");
  const [shake,setShake]=useState(false);
  useEffect(()=>{
    if(document.getElementById("frc115-kf"))return;
    const s=document.createElement("style");s.id="frc115-kf";
    s.textContent="@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}";
    document.head.appendChild(s);
  },[]);
  const submit=()=>{
    if(pin===activePin){onUnlock();}
    else{setShake(true);setPin("");setTimeout(()=>setShake(false),500);}};
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Segoe UI',Arial,sans-serif"}}>
      <div style={{width:"100%",maxWidth:300,animation:shake?"shake .4s ease":"none"}}>
        {onBack&&<button onClick={onBack} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>← Back</button>}
        <div style={{background:T.card,border:`1px solid ${T.bord}`,borderRadius:20,padding:32,boxShadow:T.glow}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:36,marginBottom:8}}>🔐</div>
            <div style={{fontWeight:800,fontSize:18,color:T.text}}>Director Mode</div>
            <div style={{fontSize:11,color:T.textD,marginTop:4}}>MVRT Team 115</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:12,height:12,borderRadius:"50%",background:pin.length>i?T.purL:"rgba(139,92,246,.25)",border:`2px solid rgba(139,92,246,.4)`,transition:"all .15s"}}/>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
              <button key={i} onClick={()=>{if(k==="⌫")setPin(p=>p.slice(0,-1));else if(k!==""&&pin.length<4)setPin(p=>p+String(k));}}
                disabled={k===""}
                style={{padding:"13px 0",borderRadius:10,border:`1px solid ${T.bord}`,background:k===""?"transparent":"rgba(147,51,234,.1)",color:T.text,fontSize:18,fontWeight:700,cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
                {k}
              </button>))}
          </div>
          <button onClick={submit} disabled={pin.length<4}
            style={{width:"100%",background:pin.length===4?T.pur:"rgba(126,34,206,.2)",color:pin.length===4?"white":T.textD,border:"none",borderRadius:10,padding:"12px",fontWeight:800,fontSize:15,cursor:pin.length===4?"pointer":"default",transition:"all .2s"}}>
            Unlock
          </button>
        </div>
      </div>
    </div>);}

// ── DIVISION PICKER ───────────────────────────────────────────────────────────
function DivisionPicker({onPick,onBack}){
  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Segoe UI',Arial,sans-serif",padding:"0 0 40px"}}>
      <div style={{background:T.grad,padding:"20px 20px 24px",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.textD,cursor:"pointer",fontSize:13,marginBottom:10,display:"flex",alignItems:"center",gap:4}}>← Home</button>
        <div style={{fontSize:11,fontWeight:700,color:T.purL,letterSpacing:2,textTransform:"uppercase"}}>MVRT Team 115 · Lead Mode</div>
        <div style={{fontSize:22,fontWeight:800,color:T.text,marginTop:4}}>Select Your Division</div>
      </div>
      <div style={{padding:"24px 20px",display:"flex",flexDirection:"column",gap:14,maxWidth:480,margin:"0 auto"}}>
        {[
          {div:"elec",emoji:"⚡",name:"Electrical",desc:"Power systems, CAN bus, motors, wiring — full pre-queue checklist",color:"#f59e0b",sections:ELEC_SECTIONS.length,items:getAllItems("elec").length},
          {div:"mech",emoji:"🔧",name:"Mechanical",desc:"Drivetrain, mechanisms, fasteners — pre-queue mechanical checks",color:"#34d399",sections:MECH_SECTIONS.length,items:getAllItems("mech").length},
          {div:"sw",  emoji:"💻",name:"Software",  desc:"Code deployment, autonomous, vision, systems check",color:"#60a5fa",sections:SW_SECTIONS.length,items:getAllItems("sw").length},
        ].map(({div,emoji,name,desc,color,sections,items})=>(
          <button key={div} onClick={()=>onPick(div)}
            style={{width:"100%",background:T.card,border:`1px solid ${T.bord}`,borderRadius:16,padding:"18px",textAlign:"left",cursor:"pointer",boxShadow:T.glow}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:52,height:52,borderRadius:14,background:`${color}20`,border:`1px solid ${color}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:800,color:T.text,marginBottom:3}}>{name}</div>
                <div style={{fontSize:12,color:T.textD,lineHeight:1.4,marginBottom:6}}>{desc}</div>
                <div style={{display:"flex",gap:10}}>
                  <span style={{fontSize:10,fontWeight:700,color,background:`${color}20`,padding:"2px 8px",borderRadius:99}}>{sections} sections</span>
                  <span style={{fontSize:10,fontWeight:700,color:T.textD,background:"rgba(255,255,255,.06)",padding:"2px 8px",borderRadius:99}}>{items} items</span>
                </div>
              </div>
              <span style={{fontSize:20,color:T.textD}}>›</span>
            </div>
          </button>))}
      </div>
    </div>);}


// ── CHECKLIST TAB ─────────────────────────────────────────────────────────────
function CheckItem({item,done,onToggle}){
  return(
    <div onClick={()=>onToggle(item.id)}
      style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",cursor:"pointer",
        borderBottom:"1px solid #f1f5f9",background:done?"#f0fdf4":"white",transition:"background .12s"}}>
      <div style={{width:20,height:20,borderRadius:4,flexShrink:0,marginTop:1,
        border:`2px solid ${done?"#16a34a":"#cbd5e1"}`,background:done?"#16a34a":"white",
        display:"flex",alignItems:"center",justifyContent:"center",transition:"all .12s"}}>
        {done&&<span style={{color:"white",fontSize:12,fontWeight:700}}>✓</span>}
      </div>
      <div style={{flexShrink:0,marginTop:2}}><Badge p={item.priority}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:done?400:600,color:done?"#6b7280":"#1e293b",textDecoration:done?"line-through":"none",lineHeight:1.4}}>{item.text}</div>
        {item.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>➤ {item.note}</div>}
      </div>
    </div>);}

function SectionBlock({section,checked,onToggle}){
  const [open,setOpen]=useState(true);
  const done=section.items.filter(i=>checked[i.id]).length;
  const allDone=done===section.items.length;
  const pct=Math.round(done/section.items.length*100);
  return(
    <div style={{borderRadius:10,overflow:"hidden",border:`1px solid ${allDone?"#bbf7d0":"#e2e8f0"}`,marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",background:allDone?"#f0fdf4":section.bg||"#f8fafc",border:"none",cursor:"pointer",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
        <div style={{width:3,height:32,borderRadius:2,background:section.color,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,color:section.color}}>{section.title}</div>
          <div style={{fontSize:11,color:"#64748b"}}>{done}/{section.items.length} complete</div>
        </div>
        <div style={{width:56,background:"#e2e8f0",borderRadius:99,height:5,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:allDone?"#16a34a":section.color,borderRadius:99,transition:"width .3s"}}/>
        </div>
        {allDone&&<span style={{fontSize:14}}>✅</span>}
        <span style={{color:"#94a3b8",fontSize:12}}>{open?"▾":"▸"}</span>
      </button>
      {open&&<div>{section.items.map(item=><CheckItem key={item.id} item={item} done={!!checked[item.id]} onToggle={onToggle}/>)}</div>}
    </div>);}

function MatchIntelPanel({autoMatch,nexusData,tbaMatches}){
  const now=useNow();
  const [sb,setSb]=useState(null);const prevKey=useRef(null);
  const parsed=autoMatch;
  const nxM=parsed?findNexusMatch(nexusData?.matches||[],parsed):null;
  const tbaM=parsed?tbaMatches.find(m=>m.comp_level===(parsed.level==="qm"?"qm":parsed.level)&&m.match_number===parsed.num):null;
  const evKey=tbaM?.event_key||EVENT_KEY;
  const tbaKey=parsed&&parsed.level==="qm"?`${evKey}_qm${parsed.num}`:null;
  useEffect(()=>{
    if(!tbaKey||tbaKey===prevKey.current)return;
    prevKey.current=tbaKey;setSb(null);
    fetch(`https://api.statbotics.io/v3/match/${tbaKey}`).then(r=>r.ok?r.json():null).then(d=>setSb(d)).catch(()=>{});
  },[tbaKey]);
  if(!parsed||(!nxM&&!tbaM&&!sb))return null;
  const ts=bestMatchTime(nxM,tbaM);
  const trigNx=nxM?findQueueTrigger(nexusData?.matches||[],nxM):null;
  const qMs=bestQueueTime(trigNx,ts);
  const diffMs=qMs?qMs-now:null;
  const passed=diffMs!==null&&diffMs<0;
  const urgent=diffMs!==null&&diffMs>=0&&diffMs<90000;
  const al=getAlliances(nxM,tbaM);
  const ss2=nexusSS(nxM?.status);
  const myWP=sb?.pred?.red_win_prob!=null?(al?.myColor==="red"?sb.pred.red_win_prob:1-sb.pred.red_win_prob):null;
  const label=nxM?.label||matchLabelFromParsed(parsed);
  return(
    <div style={{margin:"8px 14px 0",borderRadius:12,overflow:"hidden",border:`2px solid ${urgent||passed?"#fca5a5":T.bord}`,boxShadow:urgent||passed?"none":T.glow}}>
      <div style={{background:urgent||passed?"#fef2f2":T.card,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontWeight:800,fontSize:18,color:urgent||passed?"#dc2626":T.text}}>{label}</span>
            {ss2&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
          </div>
          {ts&&<div style={{fontSize:11,color:urgent||passed?"#64748b":T.textD,marginTop:1}}>{fmtDate(ts)} · {fmtTime(ts)}</div>}
          {qMs&&<div style={{fontSize:10,color:urgent||passed?"#dc2626":T.textD,marginTop:2}}>{trigNx?`Queue at start of ${trigNx.label} — ${fmtTime(qMs)}`:`Queue at ${fmtTime(qMs)}`}</div>}
        </div>
        {diffMs!==null&&!passed&&<div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:9,color:urgent?"#dc2626":T.textD,textTransform:"uppercase",letterSpacing:.5}}>queue in</div>
          <div style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:urgent?"#dc2626":T.text}}>{fmtCD(diffMs)}</div>
        </div>}
        {passed&&<div style={{background:"#dc2626",color:"white",padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:800,flexShrink:0}}>🚨 QUEUE!</div>}
      </div>
      <div style={{background:"rgba(255,255,255,.03)",padding:"10px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
        {al&&(<>
          <div style={{flex:1,minWidth:80,background:al.myColor==="red"?"#fef2f2":"#eff6ff",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,fontWeight:700,color:al.myColor==="red"?"#991b1b":"#1d4ed8",marginBottom:3,textTransform:"uppercase"}}>Partners</div>
            {al.partners.map(t=><div key={t} style={{fontSize:12,fontWeight:700,color:al.myColor==="red"?"#dc2626":"#2563eb"}}>#{t}</div>)}
          </div>
          <div style={{flex:1,minWidth:80,background:"rgba(255,255,255,.04)",borderRadius:8,padding:"7px 10px"}}>
            <div style={{fontSize:9,fontWeight:700,color:T.textD,marginBottom:3,textTransform:"uppercase"}}>Opponents</div>
            {al.opponents.map(t=><div key={t} style={{fontSize:12,fontWeight:600,color:T.textM}}>#{t}</div>)}
          </div>
        </>)}
        {myWP!=null&&(
          <div style={{flex:2,minWidth:110,background:"rgba(147,51,234,.1)",borderRadius:8,padding:"7px 10px",border:`1px solid ${T.bord}`}}>
            <div style={{fontSize:9,fontWeight:700,color:T.purL,marginBottom:4,textTransform:"uppercase"}}>Statbotics</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:10,fontWeight:700,color:myWP>=.5?T.green:T.red}}>Us {Math.round(myWP*100)}%</span>
              <span style={{fontSize:10,color:T.textD}}>Them {Math.round((1-myWP)*100)}%</span>
            </div>
            <div style={{background:"rgba(255,255,255,.1)",borderRadius:99,height:6,overflow:"hidden"}}>
              <div style={{width:`${myWP*100}%`,height:"100%",background:myWP>=.5?T.green:T.red,borderRadius:99}}/>
            </div>
          </div>
        )}
      </div>
    </div>);}

function ChecklistTab({div,nexusData,tbaMatches,autoMatch,demoMode}){
  const sections=DIVISION_SECTIONS[div]||[];
  const allItems=getAllItems(div);
  const allIds=allItems.map(i=>i.id);
  const critItems=getCritItems(div);
  const divCfg=DIVS[div];

  const [checked,setChecked]=useState({});
  const [lead,setLead]=useState("");
  const [submitting,setSubmit]=useState(false);
  const [msg,setMsg]=useState("");
  const [showMarkAll,setMarkAll]=useState(false);
  const syncRef=useRef(null);

  const matchNum=autoMatch?matchLabelFromParsed(autoMatch):"";
  const total=allItems.length,done=Object.values(checked).filter(Boolean).length;
  const pct=Math.round(done/total*100);
  const critDone=critItems.filter(i=>checked[i.id]).length,allCrit=critDone===critItems.length;

  const sKey=useCallback(()=>matchNum?`${divCfg.storKey}:${matchNum}`:divCfg.storKey,[divCfg.storKey,matchNum]);
  const loadState=useCallback(async()=>{const d=await ls(sKey());if(d?.checked)setChecked(d.checked);},[sKey]);
  useEffect(()=>{loadState();},[loadState]);
  useEffect(()=>{syncRef.current=setInterval(loadState,3000);return()=>clearInterval(syncRef.current);},[loadState]);

  const toggle=useCallback(async id=>{
    setChecked(prev=>{const next={...prev,[id]:!prev[id]};ss(sKey(),{checked:next,updatedBy:lead||"unknown",division:div,updatedAt:Date.now()});return next;});
  },[sKey,lead,div]);

  const doMarkAll=async()=>{
    const all=allIds.reduce((a,id)=>({...a,[id]:true}),{});
    setChecked(all);await ss(sKey(),{checked:all,updatedBy:lead||"unknown",division:div,updatedAt:Date.now()});setMarkAll(false);};
  const doReset=async()=>{setChecked({});setMsg("");await ss(sKey(),{checked:{},updatedBy:lead||"unknown",division:div,updatedAt:Date.now()});};
  const doSubmit=async(quickMode=false)=>{
    if(!allCrit){setMsg("⚠️ Complete all critical items first.");return;}
    setSubmit(true);
    const archKey=demoMode?"frc115_arch_demo_v6":divCfg.archKey;
    const entry={matchNum:matchNum||"?",lead:lead||"Unknown",division:div,submittedAt:Date.now(),completedCount:done,checkedIds:allIds.filter(id=>checked[id]),markedAllComplete:quickMode,isDemo:demoMode};
    const existing=await ls(archKey)||[];await ss(archKey,[...existing,entry]);
    let ok=false;if(!demoMode)ok=await sendEmail(`Match ${matchNum||"?"}`,lead,div,done,total,quickMode);
    if(demoMode)setMsg("✅ Demo submitted!");
    else if(ok)setMsg(`✅ Submitted! Email sent.`);
    else setMsg("✅ Archived — email failed");
    setTimeout(async()=>{setChecked({});setMsg("");await ss(sKey(),{checked:{},updatedBy:"auto-reset",division:div,updatedAt:Date.now()});},3000);
    setSubmit(false);};

  return(
    <div style={{paddingBottom:24}}>
      {/* Division + match bar */}
      <div style={{background:T.card,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-end",borderBottom:`1px solid ${T.bord}`}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,fontWeight:700,color:T.textD,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Division</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:18}}>{divCfg.emoji}</span>
            <span style={{fontSize:14,fontWeight:800,color:divCfg.color}}>{divCfg.label}</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,fontWeight:700,color:T.textD,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Current Match</div>
          <div style={{background:"rgba(255,255,255,.06)",border:`1px solid ${T.bord}`,borderRadius:6,padding:"5px 9px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:16,fontWeight:800,color:matchNum?T.text:"#475569"}}>{matchNum||"—"}</span>
            {matchNum?<span style={{fontSize:9,color:T.green,fontWeight:600}}>● auto</span>:<span style={{fontSize:9,color:T.textD}}>fetch schedule</span>}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,fontWeight:700,color:T.textD,marginBottom:3,textTransform:"uppercase",letterSpacing:1}}>Initials</div>
          <input value={lead} onChange={e=>setLead(e.target.value)} placeholder="JD"
            style={{width:"100%",background:"rgba(255,255,255,.08)",border:`1px solid ${T.bord}`,borderRadius:6,color:T.text,padding:"5px 8px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
      </div>

      <MatchIntelPanel autoMatch={autoMatch} nexusData={nexusData} tbaMatches={tbaMatches}/>

      {/* Sticky progress */}
      <div style={{background:"white",padding:"10px 14px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,zIndex:40,boxShadow:"0 2px 6px rgba(0,0,0,.06)",marginTop:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:13}}>{done}/{total}</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:12,fontWeight:700,background:allCrit?"#dcfce7":"#fee2e2",color:allCrit?"#166534":"#991b1b"}}>{allCrit?"✓ Critical clear":`⚠ ${critItems.length-critDone} critical left`}</span>
          </div>
          <button onClick={doReset} style={{background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600,color:"#64748b"}}>Reset</button>
        </div>
        <div style={{background:"#e2e8f0",borderRadius:99,height:6,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:pct===100?"#16a34a":pct>60?T.pur:"#f59e0b",transition:"width .3s"}}/>
        </div>
      </div>

      {/* Quick complete */}
      <div style={{background:"#faf5ff",borderBottom:"1px solid #e9d5ff",padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:T.purD}}>⚡ Quick Complete</div>
            <div style={{fontSize:11,color:T.textD,marginTop:1}}>No time to check individually? Mark everything done at once.</div>
          </div>
          <button onClick={()=>setMarkAll(true)} style={{background:T.pur,color:"white",border:"none",borderRadius:7,padding:"8px 12px",fontWeight:700,fontSize:12,cursor:"pointer",flexShrink:0}}>✓ Mark All</button>
        </div>
      </div>

      {showMarkAll&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"white",borderRadius:16,padding:24,maxWidth:320,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
          <div style={{textAlign:"center",fontSize:32,marginBottom:8}}>⚡</div>
          <div style={{fontWeight:800,fontSize:16,textAlign:"center",marginBottom:8}}>Mark All Complete?</div>
          <div style={{fontSize:13,color:"#64748b",textAlign:"center",lineHeight:1.6,marginBottom:20}}>Checks off all <strong>{total} items</strong>. Only use if you've physically verified everything.</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setMarkAll(false)} style={{flex:1,background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",color:"#374151"}}>Cancel</button>
            <button onClick={doMarkAll} style={{flex:2,background:T.pur,color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Yes, Mark All Done</button>
          </div>
        </div>
      </div>}

      <div style={{padding:"12px 14px 0"}}>
        {sections.map(s=><SectionBlock key={s.id} section={s} checked={checked} onToggle={toggle}/>)}
      </div>

      <div style={{padding:"4px 14px"}}>
        {msg&&<div style={{borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:13,fontWeight:600,background:msg.startsWith("✅")?"#dcfce7":"#fee2e2",color:msg.startsWith("✅")?"#166534":"#991b1b"}}>{msg}</div>}
        <button onClick={()=>doSubmit(false)} disabled={submitting||!allCrit}
          style={{width:"100%",background:allCrit?"#16a34a":"#94a3b8",color:"white",border:"none",borderRadius:9,padding:"13px",fontWeight:700,fontSize:15,cursor:allCrit?"pointer":"not-allowed",transition:"background .2s"}}>
          {submitting?"Submitting…":allCrit?"✅ Submit & Notify Director":"Complete all critical items to submit"}
        </button>
      </div>
    </div>);}


// ── SCHEDULE TAB ──────────────────────────────────────────────────────────────
function ScheduleTab({nexusData,tbaMatches,onFetch,loading,error}){
  const now=useNow();
  const alerted=useRef(new Set());
  const t115nx=(nexusData?.matches||[]).filter(m=>[...(m.redTeams||[]),...(m.blueTeams||[])].includes(TEAM_NUM));
  const t115tba=tbaMatches.filter(m=>[...(m.alliances?.red?.team_keys||[]),...(m.alliances?.blue?.team_keys||[])].includes(TEAM_KEY));
  const nextNx=t115nx.find(m=>{const ts=m.times?.estimatedStartTime;return ts&&ts>now-300000;});
  const nextTba=t115tba.find(m=>{const ts=getTS(m);return ts&&ts*1000>now-300000;});
  useEffect(()=>{t115nx.forEach(m=>{const qi=m.times?.estimatedQueueTime;if(!qi)return;const diff=qi-now;
    if(diff>0&&diff<30000&&!alerted.current.has(m.label)){alerted.current.add(m.label);
      if(Notification.permission==="granted")new Notification(`🤖 Team 115 — Queue for ${m.label}!`);}});},[now,t115nx]);

  const renderHero=(nxM,tbaM)=>{
    if(!nxM&&!tbaM)return(
      <div style={{background:T.card,borderRadius:12,padding:16,color:T.textD,textAlign:"center",fontSize:13,marginBottom:14,border:`1px solid ${T.bord}`}}>
        {tbaMatches.length===0?"No schedule loaded — tap Fetch below":"No upcoming matches found"}
      </div>);
    const ts=bestMatchTime(nxM,tbaM);
    const trig=nxM?findQueueTrigger(nexusData?.matches||[],nxM):null;
    const qMs=bestQueueTime(trig,ts);const diffMs=qMs?qMs-now:null;
    const passed=diffMs!==null&&diffMs<0,urgent=diffMs!==null&&diffMs>=0&&diffMs<90000;
    const al=getAlliances(nxM,tbaM);const ss2=nxM?nexusSS(nxM.status):null;
    const lbl=nxM?.label||mLbl(tbaM);
    return(
      <div style={{borderRadius:12,background:passed||urgent?"#fef2f2":T.card,color:passed||urgent?"#1e293b":T.text,
        padding:16,marginBottom:14,border:passed||urgent?"2px solid #dc2626":`1px solid ${T.bord}`,boxShadow:T.glow}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:4,color:passed||urgent?"#dc2626":T.textD}}>
          {passed?"🚨 QUEUE NOW":urgent?"⚠️ QUEUE VERY SOON":"⏭ NEXT MATCH — TEAM 115"}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{fontSize:26,fontWeight:800,color:passed?"#dc2626":undefined}}>{lbl}</span>
          {ss2&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
        </div>
        {ts&&<div style={{fontSize:12,color:passed?"#64748b":T.textD,marginBottom:4}}>{fmtDate(ts)} · {fmtTime(ts)}</div>}
        {diffMs!==null&&!passed&&<div style={{fontFamily:"monospace",fontSize:28,fontWeight:700,letterSpacing:2,marginBottom:4,color:urgent?"#dc2626":undefined}}>{fmtCD(diffMs)}</div>}
        {passed&&<div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:4}}>Get to the queue line now!</div>}
        {qMs&&<div style={{fontSize:11,color:passed?"#92400e":T.textD,marginBottom:8}}>{trig?`Queue at start of ${trig.label} — ${fmtTime(qMs)}`:`Queue at ${fmtTime(qMs)} (10-min fallback)`}</div>}
        {al&&<div style={{display:"flex",gap:8}}>
          <div style={{flex:1,background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textD,marginBottom:4}}>PARTNERS</div>
            {al.partners.map(t=><div key={t} style={{fontSize:13,fontWeight:600,color:al.myColor==="red"?"#fca5a5":"#93c5fd"}}>#{t}</div>)}
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textD,marginBottom:4}}>OPPONENTS</div>
            {al.opponents.map(t=><div key={t} style={{fontSize:13,fontWeight:600,color:T.textM}}>#{t}</div>)}
          </div>
          <div style={{background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textD,marginBottom:4}}>SIDE</div>
            <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",color:al.myColor==="red"?"#f87171":"#60a5fa"}}>{al.myColor}</div>
          </div>
        </div>}
      </div>);};

  return(<div style={{padding:14}}>
    {renderHero(nextNx,nextTba)}
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button onClick={onFetch} disabled={loading} style={{flex:1,background:T.pur,color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading?.7:1}}>{loading?"Loading…":"🔄 Fetch Schedule"}</button>
      <button onClick={()=>{"Notification" in window&&Notification.requestPermission();}} style={{background:T.card2,border:`1px solid ${T.bord}`,borderRadius:8,padding:"10px 12px",fontWeight:600,fontSize:12,cursor:"pointer",color:T.textM}}>🔔</button>
    </div>
    {error&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#991b1b",marginBottom:12}}>{error}</div>}
    {(t115nx.length||t115tba.length)>0&&<div>
      <div style={{fontSize:12,fontWeight:700,color:T.textD,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Team 115 — {EVENT_KEY}</div>
      {(t115nx.length?t115nx:t115tba).map((m,idx)=>{
        const isNx=!!m.label;const ts=isNx?bestMatchTime(m,null):(getTS(m)||0)*1000;
        const passed=ts&&ts<now-120000;const al=getAlliances(isNx?m:null,isNx?null:m);
        const trig=isNx?findQueueTrigger(nexusData?.matches||[],m):null;
        const qMs=bestQueueTime(trig,ts);const diffMs=qMs?qMs-now:null;
        const soon=diffMs!==null&&diffMs>=0&&diffMs<90000;
        const ss2=isNx?nexusSS(m.status):null;const label=isNx?m.label:mLbl(m);
        return(<div key={idx} style={{borderRadius:8,border:`1px solid ${soon?"#fca5a5":T.bord}`,background:soon?"#fef2f2":passed?"rgba(255,255,255,.02)":"rgba(255,255,255,.04)",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
            <div style={{width:3,height:40,borderRadius:2,background:al?.myColor==="red"?"#dc2626":"#2563eb",flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:14,color:passed?T.textD:T.text}}>{label}</span>
                {ss2&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
                {soon&&<span style={{fontSize:10,fontWeight:700,background:"#fee2e2",color:"#dc2626",padding:"1px 6px",borderRadius:4}}>QUEUE NOW</span>}
                {passed&&<span style={{fontSize:10,color:T.textD}}>✓ passed</span>}
              </div>
              <div style={{fontSize:11,color:T.textD}}>{ts?`${fmtDate(ts)} · ${fmtTime(ts)}`:""}</div>
              {!passed&&qMs&&<div style={{fontSize:10,color:soon?"#dc2626":T.textD,marginTop:1}}>{trig?`Queue at start of ${trig.label}`:`Queue at ${fmtTime(qMs)}`}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {al&&<div style={{fontSize:11,color:T.textD}}>w/ #{al.partners.join(", #")}</div>}
              {!passed&&diffMs!==null&&<div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,marginTop:2,color:soon?"#dc2626":T.textM}}>{diffMs>=0?fmtCD(diffMs):"Queue!"}</div>}
            </div>
          </div>
        </div>);})}
    </div>}
  </div>);}

// ── ARCHIVE TAB ───────────────────────────────────────────────────────────────
function ArchiveTab({div,demoMode}){
  const [archive,setArchive]=useState([]);const [sel,setSel]=useState(null);const [loading,setLoading]=useState(true);
  const sections=DIVISION_SECTIONS[div]||[];
  const allItems=getAllItems(div);
  const critItems=getCritItems(div);
  const divCfg=DIVS[div];
  useEffect(()=>{
    const k=demoMode?"frc115_arch_demo_v6":divCfg.archKey;
    ls(k).then(d=>{
      // Filter to only this division
      const filtered=(d||[]).filter(e=>!e.division||e.division===div);
      setArchive(filtered);setLoading(false);
    });
  },[div,demoMode,divCfg.archKey]);

  if(loading)return (<div style={{padding:32,textAlign:"center",color:T.textD}}>Loading…</div>);
  if(!archive.length)return(
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:10}}>📭</div>
      <div style={{fontWeight:700,fontSize:15,color:T.text}}>No {divCfg.label} submissions yet</div>
      <div style={{fontSize:12,color:T.textD,marginTop:4}}>Submitted checklists appear here after each match</div>
    </div>);

  if(sel!==null){
    const e=archive[sel];const ds=new Set(e.checkedIds||[]);
    return(<div style={{padding:14}}>
      <button onClick={()=>setSel(null)} style={{background:"none",border:`1px solid ${T.bord}`,borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",color:T.textM,fontWeight:600,marginBottom:14}}>← Back</button>
      <div style={{background:`linear-gradient(135deg,${T.card},${T.card2})`,borderRadius:12,padding:16,color:T.text,marginBottom:14,border:`1px solid ${T.bord}`}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:1,marginBottom:2}}>SUBMISSION RECORD · {divCfg.emoji} {divCfg.label.toUpperCase()}</div>
        <div style={{fontSize:22,fontWeight:800}}>Match {e.matchNum||"?"}</div>
        <div style={{fontSize:12,color:T.textD,marginTop:4}}>{fmtDT(e.submittedAt)} · Lead: {e.lead||"Unknown"}</div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          {[{val:e.completedCount,lbl:"CHECKED",col:T.green},{val:allItems.length-e.completedCount,lbl:"SKIPPED",col:T.red},{val:e.markedAllComplete?"QUICK":"MANUAL",lbl:"METHOD",col:e.markedAllComplete?T.amber:"#60a5fa"}].map(({val,lbl,col})=>(
            <div key={lbl} style={{flex:1,background:"rgba(255,255,255,.06)",borderRadius:8,padding:"8px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:col}}>{val}</div>
              <div style={{fontSize:10,color:T.textD}}>{lbl}</div>
            </div>))}
        </div>
      </div>
      {sections.map(sec=>{const sd=sec.items.filter(i=>ds.has(i.id)).length,ad=sd===sec.items.length;
        return(<div key={sec.id} style={{borderRadius:10,overflow:"hidden",border:`1px solid ${ad?"#bbf7d0":"#fecaca"}`,marginBottom:8}}>
          <div style={{background:ad?"#f0fdf4":"#fef2f2",padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:3,height:24,borderRadius:2,background:sec.color,flexShrink:0}}/>
            <div style={{flex:1,fontWeight:700,fontSize:12,color:sec.color}}>{sec.title}</div>
            <span style={{fontSize:11,fontWeight:700,color:ad?"#16a34a":"#dc2626"}}>{sd}/{sec.items.length}</span>
            <span>{ad?"✅":"⚠️"}</span>
          </div>
          {sec.items.filter(i=>!ds.has(i.id)).map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderTop:"1px solid #fee2e2",background:"#fff5f5"}}>
              <span>❌</span><div style={{flex:1,fontSize:12,color:"#374151",fontWeight:600}}>{item.text}</div><Badge p={item.priority}/>
            </div>))}
        </div>);})}
    </div>);}

  return(<div style={{padding:14}}>
    <div style={{fontSize:12,fontWeight:700,color:T.textD,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>
      {divCfg.emoji} {divCfg.label} · {archive.length} Submission{archive.length!==1?"s":""}
    </div>
    {[...archive].reverse().map((e,ri)=>{
      const idx=archive.length-1-ri;
      const pct=Math.round(e.completedCount/allItems.length*100);
      const allCrit=critItems.every(i=>(e.checkedIds||[]).includes(i.id));
      const ds2=new Set(e.checkedIds||[]);
      return(<div key={idx} onClick={()=>setSel(idx)} style={{borderRadius:10,border:`1px solid ${allCrit?"#bbf7d0":"#fecaca"}`,background:"white",marginBottom:10,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,background:allCrit?"#f0fdf4":"#fef2f2"}}>
          <div style={{width:38,height:38,borderRadius:9,background:allCrit?"#dcfce7":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>{allCrit?"✅":"⚠️"}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Match {e.matchNum||"?"}</span>
              {e.markedAllComplete&&<span style={{fontSize:10,fontWeight:700,background:"#ffedd5",color:"#9a3412",padding:"1px 7px",borderRadius:99}}>⚡ QUICK</span>}
            </div>
            <div style={{fontSize:11,color:"#64748b"}}>{fmtDT(e.submittedAt)} · {e.lead||"Unknown"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:15,fontWeight:800,color:pct===100?"#16a34a":pct>80?"#ca8a04":"#dc2626"}}>{pct}%</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{e.completedCount}/{allItems.length}</div>
          </div>
          <span style={{color:"#94a3b8",fontSize:14}}>›</span>
        </div>
        <div style={{background:"#e2e8f0",height:3}}><div style={{width:`${pct}%`,height:"100%",background:pct===100?"#16a34a":pct>80?"#ca8a04":"#dc2626"}}/></div>
        <div style={{padding:"7px 12px",display:"flex",flexWrap:"wrap",gap:3}}>
          {sections.map(sec=>{const sd=sec.items.filter(i=>ds2.has(i.id)).length,ok=sd===sec.items.length;
            return(<div key={sec.id} style={{display:"flex",alignItems:"center",gap:3,background:ok?"#f0fdf4":"#fef2f2",borderRadius:5,padding:"2px 5px",border:`1px solid ${ok?"#bbf7d0":"#fecaca"}`}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:sec.color}}/><span style={{fontSize:9,fontWeight:600,color:ok?"#166534":"#991b1b",whiteSpace:"nowrap"}}>{sec.title.replace(/^[^ ]+ /,"")} {sd}/{sec.items.length}</span>
            </div>);})}
        </div>
      </div>);})}
  </div>);}

// ── LIVESTREAM TAB ─────────────────────────────────────────────────────────────
function LivestreamTab(){
  const hasStream=!!YOUTUBE_STREAM_URL;
  const [open,setOpen]=useState(false);
  if(!hasStream)return(
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:12}}>📺</div>
      <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:8}}>Livestream Coming Soon</div>
      <div style={{fontSize:13,color:T.textD,lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>
        The official FRC livestream link hasn't been posted yet. It will appear here automatically once the event goes live.
      </div>
      <div style={{marginTop:20,fontSize:11,color:T.textD}}>
        Streams are typically available on <strong style={{color:T.purL}}>youtube.com/firstinspires</strong> or the local host channel
      </div>
    </div>);
  const videoId=YOUTUBE_STREAM_URL.includes("v=")
    ?new URLSearchParams(new URL(YOUTUBE_STREAM_URL).search).get("v")
    :YOUTUBE_STREAM_URL.split("/").pop();
  return(
    <div style={{padding:14}}>
      <div style={{background:T.card,borderRadius:12,overflow:"hidden",border:`1px solid ${T.bord}`,marginBottom:12}}>
        {open?(
          <div style={{position:"relative",paddingBottom:"56.25%",height:0}}>
            <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}
              allow="autoplay;encrypted-media" allowFullScreen/>
          </div>
        ):(
          <div style={{padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:8}}>▶️</div>
            <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:8}}>OC District Livestream</div>
            <button onClick={()=>setOpen(true)} style={{background:T.pur,color:"white",border:"none",borderRadius:10,padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:8}}>Watch Live</button>
          </div>
        )}
      </div>
      <a href={YOUTUBE_STREAM_URL} target="_blank" rel="noopener noreferrer"
        style={{display:"block",background:T.card2,border:`1px solid ${T.bord}`,borderRadius:10,padding:"12px 16px",textAlign:"center",color:T.purL,fontWeight:600,fontSize:13,textDecoration:"none"}}>
        🔗 Open in YouTube
      </a>
    </div>);}

// ── INFO TAB ──────────────────────────────────────────────────────────────────
function InfoTab({div}){
  const [open,setOpen]=useState(null);
  const divCfg=DIVS[div]||DIVS.elec;
  const FEATURES=[
    {icon:"📋",title:"Checklist",color:"#1d4ed8",bg:"#eff6ff",summary:`${divCfg.emoji} ${divCfg.label} pre-queue checklist.`,steps:[
      {h:"Auto-detected match",b:"The match number is pulled from the schedule automatically — just enter your initials."},
      {h:"Tap to check items",b:"CRITICAL (red) items must all be checked before you can submit. HIGH (orange), MEDIUM (yellow), and SECONDARY (green) won't block submission but indicate real risk."},
      {h:"Submit",b:"Once all critical items are done, tap Submit to archive and notify the director. The checklist auto-resets after 3 seconds."},
    ]},
    {icon:"🏆",title:"Schedule",color:"#15803d",bg:"#f0fdf4",summary:"Live match schedule with queue countdowns.",steps:[
      {h:"Fetch Schedule",b:"Tap Fetch to load Team 115's matches from TBA. The schedule is available ~1 week before the event."},
      {h:"Queue time",b:"Queue countdown = start time of the match 2 slots before yours in the full event order. Falls back to 10 min before match if no schedule is posted."},
    ]},
    {icon:"🗂",title:"Archive",color:"#92400e",bg:"#fffbeb",summary:"Full history of every submitted checklist.",steps:[
      {h:"Section breakdown",b:"Every card shows a color-coded strip per section and tapping it shows exactly which items were skipped."},
    ]},
    {icon:"📺",title:"Livestream",color:"#dc2626",bg:"#fef2f2",summary:"Watch the event stream in-app.",steps:[
      {h:"When available",b:"The embed appears automatically once the YouTube URL is configured. You can also open it directly in YouTube."},
    ]},
    {icon:"🧪",title:"Demo Mode",color:"#7e22ce",bg:"#faf5ff",summary:"Test all features before competition day.",steps:[
      {h:"How to enter",b:"Tap 🧪 in the header. Uses 2025 Pinnacles TBA data + simulated Nexus timing. Q1 queue is in 10 minutes when you enter."},
      {h:"Isolated",b:"Demo submissions go to a separate archive. Emails are suppressed. Session-only — page refresh exits demo."},
    ]},
  ];
  return(<div style={{padding:14,paddingBottom:32}}>
    <div style={{background:T.grad,borderRadius:14,padding:20,marginBottom:14,color:T.text}}>
      <div style={{fontSize:28,marginBottom:6}}>{divCfg.emoji}</div>
      <div style={{fontWeight:800,fontSize:18,marginBottom:4}}>MVRT Team 115 — {divCfg.label} Lead Guide</div>
      <div style={{fontSize:12,color:T.textD,lineHeight:1.5}}>Pre-queue checklist for {EVENT_NAME} ({EVENT_DATES}). Connects to TBA, Nexus, and Statbotics.</div>
    </div>
    <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:13,color:"#854d0e",marginBottom:10}}>⚡ Quick Start</div>
      {[["1","Open the app and select your division."],["2","Enter your initials — match is auto-detected."],["3","Work through all sections top to bottom."],["4","All CRITICAL items must be green to submit."],["5","Tap Submit — director gets notified, checklist resets."]].map(([n,t])=>(
        <div key={n} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
          <div style={{width:22,height:22,borderRadius:"50%",background:T.pur,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0}}>{n}</div>
          <div style={{fontSize:13,color:"#374151",lineHeight:1.4}}>{t}</div>
        </div>))}
    </div>
    {FEATURES.map((f,i)=>(<div key={i} style={{borderRadius:12,overflow:"hidden",border:`1px solid ${open===i?f.color+"44":"#e2e8f0"}`,marginBottom:10}}>
      <button onClick={()=>setOpen(o=>o===i?null:i)} style={{width:"100%",background:open===i?f.bg:"white",border:"none",cursor:"pointer",padding:"13px 14px",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        <div style={{width:36,height:36,borderRadius:10,background:f.bg,border:`1px solid ${f.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{f.icon}</div>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:f.color}}>{f.title}</div><div style={{fontSize:11,color:"#64748b",marginTop:1}}>{f.summary}</div></div>
        <span style={{color:"#94a3b8",fontSize:13}}>{open===i?"▾":"▸"}</span>
      </button>
      {open===i&&<div style={{borderTop:`1px solid ${f.color}22`,background:f.bg}}>
        {f.steps.map((s,si)=>(<div key={si} style={{padding:"11px 14px",borderBottom:si<f.steps.length-1?`1px solid ${f.color}18`:"none"}}>
          <div style={{fontWeight:700,fontSize:12,color:f.color,marginBottom:3}}>{s.h}</div>
          <div style={{fontSize:12,color:"#374151",lineHeight:1.5}}>{s.b}</div>
        </div>))}
      </div>}
    </div>))}
  </div>);}


// ── DIRECTOR: MONITOR ─────────────────────────────────────────────────────────
function DivisionMonitorPanel({div,archive}){
  const now=useNow(3000);
  const [liveData,setLiveData]=useState({});
  const [expandedMatch,setExpanded]=useState(null);
  const [tick,setTick]=useState(0);
  const divCfg=DIVS[div];
  const sections=DIVISION_SECTIONS[div]||[];
  const allItems=getAllItems(div);
  const critItems=getCritItems(div);

  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),3000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    const poll=async()=>{
      const data={};
      const keys=["Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10","Q11","Q12","Q13","Q14","Q15","Q16","SF1","F1"];
      for(const mk of keys){
        const d=await ls(`${divCfg.storKey}:${mk}`);
        if(d&&d.updatedAt&&(Date.now()-d.updatedAt)<2*60*60*1000)data[mk]=d;}
      const base=await ls(divCfg.storKey);if(base&&base.updatedAt)data["current"]=base;
      setLiveData(data);};
    poll();
  },[tick,divCfg.storKey]);

  const activeKeys=Object.keys(liveData).filter(k=>liveData[k]?.checked&&Object.keys(liveData[k].checked).length>0);
  const divArch=(archive||[]).filter(e=>e.division===div||!e.division&&div==="elec");
  const totalSubs=divArch.length;
  const avgPct=totalSubs?Math.round(divArch.reduce((a,e)=>a+Math.round(e.completedCount/allItems.length*100),0)/totalSubs):0;
  const critMisses=divArch.filter(e=>!critItems.every(i=>(e.checkedIds||[]).includes(i.id)));

  return(
    <div style={{background:T.card,border:`1px solid ${T.bord}`,borderRadius:14,overflow:"hidden",marginBottom:14}}>
      {/* Division header */}
      <div style={{background:`linear-gradient(135deg,${T.card2},${T.card3})`,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${T.bord}`}}>
        <div style={{width:36,height:36,borderRadius:10,background:`${divCfg.color}20`,border:`1px solid ${divCfg.color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{divCfg.emoji}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:800,color:T.text}}>{divCfg.label}</div>
          <div style={{fontSize:11,color:T.textD}}>{totalSubs} submissions · avg {avgPct}%{critMisses.length>0?` · ${critMisses.length} crit miss`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{val:totalSubs,col:T.purL,lbl:"subs"},{val:`${avgPct}%`,col:T.green,lbl:"avg"},{val:critMisses.length,col:critMisses.length>0?T.red:T.green,lbl:"miss"}].map(({val,col,lbl})=>(
            <div key={lbl} style={{textAlign:"center",background:"rgba(0,0,0,.2)",borderRadius:8,padding:"4px 8px"}}>
              <div style={{fontSize:14,fontWeight:800,color:col}}>{val}</div>
              <div style={{fontSize:9,color:T.textD}}>{lbl}</div>
            </div>))}
        </div>
      </div>

      {/* Live states */}
      {activeKeys.length===0?(
        <div style={{padding:"14px",textAlign:"center",color:T.textD,fontSize:13}}>
          No active {divCfg.label.toLowerCase()} checklist — waiting for leads
        </div>
      ):activeKeys.map(mk=>{
        const d=liveData[mk];const checked=d.checked||{};
        const done=Object.values(checked).filter(Boolean).length;
        const pct=Math.round(done/allItems.length*100);
        const critDone=critItems.filter(i=>checked[i.id]).length;
        const allCrit=critDone===critItems.length;
        const ago=Math.round((Date.now()-d.updatedAt)/1000);
        const isExpanded=expandedMatch===`${div}-${mk}`;
        const uncheckedCrit=critItems.filter(i=>!checked[i.id]);
        return(
          <div key={mk} style={{borderBottom:`1px solid ${T.bord}`}}>
            {/* Match summary row */}
            <div style={{padding:"10px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontWeight:800,fontSize:15,color:T.text}}>Match {mk}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,background:allCrit?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",color:allCrit?T.green:T.red}}>
                  {allCrit?"✓ Critical clear":`${critItems.length-critDone} crit left`}
                </span>
                <span style={{fontSize:10,color:T.textD,marginLeft:"auto"}}>
                  {d.updatedBy||"?"} · {ago<60?`${ago}s ago`:`${Math.round(ago/60)}m ago`}
                </span>
              </div>
              {/* Overall progress bar */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{flex:1,background:"rgba(255,255,255,.06)",borderRadius:99,height:7,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:pct===100?T.green:pct>60?T.pur:T.red,borderRadius:99,transition:"width .5s"}}/>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:pct===100?T.green:pct>60?T.purL:T.red,flexShrink:0}}>{pct}%</span>
              </div>
              {/* Section mini-bars */}
              <div style={{display:"flex",gap:3,marginBottom:6}}>
                {sections.map(sec=>{
                  const sd=sec.items.filter(i=>checked[i.id]).length,ok=sd===sec.items.length;
                  return <div key={sec.id} title={`${sec.title}: ${sd}/${sec.items.length}`} style={{height:5,flex:1,borderRadius:2,background:ok?T.green:sd>0?sec.color:"rgba(255,255,255,.1)"}}/>;
                })}
              </div>
              {/* Expand/collapse + uncrit items */}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>setExpanded(e=>e===`${div}-${mk}`?null:`${div}-${mk}`)}
                  style={{background:"rgba(147,51,234,.15)",border:`1px solid ${T.bord}`,borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",color:T.purL,fontWeight:600}}>
                  {isExpanded?"▲ Hide items":"▼ Show items"}
                </button>
                {uncheckedCrit.length>0&&<span style={{fontSize:11,color:T.red,fontWeight:600}}>❌ {uncheckedCrit.length} critical unchecked</span>}
              </div>
            </div>

            {/* Expanded item view */}
            {isExpanded&&(
              <div style={{borderTop:`1px solid ${T.bord}`,padding:"8px 14px",background:"rgba(0,0,0,.2)"}}>
                {sections.map(sec=>{
                  const sd=sec.items.filter(i=>checked[i.id]).length;
                  return(
                    <div key={sec.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{width:3,height:16,borderRadius:2,background:sec.color,flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:700,color:sec.color}}>{sec.title}</span>
                        <span style={{fontSize:10,color:T.textD,marginLeft:"auto"}}>{sd}/{sec.items.length}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                        {sec.items.map(item=>{
                          const isDone=!!checked[item.id];
                          return(
                            <div key={item.id} title={item.text} style={{display:"flex",alignItems:"center",gap:3,background:isDone?"rgba(74,222,128,.1)":"rgba(248,113,113,.1)",borderRadius:5,padding:"2px 6px",border:`1px solid ${isDone?"rgba(74,222,128,.3)":"rgba(248,113,113,.3)"}`}}>
                              <span style={{fontSize:9}}>{isDone?"✓":"✗"}</span>
                              <span style={{fontSize:9,color:isDone?T.green:T.red,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.text.length>30?item.text.slice(0,28)+"…":item.text}</span>
                              {item.priority==="CRITICAL"&&!isDone&&<span style={{fontSize:8,color:T.red,fontWeight:700}}>❗</span>}
                            </div>);})}
                      </div>
                    </div>);})}
              </div>)}
          </div>);})}
    </div>);}

function DirectorMonitor({archive}){
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textD,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Live Division Monitor</div>
      <DivisionMonitorPanel div="elec" archive={archive.elec||[]}/>
      <DivisionMonitorPanel div="mech" archive={archive.mech||[]}/>
      <DivisionMonitorPanel div="sw"   archive={archive.sw||[]}/>
    </div>);}

// ── DIRECTOR: ANNOUNCEMENTS ───────────────────────────────────────────────────
function DirectorAnnouncements(){
  const [ann,setAnn]=useState([]);const [text,setText]=useState("");const [urgency,setUrgency]=useState("info");
  useEffect(()=>{const poll=()=>ls(SK.announce).then(d=>setAnn(d||[]));poll();const t=setInterval(poll,5000);return()=>clearInterval(t);},[]);
  const push=async()=>{if(!text.trim())return;const a=[...ann,{id:Date.now(),text:text.trim(),urgency,time:Date.now()}];setAnn(a);await ss(SK.announce,a);setText("");};
  const remove=async(id)=>{const a=ann.filter(x=>x.id!==id);setAnn(a);await ss(SK.announce,a);};
  const clearAll=async()=>{setAnn([]);await ss(SK.announce,[]);};
  const TT={queue:{col:"#dc2626",bg:"rgba(220,38,38,.15)",label:"🚨 QUEUE NOW"},urgent:{col:"#f59e0b",bg:"rgba(245,158,11,.15)",label:"⚠️ URGENT"},info:{col:T.pur,bg:"rgba(147,51,234,.15)",label:"ℹ️ INFO"}};
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{background:T.card,border:`1px solid ${T.bord}`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.textD,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Push Announcement to Leads</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {Object.entries(TT).map(([k,v])=>(
            <button key={k} onClick={()=>setUrgency(k)} style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${urgency===k?v.col:T.bord}`,background:urgency===k?v.bg:"transparent",color:urgency===k?v.col:T.textD,fontSize:10,fontWeight:700,cursor:"pointer"}}>{v.label}</button>))}
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Type announcement…" rows={3}
          style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${T.bord}`,borderRadius:8,padding:"9px 10px",fontSize:13,color:T.text,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:8}}/>
        <button onClick={push} disabled={!text.trim()} style={{width:"100%",background:text.trim()?T.pur:"rgba(126,34,206,.2)",color:text.trim()?"white":T.textD,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:text.trim()?"pointer":"default"}}>
          📢 Push to All Leads
        </button>
      </div>
      {ann.length>0?(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textD,textTransform:"uppercase",letterSpacing:.5}}>Active Announcements ({ann.length})</div>
            <button onClick={clearAll} style={{fontSize:11,color:T.red,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Clear All</button>
          </div>
          {ann.map(a=>{const t=TT[a.urgency]||TT.info;return(
            <div key={a.id} style={{background:t.bg,border:`1px solid ${t.col}44`,borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.text}</div>
                <div style={{fontSize:10,color:T.textD,marginTop:3}}>{new Date(a.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <button onClick={()=>remove(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:16,flexShrink:0}}>✕</button>
            </div>);})}
        </div>
      ):<div style={{textAlign:"center",padding:24,color:T.textD,fontSize:13}}>No active announcements</div>}
    </div>);}

// ── DIRECTOR: ISSUES ──────────────────────────────────────────────────────────
function DirectorIssues(){
  const [issues,setIssues]=useState([]);const [match,setMatch]=useState("");const [sev,setSev]=useState("medium");
  const [comp,setComp]=useState("");const [desc,setDesc]=useState("");const [isDiv,setIsDiv]=useState("elec");
  useEffect(()=>{const poll=()=>ls(SK.issues).then(d=>setIssues(d||[]));poll();const t=setInterval(poll,10000);return()=>clearInterval(t);},[]);
  const save=async()=>{if(!desc.trim())return;const list=[...issues,{match,sev,comp,desc:desc.trim(),div:isDiv,id:Date.now(),time:Date.now()}];setIssues(list);await ss(SK.issues,list);setMatch("");setComp("");setDesc("");};
  const remove=async(id)=>{const l=issues.filter(x=>x.id!==id);setIssues(l);await ss(SK.issues,l);};
  const SEV={high:{col:T.red,bg:"rgba(248,113,113,.12)",label:"🔴 HIGH"},medium:{col:T.amber,bg:"rgba(251,146,60,.12)",label:"🟠 MEDIUM"},low:{col:T.purL,bg:"rgba(196,181,253,.12)",label:"🟢 LOW"}};
  const COMPS=["Battery/Power","CAN Bus","Swerve Module","RoboRIO/Radio","Limelight","Wire/Connector","Motor/Controller","Drivetrain Mech","Game Mechanism","Fasteners","Software/Code","Vision","Auto","Other"];
  const iS={width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${T.bord}`,borderRadius:7,padding:"7px 9px",fontSize:13,color:T.text,outline:"none",boxSizing:"border-box"};
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{background:T.card,border:`1px solid ${T.bord}`,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:T.textD,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Log Post-Match Issue</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:10,color:T.textD,marginBottom:3}}>MATCH</div><input value={match} onChange={e=>setMatch(e.target.value)} placeholder="Q12" style={iS}/></div>
          <div style={{flex:1}}><div style={{fontSize:10,color:T.textD,marginBottom:3}}>DIVISION</div>
            <select value={isDiv} onChange={e=>setIsDiv(e.target.value)} style={{...iS,background:T.card2}}>
              {Object.values(DIVS).map(d=><option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:T.textD,marginBottom:3}}>COMPONENT</div>
          <select value={comp} onChange={e=>setComp(e.target.value)} style={{...iS,background:T.card2}}>
            <option value="">Select…</option>{COMPS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {Object.entries(SEV).map(([k,v])=>(
            <button key={k} onClick={()=>setSev(k)} style={{flex:1,padding:"6px 4px",borderRadius:7,border:`1px solid ${sev===k?v.col:T.bord}`,background:sev===k?v.bg:"transparent",color:sev===k?v.col:T.textD,fontSize:10,fontWeight:700,cursor:"pointer"}}>{v.label}</button>))}
        </div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe what broke…" rows={3}
          style={{...iS,resize:"none",marginBottom:8,fontFamily:"inherit"}}/>
        <button onClick={save} disabled={!desc.trim()} style={{width:"100%",background:desc.trim()?T.pur:"rgba(126,34,206,.2)",color:desc.trim()?"white":T.textD,border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:desc.trim()?"pointer":"default"}}>Log Issue</button>
      </div>
      {issues.length===0&&<div style={{textAlign:"center",padding:24,color:T.textD,fontSize:13}}>No issues logged</div>}
      {[...issues].reverse().map(iss=>{const s=SEV[iss.sev||"medium"]||SEV.medium;const dv=DIVS[iss.div]||DIVS.elec;return(
        <div key={iss.id} style={{background:s.bg,border:`1px solid ${s.col}44`,borderRadius:10,padding:"11px 14px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                {iss.match&&<span style={{fontSize:12,fontWeight:700,color:T.text}}>Match {iss.match}</span>}
                <span style={{fontSize:11,background:"rgba(255,255,255,.08)",color:T.textM,padding:"1px 7px",borderRadius:99}}>{dv.emoji} {dv.label}</span>
                {iss.comp&&<span style={{fontSize:11,background:"rgba(255,255,255,.08)",color:T.textM,padding:"1px 7px",borderRadius:99}}>{iss.comp}</span>}
                <span style={{fontSize:10,fontWeight:700,color:s.col}}>{s.label}</span>
              </div>
              <div style={{fontSize:13,color:T.text,lineHeight:1.5}}>{iss.desc}</div>
              <div style={{fontSize:10,color:T.textD,marginTop:4}}>{new Date(iss.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <button onClick={()=>remove(iss.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:16,flexShrink:0}}>✕</button>
          </div>
        </div>);})}
    </div>);}

// ── DIRECTOR: SETTINGS ────────────────────────────────────────────────────────
function DirectorSettings({onLock,onPinChange}){
  const [archiveSizes,setArchiveSizes]=useState({elec:0,mech:0,sw:0,demo:0});
  const [clearMsg,setClearMsg]=useState("");
  const [newPin,setNewPin]=useState("");const [confirmPin,setConfirmPin]=useState("");const [pinMsg,setPinMsg]=useState("");
  const [nexusInput,setNexusInput]=useState(HARDCODED_NEXUS_KEY);const [ytInput,setYtInput]=useState(YOUTUBE_STREAM_URL);
  useEffect(()=>{
    Promise.all([ls(SK.archElec),ls(SK.archMech),ls(SK.archSW),ls(SK.archDemo||"frc115_arch_demo_v6")]).then(([e,m,s,d])=>{
      setArchiveSizes({elec:(e||[]).length,mech:(m||[]).length,sw:(s||[]).length,demo:(d||[]).length});});
  },[]);
  const savePin=async()=>{if(newPin.length!==4){setPinMsg("⚠️ PIN must be 4 digits");return;}if(newPin!==confirmPin){setPinMsg("⚠️ PINs don't match");return;}
    await ss(SK.dirPin,newPin);onPinChange(newPin);setNewPin("");setConfirmPin("");setPinMsg("✅ PIN updated — active now");setTimeout(()=>setPinMsg(""),3000);};
  const clearArch=async(k,div)=>{await ss(k,[]);setArchiveSizes(s=>({...s,[div]:0}));setClearMsg(`✅ ${div} archive cleared`);setTimeout(()=>setClearMsg(""),2000);};
  const clearAnn=async()=>{await ss(SK.announce,[]);setClearMsg("✅ Announcements cleared");setTimeout(()=>setClearMsg(""),2000);};
  const bS={background:T.card,border:`1px solid ${T.bord}`,borderRadius:12,padding:14,marginBottom:10};
  const lS={fontSize:11,fontWeight:700,color:T.textD,marginBottom:8,textTransform:"uppercase",letterSpacing:.5};
  const iS={width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${T.bord}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:T.text,outline:"none",boxSizing:"border-box",marginBottom:8};
  const btn=(col=T.pur)=>({width:"100%",background:col,color:"white",border:"none",borderRadius:8,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:6});
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={bS}>
        <div style={lS}>Change Director PIN</div>
        <input value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="New 4-digit PIN" type="password" maxLength={4} style={iS}/>
        <input value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} placeholder="Confirm new PIN" type="password" maxLength={4} style={iS}/>
        <button onClick={savePin} style={btn()}>Save New PIN</button>
        {pinMsg&&<div style={{fontSize:12,color:pinMsg.startsWith("✅")?T.green:T.red,marginTop:2}}>{pinMsg}</div>}
      </div>
      <div style={bS}>
        <div style={lS}>Archive Management</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
          {[["elec","⚡",SK.archElec],["mech","🔧",SK.archMech],["sw","💻",SK.archSW],["demo","🧪","frc115_arch_demo_v6"]].map(([div,emoji,k])=>(
            <div key={div} style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 4px",textAlign:"center",border:`1px solid ${T.bord}`}}>
              <div style={{fontSize:16}}>{emoji}</div>
              <div style={{fontSize:16,fontWeight:800,color:T.purL}}>{archiveSizes[div]||0}</div>
              <div style={{fontSize:9,color:T.textD}}>{div}</div>
            </div>))}
        </div>
        {[["⚡ Elec","#dc2626",SK.archElec,"elec"],["🔧 Mech","#374151",SK.archMech,"mech"],["💻 SW","#374151",SK.archSW,"sw"],["🧪 Demo","#374151","frc115_arch_demo_v6","demo"]].map(([lbl,col,k,div])=>(
          <button key={div} onClick={()=>clearArch(k,div)} style={btn(col)}>🗑 Clear {lbl} Archive</button>))}
        <button onClick={clearAnn} style={btn("#374151")}>🗑 Clear All Announcements</button>
        {clearMsg&&<div style={{fontSize:12,color:T.green,marginTop:4}}>{clearMsg}</div>}
      </div>
      <div style={bS}>
        <div style={lS}>System Info</div>
        <div style={{fontSize:12,color:T.textD,lineHeight:1.9}}>
          <div>Event: <strong style={{color:T.text}}>{EVENT_KEY} · {EVENT_NAME}</strong></div>
          <div>Notify: <strong style={{color:T.text}}>{NOTIFY_EMAIL}</strong></div>
          <div>Nexus: <strong style={{color:T.text}}>…{HARDCODED_NEXUS_KEY.slice(-8)}</strong></div>
          <div>Sync: <strong style={{color:T.text}}>Upstash Redis (US-West)</strong></div>
        </div>
      </div>
      <button onClick={onLock} style={{width:"100%",background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.3)`,borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",color:T.red}}>
        🔒 Lock Director Mode
      </button>
    </div>);}


// ── LEAD APP ──────────────────────────────────────────────────────────────────
function LeadApp({div,onBack,demoMode,onToggleDemo}){
  const [tab,setTab]=useState("checklist");
  const [nexusData,setNexusData]=useState(null);
  const [tbaMatches,setTBA]=useState([]);
  const [tbaAllMatches,setTBAAll]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [nexusKey,setNexusKey]=useState(HARDCODED_NEXUS_KEY);
  const [showNKModal,setShowNK]=useState(false);const [nexusKeyInput,setNKI]=useState(HARDCODED_NEXUS_KEY);
  const divCfg=DIVS[div];

  useEffect(()=>{ls(SK.nexus).then(k=>{if(k)setNexusKey(k);});},[]);
  useEffect(()=>{if(!demoMode)return;setNexusData(buildMockNexus());const t=setInterval(()=>setNexusData(buildMockNexus()),5000);return()=>clearInterval(t);},[demoMode]);

  const fetchAll=useCallback(async()=>{
    setLoading(true);setError("");const errs=[];
    const tk=demoMode?DEMO_TBA_TEAM:TEAM_KEY,ek=demoMode?DEMO_TBA_EVENT:EVENT_KEY;
    try{const r=await fetch(`https://www.thebluealliance.com/api/v3/team/${tk}/event/${ek}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}});if(r.ok)setTBA(await r.json());else errs.push(`TBA ${r.status}`);}catch{errs.push("TBA failed");}
    try{const r=await fetch(`https://www.thebluealliance.com/api/v3/event/${ek}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}});if(r.ok)setTBAAll(await r.json());}catch{}
    if(!demoMode&&nexusKey){try{const r=await fetch(`https://frc.nexus/api/v1/event/${NEXUS_EVENT}`,{headers:{"Nexus-Api-Key":nexusKey}});if(r.ok)setNexusData(await r.json());else errs.push(`Nexus ${r.status}`);}catch{errs.push("Nexus failed");}}
    if(errs.length)setError(errs.join(" · "));setLoading(false);
  },[nexusKey,demoMode]);

  useEffect(()=>{if(tbaMatches.length===0)return;const t=setInterval(()=>{const tk=demoMode?DEMO_TBA_TEAM:TEAM_KEY,ek=demoMode?DEMO_TBA_EVENT:EVENT_KEY;fetch(`https://www.thebluealliance.com/api/v3/team/${tk}/event/${ek}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}}).then(r=>r.ok?r.json():null).then(d=>{if(d)setTBA(d);});}
  ,5*60*1000);return()=>clearInterval(t);},[tbaMatches.length,demoMode]);

  const autoMatch=useMemo(()=>{
    const nx115=(nexusData?.matches||[]).filter(m=>[...(m.redTeams||[]),...(m.blueTeams||[])].includes(TEAM_NUM));
    const tba115=tbaMatches.filter(m=>[...(m.alliances?.red?.team_keys||[]),...(m.alliances?.blue?.team_keys||[])].includes(TEAM_KEY));
    if(nx115.length){const active=nx115.find(m=>m.status!=="Complete");if(active)return parseNexusLabel(active.label);const last=nx115[nx115.length-1];return parseNexusLabel(last.label);}
    if(tba115.length){const sorted=[...tba115].sort((a,b)=>(getTS(a)||0)-(getTS(b)||0));const next=sorted.find(m=>{const ts=getTS(m);return ts&&ts*1000>Date.now()-15*60*1000;});
      if(next)return{level:next.comp_level==="qm"?"qm":next.comp_level,num:next.match_number};
      const last=sorted[sorted.length-1];return{level:last.comp_level==="qm"?"qm":last.comp_level,num:last.match_number};}
    return null;
  },[nexusData,tbaMatches]);

  const TABS=[
    {id:"checklist",label:`${divCfg.emoji} Check`},
    {id:"schedule",label:"🏆 Schedule"},
    {id:"archive",label:"🗂 Archive"},
    {id:"stream",label:"📺 Stream"},
    {id:"info",label:"ℹ️ Info"},
  ];

  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto"}}>
      {/* Header */}
      <div style={{background:T.grad,color:"white",padding:"12px 14px",boxShadow:"0 4px 12px rgba(0,0,0,.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.1)",border:`1px solid ${T.bord}`,borderRadius:8,padding:"5px 8px",color:T.textM,fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>⬅ Home</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:.3}}>
              <span style={{color:divCfg.color}}>{divCfg.emoji}</span> {divCfg.label} Lead
            </div>
            <SyncStatus/>
          </div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={onToggleDemo} style={{background:demoMode?"rgba(167,139,250,.25)":"rgba(255,255,255,.08)",border:`1px solid ${demoMode?"#a78bfa":T.bord}`,borderRadius:7,padding:"5px 7px",color:demoMode?"#c4b5fd":T.textD,fontSize:10,fontWeight:700,cursor:"pointer"}}>🧪</button>
            <button onClick={()=>{setNKI(nexusKey);setShowNK(true);}} style={{background:nexusKey?"rgba(74,222,128,.15)":"rgba(255,255,255,.08)",border:`1px solid ${nexusKey?"#4ade80":T.bord}`,borderRadius:7,padding:"5px 8px",color:nexusKey?"#4ade80":T.textD,fontSize:10,fontWeight:700,cursor:"pointer"}}>{nexusKey?"●":"+"}</button>
          </div>
        </div>
      </div>

      {showNKModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"white",borderRadius:16,padding:24,maxWidth:340,width:"100%"}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:12}}>🔌 Nexus API Key</div>
          <input value={nexusKeyInput} onChange={e=>setNKI(e.target.value)} placeholder="Paste Nexus API key" style={{width:"100%",border:"1px solid #cbd5e1",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:14}}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowNK(false)} style={{flex:1,background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancel</button>
            <button onClick={async()=>{await ss(SK.nexus,nexusKeyInput);setNexusKey(nexusKeyInput);setShowNK(false);}} style={{flex:2,background:T.purD,color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Save</button>
          </div>
        </div>
      </div>}

      {demoMode&&<div style={{background:"linear-gradient(90deg,#1e0a3c,#2d1b69)",padding:"7px 14px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:12}}>🧪</span>
        <span style={{fontWeight:700,fontSize:11,color:"white"}}>DEMO MODE</span>
        <span style={{fontSize:10,color:"rgba(255,255,255,.6)",marginLeft:4}}>2025 Pinnacles data · emails suppressed</span>
        <button onClick={onToggleDemo} style={{marginLeft:"auto",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:"white",cursor:"pointer"}}>Exit</button>
      </div>}

      <AnnouncementBanner/>

      <div style={{display:"flex",background:"white",borderBottom:"2px solid #e2e8f0",position:"sticky",top:0,zIndex:50,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,border:"none",background:"none",padding:"9px 4px",fontSize:10,fontWeight:700,cursor:"pointer",color:tab===t.id?T.pur:"#64748b",borderBottom:tab===t.id?`2px solid ${T.pur}`:"2px solid transparent",marginBottom:-2,whiteSpace:"nowrap",minWidth:60}}>
            {t.label}
          </button>))}
      </div>

      {tab==="checklist"&&<ChecklistTab div={div} nexusData={nexusData} tbaMatches={tbaMatches} autoMatch={autoMatch} demoMode={demoMode}/>}
      {tab==="schedule" &&<ScheduleTab nexusData={nexusData} tbaMatches={tbaMatches} onFetch={fetchAll} loading={loading} error={error}/>}
      {tab==="archive"  &&<ArchiveTab div={div} demoMode={demoMode}/>}
      {tab==="stream"   &&<LivestreamTab/>}
      {tab==="info"     &&<InfoTab div={div}/>}
    </div>);}

// ── DIRECTOR APP ──────────────────────────────────────────────────────────────
function DirectorApp({onBack,onPinChange,activePin,demoMode,onToggleDemo}){
  const [mode,setMode]=useState("dashboard"); // "dashboard"|"lead-elec"|"lead-mech"|"lead-sw"
  const [tab,setTab]=useState("monitor");
  const [archive,setArchive]=useState({elec:[],mech:[],sw:[]});

  useEffect(()=>{
    const loadArch=async()=>{
      const [e,m,s]= await Promise.all([ls(SK.archElec),ls(SK.archMech),ls(SK.archSW)]);
      setArchive({elec:e||[],mech:m||[],sw:s||[]});};
    loadArch();const t=setInterval(loadArch,5000);return()=>clearInterval(t);
  },[]);

  // Lead view inside director
  if(mode.startsWith("lead-")){
    const div=mode.replace("lead-","");
    return <LeadApp div={div} onBack={()=>setMode("dashboard")} demoMode={demoMode} onToggleDemo={onToggleDemo}/>;
  }

  const DTABS=[{id:"monitor",label:"👁 Monitor"},{id:"announce",label:"📢 Announce"},{id:"issues",label:"🔧 Issues"},{id:"settings",label:"⚙️ Settings"}];

  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",background:T.bg,minHeight:"100vh",maxWidth:600,margin:"0 auto"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,#1e0a3c,#2d1b69)`,padding:"14px 14px 12px",boxShadow:"0 4px 20px rgba(80,0,180,.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.1)",border:`1px solid ${T.bord}`,borderRadius:8,padding:"5px 8px",color:T.textD,fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>⬅ Home</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:T.text}}>🎛️ Director Dashboard</div>
            <div style={{fontSize:10,color:T.textD}}>MVRT Team 115 · {EVENT_NAME}</div>
          </div>
          <button onClick={onBack} style={{background:"rgba(248,113,113,.15)",border:"1px solid rgba(248,113,113,.3)",borderRadius:8,padding:"5px 10px",color:T.red,fontSize:10,fontWeight:700,cursor:"pointer"}}>🔒 Lock</button>
        </div>
      </div>

      {/* View as lead buttons */}
      <div style={{background:T.card2,borderBottom:`1px solid ${T.bord}`,padding:"10px 14px"}}>
        <div style={{fontSize:10,fontWeight:700,color:T.textD,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>View as Lead</div>
        <div style={{display:"flex",gap:6}}>
          {Object.values(DIVS).map(d=>(
            <button key={d.id} onClick={()=>setMode(`lead-${d.id}`)}
              style={{flex:1,background:`${d.color}18`,border:`1px solid ${d.color}50`,borderRadius:8,padding:"7px 4px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:16}}>{d.emoji}</div>
              <div style={{fontSize:9,fontWeight:700,color:d.color,marginTop:2}}>{d.label}</div>
            </button>))}
        </div>
      </div>

      {demoMode&&<div style={{background:"rgba(167,139,250,.1)",padding:"6px 14px",display:"flex",alignItems:"center",gap:6,borderBottom:`1px solid ${T.bord}`}}>
        <span style={{fontSize:11}}>🧪</span><span style={{fontSize:11,color:T.purL,fontWeight:600}}>Demo Mode Active</span>
        <button onClick={onToggleDemo} style={{marginLeft:"auto",background:"rgba(255,255,255,.1)",border:`1px solid ${T.bord}`,borderRadius:5,padding:"2px 7px",fontSize:10,color:T.textM,cursor:"pointer"}}>Exit</button>
      </div>}

      {/* Director tabs */}
      <div style={{display:"flex",background:"rgba(255,255,255,.03)",borderBottom:`1px solid ${T.bord}`}}>
        {DTABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,border:"none",background:"none",padding:"10px 2px",fontSize:10,fontWeight:700,cursor:"pointer",color:tab===t.id?T.purL:T.textD,borderBottom:tab===t.id?`2px solid ${T.pur}`:"2px solid transparent",marginBottom:-1,transition:"color .15s"}}>
            {t.label}
          </button>))}
      </div>

      {tab==="monitor"  &&<DirectorMonitor archive={archive}/>}
      {tab==="announce" &&<DirectorAnnouncements/>}
      {tab==="issues"   &&<DirectorIssues/>}
      {tab==="settings" &&<DirectorSettings onLock={onBack} onPinChange={onPinChange}/>}
    </div>);}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("home"); // "home"|"division-pick"|"lead"|"pin"|"director"
  const [division,setDivision]=useState(null);
  const [activePin,setActivePin]=useState(DEFAULT_PIN);
  const [demoMode,setDemoMode]=useState(false);
  const [archive,setArchive]=useState({elec:[],mech:[],sw:[]});

  useEffect(()=>{ls(SK.dirPin).then(p=>{if(p)setActivePin(p);});},[]);
  useEffect(()=>{
    const loadArch=async()=>{
      const [e,m,s]=await Promise.all([ls(SK.archElec),ls(SK.archMech),ls(SK.archSW)]);
      setArchive({elec:e||[],mech:m||[],sw:s||[]});};
    loadArch();const t=setInterval(loadArch,10000);return()=>clearInterval(t);
  },[]);

  const toggleDemo=()=>setDemoMode(d=>!d);

  return(
    <ErrorBoundary>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        {screen==="home"&&(
          <HomePage
            onLeadMode={()=>setScreen("division-pick")}
            onDirectorMode={()=>setScreen("pin")}
            archive={archive}/>)}
        {screen==="division-pick"&&(
          <DivisionPicker
            onPick={div=>{setDivision(div);setScreen("lead");}}
            onBack={()=>setScreen("home")}/>)}
        {screen==="lead"&&division&&(
          <LeadApp
            div={division}
            onBack={()=>setScreen("division-pick")}
            demoMode={demoMode}
            onToggleDemo={toggleDemo}/>)}
        {screen==="pin"&&(
          <PinScreen
            activePin={activePin}
            onUnlock={()=>setScreen("director")}
            onBack={()=>setScreen("home")}/>)}
        {screen==="director"&&(
          <DirectorApp
            onBack={()=>setScreen("home")}
            onPinChange={p=>setActivePin(p)}
            activePin={activePin}
            demoMode={demoMode}
            onToggleDemo={toggleDemo}/>)}
      </div>
    </ErrorBoundary>);}
