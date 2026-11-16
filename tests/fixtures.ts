import { Study } from '../lib/study';
const at = '2026-11-15T10:00:00.000Z';
export function fixture(): Study {
  return {
    experiences: ['Physical pain', 'Uncomfortable physical sensation'],
    primaryLocation: 'Lower back',
    associatedFeelings: ['Worry', 'Frustration'],
    protocolVersion: 'physical-targets-2x3-v1',
    consentVersion: 'physical-context-consent-1',
    consentAt: at,
    baseline: { ratings: { 'Physical pain': 6, 'Uncomfortable physical sensation': 4 }, at },
    reassessments: [],
    firstEye: 'closed',
    allocation: { algorithm: 'test', at },
    rounds: [],
    status: 'active',
  };
}
