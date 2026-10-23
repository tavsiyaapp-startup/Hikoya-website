// What the subscription popup shows — safe to hand to a client component.
export interface PaywallOffer {
  price: string;
  periodDays: number;
  cardNumber: string | null;
  cardType: string | null;
  cardHolder: string | null;
  message: string | null;
  botReady: boolean;
}
