export type SplitParticipant = string;

export type ItemAllocation = {
  id: string;
  name: string;
  priceCents: number;
  participantId: SplitParticipant;
};

export type SplitOptions = {
  serviceCents?: number;
  taxCents?: number;
};

function distributeByWeights(
  totalCents: number,
  weights: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(weights).filter(
    ([, weight]) => Number.isFinite(weight) && weight > 0,
  );

  if (entries.length === 0) {
    return {};
  }

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const allocations = entries.map(([participant, weight]) => ({
    participant,
    rawShare: (totalCents * weight) / totalWeight,
  }));

  const floored = allocations.map(({ participant, rawShare }) => ({
    participant,
    value: Math.floor(rawShare),
    remainder: rawShare - Math.floor(rawShare),
  }));

  const remainder = totalCents - floored.reduce((sum, item) => sum + item.value, 0);
  floored.sort((a, b) => b.remainder - a.remainder || a.participant.localeCompare(b.participant));

  for (let index = 0; index < remainder; index += 1) {
    floored[index % floored.length].value += 1;
  }

  return Object.fromEntries(floored.map(({ participant, value }) => [participant, value]));
}

export function equalTotal(
  subtotalCents: number,
  participants: SplitParticipant[],
  options: SplitOptions = {},
): Record<string, number> {
  const { serviceCents = 0, taxCents = 0 } = options;
  const total = subtotalCents + serviceCents + taxCents;
  const equalWeights = Object.fromEntries(participants.map((participant) => [participant, 1]));
  return distributeByWeights(total, equalWeights);
}

export function customTotal(
  subtotalCents: number,
  weights: Record<string, number>,
  options: SplitOptions = {},
): Record<string, number> {
  const { serviceCents = 0, taxCents = 0 } = options;
  const total = subtotalCents + serviceCents + taxCents;
  return distributeByWeights(total, weights);
}

export function personTotal(
  items: ItemAllocation[],
  participants: SplitParticipant[],
  options: SplitOptions = {},
): Record<string, number> {
  const { serviceCents = 0, taxCents = 0 } = options;
  const subtotalByParticipant = Object.fromEntries(
    participants.map((participant) => [participant, 0]),
  );

  for (const item of items) {
    const current = subtotalByParticipant[item.participantId] ?? 0;
    subtotalByParticipant[item.participantId] = current + item.priceCents;
  }

  const serviceByParticipant = distributeByWeights(
    serviceCents,
    Object.fromEntries(
      participants.map((participant) => [participant, subtotalByParticipant[participant] ?? 0]),
    ),
  );
  const taxByParticipant = distributeByWeights(
    taxCents,
    Object.fromEntries(
      participants.map((participant) => [participant, subtotalByParticipant[participant] ?? 0]),
    ),
  );

  return Object.fromEntries(
    participants.map((participant) => {
      const itemSubtotal = subtotalByParticipant[participant] ?? 0;
      return [
        participant,
        itemSubtotal +
          (serviceByParticipant[participant] ?? 0) +
          (taxByParticipant[participant] ?? 0),
      ];
    }),
  );
}
