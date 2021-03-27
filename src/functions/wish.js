import dayjs from 'dayjs';

import { getAccountPrefix } from '../stores/account';
import { getTimeOffset } from '../stores/server';
import { readSave } from '../stores/saveManager';
import { banners } from '../data/banners';
import { weaponList } from '../data/weaponList';
import { characters } from '../data/characters';

const bannerTypes = {
  'character-event': 'characters',
  'weapon-event': 'weapons',
  standard: 'standard',
  beginners: 'beginners',
};

function readLocalData(path) {
  const prefix = getAccountPrefix();
  const data = readSave(`${prefix}${path}`);
  if (data !== null) {
    const counterData = JSON.parse(data);
    const total = counterData.total;
    const legendary = counterData.legendary;
    const rare = counterData.rare;
    const pullData = counterData.pulls || [];

    return {
      total,
      legendary,
      rare,
      pullData,
    };
  }

  return null;
}

function getNextBanner(time, currentBannerIndex, selectedBanners) {
  for (let i = currentBannerIndex + 1; i < selectedBanners.length; i++) {
    if (time >= selectedBanners[i].start && time < selectedBanners[i].end) {
      return { currentBannerIndex: i, selectedBanner: selectedBanners[i] };
    }
  }
}

function formatTime(time) {
  return dayjs.unix(time).format('ddd YYYY-MM-DD HH:mm:ss');
}

export function process(id) {
  const path = `wish-counter-${id}`;

  const bannerType = bannerTypes[id];

  const selectedBanners = banners[bannerType].map((e) => {
    // banner data based on Asia time
    const diff = 8 - getTimeOffset();

    const start = dayjs(e.start, 'YYYY-MM-DD HH:mm:ss').subtract(diff, 'hour');
    const end = dayjs(e.end, 'YYYY-MM-DD HH:mm:ss').subtract(diff, 'hour');
    const image = `/images/banners/${e.name} ${e.image}.png`;

    return {
      ...e,
      start: start.unix(),
      end: end.unix(),
      image,
      total: 0,
      legendary: [],
      rarePity: [0,0,0,0,0,0,0,0,0,0],
      rare: {
        character: [],
        weapon: [],
      },
    };
  });

  const { pullData } = readLocalData(path);

  const currentPulls = [];
  const allLegendary = [];
  const allRare = [];
  let currentBanner = null;
  let grouped = false;
  let striped = false;
  let startBanner = false;
  let currentBannerIndex = -1;

  for (let i = 0; i < pullData.length; i++) {
    const pull = pullData[i];
    const next = pullData[i + 1] || { time: dayjs().year(2000).unix() };

    if (currentBanner === null || currentBanner.end < pull.time) {
      const nextBanner = getNextBanner(pull.time, currentBannerIndex, selectedBanners);
      currentBanner = nextBanner.selectedBanner;
      currentBannerIndex = nextBanner.currentBannerIndex;
      startBanner = true;

      if (i > 0) {
        currentPulls[i - 1].end = true;
      }
    }

    const item =
      pull.type === 'character'
        ? characters[pull.id]
        : pull.type === 'weapon'
        ? weaponList[pull.id]
        : { name: 'Unknown', rarity: 3 };

    selectedBanners[currentBannerIndex].total++;

    const newPull = {
      ...pull,
      formattedTime: formatTime(pull.time),
      name: item.name,
      rarity: item.rarity,
      banner: currentBanner,
      start: startBanner,
      at: selectedBanners[currentBannerIndex].total,
    };

    if (item.rarity === 5) {
      selectedBanners[currentBannerIndex].legendary.push(newPull);
      allLegendary.push(newPull);
    } else if (item.rarity === 4) {
      allRare.push(newPull);
      selectedBanners[currentBannerIndex].rarePity[newPull.pity - 1]++;
      if (pull.type === 'character') {
        selectedBanners[currentBannerIndex].rare.character.push(newPull);
      } else if (pull.type === 'weapon') {
        selectedBanners[currentBannerIndex].rare.weapon.push(newPull);
      }
    }

    if (!grouped && pull.time === next.time) {
      striped = !striped;
      newPull.group = 'start';
      grouped = true;
    } else if (grouped && pull.time !== next.time) {
      newPull.group = 'end';
      grouped = false;
    } else if (grouped) {
      newPull.group = 'group';
    } else {
      striped = !striped;
    }

    if (i === pullData.length - 1) {
      newPull.end = true;
    }

    newPull.striped = striped;
    startBanner = false;

    currentPulls.push(newPull);
  }

  return currentPulls;

  // console.log(JSON.stringify(pulls.slice(0, 5).map(e => [e.time.toString(), e.id, e.type, e.pity, e.group === 'group'])));
  // console.log(JSON.stringify(selectedBanners[8].legendary.map(e => [e.time.toString(), e.id, e.type, e.pity, e.group === 'group'])));
  // console.log(JSON.stringify(selectedBanners[8].rarePity));
  // console.log(selectedBanners[8].legendary.length, selectedBanners[8].rare.character.length + selectedBanners[8].rare.weapon.length, selectedBanners[8].total);
}
