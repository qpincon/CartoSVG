<script lang="ts">
    import type { Color } from "src/types";

    export let svg: string;
    export let fillColor: Color = "currentColor";
    export let strokeColor: Color = "currentColor";
    export let width: string = "1.4rem";
    export let height: string = width;
    export let marginRight: string = "5px";
    export let className = "";

    function constructSvg(svg: string, fillColor: Color, strokeColor: Color, width: string, height: string) {
        const styleStr = `style="width: ${width}; height: ${height}; fill: ${fillColor}; stroke: ${strokeColor}; margin-right: ${marginRight};"`;
        return `${svg.slice(0, 4)} ${styleStr} class="${className}" ${svg.slice(4)}`;
    }
    $: constructedSvg = constructSvg(svg, fillColor, strokeColor, width, height);
</script>

{@html constructedSvg}
