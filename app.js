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
const state = { query: '' };
let rankingData = [];
let chartData = [];
let rankingSnapshots = [];
let cpInfoByCode = new Map();
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
let activeRankingLimit = '10';
let activeRankTrendLimit = '10';
let hoveredItemName = null;
let rankHoveredItemName = null;
let selectedMembers = [];
let selectedDetailCp = null;
let detailSortNewestFirst = true;

function getItemColor(index) {
  return palette[index % palette.length];
}

function change(item) { return item.previousRank === null ? null : item.previousRank - item.rank; }

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
  else if (filterLimit === '20') displayed = items.slice(0, 20);

  const width = 920, height = displayed.length > 10 ? 520 : 400;
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

  const minGap = displayed.length > 10 ? 14 : 20;
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

function rankTrendChart(items, filterLimit) {
  let displayed = items;
  if (filterLimit === '10') displayed = items.slice(0, 10);
  else if (filterLimit === '20') displayed = items.slice(0, 20);

  const width = 920;
  const height = displayed.length > 20 ? 700 : displayed.length > 10 ? 520 : 400;
  const left = 60, right = displayed.length > 20 ? 70 : 240, top = 35, bottom = 50;
  const maxRank = Math.max(...displayed.flatMap(item => item.rankTrend ?? [item.rank]), 1);
  const x0 = left, x1 = width - right;
  const periodCount = Math.max(dates.length, 1);
  const x = index => periodCount === 1 ? x0 : x0 + index / (periodCount - 1) * (x1 - x0);
  const y = rank => top + ((rank - 1) / Math.max(maxRank - 1, 1)) * (height - top - bottom);
  const tickValues = [...new Set([1, Math.ceil(maxRank * .25), Math.ceil(maxRank * .5), Math.ceil(maxRank * .75), maxRank])].sort((a, b) => a - b);
  const gridHtml = tickValues.map(rank => {
    const yPos = y(rank);
    return `<line class="chart-grid" x1="${left}" x2="${x1}" y1="${yPos}" y2="${yPos}"/><text class="chart-axis" x="${left - 8}" y="${yPos}">${rank}위</text>`;
  }).join('');

  const labelStep = Math.max(1, Math.ceil(periodCount / 6));
  const labelIndexes = dates.map((_, index) => index)
    .filter(index => index === 0 || index === periodCount - 1 || index % labelStep === 0);
  const dateLabelsHtml = labelIndexes.map(index => `
    <line x1="${x(index)}" x2="${x(index)}" y1="${top}" y2="${height - bottom}" stroke="#d7dce7" stroke-dasharray="3,3"/>
    <text class="chart-label date-title" x="${x(index)}" y="${height - 14}">${dates[index]}</text>
  `).join('');

  const showLabels = displayed.length <= 20;
  const minGap = displayed.length > 10 ? 14 : 20;
  const labelPositions = displayed.map(item => ({
    name: item.name,
    endY: y(item.rankTrend.at(-1)),
    labelY: y(item.rankTrend.at(-1))
  })).sort((a, b) => a.endY - b.endY);
  if (showLabels) {
    for (let i = 1; i < labelPositions.length; i++) {
      labelPositions[i].labelY = Math.max(labelPositions[i].labelY, labelPositions[i - 1].labelY + minGap);
    }
    const overflow = labelPositions.at(-1)?.labelY - (height - bottom - 8);
    if (overflow > 0) labelPositions.forEach(item => { item.labelY -= overflow; });
  }
  const labelYMap = new Map(labelPositions.map(item => [item.name, item.labelY]));

  const linesHtml = displayed.map((item, index) => {
    const color = getItemColor(index);
    const isHovered = rankHoveredItemName === item.name;
    const isOtherHovered = rankHoveredItemName && !isHovered;
    const points = item.rankTrend.map((rank, rankIndex) => `${x(rankIndex)},${y(rank)}`).join(' ');
    const endY = y(item.rankTrend.at(-1));
    const labelY = labelYMap.get(item.name) ?? endY;
    const label = showLabels ? `<text x="${x1 + 12}" y="${labelY + 4}" class="val-label" fill="${color}" font-weight="700">${item.name} (${item.rank}위)</text>` : '';
    return `<g class="rank-trend-group" data-name="${item.name}" style="opacity:${isOtherHovered ? .12 : 1}">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="${isHovered ? 3.8 : 2.3}" stroke-linecap="round" stroke-linejoin="round"/>
      ${item.rankTrend.map((rank, rankIndex) => `<circle cx="${x(rankIndex)}" cy="${y(rank)}" r="${rankIndex === item.rankTrend.length - 1 ? 3.8 : 2.2}" fill="${color}"><title>${dates[rankIndex]}: ${rank}위</title></circle>`).join('')}
      ${label}
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="CP별 순위 변동 그래프">${gridHtml}${dateLabelsHtml}${linesHtml}</svg>`;
}

function renderRankTrend() {
  let displayed = chartData;
  if (activeRankTrendLimit === '10') displayed = chartData.slice(0, 10);
  else if (activeRankTrendLimit === '20') displayed = chartData.slice(0, 20);
  document.querySelector('#rank-trend-graph').innerHTML = rankTrendChart(chartData, activeRankTrendLimit);
  document.querySelector('#rank-trend-legend').innerHTML = displayed.map((item, index) => `
    <button type="button" class="legend-pill ${rankHoveredItemName === item.name ? 'active' : ''}" data-name="${item.name}">
      <span class="legend-color" style="background-color:${getItemColor(index)}"></span>
      <span class="legend-name">${item.name}</span>
      <span class="legend-val">${item.rank}위</span>
    </button>
  `).join('');
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
  const totalCount = items.length;
  if (activeRankingLimit !== 'all') items = items.slice(0, Number(activeRankingLimit));
  document.querySelector('#ranking-body').innerHTML = items.map(item => `<tr><td class="rank">${item.rank}</td><td class="item-name">${item.name}</td><td class="value">${formatNumber.format(item.value)}</td><td>${movement(item)}</td></tr>`).join('');
  document.querySelector('#result-count').textContent = activeRankingLimit === 'all' ? `${totalCount}개 항목` : `${items.length} / ${totalCount}개 항목`;
  document.querySelector('#empty-state').hidden = items.length !== 0;
}

function setupRankingEvents() {
  const filterGroup = document.querySelector('#ranking-filter-group');
  if (!filterGroup) return;
  filterGroup.addEventListener('click', event => {
    const btn = event.target.closest('.filter-chip');
    if (!btn) return;
    filterGroup.querySelectorAll('.filter-chip').forEach(button => button.classList.remove('active'));
    btn.classList.add('active');
    activeRankingLimit = btn.dataset.count;
    render();
  });
}

function renderSummary() {
  let displayedItems = chartData;
  if (activeChartLimit === '5') displayedItems = chartData.slice(0, 5);
  else if (activeChartLimit === '10') displayedItems = chartData.slice(0, 10);
  else if (activeChartLimit === '20') displayedItems = chartData.slice(0, 20);

  document.querySelector('#overview-graph').innerHTML = itemTrendChart(chartData, activeChartLimit);
  renderChartLegend(displayedItems);
  document.querySelector('#page-title').textContent = dashboardTitle;
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

function setupRankTrendEvents() {
  const filterGroup = document.querySelector('#rank-trend-filter-group');
  const graph = document.querySelector('#rank-trend-graph');
  const legend = document.querySelector('#rank-trend-legend');

  filterGroup.addEventListener('click', event => {
    const btn = event.target.closest('.filter-chip');
    if (!btn) return;
    filterGroup.querySelectorAll('.filter-chip').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    activeRankTrendLimit = btn.dataset.count;
    rankHoveredItemName = null;
    renderRankTrend();
  });

  for (const element of [graph, legend]) {
    element.addEventListener('mouseover', event => {
      const target = event.target.closest('[data-name]');
      if (!target || rankHoveredItemName === target.dataset.name) return;
      rankHoveredItemName = target.dataset.name;
      renderRankTrend();
    });
    element.addEventListener('mouseleave', () => {
      if (!rankHoveredItemName) return;
      rankHoveredItemName = null;
      renderRankTrend();
    });
  }
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
      const reverseCode = String(header[c + 1] ?? '').trim();
      const backwardCode = String(header[c + 2] ?? '').trim();
      if (!forwardCode || !backwardCode || /합계|리버스/i.test(forwardCode)) continue;

      const pairKey = [forwardCode, backwardCode].sort().join('|');
      const current = running.get(pairKey) ?? {
        name: forwardCode,
        reverseName: reverseCode,
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
      dateKey: String(row[0]).trim().slice(0, 7),
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
  cpInfoByCode = new Map();
  for (const row of cpInfoRows) {
    const code = String(row[0] ?? '').trim();
    const left = String(row[1] ?? '').trim();
    const right = String(row[3] ?? '').trim();
    if (!code || !left || !right || /cp|멤버/i.test(code)) continue;
    cpInfoByCode.set(code, { left, right });
    if (!members.has(left)) members.set(left, { total: 0, left: 0, right: 0 });
    if (!members.has(right)) members.set(right, { total: 0, left: 0, right: 0 });
  }

  for (const cp of latestSnapshot.values) {
    const info = cpInfoByCode.get(cp.name);
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

const memberAvatarFiles = {
  '카르멘': 'members/carmen.svg',
  '지우': 'members/jiwoo.svg',
  '유하': 'members/yuha.svg',
  '스텔라': 'members/stella.svg',
  '주은': 'members/juun.svg',
  '에이나': 'members/aina.svg',
  '이안': 'members/ian.svg',
  '예온': 'members/yeon.svg'
};

function findSelectedPair() {
  if (selectedMembers.length !== 2) return null;
  const selected = [...selectedMembers].sort().join('|');
  return rankingSnapshots.at(-1)?.values.find(item => {
    const info = cpInfoByCode.get(item.name);
    return info && [info.left, info.right].sort().join('|') === selected;
  }) ?? null;
}

function renderDetailTable() {
  const body = document.querySelector('#detail-table-body');
  const pair = findSelectedPair();
  if (!pair || !selectedDetailCp) {
    body.innerHTML = '<tr><td colspan="3" class="detail-empty">CP를 선택하면 데이터가 표시됩니다.</td></tr>';
    return;
  }

  let rows = rankingSnapshots.map(snapshot => {
    const item = snapshot.values.find(value => value.name === pair.name && value.backwardName === pair.backwardName);
    const ranking = snapshot.ranking.find(value => value.name === selectedDetailCp);
    const value = selectedDetailCp === pair.name
      ? item.forward + item.reverse
      : item.backward + item.reverse;
    return { date: snapshot.date, value, rank: ranking?.rank ?? '-' };
  });
  if (detailSortNewestFirst) rows = rows.reverse();
  body.innerHTML = rows.map(row => `<tr><td>${row.date}</td><td>${formatNumber.format(row.value)}</td><td>${row.rank}위</td></tr>`).join('');
}

function renderPairDetail() {
  const detail = document.querySelector('#pair-detail');
  const ratio = document.querySelector('#pair-ratio');
  const buttons = document.querySelector('#detail-cp-buttons');
  const pair = findSelectedPair();
  detail.hidden = !pair;
  if (!pair) return;

  const total = pair.forward + pair.reverse + pair.backward;
  const parts = [
    { className: 'forward', label: pair.name, value: pair.forward },
    { className: 'reverse', label: pair.reverseName || '리버시블', value: pair.reverse },
    { className: 'backward', label: pair.backwardName, value: pair.backward }
  ].map(part => ({ ...part, percent: total ? part.value / total * 100 : 0 }));

  ratio.innerHTML = `
    <div class="ratio-bar">
      ${parts.map(part => `<div class="ratio-segment ${part.className}" style="flex:${part.value || .001}" title="${part.label} ${part.percent.toFixed(1)}%">${part.percent >= 8 ? `${part.percent.toFixed(1)}%` : ''}</div>`).join('')}
    </div>
    <div class="ratio-summary">
      ${parts.map(part => `<span><strong>${part.label}</strong><br>${formatNumber.format(part.value)} · ${part.percent.toFixed(1)}%</span>`).join('')}
    </div>`;

  buttons.innerHTML = [pair.name, pair.backwardName].map(code => `
    <button type="button" class="detail-cp-button ${selectedDetailCp === code ? 'active' : ''}" data-cp="${code}">${code}</button>
  `).join('');
  renderDetailTable();
}

function renderMemberPicker() {
  const memberOrder = ['카르멘', '지우', '유하', '스텔라', '주은', '에이나', '이안', '예온'];
  const grid = document.querySelector('#member-picker-grid');
  grid.innerHTML = memberOrder.map(name => `
    <button type="button" class="member-card ${selectedMembers.includes(name) ? 'selected' : ''}" data-member="${name}" aria-pressed="${selectedMembers.includes(name)}">
      <img src="${memberAvatarFiles[name]}" alt="${name} 아바타" />
      <span>${name}</span>
    </button>
  `).join('');
}

function setupDetailEvents() {
  const grid = document.querySelector('#member-picker-grid');
  grid.addEventListener('click', event => {
    const card = event.target.closest('.member-card');
    if (!card) return;
    const name = card.dataset.member;
    if (selectedMembers.includes(name)) {
      selectedMembers = selectedMembers.filter(member => member !== name);
    } else if (selectedMembers.length < 2) {
      selectedMembers.push(name);
    } else {
      selectedMembers = [selectedMembers[1], name];
    }
    selectedDetailCp = null;
    renderMemberPicker();
    renderPairDetail();
  });

  document.querySelector('#detail-cp-buttons').addEventListener('click', event => {
    const button = event.target.closest('.detail-cp-button');
    if (!button) return;
    selectedDetailCp = button.dataset.cp;
    renderPairDetail();
  });

  document.querySelector('#detail-sort-button').addEventListener('click', event => {
    detailSortNewestFirst = !detailSortNewestFirst;
    event.currentTarget.textContent = detailSortNewestFirst ? '최신순' : '오래된 순';
    renderDetailTable();
  });
}

function selectRankingMonth(index) {
  const currentSnapshot = rankingSnapshots[index];
  if (!currentSnapshot) return;

  const previous = rankingSnapshots[index - 1]?.ranking ?? [];
  const previousByName = new Map(previous.map(item => [item.name, item]));
  rankingData = currentSnapshot.ranking.map(item => ({
    ...item,
    previousRank: previousByName.get(item.name)?.rank ?? null
  }));

  const monthInput = document.querySelector('#ranking-month');
  if (monthInput) monthInput.value = currentSnapshot.dateKey;
  document.querySelector('#updated-at').textContent = `집계 ${currentSnapshot.date}`;
  render();
}

function setupMonthPicker() {
  const monthInput = document.querySelector('#ranking-month');
  if (!monthInput || !rankingSnapshots.length) return;

  monthInput.min = rankingSnapshots[0].dateKey;
  monthInput.max = rankingSnapshots.at(-1).dateKey;
  monthInput.disabled = false;
  monthInput.addEventListener('change', event => {
    const index = rankingSnapshots.findIndex(snapshot => snapshot.dateKey === event.target.value);
    if (index >= 0) selectRankingMonth(index);
    else event.target.value = rankingSnapshots.at(-1).dateKey;
  });
}

function setupPageNavigation() {
  const tabs = [...document.querySelectorAll('.page-tab')];
  const views = [...document.querySelectorAll('[data-page-view]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      tabs.forEach(item => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      views.forEach(view => {
        const active = view.dataset.pageView === page;
        view.hidden = !active;
        view.classList.toggle('active', active);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

async function loadGoogleSheet() {
  const [rankingRes, infoRes] = await Promise.all([
    fetch(SHEET_URL('포타 개수')),
    fetch(SHEET_URL('CP 정보'))
  ]);
  if (!rankingRes.ok || !infoRes.ok) throw new Error('Google Sheets를 불러오지 못했습니다.');

  const [rankingText, infoText] = await Promise.all([rankingRes.text(), infoRes.text()]);
  rankingSnapshots = calculateRankingSnapshots(buildSheetData(parseCsv(rankingText)));
  const infoRows = parseCsv(infoText);

  const latestRanking = rankingSnapshots.at(-1)?.ranking ?? [];
  chartData = latestRanking.map(item => ({
    ...item,
    trend: rankingSnapshots.map(snapshot => snapshot.ranking.find(x => x.name === item.name)?.value ?? 0),
    rankTrend: rankingSnapshots.map(snapshot => snapshot.ranking.find(x => x.name === item.name)?.rank ?? snapshot.ranking.length)
  }));
  dates = rankingSnapshots.map(snapshot => snapshot.date);
  dashboardTitle = '핱페스 포타 개수 순위';
  setupMonthPicker();
  selectRankingMonth(rankingSnapshots.length - 1);
  renderSummary();
  renderRankTrend();
  renderMemberStats(infoRows, rankingSnapshots.at(-1));
  renderMemberPicker();
}

function initialize(text) {
  const parsed = parseSource(text);
  rankingData = parsed.data;
  chartData = parsed.data.map(item => ({
    ...item,
    rankTrend: [item.previousRank ?? item.rank, item.rank]
  }));
  dates = parsed.dates;
  dashboardTitle = parsed.title;
  renderSummary();
  renderRankTrend();
  render();
}

document.querySelector('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
setupChartEvents();
setupRankTrendEvents();
setupRankingEvents();
setupPageNavigation();
setupDetailEvents();
renderMemberPicker();
initialize(fallbackText);
loadGoogleSheet().catch(error => console.error('Google Sheets load failed:', error));
