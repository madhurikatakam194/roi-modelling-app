import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  Info,
  RotateCcw,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatNumber } from './model'

const FIELD_HELP: Record<string, string> = {
  'Starting backlog':
    'Existing address records waiting to be verified or enriched when the model begins.',
  'New records per month':
    'New records entering the workload each month, expressed as a percentage of the starting backlog.',
  'Records per run':
    'Maximum records planned for each AgentFlow job. Together with frequency, this sets scheduled capacity.',
  'Run frequency':
    'How often AgentFlow runs the configured number of records. This determines annual scheduled capacity. Choose "Not set" to remove the schedule entirely, so runs start back to back and the agent is limited only by its own processing speed.',
  'Runs per year':
    'Number of processing jobs expected each year when the run frequency is on demand.',
  'Manual minutes / record':
    'Average steward time to research, validate, and correct one address without AgentFlow.',
  'Fully loaded labor':
    'Hourly employee cost including wages and employer benefits, not salary alone.',
  'Charges / record':
    'The list price this option quotes per record. It is only part of what the option actually costs you.',
  'Data stewards':
    'Number of people available to process the address workload manually.',
  'Decision correctness':
    'Percentage of cases where the agent correctly decides whether to enrich or not enrich a record.',
  'Auto-finalized':
    'Percentage of processed records completed without human review.',
  'Review minutes / record':
    'Average human time required to review each record not finalized automatically.',
  'Incorrect enrichment':
    'Share of incorrect decisions where the agent applied an enrichment that should not have been applied.',
  'Incorrect no-enrich':
    'Share of incorrect decisions where the agent left a record unchanged when enrichment was needed.',
  'Technical failure':
    'Share of unsuccessful outcomes caused by a technical processing failure rather than decision quality.',
  Workers:
    'Parallel processing workers used by the agent. More workers can improve throughput with diminishing returns.',
  'Agent minutes / record':
    'Worker-minutes the agent spends on one record. Workers run in parallel, so a run takes this divided by the worker count — 20,000 records at 5.2 min on 150 workers is 11.6 hours.',
  'Team utilization':
    'Percentage of each steward’s workday realistically available for address processing.',
  'Productivity realized':
    'Share of released steward time converted into measurable organizational value.',
  'Modeled horizon':
    'Number of years included in the cash-flow, NPV, and payback calculation.',
  'Rework minutes / record':
    'Average time to undo and redo one record that was auto-finalized with an enrichment that should not have been applied. Records wrongly left unenriched are charged the manual minutes rate instead, since fixing them is simply doing the job by hand.',
  'Price / record':
    'Negotiated AgentFlow price used only on this comparison. It does not change ROI on the other views.',
  'Delay value / record / month':
    'Optional value lost for each record that remains unresolved for another month.',
  'Value / correct result':
    'Optional downstream business value attributed to each correctly processed address.',
}

export type CalculationDetail = {
  formula: string
  description: string
  steps: Array<{
    label: string
    formula: string
    value: string
    note?: string
    /**
     * Intermediate figures the step's own formula refers to by name. Nested
     * rather than numbered, so the step count stays the count of real stages.
     */
    parts?: Array<{
      label: string
      formula?: string
      value: string
      note?: string
    }>
  }>
  result: string
}

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      <Info size={13} strokeWidth={1.8} />
      <span role="tooltip">{text}</span>
    </span>
  )
}

export function TooltipContent({
  active,
  payload,
  label,
  formatValue = (value: number) => formatCurrency(value, true),
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  formatValue?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((item) => (
        <div className="chart-tooltip-row" key={item.name}>
          <span className="legend-dot" style={{ background: item.color }} />
          <span>{item.name}</span>
          <strong>{formatValue(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function AnimatedValue({
  value,
  className = '',
}: {
  value: string
  className?: string
}) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        className={className}
        initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}

function CalculationModal({
  label,
  calculation,
  onClose,
}: {
  label: string
  calculation: CalculationDetail
  onClose: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // Closes on a click anywhere in the page — without swallowing it, so it
    // still reaches whatever it landed on — except the model-inputs sidebar,
    // since sliders there are meant to be worked while this stays open.
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element
      if (cardRef.current?.contains(target)) return
      if (target.closest?.('.sidebar')) return
      onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('mousedown', closeOnOutsideClick)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      className="calc-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${label} calculation`}
        className="calc-modal"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <div>
            <span className="eyebrow">CALCULATION BREAKDOWN</span>
            <h2>{label}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close calculation details"
          >
            <X size={18} />
          </button>
        </header>
        <div className="calc-formula">
          <span>Formula</span>
          <strong>{calculation.formula}</strong>
          <p>{calculation.description}</p>
        </div>
        <div className="calc-steps">
          {calculation.steps.map((step, index) => (
            <div className="calc-step" key={`${step.label}-${index}`}>
              <span className="calc-step-number">{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <code>{step.formula}</code>
                {step.note && <p>{step.note}</p>}
                {step.parts && (
                  <ul className="calc-step-parts">
                    {step.parts.map((part) => (
                      <li key={part.label}>
                        {part.formula ? `${part.formula} = ` : ''}
                        <strong>{part.value}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="calc-step-value">{step.value}</span>
            </div>
          ))}
        </div>
        <footer>
          <span>Calculated result</span>
          <strong>{calculation.result}</strong>
        </footer>
      </motion.section>
    </motion.div>,
    document.body,
  )
}

/**
 * The info affordance that opens a full calculation breakdown. Anywhere a
 * figure can be shown, this is how the arithmetic behind it is reached.
 */
export function CalcReveal({
  label,
  calculation,
  className = 'metric-info',
  size = 16,
}: {
  label: string
  calculation: CalculationDetail
  className?: string
  size?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`How ${label} is calculated`}
        title={`How ${label} is calculated`}
      >
        <Info size={size} strokeWidth={1.8} />
      </button>
      <AnimatePresence>
        {open && (
          <CalculationModal
            label={label}
            calculation={calculation}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export function MetricCard({
  label,
  value,
  sub,
  note,
  icon: Icon = TrendingUp,
  tone = 'default',
  calculation,
}: {
  label: string
  value: string
  /** A second, quieter figure under the headline one. */
  sub?: string
  note: string
  icon?: LucideIcon
  tone?: 'default' | 'positive' | 'warning'
  calculation?: CalculationDetail
}) {
  return (
    <motion.article
      className={`metric-card metric-${tone}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="metric-card-top">
        <span>{label}</span>
        {calculation ? (
          <CalcReveal label={label} calculation={calculation} />
        ) : (
          <div className="metric-icon">
            <Icon size={17} strokeWidth={1.8} />
          </div>
        )}
      </div>
      <AnimatedValue value={value} className="metric-value" />
      {sub && <span className="metric-sub">{sub}</span>}
      <p>{note}</p>
    </motion.article>
  )
}

export type FieldTone = 'manual' | 'agent' | 'neutral'
export type PanelTone = Exclude<FieldTone, 'neutral'> | 'off'

/** Chart palette names, so a slider's flow tag can carry the same colour as
 * the record-flow node it drives. */
export type FlowSwatch = 'green' | 'red' | 'amber' | 'blue' | 'cyan' | 'slate'

export type FlowTarget = { label: string; swatch: FlowSwatch }

/** Ties an input to every record-flow stream it moves: same wording, same
 * colour as the Sankey nodes, so the two panels can be read together. */
function FlowTags({ flow }: { flow: FlowTarget[] }) {
  return (
    <span className="flow-tags">
      {flow.map((target) => (
        <span
          className={`flow-tag flow-${target.swatch}`}
          key={`${target.swatch}-${target.label}`}
        >
          <i />
          {target.label}
        </span>
      ))}
    </span>
  )
}

export function RevertChip({ onRevert }: { onRevert: () => void }) {
  return (
    <button
      type="button"
      className="revert-chip"
      onClick={(event) => {
        event.preventDefault()
        onRevert()
      }}
    >
      <RotateCcw size={9} strokeWidth={2.4} />
      Revert
    </button>
  )
}

/**
 * Editable readout for a slider. Typing is held in local state so a
 * half-finished number never reaches the model; the value is committed and
 * clamped to the slider range on blur or Enter.
 */
function ValueInput({
  label,
  value,
  min,
  max,
  decimals,
  prefix,
  suffix,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  decimals: number
  prefix: string
  suffix: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft.replace(/[^0-9.-]/g, ''))
    setDraft(null)
    if (Number.isFinite(parsed)) {
      onCommit(Math.min(Math.max(parsed, min), max))
    }
  }

  const displayed = draft ?? formatNumber(value, decimals)
  const widthChars = Math.max(
    displayed.length,
    formatNumber(min, decimals).length,
    formatNumber(max, decimals).length,
    5,
  )

  return (
    <span className="slider-value">
      {prefix}
      <input
        type="text"
        inputMode="decimal"
        className="value-input"
        aria-label={`${label} value`}
        value={displayed}
        size={widthChars}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(null)
        }}
      />
      {suffix}
    </span>
  )
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  prefix = '',
  onChange,
  source,
  tone,
  flow,
  onRevert,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  prefix?: string
  onChange: (value: number) => void
  source?: 'Measured' | 'Benchmark' | 'Assumption'
  tone?: FieldTone
  flow?: FlowTarget[]
  onRevert?: () => void
}) {
  const progress = ((value - min) / (max - min)) * 100
  return (
    <div className={`slider-field${tone ? ` tone-${tone}` : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        <HelpTip text={FIELD_HELP[label] ?? `Adjust the ${label.toLowerCase()} used by the model.`} />
        {source && (
          <span className={`mini-source source-${source.toLowerCase()}`}>
            {source}
          </span>
        )}
        {onRevert && <RevertChip onRevert={onRevert} />}
      </span>
      <ValueInput
        label={label}
        value={value}
        min={min}
        max={max}
        decimals={step < 1 ? 2 : 0}
        prefix={prefix}
        suffix={suffix}
        onCommit={onChange}
      />
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="range-labels">
        <span>
          {prefix}
          {formatNumber(min)}
          {suffix}
        </span>
        <span>
          {prefix}
          {formatNumber(max)}
          {suffix}
        </span>
      </span>
      {flow && <FlowTags flow={flow} />}
    </div>
  )
}

export function LogSliderField({
  label,
  value,
  min,
  max,
  onChange,
  source,
  tone,
  flow,
  onRevert,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  source?: 'Measured' | 'Benchmark' | 'Assumption'
  tone?: FieldTone
  flow?: FlowTarget[]
  onRevert?: () => void
}) {
  const logMin = Math.log10(min)
  const logMax = Math.log10(max)
  const position = ((Math.log10(Math.max(min, value)) - logMin) / (logMax - logMin)) * 1000
  const progress = position / 10

  return (
    <div className={`slider-field${tone ? ` tone-${tone}` : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        <HelpTip text={FIELD_HELP[label] ?? `Adjust the ${label.toLowerCase()} used by the model.`} />
        {source && (
          <span className={`mini-source source-${source.toLowerCase()}`}>
            {source}
          </span>
        )}
        {onRevert && <RevertChip onRevert={onRevert} />}
      </span>
      <ValueInput
        label={label}
        value={value}
        min={min}
        max={max}
        decimals={0}
        prefix=""
        suffix=""
        onCommit={onChange}
      />
      <input
        type="range"
        aria-label={label}
        min={0}
        max={1000}
        step={1}
        value={position}
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => {
          const ratio = Number(event.target.value) / 1000
          const raw = Math.pow(10, logMin + ratio * (logMax - logMin))
          const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2))
          onChange(Math.round(raw / magnitude) * magnitude)
        }}
      />
      <span className="range-labels">
        <span>{formatNumber(min)}</span>
        <span>{formatNumber(max)}</span>
      </span>
      {flow && <FlowTags flow={flow} />}
    </div>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="select-field">
      <span className="select-label-row">
        {label}
        <HelpTip
          text={
            FIELD_HELP[label] ?? `Adjust the ${label.toLowerCase()} used by the model.`
          }
        />
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle-field">
      <span>
        <span className="toggle-label-row">
          <strong>{label}</strong>
          <HelpTip text={description} />
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'switch-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <motion.span
          animate={{ x: checked ? 18 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
    </label>
  )
}

/** Small heading for an input band/group, with an optional kicker above it. */
export function GroupLabel({
  kicker,
  title,
  extra,
}: {
  kicker?: string
  title: string
  extra?: ReactNode
}) {
  return (
    <div className="group-title-row">
      <div className="group-heading">
        {kicker ? <span className="group-kicker">{kicker}</span> : null}
        <h3>{title}</h3>
      </div>
      {extra}
    </div>
  )
}

/**
 * A titled, tone-colored group of input fields. Every field is visible — none
 * are hidden behind a collapsible section, so nothing can quietly drive the
 * result from out of sight.
 */
export function ComparePanel({
  tone,
  title,
  summary,
  primary,
}: {
  tone: PanelTone
  title: string
  summary?: string
  primary: ReactNode
}) {
  return (
    <section className={`compare-panel compare-${tone}`}>
      <header className="compare-head">
        <div className="compare-title">
          <i className="compare-dot" />
          <h3>{title}</h3>
        </div>
        {summary ? <p className="compare-facts">{summary}</p> : null}
      </header>
      <div className="compare-body">{primary}</div>
    </section>
  )
}

export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="compare-note">{children}</p>
}

export function PanelFlag({
  tone,
  children,
}: {
  tone: 'warn' | 'ok'
  children: ReactNode
}) {
  return <span className={`panel-flag panel-flag-${tone}`}>{children}</span>
}

export type BannerTone = 'primary' | 'measured' | 'neutral'

/**
 * Opens a section with its conclusion written as a sentence, next to an
 * optional figure. Pass `aside` to replace the stat tile (e.g. the NPV card).
 */
export function AnswerBanner({
  eyebrow,
  children,
  statLabel,
  statValue,
  statNote,
  tone = 'primary',
  aside,
}: {
  eyebrow: string
  children: ReactNode
  statLabel?: string
  statValue?: string
  statNote?: string
  tone?: BannerTone
  aside?: ReactNode
}) {
  return (
    <section className={`answer-banner answer-${tone}`}>
      <div className="answer-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{children}</h2>
      </div>
      {aside ??
        (statValue ? (
          <div className="answer-stat">
            <span>{statLabel}</span>
            <AnimatedValue value={statValue} className="answer-stat-value" />
            {statNote && <small>{statNote}</small>}
          </div>
        ) : null)}
    </section>
  )
}

/**
 * Full-width hero at the top of the page. Carries the headline and the
 * one-line shape of the model; every number lives further down the page.
 */
export function ResultHero({
  headline,
  accent,
  equation,
}: {
  headline: string
  accent?: string
  equation: Array<{ caption: string; text: string }>
}) {
  return (
    <section className="result-hero">
      <div className="hero-copy">
        <h1>
          {headline}
          {accent ? (
            <>
              <br />
              <span className="hero-accent">{accent}</span>
            </>
          ) : null}
        </h1>
        <div className="hero-equation">
          {equation.map((step, index) => (
            <Fragment key={step.text}>
              {index > 0 && <span className="hero-eq-arrow" aria-hidden />}
              <div className="hero-eq-step">
                <span>{step.caption}</span>
                <strong>{step.text}</strong>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Emphasised figure inside an `AnswerBanner` sentence. */
export function Key({ children, tone }: { children: ReactNode; tone?: 'risk' }) {
  return <b className={tone === 'risk' ? 'answer-key risk' : 'answer-key'}>{children}</b>
}

/**
 * Side-by-side "same work, two ways" table. Three columns: the measure, the
 * manual baseline, and the AgentFlow figure.
 */
export type CompareRow = {
  label: string
  today: string
  agent: string
  /** A second, quieter figure under the headline one in the same cell. */
  todaySub?: string
  agentSub?: string
  /** Optional full workings behind each figure, opened from the cell. */
  todayCalculation?: CalculationDetail
  agentCalculation?: CalculationDetail
}

export function CompareStrip({
  caption,
  rows,
  note,
}: {
  caption: string
  rows: CompareRow[]
  note?: ReactNode
}) {
  const cell = (
    row: CompareRow,
    side: 'today' | 'agent',
    columnLabel: string,
  ) => {
    const calculation =
      side === 'today' ? row.todayCalculation : row.agentCalculation
    const sub = side === 'today' ? row.todaySub : row.agentSub
    // If either column carries a second line, both reserve room for one, so
    // the headline figures stay on the same line across the strip.
    const stacked = Boolean(row.todaySub || row.agentSub)
    return (
      <div className="compare-cell" key={row.label} data-label={row.label}>
        <span className="compare-value">
          <strong>{row[side]}</strong>
          {stacked && <small>{sub ?? '\u00A0'}</small>}
        </span>
        {calculation && (
          <CalcReveal
            label={`${row.label} — ${columnLabel}`}
            calculation={calculation}
            className="compare-info"
            size={14}
          />
        )}
      </div>
    )
  }

  return (
    <section className="compare-strip">
      <div className="compare-col compare-measures">
        <span className="compare-caption">{caption}</span>
        {rows.map((row) => (
          <div className="compare-cell" key={row.label}>
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      <div className="compare-col compare-today">
        <span className="compare-head">
          <i />
          Without AgentFlow
        </span>
        {rows.map((row) => cell(row, 'today', 'Without AgentFlow'))}
      </div>
      <div className="compare-col compare-agent">
        <span className="compare-head">
          <i />
          With AgentFlow
        </span>
        {rows.map((row) => cell(row, 'agent', 'With AgentFlow'))}
      </div>
      {note && <p className="compare-note-row">{note}</p>}
    </section>
  )
}

/** Labelled divider above a small group of metric cards. */
export function CardGroup({
  label,
  tone = 'neutral',
  children,
}: {
  label: string
  tone?: 'gain' | 'cost' | 'neutral'
  children: ReactNode
}) {
  return (
    <section className="card-group">
      <div className={`card-group-label tone-${tone}`}>
        <span>{label}</span>
        <i />
      </div>
      <div className="card-group-cards">{children}</div>
    </section>
  )
}

export type OutcomeSegment = {
  label: string
  value: number
  color: string
  risk?: boolean
}

/**
 * One hundred-percent bar of mutually exclusive outcomes, with a legend that
 * repeats the counts. Replaces side-by-side donuts of the same population.
 */
export function OutcomeBar({
  segments,
  total,
}: {
  segments: OutcomeSegment[]
  total: number
}) {
  return (
    <div className="outcome-block">
      <div className="outcome-bar">
        {segments.map((segment) => {
          const share = total > 0 ? (segment.value / total) * 100 : 0
          return (
            <div
              key={segment.label}
              style={{ width: `${share}%`, background: segment.color }}
              title={`${segment.label}: ${formatNumber(segment.value)}`}
            >
              {share > 5 ? formatNumber(segment.value) : ''}
            </div>
          )
        })}
      </div>
      <div className="outcome-legend">
        {segments.map((segment) => (
          <div key={segment.label} className={segment.risk ? 'risk-row' : ''}>
            <span className="legend-dot" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{formatNumber(segment.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export type NoteTone = 'info' | 'risk' | 'measured' | 'caution'

/** Short plain-language note under a chart or table. */
export function Note({
  tone = 'info',
  title,
  children,
}: {
  tone?: NoteTone
  title: string
  children: ReactNode
}) {
  return (
    <aside className={`page-note note-${tone}`}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  )
}

export function ProvenancePill({ type }: { type: string }) {
  return (
    <span
      className={`provenance-pill provenance-${type.toLowerCase().replace(' ', '-')}`}
    >
      {type === 'Measured' && <Check size={12} />}
      {type}
    </span>
  )
}

export function ChartHeader({
  eyebrow,
  title,
  unit,
}: {
  eyebrow: string
  /** Omit where the eyebrow already names the chart. */
  title?: string
  unit?: string
}) {
  return (
    <div className="surface-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        {title ? <h3>{title}</h3> : null}
      </div>
      {unit ? <span className="chart-unit">{unit}</span> : <Info size={17} />}
    </div>
  )
}
