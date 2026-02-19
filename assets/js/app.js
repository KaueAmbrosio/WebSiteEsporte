// assets/js/app.js
// fetch-thesportsdb-frontend.js  (colar no app.js temporariamente)
const APIKEY = '1'; // chave de DEV (não segura para produção)
const LEAGUE_ID = 4328; // exemplo: English Premier League

async function fetchNextLeague() {
    const url = `https://www.thesportsdb.com/api/v1/json/${APIKEY}/eventsnextleague.php?id=${LEAGUE_ID}`;
    const res = await fetch(url);
    const json = await res.json();
    // payload: { events: [ { idEvent, strHomeTeam, strAwayTeam, dateEvent, strTime, intHomeScore, intAwayScore, ... } ] }
    return json.events || [];
}

// exemplo de uso
fetchNextLeague().then(events => {
    console.log('Próximos eventos (TheSportsDB):', events);
    // transforme os eventos para o formato do seu matches.json e use renderMatchList(...)
});


// Carrega matches.json (fallback) e popula index/matches/match/admin
document.addEventListener('DOMContentLoaded', () => {
    const DATA_PATH = 'assets/data/matches.json';
    const STORAGE_KEY = 'placar_matches_v1';

    // Load data: primeiro localStorage, se não fetch JSON e salva em localStorage
    async function loadMatches() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Erro ao parsear localStorage, recarregando do JSON.', e);
            }
        }
        const resp = await fetch(DATA_PATH);
        if (!resp.ok) throw new Error('Não foi possível carregar matches.json');
        const data = await resp.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
    }

    function saveMatches(matches) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    }

    // util query id
    function getQueryId() {
        return new URLSearchParams(window.location.search).get('id');
    }

    // format date
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    // RENDERERS
    function renderMatchList(matches, containerSelector = '.matches-list') {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        // remove existing list items (keeps title)
        const existing = container.querySelector('.match-day');
        if (existing) existing.remove();

        // Group by date (simple: group by dateString)
        const groups = {};
        matches.forEach(m => {
            const day = new Date(m.date).toLocaleDateString('pt-BR');
            if (!groups[day]) groups[day] = [];
            groups[day].push(m);
        });

        for (const day of Object.keys(groups)) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'match-day';
            const h = document.createElement('h3');
            h.className = 'match-day-title';
            h.textContent = day;
            dayDiv.appendChild(h);

            const ul = document.createElement('ul');
            ul.className = 'match-list';

            groups[day].forEach(m => {
                const li = document.createElement('li');
                li.className = 'match-item';
                li.innerHTML = `
          <div class="match-left">${new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="match-center"><span class="team-name">${m.homeTeam}</span> <span class="vs">x</span> <span class="team-name">${m.awayTeam}</span></div>
          <div class="match-right"><span class="status">${m.status || 'Agendado'}</span> <a class="link" href="match.html?id=${m.id}">Ver</a></div>
        `;
                ul.appendChild(li);
            });

            dayDiv.appendChild(ul);
            container.appendChild(dayDiv);
        }
    }

    function renderIndex(matches) {
        // Live match: pick first with status containing "Ao vivo" or with scores not null
        const live = matches.find(m => (m.status && m.status.toLowerCase().includes('ao vivo')) || (m.homeScore !== null && m.awayScore !== null && (typeof m.homeScore === 'number' || typeof m.awayScore === 'number')));
        const liveEl = document.getElementById('live-match');
        if (liveEl) {
            const home = live ? live.homeTeam : '—';
            const away = live ? live.awayTeam : '—';
            const homeScore = live && (live.homeScore !== null && live.homeScore !== undefined) ? live.homeScore : '-';
            const awayScore = live && (live.awayScore !== null && live.awayScore !== undefined) ? live.awayScore : '-';
            const status = live ? (live.status || formatDate(live.date)) : 'Nenhum jogo ao vivo';
            liveEl.querySelector('.team-name')?.remove(); // simpler: replace inner
            liveEl.innerHTML = `
        <h2 class="card-title">Jogo ao vivo</h2>
        <div class="match-snapshot">
          <div class="team">
            <div class="team-name">${home}</div>
            <div class="team-score">${homeScore}</div>
          </div>
          <div class="match-meta">
            <div class="status">${status}</div>
            <a class="btn" href="${live ? 'match.html?id=' + live.id : 'matches.html'}">Ver detalhes</a>
          </div>
          <div class="team">
            <div class="team-name">${away}</div>
            <div class="team-score">${awayScore}</div>
          </div>
        </div>
      `;
        }

        // upcoming preview: next 2 by date
        const upcomingEl = document.getElementById('upcoming');
        if (upcomingEl) {
            const upcoming = matches
                .filter(m => !m.status || m.status.toLowerCase().includes('agend'))
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 4);
            const ul = upcomingEl.querySelector('.match-list');
            if (ul) {
                ul.innerHTML = '';
                upcoming.forEach(m => {
                    const li = document.createElement('li');
                    li.className = 'match-item';
                    li.innerHTML = `
            <div class="match-left">${new Date(m.date).toLocaleDateString('pt-BR')} • ${new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="match-center">${m.homeTeam} <span class="vs">x</span> ${m.awayTeam}</div>
            <a class="link" href="match.html?id=${m.id}">Ver</a>
          `;
                    ul.appendChild(li);
                });
            }
        }

        // table preview is static in HTML, you can extend later to compute standings
    }

    function renderMatchDetail(match) {
        if (!match) return;
        const homeName = document.getElementById('home-name');
        const awayName = document.getElementById('away-name');
        const homeScore = document.getElementById('home-score');
        const awayScore = document.getElementById('away-score');
        const matchStatus = document.getElementById('match-status');
        const eventsList = document.getElementById('events-list');
        const infoSection = document.querySelector('.match-info');

        if (homeName) homeName.textContent = match.homeTeam || 'Casa';
        if (awayName) awayName.textContent = match.awayTeam || 'Visitante';
        if (homeScore) homeScore.textContent = (match.homeScore === null || match.homeScore === undefined) ? '-' : match.homeScore;
        if (awayScore) awayScore.textContent = (match.awayScore === null || match.awayScore === undefined) ? '-' : match.awayScore;
        if (matchStatus) matchStatus.textContent = match.status || formatDate(match.date);
        if (infoSection) infoSection.innerHTML = `<p><strong>Estádio:</strong> ${match.stadium || '-'} • <strong>Data:</strong> ${formatDate(match.date)} • <strong>Árbitro:</strong> ${match.referee || '-'}</p>`;

        if (eventsList) {
            eventsList.innerHTML = '';
            if (!match.events || match.events.length === 0) {
                eventsList.innerHTML = '<li>Sem eventos registrados.</li>';
            } else {
                match.events.forEach(ev => {
                    const li = document.createElement('li');
                    li.textContent = ev;
                    eventsList.appendChild(li);
                });
            }
        }
    }

    // ADMIN: popula select e atualiza jogo
    function setupAdmin(matches) {
        const select = document.getElementById('match-select');
        if (!select) return;
        select.innerHTML = matches.map(m => `<option value="${m.id}">${m.homeTeam} x ${m.awayTeam} — ${new Date(m.date).toLocaleDateString('pt-BR')}</option>`).join('');

        // When select changes, fill scores/status
        function fillFromSelect() {
            const id = select.value;
            const match = matches.find(x => x.id === id);
            if (!match) return;
            document.getElementById('home-score').value = match.homeScore ?? 0;
            document.getElementById('away-score').value = match.awayScore ?? 0;
            document.getElementById('status').value = match.status ?? '';
        }

        select.addEventListener('change', fillFromSelect);
        fillFromSelect();

        document.getElementById('btn-update')?.addEventListener('click', () => {
            const id = select.value;
            const match = matches.find(x => x.id === id);
            if (!match) return alert('Partida não encontrada');
            match.homeScore = Number(document.getElementById('home-score').value);
            match.awayScore = Number(document.getElementById('away-score').value);
            match.status = document.getElementById('status').value;
            saveMatches(matches);
            alert('Placar atualizado localmente. Recarregue a página de detalhes para ver as mudanças.');
            // optional: refresh pages or redirect to match detail
            // window.location.href = `match.html?id=${id}`;
        });

        document.getElementById('btn-add-event')?.addEventListener('click', () => {
            const id = select.value;
            const match = matches.find(x => x.id === id);
            if (!match) return alert('Partida não encontrada');
            const ev = document.getElementById('event').value;
            if (!ev) return alert('Digite um evento');
            match.events = match.events || [];
            match.events.push(ev);
            saveMatches(matches);
            document.getElementById('event').value = '';
            alert('Evento adicionado localmente.');
        });

    }

    // BOOT
    (async () => {
        try {
            const matches = await loadMatches();
            // pages detection
            if (document.querySelector('.matches-list')) {
                renderMatchList(matches);
            }
            if (document.getElementById('live-match') || document.getElementById('upcoming')) {
                renderIndex(matches);
            }
            if (document.getElementById('events-list')) {
                const id = getQueryId();
                if (!id) {
                    document.getElementById('events-list').innerHTML = '<li>ID da partida não informado na URL.</li>';
                } else {
                    const match = matches.find(m => m.id === id);
                    if (!match) {
                        document.getElementById('events-list').innerHTML = `<li>Partida com id "${id}" não encontrada.</li>`;
                    } else {
                        renderMatchDetail(match);
                    }
                }
            }
            // admin
            if (document.getElementById('match-select')) {
                setupAdmin(matches);
            }
        } catch (err) {
            console.error(err);
            // show a simple error in pages
            const main = document.querySelector('main');
            if (main) main.innerHTML = `<div style="color:salmon;padding:1rem;border-radius:8px">Erro ao carregar dados: ${err.message}</div>`;
        }
    })();

});