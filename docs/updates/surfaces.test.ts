import { describe, it, expect } from 'vitest';
import {
  lookupBlastRadius,
  INVALID,
  BLAST_RADIUS_MATRIX,
  SURFACES,
  ACTION_TYPES,
} from '../src/surfaces/surfaces.js';

describe('lookupBlastRadius — runtime surface', () => {
  it('runtime + code_change = medium', () => {
    expect(lookupBlastRadius('runtime', 'code_change')).toBe('medium');
  });
  it('runtime + deploy = high', () => {
    expect(lookupBlastRadius('runtime', 'deploy')).toBe('high');
  });
  it('runtime + schema_change = high', () => {
    expect(lookupBlastRadius('runtime', 'schema_change')).toBe('high');
  });
  it('runtime + config_change = medium', () => {
    expect(lookupBlastRadius('runtime', 'config_change')).toBe('medium');
  });
  it('runtime + dependency_update = high', () => {
    expect(lookupBlastRadius('runtime', 'dependency_update')).toBe('high');
  });
  it('runtime + auth_change = critical', () => {
    expect(lookupBlastRadius('runtime', 'auth_change')).toBe('critical');
  });
  it('runtime + payment_change = critical', () => {
    expect(lookupBlastRadius('runtime', 'payment_change')).toBe('critical');
  });
});

describe('lookupBlastRadius — credential surface (Rule 1)', () => {
  it('all pairs on credential surface return INVALID', () => {
    for (const actionType of ACTION_TYPES) {
      expect(
        lookupBlastRadius('dev-build-credential-exposure', actionType),
      ).toBe(INVALID);
    }
  });
});

describe('lookupBlastRadius — dev-build-isolated', () => {
  it('code_change = low', () => {
    expect(lookupBlastRadius('dev-build-isolated', 'code_change')).toBe('low');
  });
  it('config_change = low', () => {
    expect(lookupBlastRadius('dev-build-isolated', 'config_change')).toBe('low');
  });
  it('deploy = INVALID', () => {
    expect(lookupBlastRadius('dev-build-isolated', 'deploy')).toBe(INVALID);
  });
});

describe('lookupBlastRadius — supply chain', () => {
  it('dependency_update = high', () => {
    expect(lookupBlastRadius('dev-build-supply-chain', 'dependency_update')).toBe('high');
  });
  it('code_change = INVALID', () => {
    expect(lookupBlastRadius('dev-build-supply-chain', 'code_change')).toBe(INVALID);
  });
});

describe('matrix completeness', () => {
  it('every (Surface, ActionType) pair has a defined entry', () => {
    for (const surface of SURFACES) {
      for (const actionType of ACTION_TYPES) {
        const entry = BLAST_RADIUS_MATRIX[surface][actionType];
        expect(entry).toBeDefined();
      }
    }
  });
});
