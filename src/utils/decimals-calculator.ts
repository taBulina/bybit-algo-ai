// calculates number of decimals in input value
export const getDecimalsByValue = (value: number): number => {
  //const val = value.toFixed(20);
  const strValue = value.toString();
  if (strValue.includes('.')) {
    return strValue.split('.')[1].length;
  } else {
    return 0;
  }
};

export const getDecimalsByStringValue = (value: string): number => {
  //const val = value.toFixed(20);
  if (value.includes('.')) {
    return value.split('.')[1].length;
  } else {
    return 0;
  }
};