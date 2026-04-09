import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 1: CONFIGURATION                                                   ║
// ║  All editable constants in one place. Change these for different events.      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  team: { number: "115", key: "frc115", name: "MVRT" },
  event: {
    key: "2026cancmp",
    name: "2026 NorCal District Championship",
    dates: "April 9–12, 2026",
    location: "Cow Palace, Daly City",
    startISO: "2026-04-09T07:00:00-07:00",
  },
  demo: { tbaEvent: "2025capin", tbaTeam: "frc115" },
  apis: {
    tbaKey: "CeAknKFak2QzpNHDnlx5k7l28hIqe6JwLywSYXtAMPiNPnyxHMyf7awc5Qowl5Z0",
    nexusKey: "rVnKYGMmwYp7N-GlkYvywj0_iPs",
    nexusEvent: "2026cancmp",
  },
  email: {
    serviceId: "service_4ssfaza",
    templateId: "template_xxoll7o",
    publicKey: "OkpYMX237horE3-2j",
    notifyEmail: "sreevatsa.pervela@gmail.com",
  },
  upstash: {
    url: "https://real-goshawk-81449.upstash.io",
    token: "gQAAAAAAAT4pAAIncDFmNThjN2Y3OGZhZmI0YTBhYmNiMzJmZDE3N2NiMjNlYXAxODE0NDk",
  },
  defaultPin: "1028",
  youtubeStreamUrl: "https://www.youtube.com/watch?v=zs_AxRJusy0", // paste YouTube livestream URL when available
};

const TEAM_NUM = CONFIG.team.number;
const TEAM_KEY = CONFIG.team.key;
const EVENT_KEY = CONFIG.event.key;
const TBA_KEY = CONFIG.apis.tbaKey;
const NEXUS_EVENT = CONFIG.apis.nexusEvent;
const DEMO_TBA_EVENT = CONFIG.demo.tbaEvent;
const DEMO_TBA_TEAM = CONFIG.demo.tbaTeam;
const HARDCODED_NEXUS_KEY = CONFIG.apis.nexusKey;
const YOUTUBE_STREAM_URL = CONFIG.youtubeStreamUrl;

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 2: STORAGE KEYS                                                    ║
// ║  All localStorage/Upstash keys used by the app.                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

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
  dirItems: "frc115_dir_items_v1",
  hiddenItems: "frc115_hidden_items_v1",
};

// Which keys get synced to Upstash (for cross-device sync)
const SYNC_KEYS = [
  SK.elec, SK.mech, SK.sw,
  SK.archElec, SK.archMech, SK.archSW, SK.archDemo,
  SK.announce, SK.issues, SK.dirPin, SK.dirItems,
];

const isSyncKey = (k) => SYNC_KEYS.some(p => k === p || k.startsWith(p + ":"));

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 3: UPSTASH SYNC ENGINE                                              ║
// ║  Cross-device real-time sync via Upstash Redis REST API.                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const _writeTimestamps = {};
const _localCache = {};
let _broadcastChannel = null;

try {
  _broadcastChannel = new BroadcastChannel("frc115_sync");
  _broadcastChannel.onmessage = (e) => {
    if (e.data?.k) {
      _writeTimestamps[e.data.k] = Date.now();
      _localCache[e.data.k] = e.data.v;
    }
  };
} catch (err) {
  console.warn("[Sync] BroadcastChannel not supported:", err.message);
}

const DEBUG_SYNC = false;
const syncLog = (...args) => DEBUG_SYNC && console.log("[Sync]", ...args);

async function upstashGet(key) {
  try {
    const url = `${CONFIG.upstash.url}/get/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CONFIG.upstash.token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[Upstash GET] HTTP ${res.status} for key "${key}"`);
      return null;
    }
    const json = await res.json();
    if (json.result == null) return null;
    try {
      return JSON.parse(json.result);
    } catch {
      return json.result;
    }
  } catch (err) {
    console.warn(`[Upstash GET] Error for key "${key}":`, err.message);
    return null;
  }
}

async function upstashSet(key, value) {
  try {
    const serialized = JSON.stringify(value);
    const res = await fetch(CONFIG.upstash.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.upstash.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", key, serialized]),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Upstash SET] HTTP ${res.status} for key "${key}": ${body}`);
      return false;
    }
    syncLog("SET OK:", key);
    return true;
  } catch (err) {
    console.error(`[Upstash SET] Error for key "${key}":`, err.message);
    return false;
  }
}

async function loadValue(key) {
  if (!isSyncKey(key)) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // If we wrote this key recently (< 5s), trust local cache
  if (_writeTimestamps[key] && Date.now() - _writeTimestamps[key] < 5000) {
    syncLog("Using local cache for:", key);
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (_localCache[key] ?? null);
    } catch { return _localCache[key] ?? null; }
  }

  // Read from Upstash (source of truth for cross-device sync)
  const remoteVal = await upstashGet(key);
  if (remoteVal !== null) {
    try { localStorage.setItem(key, JSON.stringify(remoteVal)); } catch {}
    return remoteVal;
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveValue(key, value) {
  _writeTimestamps[key] = Date.now();
  _localCache[key] = value;

  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}

  if (_broadcastChannel) {
    try { _broadcastChannel.postMessage({ k: key, v: value }); } catch {}
  }

  if (isSyncKey(key)) {
    const ok = await upstashSet(key, value);
    if (!ok) {
      console.warn(`[Save] Upstash write failed for "${key}" — data saved locally only`);
    }
  }
}

const ls = loadValue;
const ss = saveValue;

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 4: THEME & DIVISION CONFIG                                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const T = {
  bg: "#0a0118", card: "#120828", card2: "#1a0d3a", card3: "#22104a",
  bord: "rgba(139,92,246,.2)", bordB: "rgba(139,92,246,.45)",
  pur: "#9333ea", purL: "#c4b5fd", purD: "#6d28d9", purXL: "#f3e8ff",
  text: "#f5f3ff", textM: "#c4b5fd", textD: "#7c6fad",
  green: "#4ade80", red: "#f87171", amber: "#fb923c", gold: "#fbbf24",
  glow: "0 0 24px rgba(147,51,234,.35)",
  grad: "linear-gradient(135deg,#1e0a3c 0%,#2d1b69 55%,#1a1f5e 100%)",
};

const DIVS = {
  elec: { id: "elec", label: "Electrical", emoji: "⚡", color: "#f59e0b", storKey: SK.elec, archKey: SK.archElec },
  mech: { id: "mech", label: "Mechanical", emoji: "🔧", color: "#34d399", storKey: SK.mech, archKey: SK.archMech },
  sw:   { id: "sw",   label: "Software",   emoji: "💻", color: "#60a5fa", storKey: SK.sw,   archKey: SK.archSW },
};

const PC = {
  CRITICAL:  { label: "CRITICAL",  bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  HIGH:      { label: "HIGH",      bg: "#ffedd5", text: "#9a3412", dot: "#ea580c" },
  MEDIUM:    { label: "MEDIUM",    bg: "#fefce8", text: "#854d0e", dot: "#ca8a04" },
  SECONDARY: { label: "SECONDARY", bg: "#f0fdf4", text: "#166534", dot: "#16a34a" },
};

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 5: CHECKLIST DATA                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const ELEC_SECTIONS = [
  {id:"power",title:"⚡ Power & Battery",color:"#b91c1c",bg:"#fef2f2",items:[
    {id:"p1",priority:"CRITICAL",text:"Battery charged ≥ 120% and secured in mount",note:"Battery Beak — ideally 130%+; must not move under acceleration"},
    {id:"p2",priority:"CRITICAL",text:"Anderson PowerPole seated & locked — tug tested",note:null},
    {id:"p3",priority:"CRITICAL",text:"120A main breaker ON and reset",note:"Button fully out; press to reset if tripped"},
    {id:"p4",priority:"CRITICAL",text:"Main power leads — no exposed copper, ferrules intact",note:null},
    {id:"p5",priority:"HIGH",text:"REV PDH 2.0 mounted firm, voltage 12.0–13.0V, all slots occupied/blanked",note:"Main PDH — blue digits stable"},
    {id:"p6",priority:"HIGH",text:"Both Mini PDHs mounted firm, power ferrules tug tested",note:"No display — physical check only"},
    {id:"p7",priority:"MEDIUM",text:"PDH breaker ratings match assigned devices",note:null},
  ]},
  {id:"roborio",title:"🖥️ RoboRIO & Radio",color:"#1d4ed8",bg:"#eff6ff",items:[
    {id:"r1",priority:"CRITICAL",text:"RoboRIO STATUS green, COMM green, RSL blinking orange",note:"Red/orange = fault; investigate before queue"},
    {id:"r2",priority:"CRITICAL",text:"Radio powered — COMM LED green",note:null},
    {id:"r3",priority:"CRITICAL",text:"Ethernet RoboRIO ↔ radio click-locked both ends",note:null},
    {id:"r4",priority:"HIGH",text:"RoboRIO & radio power ferrules tug tested",note:null},
    {id:"r5",priority:"HIGH",text:"CANivore USB to RoboRIO strain-relieved and seated",note:"Entire drivetrain CAN backbone"},
  ]},
  {id:"can",title:"🔌 CAN Bus",color:"#15803d",bg:"#f0fdf4",items:[
    {id:"c1",priority:"CRITICAL",text:"120Ω termination resistor seated at open end + PDH end plugged in",note:"Tug test JST — can vibrate loose"},
    {id:"c2",priority:"CRITICAL",text:"No CAN wire pinched in cross rails or pivot zones",note:"Walk full CAN run"},
    {id:"c3",priority:"CRITICAL",text:"All 4 Kraken (drive) CAN connectors seated — tug tested",note:"One loose joint drops all downstream"},
    {id:"c4",priority:"CRITICAL",text:"All 4 Falcon (turn) CAN connectors seated — tug tested",note:null},
    {id:"c5",priority:"CRITICAL",text:"All 4 CANcoders seated — tug tested",note:"Lost CANcoder = wrong wheel angle"},
    {id:"c6",priority:"CRITICAL",text:"Pigeon 2.0 CAN connector seated — tug tested",note:null},
    {id:"c7",priority:"HIGH",text:"All motor & CANcoder LEDs normal — no fault blinks",note:"Rapid red = fault; check Tuner X"},
    {id:"c8",priority:"HIGH",text:"CANivore LED solid green, Pigeon boot-complete",note:null},
    {id:"c9",priority:"HIGH",text:"All CAN devices visible in Tuner X — no conflicts or faults",note:"Any red entry = do not queue"},
    {id:"c10",priority:"MEDIUM",text:"CAN bus utilization below 90%",note:null},
  ]},
  {id:"swerve",title:"🌀 Swerve Drive (×4)",color:"#7e22ce",bg:"#faf5ff",items:[
    {id:"s1",priority:"CRITICAL",text:"All 8 motor power connectors (4 Kraken + 4 Falcon) tug tested",note:"Check at PDH and at motor"},
    {id:"s2",priority:"CRITICAL",text:"All 4 CANcoder absolute positions correct in Tuner X",note:"Bad offsets = unsafe enable"},
    {id:"s3",priority:"CRITICAL",text:"No wires in swerve rotation path — full range clear",note:"Rotate each module by hand"},
    {id:"s4",priority:"HIGH",text:"Spin each motor by hand — no grinding or resistance",note:"Binding = overcurrent in-match"},
    {id:"s5",priority:"MEDIUM",text:"Module bolts tight, motors cool to touch",note:null},
  ]},
  {id:"pigeon",title:"📡 Pigeon & Limelight",color:"#0f766e",bg:"#f0fdfa",items:[
    {id:"g1",priority:"CRITICAL",text:"Pigeon rigidly mounted, CAN + power seated — tug tested",note:"IMU movement corrupts heading"},
    {id:"g2",priority:"CRITICAL",text:"Limelight power seated (LED ring on) + Ethernet click-locked",note:null},
    {id:"g3",priority:"HIGH",text:"Pigeon heading 0° after yaw reset",note:"Reset before each match"},
    {id:"g4",priority:"HIGH",text:"Limelight reachable on network, mounting rigid",note:"ping limelight.local"},
    {id:"g5",priority:"MEDIUM",text:"Correct vision pipeline selected, lens clean",note:null},
  ]},
  {id:"connections",title:"🔗 Connections & Wiring",color:"#92400e",bg:"#fffbeb",items:[
    {id:"cn1",priority:"CRITICAL",text:"Tug test ALL PowerPole + ferrule crimp connections",note:"Any movement = re-crimp before queuing"},
    {id:"cn2",priority:"CRITICAL",text:"No blackened, burned, or melted connectors",note:"Discoloration = arcing"},
    {id:"cn3",priority:"CRITICAL",text:"No wires near spinning mechanisms, belts, or chain",note:"Walk every mechanism"},
    {id:"cn4",priority:"CRITICAL",text:"Conduit exits capped, cross-rail clips intact, wires flush",note:"Popped clip = wires drop into moving parts"},
    {id:"cn5",priority:"HIGH",text:"Wago levers closed, Ethernet click-locked, no exposed strands",note:null},
    {id:"cn6",priority:"HIGH",text:"Zip ties tight/trimmed, all runs have service loop",note:"Tight wire = broken ferrule after collision"},
    {id:"cn7",priority:"MEDIUM",text:"Visual sweep for chafe, corrosion, or loose screws near board",note:null},
  ]},
  {id:"motors",title:"⚙️ Motor Function Check",color:"#be185d",bg:"#fdf2f8",items:[
    {id:"m1",priority:"CRITICAL",text:"Enable — all 4 swerve modules respond, correct direction",note:"Each wheel should steer and drive correctly"},
    {id:"m2",priority:"CRITICAL",text:"No motor faults or brownouts on enable",note:"Tuner X red entries = do not queue"},
    {id:"m3",priority:"HIGH",text:"Mechanism motors respond, no unusual sounds",note:"Run full range in pits"},
    {id:"m4",priority:"HIGH",text:"Battery stays above 11.0V during full enable",note:"Below 10.5V = brownout risk"},
  ]},
  {id:"signoff",title:"✅ Pre-Queue Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"f1",priority:"CRITICAL",text:"Robot boots — RIO green, radio green, RSL blinking, DS enabled",note:"Tuner X must be all green"},
    {id:"f2",priority:"HIGH",text:"Bumpers on or confirmed at queue",note:null},
    {id:"f3",priority:"HIGH",text:"Spare battery on charger",note:null},
    {id:"f4",priority:"HIGH",text:"Electrical lead has signed off",note:"Two-person verification recommended"},
  ]},
];

const MECH_SECTIONS = [
  { id: "mech_drivetrain", title: "🌀 Drivetrain", color: "#0d9488", bg: "#f0fdfa", items: [
    { id: "md1", priority: "HIGH", text: "Turn wheels to see if they run smooth", note: "Spin each module by hand; no grinding or resistance" },
    { id: "md2", priority: "HIGH", text: "Check for carpet burrs and other dirt on swerve modules", note: "Clean out any debris caught in modules" },
    { id: "md3", priority: "HIGH", text: "Swerve belts — check tension and condition", note: "No fraying, correct tension" },
    { id: "md4", priority: "HIGH", text: "Treads — inspect for wear and damage", note: null },
    { id: "md5", priority: "MEDIUM", text: "Drivetrain screws + nuts tight", note: null },
  ]},
  { id: "mech_intake", title: "🔄 Intake", color: "#7c3aed", bg: "#faf5ff", items: [
    { id: "mi1", priority: "HIGH", text: "Pivot up and down — full range of motion", note: "Manually move intake through range; no binding" },
    { id: "mi2", priority: "HIGH", text: "Chain tension on pivot", note: "Check for slack; adjust if needed" },
    { id: "mi3", priority: "HIGH", text: "Bearings — spin freely, no play", note: null },
    { id: "mi4", priority: "HIGH", text: "Sprockets — teeth intact, no wear", note: null },
    { id: "mi5", priority: "HIGH", text: "Intake roller — spins freely, no damage", note: null },
    { id: "mi6", priority: "HIGH", text: "Roller hubs — secure, no wobble", note: null },
    { id: "mi7", priority: "MEDIUM", text: "Intake screws + nuts tight", note: null },
    { id: "mi8", priority: "HIGH", text: "Screw on kickerbar secure", note: null },
    { id: "mi9", priority: "HIGH", text: "Pulleys — aligned, no wobble", note: null },
    { id: "mi10", priority: "HIGH", text: "Belt tension correct", note: null },
    { id: "mi11", priority: "MEDIUM", text: "Check 3D printed parts for cracks or damage", note: "Replace any cracked prints" },
    { id: "mi12", priority: "MEDIUM", text: "Check metal bar (if bent)", note: "Straighten or replace if deformed" },
  ]},
  { id: "mech_hopper", title: "📦 Hopper", color: "#059669", bg: "#ecfdf5", items: [
    { id: "mh1", priority: "HIGH", text: "Both side belts secure to the pulleys", note: "Check left and right belt attachment" },
    { id: "mh2", priority: "HIGH", text: "All belt tensions correct", note: null },
    { id: "mh3", priority: "MEDIUM", text: "Netting — intact, no tears or loose points", note: null },
    { id: "mh4", priority: "MEDIUM", text: "Hopper screws + nuts tight", note: null },
  ]},
  { id: "mech_shooter", title: "🎯 Shooter", color: "#be185d", bg: "#fdf2f8", items: [
    { id: "ms1", priority: "HIGH", text: "Bearings — spin freely, no play", note: null },
    { id: "ms2", priority: "HIGH", text: "Belt tensions correct", note: null },
    { id: "ms3", priority: "HIGH", text: "Grip tape ends — secure, not peeling", note: "Re-wrap any loose tape" },
    { id: "ms4", priority: "HIGH", text: "Flywheels — spin freely, no wobble", note: null },
    { id: "ms5", priority: "HIGH", text: "Feeder wheels — spin freely, no damage", note: null },
    { id: "ms6", priority: "HIGH", text: "Sprockets — teeth intact, aligned", note: null },
    { id: "ms7", priority: "HIGH", text: "Chains — correct tension, no skipping", note: null },
  ]},
  { id: "mech_limelight", title: "📷 Limelight Mount", color: "#166534", bg: "#f0fdf4", items: [
    { id: "ml1", priority: "HIGH", text: "Limelight mounting screws + nuts tight", note: "Camera angle shift corrupts targeting" },
  ]},
  {id:"mech_signoff",title:"✅ Mechanical Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"ms1",priority:"CRITICAL",text:"Mechanical lead has verified robot is ready to compete",note:null},
  ]},
];

const SW_SECTIONS = [
  { id: "sw_swerve", title: "🌀 Swerve", color: "#2563eb", bg: "#eff6ff", items: [
    { id: "sw1", priority: "CRITICAL", text: "Left joystick all 4 directions — swerve follows correctly", note: "Push left joystick up/down/left/right and verify wheels drive in matching direction" },
    { id: "sw2", priority: "CRITICAL", text: "Right joystick rotate — swerve rotates and goes in circles", note: "Rotate right joystick; robot should spin in place smoothly" },
    { id: "sw3", priority: "CRITICAL", text: "Both joysticks simultaneously — no weird sounds, directions followed", note: "Drive and rotate at the same time; listen for grinding or stalling" },
  ]},
  { id: "sw_intake", title: "🔄 Intake", color: "#7c3aed", bg: "#faf5ff", items: [
    { id: "sw4", priority: "CRITICAL", text: "Roller by itself (right bumper) — nothing stalled", note: "Hold right bumper; rollers should spin freely with no jamming" },
    { id: "sw5", priority: "CRITICAL", text: "Raise intake up (left dpad) — goes up to target position", note: "Press left dpad; intake arm should reach its upper setpoint cleanly" },
  ]},
  { id: "sw_shooter", title: "🎯 Shooter + Hopper", color: "#0891b2", bg: "#ecfeff", items: [
    { id: "sw6", priority: "CRITICAL", text: "Rev empty shooter (left bumper) — flywheels and back index rollers rotate", note: "Hold left bumper with no game piece; confirm flywheels spin up and index rollers move" },
    { id: "sw7", priority: "CRITICAL", text: "Revving to shooting transition (left bumper + right trigger) — all motors run, intake oscillates", note: "Hold left bumper then pull right trigger; all shooter flywheels, index motors, and intake should activate" },
    { id: "sw8", priority: "HIGH", text: "AprilTag targeting — shooter and hopper motors run when target acquired", note: "Place AprilTag in front of camera; verify all shooter/hopper motors spin given a target" },
    { id: "sw9", priority: "HIGH", text: "Swerve auto-aligns based on AprilTag position", note: "With AprilTag visible, check if swerve adjusts heading toward the target" },
  ]},
  { id: "sw_signoff", title: "✅ Software Sign-Off", color: "#1f2937", bg: "#f8fafc", items: [
    { id: "sw10", priority: "CRITICAL", text: "Software lead has confirmed robot code is ready to compete", note: null },
    { id: "sw11", priority: "HIGH", text: "Drive team is aware of any software limitations this match", note: null },
  ]},
];

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 6: CHECKLIST HELPERS                                                ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const DIVISION_SECTIONS = { elec: ELEC_SECTIONS, mech: MECH_SECTIONS, sw: SW_SECTIONS };
const getAllItemsStatic = (div,hidden) => {const items=(DIVISION_SECTIONS[div]||[]).flatMap(s=>s.items);return hidden?items.filter(i=>!hidden.has(i.id)):items;};
const getCritItemsStatic = (div,hidden) => getAllItemsStatic(div,hidden).filter(i=>i.priority==="CRITICAL");
const filterSections = (div,hidden) => {
  if(!hidden||!hidden.size)return DIVISION_SECTIONS[div]||[];
  return (DIVISION_SECTIONS[div]||[]).map(s=>({...s,items:s.items.filter(i=>!hidden.has(i.id))})).filter(s=>s.items.length>0);
};
function useHiddenItems(){
  const [hidden,setHidden]=useState(new Set());
  useEffect(()=>{ls(SK.hiddenItems).then(d=>{if(Array.isArray(d))setHidden(new Set(d));});},[]);
  const toggle=useCallback(async(id)=>{
    setHidden(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);
      ss(SK.hiddenItems,[...next]);return next;});
  },[]);
  return{hidden,toggle};
}


// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtTime = ms=>!ms?"TBD":new Date(ms).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDate = ms=>!ms?"":new Date(ms).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
const fmtDT   = ms=>!ms?"":new Date(ms).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const asArray = (v)=>Array.isArray(v)?v:[];
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
function bestQueueTime(trigNx,ourMs,nxM){
  // Prefer Nexus's own estimatedQueueTime for our match — this matches frc.nexus exactly
  if(nxM?.times?.estimatedQueueTime)return nxM.times.estimatedQueueTime;
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

async function sendEmail(mLabel, leadName, div, completed, total, quickMode) {
  const url = "https://api.emailjs.com/api/v1.0/email/send";
  const payload = {
    service_id: CONFIG.email.serviceId,
    template_id: CONFIG.email.templateId,
    user_id: CONFIG.email.publicKey,
    template_params: {
      to_email: CONFIG.email.notifyEmail,
      team_number: CONFIG.team.number,
      match_label: mLabel,
      lead_name: `${leadName || "Unknown"} (${div})`,
      completed: String(completed),
      total: String(total),
      submitted_time: new Date().toLocaleTimeString(),
      event: CONFIG.event.name,
      method: quickMode ? "Quick Complete" : "Manual",
    },
  };

  const sendOnce = async (attempt) => {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[EmailJS] Attempt ${attempt} failed — HTTP ${res.status}: ${body}`);
      }
      return res.ok;
    } catch (err) {
      console.warn(`[EmailJS] Attempt ${attempt} error:`, err.message);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await sendOnce(1);
  } catch {
    if (!navigator.onLine) return false;
    await new Promise((r) => setTimeout(r, 1200));
    try {
      return await sendOnce(2);
    } catch {
      return false;
    }
  }
}

function SyncStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${CONFIG.upstash.url}/ping`, {
          headers: { Authorization: `Bearer ${CONFIG.upstash.token}` },
        });
        const j = await r.json();
        setStatus(j.result === "PONG" ? "synced" : "error");
      } catch {
        setStatus("error");
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const cfg = {
    synced: { dot: T.green, glow: `0 0 5px ${T.green}`, txt: "Live Sync" },
    checking: { dot: T.gold, glow: null, txt: "Connecting..." },
    error: { dot: T.red, glow: null, txt: "Sync Error" },
  }[status] || { dot: "#888", txt: "..." };

  return (
    <div style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4, color: T.textD, marginTop: 1 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, boxShadow: cfg.glow, flexShrink: 0 }} />
      <span>MVRT 115 &middot; {CONFIG.event.name} &middot; {cfg.txt}</span>
    </div>
  );
}

function AnnouncementBanner() {
  const [ann, setAnn] = useState([]);

  useEffect(() => {
    const poll = () => ls(SK.announce).then(d => setAnn(asArray(d)));
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  if (!ann.length) return null;

  const C = {
    queue: { bg: "#fef2f2", border: "#dc2626", text: "#991b1b" },
    urgent: { bg: "#fffbeb", border: "#f59e0b", text: "#854d0e" },
    info: { bg: "#faf5ff", border: "#9333ea", text: "#6d28d9" },
  };
  const sorted = [...ann].sort((a, b) =>
    ({ queue: 0, urgent: 1, info: 2 }[a.urgency] ?? 2) - ({ queue: 0, urgent: 1, info: 2 }[b.urgency] ?? 2)
  );

  return (
    <div>
      {sorted.map((a) => {
        const c = C[a.urgency] || C.info;
        return (
          <div key={a.id} style={{
            background: c.bg, borderLeft: `4px solid ${c.border}`, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${c.border}40`,
          }}>
            <span style={{ fontSize: 16 }}>{a.urgency === "queue" ? "\u{1F6A8}" : a.urgency === "urgent" ? "\u26A0\uFE0F" : "\u{1F4E2}"}</span>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: c.text }}>{a.text}</div>
            <div style={{ fontSize: 10, color: c.text, opacity: .6 }}>
              {new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e, i) { console.error("App crash:", e, i); }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 32, background: T.card, color: T.red, minHeight: "100vh", fontFamily: "monospace" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>App Error</div>
        <div style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", color: T.textM }}>{String(this.state.err)}</div>
        <button onClick={() => this.setState({ err: null })} style={{ marginTop: 16, padding: "8px 16px", background: T.pur, color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
          Retry
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 12: HOME / PIN / DIVISION PICKER SCREENS                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function HomePage({ onLeadMode, onDirectorMode, archive }) {
  const now = useNow(1000);
  const eventStart = new Date(CONFIG.event.startISO).getTime();
  const diffToEvent = eventStart - now;
  const eventStarted = diffToEvent <= 0;
  const totalSubs = Object.values(archive).reduce((a, arr) => a + (arr?.length || 0), 0);
  const lastSub = Object.values(archive).flatMap(arr => arr || []).sort((a, b) => b.submittedAt - a.submittedAt)[0];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Segoe UI',Arial,sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "0 0 40px" }}>
      <div style={{ width: "100%", background: T.grad, padding: "40px 24px 32px", textAlign: "center", boxShadow: "0 8px 32px rgba(80,0,180,.4)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "rgba(147,51,234,.15)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 20, background: "rgba(147,51,234,.3)", border: `2px solid ${T.bordB}`, marginBottom: 16, boxShadow: T.glow }}>
            <span style={{ fontSize: 36 }}>{"\u{1F916}"}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.purL, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>MVRT Team 115</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.text, letterSpacing: .5, marginBottom: 4 }}>Pit Checklist App</div>
          <div style={{ fontSize: 13, color: T.textD, marginBottom: 20 }}>{CONFIG.event.name} &middot; {CONFIG.event.dates} &middot; {CONFIG.event.location}</div>
          <div style={{ display: "inline-block", background: "rgba(0,0,0,.3)", borderRadius: 12, padding: "10px 20px", border: `1px solid ${T.bord}` }}>
            {eventStarted ? (
              <div style={{ fontSize: 14, fontWeight: 700, color: T.green }}>Event In Progress!</div>
            ) : (
              <div>
                <div style={{ fontSize: 10, color: T.textD, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>Event starts in</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: T.purL, letterSpacing: 2 }}>{fmtCD(diffToEvent)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {totalSubs > 0 && (
        <div style={{ width: "100%", maxWidth: 480, padding: "12px 20px", background: T.card2, borderBottom: `1px solid ${T.bord}`, display: "flex", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.purL }}>{totalSubs}</div>
            <div style={{ fontSize: 10, color: T.textD }}>Submitted</div>
          </div>
          {lastSub && <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Last: Match {lastSub.matchNum || "?"}</div>
            <div style={{ fontSize: 10, color: T.textD }}>{lastSub.division?.toUpperCase()} &middot; {fmtTime(lastSub.submittedAt)}</div>
          </div>}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 480, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, textAlign: "center" }}>Select Your Role</div>
        <button onClick={onLeadMode} style={{ width: "100%", background: T.card, border: `1px solid ${T.bord}`, borderRadius: 16, padding: "20px", textAlign: "left", cursor: "pointer", boxShadow: T.glow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(147,51,234,.2)", border: `1px solid ${T.pur}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{"\u{1F4CB}"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 3 }}>Lead Mode</div>
              <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.5 }}>For Electrical, Mechanical, and Software leads - complete your pre-queue checklist</div>
            </div>
            <span style={{ fontSize: 20, color: T.purL }}>&rsaquo;</span>
          </div>
        </button>
        <button onClick={onDirectorMode} style={{ width: "100%", background: "rgba(109,40,217,.1)", border: `1px solid ${T.purD}`, borderRadius: 16, padding: "20px", textAlign: "left", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(109,40,217,.25)", border: `1px solid ${T.pur}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{"\u{1F39B}\uFE0F"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 3 }}>Director Mode</div>
              <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.5 }}>Monitor all divisions, push announcements, manage checklists - PIN required</div>
            </div>
            <span style={{ padding: "4px 8px", borderRadius: 8, background: "rgba(147,51,234,.2)", color: T.purL, fontWeight: 700, fontSize: 10 }}>{"\u{1F510}"} PIN</span>
          </div>
        </button>
      </div>

      <div style={{ fontSize: 10, color: T.textD, textAlign: "center", marginTop: 8 }}>
        Data: TBA &middot; Nexus &middot; Statbotics &middot; Sync: Upstash
      </div>
    </div>
  );
}

function PinScreen({ onUnlock, onBack, activePin }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (document.getElementById("frc115-kf")) return;
    const s = document.createElement("style");
    s.id = "frc115-kf";
    s.textContent = "@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}";
    document.head.appendChild(s);
  }, []);

  const submit = () => {
    if (pin === activePin) { onUnlock(); }
    else { setShake(true); setPin(""); setTimeout(() => setShake(false), 500); }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI',Arial,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 300, animation: shake ? "shake .4s ease" : "none" }}>
        {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: T.textD, cursor: "pointer", fontSize: 13, marginBottom: 16 }}>&larr; Back</button>}
        <div style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 20, padding: 32, boxShadow: T.glow }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{"\u{1F510}"}</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: T.text }}>Director Mode</div>
            <div style={{ fontSize: 11, color: T.textD, marginTop: 4 }}>MVRT Team 115</div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: pin.length > i ? T.purL : "rgba(139,92,246,.25)", border: "2px solid rgba(139,92,246,.4)", transition: "all .15s" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "\u232B"].map((k, i) => (
              <button key={i} onClick={() => { if (k === "\u232B") setPin(p => p.slice(0, -1)); else if (k !== "" && pin.length < 4) setPin(p => p + String(k)); }}
                disabled={k === ""}
                style={{ padding: "13px 0", borderRadius: 10, border: `1px solid ${T.bord}`, background: k === "" ? "transparent" : "rgba(147,51,234,.1)", color: T.text, fontSize: 18, fontWeight: 700, cursor: k === "" ? "default" : "pointer", opacity: k === "" ? 0 : 1 }}>
                {k}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={pin.length < 4}
            style={{ width: "100%", background: pin.length === 4 ? T.pur : "rgba(126,34,206,.2)", color: pin.length === 4 ? "white" : T.textD, border: "none", borderRadius: 10, padding: "12px", fontWeight: 800, fontSize: 15, cursor: pin.length === 4 ? "pointer" : "default" }}>
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}

function DivisionPicker({ onPick, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Segoe UI',Arial,sans-serif", padding: "0 0 40px" }}>
      <div style={{ background: T.grad, padding: "20px 20px 24px", boxShadow: "0 4px 20px rgba(0,0,0,.3)" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.textD, cursor: "pointer", fontSize: 13, marginBottom: 10 }}>&larr; Home</button>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.purL, letterSpacing: 2, textTransform: "uppercase" }}>MVRT Team 115 &middot; Lead Mode</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 4 }}>Select Your Division</div>
      </div>
      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 480, margin: "0 auto" }}>
        {[
          { div: "elec", emoji: "\u26A1", name: "Electrical", desc: "Power systems, CAN bus, motors, wiring", color: "#f59e0b", items: getAllItemsStatic("elec").length },
          { div: "mech", emoji: "\u{1F527}", name: "Mechanical", desc: "Drivetrain, mechanisms, fasteners", color: "#34d399", items: getAllItemsStatic("mech").length },
          { div: "sw", emoji: "\u{1F4BB}", name: "Software", desc: "Code deployment, autonomous, vision", color: "#60a5fa", items: getAllItemsStatic("sw").length },
        ].map(({ div, emoji, name, desc, color, items }) => (
          <button key={div} onClick={() => onPick(div)}
            style={{ width: "100%", background: T.card, border: `1px solid ${T.bord}`, borderRadius: 16, padding: "18px", textAlign: "left", cursor: "pointer", boxShadow: T.glow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}20`, border: `1px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 3 }}>{name}</div>
                <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.4, marginBottom: 6 }}>{desc}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textD, background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 99 }}>{items} items</span>
              </div>
              <span style={{ fontSize: 20, color: T.textD }}>&rsaquo;</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
function Badge({ p }) {
  const colors = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#10b981"
  };

  return (
    <span style={{
      background: colors[p] || "#6b7280",
      color: "white",
      padding: "2px 6px",
      borderRadius: "6px",
      fontSize: "12px"
    }}>
      {p || "?"}
    </span>
  );
}
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 13: CHECKLIST UI COMPONENTS                                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function CheckItem({ item, done, onToggle }) {
  return (
    <div onClick={() => onToggle(item.id)}
      style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: done ? "#f0fdf4" : "white", transition: "background .12s" }}>
      <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${done ? "#16a34a" : "#cbd5e1"}`, background: done ? "#16a34a" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {done && <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{"\u2713"}</span>}
      </div>
      <div style={{ flexShrink: 0, marginTop: 2 }}><Badge p={item.priority} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: done ? 400 : 600, color: done ? "#6b7280" : "#1e293b", textDecoration: done ? "line-through" : "none", lineHeight: 1.4 }}>{item.text}</div>
        {item.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{"\u27A4"} {item.note}</div>}
      </div>
    </div>
  );
}

function SectionBlock({ section, checked, onToggle, onMarkSection }) {
  const [open, setOpen] = useState(true);
  const done = section.items.filter(i => checked[i.id]).length;
  const allDone = done === section.items.length;
  const pct = Math.round(done / section.items.length * 100);

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${allDone ? "#bbf7d0" : "#e2e8f0"}`, marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", alignItems: "center", background: allDone ? "#f0fdf4" : section.bg || "#f8fafc" }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
          <div style={{ width: 3, height: 32, borderRadius: 2, background: section.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: section.color }}>{section.title}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{done}/{section.items.length} complete</div>
          </div>
          <div style={{ width: 56, background: "#e2e8f0", borderRadius: 99, height: 5, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: allDone ? "#16a34a" : section.color, borderRadius: 99, transition: "width .3s" }} />
          </div>
          {allDone && <span style={{ fontSize: 14 }}>{"\u2705"}</span>}
          <span style={{ color: "#94a3b8", fontSize: 12 }}>{open ? "\u25BE" : "\u25B8"}</span>
        </button>
        {!allDone && onMarkSection && <button onClick={(e) => { e.stopPropagation(); onMarkSection(section.items.map(i => i.id)); }}
          style={{ background: section.color, color: "white", border: "none", borderRadius: 6, padding: "5px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer", marginRight: 10, whiteSpace: "nowrap", flexShrink: 0 }}>{"\u2713"} All</button>}
      </div>
      {open && <div>{section.items.map(item => <CheckItem key={item.id} item={item} done={!!checked[item.id]} onToggle={onToggle} />)}</div>}
    </div>
  );
}

function MatchIntelPanel({ autoMatch, nexusData, tbaMatches }) {
  const now = useNow();
  const [sb, setSb] = useState(null);
  const prevKey = useRef(null);
  const parsed = autoMatch;
  const nxM = parsed ? findNexusMatch(nexusData?.matches || [], parsed) : null;
  const tbaM = parsed ? tbaMatches.find(m => m.comp_level === (parsed.level === "qm" ? "qm" : parsed.level) && m.match_number === parsed.num) : null;
  const evKey = tbaM?.event_key || CONFIG.event.key;
  const tbaKey = parsed && parsed.level === "qm" ? `${evKey}_qm${parsed.num}` : null;

  useEffect(() => {
    if (!tbaKey || tbaKey === prevKey.current) return;
    prevKey.current = tbaKey;
    setSb(null);
    fetch(`https://api.statbotics.io/v3/match/${tbaKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setSb(d))
      .catch(() => {});
  }, [tbaKey]);

  if (!parsed || (!nxM && !tbaM && !sb)) return null;

  const ts = bestMatchTime(nxM, tbaM);
  const trigNx = nxM ? findQueueTrigger(nexusData?.matches || [], nxM) : null;
  const qMs = bestQueueTime(trigNx, ts, nxM);
  const diffMs = qMs ? qMs - now : null;
  const passed = diffMs !== null && diffMs < 0;
  const urgent = diffMs !== null && diffMs >= 0 && diffMs < 90000;
  const al = getAlliances(nxM, tbaM);
  const nxStatus = nexusSS(nxM?.status);
  const myWP = sb?.pred?.red_win_prob != null ? (al?.myColor === "red" ? sb.pred.red_win_prob : 1 - sb.pred.red_win_prob) : null;
  const label = nxM?.label || matchLabelFromParsed(parsed);

  return (
    <div style={{ margin: "8px 14px 0", borderRadius: 12, overflow: "hidden", border: `2px solid ${urgent || passed ? "#fca5a5" : T.bord}`, boxShadow: urgent || passed ? "none" : T.glow }}>
      <div style={{ background: urgent || passed ? "#fef2f2" : T.card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: urgent || passed ? "#dc2626" : T.text }}>{label}</span>
            {nxStatus && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: nxStatus.bg, color: nxStatus.text }}>{nxStatus.label}</span>}
          </div>
          {ts && <div style={{ fontSize: 11, color: urgent || passed ? "#64748b" : T.textD, marginTop: 1 }}>{fmtDate(ts)} &middot; {fmtTime(ts)}</div>}
          {qMs && <div style={{ fontSize: 10, color: urgent || passed ? "#dc2626" : T.textD, marginTop: 2 }}>{trigNx ? `Queue at start of ${trigNx.label} \u2014 ${fmtTime(qMs)}` : `Queue at ${fmtTime(qMs)}`}</div>}
        </div>
        {diffMs !== null && !passed && <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: urgent ? "#dc2626" : T.textD, textTransform: "uppercase", letterSpacing: .5 }}>queue in</div>
          <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 800, color: urgent ? "#dc2626" : T.text }}>{fmtCD(diffMs)}</div>
        </div>}
        {passed && <div style={{ background: "#dc2626", color: "white", padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{"\u{1F6A8}"} QUEUE!</div>}
      </div>
      <div style={{ background: "rgba(255,255,255,.03)", padding: "10px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {al && (<>
          <div style={{ flex: 1, minWidth: 80, background: al.myColor === "red" ? "#fef2f2" : "#eff6ff", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: al.myColor === "red" ? "#991b1b" : "#1d4ed8", marginBottom: 3, textTransform: "uppercase" }}>Partners</div>
            {al.partners.map(t => <div key={t} style={{ fontSize: 12, fontWeight: 700, color: al.myColor === "red" ? "#dc2626" : "#2563eb" }}>#{t}</div>)}
          </div>
          <div style={{ flex: 1, minWidth: 80, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.textD, marginBottom: 3, textTransform: "uppercase" }}>Opponents</div>
            {al.opponents.map(t => <div key={t} style={{ fontSize: 12, fontWeight: 600, color: T.textM }}>#{t}</div>)}
          </div>
        </>)}
        {myWP != null && (
          <div style={{ flex: 2, minWidth: 110, background: "rgba(147,51,234,.1)", borderRadius: 8, padding: "7px 10px", border: `1px solid ${T.bord}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.purL, marginBottom: 4, textTransform: "uppercase" }}>Statbotics</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: myWP >= .5 ? T.green : T.red }}>Us {Math.round(myWP * 100)}%</span>
              <span style={{ fontSize: 10, color: T.textD }}>Them {Math.round((1 - myWP) * 100)}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,.1)", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${myWP * 100}%`, height: "100%", background: myWP >= .5 ? T.green : T.red, borderRadius: 99 }} />
            </div>
          </div>
        )}
      </div>
    </div>);}

function ChecklistTab({div,nexusData,tbaMatches,autoMatch,demoMode}){
  const {hidden}=useHiddenItems();
  const sections=filterSections(div,hidden);
  const allItems=getAllItemsStatic(div,hidden);
  const allIds=allItems.map(i=>i.id);
  const critItems=getCritItemsStatic(div,hidden);
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
  const markSection=async(ids)=>{
    const allSection=ids.reduce((a,id)=>({...a,[id]:true}),{});
    setChecked(allSection);await ss(sKey(),{checked:allSection,updatedBy:lead||"unknown",division:div,updatedAt:Date.now()});};
  const doReset=async()=>{setChecked({});setMsg("");await ss(sKey(),{checked:{},updatedBy:lead||"unknown",division:div,updatedAt:Date.now()});};
  const doSubmit=async(quickMode=false)=>{
    if(!allCrit){setMsg("⚠️ Complete all critical items first.");return;}
    setSubmit(true);
    const archKey = demoMode ? SK.archDemo : divCfg.archKey;
    const entry = {
      matchNum: matchNum || "?", lead: lead || "Unknown", division: div,
      submittedAt: Date.now(), completedCount: done,
      checkedIds: allIds.filter(id => checked[id]),
      markedAllComplete: quickMode, isDemo: demoMode,
    };
    const existing = await ls(archKey) || [];
    await ss(archKey, [...existing, entry]);

    let ok = false;
    if (!demoMode) ok = await sendEmail(`Match ${matchNum || "?"}`, lead, div, done, total, quickMode);

    if (demoMode) setMsg("Demo submitted!");
    else if (ok) setMsg("Submitted! Email sent.");
    else setMsg("Archived \u2014 email failed");

    setTimeout(async () => {
      setChecked({});
      setMsg("");
      await ss(sKey(), { checked: {}, updatedBy: "auto-reset", division: div, updatedAt: Date.now() });
    }, 3000);
    setSubmit(false);
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ background: T.card, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", borderBottom: `1px solid ${T.bord}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textD, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Division</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18 }}>{divCfg.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: divCfg.color }}>{divCfg.label}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textD, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Current Match</div>
          <div style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${T.bord}`, borderRadius: 6, padding: "5px 9px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: matchNum ? T.text : "#475569" }}>{matchNum || "\u2014"}</span>
            {matchNum ? <span style={{ fontSize: 9, color: T.green, fontWeight: 600 }}>{"\u25CF"} auto</span> : <span style={{ fontSize: 9, color: T.textD }}>fetch schedule</span>}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textD, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Initials</div>
          <input value={lead} onChange={e => setLead(e.target.value)} placeholder="JD"
            style={{ width: "100%", background: "rgba(255,255,255,.08)", border: `1px solid ${T.bord}`, borderRadius: 6, color: T.text, padding: "5px 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      <MatchIntelPanel autoMatch={autoMatch} nexusData={nexusData} tbaMatches={tbaMatches} />

      <div style={{ background: "white", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 2px 6px rgba(0,0,0,.06)", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{done}/{total}</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 700, background: allCrit ? "#dcfce7" : "#fee2e2", color: allCrit ? "#166534" : "#991b1b" }}>
              {allCrit ? "\u2713 Critical clear" : `${critItems.length - critDone} critical left`}
            </span>
          </div>
          <button onClick={doReset} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: "#64748b" }}>Reset</button>
        </div>
        <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: pct === 100 ? "#16a34a" : pct > 60 ? T.pur : "#f59e0b", transition: "width .3s" }} />
        </div>
      </div>

      <div style={{ background: "#faf5ff", borderBottom: "1px solid #e9d5ff", padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.purD }}>Quick Complete</div>
            <div style={{ fontSize: 11, color: T.textD, marginTop: 1 }}>No time to check individually? Mark everything done at once.</div>
          </div>
          <button onClick={() => setMarkAll(true)} style={{ background: T.pur, color: "white", border: "none", borderRadius: 7, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>{"\u2713"} Mark All</button>
        </div>
      </div>

      {showMarkAll && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
          <div style={{ textAlign: "center", fontSize: 32, marginBottom: 8 }}>{"\u26A1"}</div>
          <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 8 }}>Mark All Complete?</div>
          <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>Checks off all <strong>{total} items</strong>. Only use if you've physically verified everything.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setMarkAll(false)} style={{ flex: 1, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#374151" }}>Cancel</button>
            <button onClick={doMarkAll} style={{ flex: 2, background: T.pur, color: "white", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Yes, Mark All Done</button>
          </div>
        </div>
      </div>}

      <div style={{ padding: "12px 14px 0" }}>
        {sections.map(s => <SectionBlock key={s.id} section={s} checked={checked} onToggle={toggle} onMarkSection={markSection} />)}
      </div>

      <div style={{ padding: "4px 14px" }}>
        {msg && <div style={{ borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 13, fontWeight: 600, background: msg.includes("Submitted") || msg.includes("submitted") || msg.includes("Demo") ? "#dcfce7" : "#fee2e2", color: msg.includes("Submitted") || msg.includes("submitted") || msg.includes("Demo") ? "#166534" : "#991b1b" }}>{msg}</div>}
        <button onClick={() => doSubmit(false)} disabled={submitting || !allCrit}
          style={{ width: "100%", background: allCrit ? "#16a34a" : "#94a3b8", color: "white", border: "none", borderRadius: 9, padding: "13px", fontWeight: 700, fontSize: 15, cursor: allCrit ? "pointer" : "not-allowed" }}>
          {submitting ? "Submitting..." : allCrit ? "Submit & Notify Director" : "Complete all critical items to submit"}
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
      if(Notification.permission==="granted"){
        if("serviceWorker" in navigator&&navigator.serviceWorker.ready){
          navigator.serviceWorker.ready.then(reg=>reg.showNotification(`🤖 Team 115 — Queue for ${m.label}!`)).catch(()=>{});
        }
      }}});},[now,t115nx]);

  const renderHero=(nxM,tbaM)=>{
    if(!nxM&&!tbaM)return(
      <div style={{background:T.card,borderRadius:12,padding:16,color:T.textD,textAlign:"center",fontSize:13,marginBottom:14,border:`1px solid ${T.bord}`}}>
        {tbaMatches.length===0?"No schedule loaded — tap Fetch below":"No upcoming matches found"}
      </div>);
    const ts=bestMatchTime(nxM,tbaM);
    const trig=nxM?findQueueTrigger(nexusData?.matches||[],nxM):null;
    const qMs=bestQueueTime(trig,ts,nxM);const diffMs=qMs?qMs-now:null;
    const passed=diffMs!==null&&diffMs<0,urgent=diffMs!==null&&diffMs>=0&&diffMs<90000;
    const al=getAlliances(nxM,tbaM);const ss2=nxM?nexusSS(nxM.status):null;
    const lbl=nxM?.label||mLbl(tbaM);
    return(
      <div style={{borderRadius:12,background:passed||urgent?"#fef2f2":T.card,color:passed||urgent?"#1e293b":T.text,
        padding:16,marginBottom:14,border:passed||urgent?"2px solid #dc2626":`1px solid ${T.bord}`,boxShadow:T.glow}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:4,color:passed||urgent?"#dc2626":T.textD}}>
          {passed?"🚨 QUEUE NOW":urgent?"⚠️ QUEUE VERY SOON":"⏭ NEXT MATCH — TEAM 115"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: passed ? "#dc2626" : undefined }}>{lbl}</span>
          {ss2 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: ss2.bg, color: ss2.text }}>{ss2.label}</span>}
        </div>
        {ts && <div style={{ fontSize: 12, color: passed ? "#64748b" : T.textD, marginBottom: 4 }}>{fmtDate(ts)} &middot; {fmtTime(ts)}</div>}
        {diffMs !== null && !passed && <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, letterSpacing: 2, marginBottom: 4, color: urgent ? "#dc2626" : undefined }}>{fmtCD(diffMs)}</div>}
        {passed && <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>Get to the queue line now!</div>}
        {qMs && <div style={{ fontSize: 11, color: passed ? "#92400e" : T.textD, marginBottom: 8 }}>{trig ? `Queue at start of ${trig.label} \u2014 ${fmtTime(qMs)}` : `Queue at ${fmtTime(qMs)} (10-min fallback)`}</div>}
        {al && <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textD, marginBottom: 4 }}>PARTNERS</div>
            {al.partners.map(t => <div key={t} style={{ fontSize: 13, fontWeight: 600, color: al.myColor === "red" ? "#fca5a5" : "#93c5fd" }}>#{t}</div>)}
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textD, marginBottom: 4 }}>OPPONENTS</div>
            {al.opponents.map(t => <div key={t} style={{ fontSize: 13, fontWeight: 600, color: T.textM }}>#{t}</div>)}
          </div>
          <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textD, marginBottom: 4 }}>SIDE</div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: al.myColor === "red" ? "#f87171" : "#60a5fa" }}>{al.myColor}</div>
          </div>
        </div>}
      </div>
    );
  };

  return(<div style={{padding:14}}>
    {renderHero(nextNx,nextTba)}
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button onClick={onFetch} disabled={loading} style={{flex:1,background:T.pur,color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading?0.7:1}}>{loading?"Loading…":"🔄 Fetch Schedule"}</button>
      <button onClick={async()=>{if("Notification" in window){await Notification.requestPermission();if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});}}} style={{background:T.card2,border:`1px solid ${T.bord}`,borderRadius:8,padding:"10px 12px",fontWeight:600,fontSize:12,cursor:"pointer",color:T.textM}}>🔔</button>
    </div>
    {error&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#991b1b",marginBottom:12}}>{error}</div>}
    {(t115nx.length||t115tba.length)>0&&<div>
      <div style={{fontSize:12,fontWeight:700,color:T.textD,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Team 115 — {EVENT_KEY}</div>
      {(t115nx.length?t115nx:t115tba).map((m,idx)=>{
        const isNx=!!m.label;const ts=isNx?bestMatchTime(m,null):(getTS(m)||0)*1000;
        const passed=ts&&ts<now-120000;const al=getAlliances(isNx?m:null,isNx?null:m);
        const trig=isNx?findQueueTrigger(nexusData?.matches||[],m):null;
        const qMs=bestQueueTime(trig,ts,isNx?m:null);const diffMs=qMs?qMs-now:null;
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
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 16: ARCHIVE TAB                                                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function ArchiveTab({ div, demoMode }) {
  const [archive, setArchive] = useState([]);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const sections = DIVISION_SECTIONS[div] || [];
  const allItems = getAllItemsStatic(div);
  const critItems = getCritItemsStatic(div);
  const divCfg = DIVS[div];

  useEffect(() => {
    const k = demoMode ? SK.archDemo : divCfg.archKey;
    ls(k).then(d => {
      const filtered = asArray(d).filter(e => !e.division || e.division === div);
      setArchive(filtered);
      setLoading(false);
    });
  }, [div, demoMode, divCfg.archKey]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: T.textD }}>Loading...</div>;
  if (!archive.length) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>{"\u{1F4ED}"}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>No {divCfg.label} submissions yet</div>
      <div style={{ fontSize: 12, color: T.textD, marginTop: 4 }}>Submitted checklists appear here after each match</div>
    </div>
  );

  if (sel !== null) {
    const e = archive[sel];
    if (!e) { setSel(null); return null; }
    const ds = new Set(e.checkedIds || []);
    return (
      <div style={{ padding: 14 }}>
        <button onClick={() => setSel(null)} style={{ background: "none", border: `1px solid ${T.bord}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: T.textM, fontWeight: 600, marginBottom: 14 }}>&larr; Back</button>
        <div style={{ background: `linear-gradient(135deg,${T.card},${T.card2})`, borderRadius: 12, padding: 16, color: T.text, marginBottom: 14, border: `1px solid ${T.bord}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textD, letterSpacing: 1, marginBottom: 2 }}>SUBMISSION RECORD &middot; {divCfg.emoji} {divCfg.label.toUpperCase()}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Match {e.matchNum || "?"}</div>
          <div style={{ fontSize: 12, color: T.textD, marginTop: 4 }}>{fmtDT(e.submittedAt)} &middot; Lead: {e.lead || "Unknown"}</div>
        </div>
        {sections.map(sec => {
          const sd = sec.items.filter(i => ds.has(i.id)).length;
          const ad = sd === sec.items.length;
          return (
            <div key={sec.id} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${ad ? "#bbf7d0" : "#fecaca"}`, marginBottom: 8 }}>
              <div style={{ background: ad ? "#f0fdf4" : "#fef2f2", padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 24, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 12, color: sec.color }}>{sec.title}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: ad ? "#16a34a" : "#dc2626" }}>{sd}/{sec.items.length}</span>
                <span>{ad ? "\u2705" : "\u26A0\uFE0F"}</span>
              </div>
              {sec.items.filter(i => !ds.has(i.id)).map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid #fee2e2", background: "#fff5f5" }}>
                  <span>{"\u274C"}</span>
                  <div style={{ flex: 1, fontSize: 12, color: "#374151", fontWeight: 600 }}>{item.text}</div>
                  <Badge p={item.priority} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>
        {divCfg.emoji} {divCfg.label} &middot; {archive.length} Submission{archive.length !== 1 ? "s" : ""}
      </div>
      {[...archive].reverse().map((e, ri) => {
        const idx = archive.length - 1 - ri;
        const pct = allItems.length > 0 ? Math.round(e.completedCount / allItems.length * 100) : 0;
        const allCritDone = critItems.every(i => (e.checkedIds || []).includes(i.id));
        return (
          <div key={idx} onClick={() => setSel(idx)} style={{ borderRadius: 10, border: `1px solid ${allCritDone ? "#bbf7d0" : "#fecaca"}`, background: "white", marginBottom: 10, overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: allCritDone ? "#f0fdf4" : "#fef2f2" }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: allCritDone ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>{allCritDone ? "\u2705" : "\u26A0\uFE0F"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>Match {e.matchNum || "?"}</span>
                  {e.markedAllComplete && <span style={{ fontSize: 10, fontWeight: 700, background: "#ffedd5", color: "#9a3412", padding: "1px 7px", borderRadius: 99 }}>QUICK</span>}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDT(e.submittedAt)} &middot; {e.lead || "Unknown"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: pct === 100 ? "#16a34a" : pct > 80 ? "#ca8a04" : "#dc2626" }}>{pct}%</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{e.completedCount}/{allItems.length}</div>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>&rsaquo;</span>
            </div>
            <div style={{ background: "#e2e8f0", height: 3 }}><div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : pct > 80 ? "#ca8a04" : "#dc2626" }} /></div>
          </div>
        );
      })}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 17: LIVESTREAM TAB                                                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function LivestreamTab() {
  const hasStream = !!CONFIG.youtubeStreamUrl;
  const [open, setOpen] = useState(false);

  if (!hasStream) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F4FA}"}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 8 }}>Livestream Coming Soon</div>
      <div style={{ fontSize: 13, color: T.textD, lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
        The official FRC livestream link hasn't been posted yet. It will appear here automatically once the event goes live.
      </div>
    </div>
  );

  const videoId = CONFIG.youtubeStreamUrl.includes("v=")
    ? new URLSearchParams(new URL(CONFIG.youtubeStreamUrl).search).get("v")
    : CONFIG.youtubeStreamUrl.split("/").pop();

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: T.card, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.bord}`, marginBottom: 12 }}>
        {open ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="Livestream"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="autoplay;encrypted-media" allowFullScreen />
          </div>
        ) : (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{"\u25B6\uFE0F"}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 8 }}>NorCal DCMP Livestream</div>
            <button onClick={() => setOpen(true)} style={{ background: T.pur, color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Watch Live</button>
          </div>
        )}
      </div>
      <a href={CONFIG.youtubeStreamUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", background: T.card2, border: `1px solid ${T.bord}`, borderRadius: 10, padding: "12px 16px", textAlign: "center", color: T.purL, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
        Open in YouTube
      </a>
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 18: INFO TAB                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function InfoTab({ div }) {
  const [open, setOpen] = useState(null);
  const divCfg = DIVS[div] || DIVS.elec;
  const FEATURES = [
    { icon: "\u{1F4CB}", title: "Checklist", color: "#1d4ed8", bg: "#eff6ff", summary: `${divCfg.emoji} ${divCfg.label} pre-queue checklist.`, steps: [
      { h: "Auto-detected match", b: "The match number is pulled from the schedule automatically \u2014 just enter your initials." },
      { h: "Tap to check items", b: "CRITICAL items must all be checked before you can submit. HIGH, MEDIUM, and SECONDARY won't block submission." },
      { h: "Submit", b: "Once all critical items are done, tap Submit to archive and notify the director." },
    ]},
    { icon: "\u{1F3C6}", title: "Schedule", color: "#15803d", bg: "#f0fdf4", summary: "Live match schedule with queue countdowns.", steps: [
      { h: "Fetch Schedule", b: "Tap Fetch to load Team 115's matches from TBA." },
    ]},
    { icon: "\u{1F5C2}", title: "Archive", color: "#92400e", bg: "#fffbeb", summary: "Full history of every submitted checklist.", steps: [
      { h: "Section breakdown", b: "Tapping a card shows exactly which items were skipped." },
    ]},
  ];

  return (
    <div style={{ padding: 14, paddingBottom: 32 }}>
      <div style={{ background: T.grad, borderRadius: 14, padding: 20, marginBottom: 14, color: T.text }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{divCfg.emoji}</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>MVRT Team 115 &mdash; {divCfg.label} Lead Guide</div>
        <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.5 }}>Pre-queue checklist for {CONFIG.event.name} ({CONFIG.event.dates}).</div>
      </div>
      {FEATURES.map((f, i) => (
        <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${open === i ? f.color + "44" : "#e2e8f0"}`, marginBottom: 10 }}>
          <button onClick={() => setOpen(o => o === i ? null : i)} style={{ width: "100%", background: open === i ? f.bg : "white", border: "none", cursor: "pointer", padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{f.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: f.color }}>{f.title}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{f.summary}</div>
            </div>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>{open === i ? "\u25BE" : "\u25B8"}</span>
          </button>
          {open === i && <div style={{ borderTop: `1px solid ${f.color}22`, background: f.bg }}>
            {f.steps.map((s, si) => (
              <div key={si} style={{ padding: "11px 14px", borderBottom: si < f.steps.length - 1 ? `1px solid ${f.color}18` : "none" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: f.color, marginBottom: 3 }}>{s.h}</div>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{s.b}</div>
              </div>
            ))}
          </div>}
        </div>
      ))}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 19: DIRECTOR COMPONENTS                                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function DivisionMonitorPanel({ div, archive }) {
  const [liveData, setLiveData] = useState({});
  const [expandedMatch, setExpanded] = useState(null);
  const [tick, setTick] = useState(0);
  const divCfg = DIVS[div];
  const sections = DIVISION_SECTIONS[div] || [];
  const allItems = getAllItemsStatic(div);
  const critItems = getCritItemsStatic(div);

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 3000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const poll = async () => {
      const data = {};
      const keys = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12", "Q13", "Q14", "Q15", "Q16", "SF1", "F1"];
      for (const mk of keys) {
        const d = await ls(`${divCfg.storKey}:${mk}`);
        if (d && d.updatedAt && (Date.now() - d.updatedAt) < 2 * 60 * 60 * 1000) data[mk] = d;
      }
      const base = await ls(divCfg.storKey);
      if (base && base.updatedAt) data["current"] = base;
      setLiveData(data);
    };
    poll();
  }, [tick, divCfg.storKey]);

  const activeKeys = Object.keys(liveData).filter(k => liveData[k]?.checked && Object.keys(liveData[k].checked).length > 0);
  const divArch = asArray(archive).filter(e => e.division === div || (!e.division && div === "elec"));
  const totalSubs = divArch.length;
  const avgPct = totalSubs && allItems.length > 0 ? Math.round(divArch.reduce((a, e) => a + Math.round(e.completedCount / allItems.length * 100), 0) / totalSubs) : 0;
  const critMisses = divArch.filter(e => !critItems.every(i => (e.checkedIds || []).includes(i.id)));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ background: `linear-gradient(135deg,${T.card2},${T.card3})`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.bord}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${divCfg.color}20`, border: `1px solid ${divCfg.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{divCfg.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{divCfg.label}</div>
          <div style={{ fontSize: 11, color: T.textD }}>{totalSubs} submissions &middot; avg {avgPct}%{critMisses.length > 0 ? ` \u00B7 ${critMisses.length} crit miss` : ""}</div>
        </div>
      </div>
      {activeKeys.length === 0 ? (
        <div style={{ padding: 14, textAlign: "center", color: T.textD, fontSize: 13 }}>
          No active {divCfg.label.toLowerCase()} checklist &mdash; waiting for leads
        </div>
      ) : activeKeys.map(mk => {
        const d = liveData[mk];
        const chk = d.checked || {};
        const doneCount = Object.values(chk).filter(Boolean).length;
        const pct = allItems.length > 0 ? Math.round(doneCount / allItems.length * 100) : 0;
        const critDoneCount = critItems.filter(i => chk[i.id]).length;
        const allCritDone = critDoneCount === critItems.length;
        const ago = Math.round((Date.now() - d.updatedAt) / 1000);
        const isExpanded = expandedMatch === `${div}-${mk}`;
        const uncheckedCrit = critItems.filter(i => !chk[i.id]);

        return (
          <div key={mk} style={{ borderBottom: `1px solid ${T.bord}` }}>
            <div style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>Match {mk}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: allCritDone ? "rgba(74,222,128,.15)" : "rgba(248,113,113,.15)", color: allCritDone ? T.green : T.red }}>
                  {allCritDone ? "\u2713 Critical clear" : `${critItems.length - critDoneCount} crit left`}
                </span>
                <span style={{ fontSize: 10, color: T.textD, marginLeft: "auto" }}>
                  {d.updatedBy || "?"} &middot; {ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 99, height: 7, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? T.green : pct > 60 ? T.pur : T.red, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? T.green : pct > 60 ? T.purL : T.red, flexShrink: 0 }}>{pct}%</span>
              </div>
              <button onClick={() => setExpanded(e => e === `${div}-${mk}` ? null : `${div}-${mk}`)}
                style={{ background: "rgba(147,51,234,.15)", border: `1px solid ${T.bord}`, borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: T.purL, fontWeight: 600 }}>
                {isExpanded ? "\u25B2 Hide" : "\u25BC Show items"}
              </button>
              {uncheckedCrit.length > 0 && <span style={{ fontSize: 11, color: T.red, fontWeight: 600, marginLeft: 8 }}>{"\u274C"} {uncheckedCrit.length} critical unchecked</span>}
            </div>
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${T.bord}`, padding: "8px 14px", background: "rgba(0,0,0,.2)" }}>
                {sections.map(sec => {
                  const sd = sec.items.filter(i => chk[i.id]).length;
                  return (
                    <div key={sec.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 3, height: 16, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: sec.color }}>{sec.title}</span>
                        <span style={{ fontSize: 10, color: T.textD, marginLeft: "auto" }}>{sd}/{sec.items.length}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {sec.items.map(item => {
                          const isDone = !!chk[item.id];
                          return (
                            <div key={item.id} title={item.text} style={{ display: "flex", alignItems: "center", gap: 3, background: isDone ? "rgba(74,222,128,.1)" : "rgba(248,113,113,.1)", borderRadius: 5, padding: "2px 6px", border: `1px solid ${isDone ? "rgba(74,222,128,.3)" : "rgba(248,113,113,.3)"}` }}>
                              <span style={{ fontSize: 9 }}>{isDone ? "\u2713" : "\u2717"}</span>
                              <span style={{ fontSize: 9, color: isDone ? T.green : T.red, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.text.length > 30 ? item.text.slice(0, 28) + "\u2026" : item.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DirectorMonitor({ archive }) {
  return (
    <div style={{ padding: 14, paddingBottom: 32 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textD, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Live Division Monitor</div>
      <DivisionMonitorPanel div="elec" archive={archive.elec || []} />
      <DivisionMonitorPanel div="mech" archive={archive.mech || []} />
      <DivisionMonitorPanel div="sw" archive={archive.sw || []} />
    </div>
  );
}

function DirectorAnnouncements() {
  const [ann, setAnn] = useState([]);
  const [text, setText] = useState("");
  const [urgency, setUrgency] = useState("info");

  useEffect(() => {
    const poll = () => ls(SK.announce).then(d => setAnn(asArray(d)));
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  const push = async () => {
    if (!text.trim()) return;
    const a = [...ann, { id: Date.now(), text: text.trim(), urgency, time: Date.now() }];
    setAnn(a);
    await ss(SK.announce, a);
    setText("");
  };
  const remove = async (id) => { const a = ann.filter(x => x.id !== id); setAnn(a); await ss(SK.announce, a); };
  const clearAll = async () => { setAnn([]); await ss(SK.announce, []); };

  const TT = {
    queue: { col: "#dc2626", bg: "rgba(220,38,38,.15)", label: "QUEUE NOW" },
    urgent: { col: "#f59e0b", bg: "rgba(245,158,11,.15)", label: "URGENT" },
    info: { col: T.pur, bg: "rgba(147,51,234,.15)", label: "INFO" },
  };

  return (
    <div style={{ padding: 14, paddingBottom: 32 }}>
      <div style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>Push Announcement to Leads</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {Object.entries(TT).map(([k, v]) => (
            <button key={k} onClick={() => setUrgency(k)} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${urgency === k ? v.col : T.bord}`, background: urgency === k ? v.bg : "transparent", color: urgency === k ? v.col : T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type announcement..." rows={3}
          style={{ width: "100%", background: "rgba(255,255,255,.05)", border: `1px solid ${T.bord}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, color: T.text, resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }} />
        <button onClick={push} disabled={!text.trim()} style={{ width: "100%", background: text.trim() ? T.pur : "rgba(126,34,206,.2)", color: text.trim() ? "white" : T.textD, border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: text.trim() ? "pointer" : "default" }}>
          Push to All Leads
        </button>
      </div>
      {ann.length > 0 ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, textTransform: "uppercase", letterSpacing: .5 }}>Active ({ann.length})</div>
            <button onClick={clearAll} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear All</button>
          </div>
          {ann.map(a => {
            const t2 = TT[a.urgency] || TT.info;
            return (
              <div key={a.id} style={{ background: t2.bg, border: `1px solid ${t2.col}44`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.text}</div>
                  <div style={{ fontSize: 10, color: T.textD, marginTop: 3 }}>{new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 16, flexShrink: 0 }}>{"\u2715"}</button>
              </div>
            );
          })}
        </div>
      ) : <div style={{ textAlign: "center", padding: 24, color: T.textD, fontSize: 13 }}>No active announcements</div>}
    </div>
  );
}
function DirectorChecklistManager() {
  const [items, setItems] = useState([]);
  const [div, setDiv] = useState("elec");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("HIGH");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    ls(SK.dirItems).then(d => setItems(asArray(d)));
    const t = setInterval(() => ls(SK.dirItems).then(d => setItems(asArray(d))), 10000);
    return () => clearInterval(t);
  }, []);

  const addItem = async () => {
    if (!text.trim()) return;
    const newItem = {
      id: `dir_${Date.now()}`,
      division: div,
      text: text.trim(),
      note: note.trim() || null,
      priority,
      addedAt: Date.now(),
    };
    const updated = [...items, newItem];
    setItems(updated);
    await ss(SK.dirItems, updated);
    setText("");
    setNote("");
    setMsg(`Added to ${DIVS[div].label} checklist`);
    setTimeout(() => setMsg(""), 2000);
  };

  const removeItem = async (id) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    await ss(SK.dirItems, updated);
    setMsg("Item removed from all devices");
    setTimeout(() => setMsg(""), 2000);
  };

  const clearAll = async () => {
    setItems([]);
    await ss(SK.dirItems, []);
    setMsg("All custom items cleared");
    setTimeout(() => setMsg(""), 2000);
  };

  const iS = { width: "100%", background: "rgba(255,255,255,.05)", border: `1px solid ${T.bord}`, borderRadius: 7, padding: "7px 9px", fontSize: 13, color: T.text, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 14, paddingBottom: 32 }}>
      <div style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>
          Add Checklist Item to All Devices
        </div>

        <div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>DIVISION</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {Object.values(DIVS).map(d => (
            <button key={d.id} onClick={() => setDiv(d.id)}
              style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${div === d.id ? d.color : T.bord}`, background: div === d.id ? `${d.color}20` : "transparent", color: div === d.id ? d.color : T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              {d.emoji} {d.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>PRIORITY</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {Object.entries(PC).map(([k, v]) => (
            <button key={k} onClick={() => setPriority(k)}
              style={{ flex: 1, padding: "5px 4px", borderRadius: 6, border: `1px solid ${priority === k ? v.dot : T.bord}`, background: priority === k ? v.bg : "transparent", color: priority === k ? v.text : T.textD, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>ITEM TEXT</div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g., Check intake belt tension" style={{ ...iS, marginBottom: 8 }} />

        <div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>NOTE (optional)</div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Belt slipped in Q3" style={{ ...iS, marginBottom: 10 }} />

        <button onClick={addItem} disabled={!text.trim()}
          style={{ width: "100%", background: text.trim() ? T.pur : "rgba(126,34,206,.2)", color: text.trim() ? "white" : T.textD, border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: text.trim() ? "pointer" : "default" }}>
          Add to {DIVS[div].label} Checklist
        </button>
        {msg && <div style={{ fontSize: 12, color: T.green, marginTop: 6 }}>{msg}</div>}
      </div>

      {items.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, textTransform: "uppercase", letterSpacing: .5 }}>
              Custom Items ({items.length})
            </div>
            <button onClick={clearAll} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear All</button>
          </div>
          {items.map(item => {
            const dv = DIVS[item.division] || DIVS.elec;
            return (
              <div key={item.id} style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, background: `${dv.color}20`, color: dv.color, padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>{dv.emoji} {dv.label}</span>
                    <Badge p={item.priority} />
                  </div>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{item.text}</div>
                  {item.note && <div style={{ fontSize: 11, color: T.textD, marginTop: 2 }}>{"\u27A4"} {item.note}</div>}
                  <div style={{ fontSize: 10, color: T.textD, marginTop: 3 }}>Added {fmtDT(item.addedAt)}</div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 16, flexShrink: 0 }}>{"\u2715"}</button>
              </div>
            );
          })}
        </div>
      )}
      {items.length === 0 && <div style={{ textAlign: "center", padding: 24, color: T.textD, fontSize: 13 }}>No custom checklist items. Add items above and they'll appear in all lead checklists instantly.</div>}
    </div>
  );
}
function DirectorIssues() {
  const [issues, setIssues] = useState([]);
  const [match, setMatch] = useState("");
  const [sev, setSev] = useState("medium");
  const [comp, setComp] = useState("");
  const [desc, setDesc] = useState("");
  const [isDiv, setIsDiv] = useState("elec");

  useEffect(() => {
    const poll = () => ls(SK.issues).then(d => setIssues(asArray(d)));
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    if (!desc.trim()) return;
    const list = [...issues, { match, sev, comp, desc: desc.trim(), div: isDiv, id: Date.now(), time: Date.now() }];
    setIssues(list);
    await ss(SK.issues, list);
    setMatch(""); setComp(""); setDesc("");
  };
  const remove = async (id) => { const l = issues.filter(x => x.id !== id); setIssues(l); await ss(SK.issues, l); };

  const SEV = {
    high: { col: T.red, bg: "rgba(248,113,113,.12)", label: "HIGH" },
    medium: { col: T.amber, bg: "rgba(251,146,60,.12)", label: "MEDIUM" },
    low: { col: T.purL, bg: "rgba(196,181,253,.12)", label: "LOW" },
  };
  const COMPS = ["Battery/Power", "CAN Bus", "Swerve Module", "RoboRIO/Radio", "Limelight", "Wire/Connector", "Motor/Controller", "Drivetrain Mech", "Game Mechanism", "Fasteners", "Software/Code", "Vision", "Auto", "Other"];
  const iS = { width: "100%", background: "rgba(255,255,255,.05)", border: `1px solid ${T.bord}`, borderRadius: 7, padding: "7px 9px", fontSize: 13, color: T.text, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 14, paddingBottom: 32 }}>
      <div style={{ background: T.card, border: `1px solid ${T.bord}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textD, marginBottom: 10, textTransform: "uppercase", letterSpacing: .5 }}>Log Post-Match Issue</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>MATCH</div><input value={match} onChange={e => setMatch(e.target.value)} placeholder="Q12" style={iS} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>DIVISION</div>
            <select value={isDiv} onChange={e => setIsDiv(e.target.value)} style={{ ...iS, background: T.card2 }}>
              {Object.values(DIVS).map(d => <option key={d.id} value={d.id}>{d.emoji} {d.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: T.textD, marginBottom: 3 }}>COMPONENT</div>
          <select value={comp} onChange={e => setComp(e.target.value)} style={{ ...iS, background: T.card2 }}>
            <option value="">Select...</option>{COMPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {Object.entries(SEV).map(([k, v]) => (
            <button key={k} onClick={() => setSev(k)} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: `1px solid ${sev === k ? v.col : T.bord}`, background: sev === k ? v.bg : "transparent", color: sev === k ? v.col : T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
          ))}
        </div>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe what broke..." rows={3}
          style={{ ...iS, resize: "none", marginBottom: 8, fontFamily: "inherit" }} />
        <button onClick={save} disabled={!desc.trim()} style={{ width: "100%", background: desc.trim() ? T.pur : "rgba(126,34,206,.2)", color: desc.trim() ? "white" : T.textD, border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: desc.trim() ? "pointer" : "default" }}>Log Issue</button>
      </div>
      {issues.length === 0 && <div style={{ textAlign: "center", padding: 24, color: T.textD, fontSize: 13 }}>No issues logged</div>}
      {[...issues].reverse().map(iss => {
        const s = SEV[iss.sev || "medium"] || SEV.medium;
        const dv = DIVS[iss.div] || DIVS.elec;
        return (
          <div key={iss.id} style={{ background: s.bg, border: `1px solid ${s.col}44`, borderRadius: 10, padding: "11px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  {iss.match && <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Match {iss.match}</span>}
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,.08)", color: T.textM, padding: "1px 7px", borderRadius: 99 }}>{dv.emoji} {dv.label}</span>
                  {iss.comp && <span style={{ fontSize: 11, background: "rgba(255,255,255,.08)", color: T.textM, padding: "1px 7px", borderRadius: 99 }}>{iss.comp}</span>}
                </div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{iss.desc}</div>
                <div style={{ fontSize: 10, color: T.textD, marginTop: 4 }}>{new Date(iss.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <button onClick={() => remove(iss.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontSize: 16, flexShrink: 0 }}>{"\u2715"}</button>
            </div>
          </div>
        );
      })}
    </div>
  );}

// ── DIRECTOR: SETTINGS ────────────────────────────────────────────────────────
function DirectorSettings({onLock,onPinChange}){
  const [archiveSizes,setArchiveSizes]=useState({elec:0,mech:0,sw:0,demo:0});
  const [clearMsg,setClearMsg]=useState("");
  const [newPin,setNewPin]=useState("");const [confirmPin,setConfirmPin]=useState("");const [pinMsg,setPinMsg]=useState("");
  const [nexusInput,setNexusInput]=useState(HARDCODED_NEXUS_KEY);const [ytInput,setYtInput]=useState(YOUTUBE_STREAM_URL);
  const {hidden,toggle:toggleHidden}=useHiddenItems();
  const [editDiv,setEditDiv]=useState(null);
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
      {/* Checklist Item Management */}
      <div style={bS}>
        <div style={lS}>Manage Checklist Items</div>
        <div style={{fontSize:11,color:T.textD,marginBottom:10}}>Remove items from checklists. Leads will not see removed items. {hidden.size>0&&<span style={{color:T.amber,fontWeight:700}}>{hidden.size} item{hidden.size!==1?"s":""} hidden</span>}</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[["elec","⚡","Electrical"],["mech","🔧","Mechanical"],["sw","💻","Software"]].map(([d,emoji,label])=>(
            <button key={d} onClick={()=>setEditDiv(editDiv===d?null:d)}
              style={{flex:1,background:editDiv===d?"rgba(147,51,234,.2)":"rgba(255,255,255,.04)",border:`1px solid ${editDiv===d?T.pur:T.bord}`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:14}}>{emoji}</div>
              <div style={{fontSize:9,fontWeight:700,color:editDiv===d?T.purL:T.textD}}>{label}</div>
            </button>))}
        </div>
        {editDiv&&(DIVISION_SECTIONS[editDiv]||[]).map(sec=>(
          <div key={sec.id} style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:sec.color,marginBottom:4,padding:"4px 0"}}>{sec.title}</div>
            {sec.items.map(item=>{
              const isHidden=hidden.has(item.id);
              return(
                <div key={item.id} onClick={()=>toggleHidden(item.id)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,marginBottom:2,cursor:"pointer",
                    background:isHidden?"rgba(248,113,113,.1)":"rgba(255,255,255,.03)",border:`1px solid ${isHidden?"rgba(248,113,113,.3)":T.bord}`,opacity:isHidden?0.6:1}}>
                  <span style={{fontSize:12,flexShrink:0}}>{isHidden?"🚫":"✅"}</span>
                  <div style={{flex:1,fontSize:11,color:isHidden?T.red:T.text,textDecoration:isHidden?"line-through":"none"}}>{item.text}</div>
                  <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,
                    background:item.priority==="CRITICAL"?"rgba(239,68,68,.15)":item.priority==="HIGH"?"rgba(251,146,60,.15)":"rgba(250,204,21,.15)",
                    color:item.priority==="CRITICAL"?"#ef4444":item.priority==="HIGH"?"#fb923c":"#fbbf24"}}>{item.priority}</span>
                </div>);
            })}
          </div>))}
      </div>

      <div style={bS}>
        <div style={lS}>Change Director PIN</div>
        <input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New 4-digit PIN" type="password" maxLength={4} style={iS} />
        <input value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirm new PIN" type="password" maxLength={4} style={iS} />
        <button onClick={savePin} style={btn()}>Save New PIN</button>
        {pinMsg && <div style={{ fontSize: 12, color: pinMsg.includes("updated") ? T.green : T.red, marginTop: 2 }}>{pinMsg}</div>}
      </div>
      <div style={bS}>
        <div style={lS}>Archive Management</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
          {[["elec", "\u26A1"], ["mech", "\u{1F527}"], ["sw", "\u{1F4BB}"], ["demo", "\u{1F9EA}"]].map(([d, emoji]) => (
            <div key={d} style={{ background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "8px 4px", textAlign: "center", border: `1px solid ${T.bord}` }}>
              <div style={{ fontSize: 16 }}>{emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.purL }}>{archiveSizes[d] || 0}</div>
              <div style={{ fontSize: 9, color: T.textD }}>{d}</div>
            </div>
          ))}
        </div>
        {[["Elec", "#dc2626", SK.archElec, "elec"], ["Mech", "#374151", SK.archMech, "mech"], ["SW", "#374151", SK.archSW, "sw"], ["Demo", "#374151", SK.archDemo, "demo"]].map(([lbl, col, k, d]) => (
          <button key={d} onClick={() => clearArch(k, d)} style={btn(col)}>Clear {lbl} Archive</button>
        ))}
        <button onClick={clearAnn} style={btn("#374151")}>Clear All Announcements</button>
        {clearMsg && <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>{clearMsg}</div>}
      </div>
      <div style={bS}>
        <div style={lS}>System Info</div>
        <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.9 }}>
          <div>Event: <strong style={{ color: T.text }}>{CONFIG.event.key} &middot; {CONFIG.event.name}</strong></div>
          <div>Notify: <strong style={{ color: T.text }}>{CONFIG.email.notifyEmail}</strong></div>
          <div>Nexus: <strong style={{ color: T.text }}>...{CONFIG.apis.nexusKey.slice(-8)}</strong></div>
          <div>Sync: <strong style={{ color: T.text }}>Upstash Redis</strong></div>
        </div>
      </div>
      <button onClick={onLock} style={{ width: "100%", background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.red }}>
        Lock Director Mode
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

  // Auto-fetch schedule on mount
  const hasFetched=useRef(false);
  useEffect(()=>{if(!hasFetched.current){hasFetched.current=true;fetchAll();}},[fetchAll]);

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
  }, [nexusData, tbaMatches]);

  const TABS = [
    { id: "checklist", label: `${divCfg.emoji} Check` },
    { id: "schedule", label: "Schedule" },
    { id: "archive", label: "Archive" },
    { id: "stream", label: "Stream" },
    { id: "info", label: "Info" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", background: "#f1f5f9", minHeight: "100vh", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: T.grad, color: "white", padding: "12px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.1)", border: `1px solid ${T.bord}`, borderRadius: 8, padding: "5px 8px", color: T.textM, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>&larr; Home</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: .3 }}>
              <span style={{ color: divCfg.color }}>{divCfg.emoji}</span> {divCfg.label} Lead
            </div>
            <SyncStatus />
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={onToggleDemo} style={{ background: demoMode ? "rgba(167,139,250,.25)" : "rgba(255,255,255,.08)", border: `1px solid ${demoMode ? "#a78bfa" : T.bord}`, borderRadius: 7, padding: "5px 7px", color: demoMode ? "#c4b5fd" : T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{"\u{1F9EA}"}</button>
            <button onClick={() => { setNKI(nexusKey); setShowNK(true); }} style={{ background: nexusKey ? "rgba(74,222,128,.15)" : "rgba(255,255,255,.08)", border: `1px solid ${nexusKey ? "#4ade80" : T.bord}`, borderRadius: 7, padding: "5px 8px", color: nexusKey ? "#4ade80" : T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{nexusKey ? "\u25CF" : "+"}</button>
          </div>
        </div>
      </div>

      {showNKModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%" }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Nexus API Key</div>
          <input value={nexusKeyInput} onChange={e => setNKI(e.target.value)} placeholder="Paste Nexus API key" style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowNK(false)} style={{ flex: 1, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={async () => { await ss(SK.nexus, nexusKeyInput); setNexusKey(nexusKeyInput); setShowNK(false); }} style={{ flex: 2, background: T.purD, color: "white", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save</button>
          </div>
        </div>
      </div>}

      {demoMode && <div style={{ background: "linear-gradient(90deg,#1e0a3c,#2d1b69)", padding: "7px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>{"\u{1F9EA}"}</span>
          <span style={{ fontWeight: 700, fontSize: 11, color: "white" }}>COMP SIMULATION</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>emails suppressed</span>
          <button onClick={onToggleDemo} style={{ marginLeft: "auto", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "white", cursor: "pointer" }}>Exit</button>
        </div>
        <DemoSpeedControl />
      </div>}

      <AnnouncementBanner />

      <div style={{ display: "flex", background: "white", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, zIndex: 50, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, border: "none", background: "none", padding: "9px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer", color: tab === t.id ? T.pur : "#64748b", borderBottom: tab === t.id ? `2px solid ${T.pur}` : "2px solid transparent", marginBottom: -2, whiteSpace: "nowrap", minWidth: 60 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "checklist" && <ChecklistTab div={div} nexusData={nexusData} tbaMatches={tbaMatches} autoMatch={autoMatch} demoMode={demoMode} />}
      {tab === "schedule" && <ScheduleTab nexusData={nexusData} tbaMatches={tbaMatches} onFetch={fetchAll} loading={loading} error={error} />}
      {tab === "archive" && <ArchiveTab div={div} demoMode={demoMode} />}
      {tab === "stream" && <LivestreamTab />}
      {tab === "info" && <InfoTab div={div} />}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 23: DIRECTOR APP                                                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

function DirectorApp({ onBack, onPinChange, demoMode, onToggleDemo }) {
  const [mode, setMode] = useState("dashboard");
  const [tab, setTab] = useState("monitor");
  const [archive, setArchive] = useState({ elec: [], mech: [], sw: [] });

  useEffect(() => {
    const loadArch = async () => {
      const [e, m, s] = await Promise.all([ls(SK.archElec), ls(SK.archMech), ls(SK.archSW)]);
      setArchive({ elec: asArray(e), mech: asArray(m), sw: asArray(s) });
    };
    loadArch();
    const t = setInterval(loadArch, 5000);
    return () => clearInterval(t);
  }, []);

  if (mode.startsWith("lead-")) {
    const leadDiv = mode.replace("lead-", "");
    return <LeadApp div={leadDiv} onBack={() => setMode("dashboard")} demoMode={demoMode} onToggleDemo={onToggleDemo} />;
  }

  const DTABS = [
    { id: "monitor", label: "Monitor" },
    { id: "announce", label: "Announce" },
    { id: "checklist", label: "Checklist" },
    { id: "issues", label: "Issues" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", background: T.bg, minHeight: "100vh", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg,#1e0a3c,#2d1b69)", padding: "14px 14px 12px", boxShadow: "0 4px 20px rgba(80,0,180,.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.1)", border: `1px solid ${T.bord}`, borderRadius: 8, padding: "5px 8px", color: T.textD, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>&larr; Home</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Director Dashboard</div>
            <SyncStatus />
          </div>
          <button onClick={onBack} style={{ background: "rgba(248,113,113,.15)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 8, padding: "5px 10px", color: T.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Lock</button>
        </div>
      </div>

      <div style={{ background: T.card2, borderBottom: `1px solid ${T.bord}`, padding: "10px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.textD, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>View as Lead</div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.values(DIVS).map(d => (
            <button key={d.id} onClick={() => setMode(`lead-${d.id}`)}
              style={{ flex: 1, background: `${d.color}18`, border: `1px solid ${d.color}50`, borderRadius: 8, padding: "7px 4px", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 16 }}>{d.emoji}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: d.color, marginTop: 2 }}>{d.label}</div>
            </button>
          ))}
        </div>
      </div>

      {demoMode && <div style={{ background: "rgba(167,139,250,.1)", padding: "6px 14px", display: "flex", flexDirection: "column", gap: 5, borderBottom: `1px solid ${T.bord}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11 }}>{"\u{1F9EA}"}</span>
          <span style={{ fontSize: 11, color: T.purL, fontWeight: 600 }}>Comp Simulation Active</span>
          <button onClick={onToggleDemo} style={{ marginLeft: "auto", background: "rgba(255,255,255,.1)", border: `1px solid ${T.bord}`, borderRadius: 5, padding: "2px 7px", fontSize: 10, color: T.textM, cursor: "pointer" }}>Exit</button>
        </div>
        <DemoSpeedControl />
      </div>}

      <div style={{ display: "flex", background: "rgba(255,255,255,.03)", borderBottom: `1px solid ${T.bord}` }}>
        {DTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, border: "none", background: "none", padding: "10px 2px", fontSize: 10, fontWeight: 700, cursor: "pointer", color: tab === t.id ? T.purL : T.textD, borderBottom: tab === t.id ? `2px solid ${T.pur}` : "2px solid transparent", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "monitor" && <DirectorMonitor archive={archive} />}
      {tab === "announce" && <DirectorAnnouncements />}
      {tab === "checklist" && <DirectorChecklistManager />}
      {tab === "issues" && <DirectorIssues />}
      {tab === "settings" && <DirectorSettings onLock={onBack} onPinChange={onPinChange} />}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 24: ROOT APP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export default function App() {
  const [screen, setScreen] = useState("home");
  const [division, setDivision] = useState(null);
  const [activePin, setActivePin] = useState(CONFIG.defaultPin);
  const [demoMode, setDemoMode] = useState(false);
  const [archive, setArchive] = useState({ elec: [], mech: [], sw: [] });

  useEffect(() => { ls(SK.dirPin).then(p => { if (p) setActivePin(p); }); }, []);

  useEffect(() => {
    const loadArch = async () => {
      const [e, m, s] = await Promise.all([ls(SK.archElec), ls(SK.archMech), ls(SK.archSW)]);
      setArchive({ elec: asArray(e), mech: asArray(m), sw: asArray(s) });
    };
    loadArch();
    const t = setInterval(loadArch, 10000);
    return () => clearInterval(t);
  }, []);

  const toggleDemo = () => setDemoMode(d => {
    if (!d) resetDemoAnchor(); // reset sim clock when entering demo mode
    return !d;
  });

  return (
    <ErrorBoundary>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {screen === "home" && (
          <HomePage
            onLeadMode={() => setScreen("division-pick")}
            onDirectorMode={() => setScreen("pin")}
            archive={archive}
          />
        )}
        {screen === "division-pick" && (
          <DivisionPicker
            onPick={div => { setDivision(div); setScreen("lead"); }}
            onBack={() => setScreen("home")}
          />
        )}
        {screen === "lead" && division && (
          <LeadApp
            div={division}
            onBack={() => setScreen("division-pick")}
            demoMode={demoMode}
            onToggleDemo={toggleDemo}
          />
        )}
        {screen === "pin" && (
          <PinScreen
            activePin={activePin}
            onUnlock={() => setScreen("director")}
            onBack={() => setScreen("home")}
          />
        )}
        {screen === "director" && (
          <DirectorApp
            onBack={() => setScreen("home")}
            onPinChange={p => setActivePin(p)}
            activePin={activePin}
            demoMode={demoMode}
            onToggleDemo={toggleDemo}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
