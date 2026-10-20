export const tickets = [
  {
    id: "early-bird",
    name: "Solo - Early Bird",
    price: 10_000,
    description: "Get early access to tickets at a ridiculous discount",
    remaining: 1,
  },
  {
    id: "solo",
    name: "Solo",
    price: 15_000,
    description: "Admits One",
    remaining: 10,
  },
] as const;

export type TicketId = (typeof tickets)[number]["id"];

export const serviceFeeEach = 500;

export function naira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}
