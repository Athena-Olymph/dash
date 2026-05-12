'use strict';
// Sentrium SOC — Per-Client Dashboard JS v8
// Theme, notifications, sparklines, skeletons, mobile menu

let ws = null, reconnectAttempts = 0, lastUpdateTime = null, _timer = null;
const $ = id => document.getElementById(id);

// ═══ THEME ═══
function getTheme() { return localStorage.getItem('soc-theme') || 'dark'; }
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('soc-theme', theme);
    const darkIcon = document.getElementById('theme-icon-dark');
    const lightIcon = document.getElementById('theme-icon-light');
    const label = document.getElementById('theme-label');
    if (theme === 'dark') {
        if (darkIcon) darkIcon.style.display = '';
        if (lightIcon) lightIcon.style.display = 'none';
        if (label) label.textContent = 'Dark Mode';
    } else {
        if (darkIcon) darkIcon.style.display = 'none';
        if (lightIcon) lightIcon.style.display = '';
        if (label) label.textContent = 'Light Mode';
    }
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
(function initTheme() { setTheme(getTheme()); })();

// ═══ MOBILE MENU ═══
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('visible');
    if (hamburger) hamburger.classList.toggle('active');
}
document.getElementById('sidebar-overlay')?.addEventListener('click', toggleMobileMenu);

// ═══ NOTIFICATIONS ═══
function showNotification(title, desc, type) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const icons = {
        success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = icons[type] || icons.info;
    toast.innerHTML += `<div class="toast-content"><div class="toast-title">${esc(title)}</div>${desc ? `<div class="toast-desc">${esc(desc)}</div>` : ''}</div>`;
    toast.innerHTML += '<svg class="toast-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    container.appendChild(toast);
    toast.addEventListener('click', () => dismissToast(toast));
    setTimeout(() => dismissToast(toast), 5000);
}
function dismissToast(toast) {
    if (toast.classList.contains('toast-out')) return;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 350);
}

// ═══ SPARKLINES ═══
function renderSparkline(elId, data, color) {
    const el = document.getElementById(elId);
    if (!el || !data || data.length < 2) { if (el) el.innerHTML = ''; return; }
    const values = data.map(d => d.value || 0);
    const w = 70, h = 38, p = 3;
    const min = Math.min(...values), max = Math.max(...values) || 1;
    const range = max - min || 1;
    const xStep = (w - p * 2) / (values.length - 1);
    const pts = values.map((v, i) => `${(i * xStep + p).toFixed(1)},${(h - p - ((v - min) / range) * (h - p * 2)).toFixed(1)}`);
    const line = pts.join(' ');
    const area = `M${pts[0]} L${pts.slice(1).join(' L')} L${pts[pts.length-1].split(',')[0]},${h - p} L${pts[0].split(',')[0]},${h - p} Z`;
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g-${elId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>
        <path class="sp-area" d="${area}" fill="url(#g-${elId})"/>
        <path class="sp-fill" d="M${line}" stroke="${color}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// ═══ SECTION SWITCHING ═══
function switchSection(sectionId) {
    document.querySelectorAll('.client-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.client-nav-item').forEach(b => b.classList.remove('active'));
    const sec = $(sectionId);
    if (sec) sec.classList.add('active');
    const btn = document.querySelector(`.client-nav-item[data-section="${sectionId}"]`);
    if (btn) btn.classList.add('active');
}

document.querySelectorAll('.client-nav-item[data-section]').forEach(btn =>
    btn.addEventListener('click', () => switchSection(btn.dataset.section))
);

// ═══ PLATFORM NAV VISIBILITY ═══
function applyPlatformNav(platforms) {
    const hasS1 = platforms.includes('SentinelOne');
    const hasAV = platforms.includes('AlienVault');

    const navAlerts = $('nav-alerts');
    const navEdr    = $('nav-edr');

    if (navAlerts) navAlerts.style.display = hasAV ? '' : 'none';
    if (navEdr)    navEdr.style.display    = hasS1 ? '' : 'none';

    const activeSection = document.querySelector('.client-section.active');
    if (activeSection?.id === 'section-edr' && !hasS1) switchSection('section-overview');
    if (activeSection?.id === 'section-alerts' && !hasAV) switchSection('section-overview');
}

// ═══ REST PRE-LOAD ═══
async function preload() {
    try {
        const r = await fetch(`/api/client/${encodeURIComponent(CLIENT_NAME)}/data`);
        if (r.ok) renderClient(await r.json());
    } catch (e) { console.warn('[REST]', e); }
}

// ═══ WEBSOCKET ═══
function connectWS() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
        reconnectAttempts = 0;
        const o = $('reconnect-overlay'); if (o) o.classList.remove('visible');
        showNotification('Connected', 'Real-time updates active', 'success');
    };
    ws.onmessage = e => {
        try {
            const d = JSON.parse(e.data);
            const client = (d.clients || []).find(
                c => c.name.toLowerCase() === CLIENT_NAME.toLowerCase()
            );
            if (client) { renderClient(client); lastUpdateTime = new Date(); tick(); }
            updateSysStatus(d.system_status);
        } catch (err) { console.error('[WS]', err); }
    };
    ws.onclose = () => {
        reconnectAttempts++;
        if (reconnectAttempts > 2) {
            const o = $('reconnect-overlay'); if (o) o.classList.add('visible');
        }
        if (reconnectAttempts === 1) showNotification('Disconnected', 'Attempting to reconnect...', 'warning');
        setTimeout(connectWS, Math.min(reconnectAttempts * 2000, 15000));
    };
    ws.onerror = () => ws.close();
}

// ═══ MAIN RENDER ═══
function renderClient(c) {
    if (!c) return;

    const platforms = c.platforms || [];
    applyPlatformNav(platforms);

    // Sidebar client identity
    const nameEl = $('sidebar-client-name');
    if (nameEl) nameEl.textContent = c.name || CLIENT_NAME;

    const tagsEl = $('sidebar-plat-tags');
    if (tagsEl) tagsEl.innerHTML = platforms.map(p =>
        p === 'SentinelOne'
            ? '<span class="cpill cpill-s1">S1</span>'
            : '<span class="cpill cpill-av">AV</span>'
    ).join('') || '—';

    // Platform strip
    const ppEl = $('plat-pills-strip');
    if (ppEl) ppEl.innerHTML = platforms.map(p =>
        p === 'SentinelOne'
            ? '<span class="cpill cpill-s1">SentinelOne</span>'
            : '<span class="cpill cpill-av">AlienVault</span>'
    ).join('') || '—';

    const psEl = $('plat-stats-strip');
    if (psEl) {
        const parts = [];
        if (platforms.includes('AlienVault'))  parts.push(`AV alarms: <strong>${fmt(c.av_total_alarms || 0)}</strong>`);
        if (platforms.includes('SentinelOne')) parts.push(`S1 threats: <strong>${fmt(c.total_threats || 0)}</strong>`);
        psEl.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    }

    // KPIs
    const avTotal = c.av_total_alarms || 0;
    animNum('kv-alarms',    avTotal);
    animNum('kv-threats',   c.total_threats   || 0);
    animNum('kv-endpoints', c.total_endpoints || 0);
    animNum('kv-blocked',   c.blocked_attempts|| 0);
    animNum('kv-dfir',      c.dfir_cases      || 0);

    // Sparklines
    const timeline = c.event_timeline || [];
    renderSparkline('spark-alarms',    timeline, '#F97316');
    renderSparkline('spark-threats',   timeline, '#818CF8');
    renderSparkline('spark-endpoints', timeline, '#F43F5E');
    renderSparkline('spark-blocked',   timeline, '#22D3EE');
    renderSparkline('spark-dfir',      timeline, '#A78BFA');

    // Hide KPI tiles not applicable
    const kvAlarms    = $('kv-alarms')?.closest('.kpi-tile');
    const kvThreats   = $('kv-threats')?.closest('.kpi-tile');
    const kvEndpoints = $('kv-endpoints')?.closest('.kpi-tile');
    if (kvAlarms)    kvAlarms.style.display    = platforms.includes('AlienVault')  ? '' : 'none';
    if (kvThreats)   kvThreats.style.display   = platforms.includes('SentinelOne') ? '' : 'none';
    if (kvEndpoints) kvEndpoints.style.display = platforms.includes('SentinelOne') ? '' : 'none';

    // Remove skeletons from dash-prio and dash-methods
    const dp = $('dash-prio'); if (dp) dp.innerHTML = '';
    const dm = $('dash-methods'); if (dm) dm.innerHTML = '';

    // Charts
    if (typeof updateEventChart === 'function') updateEventChart(timeline);

    // Overview panels
    renderDashPrio(c.av_priority_breakdown || []);
    renderDashMethods(c.av_method_summary  || []);

    // Alerts nav badge
    const nb = $('nav-alerts-badge');
    if (nb && avTotal > 0) { nb.textContent = fmt(avTotal); nb.style.display = 'inline'; }

    // Alerts section
    const avLbl = $('av-total-lbl');
    if (avLbl) avLbl.textContent = `${fmt(avTotal)} alarms · 24hr window`;
    const listTot = $('av-list-total'); if (listTot) listTot.textContent = fmt(avTotal);

    renderPrioTable(c.av_priority_breakdown  || []);
    renderMethTable(c.av_method_summary      || []);
    renderAssetTable('src-tbody', c.av_top_sources      || []);
    renderAssetTable('dst-tbody', c.av_top_destinations || []);
    renderAlarmLog(c.recent_alerts || []);

    // EDR section
    const s1Alerts = (c.recent_alerts || []).filter(a => a.platform === 'SentinelOne');
    const s1Lbl = $('s1-threat-lbl');
    if (s1Lbl) s1Lbl.textContent = `${fmt(s1Alerts.length)} threats · 24hr window`;
    const edrBadge = $('nav-edr-badge');
    if (edrBadge && s1Alerts.length) { edrBadge.textContent = fmt(s1Alerts.length); edrBadge.style.display = 'inline'; }
    renderS1Table(s1Alerts);
}

// ═══ OVERVIEW PANELS ═══
function renderDashPrio(rows) {
    const el = $('dash-prio'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<p style="color:#3A4A6A;font-size:.8rem;padding:6px 0;">No AV alarm data for this period.</p>'; return; }
    el.innerHTML = rows.map(r => {
        const p = r.priority.toLowerCase();
        const st = r.statuses || {};
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
            <span class="pb pb-${p}" style="min-width:62px;">${esc(r.priority)}</span>
            <span style="font-weight:800;font-size:.95rem;min-width:32px;">${fmt(r.total)}</span>
            <span style="font-size:.7rem;color:#4A5A7A;flex:1;">${st.open||0} open &nbsp;·&nbsp; ${st.closed||0} closed${st.in_review?` &nbsp;·&nbsp; ${st.in_review} review`:''}</span>
        </div>`;
    }).join('');
}

function renderDashMethods(rows) {
    const el = $('dash-methods'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<p style="color:#3A4A6A;font-size:.8rem;padding:6px 0;">No AV alarm data for this period.</p>'; return; }
    const max = rows[0]?.count || 1;
    el.innerHTML = rows.slice(0, 6).map(r => `
        <div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span style="font-size:.8rem;font-weight:600;color:#C8D4F0;">${esc(r.method)}</span>
                <span style="font-size:.76rem;font-weight:800;color:#F97316;">${fmt(r.count)}</span>
            </div>
            <div class="bar-row"><div class="bar-bg"><div class="bar-fill" style="width:${Math.round((r.count/max)*100)}%;"></div></div></div>
        </div>`).join('');
}

// ═══ ALERTS SECTION RENDERERS ═══
function renderPrioTable(rows) {
    const el = $('prio-tbody'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<tr><td colspan="5" class="empty-msg">No alarm data for this period.</td></tr>'; return; }
    el.innerHTML = rows.map(r => {
        const st = r.statuses || {};
        return `<tr>
            <td><span class="pb pb-${r.priority.toLowerCase()}">${esc(r.priority)}</span></td>
            <td style="font-weight:800;">${fmt(r.total)}</td>
            <td>${st.open ? `<span class="sc sc-open">${st.open}</span>` : '—'}</td>
            <td>${st.closed ? `<span class="sc sc-closed">${st.closed}</span>` : '—'}</td>
            <td>${st.in_review ? `<span class="sc sc-review">${st.in_review}</span>` : '—'}</td>
        </tr>`;
    }).join('');
}

function renderMethTable(rows) {
    const el = $('meth-tbody'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<tr><td colspan="4" class="empty-msg">No data.</td></tr>'; return; }
    const max = rows[0]?.count || 1;
    el.innerHTML = rows.slice(0, 15).map(r => `
        <tr>
            <td style="font-weight:600;color:#C8D4F0;">${esc(r.method)}</td>
            <td style="color:#5A6A8A;font-size:.76rem;">${esc(r.strategy || '—')}</td>
            <td style="color:#5A6A8A;font-size:.76rem;">${esc(r.intent || '—')}</td>
            <td style="text-align:right;">
                <div class="bar-row" style="justify-content:flex-end;">
                    <div class="bar-bg" style="width:50px;"><div class="bar-fill" style="width:${Math.round((r.count/max)*100)}%;"></div></div>
                    <span class="bar-cnt">${fmt(r.count)}</span>
                </div>
            </td>
        </tr>`).join('');
}

function renderAssetTable(tbodyId, rows) {
    const el = $(tbodyId); if (!el) return;
    if (!rows.length) { el.innerHTML = '<tr><td colspan="4" class="empty-msg">No data.</td></tr>'; return; }
    el.innerHTML = rows.map((r, i) => `
        <tr>
            <td style="color:#5A6A8A;font-size:.76rem;">${i + 1}</td>
            <td style="font-weight:600;color:#C8D4F0;">${esc(r.asset)}</td>
            <td><span class="asset-cnt">${fmt(r.count)}</span></td>
            <td style="color:#5A6A8A;font-size:.72rem;">${(r.alarm_types || []).slice(0, 2).map(esc).join(', ') || '—'}</td>
        </tr>`).join('');
}

function renderAlarmLog(all) {
    const el = $('alarm-tbody'); if (!el) return;
    const av = all.filter(a => a.platform === 'AlienVault');
    if (!av.length) { el.innerHTML = '<tr><td colspan="6" class="empty-msg">No AlienVault alarms in the 24hr window.</td></tr>'; return; }
    el.innerHTML = av.map(a => {
        const p  = (a.confidence || a.severity || 'low').toLowerCase();
        const st = a.status || 'Closed';
        const stCls = st === 'Open' ? 'sc-open' : st === 'In Review' ? 'sc-review' : 'sc-closed';
        return `<tr>
            <td><div class="alarm-name">${esc(a.alert_type || '—')}</div><div class="alarm-sub">${esc((a.intent && a.strategy) ? `${a.intent} · ${a.strategy}` : (a.intent || a.strategy || ''))}</div></td>
            <td><span class="pb pb-${p}">${esc(p.charAt(0).toUpperCase()+p.slice(1))}</span></td>
            <td><span class="sc ${stCls}">${esc(st)}</span></td>
            <td style="font-size:.78rem;color:#9BAAC8;">${esc(a.source || '—')}</td>
            <td style="font-size:.76rem;color:#4A5A7A;">${esc(a.destination || '—')}</td>
            <td class="alarm-time">${esc(a.reported_at || a.time || '—')}</td>
        </tr>`;
    }).join('');
}

// ═══ EDR (S1) ═══
function renderS1Table(alerts) {
    const el = $('s1-tbody'); if (!el) return;
    if (!alerts.length) { el.innerHTML = '<tr><td colspan="6" class="empty-msg">No SentinelOne threats in the 24hr window.</td></tr>'; return; }
    el.innerHTML = alerts.map(a => {
        const conf = (a.confidence || '').toLowerCase();
        const cCls = conf === 'malicious' ? 'conf-mal' : conf === 'suspicious' ? 'conf-sus' : 'conf-unk';
        const vCls = a.analyst_verdict === 'True Positive' ? 'vb-tp' : a.analyst_verdict === 'False Positive' ? 'vb-fp' : a.analyst_verdict ? 'vb-sus' : 'vb-pen';
        const stCls = a.status === 'Resolved' ? 'sc-closed' : a.status === 'In Progress' ? 'sc-review' : 'sc-open';
        return `<tr>
            <td><div class="alarm-name">${esc(a.alert_type || '—')}</div><div class="alarm-sub">${esc(a.id || '')}</div></td>
            <td><span class="pb ${cCls}">${esc(a.confidence || 'Unknown')}</span></td>
            <td><span class="vb ${vCls}">${esc(a.analyst_verdict || 'Pending')}</span></td>
            <td><span class="sc ${stCls}">${esc(a.status || 'Open')}</span></td>
            <td style="font-size:.78rem;color:#9BAAC8;">${esc(a.source || '—')}</td>
            <td class="alarm-time">${esc(a.reported_at || a.time || '—')}</td>
        </tr>`;
    }).join('');
}

// ═══ SYSTEM STATUS ═══
function updateSysStatus(st) {
    const el = $('system-status'); if (!el) return;
    el.className = 'system-status' + (st === 'degraded' ? ' degraded' : st === 'error' || st === 'unconfigured' ? ' error' : '');
    const txt = el.querySelector('.status-text');
    if (txt) txt.textContent = st === 'degraded' ? 'Partial Connectivity' : st === 'error' || st === 'unconfigured' ? 'Configuration Required' : 'All Systems Operational';
}

// ═══ HELPERS ═══
const _anims = {};
function animNum(id, target) {
    const el = $(id); if (!el) return;
    const start = Number(el.dataset.val) || 0;
    el.dataset.val = target;
    if (_anims[id]) cancelAnimationFrame(_anims[id]);
    const t0 = performance.now();
    (function step(now) {
        const p = Math.min((now - t0) / 700, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(start + (target - start) * e));
        if (p < 1) _anims[id] = requestAnimationFrame(step);
    })(t0);
}

function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function tick() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(() => {
        if (!lastUpdateTime) return;
        const s = Math.floor((Date.now() - lastUpdateTime.getTime()) / 1000);
        const el = $('last-updated');
        if (el) el.textContent = s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
    }, 1000);
}

// ═══ BOOT ═══
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof initEventChart === 'function') initEventChart();
    await preload();
    connectWS();
});
