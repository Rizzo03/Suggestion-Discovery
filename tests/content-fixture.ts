import type { BodyContext } from '../lib/body-context';
export const sampleContext: BodyContext = {
  primaryLocation: 'Lower back',
  associatedFeelings: ['Worry', 'Frustration'],
};
export const contentFixture = () => ({
  sensory_discriminative: {
    goal: 'Explore possible softer, less intense sensation in the lower back',
    direct:
      'Your lower back can have sensations with boundaries that are easier to notice when attention rests there gently without needing to make a judgement about it. You can pause whenever you wish, while considering the pressure and the extent of the sensation without needing to judge either one. Notice the possibility of those sensory qualities softening within the selected area.',
    imagery:
      'Imagine your lower back feeling gently warm, with the sensation occupying a smaller area than before while remaining aware of the physical area you selected. You can stop imagining whenever you wish, keeping the focus on the physical temperature, pressure and boundaries of the sensation itself. Imagine its pressure easing while the edges become less distinct within that area.',
    metaphorical:
      'The sensation in your lower back can be compared with a patch of weather passing across a familiar landscape. You can set this comparison aside whenever you wish, while considering the strength and extent of that weather across the area at a pace that suits you. Picture the weather gradually becoming milder, with its force settling over a smaller patch.',
  },
  affective_motivational: {
    goal: 'Explore agency in responding to discomfort in the lower back',
    direct:
      'Your lower back can feel uncomfortable while you retain a choice about how to respond to its presence. Notice any worry or frustration without deciding that either feeling has to disappear before you can respond in a way that feels appropriate for you. You can pause this listening experience whenever you wish, without judging the choice you make. Allow a sense of agency in choosing a patient response to the discomfort.',
    imagery:
      'Imagine your lower back feeling uncomfortable while you respond with a sense of choice about what happens next. Imagine acknowledging any frustration without requiring that feeling to disappear or deciding that it explains the discomfort or determines the next response you choose to make. You can stop imagining whenever you wish, and no particular emotional response is required. Imagine choosing a patient, willing response to the discomfort while keeping that sense of agency.',
    metaphorical:
      'Responding to discomfort in your lower back can be compared with carrying a bag that you did not choose. The burden can be acknowledged without deciding that it defines you or determines every response available to you in the present moment or during this listening experience. You can set aside this comparison whenever you wish, keeping your choices your own. Let the comparison suggest greater willingness and agency in responding to the burden.',
  },
});
