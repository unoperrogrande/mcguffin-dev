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

// ─── Card Component ────────────────────────────────────────
function OppCard({ opp, onContact }) {
  const [flash, setFlash] = useState(null)
  const lcd         = maxDate(opp.lastEmailDate, opp.lastTextDate, opp.lastCallDate)
  const diff        = getDiffDays(lcd)
  const contactType = getLastContactType(opp)
  const dayLabel    = diff === 0 ? 'Today' : diff === 1 ? '1 day ago' : `${diff} days ago`

  const handleBtn = (type) => {
    setFlash(type)
    setTimeout(() => setFlash(null), 1500)
    onContact(opp.id, type)
  }

  return (
    <div className="opp-card">
      <div className="opp-card-header">
        <h3 className="opp-account">{opp.accountName}</h3>
        <span className="opp-stage">{opp.stage}</span>
      </div>
      <div className="opp-meta">
        <div className="opp-meta-item">
          <span className="meta-label">Last Contact</span>
          <span className="meta-value">{dayLabel}</span>
        </div>
        <div className="opp-meta-item">
          <span className="meta-label">Last Contact Type</span>
          <span className={`meta-value contact-type contact-type-${contactType.toLowerCase()}`}>
            {contactType}
          </span>
        </div>
      </div>
      <div className="opp-actions">
        {['Email', 'Text', 'Call'].map(type => (
          <button
            key={type}
            className={`action-btn action-btn-${type.toLowerCase()} ${flash === type ? 'action-btn-flash' : ''}`}
            onClick={() => handleBtn(type)}
          >
            {flash === type ? '✓' : type}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Group Section ─────────────────────────────────────────
const GROUP_CONFIG = {
  today: { label: 'Contacted Today',            color: '#22c55e' },
  week:  { label: 'Contacted Within Last Week', color: '#3b82f6' },
  month: { label: 'Contacted Within 30 Days',   color: '#f59e0b' },
  older: { label: 'Contacted 30+ Days Ago',     color: '#ef4444' },
}

function GroupSection({ groupKey, opps, onContact }) {
  const config = GROUP_CONFIG[groupKey]
  if (!opps.length) return null
  return (
    <section className="group-section">
      <div className="group-header" style={{ borderColor: config.color }}>
        <h2 className="group-title" style={{ color: config.color }}>{config.label}</h2>
        <span className="group-count" style={{ background: config.color }}>{opps.length}</span>
      </div>
      <div className="group-cards">
        {opps.map(opp => (
          <OppCard key={opp.id} opp={opp} onContact={onContact} />
        ))}
      </div>
    </section>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function BankerPOC() {
  const [opps, setOpps]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [authed, setAuthed]   = useState(isAuthenticated())

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
    setOpps(prev => prev.map(opp => {
      if (opp.id !== id) return opp
      return {
        ...opp,
        lastEmailDate: type === 'Email' ? t : opp.lastEmailDate,
        lastTextDate:  type === 'Text'  ? t : opp.lastTextDate,
        lastCallDate:  type === 'Call'  ? t : opp.lastCallDate,
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
      <div className="poc-state">
        <p>Loading...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="banker-poc">
      <div className="poc-state">
        <p className="error-msg">{error}</p>
        <button className="login-btn" onClick={initiateLogin}>
          Try Again
        </button>
      </div>
    </div>
  )

  if (!authed) return (
    <div className="banker-poc">
      <div className="poc-state">
        <h1>Banker POC</h1>
        <p>Connect your Salesforce org to get started.</p>
        <button className="login-btn" onClick={initiateLogin}>
          Login with Salesforce
        </button>
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
        {['today', 'week', 'month', 'older'].map(key => (
          <GroupSection
            key={key}
            groupKey={key}
            opps={grouped[key]}
            onContact={handleContact}
          />
        ))}
      </main>
    </div>
  )
}