// Inject the in-page listener via a script tag.
const scriptEl = document.createElement('script');
scriptEl.src = chrome.runtime.getURL('inPageListener.js');
(document.head||document.documentElement).appendChild(scriptEl);
scriptEl.onload = () => scriptEl.remove();

// decorateTracks scans the page for a Tracklist and decorates each track with a
// cliek event handler.
const decorateTracks = () => {
  const trackListSectionEl = document.querySelector(
      'section[aria-labelledby="sc-id-tracklist"]');
  if (!trackListSectionEl) {
    return;
  }

  const trackListEl = trackListSectionEl.querySelector('ul');
  if (!trackListEl) {
    throw new Error('Could not locate track list');
  }

  // Create all of the "jump here" buttons added by the extension.
  Array.from(
      trackListEl.querySelectorAll('div.sc-c-basic-tile'),
  ).forEach((trackContainerEl) => {
    // Locate or create the button container element.
    let buttonContainerEl = trackContainerEl.querySelector(
        'div.sc-c-basic-tile__button');
    if (!buttonContainerEl) {
      buttonContainerEl = document.createElement('div');
      buttonContainerEl.classList.add(
          'sc-c-basic-tile__button', 'gs-u-mt-', 'gs-u-pt--@m',
      );
      trackContainerEl.appendChild(buttonContainerEl);
    }

    // Do we have an existing element?
    const existingEl = buttonContainerEl.querySelector(
        `button[data-snds-ex-track-index]`,
    );

    // Existing button; do nothing. Othwerwise we need to create one.
    if (existingEl) {
      return;
    }

    // Extract the track index (1-based), title and artist.
    const trackTitle =
      trackContainerEl.querySelector('.sc-c-basic-tile__title').innerText;
    const trackArtist =
      trackContainerEl.querySelector('.sc-c-basic-tile__artist').innerText;
    const trackIndex = parseInt(
        trackContainerEl.querySelector('.sc-c-basic-tile__track-number')
            .innerText,
    );

    // Determine the pid for the current page.
    const canonicalLinkEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalLinkEl) {
      throw new Error('Cannot determine canonical page location');
    }
    const canonicalUrl = canonicalLinkEl.getAttribute('href');
    if (!canonicalUrl) {
      throw new Error('Canonical link element does not have href atribute');
    }
    const canonicalUrlMatches = canonicalUrl.match(
        /^https:\/\/www.bbc.co.uk\/sounds\/play\/(?<pid>[a-z0-9]+)$/);
    if (!canonicalUrlMatches?.groups?.pid) {
      throw new Error('Cannot determine canonical pid');
    }
    const pid = canonicalUrlMatches.groups.pid;

    // Create a similarly styled buton
    const jumpButtonEl = document.createElement('button');
    jumpButtonEl.classList.add(
        'sc-c-icon-button', 'sc-o-button', 'sc-o-button--center', 'gs-u-p',
    );

    // Create SVG element for button.
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width', '16px');
    svgEl.setAttribute('height', '16px');
    svgEl.setAttribute('viewBox', '0 0 24 24');
    svgEl.setAttribute('aria-hidden', 'true');
    svgEl.setAttribute('focusable', 'false');
    svgEl.classList.add(
        'sc-c-icon', 'sc-c-icon--default',
    );
    svgEl.innerHTML = '<path d="M8 5.14v14l11-7l-11-7Z"/>';

    // Add play icon to jump button.
    jumpButtonEl.appendChild(svgEl);

    // Contain screen-reader element.
    const srEl = document.createElement('div');
    srEl.classList.add('sc-u-screenreader-only');
    // TODO: title
    srEl.appendChild(document.createTextNode(
        `Jump to ${trackTitle} by ${trackArtist}`));

    // Add screen reader caption to jump button.
    jumpButtonEl.appendChild(srEl);

    // Wire in click event
    jumpButtonEl.addEventListener('click', () => jumpTo(pid, trackIndex));

    // Add our jump button to the button container.
    buttonContainerEl.appendChild(jumpButtonEl);

    // Tag element with track index.
    jumpButtonEl.setAttribute('data-snds-ex-track-index', `${trackIndex}`);
  });
};

// Jump to a track given the id of the ellipsis button element.
const jumpTo = async (pid, trackIndex) => {
  // Get version data.
  const {version} = await getEpisodeData(pid);

  // Find segment.
  const {segment_events: segmentEvents} = version;
  const segmentEvent =
    segmentEvents.filter(
        ({segment: {type}}) => (type === 'music'),
    )[trackIndex - 1];

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
    {childList: true, subtree: true},
);
decorateTracks();
