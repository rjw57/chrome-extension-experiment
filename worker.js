// Cache of PID -> canonical episode data.
const EPISODE_CACHE = new Map();

const getEpisodeData = async (pid) => {
  // Return cached value if present.
  if (EPISODE_CACHE.has(pid)) {
    return EPISODE_CACHE.get(pid);
  }

  // Otherwise fetch programme info.
  const encodedPid = encodeURIComponent(pid);
  const {programme: {versions}} = await (await fetch(
      `https://www.bbc.co.uk/programmes/${encodedPid}.json`)).json();
  const {pid: canonicalVersionPid} = versions.filter(
      ({canonical}) => canonical === 1)[0];
  if (!canonicalVersionPid) {
    throw new Error('No canonical version found');
  }

  const encodedVersionPid = encodeURIComponent(canonicalVersionPid);
  const episodeData = await (await fetch(
      `https://www.bbc.co.uk/programmes/${encodedVersionPid}.json`)).json();

  EPISODE_CACHE.set(pid, episodeData);
  return episodeData;
};

chrome.runtime.onMessage.addListener(
    (request, _, sendResponse) => {
      const {action, data} = request;
      if (action === 'getEpisodeData') {
        const {pid} = data;
        if (!pid) {
          sendResponse({error: 'No pid specified'});
          return;
        }
        getEpisodeData(pid)
            .then((response) => sendResponse({response}))
            .catch((error) => sendResponse({
              error: `getEpisodeData: ${error}`},
            ));
        return true;
      } else {
        sendResponse({error: `Bad action: ${action}`});
      }
    },
);
