import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const TEAM_NUM="115",TEAM_KEY="frc115",EVENT_KEY="2026caoec",NEXUS_EVENT="2026caoec";
const DEMO_TBA_EVENT="2025capin",DEMO_TBA_TEAM="frc115";
const TBA_KEY="CeAknKFak2QzpNHDnlx5k7l28hIqe6JwLywSYXtAMPiNPnyxHMyf7awc5Qowl5Z0";
const EJS_SERVICE="service_4ssfaza",EJS_TEMPLATE="template_xxoll7o",EJS_PUBKEY="OkpYMX237horE3-2j";
const NOTIFY_EMAIL="sreevatsa.pervela@gmail.com";
const NEXUS_KEY_STORE="frc115_nexus_key_v1";
const STORAGE_KEY="frc115_checklist_v5";
const ARCHIVE_KEY="frc115_archive_v5";
const DEMO_ARCHIVE_KEY="frc115_archive_demo_v5";
const ANNOUNCE_KEY="frc115_announce_v1";
const ISSUES_KEY="frc115_issues_v1";
const DIR_PIN_KEY="frc115_dir_pin_v1";
const DEFAULT_PIN="3721";
const HARDCODED_NEXUS_KEY="rVnKYGMmwYp7N-GlkYvywj0_iPs";

const PC={
  CRITICAL:{label:"CRITICAL",bg:"#fee2e2",text:"#991b1b",dot:"#dc2626"},
  HIGH:{label:"HIGH",bg:"#ffedd5",text:"#9a3412",dot:"#ea580c"},
  MEDIUM:{label:"MEDIUM",bg:"#fefce8",text:"#854d0e",dot:"#ca8a04"},
  SECONDARY:{label:"SECONDARY",bg:"#f0fdf4",text:"#166534",dot:"#16a34a"},
};

const SECTIONS=[
  {id:"power",title:"⚡ Power & Battery",color:"#b91c1c",bg:"#fef2f2",items:[
    {id:"p1",priority:"CRITICAL",text:"Battery fully charged (≥ 120%)",note:"Use Battery Beak — check if > 120%, ideally 130%"},
    {id:"p2",priority:"CRITICAL",text:"Anderson PowerPole battery connector fully seated & locked",note:"Tug test — zero give allowed"},
    {id:"p3",priority:"CRITICAL",text:"120A main breaker ON and reset (button fully out)",note:"Press down to reset if tripped"},
    {id:"p4",priority:"CRITICAL",text:"Circuit breaker tight — no loose nuts or corrosion",note:"Corrosion causes voltage drop mid-match"},
    {id:"p5",priority:"CRITICAL",text:"Battery secured in mount",note:"Must not move under hard acceleration"},
    {id:"p6",priority:"CRITICAL",text:"Main power leads (red/black) have no exposed copper",note:"Inspect ferrule crimp ends and full wire run"},
    {id:"p7",priority:"HIGH",text:"REV PDH 2.0 (main) mounted firmly — no flex or wobble",note:"Main PDH handles CAN termination and carries the voltage display — a loose mount can cause CAN faults"},
    {id:"p8",priority:"HIGH",text:"REV PDH 2.0 voltage display reading 12.0–13.0V",note:"This is the only PDH with the display — blue digits should be stable and visible"},
    {id:"p9",priority:"HIGH",text:"All REV PDH 2.0 breaker slots occupied or blanked — none open",note:"Open ports = short circuit risk; check after every match"},
    {id:"p10",priority:"HIGH",text:"REV PDH 2.0 ferrule crimp power input fully seated — tug tested",note:"Partial insertion on the main PDH input = full power loss; always tug test"},
    {id:"p11",priority:"HIGH",text:"Mini PDH #1 mounted firmly and power input ferrule crimps fully seated",note:"Mini PDHs have no display — check mounting and both power input crimps physically"},
    {id:"p12",priority:"HIGH",text:"Mini PDH #2 mounted firmly and power input ferrule crimps fully seated",note:"Same check as Mini PDH #1 — tug both input leads"},
    {id:"p13",priority:"MEDIUM",text:"All three PDH breaker ratings match their assigned device current requirements",note:"Verify no breakers were swapped between matches on any of the three PDHs"},
  ]},
  {id:"roborio",title:"🖥️ RoboRIO 2.0 & Radio",color:"#1d4ed8",bg:"#eff6ff",items:[
    {id:"r1",priority:"CRITICAL",text:"RoboRIO STATUS light solid green, COMM light green",note:"Solid red/orange = fault; investigate before queue"},
    {id:"r2",priority:"CRITICAL",text:"RSL connected and blinking orange",note:"Required by rules — solid = disabled, blinking = enabled"},
    {id:"r3",priority:"CRITICAL",text:"Radio powered — COMM LED green",note:"Confirm correct team number config"},
    {id:"r4",priority:"CRITICAL",text:"Ethernet cable RoboRIO ↔ radio fully seated on both ends",note:"Click-lock test; half-seated RJ45 = no comms"},
    {id:"r5",priority:"HIGH",text:"RoboRIO power ferrule crimps fully seated in terminal block — no pull-out",note:"Tug test both 12V and ground leads; a loose ferrule here browns out the entire RIO"},
    {id:"r6",priority:"HIGH",text:"Radio power cable firmly connected — not pulled during transport",note:"Common transport damage point"},
    {id:"r7",priority:"HIGH",text:"CANivore USB cable to RoboRIO strain-relieved and seated",note:"This is the entire drivetrain CAN backbone"},
    {id:"r8",priority:"MEDIUM",text:"RoboRIO mounting screws tight — no vibration movement",note:"Loose RIO can cause intermittent ground faults"},
  ]},
  {id:"can",title:"🔌 CANivore & CAN Bus",color:"#15803d",bg:"#f0fdf4",items:[
    {id:"c1",priority:"CRITICAL",text:"Standalone 120Ω termination resistor seated and locked at the open end of the CAN chain",note:"This is the first terminator — verify it hasn't vibrated loose between matches; tug test the JST"},
    {id:"c2",priority:"CRITICAL",text:"CAN chain end at REV PDH is fully plugged in — REV PDH provides built-in 120Ω termination",note:"Main REV PDH 2.0 terminates this end — the two Mini PDHs do NOT have CAN ports; half-seated = missing termination"},
    {id:"c3",priority:"CRITICAL",text:"No CAN wire pinched in cross rails, under frame, or in any pivot/rotation zone",note:"Walk every cross rail channel and trace the full CAN run"},
    {id:"c4",priority:"CRITICAL",text:"CAN connector on Kraken X60 #1 (FL drive) fully seated — JST tug tested",note:"One loose CAN joint drops all devices downstream of it"},
    {id:"c5",priority:"CRITICAL",text:"CAN connector on Kraken X60 #2 (FR drive) fully seated — JST tug tested",note:"Check both the in and out ports if daisy-chained"},
    {id:"c6",priority:"CRITICAL",text:"CAN connector on Kraken X60 #3 (BL drive) fully seated — JST tug tested",note:"Check both the in and out ports if daisy-chained"},
    {id:"c7",priority:"CRITICAL",text:"CAN connector on Kraken X60 #4 (BR drive) fully seated — JST tug tested",note:"Check both the in and out ports if daisy-chained"},
    {id:"c8",priority:"CRITICAL",text:"CAN connector on Falcon 500 #1 (FL turn) fully seated — JST tug tested",note:"Falcon CAN connectors loosen under vibration — always tug test"},
    {id:"c9",priority:"CRITICAL",text:"CAN connector on Falcon 500 #2 (FR turn) fully seated — JST tug tested",note:"Falcon CAN connectors loosen under vibration — always tug test"},
    {id:"c10",priority:"CRITICAL",text:"CAN connector on Falcon 500 #3 (BL turn) fully seated — JST tug tested",note:"Falcon CAN connectors loosen under vibration — always tug test"},
    {id:"c11",priority:"CRITICAL",text:"CAN connector on Falcon 500 #4 (BR turn) fully seated — JST tug tested",note:"Falcon CAN connectors loosen under vibration — always tug test"},
    {id:"c12",priority:"CRITICAL",text:"CAN connector on CANcoder #1 (FL steer) fully seated",note:"Lost CANcoder = wrong wheel angle = dangerous enable"},
    {id:"c13",priority:"CRITICAL",text:"CAN connector on CANcoder #2 (FR steer) fully seated",note:"Lost CANcoder = wrong wheel angle = dangerous enable"},
    {id:"c14",priority:"CRITICAL",text:"CAN connector on CANcoder #3 (BL steer) fully seated",note:"Lost CANcoder = wrong wheel angle = dangerous enable"},
    {id:"c15",priority:"CRITICAL",text:"CAN connector on CANcoder #4 (BR steer) fully seated",note:"Lost CANcoder = wrong wheel angle = dangerous enable"},
    {id:"c16",priority:"CRITICAL",text:"CAN connector on Pigeon 2.0 fully seated — JST tug tested",note:"Lost Pigeon = no field-centric drive; robot will spin unpredictably"},
    {id:"c17",priority:"HIGH",text:"Kraken X60 #1 LED — solid orange (idle) or expected state, no fault blink",note:"Rapid red/orange blink = fault; check Phoenix Tuner X"},
    {id:"c18",priority:"HIGH",text:"Kraken X60 #2 LED — solid orange (idle) or expected state, no fault blink",note:"Rapid red/orange blink = fault; check Phoenix Tuner X"},
    {id:"c19",priority:"HIGH",text:"Kraken X60 #3 LED — solid orange (idle) or expected state, no fault blink",note:"Rapid red/orange blink = fault; check Phoenix Tuner X"},
    {id:"c20",priority:"HIGH",text:"Kraken X60 #4 LED — solid orange (idle) or expected state, no fault blink",note:"Rapid red/orange blink = fault; check Phoenix Tuner X"},
    {id:"c21",priority:"HIGH",text:"Falcon 500 #1 LED — no fault blink pattern",note:"Any abnormal blink = fault code; read it in Tuner X before queuing"},
    {id:"c22",priority:"HIGH",text:"Falcon 500 #2 LED — no fault blink pattern",note:"Any abnormal blink = fault code; read it in Tuner X before queuing"},
    {id:"c23",priority:"HIGH",text:"Falcon 500 #3 LED — no fault blink pattern",note:"Any abnormal blink = fault code; read it in Tuner X before queuing"},
    {id:"c24",priority:"HIGH",text:"Falcon 500 #4 LED — no fault blink pattern",note:"Any abnormal blink = fault code; read it in Tuner X before queuing"},
    {id:"c25",priority:"HIGH",text:"CANcoder #1 LED — solid or slow blink (healthy), no fast fault blink",note:"Fast blink or off = lost CAN; re-seat JST on that module"},
    {id:"c26",priority:"HIGH",text:"CANcoder #2 LED — solid or slow blink (healthy), no fast fault blink",note:"Fast blink or off = lost CAN; re-seat JST on that module"},
    {id:"c27",priority:"HIGH",text:"CANcoder #3 LED — solid or slow blink (healthy), no fast fault blink",note:"Fast blink or off = lost CAN; re-seat JST on that module"},
    {id:"c28",priority:"HIGH",text:"CANcoder #4 LED — solid or slow blink (healthy), no fast fault blink",note:"Fast blink or off = lost CAN; re-seat JST on that module"},
    {id:"c29",priority:"HIGH",text:"Pigeon 2.0 LED — boot-complete pattern after power-on (slow blink or solid)",note:"Solid red or rapid blink during operation = IMU fault; check CAN and firmware"},
    {id:"c30",priority:"HIGH",text:"CANivore LED — solid green after boot, no red or off state",note:"No light or red = USB/power issue; re-seat USB to RoboRIO"},
    {id:"c31",priority:"HIGH",text:"All CAN device IDs unique — no conflicts in Phoenix Tuner X",note:"Duplicate IDs cause unpredictable behavior; verify before first match of the day"},
    {id:"c32",priority:"HIGH",text:"CANivore firmware up to date (check Phoenix Tuner X)",note:"Outdated firmware can cause bus dropouts under heavy load"},
    {id:"c33",priority:"HIGH",text:"All CAN devices visible in Phoenix Tuner X with no active faults",note:"Any red entry = do not queue; resolve fault first"},
    {id:"c34",priority:"MEDIUM",text:"CAN bus utilization below 90% (check Tuner X or Driver Station)",note:"High utilization causes delayed or dropped motor commands mid-match"},
  ]},
  {id:"swerve",title:"🌀 Swerve Drive Modules (×4)",color:"#7e22ce",bg:"#faf5ff",items:[
    {id:"s1",priority:"CRITICAL",text:"All 4 Kraken X60 (drive) power connectors fully seated — tug tested",note:"Check ferrule ends at whichever PDH (main or Mini) feeds that Kraken, and at the motor itself"},
    {id:"s2",priority:"CRITICAL",text:"All 4 Falcon 500 (turn) power connectors fully seated — tug tested",note:"Falcon connectors loosen under vibration"},
    {id:"s3",priority:"CRITICAL",text:"All 4 CANcoder connectors secure on steer modules",note:"Loose CANcoder = incorrect wheel angle = robot veers on enable"},
    {id:"s4",priority:"CRITICAL",text:"All 4 CANcoder absolute position readings correct before enabling",note:"Verify in Tuner X or Shuffleboard — bad offsets = unsafe enable"},
    {id:"s5",priority:"CRITICAL",text:"No motor power wires in swerve rotation path — free flex through full steer range",note:"Manually rotate each module and watch wires"},
    {id:"s6",priority:"HIGH",text:"All 4 Kraken X60 LEDs show no fault pattern (no rapid red blink)",note:"Check Phoenix Tuner X for active faults"},
    {id:"s7",priority:"HIGH",text:"All 4 Falcon 500 LEDs show no fault pattern",note:"Phoenix Tuner X shows per-device faults"},
    {id:"s8",priority:"HIGH",text:"Spin each Kraken and Falcon by hand — no grinding or resistance",note:"Mechanical binding shows up as electrical overcurrent in-match"},
    {id:"s9",priority:"MEDIUM",text:"Swerve module mounting bolts tight — no play in module pods",note:"Loose modules cause steering angle drift"},
    {id:"s10",priority:"MEDIUM",text:"Krakens and Falcons cool to touch before first match",note:"Too hot to hold = thermal issue, check airflow"},
  ]},
  {id:"pigeon",title:"📡 Pigeon 2.0 IMU",color:"#0f766e",bg:"#f0fdfa",items:[
    {id:"g1",priority:"CRITICAL",text:"Pigeon 2.0 rigidly mounted — zero looseness in bracket",note:"IMU movement corrupts heading; critical for field-centric drive"},
    {id:"g2",priority:"CRITICAL",text:"Pigeon CAN and power connections fully seated — tug tested",note:"JST connector; gentle pull test"},
    {id:"g3",priority:"HIGH",text:"Pigeon heading reads 0° (or expected angle) after yaw reset",note:"Reset heading before each match"},
    {id:"g4",priority:"MEDIUM",text:"Pigeon firmware current (check Phoenix Tuner X)",note:"Firmware mismatch can cause unexpected CAN errors"},
  ]},
  {id:"limelight",title:"📷 Limelight",color:"#166534",bg:"#f0fdf4",items:[
    {id:"l1",priority:"CRITICAL",text:"Limelight power cable fully seated — LED ring on at boot",note:"Check green status LED on Limelight body"},
    {id:"l2",priority:"CRITICAL",text:"Limelight Ethernet cable fully clicked in to network switch",note:"Required for vision pipeline data"},
    {id:"l3",priority:"HIGH",text:"Limelight mounting rigid — bracket bolts tight",note:"Camera angle shift corrupts vision targeting"},
    {id:"l4",priority:"HIGH",text:"Limelight reachable on network (ping limelight.local from DS)",note:"No network = no auto vision"},
    {id:"l5",priority:"MEDIUM",text:"Correct pipeline selected for current game mode",note:"Wrong pipeline = bad targeting"},
    {id:"l6",priority:"MEDIUM",text:"Camera lens clean — no smudges or debris",note:"Quick microfiber wipe before queue"},
  ]},
  {id:"connections",title:"🔗 Connection Integrity Check",color:"#92400e",bg:"#fffbeb",items:[
    {id:"cn1",priority:"CRITICAL",text:"Tug test ALL PowerPole connectors — none pull loose",note:"Battery connector, main REV PDH 2.0 input, both Mini PDH inputs, and all branch connectors — tug every single one"},
    {id:"cn2",priority:"CRITICAL",text:"Tug test ALL ferrule crimp ends — none pull out of terminals",note:"Any movement = re-crimp before queuing"},
    {id:"cn3",priority:"CRITICAL",text:"All PWM signal connectors fully seated with retention clip engaged",note:"Partial PWM insertion = no signal to that controller"},
    {id:"cn4",priority:"CRITICAL",text:"No blackened, burned, or melted connectors anywhere on the robot",note:"Discoloration = arcing; find and fix root cause"},
    {id:"cn5",priority:"HIGH",text:"All Wago lever connectors fully closed — no wires backing out",note:"Lift-lever style; check lever is fully down"},
    {id:"cn6",priority:"HIGH",text:"All RJ45 Ethernet connectors click-lock tested",note:"RoboRIO, radio, Limelight"},
    {id:"cn7",priority:"HIGH",text:"No exposed bare wire strands outside of connectors",note:"Stray strands across terminals = short circuit"},
    {id:"cn8",priority:"MEDIUM",text:"Ferrule crimp ends show no green corrosion or blackening",note:"Discoloration = heat damage or poor connection"},
  ]},
  {id:"motors",title:"⚙️ Motor & Component Function Check",color:"#be185d",bg:"#fdf2f8",items:[
    {id:"m1",priority:"CRITICAL",text:"Enable robot in DS — all 4 swerve modules respond to joystick input",note:"Each wheel should steer and drive correctly"},
    {id:"m2",priority:"CRITICAL",text:"All 4 Kraken X60 drive motors spin in correct direction",note:"Verify in Phoenix Tuner X output test if unsure"},
    {id:"m3",priority:"CRITICAL",text:"All 4 Falcon 500 steer motors respond and hold wheel angle",note:"Wheel should resist manual rotation when enabled"},
    {id:"m4",priority:"CRITICAL",text:"No motor throws a fault or brownout on enable",note:"DS fault light or Tuner X red entries = do not queue"},
    {id:"m5",priority:"HIGH",text:"All mechanism motors (non-drivetrain) respond to test commands",note:"Run each subsystem through full range in pits"},
    {id:"m6",priority:"HIGH",text:"No unusual sounds (grinding, clicking, buzzing) from any motor",note:"Listen during pit enable — abnormal sound = fault"},
    {id:"m7",priority:"HIGH",text:"No motor controllers show fault LEDs after enable",note:"Orange/red blinking = fault code; check Tuner X"},
    {id:"m8",priority:"HIGH",text:"Pigeon heading updates correctly during drivetrain movement",note:"Should change smoothly with robot rotation"},
    {id:"m9",priority:"MEDIUM",text:"Limelight returns valid target data in DS/Shuffleboard",note:"Check vision feed is live and not frozen"},
    {id:"m10",priority:"MEDIUM",text:"Battery voltage stays above 11.0V during full drivetrain enable",note:"Voltage sag below 10.5V = brownout risk mid-match"},
  ]},
  {id:"wiremgmt",title:"🔒 Wire Management",color:"#374151",bg:"#f9fafb",items:[
    {id:"w1",priority:"CRITICAL",text:"No wires routed near spinning mechanisms, belts, pulleys, or chain",note:"Walk every drivetrain and mechanism and trace each wire run"},
    {id:"w2",priority:"CRITICAL",text:"All corrugated conduit exits capped or taped — no wire exposed at exits",note:"Conduit exits are highest-wear points"},
    {id:"w3",priority:"CRITICAL",text:"All 3D printed cross rail snap-in clips are fully snapped in — none popped out or cracked",note:"Check every clip along every cross rail; a popped clip lets wires drop into moving parts"},
    {id:"w4",priority:"CRITICAL",text:"All wires seated flush inside cross rail channels — none riding above the channel edge",note:"Wire above the channel edge can catch on mechanisms; press down until flush"},
    {id:"w5",priority:"HIGH",text:"Inspect all 3D printed clips for cracks or broken tabs — replace any damaged clips before match",note:"Smooth-edge clips protect wire insulation; cracked tabs can rotate and create sharp points"},
    {id:"w6",priority:"HIGH",text:"All zip ties tight and trimmed — no sharp protruding tails",note:"Protruding tails snag adjacent wires under vibration"},
    {id:"w7",priority:"HIGH",text:"All retention clips seated — none missing or cracked",note:"Check after every match; impacts knock clips loose"},
    {id:"w8",priority:"HIGH",text:"No wire under tension — all runs have adequate service loop",note:"Tight wire = broken ferrule after first field collision"},
    {id:"w9",priority:"HIGH",text:"Cable covers intact — none cracked, pulled back, or missing",note:"Especially check covers over the main REV PDH 2.0 power input region and both Mini PDH mounts"},
    {id:"w10",priority:"MEDIUM",text:"All wire labels legible — re-label any worn or missing",note:"Speeds up in-match diagnosis significantly"},
    {id:"w11",priority:"SECONDARY",text:"Visual sweep for new wire chafe from last match",note:"Run fingers lightly along cross rail channels; feel for insulation damage"},
    {id:"w12",priority:"SECONDARY",text:"No loose screws/fasteners near electrical board",note:"Metal screw on live PDH = fuse trip or fire"},
  ]},
  {id:"signoff",title:"✅ Final Pre-Queue Sign-Off",color:"#1f2937",bg:"#f8fafc",items:[
    {id:"f1",priority:"CRITICAL",text:"Robot boots fully — RIO STATUS green, radio COMM green, RSL blinking",note:"All three must be correct — if not, do not queue"},
    {id:"f2",priority:"CRITICAL",text:"Driver Station shows robot enabled, all CAN devices visible, no faults",note:"Tuner X device list must be all green"},
    {id:"f3",priority:"HIGH",text:"Bumpers on or confirmed being installed at queue",note:"Bumpers must be on before entering the field — OK to install at queue line if not done in pit"},
    {id:"f4",priority:"HIGH",text:"Spare battery is on the charger for next match rotation",note:"Never queue without a charged spare ready"},
    {id:"f5",priority:"HIGH",text:"Electrical lead has verbally signed off on this checklist",note:"Two-person verification recommended"},
  ]},
];

const ALL_ITEMS=SECTIONS.flatMap(s=>s.items);
const ALL_IDS=ALL_ITEMS.map(i=>i.id);
const CRIT_ITEMS=ALL_ITEMS.filter(i=>i.priority==="CRITICAL");

// localStorage for persistence + BroadcastChannel for instant same-device tab sync
const _bc=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("frc115"):null;
const ls=async(k)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}};
const ss=async(k,v)=>{try{const s=JSON.stringify(v);localStorage.setItem(k,s);_bc&&_bc.postMessage({k,v:s});}catch{}};

async function sendEmail(mLabel,leadName,completed,total,quickMode){
  try{
    const r=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
      method:"POST",headers:{"Content-Type":"application/json","Origin":"https://claude.ai"},
      body:JSON.stringify({service_id:EJS_SERVICE,template_id:EJS_TEMPLATE,user_id:EJS_PUBKEY,accessToken:EJS_PUBKEY,
        template_params:{to_email:NOTIFY_EMAIL,team_number:"115",match_label:mLabel,
          lead_name:leadName||"Unknown",completed:String(completed),total:String(total),
          submitted_time:new Date().toLocaleTimeString(),event:"2026 OC District",
          method:quickMode?"Quick Complete":"Manual check-off"}})});
    if(!r.ok)console.warn("EmailJS error:",r.status);
    return r.ok;
  }catch(e){console.warn("EmailJS failed:",e);return false;}}

const fmtTime=ms=>!ms?"TBD":new Date(ms).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDate=ms=>!ms?"":new Date(ms).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"});
const fmtDT=ms=>!ms?"":new Date(ms).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtCD=ms=>{const s=Math.abs(ms)/1000,h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=Math.floor(s%60);
  return h>0?`${h}h ${String(m).padStart(2,"0")}m ${String(sc).padStart(2,"0")}s`:`${String(m).padStart(2,"0")}m ${String(sc).padStart(2,"0")}s`;};
const getTS=m=>m?.predicted_time||m?.time||null;

function useNow(intervalMs=1000){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),intervalMs);return()=>clearInterval(t);},[intervalMs]);
  return now;}

const mLbl=m=>{if(!m)return"";const l=m.comp_level==="qm"?"Q":m.comp_level==="sf"?"SF":"F";return`${l}${m.match_number}`;};
const getAlliance=(m,c)=>(m?.alliances?.[c]?.team_keys||[]).map(k=>k.replace("frc",""));

function parseNexusLabel(lbl=""){if(!lbl)return null;const l=lbl.toLowerCase();
  if(l.startsWith("qualification"))return{level:"qm",num:parseInt(l.replace(/\D/g,""))||0};
  if(l.startsWith("playoff"))return{level:"sf",num:parseInt(l.replace(/\D/g,""))||0};
  if(l.startsWith("final"))return{level:"f",num:parseInt(l.replace(/\D/g,""))||0};
  return null;}
const matchInputToLabel=p=>!p?"":p.level==="qm"?`Q${p.num}`:p.level==="sf"?`SF${p.num}`:`F${p.num}`;
function findNexusMatch(nx=[],parsed){if(!parsed)return null;
  return nx.find(m=>{const p=parseNexusLabel(m.label);return p&&p.level===parsed.level&&p.num===parsed.num;})||null;}
function findQueueTrigger(nx=[],ourM){if(!ourM)return null;
  const idx=nx.findIndex(m=>m.label===ourM.label);if(idx<0)return null;
  const ti=Math.max(0,idx-2);return nx[ti]!==ourM?nx[ti]:null;}
function bestMatchTime(nxM,tbaM){
  if(nxM?.times?.estimatedStartTime)return nxM.times.estimatedStartTime;
  const t=getTS(tbaM);return t?t*1000:null;}
function bestQueueTime(trigNx,ourMs){
  if(trigNx?.times?.estimatedStartTime)return trigNx.times.estimatedStartTime;
  return ourMs?ourMs-10*60*1000:null;}
function getAlliances(nxM,tbaM){
  const red=nxM?(nxM.redTeams||[]):(tbaM?getAlliance(tbaM,"red"):[]);
  const blue=nxM?(nxM.blueTeams||[]):(tbaM?getAlliance(tbaM,"blue"):[]);
  const mc=red.includes(TEAM_NUM)?"red":"blue";
  return{myColor:mc,partners:(mc==="red"?red:blue).filter(t=>t!==TEAM_NUM),opponents:mc==="red"?blue:red};}
function nexusSS(status){if(!status)return null;const s=status.toLowerCase();
  if(s.includes("queuing"))return{bg:"#fef9c3",text:"#854d0e",label:status};
  if(s.includes("deck"))return{bg:"#ffedd5",text:"#9a3412",label:status};
  if(s.includes("field"))return{bg:"#fee2e2",text:"#991b1b",label:status};
  if(s.includes("complete"))return{bg:"#f1f5f9",text:"#64748b",label:status};
  return{bg:"#eff6ff",text:"#1d4ed8",label:status};}

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
      times:{estimatedQueueTime:qAt,estimatedOnDeckTime:odAt,estimatedOnFieldTime:ofAt,estimatedStartTime:startMs}};
  });
  const qm=matches.find(m=>m.status==="Now Queuing");
  return{eventKey:"demo",dataAsOfTime:now,nowQueuing:qm?.label||null,matches,announcements:[],partsRequests:[]};}

function Badge({p}){const c=PC[p]||PC.SECONDARY;
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:c.bg,color:c.text,whiteSpace:"nowrap"}}>{c.label}</span>;}

function CheckItem({item,done,onToggle}){
  return(<div onClick={()=>onToggle(item.id)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f1f5f9",background:done?"#f0fdf4":"white",transition:"background .15s"}}>
    <div style={{width:20,height:20,borderRadius:4,flexShrink:0,marginTop:1,border:`2px solid ${done?"#16a34a":"#cbd5e1"}`,background:done?"#16a34a":"white",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
      {done&&<span style={{color:"white",fontSize:12,fontWeight:700}}>✓</span>}
    </div>
    <div style={{flexShrink:0,marginTop:2}}><Badge p={item.priority}/></div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:done?400:600,color:done?"#6b7280":"#1e293b",textDecoration:done?"line-through":"none",lineHeight:1.4}}>{item.text}</div>
      {item.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>➤ {item.note}</div>}
    </div>
  </div>);}

function Section({section,checked,onToggle}){
  const [open,setOpen]=useState(true);
  const done=section.items.filter(i=>checked[i.id]).length,allDone=done===section.items.length;
  return(<div style={{borderRadius:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.08)",border:`1px solid ${allDone?"#bbf7d0":"#e2e8f0"}`,marginBottom:10}}>
    <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:allDone?"#f0fdf4":section.bg,border:"none",cursor:"pointer",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
      <div style={{width:3,height:32,borderRadius:2,background:section.color,flexShrink:0}}/>
      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:section.color}}>{section.title}</div><div style={{fontSize:11,color:"#64748b"}}>{done}/{section.items.length} complete</div></div>
      <div style={{width:60,background:"#e2e8f0",borderRadius:99,height:5,overflow:"hidden"}}><div style={{width:`${Math.round(done/section.items.length*100)}%`,height:"100%",background:allDone?"#16a34a":section.color,borderRadius:99,transition:"width .3s"}}/></div>
      {allDone&&<span style={{fontSize:16}}>✅</span>}
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
  const matchTimeMs=bestMatchTime(nxM,tbaM);
  const trigNx=nxM?findQueueTrigger(nexusData?.matches||[],nxM):null;
  const qMs=bestQueueTime(trigNx,matchTimeMs);
  const diffMs=qMs?qMs-now:null;
  const passed=diffMs!==null&&diffMs<0;
  const urgent=diffMs!==null&&diffMs>=0&&diffMs<90000;
  const al=getAlliances(nxM,tbaM);
  const ss2=nexusSS(nxM?.status);
  const myWP=sb?.pred?.red_win_prob!=null?(al?.myColor==="red"?sb.pred.red_win_prob:1-sb.pred.red_win_prob):null;
  const redEPA=sb?.epa?.red_score_mean,blueEPA=sb?.epa?.blue_score_mean;
  const label=nxM?.label||matchInputToLabel(parsed);
  return(
    <div style={{margin:"8px 14px 0",borderRadius:12,overflow:"hidden",border:`2px solid ${urgent||passed?"#fca5a5":"#e2e8f0"}`,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
      <div style={{background:urgent||passed?"#fef2f2":"#0f172a",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontWeight:800,fontSize:18,color:urgent||passed?"#dc2626":"white"}}>{label}</span>
            {ss2&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
          </div>
          {matchTimeMs&&<div style={{fontSize:11,color:urgent||passed?"#64748b":"#94a3b8",marginTop:1}}>{fmtDate(matchTimeMs)} · {fmtTime(matchTimeMs)}</div>}
          {qMs&&<div style={{fontSize:10,color:urgent||passed?"#dc2626":"#6b7280",marginTop:2}}>{trigNx?`Queue at start of ${trigNx.label} — ${fmtTime(qMs)}`:`Queue at ${fmtTime(qMs)} (10-min fallback)`}</div>}
        </div>
        {diffMs!==null&&!passed&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:9,fontWeight:600,color:urgent?"#dc2626":"#94a3b8",textTransform:"uppercase",letterSpacing:.5}}>queue in</div><div style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:urgent?"#dc2626":"white"}}>{fmtCD(diffMs)}</div></div>}
        {passed&&<div style={{background:"#dc2626",color:"white",padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:800,flexShrink:0}}>🚨 QUEUE!</div>}
      </div>
      <div style={{background:"rgba(255,255,255,.04)",padding:"10px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
        {al&&(<>
          <div style={{flex:1,minWidth:90,background:al.myColor==="red"?"#fef2f2":"#eff6ff",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(0,0,0,.08)"}}>
            <div style={{fontSize:9,fontWeight:700,color:al.myColor==="red"?"#991b1b":"#1d4ed8",marginBottom:4,textTransform:"uppercase"}}>Partners ({al.myColor})</div>
            {al.partners.map(t=><div key={t} style={{fontSize:12,fontWeight:700,color:al.myColor==="red"?"#dc2626":"#2563eb"}}>#{t}</div>)}
          </div>
          <div style={{flex:1,minWidth:90,background:"rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#94a3b8",marginBottom:4,textTransform:"uppercase"}}>Opponents</div>
            {al.opponents.map(t=><div key={t} style={{fontSize:12,fontWeight:600,color:"#d1d5db"}}>#{t}</div>)}
          </div>
        </>)}
        {(sb||myWP!=null)&&(
          <div style={{flex:2,minWidth:130,background:"#faf5ff",borderRadius:8,padding:"8px 10px",border:"1px solid #e9d5ff"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#7e22ce",marginBottom:6,textTransform:"uppercase"}}>Statbotics</div>
            {myWP!=null&&(<div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,fontWeight:700,color:myWP>=.5?"#16a34a":"#dc2626"}}>Us {Math.round(myWP*100)}%</span>
                <span style={{fontSize:10,color:"#94a3b8"}}>Them {Math.round((1-myWP)*100)}%</span>
              </div>
              <div style={{background:"#e2e8f0",borderRadius:99,height:7,overflow:"hidden"}}>
                <div style={{width:`${myWP*100}%`,height:"100%",background:myWP>=.5?"#16a34a":"#dc2626",borderRadius:99}}/>
              </div>
            </div>)}
            {(redEPA!=null||blueEPA!=null)&&<div style={{display:"flex",gap:5}}>
              {[{lbl:"Red",val:redEPA,col:"#dc2626",bg:"#fee2e2"},{lbl:"Blue",val:blueEPA,col:"#2563eb",bg:"#eff6ff"}].map(({lbl,val,col,bg})=>(
                <div key={lbl} style={{flex:1,background:bg,borderRadius:6,padding:"4px 6px",textAlign:"center"}}>
                  <div style={{fontSize:9,fontWeight:600,color:col}}>{lbl}</div>
                  <div style={{fontSize:14,fontWeight:800,color:col}}>{val!=null?Math.round(val):"-"}</div>
                  <div style={{fontSize:8,color:"#94a3b8"}}>pred pts</div>
                </div>
              ))}
            </div>}
          </div>
        )}
      </div>
    </div>
  );}

function ArchiveTab({demoMode}){
  const [archive,setArchive]=useState([]);const [sel,setSel]=useState(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{const k=demoMode?DEMO_ARCHIVE_KEY:ARCHIVE_KEY;ls(k).then(d=>{setArchive(d||[]);setLoading(false);});},[demoMode]);
  if(loading)return <div style={{padding:32,textAlign:"center",color:"#64748b"}}>Loading…</div>;
  if(!archive.length)return(<div style={{padding:40,textAlign:"center"}}><div style={{fontSize:48,marginBottom:10}}>📭</div><div style={{fontWeight:700,fontSize:15,color:"#374151"}}>No submissions yet</div><div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Submitted checklists appear here after each match</div></div>);
  if(sel!==null){
    const e=archive[sel];const ds=new Set(e.checkedIds||[]);
    return(<div style={{padding:14}}>
      <button onClick={()=>setSel(null)} style={{background:"none",border:"1px solid #cbd5e1",borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#374151",fontWeight:600,marginBottom:14}}>← Back to Archive</button>
      <div style={{background:"#0f172a",borderRadius:12,padding:16,color:"white",marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1,marginBottom:2}}>SUBMISSION RECORD</div>
        <div style={{fontSize:24,fontWeight:800}}>Match {e.matchNum||"?"}</div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>{fmtDT(e.submittedAt)} · Lead: {e.lead||"Unknown"}</div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          {[{val:e.completedCount,lbl:"CHECKED",col:"#4ade80"},{val:ALL_ITEMS.length-e.completedCount,lbl:"SKIPPED",col:"#f87171"},{val:e.markedAllComplete?"QUICK":"MANUAL",lbl:"METHOD",col:e.markedAllComplete?"#fb923c":"#60a5fa"}].map(({val,lbl,col})=>(
            <div key={lbl} style={{flex:1,background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:col}}>{val}</div><div style={{fontSize:10,color:"#94a3b8"}}>{lbl}</div></div>))}
        </div>
      </div>
      {SECTIONS.map(sec=>{const sd=sec.items.filter(i=>ds.has(i.id)).length,ad=sd===sec.items.length;
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
    <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>
      {archive.length} Submission{archive.length!==1?"s":""} {demoMode?"· Demo":"· 2026 OC District"}
    </div>
    {[...archive].reverse().map((e,ri)=>{
      const idx=archive.length-1-ri;
      const pct=Math.round(e.completedCount/ALL_ITEMS.length*100);
      const allCrit=CRIT_ITEMS.every(i=>(e.checkedIds||[]).includes(i.id));
      const ds=new Set(e.checkedIds||[]);
      return(<div key={idx} onClick={()=>setSel(idx)} style={{borderRadius:10,border:`1px solid ${allCrit?"#bbf7d0":"#fecaca"}`,background:"white",marginBottom:10,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,background:allCrit?"#f0fdf4":"#fef2f2"}}>
          <div style={{width:40,height:40,borderRadius:9,background:allCrit?"#dcfce7":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>{allCrit?"✅":"⚠️"}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Match {e.matchNum||"?"}</span>
              {e.markedAllComplete&&<span style={{fontSize:10,fontWeight:700,background:"#ffedd5",color:"#9a3412",padding:"1px 7px",borderRadius:99,border:"1px solid #fed7aa"}}>⚡ QUICK</span>}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginTop:1}}>{fmtDT(e.submittedAt)} · {e.lead||"Unknown"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:15,fontWeight:800,color:pct===100?"#16a34a":pct>80?"#ca8a04":"#dc2626"}}>{pct}%</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{e.completedCount}/{ALL_ITEMS.length}</div>
          </div>
          <span style={{color:"#94a3b8",fontSize:14,marginLeft:2}}>›</span>
        </div>
        <div style={{background:"#e2e8f0",height:4}}><div style={{width:`${pct}%`,height:"100%",background:pct===100?"#16a34a":pct>80?"#ca8a04":"#dc2626"}}/></div>
        <div style={{padding:"8px 14px",display:"flex",flexWrap:"wrap",gap:4}}>
          {SECTIONS.map(sec=>{const sd=sec.items.filter(i=>ds.has(i.id)).length,ok=sd===sec.items.length;
            return(<div key={sec.id} style={{display:"flex",alignItems:"center",gap:3,background:ok?"#f0fdf4":"#fef2f2",borderRadius:5,padding:"2px 6px",border:`1px solid ${ok?"#bbf7d0":"#fecaca"}`}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:sec.color}}/><span style={{fontSize:9,fontWeight:600,color:ok?"#166534":"#991b1b",whiteSpace:"nowrap"}}>{sec.title.replace(/^[^ ]+ /,"")} {sd}/{sec.items.length}</span>
            </div>);})}
        </div>
      </div>);})}
  </div>);}

function ScheduleTab({nexusData,tbaMatches,onFetch,loading,error}){
  const now=useNow();
  const alerted=useRef(new Set());
  const t115nx=(nexusData?.matches||[]).filter(m=>[...(m.redTeams||[]),...(m.blueTeams||[])].includes(TEAM_NUM));
  const t115tba=tbaMatches.filter(m=>[...(m.alliances?.red?.team_keys||[]),...(m.alliances?.blue?.team_keys||[])].includes(TEAM_KEY));
  const nextNx=t115nx.find(m=>{const ts=m.times?.estimatedStartTime;return ts&&ts>now-300000;});
  const nextTba=t115tba.find(m=>{const ts=getTS(m);return ts&&ts*1000>now-300000;});
  useEffect(()=>{t115nx.forEach(m=>{const qi=m.times?.estimatedQueueTime;if(!qi)return;const diff=qi-now;
    if(diff>0&&diff<30000&&!alerted.current.has(m.label)){alerted.current.add(m.label);
      if(Notification.permission==="granted")new Notification(`🤖 Team 115 — Queue for ${m.label}!`,{body:`Queue time reached!`});}});},[now,t115nx]);
  const renderHero=(nxM,tbaM)=>{
    if(!nxM&&!tbaM)return(<div style={{background:"#1e293b",borderRadius:12,padding:16,color:"#94a3b8",textAlign:"center",fontSize:13,marginBottom:14}}>{tbaMatches.length===0?"No schedule loaded — tap Fetch below":"No upcoming matches found"}</div>);
    const ts=bestMatchTime(nxM,tbaM);
    const trig=nxM?findQueueTrigger(nexusData?.matches||[],nxM):null;
    const qMs=bestQueueTime(trig,ts);const diffMs=qMs?qMs-now:null;
    const passed=diffMs!==null&&diffMs<0,urgent=diffMs!==null&&diffMs>=0&&diffMs<90000;
    const al=getAlliances(nxM,tbaM);const ss2=nxM?nexusSS(nxM.status):null;
    const lbl=nxM?.label||mLbl(tbaM);
    return(<div style={{borderRadius:12,background:passed||urgent?"#fef2f2":"#0f172a",color:passed||urgent?"#1e293b":"white",padding:16,marginBottom:14,border:passed||urgent?"2px solid #dc2626":"none",boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:4,color:passed||urgent?"#dc2626":"#94a3b8"}}>{passed?"🚨 QUEUE NOW":urgent?"⚠️ QUEUE VERY SOON":"⏭ NEXT MATCH — TEAM 115"}</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
        <span style={{fontSize:26,fontWeight:800,color:passed?"#dc2626":undefined}}>{lbl}</span>
        {ss2&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
      </div>
      {ts&&<div style={{fontSize:12,color:passed?"#64748b":"#94a3b8",marginBottom:4}}>{fmtDate(ts)} · {fmtTime(ts)}</div>}
      {diffMs!==null&&!passed&&<div style={{fontFamily:"monospace",fontSize:28,fontWeight:700,letterSpacing:2,marginBottom:4,color:urgent?"#dc2626":undefined}}>{fmtCD(diffMs)}</div>}
      {passed&&<div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:4}}>Get to the queue line now!</div>}
      {qMs&&<div style={{fontSize:11,color:passed?"#92400e":"#94a3b8",marginBottom:8}}>{trig?`Queue at start of ${trig.label} — ${fmtTime(qMs)}`:`Queue at ${fmtTime(qMs)} (10-min fallback)`}</div>}
      {al&&<div style={{display:"flex",gap:8}}>
        <div style={{flex:1,background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:4}}>PARTNERS</div>{al.partners.map(t=><div key={t} style={{fontSize:13,fontWeight:600,color:al.myColor==="red"?"#fca5a5":"#93c5fd"}}>#{t}</div>)}</div>
        <div style={{flex:1,background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:4}}>OPPONENTS</div>{al.opponents.map(t=><div key={t} style={{fontSize:13,fontWeight:600,color:"#d1d5db"}}>#{t}</div>)}</div>
        <div style={{background:"rgba(255,255,255,.08)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:4}}>ALLIANCE</div><div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",color:al.myColor==="red"?"#f87171":"#60a5fa"}}>{al.myColor}</div></div>
      </div>}
    </div>);};
  return(<div style={{padding:14}}>
    {renderHero(nextNx,nextTba)}
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      <button onClick={onFetch} disabled={loading} style={{flex:1,background:"#2563eb",color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading?.7:1}}>{loading?"Loading…":"🔄 Fetch Schedule (TBA + Nexus)"}</button>
      <button onClick={()=>{"Notification" in window&&Notification.requestPermission();}} style={{background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px 12px",fontWeight:600,fontSize:12,cursor:"pointer",color:"#374151"}}>🔔</button>
    </div>
    {error&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#991b1b",marginBottom:12}}>{error}</div>}
    {(t115nx.length||t115tba.length)>0&&<div>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Team 115 — {EVENT_KEY}</div>
      {(t115nx.length?t115nx:t115tba).map((m,idx)=>{
        const isNx=!!m.label;const ts=isNx?bestMatchTime(m,null):(getTS(m)||0)*1000;
        const passed=ts&&ts<now-120000;const al=getAlliances(isNx?m:null,isNx?null:m);
        const trig=isNx?findQueueTrigger(nexusData?.matches||[],m):null;
        const qMs=bestQueueTime(trig,ts);const diffMs=qMs?qMs-now:null;
        const soon=diffMs!==null&&diffMs>=0&&diffMs<90000;
        const ss2=isNx?nexusSS(m.status):null;const label=isNx?m.label:mLbl(m);
        return(<div key={idx} style={{borderRadius:8,border:`1px solid ${soon?"#fca5a5":"#e2e8f0"}`,background:soon?"#fef2f2":passed?"#f8fafc":"white",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
            <div style={{width:3,height:40,borderRadius:2,background:al?.myColor==="red"?"#dc2626":"#2563eb",flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:14,color:passed?"#94a3b8":"#1e293b"}}>{label}</span>
                {ss2&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99,background:ss2.bg,color:ss2.text}}>{ss2.label}</span>}
                {soon&&<span style={{fontSize:10,fontWeight:700,background:"#fee2e2",color:"#dc2626",padding:"1px 6px",borderRadius:4}}>QUEUE NOW</span>}
                {passed&&<span style={{fontSize:10,color:"#94a3b8"}}>✓ passed</span>}
              </div>
              <div style={{fontSize:11,color:"#64748b"}}>{ts?`${fmtDate(ts)} · ${fmtTime(ts)}`:""}</div>
              {!passed&&qMs&&<div style={{fontSize:10,color:soon?"#dc2626":"#94a3b8",marginTop:1}}>{trig?`Queue at start of ${trig.label}`:`Queue at ${fmtTime(qMs)} (10-min fallback)`}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {al&&<><div style={{fontSize:11,color:"#64748b"}}>w/ #{al.partners.join(", #")}</div><div style={{fontSize:11,color:"#94a3b8"}}>vs #{al.opponents.join(", #")}</div></>}
              {!passed&&diffMs!==null&&<div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,marginTop:2,color:soon?"#dc2626":"#374151"}}>{diffMs>=0?fmtCD(diffMs):"Queue!"}</div>}
            </div>
          </div>
        </div>);})}
    </div>}
  </div>);}

function ChecklistTab({nexusData,tbaMatches,autoMatch,demoMode}){
  const [checked,setChecked]=useState({});const [lead,setLead]=useState("");
  const [submitting,setSubmit]=useState(false);const [msg,setMsg]=useState("");
  const [showMarkAll,setMarkAll]=useState(false);const syncRef=useRef(null);
  const matchNum=autoMatch?(autoMatch.level==="qm"?`Q${autoMatch.num}`:autoMatch.level==="sf"?`SF${autoMatch.num}`:`F${autoMatch.num}`):"";
  const total=ALL_ITEMS.length,done=Object.values(checked).filter(Boolean).length;
  const pct=Math.round(done/total*100);
  const critDone=CRIT_ITEMS.filter(i=>checked[i.id]).length,allCrit=critDone===CRIT_ITEMS.length;
  const sKey=useCallback(()=>matchNum?`${STORAGE_KEY}:${matchNum}`:STORAGE_KEY,[matchNum]);
  const loadState=useCallback(async()=>{const d=await ls(sKey());if(d?.checked)setChecked(d.checked);},[sKey]);
  useEffect(()=>{loadState();},[loadState]);
  useEffect(()=>{syncRef.current=setInterval(loadState,10000);return()=>clearInterval(syncRef.current);},[loadState]);
  const toggle=useCallback(async id=>{setChecked(prev=>{const next={...prev,[id]:!prev[id]};ss(sKey(),{checked:next,updatedBy:lead||"unknown",updatedAt:Date.now()});return next;});},[sKey,lead]);
  const doMarkAll=async()=>{const all=ALL_IDS.reduce((a,id)=>({...a,[id]:true}),{});setChecked(all);await ss(sKey(),{checked:all,updatedBy:lead||"unknown",updatedAt:Date.now()});setMarkAll(false);};
  const doReset=async()=>{setChecked({});setMsg("");await ss(sKey(),{checked:{},updatedBy:lead||"unknown",updatedAt:Date.now()});};
  const doSubmit=async(quickMode=false)=>{
    if(!allCrit){setMsg("⚠️ Cannot submit — critical items still incomplete.");return;}
    setSubmit(true);
    const checkedIds=ALL_IDS.filter(id=>checked[id]);
    const archKey=demoMode?DEMO_ARCHIVE_KEY:ARCHIVE_KEY;
    const entry={matchNum:matchNum||"?",lead:lead||"Unknown",submittedAt:Date.now(),completedCount:done,checkedIds,markedAllComplete:quickMode,isDemo:demoMode};
    const existing=await ls(archKey)||[];await ss(archKey,[...existing,entry]);
    let ok=false;if(!demoMode)ok=await sendEmail(`Match ${matchNum||"?"}`,lead,done,total,quickMode);
    if(demoMode)setMsg("✅ Demo submitted & archived! (No email sent in demo mode)");
    else if(ok)setMsg(`✅ Submitted! Email sent to ${NOTIFY_EMAIL}`);
    else setMsg("✅ Archived! Email failed — see ℹ️ Info for troubleshooting");
    setTimeout(async()=>{setChecked({});setMsg("");await ss(sKey(),{checked:{},updatedBy:"auto-reset",updatedAt:Date.now()});},3000);
    setSubmit(false);};
  return(<div style={{paddingBottom:24}}>
    <div style={{background:"#1e293b",padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-end"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:3}}>CURRENT MATCH</div>
        <div style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:18,fontWeight:800,color:matchNum?"white":"#475569",letterSpacing:.5}}>{matchNum||"—"}</span>
          {matchNum?<span style={{fontSize:10,color:"#4ade80",fontWeight:600}}>● auto-detected</span>:<span style={{fontSize:10,color:"#475569"}}>fetch schedule first</span>}
        </div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:3}}>LEAD INITIALS</div>
        <input value={lead} onChange={e=>setLead(e.target.value)} placeholder="JD"
          style={{width:"100%",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"white",padding:"6px 8px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
      </div>
    </div>
    <MatchIntelPanel autoMatch={autoMatch} nexusData={nexusData} tbaMatches={tbaMatches}/>
    <div style={{background:"white",padding:"10px 14px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,zIndex:40,boxShadow:"0 2px 6px rgba(0,0,0,.06)",marginTop:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:13}}>{done}/{total}</span>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,fontWeight:700,background:allCrit?"#dcfce7":"#fee2e2",color:allCrit?"#166534":"#991b1b"}}>{allCrit?"✓ Critical clear":`⚠ ${CRIT_ITEMS.length-critDone} critical left`}</span>
        </div>
        <button onClick={doReset} style={{background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600,color:"#64748b"}}>Reset</button>
      </div>
      <div style={{background:"#e2e8f0",borderRadius:99,height:7,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:pct===100?"#16a34a":pct>60?"#2563eb":"#f59e0b",transition:"width .3s"}}/></div>
    </div>
    <div style={{background:"#fffbeb",borderBottom:"1px solid #fde68a",padding:"10px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#92400e"}}>⚡ Quick Complete</div><div style={{fontSize:11,color:"#a16207",marginTop:1}}>No time to check individually? Mark everything done at once.</div></div>
        <button onClick={()=>setMarkAll(true)} style={{background:"#d97706",color:"white",border:"none",borderRadius:7,padding:"8px 12px",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>✓ Mark All Complete</button>
      </div>
    </div>
    {showMarkAll&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,padding:24,maxWidth:320,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",fontSize:36,marginBottom:8}}>⚡</div>
        <div style={{fontWeight:800,fontSize:16,textAlign:"center",marginBottom:8}}>Mark All Complete?</div>
        <div style={{fontSize:13,color:"#64748b",textAlign:"center",lineHeight:1.6,marginBottom:20}}>This checks off all <strong>{total} items</strong> including every critical check. Only use if you've physically verified everything.</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setMarkAll(false)} style={{flex:1,background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",color:"#374151"}}>Cancel</button>
          <button onClick={doMarkAll} style={{flex:2,background:"#d97706",color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Yes, Mark All Done</button>
        </div>
      </div>
    </div>}
    <div style={{padding:"10px 14px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
      {Object.entries(PC).map(([k,v])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:4,background:v.bg,borderRadius:5,padding:"2px 8px"}}><div style={{width:6,height:6,borderRadius:"50%",background:v.dot}}/><span style={{fontSize:10,fontWeight:700,color:v.text}}>{v.label}</span></div>))}
    </div>
    <div style={{padding:"12px 14px 0"}}>{SECTIONS.map(s=><Section key={s.id} section={s} checked={checked} onToggle={toggle}/>)}</div>
    <div style={{padding:"4px 14px"}}>
      {msg&&<div style={{borderRadius:8,padding:"10px 12px",marginBottom:10,fontSize:13,fontWeight:600,background:msg.startsWith("✅")?"#dcfce7":"#fee2e2",color:msg.startsWith("✅")?"#166534":"#991b1b",border:`1px solid ${msg.startsWith("✅")?"#86efac":"#fca5a5"}`}}>{msg}{msg.startsWith("✅")&&<div style={{fontSize:11,fontWeight:400,marginTop:3,color:"#15803d"}}>Auto-resetting in 3 seconds…</div>}</div>}
      <button onClick={()=>doSubmit(false)} disabled={submitting||!allCrit} style={{width:"100%",background:allCrit?"#16a34a":"#94a3b8",color:"white",border:"none",borderRadius:9,padding:"13px",fontWeight:700,fontSize:15,cursor:allCrit?"pointer":"not-allowed",transition:"background .2s"}}>
        {submitting?"Submitting…":allCrit?"✅ Submit & Notify Director":"Complete all critical items to submit"}
      </button>
    </div>
  </div>);}

function InfoTab(){
  const [open,setOpen]=useState(null);const toggle=i=>setOpen(o=>o===i?null:i);
  const FEATURES=[
    {icon:"📋",title:"Checklist Tab",color:"#1d4ed8",bg:"#eff6ff",summary:"The main pre-queue electrical checklist for Team 115.",steps:[
      {h:"Current Match — auto-detected",b:"The match number is automatically determined from the schedule. It picks the next match for Team 115 that hasn't started yet. No manual entry needed — just enter your initials."},
      {h:"Live Match Intel Panel",b:"Once the schedule is fetched, a card shows your match time, queue countdown (2 matches before yours), alliance partners, opponents, and Statbotics win probability + predicted scores."},
      {h:"Tap items to check them off",b:"Tap any row to toggle it. Checked items turn green and strike through. CRITICAL (red), HIGH (orange), MEDIUM (yellow), SECONDARY (green)."},
      {h:"⚡ Quick Complete",b:"Marks all items done at once. A confirmation dialog prevents accidental use. Only use if you've physically verified everything but don't have time to tap each item."},
      {h:"Submit & Notify Director",b:"Unlocks once all CRITICAL items are checked. Saves to archive, sends email to director, then auto-resets in 3 seconds."},
      {h:"Shared state",b:"All leads see the same checklist. If one lead checks an item, everyone sees it within 10 seconds. Each match has its own isolated state."},
    ]},
    {icon:"🏆",title:"Schedule Tab",color:"#15803d",bg:"#f0fdf4",summary:"Live match schedule with queue countdowns for Team 115.",steps:[
      {h:"Fetch Schedule",b:"Tap Fetch to pull Team 115's matches from TBA and timing from Nexus (if key is set). The schedule won't be available until ~1 week before the event (April 2–4)."},
      {h:"Queue Time Logic",b:"Queue time = start time of the match 2 slots before Team 115's match in the full event order. Falls back to 10 minutes before match time if no schedule is posted."},
      {h:"Auto-refetch",b:"Once fetched, the schedule silently refreshes every 5 minutes to keep times accurate as the event runs ahead or behind."},
      {h:"Browser Notifications",b:"Tap 🔔 and grant permission. A notification fires on your device when queue time arrives."},
    ]},
    {icon:"🗂",title:"Archive Tab",color:"#92400e",bg:"#fffbeb",summary:"Full history of every submitted checklist.",steps:[
      {h:"Per-match submissions",b:"Every submitted checklist is saved with match number, timestamp, lead name, completion %, and section-by-section breakdown."},
      {h:"Section breakdown",b:"Each archive card shows a color-coded strip for every section — green if fully completed, red if any items were skipped."},
      {h:"Demo vs Live",b:"Demo submissions are stored separately and only visible while in demo mode. Live OC submissions are never mixed with demo data."},
    ]},
    {icon:"🧪",title:"Demo Mode",color:"#7e22ce",bg:"#faf5ff",summary:"Test all features before competition day.",steps:[
      {h:"How to enter",b:"Tap the 🧪 button in the header. Demo mode uses the 2025 Pinnacles event from TBA (real data) and simulated Nexus timing with 10 minutes until queue for your first match."},
      {h:"What changes",b:"TBA pulls from 2025capin, Nexus uses mock data, emails are suppressed, and submissions go to a separate demo archive."},
      {h:"Session only",b:"Demo mode is never saved between sessions. Refreshing the page always returns to live mode."},
    ]},
    {icon:"📊",title:"Statbotics Predictions",color:"#7e22ce",bg:"#faf5ff",summary:"Win probability and score predictions for each match.",steps:[
      {h:"Automatic",b:"Fetches from Statbotics the moment the current match is auto-detected. No key or login needed."},
      {h:"Win probability bar",b:"Shows Team 115's predicted win % vs opponents. Green = favored, red = underdog."},
      {h:"Predicted scores",b:"Red and blue alliance predicted point totals from Statbotics' EPA model."},
    ]},
    {icon:"📧",title:"Email Notifications",color:"#166534",bg:"#f0fdf4",summary:"Automatic email to the director on checklist submission.",steps:[
      {h:"When emails fire",b:"Sent every time a lead taps Submit in live mode. Includes match number, lead initials, completion count, time, and method (manual or Quick Complete). Not sent in demo mode."},
      {h:"Troubleshooting",b:"If email fails: 1) Verify your EmailJS template has all variables: to_email, match_label, lead_name, completed, total, submitted_time, method, event. 2) Reconnect Gmail using SMTP (smtp.gmail.com, port 587) with a Gmail App Password rather than OAuth. 3) Check you haven't exceeded 200 emails/month on the free plan."},
    ]},
    {icon:"🚦",title:"Priority System",color:"#991b1b",bg:"#fef2f2",summary:"Four color-coded priority levels.",steps:[
      {h:"🔴 CRITICAL",b:"Must be resolved before queuing. Submit button locked until all are checked."},
      {h:"🟠 HIGH",b:"Fix before the match if possible. Won't block submit but indicates real risk."},
      {h:"🟡 MEDIUM",b:"Monitor during or after the match. Low immediate risk."},
      {h:"🟢 SECONDARY",b:"Between-match maintenance. Do during pit time, not while rushing to queue."},
    ]},
  ];
  return(<div style={{padding:14,paddingBottom:32}}>
    <div style={{background:"linear-gradient(135deg,#0f172a,#1e3a5f)",borderRadius:14,padding:20,marginBottom:16,color:"white"}}>
      <div style={{fontSize:28,marginBottom:6}}>🤖</div>
      <div style={{fontWeight:800,fontSize:18,marginBottom:6}}>MVRT Team 115 — App Guide</div>
      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6}}>Pre-queue electrical checklist for the 2026 OC District (April 2–4). Connects to The Blue Alliance, FRC Nexus, and Statbotics.</div>
    </div>
    <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:12,padding:14,marginBottom:16}}>
      <div style={{fontWeight:800,fontSize:13,color:"#854d0e",marginBottom:10}}>⚡ Quick Start for Leads</div>
      {[["1","Open the app using the shared link."],["2","Go to 📋 Checklist — enter your initials. The match number is auto-detected."],["3","Work through the checklist top to bottom, tapping each item as you verify it."],["4","All CRITICAL items must be green before you can submit."],["5","Tap ✅ Submit & Notify Director — director gets an email and the checklist auto-resets."],["6","Check 🏆 Schedule for live queue countdowns."]].map(([n,t])=>(
        <div key={n} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
          <div style={{width:22,height:22,borderRadius:"50%",background:"#d97706",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0}}>{n}</div>
          <div style={{fontSize:13,color:"#374151",lineHeight:1.4}}>{t}</div>
        </div>))}
    </div>
    <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Feature Guide</div>
    {FEATURES.map((f,i)=>(<div key={i} style={{borderRadius:12,overflow:"hidden",border:`1px solid ${open===i?f.color+"44":"#e2e8f0"}`,marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
      <button onClick={()=>toggle(i)} style={{width:"100%",background:open===i?f.bg:"white",border:"none",cursor:"pointer",padding:"13px 14px",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        <div style={{width:38,height:38,borderRadius:10,background:f.bg,border:`1px solid ${f.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:f.color}}>{f.title}</div><div style={{fontSize:11,color:"#64748b",marginTop:1}}>{f.summary}</div></div>
        <span style={{color:"#94a3b8",fontSize:14,flexShrink:0}}>{open===i?"▾":"▸"}</span>
      </button>
      {open===i&&<div style={{borderTop:`1px solid ${f.color}22`,background:f.bg}}>
        {f.steps.map((s,si)=>(<div key={si} style={{padding:"12px 14px",borderBottom:si<f.steps.length-1?`1px solid ${f.color}18`:"none"}}>
          <div style={{fontWeight:700,fontSize:12,color:f.color,marginBottom:4}}>{s.h}</div>
          <div style={{fontSize:12,color:"#374151",lineHeight:1.6}}>{s.b}</div>
        </div>))}
      </div>}
    </div>))}
    <div style={{background:"#f1f5f9",borderRadius:10,padding:12,marginTop:4,border:"1px solid #e2e8f0",textAlign:"center"}}>
      <div style={{fontSize:11,color:"#64748b",lineHeight:1.6}}>Built for MVRT Team 115 · 2026 OC District (April 2–4)<br/>Data from <strong>The Blue Alliance</strong> · <strong>Statbotics</strong> · live timing via <strong>FRC Nexus</strong></div>
    </div>
  </div>);}

// ── ANNOUNCEMENT BANNER (shown in lead app) ────────────────────────────────────
function AnnouncementBanner(){
  const [ann,setAnn]=useState([]);
  useEffect(()=>{
    const poll=()=>ls(ANNOUNCE_KEY).then(d=>setAnn(d||[]));
    poll();const t=setInterval(poll,15000);return()=>clearInterval(t);
  },[]);
  if(!ann.length)return null;
  const latest=ann[ann.length-1];
  const C={queue:{bg:"#fef2f2",border:"#fca5a5",text:"#991b1b"},urgent:{bg:"#fffbeb",border:"#fde68a",text:"#854d0e"},info:{bg:"#faf5ff",border:"#d8b4fe",text:"#6d28d9"}};
  const c=C[latest.urgency]||C.info;
  return(
    <div style={{background:c.bg,borderBottom:`2px solid ${c.border}`,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:16}}>{latest.urgency==="queue"?"🚨":latest.urgency==="urgent"?"⚠️":"📢"}</span>
      <div style={{flex:1,fontSize:13,fontWeight:700,color:c.text}}>{latest.text}</div>
      {ann.length>1&&<span style={{fontSize:10,color:c.text,opacity:.7}}>{ann.length} msgs</span>}
    </div>);}


function SyncStatus(){
  return <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>Pre-Queue · 2026 OC District</div>;}

// ── ANNOUNCEMENT BANNER ───────────────────────────────────────────────────────

function PinScreen({onUnlock,activePin}){
  const [pin,setPin]=useState("");
  const [shake,setShake]=useState(false);
  const submit=()=>{
    if(pin===activePin){onUnlock();}
    else{setShake(true);setPin("");setTimeout(()=>setShake(false),500);}};
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d0520,#1e0a3c)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(139,92,246,.3)",borderRadius:20,padding:32,maxWidth:300,width:"100%",boxShadow:"0 24px 60px rgba(80,0,180,.3)",animation:shake?"shake .4s ease":"none"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:8}}>🔐</div>
          <div style={{fontWeight:800,fontSize:18,color:"#f1f0ff"}}>Director Mode</div>
          <div style={{fontSize:12,color:"rgba(196,181,253,.5)",marginTop:4}}>MVRT Team 115</div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:12,height:12,borderRadius:"50%",background:pin.length>i?"#c4b5fd":"rgba(139,92,246,.3)",border:"2px solid rgba(139,92,246,.5)",transition:"all .15s"}}/>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
            <button key={i} onClick={()=>{if(k==="⌫")setPin(p=>p.slice(0,-1));else if(k!==""&&pin.length<4)setPin(p=>p+String(k));}}
              disabled={k===""}
              style={{padding:"13px 0",borderRadius:10,border:"1px solid rgba(139,92,246,.25)",background:k===""?"transparent":"rgba(139,92,246,.1)",color:"#f1f0ff",fontSize:18,fontWeight:700,cursor:k===""?"default":"pointer",opacity:k===""?0:1}}>
              {k}
            </button>))}
        </div>
        <button onClick={submit} disabled={pin.length<4}
          style={{width:"100%",background:pin.length===4?"#7e22ce":"rgba(126,34,206,.2)",color:pin.length===4?"white":"rgba(196,181,253,.4)",border:"none",borderRadius:10,padding:"12px",fontWeight:800,fontSize:15,cursor:pin.length===4?"pointer":"default",transition:"all .2s"}}>
          Unlock
        </button>
        <div style={{fontSize:10,color:"rgba(196,181,253,.3)",textAlign:"center",marginTop:10}}>Team 115 Director Access</div>
      </div>
    </div>);}

// ── DIRECTOR: LIVE MONITOR ─────────────────────────────────────────────────────
function DirectorMonitor(){
  const now=useNow(5000);
  const [liveData,setLiveData]=useState({});
  const [archive,setArchive]=useState([]);
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),8000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    const poll=async()=>{
      const data={};
      for(const mk of["Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Q9","Q10","Q11","Q12","Q13","Q14","Q15","Q16","SF1","F1"]){
        const d=await ls(`${STORAGE_KEY}:${mk}`);
        if(d&&d.updatedAt&&(Date.now()-d.updatedAt)<60*60*1000)data[mk]=d;}
      const base=await ls(STORAGE_KEY);if(base&&base.updatedAt)data["(current)"]=base;
      setLiveData(data);};
    poll();ls(ARCHIVE_KEY).then(d=>setArchive(d||[]));
  },[tick]);
  const activeKeys=Object.keys(liveData).filter(k=>{const d=liveData[k];return d&&d.checked&&Object.keys(d.checked).length>0;});
  const totalMatches=archive.length;
  const avgPct=totalMatches?Math.round(archive.reduce((a,e)=>a+Math.round(e.completedCount/ALL_ITEMS.length*100),0)/totalMatches):0;
  const critMisses=archive.filter(e=>!CRIT_ITEMS.every(i=>(e.checkedIds||[]).includes(i.id)));
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[{val:totalMatches,lbl:"Submissions",col:"#c4b5fd"},{val:`${avgPct}%`,lbl:"Avg Complete",col:"#4ade80"},{val:critMisses.length,lbl:"Crit Misses",col:critMisses.length>0?"#f87171":"#4ade80"}].map(({val,lbl,col})=>(
          <div key={lbl} style={{background:"rgba(139,92,246,.1)",border:"1px solid rgba(139,92,246,.25)",borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:col}}>{val}</div>
            <div style={{fontSize:10,color:"rgba(196,181,253,.7)",marginTop:2}}>{lbl}</div>
          </div>))}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:"rgba(196,181,253,.8)",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Live Lead States</div>
      {activeKeys.length===0?(
        <div style={{background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)",borderRadius:10,padding:14,textAlign:"center",color:"rgba(196,181,253,.5)",fontSize:13,marginBottom:14}}>
          No active checklist — waiting for leads to start checking items
        </div>
      ):activeKeys.map(mk=>{
        const d=liveData[mk];const checked=d.checked||{};
        const done=Object.values(checked).filter(Boolean).length;
        const pct=Math.round(done/ALL_ITEMS.length*100);
        const critDone=CRIT_ITEMS.filter(i=>checked[i.id]).length;
        const allCrit=critDone===CRIT_ITEMS.length;
        const ago=Math.round((Date.now()-d.updatedAt)/1000);
        const uncheckedCrit=CRIT_ITEMS.filter(i=>!checked[i.id]);
        return(
          <div key={mk} style={{background:"rgba(139,92,246,.08)",border:`1px solid ${allCrit?"rgba(74,222,128,.4)":"rgba(248,113,113,.4)"}`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:800,fontSize:16,color:"#f1f0ff"}}>Match {mk}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:allCrit?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",color:allCrit?"#4ade80":"#f87171"}}>
                    {allCrit?"✓ Critical clear":`${CRIT_ITEMS.length-critDone} critical left`}
                  </span>
                </div>
                <div style={{fontSize:11,color:"rgba(196,181,253,.6)",marginTop:2}}>Lead: {d.updatedBy||"unknown"} · {ago<60?`${ago}s ago`:`${Math.round(ago/60)}m ago`}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:20,fontWeight:800,color:pct===100?"#4ade80":pct>60?"#c4b5fd":"#f87171"}}>{pct}%</div>
                <div style={{fontSize:10,color:"rgba(196,181,253,.5)"}}>{done}/{ALL_ITEMS.length}</div>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,.06)",borderRadius:99,height:6,overflow:"hidden",marginBottom:8}}>
              <div style={{width:`${pct}%`,height:"100%",background:pct===100?"#4ade80":pct>60?"#9333ea":"#f87171",borderRadius:99}}/>
            </div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:uncheckedCrit.length?8:0}}>
              {SECTIONS.map(sec=>{const sd=sec.items.filter(i=>checked[i.id]).length,ok=sd===sec.items.length;
                return <div key={sec.id} title={`${sec.title}: ${sd}/${sec.items.length}`} style={{height:4,flex:1,minWidth:6,borderRadius:2,background:ok?"#4ade80":sd>0?"#9333ea":"rgba(255,255,255,.1)"}}/>;
              })}
            </div>
            {uncheckedCrit.length>0&&(
              <div style={{background:"rgba(248,113,113,.08)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(248,113,113,.2)"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#f87171",marginBottom:4}}>UNCHECKED CRITICAL ITEMS</div>
                {uncheckedCrit.map(item=>(
                  <div key={item.id} style={{fontSize:11,color:"rgba(248,113,113,.8)",marginBottom:2}}>❌ {item.text}</div>))}
              </div>)}
          </div>);})}
      <div style={{fontSize:12,fontWeight:700,color:"rgba(196,181,253,.8)",marginBottom:8,textTransform:"uppercase",letterSpacing:.5,marginTop:8}}>Recent Submissions</div>
      {archive.slice(-3).reverse().map((e,i)=>{
        const pct=Math.round(e.completedCount/ALL_ITEMS.length*100);
        const allCrit=CRIT_ITEMS.every(ci=>(e.checkedIds||[]).includes(ci.id));
        return(
          <div key={i} style={{background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.2)",borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{allCrit?"✅":"⚠️"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f1f0ff"}}>Match {e.matchNum||"?"}</div>
              <div style={{fontSize:11,color:"rgba(196,181,253,.6)"}}>{e.lead||"?"} · {new Date(e.submittedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}{e.markedAllComplete?" · ⚡ Quick":""}</div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:pct===100?"#4ade80":pct>80?"#c4b5fd":"#f87171"}}>{pct}%</div>
          </div>);})}
    </div>);}

// ── DIRECTOR: ANNOUNCEMENTS ────────────────────────────────────────────────────
function DirectorAnnouncements(){
  const [ann,setAnn]=useState([]);
  const [text,setText]=useState("");
  const [urgency,setUrgency]=useState("info");
  useEffect(()=>{ls(ANNOUNCE_KEY).then(d=>setAnn(d||[]));},[]);
  const push=async()=>{
    if(!text.trim())return;
    const a=[...ann,{id:Date.now(),text:text.trim(),urgency,time:Date.now()}];
    setAnn(a);await ss(ANNOUNCE_KEY,a);setText("");};
  const remove=async(id)=>{const a=ann.filter(x=>x.id!==id);setAnn(a);await ss(ANNOUNCE_KEY,a);};
  const clearAll=async()=>{setAnn([]);await ss(ANNOUNCE_KEY,[]);};
  const T={queue:{col:"#dc2626",bg:"rgba(220,38,38,.15)",label:"🚨 QUEUE NOW"},urgent:{col:"#f59e0b",bg:"rgba(245,158,11,.15)",label:"⚠️ URGENT"},info:{col:"#9333ea",bg:"rgba(147,51,234,.15)",label:"ℹ️ INFO"}};
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.25)",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(196,181,253,.8)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Push Announcement to Leads</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {Object.entries(T).map(([k,v])=>(
            <button key={k} onClick={()=>setUrgency(k)}
              style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${urgency===k?v.col:"rgba(139,92,246,.2)"}`,background:urgency===k?v.bg:"transparent",color:urgency===k?v.col:"rgba(196,181,253,.6)",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {v.label}
            </button>))}
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder="Type announcement (e.g. 'Queue NOW — Q12 starting!')"
          rows={3}
          style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(139,92,246,.3)",borderRadius:8,padding:"9px 10px",fontSize:13,color:"#f1f0ff",resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        <button onClick={push} disabled={!text.trim()}
          style={{marginTop:8,width:"100%",background:text.trim()?"#7e22ce":"rgba(126,34,206,.2)",color:text.trim()?"white":"rgba(196,181,253,.3)",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:text.trim()?"pointer":"default"}}>
          📢 Push to All Leads
        </button>
      </div>
      {ann.length>0?(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(196,181,253,.8)",textTransform:"uppercase",letterSpacing:.5}}>Active Announcements</div>
            <button onClick={clearAll} style={{fontSize:11,color:"#f87171",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Clear All</button>
          </div>
          {ann.map(a=>{const t=T[a.urgency]||T.info;return(
            <div key={a.id} style={{background:t.bg,border:`1px solid ${t.col}44`,borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"#f1f0ff"}}>{a.text}</div>
                <div style={{fontSize:10,color:"rgba(196,181,253,.5)",marginTop:3}}>{new Date(a.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <button onClick={()=>remove(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(248,113,113,.7)",fontSize:16,lineHeight:1,flexShrink:0}}>✕</button>
            </div>);})}
        </div>
      ):(
        <div style={{textAlign:"center",padding:24,color:"rgba(196,181,253,.4)",fontSize:13}}>No active announcements</div>
      )}
    </div>);}

// ── DIRECTOR: ISSUES ───────────────────────────────────────────────────────────
function DirectorIssues(){
  const [issues,setIssues]=useState([]);
  const [match,setMatch]=useState("");
  const [severity,setSeverity]=useState("medium");
  const [component,setComponent]=useState("");
  const [desc,setDesc]=useState("");
  useEffect(()=>{ls(ISSUES_KEY).then(d=>setIssues(d||[]));},[]);
  const save=async()=>{
    if(!desc.trim())return;
    const list=[...issues,{match,severity,component,description:desc.trim(),id:Date.now(),time:Date.now()}];
    setIssues(list);await ss(ISSUES_KEY,list);
    setMatch("");setComponent("");setDesc("");};
  const remove=async(id)=>{const l=issues.filter(x=>x.id!==id);setIssues(l);await ss(ISSUES_KEY,l);};
  const SEV={high:{col:"#f87171",bg:"rgba(248,113,113,.12)",label:"🔴 HIGH"},medium:{col:"#fb923c",bg:"rgba(251,146,60,.12)",label:"🟠 MEDIUM"},low:{col:"#c4b5fd",bg:"rgba(196,181,253,.12)",label:"🟢 LOW"}};
  const COMPS=["Battery/Power","CAN Bus","Swerve Module","RoboRIO/Radio","Limelight","Wire/Connector","Motor/Controller","Other"];
  const iStyle={width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(139,92,246,.3)",borderRadius:7,padding:"7px 9px",fontSize:13,color:"#f1f0ff",outline:"none",boxSizing:"border-box"};
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={{background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.25)",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(196,181,253,.8)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Log Post-Match Issue</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"rgba(196,181,253,.6)",marginBottom:3}}>MATCH</div>
            <input value={match} onChange={e=>setMatch(e.target.value)} placeholder="Q12" style={iStyle}/>
          </div>
          <div style={{flex:2}}>
            <div style={{fontSize:10,color:"rgba(196,181,253,.6)",marginBottom:3}}>COMPONENT</div>
            <select value={component} onChange={e=>setComponent(e.target.value)}
              style={{...iStyle,background:"#1e0a3c"}}>
              <option value="">Select…</option>
              {COMPS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {Object.entries(SEV).map(([k,v])=>(
            <button key={k} onClick={()=>setSeverity(k)}
              style={{flex:1,padding:"6px 4px",borderRadius:7,border:`1px solid ${severity===k?v.col:"rgba(139,92,246,.2)"}`,background:severity===k?v.bg:"transparent",color:severity===k?v.col:"rgba(196,181,253,.5)",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              {v.label}
            </button>))}
        </div>
        <textarea value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder="Describe what broke or what to watch next match…"
          rows={3}
          style={{...iStyle,resize:"none",marginBottom:8,fontFamily:"inherit"}}/>
        <button onClick={save} disabled={!desc.trim()}
          style={{width:"100%",background:desc.trim()?"#7e22ce":"rgba(126,34,206,.2)",color:desc.trim()?"white":"rgba(196,181,253,.3)",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:desc.trim()?"pointer":"default"}}>
          Log Issue
        </button>
      </div>
      {issues.length===0&&<div style={{textAlign:"center",padding:24,color:"rgba(196,181,253,.4)",fontSize:13}}>No issues logged this event</div>}
      {[...issues].reverse().map(iss=>{const s=SEV[iss.severity]||SEV.medium;return(
        <div key={iss.id} style={{background:s.bg,border:`1px solid ${s.col}44`,borderRadius:10,padding:"11px 14px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                {iss.match&&<span style={{fontSize:12,fontWeight:700,color:"#f1f0ff"}}>Match {iss.match}</span>}
                {iss.component&&<span style={{fontSize:11,background:"rgba(255,255,255,.08)",color:"rgba(196,181,253,.8)",padding:"1px 7px",borderRadius:99}}>{iss.component}</span>}
                <span style={{fontSize:10,fontWeight:700,color:s.col}}>{s.label}</span>
              </div>
              <div style={{fontSize:13,color:"#f1f0ff",lineHeight:1.5}}>{iss.description}</div>
              <div style={{fontSize:10,color:"rgba(196,181,253,.4)",marginTop:4}}>{new Date(iss.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <button onClick={()=>remove(iss.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(248,113,113,.6)",fontSize:16,flexShrink:0}}>✕</button>
          </div>
        </div>);})}
    </div>);}

// ── DIRECTOR: SETTINGS ─────────────────────────────────────────────────────────
function DirectorSettings({onLock,onPinChange}){
  const [archiveSize,setArchiveSize]=useState(0);
  const [demoArchiveSize,setDemoArchiveSize]=useState(0);
  const [clearMsg,setClearMsg]=useState("");
  const [newPin,setNewPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [pinMsg,setPinMsg]=useState("");
  useEffect(()=>{
    ls(ARCHIVE_KEY).then(d=>setArchiveSize((d||[]).length));
    ls(DEMO_ARCHIVE_KEY).then(d=>setDemoArchiveSize((d||[]).length));
  },[]);
  const savePin=async()=>{
    if(newPin.length!==4){setPinMsg("⚠️ PIN must be exactly 4 digits");return;}
    if(!/^[0-9]+$/.test(newPin)){setPinMsg("⚠️ Digits only");return;}
    if(newPin!==confirmPin){setPinMsg("⚠️ PINs do not match");return;}
    await ss(DIR_PIN_KEY,newPin);
    onPinChange(newPin);
    setNewPin("");setConfirmPin("");
    setPinMsg("✅ PIN updated — active immediately");
    setTimeout(()=>setPinMsg(""),3000);};
  const clearLive=async()=>{await ss(ARCHIVE_KEY,[]);setArchiveSize(0);setClearMsg("✅ Live archive cleared");setTimeout(()=>setClearMsg(""),2000);};
  const clearDemo=async()=>{await ss(DEMO_ARCHIVE_KEY,[]);setDemoArchiveSize(0);setClearMsg("✅ Demo archive cleared");setTimeout(()=>setClearMsg(""),2000);};
  const clearIssues=async()=>{await ss(ISSUES_KEY,[]);setClearMsg("✅ Issues cleared");setTimeout(()=>setClearMsg(""),2000);};
  const clearAnn=async()=>{await ss(ANNOUNCE_KEY,[]);setClearMsg("✅ Announcements cleared");setTimeout(()=>setClearMsg(""),2000);};
  const boxStyle={background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.2)",borderRadius:12,padding:14,marginBottom:12};
  const lblStyle={fontSize:11,fontWeight:700,color:"rgba(196,181,253,.7)",marginBottom:8,textTransform:"uppercase",letterSpacing:.5};
  const inpStyle={width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(139,92,246,.3)",borderRadius:7,padding:"8px 10px",fontSize:13,color:"#f1f0ff",outline:"none",boxSizing:"border-box",marginBottom:8};
  const btnStyle=(col="#7e22ce")=>({width:"100%",background:col,color:"white",border:"none",borderRadius:8,padding:"9px",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:6});
  return(
    <div style={{padding:14,paddingBottom:32}}>
      <div style={boxStyle}>
        <div style={lblStyle}>Change Director PIN</div>
        <input value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="New 4-digit PIN" type="password" maxLength={4} style={inpStyle}/>
        <input value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} placeholder="Confirm new PIN" type="password" maxLength={4} style={inpStyle}/>
        <button onClick={savePin} style={btnStyle()}>Save New PIN</button>
        {pinMsg&&<div style={{fontSize:12,color:pinMsg.startsWith("✅")?"#4ade80":"#f87171",marginTop:2}}>{pinMsg}</div>}
      </div>
      <div style={boxStyle}>
        <div style={lblStyle}>Archive Management</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1,background:"rgba(74,222,128,.08)",borderRadius:8,padding:"8px",textAlign:"center",border:"1px solid rgba(74,222,128,.2)"}}>
            <div style={{fontSize:18,fontWeight:800,color:"#4ade80"}}>{archiveSize}</div>
            <div style={{fontSize:10,color:"rgba(196,181,253,.6)"}}>Live Submissions</div>
          </div>
          <div style={{flex:1,background:"rgba(139,92,246,.08)",borderRadius:8,padding:"8px",textAlign:"center",border:"1px solid rgba(139,92,246,.2)"}}>
            <div style={{fontSize:18,fontWeight:800,color:"#c4b5fd"}}>{demoArchiveSize}</div>
            <div style={{fontSize:10,color:"rgba(196,181,253,.6)"}}>Demo Submissions</div>
          </div>
        </div>
        <button onClick={clearLive} style={btnStyle("#dc2626")}>🗑 Clear Live Archive ({archiveSize} entries)</button>
        <button onClick={clearDemo} style={btnStyle("#374151")}>🗑 Clear Demo Archive ({demoArchiveSize} entries)</button>
        <button onClick={clearIssues} style={btnStyle("#374151")}>🗑 Clear All Issues</button>
        <button onClick={clearAnn} style={btnStyle("#374151")}>🗑 Clear All Announcements</button>
        {clearMsg&&<div style={{fontSize:12,color:"#4ade80",marginTop:4}}>{clearMsg}</div>}
      </div>
      <div style={boxStyle}>
        <div style={lblStyle}>System Info</div>
        <div style={{fontSize:12,color:"rgba(196,181,253,.7)",lineHeight:1.8}}>
          <div>Event: <strong style={{color:"#f1f0ff"}}>{EVENT_KEY} · 2026 OC District</strong></div>
          <div>Team: <strong style={{color:"#f1f0ff"}}>MVRT #115</strong></div>
          <div>Notify: <strong style={{color:"#f1f0ff"}}>{NOTIFY_EMAIL}</strong></div>
          <div>TBA Key: <strong style={{color:"#f1f0ff"}}>…{TBA_KEY.slice(-8)}</strong></div>
        </div>
      </div>
      <button onClick={onLock}
        style={{width:"100%",background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.3)",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer",color:"#f87171"}}>
        🔒 Lock Director Mode
      </button>
    </div>);}

// ── DIRECTOR SHELL ─────────────────────────────────────────────────────────────
function DirectorShell({onLock,onPinChange}){
  const [tab,setTab]=useState("monitor");
  const TABS=[{id:"monitor",label:"👁 Monitor"},{id:"announce",label:"📢 Announce"},{id:"issues",label:"🔧 Issues"},{id:"settings",label:"⚙️ Settings"}];
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",background:"#0d0520",minHeight:"100vh",maxWidth:600,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(135deg,#1e0a3c,#2d1b69)",padding:"14px 14px 12px",boxShadow:"0 4px 20px rgba(80,0,180,.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🎛️</span>
          <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,color:"#f1f0ff"}}>Director Dashboard</div><div style={{fontSize:11,color:"rgba(196,181,253,.6)"}}>MVRT Team 115 · 2026 OC District</div></div>
          <button onClick={onLock} style={{background:"rgba(248,113,113,.15)",border:"1px solid rgba(248,113,113,.3)",borderRadius:8,padding:"5px 10px",color:"#f87171",fontSize:10,fontWeight:700,cursor:"pointer"}}>🔒 Lock</button>
        </div>
      </div>
      <div style={{display:"flex",background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(139,92,246,.2)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,border:"none",background:"none",padding:"10px 2px",fontSize:10,fontWeight:700,cursor:"pointer",color:tab===t.id?"#c4b5fd":"rgba(196,181,253,.4)",borderBottom:tab===t.id?"2px solid #9333ea":"2px solid transparent",marginBottom:-1,transition:"color .15s"}}>
            {t.label}
          </button>))}
      </div>
      {tab==="monitor"  &&<DirectorMonitor/>}
      {tab==="announce" &&<DirectorAnnouncements/>}
      {tab==="issues"   &&<DirectorIssues/>}
      {tab==="settings" &&<DirectorSettings onLock={onLock} onPinChange={onPinChange}/>}
    </div>);}


// ── DIRECTOR: PIN SCREEN ───────────────────────────────────────────────────────






export default function App(){
  const [tab,setTab]=useState("checklist");
  const [nexusData,setNexusData]=useState(null);
  const [tbaMatches,setTBA]=useState([]);
  const [tbaAllMatches,setTBAAll]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [nexusKey,setNexusKey]=useState(HARDCODED_NEXUS_KEY);
  const [nexusKeyInput,setNKI]=useState(HARDCODED_NEXUS_KEY);
  const [showNKModal,setShowNK]=useState(false);
  const [demoMode,setDemoMode]=useState(false);
  const [showDemoModal,setShowDemoModal]=useState(false);
  const [directorMode,setDirectorMode]=useState(false);
  const [showPinPrompt,setShowPinPrompt]=useState(false);
  const [activePin,setActivePin]=useState(DEFAULT_PIN);

  // Load saved PIN and nexus key on mount
  useEffect(()=>{
    ls(NEXUS_KEY_STORE).then(k=>{if(k)setNexusKey(k);});
    ls(DIR_PIN_KEY).then(p=>{if(p)setActivePin(p);});
  },[]);

  // One-time clear of live state so OC starts fresh
  useEffect(()=>{
    const FLAG="frc115_cleared_v5";
    ls(FLAG).then(done=>{
      if(!done){ss(ARCHIVE_KEY,[]);ss(STORAGE_KEY,{});ss(FLAG,true);}
    });
  },[]);

  // Demo mock Nexus refresh every 5s
  useEffect(()=>{
    if(!demoMode)return;
    setNexusData(buildMockNexus());
    const t=setInterval(()=>setNexusData(buildMockNexus()),5000);
    return()=>clearInterval(t);
  },[demoMode]);

  const fetchAll=useCallback(async()=>{
    setLoading(true);setError("");const errs=[];
    const teamKey=demoMode?DEMO_TBA_TEAM:TEAM_KEY;
    const evKey=demoMode?DEMO_TBA_EVENT:EVENT_KEY;
    try{const r=await fetch(`https://www.thebluealliance.com/api/v3/team/${teamKey}/event/${evKey}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}});
      if(r.ok){const d=await r.json();setTBA(d);}else errs.push(`TBA ${r.status}`);}catch{errs.push("TBA fetch failed");}
    try{const r=await fetch(`https://www.thebluealliance.com/api/v3/event/${evKey}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}});
      if(r.ok){const d=await r.json();setTBAAll(d);}}catch{}
    if(!demoMode){
      if(nexusKey){try{const r=await fetch(`https://frc.nexus/api/v1/event/${NEXUS_EVENT}`,{headers:{"Nexus-Api-Key":nexusKey}});
        if(r.ok){const d=await r.json();setNexusData(d);}else errs.push(`Nexus ${r.status}`);}catch{errs.push("Nexus fetch failed");}}
      else errs.push("Add Nexus key for live timing");}
    if(errs.length)setError(errs.join(" · "));
    setLoading(false);
  },[nexusKey,demoMode]);

  // Auto-poll live Nexus every 30s
  useEffect(()=>{
    if(!nexusKey||demoMode)return;
    const t=setInterval(async()=>{try{const r=await fetch(`https://frc.nexus/api/v1/event/${NEXUS_EVENT}`,{headers:{"Nexus-Api-Key":nexusKey}});if(r.ok)setNexusData(await r.json());}catch{}},30000);
    return()=>clearInterval(t);
  },[nexusKey,demoMode]);

  // Auto-refetch TBA every 5 min
  useEffect(()=>{
    if(tbaMatches.length===0)return;
    const t=setInterval(()=>{
      const teamKey=demoMode?DEMO_TBA_TEAM:TEAM_KEY;const evKey=demoMode?DEMO_TBA_EVENT:EVENT_KEY;
      fetch(`https://www.thebluealliance.com/api/v3/team/${teamKey}/event/${evKey}/matches`,{headers:{"X-TBA-Auth-Key":TBA_KEY}}).then(r=>r.ok?r.json():null).then(d=>{if(d)setTBA(d);}).catch(()=>{});
    },5*60*1000);
    return()=>clearInterval(t);
  },[tbaMatches.length,demoMode]);

  const saveNexusKey=async()=>{await ss(NEXUS_KEY_STORE,nexusKeyInput);setNexusKey(nexusKeyInput);setShowNK(false);};
  const toggleDemo=()=>{const next=!demoMode;setDemoMode(next);setTBA([]);setTBAAll([]);setError("");if(!next)setNexusData(null);setShowDemoModal(false);};

  // Auto-detect current match for Team 115
  const autoMatch=useMemo(()=>{
    const nx115=(nexusData?.matches||[]).filter(m=>[...(m.redTeams||[]),...(m.blueTeams||[])].includes(TEAM_NUM));
    const tba115=tbaMatches.filter(m=>[...(m.alliances?.red?.team_keys||[]),...(m.alliances?.blue?.team_keys||[])].includes(TEAM_KEY));
    if(nx115.length){const active=nx115.find(m=>m.status!=="Complete");if(active)return parseNexusLabel(active.label);const last=nx115[nx115.length-1];return parseNexusLabel(last.label);}
    if(tba115.length){const sorted=[...tba115].sort((a,b)=>(getTS(a)||0)-(getTS(b)||0));const next=sorted.find(m=>{const ts=getTS(m);return ts&&ts*1000>Date.now()-15*60*1000;});
      if(next)return{level:next.comp_level==="qm"?"qm":next.comp_level,num:next.match_number};
      const last=sorted[sorted.length-1];return{level:last.comp_level==="qm"?"qm":last.comp_level,num:last.match_number};}
    return null;
  },[nexusData,tbaMatches]);

  // Director / PIN gates
  if(directorMode) return <DirectorShell onLock={()=>setDirectorMode(false)} onPinChange={p=>setActivePin(p)}/>;
  if(showPinPrompt) return <PinScreen activePin={activePin} onUnlock={()=>{setDirectorMode(true);setShowPinPrompt(false);}}/>;

  const TABS=[{id:"checklist",label:"📋 Checklist"},{id:"schedule",label:"🏆 Schedule"},{id:"archive",label:"🗂 Archive"},{id:"info",label:"ℹ️ Info"}];

  if(directorMode) return <DirectorShell onLock={()=>setDirectorMode(false)} onPinChange={p=>setActivePin(p)}/>;
  if(showPinPrompt) return <PinScreen activePin={activePin} onUnlock={()=>{setDirectorMode(true);setShowPinPrompt(false);}}/>;
  return(<div style={{fontFamily:"'Segoe UI',Arial,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto"}}>
    <div style={{background:"linear-gradient(135deg,#1e0a3c 0%,#2d1b69 60%,#1a1f5e 100%)",color:"white",padding:"14px 14px 12px",boxShadow:"0 4px 12px rgba(0,0,0,.3)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:26}}>🤖</span>
        <div style={{flex:1}}><div style={{fontSize:17,fontWeight:800,letterSpacing:.5}}>MVRT Team 115</div><SyncStatus/></div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setShowDemoModal(true)} style={{background:demoMode?"rgba(167,139,250,.25)":"rgba(255,255,255,.08)",border:`1px solid ${demoMode?"#a78bfa":"rgba(255,255,255,.15)"}`,borderRadius:7,padding:"5px 7px",color:demoMode?"#c4b5fd":"#64748b",fontSize:10,fontWeight:700,cursor:"pointer"}}>🧪</button>
          <button onClick={()=>{setNKI(nexusKey);setShowNK(true);}} style={{background:nexusKey?"rgba(74,222,128,.15)":"rgba(255,255,255,.08)",border:`1px solid ${nexusKey?"#4ade80":"rgba(255,255,255,.15)"}`,borderRadius:7,padding:"5px 8px",color:nexusKey?"#4ade80":"#64748b",fontSize:10,fontWeight:700,cursor:"pointer"}}>{nexusKey?"●":"+"}</button>
          <button onClick={()=>setShowPinPrompt(true)} style={{background:"rgba(147,51,234,.2)",border:"1px solid rgba(147,51,234,.4)",borderRadius:7,padding:"5px 9px",color:"#c4b5fd",fontSize:10,fontWeight:700,cursor:"pointer"}}>🎛️</button>
        </div>
      </div>
    </div>
    {showNKModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,padding:24,maxWidth:340,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>🔌 FRC Nexus API Key</div>
        <div style={{fontSize:12,color:"#64748b",lineHeight:1.5,marginBottom:14}}>Get your key at <span style={{color:"#2563eb"}}>frc.nexus/api</span>. Provides live match timing more accurate than TBA during the event.</div>
        <input value={nexusKeyInput} onChange={e=>setNKI(e.target.value)} placeholder="paste Nexus API key here" style={{width:"100%",border:"1px solid #cbd5e1",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:14}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowNK(false)} style={{flex:1,background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",color:"#374151"}}>Cancel</button>
          <button onClick={saveNexusKey} style={{flex:2,background:"#6d28d9",color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Save Key</button>
        </div>
      </div>
    </div>}
    {showDemoModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:16,padding:24,maxWidth:340,width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",fontSize:32,marginBottom:8}}>🧪</div>
        <div style={{fontWeight:800,fontSize:16,textAlign:"center",marginBottom:6}}>{demoMode?"Exit Demo Mode?":"Enter Demo Mode?"}</div>
        <div style={{fontSize:13,color:"#64748b",textAlign:"center",lineHeight:1.6,marginBottom:20}}>{demoMode?"Switching back to live mode.":"Uses 2025 Pinnacles TBA data + simulated Nexus timing. Q1 queue in 10 min. Emails suppressed, demo archive separate."}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setShowDemoModal(false)} style={{flex:1,background:"#f1f5f9",border:"1px solid #cbd5e1",borderRadius:8,padding:"10px",fontWeight:600,fontSize:13,cursor:"pointer",color:"#374151"}}>Cancel</button>
          <button onClick={toggleDemo} style={{flex:2,background:demoMode?"#374151":"#6d28d9",color:"white",border:"none",borderRadius:8,padding:"10px",fontWeight:700,fontSize:13,cursor:"pointer"}}>{demoMode?"Exit Demo":"Enter Demo Mode"}</button>
        </div>
      </div>
    </div>}
    {demoMode&&<div style={{background:"linear-gradient(90deg,#1e0a3c,#2d1b69)",padding:"7px 14px",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>🧪</span>
      <div style={{flex:1}}><span style={{fontWeight:700,fontSize:12,color:"white"}}>DEMO MODE</span><span style={{fontSize:11,color:"rgba(255,255,255,.6)",marginLeft:6}}>2025 Pinnacles data · emails suppressed</span></div>
      <button onClick={()=>setShowDemoModal(true)} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:"white",cursor:"pointer"}}>Exit</button>
    </div>}
    <AnnouncementBanner/>
    <AnnouncementBanner/>
    <div style={{display:"flex",background:"white",borderBottom:"2px solid #e2e8f0",position:"sticky",top:0,zIndex:50}}>
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,border:"none",background:"none",padding:"10px 2px",fontSize:11,fontWeight:700,cursor:"pointer",color:tab===t.id?"#9333ea":"#64748b",borderBottom:tab===t.id?"2px solid #9333ea":"2px solid transparent",marginBottom:-2,transition:"color .15s"}}>{t.label}</button>))}
    </div>
    {tab==="checklist"&&<ChecklistTab nexusData={nexusData} tbaMatches={tbaMatches} autoMatch={autoMatch} demoMode={demoMode}/>}
    {tab==="schedule" &&<ScheduleTab nexusData={nexusData} tbaMatches={tbaMatches} tbaAllMatches={tbaAllMatches} onFetch={fetchAll} loading={loading} error={error}/>}
    {tab==="archive"  &&<ArchiveTab demoMode={demoMode}/>}
    {tab==="info"     &&<InfoTab/>}
  </div>);}
