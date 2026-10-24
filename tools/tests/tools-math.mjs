// Replicates the EXACT deterministic formulas used in Diet/Fitness/Grocery screens.
let fail = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) { fail++; console.log(`FAIL ${name}: got ${got} want ${want}`); } else console.log(`ok   ${name} = ${got}`); };

// Diet: per-food scaling k(v)=round(v*grams/100), daily total = sum
const k = (v, grams) => Math.round((v * grams) / 100);
eq("chicken 165kcal @150g", k(165, 150), 248);
eq("olive oil 884 @10g", k(884, 10), 88);
eq("protein 80g @ 30g", k(80, 30), 24);
const day = [k(165,150), k(130,200), k(89,120)]; // chicken + rice + banana kcal
eq("diet daily total", day.reduce((a,b)=>a+b,0), 248 + 260 + 107);
const pct = (tot, goal) => Math.min(100, Math.round((tot/goal)*100));
eq("goal pct 1600/2000", pct(1600,2000), 80);
eq("goal pct over clamps", pct(2600,2000), 100);

// Fitness: volume = sets*reps*weight; best = max weight
const vol = (s,r,w)=>s*r*w;
eq("volume 3x10x20", vol(3,10,20), 600);
const sets = [[3,10,20],[4,8,60],[5,5,80]];
eq("session volume", sets.reduce((a,[s,r,w])=>a+vol(s,r,w),0), 600 + 1920 + 2000);
eq("best weight", Math.max(...sets.map(([,,w])=>w)), 80);

// Grocery: counts
const items = [{done:false},{done:true},{done:false},{done:true},{done:false}];
const toBuy = items.filter(i=>!i.done).length, checked = items.length - toBuy;
eq("grocery to-buy", toBuy, 3);
eq("grocery in-cart", checked, 2);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
