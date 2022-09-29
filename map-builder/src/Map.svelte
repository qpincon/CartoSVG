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

import svgoConfig from './svgo.config';
import cssTemplate from './templates/style.template.txt';
// import exportTemplate from './templates/output_template.txt';
import { drawCustomPaths, parseAndUnprojectPath } from './svg/paths';
import { paramDefs, params} from './params';
import { appendBgPattern, appendGlow } from './svg/svgDefs';
import { splitMultiPolygons } from './util/geojson';
import { download, sortBy, indexBy, pick, htmlToElement } from './util/common';
import * as shapes from './svg/shapeDefs';
import { setTransformScale } from './svg/svg';
import { drawShapes } from './svg/shape';
import iso3Data from './assets/data/iso3_filtered.json';
import DataTable from './components/DataTable.svelte';
import Modal from './components/Modal.svelte';
import SlimSelect from './components/SlimSelect.svelte';
import NestedAccordions from './components/NestedAccordions.svelte';
import { Tabs, TabList, TabPanel, Tab } from './components/tabs/tabs.js';

const resolvedAdm1 = {};
const countriesAdm1 = require.context('./assets/layers/adm1/', false, /\..*json$/, 'lazy');
const availableCountriesAdm1 = countriesAdm1.keys().reduce((acc, file) => {
    const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
    acc[name.replace('_ADM', '')] = file;
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
const offCanvasPx = 5;
let timeoutId;
let countries = null;
let land = null;
let simpleLand = null;
let commonCss = null;
let openContextMenuInfo;
const adm0Land = import('./assets/layers/world_adm0_simplified.topojson')
    .then(({default:topoAdm0}) => {
        countries = topojson.feature(topoAdm0, topoAdm0.objects.simp);
        const iso3DataById = indexBy(iso3Data, 'alpha-3');
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
let providedPaths = [];
let providedShapes = []; // {name, coords, scale, id}
let chosenCountries = [];
const menuStates = {
    chosingPoint:      false,
    pointSelected:     false,
    addingLabel:       false,
};
const inlineProps = {
    longitude: 15,
    latitude: 36,
    altitude: 1000,
    rotation: 0,
    tilt: 25,
}
let editedLabelId;
let textInput;
let typedText = "";
const inlineStyles = {}; // elemID -> prop -> value
let lastUsedLabelFont = "Luminari"
let styleEditor;
let contextualMenu;
let zonesData = {}; // key => {data (list), provided (bool)}
let showModal = false;
let tooltip = {currentId: null, element: null};
let htmlPopupElem;;
let tooltipTemplate = {'countries': defaultPopupContent('name')};
let currentTab = 'countries';
onMount(() => {
    styleEditor = new InlineStyleEditor({
        onStyleChanged: (target, eventType, cssProp, value) => {
            if (eventType === 'inline') {
                if (target.hasAttribute('id')) {
                    const elemId = target.getAttribute('id');
                    if (elemId.includes('label') && cssProp === 'font-family') {
                        lastUsedLabelFont = value;
                    }
                    if (elemId in inlineStyles) inlineStyles[elemId][cssProp] = value;
                    else inlineStyles[elemId] = {[cssProp]: value};
                }
            }
        },
        getAdditionalElems: (el) => {
            if (el.classList.contains('adm1')) {
                const parentCountry = el.parentNode.getAttribute('id').replace('-adm1', '');
                const countryElem = document.getElementById(parentCountry);
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
        .on("drag", dragged)
        .on('start', () => {
            if (menuStates.addingLabel) validateLabel();
            styleEditor.close();
            closeMenu();
        })
    );
    const zoom = d3.zoom().on('zoom', zoomed).on('start', () => closeMenu());
    zoom.scaleBy(container, altScale.invert(inlineProps.altitude));
    container.call(zoom);
});

const altScale = d3.scaleLinear().domain([1, 0]).range([100, 10000]);
function zoomed(event) {
    if (!event.sourceEvent) return;
    if (!projection) return;
    if (event.transform.k > 0.01 && event.transform.k < 1.0) {
        const newAltitude = altScale(event.transform.k);
        inlineProps.altitude = newAltitude;
    }
    else if (event.transform.k < 0.01) {
        event.transform.k = 0.01;
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

function draw(simplified = false, _) {
    // console.log((new Error()));
    for (const country of chosenCountries) {
        if (!(country in resolvedAdm1)) {
            tooltipTemplate[country] = defaultPopupContent('shapeName');
            countriesAdm1(availableCountriesAdm1[country]).then(resolved => {
                resolvedAdm1[country] = topojson.feature(resolved, resolved.objects.country);
                if (!(country in zonesData) && !zonesData?.[country]?.provided) {
                    zonesData[country] = {data: sortBy(resolvedAdm1[country].features.map(f => f.properties), 'shapeName')};
                }
                draw(simplified);
            });
            return;
        }
    }
    const snyderP = 1.0 + inlineProps.altitude / earthRadius;
    const dY = inlineProps.altitude * Math.sin(inlineProps.tilt / degrees);
    const dZ = inlineProps.altitude * Math.cos(inlineProps.tilt / degrees);
    const visibleYextent = 2 * dZ * Math.tan(0.5 * p('fieldOfView') / degrees);
    const yShift = dY * p('height') / visibleYextent;
    const scale = earthRadius * p('height') / visibleYextent;
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

    projection = geoSatellite()
        .scale(scale)
        .translate([(p('width') / 2), (yShift + p('height') / 2)])
        .rotate([-inlineProps.longitude, -inlineProps.latitude, inlineProps.rotation])
        .tilt(inlineProps.tilt)
        .distance(snyderP)
        .preclip(preclip)
        .postclip(d3.geoClipRectangle(-offCanvasPx, -offCanvasPx, p('width') + offCanvasPx, p('height') + offCanvasPx))
        .precision(0.1);
   
    const outline = {type: "Sphere"};
    const graticule = d3.geoGraticule().step([p('graticuleStep'), p('graticuleStep')])();
    if (!p('useGraticule')) graticule.coordinates = [];
    if (simplified) {
        let canvas = container.select('#canvas');
        if (canvas.empty()) canvas = container.append('canvas').attr('id', 'canvas').attr('width', p('width')).attr('height', p('height'));
        const context = canvas.node().getContext('2d');
        context.clearRect(0, 0, p('width'), p('height'));
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
    if (p('useViewBox')) {
        svg.attr('viewBox', `0 0 ${p('width')} ${p('height')}`);
    }
    else {
        svg.attr('width', `${p('width') }`)
        .attr('height', `${p('height') }`)
    }
    container.style('width', `${p('width')}px`).style('height', `${p('height')}px`);

    path = d3.geoPath(projection);
    svg.html('');
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
    if (p('showCountries') && countries) {
        if (!('countries' in zonesData) && !zonesData?.['countries']?.provided) {
            zonesData['countries'] = {data: sortBy(countries.features.map(f => f.properties), 'alpha-3')};
        }
        groupData.push({ name: 'countries', data: countries, id: (prop) => prop['alpha-3'], props: [], class: 'country', filter: null });
    }
    if (p('showLand')) {
        groupData.push({ name: 'land', data: land, id: (prop) => prop['id'], props: [], class: 'land', filter: 'firstGlow' });
    }
    // if (providedBorders && params.providedBorders.show)
    //     groupData.push({ name: 'provided-borders', data: [providedBorders], id: null, props: [], class: 'provided-borders', filter: params.providedBorders.filter });
    // if (provided && params.provided.show)
    //     groupData.push({ name: 'provided', data: provided, id: null, props: [], class: 'provided', filter: null });
    for (const country of chosenCountries) {
        groupData.push({ name: `${country}-adm1`, data: resolvedAdm1[country], id: (prop) => prop.shapeName, props: [], class: 'adm1', filter: null });
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
    appendGlow(svg, 'firstGlow', p('innerGlow1'), p('outerGlow1'));
    appendGlow(svg, 'secondGlow', p('innerGlow2'), p('outerGlow2'));
    appendBgPattern(svg, 'noise', p('seaColor'), p('backgroundNoise'));
    d3.select('#outline').style('fill', "url(#noise)");
    commonCss = Mustache.render(cssTemplate, params);
    drawAndSetupShapes();
    
    const map = document.getElementById('map')
    if(!map) return;
    // map.addEventListener('mousemove', e => {
    //     const shapeId = e.target.getAttribute('id');
    //     if (shapeId && tooltip.shapeId === shapeId) {
    //         tooltip.element.style.left = `${e.clientX + 10}px`;
    //         tooltip.element.style.top = `${e.clientY + 10}px`;
    //     }
    //     else {
    //         if (tooltip.element) {
    //             tooltip.element.remove();
    //             tooltip.shapeId = null;
    //         }
    //         if (shapeId && e.target.classList.contains('country')) {
    //             const data = zonesData['countries'].data.find(row => row['alpha-3'] === shapeId);
    //             tooltip.element = instanciateTooltip(data, 'countries', e);
    //             tooltip.shapeId = shapeId;
    //             tooltip.element.setAttribute('id', 'tooltip');
    //             container.node().appendChild(tooltip.element);
    //         }
    //     }
    // });
}

function instanciateTooltip(dataRow, groupId, event) {
    const tooltip = document.createElement('div');
    if (!htmlPopupElem) return tooltip;
    tooltip.innerHTML = tooltipTemplate[groupId].formatUnicorn(dataRow);
    reportStyle(htmlPopupElem, tooltip);
    tooltip.setAttribute('id', 'tooltip');
    if (event) {
        tooltip.style.left =    `${event.clientX + 10}px`;
        tooltip.style.top =     `${event.clientY + 10}px`;
    }
    return tooltip;
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
        
//         inlineProps.longitude = (boundingBox[2] + boundingBox[0]) / 2;
//         inlineProps.latitude = (boundingBox[3] + boundingBox[1]) / 2;
//         inlineProps.tilt = 0;
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
    // const finalSvg = svg.node();
    // const defs = finalSvg.querySelector('defs');
    const defs = svg.select('defs');
    const renderedCss = exportStyleSheet('map-style');
    defs.append('style').html(renderedCss + cssFonts);
    // let str = "I have a cat, a dog, and a goat.";
// str = str.replace(/\b(?:cat|dog|goat)\b/gi, matched => mapObj[matched]);
// console.log(str);
    // let regexExpr = '';
    // for (let key of ['ab', 'cd']) {
    //     if (regexExpr.length) regexExpr += '|';
    //     regexExpr += `\{${key}\}`;
    // }
    // console.log(regexExpr);
    const ttTemplate = getFinalTooltipTemplate('countries');
    // console.log(tooltipTemplate)
    // console.log(/\{\w+\}/g)
    // console.log([...tooltipTemplate.matchAll(/\{(\w+)\}/g)])
    let usedVars = [...ttTemplate.matchAll(/\{(\w+)\}/g)].map(group => {
        return group[1];
    });
    usedVars = [...new Set(usedVars)];
    const functionStr = ttTemplate.replaceAll(/\{(\w+)\}/gi, '${r.$1}');
    // console.log(functionStr);
    // const regex = new RegExp(regexExpr, "gi");
    // console.log("coucou{ab}hehe{cd}".replace(regex, matched => mapObj[matched]));
     // elem.innerHTML = \`${functionStr}\`;
            // elem.firstChild.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    defs.append('script').html(`<![CDATA[
    window.addEventListener('DOMContentLoaded', () => {
        let tooltip = null;
        let tooltipType = '';
        function constructTooltip(r) {
            const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            elem.setAttribute('width', 1);
            elem.setAttribute('height', 1);
            const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
            body.innerHTML = \`${functionStr}\`;
            elem.append(body);
            return elem;
        }
        document.firstChild.addEventListener('mouseover', (e) => {
            const parent = e.target.parentNode;
            if (!parent?.hasAttribute("id")) return;
            const groupId = parent.getAttribute('id');
            console.log(groupId);
            tooltip = constructTooltip({name: 'test'});
            tooltip.setAttribute('x', e.clientX);
            tooltip.setAttribute('y', e.clientY);
            tooltip.style.display = 'block';
            tooltipType = groupId;
            const lastChild = document.firstChild.lastChild;
            console.log(lastChild.tagName)
            if (lastChild.tagName === 'foreignObject') {
                document.firstChild.lastChild.replaceWith(tooltip);
            }
            else {
                document.firstChild.append(tooltip);
            }
        });

        document.firstChild.addEventListener('mousemove', (e) => {
            tooltip.setAttribute('x', e.clientX);
            tooltip.setAttribute('y', e.clientY)
        });
        document.firstChild.addEventListener('mouseout', (e) => {
            tooltip.style.display = 'none';
        });
        
    });
`);


    // const svgExport = SVGO.optimize(finalSvg.outerHTML, svgoConfig).data;
    // const renderedCss = exportStyleSheet();
    // const exportParams = {
    //     svgStr: svgExport,
    //     commonCss: renderedCss,
    //     addedCss: cssFonts,
    //     tooltip: getFinalTooltipTemplate(),
    // };
    // const out = Mustache.render(exportTemplate, exportParams);
    // console.log(renderedCss);
    // download(out, 'text/plain', 'mySvg.js');
    const finalSvg = SVGO.optimize(svg.node().outerHTML, svgoConfig).data;
    // console.log(finalSvg)
    // let optimizedSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const domParser = new DOMParser();

    const optimizedSVG = domParser.parseFromString(finalSvg, 'text/html');
    const finalDataByGroup = {};
    console.log(zonesData);
    [...chosenCountries, 'countries'].forEach(groupId => {
        const indexed = indexBy(zonesData[groupId].data, groupId === 'countries' ? 'alpha-3': 'shapeName');
        const group = optimizedSVG.getElementById(groupId);
        const finalData = {};
        for (let child of group.children) {
            const id = child.getAttribute('id');
            if (!id) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup[groupId] = finalData;
    });
    // console.log(finalSvg)
    download(finalSvg, 'text/plain', 'mySvg.svg');
}

function getTooltipData(groupId, optimizedSvg) {
    const indexed = indexBy(zonesData[groupId].data, groupId === 'countries' ? 'alpha-3': 'shapeName');
    const group = optimizedSvg.getElementById(groupId);
    const finalData = {};
    for (let child of group.children) {
        const id = child.getAttribute('id');
        if (!id) continue;
        finalData[id] = pick(indexed[id], usedVars);
    }
}

$:draw(false, chosenCountries); // redraw when chosenCountries changes
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
            if (selectorText?.includes("#paths path")) return styleSheetToText(sheets[i]);
        }
    }
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
            inlineStyles[labelId] = { 'font-family': lastUsedLabelFont};
        }
        typedText = '';
    }
    drawAndSetupShapes();
    closeMenu();
}

function drawAndSetupShapes() {
    const container = document.getElementById('points-labels');
    if (!container) return;
    drawShapes(providedShapes, container, projection);
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

let shapeCount = 0;
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
    download(JSON.stringify(data), 'text/json', 'data.json');
}

function handleDataImport(e, key) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        console.log(reader.result);
        try {
            const parsed = sortBy(JSON.parse(reader.result), 'alpha-3');
            zonesData[key] = {data: parsed, provided:true };
        } catch (e) {
            console.log('Parse error:', e);
        }
    });
    reader.readAsText(file);
}

function defaultPopupContent(idCol) {
    return `<div>
    <span> Country: {${idCol}}</span>
</div>
    `;
}

function editPopup(e) {
    const rect = e.target.getBoundingClientRect();
    styleEditor.open(e.target, rect.right, rect.bottom);
}

function editFrame(e) {
    styleEditor.open(document.getElementById('map'));
}

function reportStyle(reference, target) {
    const walkerRef = document.createTreeWalker(reference, NodeFilter.SHOW_ELEMENT); 
    const walkerTarget = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
    reportStyleElem(walkerRef.currentNode, walkerTarget.currentNode);
    while (walkerRef.nextNode()) {
        walkerTarget.nextNode();
        reportStyleElem(walkerRef.currentNode, walkerTarget.currentNode);
    }
}

function reportStyleElem(ref, target) {
    target.setAttribute('style', ref.getAttribute('style'));
}

function getFinalTooltipTemplate(groupId) {
    let finalTemplate = htmlPopupElem.cloneNode(true);
    finalTemplate.innerHTML = tooltipTemplate[groupId];
    reportStyle(htmlPopupElem, finalTemplate);
    return finalTemplate.outerHTML;
}

const popupContents = {};
async function onTabChanged(e) {
    // save changes made on the popup template
    popupContents[currentTab] = htmlPopupElem.outerHTML;
    currentTab = e.detail.tab;
    await tick();
    if (e.detail.tab in popupContents) {
        const tmpElem = htmlToElement(popupContents[e.detail.tab]);
        reportStyle(tmpElem, htmlPopupElem);
    }
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
        <div class="m-2 btn btn-outline-warning" on:click={editFrame}> Edit frame </div>
        <SlimSelect bind:value={chosenCountries} options={Object.keys(availableCountriesAdm1)} multiple="true"/>
        <Tabs>
            <TabList>
                {#each ['countries', ...chosenCountries] as tabTitle }
                    <Tab on:change={onTabChanged} tabTitle={tabTitle}> </Tab>
                {/each}
            </TabList>
            {#each ['countries', ...chosenCountries] as tabTitle }
            {#if zonesData?.[tabTitle]?.['data']}
            <TabPanel>
                    <div class="w-100 px-2 my-3 row">
                        <label for="data-input-json" class="col-form-label col-4">Import data</label>
                        <input class="form-control col" type="file" id="data-input-json" accept=".json" on:change={(e) => handleDataImport(e, 'countries')}>
                    </div>
                    <div class="data-table mb-2" on:click={() => (showModal = true)}>
                        <DataTable data={zonesData?.[tabTitle]?.['data']} idCol='alpha-3'> </DataTable>
                    </div>
                    <div class="mx-2 btn btn-outline-primary" on:click={() => exportJson(zonesData?.[tabTitle]?.['data'])}> Export JSON </div>
                    
                    <div class="w-100 px-2 my-3 row">
                        <label for="fontinput" class="col-form-label col-4">Font file</label>
                        <input class="form-control col" type="file" id="fontinput" accept=".ttf,.woff" on:change={handleInputFont}>
                    </div>
                    <div class="m-2">
                        <label for="templatePopup" class="form-label"> Popup template </label>
                        <textarea class="form-control template-input" id="templatePopup" rows="3" bind:value={tooltipTemplate[tabTitle]}></textarea>
                    </div>
                    <div class="popup-preview">
                        <div id="popup-preview" bind:this={htmlPopupElem} on:click={editPopup} style="padding: 10px; background-color: #FFFFFF; border: 1px solid black; max-width: 15rem; width: max-content;">
                            {@html tooltipTemplate[tabTitle].formatUnicorn(zonesData?.[tabTitle]?.['data'][0])}
                        </div>
                    </div>
                </TabPanel>   
            {/if}     
            {/each}
        </Tabs>
        <div class="m-2 btn btn-light" on:click={exportSvg}> Export </div>
    </aside>
    <div id="map-container"></div>
</div>
<Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable data={zonesData?.['countries']?.['data']} idCol='alpha-3'> </DataTable>
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
.popup-preview {
    padding: 10px;
}
#map-container {
    margin: 0 auto;
    flex: 0 0 auto;
}
// .template-input {

// }
</style>