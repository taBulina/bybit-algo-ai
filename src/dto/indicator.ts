export interface Indicator {
    update(timestamp: number, price: number, confirmed?: boolean): void;
    getValue(): any;
    getHistory?(count: number): any[];
}
