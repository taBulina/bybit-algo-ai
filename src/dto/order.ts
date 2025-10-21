export interface OrderData {
    orderId: string;
    side: 'Buy' | 'Sell';
    price: number;
    qty: number;
    status: string;
    symbol: string;
    createdTime?: number;
    updatedTime?: number;
}
