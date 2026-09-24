/**
 * How often AgentFlow runs. `not-set` means no schedule at all: runs start
 * back to back, so the agent's own compute time is the only thing pacing it.
 */
export type Cadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'on-demand'
  | 'not-set'

export type ModelInputs = {
  backlogRecords: number
  monthlyInflowPct: number
  cadence: Cadence
  processingRecordsPerRun: number
  onDemandRunsPerYear: number
  horizonYears: number
  manualMinutesPerRecord: number
  hourlyLaborRate: number
  dataStewards: number
  utilizationPct: number
  decisionAccuracyPct: number
  automationRatePct: number
  reviewMinutesPerRecord: number
  correctionMinutesPerRecord: number
  incorrectEnrichmentSharePct: number
  incorrectNoEnrichmentSharePct: number
  technicalFailureSharePct: number
  workers: number
  benchmarkRecords: number
  benchmarkMinutes: number
  benchmarkCustomerCost: number
  benchmarkWorkers: number
  /** What AgentFlow charges per record processed. Defaults to the measured
   * benchmark rate but is directly editable — it is not recomputed from the
   * benchmark, so a customer's actual negotiated rate can be modeled. */
  agentPricePerRecord: number
  /** Worker-minutes one record takes to process. Workers run in parallel, so
   * a run's elapsed time is this divided by the worker count — 150 workers get
   * through 150 records in the time one worker takes for one. */
  agentMinutesPerRecord: number
  discountRatePct: number
  includeDelayValue: boolean
  delayValuePerRecordMonth: number
  includeDownstreamValue: boolean
  downstreamValuePerCorrectRecord: number
}

export type Scenario = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  inputs: ModelInputs
}

export type QualityBreakdown = {
  total: number
  correctDecisions: number
  incorrectDecisions: number
  autoFinalized: number
  humanReview: number
  incorrectEnrichment: number
  incorrectNoEnrichment: number
  technicalFailures: number
  incorrectAutoFinalized: number
  /**
   * Five mutually exclusive outcomes that sum to `total`. Correctness and the
   * automation rate are crossed assuming independence, which the proposal
   * flags as an unmeasured joint distribution.
   */
  correctAutoFinalized: number
  correctReviewed: number
  incorrectReviewed: number
  /**
   * The two wrong-decision kinds crossed with the automation rate, so the
   * record flow can show which kind of mistake escaped unchecked rather than
   * pooling them. Each pair sums to its parent kind.
   */
  incorrectEnrichmentAutoFinalized: number
  incorrectEnrichmentReviewed: number
  incorrectNoEnrichmentAutoFinalized: number
  incorrectNoEnrichmentReviewed: number
}

export type AnnualResult = {
  year: number
  openingBacklog: number
  incomingRecords: number
  availableRecords: number
  processingCapacity: number
  records: number
  /** What the agent alone gets through this year, before review and rework
   * pace how many of those records are actually finished. */
  agentProcessedRecords: number
  closingBacklog: number
  laborRate: number
  manualHours: number
  manualCost: number
  reviewHours: number
  remediationHours: number
  capacityHours: number
  agentCost: number
  reviewCost: number
  remediationCost: number
  delayValue: number
  downstreamValue: number
  /** The full manual-equivalent cost of the work done this year (+ any
   * optional delay/downstream value) — the value AgentFlow avoided. */
  totalBenefits: number
  /** Everything it costs to run AgentFlow this year: its own fee, review,
   * and fixing mistakes. */
  totalCosts: number
  netValue: number
  discountedNetValue: number
}

/**
 * Every component behind the two comparison-strip rows. The strip shows four
 * headline figures and each one can be opened up, so the parts are published
 * here rather than re-derived in the view, where they could drift.
 */
export type WorkloadBreakdown = {
  /** Backlog plus horizon arrivals — the pile both sides are priced on. */
  records: number
  /* --- doing it by hand --- */
  manualHours: number
  manualCost: number
  /** Records the steward team can finish in one calendar month. */
  manualMonthlyCapacity: number
  /* --- doing it with the agent --- */
  /** Records that broke before producing a decision and are run again. */
  technicalFailures: number
  /** Runs the agent is billed for: every record, plus each retry. */
  billedRuns: number
  processingCost: number
  /** Records a person opens: decided records that were not auto-finalized. */
  reviewedRecords: number
  reviewHours: number
  reviewCost: number
  /** Wrong decisions that were auto-finalized and reached the data. */
  uncheckedErrors: number
  remediationHours: number
  remediationCost: number
  agentCost: number
  /* --- how long the agent takes --- */
  agentRuns: number
  /** Elapsed days each full run consumes: its interval, or its own runtime. */
  agentPerRunDays: number
  /** Records left for the final run, which is usually a part load. */
  agentLastRunRecords: number
  /** The final run is usually short, so it is timed on its actual size. */
  agentLastRunHours: number
  /** The scheduled gap between runs. Zero when no cadence is set. */
  agentScheduleGapDays: number
  /** Compute time a full run takes on its own, before any schedule applies. */
  agentRunComputeHours: number
  /** Calendar days the run schedule alone takes, retries included. */
  agentScheduleDays: number
  /** Steward hours of review and rework the agent's output still creates. */
  agentHumanHours: number
  /** Those hours as calendar days, at the steward team's daily capacity. */
  agentHumanDays: number
}

export type ModelResult = {
  annual: AnnualResult[]
  backlogProjection: Array<{
    month: number
    label: string
    agentBacklog: number
    manualBacklog: number
  }>
  /**
   * How every record processed across the horizon splits by outcome. Scoped to
   * `totalRecords`, not the starting backlog, so it counts new arrivals and
   * agrees with the cost and capacity figures.
   */
  quality: QualityBreakdown
  totalRecords: number
  totalDemand: number
  endingBacklog: number
  /** Full manual-equivalent cost of the work done (+ optional delay/downstream value). */
  totalBenefits: number
  /** Everything AgentFlow costs: its fee, review, and fixing mistakes. */
  totalCosts: number
  netValue: number
  npv: number
  roiPct: number
  paybackMonths: number | null
  costPerCorrectRecord: number
  manualDailyCapacity: number
  manualCostPerRecord: number
  /**
   * The pile the comparison strip prices: the starting backlog, plus new
   * arrivals over the horizon. Not capped by how much either side can finish
   * inside those years.
   */
  workloadRecords: number
  /** Hand-labor cost of `workloadRecords`. */
  workloadManualCost: number
  /** AgentFlow fee + review + rework on `workloadRecords`. */
  workloadAgentCost: number
  /** The parts those two totals are built from, for the calculation modals. */
  workload: WorkloadBreakdown
  /** Three-year manual baseline: what the same work costs with no agent. */
  totalManualHours: number
  totalManualCost: number
  /** Human hours still needed alongside the agent: review + remediation. */
  retainedHours: number
  manualCompletionDays: number
  agentCompletionHours: number
  /** Elapsed calendar days for the team to process every record the model
   * covers, at the capacity its steward count and utilization allow. */
  manualProcessingDays: number
  /** The same records, paced by the agent's run schedule and throughput. */
  agentProcessingDays: number
  timeSavedDays: number
  capacityHours: number
  /**
   * Productive hours the whole steward team delivers in one working day. This
   * sets how fast the team can work through the backlog.
   */
  teamDayHours: number
  /** Productive hours one steward delivers in a working day, after utilization. */
  stewardDayHours: number
  /** Freed hours expressed as working days for a single steward. */
  capacityStewardDays: number
  agentUnitCost: number
  projectedThroughput: number
  annualScheduledCapacity: number
  annualRuntimeCapacity: number
  /** Which side of the min() actually limits annual processing capacity. */
  bindingConstraint: 'schedule' | 'runtime' | 'tied'
  totalAgentProcessingCost: number
  agentFlowThreeYearCost: number
  assumptionsWarning: string[]
}

export const WEEKS_PER_MONTH = 4.345
export const WORKING_DAYS_PER_MONTH = 20
export const CALENDAR_DAYS_PER_MONTH = 30.4375
/**
 * Extra runs a technically failed record buys. It produced no decision, so it
 * goes back through the pipeline twice more — three runs billed and three runs
 * of schedule time in total, against one for every record that succeeds.
 */
export const RETRY_RUNS_PER_TECHNICAL_FAILURE = 2

const now = new Date().toISOString()

export const DEFAULT_INPUTS: ModelInputs = {
  backlogRecords: 1_000_000,
  monthlyInflowPct: 0,
  cadence: 'not-set',
  processingRecordsPerRun: 20_000,
  onDemandRunsPerYear: 1,
  horizonYears: 3,
  manualMinutesPerRecord: 5,
  hourlyLaborRate: 72,
  dataStewards: 5,
  utilizationPct: 90,
  decisionAccuracyPct: 91,
  automationRatePct: 90,
  reviewMinutesPerRecord: 5,
  correctionMinutesPerRecord: 10,
  incorrectEnrichmentSharePct: 50,
  incorrectNoEnrichmentSharePct: 35,
  technicalFailureSharePct: 15,
  workers: 150,
  benchmarkRecords: 20_000,
  benchmarkMinutes: 695,
  benchmarkCustomerCost: 5_215,
  benchmarkWorkers: 150,
  // The measured run billed $5,215 / 20,000 = $0.26075. $2.30 is the
  // commercial rate this model ships with, not that observed unit cost.
  agentPricePerRecord: 2.3,
  // The measured run implies 5.2125 worker-minutes per record (695 minutes on
  // 150 workers for 20,000), so 2 is a deliberately faster assumption.
  agentMinutesPerRecord: 2,
  discountRatePct: 4,
  includeDelayValue: false,
  delayValuePerRecordMonth: 0.05,
  includeDownstreamValue: false,
  downstreamValuePerCorrectRecord: 0,
}

export function createScenario(name = 'Measured benchmark'): Scenario {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    inputs: { ...DEFAULT_INPUTS },
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator
}

function qualityForRecords(records: number, inputs: ModelInputs): QualityBreakdown {
  const accuracy = clamp(inputs.decisionAccuracyPct, 0, 100) / 100
  const automation = clamp(inputs.automationRatePct, 0, 100) / 100
  const residual = records * (1 - accuracy)
  const splitTotal =
    inputs.incorrectEnrichmentSharePct +
    inputs.incorrectNoEnrichmentSharePct +
    inputs.technicalFailureSharePct
  const normalized = splitTotal > 0 ? splitTotal : 100

  const incorrectEnrichment =
    residual * (inputs.incorrectEnrichmentSharePct / normalized)
  const incorrectNoEnrichment =
    residual * (inputs.incorrectNoEnrichmentSharePct / normalized)
  const technicalFailures =
    residual * (inputs.technicalFailureSharePct / normalized)

  const correctDecisions = records * accuracy
  const reviewableIncorrect = incorrectEnrichment + incorrectNoEnrichment
  // Technical failures never reach the auto-finalize/review fork — they break
  // before a decision exists and go back through the pipeline instead. Only
  // the records that actually produced a decision get split.
  const decided = correctDecisions + reviewableIncorrect

  return {
    total: records,
    correctDecisions,
    incorrectDecisions: residual,
    autoFinalized: decided * automation,
    humanReview: decided * (1 - automation),
    incorrectEnrichment,
    incorrectNoEnrichment,
    technicalFailures,
    incorrectAutoFinalized: reviewableIncorrect * automation,
    correctAutoFinalized: correctDecisions * automation,
    correctReviewed: correctDecisions * (1 - automation),
    incorrectReviewed: reviewableIncorrect * (1 - automation),
    incorrectEnrichmentAutoFinalized: incorrectEnrichment * automation,
    incorrectEnrichmentReviewed: incorrectEnrichment * (1 - automation),
    incorrectNoEnrichmentAutoFinalized: incorrectNoEnrichment * automation,
    incorrectNoEnrichmentReviewed: incorrectNoEnrichment * (1 - automation),
  }
}

/** Hours to do a pile of records by hand, and the hours still spent if the
 * agent does that same pile: review of every record a person looks at, plus
 * rework of every wrong decision that reached the data unchecked. */
function laborForRecords(records: number, inputs: ModelInputs) {
  const quality = qualityForRecords(records, inputs)
  const manualHours = (records * inputs.manualMinutesPerRecord) / 60
  // Charged on every reviewed record, whether the agent got it right or the
  // reviewer caught a mistake — checking costs the same either way.
  const reviewHours =
    (quality.humanReview * inputs.reviewMinutesPerRecord) / 60
  // Only the wrong decisions nobody saw. Reviewed mistakes were caught at the
  // desk; technical failures are reprocessed, not repaired by hand.
  const remediationHours =
    (quality.incorrectAutoFinalized * inputs.correctionMinutesPerRecord) / 60
  return { quality, manualHours, reviewHours, remediationHours }
}

function runsPerYear(inputs: ModelInputs) {
  if (inputs.cadence === 'daily') return 365
  if (inputs.cadence === 'weekly') return 52
  if (inputs.cadence === 'monthly') return 12
  // With no schedule there is no ceiling on how many runs fit in a year, so
  // scheduled capacity must never be the binding constraint.
  if (inputs.cadence === 'not-set') return Number.POSITIVE_INFINITY
  return Math.max(1, Math.round(inputs.onDemandRunsPerYear))
}

function cadenceIntervalDays(inputs: ModelInputs) {
  if (inputs.cadence === 'daily') return 1
  if (inputs.cadence === 'weekly') return 7
  if (inputs.cadence === 'monthly') return CALENDAR_DAYS_PER_MONTH
  // No gap to wait out — the next run starts as soon as the last one ends.
  if (inputs.cadence === 'not-set') return 0
  return 365 / Math.max(1, inputs.onDemandRunsPerYear)
}

/** Longest queue the chart will draw, so a barely-moving line cannot run the
 * projection out to thousands of months. */
const MAX_PROJECTION_MONTHS = 360

/**
 * The month-by-month queue for both ways of working. Both lines work through
 * the same pile the comparison strip prices — the whole backlog plus the
 * arrivals the horizon covers — at the same all-in pace the strip reports, so
 * each line reaches zero on exactly the elapsed time shown in the strip
 * instead of on a faster processing-only pace.
 */
function buildBacklogProjection(
  inputs: ModelInputs,
  workloadRecords: number,
  agentMonths: number,
  manualMonths: number,
) {
  // Arrivals stop where the priced workload stops: the horizon buys a fixed
  // number of months of new records, and the queue is worked down from there.
  const arrivalMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12
  const monthlyIncoming =
    inputs.backlogRecords * (inputs.monthlyInflowPct / 100)
  // Records cleared per month = the whole pile spread over the elapsed time
  // the strip reports. No elapsed time at all means nothing holds the work up.
  const capacityFor = (months: number) =>
    months > 0 ? workloadRecords / months : Number.POSITIVE_INFINITY
  const agentMonthlyCapacity = capacityFor(agentMonths)
  const manualMonthlyCapacity = capacityFor(manualMonths)
  const drawMonths = (months: number) =>
    Math.ceil(Math.min(months, MAX_PROJECTION_MONTHS)) + 1
  const months = Math.min(
    MAX_PROJECTION_MONTHS,
    Math.max(
      12,
      arrivalMonths,
      drawMonths(agentMonths),
      drawMonths(manualMonths),
    ),
  )
  let agentBacklog = inputs.backlogRecords
  let manualBacklog = inputs.backlogRecords

  return Array.from({ length: months + 1 }, (_, month) => {
    if (month > 0) {
      const arriving = month <= arrivalMonths ? monthlyIncoming : 0
      agentBacklog = Math.max(
        0,
        agentBacklog + arriving - agentMonthlyCapacity,
      )
      manualBacklog = Math.max(
        0,
        manualBacklog + arriving - manualMonthlyCapacity,
      )
    }
    return {
      month,
      label: month === 0 ? 'Start' : `M${month}`,
      agentBacklog,
      manualBacklog,
    }
  })
}

/**
 * The first month cumulative net value turns positive. With no one-time cost
 * to earn back, that is the first month AgentFlow costs less to run than doing
 * the same work by hand.
 */
function calculatePaybackMonths(annual: AnnualResult[]) {
  let cumulative = 0
  for (const year of annual) {
    const monthlyNet = (year.totalBenefits - year.totalCosts) / 12
    if (monthlyNet <= 0) continue
    for (let month = 1; month <= 12; month += 1) {
      cumulative += monthlyNet
      if (cumulative >= 0) return (year.year - 1) * 12 + month
    }
  }
  return null
}

export function calculateModel(inputs: ModelInputs): ModelResult {
  const agentUnitCost = inputs.agentPricePerRecord
  // Workers process records in parallel, so throughput is simply how many
  // worker-minutes a record costs spread across the workers available. At zero
  // worker-minutes a record costs no compute time at all, which makes runtime
  // unbounded rather than nil — dividing would read that as a stalled pipeline
  // that processes nothing.
  const projectedThroughput =
    inputs.agentMinutesPerRecord > 0
      ? safeDivide(inputs.workers * 60, inputs.agentMinutesPerRecord)
      : Number.POSITIVE_INFINITY
  /** Elapsed hours for one run of the given size. */
  const runHoursFor = (records: number) =>
    safeDivide(records * inputs.agentMinutesPerRecord, inputs.workers * 60)

  const years = Math.max(1, Math.round(inputs.horizonYears))
  const monthlyIncoming =
    inputs.backlogRecords * (inputs.monthlyInflowPct / 100)
  const annualScheduledCapacity =
    inputs.processingRecordsPerRun * runsPerYear(inputs)
  const annualRuntimeCapacity = projectedThroughput * 24 * 365
  const bindingConstraint: 'schedule' | 'runtime' | 'tied' =
    annualScheduledCapacity === annualRuntimeCapacity
      ? 'tied'
      : annualScheduledCapacity < annualRuntimeCapacity
        ? 'schedule'
        : 'runtime'
  const stewardDayHours = 8 * (clamp(inputs.utilizationPct, 0, 100) / 100)
  const teamDayHours = inputs.dataStewards * stewardDayHours
  const manualDailyCapacity =
    teamDayHours * safeDivide(60, inputs.manualMinutesPerRecord)
  const manualMonthlyCapacity = manualDailyCapacity * WORKING_DAYS_PER_MONTH
  const manualCompletionMonths = safeDivide(
    inputs.backlogRecords,
    manualMonthlyCapacity,
  )
  // Elapsed calendar days for the agent to get through a given number of
  // records. Earlier runs' compute happens inside the wait for the next
  // scheduled run, so only the final run's time lands on the end of the
  // schedule. A run slower than its own interval paces itself instead.
  const agentScheduleFor = (records: number) => {
    const fullRunSize = inputs.processingRecordsPerRun
    const runsNeeded = Math.ceil(safeDivide(records, fullRunSize))
    if (runsNeeded <= 0)
      return {
        runsNeeded: 0,
        perRunDays: 0,
        lastRunRecords: 0,
        lastRunHours: 0,
        days: 0,
      }
    const lastRunRecords = records - (runsNeeded - 1) * fullRunSize
    const perRunDays = Math.max(
      cadenceIntervalDays(inputs),
      runHoursFor(fullRunSize) / 24,
    )
    const lastRunHours = runHoursFor(lastRunRecords)
    return {
      runsNeeded,
      perRunDays,
      lastRunRecords,
      lastRunHours,
      days: (runsNeeded - 1) * perRunDays + lastRunHours / 24,
    }
  }
  /**
   * Calendar days for the agent to finish a pile end to end. Two stages run
   * side by side, not one after the other: the agent keeps processing while
   * the stewards review and repair what it has already produced. So the
   * stage that takes longer sets the finish date — adding them would charge
   * the same calendar twice.
   */
  const agentElapsedFor = (records: number) => {
    const labor = laborForRecords(records, inputs)
    const schedule = agentScheduleFor(
      records +
        RETRY_RUNS_PER_TECHNICAL_FAILURE * labor.quality.technicalFailures,
    )
    const humanHours = labor.reviewHours + labor.remediationHours
    const humanDays =
      safeDivide(humanHours, teamDayHours) *
      (CALENDAR_DAYS_PER_MONTH / WORKING_DAYS_PER_MONTH)
    return {
      schedule,
      humanHours,
      humanDays,
      days: Math.max(schedule.days, humanDays),
    }
  }
  // The pile the comparison strip prices, known before the year rows are
  // built: how many records arrive depends on the horizon, not on how fast
  // the work gets done. The backlog is never cut by the horizon.
  const workloadRecords = inputs.backlogRecords + monthlyIncoming * 12 * years
  const workloadElapsed = agentElapsedFor(workloadRecords)
  const agentProcessingDays = workloadElapsed.days
  /**
   * Records a year can finish end to end. A year cannot clear more than the
   * schedule can run, more than the runtime can compute, or more than the
   * stewards can review and rework behind the agent. Without that last limit a
   * year row could claim to clear a pile the elapsed-time row says takes
   * several years.
   */
  const allInAnnualCapacity =
    agentProcessingDays > 0
      ? (workloadRecords * 365) / agentProcessingDays
      : Number.POSITIVE_INFINITY
  /** What the agent can get through in a year on its own — the schedule and
   * its compute, with no steward behind it. */
  const agentAnnualCapacity = Math.min(
    annualScheduledCapacity,
    annualRuntimeCapacity,
  )
  const annualProcessingCapacity = Math.min(
    agentAnnualCapacity,
    allInAnnualCapacity,
  )
  // When the backlog curve reaches zero: processing only, since a record
  // leaves the backlog once the agent has handled it. The review and rework it
  // creates is counted in `agentProcessingDays`, not here.
  const scheduledCompletionDays = agentScheduleFor(inputs.backlogRecords).days
  const agentCompletionMonths = scheduledCompletionDays / CALENDAR_DAYS_PER_MONTH
  const monthsAccelerated = Math.max(
    0,
    manualCompletionMonths - agentCompletionMonths,
  )
  const annual: AnnualResult[] = []
  let openingBacklog = inputs.backlogRecords
  for (let index = 0; index < years; index += 1) {
    const year = index + 1
    const incomingRecords = monthlyIncoming * 12
    const availableRecords = openingBacklog + incomingRecords
    const processingCapacity = annualProcessingCapacity
    const records = Math.min(availableRecords, processingCapacity)
    const agentProcessedRecords = Math.min(availableRecords, agentAnnualCapacity)
    const closingBacklog = Math.max(0, availableRecords - records)
    const laborRate = inputs.hourlyLaborRate
    const { quality, manualHours, reviewHours, remediationHours } =
      laborForRecords(records, inputs)
    // Hours the team gets back for other work, after review and fixing.
    const capacityHours = Math.max(
      0,
      manualHours - reviewHours - remediationHours,
    )
    const manualCost = manualHours * laborRate
    const agentCost =
      (records +
        RETRY_RUNS_PER_TECHNICAL_FAILURE * quality.technicalFailures) *
      agentUnitCost
    const reviewCost = reviewHours * laborRate
    const remediationCost = remediationHours * laborRate

    const backlogRecordsCleared = Math.min(inputs.backlogRecords, records)
    const delayValue =
      inputs.includeDelayValue && year === 1
        ? backlogRecordsCleared *
          inputs.delayValuePerRecordMonth *
          monthsAccelerated
        : 0
    const downstreamValue = inputs.includeDownstreamValue
      ? quality.correctDecisions * inputs.downstreamValuePerCorrectRecord
      : 0
    // Benefit = the full manual-equivalent cost avoided by using AgentFlow
    // instead of doing this work by hand, plus any optional delay/downstream
    // value. Cost = the full price of running AgentFlow: its own fee, review,
    // and fixing mistakes. Net value is simply "what would this have
    // cost by hand" minus "what AgentFlow actually costs."
    const totalBenefits = manualCost + delayValue + downstreamValue
    const totalCosts = agentCost + reviewCost + remediationCost
    const netValue = totalBenefits - totalCosts
    const discountedNetValue =
      netValue / Math.pow(1 + inputs.discountRatePct / 100, year)

    annual.push({
      year,
      openingBacklog,
      incomingRecords,
      availableRecords,
      processingCapacity,
      records,
      agentProcessedRecords,
      closingBacklog,
      laborRate,
      manualHours,
      manualCost,
      reviewHours,
      remediationHours,
      capacityHours,
      agentCost,
      reviewCost,
      remediationCost,
      delayValue,
      downstreamValue,
      totalBenefits,
      totalCosts,
      netValue,
      discountedNetValue,
    })
    openingBacklog = closingBacklog
  }

  const totalRecords = annual.reduce((sum, row) => sum + row.records, 0)
  // Everything asking to be processed: the same pile the strip prices, which
  // is the whole backlog plus every arrival the year rows added to it.
  const totalDemand = workloadRecords
  const endingBacklog = annual.at(-1)?.closingBacklog ?? 0
  const totalBenefits = annual.reduce((sum, row) => sum + row.totalBenefits, 0)
  const totalCosts = annual.reduce((sum, row) => sum + row.totalCosts, 0)
  const netValue = totalBenefits - totalCosts
  const npv = annual.reduce((sum, row) => sum + row.discountedNetValue, 0)
  const roiPct = safeDivide(netValue, totalCosts) * 100
  const totalCorrect = totalRecords * (inputs.decisionAccuracyPct / 100)
  const quality = qualityForRecords(totalRecords, inputs)
  const manualCompletionDays = manualCompletionMonths * CALENDAR_DAYS_PER_MONTH
  const agentCompletionHours = scheduledCompletionDays * 24
  const workloadLabor = laborForRecords(workloadRecords, inputs)
  const workloadManualCost =
    workloadLabor.manualHours * inputs.hourlyLaborRate
  const workloadBilledRuns =
    workloadRecords +
    RETRY_RUNS_PER_TECHNICAL_FAILURE * workloadLabor.quality.technicalFailures
  const workloadProcessingCost = workloadBilledRuns * agentUnitCost
  const workloadReviewCost =
    workloadLabor.reviewHours * inputs.hourlyLaborRate
  const workloadRemediationCost =
    workloadLabor.remediationHours * inputs.hourlyLaborRate
  const workloadAgentCost =
    workloadProcessingCost + workloadReviewCost + workloadRemediationCost
  // Elapsed time for the same pile the cost row prices. Manual is paced by
  // steward capacity; AgentFlow by its run schedule and throughput, already
  // measured above because the year rows are paced by it too.
  const manualProcessingDays =
    safeDivide(workloadRecords, manualMonthlyCapacity) * CALENDAR_DAYS_PER_MONTH
  const workloadSchedule = workloadElapsed.schedule
  const workload: WorkloadBreakdown = {
    records: workloadRecords,
    manualHours: workloadLabor.manualHours,
    manualCost: workloadManualCost,
    manualMonthlyCapacity,
    technicalFailures: workloadLabor.quality.technicalFailures,
    billedRuns: workloadBilledRuns,
    processingCost: workloadProcessingCost,
    reviewedRecords: workloadLabor.quality.humanReview,
    reviewHours: workloadLabor.reviewHours,
    reviewCost: workloadReviewCost,
    uncheckedErrors: workloadLabor.quality.incorrectAutoFinalized,
    remediationHours: workloadLabor.remediationHours,
    remediationCost: workloadRemediationCost,
    agentCost: workloadAgentCost,
    agentRuns: workloadSchedule.runsNeeded,
    agentPerRunDays: workloadSchedule.perRunDays,
    agentLastRunRecords: workloadSchedule.lastRunRecords,
    agentLastRunHours: workloadSchedule.lastRunHours,
    agentScheduleGapDays: cadenceIntervalDays(inputs),
    agentRunComputeHours: runHoursFor(inputs.processingRecordsPerRun),
    agentScheduleDays: workloadSchedule.days,
    agentHumanHours: workloadElapsed.humanHours,
    agentHumanDays: workloadElapsed.humanDays,
  }
  const timeSavedDays = Math.max(
    0,
    manualCompletionDays - agentCompletionHours / 24,
  )
  const capacityHours = annual.reduce((sum, row) => sum + row.capacityHours, 0)

  const totalAgentProcessingCost = annual.reduce(
    (sum, row) => sum + row.agentCost,
    0,
  )

  const warnings: string[] = []
  if (inputs.backlogRecords > inputs.benchmarkRecords) {
    warnings.push('Scale results extrapolate beyond the measured 20,000-record run.')
  }
  if (inputs.workers !== inputs.benchmarkWorkers) {
    warnings.push('Worker timing scales linearly from the observed run, with no contention modeled.')
  }
  if (inputs.includeDownstreamValue) {
    warnings.push('Downstream value is assumption-driven and should use customer evidence.')
  }
  if (inputs.automationRatePct > inputs.decisionAccuracyPct) {
    warnings.push('Automation exceeds measured correctness, increasing unreviewed error risk.')
  }
  if (endingBacklog > 0) {
    warnings.push(
      `${formatNumber(endingBacklog)} records remain after the modeled processing plan.`,
    )
  }
  const runRuntimeHours = safeDivide(
    inputs.processingRecordsPerRun,
    projectedThroughput,
  )
  const cadenceHours = cadenceIntervalDays(inputs) * 24
  // Without a schedule there is no "next run" to be late for.
  if (inputs.cadence !== 'not-set' && runRuntimeHours > cadenceHours) {
    warnings.push(
      'Records per run exceed modeled throughput before the next scheduled run.',
    )
  }

  return {
    annual,
    backlogProjection: buildBacklogProjection(
      inputs,
      workloadRecords,
      agentProcessingDays / CALENDAR_DAYS_PER_MONTH,
      manualProcessingDays / CALENDAR_DAYS_PER_MONTH,
    ),
    quality,
    totalRecords,
    totalDemand,
    endingBacklog,
    totalBenefits,
    totalCosts,
    netValue,
    npv,
    roiPct,
    paybackMonths: calculatePaybackMonths(annual),
    costPerCorrectRecord: safeDivide(totalCosts, totalCorrect),
    workloadRecords,
    workloadManualCost,
    workloadAgentCost,
    workload,
    manualDailyCapacity,
    manualCostPerRecord:
      (inputs.manualMinutesPerRecord / 60) * inputs.hourlyLaborRate,
    totalManualHours: annual.reduce((sum, row) => sum + row.manualHours, 0),
    totalManualCost: annual.reduce((sum, row) => sum + row.manualCost, 0),
    retainedHours: annual.reduce(
      (sum, row) => sum + row.reviewHours + row.remediationHours,
      0,
    ),
    manualCompletionDays,
    agentCompletionHours,
    manualProcessingDays,
    agentProcessingDays,
    timeSavedDays,
    capacityHours,
    teamDayHours,
    stewardDayHours,
    capacityStewardDays: safeDivide(capacityHours, stewardDayHours),
    agentUnitCost,
    projectedThroughput,
    annualScheduledCapacity,
    annualRuntimeCapacity,
    bindingConstraint,
    totalAgentProcessingCost,
    agentFlowThreeYearCost: totalCosts,
    assumptionsWarning: warnings,
  }
}

export type SensitivitySwing = {
  key: keyof ModelInputs
  label: string
  low: number
  high: number
  unit: string
  provenance: 'Measured' | 'Benchmark' | 'Assumption' | 'No source'
}

/**
 * Plausible ranges for the inputs most likely to move the answer. Used to show
 * the customer which assumptions their result actually depends on.
 */
const SENSITIVITY_SWINGS: SensitivitySwing[] = [
  { key: 'manualMinutesPerRecord', label: 'Manual minutes per record', low: 3, high: 10, unit: ' min', provenance: 'Assumption' },
  { key: 'correctionMinutesPerRecord', label: 'Rework minutes per record', low: 2, high: 15, unit: ' min', provenance: 'No source' },
  { key: 'decisionAccuracyPct', label: 'Decision correctness', low: 80, high: 97, unit: '%', provenance: 'Measured' },
  { key: 'reviewMinutesPerRecord', label: 'Review minutes per record', low: 1, high: 6, unit: ' min', provenance: 'Assumption' },
  { key: 'automationRatePct', label: 'Auto-finalized share', low: 70, high: 99, unit: '%', provenance: 'Assumption' },
  { key: 'hourlyLaborRate', label: 'Fully loaded labor rate', low: 55, high: 95, unit: '/hr', provenance: 'Benchmark' },
  { key: 'monthlyInflowPct', label: 'New records per month', low: 0, high: 3, unit: '%', provenance: 'No source' },
]

export type SensitivityRow = SensitivitySwing & {
  lowNpv: number
  highNpv: number
  span: number
  crossesZero: boolean
}

/** Re-runs the model once per swing to rank inputs by their effect on NPV. */
export function computeSensitivity(
  inputs: ModelInputs,
  limit = SENSITIVITY_SWINGS.length,
): SensitivityRow[] {
  return SENSITIVITY_SWINGS.map((swing) => {
    const lowNpv = calculateModel({ ...inputs, [swing.key]: swing.low }).npv
    const highNpv = calculateModel({ ...inputs, [swing.key]: swing.high }).npv
    return {
      ...swing,
      lowNpv,
      highNpv,
      span: Math.abs(highNpv - lowNpv),
      crossesZero: Math.min(lowNpv, highNpv) < 0 && Math.max(lowNpv, highNpv) > 0,
    }
  })
    .sort((a, b) => b.span - a.span)
    .slice(0, limit)
}

export type AutomationPoint = {
  automationPct: number
  silentErrors: number
  checkingCost: number
}

/**
 * Re-splits every record processed across the horizon at a few auto-finalized
 * settings, so the page can show what the slider buys: less checking labor,
 * more wrong records reaching the data unseen. Checking cost is still priced
 * per year (year one), since cost is inherently a recurring, not one-time,
 * figure.
 */
export function computeAutomationTradeoff(
  inputs: ModelInputs,
  levels: number[],
): AutomationPoint[] {
  return levels.map((automationPct) => {
    const result = calculateModel({
      ...inputs,
      automationRatePct: automationPct,
    })
    const yearOne = result.annual[0]
    return {
      automationPct,
      silentErrors: result.quality.incorrectAutoFinalized,
      checkingCost:
        (yearOne?.reviewCost ?? 0) + (yearOne?.remediationCost ?? 0),
    }
  })
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

/** Currency at cent precision — for per-record figures where rounding misleads. */
export function formatUnitCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value)
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value)
}

/**
 * Elapsed time as a customer would say it out loud: years and months once it
 * runs that long, days below a month. Both columns of the comparison use this,
 * so the two stay directly comparable at a glance.
 */
export function formatDuration(hours: number) {
  const days = hours / 24
  if (days < 1) return `${formatNumber(hours, 1)} hours`
  if (days < CALENDAR_DAYS_PER_MONTH) {
    return `${formatNumber(days, 1)} day${days < 1.05 ? '' : 's'}`
  }

  const totalMonths = days / CALENDAR_DAYS_PER_MONTH
  let years = Math.floor(totalMonths / 12)
  let months = Math.round(totalMonths - years * 12)
  // Rounding 11.6 months up must carry into the year, not read "0 yrs 12 mo".
  if (months === 12) {
    years += 1
    months = 0
  }

  if (years === 0) return `${months} month${months === 1 ? '' : 's'}`
  const yearPart = `${years} yr${years === 1 ? '' : 's'}`
  return months === 0 ? yearPart : `${yearPart} ${months} mo`
}

