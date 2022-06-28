import { rejects } from "assert";
import { Characteristic, Logger } from "homebridge";
import { ILightType } from "../lights/ZD_Light";
import { LuxorPlatform } from "../LuxorPlatform";
import Queue from "../Queue";

const axios = require('axios').default;

export class BaseController {
  protected ip: string;
  public name: string;
  protected hideGroups: boolean;
  protected independentColors: boolean;
  protected log: Logger;
  public type: IControllerType;
  protected platform: LuxorPlatform;
  protected GroupList: IGroupList[];
  protected cacheGroupList: number;
  protected ColorList: IColorList[];
  protected cacheColorList: number;
  protected ThemeList: IThemeList[];
  protected cacheThemeList: number;
  protected commandTimeout: number;
  protected callbackList: { UUID: string, type: ILightType, index: number, characteristic: any, fn: (a: number | boolean) => {} }[];
  constructor(data: any, log: any) {
    this.log = log;
    this.callbackList = [];
    this.GroupList = []
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

  protected getStatus(result): string {
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

  async doRequest(url: string, data?: any): Promise<IThemeListResp | IGroupListResp | IColorListResp | IStatus> {
    return new Promise(async (resolve, reject): Promise<IThemeListResp | IGroupListResp | IColorListResp | IStatus> => {
      try {
        switch (url) {
          case 'GroupListGet':
            if (this.hideGroups) return;
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
        })
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
    })
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async IlluminateAllAsync(): Promise<IStatus> {
    return Queue.enqueue(async () => {
      let status = await this.doRequest('IlluminateAll');
      return status;
    })
  }

  async ExtinguishAllAsync(): Promise<IStatus> {
    return Queue.enqueue(async () => {
      let status = await this.doRequest('ExtinguishAll');
      return status;
    })
  }
  public async GetGroupAsync(group: number): Promise<IGroupList> {
    if (this.hideGroups) return;
    return new Promise(async (resolve, reject) => {
      try {
        await this.GroupListGetAsync();
        for (let i in this.GroupList) {
          if (this.GroupList[i].GroupNumber === group) return resolve(this.GroupList[i]);
        }
        reject(`No Group Found in GroupGetAsync for group ${group}.\n${JSON.stringify(this.GroupList)}`)
      }
      catch (err) {
        reject(`Error with GetGroupAsync: ${err}`)
        this.log.error(err);
      }
    })
  }
  async GroupListGetAsync(): Promise<IGroupList[]> {
    // Get the list of light groups from the controller
    if (typeof this.cacheGroupList !== 'undefined' && Date.now() - this.cacheGroupList < 2000) {
      return (this.GroupList);
    }

    return Queue.enqueue(async () => {
      let data = await this.doRequest('GroupListGet');
      if (data.Status === 0) {
        this.cacheGroupList = Date.now();
        this.processGroupListGet(data as IGroupListResp);
      }
      return this.GroupList;
    })
  }
  protected processGroupListGet(data: IGroupListResp): void {
    // override with ZDC/ZDTWO
    this.GroupList = data.GroupList;
    for (let i in this.GroupList) {
      this.GroupList[i].type = ILightType.ZD;
    }
  }
  async GroupListEditAsync(name: string, groupNumber: number, color?: number): Promise<any> {
    // Same in ZDC/ZDTWO
    var requestData = JSON.stringify({
      'Name': name,
      'GroupNumber': groupNumber,
      'Color': color
    });
    return Queue.enqueue(async () => {
      let status = await this.doRequest('GroupListEdit', requestData);
      return status;
    })
    /*     let status = await this.queueRequest('GroupListEdit', requestData);
        return status; */
  }
  async ThemeListGetAsync(): Promise<IThemeList[]> {
    if (typeof this.cacheThemeList !== 'undefined' && Date.now() - this.cacheThemeList < 2000) {
      return (this.ThemeList);
    }
    return Queue.enqueue(async () => {
      let data = await this.doRequest('ThemeListGet');
      if (data.Status === 0) {
        this.cacheThemeList = Date.now();
        this.processThemeListGet(data as IThemeListResp);
      }
      return this.ThemeList;
    })
  }
  protected processThemeListGet(data: IThemeListResp): void {
    this.ThemeList = data.ThemeList;
    for (var i in this.ThemeList) {
      this.ThemeList[i].isOn = this.ThemeList[i].OnOff === 1;
      this.ThemeList[i].type = ILightType.THEME;
    }
  }
  public async GetThemeAsync(index: number): Promise<IThemeList> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.ThemeListGetAsync();
        for (let i in this.ThemeList) {
          if (this.ThemeList[i].ThemeIndex === index) return resolve(this.ThemeList[i]);
        }
        reject(`No Theme Found in ThemeGetAsync for theme ${index}.\n${JSON.stringify(this.ThemeList)}`)
      }
      catch (err) {
        this.log.error(err);
        reject(`Error with GetThemeAsync ${err}`)
      }
    })

  }
  async IlluminateThemeAsync(themeIndex: number, onOff: number): Promise<IStatus> {
    return Queue.enqueue(async () => {
      let status = await this.doRequest('IlluminateTheme', {
        'ThemeIndex': themeIndex,
        'OnOff': onOff
      });
      this.cacheThemeList = undefined;
      setTimeout(async () => { await this.updateLights() }, 250);
      return status;
    })
  }
  async IlluminateGroupAsync(groupNumber: number, desiredIntensity: number): Promise<IStatus> {
    return Queue.enqueue(async () => {
      let status = await this.doRequest('IlluminateGroup', {
        'GroupNumber': groupNumber,
        'Intensity': desiredIntensity
      });
      return status;
    })
  }
  async ColorListGetAsync(): Promise<IColorList[]> {
    return {} as IColorList[];
  }
  async ColorListSetAsync(color: number, hue: number, saturation: number): Promise<IStatus> {
    return {} as IStatus;
  }
  processColorListGet(data: IColorListResp) {
    this.ColorList = data.ColorList;
  };
  async GetColorAsync(color: number): Promise<IColorList> { return {} as IColorList; }

  registerCallback(UUID: string, type: ILightType, index: number, characteristic: any, fn: () => {}) {
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
          case ILightType.ZD:
          case ILightType.ZDC:
            if (callback.characteristic.name === this.platform.Characteristic.Brightness.name) {
              for (let i in this.GroupList){ // need to use loop as these are not 0 based indexes
                if (this.GroupList[i].GroupNumber === callback.index){
                  if (typeof this.GroupList[i].Intensity !== 'undefined') callback.fn(this.GroupList[i].Intensity);
                  break;
                }
              }
              // let group = this.GroupList.find(g=>g.GroupNumber === callback.index, this.GroupList);
              
            }
            break;
          case ILightType.THEME:
            if (callback.characteristic.name === this.platform.Characteristic.On.name) {
              for (let i in this.GroupList){ // need to use loop as these are not 0 based indexes
                if (this.ThemeList[i].ThemeIndex === callback.index){
                  if (typeof this.ThemeList[i].OnOff !== 'undefined') callback.fn(this.ThemeList[i].OnOff === 1);
                  break;
                }
              }
            }
            break;
        }
      }
      catch (err) {
        this.log.error(`execCallbacks: ${err}`)
      }
    }
  }
  async updateLights(force: boolean = false) {
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
    catch (err) { this.log.error(`${this.name} error: ${err}`) }
    finally { setTimeout(async () => { await this.pollController() }, 30 * 1000); }
  }

}

export interface IGroupListResp {
  Status: number;
  StatusStr: string;
  GroupList: IGroupList[];
}
export interface IGroupList {
  Name: string;
  Grp?: number;
  GroupNumber?: number;
  Colr?: number;
  Color?: number;
  Inten?: number;
  Intensity?: number;
  type: ILightType;
  UUID?: string;
}
export interface IStatus {
  Status: number;
  StatusStr: string;
}
export interface IThemeListResp {
  Status: number;
  StatusStr: string;
  Restricted: 0 | 1;
  ThemeList: IThemeList[];
}
export interface IThemeList {
  Name: string;
  ThemeIndex: number;
  OnOff: 0 | 1;
  isOn: boolean;
  type?: ILightType;
  UUID?: string;
}
export interface IColorListResp {
  Status: number;
  StatusStr: string;
  ListSize: number;
  ColorList: IColorList[];
}
export interface IColorList {
  C: number;
  Hue: number;
  Sat: number;
}
export enum IControllerType {
  ZD = 'ZD', ZDC = 'ZDC', ZDTWO = 'ZDTWO'
}