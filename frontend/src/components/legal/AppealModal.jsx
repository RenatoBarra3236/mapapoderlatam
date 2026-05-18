import React, { useEffect, useState } from 'react';
import { postAppeal } from '../../services/api';

const STRINGS = {
  es: {
    title: 'Solicitar revisión / apelación',
    intro: 'Si usted es la persona, empresa o representante legal mencionado en este perfil, puede ejercer aquí sus derechos bajo la normativa de protección de datos personales del país correspondiente (en Chile, Ley 21.719).',
    requestType: 'Tipo de solicitud',
    types: {
      human_review: 'Revisión humana del análisis automatizado',
      access: 'Acceso (qué datos se tratan)',
      rectification: 'Rectificación (corregir información inexacta)',
      cancellation: 'Cancelación (eliminar mis datos)',
      opposition: 'Oposición al tratamiento',
      blocking: 'Bloqueo temporal',
      portability: 'Portabilidad de mis datos',
    },
    relation: 'Su relación con este perfil',
    relations: {
      subject: 'Soy la persona o empresa mencionada',
      legal_rep: 'Soy representante legal',
      affected_company: 'Mi empresa figura en el caso',
      other: 'Otro vínculo',
    },
    name: 'Nombre o razón social',
    namePh: 'Su nombre completo o nombre de la entidad',
    contact: 'Correo de contacto',
    contactPh: 'correo@ejemplo.cl',
    description: 'Motivo de la solicitud',
    descriptionPh: 'Explique brevemente qué información considera incorrecta, qué derecho ejerce o qué solicita...',
    submit: 'Enviar solicitud',
    submitting: 'Enviando…',
    cancel: 'Cancelar',
    successTitle: 'Solicitud recibida',
    successBody: 'Hemos registrado su solicitud. Le responderemos al correo indicado dentro del plazo legal aplicable (hasta 30 días corridos en Chile).',
    ticket: 'Folio',
    close: 'Cerrar',
    errorPrefix: 'No se pudo enviar la solicitud:',
    legalNote: 'Al enviar declara actuar de buena fe. Los datos del formulario se usarán exclusivamente para tramitar esta solicitud y se conservarán por el plazo que exija la normativa.',
  },
  en: {
    title: 'Request review / appeal',
    intro: 'If you are the person, company, or legal representative named in this profile, you can exercise your data-protection rights here under the applicable national law (in Chile, Ley 21.719).',
    requestType: 'Request type',
    types: {
      human_review: 'Human review of the automated analysis',
      access: 'Access (what data is processed)',
      rectification: 'Rectification (correct inaccurate info)',
      cancellation: 'Cancellation (delete my data)',
      opposition: 'Opposition to processing',
      blocking: 'Temporary block',
      portability: 'Portability of my data',
    },
    relation: 'Your relation to this profile',
    relations: {
      subject: 'I am the person or company named',
      legal_rep: 'I am a legal representative',
      affected_company: 'My company appears in this case',
      other: 'Other link',
    },
    name: 'Name or legal entity',
    namePh: 'Your full name or entity name',
    contact: 'Contact email',
    contactPh: 'email@example.com',
    description: 'Reason for the request',
    descriptionPh: 'Briefly explain what information you consider inaccurate, which right you are exercising, or what you request...',
    submit: 'Submit request',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    successTitle: 'Request received',
    successBody: 'We have logged your request and will respond to the provided email within the applicable legal window (up to 30 calendar days in Chile).',
    ticket: 'Ticket',
    close: 'Close',
    errorPrefix: 'Could not submit the request:',
    legalNote: 'By submitting you declare to act in good faith. Form data will be used solely to handle this request and retained as required by law.',
  },
};

const TYPE_ORDER = ['human_review', 'access', 'rectification', 'cancellation', 'opposition', 'blocking', 'portability'];
const RELATION_ORDER = ['subject', 'legal_rep', 'affected_company', 'other'];

export default function AppealModal({ open, onClose, caseData, lang }) {
  const s = STRINGS[lang] || STRINGS.es;
  const [requestType, setRequestType] = useState('human_review');
  const [relation, setRelation] = useState('subject');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRequestType('human_review');
    setRelation('subject');
    setName('');
    setContact('');
    setDescription('');
    setSubmitting(false);
    setResult(null);
    setError(null);
  }, [open, caseData?.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = !submitting && name.trim() && contact.trim() && description.trim();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await postAppeal(caseData.id, {
        request_type: requestType,
        relation,
        name: name.trim(),
        contact: contact.trim(),
        description: description.trim(),
        lang,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  const rootName = caseData?.nodes?.find(n => n.id === caseData.rootId)?.name || caseData?.id;

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div
        className="legal-modal appeal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appeal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="legal-head">
          <h2 id="appeal-title">{s.title}</h2>
          <button className="legal-close" onClick={onClose} aria-label={s.close}>✕</button>
        </div>

        {result ? (
          <div className="legal-body">
            <section className="legal-section">
              <h3>{s.successTitle}</h3>
              <p>{s.successBody}</p>
              <div className="appeal-ticket">
                <span className="appeal-ticket-label">{s.ticket}</span>
                <code className="appeal-ticket-id">{result.ticket_id}</code>
              </div>
            </section>
            <div className="appeal-actions">
              <button type="button" className="appeal-submit" onClick={onClose}>{s.close}</button>
            </div>
          </div>
        ) : (
          <form className="legal-body appeal-form" onSubmit={handleSubmit}>
            <p className="appeal-intro">
              {s.intro}
              <br />
              <strong>{lang === 'es' ? 'Perfil: ' : 'Profile: '}</strong>
              <em>{rootName}</em>
            </p>

            <label className="appeal-field">
              <span className="appeal-label">{s.requestType}</span>
              <select
                className="appeal-input"
                value={requestType}
                onChange={e => setRequestType(e.target.value)}
              >
                {TYPE_ORDER.map(k => (
                  <option key={k} value={k}>{s.types[k]}</option>
                ))}
              </select>
            </label>

            <label className="appeal-field">
              <span className="appeal-label">{s.relation}</span>
              <select
                className="appeal-input"
                value={relation}
                onChange={e => setRelation(e.target.value)}
              >
                {RELATION_ORDER.map(k => (
                  <option key={k} value={k}>{s.relations[k]}</option>
                ))}
              </select>
            </label>

            <label className="appeal-field">
              <span className="appeal-label">{s.name}</span>
              <input
                className="appeal-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={s.namePh}
                maxLength={200}
                required
              />
            </label>

            <label className="appeal-field">
              <span className="appeal-label">{s.contact}</span>
              <input
                className="appeal-input"
                type="email"
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder={s.contactPh}
                maxLength={200}
                required
              />
            </label>

            <label className="appeal-field">
              <span className="appeal-label">{s.description}</span>
              <textarea
                className="appeal-input appeal-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={s.descriptionPh}
                maxLength={4000}
                rows={5}
                required
              />
            </label>

            <p className="appeal-note">{s.legalNote}</p>

            {error && <p className="appeal-error">{s.errorPrefix} {error}</p>}

            <div className="appeal-actions">
              <button type="button" className="appeal-cancel" onClick={onClose} disabled={submitting}>
                {s.cancel}
              </button>
              <button type="submit" className="appeal-submit" disabled={!canSubmit}>
                {submitting ? s.submitting : s.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
