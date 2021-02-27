/* jshint node: true */
import { BaseController, IStatus } from './BaseController';
import { ZDC_Controller } from './ZDC_Controller';

const axios = require('axios').default;

export class ZDTWO_Controller extends ZDC_Controller {
    constructor(data, log) {
        super(data, log);
    }
    protected async queueRequest(url: string, data: any): Promise<IStatus> {
        try {
            const response = await axios.post({
                url: 'http://' + this.ip + '/IlluminateTheme.json',
                data,
                headers: {
                    'cache-control': 'no-cache'
                }
            })
            let json = JSON.parse(response.data);
            json.StatusStr = this.getStatus(json.Status);
            return json;
        }
        catch (err) {
            // LXTWO was throwing ECONNRESET errors; just ignore them
            this.log.error(`Error putting data for controller ${this.name} to ${url}.json.\n${err}`)
            return { Status: 0, StatusStr: 'Ok' };
        }
    }
}









