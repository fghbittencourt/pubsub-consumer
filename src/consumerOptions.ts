import { v1 } from '@google-cloud/pubsub';
import ReceivedMessage from './receivedMessage';

export interface ConsumerOptions {
  subscriptionName: string;
  stopped?: boolean;
  batchSize?: number;
  handleMessage(message: ReceivedMessage): Promise<void>;
  handleMessageTimeout?: number;
  pollingWaitTimeMs?: number;
  subscriberClient?: v1.SubscriberClient;
}

export const assertOptions = async (
  options: ConsumerOptions
): Promise<void> => {
  if (!options.subscriptionName) {
    throw new Error(`Missing option subscriptionName.`);
  }

  if (!options.handleMessage) {
    throw new Error(`Missing option handleMessage.`);
  }

  if (options.batchSize) {
    if (options.batchSize > 10 || options.batchSize < 1) {
      throw new Error('BatchSize option must be between 1 and 10.');
    }
  }
};
