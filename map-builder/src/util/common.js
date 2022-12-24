import Tooltip from 'bootstrap/js/dist/tooltip';
import { formatLocale } from "d3";

function download(content, mimeType, filename) {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}

function downloadURI(uri, filename) {
    var link = document.createElement("a");
    link.setAttribute('download', filename);
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function debounce(func, wait, immediate = false) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

function capitalizeFirstLetter(str) {
    return str[0].toUpperCase() + str.slice(1);
}

function camelCaseToSentence(str) {
    const splitted = str.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return capitalizeFirstLetter(splitted);
}

function htmlToElement(html) {
    if (!html) return;
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function nbDecimals(num) {
    const splited = num.toString().split('.');
    if (splited.length === 1) return 1;
    return num.toString().split('.')[1].length;
}

function indexBy(data, col) {
    return data.reduce((acc, cur) => {
        acc[cur[col]] = cur;
        return acc;
    }, {});
}

function pick(obj, keys) {
    return keys.reduce((picked, curKey) => {
        picked[curKey] = obj[curKey];
        return picked;
    }, {});
}

function sortBy(data, key) {
    if (!data) return;
    return data.sort((a, b) => {
        if (!a || Object.keys(a).length === 0) return 1;
        if (!b || Object.keys(b).length === 0) return -1;
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
    });
}

function getNumericCols(jsonData) {
    const numericCols = new Set(Object.keys(jsonData[0]));
    for (let row of jsonData) {
        if (!numericCols.size) return [];
        Object.entries(row).forEach(([key, value]) => {
            if (numericCols.has(key) && typeof (value) !== 'number') numericCols.delete(key);
        });
    }
    return [...numericCols];
}

function initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => {
        const isHtml = tooltipTriggerEl.hasAttribute('allow-html');
        new Tooltip(tooltipTriggerEl, { placement: 'top', html: isHtml, customClass: isHtml ? 'big-tooltip' : '' })
    });
}

function getBestFormatter(values, locale) {
    const loc = formatLocale(locale);
    const max = Math.max(...values);
    if (max < 10) return format(',.1~f');
    if (max < 1) return format(',.2~f');
    return loc.format(',~d');
}

function tapHold(node, threshold = 300) {
    const handleMouseDown = () => {
        let intervalTimeout;
        const tapTimeout = setTimeout(() => {
            intervalTimeout = setInterval(() => {
                node.dispatchEvent(new CustomEvent('hold'));
            }, 50);
        }, threshold);
        const cancel = () => {
            clearTimeout(tapTimeout);
            if (intervalTimeout) clearInterval(intervalTimeout);
            node.removeEventListener('mousemove', cancel);
            node.removeEventListener('mouseup', cancel);
        };
        node.addEventListener('mousemove', cancel);
        node.addEventListener('mouseup', cancel);
    }

    node.addEventListener('mousedown', handleMouseDown);
    return {
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown);
        }
    };
}

function RGBAToHexA(rgba, forceRemoveAlpha = false) {
    return "#" + rgba.replace(/^rgba?\(|\s+|\)$/g, '') // Get's rgba / rgb string values
      .split(',') // splits them at ","
      .filter((string, index) => !forceRemoveAlpha || index !== 3)
      .map(string => parseFloat(string)) // Converts them to numbers
      .map((number, index) => index === 3 ? Math.round(number * 255) : number) // Converts alpha to 255 number
      .map(number => number.toString(16)) // Converts numbers to hex
      .map(string => string.length === 1 ? "0" + string : string) // Adds 0 when length of one number is 1
      .join("") // Puts the array to togehter to a string
  }

export { download, downloadURI, capitalizeFirstLetter, camelCaseToSentence, nbDecimals, indexBy, sortBy, pick, htmlToElement, debounce, getNumericCols, initTooltips, getBestFormatter, tapHold, RGBAToHexA };