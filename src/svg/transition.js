export const transitionCssMacro = `
.animate-transition path, .animate-transition #graticule, .animate-transition #outline, .animate-transition image, .animate-transition text, .animate-transition #points-labels, .animate-transition #svg-map-legend *, .animate-transition #path-images {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}
.animate-transition #graticule, .animate-transition #outline {
    transition-delay: 0.5s;
}
.animate path, .animate rect, .animate circle {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}
.animate text, .animate image, .animate #points-labels, .animate #path-images, .animate #graticule {
    opacity: 0 !important;
}
.animate #frame{
    animation: dash 3s ease 0s forwards;
}
.animate #land path, .animate #paths path, .animate .country-img path {
    animation: dash 3s ease 0.5s forwards;
}
.animate .country, .animate .adm, .animate #svg-map-legend * {
    animation: dash 3s ease 1s forwards;
}


@keyframes dash {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
}
`;

export const transitionCssMicro = `
.animate-transition path, .animate-transition text, .animate-transition #points-labels {
    transition-property: fill-opacity, opacity;
    transition-duration: 1s;
    transition-timing-function: ease;
}

.animate path, .animate #frame {
    stroke-dasharray: 1 !important;
    fill-opacity: 0 !important;
    stroke-dashoffset: 1;
}

.animate #micro .line { stroke-opacity: 0; }
.animate text, .animate #points-labels, .animate #path-images {
    opacity: 0 !important;
}
.animate #frame{
    animation: dash 3.5s ease 0s forwards;
}
.animate #micro .poly {
    animation: dash 2.5s ease 0.5s forwards;
}
.animate #micro .line, .animate #paths path {
    animation: dash 2s ease 1.5s forwards;
}

@keyframes dash {
    from {
        stroke-opacity: 1;
        stroke-dashoffset: 1;
    }
    to {
        stroke-opacity: 1;
        stroke-dashoffset: 0;
    }
}
`