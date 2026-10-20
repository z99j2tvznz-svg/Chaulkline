# train on everything and export the weights (int8, per-row scale) for a browser test
import csv, numpy as np, json, base64, sys
sys.argv=['x','24','64']; exec(open('lib/train2.py').read().split("tot=ok=0")[0])
Xtr=np.concatenate([np.stack([vec(aug(imgs[i],k)) for i in range(len(imgs))]) for k in range(4)]); ytr=np.tile(y,4)
sc=StandardScaler().fit(Xtr); m=MLPClassifier((64,),max_iter=400,alpha=1e-3,random_state=0).fit(sc.transform(Xtr),ytr)
W1=m.coefs_[0]/sc.scale_[:,None]; b1=m.intercepts_[0]-(sc.mean_/sc.scale_)@m.coefs_[0]   # fold the scaling into layer 1
W2=m.coefs_[1]; b2=m.intercepts_[1]
def q(W): s=np.abs(W).max(0)/127+1e-12; return base64.b64encode(np.round(W/s).astype(np.int8).tobytes()).decode(), s.tolist()
w1,s1=q(W1); w2,s2=q(W2)
json.dump(dict(S=24,classes=CL,nin=W1.shape[0],nh=64,w1=w1,s1=s1,b1=b1.tolist(),w2=w2,s2=s2,b2=b2.tolist()),open('lib/mlp24.json','w'))
# check the int8 version still agrees with the float one
Wq1=np.frombuffer(base64.b64decode(w1),np.int8).reshape(W1.shape)*np.array(s1); Wq2=np.frombuffer(base64.b64decode(w2),np.int8).reshape(W2.shape)*np.array(s2)
h=np.maximum(0,X0@Wq1+b1); pq=(h@Wq2+b2).argmax(1); pf=m.predict(sc.transform(X0))
print('int8 agrees with float on', (pq==pf).mean(), 'json KB', len(open('lib/mlp24.json').read())//1024)
