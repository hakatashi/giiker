import GiiKER from '../index.babel.js';

const button = document.querySelector('button');
button.addEventListener('click', async () => {
	const giiker = await GiiKER.connect();
	console.log(giiker);
});