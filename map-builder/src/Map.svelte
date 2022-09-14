<script>
import { onMount } from 'svelte';
import { Pane } from 'tweakpane';
import { geoSatellite } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import * as d3 from "d3";
import SVGO from 'svgo/dist/svgo.browser';
import Mustache from 'mustache';
// import InlineStyleEditor from 'inline-style-editor';
import InlineStyleEditor from 'inline-style-editor/dist/inline-style-editor.mjs';
// https://greensock.com/docs/v3/Plugins/MotionPathHelper/static.editPath()
import MotionPathHelper from "./util/MotionPathHelper.js";

import svgoConfig from './svgo.config';
import cssTemplate from './templates/style.template.txt';
import exportTemplate from './templates/output_template.txt';
import { drawCustomPaths, parseAndUnprojectPath } from './svg/paths';
import { params, paramBounds, filterOptions} from './params';
import { appendBgPattern, appendGlow } from './svg/svgDefs';
import { splitMultiPolygons } from './util/geojson';
import { download } from './util/common';
import * as shapes from './util/shapes';
import { setTransformScale, setTransformTranslate } from './svg/svg';

import SlimSelect from './components/SlimSelect.svelte';

const resolvedAdm1 = {};
const countriesAdm1 = require.context('./assets/layers/adm1/', false, /\..*json$/, 'lazy');
const availableCountriesAdm1 = countriesAdm1.keys().reduce((acc, file) => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    acc[name.replace('_ADM', '')] = file;
    return acc;
}, {});

const positionVars = ['longitude', 'latitude', 'rotation', 'tilt', 'altitude', 'fieldOfView'];
const earthRadius = 6371;
const degrees = 180 / Math.PI;
const offCanvasPx = 5;
let timeoutId;
function gui(opts, redraw) {
    const pane = new Pane({title: 'Options', expanded: false});
    Object.entries(params).forEach(([key, value]) => {
        add(opts, key, value);
    })

    function add(opts, key, value, folder = pane) {
        if (typeof value == 'object') {
            const group = folder.addFolder({title: key, expanded: false});
            Object.entries(value).forEach(([innerKey, innerValue]) => {
                add(value, innerKey, innerValue, group);
            });
        } else {
            let params = {};
            const boundsDef = paramBounds[key];
            if (boundsDef) {
                params = {min: boundsDef[0], max:boundsDef[1]}
            }
            if (key.includes('filter')) params = { options: filterOptions };
            folder.addInput(opts, key, params);
        }
    }
    pane.on('change', (e) => {
        const prop = e.presetKey;
        if (positionVars.includes(prop)) {
            redraw(true);
        }
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            redraw(false);
        }, 300);
    });
    return pane;
}
const pane = gui(params, draw);

let countries = null;
let land = null;
// let providedBorders = null;
// let provided = null;
let simpleLand = null;
let commonCss = null;
let openContextMenuInfo;
let currentlyDragging = null;
const adm0Land = import('./assets/layers/world_adm0_simplified.topojson')
    .then(({default:topoAdm0}) => {
        countries = topojson.feature(topoAdm0, topoAdm0.objects.simp);
        // simpleLand = topojsonSimplify.simplify(topojsonSimplify.presimplify(topoAdm0), 0.00019);
        // simpleLand = splitMultiPolygons(topojson.feature(simpleLand, simpleLand.objects.simp));
        land = topojson.merge(topoAdm0, topoAdm0.objects.simp.geometries);
        land = splitMultiPolygons({type: 'FeatureCollection', features: [{type:'Feature', geometry: {...land} }]});
    });
const verySimpleLand = import('./assets/layers/world_land_very_simplified.topojson')
    .then(({default:land}) => {
        simpleLand = topojson.feature(land, land.objects.simp);
    });
Promise.all([adm0Land, verySimpleLand]).then(() => draw());

let path = null;
let projection = null;
let svg = null;
let addingPath = false;
let currentPath = [];
let providedPaths = [];
let providedShapes = []; // {name, coords, scale}
let chosenCountries = [];
let chosingPoint = false;
let pointSelected = false;
const inlineStyles = {}; // elemID -> prop -> value
let styleEditor;
let contextualMenu;

onMount(() => {
    styleEditor = new InlineStyleEditor({
        getAdditionnalElems: (el) => {
            if (el.classList.contains('adm1')) {
                const parentCountry = target.parentNode.getAttribute('id').replace('-adm1', '');
                const countryElem = document.getElementById(parentCountry);
                return [countryElem];
            }
            return [];
        },
        onStyleChanged: (target, eventType, cssProp, value) => {
            if (eventType === 'inline') {
                if (target.hasAttribute('id')) {
                    const elemId = target.getAttribute('id');
                    if (elemId in inlineStyles) inlineStyles[elemId][cssProp] = value;
                    else inlineStyles[elemId] = {[cssProp]: value};
                }
            }
        },
        customProps: {
            'scale': {
                type: 'slider', min: 0.5, max: 5, step: 0.1,
                getter: (el) => {
                    if (el.parentNode.getAttribute('id') !== 'points-labels') return null;
                    const transform = el.getAttribute('transform');
                    if (!transform) return 1;
                    else {
                        const scaleValue = transform.match(/scale\(([0-9\.]+)\)/);
                        if (scaleValue && scaleValue.length > 1) return parseFloat(scaleValue[1]);
                    }
                    return 1;
                },
                setter: (el, val) => {
                    const scaleStr = `scale(${val})`;
                    setTransformScale(el, scaleStr);
                }
            },
        }
    });
    document.body.append(contextualMenu);
    contextualMenu.style.display = 'none';
    contextualMenu.style.position = 'absolute';
    const container = d3.select('#map-container');
    container.call(d3.drag()
        .on("drag", dragged)
        .on('start', () => {currentlyDragging = "all"; closeMenu();})
        .on('end', () => currentlyDragging = null)
    );
    const zoom = d3.zoom().on('zoom', zoomed).on('start', () => closeMenu());
    zoom.scaleBy(container, altScale.invert(params.altitude));
    container.call(zoom);
});

const altScale = d3.scaleLinear().domain([1, 0]).range(paramBounds.altitude);
function zoomed(event) {
    if (!event.sourceEvent) return;
    if (!projection) return;
    if (event.transform.k > 0.01 && event.transform.k < 1.0) {
        const newAltitude = altScale(event.transform.k);
        params.altitude = newAltitude;
    }
    else if (event.transform.k < 0.01) {
        event.transform.k = 0.01;
    }
    else {
        event.transform.k  = 1.0;
    }
    draw(true);
    pane.refresh();
}

const sensitivity = 75;
function dragged(event) {
    if (currentlyDragging !== 'all') return;
    if (event.sourceEvent.shiftKey) {
        params.tilt += event.dy / 10;
    }
    else if (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey) {
        params.rotation -= event.dx / 10;
    }
    else {
        const rotate = projection.rotate();
        const rotRad =  (params.rotation / 180) * Math.PI;
        const [xPartX, xPartY] = [Math.cos(rotRad), Math.sin(rotRad)]; 
        const [yPartX, yPartY] = [-Math.sin(rotRad), Math.cos(rotRad)];
        const k = sensitivity / projection.scale();
        const adjustedDx = ((event.dx * xPartX) + (event.dy * yPartX)) * k;
        const adjustedDy = ((event.dy * yPartY) + (event.dx * xPartY)) * k;
        params.longitude = -rotate[0] - (adjustedDx);
        params.latitude = -rotate[1] + (adjustedDy);
    }
    draw(true);
    pane.refresh();
}

function draw(simplified = false, _) {
    // console.log((new Error()));
    for (const country of chosenCountries) {
        if (!(country in resolvedAdm1)) {
            countriesAdm1(availableCountriesAdm1[country]).then(resolved => {
                resolvedAdm1[country] = topojson.feature(resolved, resolved.objects.country);;
                draw(simplified);
            });
            return;
        }
    }
    const snyderP = 1.0 + params.altitude / earthRadius;
    const dY = params.altitude * Math.sin(params.tilt / degrees);
    const dZ = params.altitude * Math.cos(params.tilt / degrees);
    const visibleYextent = 2 * dZ * Math.tan(0.5 * params.fieldOfView / degrees);
    const yShift = dY * params.height / visibleYextent;
    const scale = earthRadius * params.height / visibleYextent;
    const tilt = params.tilt / degrees;
    const alpha = Math.acos(snyderP * Math.cos(tilt) * 0.999);
    const clipDistance = d3.geoClipCircle(Math.acos(1 / snyderP) - 1e-6);
    const preclip = alpha ? geoPipeline(
        clipDistance,
        geoRotatePhi(Math.PI + tilt),
        d3.geoClipCircle(Math.PI - alpha - 1e-4), // Extra safety factor needed for large tilt values
        geoRotatePhi(-Math.PI - tilt)
    ) : clipDistance;

    function geoRotatePhi(deltaPhi) {
        const cosDeltaPhi = Math.cos(deltaPhi);
        const sinDeltaPhi = Math.sin(deltaPhi);
        return sink => ({
            point(lambda, phi) {
                const cosPhi = Math.cos(phi);
                const x = Math.cos(lambda) * cosPhi;
                const y = Math.sin(lambda) * cosPhi;
                const z = Math.sin(phi);
                const k = z * cosDeltaPhi + x * sinDeltaPhi;
                sink.point(Math.atan2(y, x * cosDeltaPhi - z * sinDeltaPhi), Math.asin(k));
            },
            lineStart() { sink.lineStart(); },
            lineEnd() { sink.lineEnd(); },
            polygonStart() { sink.polygonStart(); },
            polygonEnd() { sink.polygonEnd(); },
            sphere() { sink.sphere(); }
        });
    }

    function geoPipeline(...transforms) {
        return sink => {
            for (let i = transforms.length - 1; i >= 0; --i) {
                sink = transforms[i](sink);
            }
            return sink;
        };
    }

    const container = d3.select('#map-container');
    container.html('');

    projection = geoSatellite()
        .scale(scale)
        .translate([(params.width / 2), (yShift + params.height / 2)])
        .rotate([-params.longitude, -params.latitude, params.rotation])
        .tilt(params.tilt)
        .distance(snyderP)
        .preclip(preclip)
        .postclip(d3.geoClipRectangle(-offCanvasPx, -offCanvasPx, params.width + offCanvasPx, params.height + offCanvasPx))
        .precision(0.1);
   
    const outline = {type: "Sphere"};
    const graticule = d3.geoGraticule().step([params.graticuleStep, params.graticuleStep])();
    if (!params.useGraticule) graticule.coordinates = [];
    if (params.useCanvas || simplified) {
        let canvas = container.select('#canvas');
        if (canvas.empty()) canvas = container.append('canvas').attr('id', 'canvas').attr('width', params.width).attr('height', params.height);
        const context = canvas.node().getContext('2d');
        context.clearRect(0, 0, params.width, params.height);
        path = d3.geoPath(projection, context);
        context.fillStyle = "#88d";
        context.beginPath(), path(simplified ? simpleLand : land), context.fill();
        context.beginPath(),
            path(graticule),
            (context.strokeStyle = "#ddf"),
            (context.globalAlpha = 0.8),
            context.stroke();
        return context.canvas;
    }
    svg = container.select('svg');
    if (svg.empty()) svg = container.append('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg")
        .attr('xmlns:xlink', "http://www.w3.org/1999/xlink")
        .attr('id', 'map');
    if (params.useViewBox) {
        svg.attr('viewBox', `0 0 ${params.width} ${params.height}`);
    }
    else {
        svg.attr('width', `${params.width }`)
        .attr('height', `${params.height }`)
    }
    container.style('width', `${params.width}px`).style('height', `${params.height}px`);

    path = d3.geoPath(projection);
    svg.html('');
    svg.on('contextmenu', function(e) {
        console.log('contextmenu global', e);
        e.preventDefault();
        showMenu(e);
        chosingPoint = false;
        return false;
    }, false);
    svg.on("click", function(e) {
        closeMenu();
        if (!addingPath) return;
        const pos = projection.invert(d3.pointer(e));
        let elem = svg.select('#paths');
        if (elem.empty()) elem = svg.append('g').attr('id', 'paths');
        currentPath.push(pos);
        if (currentPath.length === 2) {
            const pathIndex = providedPaths.length;
            const id = `path-${pathIndex}`;
            const initialPath = `M${projection(currentPath[0])}L${projection(currentPath[1])}`;
            elem.append('path')
                .attr('id', id)
                .attr('d', initialPath);
            providedPaths.push(parseAndUnprojectPath(initialPath, projection));
            currentPath = [];
            addingPath = false;
            MotionPathHelper.editPath(`#${id}`, {
                onRelease: function() {
                    const parsed = parseAndUnprojectPath(this.path, projection);
                    providedPaths[pathIndex] = parsed;
                }
            });
        }
    });
    

    const groupData = [];
    groupData.push({ name: 'outline', data: [outline], id: null, props: [], class: 'outline', filter: null });
    groupData.push({ name: 'graticule', data: [graticule], id: null, props: [], class: 'graticule', filter: null });
    if (params.land.show) {
        groupData.push({ name: 'land', data: land, id: null, props: [], class: 'land', filter: params.land.filter });
    }
    if (params.countries.show && countries) {
        groupData.push({ name: 'countries', data: countries, id: (prop) => prop.shapeGroup, props: [], class: 'country', filter: null });
    }
    // if (providedBorders && params.providedBorders.show)
    //     groupData.push({ name: 'provided-borders', data: [providedBorders], id: null, props: [], class: 'provided-borders', filter: params.providedBorders.filter });
    // if (provided && params.provided.show)
    //     groupData.push({ name: 'provided', data: provided, id: null, props: [], class: 'provided', filter: null });
    if (params.adm1.show) {
        for (const country of chosenCountries) {
            groupData.push({ name: `${country}-adm1`, data: resolvedAdm1[country], id: (prop) => prop.shapeName, props: [], class: 'adm1', filter: null });
        }
    }
    groupData.push({ name: 'points-labels', data: [], id: null, props: [], class: null, filter: null });

    const groups = svg.selectAll('g').data(groupData).join('g').attr('id', d => d.name);
    
    function drawPaths(data) {
        if (!data.data) return;
        const pathElem = d3.select(this).selectAll('path')
        .data(data.data.features ? data.data.features : data.data)
        .join('path')
        .attr('d', (d) => {return path(d)});
        if (data.id && typeof data.id === 'object') pathElem.attr('id', (d) => data.id.prefix + d[data.id.field]);
        else if (typeof data.id === 'function') pathElem.attr('id', (d) => data.id(d.properties));
        if (data.class) pathElem.attr('class', data.class);
        if (data.filter) pathElem.attr('filter', `url(#${data.filter})`);
        data.props.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]))
    }
        
    groups.each(drawPaths);

    drawCustomPaths(providedPaths, svg, projection);
    appendGlow(svg, 'firstGlow', params.firstGlow.innerGlow, params.firstGlow.outerGlow);
    appendGlow(svg, 'secondGlow', params.secondGlow.innerGlow, params.secondGlow.outerGlow);
    appendBgPattern(svg, 'noise', params.seaColor, params.bgNoise);
    d3.select('#outline').style('fill', "url(#noise)");
    commonCss = Mustache.render(cssTemplate, params);
    
    drawShapes();

}

function applyStyles() {
    // apply inline styles
    Object.entries(inlineStyles).forEach((([elemId, style]) => {
        const elem = document.getElementById(elemId);
        Object.entries(style).forEach(([cssProp, cssValue]) => {
            if (cssProp === 'scale') {
                setTransformScale(elem, `scale(${cssValue})`);
            }
            else elem.style[cssProp] = cssValue;
        });
    }));
}
// function handleInput(e) {
//     const file = e.target.files[0];
//     const reader = new FileReader();
//     reader.addEventListener('load', () => {
//         // winding order matters !!!
//         provided = fixOrder(JSON.parse(reader.result));
//         providedBorders = provided.features.length > 1 ? provided.features.reduce((acc, cur)  => {
//             return union(acc, cur);
//         }, provided.features[0]) : provided.features[0];
//         const boundingBox = bbox(providedBorders);

//         providedBorders = fixOrder({ type: "FeatureCollection", features: [{...providedBorders}] });
        
//         params.longitude = (boundingBox[2] + boundingBox[0]) / 2;
//         params.latitude = (boundingBox[3] + boundingBox[1]) / 2;
//         params.tilt = 0;
//         pane.refresh();
//         draw();
//     });
//     reader.readAsText(file);
// }

let providedFonts = [];
let cssFonts;
function fontsToCss(fonts) {
    cssFonts = fonts.map(({name, content}) => {
        return `@font-face {
            font-family: "${name}";
            src: url("${content}");
        }`;
    }).join('\n') || '';
}
$: fontsToCss(providedFonts);

function handleInputFont(e) {
    const file = e.target.files[0];
    const fileName = file.name.split('.')[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        console.log(reader.result);
        const newFont = {name: fileName, content: reader.result}
        providedFonts.push(newFont);
        providedFonts = providedFonts;
    });
    reader.readAsDataURL(file);
}

function addPath() {
    closeMenu();
    addingPath = true;
}

function exportSvg() {
    const svgExport = SVGO.optimize(svg.node().outerHTML, svgoConfig).data;
    const renderedCss = exportStyleSheet();
    const exportParams = {
        svgStr: svgExport,
        commonCss: renderedCss,
        addedCss: cssFonts,
    };
    const out = Mustache.render(exportTemplate, exportParams);
    console.log(renderedCss);
    download(out, 'text/plain', 'mySvg.js');
}

$: draw(false, chosenCountries); // redraw when chosenCountries changes

function styleSheetToText(sheet) {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (let r in rules) {
        styleTxt += rules[r].cssText;
    }
    return styleTxt;
}
function exportStyleSheet() {
    const sheets = document.styleSheets;
    for (let i in sheets) {
        const rules = sheets[i].cssRules;
        for (let r in rules) {
            const selectorText = rules[r].selectorText;
            if (selectorText == "#map-container") return styleSheetToText(sheets[i]);
        }
    }
}

const domParser = new DOMParser();

function closeMenu() {
    contextualMenu.style.display = 'none';
    chosingPoint = false;
    pointSelected = false;
}
function editStyles() {
    closeMenu();
    styleEditor.open(openContextMenuInfo.event.target, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
}
function addPoint(e) {
    // closeMenu();
    chosingPoint = true;
    console.log('add point', e);
}
function addLabel(e) {
    closeMenu();
    console.log('add label', e);
}

function drawShapes() {
    const container = document.getElementById('points-labels');
    if (!container) return;
    container.innerHTML = '';
    providedShapes.forEach((shapeDef, i) => {
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg">${shapes[shapeDef.name]}</svg>`;
        const svgShape = domParser.parseFromString(svgStr, 'text/html').body.childNodes[0].firstChild;
        const projectedPos = projection(shapeDef.pos);
        const transform = `translate(${projectedPos[0]} ${projectedPos[1]})`;
        svgShape.setAttribute('transform', transform);
        svgShape.setAttribute('id', shapeDef.id);
        container.appendChild(svgShape);
    });
    d3.select(container).call(d3.drag()
        .on("drag", function(event) {
            setTransformTranslate(currentlyDragging, `translate(${event.x} ${event.y})`);
        })
        .on('start', (e) => currentlyDragging = e.sourceEvent.target)
        .on('end', (e) => {
            const pointId = currentlyDragging.getAttribute('id');
            const pointDef = providedShapes.find(def => def.id === pointId);
            pointDef.pos = projection.invert([e.x, e.y]);
            currentlyDragging = null;
        })
    );
    d3.select(container).on('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        pointSelected = true;
        showMenu(e);
        return false;
    }, false);
    applyStyles();
}

function showMenu(e) {
    openContextMenuInfo = {event: e, position: projection.invert(d3.pointer(e))};
    contextualMenu.style.display = 'block';
    contextualMenu.style.left = e.pageX + "px";
    contextualMenu.style.top = e.pageY + "px";
}

let shapeCount = 0;
function addShape(shapeName) {
    const shapeId = `${shapeName}-${shapeCount++}`;
    providedShapes.push({name: shapeName, pos: openContextMenuInfo.position, scale: 1, id:shapeId});
    drawShapes();
    closeMenu();
    setTimeout(() => {
        const lastShape = document.getElementById(providedShapes[providedShapes.length -1].id);
        styleEditor.open(lastShape, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
    }, 0);
}

function copySelection() {
    const pointId = openContextMenuInfo.event.target.getAttribute('id');
    const newDef = {...providedShapes.find(def => def.id === pointId)};
    const projected = projection(newDef.pos);
    newDef.pos = projection.invert([projected[0] - 10, projected[1]]);
    const newShapeId = `${newDef.name}-${shapeCount++}`;
    inlineStyles[newShapeId] = {...inlineStyles[newDef.id]};
    newDef.id = newShapeId;
    providedShapes.push(newDef);
    drawShapes();
    closeMenu();
}

function deleteSelection() {
    const pointId = openContextMenuInfo.event.target.getAttribute('id');
    delete inlineStyles[pointId];
    providedShapes = providedShapes.filter(def => def.id !== pointId);
    drawShapes();
    closeMenu();
}

</script>


<svelte:head>
	{@html `<${''}style> ${commonCss} </${''}style>`}
	{@html `<${''}style> ${cssFonts} </${''}style>`}
</svelte:head>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu}>
    {#if chosingPoint}
        {#each Object.keys(shapes) as shapeName (shapeName)}
            <div role="button" class="px-2 py-1" on:click={() => addShape(shapeName)}> { shapeName } </div>
        {/each}
    {:else if pointSelected}
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit styles </div>
        <div role="button" class="px-2 py-1" on:click={copySelection}> Copy </div>
        <div role="button" class="px-2 py-1" on:click={deleteSelection}> Delete </div>
    {:else}
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit styles </div>
        <div role="button" class="px-2 py-1" on:click={addPath}> Draw path </div>
        <div role="button" class="px-2 py-1" on:click={addPoint}> Add point </div>
        <div role="button" class="px-2 py-1" on:click={addLabel}> Add label </div>
    {/if}
</div>
<h1 class="text-center fs-2"> Static SVG Map builder </h1>
<div id="map-container"></div>

<div>
    <!-- <div class="file m-4">
        <label class="file-label">
            <input class="file-input" type="file" accept=".geojson,.json" on:change={handleInput}>
            <span class="file-cta">
                <span class="file-icon"> <img src={uploadIcon} alt="upload-geojson"> </span>
                <span class="file-label"> Select geojson </span>
            </span>
        </label>
    </div> -->
    <p> {chosenCountries} </p>
    <SlimSelect bind:value={chosenCountries} options={Object.keys(availableCountriesAdm1)} multiple="true"/>
    <div class="file m-4">
        <label class="file-label">
            <input class="form-control" type="file" accept=".ttf,.woff" on:change={handleInputFont}>
        </label>
    </div>
    <div class="btn btn-light" on:click={addPath}> Add path </div>
    <div class="btn btn-light" on:click={exportSvg}> Export </div>
</div>
