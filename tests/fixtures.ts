import { Study } from '../lib/study';
const at = '2026-11-15T10:00:00.000Z';
export function fixture(): Study {
  return {
    experiences: ['Fear', 'Stress'],
    consentVersion: 'pilot-consent-1',
    consentAt: at,
    baseline: { ratings: { Fear: 6, Stress: 4 }, at },
    reassessments: [],
    firstEye: 'closed',
    allocation: { algorithm: 'test', at },
    rounds: [],
    status: 'active',
  };
}
