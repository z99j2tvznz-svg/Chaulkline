import sys
sys.argv=['x','24','64']; src=open('lib/train2.py').read().split("tot=ok=0")[0]; exec(src)
shot=np.array([int(r['shot']) for r in rows])
for cut in (15,22,30):
    te=np.where((sess=='real6')&(shot>cut))[0]; tr=np.where((sess!='real6')|(shot<=cut))[0]
    Xtr=np.concatenate([np.stack([vec(aug(imgs[i],k)) for i in tr]) for k in range(4)]); ytr=np.tile(y[tr],4)
    sc=StandardScaler().fit(Xtr); m=MLPClassifier((64,),max_iter=400,alpha=1e-3,random_state=0).fit(sc.transform(Xtr),ytr)
    p=m.predict(sc.transform(X0[te])); n6=int(((sess=='real6')&(shot<=cut)).sum())
    print(f'hall pictures from shots 1-{cut} in training ({n6} spots): later hall shots right {int((p==y[te]).sum())}/{len(te)} = {100*(p==y[te]).mean():.0f}%')
