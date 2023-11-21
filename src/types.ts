export interface MessageData {
  data?: string | Uint8Array | null;
  attributes?: { [k: string]: string } | null;
  messageId?: string | null;
}
export interface ReceivedMessage {
  ackId?: string | null;
  message?: MessageData | null;
}
export interface PullResponse {
  receivedMessages?: ReceivedMessage[] | null;
}
export interface ConsumerEvents {
  responseProcessed: [PullResponse];
  empty: [];
  started: [];
  stopped: [];
  messageReceived: [ReceivedMessage];
  messageProcessed: [ReceivedMessage];
  pullingError: [Error];
  timeoutError: [Error, ReceivedMessage];
  processingError: [Error, ReceivedMessage];
  deletingError: [Error, ReceivedMessage];
}
