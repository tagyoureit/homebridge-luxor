/* jshint node: true */

import { ILightType } from '../lights/ZD_Light';
import { BaseController, IColorList, IColorListResp, IGroupList, IGroupListResp, IStatus } from './BaseController';
import Queue from "../Queue";
import { group } from 'console';
import { resolve } from 'path';

export class ZDC_Controller extends BaseController {

    constructor(data, log) {
        super(data, log);
    }

    protected processGroupListGet(data: IGroupListResp) {
        // Get the list of light groups from the controller
        // ZDC supports Groups 1-250, Intensity 0-100, Color 0-250 and color wheel 251-26 (no color wheel support here)
        // ZDTWO supports Groups 1-250, Intensity 0-100, Colors 0-250 and color wheel 251-260 (no color wheel support here) & DMX 65535
        if (typeof data.GroupList === 'undefined' || data.GroupList.length === 0) return;
        if (typeof data.GroupList[0] === 'undefined') return;  // shortcut return if we are passed cached (already processed) results
        for (let i = 0; i < data.GroupList.length; i++) {
            let grp = data.GroupList[i];
            if (grp.Colr >= 251) {
                this.log.warn(`A color value of ${grp.Colr} was found for the color of light group ${grp.GroupNumber}.  Values of 251-260 are ColorWheels and 65535 means the controller is under DMX Group control.  Please select a color 0-250 for this group to work in Homebridge.`);
            }
            else {
                let g = this.GroupList[grp.Grp] = typeof this.GroupList[grp.Grp] === 'undefined' ? {} as any : this.GroupList[grp.Grp];
                if (typeof grp.Name !== 'undefined') g.Name = grp.Name;
                if (typeof grp.Grp !== 'undefined') g.GroupNumber = grp.Grp;
                if (typeof grp.Inten !== 'undefined') g.Intensity = grp.Inten;
                if (typeof grp.Colr !== 'undefined') {
                    g.Color = grp.Colr;
                    g.type = typeof grp.Colr === 'undefined' || grp.Colr === 0 ? ILightType.ZD : ILightType.ZDC;
                }
            }
        }
    }

    async ColorListSetAsync(color: number, hue: number, saturation: number): Promise<any> {
        // Same in ZDC/ZDTWO
        var requestData = JSON.stringify({
            // assign the colors in the reverse order of their groups...
            // group 1 = color 250
            // group 2 = color 249
            // etc
            'C': color,
            'Hue': hue,
            'Sat': saturation
        });
        return Queue.enqueue(async () => {
            let status = await this.doRequest('ColorListSet', requestData);
            return status;
        })

        /*         let status = await this.queueRequest('ColorListSet', requestData);
                return status; */
    }
    async ColorListGetAsync(): Promise<IColorList[]> {
        // Same in ZDC/ZDTWO
        if (typeof this.cacheColorList !== 'undefined' && Date.now() - this.cacheColorList < 2000) {
            return (this.ColorList);
        }
        return Queue.enqueue(async () => {
            let data = await this.doRequest('ColorListGet');
            if (data.Status === 0) {
                this.cacheColorList = Date.now();
                this.processColorListGet(data as IColorListResp);
            }
            return this.ColorList;
        })
    }

    async GetColorAsync(color: number): Promise<IColorList> {
        return new Promise(async (resolve, reject): Promise<IColorList> => {
            try {
                await this.ColorListGetAsync();
                for (var colorId in this.ColorList) {
                    if (this.ColorList[colorId].C === color) {
                        resolve(Promise.resolve(this.ColorList[colorId]));
                        return;
                    }
                }
                // We get here if the color isn't found for some reason
                let status = await this.ColorListSetAsync(color, 360, 100);
                if (status.StatusStr === 'Ok') {
                    resolve({
                        "C": color,
                        "Hue": 360,
                        "Sat": 100
                    });
                    return;
                }
                reject(`No valid colors found or available.  Status: ${status.StatusStr}`)
            }
            catch (err) {
                this.log.error(`Error with GetColorAsync: ${err}`);
            }
        })
    }
    execCallbacks(): void {
        super.execCallbacks();
        for (let i = 0; i < this.callbackList.length; i++) {
            let callback = this.callbackList[i];
            try {
                switch (callback.type) {

                    case ILightType.ZDC:
                        if (callback.characteristic.name === this.platform.Characteristic.Hue.name) {
                            for (let i in this.GroupList){ // need to use loop as these are not 0 based indexes
                                if (this.GroupList[i].GroupNumber === callback.index){
                                    for (let j in this.ColorList){ // need to use loop as these are not 0 based indexes
                                        if (this.ColorList[j].C === callback.index){
                                            if (typeof this.ColorList[j].Hue !== 'undefined') callback.fn(this.ColorList[j].Hue);
                                          break;
                                        }
                                      }
                                }
                              }  
                        }
                        if (callback.characteristic.name === this.platform.Characteristic.Saturation.name) {
                            for (let i in this.GroupList){ // need to use loop as these are not 0 based indexes
                                if (this.GroupList[i].GroupNumber === callback.index){
                                    for (let j in this.ColorList){ // need to use loop as these are not 0 based indexes
                                        if (this.ColorList[j].C === callback.index){
                                            if (typeof this.ColorList[j].Sat !== 'undefined') callback.fn(this.ColorList[j].Sat);
                                          break;
                                        }
                                      }
                                }
                              }
                        }
                        break;
                }
            }
            catch (err) {
            }
        }
    }
    async updateLights(force: boolean = false) {
        if (force) {
            this.cacheColorList = undefined;
            this.cacheGroupList = undefined;
            this.cacheThemeList = undefined;
        }
        await this.GroupListGetAsync();
        await this.ThemeListGetAsync();
        await this.ColorListGetAsync();
        this.execCallbacks();
    }
}