import { BusinessPaymentMethod, PaymentType } from '@prisma/client';

export function toPersonalPaymentType(
  method: BusinessPaymentMethod,
): PaymentType {
  return method === BusinessPaymentMethod.transfer
    ? PaymentType.debit_card
    : PaymentType.cash;
}
