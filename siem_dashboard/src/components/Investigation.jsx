/**
 * Investigation.jsx
 * SOC Investigation Workspace.
 * Shows all incidents with priority/tags/status.
 * Clicking an incident opens a full workspace with notes, alert list, and metadata editor.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { parseTs } from "../utils/time";
import { fetchIncidents, fetchIncidentDetail, updateIncident, addIncidentNote } from '../services/api';
import { C, SEV, card, pill, sectionTitle } from '../theme';

const PRIORITY_COLOR = {
  critical: '#E5484D',
  high:     '#F2780C',
  medium:   '#D99A00',
  low:      '#6A5BF5',
};

const STATUS_COLOR = {
  open:          { color: '#F2780C', bg: 'var(--org-bg)', border: 'var(--org-bd)' },
  investigating: { color: 'var(--amb-fg)', bg: 'var(--amb-bg)', border: 'var(--amb-bd)' },
  resolved:      { color: 'var(--grn-fg)', bg: 'var(--grn-bg)', border: 'var(--grn-bd)' },
};

function PriorityBadge({ priority }) {
  const color = PRIORITY_COLOR[priority] || C.t3;
  return (
    <span style={{ ...pill(color, `${color}20`, `${color}50`), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {priority || 'medium'}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_COLOR[status] || { color: C.t3, bg: C.bg2, border: C.b1 };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', fontSize: '10px', padding: '2px 10px',
      fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {status}
    </span>
  );
}

function TagChip({ tag, onRemove }) {
  return (
    <span style={{
      background: 'var(--ind-bg)', color: 'var(--ind-fg)', border: '1px solid var(--ind-bd)',
      borderRadius: '12px', fontSize: '10px', padding: '2px 10px',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      {tag}
      {onRemove && (
        <button onClick={() => onRemove(tag)} style={{
          background: 'none', border: 'none', color: 'var(--ind-fg)',
          cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '12px',
        }}>×</button>
      )}
    </span>
  );
}

/* ── Incident Workspace (right panel) ──────────────────────────────── */

function Workspace({ incident, onClose, onUpdated }) {
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [saving, setSaving]     = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Editable fields
  const [status,   setStatus]   = useState(incident.status);
  const [priority, setPriority] = useState(incident.priority || 'medium');
  const [tags,     setTags]     = useState((incident.tags || '').split(',').filter(Boolean));
  const [assignee, setAssignee] = useState(incident.assigned_to || 'SOC Analyst');

  const loadDetail = useCallback(() => {
    fetchIncidentDetail(incident.id)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [incident.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const save = async (patch) => {
    await updateIncident(incident.id, patch).catch(() => {});
    onUpdated();
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    await addIncidentNote(incident.id, { content: noteText, note_type: noteType }).catch(() => {});
    setNoteText('');
    setSaving(false);
    loadDetail();
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    const newTags = [...tags, t];
    setTags(newTags);
    setTagInput('');
    save({ tags: newTags.join(',') });
  };

  const handleRemoveTag = (t) => {
    const newTags = tags.filter(x => x !== t);
    setTags(newTags);
    save({ tags: newTags.join(',') });
  };

  const handleStatusChange = (s) => {
    setStatus(s);
    save({ status: s });
  };

  const handlePriorityChange = (p) => {
    setPriority(p);
    save({ priority: p });
  };

  const NOTE_TYPE_COLOR = { note: C.t3, action: '#6A5BF5', evidence: 'var(--amb-fg)', closure: 'var(--grn-fg)' };

  const inputStyle = {
    background: C.bg2, border: `1px solid ${C.b1}`,
    borderRadius: '6px', color: C.t1, fontSize: '11px',
    padding: '6px 10px', outline: 'none', width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--overlay)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '600px', maxWidth: '95vw', height: '100vh',
        background: C.bg1, borderLeft: `1px solid ${C.b1}`,
        overflowY: 'auto', padding: '24px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ ...sectionTitle, marginBottom: '4px' }}>Incident #{incident.id}</div>
            <h3 style={{ color: C.t1, margin: 0, fontSize: '16px', fontWeight: '700' }}>{incident.title}</h3>
          </div>
          <button onClick={onClose} style={{
            background: C.bg3, border: `1px solid ${C.b2}`, color: C.t2,
            width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px',
          }}>×</button>
        </div>

        {/* Status + Priority */}
        <div style={{ ...card({ padding: '14px', marginBottom: '14px' }) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ ...sectionTitle, marginBottom: '6px' }}>Status</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['open', 'investigating', 'resolved'].map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)} style={{
                    background: status === s ? (STATUS_COLOR[s]?.bg || C.bg2) : 'transparent',
                    color:      status === s ? (STATUS_COLOR[s]?.color || C.t2) : C.t3,
                    border: `1px solid ${status === s ? (STATUS_COLOR[s]?.border || C.b1) : C.b1}`,
                    borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: '700',
                    textTransform: 'uppercase',
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...sectionTitle, marginBottom: '6px' }}>Priority</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['low', 'medium', 'high', 'critical'].map(p => (
                  <button key={p} onClick={() => handlePriorityChange(p)} style={{
                    background: priority === p ? `${PRIORITY_COLOR[p]}20` : 'transparent',
                    color:      priority === p ? PRIORITY_COLOR[p] : C.t3,
                    border: `1px solid ${priority === p ? `${PRIORITY_COLOR[p]}50` : C.b1}`,
                    borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '10px', fontWeight: '700',
                    textTransform: 'uppercase',
                  }}>{p}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ ...sectionTitle, marginBottom: '6px' }}>Assigned To</div>
            <input
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              onBlur={() => save({ assigned_to: assignee })}
              style={{ ...inputStyle, width: '200px' }}
            />
          </div>

          {/* Tags */}
          <div>
            <div style={{ ...sectionTitle, marginBottom: '6px' }}>Tags</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {tags.map(t => <TagChip key={t} tag={t} onRemove={handleRemoveTag} />)}
              {tags.length === 0 && <span style={{ color: C.t3, fontSize: '11px' }}>No tags</span>}
            </div>
            <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '6px' }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Add tag…"
                style={{ ...inputStyle, width: '140px' }}
              />
              <button type="submit" style={{
                background: C.blue, color: '#fff', border: 'none',
                borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px',
              }}>Add</button>
            </form>
          </div>
        </div>

        {/* Linked alerts */}
        {detail?.alerts?.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ ...sectionTitle, marginBottom: '8px' }}>Linked Alerts ({detail.alerts.length})</div>
            {detail.alerts.map(a => {
              const sv = SEV[a.severity] || SEV.info;
              return (
                <div key={a.id} style={{
                  background: sv.bg, border: `1px solid ${sv.border}`, borderLeft: `3px solid ${sv.badge}`,
                  borderRadius: '6px', padding: '8px 12px', marginBottom: '6px', fontSize: '11px',
                }}>
                  <span style={{ color: sv.text, fontWeight: '700', marginRight: '8px' }}>
                    {a.alert_type?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span style={{ color: C.t2 }}>{a.description}</span>
                  {a.source_ip && <span style={{ color: C.t3, marginLeft: '8px' }}>· {a.source_ip}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Investigation notes */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ ...sectionTitle, marginBottom: '8px' }}>
            Investigation Notes ({detail?.notes?.length || 0})
          </div>

          {loading && <div style={{ color: C.t3, fontSize: '12px', padding: '12px' }}>Loading notes…</div>}

          {detail?.notes?.map(note => (
            <div key={note.id} style={{
              ...card({ padding: '10px 14px', marginBottom: '8px' }),
              borderLeft: `3px solid ${NOTE_TYPE_COLOR[note.note_type] || C.b2}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', flexWrap: 'wrap', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: NOTE_TYPE_COLOR[note.note_type] || C.t3, fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {note.note_type}
                  </span>
                  <span style={{ color: C.t2, fontSize: '11px', fontWeight: '600' }}>{note.author}</span>
                </div>
                <span style={{ color: C.t3, fontSize: '10px' }}>
                  {parseTs(note.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ color: C.t1, fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {note.content}
              </div>
            </div>
          ))}

          {/* Add note form */}
          <form onSubmit={handleAddNote} style={{ ...card({ padding: '14px' }), marginTop: '10px' }}>
            <div style={{ ...sectionTitle, marginBottom: '8px' }}>Add Note</div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Document your findings, actions taken, or evidence…"
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical', lineHeight: '1.5',
                fontFamily: 'inherit', marginBottom: '10px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={noteType}
                onChange={e => setNoteType(e.target.value)}
                style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
              >
                <option value="note">Observation</option>
                <option value="action">Action Taken</option>
                <option value="evidence">Evidence</option>
                <option value="closure">Closure</option>
              </select>
              <button type="submit" disabled={saving || !noteText.trim()} style={{
                background: C.blue, color: '#fff', border: 'none',
                borderRadius: '6px', padding: '7px 18px', cursor: 'pointer',
                fontSize: '11px', fontWeight: '700',
                opacity: saving || !noteText.trim() ? 0.5 : 1,
              }}>
                {saving ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */

export default function Investigation() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [tagFilter, setTagFilter] = useState('');
  const [statusFilter, setStatusF] = useState('');

  const load = useCallback(() => {
    fetchIncidents()
      .then(data => { setIncidents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const allTags = [...new Set(incidents.flatMap(inc => (inc.tags || '').split(',').filter(Boolean)))];

  const filtered = incidents.filter(inc => {
    if (statusFilter && inc.status !== statusFilter) return false;
    if (tagFilter) {
      const incTags = (inc.tags || '').split(',').map(t => t.trim());
      if (!incTags.includes(tagFilter)) return false;
    }
    return true;
  });

  return (
    <div style={{ padding: '20px' }}>
      {selected && (
        <Workspace
          incident={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ color: C.t1, margin: 0, fontSize: '18px', fontWeight: '700' }}>Investigations</h2>
          <span style={{
            background: C.bg3, color: C.t2, border: `1px solid ${C.b2}`,
            borderRadius: '20px', fontSize: '11px', padding: '2px 10px', fontWeight: '600',
          }}>{filtered.length}</span>
        </div>
        <button onClick={load} style={{
          background: C.bg2, color: C.t2, border: `1px solid ${C.b1}`,
          borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '11px',
        }}>Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['', 'open', 'investigating', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusF(s)} style={{
              background: statusFilter === s ? C.blue : C.bg2,
              color:      statusFilter === s ? '#fff' : C.t2,
              border: `1px solid ${statusFilter === s ? C.blue : C.b1}`,
              borderRadius: '20px', padding: '3px 12px', cursor: 'pointer',
              fontSize: '11px', fontWeight: '600',
            }}>{s || 'All'}</button>
          ))}
        </div>

        {allTags.length > 0 && (
          <>
            <div style={{ width: '1px', height: '20px', background: C.b1 }} />
            <div style={{ color: C.t3, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tags:</div>
            {allTags.map(t => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? '' : t)} style={{
                background: tagFilter === t ? 'var(--ind-bg)' : 'transparent',
                color:      tagFilter === t ? 'var(--ind-fg)' : C.t3,
                border: `1px solid ${tagFilter === t ? 'var(--ind-bd)' : C.b1}`,
                borderRadius: '20px', padding: '2px 10px', cursor: 'pointer', fontSize: '10px',
              }}>{t}</button>
            ))}
          </>
        )}
      </div>

      {loading ? (
        <div style={{ color: C.t3, textAlign: 'center', padding: '40px' }}>Loading incidents…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card({ padding: '40px', textAlign: 'center' }), color: C.t3, fontSize: '13px' }}>
          No incidents found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(inc => {
            const tags = (inc.tags || '').split(',').filter(Boolean);
            return (
              <div
                key={inc.id}
                onClick={() => setSelected(inc)}
                style={{
                  ...card({ padding: '14px 16px' }),
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  borderLeft: `3px solid ${PRIORITY_COLOR[inc.priority] || C.b2}`,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
                onMouseLeave={e => e.currentTarget.style.borderColor = PRIORITY_COLOR[inc.priority] || C.b2}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: C.t3, fontSize: '10px' }}>#{inc.id}</span>
                    <span style={{ color: C.t1, fontWeight: '700', fontSize: '13px' }}>{inc.title}</span>
                    <StatusBadge status={inc.status} />
                    <PriorityBadge priority={inc.priority} />
                  </div>
                  <span style={{ color: C.t3, fontSize: '10px', flexShrink: 0 }}>
                    {parseTs(inc.created_at).toLocaleString()}
                  </span>
                </div>

                {inc.description && (
                  <div style={{ color: C.t2, fontSize: '12px', marginBottom: '8px', lineHeight: '1.4' }}>
                    {inc.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {tags.map(t => <TagChip key={t} tag={t} />)}
                  <span style={{ color: C.t3, fontSize: '10px', marginLeft: '4px' }}>
                    Assigned: {inc.assigned_to || 'SOC Analyst'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
