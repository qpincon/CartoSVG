<script>
import { onMount } from 'svelte';
import { drawCustomPaths, parseAndUnprojectPath } from './paths';
import {Pane} from 'tweakpane';
import {geoSatellite} from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import * as topojsonSimplify from 'topojson-simplify';
import * as d3 from "d3";
import bbox from 'geojson-bbox';
import union from '@turf/union';
import rewind from '@turf/rewind';
import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from './svgo.config';
import Mustache from 'mustache';
// import versor from 'versor';
import cssTemplate from './style.template.txt';

import exportTemplate from './output_template.txt';

console.log(exportTemplate);
// https://greensock.com/docs/v3/Plugins/MotionPathHelper/static.editPath()
import MotionPathHelper from "./util/MotionPathHelper.js";
// console.log(MotionPathHelper);
const params = {
    width: 850,
    height: 950,
    useViewBox: false,
    longitude: 15,
    latitude: 36,
    altitude: 1000,
    rotation: 0,
    tilt: 25,
    fieldOfView: 50,
    useCanvas: false,
    firstGlow: {
        innerGlow: {blur: 4, strength: 1.4, color: "#7c490eff"},
        outerGlow: {blur: 4, strength: 3, color: '#ffffffff'},
    },
    secondGlow: {
        innerGlow: {blur: 4, strength: 1.4, color: "#A88FAFff"},
        outerGlow: {blur: 4, strength: 3, color: '#ffffffff'},
    },
    useGraticule: true,
    graticuleStep: 3,
    seaColor: "#b4d0ff8d",
    land: {
        show: true,
        fillColor: "#ffffffff",
        strokeColor: "#00000000",
        strokeWidth: 1,
        filter: 'firstGlow'
    },
    countries: {
        show: true,
        hover: true,
        hoverColor: "#fbbc0023",
        fillColor: "#f3efec80",
        strokeColor: "#D1BEB038",
        strokeWidth: 2,
    },
    provided: {
        show: true,
        hover: true,
        hoverColor: "#fbbc0023",
        fillColor: "#ffffff00",
        strokeColor: "#D1BEB038",
        strokeWidth: 1,
    },
    providedBorders: {
        show: true,
        fillColor: "#ffffffff",
        strokeColor: "#00000000",
        strokeWidth: 1,
        filter: ''
    },
    bgNoise: true,
};

const bounds = {
    width: [200, 1500],
    height: [300, 1600],
    longitude: [-180, 180],
    latitude: [-90, 90],
    rotation: [-180, 180],
    tilt: [0, 90],
    altitude: [8, 6000],
    fieldOfView: [1, 180],
    blur: [0.5, 10],
    strength: [0.1, 10],
    graticuleStep: [0.1, 10],
    strokeWidth: [0.1, 5],
};
const filterOptions = {
    none: '',
    firstGlow: 'firstGlow',
    secondGlow: 'secondGlow',
};

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
            const boundsDef = bounds[key];
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

import bg from './assets/img/bg.png';
// import bg from './assets/img/connection-signal.svg';
import uploadIcon from './assets/img/icon-upload.svg';

function appendGlow(selection, id="glows",
                    innerParams = {blur: 2, strength: 1, color: "#7c490e"},
                    outerParams = {blur: 4, strength: 1, color: '#998'}) {
    const colorInner = d3.rgb(innerParams.color);
    const colorOuter = d3.rgb(outerParams.color);
    const existing = d3.select(`#${id}`);
    // const defs = !existing.empty() ? existing.select(function() { return this.parentNode} ) : 
    //         .append('defs');
    if (!existing.empty()) existing.remove();
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs')
    const filter = defs.append('filter').attr('id', id).attr('filterUnits', 'userSpaceOnUse');

    // OUTER GLOW
    filter.append('feMorphology')
        .attr('in', 'SourceGraphic')
        .attr('radius', outerParams.strength)
        .attr('operator', 'dilate')
        .attr('result', 'MASK_OUTER');
    filter.append('feColorMatrix')
        .attr('in', 'MASK_OUTER')
        .attr('type', 'matrix')
        .attr('values', `0 0 0 0 ${colorOuter.r / 255} 0 0 0 0 ${colorOuter.g / 255} 0 0 0 0 ${colorOuter.b / 255} 0 0 0 ${colorOuter.opacity} 0`) // apply color
        .attr('result', 'OUTER_COLORED');
    filter.append('feGaussianBlur')
        .attr('in', 'OUTER_COLORED')
        .attr('stdDeviation', outerParams.blur)
        .attr('result', 'OUTER_BLUR');
    filter.append('feComposite')
        .attr('in', 'OUTER_BLUR')
        .attr('in2', 'SourceGraphic')
        .attr('operator', 'out')
        .attr('result', 'OUTGLOW');
    // filter.append('feDropShadow')
    //     .attr('flood-color', `${colorOuter}`)
    //     // .attr('flood-opacity', `${colorOuter.opacity}`)
    //     .attr('stdDeviation', `${outerParams.strength}`)
    //     .attr('result', 'OUTGLOW');

    // INNER GLOW
    filter.append('feMorphology')
        .attr('in', 'SourceAlpha')
        .attr('radius', innerParams.strength)
        .attr('operator', 'erode')
        .attr('result', 'INNER_ERODED');

    filter.append('feGaussianBlur')
        .attr('in', 'INNER_ERODED')
        .attr('stdDeviation', innerParams.blur)
        .attr('result', 'INNER_BLURRED');

    filter.append('feColorMatrix')
        .attr('in', 'INNER_BLURRED')
        .attr('type', 'matrix')
        .attr('values', `0 0 0 0 ${colorInner.r / 255} 0 0 0 0 ${colorInner.g / 255} 0 0 0 0 ${colorInner.b / 255} 0 0 0 -1 ${colorInner.opacity }`) // inverse color
        .attr('result', 'INNER_COLOR');

    filter.append('feComposite')
        .attr('in', 'INNER_COLOR')
        .attr('in2', 'SourceGraphic')
        .attr('operator', 'in')
        .attr('result', 'INGLOW');

    // Merge
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'OUTGLOW');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
    merge.append('feMergeNode').attr('in', 'INGLOW');
    filter.append(() => merge.node());

    defs.append(() => filter.node());
}

function appendBgPattern(selection, id, seaColor, bgNoise = false, imageSize=500) {
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs')
    const existing = d3.select(`#${id}`);
    if (!existing.empty()) existing.remove();
    const pattern = defs.append('pattern')
        .attr('id', id)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', imageSize)
        .attr('height', imageSize);
    if (bgNoise) {
        pattern.append('image')
            .attr('href', bg)
            .attr('x', 0).attr('y', 0)
            .attr('width', imageSize).attr('height', imageSize);
    }

    pattern.append('rect')
        .attr('width', imageSize).attr('height', imageSize)
        .attr('fill', seaColor);
    defs.append(() => pattern.node());
    const clipPath = selection.append('clipPath').attr('id', 'clip');
    clipPath.append('rectangle')
        .attr('x', 0).attr('y', 0)
        .attr('width', 300).attr('height', 300)
        .attr('rx', 15);
    selection.append(() => clipPath.node());
}

let countries = null;
let land = null;
let providedBorders = null;
let provided = null;
let simpleLand = null;
let commonCss = null;

// let countryPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json")
let countryPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json")
    .then(response => response.json())
    .then(world => {
        world.objects.countries.geometries = world.objects.countries.geometries.filter(feat => feat.id !== '462');
        return world;
    }) // remove buggy maldives
    .then(world => {
        countries = topojson.feature(world, world.objects.countries);
        console.log('countries', countries);
    });

// let landPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-10m.json")
let landPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json")
    .then(response => response.json())
    .then(world => {
        simpleLand = topojsonSimplify.simplify(topojsonSimplify.presimplify(world), 0.03);
        simpleLand = topojson.merge(simpleLand, simpleLand.objects.land.geometries);
        land = topojson.feature(world, world.objects.land);
        // console.log('land', land);
        land = splitMultiPolygons(land);
        console.log('land', land);
    });

Promise.all([countryPromise, landPromise]).then(() => draw());

let path = null;
let projection = null;
let svg = null;
let addingPath = false;
let currentPath = [];
let providedPaths = [];

onMount(() => {
    const container = d3.select('#map-container');
    container.call(d3.drag()
        .on("drag", dragged)
    );
    // container.call(d3.drag()
    //     .on("start", dragstarted)
    //     .on("drag", dragged)
    // );
    const zoom = d3.zoom().on('zoom', zoomed);
    zoom.scaleBy(container, altScale.invert(params.altitude));
    container.call(zoom);
});

const altScale = d3.scaleLinear().domain([1, 0]).range(bounds.altitude);
function zoomed(event) {
    if (!projection) return;
    if (event.transform.k > 0.1) {
        const newAltitude = altScale(event.transform.k);
        params.altitude = newAltitude;
    }
    else {
        event.transform.k = 0.1;
    }
    draw(true);
    pane.refresh();
}

const sensitivity = 75;
function dragged(event) {
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


// let v0, q0, r0;

// function dragstarted(event) {
//     console.log(event);
//     v0 = versor.cartesian(projection.invert(d3.pointer(event, this)));
//     console.log(v0)
//     q0 = versor(r0 = projection.rotate());
// }

// function dragged(event) {
//     console.log('dragged', event);
//     const p = d3.pointer(event, this);
//     const v1 = versor.cartesian(projection.rotate(r0).invert(p));
//     const delta = versor.delta(v0, v1);
//     let q1 = versor.multiply(q0, delta);

//     projection.rotate(versor.rotation(q1));

//     [params.longitude, params.latitude, params.rotation] = projection.rotate();
//     // In vicinity of the antipode (unstable) of q0, restart.
//     if (delta[0] < 0.7) dragstarted.apply(this, [event, this]);
//     draw(true);
//     pane.refresh();
// }



// remove buggy paths, covering the whole svg element
function removeCoveringAll(groupElement) {
    if (!groupElement) return;
    const parent = groupElement.closest('svg');
    const containerRect = parent.getBoundingClientRect();
    for (let child of groupElement.children) {
        if (child.tagName != 'path') continue;
        const d = child.getAttribute('d');
        // ignore empty path, and big ones (that actually draw something)
        if (!d || d.length > 100) continue;
        const rect = child.getBoundingClientRect();
        const includes = rect.x <= containerRect.x && rect.right >= containerRect.right 
            && rect.y <= containerRect.y && rect.bottom >= containerRect.bottom;
        if (includes) {
            console.log('removing', child);
            child.remove();
        }
    }
}

function draw(simplified = false) {
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
    svg.on("click", function(e) {
        const pos = projection.invert(d3.pointer(e));
        if (!addingPath) return;
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
                    const parsed = parseAndUnprojectPath(this.path.getAttribute('d'), projection);
                    providedPaths[pathIndex] = parsed;
                }
            });
        }
    });
    

    const groupData = [];
    groupData.push({ name: 'outline', data: [outline], id: null, props: [], class: 'outline', filter: null });
    groupData.push({ name: 'graticule', data: [graticule], id: null, props: [], class: 'graticule', filter: null });
    if (params.land.show)
        groupData.push({ name: 'land', data: land, id: null, props: [], class: 'land', filter: params.land.filter });
    if (params.countries.show && countries)
        groupData.push({ name: 'countries', data: countries, id: { prefix: 'iso-3166-1-', field: 'id' }, props: ['name'], class: 'country', filter: null });
    if (providedBorders && params.providedBorders.show)
        groupData.push({ name: 'provided-borders', data: [providedBorders], id: null, props: [], class: 'provided-borders', filter: params.providedBorders.filter });
    if (provided && params.provided.show)
        groupData.push({ name: 'provided', data: provided, id: null, props: [], class: 'provided', filter: null });
        
    const groups = svg.selectAll('g').data(groupData).join('g').attr('id', d => d.name);
    
    function drawPaths(data) {
        const pathElem = d3.select(this).selectAll('path')
        .data(data.data.features ? data.data.features : data.data)
        .join('path')
        .attr('d', (d) => {return path(d)});
        if (data.id) pathElem.attr('id', (d) => data.id.prefix + d[data.id.field]);
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
    // const css = Mustache.render(cssTemplate, params);
    commonCss = Mustache.render(cssTemplate, params);
    // commonCss = `<${''}style> ${css} </${''}style>`;
    setTimeout(() => removeCoveringAll(document.getElementById('land')), 0);
}

function fixOrder(geojson) {
    if (geojson.features) {
        const fixed = {...geojson};
        fixed.features = fixed.features.map(f =>
            rewind(f, { reverse: true })
        );
        return fixed;
    }
    return rewind(geojson);
}

function splitMultiPolygons(geojson) {
    const newGeojson = {type: 'FeatureCollection', features: []};
    geojson.features.forEach(feat => {
        if (feat.geometry.type == 'MultiPolygon') {
            feat.geometry.coordinates.map(coords => {
                newGeojson.features.push(
                {
                    type: 'Feature', 
                    properties: feat.properties, 
                    geometry: {
                        type: 'Polygon', coordinates: coords
                    }
                });
            });
        }
        else newGeojson.features.push(feat);
    });
    return newGeojson;
}

let providedProps = null;
function handleInput(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        // winding order matters !!!
        provided = fixOrder(JSON.parse(reader.result));
        providedBorders = provided.features.length > 1 ? provided.features.reduce((acc, cur)  => {
            return union(acc, cur);
        }, provided.features[0]) : provided.features[0];
        // const simpOptions = {tolerance: 0.005, highQuality: false};
        // providedBorders = simplify(buffer(providedBorders, 2), simpOptions); // buffer 1km and simplify
        const boundingBox = bbox(providedBorders);

        providedBorders = fixOrder({ type: "FeatureCollection", features: [{...providedBorders}] });
        
        params.longitude = (boundingBox[2] + boundingBox[0]) / 2;
        params.latitude = (boundingBox[3] + boundingBox[1]) / 2;
        params.tilt = 0;
        pane.refresh();
        draw();
    });
    reader.readAsText(file);
}

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
    addingPath = true;
}

function exportSvg() {
    console.log(svg.node().outerHTML)
    const svgExport = SVGO.optimize(svg.node().outerHTML, svgoConfig).data;
    console.log(svgExport);
    const exportParams = {
        svgStr: svgExport,
        commonCss: commonCss,
        addedCss: cssFonts,
    };
    const out = Mustache.render(exportTemplate, exportParams);
    download(out, 'text/plain', 'mySvg.js');
    // return out;
}

function download(content, mimeType, filename){
    const a = document.createElement('a');
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}



</script>


<svelte:head>
	{@html `<${''}style> ${commonCss} </${''}style>`}
	{@html `<${''}style> ${cssFonts} </${''}style>`}
</svelte:head>

<h1 class="has-text-centered is-size-2"> Map builder </h1>
<div id="map-container"></div>

<div>
    <div class="file m-4">
        <label class="file-label">
            <input class="file-input" type="file" accept=".geojson,.json" on:change={handleInput}>
            <span class="file-cta">
                <span class="file-icon"> <img src={uploadIcon} alt="upload-geojson"> </span>
                <span class="file-label"> Select geojson </span>
            </span>
        </label>
    </div>
    <div class="file m-4">
        <label class="file-label">
            <input class="file-input" type="file" accept=".ttf,.woff" on:change={handleInputFont}>
            <span class="file-cta">
                <span class="file-icon"> <img src={uploadIcon} alt="upload-font"> </span>
                <span class="file-label"> Select font </span>
            </span>
        </label>
    </div>
    <div class="button" on:click={addPath}> Add path </div>
    <div class="button" on:click={exportSvg}> Export </div>
</div>
