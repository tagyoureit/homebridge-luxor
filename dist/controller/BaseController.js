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
        this.commandTimeout = data.commandTimeout;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmFzZUNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlci9CYXNlQ29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFFQSxpREFBZ0Q7QUFFaEQscURBQTZCO0FBRTdCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFFdkMsTUFBYSxjQUFjO0lBZ0J6QixZQUFZLElBQVMsRUFBRSxHQUFRO1FBQzdCLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUE7UUFDbkIsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFLEtBQUssV0FBVyxFQUFFO1lBQ2xDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFDaEQsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUM1QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNsQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ2hELElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUUxQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLElBQUkscUJBQXFCLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELHVC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MUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWplY3RzIH0gZnJvbSBcImFzc2VydFwiO1xuaW1wb3J0IHsgQ2hhcmFjdGVyaXN0aWMsIExvZ2dlciB9IGZyb20gXCJob21lYnJpZGdlXCI7XG5pbXBvcnQgeyBJTGlnaHRUeXBlIH0gZnJvbSBcIi4uL2xpZ2h0cy9aRF9MaWdodFwiO1xuaW1wb3J0IHsgTHV4b3JQbGF0Zm9ybSB9IGZyb20gXCIuLi9MdXhvclBsYXRmb3JtXCI7XG5pbXBvcnQgUXVldWUgZnJvbSBcIi4uL1F1ZXVlXCI7XG5cbmNvbnN0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKS5kZWZhdWx0O1xuXG5leHBvcnQgY2xhc3MgQmFzZUNvbnRyb2xsZXIge1xuICBwcm90ZWN0ZWQgaXA6IHN0cmluZztcbiAgcHVibGljIG5hbWU6IHN0cmluZztcbiAgcHJvdGVjdGVkIGhpZGVHcm91cHM6IGJvb2xlYW47XG4gIHByb3RlY3RlZCBpbmRlcGVuZGVudENvbG9yczogYm9vbGVhbjtcbiAgcHJvdGVjdGVkIGxvZzogTG9nZ2VyO1xuICBwdWJsaWMgdHlwZTogSUNvbnRyb2xsZXJUeXBlO1xuICBwcm90ZWN0ZWQgcGxhdGZvcm06IEx1eG9yUGxhdGZvcm07XG4gIHByb3RlY3RlZCBHcm91cExpc3Q6IElHcm91cExpc3RbXTtcbiAgcHJvdGVjdGVkIGNhY2hlR3JvdXBMaXN0OiBudW1iZXI7XG4gIHByb3RlY3RlZCBDb2xvckxpc3Q6IElDb2xvckxpc3RbXTtcbiAgcHJvdGVjdGVkIGNhY2hlQ29sb3JMaXN0OiBudW1iZXI7XG4gIHByb3RlY3RlZCBUaGVtZUxpc3Q6IElUaGVtZUxpc3RbXTtcbiAgcHJvdGVjdGVkIGNhY2hlVGhlbWVMaXN0OiBudW1iZXI7XG4gIHByb3RlY3RlZCBjb21tYW5kVGltZW91dDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgY2FsbGJhY2tMaXN0OiB7IFVVSUQ6IHN0cmluZywgdHlwZTogSUxpZ2h0VHlwZSwgaW5kZXg6IG51bWJlciwgY2hhcmFjdGVyaXN0aWM6IGFueSwgZm46IChhOiBudW1iZXIgfCBib29sZWFuKSA9PiB7fSB9W107XG4gIGNvbnN0cnVjdG9yKGRhdGE6IGFueSwgbG9nOiBhbnkpIHtcbiAgICB0aGlzLmxvZyA9IGxvZztcbiAgICB0aGlzLmNhbGxiYWNrTGlzdCA9IFtdO1xuICAgIHRoaXMuR3JvdXBMaXN0ID0gW11cbiAgICBpZiAodHlwZW9mIGRhdGEuaXAgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLmxvZy5kZWJ1ZyhgSW5pdGlhbGl6aW5nIGJhc2UgY29udHJvbGxlci5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5pcCA9IGRhdGEuaXA7XG4gICAgdGhpcy5uYW1lID0gZGF0YS5Db250cm9sbGVyO1xuICAgIHRoaXMudHlwZSA9IGRhdGEudHlwZTtcbiAgICB0aGlzLnBsYXRmb3JtID0gZGF0YS5wbGF0Zm9ybTtcbiAgICB0aGlzLmhpZGVHcm91cHMgPSBkYXRhLmhpZGVHcm91cHM7XG4gICAgdGhpcy5pbmRlcGVuZGVudENvbG9ycyA9IGRhdGEuaW5kZXBlbmRlbnRDb2xvcnM7XG4gICAgdGhpcy5jb21tYW5kVGltZW91dCA9IGRhdGEuY29tbWFuZFRpbWVvdXQ7XG5cbiAgICBsb2cuaW5mbyhgQXNzaWduaW5nICR7dGhpcy50eXBlfSBDb250cm9sbGVyIHRvIElQICR7dGhpcy5pcH1gKTtcbiAgICAvLyB0aGlzLnVwZGF0ZUxpZ2h0cygpO1xuICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4geyBhd2FpdCB0aGlzLnBvbGxDb250cm9sbGVyKCk7IH0sIDMwMDAwKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXRTdGF0dXMocmVzdWx0KTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKHJlc3VsdCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gKCdPaycpOyAvL1N0YXR1c09rXG4gICAgICBjYXNlICgxKTpcbiAgICAgICAgcmV0dXJuICgnVW5rbm93biBNZXRob2QnKTsgLy9TdGF0dXNVbmtub3duTWV0aG9kXG4gICAgICBjYXNlICgxMDEpOlxuICAgICAgICByZXR1cm4gKCdVbnBhcnNlYWJsZSBSZXF1ZXN0Jyk7IC8vU3RhdHVzVW5wYXJzZWFibGVSZXF1ZXN0XG4gICAgICBjYXNlICgxMDIpOlxuICAgICAgICByZXR1cm4gKCdJbnZhbGlkIFJlcXVlc3QnKTsgLy9TdGF0dXNJbnZhbGlkUmVxdWVzdFxuICAgICAgY2FzZSAoMTUxKTpcbiAgICAgICAgcmV0dXJuICgnQ29sb3IgVmFsdWUgT3V0IG9mIFJhbmdlJyk7XG4gICAgICBjYXNlICgyMDEpOlxuICAgICAgICByZXR1cm4gKCdQcmVjb25kaXRpb24gRmFpbGVkJyk7IC8vU3RhdHVzUHJlY29uZGl0aW9uRmFpbGVkXG4gICAgICBjYXNlICgyMDIpOlxuICAgICAgICByZXR1cm4gKCdHcm91cCBOYW1lIEluIFVzZScpOyAvL1N0YXR1c0dyb3VwTmFtZUluVXNlXG4gICAgICBjYXNlICgyMDUpOlxuICAgICAgICByZXR1cm4gKCdHcm91cCBOdW1iZXIgSW4gVXNlJyk7IC8vU3RhdHVzR3JvdXBOdW1iZXJJblVzZVxuICAgICAgY2FzZSAoMjQxKTpcbiAgICAgICAgcmV0dXJuICgnSXRlbSBEb2VzIE5vdCBFeGlzdCcpOyAvL1N0YXR1c1RoZW1lSW5kZXhPdXRPZlJhbmdlXG4gICAgICBjYXNlICgyNDIpOlxuICAgICAgICByZXR1cm4gKCdCYWQgR3JvdXAgTnVtYmVyJyk7IC8vU3RhdHVzVGhlbWVJbmRleE91dE9mUmFuZ2VcbiAgICAgIGNhc2UgKDI0Myk6XG4gICAgICAgIHJldHVybiAoJ1RoZW1lIEluZGV4IE91dCBPZiBSYW5nZScpOyAvL1N0YXR1c1RoZW1lSW5kZXhPdXRPZlJhbmdlXG4gICAgICBjYXNlICgyNTEpOlxuICAgICAgICByZXR1cm4gKCdCYWQgVGhlbWUgSW5kZXgnKTsgLy9TdGF0dXNUaGVtZUluZGV4T3V0T2ZSYW5nZVxuICAgICAgY2FzZSAoMjUyKTpcbiAgICAgICAgcmV0dXJuICgnVGhlbWUgQ2hhbmdlcyBSZXN0cmljdGVkJyk7IC8vU3RhdHVzVGhlbWVJbmRleE91dE9mUmFuZ2VcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAoJ1Vua25vd24gc3RhdHVzJyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZG9SZXF1ZXN0KHVybDogc3RyaW5nLCBkYXRhPzogYW55KTogUHJvbWlzZTxJVGhlbWVMaXN0UmVzcCB8IElHcm91cExpc3RSZXNwIHwgSUNvbG9yTGlzdFJlc3AgfCBJU3RhdHVzPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpOiBQcm9taXNlPElUaGVtZUxpc3RSZXNwIHwgSUdyb3VwTGlzdFJlc3AgfCBJQ29sb3JMaXN0UmVzcCB8IElTdGF0dXM+ID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN3aXRjaCAodXJsKSB7XG4gICAgICAgICAgY2FzZSAnR3JvdXBMaXN0R2V0JzpcbiAgICAgICAgICAgIGlmICh0aGlzLmhpZGVHcm91cHMpIHJldHVybjtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jYWNoZUdyb3VwTGlzdCAhPT0gJ3VuZGVmaW5lZCcgJiYgRGF0ZS5ub3coKSAtIHRoaXMuY2FjaGVHcm91cExpc3QgPCAyMDAwKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoeyBTdGF0dXM6IDEsIFN0YXR1c1N0cjogJ0NhY2hlZCcsIEdyb3VwTGlzdDogdGhpcy5Hcm91cExpc3QgfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ1RoZW1lTGlzdEdldCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY2FjaGVUaGVtZUxpc3QgIT09ICd1bmRlZmluZWQnICYmIERhdGUubm93KCkgLSB0aGlzLmNhY2hlVGhlbWVMaXN0IDwgMjAwMCkge1xuICAgICAgICAgICAgICByZXNvbHZlKHsgU3RhdHVzOiAxLCBTdGF0dXNTdHI6ICdDYWNoZWQnLCBUaGVtZUxpc3Q6IHRoaXMuVGhlbWVMaXN0IH0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDb2xvckxpc3RHZXQnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNhY2hlQ29sb3JMaXN0ICE9PSAndW5kZWZpbmVkJyAmJiBEYXRlLm5vdygpIC0gdGhpcy5jYWNoZUNvbG9yTGlzdCA8IDIwMDApIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh7IFN0YXR1czogMSwgU3RhdHVzU3RyOiAnQ2FjaGVkJywgQ29sb3JMaXN0OiB0aGlzLkNvbG9yTGlzdCB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcyh7XG4gICAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgICAgdXJsOiAnaHR0cDovLycgKyB0aGlzLmlwICsgJy8nICsgdXJsICsgJy5qc29uJyxcbiAgICAgICAgICBkYXRhLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdjYWNoZS1jb250cm9sJzogJ25vLWNhY2hlJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdGltZW91dDogdGhpcy5jb21tYW5kVGltZW91dFxuICAgICAgICB9KVxuICAgICAgICByZXNwb25zZS5kYXRhLlN0YXR1c1N0ciA9IHRoaXMuZ2V0U3RhdHVzKHJlc3BvbnNlLmRhdGEuU3RhdHVzKTtcbiAgICAgICAgaWYgKHJlc3BvbnNlLmRhdGEuU3RhdHVzU3RyICE9PSAnT2snIHx8IHJlc3BvbnNlLmNvZGUgPT09ICdFVElNRU9VVCcpIHtcbiAgICAgICAgICB0aGlzLmxvZy5lcnJvcihgQ29udHJvbGxlciAke3RoaXMubmFtZX0gcmVzcG9uZGVkIHdpdGggZXJyb3IgJHtyZXNwb25zZS5kYXRhLlN0YXR1c1N0cn0gdG8gJyR7dXJsfSdgKTtcbiAgICAgICAgICByZXNvbHZlKHsgU3RhdHVzOiAxLCBTdGF0dXNTdHI6ICdPaycsIEdyb3VwTGlzdDogdGhpcy5Hcm91cExpc3QgfHwgW10sIFRoZW1lTGlzdDogdGhpcy5UaGVtZUxpc3QgfHwgW10sIENvbG9yTGlzdDogdGhpcy5Db2xvckxpc3QgfHwgW10gfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHJlc29sdmUocmVzcG9uc2UuZGF0YSk7XG4gICAgICB9XG4gICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMubG9nLmVycm9yKGBFcnJvciBjb21tdW5pY2F0aW5nIHdpdGggY29udHJvbGxlciAke3RoaXMubmFtZX0uIFVSTCAke3VybH0uanNvbi5cXG5cXHQke2Vycn1gKTtcbiAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGFzeW5jIHNsZWVwKG1zKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICB9XG4gIGFzeW5jIElsbHVtaW5hdGVBbGxBc3luYygpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ0lsbHVtaW5hdGVBbGwnKTtcbiAgICAgIHJldHVybiBzdGF0dXM7XG4gICAgfSlcbiAgfVxuXG4gIGFzeW5jIEV4dGluZ3Vpc2hBbGxBc3luYygpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ0V4dGluZ3Vpc2hBbGwnKTtcbiAgICAgIHJldHVybiBzdGF0dXM7XG4gICAgfSlcbiAgfVxuICBwdWJsaWMgYXN5bmMgR2V0R3JvdXBBc3luYyhncm91cDogbnVtYmVyKTogUHJvbWlzZTxJR3JvdXBMaXN0PiB7XG4gICAgaWYgKHRoaXMuaGlkZUdyb3VwcykgcmV0dXJuO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLkdyb3VwTGlzdEdldEFzeW5jKCk7XG4gICAgICAgIGZvciAobGV0IGkgaW4gdGhpcy5Hcm91cExpc3QpIHtcbiAgICAgICAgICBpZiAodGhpcy5Hcm91cExpc3RbaV0uR3JvdXBOdW1iZXIgPT09IGdyb3VwKSByZXR1cm4gcmVzb2x2ZSh0aGlzLkdyb3VwTGlzdFtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVqZWN0KGBObyBHcm91cCBGb3VuZCBpbiBHcm91cEdldEFzeW5jIGZvciBncm91cCAke2dyb3VwfS5cXG4ke0pTT04uc3RyaW5naWZ5KHRoaXMuR3JvdXBMaXN0KX1gKVxuICAgICAgfVxuICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICByZWplY3QoYEVycm9yIHdpdGggR2V0R3JvdXBBc3luYzogJHtlcnJ9YClcbiAgICAgICAgdGhpcy5sb2cuZXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICB9KVxuICB9XG4gIGFzeW5jIEdyb3VwTGlzdEdldEFzeW5jKCk6IFByb21pc2U8SUdyb3VwTGlzdFtdPiB7XG4gICAgLy8gR2V0IHRoZSBsaXN0IG9mIGxpZ2h0IGdyb3VwcyBmcm9tIHRoZSBjb250cm9sbGVyXG4gICAgaWYgKHR5cGVvZiB0aGlzLmNhY2hlR3JvdXBMaXN0ICE9PSAndW5kZWZpbmVkJyAmJiBEYXRlLm5vdygpIC0gdGhpcy5jYWNoZUdyb3VwTGlzdCA8IDIwMDApIHtcbiAgICAgIHJldHVybiAodGhpcy5Hcm91cExpc3QpO1xuICAgIH1cblxuICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBkYXRhID0gYXdhaXQgdGhpcy5kb1JlcXVlc3QoJ0dyb3VwTGlzdEdldCcpO1xuICAgICAgaWYgKGRhdGEuU3RhdHVzID09PSAwKSB7XG4gICAgICAgIHRoaXMuY2FjaGVHcm91cExpc3QgPSBEYXRlLm5vdygpO1xuICAgICAgICB0aGlzLnByb2Nlc3NHcm91cExpc3RHZXQoZGF0YSBhcyBJR3JvdXBMaXN0UmVzcCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5Hcm91cExpc3Q7XG4gICAgfSlcbiAgfVxuICBwcm90ZWN0ZWQgcHJvY2Vzc0dyb3VwTGlzdEdldChkYXRhOiBJR3JvdXBMaXN0UmVzcCk6IHZvaWQge1xuICAgIC8vIG92ZXJyaWRlIHdpdGggWkRDL1pEVFdPXG4gICAgdGhpcy5Hcm91cExpc3QgPSBkYXRhLkdyb3VwTGlzdDtcbiAgICBmb3IgKGxldCBpIGluIHRoaXMuR3JvdXBMaXN0KSB7XG4gICAgICB0aGlzLkdyb3VwTGlzdFtpXS50eXBlID0gSUxpZ2h0VHlwZS5aRDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgR3JvdXBMaXN0RWRpdEFzeW5jKG5hbWU6IHN0cmluZywgZ3JvdXBOdW1iZXI6IG51bWJlciwgY29sb3I/OiBudW1iZXIpOiBQcm9taXNlPGFueT4ge1xuICAgIC8vIFNhbWUgaW4gWkRDL1pEVFdPXG4gICAgdmFyIHJlcXVlc3REYXRhID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgJ05hbWUnOiBuYW1lLFxuICAgICAgJ0dyb3VwTnVtYmVyJzogZ3JvdXBOdW1iZXIsXG4gICAgICAnQ29sb3InOiBjb2xvclxuICAgIH0pO1xuICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLmRvUmVxdWVzdCgnR3JvdXBMaXN0RWRpdCcsIHJlcXVlc3REYXRhKTtcbiAgICAgIHJldHVybiBzdGF0dXM7XG4gICAgfSlcbiAgICAvKiAgICAgbGV0IHN0YXR1cyA9IGF3YWl0IHRoaXMucXVldWVSZXF1ZXN0KCdHcm91cExpc3RFZGl0JywgcmVxdWVzdERhdGEpO1xuICAgICAgICByZXR1cm4gc3RhdHVzOyAqL1xuICB9XG4gIGFzeW5jIFRoZW1lTGlzdEdldEFzeW5jKCk6IFByb21pc2U8SVRoZW1lTGlzdFtdPiB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmNhY2hlVGhlbWVMaXN0ICE9PSAndW5kZWZpbmVkJyAmJiBEYXRlLm5vdygpIC0gdGhpcy5jYWNoZVRoZW1lTGlzdCA8IDIwMDApIHtcbiAgICAgIHJldHVybiAodGhpcy5UaGVtZUxpc3QpO1xuICAgIH1cbiAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICBsZXQgZGF0YSA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KCdUaGVtZUxpc3RHZXQnKTtcbiAgICAgIGlmIChkYXRhLlN0YXR1cyA9PT0gMCkge1xuICAgICAgICB0aGlzLmNhY2hlVGhlbWVMaXN0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgdGhpcy5wcm9jZXNzVGhlbWVMaXN0R2V0KGRhdGEgYXMgSVRoZW1lTGlzdFJlc3ApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuVGhlbWVMaXN0O1xuICAgIH0pXG4gIH1cbiAgcHJvdGVjdGVkIHByb2Nlc3NUaGVtZUxpc3RHZXQoZGF0YTogSVRoZW1lTGlzdFJlc3ApOiB2b2lkIHtcbiAgICB0aGlzLlRoZW1lTGlzdCA9IGRhdGEuVGhlbWVMaXN0O1xuICAgIGZvciAodmFyIGkgaW4gdGhpcy5UaGVtZUxpc3QpIHtcbiAgICAgIHRoaXMuVGhlbWVMaXN0W2ldLmlzT24gPSB0aGlzLlRoZW1lTGlzdFtpXS5Pbk9mZiA9PT0gMTtcbiAgICAgIHRoaXMuVGhlbWVMaXN0W2ldLnR5cGUgPSBJTGlnaHRUeXBlLlRIRU1FO1xuICAgIH1cbiAgfVxuICBwdWJsaWMgYXN5bmMgR2V0VGhlbWVBc3luYyhpbmRleDogbnVtYmVyKTogUHJvbWlzZTxJVGhlbWVMaXN0PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuVGhlbWVMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgZm9yIChsZXQgaSBpbiB0aGlzLlRoZW1lTGlzdCkge1xuICAgICAgICAgIGlmICh0aGlzLlRoZW1lTGlzdFtpXS5UaGVtZUluZGV4ID09PSBpbmRleCkgcmV0dXJuIHJlc29sdmUodGhpcy5UaGVtZUxpc3RbaV0pO1xuICAgICAgICB9XG4gICAgICAgIHJlamVjdChgTm8gVGhlbWUgRm91bmQgaW4gVGhlbWVHZXRBc3luYyBmb3IgdGhlbWUgJHtpbmRleH0uXFxuJHtKU09OLnN0cmluZ2lmeSh0aGlzLlRoZW1lTGlzdCl9YClcbiAgICAgIH1cbiAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5sb2cuZXJyb3IoZXJyKTtcbiAgICAgICAgcmVqZWN0KGBFcnJvciB3aXRoIEdldFRoZW1lQXN5bmMgJHtlcnJ9YClcbiAgICAgIH1cbiAgICB9KVxuXG4gIH1cbiAgYXN5bmMgSWxsdW1pbmF0ZVRoZW1lQXN5bmModGhlbWVJbmRleDogbnVtYmVyLCBvbk9mZjogbnVtYmVyKTogUHJvbWlzZTxJU3RhdHVzPiB7XG4gICAgcmV0dXJuIFF1ZXVlLmVucXVldWUoYXN5bmMgKCkgPT4ge1xuICAgICAgbGV0IHN0YXR1cyA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KCdJbGx1bWluYXRlVGhlbWUnLCB7XG4gICAgICAgICdUaGVtZUluZGV4JzogdGhlbWVJbmRleCxcbiAgICAgICAgJ09uT2ZmJzogb25PZmZcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jYWNoZVRoZW1lTGlzdCA9IHVuZGVmaW5lZDtcbiAgICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4geyBhd2FpdCB0aGlzLnVwZGF0ZUxpZ2h0cygpIH0sIDI1MCk7XG4gICAgICByZXR1cm4gc3RhdHVzO1xuICAgIH0pXG4gIH1cbiAgYXN5bmMgSWxsdW1pbmF0ZUdyb3VwQXN5bmMoZ3JvdXBOdW1iZXI6IG51bWJlciwgZGVzaXJlZEludGVuc2l0eTogbnVtYmVyKTogUHJvbWlzZTxJU3RhdHVzPiB7XG4gICAgcmV0dXJuIFF1ZXVlLmVucXVldWUoYXN5bmMgKCkgPT4ge1xuICAgICAgbGV0IHN0YXR1cyA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KCdJbGx1bWluYXRlR3JvdXAnLCB7XG4gICAgICAgICdHcm91cE51bWJlcic6IGdyb3VwTnVtYmVyLFxuICAgICAgICAnSW50ZW5zaXR5JzogZGVzaXJlZEludGVuc2l0eVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gc3RhdHVzO1xuICAgIH0pXG4gIH1cbiAgYXN5bmMgQ29sb3JMaXN0R2V0QXN5bmMoKTogUHJvbWlzZTxJQ29sb3JMaXN0W10+IHtcbiAgICByZXR1cm4ge30gYXMgSUNvbG9yTGlzdFtdO1xuICB9XG4gIGFzeW5jIENvbG9yTGlzdFNldEFzeW5jKGNvbG9yOiBudW1iZXIsIGh1ZTogbnVtYmVyLCBzYXR1cmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPElTdGF0dXM+IHtcbiAgICByZXR1cm4ge30gYXMgSVN0YXR1cztcbiAgfVxuICBwcm9jZXNzQ29sb3JMaXN0R2V0KGRhdGE6IElDb2xvckxpc3RSZXNwKSB7XG4gICAgdGhpcy5Db2xvckxpc3QgPSBkYXRhLkNvbG9yTGlzdDtcbiAgfTtcbiAgYXN5bmMgR2V0Q29sb3JBc3luYyhjb2xvcjogbnVtYmVyKTogUHJvbWlzZTxJQ29sb3JMaXN0PiB7IHJldHVybiB7fSBhcyBJQ29sb3JMaXN0OyB9XG5cbiAgcmVnaXN0ZXJDYWxsYmFjayhVVUlEOiBzdHJpbmcsIHR5cGU6IElMaWdodFR5cGUsIGluZGV4OiBudW1iZXIsIGNoYXJhY3RlcmlzdGljOiBhbnksIGZuOiAoKSA9PiB7fSkge1xuICAgIC8vIGxvb2sgZm9yIGFuIGV4aXN0aW5nIFVVSUQvY2hhcmFjdGVyaXN0aWMgcGFpciBhbmQgdXBkYXRlIHRoYXQgaWYgdGhlIGxpZ2h0IGF0dHJpYnV0ZXMgZ2V0IHVwZGF0ZXNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2FsbGJhY2tMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrTGlzdFtpXTtcbiAgICAgIGlmIChjYWxsYmFjay5VVUlEID09IFVVSUQgJiYgY2FsbGJhY2suY2hhcmFjdGVyaXN0aWMgPT09IGNoYXJhY3RlcmlzdGljKSB7XG4gICAgICAgIGNhbGxiYWNrID0geyBVVUlELCB0eXBlLCBpbmRleCwgY2hhcmFjdGVyaXN0aWMsIGZuIH07XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gbm90IGZvdW5kLCBhZGQgYSBuZXcgY2FsbGJhY2suXG4gICAgdGhpcy5jYWxsYmFja0xpc3QucHVzaCh7IFVVSUQsIHR5cGUsIGluZGV4LCBjaGFyYWN0ZXJpc3RpYywgZm4gfSk7XG4gIH1cbiAgZXhlY0NhbGxiYWNrcygpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY2FsbGJhY2tMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrTGlzdFtpXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN3aXRjaCAoY2FsbGJhY2sudHlwZSkge1xuICAgICAgICAgIGNhc2UgSUxpZ2h0VHlwZS5aRDpcbiAgICAgICAgICBjYXNlIElMaWdodFR5cGUuWkRDOlxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrLmNoYXJhY3RlcmlzdGljLm5hbWUgPT09IHRoaXMucGxhdGZvcm0uQ2hhcmFjdGVyaXN0aWMuQnJpZ2h0bmVzcy5uYW1lKSB7XG4gICAgICAgICAgICAgIGZvciAobGV0IGkgaW4gdGhpcy5Hcm91cExpc3QpeyAvLyBuZWVkIHRvIHVzZSBsb29wIGFzIHRoZXNlIGFyZSBub3QgMCBiYXNlZCBpbmRleGVzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuR3JvdXBMaXN0W2ldLkdyb3VwTnVtYmVyID09PSBjYWxsYmFjay5pbmRleCl7XG4gICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuR3JvdXBMaXN0W2ldLkludGVuc2l0eSAhPT0gJ3VuZGVmaW5lZCcpIGNhbGxiYWNrLmZuKHRoaXMuR3JvdXBMaXN0W2ldLkludGVuc2l0eSk7XG4gICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gbGV0IGdyb3VwID0gdGhpcy5Hcm91cExpc3QuZmluZChnPT5nLkdyb3VwTnVtYmVyID09PSBjYWxsYmFjay5pbmRleCwgdGhpcy5Hcm91cExpc3QpO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgSUxpZ2h0VHlwZS5USEVNRTpcbiAgICAgICAgICAgIGlmIChjYWxsYmFjay5jaGFyYWN0ZXJpc3RpYy5uYW1lID09PSB0aGlzLnBsYXRmb3JtLkNoYXJhY3RlcmlzdGljLk9uLm5hbWUpIHtcbiAgICAgICAgICAgICAgZm9yIChsZXQgaSBpbiB0aGlzLkdyb3VwTGlzdCl7IC8vIG5lZWQgdG8gdXNlIGxvb3AgYXMgdGhlc2UgYXJlIG5vdCAwIGJhc2VkIGluZGV4ZXNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5UaGVtZUxpc3RbaV0uVGhlbWVJbmRleCA9PT0gY2FsbGJhY2suaW5kZXgpe1xuICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLlRoZW1lTGlzdFtpXS5Pbk9mZiAhPT0gJ3VuZGVmaW5lZCcpIGNhbGxiYWNrLmZuKHRoaXMuVGhlbWVMaXN0W2ldLk9uT2ZmID09PSAxKTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5sb2cuZXJyb3IoYGV4ZWNDYWxsYmFja3M6ICR7ZXJyfWApXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jIHVwZGF0ZUxpZ2h0cyhmb3JjZTogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgaWYgKGZvcmNlKSB7XG4gICAgICB0aGlzLmNhY2hlR3JvdXBMaXN0ID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jYWNoZVRoZW1lTGlzdCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5Hcm91cExpc3RHZXRBc3luYygpO1xuICAgIGF3YWl0IHRoaXMuVGhlbWVMaXN0R2V0QXN5bmMoKTtcbiAgICB0aGlzLmV4ZWNDYWxsYmFja3MoKTtcbiAgfVxuICBhc3luYyBwb2xsQ29udHJvbGxlcigpIHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVMaWdodHMoKTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycikgeyB0aGlzLmxvZy5lcnJvcihgJHt0aGlzLm5hbWV9IGVycm9yOiAke2Vycn1gKSB9XG4gICAgZmluYWxseSB7IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4geyBhd2FpdCB0aGlzLnBvbGxDb250cm9sbGVyKCkgfSwgMzAgKiAxMDAwKTsgfVxuICB9XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJR3JvdXBMaXN0UmVzcCB7XG4gIFN0YXR1czogbnVtYmVyO1xuICBTdGF0dXNTdHI6IHN0cmluZztcbiAgR3JvdXBMaXN0OiBJR3JvdXBMaXN0W107XG59XG5leHBvcnQgaW50ZXJmYWNlIElHcm91cExpc3Qge1xuICBOYW1lOiBzdHJpbmc7XG4gIEdycD86IG51bWJlcjtcbiAgR3JvdXBOdW1iZXI/OiBudW1iZXI7XG4gIENvbHI/OiBudW1iZXI7XG4gIENvbG9yPzogbnVtYmVyO1xuICBJbnRlbj86IG51bWJlcjtcbiAgSW50ZW5zaXR5PzogbnVtYmVyO1xuICB0eXBlOiBJTGlnaHRUeXBlO1xuICBVVUlEPzogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBJU3RhdHVzIHtcbiAgU3RhdHVzOiBudW1iZXI7XG4gIFN0YXR1c1N0cjogc3RyaW5nO1xufVxuZXhwb3J0IGludGVyZmFjZSBJVGhlbWVMaXN0UmVzcCB7XG4gIFN0YXR1czogbnVtYmVyO1xuICBTdGF0dXNTdHI6IHN0cmluZztcbiAgUmVzdHJpY3RlZDogMCB8IDE7XG4gIFRoZW1lTGlzdDogSVRoZW1lTGlzdFtdO1xufVxuZXhwb3J0IGludGVyZmFjZSBJVGhlbWVMaXN0IHtcbiAgTmFtZTogc3RyaW5nO1xuICBUaGVtZUluZGV4OiBudW1iZXI7XG4gIE9uT2ZmOiAwIHwgMTtcbiAgaXNPbjogYm9vbGVhbjtcbiAgdHlwZT86IElMaWdodFR5cGU7XG4gIFVVSUQ/OiBzdHJpbmc7XG59XG5leHBvcnQgaW50ZXJmYWNlIElDb2xvckxpc3RSZXNwIHtcbiAgU3RhdHVzOiBudW1iZXI7XG4gIFN0YXR1c1N0cjogc3RyaW5nO1xuICBMaXN0U2l6ZTogbnVtYmVyO1xuICBDb2xvckxpc3Q6IElDb2xvckxpc3RbXTtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbG9yTGlzdCB7XG4gIEM6IG51bWJlcjtcbiAgSHVlOiBudW1iZXI7XG4gIFNhdDogbnVtYmVyO1xufVxuZXhwb3J0IGVudW0gSUNvbnRyb2xsZXJUeXBlIHtcbiAgWkQgPSAnWkQnLCBaREMgPSAnWkRDJywgWkRUV08gPSAnWkRUV08nXG59Il19