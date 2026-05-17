import React, { useEffect, useRef, useState } from 'react';
import { I18N, SUGGESTED_QUESTIONS } from '../../lib/i18n';
import { fakeAnswer } from './fakeAnswer';

export default function ChatbotDrawer({ caseData, lang }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const msgsRef = useRef(null);

  useEffect(() => { setMessages([]); setInput(''); setTyping(false); }, [caseData.id]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, typing]);

  const t = I18N[lang];
  const sugg = SUGGESTED_QUESTIONS[lang];

  const send = (text) => {
    const v = text.trim();
    if (!v) return;
    setMessages(m => [...m, { role: 'user', text: v }]);
    setInput('');
    setTyping(true);
    if (!expanded) setExpanded(true);
    setTimeout(() => {
      setMessages(m => [...m, { role: 'ai', text: fakeAnswer(v, caseData, lang) }]);
      setTyping(false);
    }, 900 + Math.random() * 600);
  };

  const root = caseData.nodes.find(n => n.id === caseData.rootId);
  const shortName = root.name.split(' ').slice(0, 2).join(' ');

  return (
    <div className={`chatbot ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="chatbot-head" onClick={() => setExpanded(e => !e)}>
        <div className="chatbot-head-l">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <div className="chatbot-title">
            {t.askProfile} <em>· {shortName}</em>
          </div>
        </div>
        <span className="chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </div>

      {expanded && (
        <div className="chatbot-body">
          <div className="chat-messages" ref={msgsRef}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
                {lang === 'es'
                  ? 'Hazle una pregunta a la IA sobre este perfil — analiza la red, los contratos y los vínculos.'
                  : 'Ask the AI a question about this profile — it analyzes the network, contracts and ties.'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role} slide-up`}>{m.text}</div>
            ))}
            {typing && <div className="msg ai typing slide-up">{lang === 'es' ? 'Analizando' : 'Analyzing'}</div>}
          </div>

          <div className="suggested-row">
            {sugg.map((q, i) => (
              <button key={i} className="suggested-chip" onClick={() => send(q)}>{q}</button>
            ))}
          </div>

          <form className="chat-input-row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t.askPlaceholder}
            />
            <button className="chat-send" type="submit" disabled={!input.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
