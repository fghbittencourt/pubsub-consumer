import { v1 } from '@google-cloud/pubsub';
import { ReceivedMessage } from './types';

export default interface PubSubConsumerOpts {
  subscriptionName: string;
  handleMessage(message: ReceivedMessage): Promise<void>;
  stopped?: boolean;
  batchSize?: number;
  handleMessageTimeout?: number;
  pollingWaitTimeMs?: number;
  subscriberClient?: v1.SubscriberClient;
}
