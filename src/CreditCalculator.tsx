import { useState } from 'react'
import { formatCurrency, formatNumber, formatUnitCurrency } from './model'
import { HelpTip } from './ui'

type LlmModel = 'reltio' | 'byo'
type PackageKey = '1m' | '2.5m' | '5m' | '10m'

/** AgentFlow credit price list, discounts already applied. */
const PACKAGES: Record<
  PackageKey,
  {
    label: string
    credits: number
    discountPct: number
    price: Record<LlmModel, number>
  }
> = {
  '1m': {
    label: '1M',
    credits: 1_000_000,
    discountPct: 0,
    price: { reltio: 60_000, byo: 20_000 },
  },
  '2.5m': {
    label: '2.5M',
    credits: 2_500_000,
    discountPct: 10,
    price: { reltio: 135_000, byo: 45_000 },
  },
  '5m': {
    label: '5M',
    credits: 5_000_000,
    discountPct: 20,
    price: { reltio: 240_000, byo: 80_000 },
  },
  '10m': {
    label: '10M',
    credits: 10_000_000,
    discountPct: 30,
    price: { reltio: 420_000, byo: 140_000 },
  },
}

const LLM_LABELS: Record<LlmModel, string> = {
  reltio: 'Reltio-managed',
  byo: 'Bring your own',
}

function formatCreditPrice(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)
}

/**
 * Standalone lookup: what a record costs in dollars at a given credit
 * consumption, package and LLM option. It is deliberately not wired into the
 * model — the per-record charge in the inputs is still set by hand.
 */
export function CreditCalculator() {
  const [creditsPerRecord, setCreditsPerRecord] = useState(2.3)
  const [draft, setDraft] = useState<string | null>(null)
  const [llm, setLlm] = useState<LlmModel>('reltio')
  const [packageKey, setPackageKey] = useState<PackageKey>('1m')

  const pkg = PACKAGES[packageKey]
  const packagePrice = pkg.price[llm]
  const pricePerCredit = packagePrice / pkg.credits
  const pricePerRecord = creditsPerRecord * pricePerCredit

  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft.replace(/[^0-9.]/g, ''))
    setDraft(null)
    if (Number.isFinite(parsed)) setCreditsPerRecord(Math.max(0, parsed))
  }

  return (
    <section className="surface credit-card">
      <div className="credit-head">
        <span className="eyebrow">CREDIT CALCULATOR</span>
        <span className="credit-sub">Dollar cost of one record</span>
      </div>

      <label className="credit-choice">
        <span>Credits per record</span>
        <input
          type="text"
          inputMode="decimal"
          className="credit-input"
          value={draft ?? formatNumber(creditsPerRecord, 2)}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setDraft(null)
          }}
        />
      </label>

      <div className="credit-choice">
        <span>LLM model</span>
        <div className="segmented">
          {(Object.keys(LLM_LABELS) as LlmModel[]).map((key) => (
            <button
              type="button"
              key={key}
              className={llm === key ? 'active' : ''}
              onClick={() => setLlm(key)}
            >
              {LLM_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="credit-choice">
        <span>Credit package</span>
        <div className="segmented">
          {(Object.keys(PACKAGES) as PackageKey[]).map((key) => (
            <button
              type="button"
              key={key}
              className={packageKey === key ? 'active' : ''}
              onClick={() => setPackageKey(key)}
            >
              {PACKAGES[key].label}
              {PACKAGES[key].discountPct > 0 && (
                <small>−{PACKAGES[key].discountPct}%</small>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="credit-results">
        <div className="credit-stat">
          <span className="credit-stat-label">
            Price per credit
            <HelpTip
              text={`Package price: ${formatCurrency(packagePrice)} (${pkg.label} credits${pkg.discountPct > 0 ? `, ${pkg.discountPct}% discount` : ''})`}
            />
          </span>
          <strong>{formatCreditPrice(pricePerCredit)}</strong>
          <small>
            {formatCurrency(packagePrice)} ÷ {pkg.label} credits
          </small>
        </div>
        <div className="credit-stat credit-stat-main">
          <span className="credit-stat-label">Charge per record</span>
          <strong>{formatUnitCurrency(pricePerRecord)}</strong>
          <small>
            {formatNumber(creditsPerRecord, 2)} credits ×{' '}
            {formatCreditPrice(pricePerCredit)} a credit
          </small>
        </div>
      </div>
    </section>
  )
}
