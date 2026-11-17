/* PANEL online source integration — unofficial API, best-effort. */
(function(){
"use strict";
const API="https://comix-api.vercel.app";
const KEY="panel-comix-links";
const SIX_HOURS=21600000;
function storageKey(){return typeof K==="function"?K(KEY):KEY}
function getLinks(){try{return JSON.parse(localStorage.getItem(storageKey())||"{}")||{}}catch(e){return {}}}
function saveLinks(x){try{localStorage.setItem(storageKey(),JSON.stringify(x))}catch(e){toast("Browser storage is unavailable")}}
async function request(path){
 const controller=new AbortController(),t=setTimeout(()=>controller.abort(),18000);
 try{const res=await fetch(API+path,{signal:controller.signal,headers:{"Accept":"application/json"}});
 if(!res.ok)throw Error("Source returned HTTP "+res.status+" (the source may require authorization)");
 return await res.json()}finally{clearTimeout(t)}
}
function unwrap(x){if(Array.isArray(x))return x;if(!x||typeof x!=="object")return [];
 for(const k of ["results","items","chapters","manga","comics","list","data"]){if(Array.isArray(x[k]))return x[k]}
 if(x.data)return unwrap(x.data);return []}
function name(x){return x.title||x.name||x.english_title||x.slug||"Untitled"}
function sourceId(x){return String(x.id||x.hid||x.manga_id||x.slug||"")}
function chapterNumber(x){const raw=x.number??x.chapter_number??x.chapter??x.num??x.name??x.title;
 const match=String(raw??"").match(/(?:chapter|ch\.?|#)?\s*(\d+(?:\.\d+)?)/i);return match?Number(match[1]):null}
function chapterId(x){return String(x.chapter_id||x.chapterId||x.id||x.hid||"")}
function chapterMap(list){const map={};for(const item of list){const n=chapterNumber(item),id=chapterId(item);
 if(Number.isInteger(n)&&n>0&&id&&!map[n])map[n]=id}return map}
async function sync(s,force){
 const all=getLinks(),entry=all[s.id];if(!entry)throw Error("Connect a title first");
 if(!force&&Date.now()-(entry.checked||0)<SIX_HOURS)return entry;
 let chapters=[];
 for(let page=1;page<=15;page++){
 const batch=unwrap(await request("/api/manga/"+encodeURIComponent(entry.id)+"/chapters?page="+page+"&limit=100"));
 chapters.push(...batch);if(batch.length<100)break;
 }
 const map=chapterMap(chapters);if(!Object.keys(map).length)throw Error("No readable chapter IDs returned");
 entry.chapters=map;entry.checked=Date.now();all[s.id]=entry;saveLinks(all);
 const latest=Math.max(...Object.keys(map).map(Number));if(latest>s.n){s.n=latest;put(s)}
 return entry
}
async function searchTitle(s,host){
 host.replaceChildren(el("p","set-p","Searching online catalog…"));
 try{const items=unwrap(await request("/api/manga/search?q="+encodeURIComponent(s.t)+"&sfw=true"));
 host.replaceChildren();if(!items.length){host.textContent="No results returned by the source.";return}
 for(const item of items.slice(0,10)){const id=sourceId(item);if(!id)continue;
 const btn=el("button","ch",name(item));btn.style.width="100%";
 btn.onclick=async function(){btn.disabled=true;host.textContent="Connecting and collecting chapters…";
 const links=getLinks();links[s.id]={id:id,title:name(item),checked:0,chapters:{}};saveLinks(links);
 try{const result=await sync(s,true);toast(Object.keys(result.chapters).length+" chapters indexed");route()}
 catch(e){host.textContent="Connected, but chapter retrieval failed: "+e.message}};
 host.appendChild(btn)}
 }catch(e){host.textContent="Online search unavailable: "+e.message}
}
const oldDetail=detail;
detail=function(s,d){oldDetail(s,d);
 const section=el("section");section.style.marginTop="28px";
 section.appendChild(el("h2",0,"Online chapters · Comix"));
 const entry=getLinks()[s.id];
 section.appendChild(el("p","set-p",entry?"Linked to "+entry.title+" · "+Object.keys(entry.chapters||{}).length+" chapters indexed":"Link this title to discover chapters automatically."));
 const controls=el("div","brow"),connect=el("button","btn ghost",entry?"Change source match":"Find on Comix"),refresh=el("button","btn","Check for new chapters"),result=el("div");
 connect.onclick=()=>searchTitle(s,result);
 refresh.disabled=!entry;
 refresh.onclick=async()=>{refresh.disabled=true;result.textContent="Checking chapter list…";
 try{const e=await sync(s,true);result.textContent=Object.keys(e.chapters).length+" chapters available";toast("Chapter list updated");setTimeout(route,700)}
 catch(err){result.textContent="Chapter check failed: "+err.message}finally{refresh.disabled=false}};
 controls.append(connect,refresh);section.append(controls,result);d.appendChild(section)
};
const oldRead=readView;
readView=function(s,ch,d){oldRead(s,ch,d);
 const entry=getLinks()[s.id],chapter=entry&&entry.chapters&&entry.chapters[ch];
 if(!chapter)return;
 const host=d.querySelector(".pages");if(!host)return;
 host.replaceChildren(el("p","set-p","Loading online chapter images…"));
 (async()=>{try{
 const response=await request("/api/manga/read?chapterId="+encodeURIComponent(chapter));
 const candidates=response.images||response.pages||response.data?.images||response.data?.pages||unwrap(response);
 const urls=(Array.isArray(candidates)?candidates:[]).map(x=>typeof x==="string"?x:x.url||x.src||x.image||x.img).filter(Boolean);
 if(!urls.length)throw Error("The source returned no usable images");
 if(!host.isConnected)return;host.replaceChildren();
 for(let i=0;i<urls.length;i++){const u=new URL(urls[i],API);
 if(!["https:","http:"].includes(u.protocol))continue;
 const img=document.createElement("img");img.alt="Page "+(i+1);img.loading=i<2?"eager":"lazy";img.decoding="async";img.style.cssText="display:block;width:100%;height:auto;margin:0 auto";
 img.onerror=function(){const err=el("p","set-p","Page "+(i+1)+" could not load.");img.replaceWith(err)};
 img.src=u.href;host.appendChild(img)}
 }catch(e){if(!host.isConnected)return;host.replaceChildren(el("p","set-p","Online images unavailable: "+e.message));
 const link=el("a","back","Open title on Comix.to");link.href="https://comix.to/comic/"+encodeURIComponent(entry.id);link.target="_blank";link.rel="noopener noreferrer";host.appendChild(link)}
 })()
};
async function checkAll(){if(!PROF||!LIB.length)return;const links=getLinks();
 for(const s of LIB){if(!links[s.id]||Date.now()-(links[s.id].checked||0)<SIX_HOURS)continue;
 try{await sync(s,false)}catch(e){console.warn("PANEL sync:",s.t,e.message)}}
}
setTimeout(checkAll,3000);setInterval(checkAll,SIX_HOURS);
})();