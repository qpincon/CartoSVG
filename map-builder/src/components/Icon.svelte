<script>
    export let svg = null;
    export let fillColor = 'currentColor';
    export let strokeColor = 'currentColor';
    export let width = '1.4rem';
    export let height = width;
    export let marginRight = '5px';

    function constructSvg(svg, fillColor, strokeColor, width, height) {
        const styleStr = `style="width: ${width}; height: ${height}; fill: ${fillColor}; stroke: ${strokeColor}; margin-right: ${marginRight};"`
        return `${svg.slice(0, 4)} ${styleStr} ${svg.slice(4)}`;
    }
    $: constructedSvg = constructSvg(svg, fillColor, strokeColor, width, height)
</script>

{@html constructedSvg}