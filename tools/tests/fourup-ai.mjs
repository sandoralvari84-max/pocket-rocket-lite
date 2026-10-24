// Exact replica of src/games/four-up.tsx AI. Verifies it TAKES wins and BLOCKS threats.
const COLS=7, ROWS=6, NEED=4, DEPTH=6;
const idx=(r,c)=>r*COLS+c;
const dropRow=(b,c)=>{for(let r=ROWS-1;r>=0;r--)if(b[idx(r,c)]===null)return r;return -1;};
const legalColumns=b=>{const o=[];for(let c=0;c<COLS;c++)if(b[idx(0,c)]===null)o.push(c);return o;};
const DIRS=[[0,1],[1,0],[1,1],[1,-1]];
function winnerAt(b,r,c){const who=b[idx(r,c)];if(!who)return false;for(const[dr,dc]of DIRS){let n=1;for(let s=1;s<NEED;s++){const nr=r+dr*s,nc=c+dc*s;if(nr<0||nr>=ROWS||nc<0||nc>=COLS||b[idx(nr,nc)]!==who)break;n++;}for(let s=1;s<NEED;s++){const nr=r-dr*s,nc=c-dc*s;if(nr<0||nr>=ROWS||nc<0||nc>=COLS||b[idx(nr,nc)]!==who)break;n++;}if(n>=NEED)return true;}return false;}
function placeInto(b,c,who){const row=dropRow(b,c);const next=b.slice();if(row!==-1)next[idx(row,c)]=who;return{next,row};}
function scoreWindow(cells){let m=0,p=0,e=0;for(const v of cells){if(v==="M")m++;else if(v==="P")p++;else e++;}if(m>0&&p>0)return 0;if(m===3&&e===1)return 50;if(m===2&&e===2)return 10;if(m===1&&e===3)return 1;if(p===3&&e===1)return -80;if(p===2&&e===2)return -10;if(p===1&&e===3)return -1;return 0;}
function evaluate(b){let s=0;for(let r=0;r<ROWS;r++){const v=b[idx(r,3)];if(v==="M")s+=6;else if(v==="P")s-=6;}for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)for(const[dr,dc]of DIRS){const er=r+dr*3,ec=c+dc*3;if(er<0||er>=ROWS||ec<0||ec>=COLS)continue;const w=[];for(let k=0;k<NEED;k++)w.push(b[idx(r+dr*k,c+dc*k)]);s+=scoreWindow(w);}return s;}
const ORDER=[3,2,4,1,5,0,6];
function minimax(b,depth,alpha,beta,max,lr,lc){if(lr>=0&&winnerAt(b,lr,lc))return max?-100000-depth:100000+depth;const cols=legalColumns(b);if(depth===0||cols.length===0)return evaluate(b);const ord=ORDER.filter(c=>cols.includes(c));if(max){let best=-Infinity;for(const c of ord){const{next,row}=placeInto(b,c,"M");best=Math.max(best,minimax(next,depth-1,alpha,beta,false,row,c));alpha=Math.max(alpha,best);if(alpha>=beta)break;}return best;}let best=Infinity;for(const c of ord){const{next,row}=placeInto(b,c,"P");best=Math.min(best,minimax(next,depth-1,alpha,beta,true,row,c));beta=Math.min(beta,best);if(alpha>=beta)break;}return best;}
function bestColumn(b){const cols=legalColumns(b);const ord=ORDER.filter(c=>cols.includes(c));let bs=-Infinity,pick=ord[0]??-1;for(const c of ord){const{next,row}=placeInto(b,c,"M");if(winnerAt(next,row,c))return c;const sc=minimax(next,DEPTH-1,-Infinity,Infinity,false,row,c);if(sc>bs){bs=sc;pick=c;}}return pick;}

// helpers to build a board from a row/col placement list
const mk=()=>Array(COLS*ROWS).fill(null);
function set(b,r,c,who){b[idx(r,c)]=who;} // direct placement for test setups
let fail=0; const ok=(n,cond)=>{if(!cond){fail++;console.log("FAIL "+n);}else console.log("ok   "+n);};

// 1) Machine can win now: M has three on the bottom row cols 0,1,2 -> must play col 3.
let b=mk(); set(b,5,0,"M"); set(b,5,1,"M"); set(b,5,2,"M");
ok("takes the immediate win (col 3)", bestColumn(b)===3);

// 2) Machine must BLOCK: player P has three on bottom row cols 0,1,2 -> must play col 3.
b=mk(); set(b,5,0,"P"); set(b,5,1,"P"); set(b,5,2,"P");
ok("blocks player's immediate win (col 3)", bestColumn(b)===3);

// 3) Vertical block: P stacked 3 high in col 2 -> must play col 2.
b=mk(); set(b,5,2,"P"); set(b,4,2,"P"); set(b,3,2,"P");
ok("blocks a vertical threat (col 2)", bestColumn(b)===2);

// 4) Prefers winning over blocking when both exist: M can win col 3, P threatens col 6 -> take the win.
b=mk(); set(b,5,0,"M"); set(b,5,1,"M"); set(b,5,2,"M"); set(b,5,3,"P"); set(b,5,4,"P"); set(b,5,5,"P");
// M three at 0,1,2 (win at col3 bottom? col3 bottom is empty now since we filled row5 c3 with P) -> rebuild cleanly:
b=mk(); set(b,5,0,"M"); set(b,5,1,"M"); set(b,5,2,"M"); set(b,4,4,"P"); set(b,4,5,"P"); set(b,4,6,"P");
ok("prefers its own win over blocking (col 3)", bestColumn(b)===3);

console.log(fail?`\n${fail} FAILED`:"\nALL PASS"); process.exit(fail?1:0);
