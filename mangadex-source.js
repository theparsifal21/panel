/* PANEL MangaDex integration; the Cloudflare Worker must be deployed separately. */
(function(){
"use strict";
const API="https://royal-violet-a780.galroland0826.workers.dev";
const KEY="panel-mangadex-links",SIX_HOURS=21600000;
function key(){return typeof K==="function"?K(KEY):KEY}
function links(){try{return JSON.parse(localStorage.getItem(key())||"{}")}catch(e){return {}}}
function save(v){localStorage.setItem(key(),JSON.stringify(v))}
async function api(path){const r=await fetch(API+path,{headers:{Accept:"application/json"}});let data;try{data=await r.json()}catch(e){throw Error("Worker unavailable or not deployed")};if(!r.ok)throw Error(data.error||"HTTP "+r.status);return data}
function n(x){const m=String(x??"").match(/^\d+$/);return m?Number(m[0]):null}
async function sync(s,force){const all=links(),entry=all[s.id];if(!entry)throw Error("Choose a MangaDex title first");if(!force&&Date.now()-(entry.checked||0)<SIX_HOURS)return entry;
 const data=await api("/chapters?id="+encodeURIComponent(entry.id)),map={};
 for(const c of data.chapters||[]){const num=n(c.number);if(num&&c.id&&!map[num])map[num]={id:c.id,title:c.title,group:c.group}}
 if(!Object.keys(map).length)throw Error("No English chapters with readable pages found");
 entry.chapters=map;entry.checked=Date.now();all[s.id]=entry;save(all);
 const latest=Math.max(...Object.keys(map).map(Number));if(latest>s.n){s.n=latest;put(s)}
 return entry}
async function search(s,host){host.textContent="Searching MangaDex…";try{const data=await api("/search?title="+encodeURIComponent(s.t));host.replaceChildren();
 if(!data.items?.length){host.textContent="No MangaDex matches found.";return}
 for(const item of data.items){const btn=el("button","btn ghost",item.title);btn.style.margin="5px";btn.onclick=async()=>{host.textContent="Loading chapter list…";const all=links();all[s.id]={id:item.id,title:item.title,checked:0,chapters:{}};save(all);
 try{const e=await sync(s,true);toast(Object.keys(e.chapters).length+" chapters found");route()}catch(err){host.textContent=err.message}};host.appendChild(btn)}
 }catch(e){host.textContent="Search failed: "+e.message}}
const originalDetail=detail;
detail=function(s,d){originalDetail(s,d);const section=el("section");section.style.marginTop="24px";section.appendChild(el("h2",0,"Online chapters · MangaDex"));
 const entry=links()[s.id];section.appendChild(el("p","set-p",entry?"Connected: "+entry.title+" · "+Object.keys(entry.chapters||{}).length+" chapters":"Connect this title to MangaDex to find available English chapters."));
 const searchBtn=el("button","btn ghost",entry?"Change MangaDex match":"Find on MangaDex"),syncBtn=el("button","btn","Check new chapters"),out=el("div");
 searchBtn.onclick=()=>search(s,out);syncBtn.disabled=!entry;syncBtn.onclick=async()=>{syncBtn.disabled=true;out.textContent="Checking chapters…";try{const e=await sync(s,true);out.textContent=Object.keys(e.chapters).length+" chapters indexed";setTimeout(route,700)}catch(err){out.textContent=err.message}finally{syncBtn.disabled=false}};
 section.append(searchBtn,syncBtn,out);const credit=el("p","set-p","Chapter metadata and pages provided by MangaDex. Credit belongs to the original scanlation groups.");section.appendChild(credit);d.appendChild(section)};
const originalRead=readView;
readView=function(s,ch,d){originalRead(s,ch,d);const entry=links()[s.id],chapter=entry?.chapters?.[ch];if(!chapter)return;
 const host=d.querySelector(".pages");if(!host)return;host.replaceChildren(el("p","set-p","Loading chapter pages…"));
 (async()=>{try{const data=await api("/pages?id="+encodeURIComponent(chapter.id));if(!data.pages?.length)throw Error("No pages available");
 if(!host.isConnected)return;host.replaceChildren();const attribution=el("p","set-p","Pages via MangaDex · Scanlation: "+(chapter.group?.join(", ")||"See MangaDex")+"");host.appendChild(attribution);
 for(const [i,url] of data.pages.entries()){const img=document.createElement("img");img.src=url;img.alt="Page "+(i+1);img.loading=i<2?"eager":"lazy";img.style.cssText="display:block;max-width:100%;width:auto;height:auto;margin:0 auto";img.onerror=()=>{img.replaceWith(el("p","set-p","Page "+(i+1)+" could not load"))};host.appendChild(img)}
 }catch(e){if(host.isConnected)host.replaceChildren(el("p","set-p","Chapter unavailable: "+e.message))}})()};
async function check(){if(!PROF)return;for(const s of LIB){const e=links()[s.id];if(e&&Date.now()-(e.checked||0)>=SIX_HOURS){try{await sync(s,false)}catch(err){console.warn("PANEL MangaDex:",err.message)}}}}
setTimeout(check,4000);setInterval(check,SIX_HOURS);
})();