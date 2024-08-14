import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { Characteristic, CharacteristicGetCallback, Service } from "hap-nodejs";
import { Logger } from "../logger";
import { PlatformAccessory } from "../platformAccessory";
const log = Logger.internal;

export function injectChangeDetection() {
  setDeprecatedHapClasses();
  setDeprecatedHapEnums();
  setDeprecatedHapFunctions();
  setDeprecatedHomebridgeFunctions();

  log.info("Detection of breaking changes is enabled.");
}

function setDeprecatedHapClasses() {
  let originalBatteryService = Service.BatteryService;

  // Create a proxy to monitor the BatteryService class
  Service.BatteryService = new Proxy(Service.BatteryService, {
    construct(target, args) {
      logDeprecationWarning("Service.BatteryService", "Service.Battery");
      return new target(...args); // Proceed with the instantiation
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(target: any, prop: any, receiver) {
      if (typeof target[prop] === "function") {
        return (...args: unknown[]) => {
          logDeprecationWarning("Service.BatteryService", "Service.Battery");
          return target[prop].apply(this, args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  // Define a getter and setter for the static property
  Object.defineProperty(Service, "BatteryService", {
    get() {
      logDeprecationWarning("Service.BatteryService", "Service.Battery");
      return originalBatteryService;
    },
    set(newValue) {
      logDeprecationWarning("Service.BatteryService", "Service.Battery");
      originalBatteryService = newValue;
    },
  });
}

function setDeprecatedHapEnums() {
  const FormatsProxy = new Proxy(Characteristic.Formats, {
    get(target, prop) {
      logDeprecationWarning("Characteristics.Formats", "api.hap.Formats");
      return Reflect.get(target, prop);
    },
  });

  const PermsProxy = new Proxy(Characteristic.Perms, {
    get(target, prop) {
      logDeprecationWarning("Characteristics.Perms", "api.hap.Perms");
      return Reflect.get(target, prop);
    },
  });

  const UnitsProxy = new Proxy(Characteristic.Units, {
    get(target, prop) {
      logDeprecationWarning("Characteristics.Units", "api.hap.Units");
      return Reflect.get(target, prop);
    },
  });

  // Replace the original enum with the proxy
  Characteristic.Formats = FormatsProxy;
  Characteristic.Perms = PermsProxy;
  Characteristic.Units = UnitsProxy;
}

function setDeprecatedHapFunctions() {
  const characteristicGetValue = Characteristic.prototype.getValue;

  Characteristic.prototype.getValue = function (
    this: Characteristic,
    callback: CharacteristicGetCallback
  ) {
    logDeprecationWarning("Characteristic.getValue()", "Characteristic.value");
    return characteristicGetValue.call(this, callback);
  };
}

function setDeprecatedHomebridgeFunctions() {
  const platformAccessoryGetServiceByUUIDAndSubType =
    PlatformAccessory.prototype.getServiceByUUIDAndSubType;

  PlatformAccessory.prototype.getServiceByUUIDAndSubType = function (
    this: unknown,
    uuid: string,
    subType: string
  ) {
    logDeprecationWarning(
      "platformAccessory.getServiceByUUIDAndSubType",
      "platformAccessory.getService"
    );
    return platformAccessoryGetServiceByUUIDAndSubType.call(
      this,
      uuid,
      subType
    );
  };
}

function logDeprecationWarning(deprecated: string, alternative?: string) {
  const error = new Error();
  const stackLines = error.stack?.split("\n");
  const callerLine = stackLines ? stackLines[3] : "";

  const filePathMatch = callerLine.match(/\((.*):\d+:\d+\)/);
  const filePath = filePathMatch ? filePathMatch[1] : null;

  if (filePath) {
    const packageName = getPackageName(filePath);

    const msg =
      `Warning: The usage of '${deprecated}' is deprecated and will be removed with Homebridge 2.0.0.` +
      (alternative
        ? ` Please upgrade the plugin to use '${alternative}' instead.`
        : "");

    log.warn(msg);
    log.warn(`Affected plugin: ${packageName}`);
    log.warn(`Accessed from: ${callerLine}`);
  }
}

function getPackageName(filePath: string): string | null {
  let currentDir = dirname(filePath);

  while (currentDir !== parse(currentDir).root) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      return packageJson.name || null;
    }
    currentDir = dirname(currentDir);
  }
  return null;
}
