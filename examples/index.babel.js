import GiiKER from '../index.babel.js';

const button = document.querySelector('button');
const textarea = document.querySelector('textarea');

button.addEventListener('click', async () => {
	button.classList.add('is-loading');
	button.disabled = true;

	const giiker = await GiiKER.connect();
	button.classList.remove('is-loading');
	button.textContent = 'Connected!';

	giiker.on('move', (move) => {
		textarea.value += ` ${move.notation}`;
	});
});