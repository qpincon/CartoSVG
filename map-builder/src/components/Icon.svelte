<script>
    export let svg = null;
    export let fillColor = 'currentColor';
    export let strokeColor = 'currentColor';
    export let width = '1rem';
    export let height = width;

    function constructSvg(svg, fillColor, strokeColor, width, height) {
        const styleStr = `style="width: ${width}; height: ${height}; fill: ${fillColor}; stroke: ${strokeColor}"`
        return `${svg.slice(0, 4)} ${styleStr} ${svg.slice(4)}`;
    }
    $: constructedSvg = constructSvg(svg, fillColor, strokeColor, width, height)
</script>

{@html constructedSvg}