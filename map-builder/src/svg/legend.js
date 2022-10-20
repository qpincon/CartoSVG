import * as d3 from "d3";
import { reportStyle } from '../util/dom';

function drawLegend(svg, legendDef, legendColors, isCategorical, sampleElem, entryWidth = legendDef.lineWidth) {
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
    let legendEntries = d3.select('#svg-map-legend');
    if (!legendEntries.empty()) legendEntries.remove();
    const legendSelection = svg.append('g').attr('id', 'svg-map-legend');
    legendSelection
        .attr('transform', `translate(${legendDef.x}, ${legendDef.y ? legendDef.y : svg.node().getBBox().height - 200})`)
        .append('text')
            .attr('x', 0)
            .attr('dy', -20)
            .attr('y', 0)
            .text(legendDef.title);

    legendEntries = legendSelection.selectAll('g').data(legendColors).join('g')
        .attr('id', (d, i) => `text-${i}`)
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
        .attr('y', () => (!isCategorical ? (horizontal ? legendDef.rectHeight + 5 : legendDef.rectHeight) : legendDef.rectHeight / 2 ))
        .text(d => d[1]);
    
    if (willRerun) {
        let maxWidth = 0;
        legendEntries.each( function() {
            console.log(d3.select(this).node().getBBox().width)
            maxWidth = Math.max(maxWidth, d3.select(this).node().getBBox().width);
        })
        return drawLegend(svg, legendDef, legendColors, isCategorical, sampleElem, maxWidth);
    }
    else if (sampleElem) {
        legendEntries.each(function() {
            reportStyle(sampleElem, d3.select(this).node());
        });
    }
    return legendSelection;
}

export { drawLegend };