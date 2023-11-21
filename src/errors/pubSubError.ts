export default class PubSubError extends Error {
  code: string;

  time: Date;

  retryable: boolean;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.retryable = false;
    this.time = new Date();
  }
}
