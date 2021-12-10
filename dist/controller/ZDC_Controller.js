"use strict";
/* jshint node: true */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZDC_Controller = void 0;
const ZD_Light_1 = require("../lights/ZD_Light");
const BaseController_1 = require("./BaseController");
const Queue_1 = __importDefault(require("../Queue"));
class ZDC_Controller extends BaseController_1.BaseController {
    constructor(data, log) {
        super(data, log);
    }
    processGroupListGet(data) {
        // Get the list of light groups from the controller
        // ZDC supports Groups 1-250, Intensity 0-100, Color 0-250 and color wheel 251-26 (no color wheel support here)
        // ZDTWO supports Groups 1-250, Intensity 0-100, Colors 0-250 and color wheel 251-260 (no color wheel support here) & DMX 65535
        if (typeof data.GroupList === 'undefined' || data.GroupList.length === 0)
            return;
        if (typeof data.GroupList[0] === 'undefined')
            return; // shortcut return if we are passed cached (already processed) results
        for (let i = 0; i < data.GroupList.length; i++) {
            let grp = data.GroupList[i];
            if (grp.Colr >= 251) {
                this.log.warn(`A color value of ${grp.Colr} was found for the color of light group ${grp.GroupNumber}.  Values of 251-260 are ColorWheels and 65535 means the controller is under DMX Group control.  Please select a color 0-250 for this group to work in Homebridge.`);
            }
            else {
                let g = this.GroupList[grp.Grp] = typeof this.GroupList[grp.Grp] === 'undefined' ? {} : this.GroupList[grp.Grp];
                if (typeof grp.Name !== 'undefined')
                    g.Name = grp.Name;
                if (typeof grp.Grp !== 'undefined')
                    g.GroupNumber = grp.Grp;
                if (typeof grp.Inten !== 'undefined')
                    g.Intensity = grp.Inten;
                if (typeof grp.Colr !== 'undefined') {
                    g.Color = grp.Colr;
                    g.type = typeof grp.Colr === 'undefined' || grp.Colr === 0 ? ZD_Light_1.ILightType.ZD : ZD_Light_1.ILightType.ZDC;
                }
            }
        }
    }
    async ColorListSetAsync(color, hue, saturation) {
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
        return Queue_1.default.enqueue(async () => {
            let status = await this.doRequest('ColorListSet', requestData);
            return status;
        });
        /*         let status = await this.queueRequest('ColorListSet', requestData);
                return status; */
    }
    async ColorListGetAsync() {
        // Same in ZDC/ZDTWO
        if (typeof this.cacheColorList !== 'undefined' && Date.now() - this.cacheColorList < 2000) {
            return (this.ColorList);
        }
        return Queue_1.default.enqueue(async () => {
            let data = await this.doRequest('ColorListGet');
            if (data.Status === 0) {
                this.cacheColorList = Date.now();
                this.processColorListGet(data);
            }
            return this.ColorList;
        });
    }
    async GetColorAsync(color) {
        return new Promise(async (resolve, reject) => {
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
                reject(`No valid colors found or available.  Status: ${status.StatusStr}`);
            }
            catch (err) {
                this.log.error(`Error with GetColorAsync: ${err}`);
            }
        });
    }
    execCallbacks() {
        super.execCallbacks();
        for (let i = 0; i < this.callbackList.length; i++) {
            let callback = this.callbackList[i];
            try {
                switch (callback.type) {
                    case ZD_Light_1.ILightType.ZDC:
                        if (callback.characteristic.name === this.platform.Characteristic.Hue.name) {
                            for (let i in this.GroupList) { // need to use loop as these are not 0 based indexes
                                if (this.GroupList[i].GroupNumber === callback.index) {
                                    for (let j in this.ColorList) { // need to use loop as these are not 0 based indexes
                                        if (this.ColorList[j].C === callback.index) {
                                            if (typeof this.ColorList[j].Hue !== 'undefined')
                                                callback.fn(this.ColorList[j].Hue);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        if (callback.characteristic.name === this.platform.Characteristic.Saturation.name) {
                            for (let i in this.GroupList) { // need to use loop as these are not 0 based indexes
                                if (this.GroupList[i].GroupNumber === callback.index) {
                                    for (let j in this.ColorList) { // need to use loop as these are not 0 based indexes
                                        if (this.ColorList[j].C === callback.index) {
                                            if (typeof this.ColorList[j].Sat !== 'undefined')
                                                callback.fn(this.ColorList[j].Sat);
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
    async updateLights(force = false) {
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
exports.ZDC_Controller = ZDC_Controller;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWkRDX0NvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlci9aRENfQ29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsdUJBQXVCOzs7Ozs7QUFFdkIsaURBQWdEO0FBQ2hELHFEQUFtSDtBQUNuSCxxREFBNkI7QUFFN0IsTUFBYSxjQUFlLFNBQVEsK0JBQWM7SUFFOUMsWUFBWSxJQUFJLEVBQUUsR0FBRztRQUNqQixLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLENBQUM7SUFFUyxtQkFBbUIsQ0FBQyxJQUFvQjtRQUM5QyxtREFBbUQ7UUFDbkQsK0dBQStHO1FBQy9HLCtIQUErSDtRQUMvSCxJQUFJLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU87UUFDakYsSUFBSSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssV0FBVztZQUFFLE9BQU8sQ0FBRSxzRUFBc0U7UUFDN0gsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUIsSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsRUFBRTtnQkFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxJQUFJLDJDQUEyQyxHQUFHLENBQUMsV0FBVyxvS0FBb0ssQ0FBQyxDQUFDO2FBQzdRO2lCQUNJO2dCQUNELElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sSUFBSSxD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QUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDOzRDQUN2RixNQUFNO3lDQUNQO3FDQUNGO2lDQUNOOzZCQUNGO3lCQUNOO3dCQUNELE1BQU07aUJBQ2I7YUFDSjtZQUNELE9BQU8sR0FBRyxFQUFFO2FBQ1g7U0FDSjtJQUNMLENBQUM7SUFDRCxLQUFLLENBQUMsWUFBWSxDQUFDLFFBQWlCLEtBQUs7UUFDckMsSUFBSSxLQUFLLEVBQUU7WUFDUCxJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUNoQyxJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUNoQyxJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztTQUNuQztRQUNELE1BQU0sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDL0IsTUFBTSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUMvQixNQUFNLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN6QixDQUFDO0NBQ0o7QUE3SUQsd0NBNklDIiwic291cmNlc0NvbnRlbnQiOlsiLyoganNoaW50IG5vZGU6IHRydWUgKi9cblxuaW1wb3J0IHsgSUxpZ2h0VHlwZSB9IGZyb20gJy4uL2xpZ2h0cy9aRF9MaWdodCc7XG5pbXBvcnQgeyBCYXNlQ29udHJvbGxlciwgSUNvbG9yTGlzdCwgSUNvbG9yTGlzdFJlc3AsIElHcm91cExpc3QsIElHcm91cExpc3RSZXNwLCBJU3RhdHVzIH0gZnJvbSAnLi9CYXNlQ29udHJvbGxlcic7XG5pbXBvcnQgUXVldWUgZnJvbSBcIi4uL1F1ZXVlXCI7XG5cbmV4cG9ydCBjbGFzcyBaRENfQ29udHJvbGxlciBleHRlbmRzIEJhc2VDb250cm9sbGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGRhdGEsIGxvZykge1xuICAgICAgICBzdXBlcihkYXRhLCBsb2cpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBwcm9jZXNzR3JvdXBMaXN0R2V0KGRhdGE6IElHcm91cExpc3RSZXNwKSB7XG4gICAgICAgIC8vIEdldCB0aGUgbGlzdCBvZiBsaWdodCBncm91cHMgZnJvbSB0aGUgY29udHJvbGxlclxuICAgICAgICAvLyBaREMgc3VwcG9ydHMgR3JvdXBzIDEtMjUwLCBJbnRlbnNpdHkgMC0xMDAsIENvbG9yIDAtMjUwIGFuZCBjb2xvciB3aGVlbCAyNTEtMjYgKG5vIGNvbG9yIHdoZWVsIHN1cHBvcnQgaGVyZSlcbiAgICAgICAgLy8gWkRUV08gc3VwcG9ydHMgR3JvdXBzIDEtMjUwLCBJbnRlbnNpdHkgMC0xMDAsIENvbG9ycyAwLTI1MCBhbmQgY29sb3Igd2hlZWwgMjUxLTI2MCAobm8gY29sb3Igd2hlZWwgc3VwcG9ydCBoZXJlKSAmIERNWCA2NTUzNVxuICAgICAgICBpZiAodHlwZW9mIGRhdGEuR3JvdXBMaXN0ID09PSAndW5kZWZpbmVkJyB8fCBkYXRhLkdyb3VwTGlzdC5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhLkdyb3VwTGlzdFswXSA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjsgIC8vIHNob3J0Y3V0IHJldHVybiBpZiB3ZSBhcmUgcGFzc2VkIGNhY2hlZCAoYWxyZWFkeSBwcm9jZXNzZWQpIHJlc3VsdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLkdyb3VwTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGdycCA9IGRhdGEuR3JvdXBMaXN0W2ldO1xuICAgICAgICAgICAgaWYgKGdycC5Db2xyID49IDI1MSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLndhcm4oYEEgY29sb3IgdmFsdWUgb2YgJHtncnAuQ29scn0gd2FzIGZvdW5kIGZvciB0aGUgY29sb3Igb2YgbGlnaHQgZ3JvdXAgJHtncnAuR3JvdXBOdW1iZXJ9LiAgVmFsdWVzIG9mIDI1MS0yNjAgYXJlIENvbG9yV2hlZWxzIGFuZCA2NTUzNSBtZWFucyB0aGUgY29udHJvbGxlciBpcyB1bmRlciBETVggR3JvdXAgY29udHJvbC4gIFBsZWFzZSBzZWxlY3QgYSBjb2xvciAwLTI1MCBmb3IgdGhpcyBncm91cCB0byB3b3JrIGluIEhvbWVicmlkZ2UuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZyA9IHRoaXMuR3JvdXBMaXN0W2dycC5HcnBdID0gdHlwZW9mIHRoaXMuR3JvdXBMaXN0W2dycC5HcnBdID09PSAndW5kZWZpbmVkJyA/IHt9IGFzIGFueSA6IHRoaXMuR3JvdXBMaXN0W2dycC5HcnBdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZ3JwLk5hbWUgIT09ICd1bmRlZmluZWQnKSBnLk5hbWUgPSBncnAuTmFtZTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGdycC5HcnAgIT09ICd1bmRlZmluZWQnKSBnLkdyb3VwTnVtYmVyID0gZ3JwLkdycDtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGdycC5JbnRlbiAhPT0gJ3VuZGVmaW5lZCcpIGcuSW50ZW5zaXR5ID0gZ3JwLkludGVuO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZ3JwLkNvbHIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGcuQ29sb3IgPSBncnAuQ29scjtcbiAgICAgICAgICAgICAgICAgICAgZy50eXBlID0gdHlwZW9mIGdycC5Db2xyID09PSAndW5kZWZpbmVkJyB8fCBncnAuQ29sciA9PT0gMCA/IElMaWdodFR5cGUuWkQgOiBJTGlnaHRUeXBlLlpEQztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBDb2xvckxpc3RTZXRBc3luYyhjb2xvcjogbnVtYmVyLCBodWU6IG51bWJlciwgc2F0dXJhdGlvbjogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gU2FtZSBpbiBaREMvWkRUV09cbiAgICAgICAgdmFyIHJlcXVlc3REYXRhID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLy8gYXNzaWduIHRoZSBjb2xvcnMgaW4gdGhlIHJldmVyc2Ugb3JkZXIgb2YgdGhlaXIgZ3JvdXBzLi4uXG4gICAgICAgICAgICAvLyBncm91cCAxID0gY29sb3IgMjUwXG4gICAgICAgICAgICAvLyBncm91cCAyID0gY29sb3IgMjQ5XG4gICAgICAgICAgICAvLyBldGNcbiAgICAgICAgICAgICdDJzogY29sb3IsXG4gICAgICAgICAgICAnSHVlJzogaHVlLFxuICAgICAgICAgICAgJ1NhdCc6IHNhdHVyYXRpb25cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBRdWV1ZS5lbnF1ZXVlKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLmRvUmVxdWVzdCgnQ29sb3JMaXN0U2V0JywgcmVxdWVzdERhdGEpO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICAgICAgfSlcblxuICAgICAgICAvKiAgICAgICAgIGxldCBzdGF0dXMgPSBhd2FpdCB0aGlzLnF1ZXVlUmVxdWVzdCgnQ29sb3JMaXN0U2V0JywgcmVxdWVzdERhdGEpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0dXM7ICovXG4gICAgfVxuICAgIGFzeW5jIENvbG9yTGlzdEdldEFzeW5jKCk6IFByb21pc2U8SUNvbG9yTGlzdFtdPiB7XG4gICAgICAgIC8vIFNhbWUgaW4gWkRDL1pEVFdPXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5jYWNoZUNvbG9yTGlzdCAhPT0gJ3VuZGVmaW5lZCcgJiYgRGF0ZS5ub3coKSAtIHRoaXMuY2FjaGVDb2xvckxpc3QgPCAyMDAwKSB7XG4gICAgICAgICAgICByZXR1cm4gKHRoaXMuQ29sb3JMaXN0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUXVldWUuZW5xdWV1ZShhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZGF0YSA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KCdDb2xvckxpc3RHZXQnKTtcbiAgICAgICAgICAgIGlmIChkYXRhLlN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY2FjaGVDb2xvckxpc3QgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc0NvbG9yTGlzdEdldChkYXRhIGFzIElDb2xvckxpc3RSZXNwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLkNvbG9yTGlzdDtcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhc3luYyBHZXRDb2xvckFzeW5jKGNvbG9yOiBudW1iZXIpOiBQcm9taXNlPElDb2xvckxpc3Q+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpOiBQcm9taXNlPElDb2xvckxpc3Q+ID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5Db2xvckxpc3RHZXRBc3luYygpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGNvbG9ySWQgaW4gdGhpcy5Db2xvckxpc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuQ29sb3JMaXN0W2NvbG9ySWRdLkMgPT09IGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKFByb21pc2UucmVzb2x2ZSh0aGlzLkNvbG9yTGlzdFtjb2xvcklkXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFdlIGdldCBoZXJlIGlmIHRoZSBjb2xvciBpc24ndCBmb3VuZCBmb3Igc29tZSByZWFzb25cbiAgICAgICAgICAgICAgICBsZXQgc3RhdHVzID0gYXdhaXQgdGhpcy5Db2xvckxpc3RTZXRBc3luYyhjb2xvciwgMzYwLCAxMDApO1xuICAgICAgICAgICAgICAgIGlmIChzdGF0dXMuU3RhdHVzU3RyID09PSAnT2snKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJDXCI6IGNvbG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJIdWVcIjogMzYwLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJTYXRcIjogMTAwXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlamVjdChgTm8gdmFsaWQgY29sb3JzIGZvdW5kIG9yIGF2YWlsYWJsZS4gIFN0YXR1czogJHtzdGF0dXMuU3RhdHVzU3RyfWApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoYEVycm9yIHdpdGggR2V0Q29sb3JBc3luYzogJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuICAgIGV4ZWNDYWxsYmFja3MoKTogdm9pZCB7XG4gICAgICAgIHN1cGVyLmV4ZWNDYWxsYmFja3MoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNhbGxiYWNrTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGNhbGxiYWNrID0gdGhpcy5jYWxsYmFja0xpc3RbaV07XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoY2FsbGJhY2sudHlwZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgSUxpZ2h0VHlwZS5aREM6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suY2hhcmFjdGVyaXN0aWMubmFtZSA9PT0gdGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5IdWUubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgaW4gdGhpcy5Hcm91cExpc3QpeyAvLyBuZWVkIHRvIHVzZSBsb29wIGFzIHRoZXNlIGFyZSBub3QgMCBiYXNlZCBpbmRleGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLkdyb3VwTGlzdFtpXS5Hcm91cE51bWJlciA9PT0gY2FsbGJhY2suaW5kZXgpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiBpbiB0aGlzLkNvbG9yTGlzdCl7IC8vIG5lZWQgdG8gdXNlIGxvb3AgYXMgdGhlc2UgYXJlIG5vdCAwIGJhc2VkIGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5Db2xvckxpc3Rbal0uQyA9PT0gY2FsbGJhY2suaW5kZXgpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuQ29sb3JMaXN0W2pdLkh1ZSAhPT0gJ3VuZGVmaW5lZCcpIGNhbGxiYWNrLmZuKHRoaXMuQ29sb3JMaXN0W2pdLkh1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSAgXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2suY2hhcmFjdGVyaXN0aWMubmFtZSA9PT0gdGhpcy5wbGF0Zm9ybS5DaGFyYWN0ZXJpc3RpYy5TYXR1cmF0aW9uLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpIGluIHRoaXMuR3JvdXBMaXN0KXsgLy8gbmVlZCB0byB1c2UgbG9vcCBhcyB0aGVzZSBhcmUgbm90IDAgYmFzZWQgaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5Hcm91cExpc3RbaV0uR3JvdXBOdW1iZXIgPT09IGNhbGxiYWNrLmluZGV4KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogaW4gdGhpcy5Db2xvckxpc3QpeyAvLyBuZWVkIHRvIHVzZSBsb29wIGFzIHRoZXNlIGFyZSBub3QgMCBiYXNlZCBpbmRleGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuQ29sb3JMaXN0W2pdLkMgPT09IGNhbGxiYWNrLmluZGV4KXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLkNvbG9yTGlzdFtqXS5TYXQgIT09ICd1bmRlZmluZWQnKSBjYWxsYmFjay5mbih0aGlzLkNvbG9yTGlzdFtqXS5TYXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyB1cGRhdGVMaWdodHMoZm9yY2U6IGJvb2xlYW4gPSBmYWxzZSkge1xuICAgICAgICBpZiAoZm9yY2UpIHtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVDb2xvckxpc3QgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB0aGlzLmNhY2hlR3JvdXBMaXN0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGhpcy5jYWNoZVRoZW1lTGlzdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCB0aGlzLkdyb3VwTGlzdEdldEFzeW5jKCk7XG4gICAgICAgIGF3YWl0IHRoaXMuVGhlbWVMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgYXdhaXQgdGhpcy5Db2xvckxpc3RHZXRBc3luYygpO1xuICAgICAgICB0aGlzLmV4ZWNDYWxsYmFja3MoKTtcbiAgICB9XG59Il19