// Disable Right-Click
document.addEventListener('contextmenu', event => event.preventDefault());

// Disable F12 and common DevTool shortcuts
document.onkeydown = function(e) {
  if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0))) {
    return false;
  }
}; 
const firebaseConfig = { apiKey: "AIzaSyDQVX_gTv-zp-tRAJfhmOAo8utuOAlxSjU", authDomain: "fisat-echo.firebaseapp.com", projectId: "fisat-echo", storageBucket: "fisat-echo.firebasestorage.app", messagingSenderId: "671697672068", appId: "1:671697672068:web:e22a7092e85d47cb8befd1" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
function col(name) { return db.collection(name); }

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

let isAuthenticated = false;
let unsubscribeFns = [];

// Lockout Tracking Function
async function attemptLogin() {
    const email = document.getElementById('login-username').value.trim().toLowerCase();
    const p = document.getElementById('login-password').value;
    const b = document.getElementById('login-btn');
    
    if (!email || !p) { showLoginError('Missing credentials.'); return; }

    // Retrieve lock state for this specific email
    const lockKey = 'echo_admin_lock_' + email;
    let lockData = JSON.parse(localStorage.getItem(lockKey) || '{"fails":0, "lockUntil":0, "permLocked":false}');

    // If temporarily locked
    if (lockData.lockUntil > Date.now()) {
        let mins = Math.ceil((lockData.lockUntil - Date.now()) / 60000);
        showLoginError(`Account temporarily locked. Try again in ${mins} minute(s).`);
        return;
    }

    b.disabled = true; b.innerHTML = 'Verifying...';
    try {
        await auth.signInWithEmailAndPassword(email, p);
        
        // SUCCESS: Clears lock completely. (Even if permLocked, if they manage a successful 
        // login with a new admin-changed password, it automatically clears the lock state.)
        localStorage.removeItem(lockKey);
        
        isAuthenticated = true; sessionStorage.setItem('echo_admin_auth', '1');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        setupListeners(); showToast('Welcome back');
    } catch(e) { 
        // FAILURE logic
        if (lockData.permLocked) {
            // Already permanently locked, block further logic but show the permanent error.
            showLoginError('Account permanently locked due to multiple failed attempts. Please ask the Admin to change your password.');
        } else {
            lockData.fails++;
            
            if (lockData.fails === 3) {
                lockData.lockUntil = Date.now() + 10 * 60 * 1000; // 10 minutes temporary lock
                showLoginError('3 failed attempts. Account locked for 10 minutes.');
            } else if (lockData.fails >= 5) {
                lockData.permLocked = true;
                showLoginError('5 failed attempts. Account permanently locked. Admin must reset.');
            } else {
                let remaining = lockData.fails < 3 ? (3 - lockData.fails) : (5 - lockData.fails);
                let phase = lockData.fails < 3 ? 'until temporary lock' : 'until permanent lock';
                showLoginError(`Incorrect password. ${remaining} attempt(s) remaining ${phase}.`);
            }
            
            // Save state
            localStorage.setItem(lockKey, JSON.stringify(lockData));
        }
        document.getElementById('login-password').value = ''; 
    }
    b.disabled = false; b.innerHTML = 'Sign In';
}

function showLoginError(msg) { document.getElementById('login-error-text').textContent = msg; document.getElementById('login-error').classList.remove('hidden'); }
function logout() { auth.signOut(); isAuthenticated=false; sessionStorage.removeItem('echo_admin_auth'); unsubscribeFns.forEach(f=>f()); unsubscribeFns=[]; document.getElementById('admin-dashboard').classList.add('hidden'); document.getElementById('login-screen').classList.remove('hidden'); showToast('Signed out'); }
function togglePasswordVisibility() { const pw = document.getElementById('login-password'), ico = document.getElementById('pw-eye-icon'); if(pw.type==='password'){ pw.type='text'; ico.className='fas fa-eye-slash text-sm'; } else { pw.type='password'; ico.className='fas fa-eye text-sm'; } }

if(sessionStorage.getItem('echo_admin_auth') === '1') { isAuthenticated=true; document.getElementById('login-screen').classList.add('hidden'); document.getElementById('admin-dashboard').classList.remove('hidden'); setupListeners(); }

const PANELS = ['members', 'achievements', 'activities', 'events', 'messages'];
function showPanel(name) { PANELS.forEach(p=>{ document.getElementById(`panel-${p}`).classList.add('hidden'); document.getElementById(`tab-${p}`)?.classList.remove('active'); }); document.getElementById(`panel-${name}`).classList.remove('hidden'); document.getElementById(`tab-${name}`)?.classList.add('active'); if(name==='messages') markAllRead(); }

// Member Type & Display Formats Logic
function setMemberType(type) { 
    document.getElementById('m-type').value = type; 
    document.getElementById('type-btn-student').classList.toggle('selected', type==='student'); 
    document.getElementById('type-btn-faculty').classList.toggle('selected', type==='faculty'); 
    
    const displayFormatWrap = document.getElementById('wrap-display-format');
    const teamNameWrap = document.getElementById('wrap-team-name');

    if(type === 'student') {
        displayFormatWrap.classList.remove('hidden');
        toggleTeamInput(); 
    } else {
        displayFormatWrap.classList.add('hidden');
        teamNameWrap.classList.add('hidden');
    }
}

function toggleTeamInput() {
    const isTeam = document.getElementById('m-display').value === 'team';
    document.getElementById('wrap-team-name').classList.toggle('hidden', !isTeam);
}

function toggleEditTeamInput() {
    const type = document.getElementById('edit-m-type').value;
    const displayFormatWrap = document.getElementById('wrap-edit-display-format');
    const teamNameWrap = document.getElementById('wrap-edit-team-name');
    
    if(type === 'student') {
        displayFormatWrap.classList.remove('hidden');
        const isTeam = document.getElementById('edit-m-display').value === 'team';
        teamNameWrap.classList.toggle('hidden', !isTeam);
    } else {
        displayFormatWrap.classList.add('hidden');
        teamNameWrap.classList.add('hidden');
    }
}

function populateTeamDatalist(members) {
    const datalist = document.getElementById('existing-teams');
    const teams = new Set();
    members.forEach(m => {
        if (m.memberType !== 'faculty' && m.displayFormat === 'team' && m.teamName) {
            teams.add(m.teamName.trim());
        }
    });
    datalist.innerHTML = Array.from(teams).map(t => `<option value="${escHtml(t)}">`).join('');
}

function setupListeners() {
    unsubscribeFns.forEach(f=>f()); unsubscribeFns=[];
    ['members','achievements','activities','events'].forEach(n => {
        unsubscribeFns.push(col(n).orderBy('timestamp','desc').onSnapshot(s => {
            let items = s.docs.map(d=>({id:d.id,...d.data()}));
            if (n === 'members') {
                items.sort((a,b) => (a.priority||999) - (b.priority||999));
                populateTeamDatalist(items);
            }
            renderAdminList(n, items);
        }));
    });
    unsubscribeFns.push(col('contact_messages').orderBy('timestamp','desc').onSnapshot(s => { const m=s.docs.map(d=>({id:d.id,...d.data()})); renderMessages(m); updateNotifBadge(m); }));
}

function renderAdminList(name, items) {
    const el = document.getElementById(`list-${name}`), cEl = document.getElementById(`count-${name}`);
    if(cEl) cEl.textContent = `(${items.length})`;
    if(!items.length) { el.innerHTML = `<p class="text-center text-gray-400 py-4">No entries.</p>`; return; }
    
    if(name === 'events') {
        el.innerHTML = items.map(i => `<div class="list-row">
            <div class="flex flex-col">
                <span class="font-semibold">${escHtml(i.name)} <span class="text-xs text-brand-orange ml-2">${i.status}</span></span>
                <span class="text-xs text-gray-500">${formatDate(i.date)}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="openEditEventModal('${i.id}')" class="text-brand-orange px-2 hover:underline text-sm"><i class="fas fa-edit"></i></button>
                <button onclick="promptDelete('${name}','${i.id}')" class="text-red-500 px-2 hover:underline text-sm"><i class="fas fa-trash"></i></button>
            </div></div>`).join('');
    } else if (name === 'members') {
        el.innerHTML = items.map(i => {
            let pt = escHtml(i.name || '');
            let st = escHtml(i.role || '');
            
            let badgeHtml = '';
            if(i.memberType === 'faculty') badgeHtml = `<span class="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full ml-1">Faculty</span>`;
            else if (i.displayFormat === 'team') badgeHtml = `<span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full ml-1"><i class="fas fa-users mr-1"></i>${escHtml(i.teamName || 'Team')}</span>`;
            else badgeHtml = `<span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full ml-1">Individual</span>`;

            return `<div class="list-row"><div class="flex flex-col"><span class="font-semibold">${pt} ${badgeHtml}</span><span class="text-xs text-gray-500">${st} (Priority: ${i.priority||999})</span></div>
            <div class="flex gap-2">
                <button onclick="openEditMemberModal('${i.id}')" class="text-brand-orange px-2 hover:underline text-sm"><i class="fas fa-edit"></i></button>
                <button onclick="promptDelete('${name}','${i.id}')" class="text-red-500 px-2 hover:underline text-sm"><i class="fas fa-trash"></i></button>
            </div></div>`;
        }).join('');
    } else if (name === 'achievements') {
        el.innerHTML = items.map(i => {
            let pt = escHtml(i.title || '');
            let st = escHtml(i.names || formatDate(i.date) || '');
            return `<div class="list-row"><div class="flex flex-col"><span class="font-semibold">${pt}</span><span class="text-xs text-gray-500">${st}</span></div>
            <div class="flex gap-2">
                <button onclick="openEditAchievementModal('${i.id}')" class="text-brand-orange px-2 hover:underline text-sm"><i class="fas fa-edit"></i></button>
                <button onclick="promptDelete('${name}','${i.id}')" class="text-red-500 px-2 hover:underline text-sm"><i class="fas fa-trash"></i></button>
            </div></div>`;
        }).join('');
    } else {
        el.innerHTML = items.map(i => {
            let pt = escHtml(i.title || '');
            let st = escHtml(i.names || formatDate(i.date) || '');
            return `<div class="list-row"><div class="flex flex-col"><span class="font-semibold">${pt}</span><span class="text-xs text-gray-500">${st}</span></div>
            <button onclick="promptDelete('${name}','${i.id}')" class="text-red-500 text-sm hover:underline"><i class="fas fa-trash"></i></button></div>`;
        }).join('');
    }
}

function renderMessages(m) {
    document.getElementById('count-messages').textContent = `(${m.length})`;
    document.getElementById('list-messages').innerHTML = m.length ? m.map(msg => `<div class="p-4 border rounded-xl ${msg.read?'bg-white':'bg-brand-orange/5 border-brand-orange/30'}">
        <div class="flex justify-between"><div><span class="font-bold">${escHtml(msg.name)}</span><p class="text-xs text-gray-500">${escHtml(msg.email)}</p></div>
        <button onclick="promptDelete('contact_messages','${msg.id}')" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button></div>
        <p class="mt-2 text-sm">${escHtml(msg.message)}</p></div>`).join('') : '<p class="text-center text-gray-400 py-8">No messages.</p>';
}

function updateNotifBadge(m) { const un=m.filter(x=>!x.read); const b=document.getElementById('notif-badge'); if(un.length){b.textContent=un.length; b.classList.remove('hidden');}else{b.classList.add('hidden');} document.getElementById('notif-list').innerHTML=un.length?un.map(x=>`<div onclick="showPanel('messages');closeNotifPanel();" class="p-4 hover:bg-gray-50 cursor-pointer border-b"><p class="font-bold text-sm">${escHtml(x.name)}</p><p class="text-xs text-gray-500 truncate">${escHtml(x.message)}</p></div>`).join(''):'<p class="text-center py-4 text-gray-400">All caught up</p>'; }
function toggleNotifPanel() { document.getElementById('notif-panel').classList.toggle('hidden'); }
function closeNotifPanel() { document.getElementById('notif-panel').classList.add('hidden'); }
async function markAllRead() { const s = await col('contact_messages').where('read','==',false).get(); const b=db.batch(); s.docs.forEach(d=>b.update(d.ref,{read:true})); await b.commit(); }

async function handleSubmit(e, name) {
    e.preventDefault(); if(!isAuthenticated) return;
    const btn = e.target.querySelector('button[type="submit"]'), oTxt = btn.innerHTML;
    btn.innerHTML='Saving...'; btn.disabled=true;
    let d = { timestamp: firebase.firestore.FieldValue.serverTimestamp() };
    
    if(name==='members'){ 
        d.memberType = document.getElementById('m-type').value;
        d.name = document.getElementById('m-name').value; 
        d.role = document.getElementById('m-role').value; 
        d.image = document.getElementById('m-image').value; 
        d.description = document.getElementById('m-desc').value; 
        d.priority = parseInt(document.getElementById('m-priority').value) || 999;
        d.profileLinkUrl = document.getElementById('m-link-url').value; 
        d.profileLinkType = d.profileLinkUrl ? document.getElementById('m-link-type').value : '';
        
        if (d.memberType === 'student') {
            d.displayFormat = document.getElementById('m-display').value;
            if (d.displayFormat === 'team') {
                d.teamName = document.getElementById('m-team-name').value;
                if(!d.teamName) { showToast('Team Name is required', 'error'); btn.innerHTML=oTxt; btn.disabled=false; return; }
            } else {
                d.teamName = '';
            }
        } else {
            d.displayFormat = 'individual';
            d.teamName = '';
        }
    }
    else if(name==='achievements'){ d.title=document.getElementById('a-title').value; d.names=document.getElementById('a-names').value; d.description=document.getElementById('a-desc').value; d.date=document.getElementById('a-date').value; d.image=document.getElementById('a-image').value; d.link=document.getElementById('a-link').value; }
    else if(name==='activities'){ d.title=document.getElementById('act-title').value; d.date=document.getElementById('act-date').value; d.link=document.getElementById('act-link').value; }
    else if(name==='events'){ d.name=document.getElementById('ev-name').value; d.date=document.getElementById('ev-date').value; d.status=document.getElementById('ev-status').value; d.poster=document.getElementById('ev-poster').value; d.btnLabel=document.getElementById('ev-btn-label').value; d.btnUrl=document.getElementById('ev-btn-url').value; }
    
    try { 
        await col(name).add(d); 
        e.target.reset(); 
        if(name==='members') { 
            setMemberType('student'); 
            document.getElementById('m-priority').value="10"; 
            document.getElementById('m-display').value="individual";
            toggleTeamInput();
        } 
        showToast('Added!'); 
    } catch(err) { showToast('Error','error'); }
    btn.innerHTML=oTxt; btn.disabled=false;
}

let pDel=null;
function promptDelete(c, id) { pDel={c,id}; document.getElementById('delete-modal').classList.remove('hidden'); }
function closeDeleteModal() { pDel=null; document.getElementById('delete-modal').classList.add('hidden'); }
async function executeDelete() { if(!pDel) return; try{ await col(pDel.c).doc(pDel.id).delete(); showToast('Deleted'); } catch(e){} closeDeleteModal(); }

let editEvId=null;
async function openEditEventModal(id) { editEvId=id; const d=(await col('events').doc(id).get()).data(); if(!d)return; document.getElementById('edit-ev-name').value=d.name||''; document.getElementById('edit-ev-date').value=d.date||''; document.getElementById('edit-ev-status').value=d.status||'upcoming'; document.getElementById('edit-ev-poster').value=d.poster||''; document.getElementById('edit-ev-btn-label').value=d.btnLabel||''; document.getElementById('edit-ev-btn-url').value=d.btnUrl||''; document.getElementById('edit-event-modal').classList.remove('hidden'); }
function closeEditEventModal() { editEvId=null; document.getElementById('edit-event-modal').classList.add('hidden'); }
async function saveEditedEvent() { if(!editEvId)return; try{ await col('events').doc(editEvId).update({name:document.getElementById('edit-ev-name').value,date:document.getElementById('edit-ev-date').value,status:document.getElementById('edit-ev-status').value,poster:document.getElementById('edit-ev-poster').value,btnLabel:document.getElementById('edit-ev-btn-label').value,btnUrl:document.getElementById('edit-ev-btn-url').value}); showToast('Updated'); closeEditEventModal(); }catch(e){showToast('Error','error');} }

let editMemberId=null;
async function openEditMemberModal(id) { 
    editMemberId=id; 
    const d=(await col('members').doc(id).get()).data(); 
    if(!d)return; 
    document.getElementById('edit-m-type').value=d.memberType||'student'; 
    document.getElementById('edit-m-priority').value=d.priority||999;
    
    document.getElementById('edit-m-display').value = d.displayFormat || 'individual';
    document.getElementById('edit-m-team-name').value = d.teamName || '';
    toggleEditTeamInput();

    document.getElementById('edit-m-name').value=d.name||''; 
    document.getElementById('edit-m-role').value=d.role||''; 
    document.getElementById('edit-m-image').value=d.image||''; 
    document.getElementById('edit-m-desc').value=d.description||''; 
    document.getElementById('edit-m-link-type').value=d.profileLinkType||'linkedin'; 
    document.getElementById('edit-m-link-url').value=d.profileLinkUrl||''; 
    document.getElementById('edit-member-modal').classList.remove('hidden'); 
}
function closeEditMemberModal() { editMemberId=null; document.getElementById('edit-member-modal').classList.add('hidden'); }
async function saveEditedMember() { 
    if(!editMemberId)return; 
    try{ 
        const memberType = document.getElementById('edit-m-type').value;
        const displayFormat = memberType === 'student' ? document.getElementById('edit-m-display').value : 'individual';
        const teamName = displayFormat === 'team' ? document.getElementById('edit-m-team-name').value : '';

        if (displayFormat === 'team' && !teamName) {
            showToast('Team Name is required', 'error'); return;
        }

        await col('members').doc(editMemberId).update({
            memberType: memberType,
            priority: parseInt(document.getElementById('edit-m-priority').value) || 999,
            displayFormat: displayFormat,
            teamName: teamName,
            name: document.getElementById('edit-m-name').value,
            role: document.getElementById('edit-m-role').value,
            image: document.getElementById('edit-m-image').value,
            description: document.getElementById('edit-m-desc').value,
            profileLinkType: document.getElementById('edit-m-link-type').value,
            profileLinkUrl: document.getElementById('edit-m-link-url').value
        }); 
        showToast('Updated'); 
        closeEditMemberModal(); 
    }catch(e){showToast('Error','error');} 
}

let editAchId=null;
async function openEditAchievementModal(id) { editAchId=id; const d=(await col('achievements').doc(id).get()).data(); if(!d)return; document.getElementById('edit-a-title').value=d.title||''; document.getElementById('edit-a-names').value=d.names||''; document.getElementById('edit-a-date').value=d.date||''; document.getElementById('edit-a-desc').value=d.description||''; document.getElementById('edit-a-image').value=d.image||''; document.getElementById('edit-a-link').value=d.link||''; document.getElementById('edit-achievement-modal').classList.remove('hidden'); }
function closeEditAchievementModal() { editAchId=null; document.getElementById('edit-achievement-modal').classList.add('hidden'); }
async function saveEditedAchievement() { if(!editAchId)return; try{ await col('achievements').doc(editAchId).update({title:document.getElementById('edit-a-title').value,names:document.getElementById('edit-a-names').value,date:document.getElementById('edit-a-date').value,description:document.getElementById('edit-a-desc').value,image:document.getElementById('edit-a-image').value,link:document.getElementById('edit-a-link').value}); showToast('Updated'); closeEditAchievementModal(); }catch(e){showToast('Error','error');} }

// Dedicated theme switch for Admin side only
if(localStorage.getItem('admin_theme')==='dark') document.documentElement.classList.add('dark');
function toggleTheme() { document.documentElement.classList.toggle('dark'); localStorage.setItem('admin_theme', document.documentElement.classList.contains('dark')?'dark':'light'); }

let toastTimer; function showToast(m,t='success'){ const tt=document.getElementById('toast'); document.getElementById('toast-message').textContent=m; document.getElementById('toast-icon').className=t==='error'?'fas fa-times-circle text-red-400 text-xl':'fas fa-check-circle text-brand-orange text-xl'; tt.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>tt.classList.remove('show'),3500); }