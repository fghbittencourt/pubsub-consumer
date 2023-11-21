import { v1 } from '@google-cloud/pubsub';
import { ReceivedMessage } from './types';

export default interface PubSubConsumerOptions {
  subscriptionName: string;
  handleMessage(message: ReceivedMessage): Promise<void>;
  stopped?: boolean;
  batchSize?: number;
  handleMessageTimeout?: number;
  pollingWaitIntervalMs?: number;
  subscriberClient?: v1.SubscriberClient;
}
