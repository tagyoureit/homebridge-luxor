"use strict";
// inspiration: https://medium.com/@karenmarkosyan/how-to-manage-promises-into-dynamic-queue-with-vanilla-javascript-9d0d1f8d4df5
Object.defineProperty(exports, "__esModule", { value: true });
class Queue {
    static enqueue(promise) {
        return new Promise(async (resolve, reject) => {
            this.queue.push({
                promise,
                resolve,
                reject,
            });
            await this.dequeue();
        });
    }
    static async dequeue() {
        if (this.workingOnPromise) {
            return false;
        }
        const item = this.queue.shift();
        if (!item) {
            return false;
        }
        try {
            this.workingOnPromise = true;
            let r = await item.promise();
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
exports.default = Queue;
Queue.queue = [];
Queue.pendingPromise = false;
Queue.workingOnPromise = false;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXVldWUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvUXVldWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGlJQUFpSTs7QUFFakksTUFBcUIsS0FBSztJQUt2QixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU87UUFDckIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQzNDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUNkLE9BQU87Z0JBQ1AsT0FBTztnQkFDUCxNQUFNO2FBQ1AsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdkIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPO1FBQ2xCLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3pCLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFDRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDVCxPQUFPLEtBQUssQ0FBQztTQUNkO1FBQ0QsSUFBSTtZQUNGLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7WUFFN0IsSUFBSSxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7WUFFNUIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztZQUU5QixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBRWpCO1FBQ0QsT0FBTyxHQUFHLEVBQUU7WUFDVixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1lBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDakIsd0JBQXdCO1NBQ3pCO2dCQUNPO1lBQ04sTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3JCLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ3RCO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNuQixPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pELENBQUM7O0FBaERILHdCQWlEQztBQWhEUSxXQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ1gsb0JBQWMsR0FBRyxLQUFLLENBQUM7QUFDdkIsc0JBQWdCLEdBQVksS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gaW5zcGlyYXRpb246IGh0dHBzOi8vbWVkaXVtLmNvbS9Aa2FyZW5tYXJrb3N5YW4vaG93LXRvLW1hbmFnZS1wcm9taXNlcy1pbnRvLWR5bmFtaWMtcXVldWUtd2l0aC12YW5pbGxhLWphdmFzY3JpcHQtOWQwZDFmOGQ0ZGY1XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFF1ZXVlIHtcbiAgc3RhdGljIHF1ZXVlID0gW107XG4gIHN0YXRpYyBwZW5kaW5nUHJvbWlzZSA9IGZhbHNlO1xuICBzdGF0aWMgd29ya2luZ09uUHJvbWlzZTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gICBzdGF0aWMgZW5xdWV1ZShwcm9taXNlKTpQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnF1ZXVlLnB1c2goe1xuICAgICAgICBwcm9taXNlLFxuICAgICAgICByZXNvbHZlLFxuICAgICAgICByZWplY3QsXG4gICAgICB9KTtcbiAgICAgIGF3YWl0IHRoaXMuZGVxdWV1ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGRlcXVldWUoKTpQcm9taXNlPGFueT4ge1xuICAgIGlmICh0aGlzLndvcmtpbmdPblByb21pc2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgaXRlbSA9IHRoaXMucXVldWUuc2hpZnQoKTtcbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMud29ya2luZ09uUHJvbWlzZSA9IHRydWU7XG4gICAgICBcbiAgICAgIGxldCByID0gYXdhaXQgaXRlbS5wcm9taXNlKClcblxuICAgICAgdGhpcy53b3JraW5nT25Qcm9taXNlID0gZmFsc2U7XG5cbiAgICAgIGl0ZW0ucmVzb2x2ZShyKTtcbiAgICAgIFxuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLndvcmtpbmdPblByb21pc2UgPSBmYWxzZTtcbiAgICAgIGl0ZW0ucmVqZWN0KGVycik7XG4gICAgICAvLyBhd2FpdCB0aGlzLmRlcXVldWUoKTtcbiAgICB9XG4gICAgZmluYWxseSB7IFxuICAgICAgYXdhaXQgdGhpcy5zbGVlcCg1MCk7IFxuICAgICAgYXdhaXQgdGhpcy5kZXF1ZXVlKCk7XG4gICAgfSBcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBzbGVlcChtcykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgfVxufSJdfQ==