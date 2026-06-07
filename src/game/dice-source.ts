import { withRollProvider, SuppliedRollProvider, NeedRoll } from 'dnd-srd-engine';

// Where a planning call's dice come from. Seeded uses the engine's RNG (the
// default, used for daily runs and the enemy). Supplied asks the player for
// each die, via the engine's die-typed roll seam and a resumable-prefix
// replay: attempt the plan, and when it needs a die it does not have, prompt
// the player, append the value, and re-attempt (same prefix re-draws the same
// earlier dice and advances exactly one more). Player-actions only.

export type RollChoice = { kind: 'value'; value: number } | { kind: 'app'; rest: boolean };

// Asks the player for one die roll (the die's side count + what it is for),
// resolving with their value, or a request to let the app roll instead.
export type AskForRoll = (die: number, context: string | undefined) => Promise<RollChoice>;

export interface DiceSource {
  resolve<T>(plan: () => T): Promise<T>;
}

export class SeededDiceSource implements DiceSource {
  async resolve<T>(plan: () => T): Promise<T> {
    return plan();
  }
}

export class ManualDiceSource implements DiceSource {
  private optedOut = false;

  constructor(private readonly ask: AskForRoll) {}

  async resolve<T>(plan: () => T): Promise<T> {
    if (this.optedOut) return plan();
    const queue: number[] = [];
    for (;;) {
      try {
        return withRollProvider(new SuppliedRollProvider([...queue]), plan);
      } catch (error) {
        if (!(error instanceof NeedRoll)) throw error;
        const choice = await this.ask(error.die, error.context);
        if (choice.kind === 'value') {
          queue.push(choice.value);
          continue;
        }
        // The player chose the app's dice; opt out for the rest of the duel
        // if asked, and let the engine roll this action.
        if (choice.rest) this.optedOut = true;
        return plan();
      }
    }
  }
}
