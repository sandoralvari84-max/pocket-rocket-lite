// Replicates Habits streakOf() deterministic date math.
const keyOf = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
function streakOf(days, now=new Date()){ const d=new Date(now); if(!days.has(keyOf(d))){d.setDate(d.getDate()-1); if(!days.has(keyOf(d)))return 0;} let n=0; while(days.has(keyOf(d))){n++; d.setDate(d.getDate()-1);} return n; }
const now = new Date(2026,9,24); // fixed "today"
const back = k => { const d=new Date(now); d.setDate(d.getDate()-k); return keyOf(d); };
let fail=0; const eq=(n,g,w)=>{if(g!==w){fail++;console.log(`FAIL ${n}: ${g}!=${w}`);}else console.log(`ok   ${n}=${g}`);};
eq("today+yesterday+2ago", streakOf(new Set([back(0),back(1),back(2)]),now), 3);
eq("yesterday only (today pending)", streakOf(new Set([back(1)]),now), 1);
eq("today only", streakOf(new Set([back(0)]),now), 1);
eq("gap breaks streak", streakOf(new Set([back(0),back(1),back(4),back(5)]),now), 2);
eq("empty", streakOf(new Set(),now), 0);
eq("stale (3 days ago only)", streakOf(new Set([back(3)]),now), 0);
console.log(fail?`\n${fail} FAILED`:"\nALL PASS"); process.exit(fail?1:0);
