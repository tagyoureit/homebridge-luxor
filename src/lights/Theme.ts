
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, Logger } from 'homebridge';
import { IContext, LuxorPlatform } from '../LuxorPlatform';
import { BaseController } from '../controller/BaseController';
import { ILightType, ZD_Light } from './ZD_Light';
import { resolve } from 'path';
import { rejects } from 'assert';

export class Theme extends ZD_Light {
    protected accessory: PlatformAccessory;
    protected log: Logger;
    protected service: Service;
    protected controller: BaseController;
    protected platform: LuxorPlatform;
    protected context: IContext;
    constructor(platform: LuxorPlatform, accessory: PlatformAccessory) {
        super(platform, accessory);
    }

    setServices() {
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, "Luxor")
            .setCharacteristic(this.platform.Characteristic.Model, this.context.type)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID);
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

        this.accessory.getService(this.platform.Service.Switch)
            .getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));

        this.accessory.on('identify', async () => {
            this.log.info(`Identifying ${this.accessory.displayName}.  Scene will turn on for 5s and then off.`);
            await this.illuminateTheme();
            await this.sleep(3000);
            await this.illuminateTheme(0);
        })

        this.getCurrentStateAsync().then(() => {
            this.setCharacteristics();
        }).catch((err) => {    
            this.log.error(`${this.accessory.displayName} setServices error: ${err}`);     
        });
        
        // don't register "fake" illumate/extinguish all themes.
        // don't register any themes because we don't care if the controller thinks they are on;
        // we want them to show as 'off' so they can act as a push button
        /* if (this.context.themeIndex < 100) {
            this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.themeIndex, this.platform.Characteristic.On, this.callbackBrightness.bind(this));
        } */
    }
    getOn(callback: CharacteristicGetCallback): void {
        // Themes should always show as off
        callback(null, 0);
    }
    setOn(desiredOn: boolean, callback: CharacteristicSetCallback): void {
        callback(null);  // call callback first so we don't encounter 6s delay and downstream status' can update properly
        setTimeout(async () => { await this.illuminateTheme(), 100 });
    };

    async illuminateTheme(desiredState: number = 1): Promise<void> {
        try {
            this.log.info(`${this.accessory.displayName} turning ${desiredState === 1 ? 'on' : 'off'}`)
            if (this.context.themeIndex === 101) {
                //all off
                await this.controller.ExtinguishAllAsync();
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
            } else if (this.context.themeIndex === 100) {
                //all on
                await this.controller.IlluminateAllAsync();
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
            }
            else {
                // if theme is on (on the luxor) turn it off so we can turn it on.  It won't 
                // set the theme if it is already "on" even if other lights have changed
                await this.controller.IlluminateThemeAsync(this.context.themeIndex, 0);
                if (desiredState === 1) {
                    await this.sleep(100);
                    await this.controller.IlluminateThemeAsync(this.context.themeIndex, 1);
                }
                this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                this.context.isOn = false;
                this.context.OnOff = 0;
                if (this.context.isOn) {
                    this.context.isOn = false;
                    this.context.OnOff = 0;
                    await this.sleep(1000);
                    // don't actually turn of switch or it will turn off lights
                    // await this.controller.IlluminateThemeAsync(this.context.themeIndex, this.context.OnOff);
                    this.service.updateCharacteristic(this.platform.Characteristic.On, false);
                }
            }
            await this.sleep(500);
            await this.controller.updateLights(true);
        }
        catch (err) {
            this.log.error(`${this.accessory.displayName} illuminateTheme: ${err}`)
        }
    };
    setCharacteristics(): void {
        this.service.updateCharacteristic(this.platform.Characteristic.On, typeof this.context.isOn !== 'undefined' ? this.context.isOn : false);
    }
    // this method used for event handling
    async getCurrentStateAsync(): Promise<void> {
        try {

            //themes should always show as off even if the controller has the state of 'on'
            this.context.isOn = false;
            this.context.OnOff = 0;
            return Promise.resolve()
        }
        catch (err){
            this.log.error(`${this.accessory.displayName} getCurrentStateAsync error: ${err}`);
            return Promise.reject(err);
        }
    };
    // this method used for callbacks
    async callbackOn(isOn: boolean): Promise<void> {
        try {
            if (this.context.isOn !== isOn) {
                this.log.debug(`${this.accessory.displayName} updated isOn to ${isOn ? 'on' : 'off'}.`);
                this.context.isOn = isOn;
                this.context.OnOff = isOn ? 1 : 0;
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.context.isOn);
            }
            return Promise.resolve();
        }
        catch (err) { this.log.error(err); return Promise.reject(err); }
    }
}