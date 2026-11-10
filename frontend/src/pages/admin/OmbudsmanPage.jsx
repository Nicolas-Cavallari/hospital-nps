import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { request } from '../../services/api.js';
import Button from '../../components/ui/Button.jsx';
import AdminLayout from '../../components/layout/AdminLayout.jsx';
import { ArrowLeft, CheckCircle2, ClipboardList, Clock3, LockKeyhole, MessageSquare, Phone, ShieldCheck, TriangleAlert } from 'lucide-react';
import '../../styles/admin.css';
import './ombudsman.css';

const date = (value) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
const status = (item) => item.status === 'open' ? 'Em aberto' : item.closureReason === 'contact_failed' ? 'Contato sem sucesso' : 'Concluído';
const phone = (value) => value?.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') ?? 'Não informado';
const feedbackType = (value) => ({ elogio: 'Elogio', reclamacao: 'Reclamação', sugestao: 'Sugestão', outro: 'Outro' })[value] ?? 'Tipo não informado';

export default function OmbudsmanPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState('no_answer');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [revision, setRevision] = useState(0);
  const heading = useRef(null);
  const sending = useRef(false);
  const allowed = ['super_admin', 'ouvidoria'].includes(user.role);
  const canHandle = user.role === 'ouvidoria' && item?.status === 'open';

  useEffect(() => {
    heading.current?.focus();
    setConfirmClose(false); setNotice(''); setNotes(''); setDescription(''); setOutcome('no_answer'); setInterest('');
  }, [id]);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError(''); setItem(null);
    request('GET', `/api/admin/ouvidoria${id ? `/${id}` : `?page=${page}`}`)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.status === 401 ? 'Sua sessão expirou. Entre novamente para continuar.' : result.body?.error ?? 'Não foi possível carregar os atendimentos.');
        } else if (id) setItem(result.body.case);
        else setItems(result.body.cases);
      })
      .catch(() => active && setError('Não foi possível conectar ao servidor.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, page, allowed, revision]);

  async function save(operation, body) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('POST', `/api/admin/ouvidoria/${id}/${operation}`, body);
      if (!result.ok) {
        setError(result.body?.error ?? 'Não foi possível registrar a operação.');
        if (result.status === 409) setRevision((value) => value + 1);
        return;
      }
      setItem(result.body.case); setNotes(''); setDescription(''); setConfirmClose(false);
      setNotice(result.body.case.closureReason === 'contact_failed'
        ? 'Terceira tentativa sem resposta registrada. Atendimento encerrado como contato sem sucesso.'
        : 'Registro salvo com sucesso.');
    } catch { setError('Não foi possível conectar ao servidor. Confira o histórico antes de tentar novamente.'); }
    finally { sending.current = false; setBusy(false); }
  }

  const history = item ? [
    ...item.attempts.map((entry) => ({ ...entry, kind: 'attempt' })),
    ...item.actions.map((entry) => ({ ...entry, kind: 'action' })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at) || (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0)) : [];

  return <AdminLayout title="Ouvidoria">
    <div className="admin-page ombudsman">
      <header className="admin-page__heading">
        {id && <Link to="/admin/ouvidoria" className="admin-page__back"><ArrowLeft size={15} aria-hidden="true" />Voltar para manifestações</Link>}
        <h1 ref={heading} tabIndex={-1}>{id ? 'Detalhe da manifestação' : 'Manifestações'}</h1>
        <p>{id ? `${item?.code ?? 'Atendimento'} • Acompanhamento individual` : 'Ouvidoria • Acompanhamento de retorno, privacidade e rastreabilidade'}</p>
      </header>
      {!allowed ? <div className="admin-callout admin-callout--error" role="alert"><ShieldCheck size={20} aria-hidden="true" />Seu perfil não tem acesso à ouvidoria.</div> : <>
        {error && <div className="admin-callout admin-callout--error" role="alert"><TriangleAlert size={20} aria-hidden="true" /><div className="admin-callout__content"><p>{error}</p><Button variant="quiet" onClick={() => setRevision((value) => value + 1)}>Atualizar</Button><Link to="/login">Entrar novamente</Link></div></div>}
        {notice && <div role="status" className="admin-callout admin-callout--success"><CheckCircle2 size={20} aria-hidden="true" />{notice}</div>}
        {loading && <div className="admin-panel" role="status"><p>Carregando atendimentos…</p><div className="admin-skeleton" aria-hidden="true"><span /><span /><span /></div></div>}
        {!loading && !error && !id && <>
          <section className="admin-panel ombudsman__list">
            <header className="admin-panel__heading"><h2>Atendimentos e histórico</h2><p>Manifestações enviadas voluntariamente pelos respondentes</p></header>
            {!items.length ? <div className="admin-empty"><MessageSquare size={28} aria-hidden="true" /><strong>Nenhuma manifestação nesta página</strong><p>Os feedbacks encaminhados à ouvidoria aparecerão aqui.</p></div> :
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Código</th><th scope="col">Data / horário</th><th scope="col">Setor / turno</th><th scope="col">Feedback</th><th scope="col">Situação</th><th scope="col">Retorno</th><th scope="col">Telefone autorizado</th><th scope="col">Ação</th></tr></thead>
                <tbody>{items.map((row) => <tr key={row.id}>
                  <th scope="row" className="ombudsman__code">{row.code}</th>
                  <td className="ombudsman__nowrap">{row.visitDate.split('-').reverse().join('/')}<small>{row.visitTime?.slice(0, 5) ?? 'Horário não informado'}</small><small>Recebida: {date(row.createdAt)}</small></td>
                  <td>{row.sector}<small>{row.shift ?? 'Turno não definido'}</small></td>
                  <td className="ombudsman__excerpt"><strong className="ombudsman__type">{feedbackType(row.feedbackType)}</strong><p>{row.message}</p></td>
                  <td><CaseStatus item={row} /></td><td>{row.contactRequested ? 'Sim' : 'Não'}</td><td className="ombudsman__nowrap">{row.phone ?? '—'}</td>
                  <td className="ombudsman__nowrap"><Link to={`/admin/ouvidoria/${row.id}`} aria-label={`Ver detalhe do atendimento ${row.code}`}>Ver detalhe</Link></td>
                </tr>)}</tbody>
              </table></div>}
            <nav className="ombudsman__pagination" aria-label="Páginas dos atendimentos"><span>{items.length} {items.length === 1 ? 'manifestação' : 'manifestações'} nesta página</span><div><Button variant="quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span aria-current="page">{page}</span><Button variant="quiet" disabled={items.length < 50} onClick={() => setPage(page + 1)}>Próxima</Button></div></nav>
          </section>
          <div className="admin-callout"><LockKeyhole size={19} aria-hidden="true" /><p>Telefone protegido: o contato é exibido apenas para perfis autorizados e permanece mascarado na listagem.</p></div>
          <div className="ombudsman__guidance">
            <section className="admin-panel"><h2>Acompanhamento preservado</h2><p>As manifestações em aberto recebem contatos e providências. Após o encerramento, continuam disponíveis para consulta histórica.</p></section>
            <section className="admin-panel"><h2>Contato manual</h2><p>Cada tentativa é registrada com data, horário, resultado e responsável. Não há envio automático.</p></section>
          </div>
        </>}
        {!loading && item && <>
          <section className="admin-panel ombudsman__summary"><div><h2>{item.code}</h2><p>Recebida em {date(item.createdAt)}</p></div><CaseStatus item={item} /></section>
          <div className="ombudsman__columns">
            <div className="ombudsman__primary">
              <section className="admin-panel">
                <header className="admin-panel__heading"><h2>Dados da manifestação</h2></header>
                <dl className="ombudsman__details">
                  <div><dt>Setor</dt><dd>{item.sector}</dd></div><div><dt>Turno</dt><dd>{item.shift ?? 'Não definido'}</dd></div><div><dt>Tipo</dt><dd className="ombudsman__type">{feedbackType(item.feedbackType)}</dd></div>
                  <div><dt>Data do atendimento</dt><dd>{item.visitDate.split('-').reverse().join('/')}</dd></div><div><dt>Horário</dt><dd>{item.visitTime?.slice(0, 5) ?? 'Não informado'}</dd></div><div><dt>Retorno solicitado</dt><dd>{item.contactRequested ? 'Sim' : 'Não — anônimo'}</dd></div>
                </dl>
                <div className="ombudsman__message"><h3>Mensagem original</h3><p className="ombudsman__text">{item.message}</p></div>
                <div className="admin-callout ombudsman__contact"><LockKeyhole size={20} aria-hidden="true" /><div className="admin-callout__content"><p>Telefone protegido • {item.contactRequested ? 'Retorno solicitado' : 'Feedback anônimo'}</p><strong>{phone(item.phone)}</strong></div><span>Acesso autorizado</span></div>
              </section>
              {item.status === 'closed' && <div className="admin-callout admin-callout--success"><CheckCircle2 size={20} aria-hidden="true" /><p>Encerrado em {date(item.closedAt)} por {item.closedBy ?? 'Não informado'}. Este atendimento permanece disponível para consulta e não pode ser reaberto.</p></div>}
              {user.role === 'super_admin' && <div className="admin-callout"><ShieldCheck size={20} aria-hidden="true" /><p>Seu acesso permite consultar os atendimentos. Os registros são feitos pela ouvidoria.</p></div>}
              {canHandle && <>
                {item.contactRequested && <form className="admin-panel admin-form" onSubmit={(event) => { event.preventDefault(); save('attempts', { outcome, ...(outcome === 'answered' ? { wantsToContinue: interest === 'true' } : {}), notes }); }}>
                  <div className="ombudsman__section-title"><h2>Registrar tentativa de contato</h2><span className="badge badge-warning">{item.attempts.length} {item.attempts.length === 1 ? 'tentativa' : 'tentativas'}</span></div>
                  <div className="ombudsman__form-meta"><span>Responsável: <strong>{user.fullName}</strong></span><span>Data e horário registrados ao salvar</span></div>
                  <fieldset className="ombudsman__outcomes"><legend>Resultado do contato</legend>
                    <label className={outcome === 'answered' ? 'is-selected' : ''}><input type="radio" name="outcome" value="answered" checked={outcome === 'answered'} onChange={() => { setOutcome('answered'); setInterest(''); }} disabled={busy} />Atendeu</label>
                    <label className={outcome === 'no_answer' ? 'is-selected' : ''}><input type="radio" name="outcome" value="no_answer" checked={outcome === 'no_answer'} onChange={() => { setOutcome('no_answer'); setInterest(''); }} disabled={busy} />Não atendeu</label>
                  </fieldset>
                  {outcome === 'answered' && <label>Deseja continuar o atendimento?<select required value={interest} onChange={(event) => setInterest(event.target.value)} disabled={busy}><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select></label>}
                  <label>Registro da tentativa (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} disabled={busy} /></label>
                  <div className="admin-callout admin-callout--warning"><Clock3 size={19} aria-hidden="true" /><p>A terceira tentativa sem resposta, no total, encerra automaticamente como contato sem sucesso.</p></div>
                  <div className="admin-form__actions"><Button type="submit" icon={Phone} disabled={busy}>Salvar tentativa</Button></div>
                </form>}
                <form className="admin-panel admin-form" onSubmit={(event) => { event.preventDefault(); save('actions', { description }); }}>
                  <h2>Providências e andamento</h2>
                  <label>Descrição<textarea required maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} /></label>
                  <div className="admin-form__actions"><Button type="submit" variant="secondary" icon={ClipboardList} disabled={busy || !description.trim()}>Salvar registro</Button></div>
                </form>
                <section className="admin-panel admin-form"><h2>Encerrar atendimento</h2><p>Ao concluir as providências, encerre o atendimento como concluído. A escolha de não continuar fica registrada no histórico de contato.</p>
                  {confirmClose ? <div className="admin-form" role="group" aria-label="Confirmar encerramento"><div className="admin-callout admin-callout--warning"><TriangleAlert size={20} aria-hidden="true" /><p>Confirmar encerramento? Esta ação impede novos registros e a reabertura.</p></div><div className="admin-form__actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirmClose(false)}>Cancelar</Button><Button disabled={busy} onClick={() => save('close', {})}>Confirmar encerramento</Button></div></div>
                    : <div className="admin-form__actions"><Button disabled={busy} onClick={() => setConfirmClose(true)}>Encerrar como concluído</Button></div>}
                </section>
              </>}
            </div>
            <aside className="admin-panel ombudsman__history-panel" aria-label="Histórico do atendimento">
              <header className="admin-panel__heading"><h2>Histórico rastreável</h2><p>Data, horário, resultado e responsável</p></header>
              <ol className="ombudsman__history">
                <li className="ombudsman__event ombudsman__event--created"><time>{date(item.createdAt)}</time><h3>Manifestação recebida</h3><p>Pesquisa de satisfação — {item.sector}</p></li>
                {history.map((entry) => <li className="ombudsman__event" key={entry.id}><time>{date(entry.at)}</time><h3>{entry.kind === 'attempt' ? `Tentativa ${entry.attemptNumber}: ${entry.outcome === 'no_answer' ? 'sem resposta' : 'atendida'}` : 'Providência / andamento'}</h3><p>{entry.author}</p>{entry.outcome === 'answered' && <p>Deseja continuar o atendimento: {entry.wantsToContinue ? 'Sim' : 'Não'}.</p>}<p className="ombudsman__text">{entry.description ?? entry.notes}</p></li>)}
                {item.status === 'closed' && <li className="ombudsman__event ombudsman__event--closed"><time>{date(item.closedAt)}</time><h3>{status(item)}</h3><p>{item.closedBy ?? 'Responsável não informado'}</p></li>}
              </ol>
              {!history.length && <p className="ombudsman__history-empty">Ainda não há contatos ou providências registrados.</p>}
              <div className={`admin-callout ${item.status === 'closed' ? 'admin-callout--success' : 'admin-callout--warning'}`}><ShieldCheck size={19} aria-hidden="true" /><p>{item.status === 'closed' ? 'Histórico preservado. Atendimento encerrado sem possibilidade de reabertura.' : 'Cada contato e providência mantém a identificação do responsável. Registros anteriores não são apagados.'}</p></div>
            </aside>
          </div>
          <p className="ombudsman__footnote">Acesso ao contato condicionado à permissão. As tentativas são manuais; não há envio automático de mensagens.</p>
        </>}
      </>}
    </div>
  </AdminLayout>;
}

function CaseStatus({ item }) {
  const tone = item.status === 'open' ? 'warning' : item.closureReason === 'contact_failed' ? 'critical' : 'success';
  return <span className={`badge badge-${tone}`}>{status(item)}</span>;
}
