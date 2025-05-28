<script lang="ts">
  import "bootstrap/js/dist/collapse";
  import { createEventDispatcher } from "svelte";

  import ColorPickerPreview from "./ColorPickerPreview.svelte";
  import RangeInput from "./RangeInput.svelte";
  import { camelCaseToSentence } from "../util/common";
  import type { OtherParams, ParamDefinitions, ParamKey } from "src/params";
  import { type Color } from "src/types";
  export let sections: Record<string, Record<string, number | Color>>;
  export let paramDefs: ParamDefinitions;
  export let level = 0;
  export let helpParams: Record<string, string> = {};
  export let otherParams: OtherParams = {};

  const dispatch = createEventDispatcher();

  function propChanged(prop: string, value: string | number | boolean) {
    const payload = { prop, value };
    dispatch("change", payload);
  }

  function getLabel(key: string) {
    const displayedKey = otherParams[key]?.rename || key;
    return camelCaseToSentence(displayedKey);
  }

  function sectionTitles(): ParamKey[] {
    return Object.keys(sections) as ParamKey[];
  }
</script>

{#each sectionTitles() as title, i (title)}
  <div class="accordion">
    <div class="accordion-item">
      <h3 class="accordion-header">
        <button
          class="accordion-button fs-5"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target={`#panel-${title}-collapse`}
        >
          <span> {camelCaseToSentence(title)} </span>
          {#if title in helpParams}
            <span class="help-tooltip fs-6 float-end" data-bs-toggle="tooltip" data-bs-title={helpParams[title]}>?</span
            >
          {/if}
        </button>
      </h3>
      {@html "<!-- Buggy - collaspe on any click inside... class:show={level === 0 && i < 4}-->"}
      <div id={`panel-${title}-collapse`} class="accordion-collapse collapse show">
        <div class="accordion-body" style="border-left: solid {2 * level}px var(--bs-accordion-active-bg);">
          {#each Object.keys(sections[title]) as key, i (key)}
            {#if otherParams[key]?.disabled !== true}
              <div class="field">
                {#if key in paramDefs}
                  {#if paramDefs[key].type == "range"}
                    <RangeInput
                      title={getLabel(key)}
                      helpText={helpParams[key]}
                      id={`form-${key}`}
                      value={sections[title][key] as number}
                      min={paramDefs[key].min}
                      max={paramDefs[key].max}
                      step={paramDefs[key].step || 1}
                      onChange={(val) => {
                        sections[title][key] = val;
                        propChanged(key, val);
                        sections = sections;
                      }}
                    />
                  {:else if paramDefs[key].type == "select"}
                    <div class="row">
                      <label class="col-4 col-form-label" for={`form-${key}`}>{getLabel(key)}</label>
                      <select
                        id={`form-${key}`}
                        class="form-select form-select-sm me-4 col"
                        bind:value={sections[title][key]}
                        on:change={(e) => propChanged(key, (e.target as HTMLSelectElement).value)}
                      >
                        {#each paramDefs[key].choices as opt}
                          <option value={opt}>
                            {camelCaseToSentence(opt)}
                          </option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                {:else if typeof sections[title][key] === "boolean"}
                  <div class="input-type form-check form-switch">
                    <label for={`form-${key}`} class="form-check-label">
                      <span> {camelCaseToSentence(key)}</span>
                      {#if key in helpParams}
                        <span
                          class="help-tooltip fs-6 float-end"
                          data-bs-toggle="tooltip"
                          data-bs-title={helpParams[key]}>?</span
                        >
                      {/if}
                    </label>
                    <input
                      type="checkbox"
                      role="switch"
                      class="form-check-input"
                      id={`form-${key}`}
                      bind:checked={sections[title][key]}
                      on:change={(e) => {
                        propChanged(key, (e.target as HTMLInputElement).checked);
                      }}
                    />
                  </div>
                {:else if key.toLowerCase().includes("color")}
                  <ColorPickerPreview
                    id={`form-${key}`}
                    popup="right"
                    title={camelCaseToSentence(key)}
                    value={sections[title][key] as Color}
                    onChange={(col) => {
                      sections[title][key] = col;
                      propChanged(key, col);
                      sections = sections;
                    }}
                  />
                {:else}
                  <div class="input-type">
                    <label for={`form-${key}`} class="form-label">
                      {camelCaseToSentence(key)}
                    </label>
                    <input
                      type="number"
                      class="form-control"
                      id={`form-${key}`}
                      bind:value={sections[title][key]}
                      on:change={(e) => propChanged(key, parseFloat((e.target as HTMLInputElement).value))}
                    />
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>
{/each}
