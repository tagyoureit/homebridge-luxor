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
            const response = await axios.post(`http://${this.config.ipAddr}/ControllerName.json`);
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
            this.log.error(this.Name + ' was not able to connect to connect to the controller. ', err.message);
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
            let isConnected = false;
            while (!isConnected) {
                isConnected = await this.getControllerAsync();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTHV4b3JQbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9MdXhvclBsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFJdkMsZ0VBQXNHO0FBQ3RHLHNFQUFtRTtBQUNuRSx3REFBcUQ7QUFFckQsZ0RBQStDO0FBSS9DLE1BQWEsYUFBYTtJQVV0QixZQUNvQixHQUFXLEVBQ1gsTUFBc0IsRUFDdEIsR0FBUTtRQUZSLFFBQUcsR0FBSCxHQUFHLENBQVE7UUFDWCxXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUN0QixRQUFHLEdBQUgsR0FBRyxDQUFLO1FBWjVCLG9EQUFvRDtRQUM3QyxnQkFBVyxHQUF3QixFQUFFLENBQUM7UUFNckMsd0JBQW1CLEdBQWdDLEVBQUUsQ0FBQztRQU8xRCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ2xELElBQUksQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLHFDQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUVoRixJQUFJLEdBQUcsRUFBRTtZQUNMLGtHQUFrRztZQUNsRyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FB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QUFDO1lBQ3hCLE9BQU8sQ0FBQyxXQUFXLEVBQUM7Z0JBQ2hCLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUM5QyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxRUFBcUUsQ0FBQyxDQUFBO2dCQUNwRixNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFDLElBQUksQ0FBQyxDQUFDO2FBQzdCO1lBQ0QsbUNBQW1DO1lBQ25DLE1BQU0sSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztZQUN6QyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2hDLG1DQUFtQztZQUNuQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1NBQzFDO1FBQ0QsT0FBTyxHQUFHLEVBQUU7WUFDUixJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN0RDtRQUFBLENBQUM7SUFDTixDQUFDO0NBQ0o7QUExUEQsc0NBMFBDIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgYXhpb3MgPSByZXF1aXJlKCdheGlvcycpLmRlZmF1bHQ7XG5pbXBvcnQgeyBBeGlvc1Jlc3BvbnNlIH0gZnJvbSAnYXhpb3MnO1xuaW1wb3J0IHsgQVBJLCBDaGFyYWN0ZXJpc3RpYywgRHluYW1pY1BsYXRmb3JtUGx1Z2luLCBMb2dnZXIsIFBsYXRmb3JtQWNjZXNzb3J5LCBQbGF0Zm9ybUNvbmZpZywgU2VydmljZSB9IGZyb20gJ2hvbWVicmlkZ2UnO1xuXG5pbXBvcnQgeyBCYXNlQ29udHJvbGxlciwgSUNvbnRyb2xsZXJUeXBlLCBJR3JvdXBMaXN0LCBJVGhlbWVMaXN0IH0gZnJvbSAnLi9jb250cm9sbGVyL0Jhc2VDb250cm9sbGVyJztcbmltcG9ydCB7IENvbnRyb2xsZXJGYWN0b3J5IH0gZnJvbSAnLi9jb250cm9sbGVyL0NvbnRyb2xsZXJGYWN0b3J5JztcbmltcG9ydCB7IExpZ2h0RmFjdG9yeSB9IGZyb20gJy4vbGlnaHRzL0xpZ2h0RmFjdG9yeSc7XG5pbXBvcnQgeyBUaGVtZSB9IGZyb20gJy4vbGlnaHRzL1RoZW1lJztcbmltcG9ydCB7IElMaWdodFR5cGUgfSBmcm9tICcuL2xpZ2h0cy9aRF9MaWdodCc7XG5cblxuXG5leHBvcnQgY2xhc3MgTHV4b3JQbGF0Zm9ybSBpbXBsZW1lbnRzIER5bmFtaWNQbGF0Zm9ybVBsdWdpbiB7XG4gICAgLy8gdGhpcyBpcyB1c2VkIHRvIHRyYWNrIHJlc3RvcmVkIGNhY2hlZCBhY2Nlc3Nvcmllc1xuICAgIHB1YmxpYyBhY2Nlc3NvcmllczogUGxhdGZvcm1BY2Nlc3NvcnlbXSA9IFtdO1xuICAgIHB1YmxpYyBjb250cm9sbGVyOiBCYXNlQ29udHJvbGxlcjsvLyB3aWxsIGJlIGFzc2lnbmVkIHRvIFpEIG9yIFpEQyBjb250cm9sbGVyXG4gICAgcHVibGljIE5hbWU6IHN0cmluZztcbiAgICBwdWJsaWMgbGFzdERhdGVBZGRlZDogbnVtYmVyO1xuICAgIHB1YmxpYyByZWFkb25seSBTZXJ2aWNlOiB0eXBlb2YgU2VydmljZTtcbiAgICBwdWJsaWMgcmVhZG9ubHkgQ2hhcmFjdGVyaXN0aWM6IHR5cGVvZiBDaGFyYWN0ZXJpc3RpYztcbiAgICBwcml2YXRlIGN1cnJHcm91cHNBbmRUaGVtZXM6IElHcm91cExpc3RbXSAmIElUaGVtZUxpc3RbXSA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBsb2c6IExvZ2dlcixcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGNvbmZpZzogUGxhdGZvcm1Db25maWcsXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBhcGk6IEFQSVxuICAgICkge1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICAgICAgdGhpcy5sb2cgPSBsb2c7XG4gICAgICAgIHRoaXMuU2VydmljZSA9IHRoaXMuYXBpLmhhcC5TZXJ2aWNlO1xuICAgICAgICB0aGlzLkNoYXJhY3RlcmlzdGljID0gdGhpcy5hcGkuaGFwLkNoYXJhY3RlcmlzdGljO1xuICAgICAgICB0aGlzLk5hbWUgPSBjb25maWcubmFtZTtcbiAgICAgICAgdGhpcy5sYXN0RGF0ZUFkZGVkID0gRGF0ZS5ub3coKTtcbiAgICAgICAgdGhpcy5jb250cm9sbGVyID0gQ29udHJvbGxlckZhY3RvcnkuY3JlYXRlQ29udHJvbGxlcih7IHR5cGU6ICdiYXNlJyB9LCB0aGlzLmxvZylcblxuICAgICAgICBpZiAoYXBpKSB7XG4gICAgICAgICAgICAvLyBTYXZlIHRoZSBBUEkgb2JqZWN0IGFzIHBsdWdpbiBuZWVkcyB0byByZWdpc3RlciBuZXcgdGhpcy5hcGkucGxhdGZvcm1BY2Nlc3NvcnkgdmlhIHRoaXMgb2JqZWN0LlxuICAgICAgICAgICAgdGhpcy5hcGkgPSBhcGk7XG5cbiAgICAgICAgICAgIC8vIExpc3RlbiB0byBldmVudCBcImRpZEZpbmlzaExhdW5jaGluZ1wiLCB0aGlzIG1lYW5zIGhvbWVicmlkZ2UgYWxyZWFkeSBmaW5pc2hlZCBsb2FkaW5nIGNhY2hlZCBhY2Nlc3Nvcmllc1xuICAgICAgICAgICAgLy8gUGxhdGZvcm0gUGx1Z2luIHNob3VsZCBvbmx5IHJlZ2lzdGVyIG5ldyB0aGlzLmFwaS5wbGF0Zm9ybUFjY2Vzc29yeSB0aGF0IGRvZXNuJ3QgZXhpc3QgaW4gaG9tZWJyaWRnZSBhZnRlciB0aGlzIGV2ZW50LlxuICAgICAgICAgICAgLy8gT3Igc3RhcnQgZGlzY292ZXIgbmV3IGFjY2Vzc29yaWVzXG4gICAgICAgICAgICB0aGlzLmFwaS5vbignZGlkRmluaXNoTGF1bmNoaW5nJywgdGhpcy5kaWRGaW5pc2hMYXVuY2hpbmdBc3luYy5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBzbGVlcChtcykge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gICAgfVxuICAgIC8vIEZ1bmN0aW9uIGludm9rZWQgd2hlbiBob21lYnJpZGdlIHRyaWVzIHRvIHJlc3RvcmUgY2FjaGVkIGFjY2Vzc29yeVxuICAgIC8vIERldmVsb3BlciBjYW4gY29uZmlndXJlIGFjY2Vzc29yeSBhdCBoZXJlIChsaWtlIHNldHVwIGV2ZW50IGhhbmRsZXIpXG4gICAgY29uZmlndXJlQWNjZXNzb3J5KGFjY2Vzc29yeTogUGxhdGZvcm1BY2Nlc3NvcnkpIHtcbiAgICAgICAgdGhpcy5sb2cuZGVidWcoYFJldHJpZXZlZCBjYWNoZWQgYWNjZXNzb3J5ICR7YWNjZXNzb3J5LmRpc3BsYXlOYW1lfSB3aXRoIFVVSUQgJHthY2Nlc3NvcnkuVVVJRH1gKTtcbiAgICAgICAgdGhpcy5hY2Nlc3Nvcmllc1thY2Nlc3NvcnkuVVVJRF0gPSBhY2Nlc3Nvcnk7XG4gICAgfVxuICAgIGFzeW5jIGdldENvbnRyb2xsZXJBc3luYygpOlByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICAvLyBnZXQgdGhlIG5hbWUgb2YgdGhlIGNvbnRyb2xsZXJcblxuICAgICAgICB0aGlzLmxvZy5pbmZvKHRoaXMuTmFtZSArIFwiOiBTdGFydGluZyBzZWFyY2ggZm9yIGNvbnRyb2xsZXIgYXQ6IFwiICsgdGhpcy5jb25maWcuaXBBZGRyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vU2VhcmNoIGZvciBjb250cm9sbG9yIGFuZCBtYWtlIHN1cmUgd2UgY2FuIGZpbmQgaXRcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOkF4aW9zUmVzcG9uc2UgPSBhd2FpdCBheGlvcy5wb3N0KFxuICAgICAgICAgICAgICAgIGBodHRwOi8vJHt0aGlzLmNvbmZpZy5pcEFkZHJ9L0NvbnRyb2xsZXJOYW1lLmpzb25gXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSAyMDApIHsgdGhpcy5sb2cuZXJyb3IoJ1JlY2VpdmVkIGEgc3RhdHVzIGNvZGUgb2YgJyArIHJlc3BvbnNlLnN0YXR1cyArICcgd2hlbiB0cnlpbmcgdG8gY29ubmVjdCB0byB0aGUgY29udHJvbGxlci4nKTsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgICBsZXQgY29udHJvbGxlck5hbWVEYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS5pcCA9IHRoaXMuY29uZmlnLmlwQWRkcjtcbiAgICAgICAgICAgIGNvbnRyb2xsZXJOYW1lRGF0YS5wbGF0Zm9ybSA9IHRoaXM7XG4gICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEuY29tbWFuZFRpbWVvdXQgPSB0aGlzLmNvbmZpZy5jb21tYW5kVGltZW91dDtcbiAgICAgICAgICAgIGlmIChjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlci5zdWJzdHJpbmcoMCwgNSkgPT09ICdsdXhvcicpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aRDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udHJvbGxlck5hbWVEYXRhLkNvbnRyb2xsZXIuc3Vic3RyaW5nKDAsIDUpID09PSAnbHh6ZGMnKSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkRDO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlci5zdWJzdHJpbmcoMCwgNSkgPT09ICdseHR3bycpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyTmFtZURhdGEudHlwZSA9IElDb250cm9sbGVyVHlwZS5aRFRXTztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlck5hbWVEYXRhLnR5cGUgPSBJQ29udHJvbGxlclR5cGUuWkRUV087XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbygnRm91bmQgdW5rbm93biBjb250cm9sbGVyIG5hbWVkICVzIG9mIHR5cGUgJXMsIGFzc3VtaW5nIGEgWkRUV08nLCBjb250cm9sbGVyTmFtZURhdGEuQ29udHJvbGxlciwgY29udHJvbGxlck5hbWVEYXRhLnR5cGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgRm91bmQgQ29udHJvbGxlciBuYW1lZCAke2NvbnRyb2xsZXJOYW1lRGF0YS5Db250cm9sbGVyfSBvZiB0eXBlICR7Y29udHJvbGxlck5hbWVEYXRhLnR5cGV9LmApO1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyID0gQ29udHJvbGxlckZhY3RvcnkuY3JlYXRlQ29udHJvbGxlcihjb250cm9sbGVyTmFtZURhdGEsIHRoaXMubG9nKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKHRoaXMuTmFtZSArICcgd2FzIG5vdCBhYmxlIHRvIGNvbm5lY3QgdG8gY29ubmVjdCB0byB0aGUgY29udHJvbGxlci4gJywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcblxuICAgIH1cbiAgICBhc3luYyBnZXRDb250cm9sbGVyR3JvdXBMaXN0QXN5bmMoKSB7XG4gICAgICAgIC8vIEdldCB0aGUgbGlzdCBvZiBsaWdodCBncm91cHMgZnJvbSB0aGUgY29udHJvbGxlclxuICAgICAgICBpZiAodGhpcy5jb25maWcuaGlkZUdyb3VwcykgcmV0dXJuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IGdyb3VwTGlzdHMgPSBhd2FpdCB0aGlzLmNvbnRyb2xsZXIuR3JvdXBMaXN0R2V0QXN5bmMoKTtcbiAgICAgICAgICAgIHRoaXMubG9nLmluZm8oYFJldHJpZXZlZCAke2dyb3VwTGlzdHMubGVuZ3RofSBsaWdodCBncm91cHMgZnJvbSBjb250cm9sbGVyLmApO1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBncm91cExpc3RzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLnB1c2goZ3JvdXBMaXN0c1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgdGhpcy5sb2cuZXJyb3IoYHdhcyBub3QgYWJsZSB0byByZXRyaWV2ZSBsaWdodCBncm91cHMgZnJvbSBjb250cm9sbGVyLlxcbiR7ZXJyfVxcbiR7ZXJyfWApO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBhc3luYyBnZXRDb250cm9sbGVyVGhlbWVMaXN0QXN5bmMoKSB7XG4gICAgICAgIC8vIEdldCB0aGUgbGlzdCBvZiBsaWdodCBMdXhvclRoZW1lcyBmcm9tIHRoZSBjb250cm9sbGVyXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgdGhlbWVMaXN0cyA9IGF3YWl0IHRoaXMuY29udHJvbGxlci5UaGVtZUxpc3RHZXRBc3luYygpO1xuICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmV0cmlldmVkICR7dGhlbWVMaXN0cy5sZW5ndGh9IHRoZW1lcyBmcm9tIGNvbnRyb2xsZXIuYCk7XG5cbiAgICAgICAgICAgIHRoZW1lTGlzdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgTmFtZTogJ0lsbHVtaW5hdGUgYWxsIGxpZ2h0cycsXG4gICAgICAgICAgICAgICAgVGhlbWVJbmRleDogMTAwLFxuICAgICAgICAgICAgICAgIE9uT2ZmOiAwLFxuICAgICAgICAgICAgICAgIGlzT246IGZhbHNlLFxuICAgICAgICAgICAgICAgIHR5cGU6IElMaWdodFR5cGUuVEhFTUVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhlbWVMaXN0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBOYW1lOiAnRXh0aW5ndWlzaCBhbGwgbGlnaHRzJyxcbiAgICAgICAgICAgICAgICBUaGVtZUluZGV4OiAxMDEsXG4gICAgICAgICAgICAgICAgT25PZmY6IDAsXG4gICAgICAgICAgICAgICAgaXNPbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgdHlwZTogSUxpZ2h0VHlwZS5USEVNRVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIHRoZW1lTGlzdHMpIHtcbiAgICAgICAgICAgICAgICB0aGVtZUxpc3RzW2ldLnR5cGUgPSBJTGlnaHRUeXBlLlRIRU1FO1xuICAgICAgICAgICAgICAgIHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5wdXNoKHRoZW1lTGlzdHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKCd3YXMgbm90IGFibGUgdG8gcmV0cmlldmUgbGlnaHQgdGhlbWVzIGZyb20gY29udHJvbGxlci4nLCBlcnIpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlbW92ZUFjY2Vzc29yaWVzKCkge1xuICAgICAgICBmb3IgKHZhciBVVUlEIGluIHRoaXMuYWNjZXNzb3JpZXMpIHtcbiAgICAgICAgICAgIGxldCBhY2Nlc3NvcnkgPSB0aGlzLmFjY2Vzc29yaWVzW1VVSURdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbmZpZy5yZW1vdmVBbGxBY2Nlc3NvcmllcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5jb25maWcucmVtb3ZlQWxsQWNjZXNzb3JpZXMgfHwgdHlwZW9mIHRoaXMuY29uZmlnLnJlbW92ZUFjY2Vzc29yaWVzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLmNvbmZpZy5yZW1vdmVBY2Nlc3Nvcmllcy5pbmNsdWRlcyhhY2Nlc3NvcnkuVVVJRCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBSZW1vdmluZyBjYWNoZWQgYWNjZXNzb3J5ICR7YWNjZXNzb3J5LmRpc3BsYXlOYW1lfSB3aXRoIFVVSUQgJHthY2Nlc3NvcnkuVVVJRH0gcGVyIHBsYXRmb3JtIGNvbmZpZ3VyYXRpb24gc2V0dGluZ3MuYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcGkudW5yZWdpc3RlclBsYXRmb3JtQWNjZXNzb3JpZXMoXCJob21lYnJpZGdlLWx1eG9yXCIsIFwiTHV4b3JcIiwgW2FjY2Vzc29yeV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuYWNjZXNzb3JpZXMgPSB0aGlzLmFjY2Vzc29yaWVzLmZpbHRlcihpdGVtID0+IGl0ZW0uVVVJRCAhPT0gVVVJRCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkR3JvdXBBY2Nlc3NvcnkobGlnaHRHcm91cDogSUdyb3VwTGlzdCkge1xuICAgICAgICB2YXIgYWNjZXNzb3J5ID0gbmV3IHRoaXMuYXBpLnBsYXRmb3JtQWNjZXNzb3J5KGxpZ2h0R3JvdXAuTmFtZSwgbGlnaHRHcm91cC5VVUlEKTtcbiAgICAgICAgbGV0IGNvbnRleHQ6IElDb250ZXh0ID0ge1xuICAgICAgICAgICAgbGFzdERhdGVBZGRlZDogdGhpcy5sYXN0RGF0ZUFkZGVkLFxuICAgICAgICAgICAgY29sb3I6IGxpZ2h0R3JvdXAuQ29sb3IsXG4gICAgICAgICAgICBncm91cE51bWJlcjogbGlnaHRHcm91cC5Hcm91cE51bWJlcixcbiAgICAgICAgICAgIGJyaWdodG5lc3M6IGxpZ2h0R3JvdXAuSW50ZW5zaXR5LFxuICAgICAgICAgICAgdHlwZTogbGlnaHRHcm91cC50eXBlLFxuICAgICAgICAgICAgaXNPbjogbGlnaHRHcm91cC5JbnRlbnNpdHkgPiAwLFxuICAgICAgICAgICAgaW5kZXBlbmRlbnRDb2xvcnM6IHRoaXMuY29uZmlnLmluZGVwZW5kZW50Q29sb3JzLFxuICAgICAgICAgICAgY29tbWFuZFRpbWVvdXQ6IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0XG4gICAgICAgIH1cbiAgICAgICAgYWNjZXNzb3J5LmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICBMaWdodEZhY3RvcnkuY3JlYXRlTGlnaHQodGhpcywgYWNjZXNzb3J5KTtcbiAgICAgICAgdGhpcy5hcGkucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFthY2Nlc3NvcnldKTtcbiAgICB9XG5cbiAgICBhZGRUaGVtZUFjY2Vzc29yeSh0aGVtZUdyb3VwOiBJVGhlbWVMaXN0KSB7XG4gICAgICAgIHZhciBhY2Nlc3NvcnkgPSBuZXcgdGhpcy5hcGkucGxhdGZvcm1BY2Nlc3NvcnkodGhlbWVHcm91cC5OYW1lLCB0aGVtZUdyb3VwLlVVSUQpO1xuICAgICAgICBsZXQgY29udGV4dDogSUNvbnRleHQgPSB7XG4gICAgICAgICAgICBsYXN0RGF0ZUFkZGVkOiB0aGlzLmxhc3REYXRlQWRkZWQsXG4gICAgICAgICAgICB0eXBlOiBJTGlnaHRUeXBlLlRIRU1FLFxuICAgICAgICAgICAgaXNPbjogdGhlbWVHcm91cC5Pbk9mZiA9PT0gMSxcbiAgICAgICAgICAgIHRoZW1lSW5kZXg6IHRoZW1lR3JvdXAuVGhlbWVJbmRleCxcbiAgICAgICAgICAgIE9uT2ZmOiB0aGVtZUdyb3VwLk9uT2ZmLFxuICAgICAgICAgICAgY29tbWFuZFRpbWVvdXQ6IHRoaXMuY29uZmlnLmNvbW1hbmRUaW1lb3V0XG4gICAgICAgIH1cbiAgICAgICAgYWNjZXNzb3J5LmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgICBMaWdodEZhY3RvcnkuY3JlYXRlTGlnaHQodGhpcywgYWNjZXNzb3J5KTtcbiAgICAgICAgdGhpcy5hY2Nlc3Nvcmllc1thY2Nlc3NvcnkuVVVJRF0gPSBhY2Nlc3Nvcnk7XG4gICAgICAgIHRoaXMuYXBpLnJlZ2lzdGVyUGxhdGZvcm1BY2Nlc3NvcmllcyhcImhvbWVicmlkZ2UtbHV4b3JcIiwgXCJMdXhvclwiLCBbYWNjZXNzb3J5XSk7XG4gICAgfVxuXG4gICAgYXNzaWduVVVJRHMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYWNjID0gdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzW2ldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY2MuVGhlbWVJbmRleCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBhY2MuVVVJRCA9IHRoaXMuYXBpLmhhcC51dWlkLmdlbmVyYXRlKCdsdXhvci4nICsgYHRoZW1lLSR7YWNjLlRoZW1lSW5kZXh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhY2MuVVVJRCA9IHRoaXMuYXBpLmhhcC51dWlkLmdlbmVyYXRlKCdsdXhvci4nICsgYGdyb3VwLi0ke2FjYy5Hcm91cE51bWJlcn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHByb2Nlc3NBY2Nlc3NvcmllcygpIHtcbiAgICAgICAgdGhpcy5hc3NpZ25VVUlEcygpO1xuICAgICAgICB0aGlzLnJlbW92ZUFjY2Vzc29yaWVzKClcbiAgICAgICAgZm9yICh2YXIgVVVJRCBpbiB0aGlzLmFjY2Vzc29yaWVzKSB7XG4gICAgICAgICAgICBsZXQgY2FjaGVkQWNjID0gdGhpcy5hY2Nlc3Nvcmllc1tVVUlEXTtcbiAgICAgICAgICAgIC8vIGxvb2sgZm9yIG1hdGNoIG9uIGN1cnJlbnQgZGV2aWNlc1xuICAgICAgICAgICAgbGV0IHJlbW92ZSA9IHRydWU7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuY3Vyckdyb3Vwc0FuZFRoZW1lcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGxldCBjdXJyQWNjID0gdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZWRBY2MuVVVJRCA9PT0gY3VyckFjYy5VVUlEKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZvdW5kIGV4aXN0aW5nIGRldmljZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBMb2FkaW5nIGNhY2hlZCBhY2Nlc3NvcnkgJHtjYWNoZWRBY2MuZGlzcGxheU5hbWV9IHdpdGggVVVJRCAke2NhY2hlZEFjYy5VVUlEfS5gKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGNhY2hlZCBkZXZpY2UgKG5hbWUsIGV0YylcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvbnRleHQ6IElDb250ZXh0ID0gY2FjaGVkQWNjLmNvbnRleHQgYXMgSUNvbnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQubGFzdERhdGVBZGRlZCA9IHRoaXMubGFzdERhdGVBZGRlZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLkNvbG9yICE9PSAndW5kZWZpbmVkJykgY29udGV4dC5jb2xvciA9IGN1cnJBY2MuQ29sb3I7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy5Hcm91cE51bWJlciAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQuZ3JvdXBOdW1iZXIgPSBjdXJyQWNjLkdyb3VwTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuVGhlbWVJbmRleCAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQudGhlbWVJbmRleCA9IGN1cnJBY2MuVGhlbWVJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLkludGVuc2l0eSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuYnJpZ2h0bmVzcyA9IGN1cnJBY2MuSW50ZW5zaXR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5pc09uID0gY3VyckFjYy5JbnRlbnNpdHkgPiAwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyckFjYy50eXBlICE9PSAndW5kZWZpbmVkJykgY29udGV4dC50eXBlID0gY3VyckFjYy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJBY2MuaXNPbiAhPT0gJ3VuZGVmaW5lZCcpIGNvbnRleHQuaXNPbiA9IGN1cnJBY2MuaXNPbjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyQWNjLk5hbWUgIT09ICd1bmRlZmluZWQnKSBjYWNoZWRBY2MuZGlzcGxheU5hbWUgPSBjdXJyQWNjLk5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGNhY2hlZEFjYy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcGkudXBkYXRlUGxhdGZvcm1BY2Nlc3NvcmllcyhbY2FjaGVkQWNjXSk7XG4gICAgICAgICAgICAgICAgICAgIExpZ2h0RmFjdG9yeS5jcmVhdGVMaWdodCh0aGlzLCBjYWNoZWRBY2MpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXMuc3BsaWNlKGosIDEpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gcmVtb3ZlIHRoZSBjYWNoZWRBY2MgdGhhdCBjYW4ndCBiZSBtYXRjaGVkXG4gICAgICAgICAgICBpZiAocmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgUmVtb3ZpbmcgY2FjaGVkIGFjY2Vzc29yeSAke2NhY2hlZEFjYy5kaXNwbGF5TmFtZX0gd2l0aCBVVUlEICR7Y2FjaGVkQWNjLlVVSUR9LmApO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBpLnVucmVnaXN0ZXJQbGF0Zm9ybUFjY2Vzc29yaWVzKFwiaG9tZWJyaWRnZS1sdXhvclwiLCBcIkx1eG9yXCIsIFtjYWNoZWRBY2NdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgYW55IG5ldyBhY2Nlc3NvcmllcyB0aGF0IHdlcmUgbm90IHByZXZpb3VzbHkgbWF0Y2hlZFxuICAgICAgICBpZiAodGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5jdXJyR3JvdXBzQW5kVGhlbWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJBY2MgPSB0aGlzLmN1cnJHcm91cHNBbmRUaGVtZXNbal07XG4gICAgICAgICAgICAgICAgdGhpcy5sb2cuaW5mbyhgQWRkaW5nIG5ldyBhY2Nlc3NvcnkgJHtjdXJyQWNjLk5hbWV9IHdpdGggVVVJRCAke2N1cnJBY2MuVVVJRH0uYCk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJBY2MudHlwZSA9PT0gSUxpZ2h0VHlwZS5USEVNRSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRUaGVtZUFjY2Vzc29yeShjdXJyQWNjKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkR3JvdXBBY2Nlc3NvcnkoY3VyckFjYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBkaWRGaW5pc2hMYXVuY2hpbmdBc3luYygpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbmZpZy5pcEFkZHIpIHtcbiAgICAgICAgICAgIHRoaXMubG9nLmVycm9yKHRoaXMuTmFtZSArIFwiIG5lZWRzIGFuIElQIEFkZHJlc3MgaW4gdGhlIGNvbmZpZyBmaWxlLiAgUGxlYXNlIHNlZSBzYW1wbGVfY29uZmlnLmpzb24uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgaXNDb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHdoaWxlICghaXNDb25uZWN0ZWQpe1xuICAgICAgICAgICAgICAgIGlzQ29ubmVjdGVkID0gYXdhaXQgdGhpcy5nZXRDb250cm9sbGVyQXN5bmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvZy5pbmZvKGBVbmFibGUgdG8gY29ubmVjdCB0byBMdXhvciBjb250cm9sbGVyLiAgV2FpdGluZyA2MHMgYW5kIHdpbGwgcmV0cnkuYClcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDYwKjEwMDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy90aGlzLnJldHJpZXZlQ2FjaGVkQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZ2V0Q29udHJvbGxlckdyb3VwTGlzdEFzeW5jKCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmdldENvbnRyb2xsZXJUaGVtZUxpc3RBc3luYygpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wcm9jZXNzQWNjZXNzb3JpZXMoKTtcbiAgICAgICAgICAgIC8vIHRoaXMucmVtb3ZlT3BoYW5lZEFjY2Vzc29yaWVzKCk7XG4gICAgICAgICAgICB0aGlzLmxvZy5pbmZvKCdGaW5pc2hlZCBpbml0aWFsaXppbmcnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmxvZy5lcnJvcignRXJyb3IgaW4gZGlkRmluaXNoTGF1bmNoaW5nJywgZXJyKTtcbiAgICAgICAgfTtcbiAgICB9XG59XG5leHBvcnQgaW50ZXJmYWNlIElDb250ZXh0IHtcbiAgICBsYXN0RGF0ZUFkZGVkOiBudW1iZXI7XG4gICAgZ3JvdXBOdW1iZXI/OiBudW1iZXI7XG4gICAgYnJpZ2h0bmVzcz86IG51bWJlcjtcbiAgICB0eXBlOiBJTGlnaHRUeXBlXG4gICAgY29sb3I/OiBudW1iZXI7XG4gICAgc3RhdHVzPzogYW55O1xuICAgIGlzT246IGJvb2xlYW47XG4gICAgaHVlPzogbnVtYmVyO1xuICAgIHNhdHVyYXRpb24/OiBudW1iZXI7XG4gICAgdGhlbWVJbmRleD86IG51bWJlcjtcbiAgICBPbk9mZj86IDAgfCAxO1xuICAgIGluZGVwZW5kZW50Q29sb3JzPzogYm9vbGVhbjtcbiAgICBjb21tYW5kVGltZW91dDogbnVtYmVyO1xufSJdfQ==