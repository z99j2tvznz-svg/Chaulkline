import csv, numpy as np, collections, json, sys
from PIL import Image, ImageEnhance
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
rows=[r for r in csv.DictReader(open('lib/manifest.csv')) if r['label']!='?']
CL=['0','1','2','3','4','5','6','7','8','9','nb']; S=int(sys.argv[1]); H=int(sys.argv[2])
def vec(im):
    a=np.asarray(im.resize((S,S),Image.BILINEAR).convert('RGB'),dtype=np.float32)/255.
    # plus a coarse colour summary of the middle: how much white, how much dark, mean colour of the rest
    c=a[S//4:3*S//4,S//4:3*S//4].reshape(-1,3); mx=c.max(1); mn=c.min(1); sat=(mx-mn)/(mx+1e-3)
    white=((sat<0.25)&(mx>0.6)).mean(); dark=(mx<0.3).mean(); col=c[(sat>=0.25)&(mx>=0.3)]
    m=col.mean(0) if len(col) else np.zeros(3)
    return np.concatenate([a.reshape(-1),[white*3,dark*3],m*3])
imgs=[Image.open('lib/crops/'+r['file']).convert('RGB') for r in rows]
def aug(im,k):
    if k==0: return im
    im=im.transpose(Image.FLIP_LEFT_RIGHT) if k%2 else im
    im=ImageEnhance.Brightness(im).enhance([0.8,1.15,0.9,1.05][k%4])
    if k>=2: im=im.rotate([8,-8,15,-15][k%4],fillcolor=(30,150,220))
    return im
X0=np.stack([vec(i) for i in imgs]); y=np.array([CL.index(r['label']) for r in rows]); sess=np.array([r['session'] for r in rows])
tot=ok=0; per=collections.Counter(); pert=collections.Counter(); conf=collections.Counter(); bys=collections.Counter()
for s in ['real1','real2','real3','real4','real5','real6']:
    tr=np.where(sess!=s)[0]; te=np.where(sess==s)[0]
    Xtr=np.concatenate([np.stack([vec(aug(imgs[i],k)) for i in tr]) for k in range(4)]); ytr=np.tile(y[tr],4)
    sc=StandardScaler().fit(Xtr); m=MLPClassifier((H,),max_iter=400,alpha=1e-3,random_state=0).fit(sc.transform(Xtr),ytr)
    p=m.predict(sc.transform(X0[te]))
    for t,q in zip(y[te],p):
        tot+=1; ok+=t==q; pert[CL[t]]+=1; per[CL[t]]+=t==q
        bys[s+'_n']+=1
        if t!=q: conf[(CL[t],CL[q])]+=1; bys[s]+=1
print(f'S={S} H={H} per session errors: right {ok}/{tot} = {100*ok/tot:.1f}%', {k:f'{per[k]}/{pert[k]}' for k in CL}, conf.most_common(5), dict(bys))
