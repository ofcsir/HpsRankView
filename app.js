const fallbackText = `핱페스 포타 개수 순위
(기준: 26. 6. 12.)

1. 냐람 807
2. 쥬얀 502
3. 얀닺 363
4. 닺람 334
5. 냐쥬 195
6. 람닺 138
7. 댠닺 134
8. 우앤주 129
9. 댠람 106
10. 람냐 101
11. 냐쭙 58
12. 냐얀 48
13. 닺냐 36
14. 쭙냐 35
15. 얀람 29
16. 쭙닺 26
17. 닺댠 25
18. 얀댠 23
19. 댠얀 17

핱페스 포타 개수 순위 (2026. 08. 20)

1. 냐람 1200
2. 쥬얀 673
3. 얀닺 527
4. 닺람 429
5. 냐쥬 300
6. 우앤주 273
7. 람닺 193
8. 댠닺 190
9. 람냐 176
10. 댠람 115
11. 냐쭙 109
12. 쭙닺 82
13. 닺냐 79
14. 쭙냐 67
15. 얀댠 46
16. 얀람 45
17. 닺댠 42
18. 냐얀 41
19. 댠얀 32`;

const formatNumber = new Intl.NumberFormat('ko-KR');
const state = { query: '', sortByMovement: false };
let rankingData = [];
let dates = [];
let dashboardTitle = '순위 대시보드';

function parseSource(text) {
  const groups = [[]];
  const labels = [];
  let title = dashboardTitle;
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('순위') && !/^\d+\./.test(line.trim())) {
      if (groups.at(-1).length) groups.push([]);
      const heading = line.trim();
      title = title === dashboardTitle ? heading.replace(/\s*\([^)]*\)\s*$/, '') : title;
      labels.push(heading.match(/\(([^)]+)\)/)?.[1] ?? '이전 집계');
      continue;
    }
    const dateOnly = line.match(/기준:\s*([^)]+)/);
    if (dateOnly && labels.length) labels[labels.length - 1] = dateOnly[1].trim();
    const match = line.match(/^(\d+)\.\s*(.+?)\s+(\d+)\s*$/);
    if (match) groups.at(-1).push({ rank: Number(match[1]), name: match[2], value: Number(match[3]) });
  }
  const usable = groups.filter(group => group.length);
  const previous = usable.at(-2) ?? [];
  const current = usable.at(-1) ?? [];
  const previousByName = new Map(previous.map(item => [item.name, item]));
  return {
    title,
    dates: labels.slice(-usable.length),
    data: current.map(item => ({ ...item, previousRank: previousByName.get(item.name)?.rank ?? null, trend: [previousByName.get(item.name)?.value ?? 0, item.value] }))
  };
}

const palette = [
  '#3056d3', '#059669', '#d97706', '#dc2626', '#8b5cf6',
  '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6',
  '#b91c1c', '#047857', '#b45309', '#6d28d9', '#0369a1',
  '#be185d', '#c2410c', '#4338ca', '#0f766e'
];

let activeChartLimit = '10';
let hoveredItemName = null;

function getItemColor(index) {
  return palette[index % palette.length];
}

function change(item) { return item.previousRank === null ? null : item.previousRank - item.rank; }

function sparkline(values) {
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const lastIndex = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => `${2 + (index / lastIndex) * 104},${25 - ((value - min) / range) * 20}`).join(' ');
  const color = values.at(-1) >= values[0] ? '#168760' : '#d24444';
  return `<svg class="sparkline" viewBox="0 0 108 28" aria-label="월별 누적 수치 추이"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

function movement(item) {
  const value = change(item);
  if (value === null) return '<span class="movement same">신규</span>';
  if (value > 0) return `<span class="movement up">▲ ${value}</span>`;
  if (value < 0) return `<span class="movement down">▼ ${Math.abs(value)}</span>`;
  return '<span class="movement same">–</span>';
}

function itemTrendChart(items, filterLimit) {
  let displayed = items;
  if (filterLimit === '5') displayed = items.slice(0, 5);
  else if (filterLimit === '10') displayed = items.slice(0, 10);

  const width = 920, height = 400;
  const left = 60, right = 240, top = 35, bottom = 50;

  const allVals = displayed.flatMap(i => i.trend);
  const maxVal = Math.max(...allVals, 10);
  const chartMax = Math.ceil(maxVal * 1.08 / 50) * 50 || 100;
  const chartMin = 0;
  const range = chartMax - chartMin;

  const x0 = left;
  const x1 = width - right;
  const periodCount = Math.max(dates.length, 1);
  const x = index => periodCount === 1 ? x0 : x0 + index / (periodCount - 1) * (x1 - x0);
  const y = val => top + (chartMax - val) / range * (height - top - bottom);

  const ticks = [0, Math.round(chartMax * 0.25), Math.round(chartMax * 0.5), Math.round(chartMax * 0.75), chartMax];
  const gridHtml = ticks.map(t => {
    const yPos = y(t);
    return `<line class="chart-grid" x1="${left}" x2="${x1}" y1="${yPos}" y2="${yPos}"/><text class="chart-axis" x="${left - 8}" y="${yPos + 4}">${formatNumber.format(t)}</text>`;
  }).join('');

  const labelStep = Math.max(1, Math.ceil(periodCount / 6));
  const labelIndexes = dates.map((_, index) => index)
    .filter(index => index === 0 || index === periodCount - 1 || index % labelStep === 0);
  const dateLabelsHtml = labelIndexes.map(index => `
    <line class="date-guide" x1="${x(index)}" x2="${x(index)}" y1="${top - 10}" y2="${height - bottom}" stroke="#d7dce7" stroke-dasharray="3,3"/>
    <text class="chart-label date-title" x="${x(index)}" y="${height - 14}">${dates[index]}</text>
  `).join('');

  const minGap = 20;
  const minY = top + 10;
  const maxY = height - bottom - 10;

  const labelPositions = displayed.map(item => ({
    name: item.name,
    y0: y(item.trend[0]),
    y1: y(item.trend.at(-1)),
    labelY: y(item.trend.at(-1))
  })).sort((a, b) => a.y1 - b.y1);

  for (let pass = 0; pass < 20; pass++) {
    for (let i = 1; i < labelPositions.length; i++) {
      if (labelPositions[i].labelY < labelPositions[i - 1].labelY + minGap) {
        labelPositions[i].labelY = labelPositions[i - 1].labelY + minGap;
      }
    }
    if (labelPositions.length > 0 && labelPositions[labelPositions.length - 1].labelY > maxY) {
      labelPositions[labelPositions.length - 1].labelY = maxY;
      for (let i = labelPositions.length - 2; i >= 0; i--) {
        if (labelPositions[i].labelY > labelPositions[i + 1].labelY - minGap) {
          labelPositions[i].labelY = labelPositions[i + 1].labelY - minGap;
        }
      }
    }
  }

  const labelYMap = new Map(labelPositions.map(lp => [lp.name, lp.labelY]));

  const linesHtml = displayed.map((item, idx) => {
    const color = getItemColor(idx);
    const v0 = item.trend[0];
    const v1 = item.trend.at(-1);
    const y0 = y(v0);
    const y1 = y(v1);
    const adjustedLabelY = labelYMap.get(item.name) ?? y1;

    const isHovered = hoveredItemName === item.name;
    const isOtherHovered = hoveredItemName && !isHovered;
    const opacity = isOtherHovered ? 0.15 : 1;
    const strokeWidth = isHovered ? 3.8 : 2.5;

    const leaderLine = Math.abs(adjustedLabelY - y1) > 2 ? `
      <path d="M ${x1 + 3} ${y1} Q ${x1 + 7} ${(y1 + adjustedLabelY) / 2} ${x1 + 10} ${adjustedLabelY}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
    ` : '';

    return `
      <g class="item-trend-group ${isHovered ? 'hovered' : ''}" data-name="${item.name}" style="opacity: ${opacity}; transition: opacity 0.2s ease;">
        <polyline points="${item.trend.map((value, index) => `${x(index)},${y(value)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="trend-path"/>
        ${item.trend.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${index === item.trend.length - 1 ? (isHovered ? 5.5 : 4) : 2.6}" fill="${color}" class="trend-dot"><title>${dates[index]}: ${formatNumber.format(value)}</title></circle>`).join('')}
        <text x="${x0 - 8}" y="${y0 + 4}" text-anchor="end" class="val-label start-val" fill="#65708a">${formatNumber.format(v0)}</text>
        ${leaderLine}
        <text x="${x1 + 12}" y="${adjustedLabelY + 4}" text-anchor="start" class="val-label end-val" fill="${color}" font-weight="${isHovered ? '800' : '650'}">${item.name} (${formatNumber.format(v1)})</text>
      </g>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="항목별 개수 추이 그래프">${gridHtml}${dateLabelsHtml}${linesHtml}</svg>`;
}

function renderChartLegend(displayedItems) {
  const legendEl = document.querySelector('#chart-legend');
  if (!legendEl) return;

  legendEl.innerHTML = displayedItems.map((item, idx) => {
    const color = getItemColor(idx);
    const isHovered = hoveredItemName === item.name;
    const diff = item.trend.at(-1) - (item.trend.at(-2) ?? 0);
    const diffStr = diff >= 0 ? `+${formatNumber.format(diff)}` : `${formatNumber.format(diff)}`;
    return `
      <button type="button" class="legend-pill ${isHovered ? 'active' : ''}" data-name="${item.name}">
        <span class="legend-color" style="background-color: ${color}"></span>
        <span class="legend-name">${item.name}</span>
        <span class="legend-val">${formatNumber.format(item.value)}</span>
        <span class="legend-diff ${diff >= 0 ? 'up' : 'down'}">${diffStr}</span>
      </button>
    `;
  }).join('');
}

function render() {
  let items = rankingData.filter(item => item.name.toLowerCase().includes(state.query.toLowerCase()));
  if (state.sortByMovement) items = [...items].sort((a, b) => Math.abs(change(b) ?? 0) - Math.abs(change(a) ?? 0));
  document.querySelector('#ranking-body').innerHTML = items.map(item => `<tr><td class="rank">${item.rank}</td><td class="item-name">${item.name}</td><td class="value">${formatNumber.format(item.value)}</td><td>${movement(item)}</td><td>${sparkline(item.trend)}</td></tr>`).join('');
  document.querySelector('#result-count').textContent = `${items.length}개 항목`;
  document.querySelector('#empty-state').hidden = items.length !== 0;
}

function renderSummary() {
  let displayedItems = rankingData;
  if (activeChartLimit === '5') displayedItems = rankingData.slice(0, 5);
  else if (activeChartLimit === '10') displayedItems = rankingData.slice(0, 10);

  document.querySelector('#overview-graph').innerHTML = itemTrendChart(rankingData, activeChartLimit);
  renderChartLegend(displayedItems);
  document.querySelector('#page-title').textContent = dashboardTitle;
  document.querySelector('#updated-at').textContent = dates.at(-1) ? `최근 집계 ${dates.at(-1)}` : '';
}

function setupChartEvents() {
  const filterGroup = document.querySelector('#chart-filter-group');
  if (filterGroup) {
    filterGroup.addEventListener('click', event => {
      const btn = event.target.closest('.filter-chip');
      if (!btn) return;
      filterGroup.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartLimit = btn.dataset.count;
      renderSummary();
    });
  }

  const overviewGraph = document.querySelector('#overview-graph');
  const chartLegend = document.querySelector('#chart-legend');

  const handleHover = (name) => {
    if (hoveredItemName === name) return;
    hoveredItemName = name;
    renderSummary();
  };

  const handleUnhover = () => {
    if (hoveredItemName === null) return;
    hoveredItemName = null;
    renderSummary();
  };

  [overviewGraph, chartLegend].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseover', event => {
      const target = event.target.closest('[data-name]');
      if (target) {
        handleHover(target.dataset.name);
      }
    });
    el.addEventListener('mouseleave', () => {
      handleUnhover();
    });
  });
}


const SHEET_ID = '1KYIp9NPtnEp5LISgJVBEPPNCIseCivPSVRRj2uQrBcA';
const SHEET_URL = name => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

function numberValue(v) {
  const n = Number(String(v ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function looksLikeDate(v) {
  return /^\s*\d{4}[.\-/]\s*\d{1,2}(?:[.\-/]\s*\d{1,2})?\s*$/.test(String(v ?? '')) ||
    /\d{1,2}월\s*\d{1,2}일/.test(String(v ?? ''));
}

function normalizeDate(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/(\d{2,4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (m) return `${m[1].slice(-2)}. ${Number(m[2])}. ${Number(m[3])}.`;
  const month = s.match(/(\d{4})[.\-/]\s*(\d{1,2})/);
  if (month) return `${month[1].slice(-2)}. ${Number(month[2])}.`;
  return s.replace(/\s+/g, ' ');
}

function buildSheetData(rows) {
  const dateRowIndex = rows.findIndex(r => r.some(looksLikeDate));
  if (dateRowIndex < 0) throw new Error('날짜 행을 찾을 수 없습니다.');

  const header = rows[Math.max(0, dateRowIndex - 1)];
  const maxCols = Math.max(...rows.map(r => r.length));
  const dataRows = rows.slice(dateRowIndex).filter(row => looksLikeDate(row[0]));
  const running = new Map();
  const snapshots = [];

  for (const row of dataRows) {
    for (let c = 1; c + 2 < maxCols; c += 3) {
      const forwardCode = String(header[c] ?? '').trim();
      const backwardCode = String(header[c + 2] ?? '').trim();
      if (!forwardCode || !backwardCode || /합계|리버스/i.test(forwardCode)) continue;

      const pairKey = [forwardCode, backwardCode].sort().join('|');
      const current = running.get(pairKey) ?? {
        name: forwardCode,
        backwardName: backwardCode,
        forward: 0,
        reverse: 0,
        backward: 0,
        value: 0
      };
      current.forward += numberValue(row[c]);
      current.reverse += numberValue(row[c + 1]);
      current.backward += numberValue(row[c + 2]);
      current.value = current.forward + current.reverse + current.backward;
      running.set(pairKey, current);
    }

    snapshots.push({
      date: normalizeDate(row[0]),
      values: [...running.values()].map(item => ({ ...item }))
    });
  }

  if (!snapshots.length) throw new Error('포타 개수 데이터를 찾을 수 없습니다.');
  return snapshots;
}

function calculateRankingSnapshots(snapshots) {
  return snapshots.map(snapshot => {
    const directionalValues = snapshot.values.flatMap(item => [
      { name: item.name, value: item.forward + item.reverse },
      { name: item.backwardName, value: item.backward + item.reverse }
    ]);
    const sorted = directionalValues.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    return { ...snapshot, ranking: sorted.map((x, i) => ({ ...x, rank: i + 1 })) };
  });
}

function renderMemberStats(cpInfoRows, latestSnapshot) {
  const el = document.querySelector('#member-stats-body');
  if (!el) return;

  const members = new Map();
  const infoByCode = new Map();
  for (const row of cpInfoRows) {
    const code = String(row[0] ?? '').trim();
    const left = String(row[1] ?? '').trim();
    const right = String(row[3] ?? '').trim();
    if (!code || !left || !right || /cp|멤버/i.test(code)) continue;
    infoByCode.set(code, { left, right });
    if (!members.has(left)) members.set(left, { total: 0, left: 0, right: 0 });
    if (!members.has(right)) members.set(right, { total: 0, left: 0, right: 0 });
  }

  for (const cp of latestSnapshot.values) {
    const info = infoByCode.get(cp.name);
    if (!info) continue;
    const { left, right } = info;
    const total = cp.value;
    members.get(left).total += total;
    members.get(right).total += total;
    members.get(left).left += cp.forward + cp.reverse;
    members.get(left).right += cp.backward + cp.reverse;
    members.get(right).left += cp.backward + cp.reverse;
    members.get(right).right += cp.forward + cp.reverse;
  }

  const sorted = [...members.entries()].sort((a, b) => b[1].total - a[1].total);
  el.innerHTML = sorted.map(([name, x]) => {
    const sum = x.left + x.right;
    const leftPct = sum ? x.left / sum * 100 : 0;
    const rightPct = sum ? x.right / sum * 100 : 0;
    return `<tr><td>${name}</td><td>${formatNumber.format(x.total)}</td><td>${leftPct.toFixed(1)}%</td><td>${rightPct.toFixed(1)}%</td></tr>`;
  }).join('');
}

async function loadGoogleSheet() {
  const [rankingRes, infoRes] = await Promise.all([
    fetch(SHEET_URL('포타 개수')),
    fetch(SHEET_URL('CP 정보'))
  ]);
  if (!rankingRes.ok || !infoRes.ok) throw new Error('Google Sheets를 불러오지 못했습니다.');

  const [rankingText, infoText] = await Promise.all([rankingRes.text(), infoRes.text()]);
  const snapshots = calculateRankingSnapshots(buildSheetData(parseCsv(rankingText)));
  const infoRows = parseCsv(infoText);

  const previous = snapshots.at(-2)?.ranking ?? [];
  const current = snapshots.at(-1)?.ranking ?? [];
  const previousByName = new Map(previous.map(item => [item.name, item]));

  rankingData = current.map(item => ({
    ...item,
    previousRank: previousByName.get(item.name)?.rank ?? null,
    trend: snapshots.map(snapshot => snapshot.ranking.find(x => x.name === item.name)?.value ?? 0)
  }));
  dates = snapshots.map(snapshot => snapshot.date);
  dashboardTitle = '핱페스 포타 개수 순위';
  renderSummary();
  render();
  renderMemberStats(infoRows, snapshots.at(-1));
}

function initialize(text) {
  const parsed = parseSource(text);
  rankingData = parsed.data;
  dates = parsed.dates;
  dashboardTitle = parsed.title;
  renderSummary();
  render();
}

document.querySelector('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
document.querySelector('#sort-button').addEventListener('click', event => { state.sortByMovement = !state.sortByMovement; event.currentTarget.setAttribute('aria-pressed', state.sortByMovement); render(); });
setupChartEvents();
initialize(fallbackText);
loadGoogleSheet().catch(error => console.error('Google Sheets load failed:', error));
