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
  createPattern(hatchString, id, options = {}) {
    const {
      color = this.baseColor,
      size = this.patternSize,
      strokeWidth = this.strokeWidth,
      backgroundColor = 'none'
    } = options;
    
    // Create SVG pattern element
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
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
    for (let char of hatchString) {
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
          this._addDot(pattern, size, color);
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
          this._addCircle(pattern, size, color, strokeWidth, 0.4);
          break;
      }
    }
    
    return pattern;
  }
  
  /**
   * Add a diagonal line to the pattern
   */
  _addDiagonalLine(pattern, size, color, strokeWidth, isForward) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    if (isForward) {
      line.setAttribute('x1', '0');
      line.setAttribute('y1', size);
      line.setAttribute('x2', size);
      line.setAttribute('y2', '0');
    } else {
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', size);
      line.setAttribute('y2', size);
    }
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeWidth);
    pattern.appendChild(line);
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
  _addDot(pattern, size, color) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', size / 2);
    circle.setAttribute('cy', size / 2);
    circle.setAttribute('r', size / 10);
    circle.setAttribute('fill', color);
    pattern.appendChild(circle);
  }
  
  /**
   * Add a circle to the pattern
   */
  _addCircle(pattern, size, color, strokeWidth, scale = 0.25) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', size / 2);
    circle.setAttribute('cy', size / 2);
    circle.setAttribute('r', size * scale);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('fill', 'none');
    pattern.appendChild(circle);
  }
  
  /**
   * Add pattern definitions to the SVG defs element
   * @param {SVGDefsElement} defs - SVG defs element
   * @param {Array} patterns - Array of pattern configs { id, hatch, options }
   */
  addPatternsToSVG(defs, patterns) {
    patterns.forEach(({ id, hatch, options }) => {
      const pattern = this.createPattern(id, hatch, options);
      defs.appendChild(pattern);
    });
  }
  
  /**
   * Create a demo SVG showing all available hatch patterns
   */
  createDemo() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '600');
    svg.setAttribute('height', '400');
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    
    const patterns = [
      { hatch: '/', id: 'hatch-forward-slash' },
      { hatch: '\\', id: 'hatch-backward-slash' },
      { hatch: '-', id: 'hatch-horizontal' },
      { hatch: '|', id: 'hatch-vertical' },
      { hatch: '+', id: 'hatch-plus' },
      { hatch: 'x', id: 'hatch-x' },
      { hatch: '.', id: 'hatch-dots' },
      { hatch: 'o', id: 'hatch-circles' },
      { hatch: '*', id: 'hatch-star' },
      { hatch: 'O', id: 'hatch-large-circles' },
      { hatch: '/-', id: 'hatch-forward-slash-horizontal' },
      { hatch: '/|', id: 'hatch-forward-slash-vertical' },
      { hatch: '\\-', id: 'hatch-backward-slash-horizontal' },
      { hatch: '\\|', id: 'hatch-backward-slash-vertical' },
      { hatch: '/o', id: 'hatch-forward-slash-circles' },
      { hatch: '\\o', id: 'hatch-backward-slash-circles' }
    ];
    
    // Create patterns and add to defs
    patterns.forEach(p => {
      const pattern = this.createPattern(p.hatch, p.id);
      defs.appendChild(pattern);
    });
    
    // Create rectangles to show the patterns
    const rectWidth = 100;
    const rectHeight = 80;
    const cols = 4;
    
    patterns.forEach((p, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', col * (rectWidth + 20) + 20);
      rect.setAttribute('y', row * (rectHeight + 20) + 20);
      rect.setAttribute('width', rectWidth);
      rect.setAttribute('height', rectHeight);
      rect.setAttribute('fill', `url(#${p.id})`);
      rect.setAttribute('stroke', 'black');
      rect.setAttribute('stroke-width', '1');
      
      svg.appendChild(rect);
      
      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', col * (rectWidth + 20) + 20 + rectWidth / 2);
      text.setAttribute('y', row * (rectHeight + 20) + 20 + rectHeight + 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Arial');
      text.setAttribute('font-size', '12');
      text.textContent = p.hatch;
      
      svg.appendChild(text);
    });
    
    return svg;
  }
}

// Usage example
function applyHatchPatterns() {
  const generator = new HatchPatternGenerator();
  
  // Get the SVG element
  const svg = document.querySelector('#mySvg');
  
  // Create defs element if it doesn't exist
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.prepend(defs);
  }
  
  // Create and add patterns
  const patternConfigs = [
    { id: 'pattern1', hatch: '/', options: { color: 'blue', size: 8 } },
    { id: 'pattern2', hatch: 'x', options: { color: 'red', size: 12 } },
    { id: 'pattern3', hatch: 'o.', options: { color: 'green', size: 15 } }
  ];
  
  patternConfigs.forEach(config => {
    const pattern = generator.createPattern(config.hatch, config.id, config.options);
    defs.appendChild(pattern);
  });
  
  // Apply patterns to elements
  document.querySelector('#rect1').setAttribute('fill', 'url(#pattern1)');
  document.querySelector('#rect2').setAttribute('fill', 'url(#pattern2)');
  document.querySelector('#rect3').setAttribute('fill', 'url(#pattern3)');
}

// Create a complete demo page
export function createDemoPage() {
  const generator = new HatchPatternGenerator();
  const demoSvg = generator.createDemo();
  
  // Add to document
  document.body.appendChild(demoSvg);
  
  // Create control panel
  const controls = document.createElement('div');
  controls.style.margin = '20px';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = '/o';
  input.placeholder = 'Enter hatch pattern';
  
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.value = '#000000';
  
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = '5';
  sizeInput.max = '30';
  sizeInput.value = '10';
  
  const button = document.createElement('button');
  button.textContent = 'Apply Custom Pattern';
  
  const customRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  customRect.setAttribute('x', '20');
  customRect.setAttribute('y', '350');
  customRect.setAttribute('width', '560');
  customRect.setAttribute('height', '100');
  customRect.setAttribute('stroke', 'black');
  customRect.setAttribute('stroke-width', '1');
  demoSvg.appendChild(customRect);
  
  button.addEventListener('click', () => {
    const patternId = 'custom-pattern';
    const existingPattern = document.getElementById(patternId);
    if (existingPattern) {
      existingPattern.remove();
    }
    
    const customPattern = generator.createPattern(
      input.value,
      patternId,
      { 
        color: colorPicker.value,
        size: parseInt(sizeInput.value, 10)
      }
    );
    
    const defs = demoSvg.querySelector('defs');
    defs.appendChild(customPattern);
    
    customRect.setAttribute('fill', `url(#${patternId})`);
  });
  
  controls.appendChild(document.createTextNode('Pattern: '));
  controls.appendChild(input);
  controls.appendChild(document.createTextNode(' Color: '));
  controls.appendChild(colorPicker);
  controls.appendChild(document.createTextNode(' Size: '));
  controls.appendChild(sizeInput);
  controls.appendChild(document.createTextNode(' '));
  controls.appendChild(button);
  
  document.body.appendChild(controls);
}