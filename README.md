# giiker

JavaScript wrapper for GiiKER smart cube Bluetooth API

## Usage

```js
import GiiKER from 'giiker';

// Note: To use Web Bluetooth API trigger action such as button click is required
const button = document.querySelector('button#connect');
button.addEventListener('click', async () => {
	const giiker = await GiiKER.connect();
	giiker.on('move', (move) => {
		console.log(mave.face); //=> "F"
		console.log(mave.amount); //=> -1
		console.log(mave.notation); //=> "F'"
	});
})
```
