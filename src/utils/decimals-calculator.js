"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecimalsByStringValue = exports.getDecimalsByValue = void 0;
// calculates number of decimals in input value
const getDecimalsByValue = (value) => {
    //const val = value.toFixed(20);
    const strValue = value.toString();
    if (strValue.includes('.')) {
        return strValue.split('.')[1].length;
    }
    else {
        return 0;
    }
};
exports.getDecimalsByValue = getDecimalsByValue;
const getDecimalsByStringValue = (value) => {
    //const val = value.toFixed(20);
    if (value.includes('.')) {
        return value.split('.')[1].length;
    }
    else {
        return 0;
    }
};
exports.getDecimalsByStringValue = getDecimalsByStringValue;
