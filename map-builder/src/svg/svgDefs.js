import * as d3 from "d3";
import bg from '../assets/img/bg.png?inline';
import plaid from '../assets/img/plaid.jpg';

function appendGlow(selection, id="glows", displaySource = false,
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

    // INNER GLOW
    filter.append('feMorphology')
        .attr('in', 'SourceAlpha')
        .attr('radius', innerParams.strength)
        .attr('operator', 'erode')
        .attr('result', 'INNER_ERODED_A');
    filter.append('feComponentTransfer')
        .attr('in', 'INNER_ERODED_A')
        .attr('result', 'INNER_ERODED')
        .append('feFuncA')
            .attr('type', 'linear')
            .attr('slope', '1000')
            .attr('intercept', '0');

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
    if(displaySource) merge.append('feMergeNode').attr('in', 'SourceGraphic');
    merge.append('feMergeNode').attr('in', 'INGLOW');
    filter.append(() => merge.node());

    defs.append(() => filter.node());
}

function appendBgPattern(selection, id, seaColor, backgroundNoise = false, imageSize = 100) {
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs')
    const existing = d3.select(`#${id}`);
    if (!existing.empty()) existing.remove();

    const pattern = defs.append('pattern')
        .attr('id', id)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', imageSize)
        .attr('height', imageSize);
        
    pattern.append('rect')
        .attr('width', imageSize).attr('height', imageSize)
        .attr('fill', seaColor);

    if (backgroundNoise) {
        pattern.append('image')
            .attr('href', bg)
            .attr('x', 0).attr('y', 0)
            .attr('width', imageSize).attr('height', imageSize);
    }
    defs.append(() => pattern.node());
}


function appendClip(selection, width, height, rectRadius) {
    // let defs = selection.select('defs');
    // if (defs.empty()) defs = selection.append('defs')
    const existing = d3.select('#clipMapBorder');
    if (!existing.empty()) existing.remove();
    const clip = selection.append('clipPath')
        .attr('id', "clipMapBorder")
        .attr('clipPathUnits', 'userSpaceOnUse');

    clip.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('rx', rectRadius);
}

function frontFilter(selection) {
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs');
    const filter = defs.append('filter').attr('id', 'front-filter')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

    filter.node().innerHTML = `
    <feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="BG"></feImage>
    <feBlend in="BG" in2="SourceGraphic" mode="multiply" result="BLENDED_TEXT"></feBlend>
    <!-- layer the text on top of the background image -->
    `;
}

function frontFilterOld(selection) {
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs');
    const filter = defs.append('filter').attr('id', 'front-filter')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

    filter.node().innerHTML = `<feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none"></feImage>
    <!-- desaturate the image -->
    <feColorMatrix type="saturate" values="0" result="MAP"></feColorMatrix>
    <!-- decrease level of details so the effect on text is more realistic -->
    
    <!-- use the displacement map to distort the text -->
    <feDisplacementMap in="SourceGraphic" in2="MAP" scale="15" xChannelSelector="R" yChannelSelector="R" result="TEXTURED_TEXT"></feDisplacementMap>
    <!-- add the image as a background behind the text again -->
    <feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="BG"></feImage>
    <feColorMatrix in="TEXTURED_TEXT" result="TEXTURED_TEXT_2" type="matrix" values="1 0 0 0 0 
            0 1 0 0 0 
            0 0 1 0 0 
            0 0 0 .9 0"></feColorMatrix>
    <!--  blend the text with the background image -->
    <feBlend in="BG" in2="TEXTURED_TEXT_2" mode="multiply" result="BLENDED_TEXT"></feBlend>
    <!-- layer the text on top of the background image -->
    <feMerge>
        <feMergeNode in="BG"></feMergeNode>
        <feMergeNode in="BLENDED_TEXT"></feMergeNode>
    </feMerge>`;
}

function frontFilterTest(selection) {
    let defs = selection.select('defs');
    if (defs.empty()) defs = selection.append('defs');
    const filter = defs.append('filter').attr('id', 'front-filter');

    filter.node().innerHTML = `<feImage xlink:href="${plaid}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="IMAGE"></feImage>
    <!-- desaturate the image -->
    <feColorMatrix in="IMAGE" values=".33 .33 .33 0 0
                            .33 .33 .33 0 0
                            .33 .33 .33 0 0
                            0   0   0  0.5 0"
        result="DESATURATED"></feColorMatrix>
    <feComposite in="SourceGraphic" in2="DESATURATED" operator="in"></feComposite>
`;

}

export { appendGlow, appendBgPattern, frontFilter, frontFilterTest, appendClip }; 