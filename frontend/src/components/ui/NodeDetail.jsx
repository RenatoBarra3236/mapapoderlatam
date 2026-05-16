import { useEffect, useState } from 'react';
import api from '../../services/api';

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const TYPE_CONFIG = {
  person:   { icon: '●', label: 'Persona',  color: 'text-purple-400' },
  company:  { icon: '■', label: 'Empresa',  color: 'text-teal-400' },
  contract: { icon: '◆', label: 'Contrato', color: 'text-orange-400' },
};

export default function NodeDetail({ node, onClose, onExpandNetwork }) {
  const [stats, setStats] = useState(null);
  const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.person;

  useEffect(() => {
    setStats(null);
    api.get(`/graph/${node.id}/stats`)
      .then(({ data }) => setStats(data))
      .catch(console.error);
  }, [node.id]);

  return (
    <aside className="w-72 flex flex-col bg-gray-900 border-l border-gray-800 overflow-y-auto shrink-0">

      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-800">
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
          <h2 className="text-sm font-semibold text-gray-100 mt-0.5 leading-tight">{node.name}</h2>
          {node.country && (
            <span className="text-xs text-gray-500 uppercase">{node.country}</span>
          )}
        </div>
        <button onClick={onClose} className="ml-2 text-gray-600 hover:text-gray-300 text-lg leading-none">×</button>
      </div>

      {/* Metadata */}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Información</p>
          <dl className="space-y-1">
            {Object.entries(node.metadata).map(([key, val]) => val && (
              <div key={key} className="flex gap-2">
                <dt className="text-xs text-gray-500 capitalize shrink-0 w-20 truncate">{key}:</dt>
                <dd className="text-xs text-gray-300 break-words">
                  {key === 'amount' ? CLP.format(val) : String(val)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Red de conexiones</p>
        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-2xl font-semibold text-gray-100">{stats.connections}</p>
              <p className="text-xs text-gray-500 mt-0.5">Conexiones totales</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-2xl font-semibold text-gray-100">{stats.contract_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">Contratos</p>
            </div>
            {stats.total_amount > 0 && (
              <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                <p className="text-lg font-semibold text-orange-400">{CLP.format(stats.total_amount)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Monto total en contratos</p>
              </div>
            )}
            <div className="bg-gray-800 rounded-lg p-3 col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Índice de riesgo</p>
                <span className={`text-sm font-semibold ${
                  stats.risk_score > 50 ? 'text-red-400' :
                  stats.risk_score > 20 ? 'text-orange-400' : 'text-green-400'
                }`}>
                  {stats.risk_score}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.risk_score > 50 ? 'bg-red-500' :
                    stats.risk_score > 20 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${Math.min(stats.risk_score, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600">Cargando estadísticas…</p>
        )}
      </div>

      {/* Acciones */}
      <div className="p-4 space-y-2">
        <button
          onClick={onExpandNetwork}
          className="w-full text-sm bg-purple-900 hover:bg-purple-800 text-purple-100 rounded-lg px-4 py-2 transition-colors"
        >
          Expandir red (3 grados)
        </button>
        <a
          href={`/api/graph/${node.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1"
        >
          Ver JSON del subgrafo ↗
        </a>
      </div>

    </aside>
  );
}
