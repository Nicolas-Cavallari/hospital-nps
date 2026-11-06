import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { request } from '../../services/api.js';
import './dashboard.css';

const fmt = (value, digits = 1) => value == null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
function summarizeNps(rows) {
  const scores = new Map();
  rows.filter((row) => row.kind === 'evaluation' && row.status === 'completed' && row.value != null)
    .forEach((row) => scores.set(row.value, (scores.get(row.value) ?? 0) + row.count));
  const total = [...scores.values()].reduce((sum, count) => sum + count, 0);
  if (!total) return { value: null, total, promoters: 0, passives: 0, detractors: 0 };
  const promoters = [...scores].filter(([score]) => score >= 9).reduce((sum, [, count]) => sum + count, 0);
  const detractors = [...scores].filter(([score]) => score <= 6).reduce((sum, [, count]) => sum + count, 0);
  const passives = total - promoters - detractors;
  return { value: Math.round((promoters - detractors) * 100 / total), total, promoters, passives, detractors };
}
function summarizeAnswerNps(rows) {
  const scores = new Map();
  rows.filter((row) => row.kind === 'answer' && row.isNps && row.status === 'completed' && row.value != null)
    .forEach((row) => scores.set(row.value, (scores.get(row.value) ?? 0) + row.count));
  const total = [...scores.values()].reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const promoters = [...scores].filter(([score]) => score >= 9).reduce((sum, [, count]) => sum + count, 0);
  const detractors = [...scores].filter(([score]) => score <= 6).reduce((sum, [, count]) => sum + count, 0);
  return Math.round((promoters - detractors) * 100 / total);
}
function averageAnswers(rows) {
  let sum = 0; let count = 0;
  rows.filter((row) => row.kind === 'answer' && !row.isNps && row.value != null)
    .forEach((row) => { sum += row.value * row.count; count += row.count; });
  return count ? sum / count : null;
}
function groupBy(rows, key) {
  const groups = new Map();
  rows.forEach((row) => {
    const id = row[key];
    if (!id) return;
    if (!groups.has(id)) groups.set(id, { id, name: row[key.replace('Id', '')] ?? 'Sem identificação', rows: [] });
    groups.get(id).rows.push(row);
  });
  return [...groups.values()];
}
function responseCounts(rows) {
  return rows.filter((row) => row.kind === 'evaluation').reduce((out, row) => {
    out[row.status] += row.count;
    return out;
  }, { completed: 0, incomplete: 0 });
}
function getNpsTrend(rows) {
  const months = [...new Set(rows.filter((row) => row.kind === 'evaluation' && row.status === 'completed' && row.value != null).map((row) => row.month))].sort().slice(-6);
  return months.map((month) => ({
    month,
    value: summarizeNps(rows.filter((row) => row.month === month)).value,
  }));
}

function NpsTrendChart({ rows }) {
  const points = getNpsTrend(rows);
  if (!points.length) return <p className="dashboard__chart-empty">Sem avaliações completas para mostrar a evolução do NPS.</p>;
  const x = (index) => points.length === 1 ? 360 : 48 + index * (624 / (points.length - 1));
  const y = (value) => 20 + ((100 - value) / 200) * 150;
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ');
  return <div className="dashboard__chart-wrap">
    <svg className="dashboard__line-chart" viewBox="0 0 720 210" role="img" aria-label="Evolução mensal do NPS, baseada em avaliações completas">
      {[-100, 0, 100].map((value) => <g key={value}><line x1="48" x2="672" y1={y(value)} y2={y(value)} /><text x="0" y={y(value) + 4}>{value}</text></g>)}
      <path className="dashboard__line" d={path} />
      {points.map((point, index) => <g key={point.month}><circle cx={x(index)} cy={y(point.value)} r="5" /><text className="dashboard__value" x={x(index)} y={y(point.value) - 12} textAnchor="middle">{point.value}</text><text x={x(index)} y="198" textAnchor="middle">{new Date(`${point.month}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' })}</text></g>)}
    </svg>
  </div>;
}

function SectorNpsChart({ rows }) {
  const groups = groupBy(rows.filter((row) => row.kind === 'evaluation'), 'sectorId')
    .map((group) => ({ ...group, nps: summarizeNps(group.rows).value }))
    .sort((a, b) => (b.nps ?? -101) - (a.nps ?? -101));
  if (!groups.length) return <p className="dashboard__chart-empty">Sem resultados por setor neste recorte.</p>;
  return <div className="dashboard__bars" role="img" aria-label="Comparação do NPS por setor, escala de menos 100 a mais 100">
    {groups.map((group) => <div className="dashboard__bar-row" key={group.id}><span>{group.name}</span><div className="dashboard__bar-track"><i className={group.nps < 0 ? 'is-negative' : ''} style={{ left: '50%', width: `${group.nps == null ? 0 : Math.abs(group.nps) / 2}%`, transform: group.nps < 0 ? 'translateX(-100%)' : undefined }} /></div><strong>{group.nps ?? '—'}</strong></div>)}
    <div className="dashboard__bar-scale"><span>−100</span><span>0</span><span>100</span></div>
  </div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams();
    if (month) query.set('month', month);
    if (sectorId) query.set('sectorId', sectorId);
    if (shiftId) query.set('shiftId', shiftId);
    if (teamId) query.set('teamId', teamId);
    request('GET', `/api/admin/dashboard${query.size ? `?${query}` : ''}`)
      .then((result) => {
        if (!active) return;
        if (!result.ok) { setError(result.status === 403 ? 'Seu perfil não tem acesso a estes resultados.' : result.body?.error ?? 'Não foi possível carregar os indicadores.'); setData(null); }
        else setData(result.body);
      }).catch(() => active && setError('Não foi possível conectar ao servidor.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [month, sectorId, shiftId, teamId]);

  const rows = data?.rows ?? [];
  const trendRows = data?.trendRows ?? [];
  const months = data?.availableMonths ?? [];
  const sectors = data?.sectors ?? [];
  const availableTeams = data?.teams ?? [];
  const overview = useMemo(() => ({ nps: summarizeNps(rows), counts: responseCounts(rows) }), [rows]);
  const sectorGroups = useMemo(
    () => groupBy(rows, 'sectorId').sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const questionGroups = useMemo(() => {
    const map = new Map();
    rows.filter((row) => row.kind === 'answer').forEach((row) => {
      const item = map.get(row.questionId) ?? { id: row.questionId, name: row.question, isNps: row.isNps, rows: [] };
      item.rows.push(row); map.set(row.questionId, item);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const teams = useMemo(() => groupBy(rows, 'teamId').sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const updatedAt = data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString('pt-BR') : '—';

  return <main className="dashboard">
    <header className="dashboard__heading"><div><p className="eyebrow">Experiência do paciente</p><h1>Visão geral do hospital</h1><p>Indicadores agregados • Atualizado em {updatedAt}</p></div></header>
    <section className="dashboard__filters" aria-label="Filtros do dashboard">
      <label>Período<select value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Todos os períodos</option>{months.map((value) => <option key={value} value={value}>{new Date(`${value}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>)}</select></label>
      {user.role !== 'gestor' && <label>Setor<select value={sectorId} onChange={(e) => setSectorId(e.target.value)}><option value="">Todos os setores</option>{sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></label>}
      {user.role === 'gestor' && <p className="dashboard__scope">Acesso restrito ao seu setor</p>}
      <label>Turno<select value={shiftId} onChange={(e) => setShiftId(e.target.value)}><option value="">Todos os turnos</option>{(data?.shifts ?? []).map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select></label>
      <label>Equipe<select value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">Todas as equipes</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
    </section>
    {error && <div className="dashboard__message dashboard__message--error" role="alert">{error}</div>}
    {loading && <div className="dashboard__message">Carregando indicadores…</div>}
    {!loading && !error && <>
      <section className="dashboard__cards" aria-label="Indicadores gerais">
        <article><span>NPS do hospital</span><strong>{overview.nps.value ?? '—'}</strong><small>{overview.nps.total} avaliações completas com NPS</small></article>
        <article><span>Avaliações completas</span><strong>{overview.counts.completed}</strong><small>Avaliações finalizadas</small></article>
        <article><span>Avaliações incompletas</span><strong>{overview.counts.incomplete}</strong><small>Não incluídas no NPS</small></article>
        <article><span>Promotores</span><strong>{overview.nps.total ? `${fmt(overview.nps.promoters * 100 / overview.nps.total, 0)}%` : '—'}</strong><small>{overview.nps.promoters} respostas de 9 ou 10</small></article>
      </section>
      <section className="dashboard__charts" aria-label="Gráficos de NPS">
        <article className="dashboard__panel"><h2>Evolução do NPS</h2><p>Últimos seis meses • Avaliações completas</p><NpsTrendChart rows={trendRows} /></article>
        <article className="dashboard__panel"><h2>NPS por setor</h2><p>Comparação no período e recortes selecionados</p><SectorNpsChart rows={rows} /></article>
      </section>
      {rows.length === 0 ? <div className="dashboard__message">Ainda não há respostas para o período selecionado.</div> : <>
        <section className="dashboard__panel"><h2>NPS por setor</h2><p>Calculado sobre avaliações completas; incompletas aparecem separadamente.</p><div className="dashboard__table-wrap"><table><thead><tr><th>Setor</th><th>NPS</th><th>Promotores</th><th>Neutros</th><th>Detratores</th><th>Completas</th><th>Incompletas</th></tr></thead><tbody>{sectorGroups.map((sector) => { const nps = summarizeNps(sector.rows); const counts = responseCounts(sector.rows); return <tr key={sector.id}><th>{sector.name}</th><td>{nps.value ?? '—'}</td><td>{nps.promoters}</td><td>{nps.passives}</td><td>{nps.detractors}</td><td>{counts.completed}</td><td>{counts.incomplete}</td></tr>; })}</tbody></table></div></section>
        <section className="dashboard__panel"><h2>Respostas por pergunta</h2><p>Respostas registradas são consideradas mesmo quando a avaliação ainda não foi finalizada; o NPS da pergunta usa somente avaliações completas.</p><div className="dashboard__table-wrap"><table><thead><tr><th>Pergunta</th><th>Indicador</th><th>Respostas completas</th><th>Respostas incompletas</th></tr></thead><tbody>{questionGroups.map((question) => { const completed = question.rows.filter((r) => r.status === 'completed').reduce((n, r) => n + r.count, 0); const incomplete = question.rows.filter((r) => r.status === 'incomplete').reduce((n, r) => n + r.count, 0); const indicator = question.isNps ? `NPS ${summarizeAnswerNps(question.rows) ?? '—'}` : `${fmt(averageAnswers(question.rows))}${averageAnswers(question.rows) != null ? ' / 5' : ''}`; return <tr key={question.id}><th>{question.name}</th><td>{indicator}</td><td>{completed}</td><td>{incomplete}</td></tr>; })}</tbody></table></div></section>
        <section className="dashboard__panel"><h2>NPS por equipe</h2><p>Equipes não determinadas pela regra de atribuição atual permanecem sem identificação.</p><div className="dashboard__table-wrap"><table><thead><tr><th>Equipe</th><th>NPS</th><th>Respostas completas</th><th>Respostas incompletas</th></tr></thead><tbody>{teams.map((team) => { const nps = summarizeNps(team.rows); const counts = responseCounts(team.rows); return <tr key={team.id}><th>{team.name}</th><td>{nps.value ?? '—'}</td><td>{counts.completed}</td><td>{counts.incomplete}</td></tr>; })}</tbody></table></div></section>
      </>}
    </>}
    <footer className="dashboard__foot">Os indicadores são snapshots atualizados a cada 8 horas. O NPS considera somente avaliações completas.</footer>
  </main>;
}
