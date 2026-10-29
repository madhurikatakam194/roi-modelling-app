import { motion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Layer,
  Legend,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from 'recharts'
import { Layers, TrendingUp } from 'lucide-react'
import {
  formatCompactNumber,
  formatCurrency,
  formatDuration,
  formatNumber,
  RETRY_RUNS_PER_TECHNICAL_FAILURE,
  WORKING_DAYS_PER_MONTH,
  CREDIT_PACKAGES,
  creditPackageFor,
  formatCreditCurrency,
  type CreditPackage,
  type LlmModel,
  type ModelInputs,
  type ModelResult,
} from './model'
import {
  AnswerBanner,
  CardGroup,
  ChartHeader,
  CompareStrip,
  Key,
  MetricCard,
  ResultHero,
  SliderField,
  TooltipContent,
  type CalculationDetail,
} from './ui'
import { DARK_COLORS, LIGHT_COLORS } from './colors'
import { useTheme } from './theme'

function hours(value: number) {
  return `${formatNumber(value)} hrs`
}

/** How a run cadence reads in a sentence. "Not set" means no schedule at all,
 * so the agent runs continuously rather than on an interval. */
function cadenceLabelFor(cadence: ModelInputs['cadence']) {
  if (cadence === 'on-demand') return 'on demand'
  if (cadence === 'not-set') return 'back to back'
  return cadence
}

/* ------------------------------------------------------------------ */
/* Value — headline, workload and cost                                 */
/* ------------------------------------------------------------------ */

function RecordsCompareStrip({
  result,
  inputs,
}: {
  result: ModelResult
  inputs: ModelInputs
}) {
  const arrivals = result.workloadRecords - inputs.backlogRecords
  const caption =
    arrivals > 0
      ? `${formatNumber(inputs.backlogRecords)} backlog + ${formatNumber(arrivals)} new over ${inputs.horizonYears} years`
      : `${formatNumber(inputs.backlogRecords)} backlog records`

  const w = result.workload
  const retryRuns = RETRY_RUNS_PER_TECHNICAL_FAILURE
  const cadenceLabel = cadenceLabelFor(inputs.cadence)
  // With no schedule the agent is not waiting for anything, so the timing
  // breakdown has to stop describing a gap that no longer exists.
  const noSchedule = inputs.cadence === 'not-set'
  // Every figure below is priced on the same pile, so the sentence describing
  // it is written once and reused by all four breakdowns.
  const pile =
    arrivals > 0
      ? `${formatNumber(inputs.backlogRecords)} backlog records plus the ${formatNumber(arrivals)} expected to arrive over ${inputs.horizonYears} years`
      : `all ${formatNumber(inputs.backlogRecords)} backlog records`
  const workloadStep = {
    label: 'Records to get through',
    formula:
      arrivals > 0 ? 'Backlog + arrivals over the horizon' : 'Backlog',
    value: formatNumber(w.records),
    note: `${pile}. The horizon sizes the arrivals only — the backlog is always priced in full.`,
  }
  const rate = `${formatCurrency(inputs.hourlyLaborRate)}/hr`

  const manualCost: CalculationDetail = {
    formula: 'Records × manual minutes ÷ 60 × hourly rate',
    description: `What the same pile costs when a data steward researches, validates and corrects every record by hand. This is the baseline AgentFlow is measured against, not a new expense.`,
    steps: [
      workloadStep,
      {
        label: 'Hours of steward time',
        formula: `${formatNumber(w.records)} × ${formatNumber(inputs.manualMinutesPerRecord)} min ÷ 60`,
        value: hours(w.manualHours),
      },
      {
        label: 'Cost of those hours',
        formula: `${hours(w.manualHours)} × ${rate}`,
        value: formatCurrency(w.manualCost, true),
      },
    ],
    result: formatCurrency(w.manualCost, true),
  }

  const agentCost: CalculationDetail = {
    formula: 'Processing + review + rework',
    description:
      'AgentFlow fully loaded. Beyond the per-record fee it carries the human time the agent still creates: checking what it decided, and repairing the mistakes that got past the check.',
    steps: [
      workloadStep,
      {
        label: 'Processing',
        formula: `Billed records × ${formatNumber(inputs.creditsPerRecord, 2)} credits × ${formatCreditCurrency(result.credit.pricePerCredit)} a credit`,
        value: formatCurrency(w.processingCost, true),
        note: `A record that fails technically produces no decision, so it goes back through the pipeline ${retryRuns} more times — ${retryRuns + 1} runs billed in total. Every other record is billed once.`,
        parts: [
          {
            label: 'Billed records',
            formula: `${formatNumber(w.records)} + ${retryRuns} × ${formatNumber(w.technicalFailures)} technically failed records`,
            value: formatNumber(w.billedRuns),
          },
          {
            label: 'Price per credit',
            formula: `${formatCurrency(result.credit.packagePrice)} ÷ ${formatNumber(result.credit.packageCredits)} credits (${inputs.llmModel === 'byo' ? 'bring-your-own' : 'Reltio-managed'} LLM)`,
            value: formatCreditCurrency(result.credit.pricePerCredit),
            note: 'Set by the credit package and LLM model chosen in the Credit package card.',
          },
        ],
      },
      // Each human-time line carries its own population as a sub-part, so the
      // formula can name the count instead of burying a bare number in it.
      {
        label: 'Review',
        formula: `Records that need review × ${formatNumber(inputs.reviewMinutesPerRecord)} min ÷ 60 × ${rate}`,
        value: formatCurrency(w.reviewCost, true),
        parts: [
          {
            label: 'Records that need human review',
            formula: `(${formatNumber(w.records)} − ${formatNumber(w.technicalFailures)} failed) × ${formatNumber(100 - inputs.automationRatePct)}% not auto-finalized`,
            value: `${formatNumber(w.reviewedRecords)} records`,
            note: `At ${formatNumber(inputs.automationRatePct)}% auto-finalized, a person opens the remaining ${formatNumber(100 - inputs.automationRatePct)}% of decided records. Technical failures are reprocessed, so they never reach a reviewer.`,
          },
        ],
      },
      {
        label: 'Rework',
        formula: `Records that need rework × ${formatNumber(inputs.correctionMinutesPerRecord)} min ÷ 60 × ${rate}`,
        value: formatCurrency(w.remediationCost, true),
        parts: [
          {
            label: 'Records that need to be reworked',
            formula: `Wrong decisions × ${formatNumber(inputs.automationRatePct)}% auto-finalized`,
            value: `${formatNumber(w.uncheckedErrors)} records`,
            note: 'Wrong decisions that were auto-finalized — wrong unchecked data. Mistakes caught during review are already paid for above.',
          },
        ],
      },
    ],
    result: formatCurrency(w.agentCost, true),
  }

  const manualTime: CalculationDetail = {
    formula: 'Records ÷ what the steward team clears per month',
    description: `Elapsed calendar time, not effort. ${formatNumber(inputs.dataStewards)} stewards can only work so fast, so the pile is divided by the team's throughput.`,
    steps: [
      workloadStep,
      {
        label: 'Productive hours per day',
        formula: `${formatNumber(inputs.dataStewards)} stewards × 8 hrs × ${formatNumber(inputs.utilizationPct)}% utilization`,
        value: hours(result.teamDayHours),
        note: 'Utilization discounts meetings, escalations and everything else that is not record processing.',
      },
      {
        label: 'Records cleared per month',
        formula: `${hours(result.teamDayHours)}/day ÷ ${formatNumber(inputs.manualMinutesPerRecord)} min × ${formatNumber(WORKING_DAYS_PER_MONTH)} working days`,
        value: formatNumber(w.manualMonthlyCapacity),
      },
      {
        label: 'Calendar time to finish',
        formula: `${formatNumber(w.records)} ÷ ${formatNumber(w.manualMonthlyCapacity)} per month`,
        value: formatDuration(result.manualProcessingDays * 24),
      },
    ],
    result: formatDuration(result.manualProcessingDays * 24),
  }

  const agentHours = result.agentProcessingDays * 24
  const scheduleHours = w.agentScheduleDays * 24
  const humanHours = w.agentHumanDays * 24
  // The human stage is identical either way, so it is written once and the
  // two schedule stories are told above it.
  const humanStep = {
    label: 'Then the team checks and fixes it',
    formula: `${formatNumber(w.agentHumanHours)} hrs ÷ ${formatNumber(result.teamDayHours)} hrs a day, across ${formatNumber(WORKING_DAYS_PER_MONTH)} working days a month`,
    value: formatDuration(humanHours),
    note: `Review and rework are steward work, not agent work, so they run at your team's capacity — ${formatNumber(inputs.dataStewards)} stewards at ${formatNumber(inputs.utilizationPct)}% utilization.`,
    parts: [
      {
        label: 'Reviewing what the agent decided',
        formula: `${formatNumber(w.reviewedRecords)} records × ${formatNumber(inputs.reviewMinutesPerRecord)} min ÷ 60`,
        value: hours(w.reviewHours),
      },
      {
        label: 'Fixing what got through wrong',
        formula: `${formatNumber(w.uncheckedErrors)} records × ${formatNumber(inputs.correctionMinutesPerRecord)} min ÷ 60`,
        value: hours(w.remediationHours),
      },
    ],
  }
  // Without a schedule the run-by-run breakdown cancels out — every run is
  // priced at its own compute time, so the pieces add back up to the compute
  // time for the whole pile. Showing it that way is both simpler and exact.
  const runtimeSteps: CalculationDetail['steps'] = noSchedule
    ? [
        workloadStep,
        {
          label: 'The agent processes the pile',
          formula: `(${formatNumber(w.records)} + ${retryRuns} × ${formatNumber(w.technicalFailures)} failed) × ${formatNumber(inputs.agentMinutesPerRecord, 2)} worker-min ÷ (${formatNumber(inputs.workers)} workers × 60)`,
          value: formatDuration(scheduleHours),
          note: `Workers run in parallel, so the fleet gets through ${formatNumber(inputs.workers)} minutes of work per minute of clock time. Records that fail technically are run ${retryRuns} more times.`,
        },
      ]
    : [
        workloadStep,
        {
          label: 'Runs needed',
          formula: `(${formatNumber(w.records)} + ${retryRuns} × ${formatNumber(w.technicalFailures)} failed) ÷ ${formatNumber(inputs.processingRecordsPerRun)} per run, rounded up`,
          value: formatNumber(w.agentRuns),
          note: `Records that fail technically produce no decision, so they come back for ${retryRuns} more runs and need schedule time of their own.`,
        },
        {
          label: 'Time between runs',
          formula: `Longer of the ${formatDuration(w.agentScheduleGapDays * 24)} schedule and the ${formatDuration(w.agentRunComputeHours)} a run takes`,
          value: formatDuration(w.agentPerRunDays * 24),
          note:
            w.agentScheduleGapDays * 24 >= w.agentRunComputeHours
              ? 'The schedule is the slower of the two, so the agent finishes a run and then sits idle until its next slot.'
              : 'A run takes longer than the gap it is given, so the agent paces itself and the schedule stops mattering.',
          parts: [
            {
              label: 'How long one run takes',
              formula: `${formatNumber(inputs.processingRecordsPerRun)} records × ${formatNumber(inputs.agentMinutesPerRecord, 2)} worker-min ÷ (${formatNumber(inputs.workers)} workers × 60)`,
              value: formatDuration(w.agentRunComputeHours),
              note: `Workers process records side by side, so the fleet gets through ${formatNumber(inputs.workers)} worker-minutes of work per minute of clock time.`,
            },
          ],
        },
        {
          label: 'The agent gets through the pile',
          formula: `${formatNumber(w.agentRuns - 1)} gaps × ${formatDuration(w.agentPerRunDays * 24)}, then ${formatDuration(w.agentLastRunHours)} for the last run`,
          value: formatDuration(scheduleHours),
          note: `${formatNumber(w.agentRuns)} runs have ${formatNumber(w.agentRuns - 1)} gaps between them — the first run starts straight away. Every run except the last finishes inside its own gap, so only the last one adds time of its own.`,
          parts: [
            {
              label: 'How long the last run takes',
              formula: `${formatNumber(w.agentLastRunRecords)} records × ${formatNumber(inputs.agentMinutesPerRecord, 2)} worker-min ÷ (${formatNumber(inputs.workers)} workers × 60)`,
              value: formatDuration(w.agentLastRunHours),
              note: `The first ${formatNumber(w.agentRuns - 1)} runs are full at ${formatNumber(inputs.processingRecordsPerRun)} records, leaving ${formatNumber(w.agentLastRunRecords)} for the last one. It is timed on its real size rather than a full load.`,
            },
          ],
        },
      ]

  // The two stages overlap: a batch is reviewed while the next one is still
  // being processed. Whichever stage is slower is the one you wait on. Both
  // figures sit in the one cell, so the modal has to explain both: the run
  // schedule first, then the human work, then which of them you wait on.
  const agentLedByHumans = humanHours >= scheduleHours
  const agentTime: CalculationDetail = {
    formula: 'Agent runtime, then the longer of it and the human stage',
    description: `${
      noSchedule
        ? 'No run schedule is set, so the agent works continuously and its runtime is simply how long the fleet takes to compute the whole pile, retries included.'
        : `The agent is paced by its schedule — ${formatNumber(inputs.processingRecordsPerRun)} records per run, ${cadenceLabel} — so its runtime is mostly the wait between runs.`
    } Processing and review then run side by side, The stewards work through what the agent has already produced while it keeps going on the rest.`,
    steps: [
      ...runtimeSteps,
      humanStep,
      {
        label: 'Total time taken',
        formula: `The longer of the two, which is the ${agentLedByHumans ? 'human' : 'agent'} stage`,
        value: formatDuration(agentHours),
        note: agentLedByHumans
          ? `The stewards are the bottleneck here: the agent finishes its part in ${formatDuration(scheduleHours)} and then waits on review and rework.`
          : `The agent is the bottleneck here: the team keeps up with it, clearing its ${formatDuration(humanHours)} of review and rework inside the run schedule.`,
      },
    ],
    result: formatDuration(agentHours),
  }

  return (
    <CompareStrip
      caption={caption}
      rows={[
        {
          label: 'Total cost',
          today: formatCurrency(result.workloadManualCost, true),
          agent: formatCurrency(result.workloadAgentCost, true),
          todayCalculation: manualCost,
          agentCalculation: agentCost,
        },
        {
          label: 'Time taken',
          today: formatDuration(result.manualProcessingDays * 24),
          agent: formatDuration(scheduleHours),
          agentSub: `${formatDuration(agentHours)} total, including human review`,
          todayCalculation: manualTime,
          agentCalculation: agentTime,
        },
      ]}
    />
  )
}

function CreditPackageCard({
  result,
  inputs,
  onInput,
}: {
  result: ModelResult
  inputs: ModelInputs
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void
}) {
  const c = result.credit
  const pkg = creditPackageFor(inputs)
  return (
    <section className="surface credit-card">
      <div className="credit-head">
        <span className="eyebrow">CREDIT PACKAGE</span>
        <span className="credit-sub">
          {formatNumber(result.workload.billedRuns)} billed records over{' '}
          {inputs.horizonYears} years, retries included
        </span>
      </div>
      <div className="credit-grid">
        <div className="credit-controls">
          <SliderField
            label="Credits / record"
            value={inputs.creditsPerRecord}
            min={0.1}
            max={20}
            step={0.1}
            tone="agent"
            onChange={(value) => onInput('creditsPerRecord', value)}
          />
          <div className="credit-choice">
            <span>LLM model</span>
            <div className="segmented">
              {(['reltio', 'byo'] as LlmModel[]).map((llm) => (
                <button
                  type="button"
                  key={llm}
                  className={inputs.llmModel === llm ? 'active' : ''}
                  onClick={() => onInput('llmModel', llm)}
                >
                  {llm === 'reltio' ? 'Reltio-managed' : 'Bring your own'}
                </button>
              ))}
            </div>
          </div>
          <div className="credit-choice">
            <span>Credit package</span>
            <div className="segmented">
              {(Object.keys(CREDIT_PACKAGES) as CreditPackage[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  className={inputs.creditPackage === key ? 'active' : ''}
                  onClick={() => onInput('creditPackage', key)}
                >
                  {key.toUpperCase()}
                  {CREDIT_PACKAGES[key].discountPct > 0 && (
                    <small>−{CREDIT_PACKAGES[key].discountPct}%</small>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="credit-results">
          <div className="credit-stat">
            <span>Required credits</span>
            <strong>{formatNumber(c.requiredCredits)}</strong>
          </div>
          <div className="credit-stat">
            <span>Package price</span>
            <strong>{formatCurrency(c.packagePrice)}</strong>
            <small>
              {pkg.label} credits
              {pkg.discountPct > 0 ? ` · ${pkg.discountPct}% discount` : ''}
            </small>
          </div>
          <div className="credit-stat">
            <span>Credits left after workload</span>
            <strong>{formatNumber(c.leftoverCredits)}</strong>
            {c.packagesNeeded > 1 && (
              <small>across {c.packagesNeeded} packages</small>
            )}
          </div>
          <div className="credit-stat">
            <span>Price per credit</span>
            <strong>{formatCreditCurrency(c.pricePerCredit)}</strong>
            <small>{formatCreditCurrency(c.pricePerRecord)} per record</small>
          </div>
          <p className={`credit-verdict ${c.covers ? 'ok' : 'warn'}`}>
            {c.covers
              ? `One ${pkg.label} package covers this workload.`
              : `Needs ${c.packagesNeeded} × ${pkg.label} packages (${formatCurrency(c.totalSpend)}). A larger package gets a bigger discount.`}
          </p>
        </div>
      </div>
      <p className="credit-foot">
        Estimates only. Credits per record should come from your actual agent
        consumption.
        {inputs.llmModel === 'byo' && ' Bring-your-own LLM provider charges are excluded.'}
      </p>
    </section>
  )
}

function ValueSections({
  result,
  inputs,
  onInput,
}: {
  result: ModelResult
  inputs: ModelInputs
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void
}) {
  const theme = useTheme()
  const palette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  // Both curves usually flatten to zero long before the horizon ends. Trailing
  // flat months make the chart unreadable, so trim to just past the last one.
  const lastActive = result.backlogProjection.reduce(
    (last, point, index) =>
      point.agentBacklog > 0 || point.manualBacklog > 0 ? index : last,
    0,
  )
  const backlogChartData = result.backlogProjection.slice(
    0,
    Math.min(result.backlogProjection.length, lastActive + 3),
  )
  const trimmedMonths = result.backlogProjection.length - backlogChartData.length

  return (
    <>
      <ResultHero
        headline="A transparent ROI model for autonomous data processing."
        equation={[
          { caption: 'WHAT IT COSTS', text: 'Processing + review + rework' },
          { caption: 'HOW LONG IT TAKES', text: 'The backlog, month by month' },
          { caption: 'HOW GOOD IT IS', text: 'Where every record ends up' },
        ]}
      />

      <RecordsCompareStrip result={result} inputs={inputs} />

      <div className="backlog-credit-grid">
        <section className="surface chart-surface scale-chart">
          <ChartHeader
            eyebrow="BACKLOG OVER TIME"
            unit="Records"
          />
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={backlogChartData}
                margin={{ top: 12, right: 16, left: 8, bottom: 30 }}
              >
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke={palette.grid}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: palette.axis, fontSize: 11 }}
                  interval={Math.max(0, Math.ceil(backlogChartData.length / 10) - 1)}
                  label={{
                    value: 'Months from start',
                    position: 'insideBottom',
                    offset: -22,
                    fill: palette.axis,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: palette.axis, fontSize: 11 }}
                  width={72}
                  tickFormatter={(value) => formatCompactNumber(value)}
                />
                <Tooltip
                  content={
                    <TooltipContent formatValue={(value) => formatNumber(value)} />
                  }
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="agentBacklog"
                  name="With AgentFlow"
                  stroke={palette.blue}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="manualBacklog"
                  name="Without AgentFlow"
                  stroke={palette.amber}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {trimmedMonths > 0 && (
            <p className="chart-footnote">
              Both lines reach zero in month {lastActive + 1}. The remaining{' '}
              {trimmedMonths} flat months are not drawn.
            </p>
          )}
        </section>

        <CreditPackageCard result={result} inputs={inputs} onInput={onInput} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Throughput — how the work lands year by year                        */
/* ------------------------------------------------------------------ */

/** The year-by-year picture and the two figures that summarise it, read
 * together: the chart on one side, what it comes to on the other. */
function ThroughputSections({
  result,
  inputs,
}: {
  result: ModelResult
  inputs: ModelInputs
}) {
  const theme = useTheme()
  const palette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  const yearOne = result.annual[0]
  const cadenceLabel = cadenceLabelFor(inputs.cadence)
  const noSchedule = inputs.cadence === 'not-set'
  // What the agent alone could run in a year, against what the stewards behind
  // it can actually finish — the two figures the card shows.
  const agentAnnualCapacity = Math.min(
    result.annualScheduledCapacity,
    result.annualRuntimeCapacity,
  )
  const runsAYear =
    inputs.processingRecordsPerRun > 0
      ? Math.round(
          result.annualScheduledCapacity / inputs.processingRecordsPerRun,
        )
      : 0
  const finishedPace =
    result.agentProcessingDays > 0
      ? (result.workloadRecords * 365) / result.agentProcessingDays
      : yearOne.records
  // The bars count finished records, not what the agent got through, so they
  // line up with the backlog curve and the elapsed time in the strip.
  const recordsByYear = result.annual.map((year) => ({
    name: `Year ${year.year}`,
    Finished: year.records,
  }))

  return (
    <div className="throughput-grid">
      <CardGroup label="What it comes to" tone="neutral">
        <MetricCard
          label="Processed in year one"
          value={formatCompactNumber(yearOne.agentProcessedRecords)}
          sub={`${formatCompactNumber(yearOne.records)} finished after review`}
          note={`Of ${formatNumber(yearOne.availableRecords)} available · ${formatNumber(inputs.processingRecordsPerRun)} per run, ${cadenceLabel} · review and rework set how many are finished`}
          icon={TrendingUp}
          calculation={{
            formula: 'What the agent runs, then what the team finishes behind it',
            description:
              'Year one opens with the whole backlog in front of it. The agent works to its run schedule, and review and rework run alongside at your stewards\u2019 capacity. The headline figure is what the agent got through; the second line is how much of it came out finished.',
            steps: [
              {
                label: 'Records waiting in year one',
                formula: 'Starting backlog + this year\u2019s arrivals',
                value: formatNumber(yearOne.availableRecords),
              },
              {
                label: 'What the agent can run in a year',
                formula: noSchedule
                  ? `${formatNumber(result.projectedThroughput)} records an hour, running continuously`
                  : `${formatNumber(inputs.processingRecordsPerRun)} per run × ${formatNumber(runsAYear)} runs a year`,
                value: Number.isFinite(agentAnnualCapacity)
                  ? formatNumber(agentAnnualCapacity)
                  : 'No ceiling',
                note: noSchedule
                  ? 'No run schedule is set, so nothing holds the agent back but its own compute.'
                  : `The schedule is what limits it here — ${formatNumber(inputs.workers)} workers could compute more than that in a year.`,
              },
              {
                label: 'The agent processes',
                formula: 'Lower of the two figures above',
                value: formatNumber(yearOne.agentProcessedRecords),
              },
              {
                label: 'What the team can finish in a year',
                formula: `${formatNumber(result.workloadRecords)} records ÷ ${formatDuration(result.agentProcessingDays * 24)} end to end`,
                value: formatNumber(finishedPace),
                note: 'Review and rework are steward work, so they run at your team\u2019s capacity no matter how fast the agent is.',
              },
              {
                label: 'Finished in year one',
                formula: 'Lower of what the agent ran and what the team cleared',
                value: formatNumber(yearOne.records),
                note: 'This is the figure the backlog curve and the year bars are drawn from.',
              },
            ],
            result: `${formatCompactNumber(yearOne.agentProcessedRecords)} processed · ${formatCompactNumber(yearOne.records)} finished`,
          }}
        />
        <MetricCard
          label={`Backlog left after ${inputs.horizonYears} ${inputs.horizonYears === 1 ? 'year' : 'years'}`}
          value={formatCompactNumber(result.endingBacklog)}
          note={
            result.endingBacklog > 0
              ? `${formatNumber(result.totalRecords)} of ${formatNumber(result.totalDemand)} records get processed — capacity runs out before the queue does`
              : `All ${formatNumber(result.totalDemand)} records are cleared inside the modeled horizon`
          }
          icon={Layers}
          tone={result.endingBacklog > 0 ? 'warning' : 'positive'}
          calculation={{
            formula:
              'Starting backlog + records arriving over the horizon − records processed',
            description: `Each year opens with whatever was left over, adds that year's new arrivals, and processes as much as capacity allows. Whatever is still queued when year ${inputs.horizonYears} ends is this number.`,
            steps: [
              {
                label: 'Starting backlog',
                formula: 'Backlog input',
                value: formatNumber(inputs.backlogRecords),
              },
              {
                label: 'New records arriving over the horizon',
                formula: `Monthly inflow of ${formatNumber(inputs.monthlyInflowPct)}%, compounded across ${inputs.horizonYears} ${inputs.horizonYears === 1 ? 'year' : 'years'}`,
                value: formatNumber(
                  result.totalDemand - inputs.backlogRecords,
                ),
              },
              {
                label: 'Records processed over the horizon',
                formula: 'Sum of each year\u2019s processed records',
                value: formatNumber(result.totalRecords),
              },
              {
                label: 'Left waiting at the end',
                formula: 'Total demand − total processed',
                value: formatNumber(result.endingBacklog),
              },
            ],
            result: `${formatNumber(result.endingBacklog)} records`,
          }}
        />
      </CardGroup>

      <article className="surface chart-surface">
        <ChartHeader
          eyebrow="RECORDS EACH YEAR"
          unit="Records"
        />
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={recordsByYear}
              margin={{ top: 18, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 5"
                vertical={false}
                stroke={palette.grid}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: palette.axis, fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: palette.axis, fontSize: 11 }}
                width={72}
                tickFormatter={(value) => formatCompactNumber(value)}
              />
              <Tooltip
                cursor={{ fill: 'var(--bg-sunken)' }}
                content={
                  <TooltipContent formatValue={(value) => formatNumber(value)} />
                }
              />
              <Bar
                dataKey="Finished"
                fill={palette.blue}
                radius={[5, 5, 0, 0]}
                maxBarSize={72}
              >
                <LabelList
                  dataKey="Finished"
                  position="top"
                  formatter={(value) => formatCompactNumber(Number(value))}
                  style={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-footnote">
          Year one carries the whole starting backlog, so it processes the most.
          Each later year picks up whatever was left over plus that year's new
          arrivals.{' '}
          {result.endingBacklog > 0
            ? `${formatNumber(result.endingBacklog)} records are still waiting when year ${inputs.horizonYears} ends.`
            : `Nothing is left waiting when year ${inputs.horizonYears} ends.`}
        </p>
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Decision quality                                                    */
/* ------------------------------------------------------------------ */

function QualitySankeyNode({
  x,
  y,
  width,
  height,
  index,
  payload,
  colors,
}: SankeyNodeProps & { colors: Record<string, string> }) {
  const fill = colors[payload.name] ?? 'var(--text-tertiary)'
  return (
    <Layer key={`quality-node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.9} />
      <text
        x={x + width + 8}
        y={y + height / 2 - 6}
        textAnchor="start"
        fontSize={11}
        fontWeight={600}
        fill="var(--text-primary)"
      >
        {payload.name}
      </text>
      <text
        x={x + width + 8}
        y={y + height / 2 + 9}
        textAnchor="start"
        fontSize={10}
        fontFamily="var(--font-mono)"
        fill="var(--text-tertiary)"
      >
        {formatNumber(payload.value)}
      </text>
    </Layer>
  )
}

function QualitySankeyLink({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
  colors,
}: SankeyLinkProps & { colors: Record<string, string> }) {
  const stroke = colors[payload.target.name] ?? 'var(--text-tertiary)'
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
      strokeWidth={linkWidth}
      strokeOpacity={0.32}
    />
  )
}

function QualitySections({ result }: { result: ModelResult }) {
  const theme = useTheme()
  const palette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS
  const q = result.quality
  // One picture instead of three: the donut (right/wrong), the outcome bar
  // (where the wrong ones go), and the silent-errors callout. A Sankey makes
  // the crossing between them visible — that a record can be both wrong and
  // auto-finalized, which is exactly the risk that matters. The two
  // wrong-decision kinds stay separate all the way through, so it is visible
  // which kind of mistake escaped unchecked rather than only how many.
  const qualityNodeColor: Record<string, string> = {
    'Records processed': palette.slate,
    'Decided correctly': palette.green,
    'Wrongly enriched': palette.red,
    'Wrongly not enriched': palette.amber,
    'Technical failures': palette.slate,
    'Auto-finalized': palette.blue,
    'Human-reviewed': palette.slate,
    'Wrong unchecked data': palette.red,
    'Caught in review': palette.cyan,
    Reprocessed: palette.slate,
  }
  const qualitySankeyData = {
    nodes: Object.keys(qualityNodeColor).map((name) => ({ name })),
    links: [
      { source: 0, target: 1, value: q.correctDecisions },
      { source: 0, target: 2, value: q.incorrectEnrichment },
      { source: 0, target: 3, value: q.incorrectNoEnrichment },
      { source: 0, target: 4, value: q.technicalFailures },
      { source: 1, target: 5, value: q.correctAutoFinalized },
      { source: 1, target: 6, value: q.correctReviewed },
      { source: 2, target: 7, value: q.incorrectEnrichmentAutoFinalized },
      { source: 2, target: 8, value: q.incorrectEnrichmentReviewed },
      { source: 3, target: 7, value: q.incorrectNoEnrichmentAutoFinalized },
      { source: 3, target: 8, value: q.incorrectNoEnrichmentReviewed },
      { source: 4, target: 9, value: q.technicalFailures },
    ],
  }

  return (
    <>
      <AnswerBanner eyebrow="DECISION QUALITY">
        AgentFlow gets <Key>{formatNumber(q.correctDecisions)}</Key> of{' '}
        <Key>{formatNumber(q.total)} records</Key> right.
      </AnswerBanner>

      <article className="surface quality-sankey-surface">
        <ChartHeader
          eyebrow="RECORD FLOW"
          title="Where every record ends up"
          unit="Records"
        />
        <div className="chart-frame quality-sankey-frame">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={qualitySankeyData}
              sort={false}
              nodeWidth={12}
              nodePadding={30}
              margin={{ top: 10, right: 210, bottom: 10, left: 10 }}
              node={(props: SankeyNodeProps) => (
                <QualitySankeyNode {...props} colors={qualityNodeColor} />
              )}
              link={(props: SankeyLinkProps) => (
                <QualitySankeyLink {...props} colors={qualityNodeColor} />
              )}
            />
          </ResponsiveContainer>
        </div>
      </article>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

/**
 * One page, read top to bottom: what the model is worth and how fast the
 * backlog drains, then how good the decisions are, then how the work lands
 * year by year. Every input lives in the one sidebar rather than being split
 * per section.
 */
export function Dashboard({
  result,
  inputs,
  onInput,
}: {
  result: ModelResult
  inputs: ModelInputs
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void
}) {
  return (
    <motion.div
      className="page-stack"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <ValueSections result={result} inputs={inputs} onInput={onInput} />
      <QualitySections result={result} />
      <ThroughputSections result={result} inputs={inputs} />
    </motion.div>
  )
}

