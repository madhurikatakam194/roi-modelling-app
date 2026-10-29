import { describe, expect, it } from 'vitest'
import {
  CALENDAR_DAYS_PER_MONTH,
  calculateModel,
  DEFAULT_INPUTS,
  formatDuration,
  RETRY_RUNS_PER_TECHNICAL_FAILURE,
  WORKING_DAYS_PER_MONTH,
} from './model'

describe('calculateModel', () => {
  it('reproduces the measured AEA2 unit economics', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      // The benchmark is a single 20,000-record run, so the workload has to
      // match it exactly for the measured figures to come back out.
      backlogRecords: 20_000,
      processingRecordsPerRun: 20_000,
      monthlyInflowPct: 0,
      horizonYears: 1,
      automationRatePct: 100,
      decisionAccuracyPct: 100,
      // The shipped defaults are commercial assumptions, so the measured rate
      // and effort have to be restated here for the observed figures to reappear.
      agentPricePerRecord: 5_215 / 20_000,
      agentMinutesPerRecord: (695 * 150) / 20_000,
    })

    expect(result.agentUnitCost).toBeCloseTo(0.26075, 5)
    expect(result.projectedThroughput).toBeCloseTo(1726.62, 1)
    expect(result.agentCompletionHours).toBeCloseTo(695 / 60, 2)
    expect(result.annual[0].agentCost).toBeCloseTo(5215, 2)
  })

  it('prices AgentFlow from the editable rate, independent of the benchmark fields', () => {
    const measured = calculateModel(DEFAULT_INPUTS)
    const negotiated = calculateModel({
      ...DEFAULT_INPUTS,
      agentPricePerRecord: 3,
    })

    expect(measured.agentUnitCost).toBeCloseTo(2.3, 6)
    expect(negotiated.agentUnitCost).toBeCloseTo(3, 6)
    expect(negotiated.totalCosts).toBeGreaterThan(measured.totalCosts)
    // Changing the negotiated rate must not silently move the benchmark
    // evidence numbers (throughput is still derived from the observed run).
    expect(negotiated.projectedThroughput).toBeCloseTo(
      measured.projectedThroughput,
      6,
    )
  })

  it('charges AgentFlow no one-time setup cost', () => {
    const result = calculateModel(DEFAULT_INPUTS)

    // Nothing is paid up front, so every year's cost is purely recurring and
    // the total is just the yearly figures added up.
    expect(result.totalCosts).toBeCloseTo(
      result.annual.reduce((sum, year) => sum + year.totalCosts, 0),
      2,
    )
  })

  it('returns more than it costs in every year after the backlog clears', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 20_000,
      monthlyInflowPct: 1,
      horizonYears: 3,
    })
    const steadyStateYears = result.annual.filter(
      (year) => year.openingBacklog === 0,
    )

    expect(steadyStateYears.length).toBeGreaterThan(0)
    for (const year of steadyStateYears) {
      expect(year.totalBenefits).toBeGreaterThan(year.totalCosts)
    }
  })

  it('expresses manual completion time on one calendar convention', () => {
    const result = calculateModel(DEFAULT_INPUTS)
    const workingDays =
      DEFAULT_INPUTS.backlogRecords / result.manualDailyCapacity

    // Calendar days include weekends the working-day count does not, so the
    // "team days to clear the backlog" figure should now read higher than the
    // raw working-day count, not sit inconsistently below the equivalent
    // calendar-month figure used elsewhere in the model.
    expect(result.manualCompletionDays).toBeCloseTo(
      workingDays * (CALENDAR_DAYS_PER_MONTH / WORKING_DAYS_PER_MONTH),
      2,
    )
    expect(result.manualCompletionDays).toBeGreaterThan(workingDays)
  })

  it('prices the retry runs only on technical failures', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 20_000,
      processingRecordsPerRun: 20_000,
      monthlyInflowPct: 0,
      horizonYears: 1,
      decisionAccuracyPct: 90,
    })
    const { records, agentCost } = result.annual[0]
    // A failure is retried twice, so it is billed three times over: once for
    // the run that broke and once for each retry.
    const expected =
      (records +
        RETRY_RUNS_PER_TECHNICAL_FAILURE * result.quality.technicalFailures) *
      result.agentUnitCost

    expect(agentCost).toBeCloseTo(expected, 4)
    expect(agentCost).toBeCloseTo(20_600 * 2.3, 2)
  })

  it('charges technical failures as reprocessing, never as human time', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      // Send the entire error pool to technical failures, so anything left in
      // the remediation line would have to be failure-handling time.
      incorrectEnrichmentSharePct: 0,
      incorrectNoEnrichmentSharePct: 0,
      technicalFailureSharePct: 100,
    })
    const { records, agentCost, remediationHours } = result.annual[0]
    const failed = records * (1 - DEFAULT_INPUTS.decisionAccuracyPct / 100)

    expect(remediationHours).toBe(0)
    // First run: every record. The retries: only the failed ones.
    expect(agentCost).toBeCloseTo(
      (records + RETRY_RUNS_PER_TECHNICAL_FAILURE * failed) *
        result.agentUnitCost,
      4,
    )
  })

  it('drops the schedule floor entirely when the cadence is not set', () => {
    const scheduled = calculateModel({ ...DEFAULT_INPUTS, cadence: 'monthly' })
    const unscheduled = calculateModel({
      ...DEFAULT_INPUTS,
      cadence: 'not-set',
    })

    // Runs start back to back, so a run occupies only its own compute time
    // rather than the month-long gap the monthly cadence imposes.
    const runComputeDays =
      (DEFAULT_INPUTS.processingRecordsPerRun *
        DEFAULT_INPUTS.agentMinutesPerRecord) /
      (DEFAULT_INPUTS.workers * 60 * 24)
    expect(unscheduled.workload.agentPerRunDays).toBeCloseTo(runComputeDays, 6)
    expect(unscheduled.workload.agentScheduleGapDays).toBe(0)
    expect(unscheduled.workload.agentRunComputeHours).toBeCloseTo(
      runComputeDays * 24,
      6,
    )
    // The schedule is what stretches the monthly case out, not the compute.
    expect(scheduled.workload.agentPerRunDays).toBeCloseTo(
      scheduled.workload.agentScheduleGapDays,
      6,
    )
    expect(unscheduled.agentProcessingDays).toBeLessThan(
      scheduled.agentProcessingDays,
    )

    // The run count is unchanged — only what each run costs in elapsed time.
    expect(unscheduled.workload.agentRuns).toBe(scheduled.workload.agentRuns)

    // Annual capacity has to agree with the elapsed time, or the compare strip
    // and the backlog chart would tell two different stories.
    expect(unscheduled.bindingConstraint).toBe('runtime')
    expect(unscheduled.annual[0].records).toBeGreaterThan(
      scheduled.annual[0].records,
    )
    expect(unscheduled.assumptionsWarning).not.toContain(
      'Records per run exceed modeled throughput before the next scheduled run.',
    )
  })

  it('reports schedule as the binding constraint whenever runs are on an interval', () => {
    const result = calculateModel({ ...DEFAULT_INPUTS, cadence: 'monthly' })

    expect(result.bindingConstraint).toBe('schedule')
    expect(result.annualScheduledCapacity).toBeLessThan(
      result.annualRuntimeCapacity,
    )
  })

  it('treats zero agent minutes as unlimited runtime, not a stalled pipeline', () => {
    // Needs a schedule in place, otherwise nothing caps throughput at all and
    // there is no binding constraint left to check.
    const baseline = calculateModel({ ...DEFAULT_INPUTS, cadence: 'monthly' })
    const instant = calculateModel({
      ...DEFAULT_INPUTS,
      cadence: 'monthly',
      agentMinutesPerRecord: 0,
    })

    // No compute time per record means the schedule is the only thing capping
    // throughput, so the plan must still process at least as much as it does
    // at the measured speed.
    expect(instant.bindingConstraint).toBe('schedule')
    expect(instant.annual[0].records).toBeGreaterThanOrEqual(
      baseline.annual[0].records,
    )
    expect(instant.totalRecords).toBeGreaterThanOrEqual(baseline.totalRecords)
    expect(instant.totalCosts).toBeGreaterThan(0)
    // Saving the compute time cannot leave more in the queue than the measured
    // speed does, though review and rework still pace most of the work.
    expect(instant.endingBacklog).toBeLessThanOrEqual(baseline.endingBacklog)
  })

  it('flips the binding constraint to runtime when scheduling is not the limiter', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      workers: 5,
      processingRecordsPerRun: 1_000_000,
      cadence: 'daily',
    })

    expect(result.bindingConstraint).toBe('runtime')
    expect(result.annualRuntimeCapacity).toBeLessThan(
      result.annualScheduledCapacity,
    )
  })

  it('scales delay value to the backlog actually cleared, not the full starting backlog', () => {
    const inputs = {
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      includeDelayValue: true,
      cadence: 'monthly' as const,
    }
    const result = calculateModel(inputs)
    const { records, delayValue } = result.annual[0]

    // A million-record backlog on a monthly schedule is a genuine
    // partial-clear scenario — year one cannot finish the whole pile.
    expect(records).toBeLessThan(inputs.backlogRecords)

    // monthsAccelerated isn't exposed directly, but it's reconstructible from
    // manualCompletionDays and agentCompletionHours, which are.
    const monthsAccelerated =
      result.manualCompletionDays / 30.4375 -
      result.agentCompletionHours / (24 * 30.4375)
    const backlogRecordsCleared = Math.min(inputs.backlogRecords, records)

    expect(delayValue).toBeCloseTo(
      backlogRecordsCleared *
        inputs.delayValuePerRecordMonth *
        monthsAccelerated,
      2,
    )
    expect(delayValue).toBeLessThan(
      inputs.backlogRecords *
        inputs.delayValuePerRecordMonth *
        monthsAccelerated,
    )
  })

  it('keeps the three quality split categories exhaustive', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      monthlyInflowPct: 0,
      horizonYears: 1,
    })

    const quality = result.quality
    expect(
      quality.incorrectEnrichment +
        quality.incorrectNoEnrichment +
        quality.technicalFailures,
    ).toBeCloseTo(quality.incorrectDecisions, 4)
    expect(quality.correctDecisions + quality.incorrectDecisions).toBeCloseTo(
      quality.total,
      4,
    )
  })

  it('scopes the quality breakdown to every record processed, not just the backlog', () => {
    // The Quality page reads this breakdown while the compare strip reads
    // totalRecords, so the two have to describe the same population once new
    // records start arriving. The backlog is set small enough to clear inside
    // the horizon, so the arrivals are the only reason the total keeps growing.
    const backlogRecords = 50_000
    const withInflow = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords,
      monthlyInflowPct: 2,
      horizonYears: 3,
    })

    expect(withInflow.quality.total).toBeCloseTo(withInflow.totalRecords, 4)
    expect(withInflow.quality.total).toBeGreaterThan(backlogRecords)
  })

  it('splits each wrong-decision kind across the automation rate', () => {
    const quality = calculateModel({
      ...DEFAULT_INPUTS,
      monthlyInflowPct: 0,
      horizonYears: 1,
    }).quality

    expect(
      quality.incorrectEnrichmentAutoFinalized +
        quality.incorrectEnrichmentReviewed,
    ).toBeCloseTo(quality.incorrectEnrichment, 4)
    expect(
      quality.incorrectNoEnrichmentAutoFinalized +
        quality.incorrectNoEnrichmentReviewed,
    ).toBeCloseTo(quality.incorrectNoEnrichment, 4)
    // The per-kind numbers must still add up to the pooled ones the risk
    // callout and the remediation cost are based on.
    expect(
      quality.incorrectEnrichmentAutoFinalized +
        quality.incorrectNoEnrichmentAutoFinalized,
    ).toBeCloseTo(quality.incorrectAutoFinalized, 4)
    expect(
      quality.incorrectEnrichmentReviewed + quality.incorrectNoEnrichmentReviewed,
    ).toBeCloseTo(quality.incorrectReviewed, 4)
  })

  it('does not create downstream value unless explicitly enabled', () => {
    const disabled = calculateModel({
      ...DEFAULT_INPUTS,
      includeDownstreamValue: false,
      downstreamValuePerCorrectRecord: 10,
    })
    const enabled = calculateModel({
      ...DEFAULT_INPUTS,
      includeDownstreamValue: true,
      downstreamValuePerCorrectRecord: 10,
    })

    expect(disabled.annual.every((year) => year.downstreamValue === 0)).toBe(true)
    expect(enabled.totalBenefits).toBeGreaterThan(disabled.totalBenefits)
  })

  it('splits the per-record effort across workers running in parallel', () => {
    const base = calculateModel(DEFAULT_INPUTS)
    const doubled = calculateModel({
      ...DEFAULT_INPUTS,
      workers: DEFAULT_INPUTS.workers * 2,
    })
    const slower = calculateModel({
      ...DEFAULT_INPUTS,
      agentMinutesPerRecord: DEFAULT_INPUTS.agentMinutesPerRecord * 2,
    })

    // Twice the workers is twice the throughput; twice the effort per record
    // is half. No contention or diminishing returns are modeled.
    expect(doubled.projectedThroughput).toBeCloseTo(
      base.projectedThroughput * 2,
      6,
    )
    expect(slower.projectedThroughput).toBeCloseTo(
      base.projectedThroughput / 2,
      6,
    )
  })

  it('times a run from the per-record effort and the worker count', () => {
    // One run exactly the size of the measured benchmark, so the elapsed time
    // has to come back as the observed 695 minutes.
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 20_000,
      processingRecordsPerRun: 20_000,
      monthlyInflowPct: 0,
      horizonYears: 1,
      agentMinutesPerRecord: (695 * 150) / 20_000,
    })

    expect(result.agentCompletionHours).toBeCloseTo(695 / 60, 6)
  })

  it('charges only the final run against the end of the schedule', () => {
    // Three monthly runs: two full intervals of waiting, then the last run.
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 60_000,
      processingRecordsPerRun: 20_000,
      monthlyInflowPct: 0,
      cadence: 'monthly',
    })
    const lastRunHours = (20_000 * DEFAULT_INPUTS.agentMinutesPerRecord) / (150 * 60)

    expect(result.agentCompletionHours / 24).toBeCloseTo(
      2 * 30.4375 + lastRunHours / 24,
      6,
    )
  })

  it('warns when automation exceeds decision correctness', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      automationRatePct: 95,
      decisionAccuracyPct: 90,
    })

    expect(
      result.assumptionsWarning.some((warning) =>
        warning.includes('Automation exceeds measured correctness'),
      ),
    ).toBe(true)
  })

  it('charges totalCosts the full price of running AgentFlow, including review/correction/failure labor', () => {
    const base = calculateModel(DEFAULT_INPUTS)
    const raised = calculateModel({
      ...DEFAULT_INPUTS,
      reviewMinutesPerRecord: 60,
      correctionMinutesPerRecord: 60,
    })

    // More review and rework is a real cost on the same pile. It also makes
    // the stewards the bottleneck, so fewer records get through the horizon —
    // at a high per-record fee that can make the yearly total fall even as
    // the fully-priced pile gets more expensive.
    expect(raised.workloadAgentCost).toBeGreaterThan(base.workloadAgentCost)
    expect(raised.totalCosts / raised.totalRecords).toBeGreaterThan(
      base.totalCosts / base.totalRecords,
    )
    // An hour of review and an hour of rework per record also makes the
    // stewards the bottleneck, so fewer records get through the horizon. What
    // this must not change is the benefit each processed record earns: that is
    // still the full manual cost avoided.
    expect(raised.totalRecords).toBeLessThan(base.totalRecords)
    expect(raised.totalBenefits / raised.totalRecords).toBeCloseTo(
      base.totalBenefits / base.totalRecords,
      6,
    )
    expect(raised.npv).toBeLessThan(base.npv)
  })

  it('charges the rework rate to every wrong decision that went unchecked', () => {
    // Both kinds of wrong decision are repaired at the rework rate now, so the
    // slider has to bite whichever way the reviewable split is set.
    for (const split of [
      { incorrectEnrichmentSharePct: 0, incorrectNoEnrichmentSharePct: 100 },
      { incorrectEnrichmentSharePct: 100, incorrectNoEnrichmentSharePct: 0 },
    ]) {
      const inputs = {
        ...DEFAULT_INPUTS,
        ...split,
        technicalFailureSharePct: 0,
      }
      expect(
        calculateModel({ ...inputs, correctionMinutesPerRecord: 60 })
          .workloadAgentCost,
      ).toBeGreaterThan(
        calculateModel({ ...inputs, correctionMinutesPerRecord: 1 })
          .workloadAgentCost,
      )
    }
  })

  it('publishes a workload breakdown that reconciles to the strip totals', () => {
    // The comparison strip shows four figures and each opens a step-by-step
    // breakdown. If a part stops adding up to the headline it explains, the
    // modal quietly starts lying, so the reconciliation is pinned here.
    const result = calculateModel(DEFAULT_INPUTS)
    const w = result.workload

    expect(w.records).toBe(result.workloadRecords)
    expect(w.manualCost).toBeCloseTo(result.workloadManualCost, 6)
    expect(w.manualCost).toBeCloseTo(
      w.manualHours * DEFAULT_INPUTS.hourlyLaborRate,
      6,
    )
    expect(
      w.processingCost + w.reviewCost + w.remediationCost,
    ).toBeCloseTo(result.workloadAgentCost, 6)
    expect(w.agentCost).toBeCloseTo(result.workloadAgentCost, 6)
    expect(w.billedRuns).toBeCloseTo(
      w.records + RETRY_RUNS_PER_TECHNICAL_FAILURE * w.technicalFailures,
      6,
    )
    expect(w.processingCost).toBeCloseTo(w.billedRuns * result.agentUnitCost, 6)

    // The two elapsed-time rows have to be rebuildable from their own parts.
    expect(result.manualProcessingDays).toBeCloseTo(
      (w.records / w.manualMonthlyCapacity) * CALENDAR_DAYS_PER_MONTH,
      6,
    )
    // Runs are sized to the billed pile, so the retries every technical
    // failure needs get schedule time as well as a line on the invoice.
    expect(w.agentRuns).toBe(
      Math.ceil(w.billedRuns / DEFAULT_INPUTS.processingRecordsPerRun),
    )
    expect(w.agentScheduleDays).toBeCloseTo(
      (w.agentRuns - 1) * w.agentPerRunDays + w.agentLastRunHours / 24,
      6,
    )

    // Processing and the human work it creates overlap, so elapsed time is
    // whichever of the two stages is slower — never their sum.
    expect(w.agentHumanHours).toBeCloseTo(w.reviewHours + w.remediationHours, 6)
    expect(w.agentHumanDays).toBeCloseTo(
      (w.agentHumanHours / result.teamDayHours) *
        (CALENDAR_DAYS_PER_MONTH / WORKING_DAYS_PER_MONTH),
      6,
    )
    expect(result.agentProcessingDays).toBeCloseTo(
      Math.max(w.agentScheduleDays, w.agentHumanDays),
      6,
    )
  })

  it('still beats the manual baseline once review and rework are counted', () => {
    // The whole claim rests on this: even with every hour of human follow-up
    // added on top of processing, the same team finishes sooner than it would
    // by hand. If an input change ever flips this, the demo is broken.
    const result = calculateModel(DEFAULT_INPUTS)

    expect(result.workload.agentHumanDays).toBeGreaterThan(0)
    expect(result.agentProcessingDays).toBeLessThan(result.manualProcessingDays)
  })

  it('bills rework on the unchecked wrong decisions at the rework rate', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 20_000,
      processingRecordsPerRun: 20_000,
      monthlyInflowPct: 0,
      horizonYears: 1,
    })
    const { remediationHours, reviewHours } = result.annual[0]
    const q = result.quality

    expect(remediationHours).toBeCloseTo(
      (q.incorrectAutoFinalized * DEFAULT_INPUTS.correctionMinutesPerRecord) /
        60,
      6,
    )
    // Review covers the correct records a person checked plus the mistakes
    // they caught, and excludes technical failures entirely.
    expect(q.humanReview).toBeCloseTo(q.correctReviewed + q.incorrectReviewed, 6)
    expect(q.humanReview).toBeCloseTo(
      (q.total - q.technicalFailures) *
        (1 - DEFAULT_INPUTS.automationRatePct / 100),
      6,
    )
    expect(reviewHours).toBeCloseTo(
      (q.humanReview * DEFAULT_INPUTS.reviewMinutesPerRecord) / 60,
      6,
    )
  })

  it('limits value to the processing plan and carries backlog forward', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 50_000,
      monthlyInflowPct: 0,
      cadence: 'monthly',
      processingRecordsPerRun: 1_000,
      horizonYears: 2,
    })

    // Twelve monthly runs of 1,000 is the most the schedule can run in a year,
    // and the review and rework behind the agent hold it just under that.
    const yearOne = result.annual[0]
    expect(yearOne.records).toBeLessThan(12_000)
    expect(yearOne.records).toBeGreaterThan(11_000)
    expect(yearOne.closingBacklog).toBeCloseTo(50_000 - yearOne.records, 6)
    expect(result.annual[1].openingBacklog).toBeCloseTo(
      yearOne.closingBacklog,
      6,
    )
    expect(result.annual[1].records).toBeCloseTo(yearOne.records, 6)
    expect(result.totalRecords).toBeCloseTo(yearOne.records * 2, 6)
    expect(result.endingBacklog).toBeCloseTo(50_000 - result.totalRecords, 6)
  })

  it('splits every processed record into exactly one quality outcome', () => {
    const { quality } = calculateModel(DEFAULT_INPUTS)
    const sum =
      quality.correctAutoFinalized +
      quality.correctReviewed +
      quality.incorrectAutoFinalized +
      quality.incorrectReviewed +
      quality.technicalFailures

    expect(sum).toBeCloseTo(quality.total, 6)
  })

  it('paces manual processing time by the team it has, not just the workload', () => {
    const base = calculateModel(DEFAULT_INPUTS)
    const doubleTeam = calculateModel({
      ...DEFAULT_INPUTS,
      dataStewards: DEFAULT_INPUTS.dataStewards * 2,
    })
    const idleTeam = calculateModel({ ...DEFAULT_INPUTS, utilizationPct: 45 })

    // Twice the stewards, half the elapsed time — the labor is unchanged.
    expect(doubleTeam.manualProcessingDays).toBeCloseTo(
      base.manualProcessingDays / 2,
      6,
    )
    expect(doubleTeam.totalManualHours).toBeCloseTo(base.totalManualHours, 6)
    expect(idleTeam.manualProcessingDays).toBeGreaterThan(
      base.manualProcessingDays,
    )
  })

  it('paces the agent by the run schedule and the team by its capacity', () => {
    // Bigger runs only buy elapsed time when there is a gap to skip, so this
    // has to be a scheduled scenario rather than back-to-back runs.
    const scheduled = { ...DEFAULT_INPUTS, cadence: 'monthly' as const }
    const base = calculateModel(scheduled)
    const moreStewards = calculateModel({
      ...scheduled,
      dataStewards: scheduled.dataStewards * 4,
    })
    const biggerRuns = calculateModel({
      ...scheduled,
      processingRecordsPerRun: scheduled.processingRecordsPerRun * 4,
    })

    // The schedule belongs to the agent, so stewards cannot speed it up.
    expect(moreStewards.workload.agentScheduleDays).toBeCloseTo(
      base.workload.agentScheduleDays,
      6,
    )
    expect(biggerRuns.workload.agentScheduleDays).toBeLessThan(
      base.workload.agentScheduleDays,
    )

    // Review belongs to the team, so a bigger team clears it sooner.
    expect(moreStewards.workload.agentHumanDays).toBeCloseTo(
      base.workload.agentHumanDays / 4,
      6,
    )
    // It does not move the finish date here, though: the two stages overlap
    // and the monthly schedule is much the slower of them, so the stewards
    // were never what the pile was waiting on.
    expect(base.workload.agentScheduleDays).toBeGreaterThan(
      base.workload.agentHumanDays,
    )
    expect(moreStewards.agentProcessingDays).toBeCloseTo(
      base.agentProcessingDays,
      6,
    )

    // Take the schedule away and the stewards become the bottleneck, so the
    // same extra hands now do shorten the end-to-end figure.
    const unscheduled = calculateModel(DEFAULT_INPUTS)
    const unscheduledBigTeam = calculateModel({
      ...DEFAULT_INPUTS,
      dataStewards: DEFAULT_INPUTS.dataStewards * 4,
    })

    expect(unscheduled.workload.agentHumanDays).toBeGreaterThan(
      unscheduled.workload.agentScheduleDays,
    )
    expect(unscheduledBigTeam.agentProcessingDays).toBeLessThan(
      unscheduled.agentProcessingDays,
    )
  })

  it('scopes both processing times to every record, not the starting backlog', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 50_000,
      monthlyInflowPct: 2,
      horizonYears: 3,
    })

    // Arrivals push the priced pile past the backlog, so the durations
    // have to cover more than the backlog-only figures do.
    expect(result.workloadRecords).toBeGreaterThan(50_000)
    expect(result.manualProcessingDays).toBeGreaterThan(
      result.manualCompletionDays,
    )
    expect(result.agentProcessingDays).toBeGreaterThan(
      result.agentCompletionHours / 24,
    )
  })

  it('spreads the year rows over the elapsed time the strip reports', () => {
    const result = calculateModel(DEFAULT_INPUTS)
    const paceYears = result.agentProcessingDays / 365

    // The year rows used to run on agent throughput alone, so year one claimed
    // the whole million records while the strip said the work took over two
    // years. A year can only finish what the stewards can review behind the
    // agent, so the rows have to land on the same pace.
    expect(paceYears).toBeGreaterThan(1)
    expect(result.annual[0].records).toBeCloseTo(
      result.workloadRecords / paceYears,
      6,
    )
    expect(result.annual.filter((year) => year.records > 0)).toHaveLength(
      Math.ceil(paceYears),
    )
    expect(result.totalRecords).toBeCloseTo(result.workloadRecords, 6)
  })

  it('reports what the agent got through separately from what got finished', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      monthlyInflowPct: 0,
      cadence: 'weekly',
      processingRecordsPerRun: 20_000,
    })
    const yearOne = result.annual[0]

    // The agent clears the pile inside its schedule; the stewards behind it do
    // not, so the two figures on the card must not collapse into one.
    expect(yearOne.agentProcessedRecords).toBeCloseTo(1_000_000, 6)
    expect(yearOne.records).toBeLessThan(yearOne.agentProcessedRecords)
    expect(yearOne.records).toBeCloseTo(
      result.workloadRecords / (result.agentProcessingDays / 365),
      6,
    )
  })

  it('drains the backlog chart on the same clock the comparison strip reports', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      monthlyInflowPct: 0,
      horizonYears: 4,
    })

    const firstZero = (key: 'agentBacklog' | 'manualBacklog') =>
      result.backlogProjection.find((point) => point[key] <= 0)?.month

    // The chart used to run on processing-only speed, so its line hit zero
    // years before the strip said the work was done. Both now answer the same
    // question: the month the last record of the priced pile is finished.
    expect(firstZero('agentBacklog')).toBe(
      Math.ceil(result.agentProcessingDays / CALENDAR_DAYS_PER_MONTH),
    )
    expect(firstZero('manualBacklog')).toBe(
      Math.ceil(result.manualProcessingDays / CALENDAR_DAYS_PER_MONTH),
    )
  })

  it('empties the queue before the strip figure when arrivals are still coming', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      monthlyInflowPct: 1,
      horizonYears: 4,
    })

    const agentZero = result.backlogProjection.find(
      (point) => point.agentBacklog <= 0,
    )?.month
    const stripMonths = Math.ceil(
      result.agentProcessingDays / CALENDAR_DAYS_PER_MONTH,
    )

    // The strip prices every record the horizon buys, including ones that have
    // not arrived yet, while the chart can only queue what has turned up. So a
    // fast agent hits an empty queue before it has been paid to do the whole
    // priced pile, and the two dates legitimately differ.
    expect(agentZero).toBeLessThanOrEqual(stripMonths)
  })

  it('prices the full backlog even when the horizon cannot finish it', () => {
    const shortHorizon = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      monthlyInflowPct: 0,
      horizonYears: 1,
      cadence: 'monthly',
    })
    const longerHorizon = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 1_000_000,
      monthlyInflowPct: 0,
      horizonYears: 5,
      cadence: 'monthly',
    })

    // One year of monthly 20k runs cannot process more than 240k, and the
    // review behind it holds the year under that, but the strip still prices
    // all 1M. Stretching the horizon with no arrivals must not change the
    // AgentFlow total either — there is no yearly operating labor on it.
    expect(shortHorizon.totalRecords).toBeLessThan(240_000)
    expect(shortHorizon.workloadRecords).toBe(1_000_000)
    expect(shortHorizon.workloadManualCost).toBeCloseTo(
      1_000_000 * (5 / 60) * DEFAULT_INPUTS.hourlyLaborRate,
      6,
    )
    expect(shortHorizon.workloadManualCost).toBeCloseTo(
      longerHorizon.workloadManualCost,
      6,
    )
    expect(shortHorizon.workloadAgentCost).toBeCloseTo(
      longerHorizon.workloadAgentCost,
      6,
    )
  })

  it('adds horizon-sized arrivals onto the backlog when inflow is on', () => {
    const result = calculateModel({
      ...DEFAULT_INPUTS,
      backlogRecords: 100_000,
      monthlyInflowPct: 1,
      horizonYears: 3,
    })

    expect(result.workloadRecords).toBeCloseTo(
      100_000 + 100_000 * 0.01 * 12 * 3,
      6,
    )
    expect(result.workloadManualCost).toBeCloseTo(
      result.workloadRecords *
        (DEFAULT_INPUTS.manualMinutesPerRecord / 60) *
        DEFAULT_INPUTS.hourlyLaborRate,
      6,
    )
  })

  it('reports a manual baseline that excludes the hours still spent on the agent', () => {
    const result = calculateModel(DEFAULT_INPUTS)

    expect(result.totalManualHours).toBeGreaterThan(result.retainedHours)
    expect(result.capacityHours).toBeCloseTo(
      result.totalManualHours - result.retainedHours,
      6,
    )
  })
})

describe('formatDuration', () => {
  const days = (count: number) => formatDuration(count * 24)

  it('keeps sub-month durations in hours and days', () => {
    expect(formatDuration(6)).toBe('6 hours')
    expect(days(1)).toBe('1 day')
    expect(days(3.5)).toBe('3.5 days')
    expect(days(30)).toBe('30 days')
  })

  it('rolls up into years and months once it runs that long', () => {
    expect(days(30.4375)).toBe('1 month')
    expect(days(60.875)).toBe('2 months')
    expect(days(365.25)).toBe('1 yr')
    expect(days(621.8)).toBe('1 yr 8 mo')
    expect(days(3_887)).toBe('10 yrs 8 mo')
  })

  it('carries a rounded-up twelfth month into the year', () => {
    // 11.6 months must read "1 yr", never "0 yrs 12 mo".
    expect(days(11.6 * 30.4375)).toBe('1 yr')
  })
})
