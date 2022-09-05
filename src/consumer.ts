import { protos, v1 } from '@google-cloud/pubsub';
import { google } from '@google-cloud/pubsub/build/protos/protos';
import autoBind from 'auto-bind';
import { EventEmitter } from 'events';
import { assertOptions, ConsumerOptions } from './consumerOptions';
import TimeoutError from './errors/timeoutError';
import Logger from './logger';
import ReceivedMessage from './receivedMessage';

interface TimeoutResponse {
  timeout: NodeJS.Timeout | undefined;
  pending: Promise<void>;
}

const createTimeout = (duration: number): TimeoutResponse => {
  let timeout: NodeJS.Timeout | undefined;
  const pending = new Promise<void>((_, reject) => {
    timeout = setTimeout((): void => {
      reject(new TimeoutError());
    }, duration);
  });
  return { timeout, pending };
};

const hasMessages = async (
  response: protos.google.pubsub.v1.IPullResponse
): Promise<boolean> => {
  if (response?.receivedMessages?.length) {
    return true;
  }

  return false;
};

interface Events {
  responseProcessed: [];
  empty: [];
  messageReceived: [ReceivedMessage];
  messageProcessed: [ReceivedMessage];
  error: [Error, void | ReceivedMessage | ReceivedMessage[]];
  timeoutError: [Error, ReceivedMessage];
  processingError: [Error, ReceivedMessage];
  stopped: [];
}

export default class Consumer extends EventEmitter {
  private subscriptionName: string;

  private handleMessage: (message: ReceivedMessage) => Promise<void>;

  private handleMessageTimeout: number;

  private stopped: boolean;

  private batchSize: number;

  private pollingWaitTimeMs: number;

  private subscriberClient: v1.SubscriberClient;

  constructor(options: ConsumerOptions) {
    super();
    assertOptions(options);
    this.subscriptionName = options.subscriptionName;
    this.handleMessage = options.handleMessage;
    this.handleMessageTimeout = options.handleMessageTimeout || 20;
    this.stopped = true;
    this.batchSize = options.batchSize || 1;
    this.pollingWaitTimeMs = options.pollingWaitTimeMs ?? 0;

    this.subscriberClient = new v1.SubscriberClient();

    autoBind(this);
  }

  // Factory method
  public static create(options: ConsumerOptions): Consumer {
    return new Consumer(options);
  }

  // Events
  emit<T extends keyof Events>(event: T, ...args: Events[T]): boolean {
    return super.emit(event, ...args);
  }

  on<T extends keyof Events>(
    event: T,
    listener: (...args: unknown[]) => void
  ): this {
    return super.on(event, listener);
  }

  once<T extends keyof Events>(
    event: T,
    listener: (...args: unknown[]) => void
  ): this {
    return super.once(event, listener);
  }

  // Properties
  public get isRunning(): boolean {
    return !this.stopped;
  }

  public start(): void {
    if (this.stopped) {
      Logger.debug('Starting consumer');
      this.stopped = false;
      this.#poll();
    }
  }

  public stop(): void {
    Logger.debug('Stopping consumer');
    this.stopped = true;
  }

  #poll = async (): Promise<void> => {
    if (this.stopped) {
      this.emit('stopped');
      return;
    }

    Logger.debug('Polling for messages');

    const receiveParams = {
      subscription: this.subscriptionName,
      maxMessages: this.batchSize
    };

    const currentPollingTimeout = this.pollingWaitTimeMs;

    try {
      const response = await this.#pullMessages(receiveParams);

      await this.#handlePubSubResponse(response);
    } catch (error) {
      this.emit('error', error);
    }

    setTimeout(this.#poll, currentPollingTimeout);
  };

  #pullMessages = async (
    request: protos.google.pubsub.v1.IPullRequest
  ): Promise<protos.google.pubsub.v1.IPullResponse> => {
    return this.subscriberClient.pull(
      request
    ) as protos.google.pubsub.v1.IPullResponse;
  };

  #handlePubSubResponse = async (
    response: protos.google.pubsub.v1.IPullResponse
  ): Promise<void> => {
    Logger.debug('Received response');
    Logger.debug(response);

    if (response) {
      if (await hasMessages(response)) {
        await Promise.all(response.receivedMessages!.map(this.#processMessage));

        this.emit('responseProcessed');
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
      await this.executeHandler(message);
      await this.deleteMessage(message);
      this.emit('messageProcessed', message);
    } catch (error) {
      this.emit('error', error);
    }
  };

  private async executeHandler(message: ReceivedMessage): Promise<void> {
    let timeout;
    let pending;
    try {
      if (this.handleMessageTimeout) {
        const result = createTimeout(this.handleMessageTimeout);
        timeout = result.timeout;
        pending = result.pending;

        await Promise.race([this.handleMessage(message), pending]);
      } else {
        await this.handleMessage(message);
      }
    } catch (err) {
      if (err instanceof TimeoutError) {
        err.message = `Message handler timed out after ${this.handleMessageTimeout}ms: Operation timed out.`;
      } else if (err instanceof Error) {
        err.message = `Unexpected message handler failure: ${err.message}`;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async deleteMessage(message: ReceivedMessage): Promise<void> {
    Logger.debug('Deleting message %s', message.message?.messageId);

    if (message.ackId) {
      try {
        await this.subscriberClient.acknowledge({
          subscription: this.subscriptionName,
          ackIds: [message.ackId]
        });

        Logger.debug(`Message ${message.ackId} deleted`);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
}
