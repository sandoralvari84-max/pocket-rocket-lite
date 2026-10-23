# Nibbler owned art v3.2 — apple + boulder, 24px, outline + shading.
import os
from PIL import Image, ImageDraw
OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "arcade", "nibbler"))
os.makedirs(OUT, exist_ok=True)
S, UP, TR = 24, 5, (0, 0, 0, 0)
INK=(12,16,22,255)
RED=(224,67,63,255); REDD=(154,46,43,255); REDH=(255,150,140,255)
LEAF=(79,179,80,255); LEAFD=(46,120,50,255); STEM=(120,84,50,255)
GREY=(112,120,134,255); GREYL=(158,168,182,255); GREYD=(54,60,76,255)
def tile():
    im=Image.new("RGBA",(S,S),TR); return im, ImageDraw.Draw(im)
def save(im,n): im.resize((S*UP,S*UP),Image.NEAREST).save(os.path.join(OUT,n+".png"))
def apple():
    im,d=tile()
    d.ellipse([3,6,20,21],fill=REDD)
    d.ellipse([4,7,19,20],fill=RED)
    d.ellipse([6,9,11,14],fill=REDH)
    d.rectangle([12,3,13,7],fill=STEM)
    d.polygon([(13,4),(18,2),(17,7)],fill=LEAF); d.line([(14,5),(16,4)],fill=LEAFD)
    save(im,"apple")
def rock():
    im,d=tile()
    d.ellipse([2,5,21,21],fill=GREYD)
    d.ellipse([3,6,20,20],fill=GREY)
    d.ellipse([5,8,12,14],fill=GREYL)
    d.line([8,15,15,15],fill=GREYD); d.line([12,15,12,19],fill=GREYD)
    save(im,"rock")
apple(); rock()
sh=Image.new("RGBA",(2*S*UP+24,S*UP+16),(40,46,56,255))
for i,n in enumerate(("apple","rock")):
    sh.alpha_composite(Image.open(os.path.join(OUT,n+".png")).convert("RGBA"),(8+i*(S*UP+8),8))
sh.save(os.path.join(os.path.dirname(__file__),"nibbler_v2_sheet.png")); print("nibbler v3.2 ok")
