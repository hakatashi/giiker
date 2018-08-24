const SERVICE_UUID = '0000aadb-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000aadc-0000-1000-8000-00805f9b34fb';

// face Indices;
const B = 0;
const D = 1;
const L = 2;
const U = 3;
const R = 4;
const F = 5;

const faces = ['B', 'D', 'L', 'U', 'R', 'F'];

const turns = {
  0: 1,
  1: 2,
  2: -1,
  8: -2,
};

// color indices
const b = 0;
const y = 1;
const o = 2;
const w = 3;
const r = 4;
const g = 5;

const colors = ['blue', 'yellow', 'orange', 'white', 'red', 'green'];

const cornerColors = [
  [y, r, g],
  [r, w, g],
  [w, o, g],
  [o, y, g],
  [r, y, b],
  [w, r, b],
  [o, w, b],
  [y, o, b]
];

const cornerLocations = [
  [D, R, F],
  [R, U, F],
  [U, L, F],
  [L, D, F],
  [R, D, B],
  [U, R, B],
  [L, U, B],
  [D, L, B]
];

const edgeLocations = [
  [F, D],
  [F, R],
  [F, U],
  [F, L],
  [D, R],
  [U, R],
  [U, L],
  [D, L],
  [B, D],
  [B, R],
  [B, U],
  [B, L]
];

const edgeColors = [
  [g, y],
  [g, r],
  [g, w],
  [g, o],
  [y, r],
  [w, r],
  [w, o],
  [y, o],
  [b, y],
  [b, r],
  [b, w],
  [b, o]
];

class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(label, callback) {
    if (!this.listeners[label]) {
      this.listeners[label] = [];
    }
    this.listeners[label].push(callback);
  }

  off(label, callback) {
    let listeners = this.listeners[label];

    if (listeners && listeners.length > 0) {
      let index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        this.listeners[label] = listeners;
        return true;
      }
    }
    return false;
  }

  emit(label, ...args) {
    let listeners = this.listeners[label];

    if (listeners && listeners.length > 0) {
      listeners.forEach((listener) => {
        listener(...args);
      });
      return true;
    }
    return false;
  }
}

class Giiker extends EventEmitter {
  constructor() {
    super();
    this._onCharacteristicValueChanged = this._onCharacteristicValueChanged.bind(this);
    this._onBatteryLevelChanged = this._onBatteryLevelChanged.bind(this);
    this._onDisconnected = this._onDisconnected.bind(this);
  }

  async connect() {
    if (!window.navigator) {
      throw new Error('window.navigator is not accesible. Maybe you\'re running Node.js?');
    }

    if (!window.navigator.bluetooth) {
      throw new Error('Web Bluetooth API is not accesible');
    }

    const device = await window.navigator.bluetooth.requestDevice({
      filters: [{
        namePrefix: 'GiC',
      }],
      optionalServices: [SERVICE_UUID, 'battery_service'],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
    await characteristic.startNotifications();
    const value = await characteristic.readValue();
    this._state = this._parseCubeValue(value).state;
    characteristic.addEventListener('characteristicvaluechanged', this._onCharacteristicValueChanged);

    const batteryService = await server.getPrimaryService('battery_service');
    const batteryCharacteristic = await batteryService.getCharacteristic('battery_level');
    await batteryCharacteristic.startNotifications();
    const batteryLevel = await batteryCharacteristic.readValue();
    this._batteryLevel = batteryLevel.getUint8(0);
    batteryCharacteristic.addEventListener('characteristicvaluechanged', this._onBatteryLevelChanged);

    device.addEventListener('gattserverdisconnected', this._onDisconnected);

    this._device = device;
  }

  disconnect() {
    if (!this._device) {
      return;
    }
    this._device.gatt.disconnect();
  }

  get batteryLevel () {
    return this._batteryLevel;
  }

  get state() {
    const state = {
      corners: [],
      edges: []
    };
    this._state.cornerPositions.forEach((cp, index) => {
      const mappedColors = this._mapColors(
        cornerColors[cp - 1],
        this._state.cornerOrientations[index],
        index
      );
      state.corners.push({
        position: cornerLocations[index].map((f) => faces[f]),
        colors: mappedColors.map((c) => colors[c])
      });
    });
    this._state.edgePositions.forEach((ep, index) => {
      const mappedColors = this._mapEdgeColors(
        edgeColors[ep - 1],
        this._state.edgeOrientations[index]
      );
      state.edges.push({
        position: edgeLocations[index].map((f) => faces[f]),
        colors: mappedColors.map((c) => colors[c])
      });
    });
    return state;
  }

  _onCharacteristicValueChanged(event) {
    const value = event.target.value;
    const {state, moves} = this._parseCubeValue(value);
    this._state = state;
    this.emit('move', moves[0]);
  }

  _onBatteryLevelChanged(event) {
    this._batteryLevel = event.target.value.getUint8(0);
    this.emit('battery-changed', {level: this._batteryLevel});
  }

  _onDisconnected() {
    this._device = null;
    this.emit('disconnected');
  }

  _parseCubeValue (value) {
    const state = {
      cornerPositions: [],
      cornerOrientations: [],
      edgePositions: [],
      edgeOrientations: []
    };
    const moves = [];
    for (let i = 0; i < value.byteLength; i++) {
      const move = value.getUint8(i);
      const highNibble = move >> 4;
      const lowNibble = move & 0b1111;
      if (i < 4) {
        // cornerPositions[p] == c (corner c is at position p)
        state.cornerPositions.push(highNibble, lowNibble);
      } else if (i < 8) {
        state.cornerOrientations.push(highNibble, lowNibble);
      } else if (i < 14) {
        state.edgePositions.push(highNibble, lowNibble);
      } else if (i < 16) {
        state.edgeOrientations.push(!!(move & 0b10000000));
        state.edgeOrientations.push(!!(move & 0b01000000));
        state.edgeOrientations.push(!!(move & 0b00100000));
        state.edgeOrientations.push(!!(move & 0b00010000));
        if (i === 14) {
          state.edgeOrientations.push(!!(move & 0b00001000));
          state.edgeOrientations.push(!!(move & 0b00000100));
          state.edgeOrientations.push(!!(move & 0b00000010));
          state.edgeOrientations.push(!!(move & 0b00000001));
        }
      } else {
        moves.push(this._parseMove(highNibble, lowNibble));
      }
    }

    return {state, moves};
  }

  _parseMove (faceIndex, turnIndex) {
    const face = faces[faceIndex - 1];
    const amount = turns[turnIndex - 1];
    let notation = face;

    switch (amount) {
      case 2: notation = `${face}2`; break;
      case -1: notation = `${face}'`; break;
      case -2: notation = `${face}2'`; break;
    }

    return {face, amount, notation};
  }

  _mapColors(colors, orientation, position) {
    const actualColors = [];

    if (orientation !== 3) {
      if (position === 0 || position === 2 || position === 5 || position === 7) {
        orientation = 3 - orientation;
      }
    }

    switch (orientation) {
      case 1:
        actualColors[0] = colors[1];
        actualColors[1] = colors[2];
        actualColors[2] = colors[0];
        break;
      case 2:
        actualColors[0] = colors[2];
        actualColors[1] = colors[0];
        actualColors[2] = colors[1];
        break;
      case 3:
        actualColors[0] = colors[0];
        actualColors[1] = colors[1];
        actualColors[2] = colors[2];
        break;
    }

    return actualColors;
  }

  _mapEdgeColors (colors, orientation) {
    const actualColors = [...colors];
    if (orientation) {
      actualColors.reverse();
    }
    return actualColors;
  }
}

const connect = async () => {
  const giiker = new Giiker();
  await giiker.connect();
  return giiker;
};

export default {connect};
