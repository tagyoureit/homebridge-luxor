const axios = require('axios').default;
import { AxiosResponse } from 'axios';
import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { BaseController, IControllerType, IGroupList, IThemeList } from './controller/BaseController';
import { ControllerFactory } from './controller/ControllerFactory';
import { LightFactory } from './lights/LightFactory';
import { Theme } from './lights/Theme';
import { ILightType } from './lights/ZD_Light';



export class LuxorPlatform implements DynamicPlatformPlugin {
    // this is used to track restored cached accessories
    public accessories: PlatformAccessory[] = [];
    public controller: BaseController;// will be assigned to ZD or ZDC controller
    public Name: string;
    public lastDateAdded: number;
    public readonly Service: typeof Service;
    public readonly Characteristic: typeof Characteristic;
    private currGroupsAndThemes: IGroupList[] & IThemeList[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API
    ) {
        this.config = config;
        this.log = log;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.Name = config.name;
        this.lastDateAdded = Date.now();
        this.controller = ControllerFactory.createController({ type: 'base' }, this.log)

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
    configureAccessory(accessory: PlatformAccessory) {
        this.log.debug(`Retrieved cached accessory ${accessory.displayName} with UUID ${accessory.UUID}`);
        this.accessories[accessory.UUID] = accessory;
    }
    async getControllerAsync():Promise<boolean> {
        // get the name of the controller

        this.log.info(this.Name + ": Starting search for controller at: " + this.config.ipAddr);
        try {
            //Search for controllor and make sure we can find it
            const response:AxiosResponse = await axios.post(
                `http://${this.config.ipAddr}/ControllerName.json`
            )
            if (response.status !== 200) { this.log.error('Received a status code of ' + response.status + ' when trying to connect to the controller.'); return false; }
            let controllerNameData = response.data;
            controllerNameData.ip = this.config.ipAddr;
            controllerNameData.platform = this;
            controllerNameData.commandTimeout = this.config.commandTimeout;
            if (controllerNameData.Controller.substring(0, 5) === 'luxor') {
                controllerNameData.type = IControllerType.ZD;
            } else if (controllerNameData.Controller.substring(0, 5) === 'lxzdc') {
                controllerNameData.type = IControllerType.ZDC;
            } else if (controllerNameData.Controller.substring(0, 5) === 'lxtwo') {
                controllerNameData.type = IControllerType.ZDTWO;
            } else {
                controllerNameData.type = IControllerType.ZDTWO;
                this.log.info('Found unknown controller named %s of type %s, assuming a ZDTWO', controllerNameData.Controller, controllerNameData.type);
            }
            this.log.info(`Found Controller named ${controllerNameData.Controller} of type ${controllerNameData.type}.`);
            this.controller = ControllerFactory.createController(controllerNameData, this.log);
            return true;
        }
        catch (err) {
            this.log.error(this.Name + ' was not able to connect to connect to the controller. ', err);
            return false;
        };

    }
    async getControllerGroupListAsync() {
        // Get the list of light groups from the controller
        if (this.config.hideGroups) return;
        try {
            let groupLists = await this.controller.GroupListGetAsync();
            this.log.info(`Retrieved ${groupLists.length} light groups from controller.`);
            for (var i in groupLists) {
                this.currGroupsAndThemes.push(groupLists[i]);
            }
        }
        catch (err) {
            this.log.error(`was not able to retrieve light groups from controller.\n${err}\n${err}`);
        };
    }
    async getControllerThemeListAsync() {
        // Get the list of light LuxorThemes from the controller
        try {
            let themeLists = await this.controller.ThemeListGetAsync();
            this.log.info(`Retrieved ${themeLists.length} themes from controller.`);

            if (typeof this.config.noAllThemes !== 'undefined' && this.config.noAllThemes){
                this.log.info(`Not creating Illuminate All and Extinguish All themes per config setting.`);
            }
            else {
                themeLists.push({
                    Name: 'Illuminate all lights',
                    ThemeIndex: 100,
                    OnOff: 0,
                    isOn: false,
                    type: ILightType.THEME
                });
                themeLists.push({
                    Name: 'Extinguish all lights',
                    ThemeIndex: 101,
                    OnOff: 0,
                    isOn: false,
                    type: ILightType.THEME
                });
            }
            for (var i in themeLists) {
                themeLists[i].type = ILightType.THEME;
                this.currGroupsAndThemes.push(themeLists[i]);
            }
        }
        catch (err) {
            this.log.error('was not able to retrieve light themes from controller.', err);
        };
    }

    removeAccessories() {
        for (var UUID in this.accessories) {
            let accessory = this.accessories[UUID];
            if (typeof this.config.removeAllAccessories !== 'undefined' && this.config.removeAllAccessories || typeof this.config.removeAccessories !== 'undefined' && this.config.removeAccessories.includes(accessory.UUID)) {
                this.log.info(`Removing cached accessory ${accessory.displayName} with UUID ${accessory.UUID} per platform configuration settings.`);
                this.api.unregisterPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
                this.accessories = this.accessories.filter(item => item.UUID !== UUID);
            };
        }
    }

    addGroupAccessory(lightGroup: IGroupList) {
        var accessory = new this.api.platformAccessory(lightGroup.Name, lightGroup.UUID);
        let context: IContext = {
            lastDateAdded: this.lastDateAdded,
            color: lightGroup.Color,
            groupNumber: lightGroup.GroupNumber,
            brightness: lightGroup.Intensity,
            type: lightGroup.type,
            isOn: lightGroup.Intensity > 0,
            independentColors: this.config.independentColors,
            commandTimeout: this.config.commandTimeout
        }
        accessory.context = context;
        LightFactory.createLight(this, accessory);
        this.api.registerPlatformAccessories("homebridge-luxor", "Luxor", [accessory]);
    }

    addThemeAccessory(themeGroup: IThemeList) {
        var accessory = new this.api.platformAccessory(themeGroup.Name, themeGroup.UUID);
        let context: IContext = {
            lastDateAdded: this.lastDateAdded,
            type: ILightType.THEME,
            isOn: themeGroup.OnOff === 1,
            themeIndex: themeGroup.ThemeIndex,
            OnOff: themeGroup.OnOff,
            commandTimeout: this.config.commandTimeout
        }
        accessory.context = context;
        LightFactory.createLight(this, accessory);
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
        this.removeAccessories()
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
                    let context: IContext = cachedAcc.context as IContext;
                    context.lastDateAdded = this.lastDateAdded;
                    if (typeof currAcc.Color !== 'undefined') context.color = currAcc.Color;
                    if (typeof currAcc.GroupNumber !== 'undefined') context.groupNumber = currAcc.GroupNumber;
                    if (typeof currAcc.ThemeIndex !== 'undefined') context.themeIndex = currAcc.ThemeIndex;
                    if (typeof currAcc.Intensity !== 'undefined') {
                        context.brightness = currAcc.Intensity;
                        context.isOn = currAcc.Intensity > 0;
                    }
                    if (typeof currAcc.type !== 'undefined') context.type = currAcc.type;
                    if (typeof currAcc.isOn !== 'undefined') context.isOn = currAcc.isOn;
                    if (typeof currAcc.Name !== 'undefined') cachedAcc.displayName = currAcc.Name;
                    cachedAcc.context = context;
                    this.api.updatePlatformAccessories([cachedAcc]);
                    LightFactory.createLight(this, cachedAcc);
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
                if (currAcc.type === ILightType.THEME)
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
                this.log.info(`Unable to connect to Luxor controller.  Waiting 60s and will retry.`)
                await this.sleep(60*1000);
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
        };
    }
}
export interface IContext {
    lastDateAdded: number;
    groupNumber?: number;
    brightness?: number;
    type: ILightType
    color?: number;
    status?: any;
    isOn: boolean;
    hue?: number;
    saturation?: number;
    themeIndex?: number;
    OnOff?: 0 | 1;
    independentColors?: boolean;
    commandTimeout: number;
}