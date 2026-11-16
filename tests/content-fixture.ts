import type { BodyContext } from '../lib/body-context';
export const sampleContext: BodyContext = {
  primaryLocation: 'Lower back',
  associatedFeelings: ['Worry', 'Frustration'],
};
export const contentFixture = () => ({
  sensory_discriminative: {
    goal: 'Explore possible softer, less intense sensation in the lower back',
    direct:
      'Your lower back can be noticed as an area with changing sensory boundaries. You can stop whenever you wish. Notice the possibility of softer sensory qualities within that area.',
    imagery:
      'Imagine your lower back feeling gently warm, with the sensation occupying a smaller area. You can stop imagining whenever you wish. Imagine its pressure easing and its sensory qualities softening.',
    metaphorical:
      'The sensation in your lower back can be compared with a patch of weather. You can set aside this comparison whenever you wish. Picture that weather gradually becoming milder in its strength.',
  },
  affective_motivational: {
    goal: 'Explore agency in responding to discomfort in the lower back',
    direct:
      'Your lower back can be uncomfortable while you retain a choice about your response. Acknowledge any worry without requiring it to change. You can choose to pause this listening experience.',
    imagery:
      'Imagine your lower back feeling uncomfortable while you respond with a sense of choice. Imagine acknowledging any frustration and choosing a patient response to that discomfort. No feeling needs to change, and you can stop whenever you wish.',
    metaphorical:
      'Responding to discomfort in your lower back can be compared with carrying a bag. The burden can be acknowledged while choosing the next response. You can put this comparison aside.',
  },
});
