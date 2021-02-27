import { ZD_Controller } from './ZD_Controller';
import { ZDC_Controller } from './ZDC_Controller';
import { ZDTWO_Controller } from './ZDTWO_Controller';
import { BaseController, IControllerType } from './BaseController';

export class ControllerFactory {
  public static createController(controller, log) {
    switch (controller.type) {
      case IControllerType.ZD:
        return new ZD_Controller(controller, log);
      case IControllerType.ZDC:
        return new ZDC_Controller(controller, log);
      case IControllerType.ZDTWO:
        return new ZDTWO_Controller(controller, log);
      default:
        return new BaseController(controller, log);
    }
  }
}