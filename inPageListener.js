// In-page injected message listener. Runs in page context so should be
// side-effect free and not pollute global namespace.
window.addEventListener('message', ({data: {action, data}}) => {
  if (action === 'seekPlayer') {
    const {offset} = data;
    const player = window.embeddedMedia.players[0];
    player.currentTime(offset);
    player.play();
  }
});
