import type { Color } from "src/types";

/**
 * Creates SVG pattern definitions similar to matplotlib's hatch styles
 */
export class HatchPatternGenerator {
  private ctx: CanvasRenderingContext2D | null;
  private patternScale: number;
  private size: number;
  private strokeWidth: number;
  private baseColor: Color;
  private characterMap: Record<string, (pattern: SVGElement, color: Color, strokeWidth: number) => void>;
  private offsetAccum: number = 0;

  constructor() {
    const canvas = document.createElement("canvas");
    this.ctx = canvas.getContext("2d");
    this.patternScale = 1;
    this.size = 10;
    this.strokeWidth = 3;
    this.baseColor = '#000000';
    // Add ASCII values map for character-based pattern generation
    this.characterMap = {
      "#": this._hashPattern.bind(this),
      "^": this._caretPattern.bind(this),
      "=": this._equalsPattern.bind(this),
      "0": this._createDiamondPattern.bind(this),
      "~": this._createPathPattern.bind(this, 'M0 2.5 Q1.25 0, 2.5 2.5 T5 2.5 T7.5 2.5 T10 2.5 M0 7.5 Q1.25 5, 2.5 7.5 T5 7.5 T7.5 7.5 T10 7.5 M-2.5 2.5 Q-1.25 0, 0 2.5 M10 2.5 Q11.25 0, 12.5 2.5 M-2.5 7.5 Q-1.25 5, 0 7.5 M10 7.5 Q11.25 5, 12.5 7.5'),
      "v": this._createPathPattern.bind(this, 'M0 0 5 5 10 0M0 5 5 10 10 5M-1 9 5 15 11 9M0-5 5 0 10-5'),
      "1": this._createPathPattern.bind(this, 'M0 0 C2.5 2.5, 7.5 2.5, 10 0 C7.5 2.5, 7.5 7.5, 10 10 C7.5 7.5, 2.5 7.5, 0 10 C2.5 7.5, 2.5 2.5, 0 0 Z M-2.5 -2.5 C0 0, 0 0, 0 0 M10 0 C12.5 -2.5, 12.5 -2.5, 12.5 -2.5 M10 10 C12.5 12.5, 12.5 12.5, 12.5 12.5 M0 10 C-2.5 12.5, -2.5 12.5, -2.5 12.5'),
      "2": this._createPathPattern.bind(this, 'M0 5 C2.5 2.5, 7.5 2.5, 10 5 M0 5 C2.5 7.5, 7.5 7.5, 10 5 M5 0 C2.5 2.5, 2.5 7.5, 5 10 M5 0 C7.5 2.5, 7.5 7.5, 5 10 M0 0 C3.3 3.3, 6.7 3.3, 10 0 M0 10 C3.3 6.7, 6.7 6.7, 10 10 M0 0 C3.3 3.3, 3.3 6.7, 0 10 M10 0 C6.7 3.3, 6.7 6.7, 10 10 M-5 5 C-2.5 2.5, 0 2.5, 0 5 M10 5 C12.5 2.5, 15 2.5, 15 5 M5 -5 C2.5 -2.5, 2.5 0, 5 0 M5 10 C2.5 12.5, 2.5 15, 5 15'),
      "3": this._createPathPattern.bind(this, 'M0 2 L2 2 L2 0 M4 0 L4 4 L0 4 M6 0 L6 2 L8 2 L8 0 M10 2 L8 2 M0 6 L2 6 L2 8 L0 8 M0 6 L0 4 M2 8 L2 10 M4 10 L4 6 L6 6 L6 10 M8 10 L8 8 L10 8 M8 8 L6 8 M10 6 L8 6 L8 4 L10 4 M8 4 L6 4 L6 2 L4 2 M-2 2 L0 2 M2 -2 L2 0 M10 10 L8 10 M10 -2 L8 -2 L8 0 M-2 8 L0 8 M-2 -2 L0 -2 L0 0 M10 12 L8 12 L8 10'),
      "4": this._createPathPattern.bind(this, 'M5 0 C6.5 1.5, 8.5 1.5, 10 0 C8.5 1.5, 8.5 3.5, 10 5 C8.5 3.5, 6.5 3.5, 5 5 C6.5 3.5, 6.5 1.5, 5 0 Z M5 5 C6.5 6.5, 8.5 6.5, 10 5 C8.5 6.5, 8.5 8.5, 10 10 C8.5 8.5, 6.5 8.5, 5 10 C6.5 8.5, 6.5 6.5, 5 5 Z M5 0 C3.5 1.5, 1.5 1.5, 0 0 C1.5 1.5, 1.5 3.5, 0 5 C1.5 3.5, 3.5 3.5, 5 5 C3.5 3.5, 3.5 1.5, 5 0 Z M5 5 C3.5 6.5, 1.5 6.5, 0 5 C1.5 6.5, 1.5 8.5, 0 10 C1.5 8.5, 3.5 8.5, 5 10 C3.5 8.5, 3.5 6.5, 5 5 Z M0 0 C-1.5 -1.5, -1.5 -1.5, 0 0 M10 0 C11.5 -1.5, 11.5 -1.5, 10 0 M10 10 C11.5 11.5, 11.5 11.5, 10 10 M0 10 C-1.5 11.5, -1.5 11.5, 0 10'),
      "5": this._createPathPattern.bind(this, 'M0 2.9 L1.67 0 L5 0 L6.67 2.9 L5 5.8 L1.67 5.8 Z M3.33 5.8 L5 8.7 L8.33 8.7 L10 5.8 L8.33 2.9 L5 2.9 Z M10 5.8 L11.67 2.9 L15 2.9 L16.67 5.8 L15 8.7 L11.67 8.7 Z M-3.33 2.9 L-1.67 0 L1.67 0 L3.33 2.9 L1.67 5.8 L-1.67 5.8 Z M-6.67 5.8 L-5 2.9 L-1.67 2.9 L0 5.8 L-1.67 8.7 L-5 8.7 Z M6.67 -2.9 L8.33 -5.8 L11.67 -5.8 L13.33 -2.9 L11.67 0 L8.33 0 Z M0 -5.8 L1.67 -8.7 L5 -8.7 L6.67 -5.8 L5 -2.9 L1.67 -2.9 Z M3.33 11.6 L5 8.7 L8.33 8.7 L10 11.6 L8.33 14.5 L5 14.5 Z M10 11.6 L11.67 8.7 L15 8.7 L16.67 11.6 L15 14.5 L11.67 14.5 Z'),
      "8": this._createCheckerPattern.bind(this),
      "9": this._createRadialPattern.bind(this),
    };
  }

  /**
   * Generate an SVG pattern definition from a matplotlib-style hatch string
   * @param options - Additional options (color, size, etc.)
   * @returns {SVGPatternElement} SVG pattern element
   */
  updateOrCreatePattern(options: {
    hatch: string;
    id: string;
    color?: Color;
    scale?: number;
    strokeWidth?: number;
    backgroundColor?: string;
  }): SVGPatternElement {
    const {
      hatch,
      id,
      color = this.baseColor,
      scale = this.patternScale,
      strokeWidth = this.strokeWidth,
      backgroundColor = 'none',
    } = options;

    let pattern = document.getElementById(id) as SVGPatternElement | null;
    if (pattern) pattern.remove();
    // Create SVG pattern element
    pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', this.size.toString());
    pattern.setAttribute('height', this.size.toString());
    pattern.setAttribute('patternTransform', `scale(${scale})`);

    // If a background color is specified, add it
    if (backgroundColor !== 'none') {
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', this.size.toString());
      background.setAttribute('height', this.size.toString());
      background.setAttribute('fill', backgroundColor);
      pattern.appendChild(background);
    }
    this.offsetAccum = 0;
    // Parse the hatch string and add appropriate elements
    for (const char of hatch) {
      if ('/\\-|+x.oO*'.includes(char)) {
        switch (char) {
          case '/': // Forward diagonal lines
            this._addDiagonalLine(pattern, color, strokeWidth, true);
            break;
          case '\\': // Backward diagonal lines
            this._addDiagonalLine(pattern, color, strokeWidth, false);
            break;
          case '-': // Horizontal lines
            this._addHorizontalLine(pattern, color, strokeWidth);
            break;
          case '|': // Vertical lines
            this._addVerticalLine(pattern, color, strokeWidth);
            break;
          case '+': // Horizontal and vertical lines (grid)
            this._addHorizontalLine(pattern, color, strokeWidth);
            this._addVerticalLine(pattern, color, strokeWidth);
            break;
          case 'x': // Crossed diagonal lines
            this._addDiagonalLine(pattern, color, strokeWidth, true);
            this._addDiagonalLine(pattern, color, strokeWidth, false);
            break;
          case '.': // Dots
            this._addDot(pattern, color, strokeWidth);
            break;
          case 'o': // Circles
            this._addCircle(pattern, color, strokeWidth);
            break;
          case '*': // Stars (combination of + and x)
            this._addDiagonalLine(pattern, color, strokeWidth, true);
            this._addDiagonalLine(pattern, color, strokeWidth, false);
            this._addHorizontalLine(pattern, color, strokeWidth);
            this._addVerticalLine(pattern, color, strokeWidth);
            break;
          case 'O': // Larger circles
            this._addCircle(pattern, color, strokeWidth, 0.3);
            break;
        }
      } else {
        this.createCharacterPattern(char, pattern, color, strokeWidth);
      }
    }

    return pattern;
  }

  /**
 * Add a seamless diagonal line to the pattern that works with any stroke width
 */
  _addDiagonalLine(pattern: SVGElement, color: Color, strokeWidth: number, isForward: boolean) {
    // Calculate the extension needed to ensure seamless tiling
    // We extend the line beyond the pattern boundaries by half the stroke width
    const ext = this.size / 4;

    // Create path instead of line for more control
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Define the path data - extending beyond the pattern boundary in both directions
    let d;
    if (isForward) {
      // Forward diagonal (/) extended in both directions
      d = `M${0} ${this.size} L${this.size} ${0} M${-ext} ${ext} L${ext} ${-ext} M${this.size - ext} ${this.size + ext} L${this.size + ext} ${this.size - ext}`;
    } else {
      // Backward diagonal (\) extended in both directions
      d = `M0 0 L${this.size} ${this.size} M${this.size - ext} ${-ext} L${this.size + ext} ${ext} M${-ext} ${this.size - ext} L${ext} ${this.size + ext}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${strokeWidth}`);
    path.setAttribute('stroke-linecap', 'square'); // Sharp ends for better tiling

    // Ensure the path doesn't create a fill
    path.setAttribute('fill', 'none');

    pattern.appendChild(path);
  }

  /**
   * Add a horizontal line to the pattern
   */
  _addHorizontalLine(pattern: SVGElement, color: Color, strokeWidth: number) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', `${this.size / 2}`);
    line.setAttribute('x2', `${this.size}`);
    line.setAttribute('y2', `${this.size / 2}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', `${strokeWidth}`);
    pattern.appendChild(line);
  }

  /**
   * Add a vertical line to the pattern
   */
  _addVerticalLine(pattern: SVGElement, color: Color, strokeWidth: number) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', `${this.size / 2}`);
    line.setAttribute('y1', '0');
    line.setAttribute('x2', `${this.size / 2}`);
    line.setAttribute('y2', `${this.size}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', `${strokeWidth}`);
    pattern.appendChild(line);
  }

  /**
   * Add a dot to the pattern
   */
  _addDot(pattern: SVGElement, color: Color, strokeWidth: number) {
    this._addCirclePattern(pattern, strokeWidth, color);
  }

  /**
   * Add a circle to the pattern
   */
  _addCircle(pattern: SVGElement, color: Color, strokeWidth: number, scale = 0.18) {
    this._addCirclePattern(pattern, this.size * scale, 'none', color, strokeWidth);
  }

  _addCirclePattern(pattern: SVGElement, radius: number, fillColor?: Color, strokeColor?: Color, strokeWidth?: number) {
    pattern.appendChild(this._createCircle(this.size / 2, this.size / 2, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, this.size, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(this.size, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(this.size, this.size, radius, fillColor, strokeColor, strokeWidth));
  }

  _createCircle(cx: number, cy: number, radius: number, fillColor?: Color, strokeColor?: Color, strokeWidth?: number) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', `${cx}`);
    circle.setAttribute('cy', `${cy}`);
    circle.setAttribute('r', `${radius}`);
    if (fillColor) circle.setAttribute('fill', fillColor);
    if (strokeColor) circle.setAttribute('stroke', strokeColor);
    if (strokeWidth) circle.setAttribute('stroke-width', `${strokeWidth}`);
    return circle;
  }

  addOrUpdatePatternsForSVG(defs: SVGDefsElement, patternDefs) {
    for (const def of patternDefs) {
      const pattern = this.updateOrCreatePattern(def);
      defs.appendChild(pattern);
    }
  }

  /**
   * Creates an SVG pattern from any keyboard character
   * @param {string} char - Any keyboard character
   * @param {SVGElement} pattern - The SVG pattern element
   * @param {string} color - Pattern color
   * @param {number} strokeWidth - Width of strokes
   */
  createCharacterPattern(char: string, pattern: SVGElement, color: Color, strokeWidth: number) {
    // If we have a specific implementation for this character, use it
    if (this.characterMap[char]) {
      this.characterMap[char](pattern, color, strokeWidth);
      return;
    }
    this._createCharPattern(pattern, char, color, strokeWidth);
    // For letters and other characters, use their ASCII code to generate a pattern
  }


  /**
   * Create a zig-zag pattern based on character code
   */
  _createZigZagPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    const frequency = 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    let d = `M0,${this.size / 2}`;
    const step = this.size / (2 * frequency);

    for (let i = 0; i <= frequency; i++) {
      d += ` L${step * (2 * i)},0 L${step * (2 * i + 1)},${this.size}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${strokeWidth}`);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }

  /**
   * Create a radial pattern based on character code
   */
  _createRadialPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    const numLines = 5;
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const radius = this.size / 2;

    for (let i = 0; i < numLines; i++) {
      const angle = (i * 2 * Math.PI) / numLines;
      const endX = centerX + radius * Math.cos(angle);
      const endY = centerY + radius * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', `${centerX}`);
      line.setAttribute('y1', `${centerY}`);
      line.setAttribute('x2', `${endX}`);
      line.setAttribute('y2', `${endY}`);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', `${strokeWidth}`);
      pattern.appendChild(line);
    }
  }

  /**
   * Create a checker pattern based on character code
   */
  _createCheckerPattern(pattern: SVGElement, color: Color) {
    const divisions = 4;
    const cellSize = this.size / divisions;

    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        // Only fill alternating cells
        if ((i + j) % 2 === 0) {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', `${i * cellSize}`);
          rect.setAttribute('y', `${j * cellSize}`);
          rect.setAttribute('width', `${cellSize}`);
          rect.setAttribute('height', `${cellSize}`);
          rect.setAttribute('fill', color);
          pattern.appendChild(rect);
        }
      }
    }
  }


  /**
   * Create a diamond pattern based on character code
   */
  _createDiamondPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const numDiamonds = 4;
    const diamondSize = (this.size * 0.6) / (1 + numDiamonds % 3);

    // Create multiple nested diamonds based on character code

    for (let i = 1; i <= numDiamonds; i++) {
      const currentSize = diamondSize * i;
      const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const points = `
        ${centerX},${centerY - currentSize} 
        ${centerX + currentSize},${centerY} 
        ${centerX},${centerY + currentSize} 
        ${centerX - currentSize},${centerY}
      `;

      diamond.setAttribute('points', points);
      diamond.setAttribute('stroke', color);
      diamond.setAttribute('stroke-width', `${strokeWidth}`);
      diamond.setAttribute('fill', 'none');
      pattern.appendChild(diamond);
    }
  }

  /**
   * Create pattern for hash/pound
   */
  _hashPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    // Create grid pattern with varying spacing
    const gap1 = this.size * 0.33;
    const gap2 = this.size * 0.66;

    // Horizontal lines
    for (let y of [gap1, gap2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', `${y}`);
      line.setAttribute('x2', `${this.size}`);
      line.setAttribute('y2', `${y}`);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', `${strokeWidth}`);
      pattern.appendChild(line);
    }

    // Vertical lines
    for (let x of [gap1, gap2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', `${x}`);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', `${x}`);
      line.setAttribute('y2', `${this.size}`);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', `${strokeWidth}`);
      pattern.appendChild(line);
    }
  }


  /**
   * Create pattern for caret
   */
  _caretPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    // Create multiple caret shapes (^)
    const numCarets = 4;
    const caretSize = this.size / numCarets;

    for (let i = 0; i < numCarets; i++) {
      for (let j = 0; j < numCarets; j++) {
        const x = i * caretSize;
        const y = j * caretSize;

        const caret = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        caret.setAttribute('points', `
          ${x},${y + caretSize * 0.66}
          ${x + caretSize * 0.5},${y + caretSize * 0.33}
          ${x + caretSize},${y + caretSize * 0.66}
        `);
        caret.setAttribute('stroke', color);
        caret.setAttribute('stroke-width', `${strokeWidth}`);
        caret.setAttribute('fill', 'none');
        pattern.appendChild(caret);
      }
    }
  }

  _measureChar(char: string) {
    return this.ctx!.measureText(char);
  }

  _createCharPattern(pattern: SVGElement, char: string, color: Color, strokeWidth: number) {
    const createText = (x: number, y: number) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.innerHTML = char;
      text.setAttribute('x', `${x + this.offsetAccum}`);
      text.setAttribute('y', `${y}`);
      text.setAttribute('stroke-width', `${strokeWidth}`);
      text.setAttribute('fill', color);
      text.setAttribute('stroke', color);
      text.setAttribute('style', `font-size: ${this.size / 2 + 1}px;`);
      return text;
    }
    pattern.appendChild(createText(0, this.size - 3));
    pattern.appendChild(createText(this.size / 2, this.size / 2));
    this.offsetAccum += this._measureChar(char).width + 3;
  }



  _createPathPattern(d: string, pattern: SVGElement, color: Color, strokeWidth: number) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${strokeWidth}`);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }

  /**
   * Create pattern for equals sign
   */
  _equalsPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    // Create alternating horizontal bars
    const numBars = 5;
    const barHeight = this.size / (numBars * 2 - 1);

    for (let i = 0; i < numBars; i++) {
      const y = i * 2 * barHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', `${y}`);
      rect.setAttribute('width', `${this.size}`);
      rect.setAttribute('height', `${barHeight}`);
      rect.setAttribute('fill', color);
      pattern.appendChild(rect);
    }
  }

}
