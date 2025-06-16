// ==UserScript==
// @name         Torn Revenge Tracker v2
// @namespace    https://www.torn.com/
// @version      2.1
// @description  Logs attacks, computes a Revenge Score, shows sorted list with actions and ignore support
// @author       You
// @homepage      https://github.com/Oddmeister/Torn-Revenge-Tracker
// @downloadURL   https://raw.githubusercontent.com/Oddmeister/Torn-Revenge-Tracker/main/Torn-Revenge-Tracker.user.js
// @updateURL     https://raw.githubusercontent.com/Oddmeister/Torn-Revenge-Tracker/main/Torn-Revenge-Tracker.user.js
// @license       MIT
// @match        https://www.torn.com/*
// @match        https://www.torn.com/loader.php?*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const API_KEY    = 'oxYFinbnZ3BoZzT8'; // ← your Torn API key
  const LOG_KEY    = 'revenge_log';
  const IGNORE_KEY = 'revenge_ignore';

  let log        = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  let ignoreList = JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]');

  function saveLog() {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }
  function saveIgnore() {
    localStorage.setItem(IGNORE_KEY, JSON.stringify(ignoreList));
  }
  function showNotification(msg) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed', bottom: '20px', right: '20px',
      background: '#333', color: '#fff', padding: '8px 12px',
      borderRadius: '4px', zIndex: 99999, opacity: 0, transition: 'opacity 0.3s'
    });
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = 1);
    setTimeout(() => {
      toast.style.opacity = 0;
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  }

  function fetchAttackLogs() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.torn.com/user/?selections=attacks&key=${API_KEY}`,
      onload(resp) {
        try {
          const data = JSON.parse(resp.responseText);
          let added = 0;
          if (data.attacks) {
            for (const id in data.attacks) {
              const a = data.attacks[id];
              if ((a.result === 'Mug' || a.result === 'Hospitalize') && a.defender_id === a.userID) {
                const entry = {
                  attackId:   id,
                  attackerId: a.attacker_id,
                  name:       a.attacker_name,
                  type:       a.result,
                  money:      a.stolen || 0,
                  time:       a.timestamp
                };
                if (!log.some(e => e.attackId === entry.attackId)) {
                  log.push(entry);
                  added++;
                }
              }
            }
          }
          if (added) {
            saveLog();
            showNotification(`${added} new event${added>1?'s':''}!`);
          }
        } catch (err) {
          console.error('Parse error:', err);
        }
      }
    });
  }

  function buildScoreList() {
    const map = {};
    log.forEach(e => {
      if (ignoreList.includes(e.attackerId)) return;
      if (!map[e.attackerId]) map[e.attackerId] = {
        id:    e.attackerId,
        name:  e.name,
        mugs:  0,
        hosps: 0,
        money: 0,
        last:  0
      };
      const r = map[e.attackerId];
      if (e.type === 'Mug')       r.mugs++;
      else if (e.type === 'Hospitalize') r.hosps++;
      r.money += e.money;
      if (e.time > r.last) r.last = e.time;
    });

    const arr = Object.values(map);
    const max = Math.max(...arr.map(r => r.mugs*2 + r.hosps + r.money/1e6), 0);

    return arr
      .map(r => ({
        ...r,
        score: r.mugs*2 + r.hosps + r.money/1e6,
        pct:   max ? (r.mugs*2 + r.hosps + r.money/1e6) / max : 0
      }))
      .sort((a, b) => b.score - a.score);
  }

  function createUI() {
    const old = document.getElementById('rev-panel');
    if (old) old.remove();

    const data = buildScoreList();
    const panel = document.createElement('div');
    panel.id = 'rev-panel';
    Object.assign(panel.style, {
      position:        'fixed',
      top:             '60px',
      right:           '20px',
      width:           '260px',
      background:      '#1e1e1e',
      color:           '#ddd',
      padding:         '8px',
      borderRadius:    '6px',
      zIndex:          99999,
      fontFamily:      'Arial, sans-serif',
      fontSize:        '12px',
      boxShadow:       '0 2px 6px rgba(0,0,0,0.7)'
    });

    // Header
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:bold;font-size:14px;">☠️ Revenge List</span>
        <span>
          <button id="show-ignored" title="Show Ignored"
                  style="background:none;border:none;color:#6cf;font-size:14px;cursor:pointer;">👁️</button>
          <button id="clear-all" title="Clear All"
                  style="background:none;border:none;color:#f66;font-size:14px;cursor:pointer;">🗑️</button>
        </span>
      </div>
      <hr style="border:none;border-top:1px solid #444;margin:6px 0;">
    `;

    if (!data.length) {
      panel.innerHTML += `<div style="text-align:center;color:#666;">No attackers logged</div>`;
    } else {
      data.forEach(r => {
        const date = new Date(r.last * 1000)
          .toLocaleDateString(undefined, {month:'short', day:'numeric'});
        panel.innerHTML += `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;">
              <span><strong>${r.name}</strong> <em style="color:#888;">${r.score.toFixed(1)}</em></span>
            </div>
            <div style="font-size:11px;color:#aaa;">
              M:${r.mugs} H:${r.hosps} $:${r.money.toLocaleString()} L:${date}
            </div>
            <div style="background:#333;height:5px;border-radius:3px;overflow:hidden;margin:4px 0;">
              <div style="width:${Math.floor(r.pct * 100)}%;height:100%;background:#6c6;"></div>
            </div>
            <div style="text-align:right;">
              <button data-id="${r.id}" class="btn-attack"
                      style="background:#2a2;color:#cfc;border:none;padding:2px 6px;margin-right:4px;border-radius:3px;cursor:pointer;font-size:11px;">
                Attack
              </button>
              <button data-id="${r.id}" class="btn-bounty"
                      style="background:#2a2;color:#cff;border:none;padding:2px 6px;margin-right:4px;border-radius:3px;cursor:pointer;font-size:11px;">
                Bounty
              </button>
              <button data-id="${r.id}" class="btn-ignore"
                      style="background:none;border:none;color:#f88;cursor:pointer;font-size:11px;">
                ✕
              </button>
            </div>
          </div>
        `;
      });
    }

    document.body.appendChild(panel);

    // Event handlers
    panel.querySelector('#clear-all').onclick = () => {
      if (confirm('Clear all revenge data?')) {
        localStorage.removeItem(LOG_KEY);
        log = [];
        createUI();
      }
    };
    panel.querySelector('#show-ignored').onclick = () => {
      const list = ignoreList.join(', ');
      alert(list ? 'Ignored IDs: ' + list : 'No ignored attackers');
    };
    panel.querySelectorAll('.btn-ignore').forEach(btn => btn.onclick = e => {
      const id = e.target.dataset.id;
      if (!ignoreList.includes(id)) ignoreList.push(id);
      saveIgnore();
      createUI();
    });
    panel.querySelectorAll('.btn-attack').forEach(btn => btn.onclick = e => {
      window.open(`https://www.torn.com/attack.php?XID=${e.target.dataset.id}`, '_blank');
    });
    panel.querySelectorAll('.btn-bounty').forEach(btn => btn.onclick = e => {
      window.open(`https://www.torn.com/bounty.php?ID=${e.target.dataset.id}`, '_blank');
    });
  }

  window.addEventListener('load', () => {
    fetchAttackLogs();
    createUI();
  });
})();
