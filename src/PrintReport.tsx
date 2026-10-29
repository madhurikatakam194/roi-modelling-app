import {
  formatCurrency,
  formatDuration,
  formatNumber,
  type ModelResult,
  type Scenario,
} from './model'

export function PrintReport({
  scenario,
  result,
}: {
  scenario: Scenario
  result: ModelResult
}) {
  const inputs = scenario.inputs
  return (
    <article className="print-report">
      <header className="print-report-header">
        <div>
          <span>RELTIO VALUE STUDIO</span>
          <h1>Autonomous Agents ROI Assessment</h1>
          <p>{scenario.name} · Address Enricher Agent 2</p>
        </div>
        <div>
          <strong>{new Date().toLocaleDateString('en-US')}</strong>
          <span>Internal model · Estimates are not guarantees</span>
        </div>
      </header>

      <section className="print-headline">
        <div>
          <span>Three-year NPV</span>
          <strong>{formatCurrency(result.npv)}</strong>
        </div>
        <div>
          <span>ROI</span>
          <strong>{formatNumber(result.roiPct)}%</strong>
        </div>
        <div>
          <span>Payback</span>
          <strong>
            {result.paybackMonths ? `${result.paybackMonths} months` : 'Beyond horizon'}
          </strong>
        </div>
        <div>
          <span>Ending backlog</span>
          <strong>{formatNumber(result.endingBacklog)} records</strong>
        </div>
      </section>

      <section className="print-section">
        <h2>Executive interpretation</h2>
        <p>
          This model makes {formatNumber(result.totalDemand)} records available
          and processes {formatNumber(result.totalRecords)} over {inputs.horizonYears}{' '}
          years. Value is the full manual-equivalent cost this work would have
          taken by hand, and cost is everything it takes to run AgentFlow —
          processing, review, and fixing mistakes. Net value
          is simply what the work would have cost by hand minus what
          AgentFlow actually costs.
        </p>
        <div className="print-callouts">
          <div>
            <span>Agent completion</span>
            <strong>{formatDuration(result.agentCompletionHours)}</strong>
          </div>
          <div>
            <span>Manual completion</span>
            <strong>{formatDuration(result.manualCompletionDays * 24)}</strong>
          </div>
          <div>
            <span>Cost / correct result</span>
            <strong>{formatCurrency(result.costPerCorrectRecord)}</strong>
          </div>
        </div>
      </section>

      <section className="print-section">
        <h2>Annual economics</h2>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Processed / available</th>
              <th>Ending backlog</th>
              <th>Benefits</th>
              <th>Costs</th>
              <th>Net value</th>
            </tr>
          </thead>
          <tbody>
            {result.annual.map((year) => (
              <tr key={year.year}>
                <td>Year {year.year}</td>
                <td>{formatNumber(year.records)} / {formatNumber(year.availableRecords)}</td>
                <td>{formatNumber(year.closingBacklog)}</td>
                <td>{formatCurrency(year.totalBenefits)}</td>
                <td>{formatCurrency(year.totalCosts)}</td>
                <td>{formatCurrency(year.netValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section print-two-column">
        <div>
          <h2>Quality and governance</h2>
          <dl>
            <div><dt>Decision correctness</dt><dd>{inputs.decisionAccuracyPct}%</dd></div>
            <div><dt>Auto-finalized</dt><dd>{inputs.automationRatePct}%</dd></div>
            <div><dt>Human review</dt><dd>{formatNumber(result.quality.humanReview)} records</dd></div>
            <div><dt>Correction risk</dt><dd>{formatNumber(result.quality.incorrectAutoFinalized)} records</dd></div>
          </dl>
        </div>
        <div>
          <h2>Measured benchmark</h2>
          <dl>
            <div><dt>Successfully processed</dt><dd>{formatNumber(inputs.benchmarkRecords)}</dd></div>
            <div><dt>Elapsed time</dt><dd>{inputs.benchmarkMinutes} minutes</dd></div>
            <div><dt>Customer cost</dt><dd>{formatCurrency(inputs.benchmarkCustomerCost)}</dd></div>
            <div><dt>Parallel workers</dt><dd>{inputs.benchmarkWorkers}</dd></div>
          </dl>
        </div>
      </section>

      <section className="print-section">
        <h2>Key assumptions</h2>
        <div className="print-assumptions">
          <span>Starting backlog <strong>{formatNumber(inputs.backlogRecords)}</strong></span>
          <span>Monthly inflow <strong>{inputs.monthlyInflowPct}%</strong></span>
          <span>Records per run <strong>{formatNumber(inputs.processingRecordsPerRun)}</strong></span>
          <span>Run frequency <strong>{inputs.cadence}</strong></span>
          <span>Manual effort <strong>{inputs.manualMinutesPerRecord} min / record</strong></span>
          <span>Loaded labor <strong>{formatCurrency(inputs.hourlyLaborRate)} / hour</strong></span>
          <span>Data stewards <strong>{inputs.dataStewards}</strong></span>
          <span>Agent effort <strong>{formatNumber(inputs.agentMinutesPerRecord, 2)} worker-min / record</strong></span>
          <span>Discount rate <strong>{inputs.discountRatePct}%</strong></span>
        </div>
      </section>
    </article>
  )
}
