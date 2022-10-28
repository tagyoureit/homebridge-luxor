
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, Logger, HAPStatus } from 'homebridge';
import { IContext, LuxorPlatform } from '../LuxorPlatform';
import { BaseController } from '../controller/BaseController';

export class ZD_Light {
    protected accessory: PlatformAccessory;
    protected log: Logger;
    protected service: Service;
    protected controller: BaseController;
    protected platform: LuxorPlatform;
    protected context: IContext;
    constructor(platform: LuxorPlatform, accessory: PlatformAccessory) {
        this.controller = platform.controller;
        this.accessory = accessory;
        this.log = platform.log;
        this.platform = platform;
        this.context = this.accessory.context as IContext;
        this.log.info(`Initializing ${this.accessory.displayName}.`);
        this.setServices();
    }
    setServices() {
        // Make sure you provided a name for service otherwise it may not visible in some HomeKit apps.
        // if (this.context.status === 'new') {

        try {

            this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, "Luxor")
            .setCharacteristic(this.platform.Characteristic.Model, this.context.type)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID);
            
            this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
            this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
            this.service.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));
            
            this.service.getCharacteristic(this.platform.Characteristic.Brightness)
            .on('set', this.setBrightness.bind(this))
            .on('get', this.getBrightness.bind(this));
            
            this.context.status = 'current';
            this.getCurrentStateAsync().then(() => {
                this.setCharacteristics();
            }).catch((err) => {    
                this.log.error(`${this.accessory.displayName} setServices error: ${err}`)        
            });
        }
        catch (err){
            this.log.error(`setServices ${err}`)
        }


        this.accessory.on('identify', async () => {
            this.log.info(`Identifying ${this.accessory.displayName}.  Lights will flash thrice.`);
            await this.illuminateGroupAsync(100);
            await this.sleep(3000);
            await this.illuminateGroupAsync(0);
            await this.sleep(3000);
            await this.illuminateGroupAsync(100);
            await this.sleep(3000)
            await this.illuminateGroupAsync(0);
        });
        this.controller.registerCallback(this.accessory.UUID, this.context.type, this.context.groupNumber, this.platform.Characteristic.Brightness, this.callbackBrightness.bind(this));
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getOn(callback: CharacteristicGetCallback): void {
        this.log.debug("Getting power state for: ", this.accessory.displayName);

        this.getCurrentStateAsync().then(() => {
            callback(null, this.context.isOn);
        }).catch((err) => {   
            this.log.error(`${this.accessory.displayName} error: ${err}`)
            this.context.isOn = false;
            callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE, false);
        });
    }
    setOn(desiredState: boolean, callback: CharacteristicSetCallback): void {
        if (this.context.isOn === desiredState) {
            this.log.debug('Not changing power to %s because it is already %s', desiredState ? 'On' : 'Off', this.context.isOn ? 'On' : 'Off');
            callback(null);
        } else {
            this.illuminateGroupAsync(desiredState ? this.context.brightness || 100 : 0).then(() => {
                callback(null);
            }).catch((err) => {  
                this.log.error(`${this.accessory.displayName} setOn error: ${err}`)
                callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
            });
        }
    }
    getBrightness(callback: CharacteristicGetCallback): void {
        this.getCurrentStateAsync().then(() => {
            callback(null, this.context.brightness);
        }).catch((err) => {  
            this.log.error(`${this.accessory.displayName} getBrightness error: ${err}`)
            callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE, false);
        });
    }
    setBrightness(desiredBrightness: number, callback: CharacteristicSetCallback): void {
        if (this.context.brightness === desiredBrightness) {
            this.log.debug('Not changing brightness to %s because it is already %s', desiredBrightness, this.context.brightness);
            callback(null);
        } else {
            this.illuminateGroupAsync(desiredBrightness).then(() => {
                callback(null);
            }).catch((err) => {  
                this.log.error(`${this.accessory.displayName} setBrightness error: ${err}`)
                callback(HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE, false);
            });
        }
    }

    async illuminateGroupAsync(desiredIntensity: number): Promise<void> {
        return new Promise(async(resolve, reject)=>{
            try {
                this.log.info(`${this.accessory.displayName} turning ${desiredIntensity > 0 ? 'on' : 'off'} with brightness ${desiredIntensity}`);
                let result = await this.controller.IlluminateGroupAsync(this.context.groupNumber, desiredIntensity);
                if (result.StatusStr === 'Ok') {
                    this.context.brightness = desiredIntensity;
                    this.context.isOn = this.context.brightness > 0;
                    this.service.updateCharacteristic(this.platform.Characteristic.On, desiredIntensity > 0);
                    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, desiredIntensity);
                    resolve();
                }
                else {
                    this.log.error(`${this.accessory.displayName} returned ${result.StatusStr} trying to set intensity ${desiredIntensity}.`)
                    reject();
                }
            }
            catch (err) {
                this.log.error(`${this.accessory.displayName} illuminateGroupAsync error: ${err}`)
                reject(err);
            };
        })
        }
    setCharacteristics(): void {
        this.service.updateCharacteristic(this.platform.Characteristic.On, typeof this.context.isOn !== 'undefined' ? this.context.isOn : false);
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, typeof this.context.brightness !== 'undefined' ? this.context.brightness : 0);
    }
    // this method used for event handling
    async getCurrentStateAsync(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                let group = await this.controller.GetGroupAsync(this.context.groupNumber);
                this.context.brightness = group.Intensity;
                this.context.isOn = this.context.brightness > 0;
                resolve();
            }
            catch (err) {
                this.log.error(`${this.accessory.displayName} getCurrentStateAsync error: ${err}`)
                reject(err)
            };
        })
    }
    // this method used for callbacks
    callbackBrightness(intensity: number): void {

        if (intensity !== this.context.brightness) {
            this.context.brightness = intensity;
            this.context.isOn = intensity > 0;
            this.log.debug(`${this.accessory.displayName} updated isOn to ${intensity > 0} and brightness ${intensity}.`);
            this.service.updateCharacteristic(this.platform.Characteristic.On, intensity > 0);
            this.service.updateCharacteristic(this.platform.Characteristic.Brightness, intensity);
        }
    }
}

export enum ILightType {
    ZD = 'ZD', ZDC = 'ZDC', THEME = 'Theme'
}