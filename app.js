import { saveMatchToFirebase, getMatchesFromFirebase } from './firebase.js';

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// App State
let currentMatch = {
    team1: { players: [], score: 0 },
    team2: { players: [], score: 0 },
    metadata: {},
    startTime: null
};

// Helper to set default match time
function setDefaultMatchTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('match-time').value = now.toISOString().slice(0, 16);
}

// Tab Navigation
document.addEventListener('DOMContentLoaded', function() {
    setDefaultMatchTime();
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Load Firebase data on app start
    loadFirebaseMatches().then(() => {
        updateLeaderboard();
        updateHistory();
    });
});

function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'leaderboard') {
        updateLeaderboard();
    } else if (tabName === 'history') {
        // Reload Firebase data when viewing history to get latest matches
        loadFirebaseMatches().then(() => {
            updateHistory();
        });
    }
}

// Match Management
function startMatch() {
    const team1Player1 = document.getElementById('team1-player1').value.trim();
    const team1Player2 = document.getElementById('team1-player2').value.trim();
    const team2Player1 = document.getElementById('team2-player1').value.trim();
    const team2Player2 = document.getElementById('team2-player2').value.trim();
    
    if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
        alert('Please enter all player names');
        return;
    }
    
    currentMatch = {
        team1: { players: [team1Player1, team1Player2], score: 0 },
        team2: { players: [team2Player1, team2Player2], score: 0 },
        metadata: {
            location: document.getElementById('match-location').value,
            time: document.getElementById('match-time').value,
            notes: document.getElementById('match-notes').value
        },
        startTime: new Date().toISOString()
    };
    
    document.getElementById('display-team1').textContent = `${team1Player1} & ${team1Player2}`;
    document.getElementById('display-team2').textContent = `${team2Player1} & ${team2Player2}`;
    document.getElementById('score1').textContent = '0';
    document.getElementById('score2').textContent = '0';
    
    document.getElementById('match-setup').style.display = 'none';
    document.getElementById('score-display').style.display = 'block';
    
    saveCurrentMatch();
}

function changeScore(team, delta) {
    currentMatch[team].score = Math.max(0, currentMatch[team].score + delta);
    document.getElementById(team === 'team1' ? 'score1' : 'score2').textContent = currentMatch[team].score;
    saveCurrentMatch();
}

function finishMatch() {
    if (currentMatch.team1.score === 0 && currentMatch.team2.score === 0) {
        alert('Please record some scores before finishing the match');
        return;
    }
    
    let winner = null;
    if (currentMatch.team1.score > currentMatch.team2.score) {
        winner = 'team1';
    } else if (currentMatch.team2.score > currentMatch.team1.score) {
        winner = 'team2';
    }
    
    const matchResult = {
        ...currentMatch,
        winner: winner,
        endTime: new Date().toISOString(),
        id: Date.now()
    };
    
    // Save to local storage as backup only
    saveMatchToHistory(matchResult);
    
    // Show result to user
    if (winner) {
        alert(`🏆 ${currentMatch[winner].players.join(' & ')} wins!\nFinal Score: ${currentMatch.team1.score} - ${currentMatch.team2.score}`);
    } else {
        alert(`🤝 It's a draw!\nFinal Score: ${currentMatch.team1.score} - ${currentMatch.team2.score}`);
    }
    
    resetMatch();
    
    // Save to Firebase (primary storage) and then reload data
    saveMatchToFirebase(matchResult).then(() => {
        console.log('Match successfully saved to Firebase');
        // Reload Firebase data to ensure we have the latest matches
        loadFirebaseMatches().then(() => {
            switchTab('history');
        });
    }).catch(error => {
        console.error('Failed to save match to Firebase:', error);
        // Still switch to history even if Firebase save failed
        switchTab('history');
    });
}

function resetMatch() {
    currentMatch = {
        team1: { players: [], score: 0 },
        team2: { players: [], score: 0 },
        metadata: {},
        startTime: null
    };
    
    document.getElementById('team1-player1').value = '';
    document.getElementById('team1-player2').value = '';
    document.getElementById('team2-player1').value = '';
    document.getElementById('team2-player2').value = '';
    document.getElementById('match-location').value = '';
    document.getElementById('match-notes').value = '';
    setDefaultMatchTime();
    
    document.getElementById('match-setup').style.display = 'block';
    document.getElementById('score-display').style.display = 'none';
    
    localStorage.removeItem('currentMatch');
}

// Data Persistence
function saveCurrentMatch() {
    localStorage.setItem('currentMatch', JSON.stringify(currentMatch));
}

function loadCurrentMatch() {
    const saved = localStorage.getItem('currentMatch');
    if (saved) {
        currentMatch = JSON.parse(saved);
        if (currentMatch.team1.players.length > 0) {
            document.getElementById('display-team1').textContent = currentMatch.team1.players.join(' & ');
            document.getElementById('display-team2').textContent = currentMatch.team2.players.join(' & ');
            document.getElementById('score1').textContent = currentMatch.team1.score;
            document.getElementById('score2').textContent = currentMatch.team2.score;
            
            // Restore metadata in form
            document.getElementById('match-location').value = currentMatch.metadata.location || '';
            document.getElementById('match-time').value = currentMatch.metadata.time || '';
            document.getElementById('match-notes').value = currentMatch.metadata.notes || '';
            
            document.getElementById('match-setup').style.display = 'none';
            document.getElementById('score-display').style.display = 'block';
        }
    }
}

function saveMatchToHistory(match) {
    let history = JSON.parse(localStorage.getItem('matchHistory') || '[]');
    history.unshift(match);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('matchHistory', JSON.stringify(history));
}

function updatePlayerStats(match) {
    let stats = JSON.parse(localStorage.getItem('playerStats') || '{}');
    const allPlayers = [...match.team1.players, ...match.team2.players];
    
    // Initialize stats for new players
    allPlayers.forEach(player => {
        if (!stats[player]) {
            stats[player] = { wins: 0, losses: 0, draws: 0, totalMatches: 0 };
        }
        stats[player].totalMatches++;
    });
    
    // Update win/loss/draw stats
    if (match.winner) {
        const winners = match[match.winner].players;
        const losers = match[match.winner === 'team1' ? 'team2' : 'team1'].players;
        
        winners.forEach(player => stats[player].wins++);
        losers.forEach(player => stats[player].losses++);
    } else {
        // It's a draw
        allPlayers.forEach(player => stats[player].draws++);
    }
    
    localStorage.setItem('playerStats', JSON.stringify(stats));
}

// Firebase Integration - Primary data source
let firebaseMatches = [];

async function loadFirebaseMatches() {
    try {
        console.log('Loading matches from Firebase...');
        firebaseMatches = await getMatchesFromFirebase();
        console.log(`Loaded ${firebaseMatches.length} matches from Firebase`);
        
        // Recalculate all player stats from Firebase data
        recalculatePlayerStatsFromFirebase();
        
        // Update UI if we're on history or stats tabs
        const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab;
        if (activeTab === 'history') {
            updateHistory();
        } else if (activeTab === 'leaderboard') {
            updateLeaderboard();
        }
        
        return firebaseMatches;
    } catch (error) {
        console.error('Failed to load Firebase matches:', error);
        // Fallback to local storage only if Firebase fails
        const localHistory = JSON.parse(localStorage.getItem('matchHistory') || '[]');
        firebaseMatches = localHistory;
        return localHistory;
    }
}

function recalculatePlayerStatsFromFirebase() {
    // Clear existing stats and recalculate from Firebase matches
    const stats = {};
    
    firebaseMatches.forEach(match => {
        const allPlayers = [...match.team1.players, ...match.team2.players];
        
        // Initialize stats for new players
        allPlayers.forEach(player => {
            if (!stats[player]) {
                stats[player] = { wins: 0, losses: 0, draws: 0, totalMatches: 0 };
            }
            stats[player].totalMatches++;
        });
        
        // Update win/loss/draw stats
        if (match.winner) {
            const winners = match[match.winner].players;
            const losers = match[match.winner === 'team1' ? 'team2' : 'team1'].players;
            
            winners.forEach(player => stats[player].wins++);
            losers.forEach(player => stats[player].losses++);
        } else {
            // It's a draw
            allPlayers.forEach(player => stats[player].draws++);
        }
    });
    
    localStorage.setItem('playerStats', JSON.stringify(stats));
    console.log('Player stats recalculated from Firebase data');
}

// UI Updates
function updateLeaderboard() {
    const stats = JSON.parse(localStorage.getItem('playerStats') || '{}');
    const leaderboardContent = document.getElementById('leaderboard-content');
    
    if (Object.keys(stats).length === 0) {
        leaderboardContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3>No stats yet</h3>
                <p>Play some matches to see player statistics</p>
            </div>`;
        return;
    }
    
    const sortedPlayers = Object.entries(stats).sort((a, b) => {
        const winRateA = a[1].totalMatches > 0 ? a[1].wins / a[1].totalMatches : 0;
        const winRateB = b[1].totalMatches > 0 ? b[1].wins / b[1].totalMatches : 0;
        if (winRateB !== winRateA) return winRateB - winRateA;
        return b[1].wins - a[1].wins;
    });
    
    leaderboardContent.innerHTML = sortedPlayers.map(([player, playerStats]) => {
        const winRate = playerStats.totalMatches > 0 
            ? Math.round((playerStats.wins / playerStats.totalMatches) * 100)
            : 0;
            
        return `
            <div class="leaderboard-item">
                <div>
                    <div style="font-weight: 600; font-size: 1.1em;">${player}</div>
                    <div style="opacity: 0.8;">Win Rate: ${winRate}%</div>
                </div>
                <div class="player-stats">
                    <div class="stat">
                        <div class="stat-value">${playerStats.wins}</div>
                        <div class="stat-label">Wins</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${playerStats.losses}</div>
                        <div class="stat-label">Losses</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${playerStats.draws || 0}</div>
                        <div class="stat-label">Draws</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${playerStats.totalMatches}</div>
                        <div class="stat-label">Total</div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function updateHistory() {
    const historyContent = document.getElementById('history-content');
    
    // Use Firebase matches as primary data source
    const matches = firebaseMatches.length > 0 ? firebaseMatches : JSON.parse(localStorage.getItem('matchHistory') || '[]');
    
    if (matches.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3>No matches yet</h3>
                <p>Your match history will appear here</p>
            </div>`;
        return;
    }
    
    // Sort matches by date (newest first)
    const sortedMatches = matches.sort((a, b) => {
        const dateA = new Date(a.metadata?.time || a.startTime || a.endTime || 0);
        const dateB = new Date(b.metadata?.time || b.startTime || b.endTime || 0);
        return dateB - dateA;
    });
    
    historyContent.innerHTML = sortedMatches.map(match => {
        const matchDate = new Date(match.metadata?.time || match.startTime || match.endTime);
        const dateStr = matchDate.toLocaleDateString();
        const timeStr = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const team1Name = match.team1.players.join(' & ');
        const team2Name = match.team2.players.join(' & ');
        const winnerName = match.winner ? match[match.winner].players.join(' & ') : 'Draw';
        
        return `
            <div class="history-item">
                <div class="match-info">
                    <div class="match-teams">${team1Name} vs ${team2Name}</div>
                    <div class="match-score">${match.team1.score} - ${match.team2.score}</div>
                </div>
                <div class="match-details">
                    <div class="winner">${match.winner ? '🏆 ' + winnerName : '🤝 Draw'}</div>
                    <div>${dateStr} at ${timeStr}</div>
                    ${match.metadata?.location ? `<div>📍 ${match.metadata.location}</div>` : ''}
                    ${match.metadata?.notes ? `<div>📝 ${match.metadata.notes}</div>` : ''}
                </div>
            </div>`;
    }).join('');
}

// Event Listeners
window.addEventListener('load', loadCurrentMatch);

// Global function exports for HTML onclick handlers
window.startMatch = startMatch;
window.changeScore = changeScore;
window.finishMatch = finishMatch;
window.resetMatch = resetMatch;
window.updateLeaderboard = updateLeaderboard;
window.updateHistory = updateHistory;
window.switchTab = switchTab;