import { Study, RESONANCE_ASSESSMENT } from '../lib/study';
const at = '2026-11-15T10:00:00.000Z';
export function fixture(): Study {
  return {
    experiences: ['Physical pain', 'Other uncomfortable physical sensation'],
    primaryLocation: 'Lower back',
    symptomDuration: '3 months or longer',
    associatedSensations: ['Aching', 'Tightness'],
    associatedFeelings: ['Worry', 'Frustration'],
    assessment: RESONANCE_ASSESSMENT,
    protocolVersion: 'physical-targets-2x3-v4',
    consentVersion: 'physical-context-consent-4',
    consentAt: at,
    baseline: { ratings: { 'Physical pain': 6, 'Other uncomfortable physical sensation': 4 }, at },
    reassessments: [],
    firstEye: 'closed',
    allocation: { algorithm: 'test', at },
    rounds: [],
    status: 'active',
  };
}
