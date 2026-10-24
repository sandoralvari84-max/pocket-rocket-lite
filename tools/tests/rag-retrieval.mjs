import fs from "fs";
const PACKS = JSON.parse(fs.readFileSync("src/data/kb_packs.json","utf8"));
const INDEX=[]; for (const n of PACKS.niches) for (const f of n.files) for (const c of f.chunks) INDEX.push({niche:n.id,title:n.title,file:f.file,heading:c.heading,text:c.text});
const STOP=new Set("the a an of to and or in on for with is are be as at by from this that it its your you we our how what why".split(" "));
const terms=q=>(q.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(t=>t.length>2&&!STOP.has(t));
function searchKB(query,niche,topN=4){const ts=terms(query);if(!ts.length)return[];const pool=niche?INDEX.filter(c=>c.niche===niche):INDEX;
  const sc=pool.map(c=>{const h=(c.heading+" "+c.heading+" "+c.text).toLowerCase();let s=0;for(const t of ts){let i=0,n=0;while((i=h.indexOf(t,i))>=0){n++;i+=t.length;}s+=n;}return{c,s};}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  return sc.slice(0,topN).map(x=>x.c);}

let fail=0; const check=(name,cond)=>{if(!cond){fail++;console.log("FAIL "+name);}else console.log("ok   "+name);};
console.log("index chunks:", INDEX.length, "niches:", PACKS.niches.length);
check("13 niches", PACKS.niches.length===13);
const r1=searchKB("how do I judge a health claim about relative risk","health");
check("health claim retrieves health chunk", r1.length>0 && r1[0].niche==="health");
console.log("   top:", r1[0] && (r1[0].file+" › "+r1[0].heading));
const r2=searchKB("evidence based medicine randomised trial");
check("cross-niche evidence query hits health", r2.some(c=>c.niche==="health"));
const r3=searchKB("marketing funnel conversion","marketing");
check("marketing query stays in marketing", r3.length>0 && r3.every(c=>c.niche==="marketing"));
const r4=searchKB("xyzzy nonexistentterm");
check("nonsense query returns nothing", r4.length===0);
const r5=searchKB("");
check("empty query returns nothing", r5.length===0);
console.log(fail===0?"\nALL PASS":`\n${fail} FAILED`); process.exit(fail?1:0);
