import { getStroke, type StrokeOptions } from "perfect-freehand";
import type { Color } from "src/types";
const average = (a: number, b: number) => (a + b) / 2

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
type Point = [number, number, number];
export class FreehandDrawer {
    private freehandOptions: StrokeOptions;
    private currentPath: SVGPathElement | null;
    private svg: SVGSVGElement | null;
    private currentGroup: SVGGElement | null;
    private isDrawing: boolean;
    private strokeColor: Color;
    private strokeWidth: number;
    private points: Point[];

    constructor(options: Partial<StrokeOptions> & { strokeColor?: Color; strokeWidth?: number; } = {}) {
        this.svg = null;
        this.currentGroup = null;
        this.isDrawing = false;
        this.points = [];
        this.currentPath = null;
        this.freehandOptions = {
            size: 8,
            smoothing: 0.5,
            thinning: 0.5,
            streamline: 0.5,
            easing: (t) => t,
            start: {
                taper: 0,
                cap: true,
            },
            end: {
                taper: 0,
                cap: true,
            },
            ...options
        };

        // Bind event handlers
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);


        // Stroke styling
        this.strokeColor = options.strokeColor || "#000000";
        this.strokeWidth = options.strokeWidth || 1;
    }

    // Convert perfect-freehand points to SVG path data
    getSvgPathFromStroke(points: Point[]) {
        const len = points.length

        if (len < 4) {
            return ``
        }

        let a = points[0]
        let b = points[1]
        const c = points[2]

        let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
            2
        )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
            b[1],
            c[1]
        ).toFixed(2)} T`

        for (let i = 2, max = len - 1; i < max; i++) {
            a = points[i]
            b = points[i + 1]
            result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
                2
            )} `
        }
        return result;

    }

    // Start listening for drawing events
    start(svgElement: SVGSVGElement) {
        this.svg = svgElement;
        this.currentGroup = document.createElementNS(SVG_NAMESPACE, "g");
        this.svg.append(this.currentGroup);
        this.svg.addEventListener("pointerdown", this.handlePointerDown);
        return this; // For method chaining
    }

    // Stop listening for drawing events
    stop() {
        this.svg!.removeEventListener("pointerdown", this.handlePointerDown);
        document.removeEventListener("pointermove", this.handlePointerMove);
        document.removeEventListener("pointerup", this.handlePointerUp);
        return this.currentGroup;
    }

    // Handle pointer down event
    handlePointerDown(event: PointerEvent) {
        this.isDrawing = true;

        // Get point in SVG coordinates
        const svgPoint = this.getSvgPoint(event);

        // Start a new line with the first point
        this.points = [[svgPoint.x, svgPoint.y, event.pressure || 0.5]];

        // Create new path element
        this.currentPath = document.createElementNS(SVG_NAMESPACE, "path");
        this.currentPath.setAttribute("class", "freehand");
        this.currentPath.setAttribute("fill", this.strokeColor);
        this.currentPath.setAttribute("stroke", "none");
        this.currentGroup!.appendChild(this.currentPath);

        // Add event listeners for move and up events
        document.addEventListener("pointermove", this.handlePointerMove);
        document.addEventListener("pointerup", this.handlePointerUp);
    }

    // Handle pointer move event
    handlePointerMove(event: PointerEvent) {
        if (!this.isDrawing) return;

        // Get point in SVG coordinates
        const svgPoint = this.getSvgPoint(event);

        // Add the point to the current line
        this.points.push([svgPoint.x, svgPoint.y, event.pressure || 0.5]);

        // Update the SVG path
        const freehandPoints = getStroke(this.points, this.freehandOptions) as Point[];
        this.currentPath!.setAttribute("d", this.getSvgPathFromStroke(freehandPoints));
    }

    // Handle pointer up event
    handlePointerUp() {
        this.isDrawing = false;
        this.points = [];
        this.currentPath = null;

        // Remove the event listeners
        document.removeEventListener("pointermove", this.handlePointerMove);
        document.removeEventListener("pointerup", this.handlePointerUp);
    }

    // Convert page coordinates to SVG coordinates
    getSvgPoint(event: PointerEvent) {
        const svgPoint = this.svg!.createSVGPoint();
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;

        // Convert screen coordinates to SVG coordinates
        return svgPoint.matrixTransform(this.svg!.getScreenCTM()?.inverse());
    }

    // Set stroke color
    setColor(color: Color) {
        this.strokeColor = color;
        return this;
    }

    // Set stroke width (size)
    setSize(size: number) {
        this.freehandOptions.size = size;
        return this;
    }

    // Set smoothing
    setSmoothing(value: number) {
        this.freehandOptions.smoothing = value;
        return this;
    }

}
