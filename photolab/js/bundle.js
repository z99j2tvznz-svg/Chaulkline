/* Self-contained ZIP writer / reader. STORE (no compression) by design: supports Safari offline, no CDN.
 * Importer reads only self-generated stored ZIPs, verifies CRC and bounds, rejects unsafe paths.
 */
(function(root){
 'use strict';
 const ns=root.Fieldwork||(root.Fieldwork={});
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const table=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
 function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
 function le16(view,o,v){view.setUint16(o,v,true);}function le32(view,o,v){view.setUint32(o,v>>>0,true);}
 async function toBytes(v){
   if(v instanceof Uint8Array)return v;
   if(v instanceof ArrayBuffer)return new Uint8Array(v);
   if(typeof Blob!=='undefined'&&v instanceof Blob)return new Uint8Array(await v.arrayBuffer());
   if(typeof v==='string')return encoder.encode(v);
   throw new TypeError('ZIP entry must be bytes, string, or Blob');
 }
 async function createZip(entries){
   const all=[],central=[];let offset=0;
   for(const entry of entries){
     const name=entry.name.replace(/\\/g,'/');
     if(!name||name.startsWith('/')||name.split('/').some(t=>t==='..'||t==='.')||/[\0\r\n]/.test(name))throw new Error('Unsafe ZIP entry name');
     const n=encoder.encode(name),bytes=await toBytes(entry.data);
     if(n.length>65535||bytes.length>0xffffffff)throw new Error('ZIP item too large');
     const crc=crc32(bytes),local=new Uint8Array(30+n.length),v=new DataView(local.buffer);
     le32(v,0,0x04034b50);le16(v,4,20);le16(v,6,0x800);le16(v,8,0);
     le32(v,14,crc);le32(v,18,bytes.length);le32(v,22,bytes.length);le16(v,26,n.length);
     local.set(n,30);all.push(local,bytes);
     const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);
     le32(cv,0,0x02014b50);le16(cv,4,20);le16(cv,6,20);le16(cv,8,0x800);
     le16(cv,10,0);le32(cv,16,crc);le32(cv,20,bytes.length);le32(cv,24,bytes.length);
     le16(cv,28,n.length);le32(cv,42,offset);c.set(n,46);central.push(c);
     offset+=local.length+bytes.length;
   }
   const csize=central.reduce((n,c)=>n+c.length,0),eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);
   if(entries.length>65535)throw new Error('Too many ZIP entries');
   le32(ev,0,0x06054b50);le16(ev,8,entries.length);le16(ev,10,entries.length);le32(ev,12,csize);le32(ev,16,offset);
   return new Blob([...all,...central,eocd],{type:'application/zip'});
 }
 async function parseZip(blob,{maxBytes=120*1024*1024,maxEntries=150}={}){
   if(blob.size>maxBytes)throw new Error('ZIP too large for in-browser import');
   const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();
   let end=-1;
   for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
   if(end<0)throw new Error('Invalid ZIP end record');
   const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true);
   if(count>maxEntries)throw new Error('Too many files in ZIP');
   let p=start;
   for(let i=0;i<count;i++){
     if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw new Error('Invalid ZIP file table');
     const method=view.getUint16(p+10,true),size=view.getUint32(p+24,true),crc=view.getUint32(p+16,true),len=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),localOffset=view.getUint32(p+42,true);
     if(method!==0)throw new Error('Only uncompressed Fieldwork bundles can be imported');
     if(p+46+len+extra+comment>bytes.length)throw new Error('Truncated ZIP filename');
     const name=decoder.decode(bytes.subarray(p+46,p+46+len));
     if(!name||name.startsWith('/')||name.split('/').some(t=>t==='..'||t==='.')||name.includes('\\')||name.includes('\0'))throw new Error('Unsafe ZIP filename');
     if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('Missing ZIP file data');
     const nlen=view.getUint16(localOffset+26,true),elen=view.getUint16(localOffset+28,true),dataStart=localOffset+30+nlen+elen;
     if(dataStart+size>bytes.length)throw new Error('ZIP entry truncated');
     const file=bytes.slice(dataStart,dataStart+size);
     if(crc32(file)!==crc)throw new Error('ZIP checksum mismatch for '+name);
     files.set(name,file);p+=46+len+extra+comment;
   }
   return files;
 }
 function jsonString(obj){return JSON.stringify(obj,null,2)+'\n';}
 function photoName(i){return 'photos/capture_'+String(i+1).padStart(3,'0')+'.jpg';}
 function overlayName(i){return 'overlays/capture_'+String(i+1).padStart(3,'0')+'_overlay.jpg';}
 function rectifiedName(i){return 'rectified/capture_'+String(i+1).padStart(3,'0')+'_topdown.jpg';}
 function analysisName(i){return 'analysis/capture_'+String(i+1).padStart(3,'0')+'.analysis.json';}
 async function sessionToZip(session){
   const entries=[],m={schema:'chalkline.photo-session/1',app:'Chalkline Fieldwork',version:'0.4.0',
     id:session.id,createdAt:session.createdAt,exportedAt:new Date().toISOString(),tableSizeFeet:session.tableSizeFeet,synthetic:!!session.synthetic,
     captureCount:session.frames.length,detectorVersion:ns.VISION_VERSION||'unknown',completeCaptureCount:session.frames.length>=5,
     device:session.device||{},imageResults:[],privacy:'All images processed locally; this ZIP can contain images of private property.'};
   const lines=[`App revision ${ns.APP_REVISION||'0.4.0'}`,`Session ${session.id}`,`Started ${session.createdAt}`,`Detector: ${ns.VISION_VERSION||'photo-pockets/0.4.0'}`];
   for(let i=0;i<session.frames.length;i++){
     const fr=session.frames[i],result=fr.analysis||null;
     entries.push({name:photoName(i),data:fr.original});
     if(fr.source){
       const ext=String(fr.sourceFilename||'').split('.').pop().toLowerCase();
       const safeExt=/^(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/.test(ext)?ext:'bin';
       entries.push({name:'source_originals/source_'+String(i+1).padStart(3,'0')+'.'+safeExt,data:fr.source});
     }
     if(fr.overlay)entries.push({name:overlayName(i),data:fr.overlay});
     if(fr.rectified)entries.push({name:rectifiedName(i),data:fr.rectified});
     entries.push({name:analysisName(i),data:jsonString({schema:'chalkline.photo-analysis/1',captureIndex:i+1,filename:fr.filename||photoName(i),capturedAt:fr.capturedAt,dimensions:fr.dimensions,normalization:fr.normalization||null,synthetic:!!fr.synthetic,analysis:result})});
     m.imageResults.push({captureIndex:i+1,status:result?.status||'not_analyzed',geometryConfidence:result?.table?.geometryConfidence??null,geometrySource:result?.table?.geometrySource??null,
       mouthEvidenceCount:result?.metrics?.mouthEvidenceCount??0,cornersObserved:result?.metrics?.cornersObserved??0,sidesObserved:result?.metrics?.sidesObserved??0,diamondsObserved:result?.metrics?.diamondsObserved??0,pairedMouthCandidates:result?.metrics?.pairedMouthCandidates??0,jawTipCandidates:result?.metrics?.jawTipCandidates??0,method:result?.method??null,synthetic:!!fr.synthetic,sourceFilename:fr.sourceFilename||null,normalization:fr.normalization||null});
     lines.push(`Photo ${i+1}: ${result?.status||'not_analyzed'}, ${result?.reason||result?.warnings?.join('; ')||'no error'}`);
   }
   const statuses=m.imageResults.reduce((s,i)=>(s[i.status]=(s[i.status]||0)+1,s),{});
   m.statusCounts=statuses;
   entries.push({name:'session_summary.json',data:jsonString(m)});
   entries.push({name:'debug_log.txt',data:lines.concat(session.log||[]).join('\n')+'\n'});
   entries.push({name:'README.txt',data:'Chalkline Fieldwork evidence bundle v0.4.0.\nphotos/ contains the JPEG image inputs analyzed by the detector (max 1600px).\nsource_originals/ contains original uploaded photo bytes when available; camera snapshots are already JPEG.\noverlays/ contains illustrated geometry and evidence status.\nrectified/ contains proposed perspective warp.\nanalysis/ has model-derived coordinates and heuristic scores; NOT ground-truth.\nVirtual corners = fitted cushion-line intersections; paired jaw candidates are IMAGE-DERIVED and UNVERIFIED. Pocket outcomes and true diamond landmarks are NOT verified.\nCompare images against independently checked annotations before quoting accuracy.\nNo images were uploaded by the app. Upload this ZIP to ChatGPT yourself.\n'});
   return createZip(entries);
 }
 function imageType(b){return b.length>3&&b[0]===0xff&&b[1]===0xd8?'image/jpeg':'application/octet-stream';}
 async function zipToSession(blob){
   const files=await parseZip(blob),sum=files.get('session_summary.json');
   if(!sum)throw new Error('Not a Fieldwork bundle: session_summary.json missing');
   const m=JSON.parse(decoder.decode(sum));
   if(m.schema!=='chalkline.photo-session/1'||!Array.isArray(m.imageResults))throw new Error('Unknown session bundle format');
   if(m.imageResults.length>10)throw new Error('Too many photos');
   const frames=[];
   for(let i=0;i<m.imageResults.length;i++){
     const original=files.get(photoName(i));if(!original)throw new Error('Photo '+(i+1)+' is missing');
     const aj=files.get(analysisName(i)),an=aj?JSON.parse(decoder.decode(aj)):{};
     const ob=files.get(overlayName(i)),rb=files.get(rectifiedName(i));
     const rawPrefix='source_originals/source_'+String(i+1).padStart(3,'0')+'.';
     const originalRaw=[...files.entries()].find(([name])=>name.startsWith(rawPrefix));
     frames.push({id:'imported_'+i,filename:an.filename||photoName(i),capturedAt:an.capturedAt,
       dimensions:an.dimensions,normalization:an.normalization||null,synthetic:!!an.synthetic,source:originalRaw?new Blob([originalRaw[1]],{type:'application/octet-stream'}):null,
       sourceFilename:m.imageResults[i].sourceFilename||null,original:new Blob([original],{type:imageType(original)}),
       overlay:ob?new Blob([ob],{type:'image/jpeg'}):null,rectified:rb?new Blob([rb],{type:'image/jpeg'}):null,
       analysis:an.analysis||null});
   }
   return {id:root.crypto?.randomUUID?.()||('imported-'+Date.now()),createdAt:m.createdAt||new Date().toISOString(),
     tableSizeFeet:[7,8,9].includes(m.tableSizeFeet)?m.tableSizeFeet:7,synthetic:!!m.synthetic,
     device:m.device||{},frames,log:['Imported ZIP '+new Date().toISOString(),'Original session '+m.id],importedFrom:m.id};
 }
 const api={crc32,createZip,parseZip,sessionToZip,zipToSession,photoName,analysisName};
 Object.assign(ns,api);if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);