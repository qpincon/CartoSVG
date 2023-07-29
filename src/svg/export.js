import svgoConfig from '../svgoExport.config';
import svgoConfigText from '../svgoExportText.config';

import { imageFromSpecialGElemStr, encodeSVGDataImageStr } from '../svg/contourMethods';
import { htmlToElement } from '../util/common';
import { indexBy, pick, download, discriminateCssForExport } from '../util/common';
import { reportStyle, reportStyleElem, fontsToCss, getUsedInlineFonts } from '../util/dom';

const domParser = new DOMParser();

const rgb2hex = (rgb) => `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`
// regular function
function isHexColor (hex) {
    return (hex.length === 6 || hex.length === 3 || hex.length === 8) && !isNaN(Number('0x' + hex))
}
const replaceReferenceValue = (value, prefix) => {
    let newValue;
    // discriminate colors in hex notation
    if (value[0] === '#' && !isHexColor(value.slice(1))) {
        newValue = `#${prefix}-${value.slice(1)}`
    }
    if (value.slice(0, 3) === 'url') {
        const existing = value.match(/url\(#(.*)\)/)[1];
        newValue = `url(#${prefix}-${existing})`;
    } 
    return newValue;
};
const exportFontChoices = Object.freeze({
    noExport: 0,
    convertToPath: 1,
    embedFont: 2,
    smallest: 3,
});

const domBaselineToBaseline = {
    hanging: "top",
    auto: "middle",
    middle: "middle",
    "text-top": "bottom"
};
const anchorToAnchor = {
    left: 'left',
    middle: 'center',
    right: 'right'
};

const additionnalCssExport = '#points-labels {pointer-events:none}';
const cssFontProps = ['font-family', 'font-size', 'font-weight', 'color'];
function getTextElems(svgElem) {
    const texts = Array.from(svgElem.querySelectorAll('text')).concat(Array.from(svgElem.querySelectorAll('tspan')));
    // ignore text elements containing tspans
    return texts.filter(t => !(t.tagName == 'text' && t.firstChild.tagName == 'tspan'))
}


function getInlineStyle(el, defaultStyles, propName) {
    const isTspan = el.tagName == 'tspan';
    return el.style[propName] || (isTspan ? el.parentNode.style[propName] : null) || defaultStyles.getPropertyValue(propName);
}

function replaceTextsWithPaths(svgElem, transformedTexts) {
    const defaultStyles = getComputedStyle(document.body);
    const texts = getTextElems(svgElem);
    texts.forEach(textElem => {
        const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
        const text = textElem.textContent.trim();
        const transformed = transformedTexts[fontFamily]?.[text];
        if (!transformed) return;
        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', transformed);
        reportStyleElem(textElem, pathElem);
        if (textElem.tagName == 'tspan') {
            textElem.parentNode.parentNode.append(pathElem);
            reportStyleElem(textElem.parentNode, pathElem);
            textElem.remove();
        }
        else textElem.replaceWith(pathElem);
        // no need to keep font-xxx properties on a path
        cssFontProps.forEach(prop => pathElem.style.removeProperty(prop));
    });
    // Remove now empty <text>s
    svgElem.querySelectorAll('text:empty').forEach(el => el.remove());
}

function getTextPosition(textElem, defaultStyles) {
    const getShift = (elem, attr) => {
        const fontSize = parseFloat(getInlineStyle(elem, defaultStyles, 'font-size'));
        const delta = elem.getAttribute(attr);
        if (delta && delta.includes('em')) return parseFloat(delta) * fontSize;
        return 0;
    };
    const getPos = (elem, direction) => {
        let attributes = {delta: 'dx', pos: 'x'};
        if (direction == 'y') attributes = {delta: 'dy', pos: 'y'};
        let pos = parseFloat(elem.getAttribute(attributes.pos)) || 0;
        pos += getShift(elem, attributes.delta);
        let prevSibling = elem.previousSibling;
        // if "y" is ommited, "dy" is cumulative
        while(prevSibling !== null && !prevSibling.hasAttribute(attributes.pos)) {
            pos += getShift(prevSibling, attributes.delta);
            prevSibling = prevSibling.previousSibling;
        }
        return pos;
    };
    
    let x = getPos(textElem, 'x');
    let y = getPos(textElem, 'y');
    return {x, y};
}

async function inlineFontVsPath(svgElem, providedFonts, exportFontsOption) {
    let nbFontChars = 0;
    let nbPathChars = 0;
    const transformedTexts = {};
    const SVGO = await import('svgo/dist/svgo.browser');
    const TextToSVG  = (await import('text-to-svg')).default;
    const defaultStyles = getComputedStyle(document.body);
    await Promise.all(providedFonts.map(({ name, content }) => {
        transformedTexts[name] = {};
        nbFontChars += content.length;
        const texts = getTextElems(svgElem);
        return new Promise(resolve => {
            TextToSVG.load(content, function (err, textToSVG) {
                texts.forEach(textElem => {
                    if (textElem.tagName == 'text' && textElem.firstChild.tagName == 'tspan') return;
                    const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
                    if (fontFamily === name) {
                        const text = textElem.textContent.trim();
                        const anchor = anchorToAnchor[textElem.getAttribute('text-anchor')] || 'left';
                        const baseline = domBaselineToBaseline[textElem.getAttribute('dominant-baseline')] || 'baseline';
                        const fontSize = parseFloat(getInlineStyle(textElem, defaultStyles, 'font-size'));
                        const {x, y} = getTextPosition(textElem, defaultStyles);
                        const options = {
                            x: x,
                            y: y,
                            fontSize: fontSize,
                            anchor: `${anchor} ${baseline}`
                        };
                        let path = textToSVG.getD(text, options);
                        const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        const tmpPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        tmpPath.setAttribute('d', path);
                        tmpSvg.append(tmpPath);
                        const optimized = domParser.parseFromString(SVGO.optimize(tmpSvg.outerHTML, svgoConfigText).data, 'image/svg+xml');
                        path = optimized.querySelector('path').getAttribute('d');
                        transformedTexts[name][text] = path;
                        nbPathChars += path.length;
                    }
                });
                resolve();
            });
        });
    }));
    const pathIsBetter = nbPathChars + 10000 < nbFontChars;
    if (exportFontsOption === exportFontChoices.convertToPath || pathIsBetter) {
        replaceTextsWithPaths(svgElem, transformedTexts);
        return true;
    }
    return false;
}

const urlUsingAttributes = ['marker-start', 'marker-mid', 'marker-end', 'clip-path', 'fill', 'filter', '*|href'];
function changeIdAndReferences(exportedMapElem, newMapId) {
    // change SVG definitions IDs
    exportedMapElem.querySelectorAll('defs > [id], #paths > [id]').forEach(elem => {
        const existingId = elem.getAttribute('id');
        elem.setAttribute('id', `${newMapId}-${existingId}`);
    });
    
    // change image-filter-name special attribute for contours
    exportedMapElem.querySelectorAll('[image-filter-name]').forEach(elem => {
        const existingFilterName = elem.getAttribute('image-filter-name');
        elem.setAttribute('image-filter-name', `${newMapId}-${existingFilterName}`);
    });

    // change inline styles with url(#...)
    exportedMapElem.querySelectorAll('[style*="url"]').forEach(elem => {
        for (const prop in elem.style) {
            if (elem.style.hasOwnProperty(prop)) {
                const propValue = elem.style[prop];
                if (!propValue.includes('url')) return;
                const newValue = replaceReferenceValue(propValue, newMapId);
                if (newValue) elem.style[prop] = newValue;
            }
        }
    });
    // change SVG elements attributes that could contain a reference to another element
    exportedMapElem.querySelectorAll(urlUsingAttributes.map(x => `[${x}]`).join(',')).forEach(elem => {
        console.log(elem);
        for (const attributeName of urlUsingAttributes) {
            let attributesToCheck = [attributeName];
            if (attributeName.includes('href')) attributesToCheck = ['href', 'xlink:href'];
            for (const finalAttributeName of attributesToCheck) {
                const attribute = elem.getAttribute(finalAttributeName);
                if (!attribute) continue;
                const newValue = replaceReferenceValue(attribute, newMapId);
                if (newValue) elem.setAttribute(finalAttributeName, newValue);
            }
        }
    });
    // remove ids from path elements
    // exportedMapElem.querySelectorAll('.choro').forEach(layerElem => {
    //     layerElem.childNodes.forEach(el => {
    //         el.removeAttribute('id');
    //     });
    // });
}

// to insert at the end to have mapElement object defined
const intersectionObservingPart = `
const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.3,
  };
mapElement.style['visibility'] = 'hidden';
let rendered = false;
function intersectionCallback(entries) {
    if (rendered || !entries[0].isIntersecting) return;
    rendered = true;
    // add some delay to ensure the map is in the viewport
    setTimeout(() => {
        mapElement.style['visibility'] = 'visible';
        mapElement.classList.add('animate');
        mapElement.querySelectorAll('path').forEach(pathElem => {
            pathElem.setAttribute('pathLength', 1);
        });
        setTimeout(() => {
            mapElement.classList.add('animate-transition');
        }, 1000);
        mapElement.querySelector('#frame').addEventListener('animationend', () => {
            mapElement.classList.remove('animate');
            gElemsToImages(true);
            mapElement.querySelectorAll('path[pathLength]').forEach(el => {el.removeAttribute('pathLength')});
            setTimeout(() => {
                mapElement.classList.remove('animate-transition');
            }, 1000);
        });
    }, 500);
}
const observer = new IntersectionObserver(intersectionCallback, observerOptions);
observer.observe(mapElement);
`;
async function exportSvg(svg, width, height, tooltipDefs, chosenCountries, zonesData, providedFonts, downloadExport = true, commonCss,
    animated, { exportFonts = exportFontChoices.convertToPath, hideOnResize = false, minifyJs = false })
{
    const fo = svg.select('foreignObject').node();
    // remove foreign object from dom when exporting
    if (fo) document.body.append(fo);
    const svgNode = svg.node();

    // === Remove contours ==
    // let contours = Array.from(svg.node().querySelectorAll('.contour-to-dup[filter]'));
    let contours = Array.from(svg.node().querySelectorAll('image.contour-to-dup'));
    contours = contours.map(el => {
        const parent = el.parentNode;
        document.body.append(el);
        return [el, parent];
    });
    // === End remove contours ==

    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));
    
    const SVGO = await import('svgo/dist/svgo.browser');

    // Optimize whole SVG
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig).data;

    // === re-insert tooltip and contours ===
    if (fo) svg.node().append(fo);
    contours.forEach(([el, parent]) => {
        parent.insertBefore(el, parent.firstChild);
    });
    // === End re-insertion === 

    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;
    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild, providedFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }
    const finalDataByGroup = { data: {}, tooltips: {} };
    let tooltipEnabled = false;
    [...chosenCountries, 'countries'].forEach(groupId => {
        const group = optimizedSVG.getElementById(groupId);
        if (!group || !tooltipDefs[groupId].enabled) return;
        tooltipEnabled = true;
        const ttTemplate = getFinalTooltipTemplate(groupId, tooltipDefs);
        let usedVars = [...ttTemplate.matchAll(/\{(\w+)\}/g)].map(group => {
            return group[1];
        });
        usedVars = [...new Set(usedVars)];
        usedVars = usedVars.filter(v => v != 'name');
        let functionStr = ttTemplate.replaceAll(/\{(\w+)\}/gi, '${data.$1}');
        functionStr = functionStr.replace('data.name', 'shapeId');
        finalDataByGroup.tooltips[groupId] = functionStr;
        const zonesDataDup = JSON.parse(JSON.stringify(zonesData[groupId].data));
        zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            zonesDataDup.forEach(row => {
                row[col] = zonesData[groupId].formatters[col](row[col]);
            });
        });
        const indexed = indexBy(zonesDataDup, 'name');
        const finalData = {};
        for (const child of group.children) {
            const id = child.getAttribute('id');
            if (!id) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    const onResize = hideOnResize ? `
    let resizeTimeout;
    const contentSvg = mapElement.querySelector('svg');
    window.addEventListener('resize', e => {
        contentSvg.style.display = "none"; clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => { contentSvg.style.display = 'block' }, 300);
    });`: '';

    const onMouseEvents = `
        mapElement.addEventListener('mousemove', (e) => {
            ${tooltipEnabled ? 'onMouseMove(e);' : ''}
            const parent = e.target.parentNode;
            if (e.target.tagName === 'path' && parent.tagName === 'g') {
                if (e.target.previousPos === undefined) e.target.previousPos = Array.from(parent.children).indexOf(e.target);
                if (e.target !== parent.lastElementChild) parent.append(e.target);
            } 
        });

        mapElement.addEventListener('mouseout', (e) => {
            const previousPos = e.target.previousPos;
            if (previousPos) {
                const parent = e.target.parentNode;
                parent.insertBefore(e.target, parent.children[previousPos]);
            }
        });
    `;

    const tooltipCode = tooltipEnabled ? `
    const parser = new DOMParser();
    const width = ${width}, height = ${height};
    const inverseScreenCTM = mapElement.getScreenCTM().inverse();
    const tooltip = {shapeId: null, element: null};
    tooltip.element = constructTooltip({}, '', 1, 1);
    mapElement.append(tooltip.element);
    tooltip.element.style.display = 'none';
    const dataByGroup = ${JSON.stringify(finalDataByGroup)};
    function constructTooltip(data, templateStr, shapeId, scaleX, scaleY) {
        if(!data) return;
        const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        elem.setAttribute('width', 1);
        elem.setAttribute('height', 1);
        elem.style.overflow = 'visible';
        const parsed = parser.parseFromString(eval('\`' + templateStr + '\`' ), 'text/html').querySelector('body');
        parsed.style['position'] = 'fixed';
        elem.appendChild(parsed);
        return elem;
    }
    mapElement.addEventListener('mouseleave', hideTooltip);

    function hideTooltip() {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    }

    function onMouseMove(e) {
        const parent = e.target.parentNode;
        if (!parent?.hasAttribute?.("id")) return hideTooltip();
        const mapBounds = mapElement.querySelector('#frame').getBoundingClientRect();
        const scaleX = width / mapBounds.width;
        const scaleY = height / mapBounds.height;
        const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect();
        let posX = (e.clientX - mapBounds.left + 10) * scaleX, posY = (e.clientY - mapBounds.top + 10) * scaleY;
        let tooltipVisibleOpacity = 1;
        const groupId = parent.getAttribute('id');
        const shapeId = e.target.getAttribute('id');
        if (ttBounds?.width > 0) {
            if (mapBounds.right - ttBounds.width < e.clientX + 10) {
                posX = (e.clientX - mapBounds.left - ttBounds.width - 20) * scaleX;
            }
            if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
                posY = (e.clientY - mapBounds.top - ttBounds.height - 20) * scaleY;
            }
        }
        else if (shapeId && groupId in dataByGroup.data) {
            tooltipVisibleOpacity = 0;
            setTimeout(() => {
                onMouseMove(e);
            }, 0);
        }
        if (!(groupId in dataByGroup.data)) {
            hideTooltip();
        }
        else if (shapeId && tooltip.shapeId === shapeId) {
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            // webkit positioning fix
            tooltip.element.firstChild.style['position'] = 'absolute';
            setTimeout(() => {tooltip.element.firstChild.style['position'] = 'fixed'}, 0)
            tooltip.element.style.display = 'block';
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
        else {
            const data = dataByGroup.data[groupId][shapeId];
            if (!data) {
                tooltip.element.style.display = 'none';
                return;
            }
            const tt = constructTooltip(data, dataByGroup.tooltips[groupId], shapeId, scaleX, scaleY);
            tooltip.element.replaceWith(tt);
            tooltip.element = tt;
            tooltip.shapeId = shapeId;
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
    }` : '';
    let finalScript = `
    (function() {
        ${encodeSVGDataImageStr}
        ${imageFromSpecialGElemStr}
        function duplicateContours(svgElem, transition=false) {
            Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
                if (!el.hasAttribute('filter-name')) return;
                const clone = el.cloneNode();
                clone.setAttribute('href', el.getAttribute('href').replace(\`fill='none'\`, ''))
                clone.setAttribute('filter', \`url(#\${el.getAttribute('filter-name')})\`);
                if (transition) {
                    clone.style['opacity'] = 0;
                    setTimeout(() => {
                        clone.style['opacity'] = 1;
                    }, 0);
                }
                el.parentNode.insertBefore(clone, el);
            });
        }
        const allScripts = document.getElementsByTagName('script');
        const scriptTag = allScripts[allScripts.length - 1];
        const mapElement = scriptTag.parentNode;

        function gElemsToImages(transition=false) {
            const toTransformToImg = mapElement.querySelectorAll('g[image-class]');
            toTransformToImg.forEach(gElem => {
                const image = imageFromSpecialGElem(gElem);
                gElem.parentNode.append(image);
                if (transition) {
                    setTimeout(() => {
                        gElem.remove();
                    }, 500);
                }
                else gElem.remove();
            });
            duplicateContours(mapElement, transition);
        }
        ${onResize}
        ${tooltipCode}
        ${onMouseEvents}
        ${animated ? intersectionObservingPart : 'gElemsToImages()'}
    })()
        `;

    // === Styling ===
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const {mapId, finalCss } = discriminateCssForExport(renderedCss);
    optimizedSVG.firstChild.setAttribute('id', mapId);
    changeIdAndReferences(optimizedSVG.firstChild, mapId);
    // === End styling ===

    styleElem.innerHTML = pathIsBetter ? finalCss : finalCss + fontsToCss(usedProvidedFonts);
    optimizedSVG.firstChild.append(styleElem);
    optimizedSVG.firstChild.classList.remove('animate-transition');
    if (!downloadExport) return optimizedSVG.firstChild.outerHTML;
    console.log(finalScript);
    if (minifyJs != false) {
        const terser = await import('terser');
        finalScript = await terser.minify(finalScript, { toplevel: true, mangle: {eval: true, reserved: ['data', 'shapeId']}});
        finalScript = finalScript.code;
    }
    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    const scriptContent = document.createTextNode(finalScript);
    scriptElem.appendChild(scriptContent);
    optimizedSVG.firstChild.append(scriptElem);
    download(optimizedSVG.firstChild.outerHTML, 'text/plain', 'cartosvg-export.svg');
}

function getFinalTooltipTemplate(groupId, tooltipDefs) {
    const finalReference = htmlToElement(tooltipDefs[groupId].content);
    const finalTemplate = finalReference.cloneNode(true);
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}


export { exportSvg, exportFontChoices };