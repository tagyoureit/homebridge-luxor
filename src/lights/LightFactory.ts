import { ILightType, ZD_Light } from './ZD_Light';
import { ZDC_Light } from './ZDC_Light';
import { Theme } from './Theme';
import { LuxorPlatform } from '../LuxorPlatform';
import { PlatformAccessory } from 'homebridge';
export class LightFactory {
  public static createLight(platform: LuxorPlatform, accessory: PlatformAccessory) {
    switch (accessory.context.type) {
      case ILightType.ZD:
        return new ZD_Light(platform, accessory);
      case ILightType.ZDC:
        return new ZDC_Light(platform, accessory);
      case ILightType.THEME:
        return new Theme(platform, accessory);
      default:
        platform.log.error(`Light type ${accessory.context.type} could not be found.`)
    }
  }
}