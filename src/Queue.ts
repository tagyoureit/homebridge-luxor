// inspiration: https://medium.com/@karenmarkosyan/how-to-manage-promises-into-dynamic-queue-with-vanilla-javascript-9d0d1f8d4df5

export default class Queue {
  static queue = [];
  static pendingPromise = false;
  static workingOnPromise: boolean = false;

   static enqueue(promise):Promise<any> {
    return new Promise(async (resolve, reject) => {
      this.queue.push({
        promise,
        resolve,
        reject,
      });
      await this.dequeue();
    });
  }

  static async dequeue():Promise<any> {
    if (this.workingOnPromise) {
      return false;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    try {
      this.workingOnPromise = true;
      
      let r = await item.promise()

      this.workingOnPromise = false;

      item.resolve(r);
      
    }
    catch (err) {
      this.workingOnPromise = false;
      item.reject(err);
      // await this.dequeue();
    }
    finally { 
      await this.sleep(50); 
      await this.dequeue();
    } 
    return true;
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}