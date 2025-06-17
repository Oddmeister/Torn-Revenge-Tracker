// ==UserScript==
// @name         Torn Revenge Tracker v2
// @namespace    https://www.torn.com/
// @version      2.2
// @description  Logs attacks, computes a Revenge Score, handles anonymous attackers, responsive UI for mobile/desktop
// @author       You (Oddmeister)
// @homepage     https://github.com/Oddmeister/Torn-Revenge-Tracker
// @supportURL   https://github.com/Oddmeister/Torn-Revenge-Tracker/issues
// @license      MIT
// @match        https://www.torn.com/*
// @match        https://www.torn.com/loader.php?*
// @match        https://m.torn.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Oddmeister/Torn-Revenge-Tracker/main/Torn-Revenge-Tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/Oddmeister/Torn-Revenge-Tracker/main/Torn-Revenge-Tracker.user.js
// ==/UserScript==

(function() {
'use strict';

const API_KEY    = 'oxYFinbnZ3BoZzT8';
const LOG_KEY    = 'revenge_log';
const IGNORE_KEY = 'revenge_ignore';

const isMobile = /Mobi|Android/i.test(navigator.userAgent);
let log        = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
let ignoreList = JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]');

function saveLog() {
localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function saveIgnore() {
localStorage.setItem(IGNORE_KEY, JSON.stringify(ignoreList));
}

function fetchAttackLogs() {
GM_xmlhttpRequest({
method: 'GET',
url: https://api.torn.com/user/?selections=attacks&key=${API_KEY},
onload(resp) {
try {
const data = JSON.parse(resp.responseText);
let added = 0;
if (data.attacks) {
for (const id in data.attacks) {
const a = data.attacks[id];
if ((a.result === 'Mug' || a.result === 'Hospitalize') && a.defender_id === a.userID) {
const attackerId = a.attacker_id || 'anon';
const attackerName = a.attacker_name || 'Anonymous';
const entry = { attackId: ${id}-${attackerId}, attackerId, name: attackerName, type: a.result, money: a.stolen||0, time: a.timestamp };
if (!log.some(e => e.attackId === entry.attackId)) {
log.push(entry);
added++;
}
}
}
}
if (added) saveLog();
} catch(e) { console.error(e); }
}
});
}

function buildScoreList() {
const map = {};
log.forEach(e => {
if (ignoreList.includes(e.attackerId)) return;
if (!map[e.attackerId]) map[e.attackerId] = { id: e.attackerId, name: e.name, mugs:0, hosps:0, money:0, last:0 };
const r = map[e.attackerId];
if (e.type === 'Mug') r.mugs++;
else r.hosps++;
r.money += e.money;
if (e.time > r.last) r.last = e.time;
});
const arr = Object.values(map);
const max = Math.max(...arr.map(r => r.mugs2 + r.hosps + r.money/1e6), 0);
return arr.map(r => ({ ...r, score: r.mugs2 + r.hosps + r.money/1e6, pct: max? (r.mugs*2 + r.hosps + r.money/1e6)/max:0 })).sort((a,b)=>b.score-a.score);
}

function createUI() {
var oldPanel = document.getElementById('rev-panel'); if (oldPanel) oldPanel.remove();
var oldToggle = document.getElementById('rev-toggle'); if (oldToggle) oldToggle.remove();
const data = buildScoreList();
const panel = document.createElement('div'); panel.id='rev-panel';
Object.assign(panel.style, { position:'fixed', right:'20px', top:isMobile?'auto':'60px', bottom:isMobile?'80px':'auto', width:isMobile?'200px':'260px', background:'#222', color:'#ddd', padding:'8px', borderRadius:'6px', zIndex:99999, fontSize:'12px', fontFamily:'Arial', overflowY:isMobile?'auto':'visible', maxHeight:isMobile?'40%':'none' });
panel.innerHTML = <div style='display:flex;justify-content:space-between;align-items:center;'><strong>☠️Revenge List</strong><button id='clear-all' style='background:none;border:none;color:#f66;'>🗑️</button></div><hr style='margin:4px 0;border-top:1px solid #444;'>;
if(!data.length) panel.innerHTML += <div style='text-align:center;color:#666;'>No attackers logged</div>;
data.forEach(r => { const date=new Date(r.last*1000).toLocaleDateString(); panel.innerHTML += <div style='margin-bottom:6px;'><div><strong>${r.name}</strong> (${r.score.toFixed(1)})</div><div style='font-size:11px;color:#aaa;'>M:${r.mugs} H:${r.hosps} $${r.money.toLocaleString()} L:${date}</div></div>; });
document.body.appendChild(panel);
document.getElementById('clear-all').onclick=()=>{ localStorage.removeItem(LOG_KEY); log=[]; createUI(); };
if(isMobile) { const btn=document.createElement('button'); btn.id='rev-toggle'; btn.textContent='☠️'; Object.assign(btn.style,{position:'fixed',bottom:'80px',right:'20px',zIndex:99998,background:'#222',color:'#ddd',border:'none',padding:'8px',borderRadius:'50%',fontSize:'16px',cursor:'pointer'}); btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none'; document.body.appendChild(btn); }
}

window.addEventListener('load',()=>{ fetchAttackLogs(); createUI(); });
})();

