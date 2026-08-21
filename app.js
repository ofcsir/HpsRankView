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
  const points = values.map((value, index) => `${index * 104 + 2},${25 - ((value - min) / range) * 20}`).join(' ');
  const color = values.at(-1) >= values[0] ? '#168760' : '#d24444';
  return `<svg class="sparkline" viewBox="0 0 108 28" aria-label="두 집계 시점의 수치 추이"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
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
  const y = val => top + (chartMax - val) / range * (height - top - bottom);

  const ticks = [0, Math.round(chartMax * 0.25), Math.round(chartMax * 0.5), Math.round(chartMax * 0.75), chartMax];
  const gridHtml = ticks.map(t => {
    const yPos = y(t);
    return `<line class="chart-grid" x1="${left}" x2="${x1}" y1="${yPos}" y2="${yPos}"/><text class="chart-axis" x="${left - 8}" y="${yPos + 4}">${formatNumber.format(t)}</text>`;
  }).join('');

  const dateLabelsHtml = `
    <line class="date-guide" x1="${x0}" x2="${x0}" y1="${top - 10}" y2="${height - bottom}" stroke="#d7dce7" stroke-dasharray="3,3"/>
    <line class="date-guide" x1="${x1}" x2="${x1}" y1="${top - 10}" y2="${height - bottom}" stroke="#d7dce7" stroke-dasharray="3,3"/>
    <text class="chart-label date-title" x="${x0}" y="${height - 14}">${dates[0] ?? '이전 집계'}</text>
    <text class="chart-label date-title" x="${x1}" y="${height - 14}">${dates[1] ?? '최근 집계'}</text>
  `;

  const minGap = 20;
  const minY = top + 10;
  const maxY = height - bottom - 10;

  const labelPositions = displayed.map(item => ({
    name: item.name,
    y0: y(item.trend[0]),
    y1: y(item.trend[1]),
    labelY: y(item.trend[1])
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
    const v1 = item.trend[1];
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
        <path d="M ${x0} ${y0} L ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="trend-path"/>
        <circle cx="${x0}" cy="${y0}" r="${isHovered ? 5.5 : 4}" fill="${color}" class="trend-dot"/>
        <circle cx="${x1}" cy="${y1}" r="${isHovered ? 5.5 : 4}" fill="${color}" class="trend-dot"/>
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
    const diff = item.trend[1] - item.trend[0];
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
fetch('data/ranking.txt').then(response => response.ok ? response.text() : Promise.reject()).then(initialize).catch(() => {});
