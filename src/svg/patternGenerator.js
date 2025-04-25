/**
 * Creates SVG pattern definitions similar to matplotlib's hatch styles
 */
export class HatchPatternGenerator {
  constructor() {
    const canvas = document.createElement("canvas");
    this.ctx = canvas.getContext("2d");
    this.patternSize = 10; // Default pattern size
    this.strokeWidth = 3;
    this.baseColor = '#000000';
    // Add ASCII values map for character-based pattern generation
    this.characterMap = {
      // Basic punctuation patterns
      "!": this._exclamationPattern.bind(this),
      "@": this._atSignPattern.bind(this),
      "#": this._hashPattern.bind(this),
      "^": this._caretPattern.bind(this),
      "<": this._anglePattern.bind(this),
      ">": this._anglePattern.bind(this),
      "=": this._equalsPattern.bind(this),
      "~": this._wavyPattern.bind(this),
      "0": this._createDiamondPattern.bind(this),
      "2": this._createRadialPattern.bind(this),
      "1": this._createCheckerPattern.bind(this),
    };
  }

  /**
   * Generate an SVG pattern definition from a matplotlib-style hatch string
   * @param {string} hatchString - Matplotlib style hatch pattern (e.g., '/', 'x', '+', etc.)
   * @param {string} id - Unique ID for the SVG pattern
   * @param {object} options - Additional options (color, size, etc.)
   * @returns {SVGPatternElement} SVG pattern element
   */
  updateOrCreatePattern(options = {}) {
    const {
      hatch,
      id,
      color = this.baseColor,
      size = this.patternSize,
      strokeWidth = this.strokeWidth,
      backgroundColor = 'none'
    } = options;

    let pattern = document.getElementById(id);
    if (pattern) pattern.remove();
    // Create SVG pattern element
    pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', size);
    pattern.setAttribute('height', size);

    // If a background color is specified, add it
    if (backgroundColor !== 'none') {
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', size);
      background.setAttribute('height', size);
      background.setAttribute('fill', backgroundColor);
      pattern.appendChild(background);
    }

    this.offsetAccum = 0;
    // Parse the hatch string and add appropriate elements
    for (let char of hatch) {
      if ('/\\-|+x.oO*'.includes(char)) {
        switch (char) {
          case '/': // Forward diagonal lines
            this._addDiagonalLine(pattern, size, color, strokeWidth, true);
            break;

          case '\\': // Backward diagonal lines
            this._addDiagonalLine(pattern, size, color, strokeWidth, false);
            break;

          case '-': // Horizontal lines
            this._addHorizontalLine(pattern, size, color, strokeWidth);
            break;

          case '|': // Vertical lines
            this._addVerticalLine(pattern, size, color, strokeWidth);
            break;

          case '+': // Horizontal and vertical lines (grid)
            this._addHorizontalLine(pattern, size, color, strokeWidth);
            this._addVerticalLine(pattern, size, color, strokeWidth);
            break;

          case 'x': // Crossed diagonal lines
            this._addDiagonalLine(pattern, size, color, strokeWidth, true);
            this._addDiagonalLine(pattern, size, color, strokeWidth, false);
            break;

          case '.': // Dots
            this._addDot(pattern, size, color, strokeWidth);
            break;

          case 'o': // Circles
            this._addCircle(pattern, size, color, strokeWidth);
            break;

          case '*': // Stars (combination of + and x)
            this._addDiagonalLine(pattern, size, color, strokeWidth, true);
            this._addDiagonalLine(pattern, size, color, strokeWidth, false);
            this._addHorizontalLine(pattern, size, color, strokeWidth);
            this._addVerticalLine(pattern, size, color, strokeWidth);
            break;

          case 'O': // Larger circles
            this._addCircle(pattern, size, color, strokeWidth, 0.3);
            break;
        }
      } else {
        this.createCharacterPattern(char, pattern, size, color, strokeWidth);
      }
    }

    return pattern;
  }

  /**
 * Add a seamless diagonal line to the pattern that works with any stroke width
 * @param {SVGElement} pattern - The SVG pattern element to add the line to
 * @param {number} size - Size of the pattern tile
 * @param {string} color - Stroke color
 * @param {number} strokeWidth - Width of the stroke
 * @param {boolean} isForward - True for forward slash (/), false for backslash (\)
 */
  _addDiagonalLine(pattern, size, color, strokeWidth, isForward) {
    // Calculate the extension needed to ensure seamless tiling
    // We extend the line beyond the pattern boundaries by half the stroke width
    const ext = size / 4;

    // Create path instead of line for more control
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Define the path data - extending beyond the pattern boundary in both directions
    let d;
    if (isForward) {
      // Forward diagonal (/) extended in both directions
      d = `M${0} ${size} L${size} ${0} M${-ext} ${ext} L${ext} ${-ext} M${size - ext} ${size + ext} L${size + ext} ${size - ext}`;
    } else {
      // Backward diagonal (\) extended in both directions
      d = `M0 0 L${size} ${size} M${size - ext} ${-ext} L${size + ext} ${ext} M${-ext} ${size - ext} L${ext} ${size + ext}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('stroke-linecap', 'square'); // Sharp ends for better tiling

    // Ensure the path doesn't create a fill
    path.setAttribute('fill', 'none');

    pattern.appendChild(path);
  }

  /**
   * Add a horizontal line to the pattern
   */
  _addHorizontalLine(pattern, size, color, strokeWidth) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', size / 2);
    line.setAttribute('x2', size);
    line.setAttribute('y2', size / 2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    pattern.appendChild(line);
  }

  /**
   * Add a vertical line to the pattern
   */
  _addVerticalLine(pattern, size, color, strokeWidth) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', size / 2);
    line.setAttribute('y1', '0');
    line.setAttribute('x2', size / 2);
    line.setAttribute('y2', size);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    pattern.appendChild(line);
  }

  /**
   * Add a dot to the pattern
   */
  _addDot(pattern, size, color, strokeWidth) {
    this._addCirclePattern(pattern, size, strokeWidth, color);
  }

  /**
   * Add a circle to the pattern
   */
  _addCircle(pattern, size, color, strokeWidth, scale = 0.18) {
    this._addCirclePattern(pattern, size, size * scale, 'none', color, strokeWidth);
  }

  _addCirclePattern(pattern, size, radius, fillColor, strokeColor, strokeWidth) {
    pattern.appendChild(this._createCircle(size / 2, size / 2, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, size, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(size, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(size, size, radius, fillColor, strokeColor, strokeWidth));
  }

  _createCircle(cx, cy, radius, fillColor, strokeColor, strokeWidth) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', radius);
    if (fillColor) circle.setAttribute('fill', fillColor);
    if (strokeColor) circle.setAttribute('stroke', strokeColor);
    if (strokeWidth) circle.setAttribute('stroke-width', strokeWidth);
    return circle;
  }




  addOrUpdatePatternsForSVG(defs, patternDefs) {
    for (const def of patternDefs) {
      const pattern = this.updateOrCreatePattern(def);
      defs.appendChild(pattern);
    }
  }

  /**
   * Creates an SVG pattern from any keyboard character
   * @param {string} char - Any keyboard character
   * @param {SVGElement} pattern - The SVG pattern element
   * @param {number} size - Pattern size
   * @param {string} color - Pattern color
   * @param {number} strokeWidth - Width of strokes
   */
  createCharacterPattern(char, pattern, size, color, strokeWidth) {
    // If we have a specific implementation for this character, use it
    if (this.characterMap[char]) {
      this.characterMap[char](pattern, size, color, strokeWidth);
      return;
    }
    this._createCharPattern(pattern, char, size, color, strokeWidth);
    // For letters and other characters, use their ASCII code to generate a pattern
  }


  /**
   * Create a zig-zag pattern based on character code
   */
  _createZigZagPattern(pattern, size, color, strokeWidth) {
    const frequency = 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    let d = `M0,${size / 2}`;
    const step = size / (2 * frequency);

    for (let i = 0; i <= frequency; i++) {
      d += ` L${step * (2 * i)},0 L${step * (2 * i + 1)},${size}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }

  /**
   * Create a radial pattern based on character code
   */
  _createRadialPattern(pattern, size, color, strokeWidth) {
    const numLines = 5;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    for (let i = 0; i < numLines; i++) {
      const angle = (i * 2 * Math.PI) / numLines;
      const endX = centerX + radius * Math.cos(angle);
      const endY = centerY + radius * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', centerX);
      line.setAttribute('y1', centerY);
      line.setAttribute('x2', endX);
      line.setAttribute('y2', endY);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      pattern.appendChild(line);
    }
  }

  /**
   * Create a checker pattern based on character code
   */
  _createCheckerPattern(pattern, size, color) {
    const divisions = 4 ;
    const cellSize = size / divisions;

    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < divisions; j++) {
        // Only fill alternating cells
        if ((i + j) % 2 === 0) {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', i * cellSize);
          rect.setAttribute('y', j * cellSize);
          rect.setAttribute('width', cellSize);
          rect.setAttribute('height', cellSize);
          rect.setAttribute('fill', color);
          pattern.appendChild(rect);
        }
      }
    }
  }


  /**
   * Create a diamond pattern based on character code
   */
  _createDiamondPattern(pattern, size, color, strokeWidth) {
    const centerX = size / 2;
    const centerY = size / 2;
    const numDiamonds = 4;
    const diamondSize = (size * 0.6) / (1 + numDiamonds % 3);

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
      diamond.setAttribute('stroke-width', strokeWidth);
      diamond.setAttribute('fill', 'none');
      pattern.appendChild(diamond);
    }
  }

  /**
   * Create pattern for exclamation mark
   */
  _exclamationPattern(pattern, size, color, strokeWidth) {
    // Create vertical lines with gaps
    for (let i = 0; i < 2; i++) {
      const x = size * (0.33 + i * 0.33);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', size * 0.7);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      pattern.appendChild(line);

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', size * 0.85);
      dot.setAttribute('r', strokeWidth);
      dot.setAttribute('fill', color);
      pattern.appendChild(dot);
    }
  }

  /**
   * Create pattern for at sign
   */
  _atSignPattern(pattern, size, color, strokeWidth) {
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    // Outer circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', centerX);
    circle.setAttribute('cy', centerY);
    circle.setAttribute('r', radius);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('fill', 'none');
    pattern.appendChild(circle);

    // Inner swirl
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `
      M ${centerX + radius * 0.5}, ${centerY}
      a ${radius * 0.5},${radius * 0.5} 0 1,1 0,0.01
      v ${radius * 0.3}
    `);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }

  /**
   * Create pattern for hash/pound
   */
  _hashPattern(pattern, size, color, strokeWidth) {
    // Create grid pattern with varying spacing
    const gap1 = size * 0.33;
    const gap2 = size * 0.66;

    // Horizontal lines
    for (let y of [gap1, gap2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', size);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      pattern.appendChild(line);
    }

    // Vertical lines
    for (let x of [gap1, gap2]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', size);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', strokeWidth);
      pattern.appendChild(line);
    }
  }

  /**
   * Create pattern for dollar sign
   */
  _dollarPattern(pattern, size, color, strokeWidth) {
    // Create S-curve
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `
      M ${size * 0.3},${size * 0.25}
      C ${size * 0.8},${size * 0.1} ${size * 0.2},${size * 0.5} ${size * 0.7},${size * 0.75}
      C ${size * 0.2},${size * 0.9} ${size * 0.8},${size * 0.5} ${size * 0.3},${size * 0.25}
    `);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);

    // Center line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', size / 2);
    line.setAttribute('y1', size * 0.1);
    line.setAttribute('x2', size / 2);
    line.setAttribute('y2', size * 0.9);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    pattern.appendChild(line);
  }

  /**
   * Create pattern for percent sign
   */
  _percentPattern(pattern, size, color, strokeWidth) {
    // Diagonal line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', size * 0.2);
    line.setAttribute('y1', size * 0.8);
    line.setAttribute('x2', size * 0.8);
    line.setAttribute('y2', size * 0.2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    pattern.appendChild(line);

    // Top-right circle
    const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle1.setAttribute('cx', size * 0.7);
    circle1.setAttribute('cy', size * 0.3);
    circle1.setAttribute('r', size * 0.15);
    circle1.setAttribute('stroke', color);
    circle1.setAttribute('stroke-width', strokeWidth);
    circle1.setAttribute('fill', 'none');
    pattern.appendChild(circle1);

    // Bottom-left circle
    const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle2.setAttribute('cx', size * 0.3);
    circle2.setAttribute('cy', size * 0.7);
    circle2.setAttribute('r', size * 0.15);
    circle2.setAttribute('stroke', color);
    circle2.setAttribute('stroke-width', strokeWidth);
    circle2.setAttribute('fill', 'none');
    pattern.appendChild(circle2);
  }

  /**
   * Create pattern for caret
   */
  _caretPattern(pattern, size, color, strokeWidth) {
    // Create multiple caret shapes (^)
    const numCarets = 4;
    const caretSize = size / numCarets;

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
        caret.setAttribute('stroke-width', strokeWidth);
        caret.setAttribute('fill', 'none');
        pattern.appendChild(caret);
      }
    }
  }

  _measureChar(char) {
    return this.ctx.measureText(char);
  }

  _createCharPattern(pattern, char, size, color, strokeWidth) {
    const createText = (x, y) =>  {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.innerHTML = char;
      text.setAttribute('x', x + this.offsetAccum);
      text.setAttribute('y', y);
      text.setAttribute('stroke-width', strokeWidth);
      text.setAttribute('fill', color);
      text.setAttribute('stroke', color);
      return text;
    }
    console.log(this._measureChar(char));
    pattern.appendChild(createText(0, size - 3));
    pattern.appendChild(createText(size/2, size/2));
    this.offsetAccum += this._measureChar(char).width + 3;
  }

  /**
   * Create pattern for ampersand
   */
  _ampersandPattern(pattern, size, color, strokeWidth) {
    // Create a stylized ampersand shape
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `
      M ${size * 0.6},${size * 0.2}
      C ${size * 0.4},${size * 0.1} ${size * 0.2},${size * 0.3} ${size * 0.3},${size * 0.5}
      C ${size * 0.4},${size * 0.7} ${size * 0.2},${size * 0.9} ${size * 0.3},${size * 0.8}
      C ${size * 0.5},${size * 0.6} ${size * 0.7},${size * 0.9} ${size * 0.8},${size * 0.7}
    `);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }


  /**
   * Create pattern for angle brackets
   */
  _anglePattern(pattern, size, color, strokeWidth) {
    // Create chevron pattern
    const chevrons = 3; // Number of nested chevrons

    for (let i = 1; i <= chevrons; i++) {
      const scale = i * 0.25;

      // Left chevron
      const leftChevron = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      leftChevron.setAttribute('points', `
        ${size * (0.5 - scale)},${size * 0.5}
        ${size * (0.5 - scale * 0.5)},${size * (0.5 - scale * 0.5)}
        ${size * (0.5 - scale)},${size * 0.5}
        ${size * (0.5 - scale * 0.5)},${size * (0.5 + scale * 0.5)}
      `);
      leftChevron.setAttribute('stroke', color);
      leftChevron.setAttribute('stroke-width', strokeWidth);
      leftChevron.setAttribute('fill', 'none');
      pattern.appendChild(leftChevron);

      // Right chevron
      const rightChevron = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      rightChevron.setAttribute('points', `
        ${size * (0.5 + scale)},${size * 0.5}
        ${size * (0.5 + scale * 0.5)},${size * (0.5 - scale * 0.5)}
        ${size * (0.5 + scale)},${size * 0.5}
        ${size * (0.5 + scale * 0.5)},${size * (0.5 + scale * 0.5)}
      `);
      rightChevron.setAttribute('stroke', color);
      rightChevron.setAttribute('stroke-width', strokeWidth);
      rightChevron.setAttribute('fill', 'none');
      pattern.appendChild(rightChevron);
    }
  }

  /**
   * Create pattern for equals sign
   */
  _equalsPattern(pattern, size, color, strokeWidth) {
    // Create alternating horizontal bars
    const numBars = 5;
    const barHeight = size / (numBars * 2 - 1);

    for (let i = 0; i < numBars; i++) {
      const y = i * 2 * barHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', y);
      rect.setAttribute('width', size);
      rect.setAttribute('height', barHeight);
      rect.setAttribute('fill', color);
      pattern.appendChild(rect);
    }
  }

  /**
   * Create wavy pattern for tilde
   */
  _wavyPattern(pattern, size, color, strokeWidth) {
    // // Create wavy lines
    const numWaves = 2.5;
    const amplitude = size * 0.15;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    let d = '';
    for (let i = 0; i < 3; i++) {
      const yOffset = i * size / 3;
      d += `M 0,${yOffset + size / 6} `;

      for (let x = 0; x <= size; x += 1) {
        const y = yOffset + size / 6 + amplitude * Math.sin((x / size) * Math.PI * 2 * numWaves);
        d += `${x === 0 ? 'M' : 'L'}${x},${y} `;
      }
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }
}
