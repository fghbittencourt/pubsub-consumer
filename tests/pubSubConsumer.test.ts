import { faker } from '@faker-js/faker';
import { v1 } from '@google-cloud/pubsub';
import { once } from 'events';
import PubSubConsumer from '../src/pubSubConsumer';
import { ReceivedMessage } from '../src/types';
import mockedPubSubConsumer from './mockedPubSubConsumer';

describe('PubSubConsumer Testing', () => {
  let pubSubConsumer: v1.SubscriberClient;
  let emptyHandler: (message: ReceivedMessage) => Promise<void>;

  beforeEach(() => {
    pubSubConsumer = mockedPubSubConsumer;
    emptyHandler = jest.fn();
  });

  it('requires a subscriptionName to be set', async () => {
    const opts = {
      subscriptionName: '',
      handleMessage: emptyHandler
    };

    await expect(PubSubConsumer.create(opts)).rejects.toThrow(
      'Missing subscriptionName in options'
    );
  });

  it.each([[0], [11]])(
    'requires to have a batchSize between 1 and 10',
    async testValue => {
      const opts = {
        subscriptionName: faker.datatype.string(),
        handleMessage: emptyHandler,
        batchSize: testValue
      };

      await expect(PubSubConsumer.create(opts)).rejects.toThrow(
        'BatchSize option must be between 1 and 10'
      );
    }
  );

  it('should create a new instance', async () => {
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: emptyHandler
    };

    const result = await PubSubConsumer.create(opts);

    expect(result).toBeInstanceOf(PubSubConsumer);
  });

  it('should start and stop properly', async () => {
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: emptyHandler
    };
    const consumer = await PubSubConsumer.create(opts);

    const bStopped = consumer.isRunning;
    await consumer.start();
    const bStarted = consumer.isRunning;
    await consumer.stop();
    const bStopped2 = consumer.isRunning;

    expect(bStopped).toBeFalsy();
    expect(bStarted).toBeTruthy();
    expect(bStopped2).toBeFalsy();
  });

  it('should handle one message', async () => {
    const response = [
      {
        receivedMessages: [
          {
            ackId: faker.datatype.uuid(),
            message: {
              data: faker.datatype.string(),
              messageId: faker.datatype.uuid()
            }
          }
        ]
      }
    ];
    pubSubConsumer.pull = jest.fn().mockReturnValue(response);
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: emptyHandler,
      subscriberClient: pubSubConsumer
    };
    // Doing explicit cast to access event emitter methods
    const consumer = (await PubSubConsumer.create(opts)) as PubSubConsumer;
    const responseProcessed = once(consumer, 'responseProcessed');

    await consumer.start();
    const [resultResponse] = await Promise.all([responseProcessed]);
    await consumer.stop();

    expect(emptyHandler).toHaveBeenCalledTimes(1);
    expect(resultResponse).toEqual(response);
  });

  it('should handle two messages', async () => {
    const response = [
      {
        receivedMessages: [
          {
            ackId: faker.datatype.uuid(),
            message: {
              data: faker.datatype.string(),
              messageId: faker.datatype.uuid()
            }
          },
          {
            ackId: faker.datatype.uuid(),
            message: {
              data: faker.datatype.string(),
              messageId: faker.datatype.uuid()
            }
          }
        ]
      }
    ];
    pubSubConsumer.pull = jest.fn().mockReturnValue(response);
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: emptyHandler,
      subscriberClient: pubSubConsumer
    };
    // Doing explicit cast to access event emitter methods
    const consumer = (await PubSubConsumer.create(opts)) as PubSubConsumer;
    const responseProcessed = once(consumer, 'responseProcessed');

    await consumer.start();
    const [resultResponse] = await Promise.all([responseProcessed]);
    await consumer.stop();

    expect(emptyHandler).toHaveBeenCalledTimes(2);
    expect(resultResponse).toEqual(response);
  });

  it('should abort an executing handler due to timeout', async () => {
    const response = [
      {
        receivedMessages: [
          {
            ackId: faker.datatype.uuid(),
            message: {
              data: faker.datatype.string(),
              messageId: faker.datatype.uuid()
            }
          }
        ]
      }
    ];
    pubSubConsumer.pull = jest.fn().mockReturnValue(response);
    const tooLongHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
    });
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: tooLongHandler,
      subscriberClient: pubSubConsumer,
      handleMessageTimeout: 500
    };
    // Doing explicit cast to access event emitter methods
    const consumer = (await PubSubConsumer.create(opts)) as PubSubConsumer;
    const responseProcessed = once(consumer, 'responseProcessed');
    const timeoutError = once(consumer, 'timeoutError');

    await consumer.start();
    const [resultResponse, resultError] = await Promise.all([
      responseProcessed,
      timeoutError
    ]);
    await consumer.stop();

    expect(tooLongHandler).toHaveBeenCalledTimes(1);
    expect(resultError).toBeDefined();
    expect(resultResponse).toEqual(response);
  });

  it(`should handle a processing error properly`, async () => {
    const response = [
      {
        receivedMessages: [
          {
            ackId: faker.datatype.uuid(),
            message: {
              data: faker.datatype.string(),
              messageId: faker.datatype.uuid()
            }
          }
        ]
      }
    ];
    pubSubConsumer.pull = jest.fn().mockReturnValue(response);
    const errorHandler = jest
      .fn()
      .mockRejectedValueOnce(new Error('Some handler error'));
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: errorHandler,
      subscriberClient: pubSubConsumer,
      handleMessageTimeout: 500
    };
    // Doing explicit cast to access event emitter methods
    const consumer = (await PubSubConsumer.create(opts)) as PubSubConsumer;
    const responseProcessed = once(consumer, 'responseProcessed');
    const processingError = once(consumer, 'processingError');

    await consumer.start();
    const [resultResponse, resultError] = await Promise.all([
      responseProcessed,
      processingError
    ]);
    await consumer.stop();

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(resultError).toBeDefined();
    expect(resultResponse).toEqual(response);
  });

  it(`should handle a pulling error properly`, async () => {
    pubSubConsumer.pull = jest
      .fn()
      .mockRejectedValue(() => new Error('Some pull error'));
    const opts = {
      subscriptionName: faker.datatype.string(),
      handleMessage: emptyHandler,
      subscriberClient: pubSubConsumer
    };
    // Doing explicit cast to access event emitter methods
    const consumer = (await PubSubConsumer.create(opts)) as PubSubConsumer;
    const pullingError = once(consumer, 'pullingError');

    await consumer.start();
    const [resultError] = await Promise.all([pullingError]);
    await consumer.stop();

    expect(pubSubConsumer.pull).toHaveBeenCalledTimes(1);
    expect(emptyHandler).not.toHaveBeenCalled();
    expect(resultError).toBeDefined();
  });
});
