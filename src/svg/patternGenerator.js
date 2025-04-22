/**
 * Creates SVG pattern definitions similar to matplotlib's hatch styles
 */
export class HatchPatternGenerator {
  constructor() {
    this.patternSize = 10; // Default pattern size
    this.strokeWidth = 3;
    this.baseColor = '#000000';
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
    if (pattern)pattern.remove();
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

    // Parse the hatch string and add appropriate elements
    for (let char of hatch) {
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
    }

    return  pattern;
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
    pattern.appendChild(this._createCircle(size/2, size/2, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0 , 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0 , size, radius, fillColor, strokeColor, strokeWidth));
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

}