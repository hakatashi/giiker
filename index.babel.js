import EventEmitter from 'events';
import assert from 'assert';

const SERVICE_UUID = '0000aadb-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000aadc-0000-1000-8000-00805f9b34fb';

const faces = ['B', 'D', 'L', 'U', 'R', 'F'];
const turns = {
	0: 1,
	1: 2,
	2: -1,
	8: -2,
};

class Giiker extends EventEmitter {
	constructor() {
		super();
		this.onCharacteristicValueChanged = this.onCharacteristicValueChanged.bind(this);
	}

	async connect() {
		if (!global.navigator) {
			throw new Error('window.navigator is not accesible. Maybe you\'re running Node.js?');
		}

		if (!global.navigator.bluetooth) {
			throw new Error('Web Bluetooth API is not accesible');
		}

		const device = await global.navigator.bluetooth.requestDevice({
			filters: [{
				namePrefix: 'GiC',
			}],
			optionalServices: [SERVICE_UUID],
		});

		const server = await device.gatt.connect();
		const service = await server.getPrimaryService(SERVICE_UUID);
		const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
		await characteristic.startNotifications();
		const initialValue = await characteristic.readValue();
		characteristic.addEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);
	}

	onCharacteristicValueChanged(event) {
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
		} else {
			assert(amount === -2);
			notation = `${face}2'`;
		}

		this.emit('move', {face, amount, notation});
	}
}

const connect = async () => {
	const giiker = new Giiker();
	await giiker.connect();
	return giiker;
};

export default {connect};