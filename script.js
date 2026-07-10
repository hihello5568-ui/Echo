// Disable Right-Click
document.addEventListener('contextmenu', event => event.preventDefault());

// Disable F12 and common DevTool shortcuts
document.onkeydown = function(e) {
  if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0))) {
    return false;
  }
};
// ================================================================
// SECTION A — FIREBASE & UTILITIES
// ================================================================
const firebaseConfig = {
    apiKey:            "AIzaSyDQVX_gTv-zp-tRAJfhmOAo8utuOAlxSjU",
    authDomain:        "fisat-echo.firebaseapp.com",
    projectId:         "fisat-echo",
    storageBucket:     "fisat-echo.firebasestorage.app",
    messagingSenderId: "671697672068",
    appId:             "1:671697672068:web:e22a7092e85d47cb8befd1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
function col(name) { return db.collection(name); }

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function avatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=F59E0B&color=fff`;
}

function formatDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

// ================================================================
// SECTION B — APP STATE & LISTENERS
// ================================================================
const state = { members: [], achievements: [], activities: [], events: [], teamsData: {}, achievementsDirty: false };

function setupRealtimeListeners() {
    col('members').orderBy('timestamp', 'desc').onSnapshot(
        snap => { state.members = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderMembers(); },
        err => console.error('[ECHO] Members error:', err)
    );
    col('achievements').orderBy('timestamp', 'desc').onSnapshot(
        snap => { 
            state.achievements = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            state.achievementsDirty = true;
            renderAchievements(); 
        },
        err => console.error('[ECHO] Achievements error:', err)
    );
    col('activities').orderBy('timestamp', 'desc').onSnapshot(
        snap => { state.activities = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderActivities(); },
        err => console.error('[ECHO] Activities error:', err)
    );
    col('events').orderBy('timestamp', 'desc').onSnapshot(
        snap => { state.events = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderEvents(); },
        err => console.error('[ECHO] Events error:', err)
    );
}

setupRealtimeListeners();

// ================================================================
// SECTION C — RENDER FUNCTIONS
// ================================================================

function generateMemberCardHtml(m, i, isReveal = false) {
    const hasLink = !!m.profileLinkUrl;
    let badgeIcon = 'fas fa-link', badgeClass = 'portfolio', tooltipText = m.name;
    if(hasLink) {
        if(m.profileLinkType === 'linkedin') { badgeIcon = 'fab fa-linkedin-in'; badgeClass = 'linkedin'; tooltipText = 'View LinkedIn'; }
        else if(m.profileLinkType === 'portfolio') { badgeIcon = 'fas fa-briefcase'; badgeClass = 'portfolio'; tooltipText = 'View Portfolio'; }
        else if(m.profileLinkType === 'college') { badgeIcon = 'fas fa-university'; badgeClass = 'college'; tooltipText = 'College Profile'; }
    }
    
    const animationClasses = isReveal ? 'glow-card reveal' : 'hover:-translate-y-1 hover:shadow-lg transition-all duration-300';
    const transitionStyle = isReveal ? `style="transition-delay:${i * 80}ms;"` : '';

    return `
    <div class="member-card-wrapper bg-white dark:bg-brand-card rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-4 group ${hasLink ? 'has-link' : ''} ${animationClasses}" ${transitionStyle} ${hasLink ? `onclick="window.open('${escHtml(m.profileLinkUrl)}','_blank','noopener')"` : ''}>
        ${hasLink ? `<div class="profile-badge ${badgeClass}"><i class="${badgeIcon} text-xs"></i></div><div class="member-tooltip">${tooltipText}</div>` : ''}
        
        <div class="member-img-wrap w-20 h-20 sm:w-16 sm:h-16 rounded-full flex-shrink-0 border-2 border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden order-first sm:order-last mb-2 sm:mb-0">
            <img src="${escHtml(m.image || avatarUrl(m.name))}" alt="${escHtml(m.name)}" class="absolute inset-0 w-full h-full object-cover object-top" onerror="this.src='${avatarUrl(m.name)}'">
        </div>

        <div class="flex-1 min-w-0 text-center sm:text-left w-full">
            <h3 class="text-base sm:text-lg font-bold group-hover:text-brand-orange transition-colors break-words whitespace-normal leading-tight">${escHtml(m.name)}</h3>
            <p class="text-xs sm:text-sm text-brand-orange font-medium mt-1 break-words whitespace-normal leading-tight">${escHtml(m.role)}</p>
        </div>
    </div>`;
}

function renderMembers() {
    const faculty  = state.members.filter(m => m.memberType === 'faculty').sort((a,b) => (a.priority||999) - (b.priority||999));
    const students = state.members.filter(m => m.memberType !== 'faculty').sort((a,b) => (a.priority||999) - (b.priority||999));

    const individuals = students.filter(m => m.displayFormat !== 'team');
    const teamMembers = students.filter(m => m.displayFormat === 'team');
    
    state.teamsData = {};
    teamMembers.forEach(m => {
        const tName = m.teamName || 'Other Team';
        if(!state.teamsData[tName]) state.teamsData[tName] = [];
        state.teamsData[tName].push(m);
    });

    const mentorSection   = document.getElementById('mentors-section');
    const mentorsGrid     = document.getElementById('mentors-grid');
    const studentsSection = document.getElementById('students-section');
    const membersGrid     = document.getElementById('members-grid');

    studentsSection.classList.remove('hidden');
    if (students.length === 0) {
        membersGrid.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">No team members added yet.</div>`;
    } else {
        let htmlContent = '';

        if (individuals.length > 0) {
            htmlContent += individuals.map((m, i) => generateMemberCardHtml(m, i, true)).join('');
        }

        const teamNames = Object.keys(state.teamsData);
        if (teamNames.length > 0) {
            const teamsCardsHtml = teamNames.map((tName, i) => {
                const team = state.teamsData[tName];
                const displayAvatars = team.slice(0, 4).map(m => `<img src="${escHtml(m.image || avatarUrl(m.name))}" class="w-10 h-10 rounded-full border-2 border-white dark:border-brand-card -ml-3 first:ml-0 object-cover" onerror="this.src='${avatarUrl(m.name)}'">`).join('');
                const extraCount = team.length > 4 ? `<div class="w-10 h-10 rounded-full border-2 border-white dark:border-brand-card bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold -ml-3 z-10">+${team.length-4}</div>` : '';
                
                // Changed from flex-row to flex-col on mobile so text has full width, ensuring all boxes are same height via h-full.
                return `
                <div class="h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-brand-card dark:to-[#172033] rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-brand-orange transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group reveal" style="transition-delay:${i * 80}ms;" onclick="openTeamModal('${escHtml(tName)}')">
                    <div class="w-full sm:w-auto sm:flex-1 pr-0 sm:pr-2 min-w-0">
                        <h3 class="text-lg sm:text-xl font-bold mb-1.5 text-gray-800 dark:text-gray-100 group-hover:text-brand-orange transition-colors break-words line-clamp-2">${escHtml(tName)}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">${team.length} Member${team.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pl-0 sm:pl-3 flex-shrink-0">
                        <div class="flex flex-shrink-0">${displayAvatars}${extraCount}</div>
                        <div class="ml-5 w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-colors flex-shrink-0 shadow-sm"><i class="fas fa-arrow-right"></i></div>
                    </div>
                </div>`;
            }).join('');

            htmlContent += `
                <div class="col-span-full mt-10 mb-4 pt-10 border-t border-gray-200 dark:border-gray-800 reveal">
                    <h4 class="text-2xl font-bold text-center mb-8">Specialized Teams</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">${teamsCardsHtml}</div>
                </div>
            `;
        }

        membersGrid.innerHTML = htmlContent;
    }

    if (faculty.length > 0) {
        mentorSection.classList.remove('hidden');
        mentorsGrid.innerHTML = faculty.map((m, i) => {
            const hasLink = !!m.profileLinkUrl;
            let badgeIcon = 'fas fa-link', badgeClass = 'portfolio', tooltipText = m.name;
            if(hasLink) {
                if(m.profileLinkType === 'linkedin') { badgeIcon = 'fab fa-linkedin-in'; badgeClass = 'linkedin'; tooltipText = 'View LinkedIn'; }
                else if(m.profileLinkType === 'portfolio') { badgeIcon = 'fas fa-briefcase'; badgeClass = 'portfolio'; tooltipText = 'View Portfolio'; }
                else if(m.profileLinkType === 'college') { badgeIcon = 'fas fa-university'; badgeClass = 'college'; tooltipText = 'College Profile'; }
            }

            return `
            <div class="mentor-card bg-white dark:bg-brand-card rounded-2xl p-6 flex flex-col items-center text-center border border-gray-100 dark:border-gray-800 reveal group w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.5rem)] max-w-[320px] mx-auto ${hasLink ? 'has-link cursor-pointer' : ''}" 
                 style="transition-delay:${i * 80}ms;" 
                 ${hasLink ? `onclick="window.open('${escHtml(m.profileLinkUrl)}','_blank','noopener')"` : ''}>
                
                ${hasLink ? `<div class="profile-badge ${badgeClass}"><i class="${badgeIcon} text-xs"></i></div><div class="member-tooltip">${tooltipText}</div>` : ''}

                <div class="w-32 h-32 sm:w-40 sm:h-40 mb-5 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative shrink-0 shadow-inner border border-gray-200 dark:border-gray-700">
                    <img src="${escHtml(m.image || avatarUrl(m.name))}" alt="${escHtml(m.name)}" class="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" onerror="this.src='${avatarUrl(m.name)}'">
                </div>
                <div class="w-full">
                    <h3 class="text-xl font-bold group-hover:text-brand-orange transition-colors mb-1 break-words">${escHtml(m.name)}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">${escHtml(m.role)}</p>
                    ${m.description ? `<p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">${escHtml(m.description)}</p>` : ''}
                </div>
            </div>
        `}).join('');
    } else {
        mentorSection.classList.add('hidden');
    }

    setTimeout(() => document.querySelectorAll('#members .reveal').forEach(el => revealObserver.observe(el)), 50);
}

// --- Team Modal Functions ---
function openTeamModal(teamName) {
    const team = state.teamsData[teamName];
    if(!team) return;

    document.getElementById('team-modal-title').textContent = teamName;
    document.getElementById('team-modal-subtitle').textContent = `${team.length} Member${team.length !== 1 ? 's' : ''}`;
    
    const grid = document.getElementById('team-modal-grid');
    grid.innerHTML = team.map((m, i) => generateMemberCardHtml(m, i, false)).join('');
    
    const modal = document.getElementById('team-modal');
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('open-modal');
    document.body.style.overflow = 'hidden';
}

function closeTeamModal() {
    const modal = document.getElementById('team-modal');
    modal.classList.remove('open-modal');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

function buildPosterPlaceholder(name) {
    return `
        <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 px-6 text-center">
            <div class="w-12 h-12 rounded-xl bg-brand-orange/20 flex items-center justify-center mb-3">
                <i class="fas fa-star text-brand-orange text-xl"></i>
            </div>
            <p class="text-gray-800 dark:text-white font-bold text-base leading-tight line-clamp-2">${escHtml(name)}</p>
        </div>`;
}

function renderEvents() {
    const grid = document.getElementById('events-grid');
    if (state.events.length === 0) {
        grid.innerHTML = `<div class="w-full text-center py-16 text-gray-400"><i class="fas fa-calendar-star text-4xl mb-3 block opacity-30"></i>No events posted yet. Check back soon!</div>`;
        return;
    }

    grid.innerHTML = state.events.map((ev, i) => {
        const statusClass = ev.status === 'ongoing' ? 'event-status-ongoing' : ev.status === 'completed' ? 'event-status-completed' : 'event-status-upcoming';
        const statusLabel = ev.status === 'ongoing' ? 'Ongoing' : ev.status === 'completed' ? 'Completed' : 'Upcoming';
        const statusDot   = ev.status === 'ongoing' ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>' : '';
        
        const placeholderHtml = buildPosterPlaceholder(ev.name);
        
        const posterHtml = ev.poster
            ? `<div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-5 flex-shrink-0 shadow-inner">
                   <div class="absolute inset-0 z-0 flex items-center justify-center">${placeholderHtml}</div>
                   <img src="${escHtml(ev.poster)}" alt="poster" class="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300" onerror="this.style.opacity='0';">
               </div>`
            : `<div class="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-5 flex-shrink-0 shadow-inner">${placeholderHtml}</div>`;

        const dateHtml = ev.date ? `<p class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i>${formatDate(ev.date)}</p>` : '';
        const btnHtml = (ev.btnLabel && ev.btnUrl)
            ? `<a href="${escHtml(ev.btnUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-6 py-2.5 mt-5 bg-brand-orange hover:bg-yellow-500 text-white font-bold rounded-xl shadow-lg hover:shadow-brand-orange/40 hover:-translate-y-0.5 transition-all duration-300 self-start text-sm w-full justify-center">
                  ${escHtml(ev.btnLabel)} <i class="fas fa-arrow-right text-xs"></i>
               </a>` : '';

        return `
        <div class="event-card bg-white dark:bg-brand-card p-5 reveal w-full max-w-[360px]" style="transition-delay:${i * 100}ms;">
            ${posterHtml}
            <div class="flex-1 flex flex-col justify-between w-full">
                <div>
                    <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
                        <span class="event-status-badge ${statusClass}">${statusDot} ${statusLabel}</span>
                    </div>
                    <h3 class="text-xl font-extrabold leading-snug">${escHtml(ev.name)}</h3>
                    ${dateHtml}
                </div>
                ${btnHtml}
            </div>
        </div>`;
    }).join('');

    setTimeout(() => document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el)), 50);
}

 // --- Achievement Single-View Carousel + Hover Popup ---
        let achIndex = 0;
        let achAnimDir = 0; // -1 = came from prev, 1 = came from next, 0 = no directional animation

        function renderAchievements() {
            const stage = document.getElementById('achievements-list');
            const counter = document.getElementById('ach-counter');
            if (state.achievements.length === 0) {
                stage.innerHTML = `<div class="text-center py-16 text-gray-400 w-full">Achievements will appear here soon.</div>`;
                if (counter) counter.classList.add('hidden');
                updateAchArrows();
                return;
            }
            if (achIndex >= state.achievements.length) achIndex = 0;
            if (achIndex < 0) achIndex = state.achievements.length - 1;

            const n = state.achievements.length;
            const a = state.achievements[achIndex];
            const hasLink = !!a.link;
            const dateStr = a.date ? `<span class="text-xs text-gray-400 ml-3"><i class="fas fa-calendar-alt mr-1"></i>${formatDate(a.date)}</span>` : '';
            const imageHtml = a.image
                ? `<div class="w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-white/40 dark:bg-black/25 flex-shrink-0 shadow-inner mb-4 flex items-center justify-center">
                       <img src="${escHtml(a.image)}" alt="${escHtml(a.title)}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.style.display='none';">
                   </div>`
                : '';
            const animClass = achAnimDir === 1 ? 'ach-anim-next' : achAnimDir === -1 ? 'ach-anim-prev' : 'ach-anim-fade';

            // Ghost "peek" cards — glimpses of the neighboring achievements stacked behind
            // the front card, like tiles peeking out in the iOS recent-apps switcher.
            const buildGhost = (idx, sideClass) => {
                const g = state.achievements[idx];
                if (!g) return '';
                return `
                    <div class="ach-card-slot ach-peek ${sideClass} liquid-glass" aria-hidden="true">
                        <div class="p-6">
                            <h3 class="text-lg font-bold mb-1 truncate text-gray-900 dark:text-gray-100">${escHtml(g.title)}</h3>
                            <p class="text-xs text-brand-orange font-medium truncate"><i class="fas fa-users mr-1.5"></i>${escHtml(g.names || '')}</p>
                        </div>
                    </div>`;
            };

            let ghostsHtml = '';
            if (n === 2) {
                ghostsHtml = buildGhost((achIndex + 1) % n, 'ach-peek-right');
            } else if (n > 2) {
                ghostsHtml = buildGhost((achIndex - 1 + n) % n, 'ach-peek-left')
                           + buildGhost((achIndex + 1) % n, 'ach-peek-right');
            }

            stage.innerHTML = `
                ${ghostsHtml}
                <div class="ach-card-slot ach-front liquid-glass achievement-card ${animClass} p-6 group cursor-pointer"
                     onclick="openAchievementModal(${achIndex})">
                    ${imageHtml}
                    <div class="flex-1 min-w-0">
                        <h3 class="text-xl font-bold mb-1 group-hover:text-brand-orange transition-colors">${escHtml(a.title)} ${hasLink ? `<i class="fas fa-external-link-alt text-xs text-gray-400 ml-2"></i>` : ''}</h3>
                        <p class="text-sm text-brand-orange font-medium mb-3"><i class="fas fa-users mr-1.5"></i>${escHtml(a.names)}${dateStr}</p>
                        <p class="text-gray-700 dark:text-gray-200 leading-relaxed text-sm achievement-desc-clamp">${escHtml(a.description)}</p>
                    </div>
                </div>`;
            achAnimDir = 0; // consumed — next render defaults back to a plain fade unless navigateAchievement sets it again

            if (counter) {
                counter.classList.remove('hidden');
                counter.innerHTML = state.achievements.length > 1
                    ? `${achIndex + 1} / ${state.achievements.length}`
                    : '';
            }
            updateAchArrows();
        }

        function navigateAchievement(dir) {
            if (state.achievements.length <= 1) return;
            achAnimDir = dir > 0 ? 1 : -1;
            achIndex = (achIndex + dir + state.achievements.length) % state.achievements.length;
            renderAchievements();
        }

        function updateAchArrows() {
            const prev = document.getElementById('ach-prev');
            const next = document.getElementById('ach-next');
            if (!prev || !next) return;
            const onlyOne = state.achievements.length <= 1;
            prev.classList.toggle('ach-disabled', onlyOne);
            next.classList.toggle('ach-disabled', onlyOne);
        }

        // Clicking the achievement opens its link directly (used for the mobile long-press action)
        function openAchievementLink(i) {
            const a = state.achievements[i];
            if (!a || !a.link) return;
            window.open(a.link, '_blank', 'noopener');
        }

        function openAchievementModal(i) {
            const a = state.achievements[i];
            if (!a) return;

            document.getElementById('achievement-modal-title').textContent = a.title || '';
            document.getElementById('achievement-modal-names').innerHTML = a.names ? `<i class="fas fa-users mr-1.5"></i>${escHtml(a.names)}` : '';
            const dateEl = document.getElementById('achievement-modal-date');
            if (a.date) { dateEl.innerHTML = `<i class="fas fa-calendar-alt mr-1.5"></i>${formatDate(a.date)}`; dateEl.classList.remove('hidden'); }
            else { dateEl.textContent = ''; dateEl.classList.add('hidden'); }
            document.getElementById('achievement-modal-desc').textContent = a.description || '';

            const imgWrap = document.getElementById('achievement-modal-image-wrap');
            const img = document.getElementById('achievement-modal-image');
            if (a.image) {
                img.src = a.image;
                img.alt = a.title || '';
                imgWrap.classList.remove('hidden');
            } else {
                imgWrap.classList.add('hidden');
            }

            const linkBtn = document.getElementById('achievement-modal-link');
            if (a.link) {
                linkBtn.href = a.link;
                linkBtn.classList.remove('hidden');
                linkBtn.classList.add('flex');
            } else {
                linkBtn.classList.add('hidden');
                linkBtn.classList.remove('flex');
            }

            const modal = document.getElementById('achievement-modal');
            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.add('open-modal');
            document.body.style.overflow = 'hidden';
        }

        function closeAchievementModal() {
            const modal = document.getElementById('achievement-modal');
            modal.classList.remove('open-modal');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        }

        // --- Achievements: Mobile Touch Gestures (swipe to navigate, hold to preview) ---
        (function setupAchievementTouch() {
            const container = document.getElementById('achievements-list');
            if (!container) return;

            let startX = 0, startY = 0, moved = false, gestureHandled = false;
            let holdTimer = null;
            const MOVE_CANCEL_PX = 10;   // movement past this cancels the hold-timer
            const SWIPE_PX = 45;          // horizontal distance needed to count as a swipe
            const HOLD_MS = 450;          // press-and-hold duration before preview opens

            function swallowNextClick() {
                const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
                container.addEventListener('click', swallow, { capture: true, once: true });
            }

            container.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                moved = false;
                gestureHandled = false;
                clearTimeout(holdTimer);
                holdTimer = setTimeout(() => {
                    if (!moved) {
                        gestureHandled = true;
                        if (navigator.vibrate) navigator.vibrate(12);
                        openAchievementLink(achIndex);
                    }
                }, HOLD_MS);
            }, { passive: true });

            container.addEventListener('touchmove', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
                    moved = true;
                    clearTimeout(holdTimer);
                }
            }, { passive: true });

            container.addEventListener('touchend', (e) => {
                clearTimeout(holdTimer);
                if (gestureHandled) { swallowNextClick(); return; }

                const touch = e.changedTouches && e.changedTouches[0];
                const dx = touch ? touch.clientX - startX : 0;
                const dy = touch ? touch.clientY - startY : 0;

                if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
                    swallowNextClick();
                    navigateAchievement(dx < 0 ? 1 : -1);
                }
            });

            container.addEventListener('touchcancel', () => clearTimeout(holdTimer));
        })();

        function buildActivityRowHtml(a, i, total) {
            const hasLink = !!a.link;
            const dateStr = a.date ? `<span class="text-xs text-gray-400"><i class="fas fa-calendar-alt mr-1"></i>${formatDate(a.date)}</span>` : '';
            return `
            <div class="flex items-center justify-between p-5 gap-4 ${i < total - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-brand-orange/5 dark:hover:bg-brand-orange/10 transition-colors group ${hasLink ? 'activity-row-link' : 'activity-row-nolink'}"
                 ${hasLink ? `onclick="window.open('${escHtml(a.link)}','_blank','noopener')"` : ''}>
                <div class="flex flex-col min-w-0 flex-1"><span class="font-semibold text-base uppercase tracking-wide group-hover:text-brand-orange transition-colors break-words">${escHtml(a.title)}</span>${dateStr}</div>
                ${hasLink ? `<a href="${escHtml(a.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="flex-shrink-0 px-5 py-2 border border-brand-orange text-brand-orange text-sm font-bold rounded-lg hover:bg-brand-orange hover:text-white hover:-translate-y-0.5 transition-all duration-200 shadow hover:shadow-lg">View <i class="fas fa-external-link-alt ml-1 text-xs"></i></a>` : ''}
            </div>`;
        }

        function renderActivities() {
            const wrap = document.getElementById('activities-list');
            if (state.activities.length === 0) {
                wrap.innerHTML = `<div class="text-center py-16 text-gray-400">No activities posted yet.</div>`;
                return;
            }

            // Only one activity: show it directly, no popup needed
            if (state.activities.length === 1) {
                wrap.innerHTML = `
                    <div class="bg-white dark:bg-brand-card rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
                        ${buildActivityRowHtml(state.activities[0], 0, 1)}
                    </div>`;
                return;
            }

            // More than one: show a single "view all" trigger; pressing it opens the full scrollable list
            wrap.innerHTML = `
                <div onclick="openActivitiesModal()" class="cursor-pointer bg-white dark:bg-brand-card rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 flex items-center justify-between gap-4 hover:-translate-y-1 hover:shadow-2xl hover:border-brand-orange transition-all duration-300 group">
                    <div>
                        <h3 class="text-xl font-bold group-hover:text-brand-orange transition-colors mb-1">View All Activities</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${state.activities.length} activities posted so far</p>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-colors flex-shrink-0 shadow-sm">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>`;
        }

        function openActivitiesModal() {
            const listEl = document.getElementById('activities-modal-list');
            const countEl = document.getElementById('activities-modal-count');
            if (!listEl) return;
            listEl.innerHTML = state.activities.map((a, i) => buildActivityRowHtml(a, i, state.activities.length)).join('');
            if (countEl) countEl.textContent = `${state.activities.length} Activities`;

            const modal = document.getElementById('activities-modal');
            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.add('open-modal');
            document.body.style.overflow = 'hidden';
        }

        function closeActivitiesModal() {
            const modal = document.getElementById('activities-modal');
            modal.classList.remove('open-modal');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        }

// Contact Form
async function handleContactSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    const origTxt = btn.innerHTML;
    const name = document.getElementById('c-name').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const message = document.getElementById('c-message').value.trim();

    if (!name || !email || !message) return;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>Sending…';
    btn.disabled = true;

    try {
        await col('contact_messages').add({ name, email, message, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        document.getElementById('contact-form').classList.add('hidden');
        document.getElementById('contact-success').classList.remove('hidden');
    } catch (err) {
        console.error('[ECHO] Contact form error:', err);
        showToast('Failed to send message. Please try again.', 'error');
        btn.innerHTML = origTxt;
        btn.disabled = false;
    }
}

// IntersectionObserver for reveal animation
const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); obs.unobserve(entry.target); } });
}, { threshold: 0.1 });
window.addEventListener('load', () => document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el)));

// Theme
if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark');
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-mobile').addEventListener('click', toggleTheme);

// Toast
let toastTimer;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = message;
    document.getElementById('toast-icon').className = type === 'error' ? 'fas fa-times-circle text-red-400 text-xl' : 'fas fa-check-circle text-brand-orange text-xl';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}


