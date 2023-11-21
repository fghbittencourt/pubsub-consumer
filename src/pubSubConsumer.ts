import { protos, v1 } from '@google-cloud/pubsub';
import { google } from '@google-cloud/pubsub/build/protos/protos';
import { EventEmitter } from 'events';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_POLLING_WAITING_INTERVAL
} from './defaultArguments';
import Logger from './logger/logger';
import PubSubConsumerOpts from './pubSubConsumerOptions';
import pubSubTimeout, { TimeoutError } from './timeoutError';
import { ConsumerEvents, ReceivedMessage } from './types';

export default class PubSubConsumer extends EventEmitter {
  private constructor(options: PubSubConsumerOpts) {
    super();
    this.#subscriptionName = options.subscriptionName;
    this.#handleMessage = options.handleMessage;
    this.#handleMessageTimeout = options.handleMessageTimeout;
    this.#stopped = true;
    this.#batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    this.#pollingWaitIntervalMs =
      options.pollingWaitIntervalMs ?? DEFAULT_POLLING_WAITING_INTERVAL;
    this.#subscriberClient =
      options.subscriberClient || new v1.SubscriberClient();
  }

  // Public
  static create = async (
    options: PubSubConsumerOpts
  ): Promise<PubSubConsumer> => {
    await PubSubConsumer.#assertOptions(options);
    const obj = new PubSubConsumer(options);

    return obj;
  };

  start = async (): Promise<void> => {
    this.emit('started');

    if (this.#stopped) {
      Logger.debug('Starting pubSubConsumer');
      this.#stopped = false;
      await this.#poll();
    }
  };

  stop = async (): Promise<void> => {
    Logger.debug('Stopping pubSubConsumer');
    this.#stopped = true;
  };

  addHandler<T extends keyof ConsumerEvents>(
    event: T,
    handler: (...args: unknown[]) => void
  ): void {
    this.on(event, handler);
  }

  removeHandler<T extends keyof ConsumerEvents>(event: T): void {
    this.removeAllListeners(event);
  }

  // Events
  emit<T extends keyof ConsumerEvents>(
    event: T,
    ...args: ConsumerEvents[T]
  ): boolean {
    return super.emit(event, ...args);
  }

  on<T extends keyof ConsumerEvents>(
    event: T,
    listener: (...args: unknown[]) => void
  ): this {
    return super.on(event, listener);
  }

  once<T extends keyof ConsumerEvents>(
    event: T,
    listener: (...args: unknown[]) => void
  ): this {
    return super.once(event, listener);
  }

  public get isRunning(): boolean {
    return !this.#stopped;
  }

  // Private
  #subscriptionName: string;

  #handleMessage: (message: ReceivedMessage) => Promise<void>;

  #handleMessageTimeout: number | undefined;

  #stopped: boolean;

  #batchSize: number;

  #pollingWaitIntervalMs: number;

  #subscriberClient: v1.SubscriberClient;

  static #assertOptions = async (
    options: PubSubConsumerOpts
  ): Promise<void> => {
    if (!options.subscriptionName) {
      throw new Error('Missing subscriptionName in options');
    }

    if (typeof options.batchSize !== 'undefined') {
      if (options.batchSize > 10 || options.batchSize < 1) {
        throw new Error('BatchSize option must be between 1 and 10');
      }
    }
  };

  #hasMessages = async (
    response: protos.google.pubsub.v1.IPullResponse
  ): Promise<boolean> => {
    return !!response.receivedMessages?.length;
  };

  #poll = async (): Promise<void> => {
    if (this.#stopped) {
      this.emit('stopped');
      return;
    }

    Logger.debug('Polling messages');

    const receiveParams = {
      subscription: this.#subscriptionName,
      maxMessages: this.#batchSize
    };

    try {
      const response = await this.#pullMessages(receiveParams);

      await this.#handlePubSubResponse(response);
    } catch (error) {
      this.emit('pullingError', error);
    }

    setTimeout(this.#poll, this.#pollingWaitIntervalMs);
  };

  #pullMessages = async (
    request: protos.google.pubsub.v1.IPullRequest
  ): Promise<protos.google.pubsub.v1.IPullResponse> => {
    const [response] = await this.#subscriberClient.pull(request);
    return response;
  };

  #handlePubSubResponse = async (
    response: protos.google.pubsub.v1.IPullResponse
  ): Promise<void> => {
    Logger.debug('Received response', response);

    if (response) {
      if (await this.#hasMessages(response)) {
        await Promise.all(response.receivedMessages!.map(this.#processMessage));

        this.emit('responseProcessed', response);
      } else {
        this.emit('empty');
      }
    }
  };

  #processMessage = async (
    message: google.pubsub.v1.IReceivedMessage
  ): Promise<void> => {
    this.emit('messageReceived', message);

    try {
      await this.#executeHandler(message);
      await this.#deleteMessage(message);
      this.emit('messageProcessed', message);
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.emit('timeoutError', error, message);
      }
      if (error instanceof Error) {
        this.emit('processingError', error, message);
      }
      Logger.error('Error processing message', error);
    }
  };

  #executeHandler = async (message: ReceivedMessage): Promise<void> => {
    let pending;
    let timeout;
    try {
      if (this.#handleMessageTimeout) {
        const result = pubSubTimeout(this.#handleMessageTimeout);
        pending = result.pending;
        timeout = result.timeout;

        await Promise.race([this.#handle(message), pending]);
      } else {
        await this.#handle(message);
      }
    } catch (err) {
      if (err instanceof TimeoutError) {
        err.message = `Timeout error: ${err.message}`;
      }
      if (err instanceof Error) {
        err.message = `Unexpected message handler failure: ${err.message}`;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  #handle = async (message: ReceivedMessage): Promise<void> => {
    Logger.debug('Handling message', { messageId: message.message?.messageId });
    await this.#handleMessage(message);
  };

  #deleteMessage = async (message: ReceivedMessage): Promise<void> => {
    Logger.debug('Deleting message %s', message.message?.messageId);

    if (message.ackId) {
      try {
        await this.#subscriberClient.acknowledge({
          subscription: this.#subscriptionName,
          ackIds: [message.ackId]
        });

        Logger.debug(`Message ${message.ackId} deleted`);
      } catch (error) {
        this.emit('deletingError', error, message);
      }
    }
  };
}
