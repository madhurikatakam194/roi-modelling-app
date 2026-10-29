import { DEFAULT_INPUTS, type ModelInputs } from './model'
import {
  LogSliderField,
  SelectField,
  SliderField,
  ToggleField,
  type FieldTone,
  type FlowSwatch,
  type PanelTone,
} from './ui'

type SourceValue = 'Measured' | 'Benchmark' | 'Assumption'

type FieldBase = {
  key: keyof ModelInputs
  label: string
  tone?: FieldTone
  /** Show this field only when the predicate is true (e.g. cadence === 'on-demand'). */
  visibleWhen?: (inputs: ModelInputs) => boolean
  /** Names every Quality record-flow stream this input drives, so the slider
   * and the Sankey nodes can be read against each other. Swatch must match the
   * node's colour in `qualityNodeColor`. */
  flow?: Array<{ label: string; swatch: FlowSwatch }>
}

export type InputField =
  | (FieldBase & {
      type: 'slider'
      min: number
      max: number
      step?: number
      prefix?: string
      suffix?: string
      source?: SourceValue
      /** Source flips Measured/Assumption and a revert chip appears, both
       * based on whether the value still equals DEFAULT_INPUTS[key]. */
      dynamicMeasured?: boolean
    })
  | (FieldBase & {
      type: 'logSlider'
      min: number
      max: number
      source?: SourceValue
      dynamicMeasured?: boolean
    })
  | (FieldBase & {
      type: 'select'
      options: Array<{ value: string; label: string }>
    })
  | (FieldBase & {
      type: 'toggle'
      description: string
    })

export type InputGroup = {
  id: string
  title: string
  kicker?: string
  tone: PanelTone
  fields: InputField[]
}

function setInput<K extends keyof ModelInputs>(
  onInput: <K2 extends keyof ModelInputs>(key: K2, value: ModelInputs[K2]) => void,
  key: K,
  value: ModelInputs[K],
) {
  onInput(key, value)
}

/** Single dispatcher so the drawer and the top-strip popover render fields
 * the same way from the same config, instead of duplicating per-field JSX. */
export function FieldControl({
  field,
  inputs,
  onInput,
}: {
  field: InputField
  inputs: ModelInputs
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void
}) {
  if (field.visibleWhen && !field.visibleWhen(inputs)) return null

  if (field.type === 'select') {
    return (
      <SelectField
        label={field.label}
        value={inputs[field.key] as string}
        options={field.options}
        onChange={(value) =>
          setInput(onInput, field.key, value as ModelInputs[typeof field.key])
        }
      />
    )
  }

  if (field.type === 'toggle') {
    return (
      <ToggleField
        label={field.label}
        description={field.description}
        checked={inputs[field.key] as boolean}
        onChange={(checked) =>
          setInput(onInput, field.key, checked as ModelInputs[typeof field.key])
        }
      />
    )
  }

  const value = inputs[field.key] as number
  const isDefault = value === DEFAULT_INPUTS[field.key]
  const source = field.dynamicMeasured
    ? isDefault
      ? 'Measured'
      : 'Assumption'
    : field.source
  const onRevert =
    field.dynamicMeasured && !isDefault
      ? () =>
          setInput(
            onInput,
            field.key,
            DEFAULT_INPUTS[field.key] as ModelInputs[typeof field.key],
          )
      : undefined
  const onChange = (next: number) =>
    setInput(onInput, field.key, next as ModelInputs[typeof field.key])

  if (field.type === 'logSlider') {
    return (
      <LogSliderField
        label={field.label}
        value={value}
        min={field.min}
        max={field.max}
        tone={field.tone}
        source={source}
        flow={field.flow}
        onRevert={onRevert}
        onChange={onChange}
      />
    )
  }

  return (
    <SliderField
      label={field.label}
      value={value}
      min={field.min}
      max={field.max}
      step={field.step}
      prefix={field.prefix}
      suffix={field.suffix}
      tone={field.tone}
      source={source}
      flow={field.flow}
      onRevert={onRevert}
      onChange={onChange}
    />
  )
}

/** The workload and quality inputs everything else is derived from, so they
 * lead the sidebar. */
const WORKLOAD_GROUPS: InputGroup[] = [
  {
    id: 'workload',
    title: 'Your workload',
    kicker: 'Scope',
    tone: 'off',
    fields: [
      {
        type: 'logSlider',
        key: 'backlogRecords',
        label: 'Starting backlog',
        min: 5_000,
        max: 100_000_000,
        tone: 'neutral',
        source: 'Assumption',
      },
      {
        type: 'slider',
        key: 'monthlyInflowPct',
        label: 'New records per month',
        min: 0,
        max: 10,
        step: 0.25,
        suffix: '%',
        tone: 'neutral',
        source: 'Assumption',
      },
      {
        type: 'slider',
        key: 'horizonYears',
        label: 'Modeled horizon',
        min: 1,
        max: 10,
        suffix: ' yrs',
        tone: 'neutral',
        source: 'Assumption',
      },
    ],
  },
  {
    id: 'quality',
    title: 'Decision quality',
    tone: 'agent',
    fields: [
      {
        type: 'slider',
        key: 'decisionAccuracyPct',
        label: 'Decision correctness',
        min: 70,
        max: 100,
        suffix: '%',
        tone: 'agent',
        dynamicMeasured: true,
        flow: [{ label: 'Decided correctly', swatch: 'green' }],
      },
      {
        type: 'slider',
        key: 'automationRatePct',
        label: 'Auto-finalized',
        min: 50,
        max: 100,
        suffix: '%',
        tone: 'agent',
        source: 'Assumption',
        flow: [{ label: 'Auto-finalized', swatch: 'blue' }],
      },
    ],
  },
]

/** Every common input, grouped once, identical no matter which page opened the drawer. */
/** What each way of doing the work costs to run. */
const HOME_GROUPS: InputGroup[] = [
  {
    id: 'credit-package',
    title: 'Credit package',
    tone: 'agent',
    fields: [
      {
        type: 'slider',
        key: 'creditsPerRecord',
        label: 'Credits / record',
        min: 0.1,
        max: 20,
        step: 0.1,
        tone: 'agent',
        dynamicMeasured: true,
      },
      {
        type: 'select',
        key: 'llmModel',
        label: 'LLM model',
        tone: 'agent',
        options: [
          { value: 'reltio', label: 'Reltio-managed LLM' },
          { value: 'byo', label: 'Bring your own LLM' },
        ],
      },
      {
        type: 'select',
        key: 'creditPackage',
        label: 'Credit package',
        tone: 'agent',
        options: [
          { value: '1m', label: '1M credits' },
          { value: '2.5m', label: '2.5M credits (10% off)' },
          { value: '5m', label: '5M credits (20% off)' },
          { value: '10m', label: '10M credits (30% off)' },
        ],
      },
    ],
  },
  {
    id: 'agent-processing',
    title: 'AgentFlow processing',
    tone: 'agent',
    fields: [
      {
        type: 'slider',
        key: 'agentMinutesPerRecord',
        label: 'Agent minutes / record',
        min: 0,
        max: 30,
        step: 0.05,
        suffix: ' min',
        tone: 'agent',
        // The default is a chosen figure, not the measured 5.2125, so this must
        // not carry a Measured badge.
        source: 'Assumption',
      },
      {
        type: 'slider',
        key: 'processingRecordsPerRun',
        label: 'Records per run',
        min: 1_000,
        max: 1_000_000,
        step: 1_000,
        tone: 'agent',
        dynamicMeasured: true,
      },
      {
        type: 'select',
        key: 'cadence',
        label: 'Run frequency',
        tone: 'agent',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'on-demand', label: 'On demand' },
          { value: 'not-set', label: 'Not set' },
        ],
      },
      {
        type: 'slider',
        key: 'onDemandRunsPerYear',
        label: 'Runs per year',
        min: 1,
        max: 52,
        tone: 'agent',
        source: 'Assumption',
        visibleWhen: (inputs) => inputs.cadence === 'on-demand',
      },
      {
        type: 'slider',
        key: 'workers',
        label: 'Workers',
        min: 25,
        max: 500,
        step: 25,
        tone: 'agent',
        dynamicMeasured: true,
      },
    ],
  },
  {
    id: 'manual-team',
    title: 'Manual Effort',
    tone: 'manual',
    fields: [
      {
        type: 'slider',
        key: 'manualMinutesPerRecord',
        label: 'Manual minutes / record',
        min: 1,
        max: 60,
        step: 0.5,
        suffix: ' min',
        tone: 'manual',
        source: 'Assumption',
      },
      {
        type: 'slider',
        key: 'hourlyLaborRate',
        label: 'Fully loaded labor',
        min: 35,
        max: 500,
        prefix: '$',
        suffix: '/hr',
        tone: 'manual',
        source: 'Benchmark',
      },
      {
        type: 'slider',
        key: 'dataStewards',
        label: 'Data stewards',
        min: 1,
        max: 100,
        tone: 'manual',
        source: 'Assumption',
      },
      {
        type: 'slider',
        key: 'utilizationPct',
        label: 'Team utilization',
        min: 40,
        max: 100,
        suffix: '%',
        tone: 'manual',
        source: 'Assumption',
      },
    ],
  },
]

/** How errors split and what fixing them costs. */
const QUALITY_GROUPS: InputGroup[] = [
  {
    id: 'error-split',
    title: 'Where the errors go',
    tone: 'agent',
    fields: [
      {
        type: 'slider',
        key: 'incorrectEnrichmentSharePct',
        label: 'Incorrect enrichment',
        min: 0,
        max: 100,
        suffix: '%',
        tone: 'agent',
        source: 'Assumption',
        flow: [{ label: 'Wrongly enriched', swatch: 'red' }],
      },
      {
        type: 'slider',
        key: 'incorrectNoEnrichmentSharePct',
        label: 'Incorrect no-enrich',
        min: 0,
        max: 100,
        suffix: '%',
        tone: 'agent',
        source: 'Assumption',
        flow: [{ label: 'Wrongly not enriched', swatch: 'amber' }],
      },
      {
        type: 'slider',
        key: 'technicalFailureSharePct',
        label: 'Technical failure',
        min: 0,
        max: 100,
        suffix: '%',
        tone: 'agent',
        source: 'Assumption',
        flow: [{ label: 'Technical failures', swatch: 'slate' }],
      },
    ],
  },
  {
    id: 'human-effort',
    title: 'Human effort to fix it',
    // Human time, but only time the agent creates: nobody spends these minutes
    // unless AgentFlow is running, so it reads as an AgentFlow input.
    tone: 'agent',
    fields: [
      {
        type: 'slider',
        key: 'reviewMinutesPerRecord',
        label: 'Review minutes / record',
        min: 1,
        max: 60,
        step: 0.5,
        suffix: ' min',
        tone: 'agent',
        source: 'Assumption',
        // Review time is charged on every reviewed record, whether the agent
        // got it right or the reviewer caught a mistake.
        flow: [
          { label: 'Human-reviewed', swatch: 'slate' },
          { label: 'Caught in review', swatch: 'cyan' },
        ],
      },
      {
        type: 'slider',
        key: 'correctionMinutesPerRecord',
        label: 'Rework minutes / record',
        min: 1,
        max: 60,
        step: 0.5,
        suffix: ' min',
        tone: 'agent',
        source: 'Assumption',
        flow: [{ label: 'Wrongly enriched', swatch: 'red' }],
      },
    ],
  },
]

/**
 * Every input in one ordered list, since the app is a single page. Scope and
 * quality first because everything downstream is derived from them, then what
 * each way of doing the work costs.
 */
export const ALL_GROUPS: InputGroup[] = [
  ...WORKLOAD_GROUPS,
  ...HOME_GROUPS,
  ...QUALITY_GROUPS,
]
