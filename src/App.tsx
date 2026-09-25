import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  Download,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Scale,
  Sun,
} from 'lucide-react'
import {
  calculateModel,
  createScenario,
  DEFAULT_INPUTS,
  type ModelInputs,
  type Scenario,
} from './model'
import { ControlDrawer } from './ControlDrawer'
import { Dashboard } from './views'
import { PrintReport } from './PrintReport'
import './dashboard.css'

const STORAGE_KEY = 'reltio-roi-address-enricher-model-v1'
const THEME_STORAGE_KEY = 'reltio-roi-theme'

type Theme = 'light' | 'dark'

function initialTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Fall back to the OS-level prefers-color-scheme media query.
  }
  return null
}

function resolveTheme(theme: Theme | null): Theme {
  if (theme) return theme
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'light'
}

function initialModel(): Scenario {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Scenario
      if (parsed?.inputs) {
        return { ...parsed, inputs: { ...DEFAULT_INPUTS, ...parsed.inputs } }
      }
    }
  } catch {
    // Use benchmark defaults if local storage is unavailable.
  }
  return createScenario('Address Enricher')
}

function App() {
  const [scenario, setScenario] = useState<Scenario>(initialModel)
  // Open by default: the sidebar is the only place any input lives.
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [theme, setTheme] = useState<Theme | null>(initialTheme)
  const resolvedTheme = resolveTheme(theme)

  const result = useMemo(
    () => calculateModel(scenario.inputs),
    [scenario.inputs],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario))
  }, [scenario])

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  const toggleTheme = () => {
    const next: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // The toggle still applies for this session even if storage is unavailable.
    }
  }

  const updateInput = <K extends keyof ModelInputs>(
    key: K,
    value: ModelInputs[K],
  ) => {
    setScenario((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      inputs: { ...current.inputs, [key]: value },
    }))
  }

  const resetScenario = () => {
    setScenario((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      inputs: { ...DEFAULT_INPUTS },
    }))
  }

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-is-open' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <ControlDrawer
          scenario={scenario}
          result={result}
          onInput={updateInput}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="icon-button inspector-toggle"
            onClick={() => setSidebarOpen((current) => !current)}
            title="Toggle sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>
          <div className="brand">
            <div className="brand-mark">
              <Scale size={20} />
            </div>
            <div>
              <strong>Reltio Value Studio</strong>
              <span>Autonomous Agents</span>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="agent-control">
              <span>Agent</span>
              <div className="select-wrap">
                <select
                  value="aea2"
                  aria-label="Agent"
                  onChange={() => undefined}
                >
                  <option value="aea2">Address Enricher</option>
                </select>
                <ChevronDown size={15} />
              </div>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              title={
                resolvedTheme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              {resolvedTheme === 'dark' ? (
                <Sun size={17} strokeWidth={1.8} />
              ) : (
                <Moon size={17} strokeWidth={1.8} />
              )}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={resetScenario}
              title="Reset model"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => window.print()}
            >
              <Download size={16} />
              Report
            </button>
          </div>
        </header>

        <main className="content">
          <Dashboard result={result} inputs={scenario.inputs} />
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="inspector-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <div className="mobile-model-button">
        <button type="button" onClick={() => setSidebarOpen(true)}>
          <Activity size={17} />
          Model inputs
        </button>
      </div>
      <PrintReport scenario={scenario} result={result} />
    </div>
  )
}

export default App
