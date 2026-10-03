/**
 * Every tunable rule lives here. UI and AI code must read values from a
 * RulesConfig and never hard-code them: the ruleset rests on small tests and
 * is expected to change after the Phase 3 fun check.
 */
export interface RulesConfig {
  /** All four cards of one suit. */
  fullCourt: number;
  /** All four cards of one rank. */
  coup: number;
  /** King + Queen of one suit. */
  marriage: number;
  /** Jack + Ace of one suit. */
  service: number;
  /** Any card in no combination. */
  retainer: number;
  /** Marriage value when the opponent holds that suit's Ace (Deposition). Set equal to `marriage` to disable. */
  deposedMarriage: number;
  /** Service value when the opponent holds that suit's Queen (Service counter). Set equal to `service` to disable. */
  counteredService: number;
  /** Number of grid cells dealt face down. 0 gives the full-information game. */
  faceDown: number;
}

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
  fullCourt: 12,
  coup: 12,
  marriage: 6,
  service: 4,
  retainer: 1,
  deposedMarriage: 0,
  counteredService: 0,
  faceDown: 4,
});

export function rules(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return { ...DEFAULT_RULES, ...overrides };
}

export const depositionOn = (r: RulesConfig): boolean => r.deposedMarriage !== r.marriage;
export const serviceCounterOn = (r: RulesConfig): boolean => r.counteredService !== r.service;
