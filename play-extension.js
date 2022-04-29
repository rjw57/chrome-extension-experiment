// Inject the in-page listener via a script tag.
const scriptEl = document.createElement('script');
scriptEl.src = chrome.runtime.getURL('inPageListener.js');
(document.head||document.documentElement).appendChild(scriptEl);
scriptEl.onload = () => scriptEl.remove();

// decorateTracks scans the page for a Tracklist and decorates each track with a
// cliek event handler.
const decorateTracks = () => {
  // Create all of the "jump here" buttons added by the extension.
  Array.from(
      document.querySelectorAll('button[data-bbc-container="aod_tracks"]'),
  ).forEach((buttonEl) => {
    // Do we have an existing element?
    const existingEl = document.querySelector(
        `button[data-snds-ex-sibling-button-id="${buttonEl.id}"]`,
    );

    // Existing button; do nothing. Othwerwise we need to create one.
    if (existingEl) {
      return;
    }

    // Create a similarly styled buton
    const jumpButtonEl = document.createElement('button');
    jumpButtonEl.setAttribute('data-snds-ex-sibling-button-id', buttonEl.id);
    jumpButtonEl.className = buttonEl.className;

    // Clone SVG element from ellipsis button and replace with play icon.
    const svgEl = buttonEl.querySelector('svg').cloneNode(true);
    svgEl.setAttribute('viewBox', '0 0 24 24');
    svgEl.innerHTML = '<path d="M8 5.14v14l11-7l-11-7Z"/>';

    // Add play icon to jump button.
    jumpButtonEl.appendChild(svgEl);

    // Wire in click event
    jumpButtonEl.addEventListener('click', () => jumpTo(buttonEl.id));

    // Add our jump button next to the original.
    buttonEl.parentElement.prepend(jumpButtonEl);
  });
};

// Jump to a track given the id of the ellipsis button element.
const jumpTo = async (buttonElId) => {
  // Find button.
  const buttonEl = document.getElementById(buttonElId);
  if (!buttonEl) {
    throw new Error(`Passed invalid id: ${buttonElId}`);
  }

  // Get button metadata and pid.
  const metadata = JSON.parse(buttonEl.getAttribute('data-bbc-metadata'));
  const pid = buttonEl.getAttribute('data-bbc-result');
  if (!pid || !metadata) {
    throw new Error('Failed to get metadata and pid');
  }

  // Get version data.
  const {version} = await getEpisodeData(pid);

  // Find segment.
  const {POS: posId} = metadata;
  const segmentIndex = parseInt(posId.split('::').slice(-1)[0]) - 1;
  const {segment_events: segmentEvents} = version;
  const segmentEvent = segmentEvents[segmentIndex];

  // Get offset within programme of version.
  const {version_offset: offset} = segmentEvent;

  // Seek player.
  postMessage({action: 'seekPlayer', data: {offset}});
};

// Get episode canonical version data from pid.
const getEpisodeData = (pid) => sendMessage({
  action: 'getEpisodeData', data: {pid},
});

// Promise based wrapper around sendMessage.
const sendMessage = (request) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(request, ({error, response}) => {
    if (error) {
      reject(new Error(error));
    } else {
      resolve(response);
    }
  });
});

const observer = new MutationObserver(() => decorateTracks());
observer.observe(
    document.querySelector('div.radio-main'),
    {childList: true},
);
decorateTracks();
