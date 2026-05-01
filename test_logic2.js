const tryParse = (val) => {
    let num = 0;
    if (typeof val === 'number') {
       num = val;
    } else {
        let str = String(val).trim();
        str = str.replace(/[^\d.,\-+]/g, '');
        let forcedFormat = 'EU';
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > -1 && lastDot > -1) {
           if (lastComma > lastDot) forcedFormat = 'EU'; else forcedFormat = 'US';
        } else if (lastComma > -1 && lastDot === -1) {
           const parts = str.split(',');
           const afterComma = parts[parts.length - 1];
           if (afterComma.length === 1 || afterComma.length === 2) forcedFormat = 'EU';
        } else if (lastDot > -1 && lastComma === -1) {
           const parts = str.split('.');
           const afterDot = parts[parts.length - 1];
           if (afterDot.length === 1 || afterDot.length === 2) forcedFormat = 'US';
        }
        if (forcedFormat === 'EU') {
             str = str.replace(/\./g, 'TEMP').replace(/,/g, '.').replace(/TEMP/g, '');
        } else {
             str = str.replace(/,/g, '');
        }
        num = parseFloat(str);
    }
    return num;
};
console.log(tryParse('-1.617'));
console.log(tryParse('101.52721'));

