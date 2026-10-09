const PUBLIC_SETTING_KEYS = [
  "adsEnabled",
  "cinemaName",
  "defaultTicketPrice",
  "announcementEnabled",
  "announcementText",
  "logoUrl",
  "clubTransparentImages",
  "clubHeroImageUrl",
  "clubBannerImageUrl",
  "eventTransparentImages",
  "eventHeroImageUrl",
  "eventGamesImageUrl",
  "eventPartiesImageUrl",
  "eventCorporateImageUrl",
  "eventGalleryImageUrl",
  "eventStartingPrice"
];

function publicContentSettings(settings = {}) {
  return Object.fromEntries(PUBLIC_SETTING_KEYS
    .filter((key) => Object.prototype.hasOwnProperty.call(settings, key))
    .map((key) => [key, settings[key]]));
}

module.exports = { publicContentSettings };
