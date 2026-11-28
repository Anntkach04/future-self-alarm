import numpy as np, sys
from scipy.io import wavfile
from scipy.signal import fftconvolve
SR=44100
out=sys.argv[1]
def note(f,dur,kind='bell',amp=1.0):
    t=np.arange(int(SR*dur))/SR
    if kind=='bell':   # warm glass bell: inharmonic partials, fast decay highs
        parts=[(1,1,1.6),(2.0,0.35,3.0),(3.01,0.15,5.0),(4.2,0.06,7.0)]
    elif kind=='marimba':
        parts=[(1,1,4.0),(4.0,0.25,12),(10.0,0.05,25)]
    else:  # soft pluck / kalimba
        parts=[(1,1,3.0),(2.0,0.2,6),(5.4,0.05,14)]
    s=sum(a*np.sin(2*np.pi*f*m*t)*np.exp(-d*t) for m,a,d in parts)
    att=np.minimum(1,t/0.004)
    return amp*s*att
def place(buf,sig,at):
    i=int(at*SR); buf[i:i+len(sig)]+=sig[:len(buf)-i]
def reverb(x,mix=0.25):
    n=int(SR*1.2); t=np.arange(n)/SR
    ir=np.random.default_rng(1).standard_normal(n)*np.exp(-t*4.5)
    ir/=np.abs(ir).sum()/20
    wet=fftconvolve(x,ir)[:len(x)]
    return x*(1-mix)+wet*mix
def finish(buf,name):
    buf=reverb(buf)
    buf/=np.max(np.abs(buf))*1.12
    n=len(buf); fade=int(0.25*SR); buf[-fade:]*=np.linspace(1,0,fade)
    stereo=np.stack([buf,np.roll(buf,int(SR*0.008))],1)
    wavfile.write(f"{out}/{name}.wav",SR,(stereo*32767).astype(np.int16))
N=lambda m:440*2**((m-69)/12)
# A: rising bell arpeggio into a held major chord
b=np.zeros(int(SR*2.2))
for i,m in enumerate([72,76,79]): place(b,note(N(m),1.6,'bell',0.7),i*0.09)
for m in [84,79,76]: place(b,note(N(m),1.9,'bell',0.55),0.30)
place(b,note(N(91),1.2,'bell',0.12),0.34)
finish(b,'congrats-1-bells')
# B: marimba "ta-da": two quick notes then a bright chord
b=np.zeros(int(SR*2.0))
place(b,note(N(79),0.8,'marimba',0.8),0.0)
place(b,note(N(84),0.8,'marimba',0.8),0.11)
for m in [72,76,79,84,88]: place(b,note(N(m),1.6,'marimba',0.45),0.24)
finish(b,'congrats-2-marimba')
# C: soft kalimba sparkle run up, landing on a warm chord with a shimmer
b=np.zeros(int(SR*2.3))
for i,m in enumerate([67,71,74,79,83,86]): place(b,note(N(m),1.0,'pluck',0.55),i*0.055)
for m in [67,74,79,83]: place(b,note(N(m),1.8,'bell',0.4),0.36)
place(b,note(N(95),1.0,'bell',0.08),0.40)
finish(b,'congrats-3-kalimba')
