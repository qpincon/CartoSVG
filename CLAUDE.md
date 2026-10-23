
# Mapello Project Analysis

## Overview

This project is a web-based SVG map designer called Mapello. It allows users to create and customize Scalable Vector Graphics (SVG) maps with various features, including different map projections, layers, and data visualizations. The application is built using Svelte 5 for the frontend, and it leverages several libraries for mapping and geometry operations, such as D3.js, MapLibre GL, and Turf.js.

The main goal of the application is to create intuitively static SVG maps that can be exported to the user and included directly into a website (by pasting the exported SVG in an HTML page). It is different of the existing solutions by a few aspects:
- Simple usage of the final map: simply paste the SVG, no need to load any Javascript, technical knowledge not required
- The map is customizable to be stylish, in addition to being practical (showing data)
- The exported SVG is as small as possible, by using different optimization techniques

There are globally two main modes for the application:
- "macro" mode, to create maps at the scale of countries or continents (or whole world)
- "micro" mode, to create maps with more details (to see a city with buildings, streets, etc)

There is also common code for the two modes (in `App.svelte`). This common code will use micro and macro modes, and add common features to it. See the "Common features" section.

## Project Structure

The project is organized into several directories, each with a specific purpose:

- **`node_modules`**: This directory contains all the project's dependencies.
- **`release-versions`**: This directory contains a text file with the latest version of GeoBoundaries.
- **`build`**: adapter-node build output, produced by `vite build`. Gitignored.
- **`src`**: This is the main source code directory for the Svelte application.
  - **`assets`**: This directory contains static assets like images, styles, and data.
  - **`components`**: This directory contains reusable Svelte components that are used throughout the application.
  - **`lib`**: SvelteKit `$lib` alias root. Contains `auth-client.ts` (browser auth client) and `server/` (server-only: `auth.ts`, `db.ts`, `schema.ts`, `auth-schema.ts`).
  - **`macro`**: This directory contains code related to the "macro" view of the map.
  - **`micro`**: This directory contains code related to the "micro" view of the map.
  - **`routes`**: SvelteKit file-based routes. `+layout.server.ts` loads the auth session. `api/auth/` and `api/projects/` are REST endpoints.
  - **`shared`**: This directory contains shared code that is used by both the "macro" and "micro" views.
  - **`svg`**: This directory contains code for generating and manipulating SVGs.
  - **`util`**: This directory contains utility functions that are used throughout the application.
- **`data`**: SQLite database file (`mapello.db`). Gitignored.
- **`test`**: This directory contains experimental test files, to ignore.

## Key Technologies

- **Svelte 5**: Uses runes (`$state`, `$props`, `$effect`, `$bindable`) for reactivity.
- **SvelteKit 2**: File-based routing, server-side load functions, hooks. Deployed with `@sveltejs/adapter-node`.
- **D3.js**: A JavaScript library for producing dynamic, interactive data visualizations in web browsers.
- **MapLibre GL**: A free and open-source library for client-side vector-based maps. Used in micro mode with PMTiles.
- **Turf.js**: A JavaScript library for spatial analysis.
- **Vite**: A build tool that provides a faster and leaner development experience for modern web projects.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.
- **better-auth**: Authentication library (email/password + Google OAuth). Server config in `src/lib/server/auth.ts`, browser client in `src/lib/auth-client.ts`.
- **Drizzle ORM + better-sqlite3**: Database ORM with SQLite. DB file at `data/mapello.db`, schema in `src/lib/server/schema.ts` and `src/lib/server/auth-schema.ts`, config in `drizzle.config.ts`.

## State Management

Global reactive state lives in `src/state.svelte.ts`:
- `macroState` (`StateMacro`): all macro mode state — macroParams, inlinePropsMacro, orderedTabs, chosenCountriesAdm, zonesData, zonesFilter, contourParams, colorDataDefs, legendDefs, tooltipDefs, customCategoricalPalette, visibleArea, baseCss
- `microState` (`StateMicro`): microParams, inlinePropsMicro, microLayerDefinitions
- `commonState` (`StateCommon`): providedFonts, providedShapes, providedPaths, providedFreeHand, inlineStyles, elementLinks, elementAnnotations, shapeCount, currentMode, lastUsedLabelProps
- `appState`: non-persistent runtime state (D3 projections, path functions)

Default values for all state are defined in `src/stateDefaults.ts`. Types are defined in `src/types.ts`. The state is persisted to `localStorage` via `src/util/save.ts` (`getState`/`saveState`).

## Rendering Flow

- Main draw entry point: `draw()` in `App.svelte` — clears `#map-container`, creates an SVG element, sets up event handlers, then calls `drawMacroBase()` or `drawMicroTotal()` depending on mode, and finally draws common layers (shapes, paths, freehand).
- Mode switch: `switchMode()` in `App.svelte` — clears `#map-container` immediately, updates `commonState.currentMode`, then calls `macroSidebar.applyStateAndDraw()` (macro) or `draw()` (micro).
- The MapLibre map lives in a separate `#maplibre-map` div, shown in micro mode and hidden in macro mode.

## Macro mode

This is the most complex of the 2 modes. The main logic is contained in `src/macro/components/MacroSidebar.svelte` and `src/macro/drawing.ts`.

It allows rich customization of a view of the world. The geometry data of the world is from the GeoBoundaries repository, which is preprocessed by the `getAndSimplifyWorld.ts` script, and the output of that script is stored inside `src/assets/layers`. This folder contains topojson files:
- `world_land_very_simplified_topo.json`: This is a very simplified version of the whole land, used when the user drags the map, for fast rendering
- `world_adm0_simplified_topo.json`, which contains geometries for all the countries in the world
- `adm1` folder contains all ADM1 (region) geometries for all the countries of the world (if it exists for this country)
- `adm2` folder contains all ADM2 (more detailed regions than ADM1) geometries for all the countries of the world (if it exists for this country)

Geometry loading and caching is managed in `src/macro/geometry-data.ts`.

The macro mode features multiple projections: "classical" projections provided by D3 (mercator, equalEarth, geoNaturalEarth, geoAlbersUsa, geoBaker), and a "satellite" projection which is more complex, allowing a globe view with variable altitude, tilt, field-of-view, and rotation.

The user is allowed to zoom and drag the map to change the projection and move around the world (in `src/macro/interactions.ts`).

Multiple parameters are available to the user to customize the map. The parameters are separated into two tabs inside a sidebar:

### Map settings from top bar
Contains parameters to customize visually the map: change the width / height of the container, the sea color, the graticule, the border, etc. It also allows changing "glow" parameters, which are custom SVG filters that allow the element on which they are applied to have a glow effect (inner and outer). Two glow presets are available: `firstGlow` and `secondGlow`.

### Left panel
In this tab, the user is able to decide which layers will be displayed on the map: will it show "lands" (which are all land masses in the world), will it show the countries boundaries.
The user can here add new adm data for countries. For instance it can chose to add ADM2 data for France.
For the "land" tab and the ADM tab, the user can chose which "glow filter" to use, that are defined in the general tab. This allows for a nice effect on the map.
For each layer (except land, which is just visual and has no data), the user can bind data to the layer.
With the data that is bound, the user can show a tooltip when a region is hovered, and colorize the map according to the data.

#### Tooltips
If the user enables tooltip for a layer, a tooltip will display when a region of this layer is hovered. The logic is handled in `src/tooltip.ts`. What is displayed in the tooltip will depend on what is in a dedicated template (inside `macroState.tooltipDefs.<layer>.template`). This template is using HTML, and a variable name in the data bound to the layer between 2 underscores means to display this variable (for instance `<span>Country: __name__</span>` will display `Country: France` when France is hovered). The template is editable for the user.

The user can edit the template style by clicking on a tooltip example in the sidebar, which opens the PropertiesPanel. The style changes will be stored in `macroState.tooltipDefs.<layer>.content` and applied on the actual tooltip on hover.


#### Layer coloring
With the data bound to a layer, the user can chose to colorize the layer according to a field of the data. There are 2 main modes for coloring:
- "categorical", if the data field contains strings
- "numerical" (quantize and quantile) if the data field contains numbers

Then the user can chose to display a legend with various options to customize how it is displayed. Legend rendering is in `src/svg/legend.ts`.

Export: `src/macro/export.ts`.


## Micro mode

This mode allows for the creation of detailed maps of smaller areas, such as cities. The main logic for this mode is contained in `src/micro/components/MicroSidebar.svelte` and `src/micro/drawing.ts`. This mode uses MapLibre GL to render a map with vector tiles served via PMTiles. The rendered vector features are then converted to D3/SVG paths to produce the final SVG map.

The `drawPrettyMap` function in `src/micro/drawing.ts` is responsible for rendering the map. It reads the rendered features from MapLibre, and uses D3.js to render them as SVG paths. The user can customize the appearance of the different layers by changing their color, stroke width, and other properties.

Layers available in micro mode: `grass`, `forest`, `sand`, `water`, `roads`, `railways`, `paths`, `buildings` (plus `background`). Layer styling is CSS-based and managed in `src/micro/change.ts`. Palettes (preset color themes) are defined in `src/micro/microPalettes.ts`. 3D buildings rendering is handled in `src/micro/3d.ts`.

The `onMicroParamChange` function is responsible for handling changes to the parameters, and it will update the CSS rules for the different layers accordingly.

The `exportMicro` function is responsible for exporting the map as an SVG file. It uses the SVGO library to optimize the SVG, and it also gives the user the option to embed the fonts in the SVG file or to convert the text to paths.

## Common features

Some common features exist between the two modes, which are handled in `App.svelte`. The main drawing function is the `draw` function in `App.svelte`, which will call all drawing functions (macro or micro + common drawing).

`src/components/ToolStrip.svelte`, docked in the top navbar, exposes the map's drawing tools:
- Draw / edit SVG `<path>` elements. The Curve button is a split button with two modes, stored in `curveMode` in `App.svelte` (localStorage key `mapello.curveMode`, default `pen`): **Pen** (`src/svg/penPath.ts`: click = corner anchor, click+drag = smooth anchor with handles, Alt = move one handle only, Shift = snap to 45°, Backspace/Ctrl+Z = remove last point, Enter/Esc/double-click/click on last point = finish and keep the path, switching tool also keeps it) and **Freehand** (`src/svg/freeHandPath.ts`: dragged stroke fitted to Béziers with `fit-curve`). Both output `M` + `C` commands only; editing is done by `src/svg/pathEditor.ts`
- Draw freehand on the map (`src/svg/freeHandDraw.ts`)
- Add labels on the map. It is possible to provide a font to the app. On export, we will give the choice to the user to embed or not the font as base64 in the final SVG, convert the `<text>` elements to `<path>` using `text-to-svg`, or the smallest file size of the 2 possibilities
- Add icons on the map (points / squares and more), stored as `ShapeDefinition` in `commonState.providedShapes`

Curve-specific options (image along a curve, curve end markers) live in the Properties panel once a curve is selected — see below.

### Properties panel (inspector)
`src/components/PropertiesPanel.svelte` is a permanent panel on the right side of the map area. Clicking any SVG element opens it for that element. It exposes:
- **Style editing**: fill, stroke colour, stroke width, stroke dash, font family. Edits CSS rules (shared selectors) or inline styles depending on which rule tab is selected. When editing inline styles, no overlay is shown on the map since the marching-ants ring already indicates the target. Style changes are dispatched via the `onStyleChanged` prop to `MacroSidebar.onStyleChanged` / `MicroSidebar.onStyleChanged`, which persist inline changes in `commonState.inlineStyles` via `handleInlineStyleChange` in `src/svg/svg.ts`. `applyStyles(commonState.inlineStyles)` re-applies them after every redraw.
- **Interactions**: link (URL on click), tooltip and popover annotations (opens the QuillEditor modal).
- **Path editing**: "Edit path" / "Exit editing" buttons for `path` entities.
- **Path editing** is implemented by `PathEditor` in `src/svg/pathEditor.ts` (see "Path editor" below).
- **Image along path** (path entities only): import an image, set duration/width/height, toggle "Rotate with curve". Backed by `PathDef.image`/`duration`/`width`/`height`/`imageRotate` in `commonState.providedPaths`.
- **Marker** (path entities only): pick an end-of-curve marker from `src/svg/markerDefs.ts`, or "None" to remove it. Backed by `PathDef.marker` (`MarkerName`) in `commonState.providedPaths`.
- **Delete**: removes the selected user entity.
- **Bring to front** (macro mode only, for `.country` and `.adm` elements): moves the element to the end of its parent group so it renders on top of siblings. Persisted via `commonState.inlineStyles[id].bringtofront`. Only one element per parent group can be on top; promoting a new one clears the flag from its siblings. The button is disabled when the element already has the flag set. The tooltip hover behaviour in `src/tooltip.ts` temporarily raises hovered regions, so on-top detection must use `inlineStyles` rather than DOM position.

The panel is opened programmatically via `propertiesPanel.open(el)` from SVG click handlers in `App.svelte`. `MacroSidebar` also opens it for legend sample clicks via the `openPropertiesPanel` prop.

### Path editor
`PathEditor` (`src/svg/pathEditor.ts`) edits a path made only of cubic Béziers (`M` then `C` commands). Created by `startPathEditing` in `App.svelte`; `finish()` / `undo()` / `redo()` are called from there, and `onFinish(null)` means the path was deleted.

How it works:
- `pathData` (`[anchor, handle, handle, anchor, ...]`) is the single source of truth; `render()` pushes it to the real path, the blue overlay and every visible point. Handle/anchor relations are derived from the index (anchor `i` owns handles `i-1` and `i+1`; the opposite of handle `h` is `2*anchor - h`).
- Only anchors are drawn. Selecting an anchor shows its two handles and tangent lines.
- A handle drag rotates the opposite handle (keeping its length) only if the two were collinear when the drag started (`isSmooth`), so cusps are preserved.
- The overlay copies the path's `transform`, and pointer positions are computed in that local space.
- Local undo/redo history (50 snapshots) is independent from the app-wide history; while editing, Ctrl+Z / Ctrl+Shift+Z in `App.svelte` is routed to the editor.
- Drags start after a 3px threshold: a mousedown+mouseup on the curve without movement inserts a point, with movement it translates the whole path.

Interactions and shortcuts (also summarised in the PropertiesPanel hint while editing):
| Action | Result |
|---|---|
| Click on the curve (or Ctrl+click) | Insert an anchor (a ghost dot previews the position on hover) |
| Drag the curve | Move the whole path |
| Click an anchor | Select it and show its handles |
| Click on the empty map | Deselect |
| Drag an anchor / handle | Move it (an anchor carries its handles; the opposite handle mirrors if the point is smooth) |
| Alt + drag a handle | Move it independently (creates a corner) |
| Double-click an anchor or handle | Toggle corner (handles collapsed) / smooth (handles re-created along the neighbours) |
| Delete / Backspace (or Ctrl+click an anchor) | Remove the anchor; removing one of the last 2 anchors deletes the path |
| Arrow keys (Shift = 10px) | Nudge the selected anchor |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo within the editor |
| Enter / Esc | Exit editing (Esc is handled in `App.svelte`) |

### Selection system
Shapes, paths, and freehand drawings can be selected, multi-selected, copied, pasted, and deleted. The selection state and operations are in `src/selection.svelte.ts`. A bounding box overlay is rendered by `src/svg/selectionOverlay.ts`.

### Element annotations
Any SVG element can have a tooltip (shown on hover) and/or a popover (shown on click). These are stored in `commonState.elementAnnotations` as `ElementAnnotations = { [elemId: string]: { tooltip?: string; popover?: string } }`. HTML content is fully-styled with inline styles. Tooltip logic is in `src/tooltip.ts`, popover logic in `src/popover.ts`. On export, these are serialized and included via `src/svg/exportScripts/elementAnnotations.js`.

### Undo / redo
Handled by `src/util/history.ts`.

### Saving
The state of the application is periodically serialized to `localStorage`. The state is global in `src/state.svelte.ts` and used throughout the app. Persistence is via `src/util/save.ts`.

### Layout
The map area (`#map-area`) uses `justify-content-start` with `padding-top: clamp(2rem, 6vh, 5rem)` so the SVG map sits near the top of the viewport rather than being vertically centred. The padding scales with viewport height to stay proportional at different zoom levels.

In micro mode, the "Search for a location" geocoding bar (`Geocoding.svelte`) is placed **below** the map (not above) to keep the map close to the top bar and improve feature discoverability.

## Backend

### Authentication
The app uses **better-auth** for user authentication. The app is fully usable without logging in, but login is required to export a map. If a user clicks Export without being logged in, `AuthModal.svelte` opens automatically.

- Server config: `src/lib/server/auth.ts` — configures email/password auth and optional Google OAuth (if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env vars are set). Uses `sveltekitCookies(getRequestEvent)` plugin from `$app/server`.
- Browser client: `src/lib/auth-client.ts` — exports `signIn`, `signUp`, `signOut` from `better-auth/client`.
- SvelteKit hook: `src/hooks.server.ts` — wires `svelteKitHandler` from `better-auth/svelte-kit` to handle all `/api/auth/*` requests.
- Session loading: `src/routes/(authed)/+layout.server.ts` — calls `auth.api.getSession()` on every request and exposes `user`/`session` via `page.data`. See "SvelteKit routing notes" below for why this isn't in the root layout.
- Auth API route: `src/routes/api/auth/[...all]/+server.ts` — passes requests to better-auth via `toSvelteKitHandler`.
- After login/logout: call `invalidateAll()` from `$app/navigation` to refresh `page.data.user`.
- UI: `AuthModal.svelte` (login/register with Google button), user dropdown with "Sign out" in the app navbar.
- Logged-in user: accessed in `App.svelte` via `page.data.user` from `$app/state`.

**Environment variables** (put in `.env`, see `.env.example`):
```
BETTER_AUTH_SECRET=   # required, min 32 chars (generate: npx auth secret)
BETTER_AUTH_URL=      # base URL, e.g. http://localhost:5173
GOOGLE_CLIENT_ID=     # optional
GOOGLE_CLIENT_SECRET= # optional
```

### Database
SQLite database at `data/mapello.db` managed with Drizzle ORM + better-sqlite3.

- `src/lib/server/db.ts`: opens the DB (WAL mode, foreign keys on), exports `db` instance.
- `src/lib/server/schema.ts`: `user_projects` table (id, user_id, name, project_json, created_at, updated_at).
- `src/lib/server/auth-schema.ts`: better-auth tables (user, session, account, verification) — generated by `npx @better-auth/cli generate`, do not edit manually.
- `drizzle.config.ts`: Drizzle Kit config pointing at both schema files and `data/mapello.db`.
- Run `npx drizzle-kit push` after any schema changes.

**Tables**: `user`, `session`, `account`, `verification` (managed by better-auth), `user_projects` (custom).

### Project storage
Logged-in users can save multiple named projects to the backend. Each project stores the full `GlobalState` JSON. A 1MB size limit is enforced server-side (413 if exceeded).

- `src/routes/api/projects/+server.ts`: `GET` (list), `POST` (create). All endpoints require a valid session (401 otherwise).
- `src/routes/api/projects/[id]/+server.ts`: `GET`, `PUT` (rename/overwrite JSON), `DELETE`. Ownership is checked on every request.
- UI: `ProjectDropdown.svelte` — navbar dropdown showing current project name. Supports create, load (auto-saves current first), rename, delete, reset to default. Mounted in `App.svelte`.
- `getProjectJson()` in `App.svelte`: builds the project JSON (same format as `saveProject()` local download).

### SvelteKit routing notes
- Route groups: `(landing)` holds the prerendered marketing pages (`prerender = true` per page); `(authed)` holds `(app)` (the map editor, `/app`, `/reset-password`) and `account`.
- `src/routes/(authed)/+layout.server.ts` is where the auth session (`auth.api.getSession`), subscription, and export-quota data are loaded. It is intentionally scoped to `(authed)` rather than the root layout so it never shares a load node with the prerendered `(landing)` pages — sharing it previously baked a logged-out session into the landing pages at build time, which the client router then reused (unchanged) when navigating into `/app`, since cookies aren't a tracked load dependency. Only a hard refresh forced a fresh, request-time session check. Root `src/routes/+layout.server.ts`/`+layout.ts` no longer exist.
- `src/routes/(authed)/(app)/app/+page.ts`: `export const ssr = false` — the map app page is client-only.
- `src/app.d.ts`: declares `App.Locals` (user, session) and `App.PageData` (user, session) for TypeScript.
- `tsconfig.json` `paths` includes `$lib`/`$lib/*` manually because the project-level `paths` object overrides the auto-generated `.svelte-kit/tsconfig.json` paths.
