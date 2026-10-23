<script lang="ts">
  import Modal from "./Modal.svelte";
  import ExportInstructions from "./ExportInstructions.svelte";

  type Tab =
    | "welcome"
    | "macro"
    | "micro"
    | "drawing"
    | "data"
    | "tips"
    | "export";

  interface Props {
    open: boolean;
    onClosed: () => void;
    onStartTour?: () => void;
  }

  let { open = $bindable(), onClosed, onStartTour }: Props = $props();
  let activeTab = $state<Tab>("welcome");

  const tabs: { id: Tab; label: string }[] = [
    { id: "welcome", label: "Welcome" },
    { id: "macro", label: "Macro mode" },
    { id: "micro", label: "Detailed mode" },
    { id: "drawing", label: "Drawing & annotations" },
    { id: "data", label: "Data & coloring" },
    { id: "tips", label: "Tips & shortcuts" },
    { id: "export", label: "Export & embedding" },
  ];
</script>

<Modal {open} {onClosed} modalWidth="880px">
  {#snippet header()}
    <div><h2 class="fs-4 p-2 m-0">Instructions</h2></div>
  {/snippet}
  {#snippet content()}
  <div class="inst-layout">
    <nav class="inst-tabs">
      {#each tabs as tab}
        <button
          class="inst-tab-btn"
          class:active={activeTab === tab.id}
          type="button"
          onclick={() => (activeTab = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </nav>

    <div class="inst-panel">
      {#if activeTab === "welcome"}
        <h5 class="tab-heading">Welcome to Mapello</h5>
        <p class="small">
          Mapello is a web-based SVG map designer. Create polished, customizable
          maps and export them as self-contained SVG files you can paste
          directly into any web page — no JavaScript needed.
        </p>
        <p class="small">The app has two main modes:</p>
        <ul class="tip-list">
          <li>
            <strong>Macro mode</strong> — world, continent, or country scale maps
            with projections, data layers, choropleth coloring, and legends.
          </li>
          <li>
            <strong>Detailed mode</strong> — city and street level maps rendered
            from vector tiles, with per-layer styling and optional 3D buildings.
          </li>
        </ul>
        <p class="small">
          Both modes share common drawing tools (curves, freehand, labels,
          shapes) available in the toolbar above the map.
        </p>
        <div class="mt-4">
          <p class="small text-muted mb-2">
            New here? Take the guided tour to see the main features in 2
            minutes.
          </p>
          <button
            class="btn btn-primary btn-sm"
            type="button"
            onclick={() => onStartTour?.()}
          >
            Take the tour
          </button>
        </div>
      {:else if activeTab === "macro"}
        <h5 class="tab-heading">Macro mode</h5>
        <p class="small">
          World, country, or continent scale maps. Select <strong>Macro</strong>
          from the mode switcher at the top of the left panel.
        </p>

        <h6 class="section-title">Projections</h6>
        <p class="small">
          Choose from the <strong>Map settings</strong>: Mercator, Equal Earth,
          Natural Earth, Albers USA, Baker, and Satellite. The Satellite
          projection renders a globe view with adjustable altitude, tilt, and
          field of view.
        </p>
        <div class="tip-box">
          <strong>Satellite tilt &amp; rotate</strong><br />
          Hold <kbd>Ctrl</kbd> (or <kbd>⌘</kbd> on Mac) while dragging:
          <ul class="tip-list mt-1">
            <li>Drag <strong>vertically</strong> to change the tilt</li>
            <li>Drag <strong>horizontally</strong> to rotate the view</li>
          </ul>
        </div>

        <h6 class="section-title mt-3">Map settings</h6>
        <ul class="tip-list">
          <li>Map width &amp; height</li>
          <li>Sea color, graticule, border</li>
        </ul>

        <h6 class="section-title mt-3">Left panel</h6>
        <ul class="tip-list">
          <li>
            Toggle <strong>Land</strong> (all land masses) and
            <strong>Country borders</strong>
          </li>
          <li>
            Add <strong>ADM1</strong> (regions) or <strong>ADM2</strong>
            (sub-regions) data for any country using the <strong>+</strong> button
            at the end of the layer tab strip
          </li>
          <li>Drag-reorder layers to control draw order</li>
          <li>Assign a glow filter to any layer</li>
          <li>
            Click any region on the map to edit its stroke and fill in the
            properties panel
          </li>
        </ul>
      {:else if activeTab === "micro"}
        <h5 class="tab-heading">Detailed mode</h5>
        <p class="small">
          City and street scale maps. Select <strong>Detailed</strong> from the mode
          switcher at the top of the left panel.
        </p>

        <h6 class="section-title">Finding a location</h6>
        <p class="small">
          Use the <strong>search bar</strong> that appears above the map to navigate
          to any city or address. The map recenters immediately.
        </p>

        <h6 class="section-title mt-3">Palettes</h6>
        <p class="small">
          Choose a preset color theme from the <strong
            >General tab → Palette</strong
          > dropdown. Palettes set all layer colors at once for a cohesive look.
        </p>

        <h6 class="section-title mt-3">Per-layer styling</h6>
        <p class="small">
          In the <strong>Layers tab</strong>, each layer (<em
            >grass, forest, sand, water, roads, railways, paths, buildings,
            background</em
          >) can be toggled and its colors customized individually.
        </p>

        <h6 class="section-title mt-3">3D buildings</h6>
        <p class="small">
          Enable the <strong>3D buildings</strong> toggle in the Layers tab to render
          building footprints with a perspective offset effect.
        </p>
      {:else if activeTab === "drawing"}
        <h5 class="tab-heading">Drawing &amp; annotations</h5>
        <p class="small">
          Use the toolbar above the map to draw curves, freehand strokes, points,
          and labels.
        </p>

        <h6 class="section-title">Toolbar</h6>
        <ul class="tip-list">
          <li>
            <strong>Curve</strong> — has two modes, chosen with the arrow next to
            the button (your choice is remembered). Both create an editable SVG
            <code>&lt;path&gt;</code>.
            <ul>
              <li>
                <strong>Pen</strong> (default) — click to place a point, click and
                drag to pull out its handles and make a smooth point. Hold
                <kbd>Alt</kbd> while dragging to move only one handle (sharp
                corner) and <kbd>Shift</kbd> to snap the handle to 45°.
                <kbd>Backspace</kbd> (or <kbd>Ctrl</kbd> + <kbd>Z</kbd>) removes the
                last point. Press <kbd>Enter</kbd>, <kbd>Esc</kbd>, double-click or
                click the last point to finish.
              </li>
              <li>
                <strong>Freehand</strong> — hold and drag to draw a stroke, which
                is smoothed into a curve.
              </li>
            </ul>
          </li>
          <li>
            <strong>Freehand</strong> — click the button, then hold and drag to
            draw freely.
          </li>
          <li>
            <strong>Point</strong> — pick a shape from the dropdown, then click
            the map to place it.
          </li>
          <li>
            <strong>Label</strong> — click the button, then click the map to
            place a text element. Style it in the properties panel.
          </li>
        </ul>

        <h6 class="section-title mt-3">Editing a curve</h6>
        <ul class="tip-list">
          <li>
            Select a curve, then click <strong>Edit curve</strong> in the
            properties panel
          </li>
          <li>
            Click on the curve to <strong>add</strong> a point (a dot previews
            where it will go)
          </li>
          <li>Click and drag on the curve to move the whole curve</li>
          <li>
            Click a point to select it: its two <strong>handles</strong> appear.
            Drag the point or its handles to reshape the curve
          </li>
          <li>
            Handles of a smooth point stay aligned: hold <kbd>Alt</kbd> while
            dragging a handle to move it independently and make a sharp corner
          </li>
          <li>
            Double-click a point to switch it between a sharp
            <strong>corner</strong> and a <strong>smooth</strong> point
          </li>
          <li>
            <kbd>Delete</kbd> / <kbd>Backspace</kbd> (or <kbd>Ctrl</kbd> + click
            on a point) <strong>removes</strong> the selected point. Removing the
            second-to-last point deletes the curve
          </li>
          <li>
            Arrow keys nudge the selected point by 1px (<kbd>Shift</kbd> for
            10px)
          </li>
          <li>
            <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> +
            <kbd>Shift</kbd> + <kbd>Z</kbd> undo and redo point changes while
            editing
          </li>
          <li>
            <kbd>Enter</kbd> or <kbd>Esc</kbd>, or click
            <strong>Exit editing</strong>, to finish
          </li>
        </ul>

        <h6 class="section-title mt-3">Multi-line labels</h6>
        <p class="small">
          While editing a label, press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to insert
          a line break.
        </p>

        <h6 class="section-title mt-3">Custom fonts</h6>
        <p class="small">
          Click the <strong>font icon</strong> in the top navbar to upload a
          <code>.ttf</code>
          or <code>.woff2</code> font. Uploaded fonts are available in the label
          editor and in tooltips/popovers.
        </p>

        <h6 class="section-title mt-3">Element annotations</h6>
        <p class="small">
          Click any SVG element (shape, path, label, or map region) to open the
          properties panel, then use the interactions section to:
        </p>
        <ul class="tip-list">
          <li>
            <strong>Add tooltip</strong> — shown when the element is hovered
          </li>
          <li>
            <strong>Add popover</strong> — shown when the element is clicked; supports
            rich HTML formatting
          </li>
          <li><strong>Add link</strong> — wraps the element in a URL link</li>
        </ul>
        <p class="small text-muted">
          Tooltips and popovers are exported with the SVG and work in the final
          HTML page without any extra JavaScript.
        </p>
      {:else if activeTab === "data"}
        <h5 class="tab-heading">Data &amp; coloring</h5>
        <p class="small">
          Available in <strong>Macro mode → Layers tab</strong>. Bind a data
          table to a layer to create choropleth maps.
        </p>

        <h6 class="section-title">Loading data</h6>
        <p class="small">
          In the Layers tab, select a layer (e.g. <em>Countries</em>) and click
          the data bind icon to upload a <strong>CSV file</strong>. The first
          column is used as the geographic join key (country name or ISO code).
        </p>

        <h6 class="section-title mt-3">Manage Data</h6>
        <p class="small">
          Once data is loaded, a <strong>Manage Data</strong> button appears. Use
          it to inspect columns, replace the dataset, or remove it.
        </p>

        <h6 class="section-title mt-3">Coloring modes</h6>
        <ul class="tip-list">
          <li>
            <strong>Categorical</strong> — for string fields; each unique value gets
            a distinct color
          </li>
          <li>
            <strong>Quantize</strong> — splits a numeric range into equal-width buckets
          </li>
          <li>
            <strong>Quantile</strong> — splits data into equal-count buckets, useful
            for skewed distributions
          </li>
        </ul>
        <p class="small">
          Choose the data column, color palette, and number of breaks. A <strong
            >custom palette editor</strong
          > lets you define your own colors.
        </p>

        <h6 class="section-title mt-3">Legend</h6>
        <p class="small">
          Toggle the legend on/off, choose its position, and format the labels
          (locale, prefix, suffix).
        </p>

        <h6 class="section-title mt-3">Tooltip templates</h6>
        <p class="small">
          Enable <strong>Show tooltip</strong> and edit the template. Wrap any column
          name in double underscores to insert its value:
        </p>
        <pre class="code-snippet">Country: <strong>__name__</strong></pre>
        <p class="small text-muted">
          Click on a tooltip preview in the sidebar to style it with the Inline
          Style Editor.
        </p>
      {:else if activeTab === "tips"}
        <h5 class="tab-heading">Tips &amp; shortcuts</h5>

        <h6 class="section-title">Undo &amp; redo</h6>
        <ul class="tip-list">
          <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> — undo</li>
          <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> — redo</li>
        </ul>

        <h6 class="section-title mt-3">Selection</h6>
        <ul class="tip-list">
          <li>Click a shape, curve, or freehand drawing to select it</li>
          <li><kbd>Shift</kbd> + click to add to the selection</li>
          <li>Drag the bounding box handles to resize or move the selection</li>
          <li><kbd>Ctrl</kbd> + <kbd>C</kbd> — copy</li>
          <li><kbd>Ctrl</kbd> + <kbd>V</kbd> — paste</li>
          <li>
            <kbd>Delete</kbd> or <kbd>Backspace</kbd> — delete selected elements
          </li>
        </ul>

        <h6 class="section-title mt-3">Projects &amp; saving</h6>
        <ul class="tip-list">
          <li>
            The map state is automatically saved to your browser's local storage
          </li>
          <li>
            Sign in to also sync projects to the cloud and access them from any
            device
          </li>
          <li>Projects auto-save to the server every time you make a change</li>
          <li>Maximum project size is <strong>1 MB</strong></li>
        </ul>

        <h6 class="section-title mt-3">Export</h6>
        <ul class="tip-list">
          <li>Exporting requires a free account</li>
          <li>
            Free accounts include a limited number of exports; <strong
              >Pro</strong
            > accounts have unlimited exports
          </li>
          <li>
            Choose to embed fonts as base64, convert text to paths, or let
            Mapello pick the smaller option
          </li>
          <li>
            The exported SVG is optimized with SVGO for the smallest possible
            file size
          </li>
        </ul>
      {:else if activeTab === "export"}
        <h5 class="tab-heading">Export &amp; embedding</h5>
        <p class="small mb-3">
          Click the <strong>Export</strong> button in the top navbar to download
          your map as an SVG file. Then embed it in your HTML page using one of the
          methods below.
        </p>
        <ExportInstructions />
      {/if}
    </div>
  </div>
  {/snippet}
  {#snippet footer()}
  <div class="footer-row">
    {#if onStartTour}
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm me-auto"
        onclick={() => onStartTour?.()}
      >
        Take the tour
      </button>
    {/if}
    <button type="button" class="btn btn-primary" onclick={onClosed}>OK</button>
  </div>
  {/snippet}
</Modal>

<style>
  .inst-layout {
    display: flex;
    height: 520px;
  }
  .inst-tabs {
    width: 160px;
    flex-shrink: 0;
    border-right: 1px solid #dee2e6;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.5rem 0.4rem;
  }
  .inst-tab-btn {
    text-align: left;
    padding: 0.45rem 0.75rem;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #495057;
    transition: background 0.12s;
    white-space: nowrap;
  }
  .inst-tab-btn:hover {
    background: #f1f3f5;
  }
  .inst-tab-btn.active {
    background: #e7f0fd;
    color: #0d6efd;
    font-weight: 500;
  }
  .inst-panel {
    flex: 1;
    overflow-y: auto;
    padding: 1.1rem 1.5rem;
  }
  .tab-heading {
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: #1f2937;
    font-size: 1rem;
  }
  .section-title {
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #1f2937;
    font-size: 0.875rem;
  }
  .tip-list {
    padding-left: 1.25rem;
    margin: 0 0 0.25rem 0;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .tip-list li {
    margin-bottom: 0.2rem;
  }
  .tip-box {
    background: #f8f9fa;
    border-left: 3px solid #0d6efd;
    border-radius: 0 4px 4px 0;
    padding: 0.6rem 0.9rem;
    font-size: 0.875rem;
  }
  .code-snippet {
    background: #f6f8fa;
    border: 1px solid #e1e4e8;
    border-radius: 5px;
    padding: 0.5rem 0.75rem;
    font-size: 0.82rem;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0.3rem 0 0.5rem;
  }
  .footer-row {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
  kbd {
    background: #f3f4f6;
    border: 1px solid #d0d7de;
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 0.05em 0.4em;
    font-size: 0.82em;
    color: #1f2937;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .small {
    font-size: 0.875rem;
  }
</style>
