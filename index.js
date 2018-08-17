const SERVICE_UUID = '0000aadb-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000aadc-0000-1000-8000-00805f9b34fb';

const faces = ['B', 'D', 'L', 'U', 'R', 'F'];
const turns = {
	0: 1,
	1: 2,
	2: -1,
	8: -2,
};

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
          let index = listeners.indexOf(callback)
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
			optionalServices: [SERVICE_UUID],
		});

		const server = await device.gatt.connect();
		const service = await server.getPrimaryService(SERVICE_UUID);
		const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
		await characteristic.startNotifications();
		await characteristic.readValue();
		characteristic.addEventListener('characteristicvaluechanged', this._onCharacteristicValueChanged);
		device.addEventListener('gattserverdisconnected', this._onDisconnected);

		this._device = device;
	}

	disconnect() {
		if (!this._device) {
			return;
		}
		this._device.gatt.disconnect();
	}

	_onCharacteristicValueChanged(event) {
		const move = event.target.value.getUint8(16);

		const faceIndex = move >> 4;
		const turnIndex = move & 0b1111;

		const face = faces[faceIndex - 1];
		const amount = turns[turnIndex - 1];

		let notation = '';
		if (amount === 1) {
			notation = face;
		} else if (amount === 2) {
			notation = `${face}2`;
		} else if (amount === -1) {
			notation = `${face}'`;
		} else if (amount === -2) {
			notation = `${face}2'`;
		}

		this.emit('move', {face, amount, notation});
	}

	_onDisconnected() {
		this._device = null;
		this.emit('disconnected');
	}
}

const connect = async () => {
	const giiker = new Giiker();
	await giiker.connect();
	return giiker;
};

export default {connect};
