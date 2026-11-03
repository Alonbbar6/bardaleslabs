// Privacy-friendly analytics beacon + the tracker script served at /t.js.
import { json, text, CORS, readJson, device, browser, host } from "./util.js";
import { isAdmin } from "./auth.js";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|curl|wget|python-requests/i;

export const clientIp = (request) => request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
async function excludedIps(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'exclude_ips'").first().catch(() => null);
  return new Set((r?.value || "").split(",").map(s => s.trim()).filter(Boolean));
}

export async function collect(request, env) {
  if (request.method === "OPTIONS") return text("", 204, CORS);
  const b = await readJson(request);
  if (!b || !b.p) return text("bad request", 400, CORS);
  const ua = request.headers.get("user-agent") || "";
  if (BOT.test(ua)) return text("", 204, CORS);
  // never count the owner: signed-in admin browser, or an IP they excluded in Settings
  if (await isAdmin(request, env)) return text("", 204, CORS);
  if ((await excludedIps(env)).has(clientIp(request))) return text("", 204, CORS);
  const type = b.t === "event" ? "event" : "pageview";
  const path = String(b.u || "/").slice(0, 300), ref = host(b.r || "");
  const pageHost = host(request.headers.get("origin") || request.headers.get("referer") || "");
  await env.DB.prepare("INSERT INTO events (ts, property, type, name, path, referrer, sid, country, device, browser) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(Date.now(), String(b.p).slice(0, 40), type, b.n ? String(b.n).slice(0, 60) : null, path, ref === pageHost ? "" : ref, String(b.sid || "").slice(0, 40), request.cf?.country || "", device(ua), browser(ua)).run();
  return text("", 204, CORS);
}

// Served at /t.js. Usage: <script defer src="https://bardaleslabs.../t.js" data-property="name"></script>
// Tracks page views (incl. SPA pushState) and clicks on [data-track], .btn, mailto: and outbound links.
export const TRACKER = `(function(){
var s=document.currentScript||[].slice.call(document.scripts).pop(),p=(s&&s.getAttribute('data-property'))||location.hostname,
api=(s&&s.src?new URL(s.src).origin:'')+'/api/collect',
sid=(function(){try{var k='_bl_sid',v=sessionStorage.getItem(k);if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(k,v)}return v}catch(e){return ''}})();
if(/bot|crawl|spider|headless/i.test(navigator.userAgent))return;
try{if(localStorage.getItem('_bl_ignore')==='1')return}catch(e){}
function send(d){d.p=p;d.sid=sid;d.u=location.pathname+location.search;d.r=document.referrer;var b=JSON.stringify(d);
if(navigator.sendBeacon){navigator.sendBeacon(api,new Blob([b],{type:'application/json'}))}else{fetch(api,{method:'POST',body:b,headers:{'content-type':'application/json'},keepalive:true}).catch(function(){})}}
var last='';function view(){var u=location.pathname+location.search;if(u===last)return;last=u;send({t:'pageview'})}
view();var ps=history.pushState;history.pushState=function(){ps.apply(this,arguments);setTimeout(view,0)};addEventListener('popstate',view);
addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-track],a,button');if(!a)return;
var n=a.getAttribute('data-track');if(!n){var h=a.getAttribute('href')||'';
if(h.indexOf('mailto:')===0)n='email_click';else if(/^https?:/.test(h)&&h.indexOf(location.host)<0)n='outbound:'+h.replace(/^https?:\\/\\//,'').split('/')[0];
else if(a.classList.contains('btn'))n='cta:'+(a.textContent||'').trim().slice(0,40).toLowerCase()}
if(n)send({t:'event',n:n})},true);
addEventListener('submit',function(e){var f=e.target;send({t:'event',n:'form:'+(f.getAttribute('data-form')!==null?'contact':(f.id||f.getAttribute('name')||'form'))})},true);
window.blTrack=function(n){send({t:'event',n:String(n)})};
})();`;
export const tracker = () => text(TRACKER, 200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=3600", ...CORS });

export { json };
