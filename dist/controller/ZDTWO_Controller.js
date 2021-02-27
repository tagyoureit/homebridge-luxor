"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZDTWO_Controller = void 0;
const ZDC_Controller_1 = require("./ZDC_Controller");
const axios = require('axios').default;
class ZDTWO_Controller extends ZDC_Controller_1.ZDC_Controller {
    constructor(data, log) {
        super(data, log);
    }
    async queueRequest(url, data) {
        try {
            const response = await axios.post({
                url: 'http://' + this.ip + '/IlluminateTheme.json',
                data,
                headers: {
                    'cache-control': 'no-cache'
                }
            });
            let json = JSON.parse(response.data);
            json.StatusStr = this.getStatus(json.Status);
            return json;
        }
        catch (err) {
            // LXTWO was throwing ECONNRESET errors; just ignore them
            this.log.error(`Error putting data for controller ${this.name} to ${url}.json.\n${err}`);
            return { Status: 0, StatusStr: 'Ok' };
        }
    }
}
exports.ZDTWO_Controller = ZDTWO_Controller;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWkRUV09fQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb250cm9sbGVyL1pEVFdPX0NvbnRyb2xsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEscURBQWtEO0FBRWxELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFFdkMsTUFBYSxnQkFBaUIsU0FBUSwrQkFBYztJQUNoRCxZQUFZLElBQUksRUFBRSxHQUFHO1FBQ2pCLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUNTLEtBQUssQ0FBQyxZQUFZLENBQUMsR0FBVyxFQUFFLElBQVM7UUFDL0MsSUFBSTtZQUNBLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDOUIsR0FBRyxFQUFFLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLHVCQUF1QjtnQkFDbEQsSUFBSTtnQkFDSixPQUFPLEVBQUU7b0JBQ0wsZUFBZSxFQUFFLFVBQVU7aUJBQzlCO2FBQ0osQ0FBQyxDQUFBO1lBQ0YsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM3QyxPQUFPLElBQUksQ0FBQztTQUNmO1FBQ0QsT0FBTyxHQUFHLEVBQUU7WUFDUix5REFBeUQ7WUFDekQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUNBQXFDLElBQUksQ0FBQyxJQUFJLE9BQU8sR0FBRyxXQUFXLEdBQUcsRUFBRSxDQUFDLENBQUE7WUFDeEYsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDO1NBQ3pDO0lBQ0wsQ0FBQztDQUNKO0FBdkJELDRDQXVCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGpzaGludCBub2RlOiB0cnVlICovXG5pbXBvcnQgeyBCYXNlQ29udHJvbGxlciwgSVN0YXR1cyB9IGZyb20gJy4vQmFzZUNvbnRyb2xsZXInO1xuaW1wb3J0IHsgWkRDX0NvbnRyb2xsZXIgfSBmcm9tICcuL1pEQ19Db250cm9sbGVyJztcblxuY29uc3QgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpLmRlZmF1bHQ7XG5cbmV4cG9ydCBjbGFzcyBaRFRXT19Db250cm9sbGVyIGV4dGVuZHMgWkRDX0NvbnRyb2xsZXIge1xuICAgIGNvbnN0cnVjdG9yKGRhdGEsIGxvZykge1xuICAgICAgICBzdXBlcihkYXRhLCBsb2cpO1xuICAgIH1cbiAgICBwcm90ZWN0ZWQgYXN5bmMgcXVldWVSZXF1ZXN0KHVybDogc3RyaW5nLCBkYXRhOiBhbnkpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MucG9zdCh7XG4gICAgICAgICAgICAgICAgdXJsOiAnaHR0cDovLycgKyB0aGlzLmlwICsgJy9JbGx1bWluYXRlVGhlbWUuanNvbicsXG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdjYWNoZS1jb250cm9sJzogJ25vLWNhY2hlJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBsZXQganNvbiA9IEpTT04ucGFyc2UocmVzcG9uc2UuZGF0YSk7XG4gICAgICAgICAgICBqc29uLlN0YXR1c1N0ciA9IHRoaXMuZ2V0U3RhdHVzKGpzb24uU3RhdHVzKTtcbiAgICAgICAgICAgIHJldHVybiBqc29uO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIExYVFdPIHdhcyB0aHJvd2luZyBFQ09OTlJFU0VUIGVycm9yczsganVzdCBpZ25vcmUgdGhlbVxuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoYEVycm9yIHB1dHRpbmcgZGF0YSBmb3IgY29udHJvbGxlciAke3RoaXMubmFtZX0gdG8gJHt1cmx9Lmpzb24uXFxuJHtlcnJ9YClcbiAgICAgICAgICAgIHJldHVybiB7IFN0YXR1czogMCwgU3RhdHVzU3RyOiAnT2snIH07XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuXG5cblxuXG5cblxuXG4iXX0=