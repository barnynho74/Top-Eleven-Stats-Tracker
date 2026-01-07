// Top Eleven Stats Tracker - Main JavaScript File

// Tab navigation
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab, .dropdown-item');
    const contents = document.querySelectorAll('.content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Render content based on tab
                switch (targetTab) {
                    case 'minutes':
                        updateMinutesTable();
                        break;
                    case 'goals-assists':
                        updateGoalsAssistsTable();
                        break;
                    case 'most-improved':
                        updateMostImprovedTable();
                        break;
                    case 'power-ranking':
                        loadPowerRankingData();
                        break;
                    case 'archived-players':
                        renderArchivedPlayers();
                        break;
                    case 'hall-of-fame':
                        renderHallOfFame();
                        break;
                    case 'all-time-leaders':
                        renderAllTimeLeaders();
                        break;
                }
            }
        });
    });

    // Handle jump-to-tab links
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('jump-to-tab')) {
            e.preventDefault();
            const targetTab = e.target.dataset.tab;
            const tabElement = document.querySelector(`.tab[data-tab="${targetTab}"]`);
            if (tabElement) {
                tabElement.click();
            }
        }
    });

    // DOM element references
    const addPlayerBtn=document.getElementById('add-player-btn');
    const playerModal=document.getElementById('player-modal');
    const cancelBtn=document.getElementById('cancel-btn');
    const saveBtn=document.getElementById('save-btn');
    const confirmModal=document.getElementById('confirm-modal');
    const confirmCancelBtn=document.getElementById('confirm-cancel');
    const confirmDeleteBtn=document.getElementById('confirm-delete');
    const ageAllBtn=document.getElementById('age-all-btn');
    const fullMatchBtn=document.getElementById('full-match-btn');
    const minutesInput=document.getElementById('minutes-input');
    const confirmMinutesBtn=document.getElementById('confirm-minutes-btn');
    const undoMinutesBtn=document.getElementById('undo-minutes-btn');
    const undoGaBtn=document.getElementById('undo-ga-btn');
    const avgQualitySpan=document.getElementById('avg-quality');
    const resetTrainingBtn = document.getElementById('reset-training-btn');
    const endSeasonBtn = document.getElementById('end-season-btn');
    const downloadDataBtn = document.getElementById('download-data-btn');
    const uploadDataBtn = document.getElementById('upload-data-btn');
    const uploadFileInput = document.getElementById('upload-file-input');

    // Global state variables
    let currentPlayerId=null;
    let selectedPlayersForMinutes=[];
    let players=[];
    let minutesHistory=[];
    let gaHistory=[];
    let talentChart = null;
    let archivedPlayers = [];
    let previousPowerRanking = [];
    let powerRankingTimeSeries = {};
    let powerRankingChart = null;
    let selectedPowerRankingPlayers = [];
    let isEditingTrainingTimes = false;
    let archivedSortBy = 'name';
    let archivedSortOrder = 'asc';

    /* ARCHIVED PLAYERS STORAGE */
    function loadArchivedPlayersFromStorage() {
        archivedPlayers = JSON.parse(localStorage.getItem('archivedPlayers') || '[]');
    }

    function saveArchivedPlayersToStorage() {
        localStorage.setItem('archivedPlayers', JSON.stringify(archivedPlayers));
    }

    /* Utils */
    function getPositionCategory(pos){
        if(pos==='GK')return'gk';
        if(['DL','DC','DR'].includes(pos))return'def';
        if(['DMC','ML','MC','MR','AMC','AML','AMR'].includes(pos))return'mid';
        if(['ST'].includes(pos))return'att';
        return'';
    }

    function getPositionOrder(pos){
        const order={GK:0,DL:1,DC:2,DR:3,DMC:4,ML:5,MC:6,MR:7,AML:8,AMC:9,AMR:10,ST:11};
        return order[pos]||99;
    }

    function sortPlayers(){
        const sortOption = document.getElementById('sort-option')?.value || 'position';
        if (sortOption === 'quality') {
            // Sort by current quality (highest first)
            players.sort((a, b) => {
                // Get current quality for player A
                let currentQualityA = a.initialQuality;
                for (let i = a.progress.length - 1; i >= 0; i--) {
                    if (a.progress[i] !== null && a.progress[i] !== undefined) {
                        currentQualityA = a.progress[i];
                        break;
                    }
                }
                // Get current quality for player B
                let currentQualityB = b.initialQuality;
                for (let i = b.progress.length - 1; i >= 0; i--) {
                    if (b.progress[i] !== null && b.progress[i] !== undefined) {
                        currentQualityB = b.progress[i];
                        break;
                    }
                }
                return currentQualityB - currentQualityA; // Descending order
            });
        } else {
            // Default position sorting
            const positionOrderCat={gk:0,def:1,mid:2,att:3};
            players.sort((a,b)=>{
                const catA=getPositionCategory(a.positions[0]);
                const catB=getPositionCategory(b.positions[0]);
                if(catA!==catB)return positionOrderCat[catA]-positionOrderCat[catB];
                return getPositionOrder(a.positions[0])-getPositionOrder(b.positions[0]);
            });
        }
    }

    function clearModal(){
        document.getElementById('player-name').value='';
        Array.from(document.getElementById('player-position').options).forEach(o=>o.selected=false);
        document.getElementById('player-age').value='';
        document.getElementById('player-quality').value='';
        document.getElementById('modal-title').textContent='Add New Player';
        currentPlayerId=null;
    }

    function calculateAverageQuality(){
        if(players.length===0){
            avgQualitySpan.textContent='--';
            document.getElementById('squad-count').textContent='0';
            document.getElementById('avg-age').textContent='--';
            return;
        }
        const avgQuality=(players.reduce((sum,p)=>sum+p.quality,0)/players.length).toFixed(1);
        const avgAge=(players.reduce((sum,p)=>sum+p.age,0)/players.length).toFixed(1);
        avgQualitySpan.textContent=avgQuality;
        document.getElementById('squad-count').textContent=players.length;
        document.getElementById('avg-age').textContent=avgAge;
    }

    function calculateDayAverages(){
        const averages=Array(28).fill(0);
        const counts=Array(28).fill(0);
        players.forEach(player=>{
            player.progress.forEach((value,day)=>{
                if(value!==null){
                    averages[day]+=value;
                    counts[day]++;
                }
            });
        });
        return averages.map((sum,day)=>{
            return counts[day]>0?(sum/counts[day]).toFixed(2)+'':'-';
        });
    }

    function ensureGaFields(p){
        ['leagueGoals','leagueAssists','clGoals','clAssists','cupGoals','cupAssists'].forEach(f=>{
            if(typeof p[f]!=='number')p[f]=0;
        });
        ['lifetimeMinutes', 'lifetimeMatches', 'lifetimeGoals', 'lifetimeAssists'].forEach(f => {
            if (typeof p[f] !== 'number') p[f] = 0;
        });
        if(p.comment===undefined)p.comment='';
        if(!p.tags){
            p.tags={keep:false,sell:false,slowTrainer:false,hotProspect:false};
        }
        if(!p.archiveReason) p.archiveReason = 'other';
    }

    /* Storage */
    function loadPlayersFromLocalStorage(){
        const saved=localStorage.getItem('topElevenPlayers');
        if(saved){
            players=JSON.parse(saved);
            players.forEach(p=>{
                if(!p.positions){
                    p.positions=[p.position||''];
                }
                if(!p.position)p.position=p.positions[0];
                if(!p.progress)p.progress=Array(28).fill(null);
                if(!p.minutes)p.minutes=Array(28).fill(0);
                if(!p.initialQuality)p.initialQuality=p.quality;
                ensureGaFields(p);
            });
        }
    }

    function savePlayersToLocalStorage(){
        localStorage.setItem('topElevenPlayers',JSON.stringify(players));
    }

    function endSeason() {
        if (!confirm("Are you sure you want to end the current season? This will archive all current player data and reset their stats for a new season. This action cannot be undone.")) {
            return;
        }
        // 1. Get existing archives or create new array
        const archives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
        
        // 2. Get current power ranking data
        const currentPowerRanking = JSON.parse(localStorage.getItem('powerRankingHistory') || '[]');
        const currentTimeSeries = JSON.parse(localStorage.getItem('powerRankingTimeSeries') || '{}');
        
        // 3. Create new archive object with power ranking data
        const seasonData = {
            seasonNumber: archives.length + 1,
            endDate: new Date().toLocaleDateString(),
            players: JSON.parse(JSON.stringify(players)), // Deep copy of players array
            powerRankingHistory: JSON.parse(JSON.stringify(currentPowerRanking)), // Deep copy
            powerRankingTimeSeries: JSON.parse(JSON.stringify(currentTimeSeries)) // Deep copy
        };
        
        // 4. Add new archive and save
        archives.push(seasonData);
        localStorage.setItem('topElevenArchives', JSON.stringify(archives));
        
        // 5. Clear power ranking data for the new season
        localStorage.removeItem('powerRankingHistory');
        localStorage.removeItem('powerRankingTimeSeries');
        previousPowerRanking = [];
        powerRankingTimeSeries = {};
        
        // 6. Reset players for the new season
        players.forEach(p => {
            // Accumulate lifetime stats before resetting
            const seasonGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const seasonAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            
            p.lifetimeMinutes = (p.lifetimeMinutes || 0) + (p.totalMinutes || 0);
            p.lifetimeMatches = (p.lifetimeMatches || 0) + (p.matchesPlayed || 0);
            p.lifetimeGoals = (p.lifetimeGoals || 0) + seasonGoals;
            p.lifetimeAssists = (p.lifetimeAssists || 0) + seasonAssists;
            // Reset for new season
            p.initialQuality = p.quality; // New initial quality is the last season's final quality
            p.progress = Array(28).fill(null);
            p.minutes = Array(28).fill(0);
            p.totalMinutes = 0;
            p.matchesPlayed = 0;
            p.leagueGoals = 0;
            p.leagueAssists = 0;
            p.clGoals = 0;
            p.clAssists = 0;
            p.cupGoals = 0;
            p.cupAssists = 0;
        });
        
        // 7. Save the reset player data
        savePlayersToLocalStorage();
        
        // 8. Re-render everything
        alert(`Season ${seasonData.seasonNumber} has been archived with power ranking data. The new season is ready to begin!`);
        renderPlayers();
        loadAndRenderArchives();
        renderPowerRankingTable([]);
        renderPowerRankingChart();
    }

    /* CRUD */
    function addPlayer(name,positionsArr,age,quality){
        const primary=positionsArr[0];
        const player={
            id:Date.now(),
            name,
            position:primary,
            positions:positionsArr,
            age,
            quality,
            initialQuality:quality,
            progress:Array(28).fill(null),
            minutes:Array(28).fill(0),
            leagueGoals:0,
            leagueAssists:0,
            clGoals:0,
            clAssists:0,
            cupGoals:0,
            cupAssists:0,
            totalMinutes:0,
            matchesPlayed:0,
            comment:'',
            tags:{keep:false,sell:false,slowTrainer:false,hotProspect:false},
            lifetimeMinutes: 0,
            lifetimeMatches: 0,
            lifetimeGoals: 0,
            lifetimeAssists: 0
        };
        players.push(player);
        return player;
    }

    function editPlayer(playerId){
        const player=players.find(p=>p.id===playerId);
        if(!player)return;
        currentPlayerId=playerId;
        document.getElementById('modal-title').textContent='Edit Player';
        document.getElementById('player-name').value=player.name;
        document.getElementById('player-age').value=player.age;
        document.getElementById('player-quality').value=player.quality;
        Array.from(document.getElementById('player-position').options).forEach(o=>{
            o.selected=player.positions.includes(o.value);
        });
        playerModal.style.display='flex';
    }

    function confirmDeletePlayer(playerId){
        const player=players.find(p=>p.id===playerId);
        if(!player)return;
        document.getElementById('player-to-delete').textContent=`${player.name} (${player.positions.join('/')})`;
        confirmModal.style.display='flex';
        confirmDeleteBtn.onclick=function(){
            players=players.filter(p=>p.id!==playerId);
            savePlayersToLocalStorage();
            renderPlayers();
            confirmModal.style.display='none';
        };
    }

    function ageAllPlayers(){
        players.forEach(p=>{
            if(p.age<45)p.age++;
        });
        savePlayersToLocalStorage();
        renderPlayers();
    }

    function addMinutesToSelected(minutes){
        const currentMatchDay=players[0]?.minutes.findIndex(m=>m===0);
        // Save state for undo
        const undoState={
            type:'addMinutes',
            players:selectedPlayersForMinutes.map(id=>{
                const p=players.find(pl=>pl.id===id);
                return {
                    id:id,
                    previousMinutes:p.minutes[currentMatchDay],
                    previousTotal:p.totalMinutes,
                    previousMatches:p.matchesPlayed,
                    matchDay:currentMatchDay,
                    addedMinutes:minutes
                };
            })
        };
        minutesHistory.push(undoState);
        
        players.forEach(p=>{
            if(selectedPlayersForMinutes.includes(p.id)){
                // Add minutes to current match day (don't overwrite)
                p.minutes[currentMatchDay]=(p.minutes[currentMatchDay]||0)+minutes;
                // Add to total minutes
                p.totalMinutes=(p.totalMinutes||0)+minutes;
                // Increment matches every time minutes are added
                if(minutes>0)p.matchesPlayed=(p.matchesPlayed||0)+1;
            }
        });
        selectedPlayersForMinutes=[];
        savePlayersToLocalStorage();
        updateMinutesTable();
    }

    function undoLastMinutesChange(){
        if(minutesHistory.length===0){
            alert('No changes to undo');
            return;
        }
        
        const lastChange=minutesHistory.pop();
        if(lastChange.type==='addMinutes'){
            lastChange.players.forEach(playerData=>{
                const p=players.find(pl=>pl.id===playerData.id);
                if(p){
                    p.minutes[playerData.matchDay]=playerData.previousMinutes;
                    p.totalMinutes=playerData.previousTotal;
                    p.matchesPlayed=playerData.previousMatches;
                }
            });
        }
        
        savePlayersToLocalStorage();
        updateMinutesTable();
    }

    // ARCHIVE PLAYER FUNCTION
    function archivePlayer(playerId) {
        const idx = players.findIndex(p => p.id === playerId);
        if (idx === -1) return;
        const playerToArchive = players[idx];
        if (!confirm(`Are you sure you want to archive ${playerToArchive.name}?`)) return;
        // Stamp the player with the season they are being archived in
        const archives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
        playerToArchive.archivedInSeason = archives.length + 1;
        // Remove from active players, push to archivedPlayers
        players.splice(idx, 1);
        playerToArchive.archiveReason = 'other'; // Set default reason on archive
        archivedPlayers.push(playerToArchive);
        savePlayersToLocalStorage();
        saveArchivedPlayersToStorage();
        renderPlayers();
        renderArchivedPlayers();
    }

    // RENDER ARCHIVED PLAYERS
    function renderArchivedPlayers() {
        loadArchivedPlayersFromStorage();
        archivedPlayers.forEach(p => ensureGaFields(p));
        // --- FILTERING LOGIC ---
        const posFilter = document.getElementById('archive-position-filter').value;
        const minAge = parseInt(document.getElementById('archive-age-filter-min').value) || 0;
        const maxAge = parseInt(document.getElementById('archive-age-filter-max').value) || Infinity;
        const minMinutes = parseInt(document.getElementById('archive-minutes-filter-min').value) || 0;
        const maxMinutes = parseInt(document.getElementById('archive-minutes-filter-max').value) || Infinity;
        const minMatches = parseInt(document.getElementById('archive-matches-filter-min').value) || 0;
        const maxMatches = parseInt(document.getElementById('archive-matches-filter-max').value) || Infinity;
        const minGoals = parseInt(document.getElementById('archive-goals-filter-min').value) || 0;
        const maxGoals = parseInt(document.getElementById('archive-goals-filter-max').value) || Infinity;
        const minAssists = parseInt(document.getElementById('archive-assists-filter-min').value) || 0;
        const maxAssists = parseInt(document.getElementById('archive-assists-filter-max').value) || Infinity;
        const filteredPlayers = archivedPlayers.filter(p => {
            const playerCategory = getPositionCategory(p.positions[0]);
            if (posFilter !== 'all' && playerCategory !== posFilter) return false;
            
            if (p.age < minAge || p.age > maxAge) return false;
            
            const totalMinutes = p.totalMinutes || 0;
            const matchesPlayed = p.matchesPlayed || 0;
            const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            if (totalMinutes < minMinutes || totalMinutes > maxMinutes) return false;
            if (matchesPlayed < minMatches || matchesPlayed > maxMatches) return false;
            if (totalGoals < minGoals || totalGoals > maxGoals) return false;
            if (totalAssists < minAssists || totalAssists > maxAssists) return false;
            return true;
        });
        const tbody = document.querySelector('#archived-players-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!filteredPlayers.length) {
            const message = archivedPlayers.length > 0 ? 'No players match the current filters.' : 'No players have been archived yet.';
            tbody.innerHTML = `<tr><td colspan="11">${message}</td></tr>`;
            return;
        }
        // Prepare data for sorting from the filtered list
        const data = filteredPlayers.map(p => {
            // We need to find the original index to allow editing/deleting
            const originalIndex = archivedPlayers.findIndex(original => original.id === p.id);
            let currentQuality = p.initialQuality;
            if (p.progress) {
                for (let i = p.progress.length - 1; i >= 0; i--) {
                    if (p.progress[i] !== null && p.progress[i] !== undefined) {
                        currentQuality = p.progress[i];
                        break;
                    }
                }
            }
            const totalGoals = (p.leagueGoals||0)+(p.clGoals||0)+(p.cupGoals||0);
            const totalAssists = (p.leagueAssists||0)+(p.clAssists||0)+(p.cupAssists||0);
            const improvement = (currentQuality - p.initialQuality) || 0;
            const improvementPercent = p.initialQuality > 0 ? (improvement / p.initialQuality * 100) : 0;
            const ga = totalGoals + totalAssists;
            const gaPer90 = (p.totalMinutes || 0) > 0 ? (ga * 90) / p.totalMinutes : 0;
            const avgMinPerMatch = (p.matchesPlayed || 0) > 0 ? (p.totalMinutes || 0) / p.matchesPlayed : 0;
            return {
                idx: originalIndex, // Use original index for data manipulation
                name: p.name,
                positions: p.positions,
                age: p.age,
                initialQuality: p.initialQuality,
                currentQuality,
                improvement,
                improvementPercent,
                minutes: p.totalMinutes || 0,
                matches: p.matchesPlayed || 0,
                goals: totalGoals,
                assists: totalAssists,
                gaPer90: gaPer90,
                avgMinPerMatch: avgMinPerMatch,
                archiveReason: p.archiveReason || 'other',
                player: p
            };
        });
        // Sort
        data.sort((a, b) => {
            let valA = a[archivedSortBy], valB = b[archivedSortBy];
            if (archivedSortBy === 'avgMinPerMatch') {
                valA = a.avgMinPerMatch;
                valB = b.avgMinPerMatch;
            }
            if (typeof valA === 'string') {
                return archivedSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return archivedSortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
        // Render rows
        data.forEach(item => {
            const p = item.player;
            const row = document.createElement('tr');
            // Name (bold surname)
            const nameParts = p.name.split(' ');
            let nameHtml = p.name.includes(' ') ? `${p.name.substring(0, p.name.lastIndexOf(' '))} <span class="player-name-bold">${p.name.substring(p.name.lastIndexOf(' ') + 1)}</span>` : `<span class="player-name-bold">${p.name}</span>`;
            
            const reasons = {
                sold: 'Sold',
                retired: 'Retired',
                end_of_contract: 'End of Contract',
                not_good_enough: 'Not Good Enough',
                other: 'Other'
            };
            let reasonOptions = '';
            for(const [key, value] of Object.entries(reasons)) {
                reasonOptions += `<option value="${key}" ${item.archiveReason === key ? 'selected' : ''}>${value}</option>`;
            }
            row.innerHTML = `
                <td>${nameHtml}</td>
                <td>${p.positions.join('/')}</td>
                <td><input type="number" class="editable-stat" value="${p.age}" data-idx="${item.idx}" data-field="age"></td>
                <td><input type="number" class="editable-stat" value="${item.minutes}" data-idx="${item.idx}" data-field="totalMinutes"></td>
                <td><input type="number" class="editable-stat" value="${item.matches}" data-idx="${item.idx}" data-field="matchesPlayed"></td>
                <td>${item.avgMinPerMatch.toFixed(1)}</td>
                <td><input type="number" class="editable-stat" value="${item.goals}" data-idx="${item.idx}" data-field="goals"></td>
                <td><input type="number" class="editable-stat" value="${item.assists}" data-idx="${item.idx}" data-field="assists"></td>
                <td>${item.gaPer90.toFixed(2)}</td>
                <td><select class="editable-stat" data-idx="${item.idx}" data-field="archiveReason">${reasonOptions}</select></td>
                <td><button class='delete-btn' data-idx='${item.idx}'>Delete</button></td>
            `;
            tbody.appendChild(row);
        });
        // Update sort indicators
        const table = document.getElementById('archived-players-table');
        if (table) {
            table.querySelectorAll('th[data-sort]').forEach(th => {
                th.dataset.order = '';
                const ind = th.querySelector('.sort-indicator');
                if (ind) ind.className = 'sort-indicator';
                if (th.dataset.sort === archivedSortBy) {
                    th.dataset.order = archivedSortOrder;
                    if (ind) ind.classList.add(archivedSortOrder);
                }
            });
        }
        // Delete event
        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                if (confirm(`Are you sure you want to delete archived player ${archivedPlayers[idx].name}?`)) {
                    archivedPlayers.splice(idx, 1);
                    saveArchivedPlayersToStorage();
                    renderArchivedPlayers();
                }
            });
        });
        // Editable stats event
        tbody.querySelectorAll('.editable-stat').forEach(input => {
            input.addEventListener('change', function(e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.idx);
                const field = this.dataset.field;
                const isNumeric = this.type === 'number';
                const value = isNumeric ? parseInt(this.value) : this.value;
                if (isNumeric && isNaN(value)) return;
                
                const player = archivedPlayers[idx];
                if (field === 'goals' || field === 'assists') {
                    if (field === 'goals') {
                        player.leagueGoals = value;
                        player.clGoals = 0;
                        player.cupGoals = 0;
                    } else {
                        player.leagueAssists = value;
                        player.clAssists = 0;
                        player.cupAssists = 0;
                    }
                } else {
                    player[field] = value;
                }
                
                saveArchivedPlayersToStorage();
                renderArchivedPlayers();
            });
        });
    }

    /* Render active players (progress) */
    function renderPlayers(){
        sortPlayers();
        const list=document.getElementById('player-list');
        list.innerHTML='';
        const dayAverages=calculateDayAverages();
        const header=document.createElement('div');
        header.className='player-card';
        header.style.pointerEvents='none';
        header.style.backgroundColor='transparent';
        header.style.boxShadow='none';
        const dummyInfo=document.createElement('div');
        dummyInfo.className='player-info';
        dummyInfo.style.visibility='hidden';
        header.appendChild(dummyInfo);
        const weeksContainer=document.createElement('div');
        weeksContainer.className='weeks-container';
        
        for(let week=1;week<=4;week++){
            const weekHeader=document.createElement('div');
            weekHeader.className='week-header';
            const weekLabel=document.createElement('div');
            weekLabel.className='week-label';
            weekLabel.textContent=`Week ${week}:`;
            weekHeader.appendChild(weekLabel);
            const daysCells=document.createElement('div');
            daysCells.className='days-header';
            const startDay=(week-1)*7+1;
            const endDay=Math.min(week*7,28);
            for(let i=startDay;i<=endDay;i++){
                const cell=document.createElement('div');
                cell.className='day-cell';
                cell.textContent=i;
                daysCells.appendChild(cell);
            }
            weekHeader.appendChild(daysCells);
            weeksContainer.appendChild(weekHeader);
        }
        header.appendChild(weeksContainer);
        
        const averagesRow=document.createElement('div');
        averagesRow.className='player-card';
        averagesRow.style.pointerEvents='none';
        averagesRow.style.backgroundColor='transparent';
        averagesRow.style.boxShadow='none';
        const avgLabel=document.createElement('div');
        avgLabel.className='player-info';
        avgLabel.textContent='Avg:';
        avgLabel.style.fontWeight='bold';
        avgLabel.style.fontSize='11px';
        averagesRow.appendChild(avgLabel);
        const avgWeeksContainer=document.createElement('div');
        avgWeeksContainer.className='weeks-container';
        
        for(let week=1;week<=4;week++){
            const avgWeekHeader=document.createElement('div');
            avgWeekHeader.className='week-header';
            const avgWeekLabel=document.createElement('div');
            avgWeekLabel.className='week-label';
            avgWeekLabel.style.visibility='hidden';
            avgWeekLabel.textContent=`Week ${week}:`;
            avgWeekHeader.appendChild(avgWeekLabel);
            const avgValues=document.createElement('div');
            avgValues.className='player-days';
            const startDay=(week-1)*7;
            const endDay=Math.min(week*7-1,27);
            for(let i=startDay;i<=endDay;i++){
                const avgCell=document.createElement('div');
                avgCell.className='day-average';
                
                const currentVal = dayAverages[i];
                const prevVal = i > 0 ? dayAverages[i-1] : '-';
                
                let html = `<div>${currentVal}</div>`;
                
                if (currentVal !== '-' && prevVal !== '-') {
                    const diff = parseFloat(currentVal) - parseFloat(prevVal);
                    if (Math.abs(diff) > 0.001) {
                        const color = diff > 0 ? 'green' : 'red';
                        const sign = diff > 0 ? '+' : '';
                        html += `<div style="color: ${color}; font-size: 9px;">${sign}${diff.toFixed(2)}</div>`;
                    }
                }
                
                avgCell.innerHTML = html;
                avgValues.appendChild(avgCell);
            }
            avgWeekHeader.appendChild(avgValues);
            avgWeeksContainer.appendChild(avgWeekHeader);
        }
        averagesRow.appendChild(avgWeeksContainer);
        
        list.appendChild(header);
        list.appendChild(averagesRow);
        
        players.forEach(p=>{
            const card=document.createElement('div');
            card.className='player-card';
            card.dataset.playerId=p.id;
            const info=document.createElement('div');
            info.className='player-info';
            p.positions.forEach(pos=>{
                const lab=document.createElement('span');
                lab.className=`position-label ${getPositionCategory(pos)}`;
                lab.textContent=pos;
                info.appendChild(lab);
            });
            // Create name with bold surname
            const nameSpan=document.createElement('span');
            const nameParts=p.name.split(' ');
            if(nameParts.length>1){
                const firstName=nameParts.slice(0,-1).join(' ');
                const surname=nameParts[nameParts.length-1];
                nameSpan.innerHTML=`${firstName} <span class="player-name-bold">${surname}</span> (${p.age}, ${p.quality}%)`;
            }else{
                nameSpan.innerHTML=`<span class="player-name-bold">${p.name}</span> (${p.age}, ${p.quality}%)`;
            }
            info.appendChild(nameSpan);
            // Star
            const starDiv=document.createElement('div');
            starDiv.className='star-rating';
            const starsBase='★★★★★';
            starDiv.innerHTML=`<span class='stars-outer'>${starsBase}</span><span class='stars-inner' style='width:${Math.min(p.quality,100)}%'>${starsBase}</span>`;
            info.appendChild(starDiv);
            // Tags
            const tagsContainer=document.createElement('div');
            tagsContainer.className='card-tags-container';
            tagsContainer.addEventListener('click', e => e.stopPropagation());
            const tags = {
                keep: { short: 'K', title: 'Keep', color: '#28a745' },
                sell: { short: 'S', title: 'Sell', color: '#dc3545' },
                slowTrainer: { short: 'SL', title: 'Slow Trainer', color: '#ffc107' },
                hotProspect: { short: 'H', title: 'Hot Prospect', color: '#17a2b8' }
            };
            for (const key in tags) {
                const tagEl = document.createElement('div');
                tagEl.className = `card-tag ${p.tags[key] ? 'active' : ''}`;
                tagEl.textContent = tags[key].short;
                tagEl.title = tags[key].title;
                if (p.tags[key]) {
                    tagEl.style.backgroundColor = tags[key].color;
                    tagEl.style.borderColor = tags[key].color;
                }
                tagEl.addEventListener('click', () => {
                    p.tags[key] = !p.tags[key];
                    savePlayersToLocalStorage();
                    renderPlayers();
                });
                tagsContainer.appendChild(tagEl);
            }
            info.appendChild(tagsContainer);
            card.appendChild(info);
            
            // Button Container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '8px';
            buttonContainer.style.flexShrink = '0';
            
            // Edit button
            const editBtn=document.createElement('button');
            editBtn.className='edit-btn';
            editBtn.textContent='Edit';
            editBtn.addEventListener('click',(e)=>{
                e.stopPropagation();
                editPlayer(p.id);
            });
            buttonContainer.appendChild(editBtn);
            
            // Archive button
            const archiveBtn=document.createElement('button');
            archiveBtn.className='archive-btn';
            archiveBtn.textContent='Archive';
            archiveBtn.addEventListener('click',(e)=>{
                e.stopPropagation();
                archivePlayer(p.id);
            });
            buttonContainer.appendChild(archiveBtn);
            card.appendChild(buttonContainer);
            // Weeks container for progress input
            const playerWeeksContainer=document.createElement('div');
            playerWeeksContainer.className='weeks-container';
            for(let week=1;week<=4;week++){
                const playerWeekHeader=document.createElement('div');
                playerWeekHeader.className='week-header';
                const playerWeekLabel=document.createElement('div');
                playerWeekLabel.className='week-label';
                playerWeekLabel.style.visibility='hidden';
                playerWeekLabel.textContent=`Week ${week}:`;
                playerWeekHeader.appendChild(playerWeekLabel);
                const daysDiv=document.createElement('div');
                daysDiv.className='player-days';
                const startDay=(week-1)*7;
                const endDay=Math.min(week*7-1,27);
                for(let i=startDay;i<=endDay;i++){
                    const inp=document.createElement('input');
                    inp.className='player-day-input';
                    inp.type='number';
                    inp.min='0';
                    inp.max='100';
                    inp.value=p.progress[i]||'';
                    inp.dataset.day=i;
                    inp.addEventListener('change',function(e){
                        e.stopPropagation();
                        const d=parseInt(this.dataset.day);
                        const v=this.value?parseInt(this.value):null;
                        p.progress[d]=v;
                        savePlayersToLocalStorage();
                        renderPlayers();
                    });
                    inp.addEventListener('click',function(e){
                        e.stopPropagation();
                    });
                    daysDiv.appendChild(inp);
                }
                playerWeekHeader.appendChild(daysDiv);
                playerWeeksContainer.appendChild(playerWeekHeader);
            }
            card.appendChild(playerWeeksContainer);
            card.addEventListener('click',function(e){
                if(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')return;
            });
            list.appendChild(card);
        });
        calculateAverageQuality();
    }

    function loadAndRenderArchives() {
        const archiveListDiv = document.getElementById('archive-list');
        const archives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
        
        if (archives.length === 0) {
            archiveListDiv.innerHTML = '<p>No archived seasons yet.</p>';
            return;
        }
        
        archiveListDiv.innerHTML = '';
        
        archives.reverse().forEach(archive => {
            const details = document.createElement('details');
            details.className = 'archive-details';
            
            const summary = document.createElement('summary');
            summary.className = 'archive-summary';
            summary.style.display = 'flex';
            summary.style.alignItems = 'center';
            summary.style.justifyContent = 'space-between';
            
            const summaryText = document.createElement('span');
            summaryText.innerHTML = `<strong>Season ${archive.seasonNumber}</strong> (Ended on: ${archive.endDate}) - ${archive.players.length} players`;
            summary.appendChild(summaryText);
            
            // Add "View Power Rankings" button if data exists
            if (archive.powerRankingHistory && archive.powerRankingHistory.length > 0) {
                const viewPrBtn = document.createElement('button');
                viewPrBtn.className = 'view-pr-btn';
                viewPrBtn.textContent = 'View Power Rankings';
                viewPrBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showArchivedPowerRanking(archive);
                });
                summary.appendChild(viewPrBtn);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'archive-content';
            
            details.appendChild(summary);
            details.appendChild(contentDiv);
            
            details.addEventListener('toggle', () => {
                if (details.open && !contentDiv.hasChildNodes()) {
                    renderArchivedSeasonPlayers(contentDiv, archive.players);
                }
            });
            
            archiveListDiv.appendChild(details);
        });
    }

    function downloadData() {
        const dataToSave = {
            players: JSON.parse(localStorage.getItem('topElevenPlayers') || '[]'),
            archives: JSON.parse(localStorage.getItem('topElevenArchives') || '[]'),
            trainingBonuses: JSON.parse(localStorage.getItem('trainingBonuses') || '{}'),
            powerRankingHistory: JSON.parse(localStorage.getItem('powerRankingHistory') || '[]'),
            powerRankingTimeSeries: JSON.parse(localStorage.getItem('powerRankingTimeSeries') || '{}')
        };
        
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `top_eleven_tracker_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function uploadData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        if (!confirm("Are you sure you want to upload this file? This will overwrite all current data in the tracker.")) {
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.players && data.archives && data.trainingBonuses && data.powerRankingHistory && data.powerRankingTimeSeries) {
                    localStorage.setItem('topElevenPlayers', JSON.stringify(data.players));
                    localStorage.setItem('topElevenArchives', JSON.stringify(data.archives));
                    localStorage.setItem('trainingBonuses', JSON.stringify(data.trainingBonuses));
                    localStorage.setItem('powerRankingHistory', JSON.stringify(data.powerRankingHistory));
                    localStorage.setItem('powerRankingTimeSeries', JSON.stringify(data.powerRankingTimeSeries));
                    
                    loadPlayersFromLocalStorage();
                    loadAndRenderArchives();
                    loadPowerRankingData();
                    
                    document.querySelectorAll('.tab').forEach(tab => {
                        if (tab.classList.contains('active')) {
                            tab.click();
                        }
                    });
                    renderPlayers();
                    
                    alert('Data successfully uploaded and restored!');
                } else {
                    alert('Error: The uploaded file has an invalid format.');
                }
            } catch (error) {
                alert('Error reading or parsing the file. Please ensure it is a valid JSON backup file.');
                console.error("Upload error:", error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function renderArchivedSeasonPlayers(container, archivedPlayers) {
        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'player-card';
        header.style.cssText = 'pointer-events: none; background-color: transparent; box-shadow: none;';

        const dummyInfo = document.createElement('div');
        dummyInfo.className = 'player-info';
        dummyInfo.style.visibility = 'hidden';
        header.appendChild(dummyInfo);

        const weeksContainer = document.createElement('div');
        weeksContainer.className = 'weeks-container';
        for (let week = 1; week <= 4; week++) {
            const weekHeader = document.createElement('div');
            weekHeader.className = 'week-header';
            const weekLabel = document.createElement('div');
            weekLabel.className = 'week-label';
            weekLabel.textContent = `Week ${week}:`;
            weekHeader.appendChild(weekLabel);
            const daysCells = document.createElement('div');
            daysCells.className = 'days-header';
            const startDay = (week - 1) * 7 + 1;
            const endDay = Math.min(week * 7, 28);
            for (let i = startDay; i <= endDay; i++) {
                const cell = document.createElement('div');
                cell.className = 'day-cell';
                cell.textContent = i;
                daysCells.appendChild(cell);
            }
            weekHeader.appendChild(daysCells);
            weeksContainer.appendChild(weekHeader);
        }
        header.appendChild(weeksContainer);
        container.appendChild(header);

        archivedPlayers.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-card';

            const info = document.createElement('div');
            info.className = 'player-info';
            
            let currentQuality = p.initialQuality;
            if (p.progress) {
                for (let i = p.progress.length - 1; i >= 0; i--) {
                    if (p.progress[i] !== null && p.progress[i] !== undefined) {
                        currentQuality = p.progress[i];
                        break;
                    }
                }
            }
            const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const totalMinutes = p.totalMinutes || 0;
            const matchesPlayed = p.matchesPlayed || 0;
            info.innerHTML = `
                <span class="position-label ${getPositionCategory(p.positions[0])}">${p.positions.join('/')}</span>
                <span style="min-width: 180px;">${p.name} (${p.age}, ${currentQuality}%)</span>
                <span style="margin-left: 15px; font-size: 11px; color: #333;">
                    <b>Min:</b> ${totalMinutes} | <b>M:</b> ${matchesPlayed} | <b>G:</b> ${totalGoals} | <b>A:</b> ${totalAssists}
                </span>
            `;
            card.appendChild(info);

            const playerWeeksContainer = document.createElement('div');
            playerWeeksContainer.className = 'weeks-container';
            for (let week = 1; week <= 4; week++) {
                const playerWeekHeader = document.createElement('div');
                playerWeekHeader.className = 'week-header';
                const playerWeekLabel = document.createElement('div');
                playerWeekLabel.className = 'week-label';
                playerWeekLabel.style.visibility = 'hidden';
                playerWeekHeader.appendChild(playerWeekLabel);
                
                const daysDiv = document.createElement('div');
                daysDiv.className = 'player-days';
                const startDay = (week - 1) * 7;
                const endDay = Math.min(week * 7 - 1, 27);
                for (let i = startDay; i <= endDay; i++) {
                    const dayCell = document.createElement('div');
                    dayCell.className = 'player-day-input';
                    dayCell.style.backgroundColor = '#f0f0f0';
                    dayCell.style.border = '1px solid #e0e0e0';
                    dayCell.textContent = p.progress[i] || '';
                    daysDiv.appendChild(dayCell);
                }
                playerWeekHeader.appendChild(daysDiv);
                playerWeeksContainer.appendChild(playerWeekHeader);
            }
            card.appendChild(playerWeeksContainer);
            container.appendChild(card);
        });
    }

    function updateMinutesTable(){
        const tbody=document.querySelector('#minutes-table tbody');
        tbody.innerHTML='';
        const allMinutes=players.map(p=>(p.totalMinutes||0));
        const maxMinutes=Math.max(...allMinutes);
        const minMinutes=Math.min(...allMinutes);
        
        function getMinuteColor(minutes){
            if(maxMinutes===minMinutes||minutes===0) return 'transparent';
            const ratio=(minutes-minMinutes)/(maxMinutes-minMinutes);
            const hue=240-(ratio*240);
            return `hsl(${hue}, 80%, 85%)`;
        }
        players.forEach(p=>{
            const total=p.totalMinutes||0;
            const matches=p.matchesPlayed||0;
            const row=document.createElement('tr');
            row.dataset.playerId=p.id;
            
            if(selectedPlayersForMinutes.includes(p.id)){
                row.classList.add('selected');
            }
            row.style.backgroundColor=getMinuteColor(total);
            const nameParts=p.name.split(' ');
            let displayName;
            if(nameParts.length>1){
                const firstName=nameParts.slice(0,-1).join(' ');
                const surname=nameParts[nameParts.length-1];
                displayName=`${firstName} <span class="player-name-bold">${surname}</span>`;
            }else{
                displayName=`<span class="player-name-bold">${p.name}</span>`;
            }
            
            row.innerHTML=`<td>${displayName}</td><td class='${getPositionCategory(p.positions[0])}'>${p.positions.join('/')}</td><td>${p.age}</td><td>${p.quality}</td><td>${total}</td><td>${matches}</td>`;
            
            const actionsCell=document.createElement('td');
            const resetBtn=document.createElement('button');
            resetBtn.className='reset-player-minutes-btn';
            resetBtn.textContent='Reset';
            resetBtn.dataset.playerId=p.id;
            actionsCell.appendChild(resetBtn);
            row.appendChild(actionsCell);
            
            row.addEventListener('click',function(e){
                if(e.target.classList.contains('reset-player-minutes-btn'))return;
                
                const id=parseInt(this.dataset.playerId);
                this.classList.toggle('selected');
                if(this.classList.contains('selected')){
                    if(!selectedPlayersForMinutes.includes(id))selectedPlayersForMinutes.push(id);
                }else{
                    selectedPlayersForMinutes=selectedPlayersForMinutes.filter(x=>x!==id);
                }
            });
            tbody.appendChild(row);
        });
    }

    function updateGoalsAssistsTable(){
        const tbody=document.querySelector('#goals-assists-table tbody');
        tbody.innerHTML='';
        players.forEach(p => {
            ensureGaFields(p);
            let currentQuality = p.initialQuality;
            for (let i = p.progress.length - 1; i >= 0; i--) {
                if (p.progress[i] !== null && p.progress[i] !== undefined) {
                    currentQuality = p.progress[i];
                    break;
                }
            }
            const totalGoals=p.leagueGoals+p.clGoals+p.cupGoals;
            const totalAssists=p.leagueAssists+p.clAssists+p.cupAssists;
            const ga=totalGoals+totalAssists;
            const totalMinutes=p.totalMinutes||0;
            
            let goalsPer90 = totalMinutes > 0 ? (totalGoals * 90) / totalMinutes : 0;
            let assistsPer90 = totalMinutes > 0 ? (totalAssists * 90) / totalMinutes : 0;
            let gaPer90 = totalMinutes > 0 ? (ga * 90) / totalMinutes : 0;
            const row=document.createElement('tr');
            row.dataset.playerId=p.id;
            
            const nameParts=p.name.split(' ');
            let displayName = nameParts.length > 1 ? `${nameParts.slice(0,-1).join(' ')} <span class="player-name-bold">${nameParts[nameParts.length-1]}</span>` : `<span class="player-name-bold">${p.name}</span>`;
            row.innerHTML=`<td>${displayName}</td><td class='${getPositionCategory(p.positions[0])}'>${p.positions.join('/')}</td><td>${p.age}</td><td>${currentQuality}%</td>`;
            
            const comps=['league','cl','cup'];
            comps.forEach(c => {
                let tdG=document.createElement('td');
                tdG.innerHTML=`<div class="ga-control">
                    <button class="ga-btn minus" data-field="${c}Goals" data-op="-1">-</button>
                    <span class="ga-value ${c}-color">${p[`${c}Goals`]}</span>
                    <button class="ga-btn plus" data-field="${c}Goals" data-op="1">+</button>
                </div>`;
                row.appendChild(tdG);
                let tdA=document.createElement('td');
                tdA.innerHTML=`<div class="ga-control">
                    <button class="ga-btn minus" data-field="${c}Assists" data-op="-1">-</button>
                    <span class="ga-value ${c}-color">${p[`${c}Assists`]}</span>
                    <button class="ga-btn plus" data-field="${c}Assists" data-op="1">+</button>
                </div>`;
                row.appendChild(tdA);
            });
            
            row.innerHTML+=`<td class="stats-separator">${totalGoals}</td><td>${totalAssists}</td><td>${ga}</td><td class="per90-separator">${goalsPer90.toFixed(2)}</td><td>${assistsPer90.toFixed(2)}</td><td>${gaPer90.toFixed(2)}</td>`;
            tbody.appendChild(row);
        });
    }

    document.getElementById('goals-assists-table').addEventListener('click', function(e) {
        if (e.target.classList.contains('ga-btn')) {
            const row = e.target.closest('tr');
            const pid = parseInt(row.dataset.playerId);
            const field = e.target.dataset.field;
            const operation = parseInt(e.target.dataset.op);
            const p = players.find(pl => pl.id === pid);
            if (p) {
                const previousValue = p[field];
                const newValue = Math.max(0, (p[field] || 0) + operation);
                if (previousValue === newValue) return;
                const undoState = {
                    type: 'changeGA',
                    playerId: pid,
                    field: field,
                    previousValue: previousValue,
                    newValue: newValue
                };
                gaHistory.push(undoState);
                p[field] = newValue;
                savePlayersToLocalStorage();
                updateGoalsAssistsTable();
            }
        }
    });

    function undoLastGaChange(){
        if(gaHistory.length===0){
            alert('No changes to undo');
            return;
        }
        
        const lastChange=gaHistory.pop();
        if(lastChange.type==='changeGA'){
            const p=players.find(pl=>pl.id===lastChange.playerId);
            if(p){
                p[lastChange.field]=lastChange.previousValue;
            }
        }
        
        savePlayersToLocalStorage();
        updateGoalsAssistsTable();
    }

    function updateMostImprovedTable(sortBy = 'improvement', sortOrder = 'desc') {
        const tbody = document.querySelector('#most-improved-table tbody');
        tbody.innerHTML = '';
        
        const improvements = players.map(p => {
            let currentQuality = p.initialQuality;
            for (let i = p.progress.length - 1; i >= 0; i--) {
                if (p.progress[i] !== null && p.progress[i] !== undefined) {
                    currentQuality = p.progress[i];
                    break;
                }
            }
            
            const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const improvement = currentQuality - p.initialQuality;
            const improvementPercent = p.initialQuality > 0 ? (improvement / p.initialQuality * 100) : 0;
            
            return {
                player: p,
                initialQuality: p.initialQuality,
                currentQuality: currentQuality,
                improvement: improvement,
                improvementPercent: improvementPercent,
                totalGoals: totalGoals,
                totalAssists: totalAssists,
                avgMinPerMatch: (p.matchesPlayed || 0) > 0 ? (p.totalMinutes || 0) / p.matchesPlayed : 0
            };
        });
        
        improvements.sort((a, b) => {
            let valA, valB;
            switch(sortBy) {
                case 'player': valA = a.player.name; valB = b.player.name; break;
                case 'age': valA = a.player.age; valB = b.player.age; break;
                case 'initialQuality': valA = a.initialQuality; valB = b.initialQuality; break;
                case 'currentQuality': valA = a.currentQuality; valB = b.currentQuality; break;
                case 'minutes': valA = a.player.totalMinutes || 0; valB = b.player.totalMinutes || 0; break;
                case 'matches': valA = a.player.matchesPlayed || 0; valB = b.player.matchesPlayed || 0; break;
                case 'g': valA = a.totalGoals; valB = b.totalGoals; break;
                case 'a': valA = a.totalAssists; valB = b.totalAssists; break;
                case 'avgMinPerMatch': valA = a.avgMinPerMatch; valB = b.avgMinPerMatch; break;
                case 'improvementPercent': valA = a.improvementPercent; valB = b.improvementPercent; break;
                default:
                    valA = a.improvement; valB = b.improvement; break;
            }
            if (typeof valA === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
        
        improvements.forEach((item, index) => {
            const p = item.player;
            const row = document.createElement('tr');
            const rank = index + 1;
            const improvementClass = item.improvement > 0 ? 'color:green' : item.improvement < 0 ? 'color:red' : '';
            const improvementSign = item.improvement > 0 ? '+' : '';
            row.innerHTML = `
                <td>${rank}</td>
                <td>${p.name}</td>
                <td class='${getPositionCategory(p.positions[0])}'>${p.positions.join('/')}</td>
                <td>${p.age}</td>
                <td>${item.initialQuality}%</td>
                <td>${item.currentQuality}%</td>
                <td>${p.totalMinutes || 0}</td>
                <td>${p.matchesPlayed || 0}</td>
                <td>${item.avgMinPerMatch.toFixed(1)}</td>
                <td>${item.totalGoals}</td>
                <td>${item.totalAssists}</td>
                <td style='${improvementClass}'>${improvementSign}${item.improvement}%</td>
                <td style='${improvementClass}'>${improvementSign}${item.improvementPercent.toFixed(1)}%</td>
            `;
            tbody.appendChild(row);
        });
        renderTalentChart(improvements);
    }

    function setupTrainingCalculator() {
        let trainingTimes = JSON.parse(localStorage.getItem('trainingTimes') || '["23:10", "2:10", "5:10", "8:10", "11:10", "14:10", "17:10", "20:10"]');
        const tbody = document.querySelector('#training-table tbody');
        tbody.innerHTML = '';
        
        trainingTimes.forEach((time, index) => {
            const row = document.createElement('tr');
            let timeCellContent = isEditingTrainingTimes 
                ? `<td><input type="text" class="training-time-input" value="${time}" data-index="${index}"></td>`
                : `<td>${time}</td>`;
            row.innerHTML = `
                ${timeCellContent}
                <td><input type="number" class="training-input" data-time="${time}" min="0" placeholder="0"></td>
            `;
            tbody.appendChild(row);
        });
        
        document.getElementById('most-improved-content').addEventListener('input', function(e){
            if(e.target.classList.contains('training-input')) {
                updateTrainingSummary();
            }
        });
        loadTrainingBonuses();
    }

    function updateTrainingSummary() {
        const inputs = document.querySelectorAll('.training-input');
        let sum = 0;
        const trainingValues = {};
        inputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            sum += value;
            trainingValues[input.dataset.time] = value;
        });
        
        const rangeHigh = 99 - sum;
        const rangeLow = 94 - sum;
        document.getElementById('training-range').textContent = `${rangeLow}% - ${rangeHigh}%`;
        
        localStorage.setItem('trainingBonuses', JSON.stringify(trainingValues));
    }

    function loadTrainingBonuses() {
        const savedBonuses = localStorage.getItem('trainingBonuses');
        if (savedBonuses) {
            const trainingValues = JSON.parse(savedBonuses);
            const inputs = document.querySelectorAll('.training-input');
            inputs.forEach(input => {
                const time = input.dataset.time;
                if (trainingValues[time]) {
                    input.value = trainingValues[time];
                }
            });
        }
        updateTrainingSummary();
    }

    function resetTrainingCalculator() {
        const inputs = document.querySelectorAll('.training-input');
        inputs.forEach(input => {
            input.value = '';
        });
        updateTrainingSummary();
    }

    function handleEditSaveTrainingTimes() {
        const btn = document.getElementById('edit-training-times-btn');
        isEditingTrainingTimes = !isEditingTrainingTimes;
        if (isEditingTrainingTimes) {
            btn.textContent = 'Save Times';
            btn.style.backgroundColor = '#28a745';
            setupTrainingCalculator();
        } else {
            const timeInputs = document.querySelectorAll('.training-time-input');
            const newTimes = Array.from(timeInputs).map(input => input.value.trim());
            
            if (newTimes.some(t => !/^\d{1,2}:\d{2}$/.test(t))) {
                alert('Invalid time format. Please use HH:MM.');
                isEditingTrainingTimes = true;
                return;
            }
            localStorage.setItem('trainingTimes', JSON.stringify(newTimes));
            
            btn.textContent = 'Edit Times';
            btn.style.backgroundColor = '#17a2b8';
            
            localStorage.removeItem('trainingBonuses'); 
            
            setupTrainingCalculator();
            updateTrainingSummary();
            alert('Training times updated. All training bonuses have been reset.');
        }
    }

    function renderTalentChart(improvementData) {
        const ctx = document.getElementById('talent-chart').getContext('2d');
        
        if (talentChart) {
            talentChart.destroy();
        }

        const chartData = improvementData.map(item => {
            const p = item.player;
            const radius = 5 + ((p.totalMinutes || 0) / 100); 
            return {
                x: p.age,
                y: item.improvement,
                r: Math.min(radius, 30),
                label: p.name
            };
        });
        
        talentChart = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Players',
                    data: chartData,
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dataPoint = context.raw;
                                const player = improvementData.find(item => item.player.name === dataPoint.label).player;
                                return `${dataPoint.label}: Age ${dataPoint.x}, Improvement ${dataPoint.y}%, Minutes ${player.totalMinutes || 0}`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Age'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Quality Improvement (%)'
                        }
                    }
                }
            }
        });
    }

    function getCurrentDay() {
        let lastDay = 0;
        players.forEach(p => {
            if (p.progress) {
                for (let i = p.progress.length - 1; i >= 0; i--) {
                    if (p.progress[i] !== null && p.progress[i] !== undefined) {
                        lastDay = Math.max(lastDay, i);
                    }
                }
            }
        });
        return lastDay + 1;
    }

    function getAdjustedGaScore(p) {
        const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
        const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
        let goalWeight = 0, assistWeight = 0;
        const pos = p.positions[0];
        if (['ST', 'AML', 'AMR', 'AMC'].includes(pos)) {
            goalWeight = 1.1; assistWeight = 0.8;
        } else if (['MC', 'ML', 'MR', 'DMC'].includes(pos)) {
            goalWeight = 1.8; assistWeight = 1.5;
        } else if (['DL', 'DR', 'DC', 'GK'].includes(pos)) {
            goalWeight = 2.7; assistWeight = 2.3;
        }
        return (totalGoals * goalWeight) + (totalAssists * assistWeight);
    }

    function getAgeValue(age) {
        if (age >= 18 && age <= 21) return 5;
        if (age >= 22 && age <= 25) return 3;
        if (age >= 26) return 2;
        return 0;
    }

    function calculatePowerData() {
        return players.map(p => {
            let currentQuality = p.initialQuality;
            for (let i = p.progress.length - 1; i >= 0; i--) {
                if (p.progress[i] !== null && p.progress[i] !== undefined) {
                    currentQuality = p.progress[i];
                    break;
                }
            }
            const improvement = currentQuality - p.initialQuality;
            
            const x = currentQuality;
            const qualityScore = (0.000175825 * x * x * x) - (0.05092985 * x * x) + (4.9956096 * x) - 156.471597;
            
            const improvementMap = { 1:0, 2:0, 3:0, 4:0, 5:1, 6:1, 7:2, 8:2, 9:2, 10:2, 11:3, 12:3, 13:4, 14:5, 15:5, 16:6, 17:7, 18:8, 19:8, 20:9, 21:9, 22:9, 23:10, 24:10, 25:10, 26:11, 27:13, 28:15, 29:17, 30:20 };
            let improvementScore = 0;
            if (improvement > 0) {
                improvementScore = improvementMap[Math.min(30, improvement)] || 0;
                if(improvement > 30) improvementScore = 20;
            }
            const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const ga = totalGoals + totalAssists;
            const gaPer90 = p.totalMinutes > 0 ? (ga * 90) / p.totalMinutes : 0;
            const usageScore = gaPer90 * 3;
            const gaScore = getAdjustedGaScore(p);
            const ageValue = getAgeValue(p.age);
            
            const powerScore = qualityScore + improvementScore + gaScore + usageScore + ageValue;
            
            return {
                player: p,
                powerScore: powerScore,
                currentQuality: qualityScore,
                improvementScore,
                adjustedGaPer90: gaScore,
                usageScore,
                ageValue
            };
        }).sort((a, b) => b.powerScore - a.powerScore);
    }

    function renderPowerRankingTable(powerData) {
        const tbody = document.querySelector('#power-ranking-table tbody');
        tbody.innerHTML = '';
        const previousDataMap = new Map(previousPowerRanking.map(p => [p.player.id, p]));
        const maxScores = {
            powerScore: Math.max(0, ...powerData.map(d => d.powerScore)),
            currentQuality: Math.max(0, ...powerData.map(d => d.currentQuality)),
            improvementScore: Math.max(0, ...powerData.map(d => d.improvementScore)),
            adjustedGaPer90: Math.max(0, ...powerData.map(d => d.adjustedGaPer90)),
            usageScore: Math.max(0, ...powerData.map(d => d.usageScore)),
            ageValue: Math.max(0, ...powerData.map(d => d.ageValue))
        };
        powerData.forEach((data, index) => {
            const p = data.player;
            const row = document.createElement('tr');
            row.dataset.playerId = p.id;
            if (selectedPowerRankingPlayers.includes(p.id)) {
                row.classList.add('selected');
            }
            const maxClass = (field, value) => (value > 0 && value === maxScores[field]) ? 'class="top-score"' : '';
            
            const newRank = index + 1;
            const oldData = previousDataMap.get(p.id);
            const oldRank = oldData ? previousPowerRanking.findIndex(pr => pr.player.id === p.id) + 1 : null;
            let rankChangeHtml = '<span style="color: #999;">–</span>';
            if (oldRank && oldRank !== newRank) {
                rankChangeHtml = newRank < oldRank
                    ? `<span style="color: green;">▲ ${oldRank - newRank}</span>`
                    : `<span style="color: red;">▼ ${newRank - oldRank}</span>`;
            }
            
            const getChangeHtml = (field) => {
                if (!oldData) return '';
                const diff = data[field] - oldData[field];
                if (Math.abs(diff) < 0.01) return '';
                const color = diff > 0 ? 'green' : 'red';
                const sign = diff > 0 ? '+' : '';
                return ` <span style="font-size: 11px; color: ${color};">(${sign}${diff.toFixed(2)})</span>`;
            };
            const powerScoreChange = getChangeHtml('powerScore');
            const gaScoreChange = getChangeHtml('adjustedGaPer90');
            const usageScoreChange = getChangeHtml('usageScore');
            
            row.innerHTML = `
                <td>${newRank}</td>
                <td>${p.name}</td>
                <td class='${getPositionCategory(p.positions[0])}'>${p.positions.join('/')}</td>
                <td>${rankChangeHtml}</td>
                <td ${maxClass('powerScore', data.powerScore)}>${data.powerScore.toFixed(2)}${powerScoreChange}</td>
                <td ${maxClass('currentQuality', data.currentQuality)}>${data.currentQuality.toFixed(2)}</td>
                <td ${maxClass('improvementScore', data.improvementScore)}>${data.improvementScore}</td>
                <td ${maxClass('adjustedGaPer90', data.adjustedGaPer90)}>${data.adjustedGaPer90.toFixed(2)}${gaScoreChange}</td>
                <td ${maxClass('usageScore', data.usageScore)}>${data.usageScore.toFixed(2)}${usageScoreChange}</td>
                <td ${maxClass('ageValue', data.ageValue)}>+${data.ageValue}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateAndSavePowerRanking() {
        const currentDay = getCurrentDay();
        const newPowerData = calculatePowerData();
        
        powerRankingTimeSeries[currentDay] = newPowerData.map((data) => ({
            playerId: data.player.id,
            powerScore: data.powerScore
        }));
        localStorage.setItem('powerRankingTimeSeries', JSON.stringify(powerRankingTimeSeries));
        
        renderPowerRankingTable(newPowerData);
        renderPowerRankingChart();
        
        previousPowerRanking = [...newPowerData];
        localStorage.setItem('powerRankingHistory', JSON.stringify(previousPowerRanking));
        
        alert(`Power Ranking updated for Day ${currentDay}!`);
    }

    function renderPowerRankingChart() {
        const ctx = document.getElementById('power-ranking-chart').getContext('2d');
        if (powerRankingChart) {
            powerRankingChart.destroy();
        }
        const days = Object.keys(powerRankingTimeSeries).map(Number).sort((a, b) => a - b);
        if (days.length === 0) {
             ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
             return;
        }
        
        const playerColors = {};
        players.forEach((p, i) => {
            const hue = (i * 137.508) % 360;
            playerColors[p.id] = `hsl(${hue}, 70%, 50%)`;
        });
        const datasets = players.map(player => {
            const data = days.map(day => {
                const dayData = powerRankingTimeSeries[day];
                const playerData = dayData.find(d => d.playerId === player.id);
                return playerData ? { x: day, y: playerData.powerScore } : null;
            }).filter(Boolean);
            const isSelected = selectedPowerRankingPlayers.includes(player.id);
            const isAnySelected = selectedPowerRankingPlayers.length > 0;
            return {
                label: player.name,
                data: data,
                borderColor: isAnySelected && !isSelected ? 'rgba(204, 204, 204, 0.5)' : (playerColors[player.id] || '#ccc'),
                backgroundColor: playerColors[player.id] || '#ccc',
                fill: false,
                tension: 0.1,
                borderWidth: isSelected ? 4 : (isAnySelected ? 1 : 2),
                pointRadius: isSelected ? 5 : (isAnySelected ? 2 : 3),
                pointHoverRadius: 7
            };
        }).filter(d => d.data.length > 0);
        powerRankingChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: { display: true, text: 'Power Score Ranking' },
                        reverse: false,
                        beginAtZero: true
                    },
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Day of Season' },
                        min: 1,
                        max: 28,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `Day ${tooltipItems[0].raw.x}`,
                            label: (context) => `${context.dataset.label}: Score ${context.raw.y.toFixed(2)}`
                        }
                    },
                     legend: {
                        display: false
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'xy',
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                modifierKey: 'ctrl',
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy',
                        }
                    }
                }
            }
        });
    }

    function loadPowerRankingData() {
        previousPowerRanking = JSON.parse(localStorage.getItem('powerRankingHistory') || '[]');
        powerRankingTimeSeries = JSON.parse(localStorage.getItem('powerRankingTimeSeries') || '{}');
        renderPowerRankingTable(previousPowerRanking);
        renderPowerRankingChart();
    }

    function formatSeasonString(seasonSet) {
        if (!seasonSet || seasonSet.size === 0) return 'N/A';
        const seasons = Array.from(seasonSet).sort((a, b) => a - b);
        if (seasons.length === 0) return 'N/A';
        const ranges = [];
        let start = seasons[0];
        let end = seasons[0];
        for (let i = 1; i < seasons.length; i++) {
            if (seasons[i] === end + 1) {
                end = seasons[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = seasons[i];
                end = seasons[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        return ranges.join(', ');
    }

    function renderPlayerSearchResults(results, container) {
        container.innerHTML = '';
        if (results.length === 0) {
            container.innerHTML = '<p style="font-size: 13px; color: #666;">No matching players found in archives.</p>';
            return;
        }
        results.forEach(data => {
            const p = data.player;
            const card = document.createElement('div');
            card.style.cssText = 'background-color: #fff; border: 1px solid #e9e9e9; border-radius: 5px; padding: 15px; margin-bottom: 10px; font-size: 13px;';
            const seasonsString = formatSeasonString(data.seasons);
            card.innerHTML = `
                <h5 style="margin: 0 0 10px 0; font-size: 14px;">
                    ${p.name} (${p.age}, ${p.positions.join('/')})
                </h5>
                <p style="margin: 5px 0;"><strong>Seasons Archived:</strong> ${seasonsString}</p>
                <p style="margin: 5px 0;"><strong>Career Totals:</strong></p>
                <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                    <li><strong>Minutes:</strong> ${data.totalMinutes}</li>
                    <li><strong>Matches:</strong> ${data.totalMatches}</li>
                    <li><strong>Goals:</strong> ${data.totalGoals}</li>
                    <li><strong>Assists:</strong> ${data.totalAssists}</li>
                </ul>
            `;
            container.appendChild(card);
        });
    }

    function setupPlayerSearch() {
        const searchInput = document.getElementById('player-search-input');
        const searchResults = document.getElementById('player-search-results');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }
            const seasonArchives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
            const individualArchives = JSON.parse(localStorage.getItem('archivedPlayers') || '[]');
            const playerHistory = new Map();
            seasonArchives.forEach(season => {
                season.players.forEach(p => {
                    if (p.name.toLowerCase().includes(query)) {
                        if (!playerHistory.has(p.name)) {
                            playerHistory.set(p.name, { player: p, seasons: new Set(), totalMinutes: 0, totalMatches: 0, totalGoals: 0, totalAssists: 0 });
                        }
                        const history = playerHistory.get(p.name);
                        history.seasons.add(season.seasonNumber);
                        history.totalMinutes += p.totalMinutes || 0;
                        history.totalMatches += p.matchesPlayed || 0;
                        history.totalGoals += (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
                        history.totalAssists += (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
                    }
                });
            });
            individualArchives.forEach(p => {
                if (p.name.toLowerCase().includes(query) && !playerHistory.has(p.name)) {
                    playerHistory.set(p.name, { player: p, seasons: new Set(), totalMinutes: p.totalMinutes || 0, totalMatches: p.matchesPlayed || 0, totalGoals: (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0), totalAssists: (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0) });
                }
            });
            renderPlayerSearchResults(Array.from(playerHistory.values()), searchResults);
        });
    }

    function renderHallOfFame(category = 'matchesPlayed') {
        document.querySelectorAll('.hof-category-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.hof-category-btn[data-category="${category}"]`);
        const categoryNames = { 'matchesPlayed': 'Matches Played', 'totalMinutes': 'Total Minutes', 'goals': 'Total Goals', 'assists': 'Total Assists', 'gaPer90': 'G+A per 90' };
        if (activeBtn) {
            activeBtn.classList.add('active');
            const categoryName = categoryNames[category] || activeBtn.textContent;
            document.getElementById('hof-title').textContent = `Hall of Fame: Top 10 by ${categoryName}`;
            document.getElementById('hof-value-header').textContent = categoryName;
        }
        const tbody = document.querySelector('#hof-table tbody');
        tbody.innerHTML = '';
        const seasonArchives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
        const manuallyArchivedPlayers = JSON.parse(localStorage.getItem('archivedPlayers') || '[]');
        if (manuallyArchivedPlayers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No archived players found to build the Hall of Fame.</td></tr>';
            return;
        }
        
        const aggregatedPlayers = manuallyArchivedPlayers.map(p => {
            const careerMatches = p.matchesPlayed || 0;
            const careerMinutes = p.totalMinutes || 0;
            const careerGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const careerAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const ga = careerGoals + careerAssists;
            const gaPer90 = careerMinutes > 0 ? (ga * 90) / careerMinutes : 0;
            
            const seasons = new Set();
            if (p.archivedInSeason) {
                seasons.add(p.archivedInSeason);
            }
            seasonArchives.forEach(season => {
                if (season.players.some(seasonPlayer => seasonPlayer.name === p.name)) {
                    seasons.add(season.seasonNumber);
                }
            });
            return {
                player: p,
                matchesPlayed: careerMatches,
                totalMinutes: careerMinutes,
                goals: careerGoals,
                assists: careerAssists,
                gaPer90: gaPer90,
                seasons: seasons
            };
        });
        aggregatedPlayers.sort((a, b) => b[category] - a[category]);
        const top10 = aggregatedPlayers.slice(0, 10);
        if (top10.length === 0) {
             tbody.innerHTML = '<tr><td colspan="6">No archived players found to build the Hall of Fame.</td></tr>';
             return;
        }
        top10.forEach((item, index) => {
            const row = document.createElement('tr');
            const p = item.player;
            let value;
            switch (category) {
                case 'gaPer90': value = item[category].toFixed(2); break;
                default: value = item[category];
            }
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td>${p.name}</td>
                <td>${p.positions.join('/')}</td>
                <td>${p.age}</td>
                <td>${formatSeasonString(item.seasons)}</td>
                <td class="value">${value}</td>
            `;
            tbody.appendChild(row);
        });
    }
    function renderAllTimeLeaders(category = 'matchesPlayed') {
        document.querySelectorAll('.atl-category-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.atl-category-btn[data-category="${category}"]`);
        const categoryNames = { 'matchesPlayed': 'Matches Played', 'totalMinutes': 'Total Minutes', 'goals': 'Total Goals', 'assists': 'Total Assists', 'gaPer90': 'G+A per 90' };
        if (activeBtn) {
            activeBtn.classList.add('active');
            const categoryName = categoryNames[category] || activeBtn.textContent;
            document.getElementById('atl-title').textContent = `All-Time Leaders: Top 10 by ${categoryName}`;
            document.getElementById('atl-value-header').textContent = categoryName;
        }
        const tbody = document.querySelector('#atl-table tbody');
        tbody.innerHTML = '';
        
        const archivedPlayersList = JSON.parse(localStorage.getItem('archivedPlayers') || '[]');
        const seasonArchives = JSON.parse(localStorage.getItem('topElevenArchives') || '[]');
        
        const allPlayers = [];
        
        // Add active players with career stats (sum from all archived seasons + current season)
        players.forEach(p => {
            // Current season stats
            const currentSeasonGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const currentSeasonAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const currentSeasonMinutes = p.totalMinutes || 0;
            const currentSeasonMatches = p.matchesPlayed || 0;
            
            // Find this player in all archived seasons and sum their stats
            let archivedGoals = 0;
            let archivedAssists = 0;
            let archivedMinutes = 0;
            let archivedMatches = 0;
            
            seasonArchives.forEach(season => {
                const archivedPlayer = season.players.find(ap => ap.name === p.name);
                if (archivedPlayer) {
                    archivedGoals += (archivedPlayer.leagueGoals || 0) + (archivedPlayer.clGoals || 0) + (archivedPlayer.cupGoals || 0);
                    archivedAssists += (archivedPlayer.leagueAssists || 0) + (archivedPlayer.clAssists || 0) + (archivedPlayer.cupAssists || 0);
                    archivedMinutes += archivedPlayer.totalMinutes || 0;
                    archivedMatches += archivedPlayer.matchesPlayed || 0;
                }
            });
            
            // Career totals = archived seasons stats + current season stats
            const careerGoals = archivedGoals + currentSeasonGoals;
            const careerAssists = archivedAssists + currentSeasonAssists;
            const careerMinutes = archivedMinutes + currentSeasonMinutes;
            const careerMatches = archivedMatches + currentSeasonMatches;
            
            const ga = careerGoals + careerAssists;
            const gaPer90 = careerMinutes > 0 ? (ga * 90) / careerMinutes : 0;
            
            allPlayers.push({
                player: p,
                matchesPlayed: careerMatches,
                totalMinutes: careerMinutes,
                goals: careerGoals,
                assists: careerAssists,
                gaPer90: gaPer90,
                isActive: true
            });
        });
        
        // Add archived players
        archivedPlayersList.forEach(p => {
            const totalGoals = (p.leagueGoals || 0) + (p.clGoals || 0) + (p.cupGoals || 0);
            const totalAssists = (p.leagueAssists || 0) + (p.clAssists || 0) + (p.cupAssists || 0);
            const totalMinutes = p.totalMinutes || 0;
            const matchesPlayed = p.matchesPlayed || 0;
            const ga = totalGoals + totalAssists;
            const gaPer90 = totalMinutes > 0 ? (ga * 90) / totalMinutes : 0;
            
            allPlayers.push({
                player: p,
                matchesPlayed: matchesPlayed,
                totalMinutes: totalMinutes,
                goals: totalGoals,
                assists: totalAssists,
                gaPer90: gaPer90,
                isActive: false
            });
        });
        
        if (allPlayers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No players found.</td></tr>';
            return;
        }
        
        allPlayers.sort((a, b) => b[category] - a[category]);
        const top10 = allPlayers.slice(0, 10);
        
        top10.forEach((item, index) => {
            const row = document.createElement('tr');
            const p = item.player;
            let value;
            switch (category) {
                case 'gaPer90': value = item[category].toFixed(2); break;
                default: value = item[category];
            }
            
            const statusBadge = item.isActive 
                ? '<span class="status-badge status-active">Active</span>' 
                : '<span class="status-badge status-archived">Archived</span>';
            
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td>${p.name}</td>
                <td class="${getPositionCategory(p.positions[0])}">${p.positions.join('/')}</td>
                <td>${p.age}</td>
                <td>${statusBadge}</td>
                <td class="value">${value}</td>
            `;
            tbody.appendChild(row);
        });
    }
    function showArchivedPowerRanking(archive) {
        const modal = document.getElementById('archived-pr-modal');
        const title = document.getElementById('archived-pr-title');
        const body = document.getElementById('archived-pr-body');
        
        title.textContent = `Season ${archive.seasonNumber} Power Rankings (Ended: ${archive.endDate})`;
        body.innerHTML = '';
        
        if (!archive.powerRankingHistory || archive.powerRankingHistory.length === 0) {
            body.innerHTML = '<p style="color: #666;">No power ranking data available for this season.</p>';
            modal.style.display = 'flex';
            return;
        }
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        tableContainer.style.marginBottom = '30px';
        
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="border: 1px solid #ddd; padding: 8px;">Rank</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Player</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Positions</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Power Score</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Quality</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Improvement</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">G+A Score</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Usage</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Age Bonus</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        archive.powerRankingHistory.forEach((data, index) => {
            const p = data.player;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${p.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;" class="${getPositionCategory(p.positions[0])}">${p.positions.join('/')}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${data.powerScore.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${data.currentQuality.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${data.improvementScore}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${data.adjustedGaPer90.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${data.usageScore.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">+${data.ageValue}</td>
            `;
            tbody.appendChild(row);
        });
        
        tableContainer.appendChild(table);
        body.appendChild(tableContainer);
        
        if (archive.powerRankingTimeSeries && Object.keys(archive.powerRankingTimeSeries).length > 0) {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-container';
            chartContainer.style.height = '400px';
            chartContainer.innerHTML = '<h3>Power Ranking History</h3><canvas id="archived-pr-chart"></canvas>';
            body.appendChild(chartContainer);
            
            setTimeout(() => {
                renderArchivedPowerRankingChart(archive.powerRankingTimeSeries, archive.players);
            }, 100);
        }
        
        modal.style.display = 'flex';
    }

    function renderArchivedPowerRankingChart(timeSeries, archivedPlayers) {
        const ctx = document.getElementById('archived-pr-chart');
        if (!ctx) return;
        
        const days = Object.keys(timeSeries).map(Number).sort((a, b) => a - b);
        if (days.length === 0) return;
        
        const playerColors = {};
        archivedPlayers.forEach((p, i) => {
            const hue = (i * 137.508) % 360;
            playerColors[p.id] = `hsl(${hue}, 70%, 50%)`;
        });
        
        const datasets = archivedPlayers.map(player => {
            const data = days.map(day => {
                const dayData = timeSeries[day];
                const playerData = dayData.find(d => d.playerId === player.id);
                return playerData ? { x: day, y: playerData.powerScore } : null;
            }).filter(Boolean);
            
            return {
                label: player.name,
                data: data,
                borderColor: playerColors[player.id] || '#ccc',
                backgroundColor: playerColors[player.id] || '#ccc',
                fill: false,
                tension: 0.1,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6
            };
        }).filter(d => d.data.length > 0);
        
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: { display: true, text: 'Power Score' },
                        beginAtZero: true
                    },
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Day of Season' },
                        min: 1,
                        max: 28,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => `Day ${tooltipItems[0].raw.x}`,
                            label: (context) => `${context.dataset.label}: Score ${context.raw.y.toFixed(2)}`
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    function initStatsCalculator() {
        const calcPanel = document.getElementById('stats-calculator');
        const calcToggle = document.getElementById('calc-toggle');
        const calcTableBody = document.getElementById('calc-table-body');
        const calcResetBtn = document.getElementById('calc-reset-btn');
        
        for (let i = 0; i < 8; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="number" class="stats-calc-input calc-minutes" placeholder="0"></td>
                <td><input type="number" class="stats-calc-input calc-matches" placeholder="0"></td>
                <td><input type="number" class="stats-calc-input calc-goals" placeholder="0"></td>
                <td><input type="number" class="stats-calc-input calc-assists" placeholder="0"></td>
            `;
            calcTableBody.appendChild(row);
        }
        
        calcToggle.addEventListener('click', () => {
            calcPanel.classList.toggle('open');
        });
        
        calcTableBody.addEventListener('input', updateCalcSums);
        
        function updateCalcSums() {
            const minutesInputs = document.querySelectorAll('.calc-minutes');
            const matchesInputs = document.querySelectorAll('.calc-matches');
            const goalsInputs = document.querySelectorAll('.calc-goals');
            const assistsInputs = document.querySelectorAll('.calc-assists');
            
            let sumMinutes = 0, sumMatches = 0, sumGoals = 0, sumAssists = 0;
            
            minutesInputs.forEach(input => sumMinutes += parseInt(input.value) || 0);
            matchesInputs.forEach(input => sumMatches += parseInt(input.value) || 0);
            goalsInputs.forEach(input => sumGoals += parseInt(input.value) || 0);
            assistsInputs.forEach(input => sumAssists += parseInt(input.value) || 0);
            
            document.getElementById('calc-sum-minutes').textContent = sumMinutes;
            document.getElementById('calc-sum-matches').textContent = sumMatches;
            document.getElementById('calc-sum-goals').textContent = sumGoals;
            document.getElementById('calc-sum-assists').textContent = sumAssists;
        }
        
        calcResetBtn.addEventListener('click', () => {
            document.querySelectorAll('.stats-calc-input').forEach(input => input.value = '');
            updateCalcSums();
        });
    }

    // Event Listeners
    addPlayerBtn.addEventListener('click',()=>{clearModal();playerModal.style.display='flex';});
    cancelBtn.addEventListener('click',()=>{playerModal.style.display='none';clearModal();});
    confirmCancelBtn.addEventListener('click',()=>{confirmModal.style.display='none';});
    ageAllBtn.addEventListener('click',ageAllPlayers);
    fullMatchBtn.addEventListener('click',()=>{minutesInput.value='90';});
    confirmMinutesBtn.addEventListener('click',()=>{
        const mins=parseInt(minutesInput.value);
        if(isNaN(mins)||mins<1||mins>120){alert('Please enter valid minutes (1-90)');return;}
        if(selectedPlayersForMinutes.length===0){alert('Please select at least one player');return;}
        addMinutesToSelected(mins);
        minutesInput.value='';
    });
    undoMinutesBtn.addEventListener('click',undoLastMinutesChange);
    undoGaBtn.addEventListener('click',undoLastGaChange);
    resetTrainingBtn.addEventListener('click', resetTrainingCalculator);
    document.getElementById('edit-training-times-btn').addEventListener('click', handleEditSaveTrainingTimes);
    document.getElementById('update-power-ranking-btn').addEventListener('click', updateAndSavePowerRanking);
    endSeasonBtn.addEventListener('click', endSeason);
    downloadDataBtn.addEventListener('click', downloadData);
    uploadDataBtn.addEventListener('click', () => uploadFileInput.click());
    uploadFileInput.addEventListener('change', uploadData);
    
    document.getElementById('most-improved-table').addEventListener('click', function(e) {
        const header = e.target.closest('th');
        if (header) {
            const sortBy = header.dataset.sort;
            if (!sortBy) return;
            const currentSort = header.dataset.order || 'desc';
            const newOrder = currentSort === 'desc' ? 'asc' : 'desc';
            
            document.querySelectorAll('#most-improved-table th[data-sort]').forEach(th => {
                if (!th.querySelector('.sort-indicator')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'sort-indicator';
                    indicator.textContent = '▼';
                    th.appendChild(indicator);
                }
            });

            header.dataset.order = newOrder;
            header.querySelector('.sort-indicator').classList.add(newOrder);
            updateMostImprovedTable(sortBy, newOrder);
        }
    });
    
    document.getElementById('power-ranking-table').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row || !row.dataset.playerId) return;
        const playerId = parseInt(row.dataset.playerId);
        const isCtrlPressed = e.ctrlKey || e.metaKey;
        if (!isCtrlPressed) {
            if (selectedPowerRankingPlayers.length === 1 && selectedPowerRankingPlayers[0] === playerId) {
                selectedPowerRankingPlayers = [];
            } else {
                selectedPowerRankingPlayers = [playerId];
            }
        } else {
            const index = selectedPowerRankingPlayers.indexOf(playerId);
            if (index > -1) {
                selectedPowerRankingPlayers.splice(index, 1);
            } else {
                selectedPowerRankingPlayers.push(playerId);
            }
        }
        renderPowerRankingTable(previousPowerRanking);
        renderPowerRankingChart();
    });
    
    document.getElementById('minutes-table').addEventListener('click',function(e){
        if(e.target.classList.contains('reset-player-minutes-btn')){
            const playerId=parseInt(e.target.dataset.playerId);
            const player=players.find(p=>p.id===playerId);
            if(player && confirm(`Are you sure you want to reset all minutes for ${player.name}?`)){
                player.minutes=Array(28).fill(0);
                player.totalMinutes=0;
                player.matchesPlayed=0;
                savePlayersToLocalStorage();
                updateMinutesTable();
            }
        }
    });
    
    saveBtn.addEventListener('click',()=>{
        const name=document.getElementById('player-name').value.trim();
        const positions=Array.from(document.getElementById('player-position').selectedOptions).map(o=>o.value);
        const age=parseInt(document.getElementById('player-age').value);
        const quality=parseInt(document.getElementById('player-quality').value);
        if(!name||positions.length===0||positions.length>3||!age||!quality){alert('Fill all fields (max 3 positions)');return;}
        if(currentPlayerId){
            const player=players.find(p=>p.id===currentPlayerId);
            if(player){
                player.name=name;
                player.positions=positions;
                player.position=positions[0];
                player.age=age;
                player.quality=quality;
                player.initialQuality=quality;
            }
        }else{
            addPlayer(name,positions,age,quality);
        }
        savePlayersToLocalStorage();
        playerModal.style.display='none';
        clearModal();
        renderPlayers();
    });
    
    // Initialization
    loadPlayersFromLocalStorage();
    loadArchivedPlayersFromStorage();
    loadPowerRankingData();
    
    renderPlayers();
    setupTrainingCalculator();
    setupPlayerSearch();
    loadAndRenderArchives();
    
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        if (powerRankingChart) powerRankingChart.zoom(1.1);
    });
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        if (powerRankingChart) powerRankingChart.zoom(0.9);
    });
    document.getElementById('reset-zoom-btn').addEventListener('click', () => {
        if (powerRankingChart) powerRankingChart.resetZoom();
    });
    
    const archivedTable = document.getElementById('archived-players-table');
    if (archivedTable) {
        archivedTable.addEventListener('click', function(e) {
            const header = e.target.closest('th[data-sort]');
            if (!header) return;

            const sortBy = header.dataset.sort;
            const currentOrder = header.dataset.order || 'asc';
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

            archivedSortBy = sortBy;
            archivedSortOrder = newOrder;

            renderArchivedPlayers();
        });
    }
    renderArchivedPlayers();
    
    document.getElementById('archive-filters').addEventListener('input', () => {
        renderArchivedPlayers();
    });
    document.getElementById('reset-archive-filters-btn').addEventListener('click', () => {
        document.getElementById('archive-position-filter').value = 'all';
        document.getElementById('archive-age-filter-min').value = '';
        document.getElementById('archive-age-filter-max').value = '';
        document.getElementById('archive-minutes-filter-min').value = '';
        document.getElementById('archive-minutes-filter-max').value = '';
        document.getElementById('archive-matches-filter-min').value = '';
        document.getElementById('archive-matches-filter-max').value = '';
        document.getElementById('archive-goals-filter-min').value = '';
        document.getElementById('archive-goals-filter-max').value = '';
        document.getElementById('archive-assists-filter-min').value = '';
        document.getElementById('archive-assists-filter-max').value = '';
        renderArchivedPlayers();
    });
    
    document.getElementById('hof-sidebar').addEventListener('click', function(e) {
        if (e.target.classList.contains('hof-category-btn')) {
            const category = e.target.dataset.category;
            renderHallOfFame(category);
        }
    });
    
    document.getElementById('atl-sidebar').addEventListener('click', function(e) {
        if (e.target.classList.contains('atl-category-btn')) {
            const category = e.target.dataset.category;
            renderAllTimeLeaders(category);
        }
    });
    
    document.getElementById('sort-option').addEventListener('change', function() {
        renderPlayers();
    });
    
    document.getElementById('archived-pr-close').addEventListener('click', () => {
        document.getElementById('archived-pr-modal').style.display = 'none';
    });
    
    document.getElementById('archived-pr-modal').addEventListener('click', (e) => {
        if (e.target.id === 'archived-pr-modal') {
            document.getElementById('archived-pr-modal').style.display = 'none';
        }
    });
    
    initStatsCalculator();
});