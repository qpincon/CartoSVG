<script>
import { onMount, tick } from 'svelte';
import { geoSatellite } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import * as d3 from "d3";
import SVGO from 'svgo/dist/svgo.browser';
import InlineStyleEditor from '../node_modules/inline-style-editor/dist/inline-style-editor.mjs';
import 'bootstrap/js/dist/dropdown';

import dataExplanation from './assets/dataColor.svg';
import svgoConfig from './svgoExport.config';
import { drawCustomPaths, parseAndUnprojectPath } from './svg/paths';
import PathEditor from './svg/pathEditor';
import { paramDefs, defaultParams, helpParams } from './params';
import { appendBgPattern, appendGlow } from './svg/svgDefs';
import { splitMultiPolygons } from './util/geojson';
import { download, sortBy, indexBy, htmlToElement, getNumericCols, initTooltips, debounce, getBestFormatter } from './util/common';
import * as shapes from './svg/shapeDefs';
import { setTransformScale, closestDistance } from './svg/svg';
import { drawShapes } from './svg/shape';
import iso3Data from './assets/data/iso3_filtered.json';
import DataTable from './components/DataTable.svelte';

import Legend from './components/Legend.svelte';
import defaultBaseCss from './assets/pagestyle.css?inline';
import { drawLegend } from './svg/legend';
import { freeHandDrawPath } from './svg/freeHandPath'
import Modal from './components/Modal.svelte';
import NestedAccordions from './components/NestedAccordions.svelte';
import Navbar from './components/Navbar.svelte';

import Icon from './components/Icon.svelte';
import RangeInput from './components/RangeInput.svelte';
import { reportStyle, fontsToCss, exportStyleSheet } from './util/dom';
import { saveState, getState } from './util/save';
import { svgToPng } from './svg/toPng';
import { exportSvg, exportFontChoices } from './svg/export';
import { addTooltipListener} from './tooltip';

const scalesHelp = `
<div class="inline-tooltip">  
    <p> 
        <i> Quantiles </i> separate a population into intervals of similar sizes (the 10% poorest, the 50% tallest, the 1% richest…). It is defined by the data itself (a set of values).
         <br/>
        To <i> quantize </i> means to group values with discrete increments. It is defined by the extent (min/max) of the data.
        </p> 
    <img src=${dataExplanation} width="460" height="60"> <br/>
    Those scales are only available when numeric data is associated with the layer. 
</div>
`;
const defaultTooltipStyle = `will-change: opacity; font-size: 14px; padding: 10px; background-color: #FFFFFF; border: 1px solid black; max-width: 15rem; width: max-content; border-radius:7px;`;

const iconsReq = require.context('./assets/img/.?inline', false, /\.svg$/);
const icons = iconsReq.keys().reduce((acc, iconFile) => {
    const name = iconFile.match(/\w+/)[0]; // remove extension
    acc[name] = iconsReq(iconFile); 
    return acc;
}, {});

let params = JSON.parse(JSON.stringify(defaultParams));
const iso3DataById = indexBy(iso3Data, 'alpha-3');
const resolvedAdm = {};
const countriesAdm1Resolve = require.context('./assets/layers/adm1/', false, /\..*json$/, 'lazy');
const availableCountriesAdm1 = countriesAdm1Resolve.keys().reduce((acc, file) => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    acc[`${iso3DataById[name]?.name} ADM1`] = file;
    return acc;
}, {});

const countriesAdm2Resolve = require.context('./assets/layers/adm2/', false, /\..*json$/, 'lazy');
const availableCountriesAdm2 = countriesAdm2Resolve.keys().reduce((acc, file) => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    acc[`${iso3DataById[name]?.name} ADM2`] = file
    return acc;
}, {});
const allAvailableAdm = [...Object.keys(availableCountriesAdm1), ...Object.keys(availableCountriesAdm2)].sort();

const formatLocaleResolve = require.context('../node_modules/d3-format/locale/', false,  /\..*json$/);
const resolvedLocales = {};
const availableFormatLocales = formatLocaleResolve.keys().map(file => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    resolvedLocales[name] = formatLocaleResolve(file);
    return name;
}, {});


function resolveAdm(name) {
    if (name.includes('ADM1')) return countriesAdm1Resolve(availableCountriesAdm1[name]);
    return countriesAdm2Resolve(availableCountriesAdm2[name]);
}

function findProp(propName, obj) {
    if (propName in obj) return obj[propName];
    for (let v of Object.values(obj)) {
        if (typeof v === 'object') {
            const found = findProp(propName, v);
            if (found !== undefined) return found;
        }
    }
}

String.prototype.formatUnicorn = String.prototype.formatUnicorn || function () {
    let str = this.toString();
    if (arguments.length) {
        const t = typeof arguments[0];
        const args = ("string" === t || "number" === t) ?
        Array.prototype.slice.call(arguments)
        : arguments[0];

        for (const key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

const p = (propName, obj = params) => findProp(propName, obj);

const positionVars = ['longitude', 'latitude', 'rotation', 'tilt', 'altitude', 'fieldOfView'];
const earthRadius = 6371;
const degrees = 180 / Math.PI;
const offCanvasPx = 10;
let timeoutId;
let countries = null;
let land = null;
let simpleLand = null;
let openContextMenuInfo;
const adm0Land = import('./assets/layers/world_adm0_simplified.topojson')
    .then(({default:topoAdm0}) => {
        const firstKey = Object.keys(topoAdm0.objects)[0];
        countries = topojson.feature(topoAdm0, topoAdm0.objects[firstKey]);
        countries.features.forEach(feat => {
            feat.properties = iso3DataById[feat.properties['shapeGroup']] || {};
        });
        land = topojson.merge(topoAdm0, topoAdm0.objects[firstKey].geometries);
        land = splitMultiPolygons({type: 'FeatureCollection', features: [{type:'Feature', geometry: {...land} }]}, 'land');
    });
const verySimpleLand = import('./assets/layers/world_land_very_simplified.topojson')
    .then(({default:land}) => {
        const firstKey = Object.keys(land.objects)[0];
        simpleLand = topojson.feature(land, land.objects[firstKey]);
    });
Promise.all([adm0Land, verySimpleLand]).then(() => draw());

let path = null;
let projection = null;
let svg = null;
const defaultLegendDef =  {
    x: 20,
    y: p('height') - 100,
    lineWidth: 100,
    rectWidth: 30,
    rectHeight: 30,
    significantDigits: 3,
    maxWidth: 200,
    direction: 'v',
    title: null,
    sampleHtml: null,
    changes: {},
};
const defaultColorDef = {
    enabled: false,
    colorScale: null,
    colorColumn: null,
    colorPalette: null,
    nbBreaks: 5,
    legendEnabled: false,
};

// ====== State =======
let baseCss = defaultBaseCss;
let providedPaths = [];
let providedShapes = []; // {name, coords, scale, id}
let chosenCountriesAdm = [];
let inlineProps = {
    longitude: 15,
    latitude: 42.5,
    altitude: null,
    rotation: 0,
    tilt: 8.7,
    showLand: true,
    showCountries: true
};

let providedFonts = [];
let shapeCount = 0;
let inlineStyles = {}; // elemID -> prop -> value
let zonesData = {}; // key => {data (list), provided (bool), numericCols (list)}
let zonesFilter = {'land': 'firstGlow'};
let lastUsedLabelProps = {'font-size': '14px'};

let tooltipDefs = {
    countries: {
        template: defaultTooltipContent(true),
        content: defaultTooltipFull(defaultTooltipContent(true)),
        enabled: false,
        locale: 'en-US'
    }
};

let colorDataDefs = {
    countries: {...defaultColorDef}
};
let legendDefs = {countries: JSON.parse(JSON.stringify(defaultLegendDef))};
let orderedTabs = ['countries', 'land'];

// ==== End state =====

let cssFonts;
let commonCss;
const menuStates = {
    chosingPoint:      false,
    pointSelected:     false,
    addingLabel:       false,
    pathSelected:      false,
    addingImageToPath: false
};
let editedLabelId;
let textInput;
let typedText = "";
let styleEditor;
let contextualMenu;
let showModal = false;
let showExportConfirm = false;
let exportForm;
let htmlTooltipElem;
let currentTab = 'countries';

let editingPath = false;
let commonStyleSheetElem;
let zoomFunc;
let dragFunc;
onMount(() => {
    commonStyleSheetElem = document.createElement('style');
    document.head.appendChild(commonStyleSheetElem);
    commonStyleSheetElem.innerHTML = baseCss;
    restoreState();
    styleEditor = new InlineStyleEditor({
        onStyleChanged: (target, eventType, cssProp, value) => {
            if (legendSample && legendSample.contains(target) && cssProp !== 'fill') {
                legendDefs[currentTab].sampleHtml = legendSample.outerHTML;
                colorizeAndLegend();
            }
            else if (htmlTooltipElem && htmlTooltipElem.contains(target)) {
                tooltipDefs[currentTab].content = htmlTooltipElem.outerHTML;
            }
            else if (eventType === 'inline') {
                if (target.hasAttribute('id')) {
                    const elemId = target.getAttribute('id');
                    if (elemId.includes('label')) {
                        lastUsedLabelProps[cssProp] = value;
                    }
                    if (elemId in inlineStyles) inlineStyles[elemId][cssProp] = value;
                    else inlineStyles[elemId] = {[cssProp]: value};
                }
            }
            save();
        },
        getAdditionalElems: (el) => {
            if (el.classList.contains('adm')) {
                const parentCountry = el.parentNode.getAttribute('id').replace(/ ADM(1|2)/, '')
                const parentCountryIso3 = iso3Data.find(row => row.name === parentCountry)['name'];
                const countryElem = document.getElementById(parentCountryIso3);
                if (!countryElem) return [];
                return [countryElem];
            }
            return [];
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
    attachListeners();
});

function attachListeners() {
    const container = d3.select('#map-container');
    dragFunc = d3.drag()
        .filter((e) => !e.button)   // Remove ctrlKey
        .on("drag", dragged)
        .on('start', () => {
            if (menuStates.addingLabel) validateLabel();
            styleEditor.close();
            closeMenu();
        });

    zoomFunc = d3.zoom().on('zoom', zoomed).on('start', () => closeMenu());
    container.call(dragFunc);
    container.call(zoomFunc);
}

function detachListeners() {
    const container = d3.select('#map-container');
    container.on(".drag", null);
    container.on(".zoom", null);
}

let altScale = d3.scaleLinear().domain([1, 0]).range([100, 10000]);
function zoomed(event) {
    if (!event.sourceEvent) return;
    if (!projection) return;
    event.transform.k = Math.max(Math.min(event.transform.k, 1), 0.00001)
    const newAltitude = Math.round(altScale(event.transform.k));
    params["General"].altitude = newAltitude;
    redraw('altitude');
}

const sensitivity = 75;
function dragged(event) {
    if (event.sourceEvent.shiftKey) {
        inlineProps.tilt += event.dy / 10;
    }
    else if (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey) {
        inlineProps.rotation -= event.dx / 10;
    }
    else {
        const rotate = projection.rotate();
        const rotRad =  (inlineProps.rotation / 180) * Math.PI;
        const [xPartX, xPartY] = [Math.cos(rotRad), Math.sin(rotRad)]; 
        const [yPartX, yPartY] = [-Math.sin(rotRad), Math.cos(rotRad)];
        const k = sensitivity / projection.scale();
        const adjustedDx = ((event.dx * xPartX) + (event.dy * yPartX)) * k;
        const adjustedDy = ((event.dy * yPartY) + (event.dx * xPartY)) * k;
        inlineProps.longitude = -rotate[0] - (adjustedDx);
        inlineProps.latitude = -rotate[1] + (adjustedDy);
    }
    redraw('longitude');
}

let firstDraw = true;
// without 'countries' if unchecked
let computedOrderedTabs = [];
async function draw(simplified = false, _) {
    computedOrderedTabs = orderedTabs.filter(x => {
        if (x === 'countries') return inlineProps.showCountries;
        if (x === 'land') return inlineProps.showLand;
        return true;
    });
    if (!computedOrderedTabs.length || (computedOrderedTabs.length === 1 && computedOrderedTabs[0] === 'land')) currentTab = null;
    else if (computedOrderedTabs.length > 0 && currentTab === null) {
        let i = 0;
        while (computedOrderedTabs[i] === 'land') ++i;
        currentTab = computedOrderedTabs[i];
    }
    for (const countryAdm of chosenCountriesAdm) {
        if (!(countryAdm in resolvedAdm)) {
            const resolved = await resolveAdm(countryAdm);
            const firstKey = Object.keys(resolved.objects)[0];
            resolvedAdm[countryAdm] = topojson.feature(resolved, resolved.objects[firstKey]);
            draw(simplified);
            return;
        }
        if (!(countryAdm in tooltipDefs)) {
            const contentTemplate = defaultTooltipContent(false);
            tooltipDefs[countryAdm] = {
                template: contentTemplate,
                content: defaultTooltipFull(contentTemplate),
                enabled: false,
                locale: 'en-US'
            };
            colorDataDefs[countryAdm] = {...defaultColorDef};
            legendDefs[countryAdm] = JSON.parse(JSON.stringify(defaultLegendDef));
        }
        if (!(countryAdm in zonesData) && !zonesData?.[countryAdm]?.provided) {
            const data = sortBy(resolvedAdm[countryAdm].features.map(f => f.properties), 'name');
            zonesData[countryAdm] = {
                data: data,
                provided: false,
                numericCols: getNumericCols(data)
            };
        }
    }
    const fov = p('fieldOfView');
    const width = p('width'), height = p('height'), altitude = p('altitude');
    const snyderP = 1.0 + altitude / earthRadius;
    const dY = altitude * Math.sin(inlineProps.tilt / degrees);
    const dZ = altitude * Math.cos(inlineProps.tilt / degrees);
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const visibleYextent = 2 * dZ * fovExtent;
    const altRange = [(1/fovExtent) * 500, (1/fovExtent) * 4000];
    altScale = d3.scaleLinear().domain([1, 0]).range(altRange);
    if (altitude < altScale[0]) { params["General"].altitude = altScale[0]; redraw('altitude');}
    if (altitude > altScale[1]) { params["General"].altitude = altScale[1]; redraw('altitude');}
    const yShift = dY * 600 / visibleYextent;
    const scale = earthRadius * 600 / visibleYextent;
    const tilt = inlineProps.tilt / degrees;
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
    const offCanvasWithBorder = offCanvasPx - (p('borderWidth')/2);
    projection = geoSatellite()
        .scale(scale)
        .translate([((width / 2)), (yShift + height / 2)])
        .rotate([-inlineProps.longitude, -inlineProps.latitude, inlineProps.rotation])
        .tilt(inlineProps.tilt)
        .distance(snyderP)
        .preclip(preclip)
        .postclip(d3.geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder))
        .precision(0.1);
   
    const outline = {type: "Sphere"};
    const graticule = d3.geoGraticule().step([p('graticuleStep'), p('graticuleStep')])();
    if (!p('showGraticule')) graticule.coordinates = [];
    if (simplified) {
        let canvas = container.select('#canvas');
        if (canvas.empty()) canvas = container.append('canvas').attr('id', 'canvas').attr('width', width).attr('height', height);
        const context = canvas.node().getContext('2d');
        context.clearRect(0, 0, width, height);
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
        .attr('id', 'static-svg-map');

    if (p('useViewBox')) {
        svg.attr('viewBox', `0 0 ${width} ${height}`);
    }
    else {
        svg.attr('width', `${width }`)
        .attr('height', `${height}`)
    }
    
    container.style('width', `${width}px`).style('height', `${height}px`);
    
    path = d3.geoPath(projection);
    svg.html('');
    svg.on('contextmenu', function(e) {
        if (editingPath) return;
        e.preventDefault();
        closeMenu();
        let target = null;
        const [x, y] = d3.pointer(e);
        const point = {x, y};
        const paths = Array.from(document.getElementById('paths').children);
        const closestPoint = paths.reduce((prev, curElem) => {
            const curDist = closestDistance(point, curElem);
            curDist.elem = curElem;
            return prev.distance < curDist.distance ? prev : curDist
        }, {});
        if (closestPoint.distance && closestPoint.distance < 6) {
            menuStates.pathSelected = true;
            target = closestPoint.elem;
            selectedPathIndex = closestPoint.elem.getAttribute('id').match(/\d+$/)[0];
        }
        showMenu(e, target);
        return false;
    }, false);
    svg.on("click", function(e) {
        closeMenu();
    });
    
    const groupData = [];
    groupData.push({ name: 'outline', data: [outline], id: null, props: [], class: 'outline', filter: null });
    groupData.push({ name: 'graticule', data: [graticule], id: null, props: [], class: 'graticule', filter: null });
    computedOrderedTabs.forEach((layer, i) => {
        const filter = zonesFilter[layer] ? zonesFilter[layer] : null;
        if (layer === 'countries' && inlineProps.showCountries && countries) {
            if (!('countries' in zonesData) && !zonesData?.['countries']?.provided) {
                const data = sortBy(countries.features.map(f => f.properties), 'name');
                zonesData['countries'] = {
                    data: data,
                    numericCols: getNumericCols(data),
                };
                getZonesDataFormatters();
            }
            groupData.push({ name: 'countries', data: countries, id: 'name', props: [], class: 'country', filter: filter });
        }
        if (layer === 'land' && inlineProps.showLand) groupData.push({name: 'landImg', showSource: i === 0});
        // selected country
        else if (layer !== 'countries') {
            groupData.push({ name: layer, data: resolvedAdm[layer], id: 'name', props: [], class: 'adm', filter: filter });
        }
    });
    groupData.push({ name: 'paths', data: [], id: null, props: [], class: null, filter: null });
    groupData.push({ name: 'points-labels', data: [], id: null, props: [], class: null, filter: null });
    // const groups = svg.selectAll('svg').data(groupData).join('svg').attr('id', d => d.name);
    const groups = svg.append('svg')
        // .attr('clip-path', 'url(#clipMapBorder)')
        .selectAll('g').data(groupData).join('g').attr('id', d => d.name);
    function drawPaths(data) {
        if (data.name === 'landImg') return appendLandImage.call(this, data.showSource);
        if (!data.data) return;
        const parentPathElem = d3.select(this).style('will-change', 'opacity'); 
        const pathElem = parentPathElem.selectAll('path')
            .data(data.data.features ? data.data.features : data.data)
            .join('path')
                .attr('d', (d) => {return path(d)});
        if (data.id) pathElem.attr('id', (d) => d.properties[data.id]);
        if (data.class) pathElem.attr('class', data.class);
        if (data.filter) parentPathElem.attr('filter', `url(#${data.filter})`);
        data.props.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]))
    }

    groups.each(drawPaths);

    drawCustomPaths(providedPaths, svg, projection);
    const existingFilters = [...new Set(Object.entries(zonesFilter).filter(([key, fi]) => fi && key !== 'land').map(([key, value]) => value))];
    existingFilters.forEach(filterName => {
        appendGlow(svg, filterName, true, p(filterName));
    });
    appendBgPattern(svg, 'noise', p('seaColor'), p('backgroundNoise'));
    d3.select('#outline').style('fill', "url(#noise)");
    colorizeAndLegend();
    computeCss();
    svg.append('rect')
        .attr('id', 'frame')
        .attr('width', width)
        .attr('height', height)
        .attr('rx', p('borderRadius'));
    drawAndSetupShapes();
    const map = document.getElementById('static-svg-map');
    if(!map) return;
    addTooltipListener(map, tooltipDefs, zonesData);
    firstDraw = false;
}

let totalCommonCss;
function computeCss() {
    const finalColorsCss = Object.values(colorsCss).reduce((acc, cur) => {acc += cur; return acc;}, '');
    const borderCss = `
    #static-svg-map, #static-svg-map > svg {
        border-radius: ${p('borderRadius')}px;
    }
    #frame {
        fill: none;
        stroke: ${p('borderColor')};
        stroke-width:${p('borderWidth')}px;
    }`;
    commonCss = finalColorsCss + borderCss;
    totalCommonCss = exportStyleSheet('#paths > path') + commonCss;
}

function appendLandImage(showSource) {
    const landElem = d3.create('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg");
    if (showSource) {
        landElem.attr('fill', 'white');
    }
    const pathElem = landElem.selectAll('path')
        .data(land.features ? land.features : land)
        .join('path')
            .attr('d', (d) => {return path(d)});
    if(zonesFilter['land']) {
        const filterName = zonesFilter['land'];
        pathElem.attr('filter', `url(#${filterName})`);
        appendGlow(landElem, filterName, showSource, p(filterName));
    }
    const landImage = d3.create('image').attr('width', '100%').attr('height', '100%')
        .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(landElem.node().outerHTML, svgoConfig).data.replaceAll(/#/g, '%23')}`);
        
    d3.select(this).html(landImage.node().outerHTML)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
        // .attr('clip-path', 'url(#clipMapBorder)');
}

function save() {
    baseCss = exportStyleSheet('#paths > path');
    saveState({params, inlineProps, baseCss, providedFonts, 
        providedShapes, providedPaths, chosenCountriesAdm, orderedTabs,
        inlineStyles, shapeCount, zonesData, zonesFilter, lastUsedLabelProps,
        tooltipDefs, colorDataDefs, legendDefs,
    });
}

function resetState() {
    params = JSON.parse(JSON.stringify(defaultParams));
    baseCss = defaultBaseCss;
    commonStyleSheetElem.innerHTML = baseCss;
    providedPaths = [];
    providedShapes = [];
    chosenCountriesAdm = [];
    orderedTabs = ['countries', 'land'];
    currentTab = 'countries';
    inlineProps = {
        longitude: 15,
        latitude: 42.5,
        altitude: null,
        rotation: 0,
        tilt: 8.7,
        showLand: true,
        showCountries: true
    };
    providedFonts = [];
    shapeCount = 0;
    inlineStyles = {};
    zonesData = {};
    zonesFilter = {land: 'firstGlow'};
    lastUsedLabelProps = {'font-size': '14px'};
    tooltipDefs = {
        countries: {
            template: defaultTooltipContent(true),
            content: defaultTooltipFull(defaultTooltipContent(true)),
            locale: 'en-US'
        }
    };
    colorDataDefs = {
        countries: {...defaultColorDef}
    };
    legendDefs = {countries: JSON.parse(JSON.stringify(defaultLegendDef))};
    draw();
}

function restoreState(givenState) {
    let state;
    if (givenState) {
        state = givenState;
    }
    else state = getState();
    if (!state) return;
    ({  params, inlineProps, baseCss, providedFonts, 
        providedShapes, providedPaths, chosenCountriesAdm, orderedTabs,
        inlineStyles, shapeCount, zonesData, zonesFilter, lastUsedLabelProps,
        tooltipDefs, colorDataDefs, legendDefs,
    } = state);
    if (!baseCss) baseCss = defaultBaseCss;
    commonStyleSheetElem.innerHTML = baseCss;
    const tabsWoLand = orderedTabs.filter(x => x !== 'land');
    if (tabsWoLand.length) onTabChanged(tabsWoLand[0]);
    getZonesDataFormatters();
}

function saveProject() {
    baseCss = exportStyleSheet('#paths > path'); 
    const state = {params, inlineProps, baseCss, providedFonts, 
        providedShapes, providedPaths, chosenCountriesAdm, orderedTabs,
        inlineStyles, shapeCount, zonesData, zonesFilter, lastUsedLabelProps,
        tooltipDefs, colorDataDefs, legendDefs,
    };
    download(JSON.stringify(state), 'text/json', 'project.mapbuilder');
}

function loadProject(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            const providedState = JSON.parse(reader.result);
            restoreState(providedState);
            save();
            draw();
        } catch(e) {
            console.error('Unable to parse provided file. Should be valid JSON.');
        }
    });
    reader.readAsText(file);    
}

function applyStyles() {
    // apply inline styles
    Object.entries(inlineStyles).forEach((([elemId, style]) => {
        const elem = document.getElementById(elemId);
        if (!elem) return;
        Object.entries(style).forEach(([cssProp, cssValue]) => {
            if (cssProp === 'scale') {
                setTransformScale(elem, `scale(${cssValue})`);
            }
            else if (cssProp === 'bringtofront') {
                elem.parentNode.append(elem);
            }
            else elem.style[cssProp] = cssValue;
        });
    }));
    save();
}

function openEditor(e) {
    styleEditor.open(e.target, e.pageX, e.pageY);
}

let selectedPathIndex;
function editPath() {
    closeMenu();
    const pathElem = openContextMenuInfo.target;
    detachListeners();
    editingPath = true;
    
    new PathEditor(pathElem, svg.node(), (editedPathElem) => {
        // element was deleted
        if (!editedPathElem) {
            providedPaths.splice(selectedPathIndex, 1);
        } else {
            const parsed = parseAndUnprojectPath(editedPathElem, projection);
            providedPaths[selectedPathIndex].d = parsed;
        }
        attachListeners();
        editingPath = false;
        save();
    });
}

function deletePath() {
    closeMenu();
    providedPaths.splice(selectedPathIndex, 1);
    drawCustomPaths(providedPaths, svg, projection);
}

function addImageToPath(e) {
    menuStates.pathSelected = false;
    menuStates.addingImageToPath = true;
}

function importImagePath(e) {
    const file = e.target.files[0];
    const fileName = file.name;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        const newImage = {name: fileName, content: reader.result};
        providedPaths[selectedPathIndex].image = newImage;
        if (!providedPaths[selectedPathIndex].duration) {
            providedPaths[selectedPathIndex].duration = 10;
            providedPaths[selectedPathIndex].width = 20;
            providedPaths[selectedPathIndex].height = 10;
        }
        drawCustomPaths(providedPaths, svg, projection);
        save();
    });
    reader.readAsDataURL(file);
}

const saveDebounced = debounce(save, 200);
function changeDurationAnimation(e) {
    providedPaths[selectedPathIndex].duration = e.target.value;
    drawCustomPaths(providedPaths, svg, projection);
    saveDebounced();
}

function changePathImageWidth(e) {
    providedPaths[selectedPathIndex].width = e.target.value;
    drawCustomPaths(providedPaths, svg, projection);
    saveDebounced();
}

function changePathImageHeight(e) {
    providedPaths[selectedPathIndex].height = e.target.value;
    drawCustomPaths(providedPaths, svg, projection);
    saveDebounced();
}

function getFirstDataRow(zonesDataDef) {
    if (!zonesData) return null;
    const row = {...zonesDataDef.data[0]};
    zonesDataDef.numericCols.forEach(col => {
        row[col] = zonesDataDef.formatters[col](row[col]);
    });
    return row;
}

let currentTemplateHasNumeric = false;
function templateHasNumeric(layerName) {
    const toFind = zonesData[layerName].numericCols.map(col => (`{${col}}`));
    const template = tooltipDefs[layerName].template;
    if (toFind.some(str => template.includes(str))) {
        return true;
    }
    return false;
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
        
//         inlineProps.longitude = (boundingBox[2] + boundingBox[0]) / 2;
//         inlineProps.latitude = (boundingBox[3] + boundingBox[1]) / 2;
//         inlineProps.tilt = 0;
//         pane.refresh();
//         draw();
//     });
//     reader.readAsText(file);
// }


$: cssFonts = fontsToCss(providedFonts);

function handleInputFont(e) {
    const file = e.target.files[0];
    const fileName = file.name.split('.')[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        const newFont = {name: fileName, content: reader.result}
        providedFonts.push(newFont);
        providedFonts = providedFonts;
        save();
    });
    reader.readAsDataURL(file);
}

function addPath() {
    closeMenu();
    detachListeners();
    freeHandDrawPath(svg, projection, (finishedElem) => {
        attachListeners();
        const pathIndex = providedPaths.length;
        const id = `path-${pathIndex}`;
        finishedElem.setAttribute('id', id);
        providedPaths.push({d: parseAndUnprojectPath(finishedElem.getAttribute('d'), projection)});
        saveDebounced();
    });
}

function redraw(propName) {
    if (positionVars.includes(propName)) {
        draw(true);
    }
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
        draw(false);
    }, 300);
}

function handleChangeProp(event) {
    if (firstDraw) return;
    const {prop, value} = event.detail;
    redraw(prop);
}

function closeMenu() {
    contextualMenu.style.display = 'none';
    menuStates.chosingPoint = false;
    menuStates.pointSelected = false;
    menuStates.addingLabel = false;
    menuStates.pathSelected = false;
    menuStates.addingImageToPath = false;
    editedLabelId = null;
}

function editStyles() {
    closeMenu();
    styleEditor.open(openContextMenuInfo.target, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
}
function addPoint() {
    menuStates.chosingPoint = true;
}

async function addLabel(e) {
    menuStates.addingLabel = true;
    await tick();
    textInput.focus();
    textInput.addEventListener('keydown', ({key}) => {
        if (key === "Enter") {
            validateLabel();
        }
    });
}

function validateLabel() {
    if (typedText.length) {
        if (editedLabelId) {
            const labelDef = providedShapes.find(def => def.id === editedLabelId);
            labelDef.text = typedText;
        }
        else {
            const labelId = `label-${shapeCount++}`;
            providedShapes.push({pos: openContextMenuInfo.position, scale: 1, id: labelId, text: typedText});
            inlineStyles[labelId] = {...lastUsedLabelProps};
        }
        typedText = '';
    }
    drawAndSetupShapes();
    closeMenu();
}

function drawAndSetupShapes() {
    const container = document.getElementById('points-labels');
    if (!container) return;
    drawShapes(providedShapes, container, projection, save);
    d3.select(container).on('dblclick', e => {
        const target = e.target;
        const targetId = target.getAttribute('id');
        if (targetId.includes('label')) {
            editedLabelId = targetId;
            typedText = target.childNodes[0].nodeValue.trim();
            addLabel();
            showMenu(e);
        }
        e.preventDefault();
        e.stopPropagation();
    });
    d3.select(container).on('contextmenu', function(e) {
        e.stopPropagation();
        e.preventDefault();
        menuStates.pointSelected = true;
        showMenu(e);
        return false;
    }, false);
    applyStyles();
}

function showMenu(e, target = null) {
    openContextMenuInfo = {event: e, position: projection.invert(d3.pointer(e))};
    openContextMenuInfo.target = target ? target : e.target;
    contextualMenu.style.display = 'block';
    contextualMenu.style.left = e.pageX + "px";
    contextualMenu.style.top = e.pageY + "px";
}

function addShape(shapeName) {
    const shapeId = `${shapeName}-${shapeCount++}`;
    providedShapes.push({name: shapeName, pos: openContextMenuInfo.position, scale: 1, id:shapeId});
    drawAndSetupShapes();
    closeMenu();
    setTimeout(() => {
        const lastShape = document.getElementById(providedShapes[providedShapes.length -1].id);
        styleEditor.open(lastShape, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
    }, 0);
}

function copySelection() {
    const objectId = openContextMenuInfo.target.getAttribute('id');
    const newDef = {...providedShapes.find(def => def.id === objectId)};
    const projected = projection(newDef.pos);
    newDef.pos = projection.invert([projected[0] - 10, projected[1]]);
    const newShapeId = `${newDef.name ? newDef.name : 'label'}-${shapeCount++}`;
    inlineStyles[newShapeId] = {...inlineStyles[newDef.id]};
    newDef.id = newShapeId;
    providedShapes.push(newDef);
    drawAndSetupShapes();
    closeMenu();
}

function deleteSelection() {
    const pointId = openContextMenuInfo.target.getAttribute('id');
    delete inlineStyles[pointId];
    providedShapes = providedShapes.filter(def => def.id !== pointId);
    drawAndSetupShapes();
    closeMenu();
}

const onModalClose = () => {
    showModal = false;
}

function exportJson(data) {
    download(JSON.stringify(data, null, '\t'), 'text/json', 'data.json');
}

function getZonesDataFormatters() {
    Object.entries(zonesData).forEach(([name, def]) => {
        const locale = tooltipDefs[name].locale;
        const formatters = {};
        if (def.numericCols.length) {
            def.numericCols.forEach(col => {
                formatters[col] = getBestFormatter(def.data.map(row => row[col]), resolvedLocales[locale]);
            });
        }
        zonesData[name].formatters = formatters;
    });
}

function handleDataImport(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            let parsed = JSON.parse(reader.result);
            const currentNames = new Set(zonesData[currentTab].data.map(line => line.name));
            if (!Array.isArray(parsed)) {
                return window.alert("JSON sould be a list of objects, each object reprensenting a line.");
            }
            if (parsed.some(line => line.name === undefined )) {
                return window.alert("All lines should have a 'name' property.");
            }
            const newNames = new Set(parsed.map(line => line.name));
            const difference = new Set([...currentNames].filter((x) => !newNames.has(x)));
            if (difference.size) {
                return window.alert(`Missing names ${[...difference]}`);
            }
            parsed = sortBy(parsed, 'name');
            zonesData[currentTab] = {data: parsed, provided:true, numericCols: getNumericCols(parsed) };
            getZonesDataFormatters();
            autoSelectColors();
            save();
        } catch (e) {
            console.log('Parse error:', e);
        }
    });
    reader.readAsText(file);
}

function defaultTooltipContent(isCountry) {
    return `<div>
    <span> ${isCountry ? 'Country' : 'Region'}: {name}</span>
</div>
    `;
}

function defaultTooltipFull(template) {
    return `<div id="tooltip-preview" style="${defaultTooltipStyle}">
        ${template}
    </div>`;
}

function editTooltip(e) {
    const rect = e.target.getBoundingClientRect();
    styleEditor.open(e.target, rect.right, rect.bottom);
}

let templateErrorMessages = {};
function onTemplateChange() {
    const domParser = new DOMParser();
    const parsed = domParser.parseFromString(tooltipDefs[currentTab].template, 'application/xml');
    const errorNode = parsed.querySelector('parsererror');
    if(errorNode) {
        templateErrorMessages[currentTab] = true;
    }
    else {
        tooltipDefs[currentTab].content = htmlTooltipElem.outerHTML;
        currentTemplateHasNumeric = templateHasNumeric(currentTab);
        templateErrorMessages[currentTab] = null;
    }
    save(); 
}

function changeTooltipLocale() {
    getZonesDataFormatters();
}

async function onTabChanged(newTabTitle) {
    currentTab = newTabTitle;
    await tick();
    initTooltips();
    if (!tooltipDefs[newTabTitle]) return;
    if (tooltipDefs[newTabTitle].enabled) {
        const tmpElem = htmlToElement(tooltipDefs[newTabTitle].content);
        reportStyle(tmpElem, htmlTooltipElem);
    }
    if (colorDataDefs[newTabTitle].legendEnabled) {
        const tmpElem = htmlToElement(legendDefs[newTabTitle].sampleHtml);
        reportStyle(tmpElem, legendSample);
    }
    currentTemplateHasNumeric = templateHasNumeric(currentTab);
}

async function addNewCountry(e) {
    const newLayerName = e.target.value;
    if (chosenCountriesAdm.includes(newLayerName)) return;
    let searchedAdm;
    if (newLayerName.slice(-1) === '1') searchedAdm = newLayerName.replace('ADM1', 'ADM2');
    else searchedAdm = newLayerName.replace('ADM2', 'ADM1');
    const existingIndex = chosenCountriesAdm.indexOf(searchedAdm);
    if (existingIndex > -1) {
        deleteCountry(searchedAdm, false);
    }
    chosenCountriesAdm.push(newLayerName);
    orderedTabs.push(newLayerName);
    chosenCountriesAdm = chosenCountriesAdm;
    orderedTabs = orderedTabs;
    e.target.selectedIndex = null;
    await draw();
    onTabChanged(newLayerName);
    // setTimeout(() => {onTabChanged(e.target.value);}, 2000);
}

function deleteCountry(country, drawAfter = true) {
    chosenCountriesAdm = chosenCountriesAdm.filter(x => x !== country);
    orderedTabs = orderedTabs.filter(x => x !== country);
    currentTab = orderedTabs[0];
    delete tooltipDefs[country];
    delete legendDefs[country];
    delete colorDataDefs[country];
    if(drawAfter) draw();
}

// === Drag and drop behaviour ===

let hoveringTab = false;
let dragStartIndex = 0;

function drop(event, target) {
    event.dataTransfer.dropEffect = 'move'; 
    const newList = orderedTabs;

    if (dragStartIndex < target) {
        newList.splice(target + 1, 0, newList[dragStartIndex]);
        newList.splice(dragStartIndex, 1);
    } else {
        newList.splice(target, 0, newList[dragStartIndex]);
        newList.splice(dragStartIndex + 1, 1);
    }
    orderedTabs = newList;
    hoveringTab = null;
    draw();
}

function dragstart(event, i, prevent = false) {
    if (prevent) {
        return event.preventDefault();
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    dragStartIndex = i;
}

function validateExport() {
    const formData = Object.fromEntries(new FormData(exportForm).entries());
    exportSvg(svg, p('width'), p('height'), tooltipDefs, chosenCountriesAdm, zonesData, providedFonts, true, totalCommonCss, formData);
    showExportConfirm = false;
}
// === Export as PNG behaviour ===

async function exportRaster() {
    const optimized = await exportSvg(svg, p('width'), p('height'), tooltipDefs, chosenCountriesAdm, zonesData, providedFonts, false, totalCommonCss, {});
    svgToPng('data:image/svg+xml;base64,' + window.btoa(optimized), p('width'), p('height'));
}

// === Colorize by data behaviour ===

const numericPalettes =  [
    "Blues", "Greens", "Greys", "Oranges", "Purples", "BuGn", "BuPu",
    "GnBu", "OrRd", "PuBuGn", "PuBu", "PuRd", "RdPu", "YlGnBu", "YlGn",
    "YlOrBr", "YlOrRd", "BrBG", "PRGn", "PiYG", "PuOr", "RdBu", "RdGy",
    "RdYlBu", "RdYlGn", "Spectral"
];

const categoricalPalettes = [
    "Category10", "Accent", "Dark2", "Paired", "Pastel1",
    "Pastel2", "Set1", "Set2", "Set3", "Tableau10"
];

// --- Computed ---
let availableColumns = [], availablePalettes = [];

$: availableColorTypes = zonesData?.[currentTab]?.numericCols?.length ? ['category', 'quantile', 'quantize'] : ['category'];
$: curDataDefs = colorDataDefs?.[currentTab];
function autoSelectColors() {
    if (!zonesData[currentTab]) return;
    if (curDataDefs.colorScale === null) {
        if (curDataDefs.colorColumn !== null) {
            if (zonesData[currentTab].numericCols.includes(curDataDefs.colorColumn)) {
                curDataDefs.colorScale = 'quantile';
            }
            else curDataDefs.colorScale = 'category';
        }
        else curDataDefs.colorScale = 'category';
    }
    availableColumns = curDataDefs.colorScale === "category" ? Object.keys(zonesData[currentTab].data[0]) : zonesData?.[currentTab]?.numericCols;
    availablePalettes = curDataDefs.colorScale === "category" ? categoricalPalettes : numericPalettes;
    if (!availableColumns.includes(curDataDefs.colorColumn)) {
        curDataDefs.colorColumn = availableColumns[0];
    }
    if (!availablePalettes.includes(curDataDefs.colorPalette)) curDataDefs.colorPalette = availablePalettes[0];
    if(svg) colorizeAndLegend();
}

$: if (colorDataDefs[currentTab]) {
    autoSelectColors(colorDataDefs[currentTab].colorScale, colorDataDefs[currentTab].colorColumn, colorDataDefs[currentTab].colorPalette, colorDataDefs[currentTab].nbBreaks);
}

const colorsCss = {};
let legendSample;
let displayedLegend = {};
let sampleLegend = {
    color: 'black', text: 'test'
}
async function colorizeAndLegend(e) {
    initTooltips();
    legendDefs = legendDefs;
    const legendEntries = d3.select('#svg-map-legend');
    if (!legendEntries.empty()) legendEntries.remove();
    const legendSelection = svg.append('g').attr('id', 'svg-map-legend');
    Object.entries(colorDataDefs).forEach(([tab, dataColorDef]) => {
        if (!dataColorDef.enabled) {
            dataColorDef.legendEnabled = false;
            colorsCss[tab] = '';
            computeCss();
            if (displayedLegend[tab]) displayedLegend[tab].remove();
            return;
        }
        const paletteName = `scheme${dataColorDef.colorPalette}`;
        const data = zonesData[tab].data.map(row => row[dataColorDef.colorColumn]);
        let scale;
        if (dataColorDef.colorScale === "category" ) {
            scale = d3.scaleOrdinal(d3[paletteName]);
        } else if(dataColorDef.colorScale === "quantile") {
            scale = d3.scaleQuantile().domain(data).range(d3[paletteName][dataColorDef.nbBreaks]);
        } else if(dataColorDef.colorScale === "quantize") {
            scale = d3.scaleQuantile().domain(d3.extent(data)).range(d3[paletteName][dataColorDef.nbBreaks]);
        }
        let newCss = '';
        zonesData[tab].data.forEach(row => {
            const color = scale(row[dataColorDef.colorColumn]);
            const key = row.name;
            newCss += `path[id="${key}"]{fill:${color};}
            path[id="${key}"]:hover{fill:${d3.color(color).brighter(.2).hex()};}`;
        });
        colorsCss[tab] = newCss;
        const legendColors = getLegendColors(dataColorDef, tab, scale);
        if (!legendColors) return;
        if (tab === currentTab) sampleLegend = {color: legendColors[0][0], text: legendColors[0][1]};
        const sampleElem = htmlToElement(legendDefs[tab].sampleHtml);
        displayedLegend[tab] = drawLegend(legendSelection, legendDefs[tab], legendColors, dataColorDef.colorScale === 'category', sampleElem, tab);
    });
    computeCss();
    applyStyles();
}

// ==== Legend === 

function getLegendColors(dataColorDef, tab, scale) {
    if (!dataColorDef.legendEnabled) {
        if (displayedLegend[tab]) displayedLegend[tab].remove();
        return;
    }
    if (legendSample && legendDefs[tab].sampleHtml === null) legendDefs[tab].sampleHtml = legendSample.outerHTML;
    if (legendDefs[tab].title === null) legendDefs[tab].title = dataColorDef.colorColumn;
    let threshValues;
    const data = zonesData[tab].data.map(row => row[dataColorDef.colorColumn]);
    let formatter = (x) => x;
    if (dataColorDef.colorScale === "category" ) {
        threshValues = [...new Set(data)];
    }
    else {
        formatter = d3.format(`,.${legendDefs[tab].significantDigits}r`);
        const minValue = Math.min(...data);
        if (scale.quantiles) threshValues = scale.quantiles();
        else if (scale.thresholds) threshValues = scale.thresholds();
        threshValues.unshift(minValue);
    }
    const legendColors = threshValues.reduce((acc, cur) => {
        acc.push([scale(cur), formatter(cur)]);
        return acc;
    }, []);
    if (legendDefs[tab].direction === 'v') return legendColors.reverse();
    return legendColors;
}

</script>

<svelte:head>
    <!-- {@html `<${''}style id="test"> ${baseCss} </${''}style>`} -->
	{@html `<${''}style> ${commonCss} </${''}style>`}
	{@html `<${''}style> ${cssFonts} </${''}style>`}
</svelte:head>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu}>
    {#if menuStates.chosingPoint}
        {#each Object.keys(shapes) as shapeName (shapeName)}
            <div role="button" class="px-2 py-1" on:click={() => addShape(shapeName)}> { shapeName } </div>
        {/each}
    {:else if menuStates.addingLabel}
        <input type="text" bind:this={textInput} bind:value={typedText}/>
    {:else if menuStates.pointSelected}
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit styles </div>
        <div role="button" class="px-2 py-1" on:click={copySelection}> Copy </div>
        <div role="button" class="px-2 py-1" on:click={deleteSelection}> Delete </div>
    {:else if menuStates.pathSelected}
        <div role="button" class="px-2 py-1" on:click={editPath}> Edit path </div>
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit style </div>
        <div role="button" class="px-2 py-1" on:click={deletePath}> Delete path </div>
        <div role="button" class="px-2 py-1" on:click={addImageToPath}> Image along path </div>
    {:else if menuStates.addingImageToPath}
        <div class="m-1">
            <label for="image-select" class="m-2 d-flex align-items-center btn btn-sm btn-light"> File: {providedPaths[selectedPathIndex].image?.name || 'Import image'} </label>
            <input type="file" id="image-select" accept=".png,.jpg,.svg" on:change={importImagePath}>
        </div>
        <div class="row m-1">
            <label for="duration-select" class="col-6 col-form-label col-form-label-sm"> Duration </label>
            <div class="col-6">
                <input id="duration-select" class="form-control form-control-sm" type="number" value={providedPaths[selectedPathIndex].duration} on:change={changeDurationAnimation}/>
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-width" class="col-6 col-form-label col-form-label-sm"> Image width </label>
            <div class="col-6">
                <input id="path-img-width" class="form-control form-control-sm" type="number" value={providedPaths[selectedPathIndex].width} on:change={changePathImageWidth}/>
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-height" class="col-6 col-form-label col-form-label-sm"> Image height </label>
            <div class="col-6">
                <input id="path-img-height" class="form-control form-control-sm" type="number" value={providedPaths[selectedPathIndex].height} on:change={changePathImageHeight}/>
            </div>
        </div>
    {:else}
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit styles </div>
        <div role="button" class="px-2 py-1" on:click={addPath}> Draw path </div>
        <div role="button" class="px-2 py-1" on:click={addPoint}> Add point </div>
        <div role="button" class="px-2 py-1" on:click={addLabel}> Add label </div>
    {/if}
</div>

<Navbar></Navbar>
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-start p-3">
        <aside class="panel rounded p-0 border mx-2">
            <NestedAccordions sections={params} paramDefs={paramDefs} helpParams={helpParams} on:change={handleChangeProp} ></NestedAccordions>
        </aside>
        <div class="w-auto d-flex flex-column justify-content-center">
            <div id="map-container" class="col"></div>
            <div class="mt-4 d-flex align-items-center justify-content-center">
                <div class="mx-2">
                    <label for="fontinput" class="m-2 d-flex align-items-center btn btn-outline-primary"> <Icon svg={icons['font']}/> Add font</label>
                    <input type="file" id="fontinput" accept=".ttf,.woff,.woff2" on:change={handleInputFont}>
                </div>
                <div class="dropdown mx-2">
                    <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <Icon fillColor="white" svg={icons['map']}/> Project
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" on:click={saveProject}>
                            <Icon fillColor="none" svg={icons['save']}/>
                            Save project
                        </a></li>
                        <li><a class="dropdown-item" href="#" on:click={resetState}>
                            <Icon svg={icons['reset']}/>Reset
                        </a></li>
                        <li><a class="dropdown-item" href="#">
                            <label class="" role="button" for="project-import"> <Icon svg={icons['restore']}/> Load project</label>
                            <input id="project-import" type="file" accept=".mapbuilder" on:change={loadProject}>
                        </a></li>
                    </ul>
                </div>
                <div class="dropdown mx-2">
                    <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <Icon fillColor="none" svg={icons['download']}/> Export
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" on:click={() => showExportConfirm = true}> Export SVG </a></li>
                        <li><a class="dropdown-item" href="#" on:click={exportRaster}> Export raster </a></li>
                    </ul>
                </div>
            </div>
        </div>

        
        <aside class="panel p-0 border rounded ms-4">
            <div class="p-2">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="showLand" bind:checked={inlineProps.showLand} on:change={() => draw()}>
                    <label class="form-check-label" for="showLand"> Show land</label>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" id="showCountries" bind:checked={inlineProps.showCountries} on:change={() => draw()}>
                    <label class="form-check-label" for="showCountries"> Show countries</label>
                </div>
            </div>
            
            <ul class="nav nav-tabs">
                {#each computedOrderedTabs as tabTitle, index (tabTitle) }
                {@const isLand = tabTitle === "land"}
                <li class="nav-item d-flex align-items-center"
                    draggable={isLand}
                    on:dragstart={event => dragstart(event, index, tabTitle !== "land")}
                    on:drop|preventDefault={event => drop(event, index)}
                    ondragover="return false"
                    on:dragenter={() => hoveringTab = index}
                    class:is-dnd-hovering-right={hoveringTab === index && index > dragStartIndex}
                    class:is-dnd-hois-dnd-hoveringvering-left={hoveringTab === index && index < dragStartIndex}
                    class:grabbable={isLand}>
                    <a href="javascript:;"
                    class:active={currentTab === tabTitle}
                    class="nav-link d-flex align-items-center"
                    on:click={() => onTabChanged(tabTitle)}>
                        {#if isLand} <Icon svg={icons['draggable']}/> {/if}
                        {tabTitle}
                        {#if tabTitle !== 'countries' && !isLand}
                            <span role="button" class="delete-tab" on:click={() => deleteCountry(tabTitle)}> ✕ </span>
                        {/if}
                    </a>
                {/each}
                
                <li class="nav-item icon-add">
                    <select role="button" id='country-select' on:change={addNewCountry}>
                        {#each allAvailableAdm as country}
                            <option value={country}>{country}</option>
                        {/each}
                    </select>
                    <span class="nav-link d-flex "> <Icon fillColor="none" svg={icons['add']}/> </span>
                </li>
            </ul>
            <div class="p-2">
                {#if currentTab !== 'countries'}
                <div class="d-flex m-1 align-items-center">
                    <div class="form-floating flex-grow-1">
                        <select id="choseFilter" class="form-select form-select-sm" bind:value={zonesFilter[currentTab]} on:change={() => draw()}>
                            <option value={null}> None </option>
                            <option value="firstGlow"> First filter </option>
                            <option value="secondGlow"> Second filter </option>
                        </select>
                        <label for="choseFilter">Glow filter</label>
                    </div>
                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Two filters are available, that are customizable in the panel on the other side (first / second glow sections).">?</span>
                </div>
                {/if}
                {#if zonesData?.[currentTab]?.['data']}
                    <div class="d-flex align-items-center">
                        <div>
                            <label for="data-input-json" class="m-2 btn btn-light"> Import data for {currentTab} </label>
                            <input id="data-input-json" type="file" accept=".json" on:change={(e) => handleDataImport(e)}>
                        </div>
                        <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Import data for current layer. The 'name' property must be defined for each line. You can export the default data to have a template to start from.">?</span>
                        <div class="mx-2 ms-auto btn btn-outline-primary" on:click={() => exportJson(zonesData?.[currentTab]?.['data'])}> Export JSON </div>
                    </div>
                    <div class="data-table mb-2" on:click={() => (showModal = true)}>
                        <DataTable data={zonesData?.[currentTab]?.['data']}> </DataTable>
                    </div>
                    <div class="mx-2 form-check">
                        <input
                            type="checkbox" class="form-check-input" id='showTooltip' bind:checked={tooltipDefs[currentTab].enabled} 
                            on:click={() => setTimeout(() => {initTooltips()}, 0)}
                        />
                        <label for='showTooltip' class="form-check-label"> Show tooltip on hover </label>
                    </div>
                    {#if tooltipDefs[currentTab].enabled}
                        <div class="m-2 has-validation">
                            <label for="templatetooltip" class="form-label"> Tooltip template
                                <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="The template must be valid HTML (<br/> can be used to break lines). Brackets  &#123; &#125; can be used to reference variables.  ">?</span>
                            </label>
                            <textarea class="form-control" 
                            class:is-invalid="{templateErrorMessages[currentTab]}"
                            id="templatetooltip" rows="3" bind:value={tooltipDefs[currentTab].template} on:change={onTemplateChange}/>
                            {#if templateErrorMessages[currentTab]}
                                <div class="invalid-feedback"> 
                                    <span> Malformed HTML. Please fix the template: </span> <br/>
                                    <!-- {templateErrorMessages[currentTab]} -->
                                </div> {/if}
                        </div>
                        <div class="mx-2 d-flex align-items-center">
                            <label for="tooltip-preview-{currentTab}"> Example tooltip:
                                <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Click on the example to update style">?</span>
                            </label>
                            <div class="tooltip-preview">
                                <div id="tooltip-preview-{currentTab}" bind:this={htmlTooltipElem} on:click={editTooltip} style="${defaultTooltipStyle}">
                                    {@html tooltipDefs[currentTab].template.formatUnicorn(getFirstDataRow(zonesData?.[currentTab]))}
                                </div>
                                {#if currentTemplateHasNumeric }
                                    <div class="form-floating">
                                        <select class="form-select form-select-sm" id="choseFormatLocale" bind:value={tooltipDefs[currentTab].locale} on:change={changeTooltipLocale}>
                                            {#each availableFormatLocales as locale}
                                                <option value={locale}> {locale} </option>
                                            {/each}
                                        </select>
                                        <label for="choseFormatLocale">Formatting language</label>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                    <!-- COLORING -->
                    <div class="mx-2 form-check">
                        <input
                            type="checkbox" class="form-check-input" id='colorData'
                            bind:checked={curDataDefs.enabled}
                            on:change={colorizeAndLegend}
                        />
                        <label for='colorData' class="form-check-label"> Color using data </label>
                    </div>
                    {#if curDataDefs.enabled}
                        <div class="d-flex m-1 align-items-center">
                            <div class="form-floating flex-grow-1">
                                <select class="form-select form-select-sm" id="choseColorType" bind:value={curDataDefs.colorScale}>
                                    {#each availableColorTypes as colorType}
                                        <option value={colorType}> {colorType} </option>
                                    {/each}
                                </select>
                                <label for="choseColorType">Color type</label>
                            </div>
                            <span class="help-tooltip" data-bs-toggle="tooltip" allow-html="true" data-bs-title="{scalesHelp}">?</span>
                        </div>

                        <div class="d-flex justify-content-between ">
                            <div class="flex-grow-1 m-1 form-floating">
                                <select class="form-select form-select-sm" id="choseColorColumn" bind:value={curDataDefs.colorColumn}
                                    on:change={e => legendDefs[currentTab].title = e.target.value}>
                                    {#each availableColumns as colorColumn}
                                        <option value={colorColumn}> {colorColumn} </option>
                                    {/each}
                                </select>
                                <label for="choseColorColumn"> Value color</label>
                            </div> 
                            <div class="flex-grow-1 m-1 form-floating">
                                <select class="form-select form-select-sm" id="choseColorPalette" bind:value={curDataDefs.colorPalette}>
                                    {#each availablePalettes as palette}
                                        <option value={palette}> {palette} </option>
                                    {/each}
                                </select>
                                <label for="choseColorPalette"> Palette </label>
                            </div>
                        </div>
                        {#if curDataDefs.colorScale !== 'category'}
                            <div class="">
                                <RangeInput title="Number of breaks" bind:value={curDataDefs.nbBreaks} min="3" max="9"></RangeInput>
                            </div>
                        {/if}
                            <!-- LEGEND -->
                            <div class="mx-2 form-check">
                                <input
                                    type="checkbox" class="form-check-input" id='showLegend' 
                                    bind:checked={colorDataDefs[currentTab].legendEnabled}
                                    on:change={colorizeAndLegend}
                                />
                                <label for='showLegend' class="form-check-label"> 
                                    Show legend 
                                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Drag the title of the legend to move it, as well as the entries.">?</span>
                                </label>
                            </div>
                        {/if}
                    {#if curDataDefs.legendEnabled}
                        <Legend definition={legendDefs[currentTab]} on:change={colorizeAndLegend} categorical={colorDataDefs[currentTab].colorScale === 'category'}/>
                        <svg width="75%" height={legendDefs[currentTab].rectHeight + 20}>
                            <g bind:this={legendSample}>
                                <rect x="10" y="10" width={legendDefs[currentTab].rectWidth} 
                                    height={legendDefs[currentTab].rectHeight} 
                                    fill={sampleLegend.color} stroke="black"
                                    on:click={openEditor}></rect>
                                <text x={legendDefs[currentTab].rectWidth + 15}
                                    y={(legendDefs[currentTab].rectHeight / 2) + 10}
                                    text-anchor="start" dominant-baseline="middle"
                                    on:click={openEditor}> {sampleLegend.text} </text>
                            </g>
                        </svg>
                        <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Click to update style (the legend is SVG)">?</span>
                    {/if}
                {/if}    
            </div> 
        </aside>
    </div>
</div>
<Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable slot="content" data={zonesData?.[currentTab]?.['data']} > </DataTable>
</Modal>

<Modal open={showExportConfirm} onClosed={() => showExportConfirm = false} modalWidth="35%">
    <div slot="header">
        <h2 class="fs-3 p-2 m-0"> Export options </h2>
    </div>
    <form slot="content" bind:this={exportForm}>
        {#if providedFonts.length}
            <h3 class="fs-4"> Font export </h3>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="exportFonts" value={exportFontChoices.noExport} id="exportFonts1">
                <label class="form-check-label" for="exportFonts1">
                    Do not export fonts
                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="If the final document will contain imported fonts, no need to export it as part of the SVG">?</span>
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="exportFonts" value={exportFontChoices.convertToPath} id="exportFonts2">
                <label class="form-check-label" for="exportFonts2">
                    Convert texts with imported fonts to path
                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Convert text to <path> elements to remove dependency on the imported font(s)">?</span>
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="exportFonts" value={exportFontChoices.embedFont} id="exportFonts3">
                <label class="form-check-label" for="exportFonts3">
                    Embed font(s)
                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Always embed imported font(s) (only used fonts will be exported)">?</span>
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="exportFonts" id="exportFonts4" value={exportFontChoices.smallest} checked>
                <label class="form-check-label" for="exportFonts4">
                    Smallest of the 2
                    <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="Automatically determine the smallest file size between converting to <path> and embedding font">?</span>
                </label>
            </div>
        {/if}
        <h3 class="fs-4"> Resize </h3>
        <div class="form-check form-switch">
            <input class="form-check-input" name="hideOnResize" type="checkbox" role="switch" id="hideOnResize" checked>
            <label class="form-check-label" for="flexSwitchCheckDefault">
                Hide svg on resize 
                <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title="On some browsers, resizing the window triggers a re-render, which can cause a slowdown. If activated, the SVG will be hidden while the window is being resized, thus reducing the computing load.">?</span>
            </label>
        </div>
    </form>
    <div slot="footer" class="d-flex justify-content-end">
        <button type="button" class="btn btn-success"
            data-goatcounter-click="export-svg"
            on:click={validateExport}> 
            Export
        </button>
    </div>
</Modal>

<style lang="scss" scoped>
.panel {
    min-width: 20rem;
    max-width: 30rem;
}
#country-select:hover ~ span {
    color: #aeafaf;
}
.data-table {
    max-height: 10rem;
    overflow-y: scroll;
}
.tooltip-preview {
    padding: 10px;
}
#map-container {
    margin: 0 auto;
    flex: 0 0 auto;
}
#country-select{
  opacity: 0;
  position: absolute;
  height: 38px;
  width: 4rem;
}

input[type="file"] {
    display: none;
}

.is-dnd-hovering-right {
    border-right: 3px solid black;
}
.is-dnd-hovering-left {
    border-left: 3px solid black;
}
.delete-tab {
    &:hover {
        color: #67777a;
    }
}
.grabbable {
    cursor: grab !important;
}
</style>
