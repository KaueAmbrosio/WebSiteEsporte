// assets/js/app.js (versão corrigida e simples)
// ===============================
// PlacarAoVivo — app.js (corrigido)
// ===============================

const APIKEY = "123";
const LEAGUE_ID = "4328";
const SEASON = "2025-2026"; // ajuste se necessário

/* ---------- util: datas ---------- */
function parseDateSafe(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/* ---------- util: normalizar nomes / slugs para imagens ---------- */
function normalizeTeamName(name) {
    if (!name) return "";
    // map de exceções (nomes diferentes entre API e arquivo de imagens)
    const map = {
        "Brighton & Hove Albion": "brighton",
        "Tottenham Hotspur": "tottenham",
        "Wolverhampton Wanderers": "wolves",
        "Manchester United": "manchester-united",
        "Manchester City": "manchester-city",
        "Newcastle United": "newcastle",
        "Nottingham Forest": "nottingham-forest",
        "West Ham United": "west-ham",
        "Sheffield United": "sheffield-united",
        "Luton Town": "luton",
        "Aston Villa": "aston-villa",
        "Leeds United": "leeds-united",
        "Arsenal": "arsenal",
        "Chelsea": "chelsea",
        "Liverpool": "liverpool",
        "Everton": "everton",
        "Crystal Palace": "crystal-palace",
        "Fulham": "fulham",
        "Burnley": "burnley",
        "Brentford": "brentford",
        "Bournemouth": "bournemouth"
    };
    if (map[name]) return map[name];
    return name.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/* ---------- badge local (usa slug) ---------- */
function getTeamBadge(teamName) {
    if (!teamName) return "assets/img/teams/default.png";
    const slug = normalizeTeamName(teamName);
    return `assets/img/teams/${slug}.png`;
}

/* ---------- carregar próximos eventos (TheSportsDB) ---------- */
async function loadMatches() {
    try {
        const url = `https://www.thesportsdb.com/api/v1/json/${APIKEY}/eventsnextleague.php?id=${LEAGUE_ID}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const arr = data.events || [];
        return arr.map(m => ({
            id: m.idEvent,
            homeTeam: m.strHomeTeam,
            awayTeam: m.strAwayTeam,
            homeScore: m.intHomeScore ? Number(m.intHomeScore) : null,
            awayScore: m.intAwayScore ? Number(m.intAwayScore) : null,
            status: m.strStatus || "Agendado",
            date: m.dateEvent && m.strTime ? `${m.dateEvent}T${m.strTime}` : (m.dateEvent || ""),
            stadium: m.strVenue || "",
            referee: m.strReferee || ""
        }));
    } catch (err) {
        console.warn("Erro ao carregar matches:", err);
        return [];
    }
}

/* ---------- tabela: busca raw ---------- */
async function fetchStandingsRaw() {
    const url = `https://www.thesportsdb.com/api/v1/json/${APIKEY}/lookuptable.php?l=${LEAGUE_ID}&s=${SEASON}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Standings HTTP ${resp.status}`);
    const j = await resp.json();
    return j.table || [];
}

/* ---------- cache simples para standings ---------- */
const STANDINGS_CACHE_KEY = 'fcscore_standings_cache_v1';
const STANDINGS_CACHE_TTL = 1000 * 60 * 5; // 5min

async function getStandingsCached() {
    try {
        const raw = localStorage.getItem(STANDINGS_CACHE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj.ts && (Date.now() - obj.ts) < STANDINGS_CACHE_TTL && Array.isArray(obj.data) && obj.data.length) {
                // retorna cache imediatamente e atualiza em background
                fetchStandingsRaw().then(data => {
                    localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
                }).catch(() => {/*ignore*/ });
                return obj.data;
            }
        }
    } catch (e) { console.warn('cache error', e); }
    // sem cache válido
    const data = await fetchStandingsRaw();
    try { localStorage.setItem(STANDINGS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { }
    return data;
}

/* ---------- populate helper (pode limitar linhas para preview) ---------- */
function populateStandingsTable(tableData = [], tbodyEl, limit = null) {
    if (!tbodyEl) return;
    if (!Array.isArray(tableData) || tableData.length === 0) {
        tbodyEl.innerHTML = '<tr><td colspan="8">Sem dados da tabela.</td></tr>';
        return;
    }
    const rows = (limit ? tableData.slice(0, limit) : tableData);
    tbodyEl.innerHTML = '';
    for (const team of rows) {
        const rank = team.intRank ?? '';
        const name = team.strTeam ?? '';
        const pts = team.intPoints ?? '-';
        const played = team.intPlayed ?? '-';
        const win = team.intWin ?? '-';
        const draw = team.intDraw ?? '-';
        const loss = team.intLoss ?? '-';
        const gd = team.intGoalDifference ?? '-';
        const badge = getTeamBadge(name);
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${rank}</td>
      <td class="team-cell">
        <img class="team-badge" src="${badge}" alt="${name}" onerror="this.src='assets/img/teams/default.png'">
        ${name}
      </td>
      <td>${pts}</td>
      <td>${played}</td>
      <td>${win}</td>
      <td>${draw}</td>
      <td>${loss}</td>
      <td>${gd}</td>
    `;
        tbodyEl.appendChild(tr);
    }
}

/* ---------- render preview (index) - mostra top 5 ---------- */
async function renderStandingsPreview() {
    const tbody = document.querySelector("#table-preview tbody");
    if (!tbody) return;
    const data = await getStandingsCached();
    populateStandingsTable(data, tbody, 5); // apenas top5 na preview
}

/* ---------- render full standings page ---------- */
async function renderFullStandingsPage() {
    const tbody = document.getElementById('full-standings');
    if (!tbody) return;
    const data = await getStandingsCached();
    populateStandingsTable(data, tbody, null); // todas as linhas
}

/* ---------- render teams grid (teams.html) ---------- */
async function renderTeamsPage() {
    const grid = document.getElementById("teams-grid");
    if (!grid) return;
    const data = await getStandingsCached();
    if (!Array.isArray(data) || data.length === 0) {
        grid.innerHTML = "<p>Sem dados da tabela.</p>";
        return;
    }
    grid.innerHTML = data.map(t => `
    <article class="team-card">
      <img class="team-logo" src="${getTeamBadge(t.strTeam)}" alt="${t.strTeam}" onerror="this.src='assets/img/teams/default.png'">
      <h3 class="team-card-title">${t.strTeam}</h3>
      <p>Posição: ${t.intRank} • Pontos: ${t.intPoints}</p>
    </article>
  `).join('');
}

/* ---------- render index: matches, live, upcoming ---------- */
function renderIndex(matches = []) {
    const liveEl = document.getElementById("live-match");
    const upcomingEl = document.getElementById("upcoming");
    if (!Array.isArray(matches)) matches = [];

    const now = Date.now();

    // procurar jogo "ao vivo"
    let live = matches.find(m => m.status && /live|ao vivo|in play|em andamento/i.test(m.status));
    if (!live) {
        const future = matches.filter(m => parseDateSafe(m.date) && new Date(m.date).getTime() > now);
        live = future.sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
    }

    if (liveEl) {
        if (!live) {
            liveEl.querySelector('.card-title')?.remove();
            liveEl.innerHTML = `
        <h2 class="card-title">Partida em destaque</h2>
        <div class="match-snapshot">
          <div class="team">
            <div class="team-name">—</div>
            <div class="team-score">-</div>
          </div>
          <div class="match-meta">
            <div class="status muted">Nenhum jogo ao vivo</div>
            <a class="btn" href="matches.html">Ver detalhes</a>
          </div>
          <div class="team">
            <div class="team-name">—</div>
            <div class="team-score">-</div>
          </div>
        </div>`;
        } else {
            const hb = getTeamBadge(live.homeTeam);
            const ab = getTeamBadge(live.awayTeam);
            liveEl.innerHTML = `
        <h2 class="card-title">Partida em destaque</h2>
        <div class="match-snapshot">
          <div class="team">
            <img class="team-badge-lg" src="${hb}" alt="${live.homeTeam}" onerror="this.src='assets/img/teams/default.png'">
            <div class="team-name">${live.homeTeam}</div>
            <div class="team-score">${live.homeScore ?? "-"}</div>
          </div>
          <div class="match-meta">
            <div class="status">${live.status || "Em breve"}</div>
            <a class="btn" href="match.html?id=${live.id}">Ver detalhes</a>
          </div>
          <div class="team">
            <img class="team-badge-lg" src="${ab}" alt="${live.awayTeam}" onerror="this.src='assets/img/teams/default.png'">
            <div class="team-name">${live.awayTeam}</div>
            <div class="team-score">${live.awayScore ?? "-"}</div>
          </div>
        </div>`;
        }
    }

    if (upcomingEl) {
        const upcomingList = (matches || []).filter(m => parseDateSafe(m.date) && new Date(m.date).getTime() > now)
            .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);

        const ul = upcomingEl.querySelector(".match-list");
        if (ul) {
            ul.innerHTML = "";
            upcomingList.forEach(m => {
                const d = parseDateSafe(m.date);
                const hb = getTeamBadge(m.homeTeam);
                const ab = getTeamBadge(m.awayTeam);
                const li = document.createElement("li");
                li.className = "match-item";
                li.innerHTML = `
          <div class="match-left">${d ? d.toLocaleDateString("pt-BR") + " • " + d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }) : "Sem data"}</div>
          <div class="match-center">
            <img class="team-badge" src="${hb}" alt="${m.homeTeam}" onerror="this.src='assets/img/teams/default.png'">
            ${m.homeTeam} <span class="vs">x</span> ${m.awayTeam}
            <img class="team-badge" src="${ab}" alt="${m.awayTeam}" onerror="this.src='assets/img/teams/default.png'">
          </div>
          <a class="link" href="match.html?id=${m.id}">Ver</a>
        `;
                ul.appendChild(li);
            });
        }
    }
}

/* ---------- match detail ---------- */
function renderMatchDetail(match) {
    const eventsEl = document.getElementById("events-list");
    if (!eventsEl || !match) return;
    const d = parseDateSafe(match.date);
    const dateStr = d ? d.toLocaleDateString("pt-BR") + " • " + d.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }) : "Sem data";
    eventsEl.innerHTML = `
    <li><strong>${match.homeTeam}</strong> x <strong>${match.awayTeam}</strong></li>
    <li>${dateStr}</li>
    <li>Estádio: ${match.stadium || "-"}</li>
    <li>Árbitro: ${match.referee || "-"}</li>
  `;
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const matches = await loadMatches();

        // index area
        if (document.querySelector(".matches-list") || document.getElementById("live-match") || document.getElementById("upcoming")) {
            renderIndex(matches);
        }

        // render preview top5
        if (document.querySelector("#table-preview tbody")) {
            await renderStandingsPreview();
        }

        // full standings page
        if (document.getElementById("full-standings")) {
            await renderFullStandingsPage();
        }

        // teams page
        if (document.getElementById("teams-grid")) {
            await renderTeamsPage();
        }

        // match detail page
        if (document.getElementById("events-list")) {
            const id = new URLSearchParams(location.search).get("id");
            const match = matches.find(m => m.id === id);
            if (match) renderMatchDetail(match);
        }
    } catch (err) {
        console.error("BOOT error:", err);
        const main = document.querySelector("main");
        if (main) main.innerHTML = `<div style="color:salmon;padding:1rem;border-radius:8px">Erro ao carregar dados: ${err.message}</div>`;
    }
});

// ===============================
// CARROSSEL HERO — FC SCORE
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    const slides = document.querySelectorAll(".player-carousel .carousel-item");
    if (!slides.length) return;

    let index = 0;

    // garante que apenas a primeira esteja visível ao iniciar
    slides.forEach((s, i) => {
        s.classList.toggle("visible", i === 0);
    });

    function nextSlide() {
        slides[index].classList.remove("visible");
        index = (index + 1) % slides.length;
        slides[index].classList.add("visible");
    }

    setInterval(nextSlide, 3000);
});