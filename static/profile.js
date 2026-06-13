// ==========================================================================
// PROFILE SYSTEM — Belgian Driving Licence Dashboard
// DYNAMIC: Shumayil (admin) can add/delete/manage all profiles
// Storage: bd_profiles_list (JSON) + bd_<id>_pin + bd_<id>_history
// No two profiles share any data — all keys are profile-namespaced
// ==========================================================================

// ─────────────────────────────────────────────────────
// GRADIENT PALETTE — 10 choices when creating a profile
// ─────────────────────────────────────────────────────
const GRADIENTS = [
    { label:'Purple',  gradient:'linear-gradient(135deg,#7C3AED,#4F46E5)', glow:'rgba(124,58,237,0.45)',   color:'#7C3AED' },
    { label:'Teal',    gradient:'linear-gradient(135deg,#059669,#0891B2)', glow:'rgba(5,150,105,0.45)',    color:'#059669' },
    { label:'Orange',  gradient:'linear-gradient(135deg,#D97706,#DC2626)', glow:'rgba(217,119,6,0.45)',    color:'#D97706' },
    { label:'Pink',    gradient:'linear-gradient(135deg,#DB2777,#9333EA)', glow:'rgba(219,39,119,0.45)',   color:'#DB2777' },
    { label:'Blue',    gradient:'linear-gradient(135deg,#0369A1,#1D4ED8)', glow:'rgba(3,105,161,0.45)',    color:'#0369A1' },
    { label:'Amber',   gradient:'linear-gradient(135deg,#B45309,#7C2D12)', glow:'rgba(180,83,9,0.45)',     color:'#B45309' },
    { label:'Green',   gradient:'linear-gradient(135deg,#0F766E,#065F46)', glow:'rgba(15,118,110,0.45)',   color:'#0F766E' },
    { label:'Violet',  gradient:'linear-gradient(135deg,#7E22CE,#BE185D)', glow:'rgba(126,34,206,0.45)',   color:'#7E22CE' },
    { label:'Rose',    gradient:'linear-gradient(135deg,#E11D48,#9F1239)', glow:'rgba(225,29,72,0.45)',    color:'#E11D48' },
    { label:'Cyan',    gradient:'linear-gradient(135deg,#0891B2,#0E7490)', glow:'rgba(8,145,178,0.45)',    color:'#0891B2' },
];

// ─────────────────────────────────────────────────────
// PROFILE STORAGE — all profiles in one JSON array
// ─────────────────────────────────────────────────────
const PROFILES_KEY = 'bd_profiles_list';

function loadProfiles() {
    try {
        const stored = JSON.parse(localStorage.getItem(PROFILES_KEY));
        if (stored && stored.length > 0) return stored;
    } catch {}
    // First run — seed defaults
    const defaults = [
        { id:'shumayil', name:'Shumayil', initials:'SH', gradientIndex:0, isAdmin:true  },
        { id:'farhan',   name:'Farhan',   initials:'FA', gradientIndex:1 },
        { id:'abdullah', name:'Abdullah', initials:'AB', gradientIndex:2 },
        { id:'shahmir',  name:'Shahmir',  initials:'SM', gradientIndex:3 },
    ];
    persistProfiles(defaults);
    return defaults;
}

function persistProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getProfiles()     { return loadProfiles(); }
function getAdminProfile() { return getProfiles().find(p => p.isAdmin); }

function profileGradient(p) { return GRADIENTS[p.gradientIndex] || GRADIENTS[0]; }

// ─────────────────────────────────────────────────────
// PROFILE CRUD (admin only)
// ─────────────────────────────────────────────────────
function addProfile(name, initials, gradientIndex) {
    const profiles = getProfiles();
    const id = 'p_' + Date.now(); // unique timestamp-based ID
    profiles.push({ id, name: name.trim(), initials: initials.trim().toUpperCase().slice(0,2), gradientIndex });
    persistProfiles(profiles);
    renderProfileScreen();
    renderAdminPanel();
}

function deleteProfile(profileId) {
    const profiles = getProfiles().filter(p => p.id !== profileId);
    persistProfiles(profiles);
    // Clean ALL data for this profile
    ['pin','history','reset_code','reset_expiry'].forEach(type => {
        localStorage.removeItem(`bd_${profileId}_${type}`);
    });
    renderProfileScreen();
    renderAdminPanel();
}

// ─────────────────────────────────────────────────────
// PER-PROFILE STORAGE HELPERS — 100% isolated per profile
// ─────────────────────────────────────────────────────
const pfx     = (id, type) => `bd_${id}_${type}`;
const getPin  = id      => localStorage.getItem(pfx(id,'pin'));
const setPin  = (id,p)  => localStorage.setItem(pfx(id,'pin'), p);
const clearP  = id      => localStorage.removeItem(pfx(id,'pin'));
const hasPin  = id      => !!getPin(id);
const verPin  = (id,p)  => getPin(id) === p;

// ─────────────────────────────────────────────────────
// RESET CODE (admin generates, friend enters)
// ─────────────────────────────────────────────────────
function generateResetCode(profileId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
    localStorage.setItem(pfx(profileId,'reset_code'),   code);
    localStorage.setItem(pfx(profileId,'reset_expiry'), expiry.toString());
    return code;
}

function getActiveResetCode(profileId) {
    const code   = localStorage.getItem(pfx(profileId,'reset_code'));
    const expiry = parseInt(localStorage.getItem(pfx(profileId,'reset_expiry')));
    if (!code || !expiry || Date.now() > expiry) return null;
    return { code, expiry };
}

function verifyResetCode(profileId, input) {
    const a = getActiveResetCode(profileId);
    if (!a || a.code.toUpperCase() !== input.toUpperCase()) return false;
    localStorage.removeItem(pfx(profileId,'reset_code'));
    localStorage.removeItem(pfx(profileId,'reset_expiry'));
    return true;
}

// ─────────────────────────────────────────────────────
// ACTIVE PROFILE (session-scoped)
// ─────────────────────────────────────────────────────
let activeProfileId = null;
const getActiveProfile     = () => activeProfileId;
const getActiveProfileData = () => getProfiles().find(p => p.id === activeProfileId);

// ─────────────────────────────────────────────────────
// HISTORY (called from app.js, fully per-profile)
// ─────────────────────────────────────────────────────
function saveQuizResult(lessonSlug, lessonTitle, score, total) {
    if (!activeProfileId) return;
    const h = getProfileHistory();
    h.unshift({ type:'lesson', lessonSlug, lessonTitle, score, total,
        percentage: Math.round((score/total)*100), date: new Date().toISOString() });
    localStorage.setItem(pfx(activeProfileId,'history'), JSON.stringify(h.slice(0,100)));
    renderHistoryPanel();
    if (typeof renderFullHistoryPage === "function") {
        renderFullHistoryPage();
    }
}

// ─────────────────────────────────────────────────────
// HISTORY (called from app.js, fully per-profile)
// ─────────────────────────────────────────────────────
function saveMockExamResult(score, total) {
    if (!activeProfileId) return;
    const h   = getProfileHistory();
    const pct = Math.round((score/total)*100);
    h.unshift({ type:'mock', score, total, percentage:pct,
        passed: pct >= 80, date: new Date().toISOString() });
    localStorage.setItem(pfx(activeProfileId,'history'), JSON.stringify(h.slice(0,100)));
    renderHistoryPanel();
    if (typeof renderFullHistoryPage === "function") {
        renderFullHistoryPage();
    }
}

function getProfileHistory(profileId) {
    const id = profileId || activeProfileId;
    if (!id) return [];
    try { return JSON.parse(localStorage.getItem(pfx(id,'history'))) || []; }
    catch { return []; }
}

// ─────────────────────────────────────────────────────
// PIN MODAL STATE
// ─────────────────────────────────────────────────────
let pinMode       = 'enter'; // enter | setup | confirm | forgot
let pinProfileId  = null;
let pinBuf        = '';
let pinFirst      = '';
let pinFails      = 0;
let adminTimer    = null;

// ─────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────
function renderProfileScreen() {
    const cards = document.getElementById('profile-cards');
    if (!cards) return;
    const profiles = getProfiles();

    cards.innerHTML = profiles.map(p => {
        const g    = profileGradient(p);
        const hp   = hasPin(p.id);
        const hist = getProfileHistory(p.id);
        const last = hist[0];
        let lastActivity = `<span class="prof-no-activity">No activity yet</span>`;
        if (last) {
            const when = relDate(last.date);
            if (last.type === 'mock') {
                const cls = last.passed ? 'prof-badge-pass' : 'prof-badge-fail';
                lastActivity = `<span class="prof-badge ${cls}">${last.passed?'PASS':'FAIL'}</span> Mock ${last.percentage}% · ${when}`;
            } else {
                const title = (last.lessonTitle||'').split(' ').slice(0,3).join(' ');
                lastActivity = `<i class="fa-solid fa-book-open" style="font-size:10px"></i> ${title} ${last.percentage}% · ${when}`;
            }
        }
        const crown = p.isAdmin ? `<div class="prof-crown"><i class="fa-solid fa-crown"></i> Admin</div>` : '';
        return `
        <div class="prof-card" onclick="selectProfile('${p.id}')">
            ${crown}
            <div class="prof-avatar" style="background:${g.gradient};box-shadow:0 12px 40px ${g.glow}">${p.initials}</div>
            <div class="prof-name">${p.name}</div>
            <div class="prof-pin-status">
                <i class="fa-solid ${hp?'fa-lock':'fa-lock-open'}"></i>
                ${hp ? 'PIN protected' : 'Set up PIN'}
            </div>
            <div class="prof-last-activity">${lastActivity}</div>
        </div>`;
    }).join('');

    if (!activeProfileId) {
        document.getElementById('profile-screen').classList.remove('hidden');
    }
}

// ─────────────────────────────────────────────────────
// PIN MODAL
// ─────────────────────────────────────────────────────
function selectProfile(profileId) {
    pinProfileId = profileId;
    pinBuf = ''; pinFirst = ''; pinFails = 0;
    const profile = getProfiles().find(p => p.id === profileId);
    const g       = profileGradient(profile);
    if (hasPin(profileId)) {
        pinMode = 'enter';
        openPinModal(profile, g, 'Enter your PIN', '');
    } else {
        pinMode = 'setup';
        openPinModal(profile, g, 'Create your PIN', 'Choose a 4-digit PIN to protect your profile');
    }
}

function openPinModal(profile, g, title, subtitle) {
    const el = id => document.getElementById(id);
    el('pm-avatar').style.background  = g.gradient;
    el('pm-avatar').style.boxShadow   = `0 12px 40px ${g.glow}`;
    el('pm-avatar').textContent       = profile.initials;
    el('pm-name').textContent         = profile.name;
    el('pm-title').textContent        = title;
    el('pm-subtitle').textContent     = subtitle;
    el('pm-error').textContent        = '';
    el('pm-forgot-wrap').style.display     = pinMode === 'enter' ? 'block' : 'none';
    el('pm-reset-panel').style.display     = 'none';
    el('pm-numpad-wrap').style.display     = 'grid';
    pinBuf = ''; updateDots();
    el('pin-modal').classList.remove('hidden');
    requestAnimationFrame(() => el('pin-modal').classList.add('pm-show'));
}

function closePinModal() {
    const modal = document.getElementById('pin-modal');
    modal.classList.remove('pm-show');
    setTimeout(() => modal.classList.add('hidden'), 280);
    pinBuf = ''; pinFirst = ''; pinFails = 0;
    const rp = document.getElementById('pm-reset-panel');
    if (rp) { rp.style.display = 'none'; document.getElementById('pm-reset-input').value = ''; }
}

function updateDots() {
    document.querySelectorAll('.pm-dot').forEach((d,i) => d.classList.toggle('pm-dot-filled', i < pinBuf.length));
}

function pinInput(digit) {
    if (document.getElementById('pm-reset-panel').style.display === 'block') return;
    if (pinBuf.length >= 4) return;
    pinBuf += digit; updateDots();
    if (pinBuf.length === 4) setTimeout(handlePin, 220);
}

function pinBackspace() {
    if (document.getElementById('pm-reset-panel').style.display === 'block') return;
    pinBuf = pinBuf.slice(0,-1); updateDots();
}

function handlePin() {
    const errEl = document.getElementById('pm-error');
    if (pinMode === 'enter') {
        if (verPin(pinProfileId, pinBuf)) { pinFails=0; activateProfile(pinProfileId); }
        else {
            pinFails++; pinBuf=''; updateDots();
            errEl.textContent = 'Incorrect PIN. Try again.';
            if (pinFails >= 2) document.getElementById('pm-forgot-wrap').style.display = 'block';
            shakeDots();
        }
    } else if (pinMode === 'setup') {
        pinFirst = pinBuf; pinBuf = ''; pinMode = 'confirm'; updateDots();
        document.getElementById('pm-title').textContent    = 'Confirm your PIN';
        document.getElementById('pm-subtitle').textContent = 'Enter the same PIN again';
        errEl.textContent = '';
    } else if (pinMode === 'confirm') {
        if (pinBuf === pinFirst) {
            setPin(pinProfileId, pinBuf);
            activateProfile(pinProfileId);
        } else {
            pinBuf=''; pinFirst=''; pinMode='setup'; updateDots();
            document.getElementById('pm-title').textContent    = 'Create your PIN';
            document.getElementById('pm-subtitle').textContent = "PINs didn't match — try again";
            errEl.textContent = '';
            shakeDots();
        }
    }
}

function shakeDots() {
    const w = document.querySelector('.pm-dots');
    w.classList.add('pm-shake');
    setTimeout(() => w.classList.remove('pm-shake'), 500);
}

// ─────────────────────────────────────────────────────
// FORGOT PIN / RESET CODE FLOW
// ─────────────────────────────────────────────────────
function showForgotPin() {
    document.getElementById('pm-reset-panel').style.display  = 'block';
    document.getElementById('pm-numpad-wrap').style.display  = 'none';
    document.getElementById('pm-forgot-wrap').style.display  = 'none';
    document.getElementById('pm-reset-input').value          = '';
    document.getElementById('pm-reset-error').textContent    = '';
    document.getElementById('pm-error').textContent          = '';
    pinBuf = ''; updateDots();
    setTimeout(() => document.getElementById('pm-reset-input').focus(), 100);
}

function cancelForgotPin() {
    document.getElementById('pm-reset-panel').style.display = 'none';
    document.getElementById('pm-numpad-wrap').style.display = 'grid';
    document.getElementById('pm-forgot-wrap').style.display = pinFails >= 2 ? 'block' : 'none';
    document.getElementById('pm-reset-error').textContent   = '';
}

function submitResetCode() {
    const input   = (document.getElementById('pm-reset-input').value || '').trim().toUpperCase();
    const errorEl = document.getElementById('pm-reset-error');
    if (!input) { errorEl.textContent = 'Please enter the reset code.'; return; }
    if (verifyResetCode(pinProfileId, input)) {
        clearP(pinProfileId);
        document.getElementById('pm-reset-panel').style.display = 'none';
        document.getElementById('pm-numpad-wrap').style.display = 'grid';
        pinBuf=''; pinFirst=''; pinMode='setup'; updateDots();
        document.getElementById('pm-title').textContent    = '🎉 Set new PIN';
        document.getElementById('pm-subtitle').textContent = 'Reset successful! Choose your new PIN';
        document.getElementById('pm-error').textContent    = '';
        document.getElementById('pm-forgot-wrap').style.display = 'none';
        renderProfileScreen();
    } else {
        errorEl.textContent = 'Invalid or expired code. Ask Shumayil to generate a new one.';
        document.getElementById('pm-reset-input').value = '';
    }
}

// ─────────────────────────────────────────────────────
// ACTIVATE PROFILE
// ─────────────────────────────────────────────────────
function applyProfileTheme(profile) {
    if (!profile) {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--primary-hover');
        document.documentElement.style.removeProperty('--primary-glow');
        document.documentElement.style.removeProperty('--border-color-active');
        return;
    }
    const g = profileGradient(profile);
    document.documentElement.style.setProperty('--primary', g.color);
    document.documentElement.style.setProperty('--primary-glow', g.glow);
    document.documentElement.style.setProperty('--primary-hover', g.color + 'dd');
    document.documentElement.style.setProperty('--border-color-active', g.color + '66');
}

function changeProfileGradient(gradientIndex) {
    const profile = getActiveProfileData();
    if (!profile) return;
    profile.gradientIndex = gradientIndex;
    
    // Save updated profiles list
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx !== -1) {
        profiles[idx].gradientIndex = gradientIndex;
        persistProfiles(profiles);
    }
    
    // Apply theme
    applyProfileTheme(profile);
    
    // Re-render components to reflect new color
    updateProfileBadge();
    renderProfileScreen();
    renderAdminPanel();
}

function activateProfile(profileId) {
    activeProfileId = profileId;
    closePinModal();
    setTimeout(() => {
        document.getElementById('profile-screen').classList.add('hidden');
        const profile = getActiveProfileData();
        applyProfileTheme(profile);
        updateProfileBadge();
        renderHistoryPanel();
        renderAdminPanel();
    }, 320);
}

function switchProfile() {
    activeProfileId = null;
    clearInterval(adminTimer);
    applyProfileTheme(null);
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('profile-badge-wrap').style.display = 'none';
    renderProfileScreen();
}

// ─────────────────────────────────────────────────────
// PROFILE BADGE (sidebar)
// ─────────────────────────────────────────────────────
function updateProfileBadge() {
    const profile = getActiveProfileData();
    const wrap    = document.getElementById('profile-badge-wrap');
    const badge   = document.getElementById('profile-badge');
    const dots    = document.getElementById('pb-theme-picker-dots');
    if (!profile || !wrap || !badge || !dots) return;
    const g = profileGradient(profile);
    
    badge.innerHTML = `
        <div class="pb-avatar" style="background:${g.gradient}">${profile.initials}</div>
        <span class="pb-name">${profile.name}${profile.isAdmin ? ' <i class="fa-solid fa-crown" style="color:#f59e0b;font-size:10px;margin-left:3px"></i>' : ''}</span>
        <button class="pb-switch" onclick="switchProfile()" title="Switch profile">
            <i class="fa-solid fa-right-from-bracket"></i>
        </button>`;
        
    dots.innerHTML = GRADIENTS.map((gr, idx) => `
        <div class="pb-theme-dot ${idx === profile.gradientIndex ? 'active' : ''}"
             style="background:${gr.gradient}"
             onclick="changeProfileGradient(${idx})"
             title="${gr.label}"></div>
    `).join('');
    
    wrap.style.display = 'flex';
}

// ─────────────────────────────────────────────────────
// ADMIN PANEL (only for admin profile)
// ─────────────────────────────────────────────────────
let isAdminPanelCollapsed = localStorage.getItem('bd_admin_collapsed') === 'true';

function toggleAdminPanelCollapse() {
    isAdminPanelCollapsed = !isAdminPanelCollapsed;
    localStorage.setItem('bd_admin_collapsed', isAdminPanelCollapsed ? 'true' : 'false');
    applyAdminPanelCollapse();
}

function applyAdminPanelCollapse() {
    const list = document.getElementById('admin-panel-list');
    const icon = document.querySelector('.adm-toggle-icon');
    const panel = document.getElementById('admin-panel');
    if (!list || !panel) return;
    
    if (isAdminPanelCollapsed) {
        list.style.display = 'none';
        panel.classList.add('adm-collapsed');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    } else {
        list.style.display = 'flex';
        panel.classList.remove('adm-collapsed');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function renderAdminPanel() {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    const ap = getAdminProfile();
    if (!ap || activeProfileId !== ap.id) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    const list     = document.getElementById('admin-panel-list');
    const profiles = getProfiles().filter(p => !p.isAdmin);

    list.innerHTML = profiles.map(p => {
        const g      = profileGradient(p);
        const hp     = hasPin(p.id);
        const active = getActiveResetCode(p.id);
        return `
        <div class="adm-row" id="adm-row-${p.id}">
            <div class="adm-info">
                <div class="adm-avatar" style="background:${g.gradient}">${p.initials}</div>
                <div>
                    <div class="adm-name">${p.name}</div>
                    <div class="adm-status">
                        <i class="fa-solid ${hp?'fa-lock':'fa-lock-open'}"></i>
                        ${hp ? 'PIN set' : 'No PIN'}
                    </div>
                </div>
            </div>
            <div class="adm-actions">
                ${active
                    ? `<div class="adm-code-box">
                        <span class="adm-code">${active.code}</span>
                        <button class="adm-copy" onclick="copyCode('${active.code}',this)" title="Copy code">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                       </div>
                       <div class="adm-expires">Expires <span class="adm-timer" data-expiry="${active.expiry}"></span></div>`
                    : `<button class="adm-gen-btn" onclick="adminGenCode('${p.id}')">
                        <i class="fa-solid fa-key"></i> Reset Code
                       </button>`
                }
                <button class="adm-del-btn" onclick="confirmDeleteProfile('${p.id}','${p.name}')" title="Delete profile">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    clearInterval(adminTimer);
    adminTimer = setInterval(tickTimers, 1000);
    tickTimers();
    
    applyAdminPanelCollapse();
}

function tickTimers() {
    let anyExpired = false;
    document.querySelectorAll('.adm-timer[data-expiry]').forEach(el => {
        const rem  = Math.max(0, parseInt(el.dataset.expiry) - Date.now());
        const mins = Math.floor(rem / 60000);
        const secs = Math.floor((rem % 60000) / 1000);
        el.textContent = `in ${mins}:${secs.toString().padStart(2,'0')}`;
        if (rem <= 0) anyExpired = true;
    });
    if (anyExpired) renderAdminPanel();
}

function adminGenCode(profileId) {
    generateResetCode(profileId);
    renderAdminPanel();
}

function copyCode(code, btn) {
    navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        btn.classList.add('adm-copy-ok');
        setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy"></i>'; btn.classList.remove('adm-copy-ok'); }, 2000);
    }).catch(() => {
        // Fallback: prompt to copy manually
        prompt('Copy this reset code:', code);
    });
}

function confirmDeleteProfile(profileId, name) {
    if (confirm(`Delete "${name}"?\n\nThis will permanently erase their PIN, quiz history, and all progress. This cannot be undone.`)) {
        deleteProfile(profileId);
    }
}

// ─────────────────────────────────────────────────────
// ADD PROFILE MODAL
// ─────────────────────────────────────────────────────
let selectedGradientIndex = 0;

function openAddProfileModal() {
    document.getElementById('ap-name').value     = '';
    document.getElementById('ap-initials').value = '';
    document.getElementById('ap-error').textContent = '';
    selectedGradientIndex = 0;
    renderGradientPicker();
    document.getElementById('add-profile-modal').classList.remove('hidden');
    requestAnimationFrame(() => document.getElementById('add-profile-modal').classList.add('ap-show'));
    setTimeout(() => document.getElementById('ap-name').focus(), 100);
}

function closeAddProfileModal() {
    const modal = document.getElementById('add-profile-modal');
    modal.classList.remove('ap-show');
    setTimeout(() => modal.classList.add('hidden'), 280);
}

function renderGradientPicker() {
    const picker = document.getElementById('ap-gradient-picker');
    picker.innerHTML = GRADIENTS.map((g, i) => `
        <div class="ap-color ${i === selectedGradientIndex ? 'ap-color-selected' : ''}"
             style="background:${g.gradient}"
             onclick="selectGradient(${i})"
             title="${g.label}"></div>
    `).join('');
}

function selectGradient(index) {
    selectedGradientIndex = index;
    renderGradientPicker();
    // Update preview avatar
    const g = GRADIENTS[index];
    const avatar = document.getElementById('ap-preview-avatar');
    avatar.style.background = g.gradient;
    avatar.style.boxShadow  = `0 8px 24px ${g.glow}`;
}

function autoFillInitials() {
    const name     = (document.getElementById('ap-name').value || '').trim();
    const initials = document.getElementById('ap-initials');
    if (!initials.dataset.manual) {
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
            initials.value = (words[0][0] + words[1][0]).toUpperCase();
        } else if (words.length === 1 && words[0].length >= 2) {
            initials.value = words[0].slice(0,2).toUpperCase();
        } else {
            initials.value = (name.slice(0,2)).toUpperCase();
        }
        // Update preview
        document.getElementById('ap-preview-avatar').textContent = initials.value;
    }
}

function submitAddProfile() {
    const name     = (document.getElementById('ap-name').value || '').trim();
    const initials = (document.getElementById('ap-initials').value || '').trim().toUpperCase().slice(0,2);
    const errEl    = document.getElementById('ap-error');

    if (!name)     { errEl.textContent = 'Please enter a name.';     return; }
    if (!initials) { errEl.textContent = 'Please enter initials.';   return; }
    if (name.length < 2)    { errEl.textContent = 'Name must be at least 2 characters.'; return; }

    addProfile(name, initials, selectedGradientIndex);
    closeAddProfileModal();
}

// ─────────────────────────────────────────────────────
// HISTORY PANEL (sidebar)
// ─────────────────────────────────────────────────────
function renderHistoryPanel() {
    const container = document.getElementById('history-panel');
    if (!container) return;
    const history = getProfileHistory();
    if (history.length === 0) {
        container.innerHTML = `<div class="hist-empty"><i class="fa-regular fa-clock"></i><span>No quiz history yet</span></div>`;
        return;
    }
    container.innerHTML = history.slice(0, 8).map(h => {
        const date = new Date(h.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
        const cls  = h.percentage >= 80 ? 'hist-good' : h.percentage >= 60 ? 'hist-ok' : 'hist-bad';
        const icon = h.type === 'mock' ? 'fa-graduation-cap' : 'fa-book-open';
        const name = h.type === 'mock' ? 'Mock Exam' : (h.lessonTitle||'').split(' ').slice(0,3).join(' ');
        return `
        <div class="hist-item ${cls}">
            <i class="fa-solid ${icon} hist-icon"></i>
            <div class="hist-info"><div class="hist-name">${name}</div><div class="hist-date">${date}</div></div>
            <div class="hist-score"><span class="hist-pct">${h.percentage}%</span><span class="hist-frac">${h.score}/${h.total}</span></div>
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────
function relDate(dateStr) {
    const d = new Date(dateStr), now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Keyboard shortcuts in modals
    const resetInp = document.getElementById('pm-reset-input');
    if (resetInp) resetInp.addEventListener('keydown', e => { if (e.key === 'Enter') submitResetCode(); });

    const nameInp = document.getElementById('ap-name');
    if (nameInp) {
        nameInp.addEventListener('input', autoFillInitials);
        nameInp.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('ap-initials').focus(); });
    }
    const initialsInp = document.getElementById('ap-initials');
    if (initialsInp) {
        initialsInp.addEventListener('input', () => {
            initialsInp.dataset.manual = 'true';
            document.getElementById('ap-preview-avatar').textContent = initialsInp.value.toUpperCase().slice(0,2);
        });
        initialsInp.addEventListener('keydown', e => { if (e.key === 'Enter') submitAddProfile(); });
    }

    renderProfileScreen();
});
