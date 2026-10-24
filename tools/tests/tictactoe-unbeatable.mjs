// Exact replica of src/games/three-in-a-row.tsx AI. Exhaustive proof the AI (O) never loses.
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const winnerOf=b=>{for(const[a,c,d]of LINES)if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return null;};
const legal=b=>{const o=[];for(let i=0;i<9;i++)if(b[i]===null)o.push(i);return o;};
function minimax(b,isMax,depth){const w=winnerOf(b);if(w==="O")return 10-depth;if(w==="X")return depth-10;const m=legal(b);if(!m.length)return 0;
  if(isMax){let best=-Infinity;for(const i of m){b[i]="O";best=Math.max(best,minimax(b,false,depth+1));b[i]=null;}return best;}
  let best=Infinity;for(const i of m){b[i]="X";best=Math.min(best,minimax(b,true,depth+1));b[i]=null;}return best;}
function bestMove(board){const b=board.slice();let bs=-Infinity,pick=-1;for(const i of legal(b)){b[i]="O";const s=minimax(b,false,1);b[i]=null;if(s>bs){bs=s;pick=i;}}return pick;}

let games=0, oWins=0, draws=0, xWins=0;
// X (human) moves first and tries EVERY strategy; O always plays bestMove.
function walk(b, xTurn){
  const w=winnerOf(b);
  if(w==="X"){xWins++; return;} if(w==="O"){oWins++; games++; return;}
  const m=legal(b); if(!m.length){draws++; games++; return;}
  if(xTurn){ for(const i of m){ b[i]="X"; walk(b,false); b[i]=null; } }
  else { const i=bestMove(b); b[i]="O"; walk(b,true); b[i]=null; }
}
walk(Array(9).fill(null), true);
console.log(`terminal games explored: ${games}  (O wins: ${oWins}, draws: ${draws})`);
console.log(`human (X) wins found: ${xWins}`);
if(xWins===0 && draws>0 && oWins>0){ console.log("\nPROVEN: the AI never loses across every possible human line (unbeatable)."); process.exit(0); }
console.log("\nFAIL: a losing line exists for the AI."); process.exit(1);
