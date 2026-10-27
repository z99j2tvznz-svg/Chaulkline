/* IndexedDB session persistence. Full-resolution photo Blobs never leave this browser without export. */
(function(root){
 'use strict';
 const ns=root.Fieldwork||(root.Fieldwork={});let dbPromise;
 function openDB(){
   if(typeof indexedDB==='undefined')return Promise.reject(new Error('IndexedDB unavailable'));
   if(dbPromise)return dbPromise;
   dbPromise=new Promise((resolve,reject)=>{
     const r=indexedDB.open('chalkline-fieldwork',1);
     r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('sessions'))r.result.createObjectStore('sessions',{keyPath:'id'});};
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Cannot open local storage'));
   });
   return dbPromise;
 }
 async function readSessions(){
   const db=await openDB();return new Promise((resolve,reject)=>{
     const t=db.transaction('sessions','readonly'),r=t.objectStore('sessions').getAll();
     r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
     r.onerror=()=>reject(r.error);
   });
 }
 async function saveSession(session){
   const db=await openDB();return new Promise((resolve,reject)=>{
     const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(session);
     tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('Storage quota may be full'));
   });
 }
 async function deleteSession(id){const db=await openDB();return new Promise((resolve,reject)=>{
   const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
 });}
 const api={openDB,readSessions,saveSession,deleteSession};Object.assign(ns,api);
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
