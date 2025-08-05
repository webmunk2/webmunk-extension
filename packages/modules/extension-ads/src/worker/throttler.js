class TimeThrottler {
  constructor(limit, interval) {
      this.limit = limit;               // Number of requests allowed in the interval
      this.interval = interval;         // Time window for throttling (in milliseconds)
      this.timestamps = [];             // Array to store timestamps of made requests
      this.queue = [];                  // Queue to hold pending requests
  }

  _canProcess() {
      const now = Date.now();
      // Remove timestamps that are older than the interval
      this.timestamps = this.timestamps.filter(timestamp => now - timestamp < this.interval);
      return this.timestamps.length < this.limit;
  }

  _processQueue() {
      if (this.queue.length === 0 || !this._canProcess()) {
          return;
      }

      const { request, resolve, reject } = this.queue.shift();
      this.timestamps.push(Date.now());

      request()
          .then(result => {
              resolve(result);
              this._processQueue();
          })
          .catch(error => {
              reject(error);
              this._processQueue();
          });
  }

  add(request) {
      return new Promise((resolve, reject) => {
          this.queue.push({ request, resolve, reject });
          this._processQueue();
      });
  }
}

/* Usage Example:
const throttler = new TimeThrottler(5, 10000);  // Allow 5 requests every 10 seconds

for (let i = 0; i < 20; i++) {
  throttler.add(async () => {
      console.log(`Request ${i} started`);
      await new Promise(r => setTimeout(r, 1000));
      console.log(`Request ${i} finished`);
      return `Result of request ${i}`;
  }).then(result => {
      console.log(result);
  });
}
*/
export default TimeThrottler;