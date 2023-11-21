interface TimeoutResponse {
  timeout: NodeJS.Timeout | undefined;
  pending: Promise<void>;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export default (duration: number): TimeoutResponse => {
  let timeout: NodeJS.Timeout | undefined;
  const pending = new Promise<void>((_, reject) => {
    timeout = setTimeout((): void => {
      reject(new TimeoutError('Timeout error'));
    }, duration);
  });
  return { timeout, pending };
};
