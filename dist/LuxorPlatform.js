"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuxorPlatform = void 0;
const axios = require('axios').default;
const BaseController_1 = require("./controller/BaseController");
const ControllerFactory_1 = require("./controller/ControllerFactory");
const LightFactory_1 = require("./lights/LightFactory");
const ZD_Light_1 = require("./lights/ZD_Light");
class LuxorPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.currGroupsAndThemes = [];
        this.config = config;
        this.log = log;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.Name = config.name;
        this.lastDateAdded = Date.now();
        this.controller = ControllerFactory_1.ControllerFactory.createController({ type: 'base' }, this.log);
        if (api) {
            // Save the API object as plugin needs to register new this.api.platformAccessory via this object.
            this.api = api;
            // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
            // Platform Plugin should only register new this.api.platformAccessory that doesn't exist in homebridge after this event.
            // Or start discover new accessories
            this.api.on('didFinishLaunching', this.didFinishLaunchingAsync.bind(this));
        }
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Function invoked when homebridge tries to restore cached accessory
    // Developer can configure accessory at here (like setup event handler)
    configureAccessory(accessory) {
        this.log.debug(`Retrieved cached accessory ${accessory.displayName} with UUID ${accessory.UUID}`);
        this.accessories[accessory.UUID] = accessory;
    }
    async getControllerAsync() {
        // get the name of the controller
        this.log.info(this.Name + ": Starting search for controller at: " + this.config.ipAddr);
        try {
            //Search for controllor and make sure we can find it
            const response = await axios({
                method: 'post',
                url: 'http://' + this.config.ipAddr + '/ControllerName.json',
                timeout: this.config.commandTimeout || 750
            });
            if (response.status !== 200) {
                this.log.error('Received a status code of ' + response.status + ' when trying to connect to the controller.');
                return false;
            }
            let controllerNameData = response.data;
            controllerNameData.ip = this.config.ipAddr;
            controllerNameData.platform = this;
            controllerNameData.commandTimeout = this.config.commandTimeout;
            if (controllerNameData.Controller.substring(0, 5) === 'luxor') {
                controllerNameData.type = BaseController_1.IControllerType.ZD;
            }
            else if (controllerNameData.Controller.substring(0, 5) === 'lxzdc') {
                controllerNameData.type = BaseController_1.IControllerType.ZDC;
            }
            else if (controllerNameData.Controller.substring(0, 5) === 'lxtwo') {
                controllerNameData.type = BaseController_1.IControllerType.ZDTWO;
            }
            else {
                controllerNameData.type = BaseController_1.IControllerType.ZDTWO;
                this.log.info('Found unknown controller named %s of type %s, assuming a ZDTWO', controllerNameData.Controller, controllerNameData.type);
            }
            this.log.info(`Found Controller named ${controllerNameData.Controller} of type ${controllerNameData.type}.`);
            this.controller = ControllerFactory_1.ControllerFactory.createController(controllerNameData, this.log);
            return true;
        }
        catch (err) {
            this.log.error(this.Name + ' was not able to connect to connect to the controller. ', err);
            return false;
        }
        ;
    }
    async getControllerGroupListAsync() {
        // Get the list of light groups from the controller
        if (this.config.hideGroups)
            return;
        try {
            let groupLists = await this.controller.GroupListGetAsync();
            this.log.info(`Retrieved ${groupLists.length} light groups from controller.`);
            for (var i in groupLists) {
                this.currGroupsAndThemes.push(groupLists[i]);
            }
        }
        catch (err) {
            this.log.error(`was not able to retrieve light groups from controller.\n${err}\n${err}`);
        }
        ;
    }
    async getControllerThemeListAsync() {
        // Get the list of light LuxorThemes from the controller
        try {
            let themeLists = await this.controller.ThemeListGetAsync();
            this.log.info(`Retrieved ${themeLists.length} themes from controller.`);
            if (typeof this.config.noAllThemes !== 'undefined' && this.config.noAllThemes) {
                this.log.info(`Not creating Illuminate All and Extinguish All themes per config setting.`);
            }
            else {
                themeLists.push({
                    Name: 'Illuminate all lights',
                    ThemeIndex: 100,
                    OnOff: 0,
                    isOn: false,
                    type: ZD_Light_1.ILightType.THEME
                });
                themeLists.push({
                    Name: 'Extinguish all lights',
                    ThemeIndex: 101,
                    OnOff: 0,
                    isOn: false,
                    type: ZD_Light_1.ILightType.THEME
                });
            }
            for (var i in themeLists) {
                themeLists[i].type = ZD_Light_1.ILightType.THEME;
                this.currGroupsAndThemes.push(themeLists[i]);
            }
        }
        catch (err) {
            this.log.error('was not able to retrieve light themes from controller.', err);
        }
        ;
    }
    removeAccessories() {
        for (var UUID in this.accessories) {
            let accessory = this.accessories[UUID];
            if (typeof this.config.removeAllAccessories !== 'undefined' && this.config.removeAllAccessories || typeof this.config.removeAccessories !== 'undefined' && this.config.removeAccessories.includes(accessory.UUID)) {
                this.log.info(`Removing cached accessory ${accessory.displayName} with UUID ${accessory.UUID} per platform configuration settings.`);
                this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
                this.accessories = this.accessories.filter(item => item.UUID !== UUID);
            }
            ;
        }
    }
    addGroupAccessory(lightGroup) {
        var accessory = new this.api.platformAccessory(lightGroup.Name, lightGroup.UUID);
        let context = {
            lastDateAdded: this.lastDateAdded,
            color: lightGroup.Color,
            groupNumber: lightGroup.GroupNumber,
            brightness: lightGroup.Intensity,
            type: lightGroup.type,
            isOn: lightGroup.Intensity > 0,
            independentColors: this.config.independentColors,
            commandTimeout: this.config.commandTimeout
        };
        accessory.context = context;
        LightFactory_1.LightFactory.createLight(this, accessory);
        this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
    }
    addThemeAccessory(themeGroup) {
        var accessory = new this.api.platformAccessory(themeGroup.Name, themeGroup.UUID);
        let context = {
            lastDateAdded: this.lastDateAdded,
            type: ZD_Light_1.ILightType.THEME,
            isOn: themeGroup.OnOff === 1,
            themeIndex: themeGroup.ThemeIndex,
            OnOff: themeGroup.OnOff,
            commandTimeout: this.config.commandTimeout
        };
        accessory.context = context;
        LightFactory_1.LightFactory.createLight(this, accessory);
        this.accessories[accessory.UUID] = accessory;
        this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
    }
    assignUUIDs() {
        for (let i = 0; i < this.currGroupsAndThemes.length; i++) {
            let acc = this.currGroupsAndThemes[i];
            if (typeof acc.ThemeIndex !== 'undefined') {
                acc.UUID = this.api.hap.uuid.generate('luxor.' + `theme-${acc.ThemeIndex}`);
            }
            else {
                acc.UUID = this.api.hap.uuid.generate('luxor.' + `group.-${acc.GroupNumber}`);
            }
        }
    }
    async processAccessories() {
        this.assignUUIDs();
        this.removeAccessories();
        for (var UUID in this.accessories) {
            let cachedAcc = this.accessories[UUID];
            // look for match on current devices
            let remove = true;
            for (let j = 0; j < this.currGroupsAndThemes.length; j++) {
                let currAcc = this.currGroupsAndThemes[j];
                if (cachedAcc.UUID === currAcc.UUID) {
                    // found existing device
                    this.log.info(`Loading cached accessory ${cachedAcc.displayName} with UUID ${cachedAcc.UUID}.`);
                    // update cached device (name, etc)
                    let context = cachedAcc.context;
                    context.lastDateAdded = this.lastDateAdded;
                    if (typeof currAcc.Color !== 'undefined')
                        context.color = currAcc.Color;
                    if (typeof currAcc.GroupNumber !== 'undefined')
                        context.groupNumber = currAcc.GroupNumber;
                    if (typeof currAcc.ThemeIndex !== 'undefined')
                        context.themeIndex = currAcc.ThemeIndex;
                    if (typeof currAcc.Intensity !== 'undefined') {
                        context.brightness = currAcc.Intensity;
                        context.isOn = currAcc.Intensity > 0;
                    }
                    if (typeof currAcc.type !== 'undefined')
                        context.type = currAcc.type;
                    if (typeof currAcc.isOn !== 'undefined')
                        context.isOn = currAcc.isOn;
                    if (typeof currAcc.Name !== 'undefined')
                        cachedAcc.displayName = currAcc.Name;
                    cachedAcc.context = context;
                    this.api.updatePlatformAccessories([cachedAcc]);
                    LightFactory_1.LightFactory.createLight(this, cachedAcc);
                    this.currGroupsAndThemes.splice(j, 1);
                    remove = false;
                    break;
                }
            }
            // remove the cachedAcc that can't be matched
            if (remove) {
                this.log.info(`Removing cached accessory ${cachedAcc.displayName} with UUID ${cachedAcc.UUID}.`);
                this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [cachedAcc]);
            }
        }
        // add any new accessories that were not previously matched
        if (this.currGroupsAndThemes.length > 0) {
            for (let j = 0; j < this.currGroupsAndThemes.length; j++) {
                let currAcc = this.currGroupsAndThemes[j];
                this.log.info(`Adding new accessory ${currAcc.Name} with UUID ${currAcc.UUID}.`);
                if (currAcc.type === ZD_Light_1.ILightType.THEME)
                    this.addThemeAccessory(currAcc);
                else
                    this.addGroupAccessory(currAcc);
            }
        }
    }
    async didFinishLaunchingAsync() {
        if (!this.config.ipAddr) {
            this.log.error(this.Name + " needs an IP Address in the config file.  Please see sample_config.json.");
        }
        try {
            while (await this.getControllerAsync() == false) {
                this.log.info(`Unable to connect to Luxor controller.  Waiting 60s and will retry.`);
                await this.sleep(60 * 1000);
            }
            //this.retrieveCachedAccessories();
            await this.getControllerGroupListAsync();
            await this.getControllerThemeListAsync();
            await this.processAccessories();
            // this.removeOphanedAccessories();
            this.log.info('Finished initializing');
        }
        catch (err) {
            this.log.error('Error in didFinishLaunching', err);
        }
        ;
    }
}
exports.LuxorPlatform = LuxorPlatform;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTHV4b3JQbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9MdXhvclBsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFJdkMsZ0VBQXNHO0FBQ3RHLHNFQUFtRTtBQUNuRSx3REFBcUQ7QUFFckQsZ0RBQStDO0FBSS9DLE1BQWEsYUFBYTtJQVV0QixZQUNvQixHQUFXLEVBQ1gsTUFBc0IsRUFDdEIsR0FBUTtRQUZSLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUN0QixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBWjVCLG9EQUFvRDtRQUM3QyxnQkFBVyxHQUF3QixFQUFFLENBQUM7UUFNckMsd0JBQW1CLEdBQWdDLEVBQUUsQ0FBQztRQU8xRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ2xELElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLHFDQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUVoRixJQUFJLEdBQUcsRUFBRTtZQUNMLGtHQUFrRztZQUNsRyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FB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QUFDOztvQkFFaEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2FBQ3ZDO1NBQ0o7SUFDTCxDQUFDO0lBRUQsS0FBSyxDQUFDLHVCQUF1QjtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRywwRUFBMEUsQ0FBQyxDQUFDO1NBQzFHO1FBQ0QsSUFBSTtZQUNBLE9BQU8sTUFBTSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxLQUFLLEVBQUU7Z0JBQzdDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFFQUFxRSxDQUFDLENBQUE7Z0JBQ3BGLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUMsSUFBSSxDQUFDLENBQUM7YUFDN0I7WUFDRCxtQ0FBbUM7WUFDbkMsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztZQUN6QyxNQUFNLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDaEMsbUNBQW1DO1lBQ25DLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7U0FDMUM7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLDZCQUE2QixFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQ3REO1FBQUEsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQWhRRCxzQ0FnUUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJykuZGVmYXVsdDtcbmltcG9ydCB7IEF4aW9zUmVzcG9uc2UgfSBmcm9tICdheGlvcyc7XG5pbXBvcnQgeyBBUEksIENoYXJhY3RlcmlzdGljLCBEeW5hbWljUGxhdGZvcm1QbHVnaW4sIExvZ2dlciwgUGxhdGZvcm1BY2Nlc3NvcnksIFBsYXRmb3JtQ29uZmlnLCBTZXJ2aWNlIH0gZnJvbSAnaG9tZWJyaWRnZSc7XG5cbmltcG9ydCB7IEJhc2VDb250cm9sbGVyLCBJQ29udHJvbGxlclR5cGUsIElHcm91cExpc3QsIElUaGVtZUxpc3QgfSBmcm9tICcuL2NvbnRyb2xsZXIvQmFzZUNvbnRyb2xsZXInO1xuaW1wb3J0IHsgQ29udHJvbGxlckZhY3RvcnkgfSBmcm9tICcuL2NvbnRyb2xsZXIvQ29udHJvbGxlckZhY3RvcnknO1xuaW1wb3J0IHsgTGlnaHRGYWN0b3J5IH0gZnJvbSAnLi9saWdodHMvTGlnaHRGYWN0b3J5JztcbmltcG9ydCB7IFRoZW1lIH0gZnJvbSAnLi9saWdodHMvVGhlbWUnO1xuaW1wb3J0IHsgSUxpZ2h0VHlwZSB9IGZyb20gJy4vbGlnaHRzL1pEX0xpZ2h0JztcblxuXG5cbmV4cG9ydCBjbGFzcyBMdXhvclBsYXRmb3JtIGltcGxlbWVudHMgRHluYW1pY1BsYXRmb3JtUGx1Z2luIHtcbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gdHJhY2sgcmVzdG9yZWQgY2FjaGVkIGFjY2Vzc29yaWVzXG4gICAgcHVibGljIGFjY2Vzc29yaWVzOiBQbGF0Zm9ybUFjY2Vzc29yeVtdID0gW107XG4gICAgcHVibGljIGNvbnRyb2xsZXI6IEJhc2VDb250cm9sbGVyOy8vIHdpbGwgYmUgYXNzaWduZWQgdG8gWkQgb3IgWkRDIGNvbnRyb2xsZXJcbiAgICBwdWJsaWMgTmFtZTogc3RyaW5nO1xuICAgIHB1YmxpYyBsYXN0RGF0ZUFkZGVkOiBudW1iZXI7XG4gICAgcHVibGljIHJlYWRvbmx5IFNlcnZpY2U6IHR5cGVvZiBTZXJ2aWNlO1xuICAgIHB1YmxpYyByZWFkb25seSBDaGFyYWN0ZXJpc3RpYzogdHlwZW9mIENoYXJhY3RlcmlzdGljO1xuICAgIHByaXZhdGUgY3Vyckdyb3Vwc0FuZFRoZW1lczogSUdyb3VwTGlzdFtdICYgSVRoZW1lTGlzdFtdID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGxvZzogTG9nZ2VyLFxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnOiBQbGF0Zm9ybUNvbmZpZyxcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGFwaTogQVBJXG4gICAgKSB7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICAgICAgdGhpcy5TZXJ2aWNlID0gdGhpcy5hcGkuaGFwLlNlcnZpY2U7XG4gICAgICAgIHRoaXMuQ2hhcmFjdGVyaXN0aWMgPSB0aGlzLmFwaS5oYXAuQ2hhcmFjdGVyaXN0aWM7XG4gICAgICAgIHRoaXMuTmFtZSA9IGNvbmZpZy5uYW1lO1xuICAgICAgICB0aGlzLmxhc3REYXRlQWRkZWQgPSBEYXRlLm5vdygpO1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBDb250cm9sbGVyRmFjdG9yeS5jcmVhdGVDb250cm9sbGVyKHsgdHlwZTogJ2Jhc2UnIH0sIHRoaXMubG9nKVxuXG4gICAgICAgIGlmIChhcGkpIHtcbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIEFQSSBvYmplY3QgYXMgcGx1Z2luIG5lZWRzIHRvIHJlZ2lzdGVyIG5ldyB0aGlzLmFwaS5wbGF0Zm9ybUFjY2Vzc29yeSB2aWEgdGhpcyBvYmplY3QuXG4gICAgICAgICAgICB0aGlzLmFwaSA9IGFwaTtcblxuICAgICAgICAgICAgLy8gTGlzdGVuIHRvIGV2ZW50IFwiZGlkRmluaXNoTGF1bmNoaW5nXCIsIHRoaXMgbWVhbnMgaG9tZWJyaWRnZSBhbHJlYWR5IGZpbmlzaGVkIGxvYWRpbmcgY2FjaGVkIGFjY2Vzc29yaWVzXG4gICAgICAgICAgICAvLyBQbGF0Zm9ybSBQbHVnaW4gc2hvdWxkIG9ubHkgcmVnaXN0ZXIgbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5IHRoYXQgZG9lc24ndCBleGlzdCBpbiBob21lYnJpZGdlIGFmdGVyIHRoaXMgZXZlbnQuXG4gICAgICAgICAgICAvLyBPciBzdGFydCBkaXNjb3ZlciBuZXcgYWNjZXNzb3JpZXNcbiAgICAgICAgICAgIHRoaXMuYXBpLm9uKCdkaWRGaW5pc2hMYXVuY2hpbmcnLCB0aGlzLmRpZEZpbmlzaExhdW5jaGluZ0FzeW5jLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy8gRnVuY3Rpb24gaW52b2tlZCB3aGVuIGhvbWVicmlkZ2UgdHJpZXMgdG8gcmVzdG9yZSBjYWNoZWQgYWNjZXNzb3J5XG4gICAgLy8gRGV2ZWxvcGVyIGNhbiBjb25maWd1cmUgYWNjZXNzb3J5IGF0IGhlcmUgKGxpa2Ugc2V0dXAgZXZlbnQgaGFuZGxlcilcbiAgICBjb25maWd1cmVBY2Nlc3NvcnkoYWNjZXNzb3J5OiBQbGF0Zm9ybUFjY2Vzc29yeSkge1xuICAgICAgICB0aGlzLmxvZy5kZWJ1ZyhgUmV0cmlldmVkIGNhY2hlZCBhY2Nlc3NvcnkgJHthY2Nlc3NvcnkuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2FjY2Vzc29yeS5VVUlEfWApO1xuICAgICAgICB0aGlzLmFjY2Vzc29yaWVzW2FjY2Vzc29yeS5VVUlEXSA9IGFjY2Vzc29yeTtcbiAgICB9XG4gICAgYXN5bmMgZ2V0Q29udHJvbGxlckFzeW5jKCk6UHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIC8vIGdldCB0aGUgbmFtZSBvZiB0aGUgY29udHJvbGxlclxuXG4gICAgICAgIHRoaXMubG9nLmluZm8odGhpcy5OYW1lICsgXCI6IFN0YXJ0aW5nIHNlYXJjaCBmb3IgY29udHJvbGxlciBhdDogXCIgKyB0aGlzLmNvbmZpZy5pcEFkZHIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9TZWFyY2ggZm9yIGNvbnRyb2xsb3IgYW5kIG1ha2Ugc3VyZSB3ZSBjYW4gZmluZCBpdFxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcyh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgICAgICAgICAgdXJsOiAnaHR0cDovLycgKyB0aGlzLmNvbmZpZy5pcEFkZHIgKyAnL0NvbnRyb2xsZXJOYW1lLmpzb24nLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0IHx8IDc1MFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSAyMDApIHsgdGhpcy5sb2cuZXJyb3IoJ1JlY2VpdmVkIGEgc3RhdHVzIGNvZGUgb2YgJyArIHJlc3BvbnNlLnN0YXR1cyArICcgd2hlbiB0cnlpbmcgdG8gY29ubmVjdCB0byB0aGUgY29udHJvbGxlci4nKTsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICBsZXQgY29udHJvbGxlck5hbWVEYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS5pcCA9IHRoaXMuY29uZmlnLmlwQWRkcjtcbiAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS5wbGF0Zm9ybSA9IHRoaXM7XG4gICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEuY29tbWFuZFRpbWVvdXQgPSB0aGlzLmNvbmZpZy5jb21tYW5kVGltZW91dDtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlci5zdWJzdHJpbmcoMCwgNSkgPT09ICdsdXhvcicpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aRDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXIuc3Vic3RyaW5nKDAsIDUpID09PSAnbHh6ZGMnKSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkRDO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlci5zdWJzdHJpbmcoMCwgNSkgPT09ICdseHR3bycpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aRFRXTztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkRUV087XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbygnRm91bmQgdW5rbm93biBjb250cm9sbGVyIG5hbWVkICVzIG9mIHR5cGUgJXMsIGFzc3VtaW5nIGEgWkRUV08nLCBjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlciwgY29udHJvbGxlck5hbWVEYXRhLnR5cGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgRm91bmQgQ29udHJvbGxlciBuYW1lZCAke2NvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyfSBvZiB0eXBlICR7Y29udHJvbGxlck5hbWVEYXRhLnR5cGV9LmApO1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyID0gQ29udHJvbGxlckZhY3RvcnkuY3JlYXRlQ29udHJvbGxlcihjb250cm9sbGVyTmFtZURhdGEsIHRoaXMubG9nKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKHRoaXMuTmFtZSArICcgd2FzIG5vdCBhYmxlIHRvIGNvbm5lY3QgdG8gY29ubmVjdCB0byB0aGUgY29udHJvbGxlci4gJywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcblxuICAgIH1cbiAgICBhc3luYyBnZXRDb250cm9sbGVyR3JvdXBMaXN0QXN5bmMoKSB7XG4gICAgICAgIC8vIEdldCB0aGUgbGlzdCBvZiBsaWdodCBncm91cHMgZnJvbSB0aGUgY29udHJvbGxlclxuICAgICAgICBpZiAodGhpcy5jb25maWcuaGlkZUdyb3VwcykgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGdyb3VwTGlzdHMgPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuR3JvdXBMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYFJldHJpZXZlZCAke2dyb3VwTGlzdHMubGVuZ3RofSBsaWdodCBncm91cHMgZnJvbSBjb250cm9sbGVyLmApO1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBncm91cExpc3RzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLnB1c2goZ3JvdXBMaXN0c1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoYHdhcyBub3QgYWJsZSB0byByZXRyaWV2ZSBsaWdodCBncm91cHMgZnJvbSBjb250cm9sbGVyLlxcbiR7ZXJyfVxcbiR7ZXJyfWApO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBhc3luYyBnZXRDb250cm9sbGVyVGhlbWVMaXN0QXN5bmMoKSB7XG4gICAgICAgIC8vIEdldCB0aGUgbGlzdCBvZiBsaWdodCBMdXhvclRoZW1lcyBmcm9tIHRoZSBjb250cm9sbGVyXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgdGhlbWVMaXN0cyA9IGF3YWl0IHRoaXMuY29udHJvbGxlci5UaGVtZUxpc3RHZXRBc3luYygpO1xuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmV0cmlldmVkICR7dGhlbWVMaXN0cy5sZW5ndGh9IHRoZW1lcyBmcm9tIGNvbnRyb2xsZXIuYCk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jb25maWcubm9BbGxUaGVtZXMgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuY29uZmlnLm5vQWxsVGhlbWVzKXtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBOb3QgY3JlYXRpbmcgSWxsdW1pbmF0ZSBBbGwgYW5kIEV4dGluZ3Vpc2ggQWxsIHRoZW1lcyBwZXIgY29uZmlnIHNldHRpbmcuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGVtZUxpc3RzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBOYW1lOiAnSWxsdW1pbmF0ZSBhbGwgbGlnaHRzJyxcbiAgICAgICAgICAgICAgICAgICAgVGhlbWVJbmRleDogMTAwLFxuICAgICAgICAgICAgICAgICAgICBPbk9mZjogMCxcbiAgICAgICAgICAgICAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IElMaWdodFR5cGUuVEhFTUVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGVtZUxpc3RzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBOYW1lOiAnRXh0aW5ndWlzaCBhbGwgbGlnaHRzJyxcbiAgICAgICAgICAgICAgICAgICAgVGhlbWVJbmRleDogMTAxLFxuICAgICAgICAgICAgICAgICAgICBPbk9mZjogMCxcbiAgICAgICAgICAgICAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IElMaWdodFR5cGUuVEhFTUVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gdGhlbWVMaXN0cykge1xuICAgICAgICAgICAgICAgIHRoZW1lTGlzdHNbaV0udHlwZSA9IElMaWdodFR5cGUuVEhFTUU7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLnB1c2godGhlbWVMaXN0c1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoJ3dhcyBub3QgYWJsZSB0byByZXRyaWV2ZSBsaWdodCB0aGVtZXMgZnJvbSBjb250cm9sbGVyLicsIGVycik7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmVtb3ZlQWNjZXNzb3JpZXMoKSB7XG4gICAgICAgIGZvciAodmFyIFVVSUQgaW4gdGhpcy5hY2Nlc3Nvcmllcykge1xuICAgICAgICAgICAgbGV0IGFjY2Vzc29yeSA9IHRoaXMuYWNjZXNzb3JpZXNbVVVJRF07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY29uZmlnLnJlbW92ZUFsbEFjY2Vzc29yaWVzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLmNvbmZpZy5yZW1vdmVBbGxBY2Nlc3NvcmllcyB8fCB0eXBlb2YgdGhpcy5jb25maWcucmVtb3ZlQWNjZXNzb3JpZXMgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuY29uZmlnLnJlbW92ZUFjY2Vzc29yaWVzLmluY2x1ZGVzKGFjY2Vzc29yeS5VVUlEKSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYFJlbW92aW5nIGNhY2hlZCBhY2Nlc3NvcnkgJHthY2Nlc3NvcnkuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2FjY2Vzc29yeS5VVUlEfSBwZXIgcGxhdGZvcm0gY29uZmlndXJhdGlvbiBzZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwaS51bnJlZ2lzdGVyUGxhdGZvcm1BY2Nlc3NvcmllcyhcImhvbWVicmlkZ2UtbHV4b3JcIiwgXCJMdXhvclwiLCBbYWNjZXNzb3J5XSk7XG4gICAgICAgICAgICAgICAgdGhpcy5hY2Nlc3NvcmllcyA9IHRoaXMuYWNjZXNzb3JpZXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5VVUlEICE9PSBVVUlEKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRHcm91cEFjY2Vzc29yeShsaWdodEdyb3VwOiBJR3JvdXBMaXN0KSB7XG4gICAgICAgIHZhciBhY2Nlc3NvcnkgPSBuZXcgdGhpcy5hcGkucGxhdGZvcm1BY2Nlc3NvcnkobGlnaHRHcm91cC5OYW1lLCBsaWdodEdyb3VwLlVVSUQpO1xuICAgICAgICBsZXQgY29udGV4dDogSUNvbnRleHQgPSB7XG4gICAgICAgICAgICBsYXN0RGF0ZUFkZGVkOiB0aGlzLmxhc3REYXRlQWRkZWQsXG4gICAgICAgICAgICBjb2xvcjogbGlnaHRHcm91cC5Db2xvcixcbiAgICAgICAgICAgIGdyb3VwTnVtYmVyOiBsaWdodEdyb3VwLkdyb3VwTnVtYmVyLFxuICAgICAgICAgICAgYnJpZ2h0bmVzczogbGlnaHRHcm91cC5JbnRlbnNpdHksXG4gICAgICAgICAgICB0eXBlOiBsaWdodEdyb3VwLnR5cGUsXG4gICAgICAgICAgICBpc09uOiBsaWdodEdyb3VwLkludGVuc2l0eSA+IDAsXG4gICAgICAgICAgICBpbmRlcGVuZGVudENvbG9yczogdGhpcy5jb25maWcuaW5kZXBlbmRlbnRDb2xvcnMsXG4gICAgICAgICAgICBjb21tYW5kVGltZW91dDogdGhpcy5jb25maWcuY29tbWFuZFRpbWVvdXRcbiAgICAgICAgfVxuICAgICAgICBhY2Nlc3NvcnkuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIExpZ2h0RmFjdG9yeS5jcmVhdGVMaWdodCh0aGlzLCBhY2Nlc3NvcnkpO1xuICAgICAgICB0aGlzLmFwaS5yZWdpc3RlclBsYXRmb3JtQWNjZXNzb3JpZXMoXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgW2FjY2Vzc29yeV0pO1xuICAgIH1cblxuICAgIGFkZFRoZW1lQWNjZXNzb3J5KHRoZW1lR3JvdXA6IElUaGVtZUxpc3QpIHtcbiAgICAgICAgdmFyIGFjY2Vzc29yeSA9IG5ldyB0aGlzLmFwaS5wbGF0Zm9ybUFjY2Vzc29yeSh0aGVtZUdyb3VwLk5hbWUsIHRoZW1lR3JvdXAuVVVJRCk7XG4gICAgICAgIGxldCBjb250ZXh0OiBJQ29udGV4dCA9IHtcbiAgICAgICAgICAgIGxhc3REYXRlQWRkZWQ6IHRoaXMubGFzdERhdGVBZGRlZCxcbiAgICAgICAgICAgIHR5cGU6IElMaWdodFR5cGUuVEhFTUUsXG4gICAgICAgICAgICBpc09uOiB0aGVtZUdyb3VwLk9uT2ZmID09PSAxLFxuICAgICAgICAgICAgdGhlbWVJbmRleDogdGhlbWVHcm91cC5UaGVtZUluZGV4LFxuICAgICAgICAgICAgT25PZmY6IHRoZW1lR3JvdXAuT25PZmYsXG4gICAgICAgICAgICBjb21tYW5kVGltZW91dDogdGhpcy5jb25maWcuY29tbWFuZFRpbWVvdXRcbiAgICAgICAgfVxuICAgICAgICBhY2Nlc3NvcnkuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIExpZ2h0RmFjdG9yeS5jcmVhdGVMaWdodCh0aGlzLCBhY2Nlc3NvcnkpO1xuICAgICAgICB0aGlzLmFjY2Vzc29yaWVzW2FjY2Vzc29yeS5VVUlEXSA9IGFjY2Vzc29yeTtcbiAgICAgICAgdGhpcy5hcGkucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFthY2Nlc3NvcnldKTtcbiAgICB9XG5cbiAgICBhc3NpZ25VVUlEcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBhY2MgPSB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXNbaV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFjYy5UaGVtZUluZGV4ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGFjYy5VVUlEID0gdGhpcy5hcGkuaGFwLnV1aWQuZ2VuZXJhdGUoJ2x1eG9yLicgKyBgdGhlbWUtJHthY2MuVGhlbWVJbmRleH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGFjYy5VVUlEID0gdGhpcy5hcGkuaGFwLnV1aWQuZ2VuZXJhdGUoJ2x1eG9yLicgKyBgZ3JvdXAuLSR7YWNjLkdyb3VwTnVtYmVyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgcHJvY2Vzc0FjY2Vzc29yaWVzKCkge1xuICAgICAgICB0aGlzLmFzc2lnblVVSURzKCk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWNjZXNzb3JpZXMoKVxuICAgICAgICBmb3IgKHZhciBVVUlEIGluIHRoaXMuYWNjZXNzb3JpZXMpIHtcbiAgICAgICAgICAgIGxldCBjYWNoZWRBY2MgPSB0aGlzLmFjY2Vzc29yaWVzW1VVSURdO1xuICAgICAgICAgICAgLy8gbG9vayBmb3IgbWF0Y2ggb24gY3VycmVudCBkZXZpY2VzXG4gICAgICAgICAgICBsZXQgcmVtb3ZlID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJBY2MgPSB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXNbal07XG4gICAgICAgICAgICAgICAgaWYgKGNhY2hlZEFjYy5VVUlEID09PSBjdXJyQWNjLlVVSUQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZm91bmQgZXhpc3RpbmcgZGV2aWNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYExvYWRpbmcgY2FjaGVkIGFjY2Vzc29yeSAke2NhY2hlZEFjYy5kaXNwbGF5TmFtZX0gd2l0aCBVVUlEICR7Y2FjaGVkQWNjLlVVSUR9LmApO1xuICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgY2FjaGVkIGRldmljZSAobmFtZSwgZXRjKVxuICAgICAgICAgICAgICAgICAgICBsZXQgY29udGV4dDogSUNvbnRleHQgPSBjYWNoZWRBY2MuY29udGV4dCBhcyBJQ29udGV4dDtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5sYXN0RGF0ZUFkZGVkID0gdGhpcy5sYXN0RGF0ZUFkZGVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuQ29sb3IgIT09ICd1bmRlZmluZWQnKSBjb250ZXh0LmNvbG9yID0gY3VyckFjYy5Db2xvcjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLkdyb3VwTnVtYmVyICE9PSAndW5kZWZpbmVkJykgY29udGV4dC5ncm91cE51bWJlciA9IGN1cnJBY2MuR3JvdXBOdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5UaGVtZUluZGV4ICE9PSAndW5kZWZpbmVkJykgY29udGV4dC50aGVtZUluZGV4ID0gY3VyckFjYy5UaGVtZUluZGV4O1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuSW50ZW5zaXR5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5icmlnaHRuZXNzID0gY3VyckFjYy5JbnRlbnNpdHk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmlzT24gPSBjdXJyQWNjLkludGVuc2l0eSA+IDA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLnR5cGUgIT09ICd1bmRlZmluZWQnKSBjb250ZXh0LnR5cGUgPSBjdXJyQWNjLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5pc09uICE9PSAndW5kZWZpbmVkJykgY29udGV4dC5pc09uID0gY3VyckFjYy5pc09uO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuTmFtZSAhPT0gJ3VuZGVmaW5lZCcpIGNhY2hlZEFjYy5kaXNwbGF5TmFtZSA9IGN1cnJBY2MuTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGVkQWNjLmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwaS51cGRhdGVQbGF0Zm9ybUFjY2Vzc29yaWVzKFtjYWNoZWRBY2NdKTtcbiAgICAgICAgICAgICAgICAgICAgTGlnaHRGYWN0b3J5LmNyZWF0ZUxpZ2h0KHRoaXMsIGNhY2hlZEFjYyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5zcGxpY2UoaiwgMSk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZW1vdmUgdGhlIGNhY2hlZEFjYyB0aGF0IGNhbid0IGJlIG1hdGNoZWRcbiAgICAgICAgICAgIGlmIChyZW1vdmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBSZW1vdmluZyBjYWNoZWQgYWNjZXNzb3J5ICR7Y2FjaGVkQWNjLmRpc3BsYXlOYW1lfSB3aXRoIFVVSUQgJHtjYWNoZWRBY2MuVVVJRH0uYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcGkudW5yZWdpc3RlclBsYXRmb3JtQWNjZXNzb3JpZXMoXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgW2NhY2hlZEFjY10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCBhbnkgbmV3IGFjY2Vzc29yaWVzIHRoYXQgd2VyZSBub3QgcHJldmlvdXNseSBtYXRjaGVkXG4gICAgICAgIGlmICh0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgY3VyckFjYyA9IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lc1tqXTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBBZGRpbmcgbmV3IGFjY2Vzc29yeSAke2N1cnJBY2MuTmFtZX0gd2l0aCBVVUlEICR7Y3VyckFjYy5VVUlEfS5gKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VyckFjYy50eXBlID09PSBJTGlnaHRUeXBlLlRIRU1FKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFRoZW1lQWNjZXNzb3J5KGN1cnJBY2MpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRHcm91cEFjY2Vzc29yeShjdXJyQWNjKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGRpZEZpbmlzaExhdW5jaGluZ0FzeW5jKCkge1xuICAgICAgICBpZiAoIXRoaXMuY29uZmlnLmlwQWRkcikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IodGhpcy5OYW1lICsgXCIgbmVlZHMgYW4gSVAgQWRkcmVzcyBpbiB0aGUgY29uZmlnIGZpbGUuICBQbGVhc2Ugc2VlIHNhbXBsZV9jb25maWcuanNvbi5cIik7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdoaWxlIChhd2FpdCB0aGlzLmdldENvbnRyb2xsZXJBc3luYygpID09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgVW5hYmxlIHRvIGNvbm5lY3QgdG8gTHV4b3IgY29udHJvbGxlci4gIFdhaXRpbmcgNjBzIGFuZCB3aWxsIHJldHJ5LmApXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcCg2MCoxMDAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vdGhpcy5yZXRyaWV2ZUNhY2hlZEFjY2Vzc29yaWVzKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmdldENvbnRyb2xsZXJHcm91cExpc3RBc3luYygpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5nZXRDb250cm9sbGVyVGhlbWVMaXN0QXN5bmMoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucHJvY2Vzc0FjY2Vzc29yaWVzKCk7XG4gICAgICAgICAgICAvLyB0aGlzLnJlbW92ZU9waGFuZWRBY2Nlc3NvcmllcygpO1xuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbygnRmluaXNoZWQgaW5pdGlhbGl6aW5nJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoJ0Vycm9yIGluIGRpZEZpbmlzaExhdW5jaGluZycsIGVycik7XG4gICAgICAgIH07XG4gICAgfVxufVxuZXhwb3J0IGludGVyZmFjZSBJQ29udGV4dCB7XG4gICAgbGFzdERhdGVBZGRlZDogbnVtYmVyO1xuICAgIGdyb3VwTnVtYmVyPzogbnVtYmVyO1xuICAgIGJyaWdodG5lc3M/OiBudW1iZXI7XG4gICAgdHlwZTogSUxpZ2h0VHlwZVxuICAgIGNvbG9yPzogbnVtYmVyO1xuICAgIHN0YXR1cz86IGFueTtcbiAgICBpc09uOiBib29sZWFuO1xuICAgIGh1ZT86IG51bWJlcjtcbiAgICBzYXR1cmF0aW9uPzogbnVtYmVyO1xuICAgIHRoZW1lSW5kZXg/OiBudW1iZXI7XG4gICAgT25PZmY/OiAwIHwgMTtcbiAgICBpbmRlcGVuZGVudENvbG9ycz86IGJvb2xlYW47XG4gICAgY29tbWFuZFRpbWVvdXQ6IG51bWJlcjtcbn0iXX0=