import { X } from 'lucide-react'
import {
  formatNumber,
  type ModelInputs,
  type ModelResult,
  type Scenario,
} from './model'
import { ALL_GROUPS, FieldControl, type InputField } from './inputGroups'
import { ComparePanel, GroupLabel, PanelNote } from './ui'

function renderFields(
  fields: InputField[],
  inputs: ModelInputs,
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void,
) {
  return fields.map((field) => (
    <FieldControl key={field.key} field={field} inputs={inputs} onInput={onInput} />
  ))
}

export function ControlDrawer({
  scenario,
  result,
  onInput,
  onClose,
}: {
  scenario: Scenario
  result: ModelResult
  onInput: <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => void
  onClose: () => void
}) {
  const inputs = scenario.inputs
  const quality = result.quality
  const splitTotal =
    inputs.incorrectEnrichmentSharePct +
    inputs.incorrectNoEnrichmentSharePct +
    inputs.technicalFailureSharePct

  return (
    <>
      <div className="inspector-header">
        <div>
          <span className="eyebrow">EVERY ASSUMPTION</span>
          <h2>Model inputs</h2>
        </div>
        <button
          className="icon-button inspector-close"
          onClick={onClose}
          type="button"
          aria-label="Close model inputs"
        >
          <X size={18} />
        </button>
      </div>
      <div className="inspector-content">
        <div className="input-legend">
          <span>
            <i className="legend-swatch swatch-manual" />
            Without AgentFlow
          </span>
          <span>
            <i className="legend-swatch swatch-agent" />
            With AgentFlow
          </span>
        </div>

        {ALL_GROUPS.map((group) => {
          if (group.tone === 'off') {
            return (
              <div className="input-band" key={group.id}>
                <GroupLabel kicker={group.kicker} title={group.title} />
                {renderFields(group.fields, inputs, onInput)}
              </div>
            )
          }

          const title =
            group.id === 'error-split'
              ? `Where the ${formatNumber(quality.incorrectDecisions)} errors go`
              : group.title

          return (
            <ComparePanel
              key={group.id}
              tone={group.tone}
              title={title}
              primary={
                <>
                  {renderFields(group.fields, inputs, onInput)}
                  {group.id === 'error-split' && splitTotal !== 100 && (
                    <PanelNote>
                      Shares total {splitTotal}% and are normalized to 100% in
                      the calculation.
                    </PanelNote>
                  )}
                </>
              }
            />
          )
        })}
      </div>
    </>
  )
}
