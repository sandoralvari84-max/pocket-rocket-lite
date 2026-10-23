# Fleet Hunt owned art v3.2 — ships + hit/miss/sunk, 24px, outline + shading.
import os
from PIL import Image, ImageDraw
OUT=os.path.normpath(os.path.join(os.path.dirname(__file__),"..","..","assets","arcade","fleet"))
os.makedirs(OUT,exist_ok=True)
S,UP,TR=24,5,(0,0,0,0)
INK=(12,16,22,255)
HULL=(110,118,132,255); HULLL=(158,168,182,255); HULLD=(54,60,76,255); DECK=(90,98,112,255)
GUN=(36,40,48,255); GLASS=(150,214,232,255)
AMBER=(255,152,16,255); YEL=(255,224,120,255); RED=(255,82,71,255); REDD=(184,50,41,255)
CYAN=(0,229,255,255); WHITE=(243,239,230,255); SMOKE=(80,88,102,255)
def canvas(w,h=S): im=Image.new("RGBA",(w,h),TR); return im,ImageDraw.Draw(im)
def save(im,n): im.resize((im.width*UP,im.height*UP),Image.NEAREST).save(os.path.join(OUT,n+".png"))
def ship(cells,name):
    w=cells*S; im,d=canvas(w)
    top,bot=10,19
    d.polygon([(3,bot),(w-4,bot),(w-9,top),(7,top)],fill=HULL)
    d.polygon([(w-9,top),(w-4,bot),(w-1,(top+bot)//2)],fill=HULLL)   # pointed bow
    d.line([(7,top),(w-9,top)],fill=HULLL)                           # deck highlight
    d.line([(3,bot),(w-4,bot)],fill=HULLD)                           # waterline
    cx=w//2
    d.rectangle([cx-5,top-5,cx+2,top],fill=DECK)                     # superstructure
    d.rectangle([cx-4,top-8,cx-1,top-5],fill=HULLL)                  # bridge
    d.rectangle([cx-3,top-4,cx-1,top-2],fill=GLASS)                  # bridge window
    d.line([(cx+2,top-3),(cx+9,top-3)],fill=GUN)                     # gun barrel
    save(im,name)
ship(3,"ship3"); ship(2,"ship2")
def hit():
    im,d=canvas(S)
    for a,b in [(3,12),(12,3),(20,11),(11,20),(6,6),(18,18),(18,6),(6,18)]:
        d.line([12,12,a,b],fill=AMBER,width=2)
    d.ellipse([6,6,17,17],fill=RED); d.ellipse([8,8,15,15],fill=AMBER); d.ellipse([10,10,13,13],fill=YEL)
    save(im,"hit")
def miss():
    im,d=canvas(S)
    d.ellipse([5,5,18,18],outline=CYAN,width=2); d.ellipse([9,9,14,14],outline=WHITE,width=1)
    save(im,"miss")
def sunk():
    im,d=canvas(S)
    d.rectangle([2,11,21,20],fill=REDD); d.rectangle([2,11,21,12],fill=RED)
    for x,y in ((6,8),(12,5),(17,8)): d.ellipse([x-2,y-2,x+2,y+2],fill=SMOKE)
    d.line([9,11,13,3],fill=AMBER,width=2)
    save(im,"sunk")
hit(); miss(); sunk()
fx=Image.new("RGBA",(3*(S*UP)+16,S*UP+16),(40,46,56,255))
for i,n in enumerate(("hit","miss","sunk")):
    fx.alpha_composite(Image.open(os.path.join(OUT,n+".png")).convert("RGBA"),(8+i*(S*UP+4),8))
fx.save(os.path.join(os.path.dirname(__file__),"fleet_v2_fx.png"))
sh=Image.new("RGBA",(3*S*UP+16,2*S*UP+16),(40,46,56,255))
for i,n in enumerate(("ship3","ship2")):
    sh.alpha_composite(Image.open(os.path.join(OUT,n+".png")).convert("RGBA"),(8,8+i*(S*UP+8)))
sh.save(os.path.join(os.path.dirname(__file__),"fleet_v2_ships.png")); print("fleet v3.2 ok")
