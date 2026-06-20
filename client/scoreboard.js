const SCOREBOARD_COLORS = ['#e8c14a','#4a8fe8','#4ae87a','#e84a4a','#9b4ae8','#e8874a','#e84a9b','#4ae8e8'];

function showScoreboard(data) {
  const overlay = document.getElementById('scoreboard-overlay');
  const barsEl = document.getElementById('scoreboard-bars');
  const footer = document.getElementById('scoreboard-footer');
  const title = document.getElementById('scoreboard-title');
  const readyBtn = document.getElementById('ready-next-btn');
  const readyStatus = document.getElementById('ready-status');

  barsEl.innerHTML = '';
  footer.style.display = 'none';
  readyBtn.disabled = false;
  readyBtn.textContent = 'Play Again';
  readyStatus.textContent = '';
  title.textContent = 'Round Results';
  title.style.color = '';
  title.style.fontSize = '';
  overlay.style.display = 'flex';

  const players = Object.values(data.players);
  players.sort((a, b) => a.playerNumber - b.playerNumber);

  const bars = {};
  const displayedScores = {};

  players.forEach(p => {
    displayedScores[p.playerNumber] = 0;

    const wrap = document.createElement('div');
    wrap.className = 'score-bar-wrap';

    const totalLabel = document.createElement('div');
    totalLabel.className = 'score-total-label';
    totalLabel.id = 'score-total-' + p.playerNumber;
    totalLabel.textContent = 'Total: ' + (p.totalScore - p.roundScore) + ' pts';

    const barOuter = document.createElement('div');
    barOuter.className = 'score-bar-outer';

    const barPrev = document.createElement('div');
    barPrev.className = 'score-bar score-bar-prev';
    const prevHeight = Math.min((p.totalScore - p.roundScore) / 250, 1) * 240;
    barPrev.style.height = prevHeight + 'px';
    barPrev.style.background = SCOREBOARD_COLORS[p.colorIndex !== undefined ? p.colorIndex : p.playerNumber] || '#fff';
    barPrev.style.opacity = '0.35';

    const bar = document.createElement('div');
    bar.className = 'score-bar score-bar-round';
    bar.style.background = SCOREBOARD_COLORS[p.colorIndex !== undefined ? p.colorIndex : p.playerNumber] || '#fff';
    bar.style.height = '0px';
    bars[p.playerNumber] = bar;

    const nameLabel = document.createElement('div');
    nameLabel.className = 'score-name-label';
    nameLabel.textContent = p.name || 'Player';

    barOuter.appendChild(barPrev);
    barOuter.appendChild(bar);
    wrap.appendChild(totalLabel);
    wrap.appendChild(barOuter);
    wrap.appendChild(nameLabel);
    barsEl.appendChild(wrap);
  });

  const cpCount = 5;
  let cp = 0;

  function animateNextCP() {
    if (cp >= cpCount) {
      setTimeout(() => {
        players.forEach(p => {
          const totalEl = document.getElementById('score-total-' + p.playerNumber);
          if (totalEl) totalEl.textContent = 'Total: ' + p.totalScore + ' pts';
        });
        footer.style.display = 'flex';
        if (data.winnerId) {
          const winner = data.players[data.winnerId];
          title.textContent = '🏆 ' + (winner ? winner.name : 'Someone') + ' Wins!';
          title.style.color = '#e8c14a';
          title.style.fontSize = '42px';
          if (winner !== undefined) {
            const winBar = bars[winner.playerNumber];
            if (winBar) winBar.style.boxShadow = '0 0 18px 5px #e8c14a';
          }
          readyBtn.textContent = 'Back to Lobby';
          readyBtn.disabled = false;
          readyBtn.onclick = () => window.location.reload();
          document.getElementById('ready-status').textContent = '';
        } else {
          setupReadyButton();
        }
      }, 400);
      return;
    }

    players.forEach(p => {
      const earned = (p.roundCheckpointScores && p.roundCheckpointScores[cp]) || 0;
      displayedScores[p.playerNumber] += earned;
      const roundPts = displayedScores[p.playerNumber];
      const prevPts = p.totalScore - p.roundScore;
      const totalDisplayed = prevPts + roundPts;
      const heightPx = Math.min(roundPts / 250, 1) * 240;
      bars[p.playerNumber].style.height = heightPx + 'px';
      const totalEl = document.getElementById('score-total-' + p.playerNumber);
      if (totalEl) totalEl.textContent = 'Total: ' + totalDisplayed + ' pts';
    });

    cp++;
    setTimeout(animateNextCP, 1200);
  }

  setTimeout(animateNextCP, 600);
}

function setupReadyButton() {
  const btn = document.getElementById('ready-next-btn');
  btn.onclick = () => {
    if (window.gameSocket && window.gameSocket.readyState === WebSocket.OPEN) {
      window.gameSocket.send(JSON.stringify({ type: 'readyForNextRound' }));
    }
    btn.disabled = true;
    btn.textContent = 'Waiting...';
  };
}

function hideScoreboard() {
  const overlay = document.getElementById('scoreboard-overlay');
  if (overlay) overlay.style.display = 'none';
}
