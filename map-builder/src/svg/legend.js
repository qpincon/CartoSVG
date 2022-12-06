import * as d3 from "d3";
import { reportStyle } from '../util/dom';
import { setTransformTranslate, getTranslateFromTransform } from '../svg/svg';

function drawLegend(legendSelection, legendDef, legendColors, isCategorical, sampleElem, tabName, entryWidth = legendDef.lineWidth) {
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
        .attr('transform', `translate(${legendDef.x + offsetX}, ${offsetY + (legendDef.y ? legendDef.y : 100)})`)

    const legendTitle = legendGroup.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('transform', `translate(${legendDef.changes[titleId].dx}, ${legendDef.changes[titleId].dy -20})`)
        .attr('id', `${tabName}-legend-title`)
        .style('font-size', '20px')
        .text(legendDef.title)
        .on('dblclick', e => {
            let inputVal = legendDef.title;
            const closeInput = () => {
                legendTitle.text(input.value);
                legendDef.title = input.value;
                legendDef.titleChanged = true;
                input.remove();
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
        })
        .on('start', (e) => {
            if (e.sourceEvent.target == legendTitle.node()) {
                draggingElem = legendTitle.node();
            }
            else draggingElem = legendGroup.node();
        })
    );
    const legendEntries = legendGroup.selectAll('g').data(legendColors).join('g')
        .attr('transform', (d, i) => {
            const x = computeX();
            const y = computeY(i);
            return `translate(${x},${y})`;
        });

    legendEntries.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', legendDef.rectWidth)
        .attr('height', legendDef.rectHeight)
        .attr('fill', d => d[0])
        .attr('stroke', 'black');

    legendEntries.append('text')
        .attr('text-anchor', !isCategorical && horizontal ? 'middle' : 'start')
        .attr('dominant-baseline', textBaseline)
        .attr('x', () => !isCategorical && horizontal ? 0 : legendDef.rectWidth + 5)
        .attr('y', () => (!isCategorical ? (horizontal ? legendDef.rectHeight + 5 : legendDef.rectHeight) : legendDef.rectHeight / 2))
        .text(d => d[1]);

    if (willRerun) {
        let maxWidth = 0;
        legendEntries.each(function () {
            maxWidth = Math.max(maxWidth, d3.select(this).node().getBBox().width);
        });
        legendGroup.remove();
        return drawLegend(legendSelection, legendDef, legendColors, isCategorical, sampleElem, tabName, maxWidth);
    }
    else if (sampleElem) {
        legendEntries.each(function () {
            reportStyle(sampleElem, d3.select(this).node());
        });
    }
    return legendSelection;
}

function dragLegendEntry() {

}


export { drawLegend };