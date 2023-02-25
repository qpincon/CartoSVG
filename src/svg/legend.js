import * as d3 from "d3";
import { reportStyle } from '../util/dom';
import { setTransformTranslate, getTranslateFromTransform } from '../svg/svg';
import { addSvgText } from './shape';

function drawLegend(legendSelection, legendDef, legendColors, isCategorical, sampleElem, tabName, saveFunc, applyStyles, entryWidth = legendDef.lineWidth) {
    const colors = [...legendColors];
    if (legendDef.noData.active) {
        colors.unshift([legendDef.noData.color, legendDef.noData.text]);
    }
    const labelWidths = getEntryWidths(legendSelection.node(), colors.map(x => x[1]), sampleElem);
    const maxLabelWidth = Math.max(...labelWidths);
    const horizontal = legendDef.direction === 'h';
    const gap = isCategorical ? 5 : 0;
    const textBaseline = !isCategorical && horizontal ? 'hanging' : 'middle';
    const willRerun = entryWidth === legendDef.lineWidth && isCategorical && horizontal;
    let xAcc = 0, yAcc = 0;
    const computeX = () => {
        if (horizontal) {
            if (isCategorical && xAcc >= legendDef.maxWidth) {
                xAcc = 0;
                yAcc += legendDef.rectHeight + gap;
            }
            const xPos = xAcc;
            xAcc += isCategorical ? entryWidth + 5 : legendDef.rectWidth;
            return xPos;
        }
        return 0;
    };
    const computeY = (index) => {
        if (horizontal) {
            return yAcc;
        }
        return (index * (legendDef.rectHeight + gap));
    };
    const nbLegend = legendSelection.node().childElementCount;
    let offsetX = 0;
    if (nbLegend > 0) {
        const lastChild = legendSelection.node().lastChild;
        offsetX = Math.min(lastChild.getBBox().width + 20, 100);
    }
    const groupId = `${tabName}-legend-group`;
    const titleId = `${tabName}-legend-title`;
    if (!legendDef.changes[groupId]) legendDef.changes[groupId] = {dx: 0, dy: 0};
    if (!legendDef.changes[titleId]) legendDef.changes[titleId] = {dx: 0, dy: 0, title: legendDef.title};
    offsetX += legendDef.changes[groupId].dx;
    const offsetY = legendDef.changes[groupId].dy;
    const legendGroup = legendSelection.append('g')
        .attr('id', groupId)
        .attr('transform', `translate(${legendDef.x + offsetX} ${offsetY + (legendDef.y ? legendDef.y : 100)})`)

    const legendTitle = legendGroup.append(() => addSvgText(legendDef.title, titleId).node())
        .attr('x', 0)
        .attr('y', 0)
        .attr('transform', `translate(${legendDef.changes[titleId].dx} ${legendDef.changes[titleId].dy -20})`)
        .attr('id', titleId)
        .style('font-size', '20px')
        .on('dblclick', e => {
            const inputVal = legendDef.title;
            const closeInput = () => {
                legendTitle.html(addSvgText(input.value, titleId).node().innerHTML);
                legendDef.title = input.value;
                legendDef.titleChanged = true;
                input.remove();
                applyStyles();
                saveFunc();
            };
            const input = d3.select(document.body).append('input')
                .attr('value', inputVal)
                .style('position', 'absolute')
                .style('left', `${e.clientX}px`)
                .style('top', `${e.clientY}px`)
                .on('blur', closeInput)
                .on('keydown', ({key}) => {
                    if (key === "Enter") {
                        closeInput()
                    }
                })
                .node();
            
            input.focus();
            e.preventDefault();
            e.stopPropagation();
        });

    let draggingElem;
    legendGroup.call(d3.drag()
        .on("drag", (e) => {
            const id = draggingElem.getAttribute('id');
            legendDef.changes[id].dx += e.dx;
            legendDef.changes[id].dy += e.dy;
            const [x, y] = getTranslateFromTransform(draggingElem);
            setTransformTranslate(draggingElem, `translate(${x + e.dx} ${y + e.dy})`);
            saveFunc();
        })
        .on('start', (e) => {
            if (e.sourceEvent.target == legendTitle.node() || e.sourceEvent.target.parentNode == legendTitle.node()) {
                draggingElem = legendTitle.node();
            }
            else draggingElem = legendGroup.node();
        })
    );
    const legendEntries = legendGroup.selectAll('g').data(colors).join('g')
        .attr('transform', (d, i) => {
            const x = computeX();
            const y = computeY(i);
            return `translate(${x} ${y})`;
        });
    const canBeOnLeft = isCategorical || legendDef.direction === 'v';
    const getX = (index, isRect = false) => {
        if (canBeOnLeft && legendDef.labelOnLeft) {
            if (isRect) return maxLabelWidth + 5;
            return maxLabelWidth - labelWidths[index];
        }
        if (isRect) return 0;
        return (!isCategorical && horizontal) ? 0 : legendDef.rectWidth + 5
    };
    legendEntries.append('rect')
        .attr('x', (_, i) => getX(i, true))
        .attr('y', 0)
        .attr('width', legendDef.rectWidth)
        .attr('height', legendDef.rectHeight)
        .attr('fill', d => d[0])
        .attr('stroke', 'black');
    
    legendEntries.append('text')
        .attr('text-anchor', !isCategorical && horizontal ? 'middle' : 'start')
        .attr('dominant-baseline', textBaseline)
        .attr('x', (_, i) => getX(i, false))
        .attr('y', () => (!isCategorical ? (horizontal ? legendDef.rectHeight + 5 : legendDef.rectHeight) : legendDef.rectHeight / 2))
        .text(d => d[1]);
        
    
    if (sampleElem) {
        legendEntries.each(function () {
            reportStyle(sampleElem, d3.select(this).node());
        });
    }
    if (willRerun) {
        let maxWidth = 0;
        legendEntries.each(function () {
            maxWidth = Math.max(maxWidth, d3.select(this).node().getBBox().width);
        });
        legendGroup.remove();
        return drawLegend(legendSelection, legendDef, legendColors, isCategorical, sampleElem, tabName, saveFunc, applyStyles, maxWidth);
    }
    return legendSelection;
}

function getEntryWidths(container, labels, sampleElem) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    if(sampleElem) reportStyle(sampleElem.querySelector('text'), text);
    container.append(text);
    const widths = labels.map(label => {
        text.textContent = label;
        return text.getBoundingClientRect().width;
    });
    text.remove();
    return widths;
}

export { drawLegend };