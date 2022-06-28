"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IControllerType = exports.BaseController = void 0;
const ZD_Light_1 = require("../lights/ZD_Light");
const Queue_1 = __importDefault(require("../Queue"));
const axios = require('axios').default;
class BaseController {
    constructor(data, log) {
        this.log = log;
        this.callbackList = [];
        this.GroupList = [];
        if (typeof data.ip === 'undefined') {
            this.log.debug(`Initializing base controller.`);
            return;
        }
        this.ip = data.ip;
        this.name = data.Controller;
        this.type = data.type;
        this.platform = data.platform;
        this.hideGroups = data.hideGroups;
        this.independentColors = data.independentColors;
        this.commandTimeout = data.commandTimeout || 750;
        log.info(`Assigning ${this.type} Controller to IP ${this.ip}`);
        // this.updateLights();
        setTimeout(async () => { await this.pollController(); }, 30000);
    }
    getStatus(result) {
        switch (result) {
            case 0:
                return ('Ok'); //StatusOk
            case (1):
                return ('Unknown Method'); //StatusUnknownMethod
            case (101):
                return ('Unparseable Request'); //StatusUnparseableRequest
            case (102):
                return ('Invalid Request'); //StatusInvalidRequest
            case (151):
                return ('Color Value Out of Range');
            case (201):
                return ('Precondition Failed'); //StatusPreconditionFailed
            case (202):
                return ('Group Name In Use'); //StatusGroupNameInUse
            case (205):
                return ('Group Number In Use'); //StatusGroupNumberInUse
            case (241):
                return ('Item Does Not Exist'); //StatusThemeIndexOutOfRange
            case (242):
                return ('Bad Group Number'); //StatusThemeIndexOutOfRange
            case (243):
                return ('Theme Index Out Of Range'); //StatusThemeIndexOutOfRange
            case (251):
                return ('Bad Theme Index'); //StatusThemeIndexOutOfRange
            case (252):
                return ('Theme Changes Restricted'); //StatusThemeIndexOutOfRange
            default:
                return ('Unknown status');
        }
    }
    async doRequest(url, data) {
        return new Promise(async (resolve, reject) => {
            try {
                switch (url) {
                    case 'GroupListGet':
                        if (this.hideGroups)
                            return;
                        if (typeof this.cacheGroupList !== 'undefined' && Date.now() - this.cacheGroupList < 2000) {
                            resolve({ Status: 1, StatusStr: 'Cached', GroupList: this.GroupList });
                            return;
                        }
                        break;
                    case 'ThemeListGet':
                        if (typeof this.cacheThemeList !== 'undefined' && Date.now() - this.cacheThemeList < 2000) {
                            resolve({ Status: 1, StatusStr: 'Cached', ThemeList: this.ThemeList });
                            return;
                        }
                        break;
                    case 'ColorListGet':
                        if (typeof this.cacheColorList !== 'undefined' && Date.now() - this.cacheColorList < 2000) {
                            resolve({ Status: 1, StatusStr: 'Cached', ColorList: this.ColorList });
                            return;
                        }
                        break;
                }
                const response = await axios({
                    method: 'post',
                    url: 'http://' + this.ip + '/' + url + '.json',
                    data,
                    headers: {
                        'cache-control': 'no-cache'
                    },
                    timeout: this.commandTimeout
                });
                response.data.StatusStr = this.getStatus(response.data.Status);
                if (response.data.StatusStr !== 'Ok' || response.code === 'ETIMEOUT') {
                    this.log.error(`Controller ${this.name} responded with error ${response.data.StatusStr} to '${url}'`);
                    resolve({ Status: 1, StatusStr: 'Ok', GroupList: this.GroupList || [], ThemeList: this.ThemeList || [], ColorList: this.ColorList || [] });
                }
                else
                    resolve(response.data);
            }
            catch (err) {
                this.log.error(`Error communicating with controller ${this.name}. URL ${url}.json.\n\t${err}`);
                reject(err);
            }
        });
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async IlluminateAllAsync() {
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('IlluminateAll');
            return status;
        });
    }
    async ExtinguishAllAsync() {
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('ExtinguishAll');
            return status;
        });
    }
    async GetGroupAsync(group) {
        if (this.hideGroups)
            return;
        return new Promise(async (resolve, reject) => {
            try {
                await this.GroupListGetAsync();
                for (let i in this.GroupList) {
                    if (this.GroupList[i].GroupNumber === group)
                        return resolve(this.GroupList[i]);
                }
                reject(`No Group Found in GroupGetAsync for group ${group}.\n${JSON.stringify(this.GroupList)}`);
            }
            catch (err) {
                reject(`Error with GetGroupAsync: ${err}`);
                this.log.error(err);
            }
        });
    }
    async GroupListGetAsync() {
        // Get the list of light groups from the controller
        if (typeof this.cacheGroupList !== 'undefined' && Date.now() - this.cacheGroupList < 2000) {
            return (this.GroupList);
        }
        return Queue_1.default.enqueue(async () => {
            let data = await this.doRequest('GroupListGet');
            if (data.Status === 0) {
                this.cacheGroupList = Date.now();
                this.processGroupListGet(data);
            }
            return this.GroupList;
        });
    }
    processGroupListGet(data) {
        // override with ZDC/ZDTWO
        this.GroupList = data.GroupList;
        for (let i in this.GroupList) {
            this.GroupList[i].type = ZD_Light_1.ILightType.ZD;
        }
    }
    async GroupListEditAsync(name, groupNumber, color) {
        // Same in ZDC/ZDTWO
        var requestData = JSON.stringify({
            'Name': name,
            'GroupNumber': groupNumber,
            'Color': color
        });
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('GroupListEdit', requestData);
            return status;
        });
        /*     let status = await this.queueRequest('GroupListEdit', requestData);
            return status; */
    }
    async ThemeListGetAsync() {
        if (typeof this.cacheThemeList !== 'undefined' && Date.now() - this.cacheThemeList < 2000) {
            return (this.ThemeList);
        }
        return Queue_1.default.enqueue(async () => {
            let data = await this.doRequest('ThemeListGet');
            if (data.Status === 0) {
                this.cacheThemeList = Date.now();
                this.processThemeListGet(data);
            }
            return this.ThemeList;
        });
    }
    processThemeListGet(data) {
        this.ThemeList = data.ThemeList;
        for (var i in this.ThemeList) {
            this.ThemeList[i].isOn = this.ThemeList[i].OnOff === 1;
            this.ThemeList[i].type = ZD_Light_1.ILightType.THEME;
        }
    }
    async GetThemeAsync(index) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.ThemeListGetAsync();
                for (let i in this.ThemeList) {
                    if (this.ThemeList[i].ThemeIndex === index)
                        return resolve(this.ThemeList[i]);
                }
                reject(`No Theme Found in ThemeGetAsync for theme ${index}.\n${JSON.stringify(this.ThemeList)}`);
            }
            catch (err) {
                this.log.error(err);
                reject(`Error with GetThemeAsync ${err}`);
            }
        });
    }
    async IlluminateThemeAsync(themeIndex, onOff) {
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('IlluminateTheme', {
                'ThemeIndex': themeIndex,
                'OnOff': onOff
            });
            this.cacheThemeList = undefined;
            setTimeout(async () => { await this.updateLights(); }, 250);
            return status;
        });
    }
    async IlluminateGroupAsync(groupNumber, desiredIntensity) {
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('IlluminateGroup', {
                'GroupNumber': groupNumber,
                'Intensity': desiredIntensity
            });
            return status;
        });
    }
    async ColorListGetAsync() {
        return {};
    }
    async ColorListSetAsync(color, hue, saturation) {
        return {};
    }
    processColorListGet(data) {
        this.ColorList = data.ColorList;
    }
    ;
    async GetColorAsync(color) { return {}; }
    registerCallback(UUID, type, index, characteristic, fn) {
        // look for an existing UUID/characteristic pair and update that if the light attributes get updates
        for (let i = 0; i < this.callbackList.length; i++) {
            let callback = this.callbackList[i];
            if (callback.UUID == UUID && callback.characteristic === characteristic) {
                callback = { UUID, type, index, characteristic, fn };
                return;
            }
        }
        // not found, add a new callback.
        this.callbackList.push({ UUID, type, index, characteristic, fn });
    }
    execCallbacks() {
        for (let i = 0; i < this.callbackList.length; i++) {
            let callback = this.callbackList[i];
            try {
                switch (callback.type) {
                    case ZD_Light_1.ILightType.ZD:
                    case ZD_Light_1.ILightType.ZDC:
                        if (callback.characteristic.name === this.platform.Characteristic.Brightness.name) {
                            for (let i in this.GroupList) { // need to use loop as these are not 0 based indexes
                                if (this.GroupList[i].GroupNumber === callback.index) {
                                    if (typeof this.GroupList[i].Intensity !== 'undefined')
                                        callback.fn(this.GroupList[i].Intensity);
                                    break;
                                }
                            }
                            // let group = this.GroupList.find(g=>g.GroupNumber === callback.index, this.GroupList);
                        }
                        break;
                    case ZD_Light_1.ILightType.THEME:
                        if (callback.characteristic.name === this.platform.Characteristic.On.name) {
                            for (let i in this.GroupList) { // need to use loop as these are not 0 based indexes
                                if (this.ThemeList[i].ThemeIndex === callback.index) {
                                    if (typeof this.ThemeList[i].OnOff !== 'undefined')
                                        callback.fn(this.ThemeList[i].OnOff === 1);
                                    break;
                                }
                            }
                        }
                        break;
                }
            }
            catch (err) {
                this.log.error(`execCallbacks: ${err}`);
            }
        }
    }
    async updateLights(force = false) {
        if (force) {
            this.cacheGroupList = undefined;
            this.cacheThemeList = undefined;
        }
        await this.GroupListGetAsync();
        await this.ThemeListGetAsync();
        this.execCallbacks();
    }
    async pollController() {
        try {
            await this.updateLights();
        }
        catch (err) {
            this.log.error(`${this.name} error: ${err}`);
        }
        finally {
            setTimeout(async () => { await this.pollController(); }, 30 * 1000);
        }
    }
}
exports.BaseController = BaseController;
var IControllerType;
(function (IControllerType) {
    IControllerType["ZD"] = "ZD";
    IControllerType["ZDC"] = "ZDC";
    IControllerType["ZDTWO"] = "ZDTWO";
})(IControllerType = exports.IControllerType || (exports.IControllerType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmFzZUNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlci9CYXNlQ29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFFQSxpREFBZ0Q7QUFFaEQscURBQTZCO0FBRTdCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFFdkMsTUFBYSxjQUFjO0lBZ0J6QixZQUFZLElBQVMsRUFBRSxHQUFRO1FBQzdCLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUE7UUFDbkIsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFLEtBQUssV0FBVyxFQUFFO1lBQ2xDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFDaEQsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM1QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNsQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ2hELElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsSUFBSSxHQUFHLENBQUM7UUFFakQsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLHFCQUFxQixJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FB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LHVCQUFlLFFBRTFCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcmVqZWN0cyB9IGZyb20gXCJhc3NlcnRcIjtcbmltcG9ydCB7IENoYXJhY3RlcmlzdGljLCBMb2dnZXIgfSBmcm9tIFwiaG9tZWJyaWRnZVwiO1xuaW1wb3J0IHsgSUxpZ2h0VHlwZSB9IGZyb20gXCIuLi9saWdodHMvWkRfTGlnaHRcIjtcbmltcG9ydCB7IEx1eG9yUGxhdGZvcm0gfSBmcm9tIFwiLi4vTHV4b3JQbGF0Zm9ybVwiO1xuaW1wb3J0IFF1ZXVlIGZyb20gXCIuLi9RdWV1ZVwiO1xuXG5jb25zdCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJykuZGVmYXVsdDtcblxuZXhwb3J0IGNsYXNzIEJhc2VDb250cm9sbGVyIHtcbiAgcHJvdGVjdGVkIGlwOiBzdHJpbmc7XG4gIHB1YmxpYyBuYW1lOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBoaWRlR3JvdXBzOiBib29sZWFuO1xuICBwcm90ZWN0ZWQgaW5kZXBlbmRlbnRDb2xvcnM6IGJvb2xlYW47XG4gIHByb3RlY3RlZCBsb2c6IExvZ2dlcjtcbiAgcHVibGljIHR5cGU6IElDb250cm9sbGVyVHlwZTtcbiAgcHJvdGVjdGVkIHBsYXRmb3JtOiBMdXhvclBsYXRmb3JtO1xuICBwcm90ZWN0ZWQgR3JvdXBMaXN0OiBJR3JvdXBMaXN0W107XG4gIHByb3RlY3RlZCBjYWNoZUdyb3VwTGlzdDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgQ29sb3JMaXN0OiBJQ29sb3JMaXN0W107XG4gIHByb3RlY3RlZCBjYWNoZUNvbG9yTGlzdDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgVGhlbWVMaXN0OiBJVGhlbWVMaXN0W107XG4gIHByb3RlY3RlZCBjYWNoZVRoZW1lTGlzdDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgY29tbWFuZFRpbWVvdXQ6IG51bWJlcjtcbiAgcHJvdGVjdGVkIGNhbGxiYWNrTGlzdDogeyBVVUlEOiBzdHJpbmcsIHR5cGU6IElMaWdodFR5cGUsIGluZGV4OiBudW1iZXIsIGNoYXJhY3RlcmlzdGljOiBhbnksIGZuOiAoYTogbnVtYmVyIHwgYm9vbGVhbikgPT4ge30gfVtdO1xuICBjb25zdHJ1Y3RvcihkYXRhOiBhbnksIGxvZzogYW55KSB7XG4gICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgdGhpcy5jYWxsYmFja0xpc3QgPSBbXTtcbiAgICB0aGlzLkdyb3VwTGlzdCA9IFtdXG4gICAgaWYgKHR5cGVvZiBkYXRhLmlwID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpcy5sb2cuZGVidWcoYEluaXRpYWxpemluZyBiYXNlIGNvbnRyb2xsZXIuYCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuaXAgPSBkYXRhLmlwO1xuICAgIHRoaXMubmFtZSA9IGRhdGEuQ29udHJvbGxlcjtcbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGU7XG4gICAgdGhpcy5wbGF0Zm9ybSA9IGRhdGEucGxhdGZvcm07XG4gICAgdGhpcy5oaWRlR3JvdXBzID0gZGF0YS5oaWRlR3JvdXBzO1xuICAgIHRoaXMuaW5kZXBlbmRlbnRDb2xvcnMgPSBkYXRhLmluZGVwZW5kZW50Q29sb3JzO1xuICAgIHRoaXMuY29tbWFuZFRpbWVvdXQgPSBkYXRhLmNvbW1hbmRUaW1lb3V0IHx8IDc1MDtcblxuICAgIGxvZy5pbmZvKGBBc3NpZ25pbmcgJHt0aGlzLnR5cGV9IENvbnRyb2xsZXIgdG8gSVAgJHt0aGlzLmlwfWApO1xuICAgIC8vIHRoaXMudXBkYXRlTGlnaHRzKCk7XG4gICAgc2V0VGltZW91dChhc3luYyAoKSA9PiB7IGF3YWl0IHRoaXMucG9sbENvbnRyb2xsZXIoKTsgfSwgMzAwMDApO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldFN0YXR1cyhyZXN1bHQpOiBzdHJpbmcge1xuICAgIHN3aXRjaCAocmVzdWx0KSB7XG4gICAgICBjYXNlIDA6XG4gICAgICAgIHJldHVybiAoJ09rJyk7IC8vU3RhdHVzT2tcbiAgICAgIGNhc2UgKDEpOlxuICAgICAgICByZXR1cm4gKCdVbmtub3duIE1ldGhvZCcpOyAvL1N0YXR1c1Vua25vd25NZXRob2RcbiAgICAgIGNhc2UgKDEwMSk6XG4gICAgICAgIHJldHVybiAoJ1VucGFyc2VhYmxlIFJlcXVlc3QnKTsgLy9TdGF0dXNVbnBhcnNlYWJsZVJlcXVlc3RcbiAgICAgIGNhc2UgKDEwMik6XG4gICAgICAgIHJldHVybiAoJ0ludmFsaWQgUmVxdWVzdCcpOyAvL1N0YXR1c0ludmFsaWRSZXF1ZXN0XG4gICAgICBjYXNlICgxNTEpOlxuICAgICAgICByZXR1cm4gKCdDb2xvciBWYWx1ZSBPdXQgb2YgUmFuZ2UnKTtcbiAgICAgIGNhc2UgKDIwMSk6XG4gICAgICAgIHJldHVybiAoJ1ByZWNvbmRpdGlvbiBGYWlsZWQnKTsgLy9TdGF0dXNQcmVjb25kaXRpb25GYWlsZWRcbiAgICAgIGNhc2UgKDIwMik6XG4gICAgICAgIHJldHVybiAoJ0dyb3VwIE5hbWUgSW4gVXNlJyk7IC8vU3RhdHVzR3JvdXBOYW1lSW5Vc2VcbiAgICAgIGNhc2UgKDIwNSk6XG4gICAgICAgIHJldHVybiAoJ0dyb3VwIE51bWJlciBJbiBVc2UnKTsgLy9TdGF0dXNHcm91cE51bWJlckluVXNlXG4gICAgICBjYXNlICgyNDEpOlxuICAgICAgICByZXR1cm4gKCdJdGVtIERvZXMgTm90IEV4aXN0Jyk7IC8vU3RhdHVzVGhlbWVJbmRleE91dE9mUmFuZ2VcbiAgICAgIGNhc2UgKDI0Mik6XG4gICAgICAgIHJldHVybiAoJ0JhZCBHcm91cCBOdW1iZXInKTsgLy9TdGF0dXNUaGVtZUluZGV4T3V0T2ZSYW5nZVxuICAgICAgY2FzZSAoMjQzKTpcbiAgICAgICAgcmV0dXJuICgnVGhlbWUgSW5kZXggT3V0IE9mIFJhbmdlJyk7IC8vU3RhdHVzVGhlbWVJbmRleE91dE9mUmFuZ2VcbiAgICAgIGNhc2UgKDI1MSk6XG4gICAgICAgIHJldHVybiAoJ0JhZCBUaGVtZSBJbmRleCcpOyAvL1N0YXR1c1RoZW1lSW5kZXhPdXRPZlJhbmdlXG4gICAgICBjYXNlICgyNTIpOlxuICAgICAgICByZXR1cm4gKCdUaGVtZSBDaGFuZ2VzIFJlc3RyaWN0ZWQnKTsgLy9TdGF0dXNUaGVtZUluZGV4T3V0T2ZSYW5nZVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICgnVW5rbm93biBzdGF0dXMnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkb1JlcXVlc3QodXJsOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiBQcm9taXNlPElUaGVtZUxpc3RSZXNwIHwgSUdyb3VwTGlzdFJlc3AgfCBJQ29sb3JMaXN0UmVzcCB8IElTdGF0dXM+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCk6IFByb21pc2U8SVRoZW1lTGlzdFJlc3AgfCBJR3JvdXBMaXN0UmVzcCB8IElDb2xvckxpc3RSZXNwIHwgSVN0YXR1cz4gPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3dpdGNoICh1cmwpIHtcbiAgICAgICAgICBjYXNlICdHcm91cExpc3RHZXQnOlxuICAgICAgICAgICAgaWYgKHRoaXMuaGlkZUdyb3VwcykgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNhY2hlR3JvdXBMaXN0ICE9PSAndW5kZWZpbmVkJyAmJiBEYXRlLm5vdygpIC0gdGhpcy5jYWNoZUdyb3VwTGlzdCA8IDIwMDApIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh7IFN0YXR1czogMSwgU3RhdHVzU3RyOiAnQ2FjaGVkJywgR3JvdXBMaXN0OiB0aGlzLkdyb3VwTGlzdCB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnVGhlbWVMaXN0R2V0JzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jYWNoZVRoZW1lTGlzdCAhPT0gJ3VuZGVmaW5lZCcgJiYgRGF0ZS5ub3coKSAtIHRoaXMuY2FjaGVUaGVtZUxpc3QgPCAyMDAwKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoeyBTdGF0dXM6IDEsIFN0YXR1c1N0cjogJ0NhY2hlZCcsIFRoZW1lTGlzdDogdGhpcy5UaGVtZUxpc3QgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0NvbG9yTGlzdEdldCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY2FjaGVDb2xvckxpc3QgIT09ICd1bmRlZmluZWQnICYmIERhdGUubm93KCkgLSB0aGlzLmNhY2hlQ29sb3JMaXN0IDwgMjAwMCkge1xuICAgICAgICAgICAgICByZXNvbHZlKHsgU3RhdHVzOiAxLCBTdGF0dXNTdHI6ICdDYWNoZWQnLCBDb2xvckxpc3Q6IHRoaXMuQ29sb3JMaXN0IH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICBtZXRob2Q6ICdwb3N0JyxcbiAgICAgICAgICB1cmw6ICdodHRwOi8vJyArIHRoaXMuaXAgKyAnLycgKyB1cmwgKyAnLmpzb24nLFxuICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ2NhY2hlLWNvbnRyb2wnOiAnbm8tY2FjaGUnXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0aW1lb3V0OiB0aGlzLmNvbW1hbmRUaW1lb3V0XG4gICAgICAgIH0pXG4gICAgICAgIHJlc3BvbnNlLmRhdGEuU3RhdHVzU3RyID0gdGhpcy5nZXRTdGF0dXMocmVzcG9uc2UuZGF0YS5TdGF0dXMpO1xuICAgICAgICBpZiAocmVzcG9uc2UuZGF0YS5TdGF0dXNTdHIgIT09ICdPaycgfHwgcmVzcG9uc2UuY29kZSA9PT0gJ0VUSU1FT1VUJykge1xuICAgICAgICAgIHRoaXMubG9nLmVycm9yKGBDb250cm9sbGVyICR7dGhpcy5uYW1lfSByZXNwb25kZWQgd2l0aCBlcnJvciAke3Jlc3BvbnNlLmRhdGEuU3RhdHVzU3RyfSB0byAnJHt1cmx9J2ApO1xuICAgICAgICAgIHJlc29sdmUoeyBTdGF0dXM6IDEsIFN0YXR1c1N0cjogJ09rJywgR3JvdXBMaXN0OiB0aGlzLkdyb3VwTGlzdCB8fCBbXSwgVGhlbWVMaXN0OiB0aGlzLlRoZW1lTGlzdCB8fCBbXSwgQ29sb3JMaXN0OiB0aGlzLkNvbG9yTGlzdCB8fCBbXSB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcbiAgICAgIH1cbiAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5sb2cuZXJyb3IoYEVycm9yIGNvbW11bmljYXRpbmcgd2l0aCBjb250cm9sbGVyICR7dGhpcy5uYW1lfS4gVVJMICR7dXJsfS5qc29uLlxcblxcdCR7ZXJyfWApO1xuICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgYXN5bmMgc2xlZXAobXMpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gIH1cbiAgYXN5bmMgSWxsdW1pbmF0ZUFsbEFzeW5jKCk6IFByb21pc2U8SVN0YXR1cz4ge1xuICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLmRvUmVxdWVzdCgnSWxsdW1pbmF0ZUFsbCcpO1xuICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICB9KVxuICB9XG5cbiAgYXN5bmMgRXh0aW5ndWlzaEFsbEFzeW5jKCk6IFByb21pc2U8SVN0YXR1cz4ge1xuICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLmRvUmVxdWVzdCgnRXh0aW5ndWlzaEFsbCcpO1xuICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICB9KVxuICB9XG4gIHB1YmxpYyBhc3luYyBHZXRHcm91cEFzeW5jKGdyb3VwOiBudW1iZXIpOiBQcm9taXNlPElHcm91cExpc3Q+IHtcbiAgICBpZiAodGhpcy5oaWRlR3JvdXBzKSByZXR1cm47XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuR3JvdXBMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgZm9yIChsZXQgaSBpbiB0aGlzLkdyb3VwTGlzdCkge1xuICAgICAgICAgIGlmICh0aGlzLkdyb3VwTGlzdFtpXS5Hcm91cE51bWJlciA9PT0gZ3JvdXApIHJldHVybiByZXNvbHZlKHRoaXMuR3JvdXBMaXN0W2ldKTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QoYE5vIEdyb3VwIEZvdW5kIGluIEdyb3VwR2V0QXN5bmMgZm9yIGdyb3VwICR7Z3JvdXB9LlxcbiR7SlNPTi5zdHJpbmdpZnkodGhpcy5Hcm91cExpc3QpfWApXG4gICAgICB9XG4gICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJlamVjdChgRXJyb3Igd2l0aCBHZXRHcm91cEFzeW5jOiAke2Vycn1gKVxuICAgICAgICB0aGlzLmxvZy5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH0pXG4gIH1cbiAgYXN5bmMgR3JvdXBMaXN0R2V0QXN5bmMoKTogUHJvbWlzZTxJR3JvdXBMaXN0W10+IHtcbiAgICAvLyBHZXQgdGhlIGxpc3Qgb2YgbGlnaHQgZ3JvdXBzIGZyb20gdGhlIGNvbnRyb2xsZXJcbiAgICBpZiAodHlwZW9mIHRoaXMuY2FjaGVHcm91cExpc3QgIT09ICd1bmRlZmluZWQnICYmIERhdGUubm93KCkgLSB0aGlzLmNhY2hlR3JvdXBMaXN0IDwgMjAwMCkge1xuICAgICAgcmV0dXJuICh0aGlzLkdyb3VwTGlzdCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFF1ZXVlLmVucXVldWUoYXN5bmMgKCkgPT4ge1xuICAgICAgbGV0IGRhdGEgPSBhd2FpdCB0aGlzLmRvUmVxdWVzdCgnR3JvdXBMaXN0R2V0Jyk7XG4gICAgICBpZiAoZGF0YS5TdGF0dXMgPT09IDApIHtcbiAgICAgICAgdGhpcy5jYWNoZUdyb3VwTGlzdCA9IERhdGUubm93KCk7XG4gICAgICAgIHRoaXMucHJvY2Vzc0dyb3VwTGlzdEdldChkYXRhIGFzIElHcm91cExpc3RSZXNwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLkdyb3VwTGlzdDtcbiAgICB9KVxuICB9XG4gIHByb3RlY3RlZCBwcm9jZXNzR3JvdXBMaXN0R2V0KGRhdGE6IElHcm91cExpc3RSZXNwKTogdm9pZCB7XG4gICAgLy8gb3ZlcnJpZGUgd2l0aCBaREMvWkRUV09cbiAgICB0aGlzLkdyb3VwTGlzdCA9IGRhdGEuR3JvdXBMaXN0O1xuICAgIGZvciAobGV0IGkgaW4gdGhpcy5Hcm91cExpc3QpIHtcbiAgICAgIHRoaXMuR3JvdXBMaXN0W2ldLnR5cGUgPSBJTGlnaHRUeXBlLlpEO1xuICAgIH1cbiAgfVxuICBhc3luYyBHcm91cExpc3RFZGl0QXN5bmMobmFtZTogc3RyaW5nLCBncm91cE51bWJlcjogbnVtYmVyLCBjb2xvcj86IG51bWJlcik6IFByb21pc2U8YW55PiB7XG4gICAgLy8gU2FtZSBpbiBaREMvWkRUV09cbiAgICB2YXIgcmVxdWVzdERhdGEgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAnTmFtZSc6IG5hbWUsXG4gICAgICAnR3JvdXBOdW1iZXInOiBncm91cE51bWJlcixcbiAgICAgICdDb2xvcic6IGNvbG9yXG4gICAgfSk7XG4gICAgcmV0dXJuIFF1ZXVlLmVucXVldWUoYXN5bmMgKCkgPT4ge1xuICAgICAgbGV0IHN0YXR1cyA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KCdHcm91cExpc3RFZGl0JywgcmVxdWVzdERhdGEpO1xuICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICB9KVxuICAgIC8qICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5xdWV1ZVJlcXVlc3QoJ0dyb3VwTGlzdEVkaXQnLCByZXF1ZXN0RGF0YSk7XG4gICAgICAgIHJldHVybiBzdGF0dXM7ICovXG4gIH1cbiAgYXN5bmMgVGhlbWVMaXN0R2V0QXN5bmMoKTogUHJvbWlzZTxJVGhlbWVMaXN0W10+IHtcbiAgICBpZiAodHlwZW9mIHRoaXMuY2FjaGVUaGVtZUxpc3QgIT09ICd1bmRlZmluZWQnICYmIERhdGUubm93KCkgLSB0aGlzLmNhY2hlVGhlbWVMaXN0IDwgMjAwMCkge1xuICAgICAgcmV0dXJuICh0aGlzLlRoZW1lTGlzdCk7XG4gICAgfVxuICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBkYXRhID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ1RoZW1lTGlzdEdldCcpO1xuICAgICAgaWYgKGRhdGEuU3RhdHVzID09PSAwKSB7XG4gICAgICAgIHRoaXMuY2FjaGVUaGVtZUxpc3QgPSBEYXRlLm5vdygpO1xuICAgICAgICB0aGlzLnByb2Nlc3NUaGVtZUxpc3RHZXQoZGF0YSBhcyBJVGhlbWVMaXN0UmVzcCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5UaGVtZUxpc3Q7XG4gICAgfSlcbiAgfVxuICBwcm90ZWN0ZWQgcHJvY2Vzc1RoZW1lTGlzdEdldChkYXRhOiBJVGhlbWVMaXN0UmVzcCk6IHZvaWQge1xuICAgIHRoaXMuVGhlbWVMaXN0ID0gZGF0YS5UaGVtZUxpc3Q7XG4gICAgZm9yICh2YXIgaSBpbiB0aGlzLlRoZW1lTGlzdCkge1xuICAgICAgdGhpcy5UaGVtZUxpc3RbaV0uaXNPbiA9IHRoaXMuVGhlbWVMaXN0W2ldLk9uT2ZmID09PSAxO1xuICAgICAgdGhpcy5UaGVtZUxpc3RbaV0udHlwZSA9IElMaWdodFR5cGUuVEhFTUU7XG4gICAgfVxuICB9XG4gIHB1YmxpYyBhc3luYyBHZXRUaGVtZUFzeW5jKGluZGV4OiBudW1iZXIpOiBQcm9taXNlPElUaGVtZUxpc3Q+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgdGhpcy5UaGVtZUxpc3RHZXRBc3luYygpO1xuICAgICAgICBmb3IgKGxldCBpIGluIHRoaXMuVGhlbWVMaXN0KSB7XG4gICAgICAgICAgaWYgKHRoaXMuVGhlbWVMaXN0W2ldLlRoZW1lSW5kZXggPT09IGluZGV4KSByZXR1cm4gcmVzb2x2ZSh0aGlzLlRoZW1lTGlzdFtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVqZWN0KGBObyBUaGVtZSBGb3VuZCBpbiBUaGVtZUdldEFzeW5jIGZvciB0aGVtZSAke2luZGV4fS5cXG4ke0pTT04uc3RyaW5naWZ5KHRoaXMuVGhlbWVMaXN0KX1gKVxuICAgICAgfVxuICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLmxvZy5lcnJvcihlcnIpO1xuICAgICAgICByZWplY3QoYEVycm9yIHdpdGggR2V0VGhlbWVBc3luYyAke2Vycn1gKVxuICAgICAgfVxuICAgIH0pXG5cbiAgfVxuICBhc3luYyBJbGx1bWluYXRlVGhlbWVBc3luYyh0aGVtZUluZGV4OiBudW1iZXIsIG9uT2ZmOiBudW1iZXIpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ0lsbHVtaW5hdGVUaGVtZScsIHtcbiAgICAgICAgJ1RoZW1lSW5kZXgnOiB0aGVtZUluZGV4LFxuICAgICAgICAnT25PZmYnOiBvbk9mZlxuICAgICAgfSk7XG4gICAgICB0aGlzLmNhY2hlVGhlbWVMaXN0ID0gdW5kZWZpbmVkO1xuICAgICAgc2V0VGltZW91dChhc3luYyAoKSA9PiB7IGF3YWl0IHRoaXMudXBkYXRlTGlnaHRzKCkgfSwgMjUwKTtcbiAgICAgIHJldHVybiBzdGF0dXM7XG4gICAgfSlcbiAgfVxuICBhc3luYyBJbGx1bWluYXRlR3JvdXBBc3luYyhncm91cE51bWJlcjogbnVtYmVyLCBkZXNpcmVkSW50ZW5zaXR5OiBudW1iZXIpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ0lsbHVtaW5hdGVHcm91cCcsIHtcbiAgICAgICAgJ0dyb3VwTnVtYmVyJzogZ3JvdXBOdW1iZXIsXG4gICAgICAgICdJbnRlbnNpdHknOiBkZXNpcmVkSW50ZW5zaXR5XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBzdGF0dXM7XG4gICAgfSlcbiAgfVxuICBhc3luYyBDb2xvckxpc3RHZXRBc3luYygpOiBQcm9taXNlPElDb2xvckxpc3RbXT4ge1xuICAgIHJldHVybiB7fSBhcyBJQ29sb3JMaXN0W107XG4gIH1cbiAgYXN5bmMgQ29sb3JMaXN0U2V0QXN5bmMoY29sb3I6IG51bWJlciwgaHVlOiBudW1iZXIsIHNhdHVyYXRpb246IG51bWJlcik6IFByb21pc2U8SVN0YXR1cz4ge1xuICAgIHJldHVybiB7fSBhcyBJU3RhdHVzO1xuICB9XG4gIHByb2Nlc3NDb2xvckxpc3RHZXQoZGF0YTogSUNvbG9yTGlzdFJlc3ApIHtcbiAgICB0aGlzLkNvbG9yTGlzdCA9IGRhdGEuQ29sb3JMaXN0O1xuICB9O1xuICBhc3luYyBHZXRDb2xvckFzeW5jKGNvbG9yOiBudW1iZXIpOiBQcm9taXNlPElDb2xvckxpc3Q+IHsgcmV0dXJuIHt9IGFzIElDb2xvckxpc3Q7IH1cblxuICByZWdpc3RlckNhbGxiYWNrKFVVSUQ6IHN0cmluZywgdHlwZTogSUxpZ2h0VHlwZSwgaW5kZXg6IG51bWJlciwgY2hhcmFjdGVyaXN0aWM6IGFueSwgZm46ICgpID0+IHt9KSB7XG4gICAgLy8gbG9vayBmb3IgYW4gZXhpc3RpbmcgVVVJRC9jaGFyYWN0ZXJpc3RpYyBwYWlyIGFuZCB1cGRhdGUgdGhhdCBpZiB0aGUgbGlnaHQgYXR0cmlidXRlcyBnZXQgdXBkYXRlc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jYWxsYmFja0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2tMaXN0W2ldO1xuICAgICAgaWYgKGNhbGxiYWNrLlVVSUQgPT0gVVVJRCAmJiBjYWxsYmFjay5jaGFyYWN0ZXJpc3RpYyA9PT0gY2hhcmFjdGVyaXN0aWMpIHtcbiAgICAgICAgY2FsbGJhY2sgPSB7IFVVSUQsIHR5cGUsIGluZGV4LCBjaGFyYWN0ZXJpc3RpYywgZm4gfTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBub3QgZm91bmQsIGFkZCBhIG5ldyBjYWxsYmFjay5cbiAgICB0aGlzLmNhbGxiYWNrTGlzdC5wdXNoKHsgVVVJRCwgdHlwZSwgaW5kZXgsIGNoYXJhY3RlcmlzdGljLCBmbiB9KTtcbiAgfVxuICBleGVjQ2FsbGJhY2tzKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jYWxsYmFja0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBjYWxsYmFjayA9IHRoaXMuY2FsbGJhY2tMaXN0W2ldO1xuICAgICAgdHJ5IHtcbiAgICAgICAgc3dpdGNoIChjYWxsYmFjay50eXBlKSB7XG4gICAgICAgICAgY2FzZSBJTGlnaHRUeXBlLlpEOlxuICAgICAgICAgIGNhc2UgSUxpZ2h0VHlwZS5aREM6XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2suY2hhcmFjdGVyaXN0aWMubmFtZSA9PT0gdGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5CcmlnaHRuZXNzLm5hbWUpIHtcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSBpbiB0aGlzLkdyb3VwTGlzdCl7IC8vIG5lZWQgdG8gdXNlIGxvb3AgYXMgdGhlc2UgYXJlIG5vdCAwIGJhc2VkIGluZGV4ZXNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5Hcm91cExpc3RbaV0uR3JvdXBOdW1iZXIgPT09IGNhbGxiYWNrLmluZGV4KXtcbiAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5Hcm91cExpc3RbaV0uSW50ZW5zaXR5ICE9PSAndW5kZWZpbmVkJykgY2FsbGJhY2suZm4odGhpcy5Hcm91cExpc3RbaV0uSW50ZW5zaXR5KTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBsZXQgZ3JvdXAgPSB0aGlzLkdyb3VwTGlzdC5maW5kKGc9PmcuR3JvdXBOdW1iZXIgPT09IGNhbGxiYWNrLmluZGV4LCB0aGlzLkdyb3VwTGlzdCk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSBJTGlnaHRUeXBlLlRIRU1FOlxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmNoYXJhY3RlcmlzdGljLm5hbWUgPT09IHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuT24ubmFtZSkge1xuICAgICAgICAgICAgICBmb3IgKGxldCBpIGluIHRoaXMuR3JvdXBMaXN0KXsgLy8gbmVlZCB0byB1c2UgbG9vcCBhcyB0aGVzZSBhcmUgbm90IDAgYmFzZWQgaW5kZXhlc1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLlRoZW1lTGlzdFtpXS5UaGVtZUluZGV4ID09PSBjYWxsYmFjay5pbmRleCl7XG4gICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuVGhlbWVMaXN0W2ldLk9uT2ZmICE9PSAndW5kZWZpbmVkJykgY2FsbGJhY2suZm4odGhpcy5UaGVtZUxpc3RbaV0uT25PZmYgPT09IDEpO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLmxvZy5lcnJvcihgZXhlY0NhbGxiYWNrczogJHtlcnJ9YClcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgdXBkYXRlTGlnaHRzKGZvcmNlOiBib29sZWFuID0gZmFsc2UpIHtcbiAgICBpZiAoZm9yY2UpIHtcbiAgICAgIHRoaXMuY2FjaGVHcm91cExpc3QgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmNhY2hlVGhlbWVMaXN0ID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLkdyb3VwTGlzdEdldEFzeW5jKCk7XG4gICAgYXdhaXQgdGhpcy5UaGVtZUxpc3RHZXRBc3luYygpO1xuICAgIHRoaXMuZXhlY0NhbGxiYWNrcygpO1xuICB9XG4gIGFzeW5jIHBvbGxDb250cm9sbGVyKCkge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnVwZGF0ZUxpZ2h0cygpO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7IHRoaXMubG9nLmVycm9yKGAke3RoaXMubmFtZX0gZXJyb3I6ICR7ZXJyfWApIH1cbiAgICBmaW5hbGx5IHsgc2V0VGltZW91dChhc3luYyAoKSA9PiB7IGF3YWl0IHRoaXMucG9sbENvbnRyb2xsZXIoKSB9LCAzMCAqIDEwMDApOyB9XG4gIH1cblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHcm91cExpc3RSZXNwIHtcbiAgU3RhdHVzOiBudW1iZXI7XG4gIFN0YXR1c1N0cjogc3RyaW5nO1xuICBHcm91cExpc3Q6IElHcm91cExpc3RbXTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUdyb3VwTGlzdCB7XG4gIE5hbWU6IHN0cmluZztcbiAgR3JwPzogbnVtYmVyO1xuICBHcm91cE51bWJlcj86IG51bWJlcjtcbiAgQ29scj86IG51bWJlcjtcbiAgQ29sb3I/OiBudW1iZXI7XG4gIEludGVuPzogbnVtYmVyO1xuICBJbnRlbnNpdHk/OiBudW1iZXI7XG4gIHR5cGU6IElMaWdodFR5cGU7XG4gIFVVSUQ/OiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIElTdGF0dXMge1xuICBTdGF0dXM6IG51bWJlcjtcbiAgU3RhdHVzU3RyOiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIElUaGVtZUxpc3RSZXNwIHtcbiAgU3RhdHVzOiBudW1iZXI7XG4gIFN0YXR1c1N0cjogc3RyaW5nO1xuICBSZXN0cmljdGVkOiAwIHwgMTtcbiAgVGhlbWVMaXN0OiBJVGhlbWVMaXN0W107XG59XG5leHBvcnQgaW50ZXJmYWNlIElUaGVtZUxpc3Qge1xuICBOYW1lOiBzdHJpbmc7XG4gIFRoZW1lSW5kZXg6IG51bWJlcjtcbiAgT25PZmY6IDAgfCAxO1xuICBpc09uOiBib29sZWFuO1xuICB0eXBlPzogSUxpZ2h0VHlwZTtcbiAgVVVJRD86IHN0cmluZztcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbG9yTGlzdFJlc3Age1xuICBTdGF0dXM6IG51bWJlcjtcbiAgU3RhdHVzU3RyOiBzdHJpbmc7XG4gIExpc3RTaXplOiBudW1iZXI7XG4gIENvbG9yTGlzdDogSUNvbG9yTGlzdFtdO1xufVxuZXhwb3J0IGludGVyZmFjZSBJQ29sb3JMaXN0IHtcbiAgQzogbnVtYmVyO1xuICBIdWU6IG51bWJlcjtcbiAgU2F0OiBudW1iZXI7XG59XG5leHBvcnQgZW51bSBJQ29udHJvbGxlclR5cGUge1xuICBaRCA9ICdaRCcsIFpEQyA9ICdaREMnLCBaRFRXTyA9ICdaRFRXTydcbn0iXX0=