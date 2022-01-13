
<script>
  import milestones from 'd3-milestones';
  import { tick } from 'svelte';
  import StyleEditor from './StyleEditor.svelte';

  import exampleTimeline from '../assets/data/example_timeline.xlsx';
  const orientations = ['horizontal', 'vertical'];

  let keys = null;
  let optimizeLabels = true;
  let aggregateKey = 'week';
  let orientation = orientations[0];
  let timeColumn = null;
  let textColumn = null;
  let urlColumn = null;
  let timeFormat = '%Y-%m-%dT%H:%M';
  let timelineElem;
  export let data = [];
  export let vizHeight;

  $: {
    keys = Object.keys(data?.length ? data[0] : {});
    if (keys.length > 0 && timeColumn === null) {
      timeColumn = keys[0];
      if (keys.length > 1) textColumn = keys[1];
      if (keys.length > 2) urlColumn = keys[2];
      updateGraph();
    }
  }
  let timeline = milestones('#figure');

  async function updateGraph() {
    await tick();
    timeline
        .mapping({
          timestamp: timeColumn,
          text: textColumn,
          url: urlColumn
        })
        .parseTime(timeFormat)
        .aggregateBy(aggregateKey)
        .optimize(optimizeLabels)
        .orientation(orientation)
        .render(data); 
  }

</script>

<svelte:head>
	<title>Timeline</title>
</svelte:head>

<p> There should be at least columns: one for the time, one for the content, and an optinal one for the url . See <a href={exampleTimeline}>this file</a> for an example.</p>
<p> You can click anywhere on the timeline to change its style</p> <br>
<section>
  
  <div class="control">
    <label class="label"> Orientation </label>
    <div class="select">
      <select bind:value={orientation} on:change={updateGraph}>
        {#each orientations as orient}
        <option value={orient}> {orient} </option>
        {/each}
      </select>
    </div>
  </div>
  <div class="control">
    <label class="label"> Time column </label>
    <div class="select">
      <select bind:value={timeColumn} on:change={updateGraph}>
          {#each keys as key}
            <option value={key}> {key}</option>
          {/each}
      </select>
    </div>
  </div>
  <div class="control">
    <label class="label"> Text column  </label>
    <div class="select">
      <select bind:value={textColumn} on:change={updateGraph}>
          {#each keys as key}
            <option value={key}> {key}</option>
          {/each}
      </select>
    </div>
  </div>
  <div class="control">
    <label class="label"> URL column </label>
    <div class="select">
      <select bind:value={urlColumn} on:change={updateGraph}>
          {#each keys as key}
            <option value={key}> {key}</option>
          {/each}
      </select>
    </div>
  </div>
  <div class="control">
    <label class="label"> Aggregate by </label>
    <div class="select">
      <select bind:value={aggregateKey} on:change={updateGraph}>
        <option value="second">Second</option>
        <option value="minute">Minute</option>
        <option value="hour">Hour</option>
        <option value="day" selected>Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="year">Year</option>
      </select>
    </div>
  </div>
  <div class="field">
    <label class="checkbox"> Optimize Label Output </label>
      <input type="checkbox" bind:checked={optimizeLabels} on:change={updateGraph}>
  </div>
  <div class="field">
    <label class="label">Timestamp format (default is %Y-%m-%dT%H:%M, for instance 2017-08-22T00:00). The legend of the letters is <a href="https://github.com/d3/d3-time-format#locale_format">here</a> </label>
    <div class="control">
      <input class="input" type="text" bind:value={timeFormat} on:change={updateGraph}>
    </div>
  </div>
</section>
<div id="figure" style="height:{vizHeight}px" bind:this={timelineElem}></div>
<StyleEditor elementToListen={timelineElem} cssRuleToFind=".milestones__group"></StyleEditor>
<style>
/* #figure {
  margin: 2rem 1rem;
} */
:global(.milestones) {
  position: relative;
}
:global(.milestones > *) {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
}
</style>
