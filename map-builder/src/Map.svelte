<script>
import { onMount, tick } from 'svelte';
import { geoSatellite } from 'd3-geo-projection';
import * as topojson from 'topojson-client';
import * as d3 from "d3";
import SVGO from 'svgo/dist/svgo.browser';
import Mustache from 'mustache';
import InlineStyleEditor from '../node_modules/inline-style-editor/dist/inline-style-editor.mjs';

// https://greensock.com/docs/v3/Plugins/MotionPathHelper/static.editPath()
import MotionPathHelper from "./util/MotionPathHelper.js";
import svgoConfig from './svgoExport.config';
import cssTemplate from './templates/style.template.txt';
import { drawCustomPaths, parseAndUnprojectPath } from './svg/paths';
import { paramDefs, defaultParams } from './params';
import { appendBgPattern, appendGlow } from './svg/svgDefs';
import { splitMultiPolygons } from './util/geojson';
import { download, sortBy, indexBy, htmlToElement, getNumericCols } from './util/common';
import * as shapes from './svg/shapeDefs';
import { setTransformScale } from './svg/svg';
import { drawShapes } from './svg/shape';
import iso3Data from './assets/data/iso3_filtered.json';
import DataTable from './components/DataTable.svelte';
import Legend from './components/Legend.svelte';

import { drawLegend } from './svg/legend';
import Modal from './components/Modal.svelte';
import NestedAccordions from './components/NestedAccordions.svelte';
import Icon from './components/Icon.svelte';
import RangeInput from './components/RangeInput.svelte';
import { reportStyle, fontsToCss } from './util/dom';
import { saveState, getState } from './util/save';
import { svgToPng } from './svg/toPng';
import { exportSvg } from './svg/export';
import { addTooltipListener} from './tooltip';

const iconsReq = require.context('./assets/img/.?inline', false, /\.svg$/);
const icons = iconsReq.keys().reduce((acc, iconFile) => {
    const name = iconFile.match(/\w+/)[0]; // remove extension
    acc[name] = iconsReq(iconFile); 
    return acc;
}, {});

let params = JSON.parse(JSON.stringify(defaultParams));
const iso3DataById = indexBy(iso3Data, 'alpha-3');
const resolvedAdm1 = {};
const countriesAdm1 = require.context('./assets/layers/adm1/', false, /\..*json$/, 'lazy');
const availableCountriesAdm1 = countriesAdm1.keys().reduce((acc, file) => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    acc[iso3DataById[name.replace('_ADM', '')]?.name] = file;
    return acc;
}, {});

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
let commonCss = null;
let openContextMenuInfo;
const adm0Land = import('./assets/layers/world_adm0_simplified.topojson')
    .then(({default:topoAdm0}) => {
        countries = topojson.feature(topoAdm0, topoAdm0.objects.simp);
        
        countries.features.forEach(feat => {
            feat.properties = iso3DataById[feat.properties['shapeGroup']] || {};
        });
        land = topojson.merge(topoAdm0, topoAdm0.objects.simp.geometries);
        land = splitMultiPolygons({type: 'FeatureCollection', features: [{type:'Feature', geometry: {...land} }]}, 'land');
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
let providedPaths = [];
let providedShapes = []; // {name, coords, scale, id}
let chosenCountries = [];
let inlineProps = {
    longitude: 15,
    latitude: 36,
    altitude: 1000,
    rotation: 0,
    tilt: 25,
};

let providedFonts = [];
let cssFonts;
let shapeCount = 0;
let inlineStyles = {}; // elemID -> prop -> value
let zonesData = {}; // key => {data (list), provided (bool), numericCols (list)}
let lastUsedLabelProps = {};

let tooltipDefs = {
    countries: {
        template: defaultTooltipContent('name'),
        content: defaultTooltipFull(defaultTooltipContent('name')),
        enabled: false,
    }
};

let colorDataDefs = {
    countries: {...defaultColorDef}
};
let legendDefs = {countries: JSON.parse(JSON.stringify(defaultLegendDef))};
// ==== End state =====

const menuStates = {
    chosingPoint:      false,
    pointSelected:     false,
    addingLabel:       false,
};
let editedLabelId;
let textInput;
let typedText = "";
let styleEditor;
let contextualMenu;
let showModal = false;
let htmlTooltipElem;
let currentTab = 'countries';
let orderedTabs = ['countries', 'land'];

onMount(() => {
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
            if (el.classList.contains('adm1')) {
                const parentCountry = el.parentNode.getAttribute('id').replace('-adm1', '');
                const parentCountryIso3 = iso3Data.find(row => row.name === parentCountry)['alpha-3'];
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
    const container = d3.select('#map-container');
    container.call(d3.drag()
        .filter((e) => !e.button)   // Remove ctrlKey
        .on("drag", dragged)
        .on('start', () => {
            if (menuStates.addingLabel) validateLabel();
            styleEditor.close();
            closeMenu();
        })
    );
    const zoom = d3.zoom().on('zoom', zoomed).on('start', () => closeMenu());
    container.call(zoom);
});

let altScale = d3.scaleLinear().domain([1, 0]).range([100, 10000]);
function zoomed(event) {
    if (!event.sourceEvent) return;
    if (!projection) return;
    if (event.transform.k > 0.00001 && event.transform.k < 1.0) {
        const newAltitude = Math.round(altScale(event.transform.k));
        params["General"].altitude = newAltitude;
    }
    else if (event.transform.k < 0.00001) {
        event.transform.k = 0.00001;
    }
    else {
        event.transform.k  = 1.0;
    }
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

// without 'countries' if unchecked
let computedOrderedTabs = [];
async function draw(simplified = false, _) {
    computedOrderedTabs = orderedTabs.filter(x => {
        if (x === 'countries') return p('showCountries');
        if (x === 'land') return p('showLand');
        return true;
    });
    if (!computedOrderedTabs.length || (computedOrderedTabs.length === 1 && computedOrderedTabs[0] === 'land')) currentTab = null;
    else if (computedOrderedTabs.length > 0 && currentTab === null) {
        let i = 0;
        while (computedOrderedTabs[i] === 'land') ++i;
        currentTab = computedOrderedTabs[i];
    }
    for (const country of chosenCountries) {
        if (!(country in resolvedAdm1)) {
            const resolved = await countriesAdm1(availableCountriesAdm1[country]);
            resolvedAdm1[country] = topojson.feature(resolved, resolved.objects.country);
            draw(simplified);
            return;
        }
        if (!(country in tooltipDefs)) {
            const contentTemplate = defaultTooltipContent('shapeName');
            tooltipDefs[country] = {
                template: contentTemplate,
                content: defaultTooltipFull(contentTemplate),
                enabled: false,
            };
            colorDataDefs[country] = {...defaultColorDef};
            legendDefs[country] = JSON.parse(JSON.stringify(defaultLegendDef));
        }
        if (!(country in zonesData) && !zonesData?.[country]?.provided) {
            const data = sortBy(resolvedAdm1[country].features.map(f => f.properties), 'shapeName');
            zonesData[country] = {
                data: data,
                provided: false,
                numericCols: getNumericCols(data)
            };
        }
    }
    const fov = p('fieldOfView');
    // 
    const width = p('width'), height = p('height'), altitude = p('altitude');
    const snyderP = 1.0 + altitude / earthRadius;
    const dY = altitude * Math.sin(inlineProps.tilt / degrees);
    const dZ = altitude * Math.cos(inlineProps.tilt / degrees);
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const visibleYextent = 2 * dZ * fovExtent;
    const altRange = [(1/fovExtent) * 500, (1/fovExtent) * 9000];
    altScale = d3.scaleLinear().domain([1, 0]).range(altRange);
    if (altitude < altScale[0]) { altitude = altScale[0]; redraw('altitude');}
    if (altitude > altScale[1]) { altitude = altScale[1]; redraw('altitude');}
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
    // appendClip(svg, width, height, p('borderRadius'));
    svg.on('contextmenu', function(e) {
        e.preventDefault();
        showMenu(e);
        menuStates.chosingPoint = false;
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
    computedOrderedTabs.forEach((layer, i) => {
        if (layer === 'countries' && p('showCountries') && countries) {
            if (!('countries' in zonesData) && !zonesData?.['countries']?.provided) {
                const data = sortBy(countries.features.map(f => f.properties), 'alpha-3')
                zonesData['countries'] = {
                    data: data,
                    numericCols: getNumericCols(data),
                };
            }
            groupData.push({ name: 'countries', data: countries, id: 'alpha-3', props: [], class: 'country', filter: null });
        }
        if (layer === 'land' && p('showLand')) groupData.push({name: 'landImg', showSource: i === 0});
        // selected country
        else {
            groupData.push({ name: `${layer}-adm1`, data: resolvedAdm1[layer], id: 'shapeName', props: [], class: 'adm1', filter: null });
        }
    });

    groupData.push({ name: 'points-labels', data: [], id: null, props: [], class: null, filter: null });
    // const groups = svg.selectAll('svg').data(groupData).join('svg').attr('id', d => d.name);
    const groups = svg.append('svg')
        // .attr('clip-path', 'url(#clipMapBorder)')
        .selectAll('g').data(groupData).join('g').attr('id', d => d.name);
    function drawPaths(data) {
        if (data.name === 'landImg') return appendLandImage.call(this, data.showSource);
        if (!data.data) return;
        const pathElem = d3.select(this).style('will-change', 'opacity').selectAll('path')
            .data(data.data.features ? data.data.features : data.data)
            .join('path')
                .attr('d', (d) => {return path(d)});
        if (data.id) pathElem.attr('id', (d) => d.properties[data.id]);
        if (data.class) pathElem.attr('class', data.class);
        if (data.filter) pathElem.attr('filter', `url(#${data.filter})`);
        data.props.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]))
    }

    groups.each(drawPaths);

    drawCustomPaths(providedPaths, svg, projection);
    appendGlow(svg, 'secondGlow', false, p('innerGlow2'), p('outerGlow2'));
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
}

function computeCss() {
    const finalColorsCss = Object.values(colorsCss).reduce((acc, cur) => {acc += cur; return acc;}, ''); 
    commonCss = Mustache.render(cssTemplate, params) + finalColorsCss;
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
    pathElem.attr('filter', 'url(#firstGlow)');
    appendGlow(landElem, 'firstGlow', showSource, p('innerGlow1'), p('outerGlow1'));
    const landImage = d3.create('image').attr('width', '100%').attr('height', '100%')
        .attr('href', `data:image/svg+xml,${encodeURIComponent(SVGO.optimize(landElem.node().outerHTML, svgoConfig).data)}`);
        // .attr('href', `data:image/svg+xml;utf8,${landElem.node().outerHTML}`);
        // .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(landElem.node().outerHTML, svgoConfig).data}`);
        
    d3.select(this).html(landImage.node().outerHTML)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
        // .attr('clip-path', 'url(#clipMapBorder)');
}

function save() {
    saveState({params, inlineProps, cssFonts, providedFonts, 
        providedShapes, providedPaths, chosenCountries, orderedTabs,
        inlineStyles, shapeCount, zonesData, lastUsedLabelProps,
        tooltipDefs, colorDataDefs, legendDefs,
    });
}

function resetState() {
    params = JSON.parse(JSON.stringify(defaultParams));
    providedPaths = [];
    providedShapes = [];
    chosenCountries = [];
    orderedTabs = ['countries', 'land'];
    currentTab = 'countries';
    inlineProps = {
        longitude: 15,
        latitude: 36,
        altitude: 1000,
        rotation: 0,
        tilt: 25,
    }
    providedFonts = [];
    cssFonts;
    shapeCount = 0;
    inlineStyles = {};
    zonesData = {};
    lastUsedLabelProps = {};
    tooltipDefs = {
        countries: {
            template: defaultTooltipContent('name'),
            content: defaultTooltipFull(defaultTooltipContent('name')),
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
    ({  params, inlineProps, cssFonts, providedFonts, 
        providedShapes, providedPaths, chosenCountries, orderedTabs,
        inlineStyles, shapeCount, zonesData, lastUsedLabelProps,
        tooltipDefs, colorDataDefs, legendDefs,
    } = state);
    const tabsWoLand = orderedTabs.filter(x => x !== 'land');
    if (tabsWoLand.length) onTabChanged(tabsWoLand[0]);   
}

function saveProject() {
    const state = {params, inlineProps, cssFonts, providedFonts, 
        providedShapes, providedPaths, chosenCountries, orderedTabs,
        inlineStyles, shapeCount, zonesData, lastUsedLabelProps,
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
    });
    reader.readAsDataURL(file);
}

function addPath() {
    closeMenu();
    addingPath = true;
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
    const {prop, value} = event.detail;
    redraw(prop);
}

function closeMenu() {
    contextualMenu.style.display = 'none';
    menuStates.chosingPoint = false;
    menuStates.pointSelected = false;
    menuStates.addingLabel = false;
    editedLabelId = null;
}
function editStyles() {
    closeMenu();
    styleEditor.open(openContextMenuInfo.event.target, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
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
            typedText = target.childNodes[0].nodeValue;
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

function showMenu(e) {
    openContextMenuInfo = {event: e, position: projection.invert(d3.pointer(e))};
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
    const pointId = openContextMenuInfo.event.target.getAttribute('id');
    const newDef = {...providedShapes.find(def => def.id === pointId)};
    const projected = projection(newDef.pos);
    newDef.pos = projection.invert([projected[0] - 10, projected[1]]);
    const newShapeId = `${newDef.name}-${shapeCount++}`;
    inlineStyles[newShapeId] = {...inlineStyles[newDef.id]};
    newDef.id = newShapeId;
    providedShapes.push(newDef);
    drawAndSetupShapes();
    closeMenu();
}

function deleteSelection() {
    const pointId = openContextMenuInfo.event.target.getAttribute('id');
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

function handleDataImport(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            const sortKey = currentTab === 'countries' ? 'alpha-3' : 'shapeName';
            const parsed = sortBy(JSON.parse(reader.result), sortKey);
            zonesData[currentTab] = {data: parsed, provided:true, numericCols: getNumericCols(parsed) };
            autoSelectColors();
            save();
        } catch (e) {
            console.log('Parse error:', e);
        }
    });
    reader.readAsText(file);
}

function defaultTooltipContent(idCol) {
    return `<div>
    <span> ${idCol === 'name' ? 'Country' : 'Region'}: {${idCol}}</span>
</div>
    `;
}

function defaultTooltipFull(template) {
    return `<div id="tooltip-preview" style="will-change: opacity; font-size: 14px; padding: 10px; background-color: #FFFFFF; border: 1px solid black; max-width: 15rem; width: max-content;">
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
        // const firstLineError = errorNode.firstChild.data.split('\n')[0];
        templateErrorMessages[currentTab] = true;
    }
    else {
        tooltipDefs[currentTab].content = htmlTooltipElem.outerHTML;
        templateErrorMessages[currentTab] = null;
    }
    save(); 
}


async function onTabChanged(newTabTitle) {
    currentTab = newTabTitle;
    await tick();
    if (tooltipDefs[newTabTitle].enabled) {
        const tmpElem = htmlToElement(tooltipDefs[newTabTitle].content);
        reportStyle(tmpElem, htmlTooltipElem);
    }
    if (colorDataDefs[newTabTitle].legendEnabled) {
        const tmpElem = htmlToElement(legendDefs[newTabTitle].sampleHtml);
        reportStyle(tmpElem, legendSample);
    }
}

function addNewCountry(e) {
    if (chosenCountries.includes(e.target.value)) return;
    chosenCountries.push(e.target.value);
    chosenCountries = chosenCountries;
    orderedTabs.push(e.target.value);
    orderedTabs = orderedTabs;
    e.target.selectedIndex = null;
    draw();
}

function deleteCountry(country) {
    chosenCountries = chosenCountries.filter(x => x !== country);
    orderedTabs = orderedTabs.filter(x => x !== country);
    draw();
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

// === Export as PNG behaviour ===

function exportRaster() {
    const optimized = exportSvg(svg, p('width'), p('height'), tooltipDefs, chosenCountries, zonesData, providedFonts, false);
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
$: curDataDefs = colorDataDefs[currentTab];
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

$: {
    autoSelectColors(colorDataDefs[currentTab].colorScale, colorDataDefs[currentTab].colorColumn, colorDataDefs[currentTab].colorPalette, colorDataDefs[currentTab].nbBreaks);
}

const colorsCss = {};
let legendSample;
let displayedLegend = {};
let sampleLegend = {
    color: 'black', text: 'test'
}
async function colorizeAndLegend() {
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
        const shapeKey = tab === 'countries' ? 'alpha-3' : 'shapeName';
        let newCss = '';
        zonesData[tab].data.forEach(row => {
            const color = scale(row[dataColorDef.colorColumn]);
            const key = row[shapeKey];
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
	{@html `<${''}style id="map-style"> ${commonCss} </${''}style>`}
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
    {:else}
        <div role="button" class="px-2 py-1" on:click={editStyles}> Edit styles </div>
        <div role="button" class="px-2 py-1" on:click={addPath}> Draw path </div>
        <div role="button" class="px-2 py-1" on:click={addPoint}> Add point </div>
        <div role="button" class="px-2 py-1" on:click={addLabel}> Add label </div>
    {/if}
</div>
<h1 class="text-center fs-2"> Static SVG Map builder </h1>

<div class="d-flex p-3">
    <aside id="menu" class="border me-2">
        <NestedAccordions sections={params} paramDefs={paramDefs} on:change={handleChangeProp} ></NestedAccordions>
        <ul class="nav nav-tabs">
            {#each computedOrderedTabs as tabTitle, index (tabTitle) }
            <li class="nav-item d-flex align-items-center"
                draggable={tabTitle === "land"}
                on:dragstart={event => dragstart(event, index, tabTitle !== "land")}
                on:drop|preventDefault={event => drop(event, index)}
                ondragover="return false"
                on:dragenter={() => hoveringTab = index}
                class:is-dnd-hovering-right={hoveringTab === index && index > dragStartIndex}
                class:is-dnd-hovering-left={hoveringTab === index && index < dragStartIndex}
                class:grabbable={tabTitle === 'land'}>
                <a href="javascript:;"
                class:active={currentTab === tabTitle}
                class:disabled={tabTitle === 'land'}
                class="nav-link d-flex align-items-center"
                on:click={() => onTabChanged(tabTitle)}>
                    {#if tabTitle === "land"} <Icon svg={icons['draggable']}/> {/if}
                    {tabTitle}
                    {#if tabTitle !== 'countries' && tabTitle !== "land"}
                        <span role="button" class="delete-tab" on:click={() => deleteCountry(tabTitle)}> ✕ </span>
                    {/if}
                </a>
            {/each}
            
            <li class="nav-item">
                <select role="button" id='countrySelect' on:change={addNewCountry}>
                    {#each Object.keys(availableCountriesAdm1) as country}
                        <option value={country}> {country} </option>
                    {/each}
                </select>
                <span class="nav-link d-flex"> <Icon fillColor="none" svg={icons['add']}/> </span>
            </li>
        </ul>
        {#if zonesData?.[currentTab]?.['data']}
            <div>
                <label for="data-input-json" class="m-2 btn btn-light"> Import data for {currentTab} </label>
                <input id="data-input-json" type="file" accept=".json" on:change={(e) => handleDataImport(e)}>
            </div>
            <div class="data-table mb-2" on:click={() => (showModal = true)}>
                <DataTable data={zonesData?.[currentTab]?.['data']}> </DataTable>
            </div>
            <div class="mx-2 btn btn-outline-primary" on:click={() => exportJson(zonesData?.[currentTab]?.['data'])}> Export JSON </div>
            <div class="mx-2 form-check">
                <input
                    type="checkbox" class="form-check-input" id='showTooltip' bind:checked={tooltipDefs[currentTab].enabled}
                />
                <label for='showTooltip' class="form-check-label"> Show tooltip on hover </label>
            </div>
            {#if tooltipDefs[currentTab].enabled}
                <div class="m-2 has-validation">
                    <label for="templatetooltip" class="form-label"> Tooltip template </label>
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
                    <label for="tooltip-preview-{currentTab}"> Example tooltip: <br> (click to update style) </label>
                    <div class="tooltip-preview">
                        <div id="tooltip-preview-{currentTab}" bind:this={htmlTooltipElem} on:click={editTooltip} style="will-change: opacity; font-size: 14px; padding: 10px; background-color: #FFFFFF; border: 1px solid black; max-width: 15rem; width: max-content;">
                            {@html tooltipDefs[currentTab].template.formatUnicorn(zonesData?.[currentTab]?.['data'][0])}
                        </div>
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
                <div class="form-floating">
                    <select class="form-select" id="choseColorType" bind:value={curDataDefs.colorScale}>
                        {#each availableColorTypes as colorType}
                            <option value={colorType}> {colorType} </option>
                        {/each}
                    </select>
                    <label for="choseColorType">Color type</label>
                </div>
                <div class="form-floating">
                    <select class="form-select" id="choseColorColumn" bind:value={curDataDefs.colorColumn}>
                        {#each availableColumns as colorColumn}
                            <option value={colorColumn}> {colorColumn} </option>
                        {/each}
                    </select>
                    <label for="choseColorColumn"> Value color</label>
                </div>
                <div class="form-floating">
                    <select class="form-select" id="choseColorPalette" bind:value={curDataDefs.colorPalette}>
                        {#each availablePalettes as palette}
                            <option value={palette}> {palette} </option>
                        {/each}
                    </select>
                    <label for="choseColorPalette"> Palette </label>
                </div>
                {#if curDataDefs.colorScale !== 'category'}
                    <RangeInput title="Number of breaks" bind:value={curDataDefs.nbBreaks} min="3" max="9"></RangeInput>
                {/if}
                    <!-- LEGEND -->
                    <div class="mx-2 form-check">
                        <input
                            type="checkbox" class="form-check-input" id='showLegend' 
                            bind:checked={colorDataDefs[currentTab].legendEnabled}
                            on:change={colorizeAndLegend}
                        />
                        <label for='showLegend' class="form-check-label"> Show legend </label>
                    </div>
                {/if}
            {#if curDataDefs.legendEnabled}
                <Legend definition={legendDefs[currentTab]} on:change={colorizeAndLegend} categorical={colorDataDefs[currentTab].colorScale === 'category'}/>
                <svg width="100%" height={legendDefs[currentTab].rectHeight + 20}>
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
            {/if}
        {/if}     
        <div class="d-flex flex-wrap">
            <div>
                <label for="fontinput" class="m-2 d-flex align-items-center btn btn-light"> <Icon svg={icons['font']}/> Add font</label>
                <input type="file" id="fontinput" accept=".ttf,.woff,.woff2" on:change={handleInputFont}>
            </div>
            <div class="d-flex align-items-center m-2 btn btn-light"
                on:click={() => exportSvg(svg, p('width'), p('height'), tooltipDefs, chosenCountries, zonesData, providedFonts)}>
                <Icon fillColor="none" svg={icons['download']}/> Download SVG 
            </div>
            <div class="m-2 btn btn-light" on:click={() => exportRaster()}>
                <Icon fillColor="none" svg={icons['download']}/> Download raster
            </div>
            <div class="d-flex align-items-center m-2 btn btn-light" on:click={saveProject}>
                <Icon fillColor="none" svg={icons['save']}/> Save project
            </div>
            <div class="m-2 btn btn-light" on:click={resetState}>
                <Icon svg={icons['reset']}/> Reset
            </div>
            <div>
                <label class="d-flex align-items-center m-2 btn btn-light" for="project-import"> <Icon svg={icons['restore']}/> Load project</label>
                <input id="project-import" type="file" accept=".mapbuilder" on:change={loadProject}>
            </div>
        </div>
    </aside>
    <div id="map-container"></div>
</div>
<Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable data={zonesData?.[currentTab]?.['data']} > </DataTable>
</Modal>
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
    
</div>

<style lang="scss" scoped>
#menu {
    min-width: 20rem;
    max-width: 25rem;
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
#countrySelect{
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