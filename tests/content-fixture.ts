import type { BodyContext } from '../lib/body-context';
export const sampleContext: BodyContext = {
  primaryLocation: 'Lower back',
  associatedFeelings: ['Worry', 'Frustration'],
};
export const contentFixture = () => ({
  sensory_discriminative: {
    goal: 'Explore the perceived boundaries of sensation in the lower back',
    direct:
      'Your lower back can be noticed as an area with changing sensory boundaries. Notice its shape without requiring a change in intensity. You can stop whenever you wish.',
    imagery:
      'Imagine your lower back as an area outlined by a soft line of light. Picture the boundary of that area. Nothing needs to change for you to leave this image.',
    metaphorical:
      'The sensation in your lower back can be compared with a patch of weather. Its perceived edges may have different qualities. You can set aside this comparison whenever you wish.',
  },
  affective_motivational: {
    goal: 'Explore agency in responding to discomfort in the lower back',
    direct:
      'Your lower back can be uncomfortable while you retain a choice about your response. Acknowledge any worry without requiring it to change. You can choose to pause this listening experience.',
    imagery:
      'Imagine your lower back accompanied by an ordinary supportive space around you. Picture having room to choose your response to discomfort. This image does not require any feeling to change.',
    metaphorical:
      'Responding to discomfort in your lower back can be compared with carrying a bag. The burden can be acknowledged while choosing the next response. You can put this comparison aside.',
  },
});
