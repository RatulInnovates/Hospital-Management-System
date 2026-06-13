"""
Pac-Man AI Advisor
  • Rounds 1-5  →  Original classic map (you play manually, AI judges moves)
  • After 5 rounds:
      Good performance  →  HELL map  (fast, tight, all ghosts chase with A*)
      Bad  performance  →  POOKIE map (wide open, slow, 1 ghost only)
Controls: Arrow Keys | [1] A*  [2] BFS  [3] DFS  [4] UCS | [P] Pause | [ENTER] Next
          WASD* move also supported (*W=up Q=left E=right S=down to avoid algo key clash)
"""

import pygame, sys, heapq, random, math, time
from collections import deque

# ═══════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════
CELL       = 24
COLS       = 28
ROWS       = 21
WIDTH      = COLS * CELL
HEIGHT     = ROWS * CELL + 110
FPS        = 60
MAX_ROUNDS = 5

# Performance threshold to unlock HELL (out of max possible ~5 pts)
HELL_THRESHOLD = 1500   # total score across 5 rounds needed to unlock HELL

# Tick speed in ms (lower = faster)
SPEED = {'normal': 160, 'hell': 85, 'pookie': 230}

# ─── Colors ───────────────────────────────────────────────────
BLACK    = (0,   0,   0  )
BLUE     = (26,  58,  140)
BLUE_LT  = (34,  85,  204)
YELLOW   = (255, 215, 0  )
WHITE    = (255, 255, 255)
RED      = (255, 60,  60 )
GREEN    = (50,  220, 80 )
PINK     = (255, 105, 180)
CYAN     = (0,   191, 255)
ORANGE   = (255, 184, 82 )
PELLET_C = (255, 215, 0  )
POWER_C  = (255, 140, 0  )
FRIGHT_C = (0,   100, 255)
HUD_BG   = (10,  10,  25 )
GRAY     = (120, 120, 120)
DARK_GRN = (10,  60,  20 )
DARK_RED = (70,  10,  10 )
HELL_W   = (80,  0,   0  )   # hell wall color
HELL_WL  = (160, 0,   0  )
POOK_W   = (0,   60,  80 )   # pookie wall color
POOK_WL  = (0,   120, 160)

# ═══════════════════════════════════════════════════════════════
#  MAPS
# ═══════════════════════════════════════════════════════════════

# ── Original map (rounds 1–5) ──────────────────────────────────
ORIGINAL_MAP = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#O####.#####.##.#####.####O#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "######.##### ## #####.######",
    "######.##          ##.######",
    "######.## ###--### ##.######",
    "######.## #      # ##.######",
    "     .   #        #   .     ",
    "######.## #      # ##.######",
    "######.## ######## ##.######",
    "######.##          ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#O..##.......  .......##..O#",
]

# ── Hell map (reward for good performance) ─────────────────────
HELL_MAP = [
    "############################",
    "#.#..#.#....##....#.#..#.#.#",
    "#.#.##.####.##.####.##.#.#.#",
    "#O.................#.......O",
    "#.####.###.####.###.####.###",
    "#..#.....#......#.....#..#.#",
    "##.#.###.########.###.#.#.##",
    "#..#.#..............#.#.#..#",
    "#.##.#.####.##.####.#.#.##.#",
    "##.######## ## ########.####",
    "##.######## ## ########.####",
    "##.##                ##.####",
    "##.## ##.##----##.## ##.####",
    "##.## ##.#      #.## ##.####",
    "   .     #      #      .    ",
    "##.## ##.#      #.## ##.####",
    "##.## ##.######## ## ##.####",
    "##.##                ##.####",
    "#.#..#.#....##....#.#..#.#.#",
    "#.#.##.####.##.####.##.#.#.#",
    "#O..#.......  .......#....O#",
]

# ── Pookie map (super easy, wide open, for poor performers) ────
POOKIE_MAP = [
    "############################",
    "#..........................#",
    "#.##.##.##.########.##.##.##",
    "#O..........................O",
    "#.##.##.##.########.##.##.##",
    "#..........................#",
    "#..........................#",
    "#.##.##....######....##.##.#",
    "#..........................#",
    "##.####                 ####",
    "##.####                 ####",
    "##.####                 ####",
    "##.####  #----------#  #####",
    "##.####  #          #  #####",
    "   .     #          #   .   ",
    "##.####  #          #  #####",
    "##.####  ############  #####",
    "##.####                #####",
    "#..........................#",
    "#.##.##.##.########.##.##.##",
    "#O..........................O",
]

DIR_NAME = {(-1,0):'UP',(1,0):'DOWN',(0,-1):'LEFT',(0,1):'RIGHT'}

# ═══════════════════════════════════════════════════════════════
#  GRID HELPERS
# ═══════════════════════════════════════════════════════════════

def build_grid(raw_map):
    grid, pellets, power_pellets = [], set(), set()
    for r, row in enumerate(raw_map):
        grid.append([])
        for c, ch in enumerate(row.ljust(COLS)):
            grid[r].append(1 if ch == '#' else 0)
            if ch == '.':   pellets.add((r, c))
            elif ch == 'O': power_pellets.add((r, c))
    return grid, pellets, power_pellets

def is_wall(grid, r, c):
    if r < 0 or r >= ROWS or c < 0 or c >= COLS: return True
    return grid[r][c] == 1

def get_neighbors(grid, r, c):
    return [(r+dr, c+dc) for dr,dc in [(-1,0),(1,0),(0,-1),(0,1)]
            if not is_wall(grid, r+dr, c+dc)]

def manhattan(r1,c1,r2,c2): return abs(r1-r2)+abs(c1-c2)

def reconstruct(parent, sr, sc, tr, tc):
    path, cur = [], (tr, tc)
    while cur and cur != (sr, sc):
        path.append(cur); cur = parent.get(cur)
    path.reverse(); return path

# ═══════════════════════════════════════════════════════════════
#  PATHFINDING
# ═══════════════════════════════════════════════════════════════

def astar(grid, sr, sc, tr, tc):
    heap = [(manhattan(sr,sc,tr,tc),0,sr,sc)]
    g = {(sr,sc):0}; parent={}; vis=set()
    while heap:
        f,cost,r,c = heapq.heappop(heap)
        if (r,c) in vis: continue
        vis.add((r,c))
        if r==tr and c==tc: return reconstruct(parent,sr,sc,tr,tc)
        for nr,nc in get_neighbors(grid,r,c):
            ng=cost+1
            if (nr,nc) not in g or ng<g[(nr,nc)]:
                g[(nr,nc)]=ng; parent[(nr,nc)]=(r,c)
                heapq.heappush(heap,(ng+manhattan(nr,nc,tr,tc),ng,nr,nc))
    return []

def bfs(grid, sr, sc, tr, tc):
    q=deque([(sr,sc)]); vis={(sr,sc)}; parent={}
    while q:
        r,c=q.popleft()
        if r==tr and c==tc: return reconstruct(parent,sr,sc,tr,tc)
        for nr,nc in get_neighbors(grid,r,c):
            if (nr,nc) not in vis:
                vis.add((nr,nc)); parent[(nr,nc)]=(r,c); q.append((nr,nc))
    return []

def dfs(grid, sr, sc, tr, tc):
    stack=[(sr,sc)]; vis={(sr,sc)}; parent={}
    while stack:
        r,c=stack.pop()
        if r==tr and c==tc: return reconstruct(parent,sr,sc,tr,tc)
        for nr,nc in get_neighbors(grid,r,c):
            if (nr,nc) not in vis:
                vis.add((nr,nc)); parent[(nr,nc)]=(r,c); stack.append((nr,nc))
    return []

def ucs(grid, sr, sc, tr, tc):
    """Uniform Cost Search — expands by lowest path cost (all edges cost 1 here,
    so it behaves like BFS but uses a priority queue, making it easy to extend
    with variable edge weights later)."""
    heap = [(0, sr, sc)]
    cost = {(sr,sc): 0}; parent = {}; vis = set()
    while heap:
        g, r, c = heapq.heappop(heap)
        if (r,c) in vis: continue
        vis.add((r,c))
        if r==tr and c==tc: return reconstruct(parent,sr,sc,tr,tc)
        for nr,nc in get_neighbors(grid,r,c):
            ng = g + 1
            if (nr,nc) not in cost or ng < cost[(nr,nc)]:
                cost[(nr,nc)]=ng; parent[(nr,nc)]=(r,c)
                heapq.heappush(heap,(ng,nr,nc))
    return []

def nearest_target(pellets, power_pellets, r, c):
    best,bd=None,float('inf')
    for pr,pc in list(pellets)+list(power_pellets):
        d=manhattan(r,c,pr,pc)
        if d<bd: bd=d; best=(pr,pc)
    return best

# ═══════════════════════════════════════════════════════════════
#  GHOST
# ═══════════════════════════════════════════════════════════════

class Ghost:
    def __init__(self, r, c, color, gtype):
        self.r=r; self.c=c; self.sr=r; self.sc=c
        self.color=color; self.gtype=gtype

    def reset(self): self.r=self.sr; self.c=self.sc

    def move(self, grid, pac, frightened, mode='normal'):
        if frightened:
            ns=get_neighbors(grid,self.r,self.c)
            if ns: self.r,self.c=random.choice(ns)
            return
        if mode=='hell':
            # All ghosts use A* in hell
            path=astar(grid,self.r,self.c,pac['r'],pac['c'])
            if path: self.r,self.c=path[0]
            return
        if mode=='pookie':
            # All ghosts just wander randomly in pookie
            ns=get_neighbors(grid,self.r,self.c)
            if ns: self.r,self.c=random.choice(ns)
            return
        # Normal mode
        if self.gtype=='chase':
            path=astar(grid,self.r,self.c,pac['r'],pac['c'])
            if path: self.r,self.c=path[0]
        elif self.gtype=='predict':
            pr=max(0,min(ROWS-1,pac['r']+pac['dr']*3))
            pc=max(0,min(COLS-1,pac['c']+pac['dc']*3))
            path=astar(grid,self.r,self.c,pr,pc)
            if path: self.r,self.c=path[0]
        else:
            ns=get_neighbors(grid,self.r,self.c)
            if ns: self.r,self.c=random.choice(ns)

# ═══════════════════════════════════════════════════════════════
#  FEEDBACK
# ═══════════════════════════════════════════════════════════════

class Feedback:
    def __init__(self):
        self.text=""; self.color=WHITE; self.timer=0
        self.wise_count=0; self.unwise_count=0

    def set(self, text, color, frames=100):
        self.text=text; self.color=color; self.timer=frames

    def tick(self):
        if self.timer>0: self.timer-=1

    def visible(self): return self.timer>0

# ═══════════════════════════════════════════════════════════════
#  PERFORMANCE EVALUATOR
# ═══════════════════════════════════════════════════════════════

def calc_performance_score(records):
    """
    Purely score-based: total score across all 5 rounds.
    >= 1500 → HELL, else → POOKIE
    """
    return sum(r['score'] for r in records)

# ═══════════════════════════════════════════════════════════════
#  MAIN GAME
# ═══════════════════════════════════════════════════════════════

class PacmanGame:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pac-Man AI Advisor")
        self.clock    = pygame.time.Clock()
        self.font     = pygame.font.SysFont('monospace', 15, bold=True)
        self.font_big = pygame.font.SysFont('monospace', 32, bold=True)
        self.font_xl  = pygame.font.SysFont('monospace', 36, bold=True)
        self.font_sm  = pygame.font.SysFont('monospace', 12)
        self.font_fb  = pygame.font.SysFont('monospace', 13, bold=True)
        self.algo     = 'astar'

        # Session
        self.current_round = 1
        self.round_records = []
        self.phase         = 'normal'   # 'normal' | 'hell' | 'pookie'
        self.state         = 'playing'  # 'playing' | 'round_end' | 'bonus_end' | 'game_end'
        self.start_new_round()

    # ─────────────────────────────────────────────────────────
    def _get_map_and_mode(self):
        if self.phase == 'hell':   return HELL_MAP,   'hell'
        if self.phase == 'pookie': return POOKIE_MAP, 'pookie'
        return ORIGINAL_MAP, 'normal'

    def start_new_round(self):
        raw, self.mode = self._get_map_and_mode()
        self.grid, self.pellets, self.power_pellets = build_grid(raw)
        self.pacman       = {'r':17,'c':14,'dr':0,'dc':-1}

        # Ghost count: pookie=1, normal=4, hell=4
        if self.mode == 'pookie':
            self.ghosts = [Ghost(13,13,PINK,'random')]
        else:
            self.ghosts = [
                Ghost(13,11,RED,   'chase'),
                Ghost(13,16,PINK,  'random'),
                Ghost(14,13,CYAN,  'predict'),
                Ghost(14,14,ORANGE,'random'),
            ]

        self.score        = 0
        self.lives        = 3
        self.frightened   = False
        self.fright_timer = 0
        self.game_over    = False
        self.won          = False
        self.paused       = False
        self.path_viz     = []
        self.algo_suggestion = None
        self.pending_dir  = None
        self.ghost_tick   = 0
        self.feedback     = Feedback()
        self.last_tick    = time.time()
        self.round_start  = time.time()
        self.tick_ms      = SPEED[self.mode]
        self.state        = 'playing'

    # ─────────────────────────────────────────────────────────
    def compute_suggestion(self):
        target = nearest_target(self.pellets, self.power_pellets,
                                self.pacman['r'], self.pacman['c'])
        if not target:
            self.algo_suggestion=None; self.path_viz=[]; return
        r,c = self.pacman['r'], self.pacman['c']
        if   self.algo=='astar': path=astar(self.grid,r,c,*target)
        elif self.algo=='bfs':   path=bfs  (self.grid,r,c,*target)
        elif self.algo=='ucs':   path=ucs  (self.grid,r,c,*target)
        else:                    path=dfs  (self.grid,r,c,*target)
        self.path_viz = path[:12]
        self.algo_suggestion = (path[0][0]-r, path[0][1]-c) if path else None

    def judge_move(self, pdr, pdc):
        if self.algo_suggestion is None: return
        name = {'astar':'A*','bfs':'BFS','dfs':'DFS','ucs':'UCS'}[self.algo]
        sdr,sdc = self.algo_suggestion
        pmove = DIR_NAME.get((pdr,pdc),'?')
        smove = DIR_NAME.get((sdr,sdc),'?')
        if (pdr,pdc)==(sdr,sdc):
            self.feedback.set(f"  WISE MOVE!  {name} agrees -> {pmove}", GREEN, 80)
            self.feedback.wise_count += 1
        else:
            self.feedback.set(
                f"  Not wise!  You: {pmove}  |  {name} says: {smove}", RED, 110)
            self.feedback.unwise_count += 1

    # ─────────────────────────────────────────────────────────
    def game_tick(self):
        if self.paused or self.state != 'playing': return
        now = time.time()
        if (now - self.last_tick)*1000 < self.tick_ms: return
        self.last_tick = now

        self.compute_suggestion()

        # Only move if player pressed a key
        if self.pending_dir:
            dr,dc = self.pending_dir
            nr,nc = self.pacman['r']+dr, self.pacman['c']+dc
            if not is_wall(self.grid,nr,nc):
                self.judge_move(dr,dc)
                self.pacman['r']=nr; self.pacman['c']=nc
                self.pacman['dr']=dr; self.pacman['dc']=dc
            self.pending_dir = None   # always clear after attempt

        self.ghost_tick += 1
        if self.ghost_tick % 2 == 0:
            for g in self.ghosts:
                g.move(self.grid, self.pacman, self.frightened, self.mode)

        if self.frightened:
            self.fright_timer -= 1
            if self.fright_timer <= 0: self.frightened = False

        self.check_collisions()
        self.feedback.tick()

        if self.game_over or self.won:
            self._end_round()

    def _end_round(self):
        elapsed = time.time() - self.round_start
        self.round_records.append({
            'round':  self.current_round,
            'score':  self.score,
            'time':   elapsed,
            'wise':   self.feedback.wise_count,
            'unwise': self.feedback.unwise_count,
            'phase':  self.phase,
        })

        if self.phase == 'normal':
            if self.current_round >= MAX_ROUNDS:
                # Evaluate and decide bonus level
                pts = calc_performance_score(self.round_records)
                if pts >= HELL_THRESHOLD:
                    self.phase = 'hell'
                    self.next_phase_label = '🔥 HELL'
                    self.next_phase_color = RED
                else:
                    self.phase = 'pookie'
                    self.next_phase_label = '🍭 POOKIE'
                    self.next_phase_color = PINK
                self.perf_pts = pts
                self.state = 'round_end'   # shows the "bonus unlock" screen
            else:
                self.state = 'round_end'
        else:
            # Bonus round finished
            self.state = 'game_end'

    def check_collisions(self):
        pos=(self.pacman['r'],self.pacman['c'])
        if pos in self.pellets:
            self.pellets.discard(pos); self.score+=10
        if pos in self.power_pellets:
            self.power_pellets.discard(pos); self.score+=50
            self.frightened=True; self.fright_timer=35
        for g in self.ghosts:
            if g.r==self.pacman['r'] and g.c==self.pacman['c']:
                if self.frightened: self.score+=200; g.reset()
                else:
                    self.lives-=1
                    if self.lives<=0: self.game_over=True
                    else: self.pacman['r']=17; self.pacman['c']=14
        if not self.pellets and not self.power_pellets: self.won=True

    # ═══════════════════════════════════════════════════════════
    #  DRAW
    # ═══════════════════════════════════════════════════════════
    def wall_color(self):
        if self.mode=='hell':   return HELL_W,  HELL_WL
        if self.mode=='pookie': return POOK_W,  POOK_WL
        return (26,58,140), (34,85,204)

    def draw_maze(self):
        wc,wl = self.wall_color()
        for r in range(ROWS):
            for c in range(COLS):
                if self.grid[r][c]==1:
                    x,y=c*CELL,r*CELL
                    pygame.draw.rect(self.screen,wc,(x,y,CELL,CELL))
                    pygame.draw.rect(self.screen,wl,(x,y,CELL,CELL),1)

    def draw_pellets(self):
        for r,c in self.pellets:
            pygame.draw.circle(self.screen,PELLET_C,(c*CELL+CELL//2,r*CELL+CELL//2),3)
        for r,c in self.power_pellets:
            pygame.draw.circle(self.screen,POWER_C, (c*CELL+CELL//2,r*CELL+CELL//2),7)

    def draw_path(self):
        surf=pygame.Surface((CELL,CELL),pygame.SRCALPHA)
        surf.fill((60,255,80,40))
        for r,c in self.path_viz: self.screen.blit(surf,(c*CELL,r*CELL))
        if self.path_viz:
            nr,nc=self.path_viz[0]
            pygame.draw.rect(self.screen,GREEN,(nc*CELL+2,nr*CELL+2,CELL-4,CELL-4),2)

    def draw_suggestion_arrow(self):
        if not self.algo_suggestion: return
        sdr,sdc=self.algo_suggestion
        px=self.pacman['c']*CELL+CELL//2; py=self.pacman['r']*CELL+CELL//2
        pygame.draw.line(self.screen,GREEN,(px,py),(px+sdc*CELL,py+sdr*CELL),3)
        pygame.draw.circle(self.screen,GREEN,(px+sdc*CELL,py+sdr*CELL),5)

    def draw_pacman(self):
        cx=self.pacman['c']*CELL+CELL//2; cy=self.pacman['r']*CELL+CELL//2
        pygame.draw.ellipse(self.screen,YELLOW,(cx-CELL//2+2,cy-CELL//2+2,CELL-4,CELL-4))
        a0=math.radians(30); a1=math.radians(330)
        p1=(cx+int(CELL//2*math.cos(a0)),cy-int(CELL//2*math.sin(a0)))
        p3=(cx+int(CELL//2*math.cos(a1)),cy-int(CELL//2*math.sin(a1)))
        pygame.draw.polygon(self.screen,BLACK,[p1,(cx,cy),p3])

    def draw_ghost(self, g):
        color=FRIGHT_C if self.frightened else g.color
        cx,cy=g.c*CELL+CELL//2,g.r*CELL+CELL//2; rr=CELL//2-2
        pygame.draw.ellipse(self.screen,color,(cx-rr,cy-rr,rr*2,rr*2))
        pygame.draw.rect   (self.screen,color,(cx-rr,cy,rr*2,rr))
        ww=rr*2//3
        for i in range(3):
            pygame.draw.ellipse(self.screen,BLACK,(cx-rr+i*ww,cy+rr-4,ww,8))
        if not self.frightened:
            for ox in (-4,4):
                pygame.draw.circle(self.screen,WHITE,(cx+ox,cy-2),4)
                pygame.draw.circle(self.screen,BLACK,(cx+ox,cy-2),2)

    def draw_hud(self):
        hy=ROWS*CELL
        pygame.draw.rect(self.screen,HUD_BG,(0,hy,WIDTH,110))

        phase_label = {'normal':f'ROUND {self.current_round}/{MAX_ROUNDS}',
                       'hell':'🔥 HELL ROUND','pookie':'🍭 POOKIE ROUND'}[self.phase]
        phase_color = {'normal':WHITE,'hell':RED,'pookie':PINK}[self.phase]
        elapsed = int(time.time()-self.round_start)

        # Row 1
        for txt,col,x in [
            (phase_label,              phase_color, 8),
            (f"SCORE: {self.score}",   YELLOW,     185),
            (f"LIVES: {self.lives}",   WHITE,      320),
            (f"TIME:  {elapsed}s",     CYAN,       430),
        ]:
            self.screen.blit(self.font.render(txt,True,col),(x,hy+5))

        # Row 2
        algo_label={'astar':'A*','bfs':'BFS','dfs':'DFS','ucs':'UCS'}[self.algo]
        for txt,col,x in [
            (f"ADVISOR: {algo_label}",             CYAN,     8),
            (f"Wise: {self.feedback.wise_count}",   GREEN,  175),
            (f"Unwise: {self.feedback.unwise_count}",RED,   280),
            (f"PELLETS: {len(self.pellets)+len(self.power_pellets)}",PELLET_C,390),
        ]:
            self.screen.blit(self.font.render(txt,True,col),(x,hy+27))

        # Row 3: feedback or hint
        if self.feedback.visible():
            bg=DARK_GRN if self.feedback.color==GREEN else DARK_RED
            fb=self.font_fb.render(self.feedback.text,True,self.feedback.color)
            pygame.draw.rect(self.screen,bg,(8,hy+50,fb.get_width()+20,22),border_radius=5)
            self.screen.blit(fb,(18,hy+53))
        else:
            hint=self.font_sm.render(
                "[Arrows/WASD*] Move  [1/A] A*  [2/B] BFS  [3/D] DFS  [4/U] UCS  [P] Pause",True,GRAY)
            self.screen.blit(hint,(8,hy+53))

        # Row 4
        leg=self.font_sm.render(
            "Green = algo path   Arrow = suggested next step",True,(80,180,80))
        self.screen.blit(leg,(8,hy+82))

    # ── Round-end screen (between rounds 1-5, or bonus unlock) ──
    def draw_round_end(self):
        rec = self.round_records[-1]
        ov=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA)
        ov.fill((0,0,0,210)); self.screen.blit(ov,(0,0))

        # Is this the bonus unlock screen?
        bonus_unlock = (self.phase in ('hell','pookie'))

        if bonus_unlock:
            title_txt = f"BONUS ROUND UNLOCKED!"
            title_col = self.next_phase_color
        else:
            title_txt = "ROUND COMPLETE!" if not rec['score']==0 else "ROUND OVER"
            title_col = YELLOW

        t=self.font_xl.render(title_txt,True,title_col)
        self.screen.blit(t,(WIDTH//2-t.get_width()//2,35))

        rows=[
            (f"Round {rec['round']} Score:  {rec['score']}",  WHITE),
            (f"Time taken:    {rec['time']:.1f}s",             CYAN),
            (f"Wise moves:    {rec['wise']}",                  GREEN),
            (f"Unwise moves:  {rec['unwise']}",                RED),
        ]

        if bonus_unlock:
            rows += [
                ("", WHITE),
                (f"Total Score: {self.perf_pts}  (need 1500 for HELL)", YELLOW),
                (f"Next: {self.next_phase_label}", self.next_phase_color),
            ]
        else:
            rows += [
                ("", WHITE),
                (f"Next round coming up...", GRAY),
            ]

        rows.append(("", WHITE))
        rows.append(("Press  ENTER  to continue", GRAY))

        for i,(txt,col) in enumerate(rows):
            s=self.font.render(txt,True,col)
            self.screen.blit(s,(WIDTH//2-s.get_width()//2,125+i*30))

    # ── Game end screen (after bonus round) ───────────────────
    def draw_game_end(self):
        ov=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA)
        ov.fill((0,0,0,220)); self.screen.blit(ov,(0,0))

        bonus_rec   = self.round_records[-1]
        normal_recs = [r for r in self.round_records if r['phase']=='normal']
        total_score = sum(r['score'] for r in self.round_records)
        phase_label = {'hell':'🔥 HELL','pookie':'🍭 POOKIE'}[bonus_rec['phase']]
        phase_col   = {'hell':RED,'pookie':PINK}[bonus_rec['phase']]

        t=self.font_xl.render("GAME COMPLETE!", True, YELLOW)
        self.screen.blit(t,(WIDTH//2-t.get_width()//2,20))

        # Normal rounds summary
        hdr=self.font.render("  RND   SCORE   TIME    WISE  UNWISE",True,WHITE)
        self.screen.blit(hdr,(40,70))
        pygame.draw.line(self.screen,GRAY,(40,90),(WIDTH-40,90),1)
        for r in normal_recs:
            row=self.font_sm.render(
                f"   {r['round']}    {r['score']:<7} {r['time']:<7.1f} "
                f"{r['wise']:<5} {r['unwise']}",True,CYAN)
            self.screen.blit(row,(40,95+(r['round']-1)*20))

        pygame.draw.line(self.screen,GRAY,(40,200),(WIDTH-40,200),1)

        # Bonus round result
        br=self.font.render(
            f"Bonus ({phase_label}):  Score {bonus_rec['score']}  "
            f"Time {bonus_rec['time']:.1f}s",True,phase_col)
        self.screen.blit(br,(WIDTH//2-br.get_width()//2,210))

        ts=self.font.render(f"TOTAL SCORE:  {total_score}", True, YELLOW)
        self.screen.blit(ts,(WIDTH//2-ts.get_width()//2,245))

        again=self.font_sm.render("Press  ENTER  to play again", True, GRAY)
        self.screen.blit(again,(WIDTH//2-again.get_width()//2,280))

    def draw(self):
        self.screen.fill(BLACK)
        self.draw_maze()
        if self.state=='playing':
            self.draw_path()
            self.draw_suggestion_arrow()
        self.draw_pellets()
        self.draw_pacman()
        for g in self.ghosts: self.draw_ghost(g)
        self.draw_hud()
        if self.state=='round_end':  self.draw_round_end()
        elif self.state=='game_end': self.draw_game_end()
        elif self.paused and self.state=='playing':
            p=self.font_big.render("PAUSED",True,WHITE)
            self.screen.blit(p,(WIDTH//2-p.get_width()//2,ROWS*CELL//2-20))
        pygame.display.flip()

    # ═══════════════════════════════════════════════════════════
    #  EVENTS
    # ═══════════════════════════════════════════════════════════
    def handle_events(self):
        for event in pygame.event.get():
            if event.type==pygame.QUIT:
                pygame.quit(); sys.exit()
            if event.type==pygame.KEYDOWN:

                if event.key==pygame.K_RETURN:
                    if self.state=='round_end':
                        if self.phase in ('hell','pookie'):
                            # Start the bonus round
                            self.current_round += 1
                            self.start_new_round()
                        else:
                            self.current_round += 1
                            self.start_new_round()
                    elif self.state=='game_end':
                        # Full restart
                        self.current_round=1
                        self.round_records=[]
                        self.phase='normal'
                        self.start_new_round()

                if self.state=='playing':
                    if event.key==pygame.K_p:                        self.paused=not self.paused
                    # Algo switcher — letter keys AND number keys
                    if event.key==pygame.K_a or event.key==pygame.K_1: self.algo='astar'
                    if event.key==pygame.K_b or event.key==pygame.K_2: self.algo='bfs'
                    if event.key==pygame.K_d or event.key==pygame.K_3: self.algo='dfs'
                    if event.key==pygame.K_u or event.key==pygame.K_4: self.algo='ucs'
                    # Movement — arrow keys AND WASD
                    if event.key in (pygame.K_UP,    pygame.K_w): self.pending_dir=(-1,0)
                    if event.key in (pygame.K_DOWN,  pygame.K_s): self.pending_dir=(1,0)
                    if event.key in (pygame.K_LEFT,  pygame.K_q): self.pending_dir=(0,-1)
                    if event.key in (pygame.K_RIGHT, pygame.K_e): self.pending_dir=(0,1)

    def run(self):
        while True:
            self.handle_events()
            self.game_tick()
            self.draw()
            self.clock.tick(FPS)

if __name__=='__main__':
    PacmanGame().run()