"""Create small browser-ready derivatives from the owner's DVD backups.
Usage: python3 scripts/import-demo.py '/Volumes/A044/DVD Backups'
Originals are never modified. This imports known pilot discs, not every VOB chunk.
"""
import argparse, json, subprocess, hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

parser=argparse.ArgumentParser()
parser.add_argument('root',type=Path)
args=parser.parse_args()
project=Path(__file__).resolve().parent.parent
media=project/'public/media';media.mkdir(exist_ok=True)
images=project/'public/images';images.mkdir(exist_ok=True)
records=[
 ('launch-party-promo','launch party promo','Launch party promo',None,'Campus life',None),
 ('golden-tape-2008','golden tape nominations 2008','Golden Tape nominations',2008,'Events',None),
 ('tokyo-reel-2009','Tokyo reel nov 09','Tokyo reel — November 2009',2009,'Arts & culture',None),
 ('tvmanji','TVMANJi','TVMANJi',None,'Short films',75),
 ('activities-night-2006','Activities Night : Promo 2006','Activities Night / Promo 2006',2006,'Campus life',75),
 ('activities-night-2008','Activities Night sept 2008','Activities Night — September 2008',2008,'Campus life',75),
 ('promo-video-2008','PROMO VIDEO 2008','Promo video 2008',2008,'Campus life',75),
 ('special-ops','SPECIAL OPS EMILY DVD','Special Ops / Emily',None,'Short films',75),
]
def run(i):
 slug,label,title,year,category,limit=records[i]
 folder=args.root/label
 candidates=sorted(f for f in folder.rglob('*.VOB') if not f.name.endswith('_0.VOB') and f.stat().st_size>1000000)
 if not candidates: raise RuntimeError('No playable title in '+label)
 source=candidates[0];output=media/(slug+'.mp4');poster=images/(slug+'.jpg')
 if not output.exists():
  command=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-map','0:v:0','-map','0:a:0?']
  if limit: command+=['-t',str(limit)]
  command+=['-vf','bwdif=mode=send_frame:parity=auto:deint=interlaced,scale=trunc(ih*dar/2)*2:ih,setsar=1','-c:v','libx264','-preset','veryfast','-crf','25','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(output)]
  subprocess.run(command,check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]))
 duration=round(float(probe['format']['duration']))
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(min(37 if slug=='launch-party-promo' else 15,duration//2)),'-i',str(output),'-frames:v','1','-q:v','3',str(poster)],check=True)
 excerpt=limit is not None
 desc=(f'A {duration}-second demo excerpt from the original “{label}” disc. The full recording is still being catalogued.' if excerpt else f'Recovered from the original “{label}” disc. Disc labels are preserved; titles and credits are being catalogued.')
 video=dict(id=f'DVD-{i+1:03}',slug=slug,title=title,year=year,category=category,description=desc,tags=[category,'DVD archive']+(['Demo excerpt'] if excerpt else []),dvdSlug=slug,duration=duration,poster=f'/images/{slug}.jpg',source=dict(type='mp4',url=f'/media/{slug}.mp4'),sourceUrl=f'/media/{slug}.mp4',addedAt='2026-10-01')
 dvd=dict(slug=slug,label=label,year=year,notes='Digitized from the original DVD backup. '+('This demo includes an excerpt from the first title; other titles and chapters are not yet indexed.' if excerpt else 'This demo includes the first title; other titles and chapters are not yet indexed.'),cover=f'/images/{slug}.jpg')
 print(f'Prepared {title}: {duration}s, {output.stat().st_size/1e6:.1f} MB',flush=True)
 return video,dvd,dict(disc=label,sourceFile=source.name,excerpt=excerpt,outputSha256=hashlib.sha256(output.read_bytes()).hexdigest())
with ThreadPoolExecutor(max_workers=2) as pool: imported=list(pool.map(run,range(len(records))))
snapshot=json.loads((project/'data/catalogue.json').read_text())
snapshot['videos']=[a[0] for a in imported]
snapshot['dvds']=[a[1] for a in imported]
snapshot['revision']='tvm-demo-2026-10-01'
(project/'data/catalogue.json').write_text(json.dumps(snapshot,indent=2,ensure_ascii=False)+'\n')
(project/'data/demo-import.json').write_text(json.dumps([a[2] for a in imported],indent=2)+'\n')
print('Catalogue updated with eight real DVD derivatives.',flush=True)
