export type RemotePayment = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
};

export type PaymentGateway = {
  createOrder(input: {
    amount: number;
    currency: "INR";
    receipt: string;
  }): Promise<{ id: string; amount: number; currency: string }>;
  fetchPayment(paymentId: string): Promise<RemotePayment | null>;
  listOrderPayments(orderId: string): Promise<RemotePayment[]>;
  capturePayment(paymentId: string, amount: number): Promise<RemotePayment>;
};
