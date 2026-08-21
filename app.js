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

function overviewChart(values) {
  const width = 920, height = 220, left = 48, right = 30, top = 34, bottom = 42;
  const min = Math.min(...values), max = Math.max(...values);
  const padding = Math.max((max - min) * 0.18, 1);
  const chartMin = Math.max(0, min - padding), chartMax = max + padding, range = chartMax - chartMin;
  const x = index => left + index * ((width - left - right) / Math.max(values.length - 1, 1));
  const y = value => top + (chartMax - value) / range * (height - top - bottom);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `${left},${height - bottom} ${points} ${x(values.length - 1)},${height - bottom}`;
  const gridValues = [chartMin, (chartMin + chartMax) / 2, chartMax];
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="전체 항목 개수 추이"><defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#3056d3" stop-opacity=".22"/><stop offset="100%" stop-color="#3056d3" stop-opacity="0"/></linearGradient></defs>${gridValues.map(value => `<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis" x="${left - 9}" y="${y(value) + 4}">${formatNumber.format(Math.round(value))}</text>`).join('')}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${values.map((value, index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(value)}" r="5"/><text class="chart-value" x="${x(index)}" y="${y(value) - 14}">${formatNumber.format(value)}</text><text class="chart-label" x="${x(index)}" y="${height - 14}">${dates[index] ?? `집계 ${index + 1}`}</text>`).join('')}</svg>`;
}

function render() {
  let items = rankingData.filter(item => item.name.toLowerCase().includes(state.query.toLowerCase()));
  if (state.sortByMovement) items = [...items].sort((a, b) => Math.abs(change(b) ?? 0) - Math.abs(change(a) ?? 0));
  document.querySelector('#ranking-body').innerHTML = items.map(item => `<tr><td class="rank">${item.rank}</td><td class="item-name">${item.name}</td><td class="value">${formatNumber.format(item.value)}</td><td>${movement(item)}</td><td>${sparkline(item.trend)}</td></tr>`).join('');
  document.querySelector('#result-count').textContent = `${items.length}개 항목`;
  document.querySelector('#empty-state').hidden = items.length !== 0;
}

function renderSummary() {
  const totals = [0, 1].map(index => rankingData.reduce((sum, item) => sum + item.trend[index], 0));
  const totalDifference = totals.at(-1) - totals[0];
  document.querySelector('#total-change').textContent = totalDifference >= 0 ? `▲ ${formatNumber.format(totalDifference)}개 증가` : `▼ ${formatNumber.format(Math.abs(totalDifference))}개 감소`;
  document.querySelector('#total-change').className = `total-change ${totalDifference < 0 ? 'down' : ''}`;
  document.querySelector('#overview-graph').innerHTML = overviewChart(totals);
  document.querySelector('#page-title').textContent = dashboardTitle;
  document.querySelector('#page-description').textContent = dates.length > 1 ? `${dates[0]} 대비 ${dates.at(-1)} 기준 순위 변화와 개수 추이입니다.` : '순위 변화와 수치를 빠르게 확인하세요.';
  document.querySelector('#updated-at').textContent = dates.at(-1) ? `최근 집계 ${dates.at(-1)}` : '';
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
initialize(fallbackText);
fetch('data/ranking.txt').then(response => response.ok ? response.text() : Promise.reject()).then(initialize).catch(() => {});
