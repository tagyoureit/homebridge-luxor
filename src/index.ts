require('source-map-support').install();
import { API } from 'homebridge';
import { LuxorPlatform } from './LuxorPlatform';


export = (api: API) => {
    api.registerPlatform("homebridge-luxor", "Luxor", LuxorPlatform);
};
