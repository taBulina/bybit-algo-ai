export interface InstrumentInfo {
    symbol: string;
    contractType: string;
    status: string;
    baseCurrency: string;
    quoteCurrency: string;
    priceFilter: {
        minPrice: number;
        maxPrice: number;
        tickSize: number;
    };
    lotSizeFilter: {
        maxOrderQty: number;
        minOrderQty: number;
        qtyStep: number;
    };
    [key: string]: any;
}
