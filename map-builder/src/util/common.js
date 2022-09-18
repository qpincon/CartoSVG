function download(content, mimeType, filename) {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}

function capitalizeFirstLetter(str) {
    return str[0].toUpperCase() + str.slice(1);
}

function camelCaseToSentence(str) {
    const splitted = str.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return capitalizeFirstLetter(splitted);
}

function nbDecimals(num) {
    const splited = num.toString().split('.');
    if (splited.length === 1) return 1;
    return num.toString().split('.')[1].length;
}

function sortBy(data, key) {
    if (!data) return;
    return data.sort((a, b) => {
        if (a[key] < b[key]) return -1;
        if (a[key] > b[key]) return  1;
        return 0;
    });
}

export { download, capitalizeFirstLetter, camelCaseToSentence, nbDecimals, sortBy };