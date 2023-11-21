import { google } from '@google-cloud/pubsub/build/protos/protos';

export default interface ReceivedMessage {
  ackId?: string | null;
  message?: google.pubsub.v1.IPubsubMessage | null;
}
