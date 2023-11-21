import { v1 } from '@google-cloud/pubsub';

export default (): v1.SubscriberClient =>
  ({
    pull: jest.fn(),
    acknowledge: jest.fn()
  } as unknown as v1.SubscriberClient);
