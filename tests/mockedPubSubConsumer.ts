import { v1 } from '@google-cloud/pubsub';

const mock = () => ({
  pull: jest.fn(),
  acknowledge: jest.fn()
});

export default mock as unknown as v1.SubscriberClient;
