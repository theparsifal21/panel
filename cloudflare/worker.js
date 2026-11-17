// PANEL MangaDex backend. Deploy with Cloudflare Workers (module syntax).
const API="https://api.mangadex.org";
const ORIGIN="https://theparsifal21.github.io";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS={"User-Agent":"PANEL-Reader/1.0 (https://github.com/theparsifal21/panel)","Accept":"application/json"};
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}})}
async function upstream(path){const r=await fetch(API+path,{headers:HEADERS,cf:{cacheTtl:60,cacheEverything:true}});if(!r.ok)throw Error("MangaDex HTTP "+r.status);return r.json()}
async function chapterInfo(id){const d=await upstream("/at-home/server/"+id);if(!d.baseUrl||!d.chapter?.hash)throw Error("No chapter images available");return d}
function safeBase(s){const u=new URL(s);if(u.protocol!=="https:"||!(u.hostname==="mangadex.org"||u.hostname.endsWith(".mangadex.org")||u.hostname==="mangadex.network"||u.hostname.endsWith(".mangadex.network")))throw Error("Invalid image host");return u}
export default {async fetch(req){
 const url=new URL(req.url),origin=req.headers.get("Origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return json({error:"Method not allowed"},405);
 if(origin&&origin!==ORIGIN)return json({error:"Origin not allowed"},403);
 try{
 if(url.pathname==="/health")return json({ok:true,source:"MangaDex",version:1});
 if(url.pathname==="/search"){const title=(url.searchParams.get("title")||"").trim().slice(0,120);if(title.length<2)return json({error:"Enter at least 2 characters"},400);
 const p=new URLSearchParams({title,limit:"12"});p.append("contentRating[]","safe");p.append("contentRating[]","suggestive");
 const d=await upstream("/manga?"+p);return json({items:(d.data||[]).map(x=>({id:x.id,title:x.attributes?.title?.en||Object.values(x.attributes?.title||{})[0]||"Untitled",alt:x.attributes?.altTitles||[]}))})}
 if(url.pathname==="/chapters"){const id=url.searchParams.get("id");if(!UUID.test(id||""))return json({error:"Invalid manga ID"},400);
 let all=[];for(let offset=0;offset<1000;offset+=100){const p=new URLSearchParams({limit:"100",offset:String(offset),"order[chapter]":"asc"});p.append("translatedLanguage[]","en");p.append("includes[]","scanlation_group");
 const d=await upstream("/manga/"+id+"/feed?"+p);all.push(...(d.data||[]));if(all.length>=d.total||(d.data||[]).length<100)break}
 return json({chapters:all.filter(x=>x.attributes?.pages>0&&x.attributes?.externalUrl==null).map(x=>({id:x.id,number:x.attributes?.chapter,title:x.attributes?.title||"",group:(x.relationships||[]).filter(r=>r.type==="scanlation_group").map(r=>r.attributes?.name||r.id)}))})}
 if(url.pathname==="/pages"){const id=url.searchParams.get("id");if(!UUID.test(id||""))return json({error:"Invalid chapter ID"},400);
 const d=await chapterInfo(id);const files=d.chapter.dataSaver?.length?d.chapter.dataSaver:d.chapter.data||[];
 return json({pages:files.map((_,i)=>url.origin+"/image?id="+encodeURIComponent(id)+"&page="+i),credit:"MangaDex"})}
 if(url.pathname==="/image"){const id=url.searchParams.get("id"),n=Number(url.searchParams.get("page"));if(!UUID.test(id||"")||!Number.isInteger(n)||n<0||n>500)return json({error:"Invalid page"},400);
 const d=await chapterInfo(id),files=d.chapter.dataSaver?.length?d.chapter.dataSaver:d.chapter.data||[],file=files[n];if(!file)return json({error:"Page not found"},404);
 const base=safeBase(d.baseUrl),path=(d.chapter.dataSaver?.length?"data-saver":"data")+"/"+encodeURIComponent(d.chapter.hash)+"/"+encodeURIComponent(file);
 const target=new URL(base.href.replace(/\/$/,"")+"/"+path);if(target.origin!==base.origin)throw Error("Invalid image target");
 const r=await fetch(target.toString(),{headers:{"User-Agent":HEADERS["User-Agent"]},cf:{cacheTtl:900,cacheEverything:true}});
 if(!r.ok)return json({error:"Image upstream HTTP "+r.status},502);
 const h=new Headers(cors);h.set("Content-Type",r.headers.get("Content-Type")||"image/jpeg");h.set("Cache-Control","public, max-age=900");return new Response(r.body,{status:200,headers:h})}
 return json({error:"Not found"},404)
 }catch(e){return json({error:String(e.message||e)},502)}
}};