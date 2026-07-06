import { createBar, type Bar, type CreateBarInput } from './Bar';

export interface Section {
  readonly id: string;
  readonly name: string;
  readonly bars: readonly Bar[];
  readonly loop: boolean;
}

export type CreateSectionInput = {
  id: string;
  name: string;
  bars?: readonly Bar[];
  loop?: boolean;
};

export function createSection(input: CreateSectionInput): Section {
  return {
    id: input.id,
    name: input.name,
    bars: input.bars ?? [],
    loop: input.loop ?? false,
  };
}

export function createSectionWithBars(
  id: string,
  name: string,
  barInputs: readonly CreateBarInput[],
  loop = false,
): Section {
  return createSection({
    id,
    name,
    bars: barInputs.map((barInput) => createBar(barInput)),
    loop,
  });
}
