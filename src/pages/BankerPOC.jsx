import { useState, useMemo, useEffect } from 'react'
import { initiateLogin, handleCallback, isAuthenticated, logout } from '../utils/auth'
import { fetchOpportunities, createTask } from '../utils/salesforce'
import './BankerPOC.css'

// ─── Helpers ───────────────────────────────────────────────
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const maxDate = (...dates) => {
  const valid = dates.filter(Boolean)
  if (!valid.length) return null
  return valid.reduce((a, b) => (a > b ? a : b))
}

const getDiffDays = (dateStr) => {
  if (!dateStr) return 999
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d = parseLocalDate(dateStr)
  return Math.floor((now - d) / 86400000)
}

const getLastContactType = (opp) => {
  if (opp.lastContactType) return opp.lastContactType
  const candidates = [
    { type: 'Email', date: opp.lastEmailDate },
    { type: 'Text',  date: opp.lastTextDate  },
    { type: 'Call',  date: opp.lastCallDate  },
  ].filter(c => c.date)
  if (!candidates.length) return '—'
  return candidates.reduce((a, b) => (a.date > b.date ? a : b)).type
}

const getGroup = (opp) => {
  const lcd  = maxDate(opp.lastEmailDate, opp.lastTextDate, opp.lastCallDate)
  const diff = getDiffDays(lcd)
  if (diff === 0)  return 'today'
  if (diff <= 7)   return 'week'
  if (diff <= 30)  return 'month'
  return 'older'
}

const sortOppList = (list, sortConfig) => {
  if (!sortConfig.field) return list
  return [...list].sort((a, b) => {
    let aVal, bVal
    if (sortConfig.field === 'name') {
      aVal = a.accountName.toLowerCase()
      bVal = b.accountName.toLowerCase()
    } else if (sortConfig.field === 'stage') {
      aVal = a.stage.toLowerCase()
      bVal = b.stage.toLowerCase()
    } else if (sortConfig.field === 'lastContact') {
      aVal = getDiffDays(maxDate(a.lastEmailDate, a.lastTextDate, a.lastCallDate))
      bVal = getDiffDays(maxDate(b.lastEmailDate, b.lastTextDate, b.lastCallDate))
    } else if (sortConfig.field === 'lastContactType') {
      aVal = getLastContactType(a).toLowerCase()
      bVal = getLastContactType(b).toLowerCase()
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })
}

// ─── Group Config ──────────────────────────────────────────
const GROUP_CONFIG = {
  today: { label: 'Contacted Today',            color: '#22c55e' },
  week:  { label: 'Contacted Within Last Week', color: '#3b82f6' },
  month: { label: 'Contacted Within 30 Days',   color: '#f59e0b' },
  older: { label: 'Contacted 30+ Days Ago',     color: '#ef4444' },
}

// ─── Table Row ─────────────────────────────────────────────
function OppRow({ opp, flash, onContact }) {
  const lcd         = maxDate(opp.lastEmailDate, opp.lastTextDate, opp.lastCallDate)
  const diff        = getDiffDays(lcd)
  const contactType = getLastContactType(opp)
  const dayLabel    = diff === 0 ? 'Today' : diff === 1 ? '1 day ago' : `${diff} days ago`
  const typeClass   = contactType !== '—' ? `contact-type-${contactType.toLowerCase()}` : 'contact-type-none'

  return (
    <tr className="opp-row">
      <td className="col-name">{opp.accountName}</td>
      <td className="col-stage"><span className="stage-badge">{opp.stage}</span></td>
      <td className="col-last-contact">{dayLabel}</td>
      <td className={`col-contact-type ${typeClass}`}>{contactType}</td>
      <td className="col-actions">
        <div className="actions-wrap">
          {['Email', 'Text', 'Call'].map(type => (
            <button
              key={type}
              className={`action-btn action-btn-${type.toLowerCase()}${flash === type ? ' action-btn-flash' : ''}`}
              onClick={() => onContact(opp.id, type)}
            >
              {flash === type ? '✓' : type}
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── Group Table ───────────────────────────────────────────
function GroupTable({ groupKey, opps, onContact, flashMap }) {
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' })
  const config = GROUP_CONFIG[groupKey]

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const SortIcon = ({ field }) => (
    <span className={`sort-icon${sortConfig.field === field ? ' sort-icon-active' : ''}`}>
      {sortConfig.field === field ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
    </span>
  )

  return (
    <section className="group-section">
      <div className="group-header" style={{ borderColor: config.color }}>
        <span className="group-title" style={{ color: config.color }}>{config.label}</span>
        <span className="group-count" style={{ background: config.color }}>{opps.length}</span>
      </div>
      <table className="pipeline-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')}>Name<SortIcon field="name" /></th>
            <th onClick={() => handleSort('stage')}>Stage<SortIcon field="stage" /></th>
            <th onClick={() => handleSort('lastContact')}>Last Contact<SortIcon field="lastContact" /></th>
            <th onClick={() => handleSort('lastContactType')}>Last Contact Type<SortIcon field="lastContactType" /></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortOppList(opps, sortConfig).map(opp => (
            <OppRow
              key={opp.id}
              opp={opp}
              flash={flashMap[opp.id]}
              onContact={onContact}
            />
          ))}
        </tbody>
      </table>
    </section>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function BankerPOC() {
  const [opps, setOpps]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [authed, setAuthed]     = useState(isAuthenticated())
  const [flashMap, setFlashMap] = useState({})

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')

      if (code) {
        try {
          await handleCallback(code)
          window.history.replaceState({}, '', '/BankerPOC')
          setAuthed(true)
        } catch (e) {
          setError(`Login failed: ${e.message}`)
          setLoading(false)
          return
        }
      }

      if (isAuthenticated()) {
        try {
          const data = await fetchOpportunities()
          setOpps(data)
        } catch (e) {
          setError('Failed to load opportunities. Your session may have expired.')
        }
      }

      setLoading(false)
    }

    init()
  }, [])

  const handleContact = async (id, type) => {
    const t = todayStr()
    setFlashMap(prev => ({ ...prev, [id]: type }))
    setTimeout(() => setFlashMap(prev => { const n = { ...prev }; delete n[id]; return n }), 1500)
    setOpps(prev => prev.map(opp => {
      if (opp.id !== id) return opp
      return {
        ...opp,
        lastEmailDate:   type === 'Email' ? t : opp.lastEmailDate,
        lastTextDate:    type === 'Text'  ? t : opp.lastTextDate,
        lastCallDate:    type === 'Call'  ? t : opp.lastCallDate,
        lastContactType: type,
      }
    }))
    try {
      await createTask(id, type, t)
    } catch (e) {
      console.error('Failed to update Salesforce:', e)
    }
  }

  const grouped = useMemo(() => {
    const groups = { today: [], week: [], month: [], older: [] }
    opps.forEach(opp => groups[getGroup(opp)].push(opp))
    return groups
  }, [opps])

  if (loading) return (
    <div className="banker-poc">
      <div className="poc-state"><p>Loading...</p></div>
    </div>
  )

  if (error) return (
    <div className="banker-poc">
      <div className="poc-state">
        <p className="error-msg">{error}</p>
        <button className="login-btn" onClick={initiateLogin}>Try Again</button>
      </div>
    </div>
  )

  if (!authed) return (
    <div className="banker-poc">
      <div className="poc-state">
        <h1>Banker POC</h1>
        <p>Connect your Salesforce org to get started.</p>
        <button className="login-btn" onClick={initiateLogin}>Login with Salesforce</button>
      </div>
    </div>
  )

  return (
    <div className="banker-poc">
      <header className="poc-header">
        <div>
          <h1 className="poc-greeting">Hello, <span>Banker</span></h1>
          <p className="poc-subtitle">Your pipeline at a glance</p>
        </div>
        <button className="logout-btn" onClick={() => { logout(); setAuthed(false) }}>
          Logout
        </button>
      </header>
      <main className="poc-main">
        {['older', 'month', 'week', 'today'].map(key =>
          grouped[key].length > 0 && (
            <GroupTable
              key={key}
              groupKey={key}
              opps={grouped[key]}
              onContact={handleContact}
              flashMap={flashMap}
            />
          )
        )}
      </main>
    </div>
  )
}
