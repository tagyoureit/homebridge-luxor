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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTHV4b3JQbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9MdXhvclBsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFLdkMsZ0VBQXNHO0FBQ3RHLHNFQUFtRTtBQUNuRSx3REFBcUQ7QUFFckQsZ0RBQStDO0FBSS9DLE1BQWEsYUFBYTtJQVV0QixZQUNvQixHQUFXLEVBQ1gsTUFBc0IsRUFDdEIsR0FBUTtRQUZSLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUN0QixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBWjVCLG9EQUFvRDtRQUM3QyxnQkFBVyxHQUF3QixFQUFFLENBQUM7UUFNckMsd0JBQW1CLEdBQWdDLEVBQUUsQ0FBQztRQU8xRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ2xELElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLHFDQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUVoRixJQUFJLEdBQUcsRUFBRTtZQUNMLGtHQUFrRztZQUNsRyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztZQUVmLDBHQUEwRztZQUMxRyx5SEFBeUg7WUFDekgsb0NBQW9DO1lBQ3BDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUM5RTtJQUNMLENBQUM7SUFDRCxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDVixPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNELENBQUM7SUFDRCxxRUFBcUU7SUFDckUsdUVBQXVFO0lBQ3ZFLGtCQUFrQixDQUFDLFNBQTRCO1FBQzNDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLDhCQUE4QixTQUFTLENBQUMsV0FBVyxjQUFjLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQztJQUNqRCxDQUFDO0lBQ0QsS0FBSyxDQUFDLGtCQUFrQjtRQUNwQixpQ0FBaUM7UUFFakMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyx1Q0FBdUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hGLElBQUk7WUFDQSxvREFBb0Q7WUFDcEQsTUFBTSxRQUFRLEdBQWlCLE1BQU0sS0FBSyxDQUFDO2dCQUN2QyxNQUFNLEVBQUUsTUFBTTtnQkFDZCxHQUFHLEVBQUUsU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLHNCQUFzQjtnQkFDNUQsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxJQUFJLEdBQUc7YUFDM0MsQ0FBQyxDQUFDO1lBRUwsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRTtnQkFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsR0FBRyxRQUFRLENBQUMsTUFBTSxHQUFHLDRDQUE0QyxDQUFDLENBQUM7Z0JBQUMsT0FBTyxLQUFLLENBQUM7YUFBRTtZQUM3SixJQUFJLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDdkMsa0JBQWtCLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1lBQzNDLGtCQUFrQixDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDbkMsa0JBQWtCLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDO1lBQy9ELElBQUksa0JBQWtCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFO2dCQUMzRCxrQkFBa0IsQ0FBQyxJQUFJLEdBQUcsZ0NBQWUsQ0FBQyxFQUFFLENBQUM7YUFDaEQ7aUJBQU0sSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUU7Z0JBQ2xFLGtCQUFrQixDQUFDLElBQUksR0FBRyxnQ0FBZSxDQUFDLEdBQUcsQ0FBQzthQUNqRDtpQkFBTSxJQUFJLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRTtnQkFDbEUsa0JBQWtCLENBQUMsSUFBSSxHQUFHLGdDQUFlLENBQUMsS0FBSyxDQUFDO2FBQ25EO2lCQUFNO2dCQUNILGtCQUFrQixDQUFDLElBQUksR0FBRyxnQ0FBZSxDQUFDLEtBQUssQ0FBQztnQkFDaEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsZ0VBQWdFLEVBQUUsa0JBQWtCLENBQUMsVUFBVSxFQUFFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzNJO1lBQ0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLGtCQUFrQixDQUFDLFVBQVUsWUFBWSxrQkFBa0IsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1lBQzdHLElBQUksQ0FBQyxVQUFVLEdBQUcscUNBQWlCLENBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25GLE9BQU8sSUFBSSxDQUFDO1NBQ2Y7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcseURBQXlELEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDM0YsT0FBTyxLQUFLLENBQUM7U0FDaEI7UUFBQSxDQUFDO0lBRU4sQ0FBQztJQUNELEtBQUssQ0FBQywyQkFBMkI7UUFDN0IsbURBQW1EO1FBQ25ELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1lBQUUsT0FBTztRQUNuQyxJQUFJO1lBQ0EsSUFBSSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxVQUFVLENBQUMsTUFBTSxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQzlFLEtBQUssSUFBSSxDQUFDLElBQUksVUFBVSxFQUFFO2dCQUN0QixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2hEO1NBQ0o7UUFDRCxPQUFPLEdBQUcsRUFBRTtZQUNSLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLDJEQUEyRCxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQztTQUM1RjtRQUFBLENBQUM7SUFDTixDQUFDO0lBQ0QsS0FBSyxDQUFDLDJCQUEyQjtRQUM3Qix3REFBd0Q7UUFDeEQsSUFBSTtZQUNBLElBQUksVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzNELElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsVUFBVSxDQUFDLE1BQU0sMEJBQTBCLENBQUMsQ0FBQztZQUV4RSxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFDO2dCQUMxRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQywyRUFBMkUsQ0FBQyxDQUFDO2FBQzlGO2lCQUNJO2dCQUNELFVBQVUsQ0FBQyxJQUFJLENBQUM7b0JBQ1osSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsVUFBVSxFQUFFLEdBQUc7b0JBQ2YsS0FBSyxFQUFFLENBQUM7b0JBQ1IsSUFBSSxFQUFFLEtBQUs7b0JBQ1gsSUFBSSxFQUFFLHFCQUFVLENBQUMsS0FBSztpQkFDekIsQ0FBQyxDQUFDO2dCQUNILFVBQVUsQ0FBQyxJQUFJLENBQUM7b0JBQ1osSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsVUFBVSxFQUFFLEdBQUc7b0JBQ2YsS0FBSyxFQUFFLENBQUM7b0JBQ1IsSUFBSSxFQUFFLEtBQUs7b0JBQ1gsSUFBSSxFQUFFLHFCQUFVLENBQUMsS0FBSztpQkFDekIsQ0FBQyxDQUFDO2FBQ047WUFDRCxLQUFLLElBQUksQ0FBQyxJQUFJLFVBQVUsRUFBRTtnQkFDdEIsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksR0FBRyxxQkFBVSxDQUFDLEtBQUssQ0FBQztnQkFDdEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNoRDtTQUNKO1FBQ0QsT0FBTyxHQUFHLEVBQUU7WUFDUixJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUNqRjtRQUFBLENBQUM7SUFDTixDQUFDO0lBRUQsaUJBQWlCO1FBQ2IsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQy9CLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdkMsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEtBQUssV0FBVyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsb0JBQW9CLElBQUksT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixLQUFLLFdBQVcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQy9NLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDZCQUE2QixTQUFTLENBQUMsV0FBVyxjQUFjLFNBQVMsQ0FBQyxJQUFJLHVDQUF1QyxDQUFDLENBQUM7Z0JBQ3JJLElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDakYsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7YUFDMUU7WUFBQSxDQUFDO1NBQ0w7SUFDTCxDQUFDO0lBRUQsaUJBQWlCLENBQUMsVUFBc0I7UUFDcEMsSUFBSSxTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pGLElBQUksT0FBTyxHQUFhO1lBQ3BCLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyxLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUs7WUFDdkIsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXO1lBQ25DLFVBQVUsRUFBRSxVQUFVLENBQUMsU0FBUztZQUNoQyxJQUFJLEVBQUUsVUFBVSxDQUFDLElBQUk7WUFDckIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxTQUFTLEdBQUcsQ0FBQztZQUM5QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLGlCQUFpQjtZQUNoRCxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjO1NBQzdDLENBQUE7UUFDRCxTQUFTLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUM1QiwyQkFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxVQUFzQjtRQUNwQyxJQUFJLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakYsSUFBSSxPQUFPLEdBQWE7WUFDcEIsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ2pDLElBQUksRUFBRSxxQkFBVSxDQUFDLEtBQUs7WUFDdEIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxLQUFLLEtBQUssQ0FBQztZQUM1QixVQUFVLEVBQUUsVUFBVSxDQUFDLFVBQVU7WUFDakMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLO1lBQ3ZCLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWM7U0FDN0MsQ0FBQTtRQUNELFNBQVMsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQzVCLDJCQUFZLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUM7UUFDN0MsSUFBSSxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRCxXQUFXO1FBQ1AsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDdEQsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLElBQUksT0FBTyxHQUFHLENBQUMsVUFBVSxLQUFLLFdBQVcsRUFBRTtnQkFDdkMsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsR0FBRyxTQUFTLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO2FBQy9FO2lCQUNJO2dCQUNELEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsVUFBVSxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQzthQUNqRjtTQUNKO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxrQkFBa0I7UUFDcEIsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFBO1FBQ3hCLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUMvQixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZDLG9DQUFvQztZQUNwQyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDbEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3RELElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxJQUFJLEVBQUU7b0JBQ2pDLHdCQUF3QjtvQkFDeEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLFNBQVMsQ0FBQyxXQUFXLGNBQWMsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7b0JBQ2hHLG1DQUFtQztvQkFDbkMsSUFBSSxPQUFPLEdBQWEsU0FBUyxDQUFDLE9BQW1CLENBQUM7b0JBQ3RELE9BQU8sQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztvQkFDM0MsSUFBSSxPQUFPLE9BQU8sQ0FBQyxLQUFLLEtBQUssV0FBVzt3QkFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7b0JBQ3hFLElBQUksT0FBTyxPQUFPLENBQUMsV0FBVyxLQUFLLFdBQVc7d0JBQUUsT0FBTyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO29CQUMxRixJQUFJLE9BQU8sT0FBTyxDQUFDLFVBQVUsS0FBSyxXQUFXO3dCQUFFLE9BQU8sQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQztvQkFDdkYsSUFBSSxPQUFPLE9BQU8sQ0FBQyxTQUFTLEtBQUssV0FBVyxFQUFFO3dCQUMxQyxPQUFPLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7d0JBQ3ZDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7cUJBQ3hDO29CQUNELElBQUksT0FBTyxPQUFPLENBQUMsSUFBSSxLQUFLLFdBQVc7d0JBQUUsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNyRSxJQUFJLE9BQU8sT0FBTyxDQUFDLElBQUksS0FBSyxXQUFXO3dCQUFFLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztvQkFDckUsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLEtBQUssV0FBVzt3QkFBRSxTQUFTLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQzlFLFNBQVMsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO29CQUM1QixJQUFJLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztvQkFDaEQsMkJBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO29CQUMxQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxHQUFHLEtBQUssQ0FBQztvQkFDZixNQUFNO2lCQUNUO2FBQ0o7WUFDRCw2Q0FBNkM7WUFDN0MsSUFBSSxNQUFNLEVBQUU7Z0JBQ1IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsNkJBQTZCLFNBQVMsQ0FBQyxXQUFXLGNBQWMsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7Z0JBQ2pHLElBQUksQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUNwRjtTQUNKO1FBQ0QsMkRBQTJEO1FBQzNELElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDckMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3RELElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLE9BQU8sQ0FBQyxJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7Z0JBQ2pGLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxxQkFBVSxDQUFDLEtBQUs7b0JBQ2pDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQzs7b0JBRWhDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN2QztTQUNKO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyx1QkFBdUI7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsMEVBQTBFLENBQUMsQ0FBQztTQUMxRztRQUNELElBQUk7WUFDQSxPQUFPLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksS0FBSyxFQUFFO2dCQUM3QyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxRUFBcUUsQ0FBQyxDQUFBO2dCQUNwRixNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFDLElBQUksQ0FBQyxDQUFDO2FBQzdCO1lBQ0QsbUNBQW1DO1lBQ25DLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztZQUN6QyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2hDLG1DQUFtQztZQUNuQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1NBQzFDO1FBQ0QsT0FBTyxHQUFHLEVBQUU7WUFDUixJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN0RDtRQUFBLENBQUM7SUFDTixDQUFDO0NBQ0o7QUFoUUQsc0NBZ1FDIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpLmRlZmF1bHQ7XG5cbmltcG9ydCB7IEF4aW9zUmVzcG9uc2UgfSBmcm9tICdheGlvcyc7XG5pbXBvcnQgeyBBUEksIENoYXJhY3RlcmlzdGljLCBEeW5hbWljUGxhdGZvcm1QbHVnaW4sIExvZ2dlciwgUGxhdGZvcm1BY2Nlc3NvcnksIFBsYXRmb3JtQ29uZmlnLCBTZXJ2aWNlIH0gZnJvbSAnaG9tZWJyaWRnZSc7XG5cbmltcG9ydCB7IEJhc2VDb250cm9sbGVyLCBJQ29udHJvbGxlclR5cGUsIElHcm91cExpc3QsIElUaGVtZUxpc3QgfSBmcm9tICcuL2NvbnRyb2xsZXIvQmFzZUNvbnRyb2xsZXInO1xuaW1wb3J0IHsgQ29udHJvbGxlckZhY3RvcnkgfSBmcm9tICcuL2NvbnRyb2xsZXIvQ29udHJvbGxlckZhY3RvcnknO1xuaW1wb3J0IHsgTGlnaHRGYWN0b3J5IH0gZnJvbSAnLi9saWdodHMvTGlnaHRGYWN0b3J5JztcbmltcG9ydCB7IFRoZW1lIH0gZnJvbSAnLi9saWdodHMvVGhlbWUnO1xuaW1wb3J0IHsgSUxpZ2h0VHlwZSB9IGZyb20gJy4vbGlnaHRzL1pEX0xpZ2h0JztcblxuXG5cbmV4cG9ydCBjbGFzcyBMdXhvclBsYXRmb3JtIGltcGxlbWVudHMgRHluYW1pY1BsYXRmb3JtUGx1Z2luIHtcbiAgICAvLyB0aGlzIGlzIHVzZWQgdG8gdHJhY2sgcmVzdG9yZWQgY2FjaGVkIGFjY2Vzc29yaWVzXG4gICAgcHVibGljIGFjY2Vzc29yaWVzOiBQbGF0Zm9ybUFjY2Vzc29yeVtdID0gW107XG4gICAgcHVibGljIGNvbnRyb2xsZXI6IEJhc2VDb250cm9sbGVyOy8vIHdpbGwgYmUgYXNzaWduZWQgdG8gWkQgb3IgWkRDIGNvbnRyb2xsZXJcbiAgICBwdWJsaWMgTmFtZTogc3RyaW5nO1xuICAgIHB1YmxpYyBsYXN0RGF0ZUFkZGVkOiBudW1iZXI7XG4gICAgcHVibGljIHJlYWRvbmx5IFNlcnZpY2U6IHR5cGVvZiBTZXJ2aWNlO1xuICAgIHB1YmxpYyByZWFkb25seSBDaGFyYWN0ZXJpc3RpYzogdHlwZW9mIENoYXJhY3RlcmlzdGljO1xuICAgIHByaXZhdGUgY3Vyckdyb3Vwc0FuZFRoZW1lczogSUdyb3VwTGlzdFtdICYgSVRoZW1lTGlzdFtdID0gW107XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGxvZzogTG9nZ2VyLFxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnOiBQbGF0Zm9ybUNvbmZpZyxcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGFwaTogQVBJXG4gICAgKSB7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgICAgICB0aGlzLmxvZyA9IGxvZztcbiAgICAgICAgdGhpcy5TZXJ2aWNlID0gdGhpcy5hcGkuaGFwLlNlcnZpY2U7XG4gICAgICAgIHRoaXMuQ2hhcmFjdGVyaXN0aWMgPSB0aGlzLmFwaS5oYXAuQ2hhcmFjdGVyaXN0aWM7XG4gICAgICAgIHRoaXMuTmFtZSA9IGNvbmZpZy5uYW1lO1xuICAgICAgICB0aGlzLmxhc3REYXRlQWRkZWQgPSBEYXRlLm5vdygpO1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBDb250cm9sbGVyRmFjdG9yeS5jcmVhdGVDb250cm9sbGVyKHsgdHlwZTogJ2Jhc2UnIH0sIHRoaXMubG9nKVxuXG4gICAgICAgIGlmIChhcGkpIHtcbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIEFQSSBvYmplY3QgYXMgcGx1Z2luIG5lZWRzIHRvIHJlZ2lzdGVyIG5ldyB0aGlzLmFwaS5wbGF0Zm9ybUFjY2Vzc29yeSB2aWEgdGhpcyBvYmplY3QuXG4gICAgICAgICAgICB0aGlzLmFwaSA9IGFwaTtcblxuICAgICAgICAgICAgLy8gTGlzdGVuIHRvIGV2ZW50IFwiZGlkRmluaXNoTGF1bmNoaW5nXCIsIHRoaXMgbWVhbnMgaG9tZWJyaWRnZSBhbHJlYWR5IGZpbmlzaGVkIGxvYWRpbmcgY2FjaGVkIGFjY2Vzc29yaWVzXG4gICAgICAgICAgICAvLyBQbGF0Zm9ybSBQbHVnaW4gc2hvdWxkIG9ubHkgcmVnaXN0ZXIgbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5IHRoYXQgZG9lc24ndCBleGlzdCBpbiBob21lYnJpZGdlIGFmdGVyIHRoaXMgZXZlbnQuXG4gICAgICAgICAgICAvLyBPciBzdGFydCBkaXNjb3ZlciBuZXcgYWNjZXNzb3JpZXNcbiAgICAgICAgICAgIHRoaXMuYXBpLm9uKCdkaWRGaW5pc2hMYXVuY2hpbmcnLCB0aGlzLmRpZEZpbmlzaExhdW5jaGluZ0FzeW5jLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIHNsZWVwKG1zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbiAgICB9XG4gICAgLy8gRnVuY3Rpb24gaW52b2tlZCB3aGVuIGhvbWVicmlkZ2UgdHJpZXMgdG8gcmVzdG9yZSBjYWNoZWQgYWNjZXNzb3J5XG4gICAgLy8gRGV2ZWxvcGVyIGNhbiBjb25maWd1cmUgYWNjZXNzb3J5IGF0IGhlcmUgKGxpa2Ugc2V0dXAgZXZlbnQgaGFuZGxlcilcbiAgICBjb25maWd1cmVBY2Nlc3NvcnkoYWNjZXNzb3J5OiBQbGF0Zm9ybUFjY2Vzc29yeSkge1xuICAgICAgICB0aGlzLmxvZy5kZWJ1ZyhgUmV0cmlldmVkIGNhY2hlZCBhY2Nlc3NvcnkgJHthY2Nlc3NvcnkuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2FjY2Vzc29yeS5VVUlEfWApO1xuICAgICAgICB0aGlzLmFjY2Vzc29yaWVzW2FjY2Vzc29yeS5VVUlEXSA9IGFjY2Vzc29yeTtcbiAgICB9XG4gICAgYXN5bmMgZ2V0Q29udHJvbGxlckFzeW5jKCk6UHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIC8vIGdldCB0aGUgbmFtZSBvZiB0aGUgY29udHJvbGxlclxuXG4gICAgICAgIHRoaXMubG9nLmluZm8odGhpcy5OYW1lICsgXCI6IFN0YXJ0aW5nIHNlYXJjaCBmb3IgY29udHJvbGxlciBhdDogXCIgKyB0aGlzLmNvbmZpZy5pcEFkZHIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy9TZWFyY2ggZm9yIGNvbnRyb2xsb3IgYW5kIG1ha2Ugc3VyZSB3ZSBjYW4gZmluZCBpdFxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2U6QXhpb3NSZXNwb25zZSA9IGF3YWl0IGF4aW9zKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdwb3N0JyxcbiAgICAgICAgICAgICAgICB1cmw6ICdodHRwOi8vJyArIHRoaXMuY29uZmlnLmlwQWRkciArICcvQ29udHJvbGxlck5hbWUuanNvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogdGhpcy5jb25maWcuY29tbWFuZFRpbWVvdXQgfHwgNzUwXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCkgeyB0aGlzLmxvZy5lcnJvcignUmVjZWl2ZWQgYSBzdGF0dXMgY29kZSBvZiAnICsgcmVzcG9uc2Uuc3RhdHVzICsgJyB3aGVuIHRyeWluZyB0byBjb25uZWN0IHRvIHRoZSBjb250cm9sbGVyLicpOyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgICAgIGxldCBjb250cm9sbGVyTmFtZURhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLmlwID0gdGhpcy5jb25maWcuaXBBZGRyO1xuICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnBsYXRmb3JtID0gdGhpcztcbiAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS5jb21tYW5kVGltZW91dCA9IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0O1xuICAgICAgICAgICAgaWYgKGNvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyLnN1YnN0cmluZygwLCA1KSA9PT0gJ2x1eG9yJykge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS50eXBlID0gSUNvbnRyb2xsZXJUeXBlLlpEO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlci5zdWJzdHJpbmcoMCwgNSkgPT09ICdseHpkYycpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aREM7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyLnN1YnN0cmluZygwLCA1KSA9PT0gJ2x4dHdvJykge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS50eXBlID0gSUNvbnRyb2xsZXJUeXBlLlpEVFdPO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aRFRXTztcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKCdGb3VuZCB1bmtub3duIGNvbnRyb2xsZXIgbmFtZWQgJXMgb2YgdHlwZSAlcywgYXNzdW1pbmcgYSBaRFRXTycsIGNvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyLCBjb250cm9sbGVyTmFtZURhdGEudHlwZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBGb3VuZCBDb250cm9sbGVyIG5hbWVkICR7Y29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXJ9IG9mIHR5cGUgJHtjb250cm9sbGVyTmFtZURhdGEudHlwZX0uYCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBDb250cm9sbGVyRmFjdG9yeS5jcmVhdGVDb250cm9sbGVyKGNvbnRyb2xsZXJOYW1lRGF0YSwgdGhpcy5sb2cpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IodGhpcy5OYW1lICsgJyB3YXMgbm90IGFibGUgdG8gY29ubmVjdCB0byBjb25uZWN0IHRvIHRoZSBjb250cm9sbGVyLiAnLCBlcnIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuXG4gICAgfVxuICAgIGFzeW5jIGdldENvbnRyb2xsZXJHcm91cExpc3RBc3luYygpIHtcbiAgICAgICAgLy8gR2V0IHRoZSBsaXN0IG9mIGxpZ2h0IGdyb3VwcyBmcm9tIHRoZSBjb250cm9sbGVyXG4gICAgICAgIGlmICh0aGlzLmNvbmZpZy5oaWRlR3JvdXBzKSByZXR1cm47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgZ3JvdXBMaXN0cyA9IGF3YWl0IHRoaXMuY29udHJvbGxlci5Hcm91cExpc3RHZXRBc3luYygpO1xuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmV0cmlldmVkICR7Z3JvdXBMaXN0cy5sZW5ndGh9IGxpZ2h0IGdyb3VwcyBmcm9tIGNvbnRyb2xsZXIuYCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIGdyb3VwTGlzdHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMucHVzaChncm91cExpc3RzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcihgd2FzIG5vdCBhYmxlIHRvIHJldHJpZXZlIGxpZ2h0IGdyb3VwcyBmcm9tIGNvbnRyb2xsZXIuXFxuJHtlcnJ9XFxuJHtlcnJ9YCk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGFzeW5jIGdldENvbnRyb2xsZXJUaGVtZUxpc3RBc3luYygpIHtcbiAgICAgICAgLy8gR2V0IHRoZSBsaXN0IG9mIGxpZ2h0IEx1eG9yVGhlbWVzIGZyb20gdGhlIGNvbnRyb2xsZXJcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCB0aGVtZUxpc3RzID0gYXdhaXQgdGhpcy5jb250cm9sbGVyLlRoZW1lTGlzdEdldEFzeW5jKCk7XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBSZXRyaWV2ZWQgJHt0aGVtZUxpc3RzLmxlbmd0aH0gdGhlbWVzIGZyb20gY29udHJvbGxlci5gKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbmZpZy5ub0FsbFRoZW1lcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5jb25maWcubm9BbGxUaGVtZXMpe1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYE5vdCBjcmVhdGluZyBJbGx1bWluYXRlIEFsbCBhbmQgRXh0aW5ndWlzaCBBbGwgdGhlbWVzIHBlciBjb25maWcgc2V0dGluZy5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoZW1lTGlzdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIE5hbWU6ICdJbGx1bWluYXRlIGFsbCBsaWdodHMnLFxuICAgICAgICAgICAgICAgICAgICBUaGVtZUluZGV4OiAxMDAsXG4gICAgICAgICAgICAgICAgICAgIE9uT2ZmOiAwLFxuICAgICAgICAgICAgICAgICAgICBpc09uOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogSUxpZ2h0VHlwZS5USEVNRVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoZW1lTGlzdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIE5hbWU6ICdFeHRpbmd1aXNoIGFsbCBsaWdodHMnLFxuICAgICAgICAgICAgICAgICAgICBUaGVtZUluZGV4OiAxMDEsXG4gICAgICAgICAgICAgICAgICAgIE9uT2ZmOiAwLFxuICAgICAgICAgICAgICAgICAgICBpc09uOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogSUxpZ2h0VHlwZS5USEVNRVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiB0aGVtZUxpc3RzKSB7XG4gICAgICAgICAgICAgICAgdGhlbWVMaXN0c1tpXS50eXBlID0gSUxpZ2h0VHlwZS5USEVNRTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMucHVzaCh0aGVtZUxpc3RzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcignd2FzIG5vdCBhYmxlIHRvIHJldHJpZXZlIGxpZ2h0IHRoZW1lcyBmcm9tIGNvbnRyb2xsZXIuJywgZXJyKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZW1vdmVBY2Nlc3NvcmllcygpIHtcbiAgICAgICAgZm9yICh2YXIgVVVJRCBpbiB0aGlzLmFjY2Vzc29yaWVzKSB7XG4gICAgICAgICAgICBsZXQgYWNjZXNzb3J5ID0gdGhpcy5hY2Nlc3Nvcmllc1tVVUlEXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jb25maWcucmVtb3ZlQWxsQWNjZXNzb3JpZXMgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuY29uZmlnLnJlbW92ZUFsbEFjY2Vzc29yaWVzIHx8IHR5cGVvZiB0aGlzLmNvbmZpZy5yZW1vdmVBY2Nlc3NvcmllcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5jb25maWcucmVtb3ZlQWNjZXNzb3JpZXMuaW5jbHVkZXMoYWNjZXNzb3J5LlVVSUQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmVtb3ZpbmcgY2FjaGVkIGFjY2Vzc29yeSAke2FjY2Vzc29yeS5kaXNwbGF5TmFtZX0gd2l0aCBVVUlEICR7YWNjZXNzb3J5LlVVSUR9IHBlciBwbGF0Zm9ybSBjb25maWd1cmF0aW9uIHNldHRpbmdzLmApO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBpLnVucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFthY2Nlc3NvcnldKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFjY2Vzc29yaWVzID0gdGhpcy5hY2Nlc3Nvcmllcy5maWx0ZXIoaXRlbSA9PiBpdGVtLlVVSUQgIT09IFVVSUQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZEdyb3VwQWNjZXNzb3J5KGxpZ2h0R3JvdXA6IElHcm91cExpc3QpIHtcbiAgICAgICAgdmFyIGFjY2Vzc29yeSA9IG5ldyB0aGlzLmFwaS5wbGF0Zm9ybUFjY2Vzc29yeShsaWdodEdyb3VwLk5hbWUsIGxpZ2h0R3JvdXAuVVVJRCk7XG4gICAgICAgIGxldCBjb250ZXh0OiBJQ29udGV4dCA9IHtcbiAgICAgICAgICAgIGxhc3REYXRlQWRkZWQ6IHRoaXMubGFzdERhdGVBZGRlZCxcbiAgICAgICAgICAgIGNvbG9yOiBsaWdodEdyb3VwLkNvbG9yLFxuICAgICAgICAgICAgZ3JvdXBOdW1iZXI6IGxpZ2h0R3JvdXAuR3JvdXBOdW1iZXIsXG4gICAgICAgICAgICBicmlnaHRuZXNzOiBsaWdodEdyb3VwLkludGVuc2l0eSxcbiAgICAgICAgICAgIHR5cGU6IGxpZ2h0R3JvdXAudHlwZSxcbiAgICAgICAgICAgIGlzT246IGxpZ2h0R3JvdXAuSW50ZW5zaXR5ID4gMCxcbiAgICAgICAgICAgIGluZGVwZW5kZW50Q29sb3JzOiB0aGlzLmNvbmZpZy5pbmRlcGVuZGVudENvbG9ycyxcbiAgICAgICAgICAgIGNvbW1hbmRUaW1lb3V0OiB0aGlzLmNvbmZpZy5jb21tYW5kVGltZW91dFxuICAgICAgICB9XG4gICAgICAgIGFjY2Vzc29yeS5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgTGlnaHRGYWN0b3J5LmNyZWF0ZUxpZ2h0KHRoaXMsIGFjY2Vzc29yeSk7XG4gICAgICAgIHRoaXMuYXBpLnJlZ2lzdGVyUGxhdGZvcm1BY2Nlc3NvcmllcyhcImhvbWVicmlkZ2UtbHV4b3JcIiwgXCJMdXhvclwiLCBbYWNjZXNzb3J5XSk7XG4gICAgfVxuXG4gICAgYWRkVGhlbWVBY2Nlc3NvcnkodGhlbWVHcm91cDogSVRoZW1lTGlzdCkge1xuICAgICAgICB2YXIgYWNjZXNzb3J5ID0gbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5KHRoZW1lR3JvdXAuTmFtZSwgdGhlbWVHcm91cC5VVUlEKTtcbiAgICAgICAgbGV0IGNvbnRleHQ6IElDb250ZXh0ID0ge1xuICAgICAgICAgICAgbGFzdERhdGVBZGRlZDogdGhpcy5sYXN0RGF0ZUFkZGVkLFxuICAgICAgICAgICAgdHlwZTogSUxpZ2h0VHlwZS5USEVNRSxcbiAgICAgICAgICAgIGlzT246IHRoZW1lR3JvdXAuT25PZmYgPT09IDEsXG4gICAgICAgICAgICB0aGVtZUluZGV4OiB0aGVtZUdyb3VwLlRoZW1lSW5kZXgsXG4gICAgICAgICAgICBPbk9mZjogdGhlbWVHcm91cC5Pbk9mZixcbiAgICAgICAgICAgIGNvbW1hbmRUaW1lb3V0OiB0aGlzLmNvbmZpZy5jb21tYW5kVGltZW91dFxuICAgICAgICB9XG4gICAgICAgIGFjY2Vzc29yeS5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgTGlnaHRGYWN0b3J5LmNyZWF0ZUxpZ2h0KHRoaXMsIGFjY2Vzc29yeSk7XG4gICAgICAgIHRoaXMuYWNjZXNzb3JpZXNbYWNjZXNzb3J5LlVVSURdID0gYWNjZXNzb3J5O1xuICAgICAgICB0aGlzLmFwaS5yZWdpc3RlclBsYXRmb3JtQWNjZXNzb3JpZXMoXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgW2FjY2Vzc29yeV0pO1xuICAgIH1cblxuICAgIGFzc2lnblVVSURzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGFjYyA9IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lc1tpXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYWNjLlRoZW1lSW5kZXggIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgYWNjLlVVSUQgPSB0aGlzLmFwaS5oYXAudXVpZC5nZW5lcmF0ZSgnbHV4b3IuJyArIGB0aGVtZS0ke2FjYy5UaGVtZUluZGV4fWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWNjLlVVSUQgPSB0aGlzLmFwaS5oYXAudXVpZC5nZW5lcmF0ZSgnbHV4b3IuJyArIGBncm91cC4tJHthY2MuR3JvdXBOdW1iZXJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBwcm9jZXNzQWNjZXNzb3JpZXMoKSB7XG4gICAgICAgIHRoaXMuYXNzaWduVVVJRHMoKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBY2Nlc3NvcmllcygpXG4gICAgICAgIGZvciAodmFyIFVVSUQgaW4gdGhpcy5hY2Nlc3Nvcmllcykge1xuICAgICAgICAgICAgbGV0IGNhY2hlZEFjYyA9IHRoaXMuYWNjZXNzb3JpZXNbVVVJRF07XG4gICAgICAgICAgICAvLyBsb29rIGZvciBtYXRjaCBvbiBjdXJyZW50IGRldmljZXNcbiAgICAgICAgICAgIGxldCByZW1vdmUgPSB0cnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgY3VyckFjYyA9IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lc1tqXTtcbiAgICAgICAgICAgICAgICBpZiAoY2FjaGVkQWNjLlVVSUQgPT09IGN1cnJBY2MuVVVJRCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBmb3VuZCBleGlzdGluZyBkZXZpY2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgTG9hZGluZyBjYWNoZWQgYWNjZXNzb3J5ICR7Y2FjaGVkQWNjLmRpc3BsYXlOYW1lfSB3aXRoIFVVSUQgJHtjYWNoZWRBY2MuVVVJRH0uYCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBjYWNoZWQgZGV2aWNlIChuYW1lLCBldGMpXG4gICAgICAgICAgICAgICAgICAgIGxldCBjb250ZXh0OiBJQ29udGV4dCA9IGNhY2hlZEFjYy5jb250ZXh0IGFzIElDb250ZXh0O1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lmxhc3REYXRlQWRkZWQgPSB0aGlzLmxhc3REYXRlQWRkZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5Db2xvciAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQuY29sb3IgPSBjdXJyQWNjLkNvbG9yO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuR3JvdXBOdW1iZXIgIT09ICd1bmRlZmluZWQnKSBjb250ZXh0Lmdyb3VwTnVtYmVyID0gY3VyckFjYy5Hcm91cE51bWJlcjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLlRoZW1lSW5kZXggIT09ICd1bmRlZmluZWQnKSBjb250ZXh0LnRoZW1lSW5kZXggPSBjdXJyQWNjLlRoZW1lSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5JbnRlbnNpdHkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmJyaWdodG5lc3MgPSBjdXJyQWNjLkludGVuc2l0eTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuaXNPbiA9IGN1cnJBY2MuSW50ZW5zaXR5ID4gMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MudHlwZSAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQudHlwZSA9IGN1cnJBY2MudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLmlzT24gIT09ICd1bmRlZmluZWQnKSBjb250ZXh0LmlzT24gPSBjdXJyQWNjLmlzT247XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5OYW1lICE9PSAndW5kZWZpbmVkJykgY2FjaGVkQWNjLmRpc3BsYXlOYW1lID0gY3VyckFjYy5OYW1lO1xuICAgICAgICAgICAgICAgICAgICBjYWNoZWRBY2MuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBpLnVwZGF0ZVBsYXRmb3JtQWNjZXNzb3JpZXMoW2NhY2hlZEFjY10pO1xuICAgICAgICAgICAgICAgICAgICBMaWdodEZhY3RvcnkuY3JlYXRlTGlnaHQodGhpcywgY2FjaGVkQWNjKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLnNwbGljZShqLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlbW92ZSB0aGUgY2FjaGVkQWNjIHRoYXQgY2FuJ3QgYmUgbWF0Y2hlZFxuICAgICAgICAgICAgaWYgKHJlbW92ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYFJlbW92aW5nIGNhY2hlZCBhY2Nlc3NvcnkgJHtjYWNoZWRBY2MuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2NhY2hlZEFjYy5VVUlEfS5gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwaS51bnJlZ2lzdGVyUGxhdGZvcm1BY2Nlc3NvcmllcyhcImhvbWVicmlkZ2UtbHV4b3JcIiwgXCJMdXhvclwiLCBbY2FjaGVkQWNjXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWRkIGFueSBuZXcgYWNjZXNzb3JpZXMgdGhhdCB3ZXJlIG5vdCBwcmV2aW91c2x5IG1hdGNoZWRcbiAgICAgICAgaWYgKHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGxldCBjdXJyQWNjID0gdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzW2pdO1xuICAgICAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYEFkZGluZyBuZXcgYWNjZXNzb3J5ICR7Y3VyckFjYy5OYW1lfSB3aXRoIFVVSUQgJHtjdXJyQWNjLlVVSUR9LmApO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyQWNjLnR5cGUgPT09IElMaWdodFR5cGUuVEhFTUUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkVGhlbWVBY2Nlc3NvcnkoY3VyckFjYyk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZEdyb3VwQWNjZXNzb3J5KGN1cnJBY2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZGlkRmluaXNoTGF1bmNoaW5nQXN5bmMoKSB7XG4gICAgICAgIGlmICghdGhpcy5jb25maWcuaXBBZGRyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcih0aGlzLk5hbWUgKyBcIiBuZWVkcyBhbiBJUCBBZGRyZXNzIGluIHRoZSBjb25maWcgZmlsZS4gIFBsZWFzZSBzZWUgc2FtcGxlX2NvbmZpZy5qc29uLlwiKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2hpbGUgKGF3YWl0IHRoaXMuZ2V0Q29udHJvbGxlckFzeW5jKCkgPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBVbmFibGUgdG8gY29ubmVjdCB0byBMdXhvciBjb250cm9sbGVyLiAgV2FpdGluZyA2MHMgYW5kIHdpbGwgcmV0cnkuYClcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDYwKjEwMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy90aGlzLnJldHJpZXZlQ2FjaGVkQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZ2V0Q29udHJvbGxlckdyb3VwTGlzdEFzeW5jKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmdldENvbnRyb2xsZXJUaGVtZUxpc3RBc3luYygpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIC8vIHRoaXMucmVtb3ZlT3BoYW5lZEFjY2Vzc29yaWVzKCk7XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKCdGaW5pc2hlZCBpbml0aWFsaXppbmcnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcignRXJyb3IgaW4gZGlkRmluaXNoTGF1bmNoaW5nJywgZXJyKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5leHBvcnQgaW50ZXJmYWNlIElDb250ZXh0IHtcbiAgICBsYXN0RGF0ZUFkZGVkOiBudW1iZXI7XG4gICAgZ3JvdXBOdW1iZXI/OiBudW1iZXI7XG4gICAgYnJpZ2h0bmVzcz86IG51bWJlcjtcbiAgICB0eXBlOiBJTGlnaHRUeXBlXG4gICAgY29sb3I/OiBudW1iZXI7XG4gICAgc3RhdHVzPzogYW55O1xuICAgIGlzT246IGJvb2xlYW47XG4gICAgaHVlPzogbnVtYmVyO1xuICAgIHNhdHVyYXRpb24/OiBudW1iZXI7XG4gICAgdGhlbWVJbmRleD86IG51bWJlcjtcbiAgICBPbk9mZj86IDAgfCAxO1xuICAgIGluZGVwZW5kZW50Q29sb3JzPzogYm9vbGVhbjtcbiAgICBjb21tYW5kVGltZW91dDogbnVtYmVyO1xufSJdfQ==