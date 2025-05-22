import { Tooltip } from 'bootstrap';
import { formatLocale } from "d3";

export function download(content: string, mimeType: string, filename: string): void {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}

export function downloadURI(uri: string, filename: string): void {
    const link = document.createElement("a");
    link.setAttribute('download', filename);
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function capitalizeFirstLetter(str: string): string {
    return str[0].toUpperCase() + str.slice(1);
}

export function camelCaseToSentence(str: string): string {
    const splitted = str.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return capitalizeFirstLetter(splitted);
}

export function htmlToElement(html: string): ChildNode | null {
    if (!html) return null;
    const template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

export function nbDecimals(num: number): number {
    const splited = num.toString().split('.');
    if (splited.length === 1) return 1;
    return splited[1].length;
}

export function indexBy<T>(data: T[], col: keyof T): Record<string, T> {
    return data.reduce((acc, cur) => {
        acc[String(cur[col])] = cur;
        return acc;
    }, {} as Record<string, T>);
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    return keys.reduce((picked, curKey) => {
        picked[curKey] = obj[curKey];
        return picked;
    }, {} as Pick<T, K>);
}

export function sortBy<T>(data: T[], key: keyof T): T[] | undefined {
    if (!data) return;
    return data.sort((a, b) => {
        if (!a || Object.keys(a).length === 0) return 1;
        if (!b || Object.keys(b).length === 0) return -1;
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return 1;
        return 0;
    });
}

export function getNumericCols(jsonData: Record<string, any>[]): { column: string; hasNull: boolean }[] {
    const nonNumericoCols = new Set<string>();
    const allCols = new Set<string>();
    const colWithNullOrUndef = new Set<string>();
    for (const row of jsonData) {
        Object.entries(row).forEach(([key, value]) => {
            allCols.add(key);
            const isNullOrUndef = value === undefined || value === null;
            if (isNullOrUndef) colWithNullOrUndef.add(key);
            if (!isNullOrUndef && typeof value !== 'number') nonNumericoCols.add(key);
        });
    }
    return [...allCols].reduce((acc, col) => {
        if (nonNumericoCols.has(col)) return acc;
        acc.push({
            column: col,
            hasNull: colWithNullOrUndef.has(col),
        });
        return acc;
    }, [] as { column: string; hasNull: boolean }[]);
}

export function getColumns(data: Record<string, any>[]): string[] {
    if (!data.length) return [];
    const cols = new Set<string>();
    data.forEach(row => {
        Object.keys(row).forEach(col => cols.add(col));
    });
    return [...cols];
}

export function findProp<T>(propName: string, obj: Iterable<unknown>): any {
    if (propName in obj) return (obj as any)[propName];
    for (const v of Object.values(obj)) {
        if (typeof v === 'object' && v !== null) {
            const found = findProp(propName, v);
            if (found !== undefined) return found;
        }
    }
}

export function initTooltips(): void {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => {
        const isHtml = tooltipTriggerEl.hasAttribute('allow-html');
        new Tooltip(tooltipTriggerEl as HTMLElement, { placement: 'top', html: isHtml, customClass: isHtml ? 'big-tooltip' : '' });
    });
}

export function getBestFormatter(values: number[], locale: any): (n: number) => string {
    const loc = formatLocale(locale);
    const max = Math.max(...values);
    if (max < 10) return loc.format(',.1~f');
    if (max < 1) return loc.format(',.2~f');
    return loc.format(',~d');
}

export function tapHold(node: HTMLElement, threshold = 300): { destroy: () => void } {
    const handleMouseDown = () => {
        let intervalTimeout: NodeJS.Timeout | undefined;
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
    };

    node.addEventListener('mousedown', handleMouseDown);
    return {
        destroy() {
            node.removeEventListener('mousedown', handleMouseDown);
        }
    };
}

export function RGBAToHexA(rgba: string, forceRemoveAlpha = false): string {
    return "#" + rgba.replace(/^rgba?\(|\s+|\)$/g, '') // Get's rgba / rgb string values
        .split(',') // splits them at ","
        .filter((string, index) => !forceRemoveAlpha || index !== 3)
        .map(string => parseFloat(string)) // Converts them to numbers
        .map((number, index) => index === 3 ? Math.round(number * 255) : number) // Converts alpha to 255 number
        .map(number => number.toString(16)) // Converts numbers to hex
        .map(string => string.length === 1 ? "0" + string : string) // Adds 0 when length of one number is 1
        .join(""); // Puts the array together to a string
}

const chars = 'azertyuiopqsdfghjklmwxcvbn-_';
function randomString(length: number): string {
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}
// see https://stackoverflow.com/a/12578281
const cssSelectorRegex = /([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/gm;
// will
// - Generate a unique ID for the map 
// - Replace #static-svg-map with this ID
// - Prefix all selectors from provided CSS with generated ID
export function discriminateCssForExport(cssToTransform: string): { mapId: string; finalCss: string } {
    const id = randomString(10);
    cssToTransform = cssToTransform.replaceAll('#static-svg-map', `#${id}`);
    const replacer = (group: string): string => {
        if (group.includes('animate')) return group;
        if (group.includes(id)) return group;
        if (group.includes('@keyframes') || group.includes('from {') || group.includes('to {')) return group;
        return `#${id} ${group}`;
    };
    let transformed = cssToTransform.replaceAll(cssSelectorRegex, replacer);
    transformed = transformed.replaceAll(/url\("?#(.*?)"?\)/g, (g, capture1) => {
        return `url(#${id}-${capture1})`;
    });
    return { mapId: id, finalCss: transformed };
}