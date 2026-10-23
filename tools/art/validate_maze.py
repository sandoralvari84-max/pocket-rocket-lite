# Validate a maze layout: rectangular, symmetric, fully connected (no stranded
# pellets), and suggest central ghost-home cells. Prints a verdict; non-zero exit on fail.
import sys
from collections import deque

# '#'=wall  '.'=pellet  'o'=power  'P'=player start  ' '=open floor (no pellet)
LAYOUT = [
    "#############",
    "#o..#...#..o#",
    "#.#.#.#.#.#.#",
    "#...........#",
    "#.#.#.#.#.#.#",
    "#.....#.....#",
    "#.##.###.##.#",
    "#.#...#...#.#",
    "#.#.#...#.#.#",
    "#...#.#.#...#",
    "#.#.#.#.#.#.#",
    "#.....#.....#",
    "#.#.#.#.#.#.#",
    "#o..#.P.#..o#",
    "#############",
]

def validate(grid):
    rows = len(grid); cols = len(grid[0])
    ok = True
    for i, r in enumerate(grid):
        if len(r) != cols:
            print(f"FAIL row {i} len {len(r)} != {cols}"); ok = False
    for i, r in enumerate(grid):
        if r != r[::-1]:
            print(f"warn row {i} not H-symmetric: {r}")
    # locate P
    pr = pc = None
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "P": pr, pc = r, c
    if pr is None:
        print("FAIL no player 'P'"); return False
    # flood over non-wall
    seen = set([(pr, pc)]); q = deque([(pr, pc)])
    while q:
        r, c = q.popleft()
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
            nr, nc = r+dr, c+dc
            if 0<=nr<rows and 0<=nc<cols and grid[nr][nc] != "#" and (nr,nc) not in seen:
                seen.add((nr,nc)); q.append((nr,nc))
    floor = [(r,c) for r in range(rows) for c in range(cols) if grid[r][c] != "#"]
    stranded = [p for p in floor if p not in seen]
    pellets = sum(1 for r in range(rows) for c in range(cols) if grid[r][c] in ".")
    powers  = sum(1 for r in range(rows) for c in range(cols) if grid[r][c] == "o")
    if stranded:
        print(f"FAIL {len(stranded)} stranded floor cells: {stranded[:8]}"); ok = False
    # suggest 4 homes nearest centre, on reachable open floor
    cr, cc = rows//2, cols//2
    cand = sorted(seen, key=lambda p: (p[0]-cr)**2 + (p[1]-cc)**2)
    homes = [p for p in cand if grid[p[0]][p[1]] != "P"][:4]
    print(f"size {cols}x{rows}  reachable {len(seen)}/{len(floor)}  pellets {pellets}  powers {powers}")
    print(f"player P at (r{pr},c{pc})")
    print(f"suggested homes: {homes}")
    print("VERDICT:", "OK" if ok else "FAIL")
    return ok

if __name__ == "__main__":
    sys.exit(0 if validate(LAYOUT) else 1)
